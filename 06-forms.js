/* ===================== FLUJO — modal & forms ===================== */

const Modal = {
  onSubmit: null,
  open({ title, body, submit = 'Guardar', extra = '', onSubmit, wide = false }) {
    Modal.onSubmit = onSubmit; $('#modal').onchange = null; $('#modal').oninput = null;
    $('#modal').innerHTML = `<div class="grabber"></div><div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" style="border:0" aria-label="Cerrar">${ICONS.x}</button></div><div class="m-body">${body}</div><div class="m-foot">${extra}<div class="right"><button class="btn" data-act="close">${submit ? 'Cancelar' : 'Cerrar'}</button>${submit ? `<button class="btn primary" data-act="submit">${submit}</button>` : ''}</div></div>`;
    $('#modal').style.width = wide ? 'min(820px,100%)' : '';
    $('#overlay').classList.add('open');
    const first = $('#modal .m-body [autofocus]'); if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  },
  close() { $('#overlay').classList.remove('open'); Modal.onSubmit = null; },
  submit() { if (Modal.onSubmit && Modal.onSubmit() !== false) Modal.close(); },
  val(id) { const el = $('#' + id); return el ? el.value : ''; },
  choice(id) { const el = $(`#${id} button.on`); return el ? el.dataset.v : ''; },
};
const F = {
  field: (label, inner, help = '', cls = '') => `<div class="field ${cls}"><label>${label}</label>${inner}${help ? `<span class="help">${help}</span>` : ''}</div>`,
  input: (id, val = '', attrs = '') => `<input class="input" id="${id}" value="${esc(val)}" ${attrs}>`,
  select: (id, opts, cur) => `<select class="input" id="${id}">${opts.map(o => `<option value="${o[0]}" ${String(cur) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`,
  choice: (id, opts, cur, cls = '') => `<div class="choice" id="${id}">${opts.map(o => `<button type="button" data-v="${o[0]}" class="${String(cur) === String(o[0]) ? 'on ' + (o[2] || '') : ''}" data-cls="${o[2] || ''}">${esc(o[1])}</button>`).join('')}</div>`,
  catOpts: () => state.categorias.map(c => [c.id, c.nombre]),
  medioOpts: () => [...state.tarjetas.map(t => ['t:' + t.id, t.nombre]), ['debito', 'Débito'], ['efectivo', 'Efectivo'], ['transferencia', 'Transf. / MP']],
  medioVal: (m) => m.medio === 'tarjeta' ? 't:' + (m.tarjetaId || (state.tarjetas[0] || {}).id) : (m.medio || 'debito'),
  parseMedio: (v) => v.startsWith('t:') ? { medio: 'tarjeta', tarjetaId: v.slice(2) } : { medio: v, tarjetaId: undefined },
};

/* choice buttons toggle */
document.addEventListener('click', e => { const b = e.target.closest('.choice button'); if (!b) return; const box = b.parentElement; box.querySelectorAll('button').forEach(x => { x.className = ''; }); b.className = 'on ' + (b.dataset.cls || ''); box.dispatchEvent(new CustomEvent('change', { bubbles: true })); });

/* ---------- movimiento ---------- */
function formMov(m = null, opts = {}) {
  const isNew = !m || opts.dup; const base = m ? { ...m } : { fecha: ui.mes === D.thisMonth() ? D.today() : D.dateIn(ui.mes, Math.min(Number(D.today().slice(8, 10)), D.daysIn(ui.mes))), moneda: 'ARS', cuotas: 1, necesidad: 2, medio: state.tarjetas.length ? 'tarjeta' : 'debito', tarjetaId: (state.tarjetas[0] || {}).id, catId: 'otros' };
  if (opts.dup) { delete base.id; base.fecha = D.today(); }
  const virtual = m && m.virtual;
  const freq = {}; for (const x of state.movimientos) { if (x.fecha >= D.addDays(D.today(), -120)) freq[x.catId] = (freq[x.catId] || 0) + 1; }
  const topCats = state.categorias.slice().sort((p, q) => (freq[q.id] || 0) - (freq[p.id] || 0)).slice(0, 8);
  if (!topCats.find(c => c.id === base.catId)) topCats.unshift(L.cat(base.catId));
  const descs = [...new Set(state.movimientos.slice().sort((p, q) => q.fecha.localeCompare(p.fecha)).map(x => x.desc))].slice(0, 60);
  const tipoBar = isNew && !virtual ? `<div class="seg full" style="width:fit-content;margin:0 auto 4px"><button class="on" type="button">Gasto</button><button type="button" data-act="switch-inv">Aporte a inversión</button></div>` : '';
  const body = `<div class="form-grid">
    ${tipoBar}
    <div class="full"><div class="big-amount"><span class="cur" id="f-cursym">${base.moneda === 'USD' ? 'US$' : '$'}</span><input id="f-monto" inputmode="decimal" autocomplete="off" value="${base.monto != null ? (base.moneda === 'USD' ? String(base.monto).replace('.', ',') : fmtARS.format(base.monto)) : ''}" placeholder="0" ${isNew && !virtual ? 'autofocus' : ''}></div><div class="row" style="justify-content:center;gap:6px">${F.choice('f-moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], base.moneda)}</div></div>
    ${F.field('Descripción', `<input class="input" id="f-desc" list="f-desc-list" value="${esc(base.desc || '')}" placeholder="Carrefour, Netflix, nafta…" autocomplete="off" ${!isNew || virtual ? 'autofocus' : ''}><datalist id="f-desc-list">${descs.map(d => `<option value="${esc(d)}">`).join('')}</datalist><div class="suggest" id="f-sug"></div>`, '', 'full')}
    ${F.field('Categoría', `<div class="chips" id="f-catchips">${topCats.map(c => `<button type="button" data-act="pick-cat" data-id="${c.id}" class="${c.id === base.catId ? 'on' : ''}"><i style="background:${L.catColor(c.id)}"></i>${esc(c.nombre)}</button>`).join('')}</div>${F.select('f-cat', F.catOpts(), base.catId)}`, '', 'full')}
    ${F.field('Fecha', `<div class="row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn sm" data-act="set-date" data-id="hoy">Hoy</button><button type="button" class="btn sm" data-act="set-date" data-id="ayer">Ayer</button>${F.input('f-fecha', base.fecha, 'type="date"')}</div>`, '', 'full')}
    ${F.field('Medio de pago', F.choice('f-medio', F.medioOpts(), F.medioVal(base)), '', 'full')}
    ${F.field('Cuotas', `<div class="row" style="gap:6px;flex-wrap:nowrap">${F.choice('f-cuotas', [[1, 'Un pago'], [3, '3'], [6, '6'], [12, '12']], [1, 3, 6, 12].includes(Number(base.cuotas) || 1) ? (base.cuotas || 1) : '')}<input class="input sm mono" id="f-cuotas-n" inputmode="numeric" placeholder="otra" style="width:70px" value="${[1, 3, 6, 12].includes(Number(base.cuotas) || 1) ? '' : base.cuotas}"></div>`, '<span id="f-pago-hint"></span>', 'full')}
    ${F.field('¿Hacía falta?', F.choice('f-nec', [[1, 'Necesario'], [2, 'Útil'], [3, 'Innecesario', 'n3']], base.necesidad || 2), '', 'full')}
    ${F.field('Notas', F.input('f-notas', base.notas || '', 'placeholder="opcional"'), '', 'full')}
    <details class="full" ${base.primerPago ? 'open' : ''}><summary class="small muted" style="cursor:pointer">Ajustes avanzados</summary><div class="form-grid" style="margin-top:8px">${F.field('Primer resumen (mes de pago)', F.input('f-primer', base.primerPago || '', 'type="month"'), 'Dejalo vacío para calcularlo por el cierre de la tarjeta')}</div></details>
  </div>`;
  Modal.open({ title: virtual ? `Confirmar ${base.desc} de ${D.monthName(base.mesRec, true)}` : isNew ? 'Nuevo gasto' : 'Editar gasto', body, submit: isNew || virtual ? 'Guardar gasto' : 'Guardar cambios',
    extra: !isNew && !virtual ? `<button class="btn danger" data-act="del-from-modal" data-id="${m.id}">Borrar</button>` : '',
    onSubmit: () => {
      const desc = Modal.val('f-desc').trim(); const monto = M.parse(Modal.val('f-monto'));
      if (!desc) { toast('Falta la descripción'); return false; } if (!monto) { toast('Falta el monto'); return false; }
      const medio = F.parseMedio(Modal.choice('f-medio') || 'debito');
      const cuotasN = Number(Modal.val('f-cuotas-n')) || Number(Modal.choice('f-cuotas')) || 1;
      const rec = { id: isNew ? uid() : m.id, desc, monto, moneda: Modal.choice('f-moneda') || 'ARS', fecha: Modal.val('f-fecha') || D.today(), catId: Modal.val('f-cat'), ...medio, cuotas: medio.medio === 'tarjeta' ? clamp(cuotasN, 1, 60) : 1, necesidad: Number(Modal.choice('f-nec')) || 2, notas: Modal.val('f-notas').trim() || undefined, primerPago: Modal.val('f-primer') || undefined };
      if (virtual) { rec.recId = m.recId; rec.mesRec = m.mesRec; } else if (m && m.recId && !opts.dup) { rec.recId = m.recId; rec.mesRec = m.mesRec; }
      if (isNew || virtual) state.movimientos.push(rec); else Object.assign(m, rec);
      if (!rec.recId) Smart.learn(rec);
      Persist.save(); toast(isNew ? 'Gasto guardado' : 'Cambios guardados'); render();
    } });
  // live behaviour
  const upd = () => {
    if (!$('#f-cuotas') || !$('#f-pago-hint')) return;
    const medio = F.parseMedio(Modal.choice('f-medio') || 'debito'); const hint = $('#f-pago-hint'); const fecha = Modal.val('f-fecha');
    const cuotasBox = $('#f-cuotas').parentElement.parentElement; cuotasBox.style.opacity = medio.medio === 'tarjeta' ? 1 : .45;
    if (medio.medio === 'tarjeta' && L.tarjeta(medio.tarjetaId) && fecha) { const cy = E.cycle(L.tarjeta(medio.tarjetaId), fecha); const n = Number(Modal.val('f-cuotas-n')) || Number(Modal.choice('f-cuotas')) || 1; const cuota = M.parse(Modal.val('f-monto')) / n; const over = Modal.val('f-primer'); const first = over || cy.mesPago; hint.textContent = `Cae en el resumen que vence ${over ? 'en ' + D.monthName(first, true) : D.fmt(cy.vencimiento, { year: true })}${n > 1 ? ` · ${n} cuotas de ${M.f(M.toARS(cuota, Modal.choice('f-moneda') || 'ARS'))} hasta ${D.monthName(D.addMonths(first, n - 1), true)}` : ''}`; }
    else hint.textContent = medio.medio === 'tarjeta' ? '' : 'Sale de la cuenta el mismo día';
    $('#f-cursym').textContent = (Modal.choice('f-moneda') || 'ARS') === 'USD' ? 'US$' : '$';
    const cid = $('#f-cat').value; $$('#f-catchips button').forEach(b => b.classList.toggle('on', b.dataset.id === cid));
  };
  $('#modal').onchange = upd; $('#modal').oninput = e => { if (e.target.id === 'f-monto' || e.target.id === 'f-cuotas-n') upd(); };
  $('#f-cat').addEventListener('change', () => { $('#f-cat').dataset.touched = '1'; });
  $('#f-monto').addEventListener('blur', () => { const el = $('#f-monto'); const v = M.parse(el.value); if (!v) return; el.value = (Modal.choice('f-moneda') || 'ARS') === 'USD' ? String(v).replace('.', ',') : fmtARS.format(v); });
  $('#f-cuotas-n').addEventListener('input', () => { if ($('#f-cuotas-n').value) $$('#f-cuotas button').forEach(b => b.className = ''); });
  $('#f-cuotas').addEventListener('change', () => { $('#f-cuotas-n').value = ''; });
  // suggestions while typing
  let sugTimer;
  $('#f-desc').addEventListener('input', () => { clearTimeout(sugTimer); sugTimer = setTimeout(() => {
    const s = Smart.suggest($('#f-desc').value); const box = $('#f-sug'); if (!s) { box.innerHTML = ''; return; }
    const c = L.cat(s.catId);
    const auto = !$('#f-cat').dataset.touched && isNew;
    if (auto) { $('#f-cat').value = s.catId; const nb = $(`#f-nec button[data-v="${s.necesidad || 2}"]`); if (nb) nb.click(); upd(); }
    box.innerHTML = `<button type="button" id="f-apply">${auto ? '✓ ' : ''}${s.src === 'historial' ? `Como otras ${s.n} veces: ` : 'Sugerido: '}${esc(c.nombre)} · ${NECESIDAD[s.necesidad] || 'Útil'}${s.medio ? ' · ' + (s.medio === 'tarjeta' ? (L.tarjeta(s.tarjetaId) || {}).nombre || 'tarjeta' : MEDIOS[s.medio]) : ''}${s.monto && !$('#f-monto').value ? ' · ' + M.orig(s) : ''}</button>`;
    $('#f-apply').onclick = () => { $('#f-cat').value = s.catId; const nb = $(`#f-nec button[data-v="${s.necesidad || 2}"]`); if (nb) nb.click(); if (s.medio) { const mv = s.medio === 'tarjeta' ? 't:' + s.tarjetaId : s.medio; const mb = $(`#f-medio button[data-v="${mv}"]`); if (mb) mb.click(); } if (s.monto && !$('#f-monto').value) { $('#f-monto').value = s.moneda === 'USD' ? String(s.monto).replace('.', ',') : fmtARS.format(s.monto); const cb = $(`#f-moneda button[data-v="${s.moneda || 'ARS'}"]`); if (cb) cb.click(); } box.innerHTML = ''; upd(); };
  }, 180); });
  upd();
}

