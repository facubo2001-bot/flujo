/* ===================== FLUJO — views B: tarjetas, plan, tendencias, config ===================== */

const CARD_COLORS = ['#1F4E79', '#5B2C6F', '#7A3E1D', '#1E5E4A', '#3B3B6B', '#7A1F3D'];

/* ---------- TARJETAS Y PAGOS ---------- */
function viewTarjetas() {
  const hoy = D.today(); const ym = ui.mes;
  if (!state.tarjetas.length) return `<div class="card"><div class="empty">Todavía no cargaste tarjetas. <button class="btn primary sm" data-act="new-card" style="margin-left:8px">${ICONS.plus} Agregar tarjeta</button></div></div>`;
  let html = `<div class="grid g-3">`;
  state.tarjetas.forEach((t, i) => {
    const now = E.cardNow(t, hoy);
    const consumoPeriodo = sum(E.data().pieces.filter(p => p.m.medio === 'tarjeta' && p.m.tarjetaId === t.id && p.mesPago === now.mesPago && p.idx === 1 && !p.m.recId).map(p => p.montoARS));
    const prox = E.proximoPago(t, hoy);
    const cerrando = E.resumen(t.id, now.mesPago);
    const lim = Number(t.limite) || 0; const uso = lim ? (prox.ym === now.mesPago ? cerrando.total : prox.total + cerrando.total) / lim : 0;
    const cierreDesde = D.addDays(E.fechaCierre(t.id, D.addMonths(now.mesPago, -1)), 1);
    html += `<div class="tcard" data-act="edit-card" data-id="${t.id}" style="cursor:pointer;background:linear-gradient(135deg,${t.color || CARD_COLORS[i % CARD_COLORS.length]},${t.color || CARD_COLORS[i % CARD_COLORS.length]}cc)">
      <div class="tname"><span>${esc(t.nombre)}<span style="font-weight:400;opacity:.8;font-size:13px"> ${esc(t.banco || '')}</span></span><button class="mini-btn" style="color:#fff" data-act="edit-card" data-id="${t.id}">${ICONS.edit}</button></div>
      <div><div style="font-size:12px;opacity:.85">Período ${D.fmt(cierreDesde)} – ${D.fmt(now.cierre)} · cierra en ${now.diasAlCierre} día${now.diasAlCierre === 1 ? '' : 's'}</div><div class="tbig">${M.f(cerrando.total)}</div></div>
      <div class="tmeta"><span>Consumo nuevo<b>${M.f(consumoPeriodo)}</b></span><span>Cuotas y fijos<b>${M.f(cerrando.total - consumoPeriodo)}</b></span>${prox.ym !== now.mesPago ? `<span>A pagar el ${D.fmt(prox.fecha)}<b>${M.f(prox.total)}</b></span>` : ''}</div>
      ${lim ? `<div style="margin-top:8px"><div class="row between" style="font-size:11px;opacity:.9"><span>Límite ${M.c(lim)}</span><span>${M.pct(uso)}</span></div><div class="meter" style="background:rgba(255,255,255,.2);height:6px;margin-top:3px"><i style="width:${clamp(uso * 100, 0, 100)}%;background:#fff"></i></div></div>` : ''}
    </div>`;
  });
  html += `<button class="card" data-act="new-card" style="display:grid;place-items:center;color:var(--ink-3);font-weight:600;min-height:150px;border-style:dashed;cursor:pointer">${ICONS.plus} Agregar tarjeta</button></div>`;

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
        return `<div class="list-item"><div><b style="font-weight:500">${esc(c.nombre)}</b>${c.esSueldo ? ' <span class="tag">cobro el sueldo acá</span>' : ''}<span class="sub small muted">${esc(c.tipo || '')}${asig ? ` · ${M.f(asig)} asignados a resúmenes` : ''}</span></div><div class="row" style="gap:4px"><div style="text-align:right"><div class="mono">${M.f(saldo)}${c.moneda === 'USD' ? `<span class="sub">US$ ${fmtUSD.format(Number(c.saldo) || 0)}</span>` : ''}</div>${asig || c.esSueldo ? `<div class="small ${desp < 0 ? 'pill crit' : 'muted'}">tras pagar${c.esSueldo ? ' + sueldo' : ''}: ${M.f(desp)}</div>` : ''}</div><button class="mini-btn" data-act="edit-cuenta" data-id="${c.id}">${ICONS.edit}</button></div></div>`; }).join('') : '<div class="empty">Agregá tus cuentas (caja de ahorro, Mercado Pago, dólares, Balanz) para planificar con qué pagás cada resumen.</div>'}
    </div>
    <div class="card"><div class="card-head"><h2>Detalle del resumen</h2><div class="row" style="gap:6px"><select class="input sm" id="res-card">${state.tarjetas.map(t => `<option value="${t.id}" ${ui.resCard === t.id ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select><select class="input sm" id="res-mes">${D.range(D.addMonths(ym, -2), 8).map(m => `<option value="${m}" ${(ui.resMes || E.cardNow(state.tarjetas[0], hoy).mesPago) === m ? 'selected' : ''}>cierre ${D.fmt(E.fechaCierre((ui.resCard || state.tarjetas[0].id), m), { year: true })}</option>`).join('')}</select></div></div>
      <div id="res-detalle">${renderResumenDetalle(ui.resCard || state.tarjetas[0].id, ui.resMes || E.cardNow(state.tarjetas[0], hoy).mesPago)}</div>
    </div>
  </div>`;
  return html;
}

function renderResumenDetalle(tarjetaId, ym) {
  const r = E.resumen(tarjetaId, ym); const t = L.tarjeta(tarjetaId);
  if (!r.pieces.length) return '<div class="empty">Sin consumos en este resumen.</div>';
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
    { l: 'Ingreso', v: ing.total, color: 'var(--s3)', kind: 'in' },
    { l: 'Fijos', v: -mg.fijos, color: 'var(--s1)' },
    { l: 'Cuotas del mes', v: -c.cuotas, color: 'var(--s4)' },
    { l: 'Compras', v: -c.compras, color: 'var(--s2)' },
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
    <div class="card"><div class="card-head"><h2>Cascada del mes</h2><span class="hint">Sueldo → fijos → cuotas → compras → libre</span></div><div class="waterfall">${wf}</div>
      <div class="divider"></div>
      <div class="row between"><div><div class="small muted">${ym < D.thisMonth() ? 'Quedó para invertir' : 'Podés invertir'}</div><div style="font-family:var(--font-display);font-size:22px;font-weight:600">${M.f(Math.max(0, libre))}</div><div class="small muted">objetivo ${M.f(meta)}${libre > meta ? ` · sobran ${M.f(libre - meta)} del presupuesto` : libre < meta ? ` · faltan ${M.f(meta - libre)}` : ''}</div></div><button class="btn primary sm" data-act="new-inv">${ICONS.invest} Registrar inversión</button></div>
    </div>
    <div class="card"><div class="card-head"><h2>Ingreso, gasto e inversión</h2><span class="hint">Últimos 12 meses</span></div>
      ${ChartQ.reg(w => Charts.stacked({ w, h: 230, labels: hz12.map(h => D.monthName(h.ym, true)), series: [{ name: 'Gastos del mes', color: 'var(--s2)', values: hz12.map(h => h.gasto) }, { name: 'Invertido', color: 'var(--s3)', values: hz12.map(h => h.inv) }], line: { name: 'Ingreso', color: 'var(--ink-2)', values: hz12.map(h => h.ingreso || null) } }), 230)}
      ${Charts.legend([{ name: 'Gasto', color: 'var(--s2)' }, { name: 'Invertido', color: 'var(--s3)' }, { name: 'Ingreso', color: 'var(--ink-2)', kind: 'dash' }])}
    </div>
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
      ${(() => { const list = state.inversiones.slice().sort((a, b) => M.toARS(b.monto, b.moneda) - M.toARS(a.monto, a.moneda)); if (!list.length) return '<div class="empty">Registrá lo que aportás a Balanz, BTC o plazo fijo para medir tu tasa de ahorro real.</div>'; const tot = sum(list.map(i => M.toARS(i.monto, i.moneda))); return list.map(i => `<div class="list-item"><div><b style="font-weight:500">${esc(i.destino || i.desc || 'Inversión')}</b><span class="sub small muted">${esc(i.desc && i.destino ? i.desc : D.fmt(i.fecha))}</span></div><div class="row" style="gap:4px"><span class="mono">${i.moneda === 'USD' ? 'US$ ' + (Number(i.monto) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : M.f(i.monto)}</span><button class="mini-btn" data-act="del-inv" data-id="${i.id}">${ICONS.trash}</button></div></div>`).join('') + `<div class="list-item" style="border-top:1px solid var(--line)"><b>Total invertido</b><b class="mono">${M.f(tot)}</b></div>`; })()}
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
  const necSeries = [1, 2, 3].map(k => ({ name: NECESIDAD[k], color: k === 1 ? 'var(--seq4)' : k === 2 ? 'var(--seq2)' : 'var(--s8)', values: cons.map(c => c.byNec[k]) }));
  const innecPct = cons.map(c => c.total ? c.byNec[3] / c.total : null);
  html += `<div class="grid g-2 section">
    <div class="card"><div class="card-head"><h2>Necesario vs innecesario</h2><span class="hint">Según cómo lo marcaste</span></div>
      ${ChartQ.reg(w => Charts.stacked({ w, h: 220, labels, series: necSeries }), 220)}${Charts.legend(necSeries.map(s => ({ name: s.name, color: s.color })))}
      <div class="row between small" style="margin-top:8px"><span class="muted">Innecesario, % del total:</span><span class="mono">${innecPct.map((p, i) => `${labels[i].split(' ')[0]} ${p == null ? '—' : M.pct(p)}`).join(' · ')}</span></div>
    </div>
    <div class="card"><div class="card-head"><h2>Total, compras, fijos y cuotas</h2></div>
      ${ChartQ.reg(w => Charts.line({ w, h: 220, labels, series: [{ name: 'Total', color: 'var(--accent)', values: cons.map(c => c.total || null), strong: true, area: true }, { name: 'Compras', color: 'var(--s2)', values: cons.map(c => c.count ? c.compras : null) }, { name: 'Fijos', color: 'var(--s1)', values: cons.map(c => c.count ? c.fijo : null) }, { name: 'Cuotas', color: 'var(--s4)', values: cons.map(c => c.count ? c.cuotas : null) }], refY: state.settings.ingreso || null, refLabel: 'Ingreso' }), 220)}
      ${Charts.legend([{ name: 'Total', color: 'var(--accent)', kind: 'line' }, { name: 'Compras', color: 'var(--s2)', kind: 'line' }, { name: 'Fijos', color: 'var(--s1)', kind: 'line' }, { name: 'Cuotas', color: 'var(--s4)', kind: 'line' }])}
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
      <div class="table-wrap"><table><thead><tr><th>Categoría</th><th class="r">${labels[n - 1]}</th><th class="r">${labels[n - 2] || 'Ant.'}</th><th class="r">Prom. 3m</th><th class="r">Δ vs prom.</th></tr></thead><tbody>
      ${catRows.map(r => { const d = r.avg ? (r.v - r.avg) / r.avg : null; return `<tr><td><span class="row nowrap" style="gap:6px;flex-wrap:nowrap"><i class="swatch" style="background:${L.catColor(r.cat.id)}"></i>${esc(r.cat.nombre)}</span></td><td class="amount r">${M.f(r.v)}</td><td class="amount r muted">${M.f(r.p)}</td><td class="amount r muted">${M.f(r.avg)}</td><td class="r">${d == null ? '—' : `<span class="pill ${d > 0.25 ? 'crit' : d > 0.1 ? 'warn' : d < -0.1 ? 'good' : 'neutral'}">${d > 0 ? '+' : ''}${M.pct(d)}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Dónde gastás más</h2><span class="hint">Top comercios, ${n} meses, sin fijos (compras a valor total)</span></div>
      <div class="table-wrap"><table><thead><tr><th>Comercio</th><th class="r">Veces</th><th class="r">Total</th><th class="r">Promedio</th></tr></thead><tbody>
      ${top.map(t => `<tr><td><b style="font-weight:500">${esc(t.desc)}</b><span class="sub">${L.cat(t.cat).nombre}</span></td><td class="mono r">${t.n}</td><td class="amount r">${M.f(t.total)}</td><td class="amount r muted">${M.f(t.total / t.n)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin datos</td></tr>'}
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
      ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => `<div class="meter-row"><div class="l"><span>${d}</span></div><div class="v"><b class="mono">${M.f(wd[i])}</b> <span class="muted">· ${wn[i]}</span></div><div class="meter"><i style="width:${wd[i] / wdMax * 100}%;background:var(--s1)"></i></div></div>`).join('')}
    </div>
    <div class="card"><div class="card-head"><h2>Medio de pago</h2><span class="hint">${D.monthName(ym, true)}</span></div>
      ${medios.length ? medios.map((m, i) => `<div class="meter-row"><div class="l"><span>${esc(m.name)}</span></div><div class="v"><b class="mono">${M.f(m.value)}</b> <span class="muted">${M.pct(m.value / cur.total)}</span></div><div class="meter"><i style="width:${m.value / cur.total * 100}%;background:var(--s7)"></i></div></div>`).join('') : '<div class="empty">Sin datos</div>'}
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
      ${inp('nombre', 'Nombre', s.nombre, 'placeholder="Facu"')}
      ${inp('ingreso', 'Sueldo neto mensual (ARS)', s.ingreso ? fmtARS.format(s.ingreso) : '', 'inputmode="numeric"')}
      ${inp('diaCobro', 'Día de cobro', s.diaCobro, 'inputmode="numeric"')}
      ${inp('tc', 'Dólar MEP (ARS por USD)', s.tc, 'inputmode="numeric"', `${s.tcFecha ? `Actualizado ${D.fmt(s.tcFecha, { year: true })}${s.tcFuente ? ' · ' + esc(s.tcFuente) : ''}. ` : ''}Se usa para la vista en USD y para gastos en dólares. <a href="#" data-act="tc-update">Actualizar desde dolarapi.com</a>`)}
      ${inp('presupuesto', 'Presupuesto mensual de gasto (ARS)', s.presupuesto ? fmtARS.format(s.presupuesto) : '', 'inputmode="numeric"', `Lo que decidís gastar por mes (fijos + cuotas + compras). El resto del sueldo${s.ingreso && s.presupuesto ? ` (${M.f(s.ingreso - s.presupuesto)})` : ''} es para invertir.`)}
      ${inp('alertaCuotasPct', 'Alerta de cuotas (% del presupuesto)', s.alertaCuotasPct, 'inputmode="numeric"', 'Te aviso cuando fijos + cuotas superan esto')}
    </div></div>
    <div class="card"><div class="card-head"><h2>Tarjetas</h2><button class="btn sm" data-act="new-card">${ICONS.plus} Tarjeta</button></div>
      ${state.tarjetas.length ? state.tarjetas.map((t, i) => `<div class="list-item"><div class="row" style="gap:10px"><i class="swatch" style="width:28px;height:18px;border-radius:4px;background:${t.color || CARD_COLORS[i % CARD_COLORS.length]}"></i><div><b style="font-weight:500">${esc(t.nombre)}</b> <span class="muted small">${esc(t.banco || '')}</span><span class="sub small muted">Cierra el ${t.cierre} · vence el ${t.vencimiento}${t.limite ? ` · límite ${M.c(t.limite)}` : ''}</span></div></div><div class="row" style="gap:2px"><button class="mini-btn" data-act="edit-card" data-id="${t.id}">${ICONS.edit}</button><button class="mini-btn" data-act="del-card" data-id="${t.id}">${ICONS.trash}</button></div></div>`).join('') : '<div class="empty">Sin tarjetas</div>'}
      <div class="divider"></div>
      <div class="card-head"><h3>Cuentas</h3><button class="btn sm" data-act="new-cuenta">${ICONS.plus} Cuenta</button></div>
      ${state.cuentas.length ? state.cuentas.map(c => `<div class="list-item"><div><b style="font-weight:500">${esc(c.nombre)}</b><span class="sub small muted">${esc(c.tipo || '')} · ${c.moneda}${c.esSueldo ? ' · cobro el sueldo acá' : ''}</span></div><div class="row" style="gap:2px"><span class="mono">${M.f(M.toARS(Number(c.saldo) || 0, c.moneda))}</span><button class="mini-btn" data-act="edit-cuenta" data-id="${c.id}">${ICONS.edit}</button><button class="mini-btn" data-act="del-cuenta" data-id="${c.id}">${ICONS.trash}</button></div></div>`).join('') : '<div class="empty">Sin cuentas</div>'}
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
          : `<div class="list-item" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><b style="font-weight:500">Sincronización entre dispositivos</b><span class="sub small muted">Guarda tus datos en un gist privado de tu GitHub para verlos iguales en el celu y la PC. Creá un token clásico con permiso "gist" en github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) y pegalo acá (una vez por dispositivo).</span></div><div class="row" style="gap:6px;width:100%;margin-top:8px"><input class="input sm" type="password" id="g-token" placeholder="ghp_…" style="flex:1;min-width:160px"><button class="btn sm primary" data-act="gist-connect">Conectar</button></div></div>`; })()}
        <div class="list-item"><div><b style="font-weight:500">Resumen para analizar con Claude</b><span class="sub small muted">Copia un informe del mes en texto para pegarlo en el chat del proyecto</span></div><button class="btn sm" data-act="copiar-resumen">${ICONS.copy} Copiar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Exportar respaldo</b><span class="sub small muted">Descarga todo en JSON (${state.movimientos.length} movimientos)</span></div><button class="btn sm" data-act="export">${ICONS.download} Exportar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Importar respaldo</b><span class="sub small muted">Reemplaza los datos actuales por un JSON exportado</span></div><label class="btn sm">${ICONS.upload} Importar<input type="file" accept="application/json" id="import-file" class="hidden"></label></div>
        <div class="list-item"><div><b style="font-weight:500">Importar movimientos desde CSV</b><span class="sub small muted">Columnas: fecha, descripción, monto, categoría (opcional), cuotas (opcional)</span></div><label class="btn sm">${ICONS.upload} CSV<input type="file" accept=".csv,text/csv" id="import-csv" class="hidden"></label></div>
        <div class="list-item"><div><b style="font-weight:500">Datos de ejemplo</b><span class="sub small muted">Carga 5 meses inventados para ver cómo funciona todo</span></div><button class="btn sm" data-act="demo">Cargar</button></div>
        <div class="list-item"><div><b style="font-weight:500">Borrar todo</b><span class="sub small muted">Elimina movimientos, fijos, tarjetas y ajustes</span></div><button class="btn sm danger" data-act="reset">Borrar</button></div>
      </div>
      <div class="divider"></div>
      <p class="small muted">${(() => { const b = BUILD; const v = /^\d{12}/.test(b) ? `${b.slice(6, 8)}/${b.slice(4, 6)}/${b.slice(0, 4)} ${b.slice(8, 10)}:${b.slice(10, 12)} UTC` : '—'; const u = state.updatedAt ? new Date(state.updatedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; return `App actualizada al ${v} · tus datos modificados por última vez el ${u}`; })()}</p>
      <p class="small muted">Estado: ${Persist.status === 'ok' ? 'guardado en la nube (esta página se actualiza sola en todos tus dispositivos).' : Persist.status === 'local' ? 'guardado solo en este dispositivo. Exportá un respaldo cada tanto.' : Persist.status === 'err' ? 'error al guardar: ' + esc(Persist.lastError) : 'sincronizando…'}</p>
    </div>
  </div>`;
  return html;
}
