/* ===================== FLUJO — core: utils, store, persistence ===================== */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = arr => arr.reduce((a, b) => a + b, 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2 = n => String(n).padStart(2, '0');

/* ---------- dates (all local, ISO strings) ---------- */
const D = {
  today() { const d = new Date(); return D.iso(d); },
  iso(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; },
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); },
  ym(s) { return s.slice(0, 7); },
  ymOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; },
  thisMonth() { return D.ym(D.today()); },
  addMonths(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return D.ymOf(d); },
  diffMonths(a, b) { const [ya, ma] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); },
  daysIn(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); },
  dateIn(ym, day) { return `${ym}-${pad2(Math.min(day, D.daysIn(ym)))}`; },
  addDays(s, n) { const d = D.parse(s); d.setDate(d.getDate() + n); return D.iso(d); },
  daysBetween(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); },
  dow(s) { return D.parse(s).getDay(); },
  monthName(ym, short = false) {
    const [y, m] = ym.split('-').map(Number);
    const names = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const n = names[m - 1];
    return short ? `${n.slice(0, 3)} ${String(y).slice(2)}` : `${n} ${y}`;
  },
  fmt(s, opts = {}) {
    if (!s) return '';
    const d = D.parse(s);
    const names = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    if (opts.long) return `${d.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][d.getMonth()]}`;
    return `${d.getDate()} ${names[d.getMonth()]}${opts.year ? ' ' + String(d.getFullYear()).slice(2) : ''}`;
  },
  range(fromYm, n) { return Array.from({ length: n }, (_, i) => D.addMonths(fromYm, i)); },
  /** Día hábil de mercado (NYSE) más cercano hacia atrás: fines de semana y feriados van al hábil anterior.
      Hasta donde llega el histórico de SPY se usa el calendario real; después, regla de fin de semana + feriados NYSE. */
  habil(fecha) {
    if (!fecha) return fecha;
    const hist = typeof SPY_HIST !== 'undefined' ? SPY_HIST.spy : null;
    if (hist) { const keys = D._spyKeys || (D._spyKeys = Object.keys(hist).sort()); const first = keys[0], last = keys[keys.length - 1];
      if (fecha >= first && fecha <= last) { if (hist[fecha]) return fecha; let lo = 0, hi = keys.length - 1, best = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (keys[m] <= fecha) { best = keys[m]; lo = m + 1; } else hi = m - 1; } return best || fecha; } }
    let f = fecha;
    for (let i = 0; i < 12; i++) { const d = D.dow(f); if (d === 0 || d === 6 || FERIADOS_NYSE.has(f)) f = D.addDays(f, -1); else return f; }
    return f;
  },
};
/** Feriados NYSE (fechas observadas). Ampliar cada año. */
const FERIADOS_NYSE = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
]);

