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
  let html = `<div class="grid g-3">`;
  state.tarjetas.forEach((t, i) => {
    const now = E.cardNow(t, hoy);
    const consumoPeriodo = sum(E.data().pieces.filter(p => p.m.medio === 'tarjeta' && p.m.tarjetaId === t.id && p.mesPago === now.mesPago && p.idx === 1 && !p.m.recId).map(p => p.montoARS));
    const prox = E.proximoPago(t, hoy);
    const cerrando = E.resumen(t.id, now.mesPago);
    const lim = Number(t.limite) || 0; const uso = lim ? (prox.ym === now.mesPago ? cerrando.total : prox.total + cerrando.total) / lim : 0;
    const cierreDesde = D.addDays(E.fechaCierre(t.id, D.addMonths(now.mesPago, -1)), 1);
    html += `<div class="tcard" data-act="edit-card" data-id="${t.id}" style="cursor:pointer">
      <div class="tname"><span><i class="bankdot" style="background:${cardDot(t.color || CARD_COLORS[i % CARD_COLORS.length])}"></i>${esc(t.nombre)}<span style="font-weight:400;color:var(--ink-3);font-size:13px"> ${esc(t.banco || '')}</span></span><button class="mini-btn" data-act="edit-card" data-id="${t.id}">${ICONS.edit}</button></div>
      <div><div style="font-size:12px;color:var(--ink-3)">Período ${D.fmt(cierreDesde)} – ${D.fmt(now.cierre)} · cierra en ${now.diasAlCierre} día${now.diasAlCierre === 1 ? '' : 's'}</div><div class="tbig">${M.f(cerrando.total)}</div></div>
      <div class="tmeta"><span>Consumo nuevo<b>${M.f(consumoPeriodo)}</b></span><span>Cuotas y fijos<b>${M.f(cerrando.total - consumoPeriodo)}</b></span>${prox.ym !== now.mesPago ? `<span>A pagar el ${D.fmt(prox.fecha)}<b>${M.f(prox.total)}</b></span>` : ''}</div>
      ${lim ? `<div style="margin-top:10px"><div class="row between" style="font-size:11px;color:var(--ink-3)"><span>Límite ${M.c(lim)}</span><span>${M.pct(uso)}</span></div><div class="meter lim ${uso >= 0.85 ? 'warn' : ''}" style="margin-top:6px"><i class="${uso >= 0.85 ? 'glow-fill warn' : ''}" style="width:${clamp(uso * 100, 0, 100)}%"></i></div></div>` : ''}
    </div>`;
  });
  html += `<button class="card" data-act="new-card" style="display:flex;align-items:center;justify-content:center;gap:8px;color:var(--ink-3);font-weight:700;min-height:150px;border-style:dashed;cursor:pointer">${ICONS.plus} Agregar tarjeta</button></div>`;

  // Plan de pago del mes
  const meses = D.range(ym, 3);
  html += `<div class="card section"><div class="card-head"><h2>Plan de pago</h2><span class="hint">Qué vence, cuándo y de dónde sale</span></div>
    <div class="table-wrap"><table><thead><tr><th>Cierre</th><th>Tarjeta</th><th class="r">Monto</th><th>Sale de</th><th>Pagado</th></tr></thead><tbody>
    ${meses.flatMap(m => state.tarjetas.map(t => { const r = E.resumen(t.id, m); if (!r.total && m !== ym) return ''; const p = state.pagos.find(p => p.tarjetaId === t.id && p.mes === m) || {};
      return `<tr style="${p.pagado ? 'opacity:.55' : ''}"><td class="mono" style="white-space:nowrap">${D.fmt(E.fechaCierre(t.id, m), { year: true })}</td><td><b style="font-weight:500">${esc(t.nombre)}</b><span class="sub">${r.pieces.length} ítems · vence ${D.fmt(r.fecha)}</span></td><td class="amount r"><b>${M.f(r.total)}</b></td>
      <td><select class="input sm" data-pago="${t.id}|${m}"><option value="">Elegir cuenta…</option>${state.cuentas.map(c => `<option value="${c.id}" ${p.cuentaId === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></td>
      <td><label class="switch"><input type="checkbox" data-pagado="${t.id}|${m}" ${p.pagado ? 'checked' : ''}><span>${p.pagado ? 'Sí' : 'No'}</span></label></td></tr>`; })).join('')}
    </tbody></table></div>
    <p class="small muted" style="margin-top:8px">Tocá una tarjeta arriba para editar sus datos (cierre, vencimiento, límite). Los resúmenes futuros incluyen las cuotas que ya conocés.</p></div>`;

  // Cuentas
  const pend = state.pagos.filter(p => !p.pagado && p.cuentaId);
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>De dónde sale la plata</h2><button class="btn sm" data-act="new-cuenta">${ICONS.plus} Cuenta</button></div>
      ${state.cuentas.length ? state.cuentas.map(c => { const saldo = M.toARS(Number(c.saldo) || 0, c.moneda); const asig = sum(pend.filter(p => p.cuentaId === c.id).map(p => E.resumen(p.tarjetaId, p.mes).total)); const desp = saldo - asig + (c.esSueldo ? (Number(state.settings.ingreso) || 0) : 0);
        return `<div class="list-item"><div><b style="font-weight:500">${esc(c.nombre)}</b>${c.esSueldo ? ' <span class="tag">cobro el sueldo acá</span>' : ''}<span class="sub small muted">${esc(c.tipo || '')}${asig ? ` · ${M.f(asig)} asignados a resúmenes` : ''}</span></div><div class="row" style="gap:4px"><div style="text-align:right"><div class="mono">${M.f(saldo)}${c.moneda === 'USD' ? `<span class="sub">US$ ${fmtUSD.format(Number(c.saldo) || 0)}</span>` : ''}</div>${asig || c.esSueldo ? `<div class="small ${desp < 0 ? 'pill crit' : 'muted'}">tras pagar${c.esSueldo ? ' + sueldo' : ''}: ${M.f(desp)}</div>` : ''}</div><button class="mini-btn" data-act="edit-cuenta" data-id="${c.id}">${ICONS.edit}</button></div></div>`; }).join('') : empty({ kind: 'setup', icon: 'chart', head: 'Falta decir con qué pagás', sub: 'Cargá tus cuentas y Gastos te dice si llegás a cubrir cada resumen.', btn: 'Agregar cuenta', action: 'new-cuenta' })}
    </div>
    <div class="card"><div class="card-head"><h2>Detalle del resumen</h2><div class="row" style="gap:6px"><select class="input sm" id="res-card">${state.tarjetas.map(t => `<option value="${t.id}" ${ui.resCard === t.id ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select><select class="input sm" id="res-mes">${D.range(D.addMonths(ym, -2), 8).map(m => `<option value="${m}" ${(ui.resMes || E.cardNow(state.tarjetas[0], hoy).mesPago) === m ? 'selected' : ''}>cierre ${D.fmt(E.fechaCierre((ui.resCard || state.tarjetas[0].id), m), { year: true })}</option>`).join('')}</select></div></div>
      <div id="res-detalle">${renderResumenDetalle(ui.resCard || state.tarjetas[0].id, ui.resMes || E.cardNow(state.tarjetas[0], hoy).mesPago)}</div>
    </div>
  </div>`;
  return html;
}

function renderResumenDetalle(tarjetaId, ym) {
  const r = E.resumen(tarjetaId, ym); const t = L.tarjeta(tarjetaId);
  if (!r.pieces.length) return empty({ kind: 'periodo', icon: 'cal', head: 'Sin consumos en este resumen', sub: 'Los que hagas antes del cierre aparecen acá.' });
  const rows = r.pieces.slice().sort((a, b) => a.m.fecha.localeCompare(b.m.fecha));
  const cuotas = sum(rows.filter(p => p.idx > 1).map(p => p.montoARS));
  return `<div class="row between small muted" style="margin-bottom:8px"><span>Cierra ${D.fmt(E.fechaCierre(tarjetaId, ym), { year: true })} · vence ${D.fmt(r.fecha, { year: true })} · ${rows.length} ítems</span><span>Cuotas de compras anteriores: <b class="mono">${M.f(cuotas)}</b></span></div>
  <div class="table-wrap"><table><thead><tr><th>Compra</th><th>Concepto</th><th class="r">Importe</th></tr></thead><tbody>${rows.map(p => `<tr><td class="mono muted" style="white-space:nowrap">${D.fmt(p.m.fecha)}</td><td>${esc(p.m.desc)}${p.n > 1 ? ` <span class="tag">${p.idx}/${p.n}</span>` : ''}${p.m.recId ? ' <span class="tag">fijo</span>' : ''}</td><td class="amount r">${M.f(p.montoARS)}</td></tr>`).join('')}<tr><td></td><td><b>Total</b></td><td class="amount r"><b>${M.f(r.total)}</b></td></tr></tbody></table></div>`;
}

/* ---------- PLAN: presupuesto e inversión ---------- */
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
      <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Grupo</th><th>Tipo</th><th></th></tr></thead><tbody>${state.categorias.map(c => { const used = state.movimientos.some(m => m.catId === c.id) || state.recurrentes.some(r => r.catId === c.id); return `<tr><td><span class="row nowrap" style="gap:6px;flex-wrap:nowrap"><i class="swatch" style="background:${L.catColor(c.id)}"></i>${esc(c.nombre)}</span></td><td class="small">${esc(L.grupo(c.grupo).nombre)}</td><td class="small">${c.tipo}</td><td class="r" style="white-space:nowrap"><button class="mini-btn" data-act="edit-cat" data-id="${c.id}">${ICONS.edit}</button>${!used && c.id !== 'otros' ? `<button class="mini-btn" data-act="del-cat" data-id="${c.id}">${ICONS.trash}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    </div>
    <div class="card"><div class="card-head"><h2>Datos</h2></div>
      <div class="stack">
        ${(() => { const g = Gist.cfg(); return g
          ? `<div class="list-item"><div><b style="font-weight:500">Sincronización entre dispositivos</b><span class="sub small muted">Conectada a tu GitHub (gist ${esc(String(g.id).slice(0, 8))}…). Sube al guardar y baja al abrir la app.</span></div><div class="row" style="gap:4px"><button class="btn sm" data-act="gist-pull">Traer ahora</button><button class="btn sm danger" data-act="gist-off">Desconectar</button></div></div>`
          : `<div class="list-item" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><b style="font-weight:500">Sincronización entre dispositivos</b><span class="sub small muted">Guarda tus datos en un gist privado de tu GitHub para verlos iguales en el celu y la PC. Creá un token clásico con permiso "gist" en github.com, en Settings, Developer settings, Personal access tokens, Tokens (classic), y pegalo acá (una vez por dispositivo).</span></div><div class="row" style="gap:6px;width:100%;margin-top:8px"><input class="input sm" type="password" id="g-token" placeholder="ghp_…" style="flex:1;min-width:160px"><button class="btn sm primary" data-act="gist-connect">Conectar</button></div></div>`; })()}
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
  html += `<div class="px-strip"><span class="px-txt">${hayKey ? `${k.conPrecio ? `<b>Precios ${fechaTxt}</b>` : '<b>Sin precios todav\u00eda</b>'}${k.conPrecio && k.conPrecio < k.posiciones.length ? ` \u00b7 <span class="warn-text">${k.posiciones.length - k.conPrecio} sin precio</span>` : ''}${s.ccl ? ' \u00b7 CCL ' + fmtARS.format(k.ccl) : ''}${k.spyHoy ? ' \u00b7 SPY ' + MENOS(k.spyHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''}` : '<b>Falta tu clave de Finnhub</b>'}</span>${hayKey ? `<button class="icon-btn" data-act="precios-update" aria-label="Actualizar precios" title="Actualizar precios">${ICONS.repeat}</button>` : '<button class="btn sm" data-act="go-config">Configurar</button>'}</div>`;
  if (enZona.length) html += `<div class="callout ${enZona.some(p => p.estado === 'urgente') ? 'crit' : 'amber'}" style="margin-bottom:14px"><b>${enZona.some(p => p.estado === 'urgente') ? 'Che, comprá urgente' : 'Che, mirala'}:</b> ${enZona.map(p => `<b>${esc(p.ticker)}</b> ${fmtU(p.precio)} (${G.le} ${fmtU(p.estado === 'urgente' ? p.alerta.urgente : p.alerta.mirala)})`).join(' · ')}</div>`;
  const valorTxt = k.valor != null ? fmtU(k.valor, 0) : fmtU(k.costo, 0); const valorTotTxt = k.valorTotal != null ? fmtU(k.valorTotal, 0) : valorTxt;
  const n0 = x => Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 0 }); const sg = x => x >= 0 ? '+' : '−';
  const va = k.ventanas.anio, vi = k.ventanas.inicio; const vAlfa = va.disponible ? va : vi.disponible ? vi : null;
  const rendStat = (kLabel, v) => v && v.disponible && v.rend.realDiv != null ? { k: kLabel, v: pctS(v.rend.realDiv), cls: v.rend.realDiv >= 0 ? 'pos' : 'neg' } : { k: kLabel, v: '—' };
  const ultimoDiv = k.ops.filter(o => o.tipo === 'dividendo').sort((a, b) => b.fecha.localeCompare(a.fecha) || (Number(b.monto) || 0) - (Number(a.monto) || 0))[0];
  const cajaTotal = (k.valorTotal != null ? k.valorTotal : k.costo);
  html += `<div class="grid g-kpi">
    ${kpi({ label: k.valor != null ? 'Valor de la cartera' : 'Cartera a costo', value: valorTotTxt, cls: 'hero',
      stats: k.gp != null ? [rendStat('YTD', va), rendStat('Total', vi)] : null,
      foot: k.gp != null ? `${sg(k.gpTotal)}${fmtU(Math.abs(k.gpTotal), 0)} ganados · precio ${sg(k.gp)}${n0(k.gp)}${k.dividendos ? ` · div +${n0(k.dividendos)}` : ''}${k.realizado ? ` · realizado ${sg(k.realizado)}${n0(k.realizado)}` : ''}` : 'sin precios todavía' })}
    ${kpi({ label: 'En pesos al CCL', value: M.c(cajaTotal * k.ccl, { cur: 'ARS' }),
      stats: [Number(s.ingreso) > 0 ? { k: 'Sueldos', v: `${(cajaTotal * k.ccl / Number(s.ingreso)).toLocaleString('es-AR', { maximumFractionDigits: 1 })}` } : { k: 'Costo', v: M.c(k.costo * k.ccl, { cur: 'ARS' }) }, k.gpTotal != null ? { k: 'Ganaste', v: `${sg(k.gpTotal)}${M.c(Math.abs(k.gpTotal) * k.ccl, { cur: 'ARS' })}`, cls: k.gpTotal >= 0 ? 'pos' : 'neg' } : { k: 'Ganaste', v: '—' }],
      foot: s.ccl ? `CCL $ ${fmtARS.format(k.ccl)}${s.cclFecha ? ' · ' + D.fmt(s.cclFecha) : ''}${s.cclHora ? ' ' + new Date(s.cclHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}` : 'CCL no cargado — se trae con el MEP' })}
    ${vAlfa && vAlfa.rend.alfa != null ? kpi({ label: vAlfa === va ? 'vs S&P 500 este año' : 'vs S&P 500 desde el inicio', value: `<span class="${vAlfa.rend.alfa >= 0 ? 'pos' : 'neg'}">${sg(vAlfa.rend.alfa)}${(Math.abs(vAlfa.rend.alfa) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pp</span>`,
      stats: [{ k: vAlfa.rend.alfaUSD >= 0 ? 'Le ganás' : 'Te gana', v: `${sg(vAlfa.rend.alfaUSD)}${fmtU(Math.abs(vAlfa.rend.alfaUSD), 0)}`, cls: vAlfa.rend.alfaUSD >= 0 ? 'pos' : 'neg' }, vAlfa === va && vi.disponible && vi.rend.alfa != null ? { k: 'Total', v: `${sg(vi.rend.alfa)}${(Math.abs(vi.rend.alfa) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pp`, cls: vi.rend.alfa >= 0 ? 'pos' : 'neg' } : { k: 'Tu cartera', v: pctS(vAlfa.rend.real), cls: vAlfa.rend.real >= 0 ? 'pos' : 'neg' }],
      foot: `precio contra precio · S&P ${pctS(vAlfa.rend.spyDirecto)}` }) : kpi({ label: 'vs S&P 500', value: '—', foot: 'sin comparación todavía' })}
    ${kpi({ label: 'Dividendos cobrados', value: fmtU(k.dividendos),
      stats: [{ k: 'S/ costo', v: k.costo && k.dividendos ? M.pct(k.dividendos / k.costo, 1) : '—' }, { k: 'Caja', v: k.cajaEntradas ? (k.caja > 0.005 ? fmtU(k.caja, 2) : 'usada') : '—' }],
      foot: ultimoDiv ? `último: ${esc(ultimoDiv.ticker)} ${fmtU(Number(ultimoDiv.monto) || 0, 2)} · ${D.fmt(ultimoDiv.fecha)}` : 'cargalos con el +, opción Dividendo' })}
  </div>`;
  const conc = state.cartera.conciliacion || null;
  // composición ↔ evolución
  const modo = ui.carteraChart || 'comp';
  const seg = `<div class="seg" style="padding:2px"><button class="${modo === 'comp' ? 'on' : ''}" data-act="cartera-chart" data-id="comp" style="padding:4px 10px;font-size:12.5px">Composición</button><button class="${modo === 'evo' ? 'on' : ''}" data-act="cartera-chart" data-id="evo" style="padding:4px 10px;font-size:12.5px">vs S&P 500</button></div>`;
  let chartCard;
  if (modo === 'comp') {
    chartCard = `<div class="card"><div class="card-head"><h2>Composición</h2>${seg}</div>${mapaCartera(k)}</div>`;
  } else chartCard = renderEvolucion(k, seg);
  html += `<div class="grid g-12 section">
    ${chartCard}
    <div class="card"><div class="card-head"><h2>Posiciones</h2><button class="btn sm" data-act="new-op">${ICONS.plus} Operación</button></div>
      ${k.posiciones.map(p => `<div class="pos-row" data-act="pos" data-id="${esc(p.ticker)}">
        <div class="pos-l"><b>${esc(p.ticker)}</b><span class="sub">${p.cedear ? `${fmtAcc(Math.round(Cedears.aCedears(p.acciones, p.cedear) * 100) / 100)} CEDEARs · ` : ''}${fmtAcc(p.acciones)} acc</span><span class="sub">PPC ${fmtU(p.ppc)}</span></div>
        <div class="pos-m">${p.precio != null ? `<span class="mono">${fmtU(p.precio)}</span><span class="sub ${p.dp > 0 ? 'up' : p.dp < 0 ? 'down' : ''}">${p.dp != null ? (p.dp > 0 ? '+' : '') + MENOS(p.dp.toLocaleString('es-AR', { maximumFractionDigits: 2 })) + ' % hoy' : ''}</span>` : `<span class="muted small">sin precio</span>`}</div>
        <div class="pos-r"><b class="mono">${fmtU(p.valor != null ? p.valor : p.costo, 0)}</b><span class="sub">${p.gpTotal != null ? `<span class="${p.gpTotal >= 0 ? 'up' : 'down'}">${pctS(p.rendTotal)}</span>${p.dividendos ? '<span class="muted" title="incluye dividendos">+d</span>' : ''} · ` : ''}${M.pct(p.peso, 1)}${p.estado ? ` · <span class="dot ${p.estado === 'urgente' ? 'crit' : 'warn'}" style="margin-right:0"></span>` : ''}${conc && conc.items[p.ticker] && !conc.items[p.ticker].ok ? ` · <span class="warn-text">Balanz dice ${fmtAcc(conc.items[p.ticker].balanz)}</span>` : ''}${(() => { const b = Fund.balance(p.ticker); return b && b.dias <= 7 ? ` · <span class="warn-text">balance ${b.dias === 0 ? 'hoy' : b.dias === 1 ? 'mañana' : 'en ' + b.dias + ' d'}</span>` : ''; })()}</span></div>
      </div>`).join('')}
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
      <div class="al-top"><div><b>${esc(p.ticker)}</b>${p.acciones ? '' : ' <span class="tag">watchlist</span>'}<span class="sub">${pr != null ? `hoy ${fmtU(pr)}` : 'sin precio'}${p.objetivo ? ` · obj ${fmtUSD.format(p.objetivo)}${p.upside != null ? ` (${pctS(p.upside, 0)})` : ''}` : ''}</span></div>${chip}</div>
      ${al.desc ? `<div class="al-desc">${esc(al.desc)}</div>` : ''}
      <div class="al-bar"><i class="${p.estado === 'urgente' ? 'glow-fill crit' : p.estado === 'mirala' ? 'glow-fill warn' : ''}" style="width:${Math.round(cerca * 100)}%;background:${p.estado === 'urgente' ? 'var(--crit)' : p.estado === 'mirala' ? 'var(--warn)' : 'var(--accent)'}"></i></div>
      <div class="al-lv"><span><span class="dot warn"></span>${G.le} ${al.mirala ? fmtUSD2.format(al.mirala).replace(',00', '') : '—'}${dM != null ? ` <small>${p.estado ? 'en zona' : '−' + M.pct(dM, 1)}</small>` : ''}</span><span><span class="dot crit"></span>${G.le} ${al.urgente ? fmtUSD2.format(al.urgente).replace(',00', '') : '—'}${dU != null ? ` <small>${p.estado === 'urgente' ? 'en zona' : '−' + M.pct(Math.max(0, dU), 1)}</small>` : ''}</span></div>
    </div>`;
  };
  const ordenAl = conAlerta.slice().sort((a, b) => (a.estado === 'urgente' ? 0 : a.estado === 'mirala' ? 1 : 2) - (b.estado === 'urgente' ? 0 : b.estado === 'mirala' ? 1 : 2) || ((a.distMirala ?? 9) - (b.distMirala ?? 9)));
  html += `<div class="card section"><div class="card-head"><h2>Alertas de precio</h2><div class="row" style="gap:8px"><button class="icon-btn" data-act="balances" aria-label="Calendario de balances" title="Calendario de balances">${ICONS.cuotas}</button><button class="btn sm ghost" data-act="comparar">Comparar</button><button class="btn sm" data-act="new-watch">${ICONS.plus} Ticker</button></div></div>
    ${ordenAl.length ? ordenAl.map(alRow).join('') : emptyInline('Sin alertas cargadas', 'Agregar', 'new-watch')}
  </div>`;
  // operaciones
  const ops = k.ops.slice().reverse().slice(0, 25);
  const opMonto = o => o.tipo === 'dividendo' ? Number(o.monto) || 0 : (Number(o.acciones) || 0) * (Number(o.precio) || 0);
  html += `<div class="card section"><div class="card-head"><h2>Operaciones</h2><span class="hint">${k.ops.length} · tocá para editar${k.legados ? ` · <span class="tag" style="color:var(--warn-text)">${k.legados} con fecha estimada</span>` : ''}</span></div>
    ${ops.map(o => `<div class="list-item op-row" data-act="edit-op" data-id="${o.id}" style="cursor:pointer"><div style="min-width:0"><b style="font-weight:500">${o.tipo === 'compra' ? 'Compra' : o.tipo === 'venta' ? 'Venta' : 'Dividendo'} ${esc(o.ticker)}</b>${o.legado ? ' <span class="tag" style="color:var(--warn-text)">fecha estimada</span>' : ''}${o.verif && o.verif.nivel !== 'ok' ? ` <span class="tag ${o.verif.nivel === 'block' ? 'verif-block' : 'verif-warn'}">${o.verif.nivel === 'block' ? G.no : G.warn} revisar</span>` : ''}${(o.deCaja || o.deDividendos) > 0 ? ` <span class="tag">con caja ${fmtU(o.deCaja || o.deDividendos, 0)}</span>` : ''}${o.aCaja ? ' <span class="tag">a caja</span>' : ''}${k.dupIds.has(o.id) ? ' <span class="tag verif-warn">¿duplicada?</span>' : ''}<span class="sub small muted">${D.fmt(o.fecha, { year: true })}${o.tipo !== 'dividendo' ? ` · ${o.modo === 'cedear' ? `${fmtAcc(o.cedears)} CEDEARs a $ ${fmtARS.format(o.precioCedear)} · ` : ''}${fmtAcc(o.acciones)} acc × ${fmtU(o.precio)}` : ''}</span></div><div class="row" style="gap:4px;flex:none;flex-wrap:nowrap"><span class="mono op-amt ${o.tipo === 'venta' ? 'up' : o.tipo === 'dividendo' ? 'up' : ''}">${o.tipo === 'compra' ? '−' : '+'}${fmtU(opMonto(o), 2)}</span><button class="mini-btn" data-act="del-op" data-id="${o.id}">${ICONS.trash}</button></div></div>`).join('') || emptyInline('Sin operaciones', 'Cargar', 'new-op')}
  </div>`;
  // control de calidad: conciliación con Balanz + operaciones con advertencias
  const conAviso = k.ops.filter(o => o.verif && o.verif.nivel !== 'ok').length; const concDias = conc ? D.daysBetween(conc.fecha, D.today()) : null;
  html += `<div class="card section"><div class="card-head"><h2>Control</h2><button class="btn sm ${!conc || concDias > 35 ? 'primary' : ''}" data-act="conciliar">Conciliar con Balanz</button></div>
    <div class="list-item"><div><b style="font-weight:500">Tenencia vs Balanz</b><span class="sub small muted">${conc ? `${D.fmt(conc.fecha, { year: true })} · ${conc.n} posición${conc.n === 1 ? '' : 'es'} revisada${conc.n === 1 ? '' : 's'}` : 'todavía no conciliaste'}</span></div>${conc ? (conc.dif ? `<span class="pill warn">${G.warn} ${conc.dif} diferencia${conc.dif > 1 ? 's' : ''}</span>` : `<span class="pill good">${G.ok} coincide</span>`) : `<span class="pill neutral">pendiente</span>`}</div>
    ${k.duplicadas.length ? `<div class="list-item"><div><b style="font-weight:500">Posibles duplicadas</b><span class="sub small muted">${k.duplicadas.slice(0, 3).map(([a, b]) => `${a.tipo} ${esc(a.ticker)} ${D.fmt(a.fecha)} / ${D.fmt(b.fecha)}`).join(' · ')}${k.duplicadas.length > 3 ? ' …' : ''} — marcadas en la lista</span></div><span class="pill warn">${k.duplicadas.length}</span></div>` : ''}
    <div class="list-item"><div><b style="font-weight:500">Operaciones con advertencias</b><span class="sub small muted">${conAviso ? `marcadas ${G.warn} en la lista: tocá para revisar` : 'cada operación se verifica contra NY, CCL, ratio y SPY al guardarla'}</span></div>${conAviso ? `<span class="pill warn">${conAviso}</span>` : `<span class="pill good">0</span>`}</div>
  </div>`;
  // trabajar con Claude
  html += renderPatrimonio(k);
  html += `<div class="card section"><div class="card-head"><h2>Trabajar con Claude</h2><span class="hint">análisis y niveles</span></div>
    <div class="row" style="gap:8px"><button class="btn primary" data-act="export-claude">Exportar para Claude</button><button class="btn" data-act="import-claude">Cargar actualizaciones</button></div>
  </div>`;
  return html;
}
/** Evolución: tu cartera contra la "cartera sombra" (mismas compras/ventas hechas en SPY) por rango: YTD · 1A · 3A · 5A · Todo */
/** Composición de la cartera como mapa de bloques: el área es el peso, así que no hace falta leyenda.
 *  Nueve bloques en tres filas (alto de cada fila = peso de la fila, ancho de cada bloque = su peso)
 *  y una franja para el resto. La variación del día va sin color a propósito: si el mapa se pinta de
 *  verde y rojo compite con el semáforo del resto de la app. */
/** Mapa de bloques proporcionales: el area es el dato, asi que no hace falta leyenda.
 *  Hasta nueve bloques en tres filas (alto de la fila = peso de la fila, ancho del bloque = su peso)
 *  y una franja para el resto. Sirve igual para posiciones de cartera que para grupos de gasto:
 *  el color es solo jerarquia, que es lo unico que una rampa secuencial sabe hacer.
 *  items: [{ label, peso (0..1), der, act, id }] — `der` es la cifra chica de la derecha.
 *  otras: { n, peso } o null. */
function mapaBloques(items, otras = null, todas = false) {
  const top = todas ? items.slice() : items.slice(0, 9); if (!top.length) return '';
  const TK = [14, 12, 11], NM = [10.5, 9.5, 9], PD = [9, 8, 7];
  // flex-grow reparte el espacio libre solo hasta donde suman los factores: con pesos de 0 a 1
  // la suma queda por debajo de 1 y los bloques no llegan a llenar la fila. Se escalan.
  const G = 1000, grow = x => Math.max(x * G, 0.01);
  // con pocos items no tiene sentido forzar tres filas: quedan tiras de 20 px ilegibles
  const porFila = 3, nFilas = top.length <= 3 ? 1 : top.length <= 6 ? 2 : Math.ceil(top.length / porFila);
  const filas = Array.from({ length: nFilas }, (_, r) => top.slice(r * porFila, (r + 1) * porFila)).filter(f => f.length).map((fila, r) => {
    const bs = fila.map(it => {
      const i = top.indexOf(it);
      // rampa de cian por opacidad: por debajo de alfa 0,62 el texto oscuro ya no se lee
      const attrs = it.act ? ` data-act="${it.act}" data-id="${esc(it.id)}" style="cursor:pointer;` : ' style="';
      return `<div class="cmap-b"${attrs}flex-grow:${grow(it.peso)};background:var(--c${Math.min(i, 8) + 1});color:${i < 3 ? 'var(--on-fill)' : '#FFFFFF'};padding:${PD[Math.min(r, 2)]}px">
        <b style="font-size:${TK[Math.min(r, 2)]}px">${esc(it.label)}</b>
        <span class="n" style="font-size:${NM[Math.min(r, 2)]}px"><i>${M.pct(it.peso, 1)}</i><em>${it.der || ''}</em></span>
      </div>`;
    }).join('');
    return `<div class="cmap-row" style="flex-grow:${grow(sum(fila.map(x => x.peso)))}">${bs}</div>`;
  }).join('');
  // la franja del resto se toca: abre el mapa con todas las posiciones (y vuelve)
  const franja = otras && otras.n ? `<div class="cmap-otras"${otras.act ? ` data-act="${otras.act}" role="button" style="cursor:pointer"` : ''}><span>${esc(otras.label)}</span><span>${otras.der != null ? otras.der : M.pct(otras.peso, 1)}</span></div>` : '';
  // con todas, el alto crece con las filas: 210 px para tres, ~52 por fila de ahi en mas
  return `<div class="cmap"${nFilas > 3 ? ` style="height:${Math.max(210, nFilas * 52)}px"` : ''}>${filas}${franja}</div>`;
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
  return mapaBloques(top.map(p => ({ label: p.ticker, peso: p.peso, der: dpTxt(p), act: 'pos', id: p.ticker })), franja) + lista;
}

