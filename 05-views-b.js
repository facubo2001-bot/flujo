/* ===================== FLUJO — views B: tarjetas, plan, tendencias, config ===================== */

const CARD_COLORS = ['#1F4E79', '#5B2C6F', '#7A3E1D', '#1E5E4A', '#3B3B6B', '#7A1F3D'];
/** Los colores de tarjeta se eligieron para un degrade de fondo; como punto de 8 px sobre negro
 *  no se ven. Cada uno tiene su equivalente luminoso para el punto y el swatch. */
const CARD_DOT = { '#1F4E79': '#2F6FD0', '#5B2C6F': '#8E5BD0', '#7A3E1D': '#D07A3A', '#1E5E4A': '#2FA98A', '#3B3B6B': '#6C63C7', '#7A1F3D': '#D0446F' };
const cardDot = c => CARD_DOT[String(c || '').toUpperCase()] || c || 'var(--ink-3)';

/* ---------- TARJETAS Y PAGOS ---------- */
function viewTarjetas() {
  const hoy = D.today(); const ym = ui.mes;
  if (!state.tarjetas.length) return `<div class="card">${empty({ kind: 'setup', icon: 'card', head: 'Todavía no cargaste tarjetas', sub: 'Agregá la primera y Gastos calcula solo el cierre, las cuotas y cuánto pagás cada mes.', btn: 'Agregar tarjeta', action: 'new-card' })}</div>`;
  const kARS = v => `$ ${abrevARS(v)}`;
  const sinCuotas = d => String(d || '').replace(/,\s*\d+\s*cuotas?\)/i, ')').replace(/\s*\(\s*\d+\s*cuotas?\s*\)\s*$/i, '');
  // --- tarjetas: mismo formato que las de Cartera (numero grande + tres filas + pie)
  let html = `<div class="grid g-kpi">`;
  state.tarjetas.forEach((t, i) => {
    const now = E.cardNow(t, hoy);
    const consumoPeriodo = sum(E.data().pieces.filter(p => p.m.medio === 'tarjeta' && p.m.tarjetaId === t.id && p.mesPago === now.mesPago && p.idx === 1 && !p.m.recId).map(p => p.montoARS));
    const prox = E.proximoPago(t, hoy);
    const cerrando = E.resumen(t.id, now.mesPago);
    const lim = Number(t.limite) || 0; const uso = lim ? (prox.ym === now.mesPago ? cerrando.total : prox.total + cerrando.total) / lim : 0;
    const stats = [{ k: 'Nuevo', v: kARS(consumoPeriodo) }, { k: 'Cuotas', v: kARS(cerrando.total - consumoPeriodo) }];
    if (prox.ym !== now.mesPago) stats.push({ k: 'A pagar', v: kARS(prox.total), cls: 'mid' });
    if (lim) stats.push({ k: 'L\u00edmite', v: M.pct(uso, 0), cls: uso >= 0.85 ? 'neg' : uso >= 0.6 ? 'mid' : 'pos' });
    const esSel = (ui.resCard || state.tarjetas[0].id) === t.id;
    html += `<div class="card kpi tap ${esSel ? 'sel' : ''}" data-act="tj-sel" data-id="${t.id}"><div class="label"><i class="bankdot" style="background:${cardDot(t.color || CARD_COLORS[i % CARD_COLORS.length])}"></i>${esc(t.nombre)}</div><div class="value">${M.f(cerrando.total)}</div>
      <div class="mini">${stats.map(x => `<div><span class="k">${x.k}</span><b class="${x.cls || ''}">${x.v}</b></div>`).join('')}</div>
      <div class="foot">${prox.ym !== now.mesPago ? `pag\u00e1s el ${D.fmt(prox.fecha)} \u00b7 ` : ''}cierra en ${now.diasAlCierre} d\u00eda${now.diasAlCierre === 1 ? '' : 's'}</div></div>`;
  });
  html += `</div><button class="tj-add" data-act="new-card">${ICONS.plus} Agregar tarjeta</button>`;

  // --- solo lo que va en cada tarjeta (Facu: plan de pago y cuentas no hacen falta). Tocar una tarjeta la elige.
  const tSel = state.tarjetas.find(t => t.id === ui.resCard) || state.tarjetas[0];
  const mSel = ui.resMes || E.cardNow(tSel, hoy).mesPago;
  html += `<div class="card section"><div class="card-head"><h2>Qu\u00e9 va en ${esc(tSel.nombre)}</h2><button class="btn sm ghost" data-act="edit-card" data-id="${tSel.id}">${ICONS.edit} Editar</button></div>
    <div class="tp-sels"><select class="tp-sel" id="res-mes">${D.range(D.addMonths(ym, -2), 8).map(m => `<option value="${m}" ${mSel === m ? 'selected' : ''}>cierre ${D.fmt(E.fechaCierre(tSel.id, m))}</option>`).join('')}</select></div>
    <div id="res-detalle">${renderResumenDetalle(tSel.id, mSel)}</div>
  </div>`;
  return html;
}

function renderResumenDetalle(tarjetaId, ym) {
  const r = E.resumen(tarjetaId, ym);
  if (!r.pieces.length) return empty({ kind: 'periodo', icon: 'cal', head: 'Sin consumos en este resumen', sub: 'Los que hagas antes del cierre aparecen ac\u00e1.' });
  const rows = r.pieces.slice().sort((a, b) => a.m.fecha.localeCompare(b.m.fecha));
  const cuotas = sum(rows.filter(p => p.idx > 1).map(p => p.montoARS));
  const sinCuotas = d => String(d || '').replace(/,\s*\d+\s*cuotas?\)/i, ')').replace(/\s*\(\s*\d+\s*cuotas?\s*\)\s*$/i, '');
  return `<div class="tp-sum">vence ${D.fmt(r.fecha)} \u00b7 ${rows.length} \u00edtems \u00b7 cuotas anteriores ${M.f(cuotas)}</div>
    <div class="mlist">${rows.map(p => `<div class="mv"><div style="min-width:0"><div class="m1"><b>${esc(sinCuotas(p.m.desc))}</b></div><div class="m2">${['compra ' + D.fmt(p.m.fecha), p.n > 1 ? `cuota ${p.idx}/${p.n}` : '', p.m.recId ? 'fijo' : ''].filter(Boolean).join(' \u00b7 ')}</div></div><div class="mm">${M.f(p.montoARS)}</div></div>`).join('')}</div>`;
}