/* ---------- money ---------- */
/** el negativo de toda cifra es el menos tipográfico − (U+2212): mismo ancho que el + en tabular-nums */
const MENOS = t => String(t).replace(/-/g, '\u2212');
const NF = o => { const f = new Intl.NumberFormat('es-AR', o); return { format: v => MENOS(f.format(v)) }; };
const fmtARS = NF({ maximumFractionDigits: 0 });
const fmtUSD = NF({ minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUSD2 = NF({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
const M = {
  tc() { return Number(state.settings.tc) || 1; },
  toARS(monto, moneda) { return moneda === 'USD' ? monto * M.tc() : monto; },
  toUSD(ars) { return ars / M.tc(); },
  /** format an ARS amount in the display currency */
  f(ars, opts = {}) {
    const cur = opts.cur || ui.cur;
    if (cur === 'USD') {
      const v = M.toUSD(ars);
      const s = Math.abs(v) < 100 && !opts.int ? fmtUSD2.format(v) : fmtUSD.format(v);
      return `US$ ${s}`;
    }
    return `$ ${fmtARS.format(Math.round(ars))}`;
  },
  /** compact for tiles: $ 1,2 M / $ 850 k */
  c(ars, opts = {}) {
    const cur = opts.cur || ui.cur;
    if (cur === 'USD') return M.f(ars, opts);
    const a = Math.abs(ars);
    if (a >= 1e6) return `${ars < 0 ? '\u2212' : ''}$ ${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: a >= 1e7 ? 1 : 2 })} M`;
    if (a >= 1e4) return `${ars < 0 ? '\u2212' : ''}$ ${(a / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })} k`;
    return M.f(ars, opts);
  },
  pct(v, d = 0) { return `${MENOS((v * 100).toLocaleString('es-AR', { maximumFractionDigits: d }))} %`; },
  /** original currency formatting for a movement */
  orig(m) { return m.moneda === 'USD' ? `US$ ${fmtUSD2.format(m.monto)}` : `$ ${fmtARS.format(m.monto)}`; },
  parse(str) {
    if (typeof str === 'number') return str;
    let s = String(str || '').replace(/\u2212/g, '-').trim().replace(/[^\d,.\-]/g, '');
    if (!s) return 0;
    // es-AR: 1.234.567,89 ; also accept 1234567.89
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/\.\d{3}$/.test(s)) s = s.replace('.', '');
    return Number(s) || 0;
  },
};

/* ---------- default data ---------- */
const GRUPOS = [
  { id: 'hogar',     nombre: 'Hogar y vivienda',   slot: 1 },
  { id: 'comida',    nombre: 'Comida',             slot: 2 },
  { id: 'auto',      nombre: 'Auto y transporte',  slot: 3 },
  { id: 'servicios', nombre: 'Servicios y subs',   slot: 4 },
  { id: 'ocio',      nombre: 'Ocio y viajes',      slot: 5 },
  { id: 'compras',   nombre: 'Compras',            slot: 6 },
  { id: 'salud',     nombre: 'Salud y educación',  slot: 7 },
  { id: 'otros',     nombre: 'Otros',              slot: 8 },
];
const DEFAULT_CATS = [
  ['alquiler',   'Alquiler / expensas', 'hogar', 'fijo'],
  ['hogar',      'Casa y muebles',      'hogar', 'variable'],
  ['super',      'Supermercado',        'comida', 'variable'],
  ['delivery',   'Delivery y comida afuera', 'comida', 'variable'],
  ['nafta',      'Nafta',               'auto', 'variable'],
  ['auto',       'Auto (seguro, service, patente)', 'auto', 'fijo'],
  ['transporte', 'Transporte público / Uber', 'auto', 'variable'],
  ['servicios',  'Luz, gas, agua, internet, celu', 'servicios', 'fijo'],
  ['subs',       'Suscripciones',       'servicios', 'fijo'],
  ['salidas',    'Salidas y bares',     'ocio', 'variable'],
  ['viajes',     'Viajes',              'ocio', 'variable'],
  ['deporte',    'Deporte y gimnasio',  'salud', 'fijo'],
  ['salud',      'Salud y farmacia',    'salud', 'variable'],
  ['educacion',  'Educación y libros',  'salud', 'variable'],
  ['mascotas',   'Mascotas',            'hogar', 'variable'],
  ['personal',   'Cuidado personal',    'salud', 'variable'],
  ['ropa',       'Ropa y calzado',      'compras', 'variable'],
  ['compras_otros', 'Compras online (ML y otros)', 'compras', 'variable'],
  ['tech',       'Tecnología',          'compras', 'variable'],
  ['regalos',    'Regalos',             'compras', 'variable'],
  ['impuestos',  'Impuestos y bancos',  'otros', 'fijo'],
  ['otros',      'Otros',               'otros', 'variable'],
].map(([id, nombre, grupo, tipo]) => ({ id, nombre, grupo, tipo, presupuesto: 0 }));

const NECESIDAD = { 1: 'Necesario', 2: 'Útil', 3: 'Innecesario' };
const MEDIOS = { tarjeta: 'Tarjeta de crédito', debito: 'Débito', efectivo: 'Efectivo', transferencia: 'Transferencia / MP' };

function defaultState() {
  return {
    v: 1, updatedAt: Date.now(),
    settings: { ingreso: 0, presupuesto: 0, diaCobro: 1, tc: 1300, alertaCuotasPct: 60, nombre: '' },
    tarjetas: [],
    cuentas: [],
    categorias: DEFAULT_CATS.map(c => ({ ...c })),
    movimientos: [],
    recurrentes: [],
    ingresos: [],
    inversiones: [],
    pagos: [],
    sueldos: {},
    presets: [],
    aprendido: {},
    cartera: { operaciones: [], alertas: {}, precios: {}, preciosFecha: null, historial: {}, spy: {}, inicio: null, fund: {} },
  };
}
const BUILD = '__BUILD__';
let state = defaultState();
const ui = { view: 'resumen', mes: D.thisMonth(), cur: 'ARS', sort: { key: 'fecha', dir: -1 }, filtros: {}, trendRange: 6 };

/* ---------- lookups ---------- */
const L = {
  cat(id) { return state.categorias.find(c => c.id === id) || state.categorias[state.categorias.length - 1]; },
  grupo(id) { return GRUPOS.find(g => g.id === id) || GRUPOS[7]; },
  grupoDeCat(catId) { return L.grupo(L.cat(catId).grupo); },
  slotColor(slot) { return slot >= 8 ? 'var(--c-otras)' : `var(--c${slot})`; },
  catColor(catId) { return L.slotColor(L.grupoDeCat(catId).slot); },
  tarjeta(id) { return state.tarjetas.find(t => t.id === id); },
  cuenta(id) { return state.cuentas.find(c => c.id === id); },
};

/* ---------- persistence ---------- */
const LS_KEY = 'flujo.v1';
const Persist = {
  status: 'idle', mode: 'unknown', artifact: undefined, timer: null, dirty: false, lastError: '',
  async init() {
    let candidates = [];
    try { const raw = localStorage.getItem(LS_KEY); if (raw) candidates.push({ src: 'local', data: JSON.parse(raw) }); } catch (e) {}
    try { const emb = JSON.parse($('#flujo-data').textContent); if (emb && emb.v) candidates.push({ src: 'embed', data: emb }); } catch (e) {}
    try {
      const url = new URL('data/flujo.json', location.href).href;
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && j.v) candidates.push({ src: 'cloud', data: j }); }
    } catch (e) {}
    candidates.sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
    if (candidates.length) { state = Persist.migrate(candidates[0].data); Persist.mode = candidates[0].src; }
    Persist.setStatus(candidates.length ? (candidates[0].src === 'local' ? 'local' : 'ok') : 'idle');
    if (Persist.applyPreset()) { state.updatedAt = Date.now(); Persist.local(); Persist.schedule(1500); }
    // resolve capability in background (never block first paint)
    Persist.capPromise = (async () => {
      if (window.claude && typeof window.claude.use === 'function') {
        try { Persist.artifact = await window.claude.use('artifact'); } catch (e) { Persist.artifact = null; }
      } else Persist.artifact = null;
      if (Persist.artifact && candidates.length && candidates[0].src === 'local') Persist.schedule(300); // push local-only edits to cloud
      else if (!Persist.artifact && Persist.status === 'ok') Persist.setStatus('local');
    })();
  },
  /** Merge a data preset embedded by Claude (idempotent: applied once per preset id) */
  applyPreset() {
    let list = null; try { list = JSON.parse($('#flujo-preset').textContent); } catch (e) { return false; }
    if (!list) return false; if (!Array.isArray(list)) list = [list];
    state = Persist.migrate(state);
    let changed = false;
    if (!Array.isArray(state.presets)) state.presets = [];
    for (const p of list) if (p && p.id && !state.presets.includes(p.id)) { Persist.applyOne(p); changed = true; }
    return changed;
  },
  applyOne(p) {
    const byId = arr => new Set(arr.map(x => x.id));
    for (const c of p.categorias || []) if (!byId(state.categorias).has(c.id)) state.categorias.splice(Math.max(0, state.categorias.length - 1), 0, c);
    for (const t of p.tarjetas || []) if (!byId(state.tarjetas).has(t.id) && !state.tarjetas.find(x => norm(x.nombre) === norm(t.nombre))) state.tarjetas.push(t);
    for (const c of p.cuentas || []) if (!byId(state.cuentas).has(c.id) && !state.cuentas.find(x => norm(x.nombre) === norm(c.nombre))) state.cuentas.push(c);
    for (const r of p.recurrentes || []) if (!byId(state.recurrentes).has(r.id)) state.recurrentes.push(r);
    const previos = state.movimientos.slice();
    const dup = (m) => previos.some(x => x.tarjetaId === m.tarjetaId && Math.abs(M.toARS(Number(x.monto) || 0, x.moneda) - M.toARS(Number(m.monto) || 0, m.moneda)) < 1 && Math.abs(D.daysBetween(x.fecha, m.fecha)) <= 4);
    const ids = byId(state.movimientos);
    for (const m of p.movimientos || []) if (!ids.has(m.id) && !dup(m)) state.movimientos.push(m);
    for (const id of p.remove || []) state.movimientos = state.movimientos.filter(x => x.id !== id);
    for (const u of p.updateTarjetas || []) { const t = state.tarjetas.find(x => x.id === u.id); if (t) Object.assign(t, u); }
    for (const u of p.updateRecurrentes || []) { const r = state.recurrentes.find(x => x.id === u.id); if (r) Object.assign(r, u); }
    for (const id of p.removeRecurrentes || []) state.recurrentes = state.recurrentes.filter(x => x.id !== id);
    for (const term of p.scrub || []) { const t = norm(term); state.movimientos = state.movimientos.filter(x => !norm(x.desc).includes(t)); state.recurrentes = state.recurrentes.filter(x => !norm(x.desc).includes(t)); for (const k of Object.keys(state.aprendido)) if (k.includes(t)) delete state.aprendido[k]; }
    for (const g of p.pagos || []) if (!state.pagos.find(x => x.tarjetaId === g.tarjetaId && x.mes === g.mes)) state.pagos.push(g);
    if (p.limpiarInversionesExcepto) { const keep = p.limpiarInversionesExcepto.map(norm); state.inversiones = state.inversiones.filter(i => keep.some(t => norm(i.desc || '').includes(t) || norm(i.destino || '').includes(t))); }
    for (const i of p.inversiones || []) if (!byId(state.inversiones).has(i.id)) state.inversiones.push(i);
    if (p.cartera) {
      const c = state.cartera;
      for (const id of p.cartera.removeInversiones || []) state.inversiones = state.inversiones.filter(x => x.id !== id);
      for (const o of p.cartera.operaciones || []) if (!byId(c.operaciones).has(o.id)) c.operaciones.push(o);
      for (const [t, a] of Object.entries(p.cartera.alertas || {})) if (!c.alertas[t]) c.alertas[t] = a;
      for (const id of p.cartera.removeOperaciones || []) c.operaciones = c.operaciones.filter(x => x.id !== id);
      if (p.cartera.inicio) c.inicio = p.cartera.inicio;
    }
    if (p.settings) for (const [k, v] of Object.entries(p.settings)) if (p.forceSettings || !state.settings[k]) state.settings[k] = v;
    for (const u of p.updates || []) { const m = state.movimientos.find(x => x.id === u.id); if (m) Object.assign(m, u); }
    state.presets.push(p.id);
  },
  migrate(d) {
    const base = defaultState();
    const s = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
    if (!s.categorias || !s.categorias.length) s.categorias = base.categorias;
    for (const k of ['tarjetas','cuentas','movimientos','recurrentes','ingresos','inversiones','pagos']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.aprendido) s.aprendido = {};
    if (!s.sueldos || typeof s.sueldos !== 'object' || Array.isArray(s.sueldos)) s.sueldos = {};
    if (!s.cartera || typeof s.cartera !== 'object') s.cartera = { operaciones: [], alertas: {}, precios: {}, preciosFecha: null };
    for (const k of ['operaciones']) if (!Array.isArray(s.cartera[k])) s.cartera[k] = [];
    for (const k of ['alertas', 'precios', 'historial', 'spy', 'fund']) if (!s.cartera[k] || typeof s.cartera[k] !== 'object') s.cartera[k] = {};
    for (const o of s.cartera.operaciones) if (o && o.fecha) { const h = D.habil(o.fecha); if (h !== o.fecha) o.fecha = h; }
    for (const o of s.cartera.operaciones) if (o && o.deDividendos > 0 && o.deCaja == null) { o.deCaja = o.deDividendos; delete o.deDividendos; }
    if (!Array.isArray(s.presets)) s.presets = [];
    if (!s.settings.presupuesto && s.settings.ingreso) s.settings.presupuesto = Math.max(0, Math.round(s.settings.ingreso * (1 - (Number(s.settings.metaInversionPct) || 0) / 100) - (Number(s.settings.colchon) || 0)));
    for (const c of DEFAULT_CATS) if (!s.categorias.find(k => k.id === c.id)) s.categorias.splice(Math.max(0, s.categorias.length - 1), 0, { ...c });
    return s;
  },
  setStatus(st, msg) {
    Persist.status = st;
    const map = { idle: ['', 'Sin datos guardados'], busy: ['busy', 'Guardando…'], ok: ['ok', Gist.cfg() && !Persist.artifact ? 'Sincronizado con tu GitHub' : 'Guardado en la nube'], local: ['local', 'Guardado en este dispositivo'], err: ['err', msg || 'No se pudo guardar'] };
    const [cls, text] = map[st] || map.idle;
    for (const id of ['#save-state', '#save-state-m']) {
      const el = $(id); if (!el) continue;
      el.querySelector('.save-dot').className = 'save-dot ' + cls;
      const t = el.querySelectorAll('span')[1]; if (t) t.textContent = text;
      el.title = text;
    }
  },
  save() { state.updatedAt = Date.now(); Persist.local(); Persist.schedule(); },
  local() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} },
  schedule(ms = 1800) { Persist.dirty = true; clearTimeout(Persist.timer); Persist.timer = setTimeout(Persist.flush, ms); Persist.setStatus('busy'); },
  async flush() {
    Persist.dirty = false;
    if (Persist.artifact === undefined && Persist.capPromise) await Persist.capPromise;
    if (!Persist.artifact && Gist.cfg()) {
      try { await Gist.push(); Persist.setStatus('ok'); } catch (e) { Persist.setStatus(e && e.status === 401 ? 'err' : 'local', e && e.status === 401 ? 'Token de GitHub inválido' : ''); }
      return;
    }
    if (!Persist.artifact) { Persist.setStatus('local'); return; }
    const json = JSON.stringify(state);
    try {
      await Persist.artifact.publish({ 'data/flujo.json': { content: json, contentType: 'application/json' } });
      Persist.setStatus('ok');
    } catch (e) {
      const code = e && e.code;
      if (code === 'capability_disabled' || code === 'read_only_path' || code === 'capability_removed' || code === 'transform_error') {
        // fallback: republish whole page with embedded data
        try {
          const r = await fetch(location.href, { cache: 'no-store' });
          let html = await r.text();
          const re = /<script type="application\/json" id="flujo-data">[\s\S]*?<\/script>/;
          if (!re.test(html) || !/^\s*<!doctype html>/i.test(html)) throw new Error('no-template');
          html = html.replace(re, `<script type="application/json" id="flujo-data">${json.replace(/<\//g, '<\\/')}<\/script>`);
          sessionStorage.setItem('flujo.ui', JSON.stringify({ view: ui.view, mes: ui.mes, cur: ui.cur }));
          await Persist.artifact.publish(html);
          Persist.setStatus('ok');
        } catch (e2) { Persist.setStatus(e2 && e2.code === 'conflict' ? 'ok' : 'local'); }
      } else if (code === 'conflict') { Persist.setStatus('ok'); }
      else if (code === 'not_granted' || code === 'not_writer' || code === 'not_declared') { Persist.artifact = null; Persist.setStatus('local'); }
      else if (code === 'rate_limited') { Persist.setStatus('busy'); Persist.schedule(15000); }
      else { Persist.lastError = (e && e.message) || String(e); Persist.setStatus('err'); }
    }
  },
};