/* ---------- recurrente ---------- */
function formRec(r = null, fromMov = null) {
  const base = r ? { ...r } : fromMov ? { desc: fromMov.desc, monto: fromMov.monto, moneda: fromMov.moneda, catId: fromMov.catId, medio: fromMov.medio, tarjetaId: fromMov.tarjetaId, dia: Number(fromMov.fecha.slice(8, 10)), necesidad: fromMov.necesidad, desde: D.thisMonth() } : { moneda: 'ARS', medio: state.tarjetas.length ? 'tarjeta' : 'debito', tarjetaId: (state.tarjetas[0] || {}).id, catId: 'subs', dia: 1, necesidad: 1, desde: D.thisMonth() };
  const body = `<div class="form-grid">
    ${F.field('Concepto', F.input('r-desc', base.desc || '', 'placeholder="Seguro del auto, Claude, alquiler…" autofocus'), '', 'full')}
    ${F.field('Monto por mes', `<div class="amount-input"><span class="cur">${base.moneda === 'USD' ? 'US$' : '$'}</span><input class="input" id="r-monto" inputmode="decimal" value="${base.monto != null ? (base.moneda === 'USD' ? String(base.monto).replace('.', ',') : fmtARS.format(base.monto)) : ''}"></div>`)}
    ${F.field('Moneda', F.choice('r-moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], base.moneda || 'ARS'))}
    ${F.field('Categoría', F.select('r-cat', F.catOpts(), base.catId))}
    ${F.field('Día del mes', F.input('r-dia', base.dia || 1, 'inputmode="numeric"'))}
    ${F.field('Medio de pago', F.choice('r-medio', F.medioOpts(), F.medioVal(base)), '', 'full')}
    ${F.field('¿Hacía falta?', F.choice('r-nec', [[1, 'Necesario'], [2, 'Útil'], [3, 'Innecesario', 'n3']], base.necesidad || 1))}
    ${F.field('Activo', `<label class="switch"><input type="checkbox" id="r-activo" ${base.activo === false ? '' : 'checked'}><span>Se repite todos los meses</span></label>`)}
    ${F.field('Desde', F.input('r-desde', base.desde || '', 'type="month"'))}
    ${F.field('Hasta (opcional)', F.input('r-hasta', base.hasta || '', 'type="month"'), 'Para cuotas fijas de un préstamo, por ejemplo')}
  </div>`;
  Modal.open({ title: r ? 'Editar gasto fijo' : 'Nuevo gasto fijo', body, onSubmit: () => {
    const desc = Modal.val('r-desc').trim(); const monto = M.parse(Modal.val('r-monto')); if (!desc || !monto) { toast('Completá concepto y monto'); return false; }
    const rec = { id: r ? r.id : uid(), desc, monto, moneda: Modal.choice('r-moneda') || 'ARS', catId: Modal.val('r-cat'), dia: clamp(Number(Modal.val('r-dia')) || 1, 1, 31), ...F.parseMedio(Modal.choice('r-medio') || 'debito'), necesidad: Number(Modal.choice('r-nec')) || 1, activo: $('#r-activo').checked, desde: Modal.val('r-desde') || undefined, hasta: Modal.val('r-hasta') || undefined };
    if (r) Object.assign(r, rec); else state.recurrentes.push(rec);
    if (fromMov) { // convert history: tag matching past movements as instances
      const k = norm(fromMov.desc).replace(/\d+/g, '').trim();
      for (const m of state.movimientos) if (!m.recId && norm(m.desc).replace(/\d+/g, '').trim() === k) { m.recId = rec.id; m.mesRec = D.ym(m.fecha); }
    }
    Persist.save(); toast('Gasto fijo guardado'); render();
  } });
}

/* ---------- tarjeta ---------- */
function formCard(t = null) {
  const base = t || { cierre: 20, vencimiento: 5, color: CARD_COLORS[state.tarjetas.length % CARD_COLORS.length] };
  const body = `<div class="form-grid">
    ${F.field('Nombre', F.input('c-nombre', base.nombre || '', 'placeholder="Visa" autofocus'))}
    ${F.field('Banco', F.input('c-banco', base.banco || '', 'placeholder="Galicia"'))}
    ${F.field('Día de cierre', F.input('c-cierre', base.cierre, 'inputmode="numeric"'), 'Las compras hasta ese día entran en el resumen del mes')}
    ${F.field('Día de vencimiento', F.input('c-venc', base.vencimiento, 'inputmode="numeric"'), 'Día en que pagás el resumen')}
    ${F.field('Límite (opcional)', F.input('c-limite', base.limite ? fmtARS.format(base.limite) : '', 'inputmode="numeric"'))}
    ${F.field('Color', `<div class="choice" id="c-color">${CARD_COLORS.map(c => `<button type="button" data-v="${c}" class="${base.color === c ? 'on' : ''}" style="background:${c};width:34px;height:30px;border-color:${base.color === c ? 'var(--ink)' : 'transparent'}"></button>`).join('')}</div>`)}
  </div>`;
  Modal.open({ title: t ? 'Editar tarjeta' : 'Nueva tarjeta', body, onSubmit: () => {
    const nombre = Modal.val('c-nombre').trim(); if (!nombre) { toast('Falta el nombre'); return false; }
    const rec = { id: t ? t.id : uid(), nombre, banco: Modal.val('c-banco').trim(), cierre: clamp(Number(Modal.val('c-cierre')) || 20, 1, 31), vencimiento: clamp(Number(Modal.val('c-venc')) || 5, 1, 31), limite: M.parse(Modal.val('c-limite')) || 0, color: Modal.choice('c-color') || base.color };
    if (t) Object.assign(t, rec); else state.tarjetas.push(rec);
    Persist.save(); render();
  } });
}

/* ---------- cuenta ---------- */
function formCuenta(c = null) {
  const base = c || { moneda: 'ARS', tipo: 'Caja de ahorro' };
  const body = `<div class="form-grid">
    ${F.field('Nombre', F.input('a-nombre', base.nombre || '', 'placeholder="Galicia caja de ahorro" autofocus'))}
    ${F.field('Tipo', F.select('a-tipo', [['Caja de ahorro', 'Caja de ahorro'], ['Cuenta corriente', 'Cuenta corriente'], ['Billetera virtual', 'Billetera virtual (MP, Ualá)'], ['Broker', 'Broker (Balanz, IOL)'], ['Efectivo', 'Efectivo'], ['Cripto', 'Cripto / stablecoins']], base.tipo))}
    ${F.field('Saldo actual', F.input('a-saldo', base.saldo != null ? String(base.saldo).replace('.', ',') : '', 'inputmode="decimal"'))}
    ${F.field('Moneda', F.choice('a-moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], base.moneda))}
    ${F.field('', `<label class="switch"><input type="checkbox" id="a-sueldo" ${base.esSueldo ? 'checked' : ''}><span>Acá cobro el sueldo</span></label>`, '', 'full')}
  </div>`;
  Modal.open({ title: c ? 'Editar cuenta' : 'Nueva cuenta', body, onSubmit: () => {
    const nombre = Modal.val('a-nombre').trim(); if (!nombre) { toast('Falta el nombre'); return false; }
    const rec = { id: c ? c.id : uid(), nombre, tipo: Modal.val('a-tipo'), saldo: M.parse(Modal.val('a-saldo')), moneda: Modal.choice('a-moneda') || 'ARS', esSueldo: $('#a-sueldo').checked };
    if (c) Object.assign(c, rec); else state.cuentas.push(rec);
    Persist.save(); render();
  } });
}

/* ---------- cobro del sueldo: el día de cobro la app pregunta cuánto cobraste y recalcula todo ---------- */
const Cobro = {
  key: 'flujo.cobroPospuesto',
  pospuestoHoy() { try { return localStorage.getItem(Cobro.key) === D.today(); } catch (e) { return false; } },
  posponer() { try { localStorage.setItem(Cobro.key, D.today()); } catch (e) {} },
  /** Resultado de registrar: toast con variación y lo que queda para invertir */
  avisar(ym, r) {
    const mes = D.monthName(ym).split(' ')[0]; const pres = E.presupuesto(ym);
    const delta = r.delta != null && Math.abs(r.delta) >= 0.001 ? ` (${r.delta > 0 ? '+' : ''}${(r.delta * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} % vs ${r.prevRegistrado ? D.monthName(D.addMonths(ym, -1)).split(' ')[0] : 'el anterior'})` : '';
    toast(`Sueldo de ${mes}: ${M.f(r.monto)}${delta}${pres ? ` · para invertir ${M.f(r.monto - pres)}` : ''}`, 5000);
  },
};
function formCobro(ym = D.thisMonth()) {
  const prevYm = D.addMonths(ym, -1); const prev = E.sueldo(prevYm); const act = E.sueldo(ym);
  const mes = D.monthName(ym).split(' ')[0]; const fechaDef = act.registrado && act.fecha ? act.fecha : E.fechaCobro(ym);
  const body = `<div class="form-grid">
    ${F.field(`Sueldo neto de ${mes} (ARS)`, F.input('sc-monto', act.registrado ? fmtARS.format(act.monto) : (prev.monto ? fmtARS.format(prev.monto) : ''), 'inputmode="numeric" autofocus'), prev.monto ? `${prev.registrado ? D.monthName(prevYm).split(' ')[0] : 'Sueldo actual'}: ${M.f(prev.monto)}` : '', 'full')}
    ${F.field('Fecha de cobro', F.input('sc-fecha', fechaDef, 'type="date"'))}
  </div>`;
  Modal.open({ title: act.registrado || E.fechaCobro(ym) > D.today() ? `Sueldo de ${mes}` : '¿Cuánto cobraste?', body, submit: 'Guardar', extra: act.registrado ? `<button type="button" class="btn danger" data-act="del-sueldo" data-id="${ym}">Borrar</button>` : '', onSubmit: () => {
    const monto = M.parse(Modal.val('sc-monto')); if (!monto) { toast('Falta el monto'); return false; }
    const r = E.registrarSueldo(ym, monto, Modal.val('sc-fecha') || E.fechaCobro(ym)); Persist.save(); render(); setTimeout(() => Cobro.avisar(ym, r), 250);
  } });
}

