/* ===================== FLUJO — views A: resumen, movimientos, cuotas ===================== */

const VIEWS = [
  { id: 'resumen', label: 'Resumen', short: 'Resumen' },
  { id: 'movimientos', label: 'Movimientos', short: 'Gastos' },
  { id: 'cuotas', label: 'Cuotas y fijos', short: 'Cuotas' },
  { id: 'tarjetas', label: 'Tarjetas y pagos', short: 'Tarjetas' },
  { id: 'cartera', label: 'Cartera', short: 'Cartera' },
  { id: 'plan', label: 'Presupuesto e inversión', short: 'Plan' },
  { id: 'tendencias', label: 'Tendencias', short: 'Tendencias' },
  { id: 'config', label: 'Configuración', short: 'Ajustes' },
];
const VIEW_TITLES = {
  resumen: ['Resumen', 'Cómo viene el mes'], movimientos: ['Movimientos', 'Todo lo que gastaste'], cuotas: ['Cuotas y fijos', 'Lo que ya está comprometido'],
  tarjetas: ['Tarjetas y pagos', 'Resúmenes y de dónde sale la plata'], cartera: ['Cartera', 'Tus CEDEARs, valuados hoy'], plan: ['Presupuesto e inversión', 'Cuánto sobra para invertir'], tendencias: ['Tendencias', 'Patrones y evolución'], config: ['Configuración', 'Tu perfil, tarjetas y datos'],
};

const catChip = (catId) => { const c = L.cat(catId); return `<span class="cat-chip"><i style="background:${L.catColor(catId)}"></i>${esc(c.nombre)}</span>`; };
const necBadge = (n) => `<span class="nec nec-${n || 1}" title="${NECESIDAD[n || 1]}">${n || 1}</span>`;
const medioLabel = (m) => m.medio === 'tarjeta' ? (L.tarjeta(m.tarjetaId) ? L.tarjeta(m.tarjetaId).nombre : 'Tarjeta') : (MEDIOS[m.medio] || m.medio || '—').split(' /')[0];
const deltaPill = (cur, prev, invert = false) => { if (!prev) return ''; const d = (cur - prev) / prev; const up = d > 0; const good = invert ? up : !up; return `<b class="${Math.abs(d) < 0.02 ? 'neutral' : good ? 'down' : 'up'}">${up ? '+' : ''}${M.pct(d)}</b>`; };
const kpi = ({ label, value, sub = '', cls = '', spark = '', stats = null, foot = '' }) => `<div class="card kpi ${cls}"><div class="label">${label}</div><div class="value">${value}</div>${stats ? `<div class="mini">${stats.map(x => `<div><span class="k">${x.k}</span><b class="${x.cls || ''}">${x.v}</b></div>`).join('')}</div>` : ''}${sub ? `<div class="delta">${sub}</div>` : ''}${foot ? `<div class="foot">${foot}</div>` : ''}${spark}</div>`;

/* ---------- RESUMEN ---------- */
/** Día de cobro: la app pregunta cuánto cobraste (hasta registrar el mes; "Después" lo posterga hasta mañana) */
function renderCobroBanner() {
  const pend = E.cobroPendiente(); if (!pend.length || Cobro.pospuestoHoy()) return '';
  const ym = pend[pend.length - 1]; const prev = E.sueldo(D.addMonths(ym, -1)); const mes = D.monthName(ym).split(' ')[0];
  return `<div class="callout" style="margin-bottom:14px"><b>¿Cuánto cobraste el ${D.fmt(E.fechaCobro(ym))}?</b><br><span class="small muted">Sueldo de ${mes} · con el número real se recalcula todo.</span><div class="row" style="margin-top:10px;gap:8px"><button class="btn sm primary" data-act="cobro-cargar" data-id="${ym}">Cargar</button>${prev.monto ? `<button class="btn sm" data-act="cobro-igual" data-id="${ym}">Igual: ${M.f(prev.monto)}</button>` : ''}<button class="btn sm ghost" data-act="cobro-later" data-id="${ym}">Después</button></div></div>`;
}
/** Fijos del mes cuyo día ya pasó y no están confirmados: ¿quedaron igual o cambiaron? */
function renderFijosBanner() {
  const ym = D.thisMonth(); const pend = E.fijosPendientes(ym); if (!pend.length || !state.settings.ingreso) return '';
  const tot = sum(pend.map(v => M.toARS(v.monto, v.moneda)));
  return `<div class="callout amber" style="margin-bottom:14px"><b>Fijos de ${D.monthName(ym).split(' ')[0]}: ${pend.length} por confirmar</b><br><span class="small muted">${pend.slice(0, 4).map(v => esc(v.desc)).join(', ')}${pend.length > 4 ? '…' : ''} · ${M.f(tot)} estimados</span><div class="row" style="margin-top:10px;gap:8px"><button class="btn sm primary" data-act="fijos-revisar" data-id="${ym}">Revisar</button></div></div>`;
}
function renderCierreBanner() {
  if (ui.cierreDismiss) return '';
  const hoy = D.today();
  for (const t of state.tarjetas) {
    const cy = E.cycle(t, hoy); const ym = D.ym(cy.cierre);
    if (t.cierres && t.cierres[ym]) continue;
    return `<div class="callout amber" style="margin-bottom:14px"><b>¿Cuándo cierra ${esc(t.nombre)} este período?</b><br><span class="small muted">Estoy estimando el ${D.fmt(cy.cierre, { year: true })}. La fecha exacta cambia un poco cada mes; con la real, cada compra cae en el resumen justo.</span><div class="row" style="margin-top:10px;gap:8px"><button class="btn sm primary" data-act="cierre-ok" data-id="${t.id}|${ym}|${cy.cierre}">Es el ${D.fmt(cy.cierre)}</button><button class="btn sm" data-act="cierre-edit" data-id="${t.id}|${ym}|${cy.cierre}">Otra fecha</button><button class="btn sm ghost" data-act="cierre-later">Después</button></div></div>`;
  }
  return '';
}