/* ---------- sincronización vía Gist privado de GitHub (la config vive en ESTE dispositivo) ---------- */
const Gist = {
  FILE: 'gestor-gastos-datos.json', lastPull: 0,
  cfg() { try { return JSON.parse(localStorage.getItem('flujo.gist') || 'null'); } catch (e) { return null; } },
  guardar(c) { try { localStorage.setItem('flujo.gist', JSON.stringify(c)); } catch (e) {} },
  clear() { try { localStorage.removeItem('flujo.gist'); } catch (e) {} },
  hdr(t) { return { 'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json' }; },
  async conectar(token) {
    const r = await fetch('https://api.github.com/gists?per_page=100', { headers: Gist.hdr(token) });
    if (r.status === 401) throw new Error('El token no es válido. Fijate que sea un token clásico con permiso "gist".');
    if (!r.ok) throw new Error('GitHub respondió ' + r.status);
    const list = await r.json();
    let g = Array.isArray(list) ? list.find(x => x.files && x.files[Gist.FILE]) : null;
    if (!g) {
      const c = await fetch('https://api.github.com/gists', { method: 'POST', headers: Gist.hdr(token), body: JSON.stringify({ description: 'Gestor de gastos — datos (privado)', public: false, files: { [Gist.FILE]: { content: JSON.stringify(state) } } }) });
      if (!c.ok) throw new Error('No pude crear el archivo en GitHub (' + c.status + '). ¿El token tiene permiso "gist"?');
      g = await c.json();
    }
    Gist.guardar({ token, id: g.id });
    return g.id;
  },
  async pull() {
    const c = Gist.cfg(); if (!c) return null;
    const r = await fetch('https://api.github.com/gists/' + c.id, { headers: Gist.hdr(c.token), cache: 'no-store' });
    if (!r.ok) { const e = new Error('gist ' + r.status); e.status = r.status; throw e; }
    const g = await r.json(); const f = g.files && g.files[Gist.FILE]; if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) { const rr = await fetch(f.raw_url); content = await rr.text(); }
    return JSON.parse(content);
  },
  async push() {
    const c = Gist.cfg(); if (!c) return false;
    const r = await fetch('https://api.github.com/gists/' + c.id, { method: 'PATCH', headers: Gist.hdr(c.token), body: JSON.stringify({ files: { [Gist.FILE]: { content: JSON.stringify(state) } } }) });
    if (!r.ok) { const e = new Error('gist ' + r.status); e.status = r.status; throw e; }
    return true;
  },
  /** trae del gist si hay algo más nuevo; devuelve true si cambió el estado local */
  async refrescar(force = false) {
    if (!Gist.cfg()) return false;
    if (!force && Date.now() - Gist.lastPull < 60000) return false;
    Gist.lastPull = Date.now();
    try {
      const remote = await Gist.pull();
      if (remote && remote.v && (remote.updatedAt || 0) > (state.updatedAt || 0)) { state = Persist.migrate(remote); if (Persist.applyPreset()) { state.updatedAt = Date.now(); Persist.schedule(1500); } Persist.local(); Persist.setStatus('ok'); return true; }
      if (remote && (state.updatedAt || 0) > (remote.updatedAt || 0)) Persist.schedule(800);
      Persist.setStatus('ok');
    } catch (e) { if (e && e.status === 401) Persist.setStatus('err', 'Token de GitHub inválido'); }
    return false;
  },
};