/* ---------- fijos del mes: cuando llega el día de cada gasto fijo, la app pregunta si quedó igual o cambió ---------- */
const Fijos = {
  key: 'flujo.fijosVisto',
  firma(ym) { return `${ym}:${E.fijosPendientes(ym).map(v => v.recId).sort().join(',')}`; },
  yaMostrado(ym) { try { return localStorage.getItem(Fijos.key) === Fijos.firma(ym); } catch (e) { return false; } },
  marcar(ym) { try { localStorage.setItem(Fijos.key, Fijos.firma(ym)); } catch (e) {} },
};
function formFijos(ym = D.thisMonth()) {
  const pend = E.fijosPendientes(ym); if (!pend.length) { toast('No hay fijos pendientes'); return; }
  const mes = D.monthName(ym).split(' ')[0]; Fijos.marcar(ym);
  const rows = pend.map(v => `<div class="fijo-row" data-rec="${esc(v.recId)}"><div style="min-width:0"><b>${esc(v.desc)}</b><span class="sub">día ${Number(v.fecha.slice(8, 10))} · antes ${M.f(M.toARS(v.monto, v.moneda))}</span></div><div class="amount-input"><span class="cur">${v.moneda === 'USD' ? 'US$' : '$'}</span><input class="input sm mono" inputmode="decimal" data-fijo="${esc(v.recId)}" value="${v.moneda === 'USD' ? String(v.monto).replace('.', ',') : fmtARS.format(v.monto)}"></div><button type="button" class="mini-btn" data-act="fijo-omitir" data-id="${esc(v.recId)}" aria-label="Este mes no va">${ICONS.x}</button></div>`).join('');
  Modal.open({ title: `Fijos de ${mes}`, submit: 'Confirmar', body: `<div class="stack"><div class="small muted">Dejá el monto si quedó igual, corregilo si cambió, ✕ si este mes no va.</div><div class="fijos">${rows}</div></div>`, onSubmit: () => {
    const montos = {}; const omit = [];
    $$('.fijo-row').forEach(row => { const id = row.dataset.rec; if (row.classList.contains('omitido')) { omit.push(id); return; } montos[id] = M.parse(row.querySelector('input').value); });
    if (Object.values(montos).some(m => !(m > 0))) { toast('Hay un fijo sin monto: corregilo o marcalo con ✕'); return false; }
    const r = E.confirmarFijos(ym, montos, omit); Persist.save(); render();
    const camb = r.cambios.map(c => `${c.desc} ${c.d > 0 ? '+' : ''}${M.pct(c.d, 0)}`).join(', ');
    setTimeout(() => toast(`${r.n} fijo${r.n === 1 ? '' : 's'} de ${mes} confirmado${r.n === 1 ? '' : 's'}${r.cambios.length ? ` · cambiaron: ${camb}` : r.n ? ' · sin cambios' : ''}${r.omitidos ? ` · ${r.omitidos} omitido${r.omitidos > 1 ? 's' : ''}` : ''}`, 5000), 250);
  } });
}

/* ---------- conciliación con Balanz: la verdad es la tenencia del broker ---------- */
function formConciliar() {
  const k = E.cartera(); const prev = state.cartera.conciliacion || null;
  if (!k.posiciones.length) { toast('Sin posiciones para conciliar'); return; }
  const rows = k.posiciones.map(p => { const c = p.cedear; const app = c ? Cedears.aCedears(p.acciones, c) : p.acciones; const pv = prev && prev.items && prev.items[p.ticker]; return `<div class="conc-row"><div style="min-width:0"><b>${esc(p.ticker)}</b><span class="sub">${fmtAcc(Math.round(app * 1000) / 1000)} ${c ? 'CEDEARs' : 'acc'} según la app</span></div><input class="input sm mono" inputmode="decimal" data-conc="${esc(p.ticker)}" placeholder="Balanz" value="${pv && pv.balanz != null ? String(pv.balanz).replace('.', ',') : ''}"></div>`; }).join('');
  Modal.open({ title: 'Conciliar con Balanz', submit: 'Guardar', body: `<div class="stack"><div class="small muted">Balanz → Tenencia: copiá la cantidad de cada ${k.posiciones.some(p => p.cedear) ? 'CEDEAR' : 'activo'}. Vacío = no lo revisaste.${prev ? ` Última conciliación: ${D.fmt(prev.fecha, { year: true })}.` : ''}</div><div class="conc">${rows}</div></div>`, onSubmit: () => {
    const items = {}; let ok = 0, dif = 0, n = 0;
    for (const p of k.posiciones) { const el = $(`[data-conc="${p.ticker}"]`); if (!el || !el.value.trim()) continue; const v = M.parse(el.value); const c = p.cedear; const app = c ? Cedears.aCedears(p.acciones, c) : p.acciones; n++; const coincide = Math.abs(v - app) <= Math.max(0.01, app * 0.002); items[p.ticker] = { app: Math.round(app * 1000) / 1000, balanz: v, ok: coincide }; if (coincide) ok++; else dif++; }
    if (!n) { toast('Cargá al menos una cantidad'); return false; }
    state.cartera.conciliacion = { fecha: D.today(), items, ok, dif, n }; Persist.save(); render();
    setTimeout(() => toast(dif ? `${dif} diferencia${dif > 1 ? 's' : ''} con Balanz: revisá las operaciones de esas posiciones` : `Conciliación OK: ${ok} posición${ok === 1 ? '' : 'es'} coinciden con Balanz`, 4500), 250);
  } });
}

/* ---------- inversión / ingreso extra ---------- */
function formInv() {
  const destinos = [...new Set(state.inversiones.slice().sort((p, q) => q.fecha.localeCompare(p.fecha)).map(i => i.destino).filter(Boolean))].slice(0, 6);
  const body = `<div class="form-grid">
    <div class="seg full" style="width:fit-content;margin:0 auto 4px"><button type="button" data-act="switch-gasto">Gasto</button><button class="on" type="button">Aporte a inversión</button></div>
    <div class="full"><div class="big-amount"><span class="cur" id="i-cursym">$</span><input id="i-monto" inputmode="decimal" autocomplete="off" placeholder="0" autofocus></div><div class="row" style="justify-content:center;gap:6px">${F.choice('i-moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], 'ARS')}</div></div>
    ${F.field('Destino', `${destinos.length ? `<div class="chips" style="margin-bottom:6px">${destinos.map(d => `<button type="button" data-act="pick-destino" data-id="${esc(d)}">${esc(d)}</button>`).join('')}</div>` : ''}<input class="input" id="i-destino" placeholder="Balanz · CEDEARs, BTC, plazo fijo…">`, '', 'full')}
    ${F.field('Fecha', `<div class="row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn sm" data-act="set-date-inv" data-id="hoy">Hoy</button><button type="button" class="btn sm" data-act="set-date-inv" data-id="ayer">Ayer</button>${F.input('i-fecha', ui.mes === D.thisMonth() ? D.today() : D.dateIn(ui.mes, 1), 'type="date"')}</div>`, '', 'full')}
    ${F.field('Detalle', F.input('i-desc', '', 'placeholder="opcional"'), '', 'full')}
  </div>`;
  Modal.open({ title: 'Registrar inversión', body, submit: 'Guardar inversión', onSubmit: () => { const monto = M.parse(Modal.val('i-monto')); if (!monto) { toast('Falta el monto'); return false; } state.inversiones.push({ id: uid(), monto, moneda: Modal.choice('i-moneda') || 'ARS', fecha: Modal.val('i-fecha') || D.today(), destino: Modal.val('i-destino').trim(), desc: Modal.val('i-desc').trim() }); Persist.save(); toast('Inversión registrada'); render(); } });
  $('#modal').onchange = () => { const el = $('#i-cursym'); if (el) el.textContent = (Modal.choice('i-moneda') || 'ARS') === 'USD' ? 'US$' : '$'; };
}
function formIng() {
  const body = `<div class="form-grid">
    ${F.field('Monto', `<div class="amount-input"><span class="cur">$</span><input class="input" id="g-monto" inputmode="decimal" autofocus></div>`)}
    ${F.field('Moneda', F.choice('g-moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], 'ARS'))}
    ${F.field('Fecha', F.input('g-fecha', ui.mes === D.thisMonth() ? D.today() : D.dateIn(ui.mes, 1), 'type="date"'))}
    ${F.field('Concepto', F.input('g-desc', '', 'placeholder="Aguinaldo, freelance, venta…"'))}
  </div>`;
  Modal.open({ title: 'Ingreso extra', body, onSubmit: () => { const monto = M.parse(Modal.val('g-monto')); if (!monto) { toast('Falta el monto'); return false; } state.ingresos.push({ id: uid(), monto, moneda: Modal.choice('g-moneda') || 'ARS', fecha: Modal.val('g-fecha') || D.today(), desc: Modal.val('g-desc').trim() }); Persist.save(); render(); } });
}

/* ---------- categoría ---------- */
function formCat(c = null) {
  const base = c || { grupo: 'otros', tipo: 'variable' };
  const body = `<div class="form-grid">
    ${F.field('Nombre', F.input('k-nombre', base.nombre || '', 'autofocus'))}
    ${F.field('Grupo (define el color en los gráficos)', F.select('k-grupo', GRUPOS.map(g => [g.id, g.nombre]), base.grupo))}
    ${F.field('Tipo', F.choice('k-tipo', [['variable', 'Variable'], ['fijo', 'Fijo']], base.tipo))}
  </div>`;
  Modal.open({ title: c ? 'Editar categoría' : 'Nueva categoría', body, onSubmit: () => { const nombre = Modal.val('k-nombre').trim(); if (!nombre) return false; const rec = { id: c ? c.id : 'c_' + uid(), nombre, grupo: Modal.val('k-grupo'), tipo: Modal.choice('k-tipo') || 'variable', presupuesto: c ? c.presupuesto : 0 }; if (c) Object.assign(c, rec); else state.categorias.splice(state.categorias.length - 1, 0, rec); Persist.save(); render(); } });
}

/* ---------- confirm ---------- */
function confirmar(msg, onOk, label = 'Borrar') { Modal.open({ title: 'Confirmar', body: `<p>${esc(msg)}</p>`, submit: label, onSubmit: () => { onOk(); } }); const b = $('#modal [data-act="submit"]'); if (b && label === 'Borrar') b.classList.add('danger'); }