function viewResumen() {
  const ym = ui.mes; const isCur = ym === D.thisMonth();
  const c = E.consumo(ym), prev = E.consumo(D.addMonths(ym, -1)), ing = E.ingreso(ym), proj = E.proyeccion(ym);
  if (!state.settings.ingreso && !state.movimientos.length && !state.recurrentes.length) return viewOnboarding();
  const dia = Number(D.today().slice(8, 10));
  const avg = E.promedioAcumulado(ym);
  const avgToDate = avg.vals ? avg.vals[(isCur ? dia : D.daysIn(ym)) - 1] : null;
  const last6 = D.range(D.addMonths(ym, -5), 6).map(m => E.consumo(m).total);
  const margen = E.margen(ym); const mesN = D.monthName(ym).split(' ')[0];
  const projPct = margen.presupuesto ? proj.total / margen.presupuesto : 0; const pres = margen.presupuesto; const comp = margen.fijos + c.cuotas;

  let html = renderCobroBanner() + renderFijosBanner() + renderCierreBanner();
  html += `<div class="grid g-kpi">`;
  html += kpi({ label: `Gastos de ${mesN}`, value: M.f(c.total), sub: `${avgToDate ? deltaPill(c.total, avgToDate) : ''} <span>${avgToDate ? `vs promedio${isCur ? ' al mismo día' : ''} (${avg.n} ${avg.n === 1 ? 'mes' : 'meses'})` : ''} · compras ${M.c(c.compras)}</span>`, spark: Charts.spark(last6), cls: 'hero' });
  html += kpi({ label: isCur ? 'Proyección de cierre' : ym > D.thisMonth() ? 'Estimado (promedio 3 meses)' : 'Cerró el mes en', value: `<span class="${pres && projPct >= 1 ? 'neg' : ''}">${M.f(proj.total)}</span>`, sub: pres ? `<span class="pill ${projPct > 1 ? 'crit' : projPct > 0.85 ? 'warn' : 'good'}">${M.pct(projPct)} del presupuesto</span>${isCur ? `<span>${M.f(proj.pace || 0)}/día · ${proj.restantes} días</span>` : ''}` : '<span>Cargá tu presupuesto en Configuración</span>' });
  html += kpi({ label: `Fijos + cuotas de ${mesN}`, value: M.f(comp), sub: `<span>Fijos ${M.c(margen.fijos)} · ${c.nCuotas} cuota${c.nCuotas === 1 ? '' : 's'} ${M.c(c.cuotas)}</span>${pres ? `<span class="pill ${pctPresu(comp / pres)}">${M.pct(comp / pres)} del presupuesto</span>` : ''}`, cls: 'amber' });
  html += kpi({ label: isCur ? 'Te queda para gastar' : ym < D.thisMonth() ? 'Te quedó sin gastar' : 'Quedará para gastar', value: M.f(margen.queda), sub: pres ? `<span class="pill ${margen.queda < 0 ? 'crit' : margen.queda < pres * 0.1 ? 'warn' : 'good'}">${margen.queda < 0 ? 'te pasaste del presupuesto' : 'presupuesto ' + M.c(pres)}</span>${isCur && margen.restantes ? `<span>${M.f(Math.max(0, margen.queda) / margen.restantes)}/día por ${margen.restantes} días</span>` : ''}` : '<span>Cargá tu presupuesto en Configuración</span>', cls: 'accent' });
  html += `</div>`;

  // ritmo + margen
  const days = D.daysIn(ym); const labels = Array.from({ length: days }, (_, i) => String(i + 1));
  const cum = (agg, upto) => { let a = 0; return labels.map((_, i) => { if (i + 1 > upto) return null; a += (agg.byDay[i + 1] || 0); return a; }); };
  const curVals = cum(c, isCur ? dia : days);
  const avgVals = avg.vals ? avg.vals.slice(0, days) : labels.map(() => null);
  let projVals = labels.map(() => null);
  if (isCur && proj.pace != null) { const base = curVals[dia - 1] || 0; const fijosRest = Math.max(0, proj.fijo - c.fijo); for (let i = dia - 1; i < days; i++) projVals[i] = base + (proj.pace + fijosRest / Math.max(1, proj.restantes)) * (i + 1 - dia); }
  // cruce del presupuesto: el día en que el acumulado real lo pasó, o el día en que lo pasaría al ritmo actual (marca sutil en el gráfico)
  let cruce = null;
  if (pres) { const iReal = curVals.findIndex(v => v != null && v >= pres); const iProj = iReal < 0 ? projVals.findIndex(v => v != null && v >= pres) : -1;
    if (iReal >= 0) cruce = { i: iReal, label: String(iReal + 1), color: 'var(--crit)', pasado: true }; else if (iProj >= 0) cruce = { i: iProj, label: String(iProj + 1), color: 'var(--warn)', pasado: false }; }
  html += `<div class="grid g-21 section">
    <div class="card"><div class="card-head"><h2>Ritmo del mes</h2><span class="hint">${cruce ? `<span class="${cruce.pasado ? 'crit-text' : 'warn-text'}">${cruce.pasado ? `presupuesto cruzado el ${cruce.label}` : `a este ritmo lo cruzás el ${cruce.label}`}</span>` : 'Acumulado por día de compra'}</span></div>
      ${ChartQ.reg(w => Charts.line({ w, labels, h: 230, cruce, tipTitle: i => `Día ${labels[i]}`, refY: margen.presupuesto || null, refLabel: margen.presupuesto ? 'Presupuesto' : '', series: [
        ...(avg.vals ? [{ name: `Promedio ${avg.n} ${avg.n === 1 ? 'mes' : 'meses'}`, color: 'var(--line-2)', values: avgVals }] : []),
        { name: D.monthName(ym).split(' ')[0], color: 'var(--accent)', values: curVals, area: true, strong: true },
        ...(isCur ? [{ name: 'Proyección', color: 'var(--accent)', values: projVals, dashed: true }] : []),
      ] }), 230)}
      ${Charts.legend([{ name: 'Este mes', color: 'var(--accent)', kind: 'line' }, ...(avg.vals ? [{ name: `Promedio (${avg.n} ${avg.n === 1 ? 'mes' : 'meses'})`, color: 'var(--line-2)', kind: 'line' }] : []), ...(isCur ? [{ name: 'Proyección', color: 'var(--accent)', kind: 'dash' }] : [])])}
    </div>
    <div class="card"><div class="card-head"><h2>Cuánto me queda</h2><button class="btn ghost sm" data-go="plan">Plan e inversión ${G.to}</button></div>${renderMargen(margen, proj)}</div>
  </div>`;

  // insights + donut
  const ins = Insights.build(ym);
  const grupos = Object.entries(c.byGrupo).map(([g, v]) => ({ name: L.grupo(g).nombre, value: v, color: L.slotColor(L.grupo(g).slot), id: g })).sort((a, b) => b.value - a.value);
  html += `<div class="grid g-21 section">
    <div class="card"><div class="card-head"><h2>Lectura del mes</h2><span class="hint">Alertas y patrones calculados sobre tus datos</span></div>${renderInsights(ins)}</div>
    <div class="card"><div class="card-head"><h2>Dónde se fue</h2><span class="hint">${D.monthName(ym)}</span></div>
      ${grupos.length ? mapaBloques(grupos.map(g => ({ label: g.name.split(' ')[0], peso: g.value / (c.total || 1), der: M.c(g.value) }))) : empty({ kind: 'periodo', icon: 'cal', head: `Sin gastos en ${D.monthName(ui.mes).split(' ')[0]}`, sub: 'Cuando cargues el primero va a aparecer acá.' })}
    </div>
  </div>`;

  // categorías + horizonte
  const cats = Object.entries(c.byCat).map(([id, v]) => ({ cat: L.cat(id), v, avg: E.promedioCat(id, ym, 3) })).sort((a, b) => b.v - a.v);
  const hz = E.horizonte(D.thisMonth(), 12); const alerta = (Number(state.settings.alertaCuotasPct) || 60) / 100;
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Por categoría</h2><span class="hint">Barra = vs presupuesto o promedio 3 meses</span></div>
      ${cats.length ? cats.slice(0, 9).map(({ cat, v, avg }) => { const ref = cat.presupuesto || avg || v; const r = v / (ref || 1); const sobre = avg > 0 && v > avg * 1.001; return `<div class="meter-row"><div class="l"><span>${esc(cat.nombre)}</span>${cat.presupuesto ? `<span class="pill ${r > 1 ? 'crit' : r > .8 ? 'warn' : 'neutral'}" style="font-size:10.5px">${M.pct(r)}</span>` : ''}</div><div class="v"><b class="mono">${M.f(v)}</b>${cat.presupuesto ? ` <span class="muted">/ ${M.c(cat.presupuesto)}</span>` : avg ? ` <span class="muted">prom. ${M.c(avg)}</span>` : ''}</div><div class="meter neutral ${sobre ? 'warn' : ''}"><i style="width:${clamp(r * 100, 2, 100)}%"></i>${!cat.presupuesto && avg ? `<span class="mark" style="left:${clamp(avg / Math.max(v, avg) * 100, 0, 100)}%"></span>` : ''}</div></div>`; }).join('') : empty({ kind: 'periodo', icon: 'cal', head: `Sin gastos en ${D.monthName(ui.mes).split(' ')[0]}`, sub: 'Cuando cargues el primero va a aparecer acá.' })}
    </div>
    <div class="card"><div class="card-head"><h2>Próximos 12 meses</h2><span class="hint">Fijos + cuotas ya comprometidos vs presupuesto</span></div>
      ${ChartQ.reg(w => Charts.stacked({ w, h: 230, labels: hz.map(h => D.monthName(h.ym, true)), series: [{ name: 'Fijos', color: 'var(--c1)', values: hz.map(h => h.fijos) }, { name: 'Cuotas', color: 'var(--c4)', values: hz.map(h => h.cuotas) }], line: { name: 'Presupuesto', color: 'var(--ink-2)', values: hz.map(h => h.presupuesto || null) }, thresholdPct: alerta }), 230)}
      ${Charts.legend([{ name: 'Fijos', color: 'var(--c1)' }, { name: 'Cuotas', color: 'var(--c4)' }, { name: 'Presupuesto', color: 'var(--ink-2)', kind: 'dash' }, { name: `Alerta ${M.pct(alerta)}`, color: 'var(--warn)', kind: 'dash' }])}
    </div>
  </div>`;

  // últimas compras (solo lo cargado a mano en el mes visto: sin fijos ni cuotas)
  const last = state.movimientos.filter(m => !m.recId && m.fecha.startsWith(ym)).slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.id > a.id ? 1 : -1));
  html += `<div class="card section"><div class="card-head"><h2>Últimas compras</h2><div class="row" style="gap:8px"><span class="hint">Sin fijos ni cuotas</span><button class="btn ghost sm" data-go="movimientos">Ver todo el mes ${G.to}</button></div></div>${renderMovTable(last, { compact: true })}</div>`;
  return html;
}

function renderMargen(mg, proj) {
  if (!mg.presupuesto) return empty({ kind: 'setup', icon: 'chart', head: 'Falta tu presupuesto mensual', sub: 'Definilo y Gastos te avisa cuánto te queda por día y cuándo lo vas a cruzar.', btn: 'Definir presupuesto', go: 'config' });
  const isCur = mg.ym === D.thisMonth();
  const rows = [
    ['Presupuesto del mes', mg.presupuesto, 'in'],
    ['Fijos', -mg.fijos, 'var(--c1)'],
    ['Cuotas del mes', -mg.cuotas, 'var(--c4)'],
    [isCur ? 'Compras hasta hoy' : 'Compras', -mg.compras, 'var(--c7)'],
  ];
  let acc = 0; const maxV = Math.max(mg.presupuesto, mg.fijos + mg.cuotas + mg.compras, 1);
  const wf = rows.map(([l, v, color]) => { let left, width; if (color === 'in') { left = 0; width = v / maxV * 100; acc = v; } else { const from = acc; acc += v; left = Math.max(0, acc) / maxV * 100; width = (Math.max(from, 0) - Math.max(acc, 0)) / maxV * 100; } return `<div class="wf"><span>${l}</span><div class="bar"><i style="left:${left}%;width:${width}%;background:${color === 'in' ? 'var(--line-2)' : color}"></i></div><span class="n">${v < 0 ? '−' : ''}${M.f(Math.abs(v))}</span></div>`; }).join('');
  return `<div style="font-family:var(--font-display);font-size:30px;font-weight:900;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:${mg.queda < 0 ? 'var(--crit-text)' : 'var(--ink)'}">${M.f(mg.queda)}</div>
    <p class="small muted" style="margin:2px 0 12px">${mg.queda < 0 ? 'Ya te pasaste del presupuesto del mes.' : isCur ? `Podés gastar hasta ahí en lo que queda de ${D.monthName(mg.ym).split(' ')[0]}.` : 'Lo que quedó del presupuesto después de fijos, cuotas y compras.'}</p>
    <div class="waterfall">${wf}<div class="wf total"><span>Queda</span><div class="bar"><i style="left:0;width:${clamp(Math.max(0, mg.queda) / maxV * 100, 0, 100)}%;background:var(--accent)"></i></div><span class="n">${M.f(mg.queda)}</span></div></div>
    ${isCur && proj && proj.pace != null ? `<div class="callout ${mg.quedaProj < 0 ? 'crit' : ''}" style="margin-top:12px">Al ritmo actual (${M.f(proj.pace)}/día en compras) cerrás el mes ${mg.quedaProj < 0 ? `<b>${M.f(-mg.quedaProj)}</b> por encima del presupuesto.` : `con <b>${M.f(mg.quedaProj)}</b> sin usar.`}</div>` : ''}
    ${mg.ingreso ? `<p class="small muted" style="margin-top:10px">Sueldo ${M.f(mg.ingreso)} − presupuesto ${M.f(mg.presupuesto)} = <b>${M.f(mg.ahorro)}</b> para invertir / ahorrar.</p>` : ''}`;
}

function renderInsights(list) {
  if (!list.length) return empty({ kind: 'periodo', icon: 'list', head: 'Todo en orden', sub: 'Cuando algo se salga de lo normal lo vas a ver acá.' });
  return list.map(i => `<div class="insight ${i.level}"><div class="ic">${ICONS[i.icon] || ICONS.spark}</div><div><div class="t">${esc(i.title)}</div><p>${esc(i.text)}${i.view ? ` <a href="#" data-go="${i.view}">Ver ${G.to}</a>` : ''}${i.action === 'detectar' ? ` <a href="#" data-act="detectar">Revisar ${G.to}</a>` : ''}</p></div></div>`).join('');
}

function viewOnboarding() {
  return `<div class="onboard fade">
    <div class="hero"><div class="eyebrow">Bienvenido</div><h1>¿Cuánto te queda este mes?</h1><p>La app sigue lo que gastás con tarjeta, te dice en qué resumen cae cada compra, cuánto ya tenés comprometido en cuotas y cuánto te queda para invertir.</p></div>
    <div class="card"><div class="card-head"><h2>Arranquemos con lo básico</h2></div>
      <div class="form-grid">
        <div class="field"><label>Sueldo neto mensual (ARS)</label><input class="input" id="ob-ingreso" inputmode="numeric" placeholder="2.500.000"></div>
        <div class="field"><label>Dólar MEP de referencia</label><input class="input" id="ob-tc" inputmode="numeric" value="${state.settings.tc}"></div>
        <div class="field"><label>Tarjeta 1 · nombre</label><input class="input" id="ob-t1" placeholder="Visa Galicia"></div>
        <div class="field"><label>Cierre / vencimiento (día del mes)</label><div class="row" style="flex-wrap:nowrap"><input class="input" id="ob-t1c" inputmode="numeric" value="20"><input class="input" id="ob-t1v" inputmode="numeric" value="5"></div></div>
        <div class="field"><label>Tarjeta 2 · nombre (opcional)</label><input class="input" id="ob-t2" placeholder="Mastercard Santander"></div>
        <div class="field"><label>Cierre / vencimiento</label><div class="row" style="flex-wrap:nowrap"><input class="input" id="ob-t2c" inputmode="numeric" value="22"><input class="input" id="ob-t2v" inputmode="numeric" value="8"></div></div>
        <div class="field"><label>Cuánto querés gastar por mes (presupuesto)</label><input class="input" id="ob-pres" inputmode="numeric" placeholder="1.600.000"></div>
      </div>
      <div class="row between" style="margin-top:16px"><button class="btn" data-act="demo">Ver con datos de ejemplo</button><button class="btn primary" data-act="onboard">Empezar</button></div>
      <p class="small muted" style="margin-top:10px">Todo se guarda en esta página. Podés cambiar cualquier cosa después desde Configuración.</p>
    </div></div>`;
}

/* ---------- MOVIMIENTOS ---------- */
function renderMovTable(movs, opts = {}) {
  if (!movs.length) return opts.compact
    ? empty({ kind: 'periodo', icon: 'cal', head: `Sin compras en ${D.monthName(ui.mes).split(' ')[0]}`, sub: 'Las compras sueltas del mes aparecen acá, sin los fijos ni las cuotas.' })
    : empty({ kind: 'filtro', icon: 'search', head: 'Ningún movimiento coincide', sub: 'Probá ampliando el período o sacando alguna categoría.', btn: 'Limpiar filtros', action: 'clear-filters', ghost: true });
  const s = ui.sort; const key = s.key;
  const val = m => key === 'monto' ? E.rowAmount(m) : key === 'cat' ? L.cat(m.catId).nombre : key === 'nec' ? (m.necesidad || 1) : key === 'desc' ? norm(m.desc) : m.fecha + (m.id || '');
  const rows = opts.compact ? movs : movs.slice().sort((a, b) => { const va = val(a), vb = val(b); return (va > vb ? 1 : va < vb ? -1 : 0) * s.dir; });
  const th = (k, label, cls = '') => opts.compact ? `<th class="${cls}">${label}</th>` : `<th class="${cls} ${key === k ? 'sorted' : ''}" data-sort="${k}">${label}${key === k ? (s.dir > 0 ? ' ' + G.up : ' ' + G.down) : ''}</th>`;
  return `<div class="table-wrap"><table class="responsive ${!opts.compact && key === 'fecha' ? 'grouped' : ''}"><thead><tr>${th('fecha', 'Fecha')}${th('desc', 'Descripción')}${th('cat', 'Categoría')}<th>Medio</th>${th('nec', 'Nec.')}${th('monto', 'Monto', 'r')}<th></th></tr></thead><tbody>
  ${rows.map((m, i) => { const ars = E.rowAmount(m); const dayHead = !opts.compact && key === 'fecha' && (i === 0 || rows[i - 1].fecha !== m.fecha) ? `<tr class="day"><td colspan="7">${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][D.dow(m.fecha)]} ${D.fmt(m.fecha)}<span>${M.f(sum(rows.filter(x => x.fecha === m.fecha).map(E.rowAmount)))}</span></td></tr>` : ''; const total = M.toARS(m.monto, m.moneda); const cuotas = (m.cuotas || 1) > 1; const t = L.tarjeta(m.tarjetaId); const pago = m.medio === 'tarjeta' && t && !m.cuotaRow ? E.primerPago(m) : null;
    return dayHead + `<tr class="${m.virtual ? 'virtual' : ''} ${m.cuotaRow ? 'cuota' : ''}" data-id="${m.id}">
      <td class="keep mono muted fecha" style="white-space:nowrap">${D.fmt(m.fecha)}</td>
      <td class="keep"><div class="mrow"><div><b style="font-weight:500">${esc(m.desc)}</b>${m.cuotaRow ? ` <span class="tag" title="Cuota de una compra anterior">cuota ${m.cuotaIdx}/${m.cuotaN}</span>` : cuotas ? ` <span class="tag">1/${m.cuotas} cuotas</span>` : ''}${m.recId ? ` <span class="tag" title="Gasto fijo">${m.virtual ? 'fijo estimado' : 'fijo'}</span>` : ''}<span class="sub">${m.cuotaRow ? `Compra del ${D.fmt(state.movimientos.find(x => x.id === m.origId)?.fecha || m.fecha, { year: true })} · ${medioLabel(m)}` : pago ? `Resumen ${D.monthName(pago, true)}` : medioLabel(m)}${m.moneda === 'USD' ? ` · ${M.orig(m)}` : ''}${m.notas && !m.cuotaRow ? ` · ${esc(m.notas)}` : ''}</span></div><div class="mob">${necBadge(m.necesidad)}<span class="mono">${M.f(ars)}</span></div></div></td>
      <td>${catChip(m.catId)}</td><td class="small">${esc(medioLabel(m))}</td><td>${necBadge(m.necesidad)}</td>
      <td class="amount r">${M.f(ars)}${cuotas && !m.cuotaRow ? `<span class="sub">total ${M.f(total)}</span>` : ''}</td>
      <td class="r" style="white-space:nowrap">${m.virtual ? `<button class="btn sm" data-act="confirmar" data-id="${m.id}" title="Cargar el monto real de este mes">Confirmar</button>` : m.cuotaRow ? `<span class="row-actions"><button class="mini-btn" data-act="edit" data-id="${m.origId}" title="Ver la compra original">${ICONS.edit}</button></span>` : `<span class="row-actions"><button class="mini-btn" data-act="edit" data-id="${m.id}" title="Editar">${ICONS.edit}</button><button class="mini-btn" data-act="dup" data-id="${m.id}" title="Duplicar">${ICONS.copy}</button><button class="mini-btn" data-act="del" data-id="${m.id}" title="Borrar">${ICONS.trash}</button></span>`}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

function viewMovimientos() {
  const ym = ui.mes; const f = ui.filtros; const c = E.consumo(ym);
  let movs = c.movs;
  if (f.q) { const q = norm(f.q); movs = movs.filter(m => norm(m.desc).includes(q) || norm(m.notas || '').includes(q)); }
  if (f.cat) movs = movs.filter(m => m.catId === f.cat);
  if (f.grupo) movs = movs.filter(m => L.cat(m.catId).grupo === f.grupo);
  if (f.medio) movs = movs.filter(m => f.medio.startsWith('t:') ? m.tarjetaId === f.medio.slice(2) : m.medio === f.medio);
  if (f.nec) movs = movs.filter(m => String(m.necesidad || 1) === f.nec);
  if (f.tipo === 'fijos') movs = movs.filter(m => m.recId); else if (f.tipo === 'variables') movs = movs.filter(m => !m.recId && !m.cuotaRow); else if (f.tipo === 'cuotas') movs = movs.filter(m => m.cuotaRow || (m.cuotas || 1) > 1);
  const total = sum(movs.map(E.rowAmount)); const innec = sum(movs.filter(m => (m.necesidad || 1) === 3).map(E.rowAmount));
  const sel = (id, opts, cur, ph) => `<select class="input sm" data-filter="${id}"><option value="">${ph}</option>${opts.map(o => `<option value="${o[0]}" ${cur === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  return `<div class="card">
    <div class="filters">
      <input class="input sm" style="min-width:180px;flex:1" placeholder="Buscar…" data-filter="q" value="${esc(f.q || '')}">
      ${sel('cat', state.categorias.map(c => [c.id, c.nombre]), f.cat, 'Todas las categorías')}
      ${sel('medio', [['tarjeta', 'Tarjeta (todas)'], ...state.tarjetas.map(t => ['t:' + t.id, t.nombre]), ['debito', 'Débito'], ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia / MP']], f.medio, 'Todos los medios')}
      ${sel('nec', [['1', 'Necesario'], ['2', 'Útil'], ['3', 'Innecesario']], f.nec, 'Necesidad')}
      ${sel('tipo', [['variables', 'Solo compras'], ['fijos', 'Solo fijos'], ['cuotas', 'Solo cuotas']], f.tipo, 'Todo (compras, fijos, cuotas)')}
      ${Object.values(f).some(Boolean) ? '<button class="btn ghost sm" data-act="clear-filters">Limpiar</button>' : ''}
    </div>
    <div class="row between small muted" style="margin-bottom:8px"><span>${movs.length} movimientos · <b class="mono" style="color:var(--ink)">${M.f(total)}</b></span><span>Innecesario: <b class="mono">${M.f(innec)}</b> (${M.pct(innec / (total || 1))})</span></div>
    ${renderMovTable(movs)}
    <p class="small muted" style="margin-top:10px">Cada mes muestra sus compras, sus fijos y las cuotas de compras anteriores que caen en él (monto de la cuota, no el total). Las filas con borde ámbar son fijos estimados: tocá <b>Confirmar</b> para cargar el monto real. <kbd>N</kbd> abre un gasto nuevo.</p>
  </div>`;
}

/* ---------- CUOTAS Y FIJOS ---------- */
function viewCuotas() {
  const ym = D.thisMonth(); const next = D.addMonths(ym, 1);
  const hz = E.horizonte(ym, 12); const alerta = (Number(state.settings.alertaCuotasPct) || 60) / 100;
  const act = E.cuotasActivas(ym); const fNext = hz[1];
  const restante = sum(act.map(a => a.restante));
  const recs = state.recurrentes.slice().sort((a, b) => M.toARS(b.monto, b.moneda) - M.toARS(a.monto, a.moneda));
  const fijosMes = sum(recs.filter(r => r.activo !== false).map(r => M.toARS(r.monto, r.moneda)));
  let html = `<div class="grid g-kpi">
    ${kpi({ label: `Fijos + cuotas en ${D.monthName(next).split(' ')[0]}`, value: M.f(fNext.comprometido), sub: fNext.ingreso ? `<span class="pill ${pctPresu(fNext.pct)}">${M.pct(fNext.pct)} del presupuesto</span>` : '', cls: 'amber' })}
    ${kpi({ label: 'Gastos fijos por mes', value: M.f(fijosMes), sub: `<span>${recs.filter(r => r.activo !== false).length} recurrentes activos</span>` })}
    ${kpi({ label: 'Planes de cuotas activos', value: String(act.length), sub: `<span>${M.f(sum(act.map(a => a.cuota)))} por mes</span>` })}
    ${kpi({ label: 'Deuda restante en cuotas', value: M.f(restante), sub: act.length ? `<span>última cuota ${D.monthName(act[act.length - 1].last, true)}</span>` : '' })}
  </div>`;
  html += `<div class="card section"><div class="card-head"><h2>Carga mensual de los próximos 12 meses</h2><span class="hint">Lo que ya sabés que vas a pagar, contra tu presupuesto</span></div>
    ${ChartQ.reg(w => Charts.stacked({ w, h: 250, labels: hz.map(h => D.monthName(h.ym, true)), series: [{ name: 'Fijos', color: 'var(--c1)', values: hz.map(h => h.fijos) }, { name: 'Cuotas', color: 'var(--c4)', values: hz.map(h => h.cuotas) }, { name: 'Compras', color: 'var(--line-2)', values: hz.map(h => h.nuevo) }], line: { name: 'Presupuesto', color: 'var(--ink-2)', values: hz.map(h => h.presupuesto || null) }, thresholdPct: alerta }), 250)}
    ${Charts.legend([{ name: 'Fijos', color: 'var(--c1)' }, { name: 'Cuotas', color: 'var(--c4)' }, { name: 'Compras del mes', color: 'var(--line-2)' }, { name: 'Presupuesto', color: 'var(--ink-2)', kind: 'dash' }, { name: `Umbral ${M.pct(alerta)}`, color: 'var(--warn)', kind: 'dash' }])}
    <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Mes</th><th class="r">Fijos</th><th class="r">Cuotas</th><th class="r">Fijos + cuotas</th><th class="r">% presup.</th><th class="r">Libre para compras</th></tr></thead><tbody>
      ${hz.map(h => `<tr><td style="text-transform:capitalize">${D.monthName(h.ym)}</td><td class="amount r">${M.f(h.fijos)}</td><td class="amount r">${M.f(h.cuotas)}</td><td class="amount r"><b>${M.f(h.comprometido)}</b></td><td class="r">${h.presupuesto ? `<span class="pill ${pctPresu(h.pct)}">${M.pct(h.pct)}</span>` : '—'}</td><td class="amount r">${h.presupuesto ? M.f(h.libre) : '—'}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Cuotas en curso</h2><span class="hint">${act.length} planes</span></div>
      ${act.length ? act.map(a => `<div class="cuota-row"><div><b style="font-weight:500">${esc(a.m.desc)}</b> <span class="progress-pill">${a.idxPeriodo}/${a.n}</span></div><div class="amt">${M.f(a.cuota)}<span class="muted"> /mes</span></div><div class="sub">${L.cat(a.m.catId).nombre} · ${medioLabel(a.m)}${a.cierre && a.idxPeriodo <= a.n ? ` · la ${a.idxPeriodo}/${a.n} cierra el ${D.fmt(a.cierre)}` : ''} · termina ${D.monthName(a.last, true)} · faltan ${M.f(a.restante)}</div><div class="meter"><i style="width:${a.idxPeriodo / a.n * 100}%;background:var(--c4)"></i></div></div>`).join('') : empty({ kind: 'periodo', icon: 'cal', head: 'Ninguna cuota activa', sub: 'Las compras en cuotas aparecen acá con cuántas van y cuánto falta.' })}
    </div>
    <div class="card"><div class="card-head"><h2>Simulador: ¿me conviene sacar cuotas?</h2></div>
      <div class="form-grid">
        <div class="field"><label>Monto total</label><input class="input" id="sim-monto" inputmode="numeric" placeholder="600.000"></div>
        <div class="field"><label>Cuotas</label><input class="input" id="sim-cuotas" inputmode="numeric" value="6"></div>
        <div class="field"><label>Tarjeta</label><select class="input" id="sim-tarjeta">${state.tarjetas.map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}<option value="">Débito / contado</option></select></div>
        <div class="field"><label>Mes de compra</label><input class="input" id="sim-mes" type="month" value="${ym}"></div>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="simular">Simular</button><span class="small muted">Compara contra lo que ya tenés comprometido.</span></div>
      <div id="sim-out" class="section"></div>
    </div>
  </div>`;
  const det = Smart.detectarRecurrentes();
  html += `<div class="card section"><div class="card-head"><h2>Gastos fijos y suscripciones</h2><button class="btn sm" data-act="new-rec">${ICONS.plus} Nuevo fijo</button></div>
    ${det.length ? `<div class="callout amber" style="margin-bottom:12px"><b>Se repiten todos los meses:</b> ${det.map(d => `<button class="btn sm" style="margin:3px 4px 0 0" data-act="rec-from" data-id="${d.m.id}">${esc(d.desc)} · ~${M.c(d.avg)}</button>`).join('')}<div class="small muted" style="margin-top:6px">Tocá uno para convertirlo en gasto fijo y que entre en el pronóstico.</div></div>` : ''}
    ${recs.length ? `<div class="table-wrap"><table class="responsive"><thead><tr><th>Concepto</th><th>Categoría</th><th>Medio</th><th>Día</th><th class="r">Monto / mes</th><th></th></tr></thead><tbody>${recs.map(r => `<tr data-rec="${r.id}" style="cursor:pointer;${r.activo === false ? 'opacity:.5' : ''}">
      <td class="keep"><div class="mrow"><div><b style="font-weight:500">${esc(r.desc)}</b>${r.activo === false ? ' <span class="tag">pausado</span>' : ''}<span class="sub">${L.cat(r.catId).nombre} · ${medioLabel(r)} · día ${r.dia || 1}${r.hasta ? ` · hasta ${D.monthName(r.hasta, true)}` : ''}</span></div><div class="mob"><span class="mono">${M.f(M.toARS(r.monto, r.moneda))}</span></div></div></td>
      <td>${catChip(r.catId)}</td><td class="small">${esc(medioLabel(r))}</td><td class="mono">${r.dia || 1}</td><td class="amount r">${M.f(M.toARS(r.monto, r.moneda))}${r.moneda === 'USD' ? `<span class="sub">${M.orig(r)}</span>` : ''}</td>
      <td class="r" style="white-space:nowrap"><span class="row-actions"><button class="mini-btn" data-act="edit-rec" data-id="${r.id}" title="Editar">${ICONS.edit}</button><button class="mini-btn" data-act="toggle-rec" data-id="${r.id}" title="${r.activo === false ? 'Reactivar' : 'Pausar'}">${ICONS.clock}</button><button class="mini-btn" data-act="del-rec" data-id="${r.id}" title="Borrar">${ICONS.trash}</button></span></td></tr>`).join('')}</tbody></table></div>` : empty({ kind: 'setup', icon: 'list', head: 'Todavía no cargaste gastos fijos', sub: 'Alquiler, seguro, suscripciones. Una vez cargados el pronóstico los descuenta solo.', btn: 'Agregar gasto fijo', action: 'new-rec' })}
  </div>`;
  return html;
}

function renderSimulacion(res, monto) {
  if (!res.length) return '';
  const peor = res.slice().sort((a, b) => b.pct - a.pct)[0]; const alertas = res.filter(r => r.alerta);
  return `<div class="callout ${alertas.length ? 'crit' : ''}" style="margin-bottom:10px">${alertas.length ? `<b>Ojo:</b> ${alertas.length} de ${res.length} meses quedarían con más de ${M.pct((state.settings.alertaCuotasPct || 60) / 100)} del presupuesto comprometido. El peor es ${D.monthName(peor.ym)} con ${M.pct(peor.pct)}.` : `<b>Entra cómodo.</b> El mes más cargado sería ${D.monthName(peor.ym)} con ${M.pct(peor.pct)} del presupuesto comprometido.`}</div>
  <div class="sim-result"><div class="box"><div class="l">Cuota mensual</div><div class="v">${M.f(res[0].cuota)}</div></div><div class="box"><div class="l">Última cuota</div><div class="v">${D.monthName(res[res.length - 1].ym, true)}</div></div><div class="box"><div class="l">Libre en el peor mes</div><div class="v" style="color:${peor.libre < 0 ? 'var(--crit-text)' : 'inherit'}">${M.f(peor.libre)}</div></div></div>
  <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Mes</th><th class="r">Antes</th><th class="r">Con la compra</th><th class="r">% ingreso</th></tr></thead><tbody>${res.map(r => `<tr><td>${D.monthName(r.ym, true)}</td><td class="amount r">${M.f(r.antes)}</td><td class="amount r">${M.f(r.despues)}</td><td class="r"><span class="pill ${r.alerta ? 'crit' : r.pct > 0.25 ? 'warn' : 'good'}">${M.pct(r.pct)}</span></td></tr>`).join('')}</tbody></table></div>`;
}