/* ---------- dólar MEP (dolarapi.com; only works outside the artifact sandbox) ---------- */
const TC = {
  /** CCL fresco (para cargar operaciones): guarda valor + hora; devuelve {ccl, hora} o null */
  async ccl(maxEdadMin = 10) {
    const s = state.settings; const edad = s.cclHora ? (Date.now() - new Date(s.cclHora).getTime()) / 60000 : Infinity;
    if (s.ccl && edad < maxEdadMin) return { ccl: s.ccl, hora: s.cclHora, cache: true };
    try {
      const r = await fetch('https://dolarapi.com/v1/dolares/contadoconliqui', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const j = await r.json(); const v = Number(j.venta) || Number(j.compra); if (!v) throw new Error('sin valor');
      s.ccl = Math.round(v); s.cclFecha = D.today(); s.cclHora = j.fechaActualizacion || new Date().toISOString(); Persist.save();
      return { ccl: s.ccl, hora: s.cclHora, cache: false };
    } catch (e) { return s.ccl ? { ccl: s.ccl, hora: s.cclHora, cache: true, error: true } : null; }
  },
  async actualizar(silencioso = false) {
    try {
      const r = await fetch('https://dolarapi.com/v1/dolares/bolsa', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(); const v = Number(j.venta) || Number(j.compra); if (!v) throw new Error('sin valor');
      state.settings.tc = Math.round(v); state.settings.tcFecha = D.today(); state.settings.tcFuente = 'dolarapi.com (MEP venta)';
      try { const r2 = await fetch('https://dolarapi.com/v1/dolares/contadoconliqui', { cache: 'no-store' }); if (r2.ok) { const j2 = await r2.json(); const v2 = Number(j2.venta) || Number(j2.compra); if (v2) { state.settings.ccl = Math.round(v2); state.settings.cclFecha = D.today(); state.settings.cclHora = j2.fechaActualizacion || new Date().toISOString(); } } } catch (e2) {}
      Persist.save(); if (!silencioso) { toast(`Dólar actualizado · MEP $ ${fmtARS.format(state.settings.tc)}${state.settings.ccl ? ' · CCL $ ' + fmtARS.format(state.settings.ccl) : ''}`); render(); }
      return true;
    } catch (e) {
      if (!silencioso) toast('No se pudo consultar la cotización desde acá (la versión publicada no puede salir a internet). Cargalo a mano o pedímelo en el chat.', 5000);
      return false;
    }
  },
};

/* ---------- CEDEARs (tabla BYMA embebida + copia online en el repo: cedears.json) ---------- */
const Cedears = {
  _src: null, byCode: {}, byUs: {},
  tabla() { try { const r = JSON.parse(localStorage.getItem('flujo.cedears') || 'null'); if (r && r.cedears && r.cedears.length && r.actualizado >= CEDEARS_EMBED.actualizado) return r; } catch (e) {} return CEDEARS_EMBED; },
  lista() { return Cedears.tabla().cedears; },
  actualizado() { return Cedears.tabla().actualizado; },
  index() { const l = Cedears.lista(); if (Cedears._src === l) return; Cedears.byCode = {}; Cedears.byUs = {}; for (const c of l) { Cedears.byCode[c.code] = c; Cedears.byUs[c.us || c.code] = c; } Cedears._src = l; },
  /** entrada de la tabla para un ticker interno (US) o código BYMA */
  de(t) { if (!t) return null; Cedears.index(); return Cedears.byUs[t] || Cedears.byCode[t] || null; },
  ticker(c) { return c.us || c.code; },
  ratioTxt(c) { return `${c.ratio[0]}:${c.ratio[1]}`; },
  /** N CEDEARs = M acciones → acciones = cedears × M / N */
  aAcciones(cedears, c) { return cedears * c.ratio[1] / c.ratio[0]; },
  aCedears(acciones, c) { return acciones * c.ratio[0] / c.ratio[1]; },
  /** precio USD por acción = precio ARS del CEDEAR × N/M ÷ CCL */
  precioUSD(precioARS, c, ccl) { return ccl ? precioARS * c.ratio[0] / c.ratio[1] / ccl : 0; },
  buscar(q, limite = 8) {
    q = norm(q || '').replace(/\s+/g, ''); if (!q) return [];
    const l = Cedears.lista(); const a = [], b = [];
    for (const c of l) { const code = norm(c.code), us = norm(c.us || ''); if (code.startsWith(q) || us.startsWith(q)) a.push(c); else if (norm(c.nombre).replace(/\s+/g, '').includes(q) || code.includes(q)) b.push(c); }
    return a.concat(b).slice(0, limite);
  },
  async actualizar() {
    try { const r = await fetch(`cedears.json?v=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return false; const j = await r.json(); if (j && Array.isArray(j.cedears) && j.actualizado && j.actualizado > Cedears.actualizado()) { localStorage.setItem('flujo.cedears', JSON.stringify(j)); Cedears._src = null; return true; } } catch (e) {}
    return false;
  },
};

/* ---------- SPY histórico (embebido hasta la fecha de build + cierres que la app va guardando) ---------- */
const Spy = {
  _keys: null, _map: null,
  tabla() { const dyn = state.cartera.spy || {}; if (Spy._map && Spy._dyn === dyn && Spy._n === Object.keys(dyn).length) return Spy._map; Spy._map = { ...SPY_HIST.spy, ...dyn }; Spy._keys = Object.keys(Spy._map).sort(); Spy._dyn = dyn; Spy._n = Object.keys(dyn).length; return Spy._map; },
  fechas() { Spy.tabla(); return Spy._keys; },
  /** último cierre conocido ≤ fecha */
  /** Dividendos de SPY (ex-fecha → USD por acción), para que la sombra sea S&P 500 *total return*: se reinvierten al cierre de la ex-fecha */
  divs() { if (!Spy._divs) { const d = typeof SPY_DIVS !== 'undefined' && SPY_DIVS.divs ? SPY_DIVS.divs : {}; Spy._divs = Object.keys(d).sort().map(f => ({ fecha: f, monto: Number(d[f]) || 0 })); } return Spy._divs; },
  /** factor de reinversión de dividendos de SPY para acciones tenidas desde `desde` (exclusive) hasta `hasta` (inclusive): Π (1 + div / cierre ex-fecha) */
  /** Decisión de diseño (sep-2026): la comparación contra el S&P 500 es precio contra precio, sin dividendos de ningún lado → TR apagado (los datos quedan por si algún día se quiere total return) */
  TR: false,
  factor(desde, hasta) { if (!Spy.TR) return 1; let f = 1; for (const d of Spy.divs()) { if (d.fecha <= desde) continue; if (d.fecha > hasta) break; const c = Spy.at(d.fecha); if (c && d.monto) f *= 1 + d.monto / c; } return f; },
  /** fecha del último cierre conocido ≤ fecha (null si no hay) */
  fechaDe(fecha) { const m = Spy.tabla(); if (m[fecha]) return fecha; const k = Spy._keys; let lo = 0, hi = k.length - 1, best = null; while (lo <= hi) { const mid = (lo + hi) >> 1; if (k[mid] <= fecha) { best = k[mid]; lo = mid + 1; } else hi = mid - 1; } return best; },
  at(fecha) { const m = Spy.tabla(); if (m[fecha]) return m[fecha]; const k = Spy._keys; let lo = 0, hi = k.length - 1, best = null; while (lo <= hi) { const mid = (lo + hi) >> 1; if (k[mid] <= fecha) { best = k[mid]; lo = mid + 1; } else hi = mid - 1; } return best ? m[best] : null; },
};

/* ---------- precios de acciones (Finnhub, clave gratuita en Ajustes) ---------- */
const Precios = {
  simbolo(t) { return t.replace('-', '.'); },
  /** una cotización puntual (para el form de operación); devuelve el precio o null */
  async quote(t) {
    const key = (state.settings.finnhubKey || '').trim(); if (!key || !t) return null;
    try { const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(Precios.simbolo(t))}&token=${encodeURIComponent(key)}`, { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); if (!j || !Number(j.c)) return null; state.cartera.precios[t] = { c: Number(j.c), dp: Number(j.dp) || 0, pc: Number(j.pc) || null, t: Date.now() }; return Number(j.c); } catch (e) { return null; }
  },
  tickers() { const k = E.cartera(); const set = new Set(); for (const p of k.posiciones) set.add(p.ticker); for (const t of Object.keys(state.cartera.alertas)) set.add(t); set.add('SPY'); return [...set]; },
  async actualizar(silencioso = false) {
    try { await TC.actualizar(true); } catch (e) {}
    const key = (state.settings.finnhubKey || '').trim();
    if (!key) { if (!silencioso) toast('Cargá tu clave gratuita de Finnhub en Ajustes, sección Cartera, para traer precios.', 5000); return false; }
    const tickers = Precios.tickers(); if (!tickers.length) return false;
    let ok = 0;
    for (const t of tickers) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(Precios.simbolo(t))}&token=${encodeURIComponent(key)}`, { cache: 'no-store' });
        if (r.status === 429) { await new Promise(res => setTimeout(res, 1200)); continue; }
        if (!r.ok) continue;
        const j = await r.json(); if (!j || !Number(j.c)) continue;
        state.cartera.precios[t] = { c: Number(j.c), dp: Number(j.dp) || 0, pc: Number(j.pc) || null, t: Date.now() }; ok++;
      } catch (e) {}
    }
    if (ok) {
      state.cartera.preciosFecha = new Date().toISOString();
      const hoy = D.today(); const spy = state.cartera.precios.SPY;
      if (spy && spy.c && D.habil(hoy) === hoy) state.cartera.spy[hoy] = spy.c;
      if (spy && spy.pc && D.habil(hoy) === hoy) { const ayer = D.habil(D.addDays(hoy, -1)); const m = Spy.tabla(); if (!m[ayer] && Math.abs(spy.c / spy.pc - 1) < 0.07) state.cartera.spy[ayer] = spy.pc; }
      // valuación del día solo si el refresco fue (casi) completo y trajo SPY: un snapshot con precios viejos ensuciaría la serie y el TWR
      try { const k = E.cartera(); if (k.valor != null && spy && spy.c && ok >= Math.ceil(tickers.length * 0.85)) { const h = state.cartera.historial; const vi = k.ventanas.inicio, va = k.ventanas.anio; h[hoy] = { v: Math.round(k.valor * 100) / 100, c: Math.round(k.costo * 100) / 100, s: vi.disponible ? Math.round(vi.sombraValor * 100) / 100 : null, sa: va.disponible ? Math.round(va.sombraValor * 100) / 100 : null, spy: k.spyHoy, mep: k.mep, ccl: k.ccl }; const ks = Object.keys(h).sort(); if (ks.length > 1500) for (const old of ks.slice(0, ks.length - 1500)) delete h[old]; } } catch (e) {}
      Persist.save();
    }
    if (!silencioso) { toast(ok ? `Precios actualizados (${ok}/${tickers.length})` : 'No pude traer precios. Revisá la clave de Finnhub o la conexión.', 3500); render(); }
    return ok > 0;
  },
};

/* ---------- fundamentales de cada empresa (Finnhub: perfil, métricas, balances SEC, calendario) ---------- */
const Fund = {
  /** datos guardados de un ticker (se muestran al instante mientras se refrescan) */
  de(t) { const f = state.cartera.fund || {}; return f[t] || null; },
  /** concepto de un balance SEC: primer match por nombre exacto o parcial */
  _v(arr, nombres) {
    if (!Array.isArray(arr)) return null;
    for (const n of nombres) { const h = arr.find(x => x.concept === n); if (h && Number.isFinite(Number(h.value))) return Number(h.value); }
    for (const n of nombres) { const h = arr.find(x => (x.concept || '').includes(n)); if (h && Number.isFinite(Number(h.value))) return Number(h.value); }
    return null;
  },
  C: {
    ventas: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet'],
    neto: ['NetIncomeLoss', 'ProfitLoss'],
    eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
    operativo: ['OperatingIncomeLoss'],
    impuesto: ['IncomeTaxExpenseBenefit'],
    antesImp: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxes'],
    patrimonio: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    deuda: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligationsNoncurrent', 'LongTermDebt'],
    caja: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
    cfo: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    acciones: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic', 'CommonStockSharesOutstanding'],
  },
  /** una fila por año fiscal, de más viejo a más nuevo */
  anios(fin) {
    if (!fin || !Array.isArray(fin.data)) return [];
    const V = Fund._v, C = Fund.C;
    const filas = fin.data.filter(d => d.report && (d.report.ic || d.report.bs)).map(d => {
      const ic = d.report.ic || [], bs = d.report.bs || [], cf = d.report.cf || [];
      const opi = V(ic, C.operativo), imp = V(ic, C.impuesto), pre = V(ic, C.antesImp);
      const pat = V(bs, C.patrimonio), deu = V(bs, C.deuda) || 0, caj = V(bs, C.caja) || 0;
      const cfo = V(cf, C.cfo), cpx = V(cf, C.capex);
      const tasa = pre && imp != null && pre > 0 ? clamp(imp / pre, 0, 0.6) : 0.21;
      const invertido = pat != null ? pat + deu - caj : null;
      return {
        anio: Number(d.year) || Number((d.endDate || '').slice(0, 4)), fin: d.endDate || '',
        ventas: V(ic, C.ventas), neto: V(ic, C.neto), eps: V(ic, C.eps), operativo: opi,
        patrimonio: pat, cfo, capex: cpx != null ? Math.abs(cpx) : null,
        fcf: cfo != null && cpx != null ? cfo - Math.abs(cpx) : null,
        acciones: V(ic, C.acciones) || V(bs, C.acciones),
        roic: opi != null && invertido && invertido > 0 ? opi * (1 - tasa) / invertido : null,
      };
    }).filter(f => f.anio && (f.ventas || f.neto));
    const vistos = {}; for (const f of filas) if (!vistos[f.anio] || f.fin > vistos[f.anio].fin) vistos[f.anio] = f;
    return Object.values(vistos).sort((a, b) => a.anio - b.anio);
  },
  /** CAGR entre el primero y el último valor positivo de la serie (n años) */
  cagr(filas, campo, n) {
    const xs = filas.filter(f => Number.isFinite(f[campo]) && f[campo] > 0).slice(-(n + 1));
    if (xs.length < 2) return null;
    const a = xs[0][campo], b = xs[xs.length - 1][campo], t = xs[xs.length - 1].anio - xs[0].anio;
    return t > 0 ? Math.pow(b / a, 1 / t) - 1 : null;
  },
  prom(filas, campo, n) { const xs = filas.slice(-n).map(f => f[campo]).filter(Number.isFinite); return xs.length ? sum(xs) / xs.length : null; },
  mediana(xs) { const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
  /** trae todo de Finnhub y lo guarda; devuelve los datos o null */
  async traer(t) {
    const key = (state.settings.finnhubKey || '').trim(); if (!key || !t) return null;
    const s = encodeURIComponent(Precios.simbolo(t));
    const get = async q => { try { const r = await fetch(`https://finnhub.io/api/v1/${q}&token=${encodeURIComponent(key)}`, { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; } };
    const hoy = D.today(); const hasta = D.iso(new Date(D.parse(hoy).getTime() + 200 * 86400000));
    const [perfil, met, fin, cal] = await Promise.all([
      get(`stock/profile2?symbol=${s}`),
      get(`stock/metric?symbol=${s}&metric=all`),
      get(`stock/financials-reported?symbol=${s}&freq=annual&from=2008-01-01&to=${hoy}`),
      get(`calendar/earnings?from=${hoy}&to=${hasta}&symbol=${s}`),
    ]);
    if (!perfil && !met && !fin) return null;
    const m = (met && met.metric) || {}; const serie = (met && met.series && met.series.annual) || {};
    const filas = Fund.anios(fin);
    const peHist = (serie.pe || []).map(x => Number(x.v)).filter(Number.isFinite);
    const bal = cal && cal.earningsCalendar && cal.earningsCalendar.length ? cal.earningsCalendar.slice().sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const d = {
      at: Date.now(), ticker: t,
      nombre: perfil && perfil.name || null, sector: perfil && perfil.finnhubIndustry || null,
      capUSD: perfil && perfil.marketCapitalization ? perfil.marketCapitalization * 1e6 : null,
      max52: m['52WeekHigh'] != null ? Number(m['52WeekHigh']) : null, min52: m['52WeekLow'] != null ? Number(m['52WeekLow']) : null,
      pe: Number(m.peTTM ?? m.peBasicExclExtraTTM) || null, peMediana: Fund.mediana(peHist.slice(-10)),
      pb: Number(m.pbAnnual ?? m.pbQuarterly) || null, peg: Number(m.pegTTM ?? m.pegRatio) || null,
      roe: Number(m.roeTTM ?? m.roeRfy) / 100 || null, roa: Number(m.roaTTM ?? m.roaRfy) / 100 || null,
      margenNeto: Number(m.netProfitMarginTTM) / 100 || null, margenNeto5: Number(m.netProfitMargin5Y) / 100 || null,
      margenBruto: Number(m.grossMarginTTM) / 100 || null, margenOper: Number(m.operatingMarginTTM) / 100 || null,
      deudaPat: Number(m['totalDebt/totalEquityQuarterly'] ?? m['totalDebt/totalEquityAnnual']) || null,
      yieldDiv: Number(m.dividendYieldIndicatedAnnual ?? m.currentDividendYieldTTM) / 100 || null,
      divCrec5: Number(m.dividendGrowthRate5Y) / 100 || null, payout: Number(m.payoutRatioTTM) / 100 || null,
      crecVentas5: Number(m.revenueGrowth5Y) / 100 || null, crecEps5: Number(m.epsGrowth5Y) / 100 || null,
      beta: Number(m.beta) || null,
      balance: bal ? { fecha: bal.date, hora: bal.hour || '', epsEst: bal.epsEstimate ?? null, trimestre: bal.quarter ?? null } : null,
      filas: filas.slice(-12).map(f => ({ anio: f.anio, ventas: f.ventas, neto: f.neto, eps: f.eps, fcf: f.fcf, acciones: f.acciones, roic: f.roic })),
    };
    // calculados sobre los balances reportados a la SEC (lo que Finnhub no da hecho)
    d.cagrVentas5 = Fund.cagr(filas, 'ventas', 5); d.cagrNeto5 = Fund.cagr(filas, 'neto', 5); d.cagrEps5 = Fund.cagr(filas, 'eps', 5);
    d.cagrVentas10 = Fund.cagr(filas, 'ventas', 10); d.cagrNeto10 = Fund.cagr(filas, 'neto', 10);
    d.roicProm5 = Fund.prom(filas.filter(f => f.roic != null), 'roic', 5);
    const u = filas[filas.length - 1];
    d.roicAct = u && u.roic != null ? u.roic : (Number(m.roiTTM) / 100 || null);  // respaldo: el ROI que ya calcula Finnhub (empresas con patrimonio negativo)
    d.fcfSobreNeto = u && u.fcf != null && u.neto ? u.fcf / u.neto : null;
    const accIni = filas.filter(f => f.acciones).slice(0, 1)[0], accFin = filas.filter(f => f.acciones).slice(-1)[0];
    d.accionesCambio = accIni && accFin && accIni.acciones && accIni.anio !== accFin.anio ? { desde: accIni.anio, hasta: accFin.anio, pct: accFin.acciones / accIni.acciones - 1 } : null;
    d.aniosDatos = filas.length ? { desde: filas[0].anio, hasta: filas[filas.length - 1].anio } : null;
    if (!state.cartera.fund) state.cartera.fund = {};
    state.cartera.fund[t] = d;
    const ks = Object.keys(state.cartera.fund); if (ks.length > 60) delete state.cartera.fund[ks[0]];
    Persist.save();
    return d;
  },
  /** refresca en segundo plano los tickers de la cartera con datos viejos (para los avisos de balance) */
  async actualizarCartera(max = 8, diasFrescura = 6) {
    if (!(state.settings.finnhubKey || '').trim()) return 0;
    const f = state.cartera.fund || {}; const corte = Date.now() - diasFrescura * 86400000;
    const ts = Precios.tickers().filter(t => t !== 'SPY' && (!f[t] || f[t].at < corte)).slice(0, max);
    let n = 0; for (const t of ts) { try { if (await Fund.traer(t)) n++; } catch (e) {} await new Promise(r => setTimeout(r, 300)); }
    return n;
  },
  /** próximo balance de un ticker, si está guardado: {fecha, dias} */
  balance(t) { const d = Fund.de(t); if (!d || !d.balance) return null; const dias = D.daysBetween(D.today(), d.balance.fecha); return dias >= 0 ? { ...d.balance, dias } : null; },
};

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, ms = 2200, action = null) { const t = $('#toast'); t.textContent = msg; if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { t.classList.remove('show'); action.fn(); }; t.appendChild(b); } t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }

/* ---------- icons ---------- */
/* ---------- estados vacios ----------
 * Cinco tipos con comportamientos distintos, no una sola regla que los estiliza.
 * El titulo dice que falta; el subtitulo, que pasa cuando lo cargues. Nunca "Sin datos" solo. */
const EmptyIcons = {
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M6 14.5h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17"/>',
  warn: '<path d="M12 4.5L21 19.5H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  list: '<path d="M4 7h16"/><path d="M4 12h11"/><path d="M4 17h7"/>',
  chart: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v8.5h8.5"/>',
};
function empty({ icon = 'list', head, sub = '', btn = null, action = null, go = null, ghost = false, trace = null, kind = '' }) {
  return `<div class="empty ${kind}">
    <div class="ico"><svg viewBox="0 0 24 24">${EmptyIcons[icon]}</svg></div>
    <h4>${esc(head)}</h4>
    ${sub ? `<p>${esc(sub)}</p>` : ''}
    ${trace ? `<div class="trace">${esc(trace)}</div>` : ''}
    ${btn ? `<button class="btn${ghost ? ' ghost' : ''}" ${go ? `data-go="${go}"` : `data-act="${action}"`}>${esc(btn)}</button>` : ''}
  </div>`;
}
/** hueco chico adentro de una tarjeta: el borde punteado dice "aca va algo" sin ocupar media pantalla */
function emptyInline(text, btn = 'Agregar', action = null) {
  return `<div class="empty-inline"><span>${esc(text)}</span>
    <button data-act="${action}">${esc(btn)}</button></div>`;
}