/* ---------- cartera: operaciones, posiciones, alertas ---------- */
/* ---------- control de calidad de una operación: cada número se contrasta con una fuente independiente antes de guardar ---------- */
const Verif = {
  /** Lee el form de operación y arma la operación candidata (sin validar campos vacíos) */
  candidata(pre = {}) {
    const tipo = Modal.choice('o-tipo') || 'compra'; const ticker = formOpTicker(); const modo = tipo === 'dividendo' ? null : (Modal.choice('o-modo') || 'usd');
    const fRaw = Modal.val('o-fecha') || D.today(); const o = { id: pre.id || null, tipo, ticker, fecha: D.habil(fRaw), fechaRaw: fRaw, modo };
    if (tipo === 'dividendo') o.monto = M.parse(Modal.val('o-monto'));
    else if (modo === 'cedear') { const c = formOpCedear(ticker); o.c = c; o.cedears = M.parse(Modal.val('o-ced')); o.precioCedear = M.parse(Modal.val('o-pxars')); o.ccl = M.parse(Modal.val('o-ccl')); if (c && o.cedears && o.precioCedear && o.ccl) { o.acciones = Cedears.aAcciones(o.cedears, c); o.precio = Cedears.precioUSD(o.precioCedear, c, o.ccl); } }
    else { o.acciones = M.parse(Modal.val('o-acc')); o.precio = M.parse(Modal.val('o-precio')); }
    return o;
  },
  /** Chequeos: [{nivel:'ok'|'info'|'warn'|'block', txt}] + trazabilidad de las fuentes usadas */
  evaluar(o, k) {
    const items = []; const add = (nivel, txt) => items.push({ nivel, txt });
    const hoy = D.today(); const hoyH = D.habil(hoy); const s = state.settings; const pr = o.ticker ? state.cartera.precios[o.ticker] : null; const spy = state.cartera.precios.SPY;
    const min = t => t ? Math.round((Date.now() - t) / 60000) : null; const hace = m => m == null ? '' : m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
    const traza = { en: new Date().toISOString() };
    if (o.fechaRaw > hoy) add('block', `Fecha futura (${D.fmt(o.fechaRaw, { year: true })}).`);
    else if (o.fecha !== o.fechaRaw) add('info', `${D.fmt(o.fechaRaw)} no es día hábil: se guarda el ${D.fmt(o.fecha, { year: true })}.`);
    if (o.tipo === 'dividendo') {
      const p = k.posiciones.find(x => x.ticker === o.ticker);
      if (!p) add('warn', `No tenés ${o.ticker || 'ese ticker'} en cartera: ¿dividendo de una posición cerrada?`);
      else if (o.monto && p.valor && o.monto > p.valor * 0.1) add('warn', `Dividendo de ${fmtU(o.monto)} = ${M.pct(o.monto / p.valor, 1)} de la posición: inusualmente alto, revisá que sea neto en USD.`);
      return { items, nivel: Verif.nivel(items), traza };
    }
    // ratio
    if (o.modo === 'cedear') {
      if (!o.c) add('block', 'Sin ratio: no puedo convertir CEDEARs a acciones.');
      else if (o.c.manual) { add('warn', `Ratio manual ${Cedears.ratioTxt(o.c)}: verificalo en Balanz o BYMA.`); traza.ratio = { txt: Cedears.ratioTxt(o.c), fuente: 'manual' }; }
      else { add('ok', `Ratio ${Cedears.ratioTxt(o.c)} · tabla BYMA ${D.fmt(Cedears.actualizado(), { year: true })}.`); traza.ratio = { txt: Cedears.ratioTxt(o.c), fuente: `BYMA ${Cedears.actualizado()}` }; }
    }
    // precio en USD vs NY (independiente de lo que tipeaste): el chequeo que atrapa errores de precio, cantidad, ratio o ticker
    if (o.precio) {
      const ny = pr && pr.c ? pr : null;
      if (!ny) add('warn', `Sin precio de ${o.ticker} en NY para contrastar (cargá la clave de Finnhub en Ajustes).`);
      else {
        const gap = o.precio / ny.c - 1; const ag = Math.abs(gap); const pasada = o.fecha < hoyH; const txt = `${fmtU(o.precio)} por acción vs ${fmtU(ny.c)} en NY ${pasada ? 'hoy' : hace(min(ny.t))} (${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)} %)`;
        traza.ny = { precio: ny.c, hora: ny.t ? new Date(ny.t).toISOString() : null, gap: Math.round(gap * 10000) / 10000 };
        if (pasada) add(ag > 0.35 ? 'warn' : 'info', `${txt}${ag > 0.35 ? ': muy lejos del precio actual, revisá' : ' · fecha pasada, sin verificación exacta'}.`);
        else if (ag <= 0.03) add('ok', `Precio coherente con NY: ${txt}.`);
        else if (ag <= 0.12) add('warn', `Precio ${txt}: puede ser el premium del CEDEAR o un error de precio, cantidad o ratio.`);
        else add('block', `Precio ${txt}: casi seguro hay un error (precio, cantidad, ratio o ticker).`);
      }
    }
    // CCL
    if (o.modo === 'cedear' && o.ccl) {
      const el = $('#o-ccl'); const fuente = el && el.dataset.fuente ? el.dataset.fuente : 'mercado'; const edad = s.cclHora ? min(new Date(s.cclHora).getTime()) : null;
      traza.ccl = { valor: o.ccl, fuente, mercado: s.ccl || null, hora: s.cclHora || null };
      if (o.c && pr && pr.c && o.precioCedear) traza.ccl.implicito = Math.round(o.precioCedear * o.c.ratio[0] / o.c.ratio[1] / pr.c);
      if (o.fecha < hoyH) add('info', `CCL $ ${fmtARS.format(o.ccl)} (${fuente === 'manual' ? 'manual' : fuente}) · fecha pasada: tiene que ser el CCL de ese día.`);
      else if (fuente === 'implicito') add('ok', `CCL implícito $ ${fmtARS.format(o.ccl)}: tu precio queda igual al de NY${s.ccl ? ` (mercado $ ${fmtARS.format(s.ccl)})` : ''}.`);
      else if (fuente === 'manual') add('warn', `CCL manual $ ${fmtARS.format(o.ccl)}${s.ccl ? ` · mercado $ ${fmtARS.format(s.ccl)} ${hace(edad)}` : ''}.`);
      else if (edad == null || edad > 30) add('warn', `CCL de mercado $ ${fmtARS.format(o.ccl)} ${edad == null ? 'sin hora' : hace(edad)}: refrescalo antes de guardar.`);
      else add('ok', `CCL de mercado $ ${fmtARS.format(o.ccl)} · dolarapi ${hace(edad)}.`);
    }
    // sombra S&P 500
    if (o.fecha === hoyH) {
      const fresco = spy && spy.c && spy.t && D.iso(new Date(spy.t)) === hoy && (!spy.pc || Math.abs(spy.c / spy.pc - 1) < 0.07);
      if (fresco) { const m = min(spy.t); add('ok', `Sombra: SPY ${m <= 20 ? 'en vivo' : 'del día'} ${fmtU(spy.c)} ${hace(m)}.`); traza.spy = { valor: spy.c, fuente: m <= 20 ? 'vivo' : 'dia', hora: new Date(spy.t).toISOString() }; }
      else { const cl = Spy.at(o.fecha); const fd = Spy.fechaDe(o.fecha); add('warn', `Sin SPY en vivo: la sombra usa el cierre ${fd ? `del ${D.fmt(fd)}` : ''} ${cl ? fmtU(cl) : 's/d'}.`); traza.spy = { valor: cl, fuente: 'cierre', fecha: fd }; }
    } else {
      const fd = Spy.fechaDe(o.fecha); const cl = Spy.at(o.fecha); traza.spy = { valor: cl, fuente: 'cierre', fecha: fd };
      if (!cl) add('warn', 'Sin cierre de SPY para esa fecha: la sombra no puede replicar la operación.');
      else if (fd !== o.fecha) add('warn', `Sin cierre de SPY del ${D.fmt(o.fecha)}: la sombra usa el del ${D.fmt(fd)} (${fmtU(cl)}).`);
      else add('ok', `Sombra: cierre de SPY del ${D.fmt(o.fecha)} ${fmtU(cl)}.`);
    }
    // venta > tenencia
    if (o.tipo === 'venta' && o.acciones) { const p = k.posiciones.find(x => x.ticker === o.ticker); const tengo = p ? p.acciones + (o.id ? (k.ops.find(x => x.id === o.id) || {}).acciones || 0 : 0) : 0; if (tengo + 1e-6 < o.acciones) add('block', `Vendés ${fmtAcc(o.acciones)} acciones y tenés ${fmtAcc(tengo)}.`); }
    // duplicado
    const dup = state.cartera.operaciones.find(x => x.id !== o.id && x.ticker === o.ticker && x.fecha === o.fecha && x.tipo === o.tipo && o.acciones && Math.abs((x.acciones || 0) - o.acciones) < 1e-6);
    if (dup) add('warn', `Ya hay una ${o.tipo} igual de ${o.ticker} el ${D.fmt(o.fecha)}: ¿duplicada?`);
    // monto inusual
    if (o.acciones && o.precio) { const total = o.acciones * o.precio; const prev = state.cartera.operaciones.filter(x => x.id !== o.id && x.tipo !== 'dividendo').map(x => (x.acciones || 0) * (x.precio || 0)); const mx = prev.length ? Math.max(...prev) : 0; if (mx && total > 3 * mx && total > 500) add('warn', `Total ${fmtU(total)}: muy por encima de tu operación más grande (${fmtU(mx)}).`); }
    return { items, nivel: Verif.nivel(items), traza };
  },
  nivel(items) { return items.some(i => i.nivel === 'block') ? 'block' : items.some(i => i.nivel === 'warn') ? 'warn' : 'ok'; },
  html(ev) {
    const ic = { ok: '✓', info: '·', warn: '⚠', block: '✕' };
    return `<ul class="verif">${ev.items.map(i => `<li class="${i.nivel}"><i>${ic[i.nivel]}</i><span>${i.txt}</span></li>`).join('')}</ul>${ev.nivel === 'block' ? `<label class="switch verif-force"><input type="checkbox" id="o-force"><span>Lo revisé, guardar igual</span></label>` : ''}`;
  },
  /** Texto corto de trazabilidad para el detalle de una operación guardada */
  trazaTxt(v) {
    if (!v || !v.traza) return ''; const t = v.traza; const parts = [];
    if (t.ratio) parts.push(`ratio ${t.ratio.txt} (${t.ratio.fuente})`);
    if (t.ccl) parts.push(`CCL $ ${fmtARS.format(t.ccl.valor)} ${t.ccl.fuente === 'implicito' ? 'implícito' : t.ccl.fuente}${t.ccl.implicito && t.ccl.fuente !== 'implicito' ? ` · implícito $ ${fmtARS.format(t.ccl.implicito)}` : ''}${t.ccl.mercado && t.ccl.fuente !== 'mercado' ? ` · mercado $ ${fmtARS.format(t.ccl.mercado)}` : ''}`);
    if (t.ny) parts.push(`NY ${fmtU(t.ny.precio)} (${t.ny.gap >= 0 ? '+' : ''}${(t.ny.gap * 100).toFixed(1)} %)`);
    if (t.spy) parts.push(`SPY ${t.spy.valor ? fmtU(t.spy.valor) : 's/d'} ${t.spy.fuente === 'vivo' ? 'en vivo' : t.spy.fuente === 'dia' ? 'del día' : `cierre${t.spy.fecha ? ' ' + D.fmt(t.spy.fecha) : ''}`}`);
    return `${parts.join(' · ')}${t.en ? ` · guardada ${new Date(t.en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}`;
  },
};
function formOp(pre = {}) {
  const k = E.cartera(); const mios = k.posiciones.map(p => p.ticker);
  const editando = !!pre.id; const tipo = pre.tipo || 'compra';
  const modo = pre.modo || (editando ? 'usd' : (state.settings.modoOp || 'cedear'));
  const ced = pre.ticker ? Cedears.de(pre.ticker) : null;
  const body = `<div class="form-grid">
    <div class="full">${F.choice('o-tipo', [['compra', 'Compra'], ['venta', 'Venta'], ['dividendo', 'Dividendo']], tipo)}</div>
    ${F.field('Ticker', `${mios.length ? `<div class="chips" style="margin-bottom:6px">${mios.map(t => `<button type="button" data-act="pick-ticker" data-id="${esc(t)}" class="${t === pre.ticker ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>` : ''}
      <input type="hidden" id="o-tk" value="${esc(pre.ticker || '')}">
      <input class="input" id="o-ticker" value="${esc(ced ? `${ced.code} · ${ced.nombre}` : (pre.ticker || ''))}" placeholder="Buscá entre los ${Cedears.lista().length} CEDEARs: MELI, Apple, Nvidia…" autocomplete="off" autocapitalize="characters" ${pre.ticker ? '' : 'autofocus'}>
      <div class="sug-list" id="o-sug"></div>
      <div class="small muted" id="o-info" style="margin-top:4px">${formOpInfo(pre.ticker)}</div>`, '', 'full')}
    <div class="full" id="o-modo-box" ${tipo === 'dividendo' ? 'hidden' : ''}>${F.field('Cómo lo cargás', F.choice('o-modo', [['cedear', 'CEDEARs en pesos'], ['usd', 'Acciones en USD']], modo), 'En pesos: cantidad de CEDEARs y precio en $; la app convierte con el ratio y el CCL.')}</div>
    <div id="o-campos" class="full form-grid" style="padding:0">${formOpCampos(tipo, modo, pre)}</div>
    <div class="full callout" id="o-calc" style="padding:8px 12px;font-size:13px"></div>
    ${(k.caja || 0) + (pre.deCaja || 0) > 0.005 ? `<div class="full" id="o-dediv-box" ${tipo === 'compra' ? '' : 'hidden'}><label class="switch"><input type="checkbox" id="o-de-div" ${pre.deCaja > 0 ? 'checked' : ''}><span>Pagada con la caja <small class="muted">(dividendos y ventas: tenés ${fmtU((k.caja || 0) + (pre.deCaja || 0), 2)})</small></span></label></div>` : ''}
    <div class="full" id="o-acaja-box" ${tipo === 'venta' ? '' : 'hidden'}><label class="switch"><input type="checkbox" id="o-a-caja" ${editando ? (pre.aCaja ? 'checked' : '') : 'checked'}><span>El cobro queda en caja <small class="muted">(para pagar compras futuras)</small></span></label></div>
    ${F.field('Fecha', `<div class="row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn sm" data-act="set-date-op" data-id="hoy">Hoy</button><button type="button" class="btn sm" data-act="set-date-op" data-id="ayer">Ayer</button>${F.input('o-fecha', pre.fecha || D.today(), 'type="date"')}</div>`, pre.legado ? '⚠️ Fecha estimada (posición previa cargada el 3-4/1/26). Poné la fecha real de compra para afinar la comparación contra el S&P.' : '', 'full')}
    ${F.field('Nota', F.input('o-nota', pre.nota || '', 'placeholder="opcional"'), '', 'full')}
    ${editando && pre.verif ? `<div class="full small muted traza"><b class="${pre.verif.nivel === 'ok' ? 'up' : 'warn-text'}">${pre.verif.nivel === 'ok' ? '✓ verificada' : pre.verif.nivel === 'block' ? '✕ guardada con errores' : '⚠ con advertencias'}</b> · ${esc(Verif.trazaTxt(pre.verif))}</div>` : ''}
  </div>`;
  Modal.open({ title: editando ? 'Editar operación' : 'Operación de cartera', body, submit: editando ? 'Guardar cambios' : 'Guardar', extra: editando ? `<button type="button" class="btn danger" data-act="del-op-modal" data-id="${pre.id}">Borrar</button>` : '', onSubmit: () => {
    const tipo = Modal.choice('o-tipo') || 'compra';
    const ticker = formOpTicker(); if (!ticker) { toast('Falta el ticker'); return false; }
    const fRaw = Modal.val('o-fecha') || D.today(); const fH = D.habil(fRaw);
    const o = { id: pre.id || uid(), tipo, ticker, fecha: fH, nota: Modal.val('o-nota').trim() };
    if (fH !== fRaw) setTimeout(() => toast(`Fecha movida al día hábil anterior: ${D.fmt(fH, { year: true })}`, 3500), 400);
    if (pre.origen) o.origen = pre.origen;
    if (pre.legado && o.fecha === pre.fecha) o.legado = true;  // sigue sin fecha real
    const spy = state.cartera.precios.SPY; const spyDelDia = spy && spy.c && spy.t && D.iso(new Date(spy.t)) === D.today() && (!spy.pc || Math.abs(spy.c / spy.pc - 1) < 0.07);
    if (spyDelDia && o.fecha === D.habil(D.today())) o.spy = spy.c; else if (pre.spy && o.fecha === pre.fecha) o.spy = pre.spy;
    if (tipo === 'dividendo') { o.monto = M.parse(Modal.val('o-monto')); if (!o.monto) { toast('Falta el monto del dividendo'); return false; } }
    else {
      // compra pagada con dividendos: consume la caja de dividendos (el dividendo sigue contando como ganancia; la caja baja para no contar dos veces)
      const deDiv = tipo === 'compra' && $('#o-de-div') && $('#o-de-div').checked;
      const modo = Modal.choice('o-modo') || 'usd'; if (!editando) state.settings.modoOp = modo;
      if (modo === 'cedear') {
        const c = formOpCedear(ticker); const ced = M.parse(Modal.val('o-ced')), px = M.parse(Modal.val('o-pxars')), ccl = M.parse(Modal.val('o-ccl'));
        if (!c) { toast('No conozco el ratio de ese CEDEAR: cargalo en el campo Ratio o usá "Acciones en USD"'); return false; }
        if (!ced || !px || !ccl) { toast('Faltan cantidad, precio o CCL'); return false; }
        Object.assign(o, { modo: 'cedear', cedears: ced, precioCedear: px, ccl, ratio: Cedears.ratioTxt(c), acciones: Cedears.aAcciones(ced, c), precio: Cedears.precioUSD(px, c, ccl), montoARS: ced * px });
      } else { o.modo = 'usd'; o.acciones = M.parse(Modal.val('o-acc')); o.precio = M.parse(Modal.val('o-precio')); if (!o.acciones || !o.precio) { toast('Faltan acciones o precio'); return false; } }
      if (deDiv) o.deCaja = Math.round(Math.min((k.caja || 0) + (pre.deCaja || 0), o.acciones * o.precio) * 100) / 100;
      if (tipo === 'venta' && $('#o-a-caja') && $('#o-a-caja').checked) o.aCaja = true;
    }
    // control de calidad: contrasta precio, CCL, ratio, SPY, fecha, duplicados y tenencia; lo rojo bloquea salvo que lo confirmes
    const ev = Verif.evaluar(Verif.candidata(pre), k); const force = $('#o-force') && $('#o-force').checked;
    if (ev.nivel === 'block' && !force) { toast('Hay puntos en rojo: revisalos o marcá "Lo revisé, guardar igual"', 4000); const box = $('#o-calc'); if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
    o.verif = { nivel: ev.nivel, items: ev.items.filter(i => i.nivel !== 'ok' && i.nivel !== 'info').map(i => i.txt), traza: ev.traza, forzada: ev.nivel === 'block' && force ? true : undefined };
    const ops = state.cartera.operaciones; const idx = ops.findIndex(x => x.id === o.id);
    if (idx >= 0) ops[idx] = o; else ops.push(o);
    if (tipo !== 'dividendo' && !state.cartera.precios[ticker]) state.cartera.precios[ticker] = { c: o.precio, dp: 0, t: 0, estimado: true };
    Persist.save(); toast(editando ? 'Operación actualizada' : `${tipo === 'compra' ? 'Compra' : tipo === 'venta' ? 'Venta' : 'Dividendo'} de ${ticker} registrada`); if (ui.view !== 'cartera') ui.view = 'cartera'; render();
  } });
  const refresh = () => { const t = Modal.choice('o-tipo') || 'compra'; const m = Modal.choice('o-modo') || 'usd'; const box = $('#o-campos'); const mb = $('#o-modo-box'); if (mb) mb.hidden = t === 'dividendo'; const dd = $('#o-dediv-box'); if (dd) dd.hidden = t !== 'compra'; const ac = $('#o-acaja-box'); if (ac) ac.hidden = t !== 'venta'; if (box) box.innerHTML = formOpCampos(t, m, { ticker: formOpTicker() }); formOpCalc(); formOpCclInfo(); };
  $('#modal').onchange = e => { if (e.target.closest('#o-tipo') || e.target.closest('#o-modo')) refresh(); else formOpCalc(); };
  $('#modal').oninput = e => {
    if (e.target.id === 'o-ticker') { const q = e.target.value.trim(); $('#o-tk').value = q.toUpperCase().replace(/[^A-Z0-9.\-]/g, ''); const res = Cedears.buscar(q); const sug = $('#o-sug'); sug.innerHTML = res.map(c => `<button type="button" data-act="pick-ced" data-id="${esc(c.code)}"><b>${esc(c.code)}</b><span>${esc(c.nombre)}</span><i>${Cedears.ratioTxt(c)}</i></button>`).join(''); $('#o-info').innerHTML = formOpInfo(formOpTicker()); formOpCalc(); return; }
    if (e.target.id === 'o-ccl') { const el = $('#o-ccl'); if (el) { el.dataset.manual = '1'; el.dataset.fuente = 'manual'; } }
    formOpCalc();
  };
  formOpCalc._pre = pre; formOpCalc(); formOpCclFresh();
}
/** CCL fresco al abrir el form (dolarapi, ≤10 min) + precio del subyacente en vivo para el CCL implícito */
async function formOpCclFresh() {
  const r = await TC.ccl(10);
  const el = $('#o-ccl'); if (el && r && r.ccl && !el.dataset.manual && !el.value) { el.value = r.ccl; el.dataset.fuente = 'mercado'; }
  if (el && r && r.ccl && !el.dataset.manual && Number(el.value) !== r.ccl && !r.cache) { el.value = r.ccl; el.dataset.fuente = 'mercado'; }
  formOpCclInfo(); formOpCalc();
  const t = formOpTicker(); if (t && (Modal.choice('o-modo') || 'usd') === 'cedear') { const pr = state.cartera.precios[t]; if (!pr || !pr.t || Date.now() - pr.t > 10 * 60000) { await Precios.quote(t); formOpCclInfo(); } }
  const sp = state.cartera.precios.SPY; if (!sp || !sp.t || Date.now() - sp.t > 10 * 60000) await Precios.quote('SPY');  // SPY en vivo: la sombra compra al precio del momento
}
function formOpCclInfo() {
  const box = $('#o-ccl-info'); if (!box) return;
  const s = state.settings; const t = formOpTicker(); const c = formOpCedear(t); const pr = t ? state.cartera.precios[t] : null;
  const hora = s.cclHora ? new Date(s.cclHora) : null; const edad = hora ? Math.round((Date.now() - hora.getTime()) / 60000) : null;
  const px = M.parse(Modal.val('o-pxars'));
  let imp = null; if (c && pr && pr.c && px) imp = px * c.ratio[0] / c.ratio[1] / pr.c;
  box.innerHTML = `<span>Mercado: <b>$ ${s.ccl ? fmtARS.format(s.ccl) : 's/d'}</b>${edad != null ? ` <small class="muted">(${edad < 1 ? 'recién' : edad < 60 ? `hace ${edad} min` : edad < 1440 ? `hace ${Math.round(edad / 60)} h` : D.fmt(D.iso(hora))})</small>` : ''} <button type="button" class="btn ghost sm" data-act="op-ccl-usar" data-id="${s.ccl || ''}|mercado" style="padding:2px 8px;min-height:26px">usar</button></span>`
    + (imp ? `<span>Implícito en tu compra: <b>$ ${fmtARS.format(imp)}</b> <small class="muted">(${esc(t)} a ${fmtU(pr.c)} ${pr.t ? 'ahora' : 'estimado'})</small> <button type="button" class="btn ghost sm" data-act="op-ccl-usar" data-id="${Math.round(imp)}|implicito" style="padding:2px 8px;min-height:26px">usar</button></span>` : (c && px ? `<span class="muted">Implícito: falta el precio en USD de ${esc(t)} (cargá la clave de Finnhub)</span>` : ''));
}
/** ticker interno (US) elegido en el form de operación */
function formOpTicker() { const el = $('#o-tk'); return el ? el.value.trim().toUpperCase() : ''; }
function formOpCedear(ticker) { const c = Cedears.de(ticker); if (c) return c; const r = $('#o-ratio'); if (r) { const m = String(r.value).match(/(\d+)\s*:\s*(\d+)/); if (m) return { code: ticker, nombre: ticker, ratio: [Number(m[1]), Number(m[2])], manual: true }; } return null; }
function formOpInfo(ticker) {
  if (!ticker) return 'Elegí de tus posiciones o escribí para buscar.';
  const c = Cedears.de(ticker); const p = E.cartera().posiciones.find(x => x.ticker === ticker);
  return `${c ? `<b>${esc(c.code)}</b> · ${esc(c.nombre)} · ratio <b>${Cedears.ratioTxt(c)}</b> (${c.ratio[0]} CEDEAR${c.ratio[0] > 1 ? 's' : ''} = ${c.ratio[1]} acción${c.ratio[1] > 1 ? 'es' : ''})` : `<b>${esc(ticker)}</b> · no está en la tabla de CEDEARs de BYMA`}${p ? ` · tenés ${fmtAcc(p.acciones)} acc (PPC ${fmtU(p.ppc)})` : ''}`;
}
function formOpCampos(tipo, modo, pre = {}) {
  if (tipo === 'dividendo') return F.field('Monto cobrado (USD)', F.input('o-monto', pre.monto || '', 'inputmode="decimal" placeholder="0,00"'), 'Neto, lo que entró en la cuenta.', 'full');
  const p = pre.ticker ? E.cartera().posiciones.find(x => x.ticker === pre.ticker) : null; const c = pre.ticker ? Cedears.de(pre.ticker) : null;
  if (modo === 'cedear') {
    const ccl = pre.ccl || Number(state.settings.ccl) || Number(state.settings.tc) || '';
    return F.field('Cantidad de CEDEARs', F.input('o-ced', pre.cedears || '', 'inputmode="numeric" placeholder="4"'), tipo === 'venta' && p && c ? `Tenés ~${fmtAcc(Cedears.aCedears(p.acciones, c))} CEDEARs` : '')
      + F.field('Precio por CEDEAR ($)', F.input('o-pxars', pre.precioCedear || '', 'inputmode="decimal" placeholder="15.250"'), 'Lo que pagaste/cobraste por cada uno en pesos')
      + F.field('Dólar CCL de la operación', F.input('o-ccl', ccl, 'inputmode="decimal"') + `<div class="ccl-info" id="o-ccl-info"></div>`, 'Se usa para pasar tu precio en pesos a dólares. El de mercado se refresca solo; el implícito sale de tu precio y del precio en USD del subyacente ahora.')
      + (pre.ticker && !c ? F.field('Ratio del CEDEAR', F.input('o-ratio', '', 'placeholder="24:1"'), 'No está en la tabla BYMA: cargalo a mano (N CEDEARs : M acciones)') : '');
  }
  return F.field('Acciones', F.input('o-acc', pre.acciones || '', 'inputmode="decimal" placeholder="0,5"'), tipo === 'venta' && p ? `Tenés ${fmtAcc(p.acciones)}` : 'Fracciones con coma: 0,508')
    + F.field('Precio por acción (USD)', F.input('o-precio', pre.precio || (p && p.precio ? String(p.precio).replace('.', ',') : ''), 'inputmode="decimal" placeholder="0,00"'), tipo === 'venta' && p ? `PPC ${fmtU(p.ppc)}` : '');
}
function formOpCalc() {
  const box = $('#o-calc'); if (!box) return;
  const tipo = Modal.choice('o-tipo') || 'compra'; const ticker = formOpTicker(); const modo = Modal.choice('o-modo') || 'usd';
  if (!ticker) { box.hidden = true; return; }
  const c = formOpCedear(ticker); const ccl = M.parse(Modal.val('o-ccl')) || Number(state.settings.ccl) || Number(state.settings.tc) || 0;
  let html = '';
  if (tipo === 'dividendo') html = '';
  else if (modo === 'cedear') {
    const ced = M.parse(Modal.val('o-ced')), px = M.parse(Modal.val('o-pxars'));
    if (!c) html = 'Cargá el ratio para poder convertir.';
    else if (ced && px && ccl) { const acc = Cedears.aAcciones(ced, c); const pu = Cedears.precioUSD(px, c, ccl); html = `= <b>${fmtAcc(acc)} acciones</b> de ${esc(ticker)} · <b>${fmtU(pu)}</b> por acción · total <b>${fmtU(acc * pu)}</b> (${M.f(ced * px, { cur: 'ARS' })} al CCL $ ${fmtARS.format(ccl)})`; }
    else html = 'Completá cantidad y precio para ver el equivalente en acciones y dólares.';
    formOpCclInfo();
  } else {
    const acc = M.parse(Modal.val('o-acc')), pu = M.parse(Modal.val('o-precio'));
    if (acc && pu) html = `= total <b>${fmtU(acc * pu)}</b>${c && ccl ? ` · equivale a <b>${fmtAcc(Cedears.aCedears(acc, c))} CEDEARs</b> a ~$ ${fmtARS.format(pu * ccl * c.ratio[1] / c.ratio[0])} c/u al CCL` : ''}`;
    else html = 'Completá acciones y precio.';
  }
  let ver = '', nivel = 'ok'; try { const k = E.cartera(); const o = Verif.candidata(formOpCalc._pre || {}); const ev = Verif.evaluar(o, k); ver = Verif.html(ev); nivel = ev.nivel; } catch (err) { ver = ''; }
  box.hidden = false; box.innerHTML = html + ver; box.classList.toggle('crit', nivel === 'block'); box.classList.toggle('amber', nivel === 'warn');
}
function formPosicion(ticker) {
  const k = E.cartera(); const p = k.posiciones.find(x => x.ticker === ticker) || k.watch.find(x => x.ticker === ticker); if (!p) return;
  const ops = k.ops.filter(o => o.ticker === ticker).slice().reverse();
  const al = p.alerta || {};
  const body = `<div class="stack">
    ${p.cedear ? `<div class="small muted">CEDEAR <b>${esc(p.cedear.code)}</b> · ratio ${Cedears.ratioTxt(p.cedear)}${p.acciones ? ` · tenés ~<b>${fmtAcc(Cedears.aCedears(p.acciones, p.cedear))} CEDEARs</b>` : ''}${p.lotes && p.lotes.length ? ` · ${p.lotes.length} lote${p.lotes.length > 1 ? 's' : ''} abierto${p.lotes.length > 1 ? 's' : ''} (FIFO)` : ''}</div>` : ''}
    ${p.acciones ? `<div class="sim-result">
      <div class="box"><div class="l">Tenés</div><div class="v">${fmtAcc(p.acciones)} acc</div></div>
      <div class="box"><div class="l">PPC</div><div class="v">${fmtU(p.ppc)}</div></div>
      <div class="box"><div class="l">Precio hoy</div><div class="v">${p.precio != null ? fmtU(p.precio) : '—'}</div></div>
      <div class="box"><div class="l">Valor</div><div class="v">${fmtU(p.valor != null ? p.valor : p.costo, 0)}</div></div>
      <div class="box"><div class="l">Resultado total</div><div class="v ${p.gpTotal > 0 ? 'up' : p.gpTotal < 0 ? 'down' : ''}">${p.gpTotal != null ? (p.gpTotal >= 0 ? '+' : '−') + fmtU(Math.abs(p.gpTotal), 0) : '—'}</div><div class="l">${p.rendTotal != null ? pctS(p.rendTotal) : ''}${p.dividendos && p.rendPrecio != null ? ` = precio ${pctS(p.rendPrecio)} + div ${pctS(p.rendDiv)}` : ''}${p.realizado ? ` · realizado ${p.realizado >= 0 ? '+' : '−'}${fmtU(Math.abs(p.realizado), 0)}` : ''}</div></div>
      <div class="box"><div class="l">vs S&P 500</div><div class="v ${p.alfaUSD > 0 ? 'up' : p.alfaUSD < 0 ? 'down' : ''}">${p.alfaUSD != null ? (p.alfaUSD >= 0 ? '+' : '−') + fmtU(Math.abs(p.alfaUSD), 0) : '—'}</div><div class="l">${p.alfaUSD != null ? 'mismas compras en SPY' : ''}</div></div>
    </div>` : `<div class="callout">Watchlist: no tenés ${esc(ticker)}, solo lo vigilás.${p.precio != null ? ` Hoy ${fmtU(p.precio)}.` : ''}</div>`}
    ${p.objetivo ? `<div class="small"><b>Precio objetivo:</b> ${fmtU(p.objetivo)}${p.upside != null ? ` (${pctS(p.upside)} desde hoy)` : ''}</div>` : ''}
    ${al.nota ? `<div class="callout" style="font-size:13px"><b>Tesis / nota:</b> ${esc(al.nota)}</div>` : ''}
    <div class="form-grid"><div class="full"><div class="eyebrow" style="margin-bottom:6px">Alertas y objetivo (USD)</div></div>
      ${F.field('🟡 Che, mirala ≤', F.input('a-mirala', al.mirala || '', 'inputmode="decimal" placeholder="0"'))}
      ${F.field('🔴 Comprá urgente ≤', F.input('a-urgente', al.urgente || '', 'inputmode="decimal" placeholder="0"'))}
      ${F.field('Precio objetivo 12 m', F.input('a-objetivo', al.objetivo || '', 'inputmode="decimal" placeholder="opcional"'))}
      ${F.field('Tesis / nota', F.input('a-nota', al.nota || '', 'placeholder="por qué la tenés, qué mirar"'))}
    </div>
    <div class="row" style="gap:8px"><button type="button" class="btn sm primary" data-act="op-para" data-id="${esc(ticker)}|compra">${ICONS.plus} Comprar</button>${p.acciones ? `<button type="button" class="btn sm" data-act="op-para" data-id="${esc(ticker)}|venta">Vender</button><button type="button" class="btn sm" data-act="op-para" data-id="${esc(ticker)}|dividendo">Dividendo</button>` : ''}${p.alerta ? `<button type="button" class="btn sm danger" data-act="del-alerta" data-id="${esc(ticker)}">Quitar alerta</button>` : ''}</div>
    ${ops.length ? `<div><div class="eyebrow" style="margin:6px 0">Operaciones <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">(tocá para editar)</span></div>${ops.map(o => `<div class="list-item op-row" data-act="edit-op" data-id="${o.id}" style="cursor:pointer"><div style="min-width:0"><b style="font-weight:500">${o.tipo === 'compra' ? 'Compra' : o.tipo === 'venta' ? 'Venta' : 'Dividendo'}</b>${o.legado ? ' <span class="tag" style="color:var(--warn-text)">fecha estimada</span>' : ''}<span class="sub small muted">${D.fmt(o.fecha, { year: true })}${o.tipo !== 'dividendo' ? ` · ${fmtAcc(o.acciones)} × ${fmtU(o.precio)}` : ''}</span></div><span class="mono op-amt">${fmtU(o.tipo === 'dividendo' ? Number(o.monto) || 0 : (Number(o.acciones) || 0) * (Number(o.precio) || 0), 2)}</span></div>`).join('')}</div>` : ''}
  </div>`;
  Modal.open({ title: ticker, body, submit: 'Guardar', onSubmit: () => {
    const mirala = M.parse(Modal.val('a-mirala')), urgente = M.parse(Modal.val('a-urgente')), objetivo = M.parse(Modal.val('a-objetivo')), nota = Modal.val('a-nota').trim();
    if (!mirala && !urgente && !objetivo && !nota) { delete state.cartera.alertas[ticker]; } else state.cartera.alertas[ticker] = { mirala: mirala || null, urgente: urgente || null, objetivo: objetivo || null, nota: nota || null };
    Persist.save(); toast('Guardado'); render();
  } });
}
function formWatch() {
  Modal.open({ title: 'Vigilar un ticker', body: `<div class="form-grid">${F.field('Ticker', F.input('w-ticker', '', 'placeholder="TSM" autofocus autocapitalize="characters" style="text-transform:uppercase"'), 'Sin tenerlo: solo para que la app y el bot te avisen.', 'full')}${F.field('🟡 Che, mirala ≤ (USD)', F.input('w-mirala', '', 'inputmode="decimal"'))}${F.field('🔴 Comprá urgente ≤ (USD)', F.input('w-urgente', '', 'inputmode="decimal"'))}</div>`, submit: 'Guardar', onSubmit: () => {
    const t = Modal.val('w-ticker').trim().toUpperCase(); const mirala = M.parse(Modal.val('w-mirala')), urgente = M.parse(Modal.val('w-urgente'));
    if (!t || (!mirala && !urgente)) { toast('Ticker y al menos un nivel'); return false; }
    state.cartera.alertas[t] = { mirala: mirala || null, urgente: urgente || null }; Persist.save(); render();
  } });
}

/* ---------- intercambio con Claude: exportar cartera / cargar actualizaciones ---------- */
const Intercambio = {
  FORMATO: 'gestor-gastos-cambios', VERSION: 1,
  nombreArchivo() { return `cartera-${D.today()}.md`; },
  /** Markdown legible (tablas) + bloque JSON exacto + instrucciones y esquema de respuesta */
  exportar() {
    const k = E.cartera(); const s = state.settings; const hoy = D.today(); const hora = new Date();
    const n = v => v == null ? '' : Number(v).toFixed(2); const pct = v => v == null ? '' : (v * 100).toFixed(1) + ' %';
    const pctO = v => v == null ? 's/d' : pct(v);
    const rend = (v, nombre) => v.disponible ? `- **${nombre}** (desde ${v.desde}, ${v.dias} días): cartera con dividendos ${pctO(v.rend.realDiv)} · precio contra precio: cartera ${pctO(v.rend.real)} · sombra S&P 500 ${pctO(v.rend.sombra)} · alfa ${v.rend.alfa != null ? (v.rend.alfa * 100).toFixed(1) + ' pp' : 's/d'}${v.rend.alfaUSD != null ? ` (${v.rend.alfaUSD >= 0 ? '+' : ''}${n(v.rend.alfaUSD)} USD)` : ''} · TIR anual ${pctO(v.rend.tirReal)} vs sombra ${pctO(v.rend.tirSombra)} · TWR ${pctO(v.rend.twr)} vs SPY solo ${pctO(v.rend.spyDirecto)}` : `- **${nombre}**: no disponible`;
    const rendJSON = v => v.disponible ? { desde: v.desde, dias: v.dias, metodoAcumulado: v.rend.metodo, carteraConDividendos: { acumulado: v.rend.realDiv, tirAnual: v.rend.tirRealDiv, dividendosUSD: +v.rend.dividendosVentana.toFixed(2) }, acumulado: { cartera: v.rend.real, sombraSP500: v.rend.sombra, sp500Directo: v.rend.spyDirecto, alfaPP: v.rend.alfa, alfaUSD: v.rend.alfaUSD != null ? +v.rend.alfaUSD.toFixed(2) : null }, tirAnual: { cartera: v.rend.tirReal, sombraSP500: v.rend.tirSombra, sp500Directo: v.rend.tirSpy }, twr: { cartera: v.rend.twr, sombraSP500: v.rend.spyDirecto, sp500Directo: v.rend.spyDirecto }, nota: v.nota || null } : null;
    const posRows = k.posiciones.map(p => `| ${p.ticker} | ${p.cedear ? `${p.cedear.code} ${Cedears.ratioTxt(p.cedear)}` : ''} | ${fmtAcc(p.acciones)} | ${n(p.ppc)} | ${n(p.precio)} | ${n(p.valor)} | ${pct(p.rendTotal)}${p.dividendos ? ` (precio ${pct(p.rendPrecio)} + div ${n(p.dividendos)} USD)` : ''} | ${pct(p.peso)} | ${p.alfaUSD != null ? n(p.alfaUSD) : ''} | ${p.alerta && p.alerta.mirala ? n(p.alerta.mirala) : ''} | ${p.alerta && p.alerta.urgente ? n(p.alerta.urgente) : ''} | ${p.objetivo ? n(p.objetivo) : ''} | ${p.alerta && p.alerta.nota ? p.alerta.nota.replace(/\|/g, '/') : ''} |`).join('\n');
    const watchRows = k.watch.map(p => `| ${p.ticker} | ${p.cedear ? `${p.cedear.code} ${Cedears.ratioTxt(p.cedear)}` : ''} | ${n(p.precio)} | ${p.alerta && p.alerta.mirala ? n(p.alerta.mirala) : ''} | ${p.alerta && p.alerta.urgente ? n(p.alerta.urgente) : ''} | ${p.objetivo ? n(p.objetivo) : ''} | ${p.alerta && p.alerta.nota ? p.alerta.nota.replace(/\|/g, '/') : ''} |`).join('\n');
    const cerrRows = k.cerradas.map(p => `| ${p.ticker} | ${n(p.realizado)} | ${n(p.dividendos)} | ${p.alfaUSD != null ? n(p.alfaUSD) : ''} |`).join('\n');
    const ops = k.ops.slice().reverse().slice(0, 40).map(o => `| ${o.fecha} | ${o.tipo} | ${o.ticker} | ${o.tipo === 'dividendo' ? '' : fmtAcc(o.acciones)} | ${o.tipo === 'dividendo' ? n(o.monto) : n(o.precio)} | ${o.modo === 'cedear' ? `${o.cedears} CEDEARs a $${fmtARS.format(o.precioCedear)} (CCL ${fmtARS.format(o.ccl)})` : ''}${o.legado ? 'fecha estimada' : ''} |`).join('\n');
    const json = {
      tipo: 'gestor-gastos-cartera', version: Intercambio.VERSION, generado: hora.toISOString(), app: BUILD,
      dolar: { mep: k.mep, ccl: k.ccl, spy: k.spyHoy, preciosAl: k.preciosFecha },
      resumen: { valorUSD: k.valor, valorTotalUSD: k.valorTotal != null ? +k.valorTotal.toFixed(2) : null, costoUSD: k.costo, gpUSD: k.gp, gpPct: k.gpPct, dividendosUSD: k.dividendos, realizadoUSD: k.realizado, resultadoTotalUSD: k.gpTotal != null ? +k.gpTotal.toFixed(2) : null, rendTotalSobreCosto: k.rendTotal, posiciones: k.posiciones.length },
      rendimiento: Object.fromEntries(E.VENTANAS.map(([m, l]) => [m, Object.assign({ rango: l }, rendJSON(k.ventanas[m]) || { disponible: false })])),
      posiciones: k.posiciones.map(p => ({ ticker: p.ticker, cedear: p.cedear ? p.cedear.code : null, ratio: p.cedear ? Cedears.ratioTxt(p.cedear) : null, acciones: +p.acciones.toFixed(6), ppc: +p.ppc.toFixed(2), precio: p.precio, valor: p.valor != null ? +p.valor.toFixed(2) : null, gpPct: p.gpPct, rendTotal: p.rendTotal, rendPrecio: p.rendPrecio, rendDividendos: p.rendDiv, peso: p.peso, alfaUSD: p.alfaUSD != null ? +p.alfaUSD.toFixed(2) : null, dividendosUSD: +p.dividendos.toFixed(2), lotes: (p.lotes || []).map(l => ({ fecha: l.fecha, acciones: +l.q.toFixed(6), precio: +l.px.toFixed(2) })), alerta: p.alerta || null })),
      watchlist: k.watch.map(p => ({ ticker: p.ticker, precio: p.precio, alerta: p.alerta })),
      cerradas: k.cerradas.map(p => ({ ticker: p.ticker, realizadoUSD: +p.realizado.toFixed(2), dividendosUSD: +p.dividendos.toFixed(2), alfaUSD: p.alfaUSD != null ? +p.alfaUSD.toFixed(2) : null })),
    };
    const md = `# Cartera de ${esc(s.nombre || 'mi cartera')} — exportada el ${D.fmt(hoy, { year: true })} ${pad2(hora.getHours())}:${pad2(hora.getMinutes())}

App "Gestor de gastos" v${BUILD}. Precios al ${k.preciosFecha ? new Date(k.preciosFecha).toLocaleString('es-AR') : 's/d'} · MEP $ ${fmtARS.format(k.mep)} · CCL $ ${fmtARS.format(k.ccl)} · SPY ${n(k.spyHoy)}.

## Resumen
- Valor: **US$ ${n(k.valor)}** · costo (lotes FIFO) US$ ${n(k.costo)} · resultado no realizado ${k.gp != null ? (k.gp >= 0 ? '+' : '') + n(k.gp) : 's/d'} USD (${pct(k.gpPct)}) · **resultado total** (precio + dividendos + realizado) ${k.gpTotal != null ? (k.gpTotal >= 0 ? '+' : '') + n(k.gpTotal) : 's/d'} USD · rendimiento total sobre el costo de lo que tenés ${pct(k.rendTotal)} · valor total (acciones + caja US$ ${n(k.caja)}: dividendos + ventas a caja − compras pagadas con la caja) US$ ${n(k.valorTotal)}
- Dividendos cobrados US$ ${n(k.dividendos)} · resultado realizado (posiciones cerradas) US$ ${n(k.realizado)}
${E.VENTANAS.map(([m, l]) => rend(k.ventanas[m], l === 'Todo' ? 'Todo (desde la primera operación)' : l)).join('\n')}
- "Sombra S&P 500" = las mismas compras/ventas hechas en SPY el mismo día. La comparación es precio contra precio: no cuentan dividendos, ni los propios ni los del S&P. Alfa = cartera − sombra. Acumulado y TIR son money-weighted (TIR anual = tasa por año); TWR es time-weighted (GIPS), aproximado entre valuaciones guardadas. Rdo total por posición = (precio hoy − PPC + dividendos cobrados) / costo.

## Posiciones (${k.posiciones.length})
| Ticker | CEDEAR (ratio) | Acciones | PPC | Precio | Valor | Rdo total % (precio + dividendos) | Peso | Alfa vs SPY (USD) | 🟡 mirala ≤ | 🔴 urgente ≤ | Objetivo | Tesis / nota |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${posRows}

## Watchlist (alertas sin posición) (${k.watch.length})
| Ticker | CEDEAR (ratio) | Precio | 🟡 mirala ≤ | 🔴 urgente ≤ | Objetivo | Nota |
|---|---|---|---|---|---|---|
${watchRows || '| — | | | | | | |'}

## Posiciones cerradas
| Ticker | Realizado USD | Dividendos | Alfa vs SPY |
|---|---|---|---|
${cerrRows || '| — | | | |'}

## Últimas operaciones (${Math.min(40, k.ops.length)} de ${k.ops.length})
| Fecha | Tipo | Ticker | Acciones | Precio USD (o monto) | Detalle |
|---|---|---|---|---|---|
${ops}

## Datos exactos (JSON)
\`\`\`json
${JSON.stringify(json, null, 1)}
\`\`\`

## Instrucciones para Claude
Sos mi asesor de inversiones (perfil: largo plazo, value/growth de calidad, Buffett y Lynch, objetivo: ganarle al S&P 500). Con los datos de arriba:
1. Analizá la cartera: concentración y pesos, calidad de cada tesis, qué posiciones aportan alfa y cuáles lo destruyen, riesgos, qué falta y qué sobra. Sé directo y objetivo.
2. Revisá las alertas: proponé niveles **🟡 mirala** (zona de acumulación razonable) y **🔴 comprá urgente** (descuento profundo, margen de seguridad) en **USD del subyacente**, y un **precio objetivo a 12 meses** por ticker, con una línea de tesis. Podés agregar tickers a la watchlist (CEDEARs disponibles en BYMA) o quitar los que no tengan sentido.
3. Al final de tu respuesta, devolvé **un solo bloque \`\`\`json** con este formato exacto para que la app lo importe (solo los tickers que cambian; \`null\` en un ticker lo saca de las alertas/watchlist; los campos que no mandás no se tocan):
\`\`\`json
{ "tipo": "${Intercambio.FORMATO}", "version": ${Intercambio.VERSION}, "fecha": "${hoy}",
  "alertas": {
    "MELI": { "mirala": 1750, "urgente": 1600, "objetivo": 2300, "nota": "líder e-commerce/fintech LatAm; comprar en caídas" },
    "TSM": null
  },
  "comentario": "resumen en una línea de lo que cambiaste y por qué" }
\`\`\`
Reglas: tickers en formato de EE.UU. (BRK-B, no BRKB); niveles y objetivos en USD por acción del subyacente; no inventes precios, si te falta un dato decilo. Si cambiás niveles, recordame pedirte en el chat del proyecto que actualices la tarea programada de alertas con los nuevos valores.
`;
    return md;
  },
  /** extrae el JSON de cambios de un texto pegado (bloque \`\`\`json o primer objeto {...}) */
  parsear(texto) {
    if (!texto) throw new Error('No hay nada para cargar.');
    let t = String(texto);
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/g);
    const candidatos = fence ? fence.map(f => f.replace(/```(?:json)?/g, '').trim()) : [];
    candidatos.push(t.trim());
    // último recurso: primer objeto balanceado
    const i = t.indexOf('{'); if (i >= 0) { let d = 0; for (let j = i; j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}') { d--; if (d === 0) { candidatos.push(t.slice(i, j + 1)); break; } } } }
    let obj = null, err = null;
    for (const c of candidatos) { try { const o = JSON.parse(c); if (o && typeof o === 'object' && (o.alertas || o.tipo === Intercambio.FORMATO)) { obj = o; break; } } catch (e) { err = e; } }
    if (!obj) throw new Error('No encontré un bloque JSON válido con "alertas". ' + (err ? 'Error: ' + err.message : ''));
    if (obj.tipo && obj.tipo !== Intercambio.FORMATO) throw new Error(`El archivo es de tipo "${obj.tipo}", esperaba "${Intercambio.FORMATO}".`);
    return obj;
  },
  /** diff contra las alertas actuales */
  diff(obj) {
    const cur = state.cartera.alertas; const k = E.cartera(); const tengo = new Set(k.posiciones.map(p => p.ticker));
    const cambios = [], avisos = [];
    for (const [tk0, v] of Object.entries(obj.alertas || {})) {
      const tk = String(tk0).toUpperCase().trim(); const ced = Cedears.de(tk); const ticker = ced ? Cedears.ticker(ced) : tk;
      if (!ced && !tengo.has(ticker)) avisos.push(`${ticker}: no está en la tabla de CEDEARs de BYMA (se carga igual).`);
      const antes = cur[ticker] || null;
      if (v === null) { if (antes) cambios.push({ ticker, tipo: 'quitar', antes }); continue; }
      if (typeof v !== 'object') { avisos.push(`${ticker}: valor inválido, se ignora.`); continue; }
      const num = x => x == null || x === '' ? null : (Number(x) || null);
      const despues = { mirala: 'mirala' in v ? num(v.mirala) : (antes ? antes.mirala : null), urgente: 'urgente' in v ? num(v.urgente) : (antes ? antes.urgente : null), objetivo: 'objetivo' in v ? num(v.objetivo) : (antes ? antes.objetivo : null), nota: 'nota' in v ? (v.nota ? String(v.nota).slice(0, 300) : null) : (antes ? antes.nota : null) };
      if (despues.mirala && despues.urgente && despues.urgente > despues.mirala) avisos.push(`${ticker}: "urgente" (${despues.urgente}) es mayor que "mirala" (${despues.mirala}); revisalo.`);
      const igual = antes && ['mirala', 'urgente', 'objetivo', 'nota'].every(f => (antes[f] || null) === (despues[f] || null));
      if (!igual) cambios.push({ ticker, tipo: antes ? 'cambiar' : (tengo.has(ticker) ? 'nueva' : 'watchlist'), antes, despues });
    }
    return { cambios, avisos, comentario: obj.comentario || '' };
  },
  aplicar(d) {
    for (const c of d.cambios) { if (c.tipo === 'quitar') delete state.cartera.alertas[c.ticker]; else state.cartera.alertas[c.ticker] = c.despues; }
    Persist.save();
  },
};
function formExportar() {
  const md = Intercambio.exportar(); const nombre = Intercambio.nombreArchivo();
  const puedeCompartir = !!(navigator.share);
  Modal.open({ title: 'Exportar para Claude', submit: '', body: `<div class="stack">
    <p class="small muted">Un archivo con tu cartera, rendimiento vs S&P 500, alertas, watchlist y operaciones, más las instrucciones para que Claude lo analice y te devuelva un bloque de cambios que la app puede importar.</p>
    <div class="row" style="gap:8px">${puedeCompartir ? `<button type="button" class="btn primary" data-act="export-share">Compartir archivo</button>` : ''}<button type="button" class="btn ${puedeCompartir ? '' : 'primary'}" data-act="export-copy">Copiar texto</button></div>
    <p class="small muted">Pegalo en un chat del proyecto <b>Inversiones</b> (o adjuntá el archivo). Cuando Claude responda, copiá su bloque JSON y usá "Cargar actualizaciones".</p>
    <textarea class="input textarea" id="export-md" readonly style="min-height:200px">${esc(md)}</textarea>
  </div>` });
}
function formImportar() {
  Modal.open({ title: 'Cargar actualizaciones de Claude', submit: 'Analizar', body: `<div class="stack">
    <p class="small muted">Pegá la respuesta de Claude (o solo su bloque JSON). Vas a ver qué cambia antes de aplicar nada.</p>
    <textarea class="input textarea" id="import-txt" placeholder='{ "tipo": "gestor-gastos-cambios", ... }' style="min-height:160px" autofocus></textarea>
    <label class="btn sm" style="width:fit-content">Elegir archivo… <input type="file" id="import-file" accept=".json,.md,.txt" hidden></label>
    <div id="import-out"></div>
  </div>`, onSubmit: () => {
    // segundo toque del botón del pie: ya analizado → aplicar (el pie siempre está a la vista, sin scrollear la lista)
    if (Intercambio._pendiente && Intercambio._pendiente.txt === $('#import-txt').value) { Actions['import-apply'](); return false; }
    Intercambio._pendiente = null;
    try {
      const obj = Intercambio.parsear($('#import-txt').value); const d = Intercambio.diff(obj); d.txt = $('#import-txt').value;
      const out = $('#import-out');
      if (!d.cambios.length) { out.innerHTML = `<div class="callout">Sin cambios respecto de lo que ya tenés.${d.avisos.length ? '<br>' + d.avisos.map(esc).join('<br>') : ''}</div>`; return false; }
      Intercambio._pendiente = d;
      const fmt = a => a ? `🟡 ${a.mirala ?? '—'} · 🔴 ${a.urgente ?? '—'}${a.objetivo ? ` · obj ${a.objetivo}` : ''}${a.nota ? ` · “${esc(a.nota)}”` : ''}` : '—';
      out.innerHTML = `<div class="stack">${d.comentario ? `<div class="callout" style="font-size:13px"><b>Claude:</b> ${esc(d.comentario)}</div>` : ''}
        ${d.cambios.map(c => `<div class="list-item" style="align-items:flex-start"><div><b>${esc(c.ticker)}</b> <span class="tag">${c.tipo === 'quitar' ? 'quitar' : c.tipo === 'cambiar' ? 'cambia' : c.tipo === 'nueva' ? 'nueva alerta' : 'a watchlist'}</span>${c.tipo !== 'quitar' ? `<span class="sub small">${fmt(c.despues)}</span>` : ''}${c.antes ? `<span class="sub small muted">antes: ${fmt(c.antes)}</span>` : ''}</div></div>`).join('')}
        ${d.avisos.length ? `<div class="callout amber small">${d.avisos.map(esc).join('<br>')}</div>` : ''}
        <button type="button" class="btn primary" data-act="import-apply">Aplicar ${d.cambios.length} cambio${d.cambios.length > 1 ? 's' : ''}</button></div>`;
      const sb = $('#modal [data-act="submit"]'); if (sb) sb.textContent = `Aplicar ${d.cambios.length} cambio${d.cambios.length > 1 ? 's' : ''}`;
      const cnt = $('#import-out'); if (cnt) cnt.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return false;
    } catch (e) { $('#import-out').innerHTML = `<div class="callout crit small">${esc(e.message)}</div>`; return false; }
  } });
  $('#modal').onchange = e => { if (e.target.id === 'import-file' && e.target.files[0]) { const fr = new FileReader(); fr.onload = () => { $('#import-txt').value = fr.result; }; fr.readAsText(e.target.files[0]); } };
}
