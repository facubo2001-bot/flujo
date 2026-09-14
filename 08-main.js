/* ===================== FLUJO — main: render, navigation, events ===================== */

function applyTheme() { /* estética OLED: un solo tema, negro puro */ document.documentElement.setAttribute('data-theme', 'dark'); }

function renderNav() {
  const btn = (v, cls) => `<button class="${cls} ${ui.view === v.id ? 'active' : ''}" data-go="${v.id}">${ICONS[v.id]}<span>${cls === 'nav-btn' ? v.label : v.short}</span></button>`;
  $('#rail-nav').innerHTML = VIEWS.map(v => btn(v, 'nav-btn')).join('');
  $('#tabbar').innerHTML = VIEWS.filter(v => v.id !== 'config').slice(0, 5).map(v => btn(v, '')).join('') + btn(VIEWS.find(v => v.id === 'config'), '');
}

function renderTopbar() {
  const [t, sub] = VIEW_TITLES[ui.view]; const withMonth = ['resumen', 'movimientos', 'tarjetas', 'plan', 'tendencias'].includes(ui.view);
  return `<div class="topbar"><div class="title"><h1>${t}</h1><small>${sub}${state.settings.nombre && ui.view === 'resumen' ? ` · ${esc(state.settings.nombre)}` : ''}</small></div><div class="tools">
    ${withMonth ? `<div class="month-nav"><button data-mes="-1" aria-label="Mes anterior">‹</button><span class="label" data-mes="0" title="Ir al mes actual">${D.monthName(ui.mes)}</span><button data-mes="1" aria-label="Mes siguiente">›</button></div>` : ''}
    <div class="seg" id="cur-seg">${['ARS', 'USD'].map(c => `<button class="${ui.cur === c ? 'on' : ''}" data-cur="${c}">${c === 'ARS' ? '$ ARS' : 'US$'}</button>`).join('')}</div>
    <button class="btn primary" data-act="new" style="display:none" id="btn-new-desktop">${ICONS.plus} Gasto</button>
  </div></div>`;
}

let lastView = null;
function render() {
  const viewChanged = lastView !== ui.view; lastView = ui.view;
  const scroller = window.innerWidth <= 900 ? $('.main') : null; const keepY = viewChanged ? 0 : (scroller ? scroller.scrollTop : window.scrollY);
  E.build(); ChartQ.reset(); renderNav();
  const fns = { resumen: viewResumen, movimientos: viewMovimientos, cuotas: viewCuotas, tarjetas: viewTarjetas, cartera: viewCartera, plan: viewPlan, tendencias: viewTendencias, config: viewConfig };
  let body = '';
  try { body = fns[ui.view](); } catch (e) { console.error(e); body = `<div class="card"><div class="empty">Algo falló al dibujar esta vista: ${esc(e.message)}. <button class="btn sm" data-act="reload">Recargar</button></div></div>`; }
  $('#view').innerHTML = renderTopbar() + `<div class="${viewChanged ? 'fade' : 'nofade'}">${body}</div>`;
  if (window.innerWidth > 900) $('#btn-new-desktop').style.display = '';
  ChartQ.mount();
  try { sessionStorage.setItem('flujo.ui', JSON.stringify({ view: ui.view, mes: ui.mes, cur: ui.cur })); } catch (e) {}
  if (scroller) scroller.scrollTop = keepY; else window.scrollTo({ top: keepY });
}
function go(view) { ui.view = view; render(); }