/* ---------- PLAN: presupuesto e inversión ---------- */
/** Proyeccion: patrimonio de hoy + aporte mensual, a tres ritmos de retorno (Facu: "cantidad de guita estimada para el anio que viene y asi") */
function proyeccionCard() {
  const k = E.cartera(); const pt = E.patrimonio(k); const v0 = pt.total || k.valor || 0; if (!(v0 > 0)) return '';
  const ap = E.aporteMensual(k); const auto = Math.max(0, Math.round(ap.mensual)); const aporte = state.settings.proyAporte != null ? Number(state.settings.proyAporte) : auto;
  const tir = k.ventanas.inicio && k.ventanas.inicio.disponible ? k.ventanas.inicio.rend.tirRealDiv : null;
  const esc3 = [{ k: 'Prudente', r: 0.06, c: 'var(--ink-3)' }, { k: 'S&P 500 hist\u00f3rico', r: 0.10, c: 'var(--accent)' }, ...(tir != null && tir > 0 ? [{ k: 'Tu ritmo', r: tir, c: 'var(--warn-text)' }] : [])];
  const N = 20; const series = esc3.map(e => ({ ...e, v: E.proyectar(v0, aporte, e.r, N) }));
  const puesto = Array.from({ length: N + 1 }, (_, i) => v0 + aporte * 12 * i);
  const f0 = x => fmtU(x, 0); const filas = [1, 2, 3, 5, 10, 20];
  const base = series[1]; const renta = x => x * 0.04 / 12;
  const n0 = x => Math.round(x).toLocaleString('es-AR');
  const tabla = `<div class="table-wrap"><table class="proy"><thead><tr><th>En US$</th>${series.map(e => `<th class="r">${e.k === 'S&P 500 hist\u00f3rico' ? 'S&amp;P 500' : e.k}<small>${(e.r * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} % anual</small></th>`).join('')}</tr></thead><tbody>
    ${filas.map(n => `<tr><td>${Number(D.today().slice(0, 4)) + n}<small>sin rendir ${n0(puesto[n])}</small></td>${series.map((e, i) => `<td class="r ${i === 1 ? 'b' : ''}">${n0(e.v[n])}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;
  const labels = Array.from({ length: 11 }, (_, i) => i ? `+${i}` : 'hoy');
  const chart = ChartQ.reg(w => Charts.line({ w, h: 200, labels, tipTitle: i => i ? `En ${i} a\u00f1o${i > 1 ? 's' : ''}` : 'Hoy', tipFmt: x => f0(x),
    yFmt: x => MENOS(Math.abs(x) >= 1000 ? (x / 1000).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' k' : Math.round(x).toString()),
    series: [{ name: 'Sin rendir', color: 'var(--ink-3)', values: puesto.slice(0, 11), dashed: true }, ...series.map((e, i) => ({ name: e.k, color: e.c, values: e.v.slice(0, 11), strong: i === 1 }))] }), 200)
    + Charts.legend([...series.map(e => ({ name: e.k, color: e.c, kind: 'line' })), { name: 'Sin rendir (hoy + aportes)', color: 'var(--ink-3)', kind: 'dash' }]);
  const info = infoBtn(`Parte de todo tu patrimonio de hoy (CEDEARs, fondo, bitcoin y caja: ${f0(v0)}) y le suma cada mes el aporte. El aporte autom\u00e1tico es la plata nueva que entr\u00f3 en los \u00faltimos ${Math.round(ap.meses)} meses (compras menos ventas de CEDEARs ${f0(ap.ced)} + dep\u00f3sitos al fondo ${f0(ap.fondo)} al CCL de cada d\u00eda): ${f0(ap.mensual)} por mes. Reinvertir ventas o dividendos no cuenta como plata nueva. Retornos: 6 % prudente, 10 % lo que hist\u00f3ricamente rindi\u00f3 el S&P 500 con dividendos, y tu TIR real de CEDEARs con dividendos${tir != null ? ` (${(tir * 100).toFixed(1)} %)` : ''}, que es dif\u00edcil de sostener muchos a\u00f1os. Todo en d\u00f3lares de hoy sin descontar inflaci\u00f3n de EE.UU. (~2-3 % por a\u00f1o) ni impuestos. La renta es la regla del 4 %: lo que podr\u00edas retirar por a\u00f1o sin comerte el capital.`);
  return `<div class="card section"><div class="card-head"><h2>Proyecci\u00f3n de tu patrimonio ${info}</h2></div>
    <div class="proy-top"><div><span class="small muted">Hoy</span><b>${f0(v0)}</b></div>
      <label class="proy-ap"><span class="small muted">Aporte por mes</span><span class="row" style="gap:4px;align-items:center">US$ <input id="proy-ap" class="input sm mono" inputmode="decimal" value="${aporte}" style="width:84px"></span><span class="small muted">${state.settings.proyAporte != null ? `a mano \u00b7 autom\u00e1tico ${f0(auto)} (borralo para volver)` : `promedio de los \u00faltimos ${Math.round(ap.meses)} meses`}</span></label></div>
    <div class="proy-hl">En 1 a\u00f1o, al ritmo del S&amp;P: <b>${f0(base.v[1])}</b> \u00b7 en 10 a\u00f1os <b>${f0(base.v[10])}</b>, que al 4 % dan <b>${f0(renta(base.v[10]))}/mes</b> de renta</div>
    ${chart}${tabla}</div>`;
}
function viewPlan() {
  const ym = ui.mes; const ing = E.ingreso(ym), c = E.consumo(ym), inv = E.invertido(ym); const mg = E.margen(ym);
  const meta = mg.ahorro;
  const libre = ing.total - c.total;
  const steps = [
    { l: 'Ingreso', v: ing.total, color: 'var(--c2)', kind: 'in' },
    { l: 'Fijos', v: -mg.fijos, color: 'var(--c3)' },
    { l: 'Cuotas del mes', v: -c.cuotas, color: 'var(--c5)' },
    { l: 'Compras', v: -c.compras, color: 'var(--c7)' },
    { l: 'Libre', v: libre, color: 'var(--accent)', kind: 'total' },
  ];
  const maxV = Math.max(ing.total, c.total, 1);
  let acc = 0;
  const wf = steps.map(s => { let left, width; if (s.kind === 'in' || s.kind === 'total') { left = 0; width = Math.max(0, s.v) / maxV * 100; } else { const start = acc + s.v; left = Math.max(0, start) / maxV * 100; width = Math.abs(s.v) / maxV * 100; } if (s.kind !== 'total') acc += s.v; return `<div class="wf ${s.kind === 'total' ? 'total' : ''}"><span>${s.l}</span><div class="bar"><i style="left:${left}%;width:${width}%;background:${s.color}"></i></div><span class="n">${s.v < 0 ? '−' : ''}${M.f(Math.abs(s.v))}</span></div>`; }).join('');

  const hz12 = D.range(D.addMonths(D.thisMonth(), -11), 12).map(m => { const cc = E.consumo(m); const ii = E.ingreso(m).total; return { ym: m, gasto: cc.total, inv: E.invertido(m), ingreso: ii, tasa: ii ? E.invertido(m) / ii : null }; });
  const tasa3 = hz12.slice(-3).filter(h => h.ingreso); const tasaProm = tasa3.length ? sum(tasa3.map(h => h.tasa)) / tasa3.length : 0;
  let html = `<div class="grid g-kpi">
    ${kpi({ label: `Libre en ${D.monthName(ym).split(' ')[0]}`, value: M.f(libre), sub: `<span>Ingreso ${M.f(ing.total)} − gastos ${M.f(c.total)}</span>`, cls: 'accent' })}
    ${kpi({ label: 'Para invertir / ahorrar', value: M.f(meta), sub: `<span>sueldo − presupuesto de ${M.c(mg.presupuesto)}</span>` })}
    ${kpi({ label: 'Invertido este mes', value: M.f(inv), sub: ing.total ? `<span class="pill ${inv >= meta && meta ? 'good' : inv > 0 ? 'warn' : 'neutral'}">${M.pct(inv / ing.total)} del sueldo</span>` : '' })}
    ${kpi({ label: 'Tasa de inversión (3 meses)', value: M.pct(tasaProm), sub: `<span>promedio invertido / ingreso</span>` })}
  </div>`;
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Cascada del mes</h2><span class="hint">Del sueldo salen los fijos, después las cuotas y las compras; lo que queda es libre</span></div><div class="waterfall">${wf}</div>
      <div class="divider"></div>
      <div class="row between"><div><div class="small muted">${ym < D.thisMonth() ? 'Quedó para invertir' : 'Podés invertir'}</div><div style="font-family:var(--font-display);font-size:22px;font-weight:900;letter-spacing:-.03em;font-variant-numeric:tabular-nums">${M.f(Math.max(0, libre))}</div><div class="small muted">objetivo ${M.f(meta)}${libre > meta ? ` · sobran ${M.f(libre - meta)} del presupuesto` : libre < meta ? ` · faltan ${M.f(meta - libre)}` : ''}</div></div><button class="btn primary sm" data-act="new-inv">${ICONS.invest} Registrar inversión</button></div>
    </div>
    <div class="card"><div class="card-head"><h2>Ingreso, gasto e inversión</h2><span class="hint">Últimos 12 meses</span></div>
      ${ChartQ.reg(w => Charts.stacked({ w, h: 230, labels: hz12.map(h => D.monthName(h.ym, true)), series: [{ name: 'Gastos del mes', color: 'var(--c1)', values: hz12.map(h => h.gasto) }, { name: 'Invertido', color: 'var(--c4)', values: hz12.map(h => h.inv) }], line: { name: 'Ingreso', color: 'var(--ink-2)', values: hz12.map(h => h.ingreso || null) } }), 230)}
      ${Charts.legend([{ name: 'Gasto', color: 'var(--c1)' }, { name: 'Invertido', color: 'var(--c4)' }, { name: 'Ingreso', color: 'var(--ink-2)', kind: 'dash' }])}
    </div>
  </div>`;
  // sueldo: historial de cobros (lo que la app pregunta cada día de cobro)
  const suTodos = D.range(D.addMonths(ym, -5), 6).map(m => ({ ym: m, s: E.sueldo(m) })); const suPrimero = Object.keys(state.sueldos || {}).sort()[0];
  const suMeses = suTodos.filter(h => h.s.registrado || h.ym >= (suPrimero && suPrimero < ym ? suPrimero : ym));
  const suRow = (h, i) => { const ant = i ? suMeses[i - 1].s.monto : null; const d = ant && h.s.registrado ? h.s.monto / ant - 1 : null; return `<div class="list-item" data-act="sueldo-edit" data-id="${h.ym}" style="cursor:pointer"><div><b style="font-weight:500">${D.monthName(h.ym, true)}</b><span class="sub small muted">${h.s.registrado ? `cobrado el ${D.fmt(h.s.fecha)}` : 'estimado'}</span></div><div class="row" style="gap:8px;flex-wrap:nowrap">${d != null && Math.abs(d) >= 0.001 ? `<span class="pill ${d > 0 ? 'good' : 'warn'}">${d > 0 ? '+' : ''}${M.pct(d, 1)}</span>` : ''}<span class="mono ${h.s.registrado ? '' : 'muted'}">${M.f(h.s.monto)}</span></div></div>`; };
  const pendCobro = E.cobroPendiente();
  html += `<div class="card section"><div class="card-head"><h2>Sueldo</h2><div class="row" style="gap:8px"><span class="hint">cobrás el ${Number(state.settings.diaCobro) >= 28 ? 'último día del mes' : 'día ' + (Number(state.settings.diaCobro) || 1)}</span><button class="btn sm ${pendCobro.length ? 'primary' : ''}" data-act="cobro-cargar" data-id="${pendCobro.length ? pendCobro[pendCobro.length - 1] : ym}">${ICONS.plus} Cobro</button></div></div>
    ${suMeses.map(suRow).join('')}
  </div>`;
  // presupuestos
  const cats = state.categorias.slice().sort((a, b) => (c.byCat[b.id] || 0) - (c.byCat[a.id] || 0));
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Presupuesto por categoría</h2><span class="hint">Dejá en blanco las que no querés limitar</span></div>
      <div class="table-wrap"><table><thead><tr><th>Categoría</th><th class="r">Este mes</th><th class="r">Prom. 3m</th><th class="r">Presupuesto</th></tr></thead><tbody>
      ${cats.map(cat => { const v = c.byCat[cat.id] || 0; const avg = E.promedioCat(cat.id, ym, 3); const r = cat.presupuesto ? v / cat.presupuesto : 0; return `<tr><td><span class="row nowrap" style="gap:6px;flex-wrap:nowrap"><i class="swatch" style="background:${L.catColor(cat.id)}"></i>${esc(cat.nombre)}</span>${cat.presupuesto ? `<div class="meter ${r > 1 ? 'crit' : r > .8 ? 'warn' : ''}" style="height:4px;margin-top:4px;max-width:160px"><i style="width:${clamp(r * 100, 0, 100)}%"></i></div>` : ''}</td><td class="amount r">${v ? M.f(v) : '<span class="muted">—</span>'}</td><td class="amount r muted">${avg ? M.f(avg) : '—'}</td><td class="r"><input class="input sm mono" style="width:120px;text-align:right" inputmode="numeric" data-budget="${cat.id}" value="${cat.presupuesto ? fmtARS.format(cat.presupuesto) : ''}" placeholder="—"></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin-top:8px">Total presupuestado: <b class="mono">${M.f(sum(state.categorias.map(c => Number(c.presupuesto) || 0)))}</b> · fijos estimados: <b class="mono">${M.f(E.fijosEstimados(ym))}</b></p>
    </div>
    <div class="card"><div class="card-head"><h2>Portfolio · inversiones</h2><span class="hint">todo lo registrado</span></div>
      ${(() => { const list = state.inversiones.slice().sort((a, b) => M.toARS(b.monto, b.moneda) - M.toARS(a.monto, a.moneda)); if (!list.length) return empty({ kind: 'setup', icon: 'chart', head: 'Todavía no registrás aportes', sub: 'Cargá lo que ponés en Balanz, BTC o plazo fijo y Gastos calcula tu tasa de ahorro real.', btn: 'Registrar aporte', action: 'new-inv' }); const tot = sum(list.map(i => M.toARS(i.monto, i.moneda))); return list.map(i => `<div class="list-item"><div><b style="font-weight:500">${esc(i.destino || i.desc || 'Inversión')}</b><span class="sub small muted">${esc(i.desc && i.destino ? i.desc : D.fmt(i.fecha))}</span></div><div class="row" style="gap:4px"><span class="mono">${i.moneda === 'USD' ? 'US$ ' + (Number(i.monto) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : M.f(i.monto)}</span><button class="mini-btn" data-act="del-inv" data-id="${i.id}">${ICONS.trash}</button></div></div>`).join('') + `<div class="list-item" style="border-top:1px solid var(--line)"><b>Total invertido</b><b class="mono">${M.f(tot)}</b></div>`; })()}
      <div class="divider"></div>
      <div class="card-head"><h3>Ingresos extra</h3><button class="btn sm" data-act="new-ing">${ICONS.plus} Ingreso</button></div>
      ${(() => { const list = state.ingresos.filter(i => D.ym(i.fecha) === ym); return list.length ? list.map(i => `<div class="list-item"><div><b style="font-weight:500">${esc(i.desc || 'Ingreso')}</b><span class="sub small muted">${D.fmt(i.fecha)}</span></div><div class="row" style="gap:4px"><span class="mono">${M.f(M.toARS(i.monto, i.moneda))}</span><button class="mini-btn" data-act="del-ing" data-id="${i.id}">${ICONS.trash}</button></div></div>`).join('') : `<p class="small muted">Sueldo base: <b class="mono">${M.f(ing.base)}</b>. Aguinaldo, freelance o ventas van acá.</p>`; })()}
    </div>
  </div>`;
  return html;
}

/* ---------- TENDENCIAS ---------- */
/** un viaje: destino, fechas, total en pesos y dolares, por dia y en que se fue */
function viajeItem(v) {
  const usd = x => x != null ? fmtU(x, 0) : '\u2014'; const cats = Object.entries(v.byCat).sort((x, y) => y[1] - x[1]);
  const fechas = v.desde ? `${D.fmt(v.desde, { year: true })}${v.hasta && v.hasta !== v.desde ? ` al ${D.fmt(v.hasta, { year: true })}` : ''}` : 'sin fechas';
  return `<div class="vj-item" data-act="viaje" data-id="${v.id}"><div class="vj-h"><span><b>\u2708 ${esc(v.nombre)}</b></span><span class="mono">${M.f(v.total)}</span></div>
    <div class="vj-sub">${fechas}${v.dias ? ` \u00b7 ${v.dias} d\u00eda${v.dias > 1 ? 's' : ''}` : ''} \u00b7 ${usd(v.usd)}${v.porDia ? ` \u00b7 ${usd(v.porDiaUSD)} por d\u00eda` : ''}</div>
    ${cats.length > 1 ? `<div class="vj-cats">${cats.map(([k, x]) => `<span>${esc(L.cat(k).nombre)} <b>${M.pct(x / (v.total || 1), 0)}</b></span>`).join('')}</div>` : ''}${v.nota ? `<div class="vj-sub">${esc(v.nota)}</div>` : ''}</div>`;
}
/** Viajes: cada uno con total, por dia y en que se fue la plata; y el gasto del año = meses + viajes */
function viajesCard() {
  const vs = E.viajes(); if (!vs.length) return '';
  return `<div class="card section"><div class="card-head"><h2>Viajes ${infoBtn('Lo que cargues en un viaje (categor\u00eda Viajes y escapadas) no suma al gasto del mes, porque es puntual y lo distorsiona; s\u00ed suma al del a\u00f1o (toc\u00e1 A\u00f1o arriba). Los pesos se pasan a d\u00f3lares al CCL del d\u00eda de cada gasto, para comparar viajes de a\u00f1os distintos. Las cuotas del viaje igual cuentan en lo comprometido de cada mes, porque se pagan con el sueldo. Toc\u00e1 un viaje para corregirlo o borrarlo.')}</h2><span class="hint">toc\u00e1 uno para editarlo</span></div>${vs.map(viajeItem).join('')}</div>`;
}

function viewTendencias() {
  const n = ui.trendRange || 6; const ym = ui.mes;
  const months = D.range(D.addMonths(ym, -(n - 1)), n);
  const cons = months.map(m => E.consumo(m));
  const labels = months.map(m => D.monthName(m, true));
  const gruposUsados = GRUPOS.filter(g => cons.some(c => c.byGrupo[g.id]));
  let html = `<div class="row between" style="margin-bottom:14px"><div class="seg">${[3, 6, 12].map(k => `<button class="${n === k ? 'on' : ''}" data-range="${k}">${k} meses</button>`).join('')}</div><span class="small muted">Hasta ${D.monthName(ym)}</span></div>`;
  html += `<div class="card"><div class="card-head"><h2>Evolución por grupo</h2><span class="hint">Consumo por fecha de compra</span></div>
    ${ChartQ.reg(w => Charts.stacked({ w, h: 260, labels, highlight: n - 1, series: gruposUsados.map(g => ({ name: g.nombre, color: L.slotColor(g.slot), values: cons.map(c => c.byGrupo[g.id] || 0) })), line: state.settings.ingreso ? { name: 'Ingreso', color: 'var(--ink-2)', values: months.map(m => E.ingreso(m).total) } : null }), 260)}
    ${Charts.legend(gruposUsados.map(g => ({ name: g.nombre, color: L.slotColor(g.slot) })))}
  </div>`;
  html += viajesCard();
  // necesidad + medio
  const necSeries = [1, 2, 3].map(k => ({ name: NECESIDAD[k], color: k === 1 ? 'var(--c1)' : k === 2 ? 'var(--c4)' : 'var(--c7)', values: cons.map(c => c.byNec[k]) }));
  const innecPct = cons.map(c => c.total ? c.byNec[3] / c.total : null);
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Necesario vs innecesario</h2><span class="hint">Según cómo lo marcaste</span></div>
      ${ChartQ.reg(w => Charts.stacked({ w, h: 220, labels, series: necSeries }), 220)}${Charts.legend(necSeries.map(s => ({ name: s.name, color: s.color })))}
      <div class="row between small" style="margin-top:8px"><span class="muted">Innecesario, % del total:</span><span class="mono">${innecPct.map((p, i) => `${labels[i].split(' ')[0]} ${p == null ? '—' : M.pct(p)}`).join(' · ')}</span></div>
    </div>
    <div class="card"><div class="card-head"><h2>Total, compras, fijos y cuotas</h2></div>
      ${ChartQ.reg(w => Charts.line({ w, h: 220, labels, series: [{ name: 'Total', color: 'var(--accent)', values: cons.map(c => c.total || null), strong: true, area: true }, { name: 'Compras', color: 'var(--c2)', values: cons.map(c => c.count ? c.compras : null) }, { name: 'Fijos', color: 'var(--c4)', values: cons.map(c => c.count ? c.fijo : null) }, { name: 'Cuotas', color: 'var(--c6)', values: cons.map(c => c.count ? c.cuotas : null) }], refY: state.settings.ingreso || null, refLabel: 'Ingreso' }), 220)}
      ${Charts.legend([{ name: 'Total', color: 'var(--accent)', kind: 'line' }, { name: 'Compras', color: 'var(--c2)', kind: 'line' }, { name: 'Fijos', color: 'var(--c4)', kind: 'line' }, { name: 'Cuotas', color: 'var(--c6)', kind: 'line' }])}
    </div>
  </div>`;
  // tabla categorías mes vs anterior vs prom
  const cur = cons[n - 1], prev = cons[n - 2] || { byCat: {} };
  const catRows = state.categorias.map(cat => ({ cat, v: cur.byCat[cat.id] || 0, p: prev.byCat[cat.id] || 0, avg: E.promedioCat(cat.id, ym, 3) })).filter(r => r.v || r.p || r.avg).sort((a, b) => b.v - a.v);
  // top comercios
  const all = cons.flatMap(c => c.movs).filter(m => !m.recId);
  const byDesc = {}; for (const m of all) { if (m.cuotaRow) continue; const k = norm(m.desc); if (!byDesc[k]) byDesc[k] = { desc: m.desc, n: 0, total: 0, cat: m.catId }; byDesc[k].n++; byDesc[k].total += M.toARS(m.monto, m.moneda); }
  const top = Object.values(byDesc).sort((a, b) => b.total - a.total).slice(0, 10);
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Categorías: mes a mes</h2></div>
      <div class="table-wrap"><table><thead><tr><th>Categoría</th><th class="r">${labels[n - 1]}</th><th class="r">${labels[n - 2] || 'Ant.'}</th><th class="r">Prom. 3m</th><th class="r">Dif. vs prom.</th></tr></thead><tbody>
      ${catRows.map(r => { const d = r.avg ? (r.v - r.avg) / r.avg : null; return `<tr><td><span class="row nowrap" style="gap:6px;flex-wrap:nowrap"><i class="swatch" style="background:${L.catColor(r.cat.id)}"></i>${esc(r.cat.nombre)}</span></td><td class="amount r">${M.f(r.v)}</td><td class="amount r muted">${M.f(r.p)}</td><td class="amount r muted">${M.f(r.avg)}</td><td class="r">${d == null ? '—' : `<span class="pill ${d > 0.25 ? 'crit' : d > 0.1 ? 'warn' : d < -0.1 ? 'good' : 'neutral'}">${d > 0 ? '+' : ''}${M.pct(d)}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Dónde gastás más</h2><span class="hint">Top comercios, ${n} meses, sin fijos (compras a valor total)</span></div>
      <div class="table-wrap"><table><thead><tr><th>Comercio</th><th class="r">Veces</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>
      ${top.map(t => `<tr><td><b style="font-weight:500">${esc(t.desc)}</b><span class="sub">${L.cat(t.cat).nombre}</span></td><td class="mono r">${t.n}</td><td class="amount r">${M.f(t.total)}</td><td class="amount r muted">${M.f(t.total / t.n)}</td></tr>`).join('') || `<tr><td colspan="4" style="padding:0">${empty({ kind: 'periodo bare-top', icon: 'chart', head: 'Todavía no hay suficiente historia', sub: 'Con dos meses cargados ya vas a ver tendencias.' })}</td></tr>`}
      </tbody></table></div></div>
  </div>`;
  // heat + weekday
  const wd = [0, 0, 0, 0, 0, 0, 0], wn = [0, 0, 0, 0, 0, 0, 0];
  for (const m of all) { if (m.cuotaRow) continue; const d = (D.dow(m.fecha) + 6) % 7; wd[d] += E.rowAmount(m); wn[d]++; }
  const wdMax = Math.max(...wd, 1);
  const medios = Object.entries(cur.byMedio).map(([k, v]) => ({ name: k === 'tarjeta' ? 'Tarjeta' : MEDIOS[k] || k, value: v })).sort((a, b) => b.value - a.value);
  html += `<div class="grid g-3 section">
    <div class="card"><div class="card-head"><h2>Calendario</h2><span class="hint">${D.monthName(ym)}</span></div>${Charts.heat(ym, cur.byDay)}</div>
    <div class="card"><div class="card-head"><h2>Por día de la semana</h2><span class="hint">Total en ${n} meses</span></div>
      ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => `<div class="meter-row"><div class="l"><span>${d}</span></div><div class="v"><b class="mono">${M.f(wd[i])}</b> <span class="muted">· ${wn[i]}</span></div><div class="meter"><i style="width:${wd[i] / wdMax * 100}%;background:var(--c4)"></i></div></div>`).join('')}
    </div>
    <div class="card"><div class="card-head"><h2>Medio de pago</h2><span class="hint">${D.monthName(ym, true)}</span></div>
      ${medios.length ? medios.map((m, i) => `<div class="meter-row"><div class="l"><span>${esc(m.name)}</span></div><div class="v"><b class="mono">${M.f(m.value)}</b> <span class="muted">${M.pct(m.value / cur.total)}</span></div><div class="meter"><i style="width:${m.value / cur.total * 100}%;background:var(--c4)"></i></div></div>`).join('') : empty({ kind: 'periodo', icon: 'chart', head: 'Todavía no hay suficiente historia', sub: 'Con dos meses cargados ya vas a ver tendencias.' })}
      ${state.tarjetas.length > 1 ? `<div class="divider"></div>${state.tarjetas.map(t => { const v = sum(cur.movs.filter(m => m.tarjetaId === t.id).map(m => M.toARS(m.monto, m.moneda))); return `<div class="row between small"><span>${esc(t.nombre)}</span><b class="mono">${M.f(v)}</b></div>`; }).join('')}` : ''}
    </div>
  </div>`;
  return html;
}

/* ---------- CONFIG ---------- */
function viewConfig() {
  const s = state.settings;
  const inp = (id, label, val, extra = '', help = '') => `<div class="field"><label>${label}</label><input class="input" data-setting="${id}" value="${esc(val ?? '')}" ${extra}>${help ? `<span class="help">${help}</span>` : ''}</div>`;
  let html = `<div class="grid g-2">
    <div class="card"><div class="card-head"><h2>Perfil</h2></div><div class="form-grid">
      ${inp('nombre', 'Nombre', s.nombre, 'placeholder="Tu nombre"')}
      ${inp('ingreso', 'Sueldo neto mensual (ARS)', s.ingreso ? fmtARS.format(s.ingreso) : '', 'inputmode="numeric"')}
      ${inp('diaCobro', 'Día de cobro', s.diaCobro, 'inputmode="numeric"', '31 = último día del mes. Ese día la app te pregunta cuánto cobraste y recalcula todo.')}
      ${inp('ccl', 'Dólar CCL (ARS por USD)', s.ccl || '', 'inputmode="numeric"', 'Para valuar los CEDEARs en pesos. Se actualiza junto con el MEP.')}
      ${inp('finnhubKey', 'Clave de Finnhub (precios de acciones)', s.finnhubKey || '', 'placeholder="pegá tu API key" autocomplete="off"', 'Gratis en finnhub.io, botón Get free API key. Con esto la Cartera trae los precios al abrir la app. <a href="#" data-act="precios-update">Actualizar precios ahora</a>')}
      ${inp('tc', 'Dólar MEP (ARS por USD)', s.tc, 'inputmode="numeric"', `${s.tcFecha ? `Actualizado ${D.fmt(s.tcFecha, { year: true })}${s.tcFuente ? ' · ' + esc(s.tcFuente) : ''}. ` : ''}Se usa para la vista en USD y para gastos en dólares. <a href="#" data-act="tc-update">Actualizar desde dolarapi.com</a>`)}
      ${inp('presupuesto', 'Presupuesto mensual de gasto (ARS)', s.presupuesto ? fmtARS.format(s.presupuesto) : '', 'inputmode="numeric"', `Lo que decidís gastar por mes (fijos + cuotas + compras). El resto del sueldo${s.ingreso && s.presupuesto ? ` (${M.f(s.ingreso - s.presupuesto)})` : ''} es para invertir.`)}
      ${inp('alertaCuotasPct', 'Alerta de cuotas (% del presupuesto)', s.alertaCuotasPct, 'inputmode="numeric"', 'Te aviso cuando fijos + cuotas superan esto')}
    </div></div>
    <div class="card"><div class="card-head"><h2>Tarjetas</h2><button class="btn sm" data-act="new-card">${ICONS.plus} Tarjeta</button></div>
      ${state.tarjetas.length ? state.tarjetas.map((t, i) => `<div class="list-item"><div class="row" style="gap:10px"><i class="swatch" style="width:28px;height:18px;border-radius:4px;background:${cardDot(t.color) || CARD_COLORS[i % CARD_COLORS.length]}"></i><div><b style="font-weight:500">${esc(t.nombre)}</b> <span class="muted small">${esc(t.banco || '')}</span><span class="sub small muted">Cierra el ${t.cierre} · vence el ${t.vencimiento}${t.limite ? ` · límite ${M.c(t.limite)}` : ''}</span></div></div><div class="row" style="gap:2px"><button class="mini-btn" data-act="edit-card" data-id="${t.id}">${ICONS.edit}</button><button class="mini-btn" data-act="del-card" data-id="${t.id}">${ICONS.trash}</button></div></div>`).join('') : emptyInline('Ninguna tarjeta cargada', 'Agregar', 'new-card')}
      <div class="divider"></div>
      <div class="card-head"><h3>Cuentas</h3><button class="btn sm" data-act="new-cuenta">${ICONS.plus} Cuenta</button></div>
      ${state.cuentas.length ? state.cuentas.map(c => `<div class="list-item"><div><b style="font-weight:500">${esc(c.nombre)}</b><span class="sub small muted">${esc(c.tipo || '')} · ${c.moneda}${c.esSueldo ? ' · cobro el sueldo acá' : ''}</span></div><div class="row" style="gap:2px"><span class="mono">${M.f(M.toARS(Number(c.saldo) || 0, c.moneda))}</span><button class="mini-btn" data-act="edit-cuenta" data-id="${c.id}">${ICONS.edit}</button><button class="mini-btn" data-act="del-cuenta" data-id="${c.id}">${ICONS.trash}</button></div></div>`).join('') : emptyInline('Ninguna cuenta cargada', 'Agregar', 'new-cuenta')}
    </div>
  </div>`;
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Categorías</h2><button class="btn sm" data-act="new-cat">${ICONS.plus} Categoría</button></div>
      ${GRUPOS.map(g => { const cs = state.categorias.filter(c => L.grupo(c.grupo).id === g.id); if (!cs.length) return ''; return `<div class="kg"><div class="kg-h">${esc(g.nombre)}</div>${cs.map(c => { const used = state.movimientos.some(m => m.catId === c.id) || state.recurrentes.some(r => r.catId === c.id); return `<div class="kg-r"><span data-act="edit-cat" data-id="${c.id}">${esc(c.nombre)}${c.esencial ? '' : '<i class="eleg">elegible</i>'}</span><span class="kg-b"><button class="mini-btn" data-act="edit-cat" data-id="${c.id}">${ICONS.edit}</button>${!used && c.id !== 'revisar' ? `<button class="mini-btn" data-act="del-cat" data-id="${c.id}">${ICONS.trash}</button>` : ''}</span></div>`; }).join('')}</div>`; }).join('')}
    </div>
    <div class="card"><div class="card-head"><h2>Datos</h2></div>
      <div class="stack">
        ${(() => { const g = Gist.cfg(); return g
          ? `<div class="list-item"><div><b style="font-weight:500">Sincronización entre dispositivos</b><span class="sub small muted ver">Conectada a tu GitHub (gist ${esc(String(g.id).slice(0, 8))}…). Sube al guardar y baja al abrir la app.${(() => { const t = Gist.ultimoPush(); return t ? ` Última subida ${haceTxt(t)}.` : ''; })()} GitHub guarda cada versión y una copia mensual aparte.</span></div><div class="row" style="gap:4px"><button class="btn sm" data-act="gist-pull">Traer ahora</button><button class="btn sm danger" data-act="gist-off">Desconectar</button></div></div>`
          : `<div class="list-item" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><b style="font-weight:500">Sincronización entre dispositivos</b><span class="sub small muted">Guarda tus datos en un gist privado de tu GitHub para verlos iguales en el celu y la PC. Creá un token clásico con permiso "gist" en github.com, en Settings, Developer settings, Personal access tokens, Tokens (classic), y pegalo acá (una vez por dispositivo).</span></div><div class="row" style="gap:6px;width:100%;margin-top:8px"><input class="input sm" type="password" id="g-token" placeholder="ghp_…" style="flex:1;min-width:160px"><button class="btn sm primary" data-act="gist-connect">Conectar</button></div></div>`; })()}
        ${Gist.cfg() ? `<div class="list-item"><div><b style="font-weight:500">Volver a una versión anterior</b><span class="sub small muted">Elegí un día y hora del historial de GitHub; la app vuelve a como estaba entonces</span></div><button class="btn sm" data-act="gist-versiones">${ICONS.clock} Ver</button></div>` : ''}
        <div class="list-item"><div><b style="font-weight:500">Resumen para analizar con Claude</b><span class="sub small muted">Copia un informe del mes en texto para pegarlo en el chat del proyecto</span></div><button class="btn sm" data-act="copiar-resumen">${ICONS.copy} Copiar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Exportar respaldo</b><span class="sub small muted">Descarga todo en JSON (${state.movimientos.length} movimientos)</span></div><button class="btn sm" data-act="export">${ICONS.download} Exportar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Importar respaldo</b><span class="sub small muted">Reemplaza los datos actuales por un JSON exportado</span></div><label class="btn sm">${ICONS.upload} Importar<input type="file" accept="application/json" id="import-file" class="hidden"></label></div>
        <div class="list-item"><div><b style="font-weight:500">Importar movimientos desde CSV</b><span class="sub small muted">Columnas: fecha, descripción, monto, categoría (opcional), cuotas (opcional)</span></div><label class="btn sm">${ICONS.upload} CSV<input type="file" accept=".csv,text/csv" id="import-csv" class="hidden"></label></div>
        <div class="list-item"><div><b style="font-weight:500">Datos de ejemplo</b><span class="sub small muted">Carga 5 meses inventados para ver cómo funciona todo</span></div><button class="btn sm" data-act="demo">Cargar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Borrar todo</b><span class="sub small muted">Elimina movimientos, fijos, tarjetas y ajustes</span></div><button class="btn sm danger" data-act="reset">Borrar</button></div>
      </div>
      <div class="divider"></div>
      <p class="small muted">${(() => { const b = BUILD; const v = /^\d{12}/.test(b) ? `${b.slice(6, 8)}/${b.slice(4, 6)}/${b.slice(0, 4)} ${b.slice(8, 10)}:${b.slice(10, 12)} UTC` : '—'; const u = state.updatedAt ? new Date(state.updatedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; return `App actualizada al ${v} · tus datos modificados por última vez el ${u}`; })()}</p>
      <div class="row" style="gap:8px;margin-top:6px"><button class="btn sm" data-act="sw-update">Buscar actualización</button></div>
      <p class="small muted">Estado: ${Persist.status === 'ok' ? 'guardado en la nube (esta página se actualiza sola en todos tus dispositivos).' : Persist.status === 'local' ? 'guardado solo en este dispositivo. Exportá un respaldo cada tanto.' : Persist.status === 'err' ? 'error al guardar: ' + esc(Persist.lastError) : 'sincronizando…'}</p>
    </div>
  </div>`;
  return html;
}

/* ---------- cartera ---------- */
const fmtU = (v, d = null) => { const a = Math.abs(v); const f = d != null ? NF({ minimumFractionDigits: d, maximumFractionDigits: d }) : (a < 100 ? fmtUSD2 : fmtUSD); return `${v < 0 ? '−' : ''}US$ ${f.format(a)}`; };
const fmtAcc = q => MENOS((Number(q) || 0).toLocaleString('es-AR', { maximumFractionDigits: 4 }));
const pctS = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${M.pct(Math.abs(v), d)}`;
const gpPill = (gp, pct) => gp == null ? '' : `<span class="pill ${gp >= 0 ? 'good' : 'crit'}">${gp >= 0 ? '+' : '−'}${fmtU(Math.abs(gp), 0)}${pct != null ? ` · ${pctS(pct)}` : ''}</span>`;
function viewCartera() {
  const k = E.cartera(); const s = state.settings; const hayKey = !!(s.finnhubKey || '').trim();
  const fechaP = k.preciosFecha ? new Date(k.preciosFecha) : null;
  const fechaTxt = fechaP ? `${D.fmt(D.iso(fechaP))} ${pad2(fechaP.getHours())}:${pad2(fechaP.getMinutes())}` : null;
  const enZona = [...k.posiciones, ...k.watch].filter(p => p.estado);
  if (!k.posiciones.length && !k.ops.length) return `<div class="card">${empty({ kind: 'setup', icon: 'chart', head: 'Todavía no hay operaciones', sub: 'Cargá tu primera compra y la cartera se arma sola.', btn: 'Cargar operación', action: 'new-op' })}</div>`;
  let html = '';
  // precios: una sola linea, sin tarjeta. La hora manda; CCL y SPY al lado; actualizar es un icono
  html += `<div class="px-strip"><span class="px-txt">${hayKey ? `${k.conPrecio ? `<b>Precios ${fechaTxt}</b>` : '<b>Sin precios todav\u00eda</b>'}${k.conPrecio && k.conPrecio < k.posiciones.length ? ` \u00b7 <span class="warn-text">${k.posiciones.length - k.conPrecio} sin precio</span>` : ''}${(() => { const pg = Motor.progreso(); return (pg.faltan ? ` \u00b7 Fundamentales ${pg.alDia}/${pg.total} \u00b7 faltan ~${pg.min} min` : '') + (pg.sinFuente.length ? ` \u00b7 <span class="soft" title="${esc(pg.sinFuente.join(', '))}">${pg.sinFuente.length} sin fuente</span>` : ''); })()}${s.ccl ? ' \u00b7 CCL ' + fmtARS.format(k.ccl) : ''}${k.spyHoy ? ' \u00b7 SPY ' + MENOS(k.spyHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''}` : '<b>Falta tu clave de Finnhub</b>'}</span><button class="icon-btn" data-act="claude-menu" aria-label="Claude" title="Claude: exportar o cargar">${ICONS.spark}</button>${hayKey ? `<button class="icon-btn" data-act="precios-update" aria-label="Actualizar precios" title="Actualizar precios">${ICONS.repeat}</button>` : '<button class="btn sm" data-act="go-config">Configurar</button>'}</div>`;
  const valorTxt = k.valor != null ? fmtU(k.valor, 0) : fmtU(k.costo, 0); const valorTotTxt = k.valorTotal != null ? fmtU(k.valorTotal, 0) : valorTxt;
  const n0 = x => Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 0 }); const sg = x => x >= 0 ? '+' : '−';
  const va = k.ventanas.anio, vi = k.ventanas.inicio; const vAlfa = va.disponible ? va : vi.disponible ? vi : null;
  const rendStat = (kLabel, v) => v && v.disponible && v.rend.realDiv != null ? { k: kLabel, v: pctS(v.rend.realDiv), cls: v.rend.realDiv >= 0 ? 'pos' : 'neg' } : { k: kLabel, v: '—' };
  const ultimoDiv = k.ops.filter(o => o.tipo === 'dividendo').sort((a, b) => b.fecha.localeCompare(a.fecha) || (Number(b.monto) || 0) - (Number(a.monto) || 0))[0];
  const cajaTotal = (k.valorTotal != null ? k.valorTotal : k.costo);
  // --- tarjetas gerenciales: Portfolio · CEDEARs · Novedades (balances de la semana + lo que esta en zona)
  const pt = E.patrimonio(k); const hayActivos = pt.activos.length > 0;
  const rendStr = v => v && v.disponible && v.rend.realDiv != null ? { v: pctS(v.rend.realDiv), cls: v.rend.realDiv >= 0 ? 'pos' : 'neg' } : { v: '—', cls: '' };
  const reparto = pt.grupos.filter(g => g.valor > 0).map(g => `${g.id === 'cedears' ? 'CEDEARs' : g.id === 'reserva' ? 'fondo' : g.nombre.toLowerCase()} ${M.pct(g.valor / pt.total, 0)}`).join(' · ');
  // balances cerca: 14 dias antes si la tenes, 7 si es watchlist; primero los mas proximos, entre iguales lo que tenes
  const balSemana = [...k.posiciones.map(x => ({ t: x.ticker, tengo: true, peso: x.peso })), ...k.watch.filter(w => !k.posiciones.some(p => p.ticker === w.ticker)).map(x => ({ t: x.ticker, tengo: false, peso: 0 }))]
    .map(x => ({ ...x, b: Fund.balanceCerca(x.t, x.tengo) })).filter(x => x.b).sort((x, y) => x.b.dias - y.b.dias || (y.tengo - x.tengo) || (y.peso - x.peso));
  // chips: "MELI 25/09 pm" (pm = tras el cierre, am = antes de abrir)
  const ddmm = f => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const balLineas = balSemana.length ? `<div class="nov-l nov-z"><span class="nov-chips">${balSemana.map(x => `<span class="nov-chip bal" data-act="pos" data-id="${esc(x.t)}">${esc(x.t)} ${ddmm(x.b.fecha)}${x.b.hora === 'bmo' ? '<i>am</i>' : x.b.hora === 'amc' ? '<i>pm</i>' : ''}</span>`).join('')}</span></div>` : '';
  const zona = [...k.posiciones, ...k.watch].filter(x => x.estado).sort((x, y) => (x.estado === 'urgente' ? 0 : 1) - (y.estado === 'urgente' ? 0 : 1) || ((k.posiciones.some(p => p.ticker === y.ticker) ? 1 : 0) - (k.posiciones.some(p => p.ticker === x.ticker) ? 1 : 0)));
  const zonaLinea = zona.length ? `<div class="nov-l nov-z"><span class="nov-chips">${zona.map(x => `<span class="nov-chip ${x.estado}" data-act="pos" data-id="${esc(x.ticker)}">${esc(x.ticker)}</span>`).join('')}</span></div>` : '';
  const baratas = Fund.baratas([...k.posiciones, ...k.watch].map(p => p.ticker)).slice(0, 8);
  // todas las que estan en su EMA 200 o por debajo, de la mas lejos abajo a la mas cerca; mas de 5 % abajo en rojo
  const emaCerca = [...k.posiciones, ...k.watch].map(p => ({ t: p.ticker, e: Tec.de(p.ticker) })).filter(x => x.e && x.e.dist <= 0.005).sort((a, b) => a.e.dist - b.e.dist);
  const emaLinea = emaCerca.length ? `<div class="nov-l nov-z"><span class="nov-chips">${emaCerca.map(x => `<span class="nov-chip tec${x.e.dist < -0.05 ? ' abajo' : ''}" data-act="pos" data-id="${esc(x.t)}" title="EMA 200 ${x.e.ema.toFixed(2)} \u00b7 ${Tec.toquesTxt(x.e)}${x.e.pctAbajo10 != null ? ` \u00b7 estuvo abajo el ${Math.round(x.e.pctAbajo10 * 100)} % de los d\u00edas` : ''}">${esc(x.t)}<i>EMA ${Tec.distTxt(x.e.dist)}</i></span>`).join('')}</span></div>` : '';
  const barLinea = baratas.length ? `<div class="nov-l nov-z"><span class="nov-chips">${baratas.map(x => `<span class="nov-chip val" data-act="pos" data-id="${esc(x.t)}" title="P/E ${x.b.pe.toFixed(1)} vs mediana 10 a\u00f1os ${x.b.med.toFixed(1)}">${esc(x.t)}<i>P/E \u2212${Math.round(x.b.desc * 100)}%</i></span>`).join('')}</span></div>` : '';
  const pxHora = k.preciosFecha ? new Date(k.preciosFecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
  html += `<div class="grid g-kpi">
    ${kpi({ label: 'Portfolio', value: hayActivos ? fmtU(pt.total, 0) : valorTotTxt, cls: 'hero', act: hayActivos ? 'pat-dist' : '',
      stats: (hayActivos
        ? pt.grupos.slice(0, 3).map(g => ({ k: g.id === 'cedears' ? 'CEDEARs' : g.id === 'reserva' ? 'Reserva' : g.id === 'renta' ? 'Bonos' : g.nombre, v: fmtARS.format(Math.round(g.valor)), cls: g.id === 'reserva' && pt.reservaPct != null && pt.reservaPct < pt.reservaObjetivo ? 'neg' : '' }))
        : [{ k: 'CEDEARs', v: fmtARS.format(Math.round(k.valor != null ? k.valor : k.costo)) }, { k: 'Otros', v: '<span class="soft">abajo</span>' }]
      ).concat([{ k: 'En $', v: pt.mep ? `$ ${abrevARS((hayActivos ? pt.total : (k.valorTotal != null ? k.valorTotal : k.costo)) * pt.mep)}` : '—' }]) })}
    ${kpi({ label: 'CEDEARs', value: valorTxt,
      stats: [
        { k: 'YTD', ...rendStr(va) }, { k: 'Inicio', ...rendStr(vi) },
        { k: 'Posiciones', v: String(k.posiciones.length) },
        { k: 'Divid.', v: k.dividendos ? `+${fmtU(k.dividendos, 0)}` : '—', cls: k.dividendos ? 'pos' : '' },
      ] })}
    ${renderReservaCard(pt)}
    <div class="card kpi nov ${balLineas || zonaLinea ? 'tap' : ''}" ${balLineas || zonaLinea ? 'data-act="ir-alertas"' : ''}><div class="label">Novedades</div>
      ${balLineas || zonaLinea || barLinea || emaLinea ? balLineas + zonaLinea + barLinea + emaLinea : '<div class="nov-l"><span class="muted">Sin novedades: nada en zona ni balances esta semana.</span></div>'}
    </div>
  </div>`;
  const conc = state.cartera.conciliacion || null;
  // composición ↔ evolución
  const modo = ui.carteraChart || 'comp';
  const segB = (id, l) => `<button class="${modo === id ? 'on' : ''}" data-act="cartera-chart" data-id="${id}" style="padding:4px 9px;font-size:12.5px">${l}</button>`;
  const seg = `<div class="seg" style="padding:2px">${segB('comp', 'Mapa')}${segB('dist', 'Grupos')}${segB('evo', 'vs S&P')}</div>`;
  let chartCard;
  if (modo === 'comp') {
    chartCard = `<div class="card"><div class="card-head"><h2>Composici\u00f3n</h2>${seg}</div>${mapaCartera(k)}</div>`;
  } else if (modo === 'dist') chartCard = `<div class="card"><div class="card-head"><h2>Distribuci\u00f3n</h2>${seg}</div>${distCartera(k)}</div>`;
  else chartCard = renderEvolucion(k, seg);
  html += `<div class="grid g-12 section">
    ${chartCard}
    <div class="card"><div class="card-head"><h2>Posiciones</h2><button class="btn sm" data-act="new-op">${ICONS.plus} Operación</button></div>
      ${(() => { const o = state.settings.pzOrden || { k: 'valor', dir: -1 };
        const op = [['valor', 'Valor'], ['rend', 'Rendimiento'], ['gan', 'Ganado'], ['hoy', 'Hoy'], ['az', 'A-Z']];
        return `<div class="pz-ord" role="group" aria-label="Ordenar posiciones">${op.map(([id, l]) => `<button type="button" data-act="pz-orden" data-id="${id}" class="${o.k === id ? 'on' : ''}">${l}${o.k === id ? ` <i>${(id === 'az' ? o.dir > 0 : o.dir < 0) ? '\u2193' : '\u2191'}</i>` : ''}</button>`).join('')}</div>`; })()}
      <div class="pz-list"><div class="pz-cols"><span>Empresa</span><span>Precio</span><span>Ten\u00e9s</span></div>
      ${(() => {
      const valTxt = p => fmtU(p.valor != null ? p.valor : p.costo, 0), pxTxt = p => p.precio != null ? MENOS(Number(p.precio).toLocaleString('es-AR', { minimumFractionDigits: p.precio < 100 ? 2 : 0, maximumFractionDigits: p.precio < 100 ? 2 : 0 })) : '';  // con un $ chico adelante (Facu: el numero solo se ve raro)
      const o = state.settings.pzOrden || { k: 'valor', dir: -1 };
      const clave = { valor: p => p.valor != null ? p.valor : p.costo, rend: p => p.rendTotal, gan: p => p.gpTotal, hoy: p => p.dp, az: p => p.ticker }[o.k] || (p => p.valor);
      const lista = k.posiciones.slice().sort((a, b) => { const x = clave(a), y = clave(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * o.dir; });
      const sub = p => p.gpTotal == null ? '' : o.k === 'gan' ? `<span class="pz-rt ${p.gpTotal >= 0 ? 'up' : 'down'}">${p.gpTotal >= 0 ? '+' : '\u2212'}${fmtU(Math.abs(p.gpTotal), 0)}</span>` : `<span class="pz-rt ${p.gpTotal >= 0 ? 'up' : 'down'}">${pctS(p.rendTotal)}</span>`;
      return lista.map(p => { const avisos = []; if (conc && conc.items[p.ticker] && !conc.items[p.ticker].ok) avisos.push(`Balanz dice ${fmtAcc(conc.items[p.ticker].balanz)}`); const bal = Fund.balanceCerca(p.ticker, true);
      return `<div class="pz" data-act="pos" data-id="${esc(p.ticker)}">
        <div class="pz-l"><div class="pz-t"><b>${esc(p.ticker)}</b>${p.estado ? `<i class="pz-dot ${p.estado}" title="${p.estado}"></i>` : ''}${bal ? `<i class="pz-dot bal" title="balance en ${bal.dias} d"></i>` : ''}</div><span class="pz-s">${(Math.round(p.acciones * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })} acc \u00b7 PPC ${MENOS(Number(p.ppc).toLocaleString('es-AR', { maximumFractionDigits: p.ppc < 100 ? 2 : 0 }))}</span></div>
        <div class="pz-m">${p.precio != null ? `<span class="pz-px"><small class="pz-cur">$</small>${esc(pxTxt(p))}</span><span class="pz-dp ${p.dp > 0 ? 'up' : p.dp < 0 ? 'down' : 'flat'}">${p.dp != null ? (p.dp > 0 ? '+' : '') + MENOS(p.dp.toLocaleString('es-AR', { maximumFractionDigits: 1 })) + ' %' : '\u2014'}</span>` : `<span class="pz-px muted">${Precios.sinFuente(p.ticker) ? 'sin fuente' : 'sin precio'}</span>`}</div>
        <div class="pz-r"><b>${esc(valTxt(p))}</b>${sub(p)}</div>
        ${avisos.length ? `<div class="pz-f warn-text">${avisos.join(' · ')}</div>` : ''}
      </div>`; }).join(''); })()}
      </div>
    </div>
  </div>`;
  // alertas: una vista compacta, sin scroll horizontal
  const conAlerta = [...k.posiciones.filter(p => p.alerta), ...k.watch];
  const alRow = p => {
    const al = p.alerta; const pr = p.precio;
    const dist = (niv) => pr && niv ? (pr - niv) / pr : null;
    const dM = dist(al.mirala), dU = dist(al.urgente);
    const cerca = dM != null ? clamp(1 - Math.max(0, dM) / 0.25, 0, 1) : 0;
    const chip = p.estado === 'urgente' ? '<span class="pill crit"><span class="dot"></span>comprá urgente</span>' : p.estado === 'mirala' ? '<span class="pill warn"><span class="dot"></span>mirala</span>' : dM != null ? `<span class="pill neutral">a ${M.pct(dM, 1)}</span>` : '<span class="pill neutral">sin precio</span>';
    return `<div class="al-row" data-alerta="${esc(p.ticker)}">
      <div class="al-top"><div><b>${esc(p.ticker)}</b>${p.acciones ? '' : ' <span class="tag">watchlist</span>'}<span class="sub">${pr != null ? `hoy ${fmtU(pr)}` : Precios.sinFuente(p.ticker) ? 'sin fuente de precio' : 'sin precio'}${Tier.de(p.ticker) ? ` \u00b7 tier ${Tier.de(p.ticker)}` : ''}${p.objetivo ? ` · obj ${fmtUSD.format(p.objetivo)}${p.upside != null ? ` (${pctS(p.upside, 0)})` : ''}` : ''}</span></div>${chip}</div>
      ${al.desc ? `<div class="al-desc">${esc(al.desc)}</div>` : ''}
      <div class="al-bar"><i class="${p.estado === 'urgente' ? 'glow-fill crit' : p.estado === 'mirala' ? 'glow-fill warn' : ''}" style="width:${Math.round(cerca * 100)}%;background:${p.estado === 'urgente' ? 'var(--crit)' : p.estado === 'mirala' ? 'var(--warn)' : 'var(--accent)'}"></i></div>
      <div class="al-lv"><span><span class="dot warn"></span>${G.le} ${al.mirala ? fmtUSD2.format(al.mirala).replace(',00', '') : '—'}${dM != null ? ` <small>${p.estado ? 'en zona' : '−' + M.pct(dM, 1)}</small>` : ''}</span><span><span class="dot crit"></span>${G.le} ${al.urgente ? fmtUSD2.format(al.urgente).replace(',00', '') : '—'}${dU != null ? ` <small>${p.estado === 'urgente' ? 'en zona' : '−' + M.pct(Math.max(0, dU), 1)}</small>` : ''}</span></div>
    </div>`;
  };
  const ordenAl = conAlerta.slice().sort((a, b) => (a.estado === 'urgente' ? 0 : a.estado === 'mirala' ? 1 : 2) - (b.estado === 'urgente' ? 0 : b.estado === 'mirala' ? 1 : 2) || ((a.distMirala ?? 9) - (b.distMirala ?? 9)));
  html += `<div class="card section"><div class="card-head"><h2>Alertas de precio</h2><div class="row" style="gap:8px"><button class="icon-btn" data-act="balances" aria-label="Calendario de balances" title="Calendario de balances">${ICONS.cuotas}</button><button class="btn sm ghost" data-act="comparar">Comparar</button><button class="btn sm" data-act="new-watch">${ICONS.plus} Ticker</button></div></div>
    ${ordenAl.length ? (() => {
      // vivas: en zona (roja o amarilla) o a menos de 5 % de mirala. El resto, detras de un boton (Facu)
      const viva = p => p.estado || (p.precio && p.alerta && p.alerta.mirala && (p.precio - p.alerta.mirala) / p.precio <= 0.05);
      const vivas = ordenAl.filter(viva), resto = ordenAl.filter(p => !viva(p));
      return (vivas.length ? vivas.map(alRow).join('') : '<p class="small muted" style="margin:4px 0 8px">Nada en zona ni a menos de 5 % de mirala.</p>')
        + (resto.length ? (ui.alTodas ? resto.map(alRow).join('') : '') + `<button class="btn ghost al-mas" data-act="al-todas">${ui.alTodas ? 'Ver menos' : `Ver todas (${resto.length} m\u00e1s)`}</button>` : '');
    })() : emptyInline('Sin alertas cargadas', 'Agregar', 'new-watch')}
  </div>`;
  // control de calidad: conciliación con Balanz + operaciones con advertencias
  const conAviso = k.ops.filter(o => o.verif && o.verif.nivel !== 'ok').length; const concDias = conc ? D.daysBetween(conc.fecha, D.today()) : null;
  html += `<div class="card section"><div class="card-head"><h2>Control</h2><button class="btn sm ${!conc || concDias > 35 ? 'primary' : ''}" data-act="conciliar">Conciliar con Balanz</button></div>
    <div class="list-item"><div><b style="font-weight:500">Tenencia vs Balanz</b><span class="sub small muted">${conc ? `${D.fmt(conc.fecha, { year: true })} · ${conc.n} posición${conc.n === 1 ? '' : 'es'} revisada${conc.n === 1 ? '' : 's'}` : 'todavía no conciliaste'}</span></div>${conc ? (conc.dif ? `<span class="pill warn">${G.warn} ${conc.dif} diferencia${conc.dif > 1 ? 's' : ''}</span>` : `<span class="pill good">${G.ok} coincide</span>`) : `<span class="pill neutral">pendiente</span>`}</div>
    ${k.duplicadas.length ? `<div class="list-item"><div><b style="font-weight:500">Posibles duplicadas</b><span class="sub small muted">${k.duplicadas.slice(0, 3).map(([a, b]) => `${a.tipo} ${esc(a.ticker)} ${D.fmt(a.fecha)} / ${D.fmt(b.fecha)}`).join(' · ')}${k.duplicadas.length > 3 ? ' …' : ''} — marcadas en la lista</span></div><span class="pill warn">${k.duplicadas.length}</span></div>` : ''}
    <div class="list-item"><div><b style="font-weight:500">Operaciones con advertencias</b><span class="sub small muted">${conAviso ? `marcadas ${G.warn} en la lista: tocá para revisar` : 'cada operación se verifica contra NY, CCL, ratio y SPY al guardarla'}</span></div>${conAviso ? `<span class="pill warn">${conAviso}</span>` : `<span class="pill good">0</span>`}</div>
  </div>`;
  html += renderPatrimonio(k);
  html += proyeccionCard();
  // operaciones
  const ops = k.ops.slice().reverse().slice(0, 25);
  const opMonto = o => o.tipo === 'dividendo' ? Number(o.monto) || 0 : (Number(o.acciones) || 0) * (Number(o.precio) || 0);
  html += `<div class="card section"><div class="card-head"><h2>Operaciones</h2><span class="hint">${k.ops.length} · tocá para editar${k.legados ? ` · <span class="tag">${k.legados} de año cero (31/12/25)</span>` : ''}</span></div>
    ${ops.map(o => `<div class="list-item op-row" data-act="edit-op" data-id="${o.id}" style="cursor:pointer"><div style="min-width:0"><b style="font-weight:500">${o.tipo === 'compra' ? 'Compra' : o.tipo === 'venta' ? 'Venta' : 'Dividendo'} ${esc(o.ticker)}</b>${o.legado ? ' <span class="tag" style="color:var(--warn-text)">fecha estimada</span>' : ''}${o.verif && o.verif.nivel !== 'ok' ? ` <span class="tag ${o.verif.nivel === 'block' ? 'verif-block' : 'verif-warn'}">${o.verif.nivel === 'block' ? G.no : G.warn} revisar</span>` : ''}${(o.deCaja || o.deDividendos) > 0 ? ` <span class="tag">con caja ${fmtU(o.deCaja || o.deDividendos, 0)}</span>` : ''}${o.aCaja ? ' <span class="tag">a caja</span>' : ''}${k.dupIds.has(o.id) ? ' <span class="tag verif-warn">¿duplicada?</span>' : ''}<span class="sub small muted">${D.fmt(o.fecha, { year: true })}${o.tipo !== 'dividendo' ? ` · ${o.modo === 'cedear' ? `${fmtAcc(o.cedears)} CEDEARs a $ ${fmtARS.format(o.precioCedear)} · ` : ''}${fmtAcc(o.acciones)} acc × ${fmtU(o.precio)}` : ''}</span></div><div class="row" style="gap:4px;flex:none;flex-wrap:nowrap"><span class="mono op-amt ${o.tipo === 'venta' ? 'up' : o.tipo === 'dividendo' ? 'up' : ''}">${o.tipo === 'compra' ? '−' : '+'}${fmtU(opMonto(o), 2)}</span><button class="mini-btn" data-act="del-op" data-id="${o.id}">${ICONS.trash}</button></div></div>`).join('') || emptyInline('Sin operaciones', 'Cargar', 'new-op')}
  </div>`;
  return html;
}
/** Evolución: tu cartera contra la "cartera sombra" (mismas compras/ventas hechas en SPY) por rango: YTD · 1A · 3A · 5A · Todo */
/** Composición de la cartera como mapa de bloques: el área es el peso, así que no hace falta leyenda.
 *  Nueve bloques en tres filas (alto de cada fila = peso de la fila, ancho de cada bloque = su peso)
 *  y una franja para el resto. La variación del día va sin color a propósito: si el mapa se pinta de
 *  verde y rojo compite con el semáforo del resto de la app. */
/** Mapa de bloques (treemap "squarified"): el area de cada bloque es exactamente su peso y el tono va de
 *  blanco (el mas pesado) a gris oscuro (el mas liviano), asi tamaño y color dicen lo mismo.
 *  Antes eran filas de tres con flex-grow y la altura de cada fila salia del contenido, no del peso:
 *  NVDA con 9,4 % quedaba mas chica que META con 6,9 % (Facu, 27-sep).
 *  El layout se calcula en porcentajes sobre una caja de proporcion fija, asi que las areas siguen siendo
 *  proporcionales a cualquier ancho de pantalla.
 *  items: [{ label, peso (0..1), der, act, id }] — `der` es la cifra chica de la derecha. otras: { n, peso, label, der, act } o null. */
const CMAP_W = 358, CMAP_H = 200;   // caja de referencia (celular): solo decide la forma, no el area
function squarify(vals, x, y, w, h) {
  // Bruls, Huizing, van Wijk (2000). vals ya escalados al area w*h, ordenados de mayor a menor
  const out = []; let fila = [], i = 0;
  const peor = (f, lado) => { const s = sum(f); const mx = Math.max(...f), mn = Math.min(...f); return Math.max(lado * lado * mx / (s * s), (s * s) / (lado * lado * mn)); };
  const cerrar = f => {
    const s = sum(f);
    if (w >= h) { const ww = s / h; let yy = y; f.forEach(v => { const hh = v / ww; out.push([x, yy, ww, hh]); yy += hh; }); x += ww; w -= ww; }
    else { const hh = s / w; let xx = x; f.forEach(v => { const ww = v / hh; out.push([xx, y, ww, hh]); xx += ww; }); y += hh; h -= hh; }
  };
  while (i < vals.length) {
    const v = vals[i]; const lado = Math.min(w, h);
    if (!fila.length || peor(fila.concat(v), lado) <= peor(fila, lado)) { fila.push(v); i++; }
    else { cerrar(fila); fila = []; }
  }
  if (fila.length) cerrar(fila);
  return out;
}
/** Mapa anidado para "Donde se fue": los grupos son marcos y adentro cada categoria es un bloque del tamaño
 *  de lo que gastaste. Esencial en gris, elegible (lo que se puede recortar) en celeste: de un vistazo se ve
 *  cuanta plata se fue en cosas evitables y en cuales. grupos: [{ id, label, v, items: [{ id, label, v, eleg }] }] */
/** nombre corto para los bloques: "Seguro y mantenimiento del auto" no entra en un bloque de 70 px */
const NOM_CORTO = { 'Comida del trabajo': 'Laburo', 'Salidas a comer': 'Salidas', 'Seguro y mantenimiento del auto': 'Auto', 'Peajes y estacionamiento': 'Peajes', 'Transporte público': 'Transporte', 'Médicos y estudios': 'Médicos', 'Cuidado personal': 'Cuidado', 'Gimnasio y suplementos': 'Gimnasio', 'Comida de Odi': 'Comida', 'Baño e higiene de Odi': 'Baño', 'Juguetes y accesorios': 'Juguetes', 'Otros de Odi': 'Otros', 'Cine y entretenimiento': 'Cine', 'Otras compras': 'Otras', 'Teléfono y servicios': 'Servicios', 'Claude y suscripciones': 'Suscripciones', 'Impuestos y percepciones': 'Impuestos' };
function nomCorto(label) {
  const t = String(label).replace(/\s*\(.*\)\s*$/, '').trim();
  if (NOM_CORTO[t]) return NOM_CORTO[t];
  if (/^\+\d/.test(t)) return t;
  return t.length <= 12 ? t : t.split(/ y | e | de | del /)[0];
}
function mapaAnidado(grupos, alto = 300) {
  const W = 358, H = alto; const gs = grupos.filter(g => g.v > 0).sort((a, b) => b.v - a.v); if (!gs.length) return '';
  const tot = sum(gs.map(g => g.v)); const maxCat = Math.max(...gs.flatMap(g => g.items.map(it => it.v)), 1);
  // tono por tamaño en todo el mapa: lo que mas pesa, mas claro; lo chico, oscuro (Facu: aplica a todos los bloques)
  const tono = v => (0.07 + 0.30 * Math.pow(Math.min(1, v / maxCat), 0.8)).toFixed(3);
  const outer = squarify(gs.map(g => g.v / tot * W * H), 0, 0, W, H);
  const pct = (v, T) => (v / T * 100).toFixed(3);
  let html = '';
  gs.forEach((g, i) => {
    const [x, y, w, h] = outer[i];
    const cab = w >= 56 && h >= 58; const hh = cab ? 20 : 0; const pad = 3;
    const nombre = g.label.length * 8.2 + (w >= 96 ? 56 : 0) > w - 12 ? g.label.split(' ')[0] : g.label;
    html += `<div class="nm-g" style="left:${pct(x, W)}%;top:${pct(y, H)}%;width:${pct(w, W)}%;height:${pct(h, H)}%">${cab ? `<div class="nm-gh" style="font-size:${Math.max(8.5, Math.min(10.5, (w - (w >= 96 ? 70 : 16)) / (nombre.length * 0.92))).toFixed(1)}px"><span>${esc(nombre)}</span>${w >= 96 ? `<b>${M.c(g.v)}</b>` : ''}</div>` : ''}</div>`;
    // categorias dentro del marco. Regla: todo bloque dibujado tiene que poder leerse (nombre + monto).
    // Las que no entran se juntan en "+N"; si ese "+N" tampoco entra y pesa poco (<12 % del grupo), no se dibuja
    // (quedan en el total del grupo y al tocar el grupo en Gastos).
    const ix = x + pad, iy = y + hh + pad, iw = Math.max(1, w - 2 * pad), ih = Math.max(1, h - hh - 2 * pad);
    const MINW = 62, MINH = 46;
    const its = g.items.filter(it => it.v > 0).sort((a, b) => b.v - a.v);
    const entra = (r, chico) => chico ? r[2] >= 44 && r[3] >= 40 : r[2] >= MINW && r[3] >= MINH;
    let n = its.length, lista = its, inner = null;
    for (; n >= 1; n--) {
      const grandes = its.slice(0, n), chicos = its.slice(n);
      const resto = chicos.length ? { id: null, label: chicos.length === 1 ? chicos[0].label : `+${chicos.length} más`, v: sum(chicos.map(c => c.v)), eleg: chicos.every(c => c.eleg), resto: chicos.map(c => `${c.label} ${M.c(c.v)}`).join(' · '), id1: chicos.length === 1 ? chicos[0].id : null } : null;
      let L = resto ? [...grandes, resto] : grandes, tot = sum(L.map(it => it.v));
      let r = squarify(L.map(it => it.v / tot * iw * ih), ix, iy, iw, ih);
      if (resto && !entra(r[r.length - 1], true) && resto.v / g.v < 0.12) { L = grandes; tot = sum(L.map(it => it.v)); r = squarify(L.map(it => it.v / tot * iw * ih), ix, iy, iw, ih); }
      if (r.every((q, k) => entra(q, L[k] === resto))) { lista = L; inner = r; break; }
    }
    // ni una sola categoria entra legible junto al resto: un bloque con el grupo entero (el detalle esta al tocar el grupo en Gastos)
    if (!inner) { lista = [its.length === 1 ? its[0] : { id: null, label: `${its.length} categor\u00edas`, v: g.v, resto: its.map(c => `${c.label} ${M.c(c.v)}`).join(' \u00b7 ') }]; inner = [[ix, iy, iw, ih]]; }
    lista.forEach((it, j) => {
      const [cx, cy, cw, ch] = inner[j];
      const id = it.id || it.id1; const act = id ? ` data-act="ver-cat" data-id="${esc(id)}"` : '';
      const esResto = !it.id && !it.id1 && /^\+\d/.test(it.label); const monto = M.c(it.v); const nom = esResto && cw < 80 ? it.label.split(' ')[0] : nomCorto(it.label);
      // letra que entra en el ancho (sin "..."): monto de 20 a 12 px, nombre de 13 a 11 px
      const fsV = Math.max(12, Math.min(ch >= 90 && cw >= 120 ? 22 : ch >= 64 ? 18 : 15, Math.floor((cw - 16) / (monto.length * 0.6))));
      const pal = nom.split(' '); const lineas = pal.length > 1 && ch >= 68 && nom.length * 7 > cw - 16 ? 2 : 1;
      const fsN = Math.max(10, Math.min(13, Math.floor((cw - 14) / ((lineas === 2 ? Math.max(...pal.map(p => p.length)) : nom.length) * 0.55))));
      const soloMonto = !esResto && (cw < MINW || ch < MINH);
      html += `<div class="nm-c${it.eleg ? '' : ''}" style="left:${pct(cx, W)}%;top:${pct(cy, H)}%;width:${pct(cw, W)}%;height:${pct(ch, H)}%"${act} title="${esc(it.resto || it.label)}"><div style="background:rgba(255,255,255,${tono(it.v)})">${soloMonto ? '' : `<span style="font-size:${fsN}px;-webkit-line-clamp:${lineas}">${esc(nom)}</span>`}<b style="font-size:${soloMonto ? 11 : Math.max(11, Math.min(fsV, Math.floor((cw - 12) / (monto.length * 0.6))))}px">${monto}</b></div></div>`;
    });
    if (!cab) html += `<div class="nm-tag" style="left:${pct(x, W)}%;top:${pct(y, H)}%">${esc(g.label.split(' ')[0])}</div>`;
  });
  return `<div class="nmap" style="height:${alto}px">${html}</div>`;
}
function mapaBloques(items, otras = null) {
  const top = items.filter(it => it.peso > 0).sort((a, b) => b.peso - a.peso).slice(0, 9); if (!top.length) return '';
  const tot = sum(top.map(it => it.peso)); const mx = top[0].peso;
  const rects = squarify(top.map(it => it.peso / tot * CMAP_W * CMAP_H), 0, 0, CMAP_W, CMAP_H);
  const bs = top.map((it, i) => {
    const [x, y, w, h] = rects[i];
    // tono por peso (no por puesto): el mas pesado casi blanco, el mas liviano gris oscuro
    // bloque oscuro con tinte por peso (el mas pesado mas claro) y texto siempre blanco: se lee mejor que el gris lavado
    const a = 0.07 + 0.23 * Math.pow(it.peso / mx, 0.9);
    const oscuro = false;
    // bloques chicos: primero se cae la cifra de la derecha, despues todo va en un renglon;
    // el nombre achica la letra hasta entrar (nunca "ME...")
    const tam = h < 40 ? 'fila' : w < 84 ? 'ang' : w < 118 || h < 60 ? 's' : '';
    const conDer = (tam === '' && w >= 150) || (tam === 's' && w >= 150);
    const base = tam === '' ? 16 : tam === 's' ? 14 : 13;
    const fs = Math.max(10, Math.min(base, Math.floor((w * 0.88 - (tam === 'fila' ? 44 : 16)) / (String(it.label).length * 0.8))));
    const pos = `left:${(x / CMAP_W * 100).toFixed(3)}%;top:${(y / CMAP_H * 100).toFixed(3)}%;width:${(w / CMAP_W * 100).toFixed(3)}%;height:${(h / CMAP_H * 100).toFixed(3)}%`;
    const act = it.act ? ` data-act="${it.act}" data-id="${esc(it.id)}"` : '';
    return `<div class="cmap-c" style="${pos}"><div class="cmap-b ${tam} ${it.sel ? 'sel' : ''}"${act} style="background:rgba(255,255,255,${a.toFixed(3)});color:#FFFFFF">
      <b style="font-size:${fs}px">${esc(it.label)}</b><span class="n"><i>${M.pct(it.peso, 1)}</i>${conDer ? `<em class="${it.derCls || ''}">${it.der || ''}</em>` : ''}</span></div></div>`;
  }).join('');
  const franja = otras && otras.n ? `<div class="cmap-otras"${otras.act ? ` data-act="${otras.act}" role="button" style="cursor:pointer"` : ''}><span>${esc(otras.label)}</span><span>${otras.der != null ? otras.der : M.pct(otras.peso, 1)}</span></div>` : '';
  return `<div class="cmap"><div class="cmap-area">${bs}</div>${franja}</div>`;
}

function mapaCartera(k) {
  const top = k.posiciones.slice(0, 9); if (!top.length) return '';
  const resto = k.posiciones.slice(9);
  // sin color a proposito: si el mapa se pinta de verde y rojo compite con el semaforo del resto
  const dpTxt = p => p.dp == null ? '\u00B1x,xx %' : `${p.dp > 0 ? '+' : ''}${MENOS(p.dp.toLocaleString('es-AR', { maximumFractionDigits: 2 }))} %`;
  // el resto no entra al mapa: con pesos de 1-4 % el area deja de leerse (una sola en la ultima fila
  // quedaba mas grande que MELI). Se abre debajo como lista, con la barra relativa a la mayor del resto.
  const todas = !!ui.cmapTodas && resto.length > 0;
  const pesoResto = sum(resto.map(p => p.peso));
  const franja = resto.length ? { n: resto.length, peso: pesoResto, label: todas ? `Otras ${resto.length} \u00b7 ocultar` : `Otras ${resto.length} ${resto.length === 1 ? 'posici\u00f3n' : 'posiciones'} \u00b7 ver`, act: 'cmap-todas' } : null;
  const mx = Math.max(...resto.map(p => p.peso || 0), 0.0001);
  const lista = todas ? `<div class="cmap-lista">${resto.map(p => `<div class="cl-r" data-act="pos" data-id="${esc(p.ticker)}"><b>${esc(p.ticker)}</b><span class="cl-bar"><i style="width:${Math.max(2, Math.round((p.peso || 0) / mx * 100))}%"></i></span><span class="cl-p">${M.pct(p.peso, 1)}</span><span class="cl-d">${dpTxt(p)}</span></div>`).join('')}</div>` : '';
  return mapaBloques(top.map(p => ({ label: p.ticker, peso: p.peso, der: dpTxt(p), derCls: p.dp > 0 ? 'up' : p.dp < 0 ? 'down' : '', act: 'pos', id: p.ticker })), franja) + lista;
}

function renderEvolucion(k, seg) {
  const modo = ui.carteraVentana && k.ventanas[ui.carteraVentana] && !k.ventanas[ui.carteraVentana].masLargo ? ui.carteraVentana : (k.ventanas.anio.disponible ? 'anio' : 'inicio');
  const v = k.ventanas[modo];
  const rangos = `<div class="seg rangos">${E.VENTANAS.filter(([m]) => !k.ventanas[m].masLargo).map(([m, l]) => `<button class="${m === modo ? 'on' : ''} ${k.ventanas[m].disponible ? '' : 'off'}" data-act="cartera-ventana" data-id="${m}">${l}</button>`).join('')}</div>`;
  if (!v || !v.disponible) return `<div class="card"><div class="card-head"><h2>vs S&P 500</h2>${seg}</div>${rangos}${empty({ kind: 'periodo', icon: 'cal', head: v && v.motivo || 'Sin datos para esta ventana', sub: 'Probá con un período más largo.' })}</div>`;
  const r = v.rend; const alfaOk = r.alfa != null && r.alfa >= 0;
  const serie = E.carteraSerie(k, modo);
  let chart = '';
  if (serie && serie.fechas.length > 2) {
    // en ventanas cortas (≤ 45 días) el eje va por día en vez de por mes: 1 M con un solo "sep" no dice nada
    const diaLabels = (w) => { const cada = w < 520 ? 7 : 5; return serie.fechas.map((f, i) => (i % cada === 0 && i < serie.fechas.length - 2) ? String(Number(f.slice(8, 10))) : ''); };
    const corta = serie.fechas.length && D.daysBetween(serie.fechas[0], serie.fechas[serie.fechas.length - 1]) <= 45;
    const mesLabels = (w) => { if (corta) return diaLabels(w); const meses = serie.fechas.length > 260 ? 3 : (w < 520 ? 2 : 1); let n = -1; return serie.fechas.map((f, i) => { const ym = D.ym(f); const prev = i ? D.ym(serie.fechas[i - 1]) : null; if (i === 0 || ym === prev || i > serie.fechas.length - 4) return ''; n++; return n % meses === 0 ? (serie.fechas.length > 260 ? D.monthName(ym, true) : D.monthName(ym, true).split(' ')[0]) : ''; }); };
    const yFmt = x => MENOS(Math.abs(x) >= 1000 ? (x / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' k' : Math.round(x).toString());
    chart = ChartQ.reg(w => Charts.line({ w, labels: mesLabels(w), h: 220, yFmt, xSparse: true, tipFmt: x => fmtU(x, 0), tipTitle: i => D.fmt(serie.fechas[i], { year: true }), series: [
      { name: 'Invertido (neto)', color: 'var(--ink-3)', values: serie.invertido, dashed: true },
      { name: 'Sombra S&P 500', color: 'var(--c4)', values: serie.sombra },
      { name: 'Tu cartera', color: 'var(--accent)', values: serie.real, strong: true },
      { name: 'Tu cartera', color: 'var(--accent)', values: serie.sueltos, dots: true },
    ] }), 220) + Charts.legend([{ name: 'Tu cartera', color: 'var(--accent)', kind: 'line' }, { name: 'Sombra S&P 500', color: 'var(--c4)', kind: 'line' }, { name: 'Invertido neto', color: 'var(--ink-3)', kind: 'dash' }])
      + (serie.haySueltos ? `<div class="i-row">${infoBtn(`${serie.desdeDiario ? `Tu cartera se registra d\u00eda a d\u00eda desde el ${D.fmt(serie.desdeDiario)}` : 'Tu cartera se empieza a registrar d\u00eda a d\u00eda desde hoy'}; antes solo hay puntos sueltos (el arranque y las fotos guardadas). Los n\u00fameros de arriba s\u00ed cuentan todo el per\u00edodo: salen de tus operaciones.`)}</div>` : '');
  }
  // alfa por posición (mismas compras hechas en SPY): quién suma y quién resta
  const conAlfa = [...k.posiciones, ...k.cerradas].filter(p => p.alfaUSD != null).sort((a, b) => b.alfaUSD - a.alfaUSD);
  const top = conAlfa.slice(0, 4), bottom = conAlfa.slice(-4).reverse().filter(p => !top.includes(p));
  const alfaRow = p => `<div class="alfa-row"><span>${esc(p.ticker)}${p.acciones <= 0 ? ' <small class="muted">cerrada</small>' : ''}</span><i><b style="width:${Math.min(100, Math.abs(p.alfaUSD) / Math.max(1, Math.abs(conAlfa[0].alfaUSD), Math.abs(conAlfa[conAlfa.length - 1].alfaUSD)) * 100).toFixed(0)}%;background:${p.alfaUSD >= 0 ? 'var(--good)' : 'var(--crit)'}"></b></i><b class="mono ${p.alfaUSD >= 0 ? 'up' : 'down'}">${p.alfaUSD >= 0 ? '+' : '−'}${fmtU(Math.abs(p.alfaUSD), 0)}</b></div>`;
  const box = (l, v, cls, sub) => `<div class="box"><div class="l">${l}</div><div class="v ${cls}">${v}</div><div class="s">${sub}</div></div>`;
  return `<div class="card"><div class="card-head"><h2>vs S&P 500 <button class="info-btn" data-act="cartera-info" data-id="${modo}" aria-label="Cómo se calcula">${ICONS.info}</button></h2>${seg}</div>
    ${rangos}
    <div class="evo-kpi">
      ${box('Cartera', r.real != null ? pctS(r.real) : '—', r.real != null ? (r.real >= 0 ? 'up' : 'down') : '', k.valor != null ? fmtU(k.valor, 0) : 'sin precios')}
      ${box('Sombra S&P', pctS(r.sombra), r.sombra >= 0 ? 'up' : 'down', fmtU(v.sombraValor, 0))}
      ${box('Alfa', r.alfa != null ? `${r.alfa >= 0 ? '+' : '−'}${(Math.abs(r.alfa) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pp` : '—', r.alfa != null ? (alfaOk ? 'up' : 'down') : '', r.alfaUSD != null ? `${r.alfaUSD >= 0 ? '+' : '−'}${fmtU(Math.abs(r.alfaUSD), 0)}` : '')}
    </div>
    ${chart}
    ${conAlfa.length ? `<div class="divider"></div><div class="card-head" style="margin-bottom:6px"><h3>Alfa por posición</h3><span class="hint">vs SPY, desde el inicio</span></div>${top.map(alfaRow).join('')}${bottom.length ? `<div class="divider" style="margin:6px 0"></div>${bottom.map(alfaRow).join('')}` : ''}` : ''}
  </div>`;
}
/** ⓘ de la comparación: las tres medidas que usan los pros (acumulado money-weighted, TIR anual, TWR), cómo se arma la sombra y salvedades */
function infoEvolucion(modo) {
  const k = E.cartera(); const v = k.ventanas[modo] || k.ventanas.anio; if (!v || !v.disponible) return;
  const r = v.rend; const puntos = Object.keys(state.cartera.historial || {}).length; const anual = v.dias >= 30;
  const p = x => x == null ? '<span class="muted">—</span>' : `<span class="${x >= 0 ? 'up' : 'down'}">${pctS(x)}</span>`;
  const tabla = `<table class="metricas"><thead><tr><th>${D.fmt(v.desde, { year: true })}<br>hasta hoy, ${v.dias} días</th><th>Cartera</th><th>Sombra S&P</th><th>SPY solo</th></tr></thead><tbody>
    <tr><td>Acumulado<small>${r.metodo === 'tir' ? 'ponderado por dinero (TIR)' : 'ponderado por dinero (Dietz)'}</small></td><td>${p(r.real)}</td><td>${p(r.sombra)}</td><td>${p(r.spyDirecto)}</td></tr>
    <tr><td>TIR anual<small>${anual ? 'la misma tasa, por año' : 'a partir de 30 días'}</small></td><td>${anual ? p(r.tirReal) : p(null)}</td><td>${anual ? p(r.tirSombra) : p(null)}</td><td>${p(r.tirSpy)}</td></tr>
    <tr><td>Ponderado por tiempo<small>${r.twr == null && (k.twrReal = k.twrReal || E.twrReal(k)) ? `TWR: solo con valuaciones diarias reales (desde el ${D.fmt(k.twrReal.desde, { year: true })}: ${pctS(k.twrReal.twr)} vs SPY ${k.twrReal.spy != null ? pctS(k.twrReal.spy) : '\u2014'})` : 'TWR, sin efecto de tus aportes'}</small></td><td>${p(r.twr)}</td><td>${p(r.spyDirecto)}</td><td>${p(r.spyDirecto)}</td></tr>
  </tbody></table>`;
  Modal.open({ title: 'Cómo se calcula', submit: '', body: `<div class="stack small" style="line-height:1.5">
    ${tabla}
    <p><b>Precio contra precio.</b> Acá no cuentan dividendos, ni los tuyos ni los del S&P: solo compras, ventas y cotización. Con dividendos, tu cartera rindió ${r.realDiv != null ? pctS(r.realDiv) : '—'} en este rango${r.dividendosVentana ? ` (${fmtU(r.dividendosVentana)} cobrados)` : ''}: es el número de la card "Valor de la cartera". <b>Acumulado</b> es lo que ves en las cajas: cuánto rindió tu plata en el rango contando cuándo entró cada aporte (TIR, el "personal rate of return" de Fidelity o Sharesight). <b>TIR anual</b> es esa misma tasa expresada por año. <b>TWR</b> es la norma profesional (GIPS): mide tu selección de activos sin premiar ni castigar el momento de los aportes; acá se aproxima entre valuaciones guardadas (${puntos} hasta ahora, una por día al traer precios).</p>
    <p><b>Sombra S&P 500.</b> ${v.V0 ? `Lo que tenías el ${D.fmt(v.desde, { year: true })} (${fmtU(v.V0, 0)}) pasa a SPY a ${fmtU(v.spy0)}${v.aprox ? ' (valuación aproximada)' : ''}; después` : `Arranca en cero el ${D.fmt(v.desde, { year: true })} y`} cada compra o venta se replica el mismo día en SPY por el mismo monto. Las operaciones nuevas usan el SPY del momento en que las guardás; las anteriores, el cierre del día. Alfa = cartera − sombra, en puntos y en dólares.</p>
    ${v.nota ? `<p class="callout amber" style="margin:0">${esc(v.nota)}</p>` : ''}
  </div>` });
}


/** Distribuci\u00f3n de los CEDEARs por grupo: anillo + lista con las empresas de cada grupo. Tocar una empresa cambia su grupo. */
const DIST_COL = ['var(--accent)', 'var(--c1)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--c9)'];
function distCartera(k) {
  const d = Grupo.distribucion(k); if (!d.grupos.length) return '<div class="muted small">Sin posiciones todav\u00eda.</div>';
  const pc = v => M.pct(v, v < 0.1 ? 1 : 0);
  return `<div class="dist"><div class="dist-d">${Charts.donut({ slices: d.grupos.map((g, i) => ({ name: g.nombre, value: g.valor, color: DIST_COL[i % DIST_COL.length] })), size: 170, thick: 24, center: `CEDEARs|${fmtU(d.total, 0)}` })}</div>
    <div class="dist-l">${d.grupos.map((g, i) => `<div class="dist-g"><div class="dist-h"><i style="background:${DIST_COL[i % DIST_COL.length]}"></i><span>${esc(g.nombre)}</span><b>${pc(g.pct)}</b><em>${fmtU(g.valor, 0)}</em></div>
      <div class="dist-t">${g.items.map(x => `<button type="button" data-act="grupo-cambiar" data-id="${esc(x.t)}">${esc(x.t)} <small>${pc(x.pct)}</small></button>`).join('')}</div></div>`).join('')}</div>
    <div class="small muted" style="margin-top:10px">Toc\u00e1 una empresa para cambiarla de grupo.</div></div>`;
}
function formGrupo(t) {
  const act = Grupo.de(t);
  Modal.open({ title: `Grupo de ${t}`, submit: '', body: `<div class="small muted" style="margin-bottom:10px">Eleg\u00ed d\u00f3nde cuenta en la distribuci\u00f3n.</div><div class="dist-pick">${Grupo.LISTA.map(g => `<button type="button" class="btn ${g === act ? 'primary' : ''}" data-act="grupo-set" data-id="${esc(t)}|${esc(g)}">${esc(g)}</button>`).join('')}</div>` });
}
/** tocar la card Portfolio: dona con la distribucion (antes estaba fija en la card de abajo) */
function verDistribucion() {
  const pt = E.patrimonio(E.cartera()); if (!pt.activos.length) return;
  const leyenda = pt.grupos.map(g => `<div class="pat-g"><i style="background:${g.color}"></i><span>${esc(g.nombre)}</span><b>${M.pct(g.valor / pt.total, 1)}</b><span class="sub">${fmtU(g.valor, 0)}</span></div>`).join('');
  const reservaCls = pt.reservaPct == null ? '' : pt.reservaPct >= pt.reservaObjetivo ? 'ok' : pt.reservaPct >= pt.reservaObjetivo * 0.6 ? 'mid' : 'bad';
  Modal.open({ title: 'D\u00f3nde est\u00e1 tu plata', submit: '', body: `<div class="pat-top">
      <div class="pat-donut">${Charts.donut({ slices: pt.grupos.map(g => ({ name: g.nombre, value: g.valor, color: g.color })), size: 150, thick: 22, center: `Total|${fmtU(pt.total, 0)}` })}</div>
      <div class="pat-leg">${leyenda}</div>
    </div>
    <div class="pat-res"><span>Reserva (efectivo + fondos) vs CEDEARs</span><b class="${reservaCls}">${pt.reservaPct != null ? M.pct(pt.reservaPct, 1) : '\u2014'}</b><span class="sub">objetivo ${M.pct(pt.reservaObjetivo, 0)} \u00b7 <button type="button" class="link-btn" data-act="reserva-objetivo">cambiar</button></span></div>` });
}
/** boton chiquito de arriba: exportar o cargar */
function menuClaude() {
  Modal.open({ title: 'Claude', submit: '', body: `<div class="stack" style="gap:8px"><button class="btn primary" data-act="export-claude" style="width:100%">Exportar para Claude</button><button class="btn" data-act="import-claude" style="width:100%">Cargar actualizaciones</button></div>` });
}

/* ---------- Toda tu plata: CEDEARs + efectivo, fondos, letras, bonos y bitcoin ---------- */
function renderPatrimonio(k) {
  const pt = E.patrimonio(k); const hay = pt.activos.length > 0;
  const fmtM = (v, moneda) => moneda === 'ARS' ? `$ ${fmtARS.format(Math.round(v))}` : fmtU(v, 0);
  const fila = a => `<div class="act-r" data-act="activo" data-id="${a.id}"><div class="act-l"><b>${esc(a.nombre)}</b><span class="sub">${esc(E.TIPOS_ACTIVO[a.tipo] || '')}${a.detalle ? ' \u00b7 ' + esc(a.detalle) : ''}</span></div><div class="act-v"><b>${a.valorUSD != null ? fmtU(a.valorUSD, 0) : '\u2014'}</b><span class="sub">${a.valorMoneda != null && a.moneda === 'ARS' ? fmtM(a.valorMoneda, 'ARS') : (pt.total && a.valorUSD != null ? M.pct(a.valorUSD / pt.total, 1) : '')}</span></div></div>`;
  return `<div class="card section"><div class="card-head"><h2>Otros activos ${pt.mep ? infoBtn(`Total en pesos al CCL ($ ${fmtARS.format(pt.mep)}): $ ${fmtARS.format(Math.round(pt.total * pt.mep))}. Los pesos se pasan a d\u00f3lares al CCL. La caja contable de la app (dividendos y ventas) no se suma: esa plata ya est\u00e1 en alguno de estos activos.`) : ''}</h2><button class="btn sm" data-act="new-activo">${ICONS.plus} Activo</button></div>
    ${hay ? `
    ${pt.sinPrecio.length ? `<p class="small warn-text" style="margin:0 0 6px">Sin precio: ${pt.sinPrecio.map(esc).join(', ')}. Se actualiza con los precios.</p>` : ''}
    <div class="act-list">${pt.activos.map(fila).join('')}</div>`
    : `<p class="ob-nota" style="margin:0">Ac\u00e1 van el efectivo, el fondo de Lecaps, letras, bonos y bitcoin, para ver d\u00f3nde est\u00e1 toda tu plata y qu\u00e9 parte es reserva. Los CEDEARs ya est\u00e1n. Toc\u00e1 "Activo" para cargar el primero.</p>`}
  </div>`;
}


/** "hace 3 min", "hace 2 h", "hace 5 días" */
function haceTxt(t) { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`; const h = Math.round(m / 60); if (h < 36) return `hace ${h} h`; return `hace ${Math.round(h / 24)} días`; }

/** aviso de respaldo: rojo si los datos viven solo en este dispositivo, ámbar si hace mucho que no suben */
function renderRespaldoBanner() {
  if (!state.movimientos.length && !(state.cartera && state.cartera.operaciones.length)) return '';
  if (!Gist.cfg()) return `<div class="callout crit" style="margin-bottom:14px"><b>Tus datos viven solo en este dispositivo.</b> Si lo perdés o borrás el navegador, se pierden. Conectá tu GitHub en <a data-go="config" style="color:var(--accent);text-decoration:underline;cursor:pointer">Ajustes</a>: tarda 2 minutos y de ahí en más se guarda solo.</div>`;
  const t = Gist.ultimoPush(); if (t && Date.now() - t > 7 * 86400000) return `<div class="callout amber" style="margin-bottom:14px"><b>Hace ${Math.round((Date.now() - t) / 86400000)} días que no sube a GitHub.</b> Abrí Ajustes y tocá "Traer ahora" para ver si hay un problema con el token.</div>`;
  return '';
}


/* ---------- Reserva en pesos: el fondo con valor cuota real y que tendrias en MP / dolar / inflacion ---------- */
function renderReservaCard(pt) {
  const fondos = pt.activos.filter(a => a.tipo === 'fci' && a.reserva);
  if (!fondos.length) return '';
  const a = fondos[0]; const r = a.reserva; const act = (state.cartera.activos || []).find(x => x.id === a.id);
  const pc2 = v => `${v >= 0 ? '+' : '\u2212'}${(Math.abs(v) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}`;
  const sem = b => b.dif == null ? { cls: 'off', txt: '\u2014' } : { cls: b.dif >= 0 ? 'pos' : 'neg', txt: `${pc2(b.dif)} pp` };
  const chips = [['MP', r.mp], ['CCL', r.ccl], ['Inflaci\u00f3n', r.ipc]].map(([k, b]) => { const x = sem(b); return `<span class="rsv-c ${x.cls}">${k}<b>${x.txt}</b></span>`; }).join('');
  const pierde = [['Mercado Pago', r.mp], ['el d\u00f3lar CCL', r.ccl], ['la inflaci\u00f3n', r.ipc]].filter(([, b]) => b.dif != null && b.dif < -0.0005);
  const alerta = pierde.length ? `<div class="rsv-alerta">La reserva pierde contra ${pierde.map(([n, b]) => `${n} (${pc2(b.dif)} pp por mes${b.difPesos != null ? `, $ ${fmtARS.format(Math.round(Math.abs(b.difPesos)))} menos` : ''})`).join(' y ')}.</div>` : (r.dias >= 7 ? `<div class="rsv-ok">La reserva le gana a las tres alternativas desde que la pusiste.</div>` : '');
  const ced = (pt.grupos.find(g => g.id === 'cedears') || {}).valor || 0; const pesoPct = ced ? a.valorUSD / ced : null;  // contra los CEDEARs
  return `<div class="card kpi rsv tap" data-act="activo" data-id="${a.id}">
    <div class="label">Reserva en pesos <span class="soft">\u00b7 ${esc(a.nombre)}</span></div>
    <div class="rsv-top"><div class="value">$ ${fmtARS.format(Math.round(r.valor))}</div><div class="rsv-usd">${r.usdHoy != null ? fmtU(r.usdHoy, 0) : '\u2014'}${pesoPct != null ? ` <span class="soft">\u00b7 ${M.pct(pesoPct, 1)} de tus CEDEARs (objetivo ${M.pct(pt.reservaObjetivo, 0)})</span>` : ''}</div></div>
    <div class="rsv-tasa"><span>TEM <b>${r.tem != null ? (r.tem * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' %' : '\u2014'}</b></span><span>TNA <b>${r.tna != null ? (r.tna * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %' : '\u2014'}</b></span><span>${Math.round(r.dias)} d\u00edas \u00b7 vc al ${D.fmt(r.corte)}</span><span class="soft">${r.ganado >= 0 ? '+' : '\u2212'}$ ${fmtARS.format(Math.round(Math.abs(r.ganado)))}</span></div>
    <div class="rsv-sem">${chips}</div>
    ${r.dias < 7 ? `<div class="rsv-sucio">Primeros ${Math.max(1, Math.round(r.dias))} d\u00edas: los n\u00fameros todav\u00eda tienen ruido.</div>` : alerta}
    ${r.faltan.length ? `<div class="small warn-text">Sin valor cuota para ${r.faltan.map(D.fmt).join(', ')}: ese lote no se cuenta.</div>` : ''}
  </div>`;
}