function renderEvolucion(k, seg) {
  const modo = ui.carteraVentana && k.ventanas[ui.carteraVentana] ? ui.carteraVentana : (k.ventanas.anio.disponible ? 'anio' : 'inicio');
  const v = k.ventanas[modo];
  const rangos = `<div class="seg rangos">${E.VENTANAS.map(([m, l]) => `<button class="${m === modo ? 'on' : ''} ${k.ventanas[m].disponible ? '' : 'off'}" data-act="cartera-ventana" data-id="${m}">${l}</button>`).join('')}</div>`;
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
      + (serie.haySueltos ? `<p class="small muted" style="margin:8px 0 0">${serie.desdeDiario ? `Tu cartera se registra d\u00eda a d\u00eda desde el ${D.fmt(serie.desdeDiario)}` : 'Tu cartera se empieza a registrar d\u00eda a d\u00eda desde hoy'}; antes solo hay puntos sueltos (el arranque y las fotos guardadas). Los n\u00fameros de arriba s\u00ed cuentan todo el per\u00edodo: salen de tus operaciones.</p>` : '');
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
    <tr><td>Ponderado por tiempo<small>TWR, sin efecto de tus aportes</small></td><td>${p(r.twr)}</td><td>${p(r.spyDirecto)}</td><td>${p(r.spyDirecto)}</td></tr>
  </tbody></table>`;
  Modal.open({ title: 'Cómo se calcula', submit: '', body: `<div class="stack small" style="line-height:1.5">
    ${tabla}
    <p><b>Precio contra precio.</b> Acá no cuentan dividendos, ni los tuyos ni los del S&P: solo compras, ventas y cotización. Con dividendos, tu cartera rindió ${r.realDiv != null ? pctS(r.realDiv) : '—'} en este rango${r.dividendosVentana ? ` (${fmtU(r.dividendosVentana)} cobrados)` : ''}: es el número de la card "Valor de la cartera". <b>Acumulado</b> es lo que ves en las cajas: cuánto rindió tu plata en el rango contando cuándo entró cada aporte (TIR, el "personal rate of return" de Fidelity o Sharesight). <b>TIR anual</b> es esa misma tasa expresada por año. <b>TWR</b> es la norma profesional (GIPS): mide tu selección de activos sin premiar ni castigar el momento de los aportes; acá se aproxima entre valuaciones guardadas (${puntos} hasta ahora, una por día al traer precios).</p>
    <p><b>Sombra S&P 500.</b> ${v.V0 ? `Lo que tenías el ${D.fmt(v.desde, { year: true })} (${fmtU(v.V0, 0)}) pasa a SPY a ${fmtU(v.spy0)}${v.aprox ? ' (valuación aproximada)' : ''}; después` : `Arranca en cero el ${D.fmt(v.desde, { year: true })} y`} cada compra o venta se replica el mismo día en SPY por el mismo monto. Las operaciones nuevas usan el SPY del momento en que las guardás; las anteriores, el cierre del día. Alfa = cartera − sombra, en puntos y en dólares.</p>
    ${v.nota ? `<p class="callout amber" style="margin:0">${esc(v.nota)}</p>` : ''}
  </div>` });
}


/* ---------- Toda tu plata: CEDEARs + efectivo, fondos, letras, bonos y bitcoin ---------- */
function renderPatrimonio(k) {
  const pt = E.patrimonio(k); const hay = pt.activos.length > 0;
  const fmtM = (v, moneda) => moneda === 'ARS' ? `$ ${fmtARS.format(Math.round(v))}` : fmtU(v, 0);
  const fila = a => `<div class="act-r" data-act="activo" data-id="${a.id}"><div class="act-l"><b>${esc(a.nombre)}</b><span class="sub">${esc(E.TIPOS_ACTIVO[a.tipo] || '')}${a.detalle ? ' \u00b7 ' + esc(a.detalle) : ''}</span></div><div class="act-v"><b>${a.valorUSD != null ? fmtU(a.valorUSD, 0) : '\u2014'}</b><span class="sub">${a.valorMoneda != null && a.moneda === 'ARS' ? fmtM(a.valorMoneda, 'ARS') : (pt.total && a.valorUSD != null ? M.pct(a.valorUSD / pt.total, 1) : '')}</span></div></div>`;
  const leyenda = pt.grupos.map(g => `<div class="pat-g"><i style="background:${g.color}"></i><span>${esc(g.nombre)}</span><b>${M.pct(g.valor / pt.total, 1)}</b><span class="sub">${fmtU(g.valor, 0)}</span></div>`).join('');
  const reservaCls = pt.reservaPct == null ? '' : pt.reservaPct >= pt.reservaObjetivo ? 'ok' : pt.reservaPct >= pt.reservaObjetivo * 0.6 ? 'mid' : 'bad';
  return `<div class="card section"><div class="card-head"><h2>Toda tu plata</h2><button class="btn sm" data-act="new-activo">${ICONS.plus} Activo</button></div>
    ${hay ? `
    <div class="pat-top">
      <div class="pat-donut">${Charts.donut({ slices: pt.grupos.map(g => ({ name: g.nombre, value: g.valor, color: g.color })), size: 150, thick: 22, center: `Total|${fmtU(pt.total, 0)}` })}</div>
      <div class="pat-leg">${leyenda}</div>
    </div>
    <div class="pat-res"><span>Reserva (efectivo + fondos)</span><b class="${reservaCls}">${pt.reservaPct != null ? M.pct(pt.reservaPct, 1) : '\u2014'}</b><span class="sub">objetivo ${M.pct(pt.reservaObjetivo, 0)} \u00b7 <button type="button" class="link-btn" data-act="reserva-objetivo">cambiar</button></span></div>
    ${pt.mep ? `<p class="small muted" style="margin:0 0 6px">Total en pesos al MEP ($ ${fmtARS.format(pt.mep)}): $ ${fmtARS.format(Math.round(pt.total * pt.mep))}. Los CEDEARs valen lo de arriba; los pesos se pasan a d\u00f3lares al MEP. La caja contable de la app (dividendos y ventas) no se suma: esa plata ya est\u00e1 en alguno de estos activos.</p>` : ''}
    ${pt.sinPrecio.length ? `<p class="small warn-text" style="margin:0 0 6px">Sin precio: ${pt.sinPrecio.map(esc).join(', ')}. Se actualiza con los precios.</p>` : ''}
    <div class="act-list">${pt.activos.map(fila).join('')}</div>`
    : `<p class="ob-nota" style="margin:0">Ac\u00e1 van el efectivo, el fondo de Lecaps, letras, bonos y bitcoin, para ver d\u00f3nde est\u00e1 toda tu plata y qu\u00e9 parte es reserva. Los CEDEARs ya est\u00e1n. Toc\u00e1 "Activo" para cargar el primero.</p>`}
  </div>`;
}
