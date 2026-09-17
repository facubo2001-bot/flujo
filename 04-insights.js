/* ===================== FLUJO — insights (rule-based analysis) ===================== */

const Insights = {
  /** returns list of {level, icon, title, text, view?} for the selected month */
  build(ym) {
    const out = [];
    const c = E.consumo(ym), prev = E.consumo(D.addMonths(ym, -1)), ing = E.ingreso(ym).total; const mg = E.margen(ym);
    const isCur = ym === D.thisMonth(); const proj = E.proyeccion(ym);
    const nextYm = D.addMonths(ym, 1); const ingNext = E.ingreso(nextYm).total;
    const hz = E.horizonte(D.thisMonth(), 12); const alerta = (Number(state.settings.alertaCuotasPct) || 60) / 100;
    if (!c.count) return [{ level: 'info', icon: 'spark', title: 'Todavía no hay movimientos en este mes', text: 'Cargá tus gastos con el botón + y acá vas a ver alertas, tendencias y sugerencias calculadas sobre tus datos.' }];

    // 1. projection vs income / vs previous month
    const pres = mg.presupuesto;
    if (isCur && pres) {
      const ratio = proj.total / pres;
      if (ratio > 1) out.push({ level: 'crit', icon: 'alert', title: `Proyección: te pasás ${M.pct(ratio - 1)} del presupuesto`, text: `Al ritmo actual cerrás ${D.monthName(ym)} con ${M.f(proj.total)} contra un presupuesto de ${M.f(pres)}. Los ${proj.restantes} días que quedan necesitan un freno: cada día de compras promedia ${M.f(proj.pace)}.` });
      else if (ratio > 0.85) out.push({ level: 'warn', icon: 'alert', title: `Proyección ajustada: ${M.pct(ratio)} del presupuesto`, text: `Vas a cerrar el mes cerca de ${M.f(proj.total)}. Queda poco margen si no bajás las compras (${M.f(proj.pace)} por día).` });
      else out.push({ level: 'good', icon: 'check', title: `Proyección de cierre: ${M.f(proj.total)} (${M.pct(ratio)} del presupuesto)`, text: `Si mantenés el ritmo, te sobran ${M.f(mg.quedaProj)} del presupuesto, además de los ${M.f(mg.ahorro)} que ya separás para invertir.` });
    }
    // 1b. sueldo registrado del mes: adónde va la diferencia (presupuesto quieto → todo el aumento a inversión)
    const su = E.sueldo(ym), suPrev = E.sueldo(D.addMonths(ym, -1));
    if (su.registrado && suPrev.monto && pres && (suPrev.registrado || (suPrev.ref && suPrev.ref < ym))) {
      const d = su.monto / suPrev.monto - 1; const ant = suPrev.registrado ? D.monthName(D.addMonths(ym, -1)).split(' ')[0] : 'el sueldo anterior';
      if (d >= 0.005) out.push({ level: 'good', icon: 'trend', title: `Cobraste ${M.f(su.monto)}: +${M.pct(d)} vs ${ant}`, text: `Con el presupuesto quieto en ${M.f(pres)}, los ${M.f(su.monto - suPrev.monto)} de más van derecho a inversión: ${M.f(su.monto - pres)} este mes.`, view: 'plan' });
      else if (d <= -0.005) out.push({ level: 'warn', icon: 'down', title: `Cobraste ${M.f(su.monto)}: ${M.pct(d)} vs ${ant}`, text: `Quedan ${M.f(su.monto - pres)} para invertir con el presupuesto en ${M.f(pres)}. Para sostener el objetivo anterior habría que recortar ${M.f(suPrev.monto - su.monto)} de gastos.`, view: 'plan' });
    }
    // 2. vs previous month
    if (prev.count && c.count) {
      const d = (c.total - prev.total) / (prev.total || 1);
      const cmp = isCur ? `Comparado con el mismo punto del mes pasado` : `Contra ${D.monthName(D.addMonths(ym, -1))}`;
      let prevToDate = prev.total;
      if (isCur) { const dia = Number(D.today().slice(8, 10)); prevToDate = sum(Object.entries(prev.byDay).filter(([k]) => Number(k) <= dia).map(([, v]) => v)); }
      const dd = (c.total - prevToDate) / (prevToDate || 1);
      if (Math.abs(dd) > 0.12 && prevToDate > 0) out.push({ level: dd > 0 ? 'warn' : 'good', icon: dd > 0 ? 'trend' : 'down', title: `${dd > 0 ? '+' : ''}${M.pct(dd)} vs el mes pasado`, text: `${cmp}: ${M.f(c.total)} contra ${M.f(prevToDate)}. ${dd > 0 ? 'Fijate en qué categorías está la diferencia (abajo).' : 'Buen ritmo, sostenelo.'}` });
    }
    // 3. category jumps
    const jumps = [];
    for (const [catId, v] of Object.entries(c.byCat)) {
      const avg = E.promedioCat(catId, ym, 3);
      if (avg > 0 && v > avg * 1.4 && v - avg > ing * 0.02 && v > 20000) jumps.push({ cat: L.cat(catId), v, avg });
    }
    jumps.sort((a, b) => (b.v - b.avg) - (a.v - a.avg)).slice(0, 2).forEach(j => out.push({ level: 'warn', icon: 'trend', title: `${j.cat.nombre}: ${M.pct(j.v / j.avg - 1)} arriba de tu promedio`, text: `Llevás ${M.f(j.v)} en ${D.monthName(ym)} contra un promedio de ${M.f(j.avg)} en los últimos 3 meses.` }));
    // 4. budgets
    for (const cat of state.categorias) {
      if (!cat.presupuesto) continue; const v = c.byCat[cat.id] || 0; const r = v / M.toARS(cat.presupuesto, 'ARS');
      if (r >= 1) out.push({ level: 'crit', icon: 'alert', title: `Presupuesto de ${cat.nombre} superado (${M.pct(r)})`, text: `Gastaste ${M.f(v)} de los ${M.f(cat.presupuesto)} que definiste.` });
      else if (r >= 0.8 && isCur && proj.restantes > 5) out.push({ level: 'warn', icon: 'clock', title: `${cat.nombre} al ${M.pct(r)} del presupuesto`, text: `Quedan ${M.f(cat.presupuesto - v)} para ${proj.restantes} días.` });
    }
    // 5. unnecessary share
    if (c.total > 0) {
      const share = c.innecesario / c.total;
      const prevShare = prev.total ? prev.byNec[3] / prev.total : null;
      if (share > 0.2) out.push({ level: 'warn', icon: 'alert', title: `${M.pct(share)} de lo gastado lo marcaste como innecesario`, text: `Son ${M.f(c.innecesario)}. ${prevShare != null ? `El mes pasado fue ${M.pct(prevShare)}. ` : ''}Eso equivale a ${M.pct(c.innecesario / (pres || c.total))} de tu presupuesto que podría ir a inversión.` });
      else if (share < 0.08 && c.count > 5) out.push({ level: 'good', icon: 'check', title: `Solo ${M.pct(share)} de gasto innecesario`, text: `Gasto disciplinado: ${M.f(c.innecesario)} en caprichos sobre ${M.f(c.total)}.` });
    }
    // 6. installment load next months
    const heavy = hz.filter(h => h.presupuesto && h.pct > alerta);
    if (heavy.length) {
      const worst = heavy.sort((a, b) => b.pct - a.pct)[0];
      out.push({ level: worst.pct > 0.5 ? 'crit' : 'warn', icon: 'cuotas', title: `${heavy.length === 1 ? 'Un mes' : heavy.length >= 6 ? 'Casi todos los próximos meses' : heavy.length + ' meses'} con más de ${M.pct(alerta)} del presupuesto ya comprometido`, text: `El peor es ${D.monthName(worst.ym)}: ${M.f(worst.comprometido)} entre fijos y cuotas (${M.pct(worst.pct)} del presupuesto). Evitá sumar cuotas nuevas que caigan ahí.`, view: 'cuotas' });
    } else if (hz[1] && hz[1].presupuesto) {
      out.push({ level: 'info', icon: 'cuotas', title: `Ya comprometido para ${D.monthName(nextYm)}: ${M.f(hz[1].comprometido)}`, text: `${M.pct(hz[1].pct)} del presupuesto entre fijos (${M.f(hz[1].fijos)}) y cuotas (${M.f(hz[1].cuotas)}). Te quedan ${M.f(hz[1].libre)} para compras.`, view: 'cuotas' });
    }
    // 7. cuotas finishing soon
    const act = E.cuotasActivas(ym); const ending = act.filter(a => a.last === ym || a.last === nextYm);
    if (ending.length) out.push({ level: 'good', icon: 'check', title: `Se terminan ${ending.length} plan${ending.length > 1 ? 'es' : ''} de cuotas`, text: `${ending.map(a => `${a.m.desc} (${M.f(a.cuota)}/mes)`).join(', ')}. Se liberan ${M.f(sum(ending.map(a => a.cuota)))} mensuales desde ${D.monthName(D.addMonths(ending.sort((a, b) => b.last.localeCompare(a.last))[0].last, 1))}.` });
    // 8. subscriptions annualized
    const subs = state.recurrentes.filter(r => r.activo !== false && L.cat(r.catId).id === 'subs');
    if (subs.length >= 3) { const tot = sum(subs.map(r => M.toARS(r.monto, r.moneda))); out.push({ level: 'info', icon: 'repeat', title: `${subs.length} suscripciones: ${M.f(tot)} por mes`, text: `Anualizado son ${M.f(tot * 12)}. Revisá si usás todas: ${subs.map(s => s.desc).join(', ')}.` }); }
    // 9. hormiga
    const small = c.movs.filter(m => !m.recId && !m.cuotaRow && M.toARS(m.monto, m.moneda) < 8000);
    if (small.length >= 12) { const t = sum(small.map(m => M.toARS(m.monto, m.moneda))); out.push({ level: 'info', icon: 'wallet', title: `Gasto hormiga: ${small.length} compras chicas suman ${M.f(t)}`, text: `Compras de menos de $ 8.000 que individualmente no se notan pero juntas son ${M.pct(t / (c.total || 1))} del mes.` }); }
    // 10. recurring detection
    const det = Smart.detectarRecurrentes();
    if (det.length) out.push({ level: 'info', icon: 'repeat', title: `Detecté ${det.length} gasto${det.length > 1 ? 's' : ''} que se repite${det.length > 1 ? 'n' : ''} todos los meses`, text: `${det.slice(0, 3).map(d => `${d.desc} (~${M.f(d.avg)})`).join(', ')}. Convertilos en fijos para que el pronóstico los tenga en cuenta.`, action: 'detectar' });
    // 11. investment
    const inv = E.invertido(ym);
    if (ing && !isCur && ym <= D.thisMonth()) {
      const libre = ing - c.total; const meta = mg.ahorro;
      if (inv >= meta && meta > 0) out.push({ level: 'good', icon: 'invest', title: `Invertiste ${M.f(inv)}: ${M.pct(inv / ing)} del sueldo`, text: `Cumpliste el objetivo de ${M.f(meta)}.` });
      else if (libre > meta * 0.5 && inv < meta) out.push({ level: 'info', icon: 'invest', title: `Te sobraron ${M.f(libre)} en ${D.monthName(ym)}`, text: `Invertiste ${M.f(inv)}. Registrá lo que aportaste a Balanz/BTC para seguir tu tasa de ahorro real.`, view: 'plan' });
    }
    // 12. weekend pattern
    const wk = { fin: 0, sem: 0 };
    for (const m of c.movs) { if (m.recId || m.cuotaRow) continue; const d = D.dow(m.fecha); wk[d === 0 || d === 6 ? 'fin' : 'sem'] += E.rowAmount(m); }
    if (wk.fin > wk.sem && wk.fin > 0) out.push({ level: 'info', icon: 'clock', title: 'Gastás más los fines de semana que en toda la semana', text: `${M.f(wk.fin)} sábados y domingos contra ${M.f(wk.sem)} de lunes a viernes.` });
    // 13. card closing soon
    if (isCur) for (const t of state.tarjetas) { const now = E.cardNow(t); if (now.diasAlCierre >= 0 && now.diasAlCierre <= 3) out.push({ level: 'info', icon: 'tarjetas', title: `${t.nombre} cierra ${now.diasAlCierre === 0 ? 'hoy' : now.diasAlCierre === 1 ? 'mañana' : 'en ' + now.diasAlCierre + ' días'}`, text: `Lo que compres después del ${D.fmt(now.cierre)} recién lo pagás el ${D.fmt(D.dateIn(D.addMonths(now.mesPago, 1), t.vencimiento))}. Si podés esperar, esperá.` }); }
    // 14. backup reminder (only outside claude.ai)
    if (!window.claude && state.movimientos.length > 20) { const last = state.settings.lastBackup; if (!last || D.daysBetween(last, D.today()) > 30) out.push({ level: 'info', icon: 'download', title: 'Hacé un respaldo', text: `${last ? 'Hace más de un mes que no exportás' : 'Nunca exportaste'} tus datos. Viven solo en este teléfono: Configuración → Exportar → Guardar en Archivos.`, view: 'config' }); }
    const order = { crit: 0, warn: 1, good: 2, info: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 8);
  },

  /** Text summary to paste into a Claude chat */
  resumenTexto(ym) {
    const c = E.consumo(ym), ing = E.ingreso(ym); const mg = E.margen(ym);
    const lines = [];
    lines.push(`# Resumen financiero ${D.monthName(ym)} (generado por Gestor de gastos)`);
    lines.push(`Tipo de cambio usado: ${state.settings.tc} ARS/USD. Ingreso: ${M.f(ing.total, { cur: 'ARS' })} (${M.f(ing.total, { cur: 'USD' })}).`);
    lines.push(`Gastos del mes: ${M.f(c.total, { cur: 'ARS' })} — fijos ${M.f(c.fijo, { cur: 'ARS' })}, cuotas de compras anteriores ${M.f(c.cuotas, { cur: 'ARS' })}, compras ${M.f(c.compras, { cur: 'ARS' })}. Innecesario: ${M.f(c.innecesario, { cur: 'ARS' })} (${M.pct(c.innecesario / (c.total || 1))}).`);
    lines.push(`Presupuesto mensual: ${M.f(mg.presupuesto, { cur: 'ARS' })} (el resto, ${M.f(mg.ahorro, { cur: 'ARS' })}, va a inversión). Queda para gastar: ${M.f(mg.queda, { cur: 'ARS' })}.`);
    lines.push(`Invertido: ${M.f(E.invertido(ym), { cur: 'ARS' })}.`);
    lines.push('\n## Por categoría');
    Object.entries(c.byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => lines.push(`- ${L.cat(k).nombre}: ${M.f(v, { cur: 'ARS' })} (${M.pct(v / (c.total || 1))})`));
    lines.push('\n## Próximos 6 meses (comprometido: fijos + cuotas)');
    E.horizonte(D.thisMonth(), 6).forEach(h => lines.push(`- ${D.monthName(h.ym, true)}: fijos + cuotas ${M.f(h.comprometido, { cur: 'ARS' })} de un presupuesto de ${M.f(h.presupuesto, { cur: 'ARS' })} (${M.pct(h.pct)}), libre para compras ${M.f(h.libre, { cur: 'ARS' })}`));
    const act = E.cuotasActivas(ym);
    if (act.length) { lines.push('\n## Cuotas activas'); act.forEach(a => lines.push(`- ${a.m.desc}: cuota ${a.idx}/${a.n} de ${M.f(a.cuota, { cur: 'ARS' })}, termina ${D.monthName(a.last, true)}`)); }
    lines.push('\n## Movimientos del mes');
    c.movs.sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => lines.push(`- ${m.fecha} | ${m.desc} | ${M.f(E.rowAmount(m), { cur: 'ARS' })}${m.cuotaRow ? ` (cuota ${m.cuotaIdx}/${m.cuotaN})` : (m.cuotas || 1) > 1 ? ` (1/${m.cuotas} cuotas, total ${M.orig(m)})` : ''} | ${L.cat(m.catId).nombre} | ${NECESIDAD[m.necesidad || 1]} | ${MEDIOS[m.medio] || m.medio}${m.recId ? ' | fijo' : ''}`));
    lines.push('\nAnalizá tendencias, señalá gastos evitables y decime cuánto podría invertir el mes que viene sin quedarme corto.');
    return lines.join('\n');
  },
};
