/* ===================== FLUJO — engine: cycles, cuotas, aggregation ===================== */

const E = {
  /** Closing date that falls in month ym (exact per-cycle date if loaded, else the usual day) */
  cierreDe(t, ym) { return (t.cierres && t.cierres[ym]) || D.dateIn(ym, clamp(Number(t.cierre) || 27, 1, 31)); },
  /** For a card + purchase date → closing date, due date, payment month.
      If the purchase falls between two closing dates loaded explicitly (≤ 45 días entre sí), usa la siguiente exacta —
      esto banca ciclos irregulares como un cierre 27-ago seguido de 1-oct. */
  cycle(tarjeta, fecha) {
    const exactas = Object.values(tarjeta.cierres || {}).sort();
    const next = exactas.find(d => d >= fecha);
    const prev = exactas.filter(d => d < fecha).pop();
    if (next && prev && D.daysBetween(prev, next) <= 45) {
      const venc0 = clamp(Number(tarjeta.vencimiento) || 5, 1, 31);
      let vy = D.ym(next); let vd = D.dateIn(vy, venc0);
      while (vd <= next) { vy = D.addMonths(vy, 1); vd = D.dateIn(vy, venc0); }
      return { cierre: next, vencimiento: vd, mesPago: vy };
    }
    let ym = D.ym(fecha); let cierreDate = E.cierreDe(tarjeta, ym);
    if (fecha > cierreDate) { ym = D.addMonths(ym, 1); cierreDate = E.cierreDe(tarjeta, ym); }
    if (next && next < cierreDate) cierreDate = next, ym = D.ym(next);
    const venc = clamp(Number(tarjeta.vencimiento) || 5, 1, 31);
    let vencYm = ym; let vencDate = D.dateIn(vencYm, venc);
    while (vencDate <= cierreDate) { vencYm = D.addMonths(vencYm, 1); vencDate = D.dateIn(vencYm, venc); }
    return { cierre: cierreDate, vencimiento: vencDate, mesPago: vencYm };
  },
  /** Next closing / due dates for a card relative to today */
  cardNow(tarjeta, hoy = D.today()) {
    const c = E.cycle(tarjeta, hoy);
    // period start = day after previous closing
    const exactas = Object.values(tarjeta.cierres || {}).sort();
    const prevCierre = exactas.filter(d => d < c.cierre).pop();
    const periodoDesde = D.addDays(prevCierre && D.daysBetween(prevCierre, c.cierre) <= 45 ? prevCierre : E.cierreDe(tarjeta, D.addMonths(D.ym(c.cierre), -1)), 1);
    return { ...c, periodoDesde, periodoHasta: c.cierre, diasAlCierre: D.daysBetween(hoy, c.cierre), diasAlVenc: D.daysBetween(hoy, c.vencimiento) };
  },
  /** Next statement to pay (earliest whose due date is today or later) */
  proximoPago(tarjeta, hoy = D.today()) {
    const now = E.cardNow(tarjeta, hoy);
    for (const ym of [D.addMonths(now.mesPago, -1), now.mesPago]) { const f = D.dateIn(ym, tarjeta.vencimiento); if (f >= hoy) return { ym, fecha: f, dias: D.daysBetween(hoy, f), ...E.resumen(tarjeta.id, ym) }; }
    return { ym: now.mesPago, fecha: now.vencimiento, dias: now.diasAlVenc, ...E.resumen(tarjeta.id, now.mesPago) };
  },
  /** payment month for a movement's first installment */
  primerPago(m) {
    if (m.primerPago) return m.primerPago;
    if (m.medio === 'tarjeta') { const t = L.tarjeta(m.tarjetaId); if (t) return E.cycle(t, m.fecha).mesPago; }
    return D.ym(m.fecha);
  },
  /** Month the first installment is "spent" in (accrual): purchase month, unless an explicit first statement was set */
  baseMes(m) {
    if (m.primerPago && m.medio === 'tarjeta') { const t = L.tarjeta(m.tarjetaId); if (t) { const cy = E.cycle(t, m.fecha); return D.addMonths(m.primerPago, -D.diffMonths(D.ym(cy.cierre), cy.mesPago)); } }
    return D.ym(m.fecha);
  },
  /** Expand a movement into installment pieces. mesGasto = month the cuota counts as spent; mesPago = month it is debited */
  expand(m) {
    const n = Math.max(1, Number(m.cuotas) || 1);
    const totalARS = M.toARS(Number(m.monto) || 0, m.moneda);
    const first = E.primerPago(m); const base = E.baseMes(m);
    const mesConsumo = D.ym(m.fecha);
    const origenBase = m.recId ? 'fijo' : null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const mesPago = D.addMonths(first, i); const mesGasto = D.addMonths(base, i);
      out.push({
        m, idx: i + 1, n, montoARS: totalARS / n, totalARS, mesConsumo, mesPago, mesGasto,
        fechaPago: m.medio === 'tarjeta' ? E.fechaVenc(m.tarjetaId, mesPago) : m.fecha,
        origen: origenBase || (n > 1 ? (i === 0 ? 'nuevo' : 'cuota') : (mesPago === mesConsumo ? 'nuevo' : 'nuevo')),
      });
    }
    return out;
  },
  fechaVenc(tarjetaId, ym) { const t = L.tarjeta(tarjetaId); return t ? D.dateIn(ym, t.vencimiento) : D.dateIn(ym, 1); },
  /** closing date of the statement whose payment month is ym */
  fechaCierre(tarjetaId, ym) { const t = L.tarjeta(tarjetaId); if (!t) return D.dateIn(ym, 1); const cy = Number(t.vencimiento) <= Number(t.cierre) ? D.addMonths(ym, -1) : ym; return E.cierreDe(t, cy); },

  /** Virtual instances of recurrentes for a month (skipping months already instantiated as real movements) */
  recurrentesDe(ym) {
    const real = new Set(state.movimientos.filter(m => m.recId).map(m => m.recId + ':' + m.mesRec));
    return state.recurrentes.filter(r => r.activo !== false && (!r.desde || r.desde <= ym) && (!r.hasta || r.hasta >= ym) && !real.has(r.id + ':' + ym) && !(Array.isArray(r.omitidos) && r.omitidos.includes(ym)))
      .map(r => ({ id: 'v:' + r.id + ':' + ym, virtual: true, recId: r.id, mesRec: ym, fecha: D.dateIn(ym, Number(r.dia) || 1), desc: r.desc, monto: r.monto, moneda: r.moneda || 'ARS', catId: r.catId, medio: r.medio || 'debito', tarjetaId: r.tarjetaId, cuentaId: r.cuentaId, necesidad: r.necesidad || 1, cuotas: 1 }));
  },
  /** all movements (real + virtual) whose purchase month is in [from, to] */
  movs(from, to) {
    const real = state.movimientos.filter(m => { const ym = D.ym(m.fecha); return ym >= from && ym <= to; });
    const virt = [];
    for (const ym of D.range(from, D.diffMonths(from, to) + 1)) virt.push(...E.recurrentesDe(ym));
    return real.concat(virt);
  },
  /** cache per render */
  _cache: null,
  build() {
    const from = D.addMonths(D.thisMonth(), -18), to = D.addMonths(D.thisMonth(), 14);
    const movs = E.movs(from, to);
    const pieces = movs.flatMap(E.expand);
    E._cache = { movs, pieces, from, to };
    return E._cache;
  },
  data() { return E._cache || E.build(); },

  /* ---------- aggregations ---------- */
  /** Día de cobro del sueldo de un mes (settings.diaCobro; 28 o más = último día del mes) */
  fechaCobro(ym) { const d = Number(state.settings.diaCobro) || 1; return D.dateIn(ym, d >= 28 ? D.daysIn(ym) : d); },
  /** Sueldo neto de un mes: el registrado ese mes; si no, el registrado más cercano (antes, o después); si no, el de Configuración */
  sueldo(ym) {
    const s = state.sueldos || {}; const ok = k => s[k] && Number(s[k].monto) > 0;
    if (ok(ym)) return { monto: Number(s[ym].monto), fecha: s[ym].fecha || E.fechaCobro(ym), registrado: true };
    const keys = Object.keys(s).filter(ok).sort(); const prev = keys.filter(k => k < ym).pop(); const ref = prev || keys.find(k => k > ym) || null;
    return { monto: ref ? Number(s[ref].monto) : Number(state.settings.ingreso) || 0, fecha: E.fechaCobro(ym), registrado: false, ref };
  },
  /** Guarda el sueldo cobrado en un mes; si es el más reciente, pasa a ser el sueldo base de toda la app. Devuelve {monto, prev, delta} */
  registrarSueldo(ym, monto, fecha) {
    if (!state.sueldos) state.sueldos = {};
    const prev = E.sueldo(D.addMonths(ym, -1));
    state.sueldos[ym] = { monto: Math.round(monto), fecha: fecha || E.fechaCobro(ym) };
    const ultimo = Object.keys(state.sueldos).sort().pop(); if (ultimo === ym) state.settings.ingreso = Math.round(monto);
    return { monto: Math.round(monto), prev: prev.monto, prevRegistrado: prev.registrado, delta: prev.monto ? monto / prev.monto - 1 : null };
  },
  /** Meses cuyo cobro ya pasó (hasta 25 días atrás) y no está registrado: el anterior y el actual, del más viejo al más nuevo */
  cobroPendiente() {
    if (!(Number(state.settings.ingreso) > 0)) return []; const hoy = D.today(); const cur = D.thisMonth();
    return [D.addMonths(cur, -1), cur].filter(ym => { const f = E.fechaCobro(ym); return f <= hoy && D.daysBetween(f, hoy) <= 25 && !E.sueldo(ym).registrado; });
  },
  ingreso(ym) {
    const base = E.sueldo(ym).monto;
    const extra = sum(state.ingresos.filter(i => D.ym(i.fecha) === ym).map(i => M.toARS(Number(i.monto) || 0, i.moneda)));
    return { base, extra, total: base + extra };
  },
  invertido(ym) { return sum(state.inversiones.filter(i => D.ym(i.fecha) === ym).map(i => M.toARS(Number(i.monto) || 0, i.moneda))); },
  /** Gasto del mes (devengado): fijos del mes + cuotas que caen en el mes + compras del mes (primera cuota) */
  consumo(ym) {
    const pieces = E.data().pieces.filter(p => p.mesGasto === ym);
    const agg = { total: 0, fijo: 0, cuotas: 0, compras: 0, variable: 0, byCat: {}, byGrupo: {}, byNec: { 1: 0, 2: 0, 3: 0 }, byMedio: {}, byDay: {}, count: 0, movs: [], innecesario: 0, tarjeta: 0, nCuotas: 0 };
    const dias = D.daysIn(ym);
    for (const p of pieces) {
      const m = p.m; const v = p.montoARS;
      let row = m;
      if (p.idx > 1) { row = { ...m, id: m.id + '#' + p.idx, origId: m.id, cuotaRow: true, cuotaIdx: p.idx, cuotaN: p.n, monto: v, moneda: 'ARS', cuotas: 1, fecha: D.dateIn(ym, Math.min(Number(m.fecha.slice(8, 10)), dias)), primerPago: undefined }; agg.cuotas += v; agg.nCuotas++; }
      else if (m.recId) agg.fijo += v;
      else agg.compras += v;
      agg.total += v; agg.count++; agg.movs.push(row);
      agg.byCat[m.catId] = (agg.byCat[m.catId] || 0) + v;
      const g = L.grupoDeCat(m.catId).id; agg.byGrupo[g] = (agg.byGrupo[g] || 0) + v;
      agg.byNec[m.necesidad || 1] += v;
      agg.byMedio[m.medio] = (agg.byMedio[m.medio] || 0) + v;
      const d = Number(row.fecha.slice(8, 10)); const dd = D.ym(row.fecha) === ym ? d : 1; agg.byDay[dd] = (agg.byDay[dd] || 0) + v;
      if (m.medio === 'tarjeta') agg.tarjeta += v;
    }
    agg.variable = agg.compras; agg.comprometido = agg.fijo + agg.cuotas; agg.innecesario = agg.byNec[3];
    return agg;
  },
  /** amount a row represents in the month (cuota rows and first cuotas show the installment, not the total) */
  rowAmount(m) { if (m.cuotaRow) return m.monto; const v = M.toARS(Number(m.monto) || 0, m.moneda); return (m.cuotas || 1) > 1 ? v / m.cuotas : v; },
  /** flujo: by payment month — what leaves the accounts */
  flujo(ym) {
    const pieces = E.data().pieces.filter(p => p.mesPago === ym);
    const agg = { total: 0, fijos: 0, cuotas: 0, previo: 0, nuevo: 0, tarjetas: {}, contado: 0, pieces, byCat: {}, comprometido: 0 };
    for (const p of pieces) {
      agg.total += p.montoARS;
      if (p.origen === 'fijo') agg.fijos += p.montoARS;
      else if (p.idx > 1) agg.cuotas += p.montoARS;
      else if (p.mesConsumo < ym) agg.previo += p.montoARS;
      else agg.nuevo += p.montoARS;
      if (p.m.medio === 'tarjeta') { const k = p.m.tarjetaId || 'sin'; agg.tarjetas[k] = (agg.tarjetas[k] || 0) + p.montoARS; }
      else agg.contado += p.montoARS;
      agg.byCat[p.m.catId] = (agg.byCat[p.m.catId] || 0) + p.montoARS;
    }
    agg.comprometido = agg.fijos + agg.cuotas + agg.previo;
    return agg;
  },
  /** Statement (resumen) of a card for a payment month */
  resumen(tarjetaId, ym) {
    const pieces = E.data().pieces.filter(p => p.mesPago === ym && p.m.medio === 'tarjeta' && p.m.tarjetaId === tarjetaId);
    return { total: sum(pieces.map(p => p.montoARS)), pieces, fecha: E.fechaVenc(tarjetaId, ym) };
  },
  /** Projection of consumo for a month (variable spend) */
  proyeccion(ym) {
    const hoy = D.today();
    const c = E.consumo(ym);
    const dias = D.daysIn(ym);
    if (ym < D.thisMonth()) return { total: c.total, variable: c.variable, fijo: c.fijo, cuotas: c.cuotas, cerrado: true };
    if (ym > D.thisMonth()) {
      const hist = E.promedioVariable(ym, 3); const fe = Math.max(c.fijo, E.fijosEstimados(ym));
      return { total: hist + fe + c.cuotas, variable: hist, fijo: fe, cuotas: c.cuotas, futuro: true };
    }
    const dia = Number(hoy.slice(8, 10));
    const restantes = dias - dia;
    const hist = E.promedioVariable(ym, 3);
    const paceActual = dia > 0 ? c.variable / dia : 0;
    const paceHist = hist / dias;
    const w = clamp(dia / dias, 0.15, 0.85); // trust current pace more as month advances
    const pace = paceActual * w + paceHist * (1 - w);
    const variable = c.variable + pace * restantes;
    const fijoTotal = Math.max(c.fijo, E.fijosEstimados(ym));
    return { total: variable + fijoTotal + c.cuotas, variable, fijo: fijoTotal, cuotas: c.cuotas, pace, restantes, dia };
  },
  /** Average cumulative spend curve over previous months (accrual). Returns {vals, n} for ym's days */
  promedioAcumulado(ym, maxMeses = 12) {
    const dias = D.daysIn(ym); const curvas = [];
    for (let i = 1; i <= maxMeses; i++) {
      const m = D.addMonths(ym, -i); const c = E.consumo(m); if (c.count < 5) continue;
      const dm = D.daysIn(m); const cum = []; let acc = 0;
      for (let d = 1; d <= dm; d++) { acc += (c.byDay[d] || 0); cum.push(acc); }
      curvas.push({ cum, dm });
      if (curvas.length >= 6) break;
    }
    if (!curvas.length) return { vals: null, n: 0 };
    const vals = Array.from({ length: dias }, (_, i) => sum(curvas.map(c => c.cum[Math.min(i, c.dm - 1)])) / curvas.length);
    return { vals, n: curvas.length };
  },
  promedioVariable(ym, n) {
    const vals = [];
    for (let i = 1; i <= n; i++) { const m = D.addMonths(ym, -i); const c = E.consumo(m); if (c.count >= 5) vals.push(c.variable); }
    return vals.length ? sum(vals) / vals.length : 0;
  },
  /** Fijos del mes todavía no confirmados (virtuales) cuyo día ya pasó (mes actual) o todos (meses anteriores) */
  fijosPendientes(ym = D.thisMonth()) { const hoy = D.today(); return E.recurrentesDe(ym).filter(v => ym < D.thisMonth() || v.fecha <= hoy); },
  /** Confirma los fijos de un mes: crea el movimiento real con el monto dicho; si cambió, actualiza el monto base del fijo. omitidos = ids de recurrentes que no van este mes */
  confirmarFijos(ym, montos, omitidos = []) {
    const cambios = []; let n = 0;
    for (const v of E.recurrentesDe(ym)) {
      const r = state.recurrentes.find(x => x.id === v.recId); if (!r) continue;
      if (omitidos.includes(v.recId)) { r.omitidos = Array.from(new Set([...(r.omitidos || []), ym])); continue; }
      const monto = Number(montos[v.recId]); if (!(monto > 0)) continue;
      state.movimientos.push({ id: uid(), fecha: v.fecha, desc: v.desc, monto, moneda: v.moneda, catId: v.catId, medio: v.medio, tarjetaId: v.tarjetaId, cuentaId: v.cuentaId, necesidad: v.necesidad, cuotas: 1, recId: v.recId, mesRec: ym }); n++;
      if (Math.abs(monto - Number(r.monto)) > 0.5) { cambios.push({ desc: r.desc, antes: Number(r.monto), ahora: monto, d: monto / Number(r.monto) - 1 }); r.monto = monto; }
    }
    E._cache = null; return { n, cambios, omitidos: omitidos.length };
  },
  fijosEstimados(ym) { return sum(E.recurrentesDe(ym).map(r => M.toARS(r.monto, r.moneda))) + sum(state.movimientos.filter(m => m.recId && m.mesRec === ym).map(m => M.toARS(m.monto, m.moneda))); },
  /** Forward view: fijos + cuotas already committed per month (accrual) vs income */
  horizonte(fromYm, n = 12) {
    return D.range(fromYm, n).map(ym => {
      const c = E.consumo(ym); const ing = E.ingreso(ym).total || E.ingreso(D.thisMonth()).base; const pres = E.presupuesto(ym) || ing;
      const fijos = Math.max(c.fijo, E.fijosEstimados(ym)); const comprometido = fijos + c.cuotas;
      return { ym, ingreso: ing, presupuesto: pres, fijos, cuotas: c.cuotas, nuevo: c.compras, comprometido, libre: pres - comprometido, pct: pres ? comprometido / pres : 0 };
    });
  },
  /** Active installment plans. idx = calendar month; idxPeriodo advances when the card closes */
  cuotasActivas(ym = D.thisMonth()) {
    const hoy = D.today();
    return state.movimientos.filter(m => (m.cuotas || 1) > 1).map(m => {
      const first = E.baseMes(m); const n = Number(m.cuotas);
      const last = D.addMonths(first, n - 1);
      const idx = clamp(D.diffMonths(first, ym) + 1, 0, n);
      const t = m.medio === 'tarjeta' ? L.tarjeta(m.tarjetaId) : null;
      const cierre = t ? E.cycle(t, hoy).cierre : null;
      const ymPer = ym === D.thisMonth() && cierre ? D.ym(cierre) : ym;
      // Nº de cuota "en curso" = cierres de la tarjeta que YA pasaron desde la compra + 1 (la que va al próximo cierre).
      // Solo se usa el calendario si no hay tarjeta o si se mira un mes que no es el actual.
      let idxPeriodo, pasados = null;
      if (t && ym === D.thisMonth()) {
        let c = E.cycle(t, m.fecha).cierre; pasados = 0;
        while (c && c <= hoy && pasados < n) { pasados++; c = E.cycle(t, D.addDays(c, 1)).cierre; }
        idxPeriodo = clamp(pasados + 1, 1, n);
      } else idxPeriodo = clamp(Math.min(D.diffMonths(first, ymPer) + 1, idx + 1), 0, n);
      const total = M.toARS(m.monto, m.moneda);
      return { m, first, last, n, idx, idxPeriodo, cierre, cuota: total / n, total, restante: total / n * (n - idxPeriodo), restantes: n - idxPeriodo, activa: pasados !== null ? pasados < n : (last >= ymPer || last >= ym) };
    }).filter(x => x.activa).sort((a, b) => a.last.localeCompare(b.last));
  },
  /** Cartera de inversiones.
      Posiciones derivadas de las operaciones con lotes FIFO (como Yahoo y como el criterio fiscal argentino):
      compra → nuevo lote · venta → consume los lotes más viejos y registra resultado realizado · dividendo → cobro en USD.
      Cartera sombra: cada compra/venta/dividendo se replica en SPY el mismo día por el mismo monto. Se mide en dos ventanas:
        · inicio  — desde la primera operación (la sombra arranca en cero y compra SPY con cada flujo)
        · anio    — desde el último cierre de año conocido (31-dic): lo que había ese día entra valuado a mercado (c.inicio o snapshot)
      Rendimiento por ventana = Modified Dietz (flujos ponderados por tiempo). Alfa por posición = valor hoy − lo que valdrían los mismos flujos en SPY. */
  cartera() {
    const c = state.cartera || { operaciones: [], alertas: {}, precios: {} };
    const ORD = { compra: 0, dividendo: 1, venta: 2 };
    const ops = c.operaciones.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || (ORD[a.tipo] - ORD[b.tipo]) || (a.id > b.id ? 1 : -1));
    const hoy = D.today();
    const spyHoy = (c.precios.SPY && c.precios.SPY.c) || Spy.at(hoy) || null;
    const pos = {};
    const get = t => pos[t] || (pos[t] = { ticker: t, acciones: 0, costo: 0, dividendos: 0, realizado: 0, nOps: 0, lotes: [], spyShares: 0, flujoNeto: 0 });
    const flujos = []; let dividendos = 0;
    for (const o of ops) {
      const p = get(o.ticker); p.nOps++;
      const q = Number(o.acciones) || 0, px = Number(o.precio) || 0;
      if (o.tipo === 'compra') { p.lotes.push({ q, px, fecha: o.fecha, id: o.id }); p.acciones += q; p.costo += q * px; }
      else if (o.tipo === 'venta') {
        let rest = Math.min(q, p.acciones); const qv = rest; let costoVendido = 0;
        while (rest > 1e-9 && p.lotes.length) { const l = p.lotes[0]; const take = Math.min(l.q, rest); costoVendido += take * l.px; l.q -= take; rest -= take; if (l.q <= 1e-9) p.lotes.shift(); }
        p.realizado += qv * px - costoVendido; p.costo -= costoVendido; p.acciones -= qv;
        if (p.acciones < 1e-6) { p.acciones = 0; p.costo = 0; p.lotes = []; }
      } else if (o.tipo === 'dividendo') { const m = Number(o.monto) || 0; p.dividendos += m; dividendos += m; }
      const monto = o.tipo === 'dividendo' ? -(Number(o.monto) || 0) : (o.tipo === 'compra' ? q * px : -q * px);
      const spx = Number(o.spy) || Spy.at(o.fecha) || null;
      flujos.push({ fecha: o.fecha, monto, spy: spx, tipo: o.tipo, ticker: o.ticker, legado: !!o.legado, id: o.id });
      if (spx) p.spyShares += monto / spx; p.flujoNeto += monto;
    }
    const mep = Number(state.settings.tc) || 0, ccl = Number(state.settings.ccl) || mep;
    const enrich = p => {
      const pr = c.precios[p.ticker]; const precio = pr && pr.c ? pr.c : null;
      const ppc = p.acciones ? p.costo / p.acciones : 0;
      const valor = precio != null ? p.acciones * precio : null;
      const gp = valor != null ? valor - p.costo : null;
      const al = c.alertas[p.ticker] || null;
      let estado = null; if (al && precio != null) { if (al.urgente && precio <= al.urgente) estado = 'urgente'; else if (al.mirala && precio <= al.mirala) estado = 'mirala'; }
      const ced = Cedears.de(p.ticker);
      // alfa por posición: valor hoy (0 si está cerrada) vs los mismos flujos hechos en SPY
      const sombraPos = spyHoy ? p.spyShares * spyHoy : null;
      const valorAlfa = p.acciones > 0 ? valor : 0;
      const alfaUSD = sombraPos != null && valorAlfa != null ? valorAlfa - sombraPos : null;
      return { ...p, ppc, precio, dp: pr ? pr.dp : null, precioT: pr ? pr.t : null, valor, gp, gpPct: p.costo ? (gp != null ? gp / p.costo : null) : null, alerta: al, estado,
        distMirala: al && al.mirala && precio ? (precio - al.mirala) / precio : null, distUrgente: al && al.urgente && precio ? (precio - al.urgente) / precio : null, cedear: ced,
        sombraPos, alfaUSD, objetivo: al && al.objetivo ? al.objetivo : null, upside: al && al.objetivo && precio ? al.objetivo / precio - 1 : null };
    };
    const all = Object.values(pos).map(enrich);
    const abiertas = all.filter(p => p.acciones > 0);
    const costo = sum(abiertas.map(p => p.costo));
    const conPrecio = abiertas.filter(p => p.valor != null).length;
    const valor = abiertas.length && conPrecio ? sum(abiertas.map(p => p.valor != null ? p.valor : p.costo)) : null;
    for (const p of abiertas) p.peso = valor ? (p.valor != null ? p.valor : p.costo) / valor : (costo ? p.costo / costo : 0);
    abiertas.sort((a, b) => (b.valor != null ? b.valor : b.costo) - (a.valor != null ? a.valor : a.costo));
    const watch = Object.keys(c.alertas).filter(t => !pos[t] || pos[t].acciones <= 0).map(t => enrich(get(t)));
    const cerradas = all.filter(p => p.acciones <= 0 && p.nOps);
    const k = { posiciones: abiertas, cerradas, watch, costo, valor, conPrecio, gp: valor != null ? valor - costo : null, gpPct: valor != null && costo ? (valor - costo) / costo : null,
      dividendos, realizado: sum(all.map(p => p.realizado)), mep, ccl, valorMEP: valor != null ? valor * mep : null, valorCCL: valor != null ? valor * ccl : null,
      preciosFecha: c.preciosFecha, ops, cerradasCount: cerradas.length, flujos, spyHoy, inicio: c.inicio || null,
      legados: flujos.filter(f => f.legado).length, primeraOp: ops.length ? ops[0].fecha : null };
    k.ventanas = {}; for (const [m] of E.VENTANAS) k.ventanas[m] = E.ventana(k, m);
    return k;
  },
  /** TIR (XIRR): tasa anual r tal que Σ cf_i / (1+r)^(t_i/365) = 0. cfs: [{t: días desde el inicio, v: flujo (negativo = plata que ponés)}]. Newton + bisección. */
  xirr(cfs) {
    if (!cfs.some(c => c.v < 0) || !cfs.some(c => c.v > 0)) return null;
    const f = r => sum(cfs.map(c => c.v / Math.pow(1 + r, c.t / 365)));
    const df = r => sum(cfs.map(c => -(c.t / 365) * c.v / Math.pow(1 + r, c.t / 365 + 1)));
    let lo = -0.9999, hi = 20; let flo = f(lo), fhi = f(hi); if (!isFinite(flo) || flo * fhi > 0) return null;
    let r = 0.1;
    for (let i = 0; i < 100; i++) {
      const fr = f(r); if (Math.abs(fr) < 1e-8) break;
      const d = df(r); let nr = d ? r - fr / d : NaN;
      if (!isFinite(nr) || nr <= lo || nr >= hi) nr = (lo + hi) / 2;
      if (f(lo) * f(nr) <= 0) hi = nr; else lo = nr;
      if (Math.abs(nr - r) < 1e-10) { r = nr; break; } r = nr;
    }
    return isFinite(r) ? r : null;
  },
  /** Modified Dietz entre dos valuaciones: (V1 − V0 − ΣF) / (V0 + Σ F_i·w_i), w_i = fracción del período que el flujo estuvo invertido */
  dietz(v0, v1, flujos, desde, hasta) {
    const T = Math.max(1, D.daysBetween(desde, hasta)); const F = sum(flujos.map(f => f.monto));
    const W = sum(flujos.map(f => f.monto * Math.max(0, T - D.daysBetween(desde, f.fecha)) / T)); const den = v0 + W;
    return den > 1e-9 ? (v1 - v0 - F) / den : null;
  },
  /** Ventanas de medición disponibles (como los rangos de un gráfico financiero) */
  VENTANAS: [['anio', 'YTD'], ['1a', '1 A'], ['3a', '3 A'], ['5a', '5 A'], ['inicio', 'Todo']],
  /** Valuación conocida más reciente ≤ fecha: seed (c.inicio, 31-dic) o snapshot diario. Devuelve {fecha, V, spy, tipo} o null */
  valuacionEn(k, fecha) {
    const c = state.cartera; const cands = [];
    if (c.inicio && c.inicio.fecha <= fecha && c.inicio.spy) {
      const seed = c.inicio; const esInicial = o => o.fecha <= seed.fecha || !!o.legado; const pos0 = {};
      for (const o of k.ops) if (esInicial(o) && o.tipo !== 'dividendo') pos0[o.ticker] = (pos0[o.ticker] || 0) + (o.tipo === 'compra' ? Number(o.acciones) || 0 : -(Number(o.acciones) || 0));
      const V = sum(Object.entries(pos0).map(([t, q]) => q > 1e-9 && seed.precios && seed.precios[t] ? q * seed.precios[t] : 0));
      cands.push({ fecha: seed.fecha, V, spy: seed.spy, tipo: 'seed', esInicial });
    }
    const h = c.historial || {};
    for (const f of Object.keys(h)) if (f <= fecha && h[f].spy && h[f].v != null) cands.push({ fecha: f, V: h[f].v, spy: h[f].spy, tipo: 'snapshot', esInicial: o => o.fecha <= f });
    if (!cands.length) return null;
    cands.sort((a, b) => a.fecha.localeCompare(b.fecha)); return cands[cands.length - 1];
  },
  /** Ventana: {disponible, modo, desde, V0, S0, spy0, flujos, rend:{real, sombra, alfa, alfaUSD, spyDirecto}, sombraValor, nota, aprox} */
  ventana(k, modo) {
    const hoy = D.today(); const spyHoy = k.spyHoy;
    if (!k.primeraOp) return { disponible: false, modo, motivo: 'Sin operaciones.' };
    let objetivo;  // fecha de arranque deseada
    if (modo === 'inicio') objetivo = k.primeraOp;
    else if (modo === 'anio') objetivo = `${Number(hoy.slice(0, 4)) - 1}-12-31`;
    else { const n = Number(modo.replace('a', '')); const d = D.parse(hoy); d.setFullYear(d.getFullYear() - n); objetivo = D.iso(d); }
    let desde, V0 = 0, S0 = 0, spy0, esInicial = () => false, aprox = false, nota = '';
    if (modo === 'inicio' || objetivo <= k.primeraOp) {
      desde = k.primeraOp; spy0 = Spy.at(desde);
      if (k.legados) nota = `${k.legados} lote${k.legados > 1 ? 's' : ''} previo${k.legados > 1 ? 's' : ''} sin fecha real de compra (entran el 2/1/26): corregí la fecha tocando la operación para afinar esta comparación.`;
    } else {
      const val = E.valuacionEn(k, objetivo);
      if (!val) return { disponible: false, modo, objetivo, motivo: `Todavía no hay una valuación guardada al ${D.fmt(objetivo, { year: true })}. La app guarda una por día desde que empezó a traer precios.` };
      if (D.daysBetween(val.fecha, objetivo) > 45) { aprox = true; nota = `Sin valuación exacta al ${D.fmt(objetivo, { year: true })}: se usa la más cercana (${D.fmt(val.fecha, { year: true })}).`; }
      desde = val.fecha; V0 = val.V; spy0 = val.spy; S0 = spy0 ? V0 / spy0 : 0; esInicial = val.esInicial;
    }
    if (!spy0 || !spyHoy) return { disponible: false, modo, motivo: 'Falta la cotización de SPY.' };
    const fl = k.flujos.filter(f => !esInicial({ fecha: f.fecha, legado: f.legado }));
    const S = S0 + sum(fl.map(f => f.spy ? f.monto / f.spy : 0));
    const sombraValor = S * spyHoy;
    const T = Math.max(1, D.daysBetween(desde, hoy));
    // --- dinero (money-weighted): TIR anual y su equivalente acumulado en la ventana; Dietz como aproximación/respaldo
    const cfs = vEnd => [...(V0 > 0 ? [{ t: 0, v: -V0 }] : []), ...fl.map(f => ({ t: D.daysBetween(desde, f.fecha), v: -f.monto })), { t: T, v: vEnd }];
    const tirReal = k.valor != null ? E.xirr(cfs(k.valor)) : null; const tirSombra = E.xirr(cfs(sombraValor));
    const acum = tir => tir == null ? null : Math.pow(1 + tir, T / 365) - 1;
    const dietzReal = k.valor != null ? E.dietz(V0, k.valor, fl, desde, hoy) : null; const dietzSombra = E.dietz(V0, sombraValor, fl, desde, hoy);
    const real = tirReal != null ? acum(tirReal) : dietzReal, sombra = tirSombra != null ? acum(tirSombra) : dietzSombra;
    // --- tiempo (time-weighted): sub-períodos entre valuaciones conocidas, Dietz en cada uno, encadenados. La sombra es 100 % SPY → su TWR = SPY solo.
    //     Si la ventana arranca en cero (primera operación), las compras de ese día son la valuación inicial.
    let twr = null;
    if (k.valor != null) {
      const c = state.cartera; let fl0 = fl, Vstart = V0;
      if (!(V0 > 0)) { Vstart = sum(fl.filter(f => f.fecha === desde).map(f => f.monto)); fl0 = fl.filter(f => f.fecha !== desde); }
      const vals = [{ fecha: desde, V: Vstart }];
      const seed = c.inicio;
      if (seed && seed.precios && seed.fecha > desde && seed.fecha < hoy) {
        // valuación al 31-dic con lo que ya había entrado a la ventana ese día (los lotes previos sin fecha entran después, a su costo); se omite si falta algún precio
        const pos0 = {}; for (const o of k.ops) if (o.tipo !== 'dividendo' && !o.legado && o.fecha <= seed.fecha) pos0[o.ticker] = (pos0[o.ticker] || 0) + (o.tipo === 'compra' ? Number(o.acciones) || 0 : -(Number(o.acciones) || 0));
        let ok = true; const V = sum(Object.entries(pos0).map(([t, q]) => { if (q <= 1e-9) return 0; if (!seed.precios[t]) ok = false; return q * (seed.precios[t] || 0); }));
        if (ok && V > 0) vals.push({ fecha: seed.fecha, V });
      }
      for (const [f, h] of Object.entries(c.historial || {})) if (f > desde && f < hoy && h.v != null) vals.push({ fecha: f, V: h.v });
      vals.push({ fecha: hoy, V: k.valor }); vals.sort((a, b) => a.fecha.localeCompare(b.fecha));
      let acc = 1, ok = Vstart > 0;
      for (let i = 0; ok && i < vals.length - 1; i++) { const a = vals[i], b = vals[i + 1]; const sub = fl0.filter(f => f.fecha > a.fecha && f.fecha <= b.fecha); const r = E.dietz(a.V, b.V, sub, a.fecha, b.fecha); if (r == null) ok = false; else acc *= 1 + r; }
      twr = ok ? acc - 1 : null;
    }
    const spyDirecto = spyHoy / spy0 - 1;
    return { disponible: true, modo, desde, objetivo, aprox, V0, S0, spy0, flujos: fl, sombraValor, invertidoNeto: V0 + sum(fl.map(f => f.monto)), nota, dias: T, valuaciones: null,
      rend: { real, sombra, alfa: real != null && sombra != null ? real - sombra : null, alfaUSD: k.valor != null ? k.valor - sombraValor : null, spyDirecto, dias: T,
        tirReal, tirSombra, tirSpy: T >= 30 ? Math.pow(1 + spyDirecto, 365 / T) - 1 : null, dietzReal, dietzSombra, twr, metodo: tirReal != null ? 'tir' : 'dietz' } };
  },
  /** Serie temporal de una ventana: sombra S&P (diaria), invertido neto (escalón) y cartera real (valuaciones conocidas: arranque, seed 31-dic, snapshots, hoy) */
  carteraSerie(k, modo = 'anio') {
    const v = k.ventanas[modo]; if (!v || !v.disponible) return null;
    const c = state.cartera; const hoy = D.today();
    let fechas = Spy.fechas().filter(f => f >= v.desde && f <= hoy);
    if (!fechas.length || fechas[0] !== v.desde) fechas.unshift(v.desde);
    if (fechas[fechas.length - 1] !== hoy) fechas.push(hoy);
    // en ventanas largas, quedarse con ~120 puntos para que el gráfico sea liviano
    const hist = c.historial || {};
    const seedF = c.inicio ? c.inicio.fecha : null;
    if (fechas.length > 130) { const step = Math.ceil(fechas.length / 120); fechas = fechas.filter((f, i) => i % step === 0 || i === fechas.length - 1 || f === v.desde || f === seedF || !!hist[f]); }
    const fl = v.flujos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    let S = v.S0, inv = v.V0, j = 0;
    const sombra = [], invertido = [], real = [];
    const seed = c.inicio && c.inicio.fecha > v.desde && c.inicio.fecha <= hoy ? E.valuacionEn(k, c.inicio.fecha) : null;
    for (const f of fechas) {
      while (j < fl.length && fl[j].fecha <= f) { if (fl[j].spy) S += fl[j].monto / fl[j].spy; inv += fl[j].monto; j++; }
      const spx = f === hoy ? k.spyHoy : Spy.at(f);
      sombra.push(spx ? S * spx : null); invertido.push(inv);
      let r = null;
      if (f === hoy) r = k.valor != null ? k.valor : null;
      else if (f === v.desde) r = modo === 'inicio' || v.desde === k.primeraOp ? 0 : v.V0;
      else if (seed && f === seed.fecha && seed.tipo === 'seed') r = seed.V;
      else if (hist[f]) r = hist[f].v;
      real.push(r);
    }
    return { fechas, sombra, invertido, real };
  },
  /** Presupuesto del mes: lo que decidiste gastar (el resto del sueldo va a inversión/ahorro) */
  presupuesto(ym) { return Number(state.settings.presupuesto) || 0; },
  /** What is left to spend in a month: presupuesto − fijos − cuotas − compras */
  margen(ym = D.thisMonth()) {
    const ing = E.ingreso(ym).total; const pres = E.presupuesto(ym); const c = E.consumo(ym); const proj = E.proyeccion(ym);
    const fijos = Math.max(c.fijo, E.fijosEstimados(ym));
    const queda = pres - fijos - c.cuotas - c.compras;
    const quedaProj = pres - proj.total;
    return { ym, ingreso: ing, presupuesto: pres, ahorro: ing - pres, fijos, cuotas: c.cuotas, compras: c.compras, queda, quedaProj, restantes: Math.max(0, D.daysIn(ym) - (ym === D.thisMonth() ? Number(D.today().slice(8, 10)) : D.daysIn(ym))) };
  },
  /** Category stats over last n months (for insights & budgets) */
  promedioCat(catId, ym, n = 3) {
    const vals = [];
    for (let i = 1; i <= n; i++) { const c = E.consumo(D.addMonths(ym, -i)); if (c.count >= 5) vals.push(c.byCat[catId] || 0); }
    return vals.length ? sum(vals) / vals.length : 0;
  },
  /** Simulate a new purchase in cuotas */
  simular({ monto, moneda, cuotas, tarjetaId, desde }) {
    const fake = { id: 'sim', fecha: desde ? D.dateIn(desde, 1) : D.today(), monto, moneda, cuotas, medio: tarjetaId ? 'tarjeta' : 'debito', tarjetaId, catId: 'otros', necesidad: 2 };
    const pieces = E.expand(fake);
    const alerta = (Number(state.settings.alertaCuotasPct) || 60) / 100;
    return pieces.map(p => {
      const h = E.horizonte(p.mesGasto, 1)[0];
      const nuevoComp = h.comprometido + p.montoARS;
      return { ym: p.mesGasto, cuota: p.montoARS, antes: h.comprometido, despues: nuevoComp, ingreso: h.presupuesto, pct: h.presupuesto ? nuevoComp / h.presupuesto : 0, libre: h.presupuesto - nuevoComp, alerta: h.presupuesto ? nuevoComp / h.presupuesto > alerta : false };
    });
  },
};