/** glifos que en realidad son iconos: mismo trazo 1.5 que el resto, al tamano del texto */
const G = {
  ok: '<svg class="g" viewBox="0 0 24 24"><path d="M20 6.5L9.5 17 4 11.5"/></svg>',
  no: '<svg class="g" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  warn: '<svg class="g" viewBox="0 0 24 24"><path d="M12 4.2L21.2 19.8H2.8z"/><path d="M12 10v4M12 16.8h.01"/></svg>',
  to: '<svg class="g" viewBox="0 0 24 24"><path d="M4.5 12h14M13 6l6 6-6 6"/></svg>',
  up: '<svg class="g" viewBox="0 0 24 24"><path d="M6.5 14.5L12 9l5.5 5.5"/></svg>',
  down: '<svg class="g" viewBox="0 0 24 24"><path d="M6.5 9.5L12 15l5.5-5.5"/></svg>',
};
const ICONS = {
  resumen: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  movimientos: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  cuotas: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h3"/></svg>',
  tarjetas: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M2 10.5h20M6 15h4"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>',
  cartera: '<svg viewBox="0 0 24 24"><path d="M21.2 15.1A9 9 0 1 1 8.9 2.8"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  tendencias: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  config: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8M14 17h7v-7"/></svg>',
  invest: '<svg viewBox="0 0 24 24"><path d="M12 2v20M17 6.5C17 4.5 14.8 3 12 3S7 4.5 7 6.5 9.2 10 12 10s5 1.5 5 3.5-2.2 3.5-5 3.5-5-1.5-5-3.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 3H6a2 2 0 0 0-2 2v2"/><circle cx="17" cy="14" r="1.5"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 21V9M6 13l6-6 6 6M4 3h16"/></svg>',
};
