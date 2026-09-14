/* ===================== FLUJO — modal & forms ===================== */

const Modal = {
  onSubmit: null,
  open({ title, body, submit = 'Guardar', extra = '', onSubmit, wide = false }) {
    Modal.onSubmit = onSubmit; $('#modal').onchange = null; $('#modal').oninput = null;
    $('#modal').innerHTML = `<div class="grabber"></div><div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" style="border:0" aria-label="Cerrar">${ICONS.x}</button></div><div class="m-body">${body}</div><div class="m-foot">${extra}<div class="right"><button class="btn" data-act="close">Cancelar</button>${submit ? `<button class="btn primary" data-act="submit">${submit}</button>` : ''}</div></div>`;
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
  const tipoBar = isNew && !virtual ? `<div class="seg full" style="width:fit-content;margin:0 auto 4px"><button class="on" type="button">Gasto</button><button type="button" data-act="switch-inv">Aporte</button><button type="button" data-act="switch-op">Cartera</button></div>` : '';
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

/* ---------- inversión / ingreso extra ---------- */
function formInv() {
  const destinos = [...new Set(state.inversiones.slice().sort((p, q) => q.fecha.localeCompare(p.fecha)).map(i => i.destino).filter(Boolean))].slice(0, 6);
  const body = `<div class="form-grid">
    <div class="seg full" style="width:fit-content;margin:0 auto 4px"><button type="button" data-act="switch-gasto">Gasto</button><button class="on" type="button">Aporte</button><button type="button" data-act="switch-op">Cartera</button></div>
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
function formOp(pre = {}) {
  const k = E.cartera(); const tickers = [...new Set([...k.posiciones.map(p => p.ticker), ...k.watch.map(p => p.ticker)])];
  const tipo = pre.tipo || 'compra';
  const body = `<div class="form-grid">
    <div class="seg full" style="width:fit-content;margin:0 auto 4px"><button type="button" data-act="switch-gasto">Gasto</button><button type="button" data-act="switch-inv">Aporte</button><button class="on" type="button">Cartera</button></div>
    <div class="full">${F.choice('o-tipo', [['compra', 'Compra'], ['venta', 'Venta'], ['dividendo', 'Dividendo']], tipo)}</div>
    ${F.field('Ticker', `${tickers.length ? `<div class="chips" style="margin-bottom:6px">${tickers.map(t => `<button type="button" data-act="pick-ticker" data-id="${esc(t)}" class="${t === pre.ticker ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>` : ''}<input class="input" id="o-ticker" value="${esc(pre.ticker || '')}" placeholder="MELI, NVDA, GLD…" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase" ${pre.ticker ? '' : 'autofocus'}>`, 'El ticker de USA (subyacente del CEDEAR), como lo ves en Yahoo/Balanz.', 'full')}
    <div id="o-campos" class="full form-grid" style="padding:0">${formOpCampos(tipo, pre)}</div>
    ${F.field('Fecha', `<div class="row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn sm" data-act="set-date-op" data-id="hoy">Hoy</button><button type="button" class="btn sm" data-act="set-date-op" data-id="ayer">Ayer</button>${F.input('o-fecha', pre.fecha || D.today(), 'type="date"')}</div>`, '', 'full')}
    ${F.field('Nota', F.input('o-nota', pre.nota || '', 'placeholder="opcional"'), '', 'full')}
  </div>`;
  Modal.open({ title: 'Operación de cartera', body, submit: 'Guardar', onSubmit: () => {
    const tipo = Modal.choice('o-tipo') || 'compra'; const ticker = Modal.val('o-ticker').trim().toUpperCase().replace(/\s+/g, '');
    if (!ticker) { toast('Falta el ticker'); return false; }
    const o = { id: uid(), tipo, ticker, fecha: Modal.val('o-fecha') || D.today(), nota: Modal.val('o-nota').trim() };
    if (tipo === 'dividendo') { o.monto = M.parse(Modal.val('o-monto')); if (!o.monto) { toast('Falta el monto del dividendo'); return false; } }
    else { o.acciones = M.parse(Modal.val('o-acc')); o.precio = M.parse(Modal.val('o-precio')); if (!o.acciones || !o.precio) { toast('Faltan acciones o precio'); return false; }
      if (tipo === 'venta') { const p = E.cartera().posiciones.find(x => x.ticker === ticker); if (!p || p.acciones + 1e-6 < o.acciones) { toast(`No tenés ${fmtAcc(o.acciones)} acciones de ${ticker} para vender`); return false; } } }
    state.cartera.operaciones.push(o); if (!state.cartera.precios[ticker] && tipo !== 'dividendo') state.cartera.precios[ticker] = { c: o.precio, dp: 0, t: 0, estimado: true };
    Persist.save(); toast(`${tipo === 'compra' ? 'Compra' : tipo === 'venta' ? 'Venta' : 'Dividendo'} de ${ticker} registrada`); if (ui.view !== 'cartera') ui.view = 'cartera'; render();
  } });
  $('#modal').onchange = e => { if (e.target.closest('#o-tipo')) { const t = Modal.choice('o-tipo'); const box = $('#o-campos'); if (box) box.innerHTML = formOpCampos(t, { ticker: Modal.val('o-ticker') }); } };
}
function formOpCampos(tipo, pre = {}) {
  if (tipo === 'dividendo') return F.field('Monto cobrado (USD)', F.input('o-monto', pre.monto || '', 'inputmode="decimal" placeholder="0,00"'), 'Neto, lo que entró en la cuenta.', 'full');
  const p = pre.ticker ? E.cartera().posiciones.find(x => x.ticker === pre.ticker) : null;
  return F.field('Acciones', F.input('o-acc', pre.acciones || '', 'inputmode="decimal" placeholder="0,5"'), tipo === 'venta' && p ? `Tenés ${fmtAcc(p.acciones)}` : 'Fracciones con coma: 0,508') + F.field('Precio por acción (USD)', F.input('o-precio', pre.precio || (p && p.precio ? String(p.precio).replace('.', ',') : ''), 'inputmode="decimal" placeholder="0,00"'), tipo === 'venta' && p ? `PPC ${fmtU(p.ppc)}` : '');
}
function formPosicion(ticker) {
  const k = E.cartera(); const p = k.posiciones.find(x => x.ticker === ticker) || k.watch.find(x => x.ticker === ticker); if (!p) return;
  const ops = k.ops.filter(o => o.ticker === ticker).slice().reverse();
  const al = p.alerta || {};
  const body = `<div class="stack">
    ${p.acciones ? `<div class="sim-result">
      <div class="box"><div class="l">Tenés</div><div class="v">${fmtAcc(p.acciones)} acc</div></div>
      <div class="box"><div class="l">PPC</div><div class="v">${fmtU(p.ppc)}</div></div>
      <div class="box"><div class="l">Precio hoy</div><div class="v">${p.precio != null ? fmtU(p.precio) : '—'}</div></div>
      <div class="box"><div class="l">Valor</div><div class="v">${fmtU(p.valor != null ? p.valor : p.costo, 0)}</div></div>
      <div class="box"><div class="l">Resultado</div><div class="v ${p.gp > 0 ? 'up' : p.gp < 0 ? 'down' : ''}">${p.gp != null ? (p.gp >= 0 ? '+' : '') + fmtU(p.gp, 0) : '—'}</div><div class="l">${p.gpPct != null ? (p.gp >= 0 ? '+' : '') + M.pct(p.gpPct, 1) : ''}</div></div>
      <div class="box"><div class="l">Peso</div><div class="v">${M.pct(p.peso || 0, 1)}</div></div>
    </div>` : `<div class="callout">Watchlist: no tenés ${esc(ticker)}, solo lo vigilás.${p.precio != null ? ` Hoy ${fmtU(p.precio)}.` : ''}</div>`}
    <div class="form-grid"><div class="full"><div class="eyebrow" style="margin-bottom:6px">Alertas de precio (USD)</div></div>
      ${F.field('🟡 Che, mirala ≤', F.input('a-mirala', al.mirala || '', 'inputmode="decimal" placeholder="0"'))}
      ${F.field('🔴 Comprá urgente ≤', F.input('a-urgente', al.urgente || '', 'inputmode="decimal" placeholder="0"'))}
    </div>
    <div class="row" style="gap:8px"><button type="button" class="btn sm primary" data-act="op-para" data-id="${esc(ticker)}|compra">${ICONS.plus} Comprar</button>${p.acciones ? `<button type="button" class="btn sm" data-act="op-para" data-id="${esc(ticker)}|venta">Vender</button><button type="button" class="btn sm" data-act="op-para" data-id="${esc(ticker)}|dividendo">Dividendo</button>` : ''}${p.alerta ? `<button type="button" class="btn sm danger" data-act="del-alerta" data-id="${esc(ticker)}">Quitar alerta</button>` : ''}</div>
    ${ops.length ? `<div><div class="eyebrow" style="margin:6px 0">Operaciones</div>${ops.map(o => `<div class="list-item"><div><b style="font-weight:500">${o.tipo === 'compra' ? 'Compra' : o.tipo === 'venta' ? 'Venta' : 'Dividendo'}</b><span class="sub small muted">${D.fmt(o.fecha, { year: true })}${o.tipo !== 'dividendo' ? ` · ${fmtAcc(o.acciones)} × ${fmtU(o.precio)}` : ''}</span></div><div class="row" style="gap:4px"><span class="mono">${fmtU(o.tipo === 'dividendo' ? Number(o.monto) || 0 : (Number(o.acciones) || 0) * (Number(o.precio) || 0))}</span><button type="button" class="mini-btn" data-act="del-op-modal" data-id="${o.id}">${ICONS.trash}</button></div></div>`).join('')}</div>` : ''}
  </div>`;
  Modal.open({ title: ticker, body, submit: 'Guardar alertas', onSubmit: () => {
    const mirala = M.parse(Modal.val('a-mirala')), urgente = M.parse(Modal.val('a-urgente'));
    if (!mirala && !urgente) { delete state.cartera.alertas[ticker]; } else state.cartera.alertas[ticker] = { mirala: mirala || null, urgente: urgente || null };
    Persist.save(); toast('Alertas guardadas'); render();
  } });
}
function formWatch() {
  Modal.open({ title: 'Vigilar un ticker', body: `<div class="form-grid">${F.field('Ticker', F.input('w-ticker', '', 'placeholder="TSM" autofocus autocapitalize="characters" style="text-transform:uppercase"'), 'Sin tenerlo: solo para que la app y el bot te avisen.', 'full')}${F.field('🟡 Che, mirala ≤ (USD)', F.input('w-mirala', '', 'inputmode="decimal"'))}${F.field('🔴 Comprá urgente ≤ (USD)', F.input('w-urgente', '', 'inputmode="decimal"'))}</div>`, submit: 'Guardar', onSubmit: () => {
    const t = Modal.val('w-ticker').trim().toUpperCase(); const mirala = M.parse(Modal.val('w-mirala')), urgente = M.parse(Modal.val('w-urgente'));
    if (!t || (!mirala && !urgente)) { toast('Ticker y al menos un nivel'); return false; }
    state.cartera.alertas[t] = { mirala: mirala || null, urgente: urgente || null }; Persist.save(); render();
  } });
}