/* ---------- actions ---------- */
const Actions = {
  new() { formMov(); },
  edit(id) { const m = state.movimientos.find(m => m.id === id); if (m) formMov(m); },
  dup(id) { const m = state.movimientos.find(m => m.id === id); if (m) formMov(m, { dup: true }); },
  del(id) { const m = state.movimientos.find(m => m.id === id); if (!m) return; const idx = state.movimientos.indexOf(m); state.movimientos.splice(idx, 1); Persist.save(); render(); toast(`Borrado: ${m.desc}`, 6000, { label: 'Deshacer', fn: () => { state.movimientos.splice(Math.min(idx, state.movimientos.length), 0, m); Persist.save(); render(); toast('Restaurado'); } }); },
  'del-from-modal'(id) { Modal.close(); Actions.del(id); },
  confirmar(id) { const m = E.data().movs.find(m => m.id === id); if (m) formMov(m); },
  'new-rec'() { formRec(); },
  'edit-rec'(id) { const r = state.recurrentes.find(r => r.id === id); if (r) formRec(r); },
  'toggle-rec'(id) { const r = state.recurrentes.find(r => r.id === id); if (r) { r.activo = r.activo === false; Persist.save(); render(); } },
  'del-rec'(id) { const r = state.recurrentes.find(r => r.id === id); if (!r) return; confirmar(`¿Borrar el gasto fijo "${r.desc}"? Los meses ya confirmados quedan como gastos normales.`, () => { state.recurrentes = state.recurrentes.filter(x => x.id !== id); state.movimientos.forEach(m => { if (m.recId === id) { delete m.recId; delete m.mesRec; } }); Persist.save(); render(); }); },
  'rec-from'(id) { const m = state.movimientos.find(m => m.id === id); if (m) formRec(null, m); },
  detectar() { go('cuotas'); },
  'new-card'() { formCard(); },
  'edit-card'(id) { const t = L.tarjeta(id); if (t) formCard(t); },
  'del-card'(id) { const t = L.tarjeta(id); if (!t) return; const n = state.movimientos.filter(m => m.tarjetaId === id).length; confirmar(`¿Borrar ${t.nombre}? ${n ? n + ' movimientos quedan sin tarjeta asignada.' : ''}`, () => { state.tarjetas = state.tarjetas.filter(x => x.id !== id); Persist.save(); render(); }); },
  'new-cuenta'() { formCuenta(); },
  'edit-cuenta'(id) { const c = L.cuenta(id); if (c) formCuenta(c); },
  'del-cuenta'(id) { confirmar('¿Borrar esta cuenta?', () => { state.cuentas = state.cuentas.filter(x => x.id !== id); Persist.save(); render(); }); },
  'new-inv'() { formInv(); },
  'del-inv'(id) { state.inversiones = state.inversiones.filter(x => x.id !== id); Persist.save(); render(); },
  'new-ing'() { formIng(); },
  'del-ing'(id) { state.ingresos = state.ingresos.filter(x => x.id !== id); Persist.save(); render(); },
  'new-cat'() { formCat(); },
  'edit-cat'(id) { const c = state.categorias.find(c => c.id === id); if (c) formCat(c); },
  'del-cat'(id) { state.categorias = state.categorias.filter(c => c.id !== id); Persist.save(); render(); },
  'clear-filters'() { ui.filtros = {}; render(); },
  simular() {
    const monto = M.parse($('#sim-monto').value); const cuotas = clamp(Number($('#sim-cuotas').value) || 1, 1, 60); const tarjetaId = $('#sim-tarjeta').value || undefined; const desde = $('#sim-mes').value || D.thisMonth();
    if (!monto) { toast('Ingresá un monto'); return; }
    const res = E.simular({ monto, moneda: 'ARS', cuotas, tarjetaId, desde });
    $('#sim-out').innerHTML = renderSimulacion(res, monto);
  },
  'tc-update'() { TC.actualizar(false); },
  async 'gist-connect'() {
    const token = ($('#g-token') && $('#g-token').value || '').trim(); if (!token) { toast('Pegá el token primero'); return; }
    toast('Conectando con GitHub…');
    try { await Gist.conectar(token); const ch = await Gist.refrescar(true); if (!ch) { Persist.schedule(500); } toast('Sincronización conectada'); lastView = null; render(); }
    catch (e) { toast((e && e.message) || 'No se pudo conectar', 5000); }
  },
  'gist-off'() { Gist.clear(); Persist.setStatus(state.movimientos.length ? 'local' : 'idle'); toast('Sincronización desconectada en este dispositivo'); render(); },
  async 'gist-pull'() { const ch = await Gist.refrescar(true); toast(ch ? 'Datos actualizados' : 'Ya estabas al día'); if (ch) { lastView = null; render(); } },
  'cierre-ok'(v) { const [tid, ym, fecha] = v.split('|'); const t = L.tarjeta(tid); if (!t) return; t.cierres = t.cierres || {}; t.cierres[ym] = fecha; Persist.save(); toast(`${t.nombre}: cierre ${D.fmt(fecha)} confirmado`); render(); },
  'cierre-later'() { ui.cierreDismiss = true; render(); },
  'cierre-edit'(v) {
    const [tid, ym, est] = v.split('|'); const t = L.tarjeta(tid); if (!t) return;
    Modal.open({ title: `Cierre de ${t.nombre}`, body: `<div class="form-grid">${F.field('Fecha de cierre de este período', F.input('cc-fecha', est, 'type="date"'), 'La encontrás en la app del banco, en "próximo cierre"')}</div>`, submit: 'Guardar', onSubmit: () => { const f = Modal.val('cc-fecha'); if (!f) return false; t.cierres = t.cierres || {}; t.cierres[D.ym(f)] = f; Persist.save(); render(); } });
  },
  'switch-inv'() { formInv(); },
  'switch-op'() { formOp(); },
  'new-op'() { formOp(); },
  'op-para'(v) { const [t, tipo] = v.split('|'); formOp({ ticker: t, tipo }); },
  'pick-ticker'(t) { const el = $('#o-ticker'); if (el) { el.value = t; const box = $('#o-campos'); if (box) box.innerHTML = formOpCampos(Modal.choice('o-tipo') || 'compra', { ticker: t }); } $$('#modal [data-act="pick-ticker"]').forEach(b => b.classList.toggle('on', b.dataset.id === t)); },
  'set-date-op'(v) { const f = $('#o-fecha'); if (f) f.value = v === 'hoy' ? D.today() : D.addDays(D.today(), -1); },
  'del-op'(id) { const o = state.cartera.operaciones.find(x => x.id === id); if (!o) return; confirmar(`¿Borrar ${o.tipo} de ${o.ticker} del ${D.fmt(o.fecha, { year: true })}?`, () => { state.cartera.operaciones = state.cartera.operaciones.filter(x => x.id !== id); Persist.save(); render(); }); },
  'del-op-modal'(id) { state.cartera.operaciones = state.cartera.operaciones.filter(x => x.id !== id); Persist.save(); Modal.close(); render(); toast('Operación borrada'); },
  pos(t) { formPosicion(t); },
  'new-watch'() { formWatch(); },
  'del-alerta'(t) { delete state.cartera.alertas[t]; Persist.save(); Modal.close(); render(); toast(`Alerta de ${t} quitada`); },
  'precios-update'() { toast('Buscando precios…'); Precios.actualizar(false); },
  'go-config'() { go('config'); },
  'switch-gasto'() { formMov(); },
  'pick-destino'(d) { const el = $('#i-destino'); if (el) el.value = d; },
  'set-date-inv'(v) { const f = $('#i-fecha'); if (f) f.value = v === 'hoy' ? D.today() : D.addDays(D.today(), -1); },
  'set-date'(v) { const f = $('#f-fecha'); if (f) { f.value = v === 'hoy' ? D.today() : D.addDays(D.today(), -1); f.dispatchEvent(new Event('change', { bubbles: true })); } },
  'pick-cat'(id) { const s = $('#f-cat'); if (s) { s.value = id; s.dataset.touched = '1'; $$('#f-catchips button').forEach(b => b.classList.toggle('on', b.dataset.id === id)); } },
  close() { Modal.close(); },
  submit() { Modal.submit(); },
  reload() { location.reload(); },
  demo() { confirmar('Se van a cargar 5 meses de datos inventados (reemplazan lo que haya). Después podés borrar todo desde Configuración.', () => { cargarDemo(); ui.mes = D.thisMonth(); Persist.save(); toast('Datos de ejemplo cargados'); go('resumen'); }, 'Cargar ejemplo'); },
  reset() { confirmar('¿Borrar absolutamente todo? No se puede deshacer (exportá un respaldo antes).', () => { state = defaultState(); Persist.save(); render(); }); },
  onboard() {
    const ing = M.parse($('#ob-ingreso').value); state.settings.ingreso = ing; state.settings.tc = M.parse($('#ob-tc').value) || state.settings.tc; state.settings.presupuesto = M.parse($('#ob-pres').value) || Math.round(ing * 0.6);
    const t1 = $('#ob-t1').value.trim(), t2 = $('#ob-t2').value.trim();
    if (t1) state.tarjetas.push({ id: uid(), nombre: t1, cierre: Number($('#ob-t1c').value) || 20, vencimiento: Number($('#ob-t1v').value) || 5, color: CARD_COLORS[0] });
    if (t2) state.tarjetas.push({ id: uid(), nombre: t2, cierre: Number($('#ob-t2c').value) || 22, vencimiento: Number($('#ob-t2v').value) || 8, color: CARD_COLORS[1] });
    if (!ing && !t1) { toast('Cargá al menos tu sueldo'); return; }
    Persist.save(); toast('Listo. Cargá tu primer gasto con el +'); render();
  },
  async export() {
    const json = JSON.stringify(state, null, 1); const filename = `gastos-${D.today()}.json`;
    let dl = null; try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) {}
    if (dl) { try { await dl.save({ filename, data: json }); toast('Respaldo guardado'); return; } catch (e) { if (e && e.code === 'unavailable') dl = null; else { toast('No se guardó el respaldo'); return; } } }
    if (!window.claude && navigator.canShare) { try { const file = new File([json], filename, { type: 'application/json' }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Respaldo Gestor de gastos' }); state.settings.lastBackup = D.today(); Persist.save(); toast('Respaldo compartido'); return; } } catch (e) { if (e && e.name === 'AbortError') return; } }
    if (!window.claude) { const blob = new Blob([json], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); state.settings.lastBackup = D.today(); Persist.save(); return; }
    Modal.open({ title: 'Respaldo', body: `<p class="small muted" style="margin-bottom:8px">Copiá este texto y guardalo en un archivo .json:</p><textarea class="input textarea" style="min-height:300px" readonly>${esc(json)}</textarea>`, submit: '' });
  },
  'copiar-resumen'() { const txt = Insights.resumenTexto(ui.mes); const done = () => toast('Resumen copiado. Pegalo en el chat.'); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => Actions.mostrarTexto(txt)); else Actions.mostrarTexto(txt); },
  mostrarTexto(txt) { Modal.open({ title: 'Resumen para Claude', body: `<textarea class="input textarea" style="min-height:300px" readonly>${esc(txt)}</textarea>`, submit: '' }); },
};

/* ---------- global events ---------- */
document.addEventListener('click', e => {
  const go_ = e.target.closest('[data-go]'); if (go_) { e.preventDefault(); go(go_.dataset.go); return; }
  const mes = e.target.closest('[data-mes]'); if (mes) { const n = Number(mes.dataset.mes); ui.mes = n === 0 ? D.thisMonth() : D.addMonths(ui.mes, n); lastView = null; render(); return; }
  const cur = e.target.closest('[data-cur]'); if (cur) { ui.cur = cur.dataset.cur; render(); return; }
  const th = e.target.closest('th[data-sort]'); if (th) { const k = th.dataset.sort; if (ui.sort.key === k) ui.sort.dir *= -1; else ui.sort = { key: k, dir: k === 'monto' || k === 'fecha' ? -1 : 1 }; render(); return; }
  const rg = e.target.closest('[data-range]'); if (rg) { ui.trendRange = Number(rg.dataset.range); render(); return; }
  if (e.target.closest('#fab')) { if (ui.view === 'cartera') formOp(); else formMov(); return; }
  const ta = e.target.closest('tr[data-alerta]'); if (ta && !e.target.closest('button')) { formPosicion(ta.dataset.alerta); return; }
  if (e.target.id === 'overlay') { Modal.close(); return; }
  const act = e.target.closest('[data-act]'); if (act) { e.preventDefault(); const fn = Actions[act.dataset.act]; if (fn) fn(act.dataset.id); return; }
  const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('button,select,input,a,label')) { const id = tr.dataset.id; if (id.startsWith('v:')) Actions.confirmar(id); else Actions.edit(id.split('#')[0]); return; }
  const trr = e.target.closest('tr[data-rec]'); if (trr && !e.target.closest('button,select,input,a,label')) { Actions['edit-rec'](trr.dataset.rec); return; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.filter) { ui.filtros[t.dataset.filter] = t.value; render(); const again = $(`[data-filter="${t.dataset.filter}"]`); if (again && t.dataset.filter === 'q') { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } return; }
  if (t.dataset.setting) { const k = t.dataset.setting; const v = ['ingreso', 'tc', 'presupuesto', 'ccl'].includes(k) ? M.parse(t.value) : ['diaCobro', 'alertaCuotasPct'].includes(k) ? Number(t.value) || 0 : t.value.trim(); state.settings[k] = v; Persist.save(); if (k !== 'nombre') render(); return; }
  if (t.dataset.budget) { const c = state.categorias.find(c => c.id === t.dataset.budget); if (c) { c.presupuesto = M.parse(t.value); Persist.save(); render(); } return; }
  if (t.dataset.pago) { const [tarjetaId, mes] = t.dataset.pago.split('|'); let p = state.pagos.find(p => p.tarjetaId === tarjetaId && p.mes === mes); if (!p) { p = { tarjetaId, mes }; state.pagos.push(p); } p.cuentaId = t.value; Persist.save(); render(); return; }
  if (t.dataset.pagado) { const [tarjetaId, mes] = t.dataset.pagado.split('|'); let p = state.pagos.find(p => p.tarjetaId === tarjetaId && p.mes === mes); if (!p) { p = { tarjetaId, mes }; state.pagos.push(p); } p.pagado = t.checked; Persist.save(); render(); return; }
  if (t.id === 'res-card' || t.id === 'res-mes') { ui.resCard = $('#res-card').value; ui.resMes = $('#res-mes').value; $('#res-detalle').innerHTML = renderResumenDetalle(ui.resCard, ui.resMes); return; }
  if (t.id === 'import-file') { const f = t.files[0]; if (!f) return; f.text().then(txt => { try { const j = JSON.parse(txt); if (!j || !j.v) throw new Error(); confirmar(`Importar ${j.movimientos?.length || 0} movimientos y reemplazar los datos actuales?`, () => { state = Persist.migrate(j); Persist.save(); toast('Datos importados'); go('resumen'); }, 'Importar'); } catch (e) { toast('El archivo no es un respaldo válido'); } }); return; }
  if (t.id === 'import-csv') { const f = t.files[0]; if (!f) return; f.text().then(importarCSV); return; }
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset.filter === 'q') { clearTimeout(window._qT); window._qT = setTimeout(() => { ui.filtros.q = t.value; const pos = t.selectionStart; render(); const again = $('[data-filter="q"]'); if (again) { again.focus(); again.setSelectionRange(pos, pos); } }, 250); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#overlay').classList.contains('open')) { Modal.close(); return; }
  if ($('#overlay').classList.contains('open')) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.choice')) { e.preventDefault(); Modal.submit(); } return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'n' || e.key === 'N') formMov();
});
let rzT, lastW = window.innerWidth; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; if (!$('#overlay').classList.contains('open')) render(); }, 250); });
window.addEventListener('beforeunload', () => { if (Persist.dirty) { Persist.local(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && Persist.dirty) { clearTimeout(Persist.timer); Persist.flush(); } else if (!document.hidden && Gist.cfg() && !Persist.dirty) { Gist.refrescar().then(ch => { if (ch && !$('#overlay').classList.contains('open')) { render(); toast('Datos actualizados'); } }); } });

function importarCSV(txt) {
  const lines = txt.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) { toast('CSV vacío'); return; }
  const sep = lines[0].includes(';') ? ';' : ','; const head = lines[0].split(sep).map(h => norm(h));
  const idx = (names) => head.findIndex(h => names.some(n => h.includes(n)));
  const iF = idx(['fecha', 'date']), iD = idx(['desc', 'concepto', 'detalle']), iM = idx(['monto', 'importe', 'amount', 'total']), iC = idx(['categ']), iQ = idx(['cuota']);
  if (iF < 0 || iM < 0) { toast('Necesito al menos columnas fecha y monto'); return; }
  let n = 0;
  for (const l of lines.slice(1)) {
    const c = l.split(sep); let fecha = c[iF]?.trim(); if (!fecha) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fecha)) { const [d, m, y] = fecha.split('/'); fecha = `${y.length === 2 ? '20' + y : y}-${pad2(m)}-${pad2(d)}`; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    const monto = Math.abs(M.parse(c[iM])); if (!monto) continue;
    const desc = (iD >= 0 ? c[iD] : 'Importado').trim(); const s = Smart.suggest(desc);
    let catId = s ? s.catId : 'otros'; if (iC >= 0 && c[iC]) { const found = state.categorias.find(k => norm(k.nombre) === norm(c[iC]) || k.id === norm(c[iC])); if (found) catId = found.id; }
    state.movimientos.push({ id: uid(), fecha, desc, monto, moneda: 'ARS', catId, medio: state.tarjetas.length ? 'tarjeta' : 'debito', tarjetaId: (state.tarjetas[0] || {}).id, necesidad: s ? s.necesidad : 2, cuotas: iQ >= 0 ? Number(c[iQ]) || 1 : 1 }); n++;
  }
  Persist.save(); toast(`${n} movimientos importados`); go('movimientos');
}

/* ---------- boot ---------- */
(async function boot() {
  applyTheme();
  try { const u = JSON.parse(sessionStorage.getItem('flujo.ui') || 'null'); if (u) { ui.view = u.view || ui.view; ui.mes = u.mes || ui.mes; ui.cur = u.cur || ui.cur; } } catch (e) {}
  renderNav(); $('#view').innerHTML = '<div class="empty">Cargando…</div>';
  await Persist.init();
  render();
  if (!window.claude && state.settings.tcFecha !== D.today()) TC.actualizar(true).then(ok => { if (ok) render(); });
  if (!window.claude && (state.settings.finnhubKey || '').trim() && Precios.tickers().length) { const f = state.cartera.preciosFecha ? Date.now() - new Date(state.cartera.preciosFecha).getTime() : Infinity; if (f > 15 * 60 * 1000) Precios.actualizar(true).then(ok => { if (ok && ui.view === 'cartera') render(); }); }
  if (Gist.cfg()) Gist.refrescar(true).then(ch => { if (ch) { lastView = null; render(); toast('Datos actualizados desde tus otros dispositivos'); } });
})();