/* ---------- smart categorization ---------- */
const DICT = [
  [/carrefour|coto|dia %|d[ií]a\b|jumbo|disco|vea\b|chango|super|mercado|almacen|verduler|carnicer|panader|chino/, 'super', 1],
  [/rappi|pedidos ?ya|mcdonald|burger|pizza|sushi|delivery|restaurante|resto\b|parrilla|cafe|caf[eé]|starbucks|helader|empanada/, 'delivery', 2],
  [/ypf|shell|axion|puma|nafta|combustible|gnc/, 'nafta', 1],
  [/seguro|patente|service|taller|gomer|lavadero|cochera|peaje|vtv|estacionamiento/, 'auto', 1],
  [/uber|cabify|didi|sube|colectivo|tren|subte|taxi|remis/, 'transporte', 1],
  [/edenor|edesur|metrogas|naturgy|aysa|fibertel|personal|claro|movistar|telecentro|flow|internet|luz\b|gas\b|agua\b|celular/, 'servicios', 1],
  [/netflix|spotify|claude|chatgpt|openai|youtube|disney|hbo|max\b|prime|amazon prime|apple|icloud|google one|suscripci|dropbox|notion|github|steam|playstation|xbox|gym ?pass|canva/, 'subs', 2],
  [/bar\b|birra|cerveza|boliche|fiesta|salida|cine|teatro|recital|entrada|show|previa|vino/, 'salidas', 3],
  [/vuelo|aerol|flybondi|jetsmart|latam|hotel|airbnb|booking|despegar|viaje|hostel|pasaje/, 'viajes', 2],
  [/gimnasio|gym|club|padel|f[uú]tbol|deporte|megatlon|sportclub|crossfit|natacion/, 'deporte', 1],
  [/farmac|farmacity|m[eé]dico|dentista|odont|obra social|prepaga|osde|swiss|galeno|psic[oó]|kinesi|laborator|hospital|cl[ií]nica/, 'salud', 1],
  [/curso|udemy|coursera|platzi|libro|librer|universidad|facultad|clase|profesor|ingl[eé]s/, 'educacion', 1],
  [/zara|nike|adidas|ropa|zapat|remera|jean|camisa|dexter|solido|h&m|uniqlo|calzado|campera/, 'ropa', 2],
  [/mercado ?libre|meli|fravega|garbarino|musimundo|notebook|celular|iphone|samsung|monitor|auricular|tecnolog|cablecito|cargador/, 'tech', 2],
  [/regalo|cumple|flores/, 'regalos', 2],
  [/alquiler|expensas|abl|inmobiliaria/, 'alquiler', 1],
  [/easy\b|sodimac|ikea|mueble|ferreter|pintur|electrodom|colch[oó]n|s[aá]bana|decor|hogar/, 'hogar', 2],
  [/asato|sushi|miaokou|anapat|antares|bar\b/, 'salidas', 2],
  [/del viento|de la colonia|helader|chocolater/, 'delivery', 3],
  [/puppy|mascota|veterinar|huellas|pet ?shop/, 'mascotas', 1],
  [/barber|peluquer|safe ?razor|estilo ?barber/, 'personal', 1],
  [/emova|subte\b/, 'transporte', 1],
  [/federacion patronal|telepase|axion/, 'auto', 1],
  [/spot alem|green apple|open ?25|kiosco/, 'delivery', 2],
  [/afip|arca|monotributo|impuesto|ganancias|iva\b|sellado|comisi[oó]n|mantenimiento de cuenta|banco|interes/, 'impuestos', 1],
];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const Smart = {
  suggest(desc) {
    const d = norm(desc); if (!d || d.length < 2) return null;
    // 1) learned from history: exact/prefix match of normalized description
    const hist = state.movimientos.filter(m => { const n = norm(m.desc); return n === d || n.startsWith(d) || d.startsWith(n) && n.length >= 3; });
    if (hist.length) {
      const count = {}; for (const m of hist) { const k = [m.catId, m.necesidad || 1, m.medio, m.tarjetaId || ''].join('|'); count[k] = (count[k] || 0) + 1; }
      const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0].split('|');
      const last = hist.sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      return { catId: best[0], necesidad: Number(best[1]), medio: best[2], tarjetaId: best[3] || undefined, monto: last.monto, moneda: last.moneda, src: 'historial', n: hist.length };
    }
    if (state.aprendido[d]) return { ...state.aprendido[d], src: 'aprendido' };
    // 2) dictionary
    for (const [re, cat, nec] of DICT) if (re.test(' ' + d + ' ') || re.test(d)) { if (state.categorias.find(c => c.id === cat)) return { catId: cat, necesidad: nec, src: 'diccionario' }; }
    return null;
  },
  learn(m) { const d = norm(m.desc); if (d.length >= 3) state.aprendido[d] = { catId: m.catId, necesidad: m.necesidad, medio: m.medio, tarjetaId: m.tarjetaId }; },
  /** detect possible recurring expenses among non-recurrent movements */
  detectarRecurrentes() {
    const groups = {};
    for (const m of state.movimientos) { if (m.recId) continue; const k = norm(m.desc).replace(/\d+/g, '').trim(); if (k.length < 3) continue; (groups[k] = groups[k] || []).push(m); }
    const out = [];
    for (const [k, arr] of Object.entries(groups)) {
      const months = [...new Set(arr.map(m => D.ym(m.fecha)))].sort();
      if (months.length < 3) continue;
      let consec = 1, best = 1;
      for (let i = 1; i < months.length; i++) { consec = D.diffMonths(months[i - 1], months[i]) === 1 ? consec + 1 : 1; best = Math.max(best, consec); }
      if (best < 3 || arr.length > months.length * 1.3) continue;
      const montos = arr.map(m => M.toARS(m.monto, m.moneda)); const avg = sum(montos) / montos.length;
      const cv = Math.sqrt(sum(montos.map(v => (v - avg) ** 2)) / montos.length) / (avg || 1);
      if (cv < 0.25 && !state.recurrentes.find(r => norm(r.desc).replace(/\d+/g, '').trim() === k)) out.push({ desc: arr[arr.length - 1].desc, avg, meses: months.length, m: arr[arr.length - 1] });
    }
    return out;
  },
};
