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
/** pesos abreviados para tarjetas: 9,9 M · 360 k */
const abrevARS = v => Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3).toLocaleString('es-AR')} k` : fmtARS.format(Math.round(v));
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
/* Categorias v2 (27-sep, con los gastos reales de Facu): dos niveles. El GRUPO es la pregunta macro
 * ("¿cuanto se va en comida?") y la CATEGORIA el detalle ("¿y de eso cuanto en antojos?").
 * Cada categoria dice si es esencial o elegible: la parte elegible es donde se puede ahorrar. */
const GRUPOS = [
  { id: 'comida',    nombre: 'Comida',           slot: 1 },
  { id: 'movilidad', nombre: 'Movilidad',        slot: 2 },
  { id: 'salud',     nombre: 'Salud y cuidado',  slot: 3 },
  { id: 'mascotas',  nombre: 'Mascotas',         slot: 7 },
  { id: 'ocio',      nombre: 'Ocio',             slot: 4 },
  { id: 'compras',   nombre: 'Compras',          slot: 5 },
  { id: 'fijos',     nombre: 'Fijos y digital',  slot: 6 },
  { id: 'otros',     nombre: 'Otros',            slot: 8 },
];
// [id, nombre, grupo, tipo, esencial]
const DEFAULT_CATS = [
  ['super',          'Supermercado',                 'comida',    'variable', 1],
  ['comida_trabajo', 'Comida del trabajo',           'comida',    'variable', 1],
  ['restaurantes',   'Salidas a comer',              'comida',    'variable', 0],
  ['pedido',         'Delivery',                     'comida',    'variable', 0],
  ['alpaso',         'Al paso',                      'comida',    'variable', 0],
  ['antojos',        'Antojos',                      'comida',    'variable', 0],
  ['nafta',          'Nafta',                        'movilidad', 'variable', 1],
  ['auto',           'Seguro y mantenimiento del auto', 'movilidad', 'fijo',  1],
  ['peajes',         'Peajes y estacionamiento',     'movilidad', 'variable', 1],
  ['transporte',     'Transporte público',           'movilidad', 'variable', 1],
  ['taxi',           'Taxis (Uber, Cabify)',         'movilidad', 'variable', 0],
  ['medicos',        'Médicos y estudios',           'salud',     'variable', 1],
  ['optica',         'Óptica y anteojos',            'salud',     'variable', 1],
  ['farmacia',       'Farmacia',                     'salud',     'variable', 1],
  ['peluqueria',     'Peluquería',                   'salud',     'variable', 1],
  ['personal',       'Cuidado personal',             'salud',     'variable', 1],
  ['gimnasio',       'Gimnasio y suplementos',       'salud',     'variable', 0],
  ['odi_comida',     'Comida de Odi',                'mascotas',  'variable', 1],
  ['odi_vet',        'Veterinaria',                  'mascotas',  'variable', 1],
  ['odi_banio',      'Baño e higiene de Odi',        'mascotas',  'variable', 1],
  ['odi_juguetes',   'Juguetes y accesorios',        'mascotas',  'variable', 0],
  ['odi_otros',      'Otros de Odi',                 'mascotas',  'variable', 1],
  ['bares',          'Bares y noche',                'ocio',      'variable', 0],
  ['river',          'River',                        'ocio',      'variable', 0],
  ['entretenimiento','Cine y entretenimiento',       'ocio',      'variable', 0],
  ['viajes',         'Viajes y escapadas',           'ocio',      'variable', 0],

  ['ropa',           'Ropa y calzado',               'compras',   'variable', 0],
  ['regalos',        'Regalos',                      'compras',   'variable', 0],
  ['tech',           'Tecnología',                   'compras',   'variable', 0],
  ['casa',           'Casa y deco',                  'compras',   'variable', 0],
  ['compras_otros',  'Otras compras (ML, AliExpress)', 'compras', 'variable', 0],
  ['servicios',      'Teléfono y servicios',         'fijos',     'fijo',     1],
  ['subs',           'Claude y suscripciones',       'fijos',     'fijo',     0],
  ['impuestos',      'Impuestos y percepciones',     'fijos',     'fijo',     1],
  ['revisar',        'Otros',                        'otros',     'variable', 0],
].map(([id, nombre, grupo, tipo, esencial]) => ({ id, nombre, grupo, tipo, esencial: !!esencial, presupuesto: 0 }));
/** reglas por descripcion (texto normalizado, sin acentos): las usan la migracion a v2 y las sugerencias al cargar.
 *  Van de lo especifico a lo general: la primera que matchea gana. */
const CAT_REGLAS = [
  // lo que dice "vacaciones / escapada / viaje" va a Viajes aunque sea comida (Facu: "comida vacaciones")
  [/vacacion|escapada|\bfinde\b|\bviaje\b|excursion|\bhotel\b|hostel|airbnb|booking|vuelo|pasaje|aerol|flybondi|jetsmart/, 'viajes', 2],
  // Odi (el perro de Facu): grupo propio con sus categorias
  [/(bano|banio|peluquer|toallitas|shampoo).*(\bodi\b|perro)|pet ?grooming/, 'odi_banio', 1],
  [/veterinar|vacuna|antiparasit|pipeta|desparasit/, 'odi_vet', 1],
  [/(comida|alimento|balanceado|premio).*(\bodi\b|perro)|mon ami|dog ?chow|pro ?plan|royal canin|eukanuba|puppy|huellas|curupet|pet ?shop/, 'odi_comida', 1],
  [/(juguete|pelota|correa|collar|cucha|cama).*(\bodi\b|perro)|correa|collar para/, 'odi_juguetes', 2],
  [/\bodi\b|\bperro\b|mascota/, 'odi_otros', 1],
  [/optica|oculus|anteojo|lentes/, 'optica', 1],
  [/afeitar|safe ?razor|maquinita|crema|perfum|desodor|shampoo/, 'personal', 1],
  [/barber|peluquer/, 'peluqueria', 1],
  [/farmac|farmacity|remedio|medicament|ibuprofeno|ibupirac|actron|paracetamol|tafirol|aspirina|bayaspirina|amoxicilina|antibiotic|antialergic|loratadina|omeprazol|sertal|buscapina|reliverán|reliveran|curitas|gasa|alcohol en gel|vitamina|termometro|preservativ/, 'farmacia', 1],
  [/medic|dentista|odont|laborator|estudio|clinica|hospital|kinesi|psico|prepaga|obra social|osde|swiss|galeno/, 'medicos', 1],
  [/suplement|proteina|creatina|whey|colageno|gimnasio|\bgym\b|megatlon|sportclub|crossfit|padel|futbol 5|cancha/, 'gimnasio', 2],
  [/(comida|almuerzo|morfi|vianda|desayuno|merienda|cena).*(laburo|trabajo|oficina|\bpae\b)|\bpae\b|vianda/, 'comida_trabajo', 1],
  [/uber|cabify|didi|taxi|remis/, 'taxi', 2],
  [/subte|emova|\bsube\b|colectivo|\btren\b/, 'transporte', 1],
  [/telepase|peaje|ausa|autopista|park ?work|estacionamiento|cochera/, 'peajes', 1],
  [/nafta|axion|\bypf\b|shell|puma energy|combustible|\bgnc\b/, 'nafta', 1],
  [/federacion patronal|seguro (del )?auto|auto ?partes|repuesto|patente|\bvtv\b|service|taller|gomeria|lavadero/, 'auto', 1],
  [/river|\bcarp\b/, 'river', 2],
  [/helad|chocolat|kiosco|kiosko|golosin|gomitas|caramelo|chicle|pilipops|open ?25|delvi|spot alem|fikafe|green apple|lado bueno|\bcafe\b|cafecito|starbucks|havanna|alfajor|facturas|medialuna|snack|gaseosa|coca|monster|speed/, 'antojos', 3],
  // Comida segun por que comiste: pediste a casa (Delivery) o compraste algo en la calle, solo (Al paso)
  [/pedidos ?ya|rappi|delivery|\bpedido\b|pedi |pedimos/, 'pedido', 2],
  [/mcdonald|burger|\bmc\b|\bwtb\b|mostaza|pizza|empanada|sanguch|sandwich|pancho|hamburg|al paso/, 'alpaso', 2],
  [/asato|anapat|franks|mooi|miaokou|mostrador|lanelly|parrilla|restaurant|resto\b|sushi|cena|asado|almuerzo/, 'restaurantes', 2],
  [/antares|\bbar\b|jobs bar|bar jps|cerveza|birra|boliche|salida con|campari|vermouth|fernet|previa/, 'bares', 3],
  [/\bcine\b|teatro|recital|show|entrada/, 'entretenimiento', 3],
  [/hotel|lucania|vuelo|aerol|flybondi|jetsmart|airbnb|booking|despegar|hostel|pasaje/, 'viajes', 2],
  [/regalo|cumple|flores/, 'regalos', 2],
  [/personal telefono|\btelefono\b|internet|edenor|edesur|metrogas|naturgy|aysa|fibertel|telecentro|movistar|claro\b|\bluz\b|\bgas\b/, 'servicios', 1],
  [/claude|anthropic|chatgpt|openai|netflix|spotify|youtube|disney|\bhbo\b|icloud|google one|suscripci/, 'subs', 2],
  [/percepci|impuesto|reembolso|comision|mantenimiento de cuenta|\biva\b|sellado|afip|arca/, 'impuestos', 1],
  [/stanley|vinilo|sodimac|easy\b|ikea|mueble|ferreter|pintur|decor|colchon|sabana/, 'casa', 2],
  [/zara|nike|adidas|dexter|campero|alpargatas|bowie|ropa|zapat|remera|jean|camisa|calzado|campera|solido|uniqlo/, 'ropa', 2],
  [/monitor|notebook|celular|iphone|samsung|auricular|cargador|tecnolog|portal insumos|fravega|garbarino|musimundo/, 'tech', 2],
  [/aliexpress|\bchina\b|mercado ?libre|amazon|temu|shein/, 'compras_otros', 2],
  [/jumbo|carrefour|coto|\bdia\b|disco|\bvea\b|chango|super|almacen|verduler|carniceria|panaderia|fiambreria|dietetica|chino|tienda molinos|nestle|carne|fruta|verdura|leche|huevos|yerba/, 'super', 1],
];
/** migracion de categorias v1 -> v2: se reclasifica cada gasto, fijo y aprendido de las categorias viejas por defecto
 *  (primero por su descripcion, si no por la equivalencia vieja->nueva). Las categorias propias se conservan. */
const CAT_V1_A_V2 = { super: 'super', delivery: 'fastfood', salidas: 'restaurantes', nafta: 'nafta', auto: 'auto', transporte: 'transporte', subs: 'subs', deporte: 'gimnasio', salud: 'medicos', personal: 'personal', mascotas: 'odi', ropa: 'ropa', tech: 'tech', hogar: 'casa', compras_otros: 'compras_otros', regalos: 'regalos', viajes: 'viajes', impuestos: 'impuestos', otros: 'revisar', servicios: 'servicios', alquiler: 'alquiler', educacion: 'educacion' };
const GRUPO_V1_A_V2 = { hogar: 'fijos', comida: 'comida', auto: 'movilidad', servicios: 'fijos', ocio: 'ocio', compras: 'compras', salud: 'salud', otros: 'otros' };
const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function catPorRegla(desc) { const d = ' ' + normTxt(desc) + ' '; for (const [re, cat, nec] of CAT_REGLAS) if (re.test(d)) return { catId: cat, necesidad: nec }; return null; }
/** v2 -> v3 (27-sep): Odi pasa a su grupo Mascotas con categorias propias, optica se separa de medicos,
 *  "Cafes, kioscos y antojos" pasa a "Antojos". Solo toca lo que salio de v2. */
function migrarCategoriasV3(s) {
  if (Number(s.settings.catsV) >= 3) return;
  const ren = { antojos: ['Cafés, kioscos y antojos', 'Antojos'], medicos: ['Médicos, estudios y óptica', 'Médicos y estudios'] };
  for (const c of s.categorias) if (ren[c.id] && c.nombre === ren[c.id][0]) c.nombre = ren[c.id][1];
  const nueva = (desc, catId) => {
    if (catId === 'odi') { const r = catPorRegla(desc); return r && r.catId.startsWith('odi_') ? r.catId : 'odi_otros'; }
    if (catId === 'medicos') { const r = catPorRegla(desc); return r && r.catId === 'optica' ? 'optica' : 'medicos'; }
    return catId;
  };
  for (const m of s.movimientos || []) m.catId = nueva(m.desc, m.catId);
  for (const r of s.recurrentes || []) r.catId = nueva(r.desc, r.catId);
  for (const [d, a] of Object.entries(s.aprendido || {})) if (a && a.catId) a.catId = nueva(d, a.catId);
  const odi = s.categorias.find(c => c.id === 'odi');
  s.categorias = s.categorias.filter(c => c.id !== 'odi');
  for (const c of DEFAULT_CATS) if (!s.categorias.find(k => k.id === c.id)) { const at = s.categorias.findIndex(k => k.id === 'revisar'); s.categorias.splice(at < 0 ? s.categorias.length : at, 0, { ...c }); }
  if (odi && Number(odi.presupuesto)) { const k = s.categorias.find(c => c.id === 'odi_comida'); if (k) k.presupuesto = Number(odi.presupuesto); }
  s.settings.catsV = 3;
}
/** v3 -> v4 (27-sep): "Delivery y fast food" se parte en Delivery (pediste a casa) y Al paso; Restaurantes -> Salidas a comer. */
function migrarCategoriasV4(s) {
  if (Number(s.settings.catsV) >= 4) return;
  const r = s.categorias.find(c => c.id === 'restaurantes'); if (r && r.nombre === 'Restaurantes y parrillas') r.nombre = 'Salidas a comer';
  const nueva = (desc, catId) => { if (catId !== 'fastfood') return catId; const k = catPorRegla(desc); return k && k.catId === 'pedido' ? 'pedido' : 'alpaso'; };
  for (const m of s.movimientos || []) m.catId = nueva(m.desc, m.catId);
  for (const x of s.recurrentes || []) x.catId = nueva(x.desc, x.catId);
  for (const [d, a] of Object.entries(s.aprendido || {})) if (a && a.catId) a.catId = nueva(d, a.catId);
  const ff = s.categorias.find(c => c.id === 'fastfood');
  s.categorias = s.categorias.filter(c => c.id !== 'fastfood');
  for (const c of DEFAULT_CATS) if (!s.categorias.find(k => k.id === c.id)) { const at = s.categorias.findIndex(k => k.id === 'revisar'); s.categorias.splice(at < 0 ? s.categorias.length : at, 0, { ...c }); }
  if (ff && Number(ff.presupuesto)) { const k = s.categorias.find(c => c.id === 'alpaso'); if (k) k.presupuesto = Number(ff.presupuesto); }
  s.settings.catsV = 4;
}
/** v4 -> v5 (27-sep): Regalos pasa de Ocio a Compras; "Chocolates cr" fue un regalo (Facu). */
function migrarCategoriasV5(s) {
  if (Number(s.settings.catsV) >= 5) return;
  const r = s.categorias.find(c => c.id === 'regalos'); if (r && r.grupo === 'ocio') r.grupo = 'compras';
  for (const m of s.movimientos || []) if (normTxt(m.desc) === 'chocolates cr') m.catId = 'regalos';
  if (s.aprendido && s.aprendido['chocolates cr']) s.aprendido['chocolates cr'].catId = 'regalos';
  s.settings.catsV = 5;
}
function migrarCategoriasV2(s) {
  if (Number(s.settings.catsV) >= 2) return;
  const viejas = s.categorias || [];
  const idsV1 = new Set(Object.keys(CAT_V1_A_V2));
  const esV1 = viejas.some(c => ['delivery', 'salidas', 'mascotas', 'otros', 'hogar', 'deporte'].includes(c.id));
  if (!esV1) { s.settings.catsV = 2; return; }
  const nueva = (desc, catId) => { if (!idsV1.has(catId)) return catId; const r = catPorRegla(desc); return r ? r.catId : CAT_V1_A_V2[catId]; };
  const usadas = new Set();
  for (const m of s.movimientos || []) { m.catId = nueva(m.desc, m.catId); usadas.add(m.catId); }
  for (const r of s.recurrentes || []) { r.catId = nueva(r.desc, r.catId); usadas.add(r.catId); }
  for (const [d, a] of Object.entries(s.aprendido || {})) if (a && a.catId) a.catId = nueva(d, a.catId);
  const cats = DEFAULT_CATS.map(c => ({ ...c }));
  // presupuestos por categoria: el de la vieja pasa a su equivalente
  for (const v of viejas) if (idsV1.has(v.id) && Number(v.presupuesto)) { const k = cats.find(c => c.id === CAT_V1_A_V2[v.id]); if (k) k.presupuesto = (Number(k.presupuesto) || 0) + Number(v.presupuesto); }
  // alquiler / educacion (viejas sin equivalente) solo quedan si se usan; las propias se conservan con su grupo nuevo
  for (const v of viejas) {
    if (cats.find(c => c.id === v.id)) continue;
    if (idsV1.has(v.id) && !['alquiler', 'educacion'].includes(v.id)) continue;
    if (['alquiler', 'educacion'].includes(v.id) && !usadas.has(v.id)) continue;
    cats.splice(cats.length - 1, 0, { ...v, grupo: GRUPO_V1_A_V2[v.grupo] || (GRUPOS.find(g => g.id === v.grupo) ? v.grupo : 'otros'), esencial: v.esencial != null ? !!v.esencial : v.tipo === 'fijo' });
  }
  s.categorias = cats; s.settings.catsV = 2;
  // la v2 todavia tenia 'odi' como una sola categoria: la v3 la abre
  s.categorias.push({ id: 'odi', nombre: 'Odi (perro)', grupo: 'mascotas', tipo: 'variable', esencial: true, presupuesto: 0 }, { id: 'fastfood', nombre: 'Delivery y fast food', grupo: 'comida', tipo: 'variable', esencial: false, presupuesto: 0 });
}

const NECESIDAD = { 1: 'Necesario', 2: 'Útil', 3: 'Innecesario' };
/** Un solo umbral para "% del presupuesto", en todas las vistas: verde < 40 %, ambar 40-60 %, rojo > 60 %.
 *  Antes cada vista tenia el suyo y el mismo indicador salia ambar en Resumen y verde en Cuotas. */
const pctPresu = p => p > 0.6 ? 'crit' : p >= 0.4 ? 'warn' : 'good';
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
  grupo(id) { return GRUPOS.find(g => g.id === id) || GRUPOS[GRUPOS.length - 1]; },
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
    if (!Array.isArray(s.cartera.activos)) s.cartera.activos = [];  // otros activos: efectivo, fondos, letras, bonos, bitcoin
    // reserva v2: los fondos llevan lotes (suscripcion / rescate) y valor cuota real; un fci viejo (capital + tna) pasa a un lote
    for (const a of s.cartera.activos) if (a && a.tipo === 'fci' && !Array.isArray(a.lotes)) { a.lotes = a.capital ? [{ id: uid(), tipo: 'suscripcion', fecha: a.desde || D.today(), monto: Number(a.capital) || 0 }] : []; }
    for (const o of s.cartera.operaciones) if (o && o.fecha) { const h = D.habil(o.fecha); if (h !== o.fecha) o.fecha = h; }
    for (const o of s.cartera.operaciones) if (o && o.deDividendos > 0 && o.deCaja == null) { o.deCaja = o.deDividendos; delete o.deDividendos; }
    // alertas v2: `desc` (qué hace) separado de `nota` (tier + tesis). Nota vieja "qué hace | tesis" se parte una sola vez.
    for (const a of Object.values(s.cartera.alertas)) if (a && typeof a === 'object' && !a.desc && a.nota && String(a.nota).includes(' | ')) { const t = String(a.nota), i = t.indexOf(' | '); a.desc = t.slice(0, i).trim().slice(0, 120) || null; a.nota = t.slice(i + 3).trim() || null; }
    if (!Array.isArray(s.presets)) s.presets = [];
    if (!s.settings.presupuesto && s.settings.ingreso) s.settings.presupuesto = Math.max(0, Math.round(s.settings.ingreso * (1 - (Number(s.settings.metaInversionPct) || 0) / 100) - (Number(s.settings.colchon) || 0)));
    migrarCategoriasV2(s);
    migrarCategoriasV3(s);
    migrarCategoriasV4(s);
    migrarCategoriasV5(s);
    for (const c of s.categorias) if (c.esencial == null) c.esencial = c.tipo === 'fijo';
    for (const c of DEFAULT_CATS) if (!s.categorias.find(k => k.id === c.id)) s.categorias.splice(Math.max(0, s.categorias.length - 1), 0, { ...c });
    return s;
  },
  /** al reemplazar el estado por el del gist, se conservan las fichas de este dispositivo (el gist no las trae) */
  conCache(nuevo, viejo) {
    const c = viejo && viejo.cartera, n = nuevo && nuevo.cartera; if (!c || !n) return nuevo;
    n.fund = { ...(n.fund || {}), ...(c.fund || {}) };
    for (const k of ['fundSinDatos', 'calendario']) if (c[k] && !n[k]) n[k] = c[k];
    return nuevo;
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
    // las fichas de fundamentales, el calendario y los "sin datos" son cache que se vuelve a bajar: no viajan al gist
    const liviano = JSON.stringify(state, (k, v) => (k === 'fund' || k === 'fundSinDatos' || k === 'calendario') ? undefined : v);
    const files = { [Gist.FILE]: { content: liviano } };
    // copia mensual aparte, que no se pisa: respaldo-AAAA-MM.json (una por mes, en el mismo gist)
    const mes = D.thisMonth(); const marca = 'flujo.gist.mes';
    let ultimo = null; try { ultimo = localStorage.getItem(marca); } catch (e) {}
    if (ultimo !== mes) files[`respaldo-${mes}.json`] = { content: liviano };
    const r = await fetch('https://api.github.com/gists/' + c.id, { method: 'PATCH', headers: Gist.hdr(c.token), body: JSON.stringify({ files }) });
    if (!r.ok) { const e = new Error('gist ' + r.status); e.status = r.status; throw e; }
    try { localStorage.setItem(marca, mes); localStorage.setItem('flujo.gist.push', String(Date.now())); } catch (e) {}
    return true;
  },
  ultimoPush() { try { return Number(localStorage.getItem('flujo.gist.push')) || 0; } catch (e) { return 0; } },
  /** historial del gist: GitHub guarda una version por cada subida */
  async versiones(n = 30) {
    const c = Gist.cfg(); if (!c) return [];
    const r = await fetch(`https://api.github.com/gists/${c.id}/commits?per_page=${n}`, { headers: Gist.hdr(c.token), cache: 'no-store' });
    if (!r.ok) { const e = new Error('gist ' + r.status); e.status = r.status; throw e; }
    const list = await r.json();
    return (Array.isArray(list) ? list : []).map(x => ({ sha: x.version, fecha: x.committed_at, cambios: x.change_status ? (x.change_status.additions || 0) + (x.change_status.deletions || 0) : null }));
  },
  async version(sha) {
    const c = Gist.cfg(); if (!c) return null;
    const r = await fetch(`https://api.github.com/gists/${c.id}/${sha}`, { headers: Gist.hdr(c.token), cache: 'no-store' });
    if (!r.ok) { const e = new Error('gist ' + r.status); e.status = r.status; throw e; }
    const g = await r.json(); const f = g.files && g.files[Gist.FILE]; if (!f) return null;
    let content = f.content; if (f.truncated && f.raw_url) { const rr = await fetch(f.raw_url); content = await rr.text(); }
    return JSON.parse(content);
  },
  /** trae del gist si hay algo más nuevo; devuelve true si cambió el estado local */
  async refrescar(force = false) {
    if (!Gist.cfg()) return false;
    if (!force && Date.now() - Gist.lastPull < 60000) return false;
    Gist.lastPull = Date.now();
    try {
      const remote = await Gist.pull();
      if (remote && remote.v && (remote.updatedAt || 0) > (state.updatedAt || 0)) { state = Persist.conCache(Persist.migrate(remote), state); if (Persist.applyPreset()) { state.updatedAt = Date.now(); Persist.schedule(1500); } Persist.local(); Persist.setStatus('ok'); return true; }
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

/* ---------- ArgentinaDatos (misma gente que dolarapi; gratis, sin clave): valor cuota de FCI (fuente CNV),
 * inflacion mensual (INDEC) y CCL historico. Todo cacheado en state.cartera.ad, se refresca una vez por dia. ---------- */
const AD = {
  BASE: 'https://api.argentinadatos.com/v1',
  MP_SLUG: 'mercado-fondo-clase-a',   // el fondo de Mercado Pago, para comparar contra "dejarlo en MP"
  box() { const c = state.cartera; if (!c.ad || typeof c.ad !== 'object') c.ad = { fondos: {}, ipc: {}, ccl: {}, at: {} }; for (const k of ['fondos', 'ipc', 'ccl', 'at']) if (!c.ad[k] || typeof c.ad[k] !== 'object') c.ad[k] = {}; return c.ad; },
  async get(path) { const r = await fetch(`${AD.BASE}${path}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json(); },
  fresco(k, horas = 20) { const t = AD.box().at[k]; return t && Date.now() - t < horas * 3600000; },
  /** lista de fondos (para buscar el propio por nombre); cache en memoria una sesion */
  async fondos() {
    if (AD._fondos) return AD._fondos;
    const j = await AD.get('/finanzas/fci/fondos');
    const arr = Array.isArray(j) ? j : (j && (j.fondos || j.data)) || [];
    AD._fondos = arr.map(f => ({ slug: f.slug || AD.slug(f.nombre || ''), nombre: f.nombre || f.slug || '', categoria: f.categoria || '', horizonte: f.horizonte || '' })).filter(f => f.slug);
    return AD._fondos;
  },
  slug(n) { return String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); },
  buscar(lista, q) { const t = AD.slug(q).split('-').filter(Boolean); return lista.filter(f => { const n = AD.slug(f.nombre); return t.every(x => n.includes(x)); }).slice(0, 25); },
  /** historico de valor cuota de un fondo → { fecha: valorCuotaparte }, ultimos ~420 dias */
  async fondo(slug, forzar = false) {
    const box = AD.box(); const k = 'fondo:' + slug;
    if (!forzar && AD.fresco(k) && box.fondos[slug]) return box.fondos[slug];
    const j = await AD.get(`/finanzas/fci/fondos/${encodeURIComponent(slug)}/historico`);
    const hist = Array.isArray(j) ? j : (j && j.historico) || [];
    const desde = D.addDays(D.today(), -420); const vc = {};
    for (const h of hist) { const f = String(h.fecha || '').slice(0, 10); const v = Number(h.valorCuotaparte ?? h.vcp ?? h.valor); if (f >= desde && v > 0) vc[f] = v; }
    if (!Object.keys(vc).length) throw new Error('sin valor cuota');
    box.fondos[slug] = { nombre: (j && j.nombre) || (hist[0] && hist[0].nombre) || slug, vc, hasta: Object.keys(vc).sort().pop() };
    box.at[k] = Date.now(); Persist.save(); return box.fondos[slug];
  },
  /** valor cuota en una fecha (o el ultimo anterior disponible) */
  vcEn(slug, fecha) { const f = AD.box().fondos[slug]; if (!f) return null; if (f.vc[fecha]) return { v: f.vc[fecha], fecha }; const ks = Object.keys(f.vc).filter(x => x <= fecha).sort(); const k = ks[ks.length - 1]; return k ? { v: f.vc[k], fecha: k } : null; },
  vcUltimo(slug) { const f = AD.box().fondos[slug]; return f ? { v: f.vc[f.hasta], fecha: f.hasta } : null; },
  /** inflacion mensual INDEC → { 'AAAA-MM': % } */
  async inflacion(forzar = false) {
    const box = AD.box(); if (!forzar && AD.fresco('ipc', 48) && Object.keys(box.ipc).length) return box.ipc;
    const j = await AD.get('/finanzas/indices/inflacion'); const arr = Array.isArray(j) ? j : [];
    const ipc = {}; for (const r of arr) { const f = String(r.fecha || '').slice(0, 7); const v = Number(r.valor); if (f && Number.isFinite(v)) ipc[f] = v; }
    if (Object.keys(ipc).length) { box.ipc = ipc; box.at.ipc = Date.now(); Persist.save(); }
    return box.ipc;
  },
  /** CCL historico (venta) → { fecha: valor }, ultimos ~420 dias */
  async cclHist(forzar = false) {
    const box = AD.box(); if (!forzar && AD.fresco('ccl') && Object.keys(box.ccl).length) return box.ccl;
    const j = await AD.get('/cotizaciones/dolares/contadoconliqui'); const arr = Array.isArray(j) ? j : [];
    const desde = D.addDays(D.today(), -420); const ccl = {};
    for (const r of arr) { const f = String(r.fecha || '').slice(0, 10); const v = Number(r.venta) || Number(r.compra); if (f >= desde && v > 0) ccl[f] = v; }
    if (Object.keys(ccl).length) { box.ccl = ccl; box.at.ccl = Date.now(); Persist.save(); }
    return box.ccl;
  },
  cclEn(fecha) { const c = AD.box().ccl; if (c[fecha]) return c[fecha]; const ks = Object.keys(c).filter(x => x <= fecha).sort(); const k = ks[ks.length - 1]; return k ? c[k] : null; },
  /** refresco diario de todo lo que usa la reserva; silencioso, cada fuente por su lado */
  async actualizar() {
    const slugs = new Set((state.cartera.activos || []).filter(a => a.tipo === 'fci' && a.slug).map(a => a.slug));
    if (!slugs.size) return;
    slugs.add(AD.MP_SLUG);
    const tareas = [...slugs].map(sl => AD.fondo(sl).catch(e => { AD.box().at['err:' + sl] = String(e.message || e); }));
    tareas.push(AD.inflacion().catch(() => {}), AD.cclHist().catch(() => {}));
    await Promise.all(tareas);
  },
};

/* ---------- Bitcoin (CoinGecko, gratis y sin clave) ---------- */
const Btc = {
  async actualizar() {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const j = await r.json(); const c = Number(j && j.bitcoin && j.bitcoin.usd); if (!c) throw new Error('sin valor');
      state.cartera.btc = { c, dp: Number(j.bitcoin.usd_24h_change) || 0, t: Date.now() }; Persist.save(); return true;
    } catch (e) { return false; }
  },
  precio() { const b = state.cartera.btc; return b && b.c ? b : null; },
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
/* ---------- Finnhub: una sola puerta con limite (plan gratis: 60 por minuto; usamos 55) ----------
 * Toda llamada pasa por aca: precios, fundamentales y calendario comparten el cupo. Un 429 pausa a todos
 * 60 s (o lo que diga Retry-After) y la misma llamada se reintenta: no se pierde el ticker. */
const Finnhub = {
  LIMITE: 55, _hits: [], _pausa: 0,
  async turno() {
    for (;;) {
      const now = Date.now();
      if (now < Finnhub._pausa) { await new Promise(r => setTimeout(r, Finnhub._pausa - now + 50)); continue; }
      Finnhub._hits = Finnhub._hits.filter(x => now - x < 60000);
      if (Finnhub._hits.length < Finnhub.LIMITE) { Finnhub._hits.push(now); return; }
      await new Promise(r => setTimeout(r, 60000 - (now - Finnhub._hits[0]) + 50));
    }
  },
  /** GET: { ok, status, json }. status 429 solo si fallo 3 veces seguidas por limite */
  async get(path) {
    const key = (state.settings.finnhubKey || '').trim(); if (!key) return { ok: false, status: 401 };
    for (let i = 0; i < 3; i++) {
      await Finnhub.turno();
      try {
        const r = await fetch(`https://finnhub.io/api/v1/${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(key)}`, { cache: 'no-store' });
        if (r.status === 429) { const ra = Number(r.headers.get('Retry-After')) || 60; Finnhub._pausa = Date.now() + Math.min(120, ra) * 1000; continue; }
        if (!r.ok) return { ok: false, status: r.status };
        return { ok: true, status: 200, json: await r.json() };
      } catch (e) { return { ok: false, status: 0 }; }
    }
    return { ok: false, status: 429 };
  },
  /** consultas usadas en el ultimo minuto (para el indicador) */
  usadas() { const now = Date.now(); return Finnhub._hits.filter(x => now - x < 60000).length; },
};

/* ---------- Tier y tipo de cada ticker (A, B, C, Ciclica, Especulativa, F) ----------
 * Campo propio en la alerta (formato de cambios v3). Si no esta, se deduce de la nota ("A def", "B+ ciclica"). */
const TIERS = ['A', 'B', 'C', 'Cíclica', 'Especulativa', 'F'];
const Tier = {
  norm(x) {
    const t = normTxt(String(x || '').split('·')[0]); if (!t) return null;
    if (/^f\b/.test(t)) return 'F';
    if (/especul/.test(t)) return 'Especulativa';
    if (/cicl/.test(t)) return 'Cíclica';
    const m = t.match(/^([abc])(?:[+\-]|\b)/); return m ? m[1].toUpperCase() : null;
  },
  de(t) { const a = state.cartera.alertas[t]; if (!a) return null; return (a.tier && Tier.norm(a.tier)) || Tier.norm(a.nota); },
};

const Precios = {
  simbolo(t) { return t.replace('-', '.'); },
  /** una cotización puntual (para el form de operación); devuelve el precio o null */
  /** una cotizacion puntual; devuelve el precio o null. Sin precio en Finnhub (OTC, Brasil) -> "sin fuente" */
  async quote(t) {
    if (!t) return null;
    const r = await Finnhub.get(`quote?symbol=${encodeURIComponent(Precios.simbolo(t))}`);
    if (!r.ok) return null;
    const j = r.json || {}; const prev = state.cartera.precios[t] || {};
    if (!Number(j.c)) { state.cartera.precios[t] = { ...prev, sinFuente: Date.now() }; return null; }
    state.cartera.precios[t] = { c: Number(j.c), dp: Number(j.dp) || 0, pc: Number(j.pc) || null, t: Date.now() };
    return Number(j.c);
  },
  tickers() { const k = E.cartera(); const set = new Set(); for (const p of k.posiciones) set.add(p.ticker); for (const t of Object.keys(state.cartera.alertas)) if (Tier.de(t) !== 'F') set.add(t); set.add('SPY'); return [...set]; },
  /** "sin fuente": Finnhub no tiene precio; se reintenta una vez por mes */
  sinFuente(t) { const q = state.cartera.precios[t]; return !!(q && q.sinFuente && Date.now() - q.sinFuente < 30 * 86400000); },
  /** prioridad y cada cuanto: cerca de zona (a <5 % de mirala) y tenencias y tier A cada 15 min, B cada hora, el resto cada 4 h.
   *  Con el mercado de NY cerrado alcanza con un precio cada 12 h. */
  plan() {
    const k = E.cartera(); const tengo = new Set(k.posiciones.map(p => p.ticker)); const ny = typeof mercadoNY === 'function' ? mercadoNY() : { abierto: true };
    const MIN = 60000; const RANGO = { A: 2, B: 3, C: 4, 'Cíclica': 4, Especulativa: 5 };
    return Precios.tickers().map(t => {
      const q = state.cartera.precios[t]; const al = state.cartera.alertas[t]; const tier = Tier.de(t);
      const cerca = !!(al && al.mirala && q && q.c && q.c <= al.mirala * 1.05);
      const rapido = cerca || tengo.has(t) || tier === 'A' || t === 'SPY';
      let cada = rapido ? 15 * MIN : tier === 'B' ? 60 * MIN : 240 * MIN;
      if (!ny.abierto) cada = Math.max(cada, 12 * 60 * MIN);
      const rango = cerca ? 0 : (tengo.has(t) || t === 'SPY') ? 1 : (RANGO[tier] ?? 4);
      return { t, rango, cada, rapido, edad: q && q.t ? Date.now() - q.t : Infinity, sinFuente: Precios.sinFuente(t) };
    }).filter(x => !x.sinFuente).sort((a, b) => a.rango - b.rango || b.edad - a.edad);
  },
  vencidos() { return Precios.plan().filter(x => x.edad >= x.cada); },
  /** una sola corrida a la vez */
  actualizar(silencioso = false, modo = 'todos') {
    if (Precios._run) { if (!silencioso) toast('Ya se están actualizando los precios…'); return Precios._run; }
    Precios._run = Precios._actualizar(silencioso, modo).finally(() => { Precios._run = null; });
    return Precios._run;
  },
  /** modo: 'todos' (boton), 'rapidos' (tenencias, A, cerca de zona + lo vencido; lo usa el export) o 'vencidos' (el motor) */
  async _actualizar(silencioso = false, modo = 'todos') {
    try { await TC.actualizar(true); } catch (e) {}
    if ((state.cartera.activos || []).some(a => a.tipo === 'btc')) { try { await Btc.actualizar(); } catch (e) {} }
    try { await AD.actualizar(); } catch (e) {}
    const key = (state.settings.finnhubKey || '').trim();
    if (!key) { if (!silencioso) toast('Cargá tu clave gratuita de Finnhub en Ajustes, sección Cartera, para traer precios.', 5000); return false; }
    const plan = Precios.plan(); const lista = modo === 'todos' ? plan : modo === 'rapidos' ? plan.filter(x => x.rapido || x.edad >= x.cada) : plan.filter(x => x.edad >= x.cada);
    if (!lista.length) return true;
    let ok = 0;
    for (const x of lista) { if (await Precios.quote(x.t) != null) ok++; }
    if (ok) Precios._despues(ok, lista.length);
    if (!silencioso) { toast(ok ? `Precios actualizados (${ok}/${lista.length})` : 'No pude traer precios. Revisá la clave de Finnhub o la conexión.', 3500); render(); }
    return ok > 0;
  },
  /** despues de traer precios: fecha, SPY del dia y la valuacion diaria */
  _despues(ok, n) {
    state.cartera.preciosFecha = new Date().toISOString();
    const hoy = D.today(); const spy = state.cartera.precios.SPY;
    if (spy && spy.c && D.habil(hoy) === hoy) state.cartera.spy[hoy] = spy.c;
    if (spy && spy.pc && D.habil(hoy) === hoy) { const ayer = D.habil(D.addDays(hoy, -1)); const m = Spy.tabla(); if (!m[ayer] && Math.abs(spy.c / spy.pc - 1) < 0.07) state.cartera.spy[ayer] = spy.pc; }
    // valuacion del dia solo si todas las tenencias tienen precio de las ultimas 2 h (un snapshot con precios viejos ensucia el TWR)
    try { const k = E.cartera(); const fresco = k.posiciones.every(p => { const q = state.cartera.precios[p.ticker]; return q && q.t && Date.now() - q.t < 2 * 3600000; });
      if (k.valor != null && spy && spy.c && fresco) Precios._foto(k, hoy); } catch (e) {}
    Persist.save();
  },
  _foto(k, hoy) {
    const h = state.cartera.historial; const vi = k.ventanas.inicio, va = k.ventanas.anio;
    h[hoy] = { v: Math.round(k.valor * 100) / 100, c: Math.round(k.costo * 100) / 100, s: vi.disponible ? Math.round(vi.sombraValor * 100) / 100 : null, sa: va.disponible ? Math.round(va.sombraValor * 100) / 100 : null, spy: k.spyHoy, mep: k.mep, ccl: k.ccl };
    const ks = Object.keys(h).sort(); if (ks.length > 1500) for (const old of ks.slice(0, ks.length - 1500)) delete h[old];
  },
};

/* ---------- EMA 200 (la baja la tarea diaria del repo: tools/tecnico.mjs -> sec/tecnico.json) ---------- */
const Tec = {
  datos: null, dia: null,
  async cargar() {
    const hoy = D.today(); if (Tec.dia === hoy) return;
    try { if (location.protocol.startsWith('http')) { const r = await fetch(`sec/tecnico.json?d=${hoy}`, { cache: 'no-store' }); if (r.ok) Tec.datos = await r.json(); } } catch (e) {}
    Tec.dia = hoy;
  },
  /** EMA 200 de un ticker contra el precio de hoy: {ema, dist (precio/ema - 1), toques10, ultimoToque, fecha} */
  de(t) {
    const x = Tec.datos && Tec.datos[Sec.clave(t)]; if (!x || !x.ema200) return null;
    const px = state.cartera.precios[t] && state.cartera.precios[t].c;
    // el precio de BYMA/Finnhub y el ajustado de la serie pueden diferir si hubo split reciente: si el cierre de la serie y el precio de hoy
    // estan a mas de 35 % se descarta
    if (!px || Math.abs(px / x.cierre - 1) > 0.35) return null;
    return { ema: x.ema200, sma: x.sma200, dist: px / x.ema200 - 1, toques10: x.toques10, ultimoToque: x.ultimoToque, pctAbajo10: x.pctAbajo10, anios: x.anios, fecha: x.fecha, sube: x.ema200 >= x.ema200hace30 };
  },
  /** cerca de la EMA 200: entre 3 % arriba y 5 % abajo */
  /** "+16 %", "\u22123 %"; si redondea a 0 no lleva signo */
  distTxt(v, sp = '') { const n = Math.round(Math.abs(v) * 100); return n === 0 ? `0${sp}%` : `${v > 0 ? '+' : '\u2212'}${n}${sp}%`; },
  toquesTxt(e) { const a = Math.max(1, Math.min(10, Math.round(e.anios || 10))); return e.toques10 ? `la toc\u00f3 ${e.toques10} ${e.toques10 === 1 ? 'vez' : 'veces'} en ${a} a\u00f1os` : `no la toc\u00f3 en ${a} a\u00f1os`; },
  cerca(t) { const e = Tec.de(t); return e && e.dist <= 0.03 && e.dist >= -0.05 ? e : null; },
};

/* ---------- balances oficiales de la SEC, bajados por la tarea diaria del repo (tools/sec.mjs -> sec/<T>.json) ---------- */
const Sec = {
  _cache: {},
  /** nombre del archivo de la tarea diaria: usa el guion de Yahoo/SEC (BRK-B, AKO-B), no el punto de Finnhub */
  clave(t) { return Precios.simbolo(t).replace('.', '-'); },
  async de(t) {
    const sym = Sec.clave(t); const hoy = D.today();
    const c = Sec._cache[sym]; if (c && c.dia === hoy) return c.doc;
    let doc = null;
    try {
      if (location.protocol.startsWith('http')) {
        const r = await fetch(`sec/${encodeURIComponent(sym)}.json?d=${hoy}`, { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); if (j && j.annual && Array.isArray(j.annual.data) && j.annual.data.length) doc = j; }
      }
    } catch (e) {}
    if (doc) for (const blk of [doc.annual, doc.quarterly]) for (const d of (blk && blk.data) || []) if (d.report && !d.report.cf) d.report.cf = d.report.ic;
    Sec._cache[sym] = { dia: hoy, doc }; return doc;
  },
  /** une los reportes de Finnhub con los de la SEC: por cada cierre manda el de Finnhub; la SEC agrega los que faltan */
  mezclar(fh, sec) {
    const a = (fh && Array.isArray(fh.data)) ? fh.data.filter(d => d && d.report && Fund.anios({ data: [d] }).length + Fund.trimestres({ data: [d] }).length) : [];
    const b = (sec && Array.isArray(sec.data)) ? sec.data : [];
    if (!b.length) return fh; if (!a.length) return sec;
    const cierre = d => Date.parse(String(d.endDate).slice(0, 10));
    const cerca = (x, y) => Math.abs(cierre(x) - cierre(y)) < 12 * 864e5;
    // el de Finnhub sirve si trae patrimonio de la empresa que cotiza (CEG: Finnhub trae la subsidiaria LLC, sin StockholdersEquity)
    const sirve = d => { const cs = ((d.report && d.report.bs) || []).map(x => Fund._c(x)); return cs.includes('StockholdersEquity') || cs.includes('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'); };
    const aOk = a.filter(y => sirve(y) || !b.some(x => cerca(x, y) && sirve(x)));
    const extra = b.filter(x => !aOk.some(y => cerca(x, y)));
    // mismo periodo en las dos: se usa el de Finnhub y se le agregan de la SEC los flujos que no trae (dividendos, recompras,
    // margen bruto, acciones). El balance (deuda) no se toca: es el que coincide con TradingView.
    const RELLENO = /(PaymentsOfDividends|PaymentsForRepurchaseOfCommonStock|GrossProfit|CostOfRevenue|CostOfGoodsAndServicesSold|OperatingIncomeLoss|WeightedAverageNumberOf|NetCashProvidedByUsedInOperatingActivities|PaymentsToAcquirePropertyPlantAndEquipment)/;
    const aFull = aOk.map(y => { const x = b.find(z => cerca(z, y)); if (!x || !x.report) return y; const ic = (y.report.ic || []).slice(), cf = (y.report.cf || []).slice(); const tiene = new Set([...ic, ...cf].map(c => Fund._c(c)));
      for (const c of (x.report.ic || [])) { const n = Fund._c(c); if (RELLENO.test(n) && !tiene.has(n)) { ic.push(c); cf.push(c); tiene.add(n); } }
      return { ...y, report: { ...y.report, ic, cf } }; });
    return { data: [...aFull, ...extra], mezcla: extra.length };
  },
};

/* ---------- fundamentales de cada empresa (Finnhub: perfil, métricas, balances SEC, calendario) ---------- */
const Fund = {
  /** datos guardados de un ticker (se muestran al instante mientras se refrescan) */
  de(t) { const f = state.cartera.fund || {}; return f[t] || null; },
  /** concepto de un balance SEC: primer match por nombre exacto o parcial */
  /** Finnhub manda los conceptos de los 10-K nuevos con prefijo de taxonomia ("us-gaap_Revenues", "ifrs-full_Revenue") y los viejos sin prefijo.
   *  Sin sacarlo, ningun concepto matcheaba y la ficha quedaba sin balances (o con los de 2012). */
  _c(x) { return String((x && x.concept) || '').replace(/^[A-Za-z][A-Za-z0-9-]*_/, ''); },
  _v(arr, nombres) {
    if (!Array.isArray(arr)) return null;
    for (const n of nombres) { const h = arr.find(x => Fund._c(x) === n); if (h && Number.isFinite(Number(h.value))) return Number(h.value); }
    // parcial: el concepto empieza con el nombre y lo que sigue no lo cambia de significado. Antes "NetIncomeLoss"
    // caia en NetIncomeLossAttributableToNoncontrollingInterest (PFE, CEG, PEP, GEV: caja libre / ganancia de 200x)
    for (const n of nombres) { const h = arr.find(x => { const c = Fund._c(x); return c.startsWith(n) && !/Noncontrolling|Minority|PerShare|Attributable|Other|Extraordinary/.test(c.slice(n.length)); }); if (h && Number.isFinite(Number(h.value))) return Number(h.value); }
    return null;
  },
  /** suma de todos los conceptos de una lista que aparezcan (cada uno una sola vez) */
  _sum(arr, nombres) { if (!Array.isArray(arr)) return null; let t = null; for (const n of nombres) { const h = arr.find(x => Fund._c(x) === n); if (h && Number.isFinite(Number(h.value))) t = (t || 0) + Number(h.value); } return t; },
  C: {
    ventas: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet'],
    neto: ['NetIncomeLoss', 'ProfitLoss'],
    eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
    operativo: ['OperatingIncomeLoss'],
    impuesto: ['IncomeTaxExpenseBenefit'],
    antesImp: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxes'],
    patrimonio: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'MembersEquity', 'LimitedLiabilityCompanyOrLimitedPartnershipMembersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    deuda: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligationsNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermLoansPayable', 'LongTermNotesPayable'],
    // deuda total como la cuenta TradingView: largo plazo + porcion corriente + corto plazo + leases
    deudaCorriente: ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent', 'DebtCurrent', 'ShortTermDebtAndCurrentPortionOfLongTermDebt'],
    deudaCorto: ['ShortTermBorrowings', 'CommercialPaper', 'OtherShortTermBorrowings', 'LoansPayableCurrent', 'NotesPayableCurrent'],
    // solo leases financieros: los operativos no entran en la deuda del ROIC de TradingView (MELI FY2025: 15,4 % sin ellos, 13,6 % con ellos)
    leases: ['FinanceLeaseLiabilityNoncurrent', 'FinanceLeaseLiabilityCurrent'],
    patrimonioTotal: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'LimitedLiabilityCompanyOrLimitedPartnershipMembersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    minoritarios: ['MinorityInterest', 'StockholdersEquityAttributableToNoncontrollingInterest'],
    caja: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
    invCorto: ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    cfo: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets'],
    acciones: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic', 'CommonStockSharesOutstanding'],
  },
  /** dividendo por accion pagado (o declarado) en el periodo */
  dps(ic, cf) { const k = ['CommonStockDividendsPerShareCashPaid', 'CommonStockDividendsPerShareDeclared']; const v = Fund._v(ic, k) ?? Fund._v(cf, k); return v != null ? Math.abs(v) : null; },
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
        anio: Number(d.year) || Number((d.endDate || '').slice(0, 4)), fin: (d.endDate || '').slice(0, 10), inicio: (d.startDate || '').slice(0, 10), trim: Number(d.quarter) || null,
        ventas: V(ic, C.ventas), neto: V(ic, C.neto), eps: V(ic, C.eps), operativo: opi,
        bruto: (() => { const g = V(ic, ['GrossProfit']); if (g != null) return g; const v = V(ic, C.ventas), cr = V(ic, ['CostOfRevenue', 'CostOfGoodsAndServicesSold']); if (v == null || cr == null) return null;
          // sin ganancia bruta presentada se arma ventas - costo; si el "costo" es una parte chica (UNH: solo productos, sin costos medicos)
          // el margen sale absurdo (88 % bruto con 4 % operativo) -> sin dato
          const gb = v - cr; return v > 0 && opi != null && (gb - opi) / v > 0.6 ? null : gb; })(),
        patrimonio: pat, cfo, capex: cpx != null ? Math.abs(cpx) : null,
        div: (v => v != null ? Math.abs(v) : null)(V(cf, ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'])), dps: Fund.dps(ic, cf), recompra: (v => v != null ? Math.abs(v) : null)(V(cf, ['PaymentsForRepurchaseOfCommonStock'])),
        fcf: cfo != null && cpx != null ? cfo - Math.abs(cpx) : null,
        acciones: V(ic, C.acciones) || V(bs, C.acciones),
        roicNopat: opi != null && invertido && invertido > 0 ? opi * (1 - tasa) / invertido : null,
        capital: Fund.capitalTotal(bs), caja: V(bs, C.caja), invCorto: V(bs, C.invCorto),
      };
    }).filter(f => f.anio && (f.ventas || f.neto));
    const vistos = {}; for (const f of filas) if (!vistos[f.anio] || f.fin > vistos[f.anio].fin) vistos[f.anio] = f;
    const out = Object.values(vistos).sort((a, b) => a.anio - b.anio);
    // acciones: algunos 10-K vienen en millones (MCD 713) y los splits (NVDA 10:1 en 2024) rompen la serie. Se normaliza a unidades
    // y se ajustan los anios viejos por split, como hace TradingView.
    for (const f of out) if (f.acciones > 0 && f.acciones < 1e5) f.acciones *= 1e6;
    // JNJ, PFE no etiquetan el dividendo pagado en el flujo de caja: dividendo por accion x acciones (antes de ajustar por splits)
    for (const f of out) if (f.div == null && f.dps > 0 && f.acciones > 0) f.div = f.dps * f.acciones;
    for (let i = out.length - 1; i > 0; i--) {
      const a1 = out[i].acciones, a0 = out[i - 1].acciones; if (!(a1 > 0 && a0 > 0)) continue;
      const r = a1 / a0; const k = [2, 3, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50].find(x => Math.abs(r / x - 1) < 0.12) || [2, 3, 4, 5, 8, 10, 20].map(x => 1 / x).find(x => Math.abs(r / x - 1) < 0.12);
      if (k) for (let j = 0; j < i; j++) if (out[j].acciones) out[j].acciones *= k;
    }
    // EPS: Finnhub redondea el de varios 10-K recientes a entero (HD 15, UNH 24, META 15). Se calcula ganancia / acciones diluidas.
    for (const f of out) { f.epsCalc = false; if (f.neto != null && f.acciones > 0) { f.eps = f.neto / f.acciones; f.epsCalc = true; } }
    // ROIC como lo publica TradingView: ganancia neta / promedio del capital total (patrimonio + deuda total) de dos periodos
    out.forEach((f, i) => { const prev = i ? out[i - 1] : null; f.roic = Fund.roicTV(f.neto, f.capital, prev && prev.anio === f.anio - 1 ? prev.capital : null); });
    return out;
  },
  /** capital invertido como TradingView (contrastado con MELI: FY2025 18,62 %, FY2024 27,03 %):
   *  patrimonio (con minoritarios) + deuda de LARGO plazo + leases de largo plazo (operativos y financieros).
   *  La deuda de corto y la porcion corriente no entran. `deudaTotal` (con todo) es para la caja neta. null si no hay patrimonio. */
  capitalTotal(bs) {
    const V = Fund._v, C = Fund.C; const tiene = n => Array.isArray(bs) && bs.some(x => Fund._c(x) === n);
    let pat = V(bs, C.patrimonioTotal);
    if (pat == null) { const p = V(bs, C.patrimonio); if (p == null) return null; pat = p + (Fund._sum(bs, C.minoritarios) || 0); }
    const cor = V(bs, C.deudaCorriente) || 0;
    // deuda de largo plazo NO corriente, por prioridad (la SEC trae el mismo monto con varios nombres; sumar duplicaba):
    // 1) LongTermDebtNoncurrent (+ leases financieros aparte) 2) LongTermDebtAndCapitalLeaseObligations* (ya incluye leases financieros,
    // es la porcion NO corriente: HD 46,34) 3) prestamos/notas de largo plazo (MELI) 4) LongTermDebt total menos la porcion corriente
    const exacto = n => { const h = Array.isArray(bs) && bs.find(x => Fund._c(x) === n); const v = h ? Number(h.value) : NaN; return Number.isFinite(v) ? v : null; };
    let lp = 0, incluyeFin = false; void incluyeFin;
    if (exacto('LongTermDebtNoncurrent') != null) lp = exacto('LongTermDebtNoncurrent');
    else { const cl = ['LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligationsNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'].map(exacto).find(v => v != null);
      if (cl != null) { lp = cl; incluyeFin = true; }
      else if (tiene('LongTermLoansPayable') || tiene('LongTermNotesPayable')) lp = Math.max(exacto('LongTermLoansPayable') || 0, 0) + Math.max(exacto('LongTermNotesPayable') || 0, 0);
      else lp = Math.max(0, (exacto('LongTermDebt') || 0) - cor); }
    // leases: cada empresa los nombra distinto (us-gaap OperatingLeaseLiabilityNoncurrent, AMZN LeaseLiabilityNoncurrent,
    // MCD LongTermLeaseLiabilityNoncurrentNet / CurrentLeaseLiabilityNet): se suman por patron, una vez cada concepto
    const leaseSum = re => { const vistos = new Set(); let t = 0; for (const x of (Array.isArray(bs) ? bs : [])) { const c = Fund._c(x); if (vistos.has(c) || /Debt|Payments|Expense|Cost|Asset|RightOfUse/.test(c) || !re.test(c)) continue; if (/Finance|Capital/.test(c)) continue; /* leases financieros: van dentro de la deuda o en notas (IBM, MCD matchean a TV sin sumarlos) */ const v = Number(x.value); if (Number.isFinite(v)) { vistos.add(c); t += v; } } return t; };
    const leasesLP = leaseSum(/Lease\w*Liabilit\w*Noncurrent|LongTermLease\w*Liabilit/);
    const corTotal = tiene('DebtCurrent') || tiene('ShortTermDebtAndCurrentPortionOfLongTermDebt');
    const corto = corTotal && !['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent'].some(tiene) ? 0 : (Fund._sum(bs, C.deudaCorto) || 0);
    const leasesCP = leaseSum(/^(?!.*Noncurrent)(?:\w*Lease\w*Liabilit\w*Current|CurrentLease\w*Liabilit\w*)/);
    // capital invertido de TradingView: patrimonio + deuda y leases NO corrientes (sin porcion corriente ni deuda de corto)
    const deuda = lp + leasesLP;
    return { patrimonio: pat, deuda, deudaTotal: lp + cor + corto + leasesLP + leasesCP, total: pat + deuda };
  },
  /** ganancia neta / promedio del capital total de dos periodos; vacio si el capital promedio no es positivo o el resultado es absurdo */
  roicTV(neto, cap, capPrev) {
    if (neto == null || !cap) return null;
    const base = capPrev && capPrev.total != null ? (cap.total + capPrev.total) / 2 : cap.total;
    if (!(base > 0)) return null;
    const r = neto / base; return Math.abs(r) <= 3 ? r : null;
  },
  /** filas trimestrales (10-Q y 10-K) con periodo en meses, de mas vieja a mas nueva */
  trimestres(finQ) {
    if (!finQ || !Array.isArray(finQ.data)) return [];
    const V = Fund._v, C = Fund.C;
    return finQ.data.filter(d => d.report && (d.report.ic || d.report.bs) && d.endDate).map(d => {
      const ic = d.report.ic || [], bs = d.report.bs || [];
      const fin = String(d.endDate).slice(0, 10), ini = String(d.startDate || '').slice(0, 10);
      const meses = ini && D.parse(ini) ? Math.round((D.parse(fin) - D.parse(ini)) / (30.4 * 86400000)) : null;
      const cf = d.report.cf || ic; const cfo = V(cf, C.cfo), cpx = V(cf, C.capex); const abs = v => v != null ? Math.abs(v) : null;
      let acc = V(ic, ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic']); if (acc > 0 && acc < 1e5) acc *= 1e6;
      return { fin, ini, meses, anio: Number(d.year) || Number(fin.slice(0, 4)), trim: Number(d.quarter) || null, neto: V(ic, C.neto), ventas: V(ic, C.ventas), capital: Fund.capitalTotal(bs),
        cfo, capex: abs(cpx), div: abs(V(cf, ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'])) ?? (Fund.dps(ic, cf) > 0 && acc > 0 ? Fund.dps(ic, cf) * acc : null), recompra: abs(V(cf, ['PaymentsForRepurchaseOfCommonStock'])), acciones: acc };
    }).sort((a, b) => a.fin.localeCompare(b.fin));
  },
  /** Ganancia neta de los ultimos 12 meses y capital promedio (hoy y hace un anio) a partir de 10-K + 10-Q.
   *  Soporta 10-Q con valores del trimestre (3 meses) o acumulados del anio (6/9 meses). null si no cierra. */
  ttm(filasAnuales, trims) {
    if (!trims.length || !filasAnuales.length) return null;
    const q = trims.filter(t => t.neto != null);
    const ult = q[q.length - 1]; if (!ult) return null;
    const ultAnual = filasAnuales[filasAnuales.length - 1];
    if (ult.fin <= ultAnual.fin) return { neto: ultAnual.neto, hasta: ultAnual.fin, capital: ultAnual.capital, capitalPrev: (filasAnuales[filasAnuales.length - 2] || {}).capital || null, base: 'anual' };
    // valor de los meses transcurridos desde el cierre anual (YTD) en un periodo dado
    const ytdDesde = (cierre, hasta, nMax = 4) => {
      const tramo = q.filter(t => t.fin > cierre && t.fin <= hasta).slice(0, nMax);
      if (!tramo.length) return null;
      const u = tramo[tramo.length - 1];
      if (u.meses != null && u.meses >= 5) return u.neto;               // el 10-Q ya viene acumulado
      if (tramo.every(t => t.meses == null || t.meses <= 4)) return sum(tramo.map(t => t.neto));  // trimestres sueltos
      return null;
    };
    const nTramo = q.filter(t => t.fin > ultAnual.fin && t.fin <= ult.fin).length;
    const ytd = ytdDesde(ultAnual.fin, ult.fin);
    // el mismo tramo del anio anterior: los cierres fiscales se corren unos dias (NVDA cierra 27/28 de julio), por eso el margen
    const finPrev = (filasAnuales[filasAnuales.length - 2] || {}).fin; const hastaPrev = D.addDays(ult.fin, -365);
    const ytdPrev = finPrev ? ytdDesde(finPrev, D.addDays(hastaPrev, 20), nTramo) : null;
    if (ytd == null || ytdPrev == null || ultAnual.neto == null) return null;
    const neto = ultAnual.neto + ytd - ytdPrev;
    if (ultAnual.neto && Math.abs(neto / ultAnual.neto) > 4) return null;  // algo se leyo mal
    // balance de hace un anio: el trimestre mas cercano a esa fecha (a lo sumo 45 dias de diferencia)
    const prev = q.filter(t => t.capital && Math.abs(D.parse(t.fin) - D.parse(hastaPrev)) <= 45 * 86400000).sort((a, b) => Math.abs(D.parse(a.fin) - D.parse(hastaPrev)) - Math.abs(D.parse(b.fin) - D.parse(hastaPrev)))[0];
    return { neto, hasta: ult.fin, capital: ult.capital, capitalPrev: prev ? prev.capital : null, base: 'ttm' };
  },
  /** ultimos 12 meses de un campo de flujo (ventas, neto, cfo, capex, div, recompra) = ultimo anual + lo que va del anio − lo mismo del anio anterior.
   *  Soporta trimestres sueltos (3 meses) o acumulados del anio. Si no hay trimestres posteriores al anual, devuelve el anual. */
  ttmCampo(filasAnuales, trims, campo) {
    const ua = filasAnuales[filasAnuales.length - 1]; if (!ua || ua[campo] == null) return null;
    const q = trims.filter(t => t[campo] != null); const ult = q[q.length - 1];
    if (!ult || ult.fin <= ua.fin) return { v: ua[campo], hasta: ua.fin, base: 'fy' };
    const ytdDesde = (cierre, hasta, nMax = 4) => { const tramo = q.filter(t => t.fin > cierre && t.fin <= hasta).slice(0, nMax); if (!tramo.length) return null; const u = tramo[tramo.length - 1]; if (u.meses != null && u.meses >= 5) return u[campo]; if (tramo.every(t => t.meses == null || t.meses <= 4)) return sum(tramo.map(t => t[campo])); return null; };
    const nTramo = q.filter(t => t.fin > ua.fin && t.fin <= ult.fin).length;
    const ytd = ytdDesde(ua.fin, ult.fin); const pv = filasAnuales[filasAnuales.length - 2];
    const ytdPrev = pv && pv.fin ? ytdDesde(pv.fin, D.addDays(D.addDays(ult.fin, -365), 20), nTramo) : null;
    if (ytd == null || ytdPrev == null) return { v: ua[campo], hasta: ua.fin, base: 'fy' };
    return { v: ua[campo] + ytd - ytdPrev, hasta: ult.fin, base: 'ttm' };
  },
  /** multiplos con el precio de hoy y los ultimos 12 meses de la SEC/Finnhub. Solo si el balance esta en dolares y el valor de
   *  mercado propio coincide con el de Finnhub (+-25 %): si no (ADR con otra relacion de acciones, otra moneda) -> sin dato */
  mult(t, d = Fund.de(t)) {
    const o = { pe: null, ps: null, pfcf: null, fcfY: null, eps: null, payout: null, recompras: null, base: null };
    if (!d || !d.ttm || d.moneda && d.moneda !== 'USD') return o;
    // sin 10-Q (20-F) o con el ultimo anual de hace mas de 13 meses no hay "ultimos 12 meses" -> sin dato (NU, VIST: 2024)
    if (d.solo20F || (d.ttm.base === 'fy' && d.ttm.hasta && D.daysBetween(d.ttm.hasta, D.today()) > 400)) return o;
    const px = state.cartera.precios[t] && state.cartera.precios[t].c; const x = d.ttm; if (!px || !(x.acciones > 0)) return o;
    const mcap = px * x.acciones;
    if (d.capUSD && d.pxCap && Math.abs((d.capUSD / d.pxCap * px) / mcap - 1) > 0.25) return o;
    o.base = x.base; o.eps = x.neto != null ? x.neto / x.acciones : null;
    o.pe = x.neto > 0 ? mcap / x.neto : null; o.ps = x.ventas > 0 ? mcap / x.ventas : null;
    o.pfcf = x.fcf > 0 ? mcap / x.fcf : null; o.fcfY = x.fcf != null ? x.fcf / mcap : null;
    o.payout = x.div != null && x.neto > 0 ? x.div / x.neto : null; o.recompras = x.recompra != null ? x.recompra / mcap : null;
    return o;
  },
  /** CAGR entre el primero y el último valor positivo de la serie (n años) */
  /** CAGR exacto a n anios: del ultimo ejercicio (FY) contra el de n anios antes. Sin atajos: si falta alguno de los dos anios,
   *  si el ultimo ejercicio no tiene el dato o si alguno es <= 0 (no hay tasa de crecimiento con base negativa) -> null ("—") */
  cagrDet(filas, campo, n) {
    const ult = filas[filas.length - 1]; if (!ult) return null;
    const b = ult[campo]; const f0 = filas.find(f => f.anio === ult.anio - n); const a = f0 ? f0[campo] : null;
    if (campo === 'eps' && (!ult.epsCalc || !(f0 && f0.epsCalc))) return null;  // EPS solo si ambos salen de ganancia / acciones (ajustado por splits)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
    return { v: Math.pow(b / a, 1 / n) - 1, desde: f0.anio, hasta: ult.anio, a, b };
  },
  cagr(filas, campo, n) { const x = Fund.cagrDet(filas, campo, n); return x ? x.v : null; },
  prom(filas, campo, n) { const xs = filas.slice(-n).map(f => f[campo]).filter(Number.isFinite); return xs.length ? sum(xs) / xs.length : null; },
  mediana(xs) { const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
  /** trae todo de Finnhub y lo guarda; devuelve los datos o null */
  async traer(t) {
    const key = (state.settings.finnhubKey || '').trim(); if (!key || !t) return null;
    const s = encodeURIComponent(Precios.simbolo(t));
    // todo pasa por la cola de Finnhub; si alguna llamada choca con el limite, la ficha NO se guarda a medias
    let limite = false;
    const get = async q => { const r = await Finnhub.get(q); if (r.status === 429) limite = true; return r.ok ? r.json : null; };
    const hoy = D.today(); const hasta = D.iso(new Date(D.parse(hoy).getTime() + 200 * 86400000));
    const desdeQ = D.addDays(hoy, -800);
    const previa0 = Fund.de(t);
    // perfil: una vez cada 90 dias (nombre, sector, mercado no cambian); calendario: una consulta al dia para todos
    const perfilViejo = !(previa0 && previa0.nombre && previa0.perfilAt && Date.now() - previa0.perfilAt < 90 * 86400000);
    const calGlobal = Fund.calendarioFresco();
    // balances oficiales de la SEC (los baja una tarea diaria del repo a sec/<T>.json, mismo formato que Finnhub).
    // Si estan, no se le piden balances a Finnhub (2 consultas menos por ficha y sin sus agujeros: 20-F, 10-K atrasados).
    const sec = await Sec.de(t);
    const [perfil0, met, fin0, cal, finQ0] = await Promise.all([
      perfilViejo ? get(`stock/profile2?symbol=${s}`) : null,
      get(`stock/metric?symbol=${s}&metric=all`),
      // Dos pedidos: los ultimos ~3 10-K (ROIC y base del TTM, siempre chico) y la historia desde 2008 (CAGR 5 y 10 anios).
      // Si el historico llegara cortado, el ROIC actual igual sale del reciente.
      Promise.all([get(`stock/financials-reported?symbol=${s}&freq=annual&from=${D.addDays(hoy, -1150)}&to=${hoy}`), get(`stock/financials-reported?symbol=${s}&freq=annual&from=2008-01-01&to=${D.addDays(hoy, -1100)}`)])
        .then(([a, b]) => a || b ? { data: [...((a && a.data) || []), ...((b && b.data) || [])] } : null),
      calGlobal ? null : get(`calendar/earnings?from=${hoy}&to=${hasta}&symbol=${s}`),
      get(`stock/financials-reported?symbol=${s}&freq=quarterly&from=${desdeQ}&to=${hoy}`),
    ]);
    if (limite) return null;
    // Finnhub trae el balance tal cual se presenta (lo que contrastamos con TradingView); la SEC completa lo que a Finnhub le falta:
    // anios nuevos que todavia no cargo (MSFT FY2026), empresas con 20-F (ASML, NU, VIST) e historia larga
    const fin = Sec.mezclar(fin0, sec && sec.annual), finQ = Sec.mezclar(finQ0, sec && sec.quarterly);
    const perfil = perfil0 || (previa0 && previa0.nombre ? { name: previa0.nombre, finnhubIndustry: previa0.sector, exchange: previa0.mercado, marketCapitalization: null, _viejo: true } : null);
    const vacio = x => !x || (typeof x === 'object' && !Object.keys(x).length) || (x.metric && !Object.keys(x.metric).length && !(x.series && Object.keys(x.series).length));
    // Finnhub no tiene nada de este ticker (OTC, Brasil): se marca y no se reintenta por 30 dias
    if (vacio(perfil0) && !(previa0 && previa0.nombre) && vacio(met) && !(fin && fin.data && fin.data.length)) { state.cartera.fundSinDatos = state.cartera.fundSinDatos || {}; state.cartera.fundSinDatos[t] = Date.now(); return null; }
    if (!perfil && !met && !fin) return null;
    // Si Finnhub corto por limite (la llamada falla, no viene vacia), la ficha nueva esta incompleta.
    // Metricas es el nucleo: sin ellas se conserva la anterior o se guarda marcada vieja para reintentar.
    // Balances SEC: sin ellos se conserva la anterior buena; si no habia, se guarda igual, porque hay
    // empresas que no presentan a la SEC (ASML, TSM) y reintentar para siempre no trae nada.
    const previa = Fund.de(t);
    if (!met && previa) return previa;
    if (!fin && previa && !previa.parcial) return previa;
    const m = (met && met.metric) || {}; const serie = (met && met.series && met.series.annual) || {};
    let filas = Fund.anios(fin);
    // CEG: Finnhub trae los 10-K de la subsidiaria (Constellation Energy Generation LLC): ventas distintas a las de la empresa que cotiza
    const llc = (() => { const ds = (fin && fin.data || []).filter(x => x.report && x.report.bs).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate))); const bs0 = ds[0] && ds[0].report.bs; if (!bs0) return false; const cs = bs0.map(x => Fund._c(x)); return !cs.includes('StockholdersEquity') && !cs.includes('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest') && cs.some(c => /MembersEquity/.test(c)); })();
    if (llc) filas = [];
    // sin un 10-K de los ultimos 2 anios, los balances no representan a la empresa de hoy: se descartan (manda Finnhub)
    if (filas.length && filas[filas.length - 1].anio < Number(hoy.slice(0, 4)) - 2) filas = [];
    // las series de Finnhub vienen de la mas nueva a la mas vieja: se ordenan antes de cortar los ultimos N años
    // ojo: Finnhub manda v: null en los anios con perdida (AMZN 2022, MU 2023) y Number(null) es 0: se descartan antes
    const serieK = k => (Array.isArray(serie[k]) ? serie[k] : []).filter(x => x && x.period).sort((a, b) => String(a.period).localeCompare(String(b.period))).map(x => x.v == null || x.v === '' ? NaN : Number(x.v));
    const hist = k => serieK(k).filter(Number.isFinite);
    const prom5 = k => { const xs = hist(k).slice(-5); return xs.length >= 3 ? sum(xs) / xs.length : null; };
    // multiplos: los ultimos 10 ejercicios, solo los positivos (un P/E negativo o sin dato no es un P/E); hacen falta 3
    const pos10 = k => serieK(k).slice(-10).filter(v => Number.isFinite(v) && v > 0);
    const med10 = k => { const xs = pos10(k); return xs.length >= 3 ? Fund.mediana(xs) : null; };
    const peHist = pos10('pe');
    const bal = calGlobal ? Fund.calDe(t) : cal && cal.earningsCalendar && cal.earningsCalendar.length ? cal.earningsCalendar.slice().sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const d = {
      at: Date.now(), ticker: t, v: Fund.VERSION, fuenteBal: sec ? (fin0 && fin0.data && fin0.data.length ? 'finnhub+sec' : 'sec') : 'finnhub', moneda: sec && !(fin0 && fin0.data && fin0.data.length) ? sec.moneda || 'USD' : 'USD',
      nombre: perfil && perfil.name || null, sector: perfil && perfil.finnhubIndustry || null,
      capUSD: perfil && perfil.marketCapitalization ? perfil.marketCapitalization * 1e6 : (m0 => Number(m0.marketCapitalization) ? Number(m0.marketCapitalization) * 1e6 : (previa0 ? previa0.capUSD : null))((met && met.metric) || {}),
      perfilAt: perfil && !perfil._viejo ? Date.now() : (previa0 ? previa0.perfilAt : null),
      max52: m['52WeekHigh'] != null ? Number(m['52WeekHigh']) : null, min52: m['52WeekLow'] != null ? Number(m['52WeekLow']) : null,
      pe: Number(m.peTTM ?? m.peBasicExclExtraTTM) || null, peMediana: peHist.length >= 3 ? Fund.mediana(peHist) : null, peN: peHist.length,
      pb: Number(m.pbQuarterly ?? m.pbAnnual) || null, peg: Number(m.pegTTM ?? m.pegRatio) || null,
      roe: Number(m.roeTTM ?? m.roeRfy) / 100 || null, roa: Number(m.roaTTM ?? m.roaRfy) / 100 || null,
      margenNeto: Number(m.netProfitMarginTTM) / 100 || null, margenNeto5: Number(m.netProfitMargin5Y) / 100 || null,
      margenBruto: Number(m.grossMarginTTM) / 100 || null, margenOper: Number(m.operatingMarginTTM) / 100 || null,
      deudaPat: Number(m['totalDebt/totalEquityQuarterly'] ?? m['totalDebt/totalEquityAnnual']) || null,
      yieldDiv: Number(m.dividendYieldIndicatedAnnual ?? m.currentDividendYieldTTM) / 100 || null,
      divCrec5: Number(m.dividendGrowthRate5Y) / 100 || null, payout: Number(m.payoutRatioTTM) / 100 || null,
      crecVentas5: Number(m.revenueGrowth5Y) / 100 || null, crecEps5: Number(m.epsGrowth5Y) / 100 || null, roiFinnhub: Number(m.roiTTM) / 100 || null,
      beta: Number(m.beta) || null,
      roe5: Number(m.roe5Y) / 100 || null, margenBruto5: Number(m.grossMargin5Y) / 100 || null, margenOper5: Number(m.operatingMargin5Y) / 100 || null,
      currentRatio: Number(m.currentRatioQuarterly ?? m.currentRatioAnnual) || null, currentRatio5: prom5('currentRatio'),
      quickRatio: Number(m.quickRatioQuarterly ?? m.quickRatioAnnual) || null, quickRatio5: prom5('quickRatio'),
      deudaPat5: prom5('totalDebtToEquity'),
      ps: Number(m.psTTM ?? m.psAnnual) || null, psMed: med10('ps'),
      pfcf: Number(m.pfcfShareTTM ?? m.pfcfShareAnnual) || null, pfcfMed: med10('pfcf'), pbMed: med10('pb'),
      interesCob: Number(m.netInterestCoverageTTM ?? m.netInterestCoverageAnnual) || null,
      balance: bal ? { fecha: bal.date, hora: bal.hour || '', epsEst: bal.epsEstimate ?? null, trimestre: bal.quarter ?? null } : null,
      filas: filas.slice(-12).map(f => ({ anio: f.anio, ventas: f.ventas, neto: f.neto, eps: f.eps, fcf: f.fcf, acciones: f.acciones, roic: f.roic, capital: f.capital ? f.capital.total : null })),
    };
    // calculados sobre los balances reportados a la SEC (lo que Finnhub no da hecho)
    d.avisos = [];
    d.cagrVentas5 = Fund.cagr(filas, 'ventas', 5); d.cagrNeto5 = Fund.cagr(filas, 'neto', 5);
    d.cagrVentas10 = Fund.cagr(filas, 'ventas', 10); d.cagrNeto10 = Fund.cagr(filas, 'neto', 10);
    d.cagrFcf5 = Fund.cagr(filas, 'fcf', 5); d.cagrAcc5 = Fund.cagr(filas, 'acciones', 5);
    { const xs = filas.slice(-5).filter(f => f.neto > 0 && Number.isFinite(f.fcf)).map(f => f.fcf / f.neto).filter(x => Math.abs(x) <= 15); d.fcfSobreNeto5 = xs.length >= 3 ? sum(xs) / xs.length : null; }
    { const u = filas[filas.length - 1]; d.netCash = u && u.capital && (u.caja != null || u.invCorto != null) ? (u.caja || 0) + (u.invCorto || 0) - (u.capital.deudaTotal != null ? u.capital.deudaTotal : u.capital.deuda) : null; }
    // EPS: ganancia / acciones diluidas de cada 10-K, con las acciones ajustadas por splits (Fund.anios). El de Finnhub no se usa:
    // no se puede verificar y mezcla periodos. Si no hay acciones en alguno de los dos anios -> "—"
    d.cagrEps5 = Fund.cagr(filas, 'eps', 5); d.epsFuente = d.cagrEps5 != null ? 'balances' : null;
    d.cagrEps10 = Fund.cagr(filas, 'eps', 10);
    d.cagrDet = Object.fromEntries(['ventas', 'neto', 'eps', 'fcf', 'acciones'].map(c => [c, Fund.cagrDet(filas, c, 5)]));
    // ROIC (formula de TradingView): ganancia neta / capital total promedio. Actual = ultimos 12 meses (10-K + 10-Q),
    // si no el ultimo anual, si no el ROI que calcula Finnhub. Promedio 5 anios con la misma formula.
    const trims = Fund.trimestres(finQ); const ttm = Fund.ttm(filas, trims);
    const u = filas[filas.length - 1];
    let roic = null, fuente = null, cuenta = null;
    const base = (c, cp) => c && cp ? (c + cp) / 2 : c;
    // ROIC como TradingView: "Current" = ganancia de los ultimos 12 meses / capital promedio (hoy y hace un anio);
    // si no hay trimestres, el del ultimo ejercicio (columna FY). Se guardan los dos.
    const pvA = filas[filas.length - 2]; const cpA = u && pvA && pvA.anio === u.anio - 1 && pvA.capital ? pvA.capital.total : null;
    d.roicFY = u && u.roic != null ? u.roic : null; d.roicFYanio = u ? u.anio : null;
    d.roicTTM = null;
    if (ttm && ttm.base === 'ttm') { const r = Fund.roicTV(ttm.neto, ttm.capital, ttm.capitalPrev); d.roicTTM = r; if (r != null) { roic = r; fuente = 'ttm'; const cp = ttm.capitalPrev ? ttm.capitalPrev.total : null; cuenta = { neto: ttm.neto, hasta: ttm.hasta, capital: ttm.capital.total, capitalPrev: cp, base: base(ttm.capital.total, cp) }; } }
    if (roic == null && d.roicFY != null) { roic = d.roicFY; fuente = 'anual'; cuenta = { neto: u.neto, hasta: u.fin, capital: u.capital.total, capitalPrev: cpA, base: base(u.capital.total, cpA) }; }
    // sin balances de la SEC (ASML, NU, VIST presentan 20-F) el ROI de Finnhub no sirve como ROIC: NU daba 6 % contra 25 % de TradingView
    if (roic == null && filas.length) { const f = Number(m.roiTTM) / 100; if (Number.isFinite(f) && f !== 0 && Math.abs(f) <= 3) { roic = f; fuente = 'finnhub'; } }
    if (roic == null && u && u.capital && !(u.capital.total > 0)) d.avisos.push('ROIC: capital total negativo (recompras); TradingView tampoco lo publica');
    d.roicAct = roic; d.roicFuente = fuente; d.roicCuenta = cuenta;
    // ultimos 12 meses para los multiplos propios (Fund.mult)
    if (u) { const T = c => Fund.ttmCampo(filas, trims, c); const ve = T('ventas'), ne = T('neto'), cfo = T('cfo'), cpx = T('capex'), dv = T('div'), rc = T('recompra');
      const qa = trims.filter(q => q.acciones > 0 && q.fin > u.fin); const acc = qa.length ? qa[qa.length - 1].acciones : u.acciones;
      d.ttm = { hasta: (ne || ve || {}).hasta || u.fin, base: ne && ne.base, ventas: ve && ve.v, neto: ne && ne.v, fcf: cfo && cpx && cfo.base === cpx.base ? cfo.v - cpx.v : null, div: dv && dv.v, recompra: rc && rc.v, acciones: acc || null }; }
    d.pxCap = state.cartera.precios[t] && state.cartera.precios[t].c || null;
    // deuda / patrimonio como TradingView: deuda total (corto + largo + leases) / patrimonio del ultimo balance (trimestral si hay)
    { const qs = trims.filter(q => q.capital && q.capital.deudaTotal != null); const ultQ = qs[qs.length - 1];
      const cap = ultQ && (!u || ultQ.fin >= u.fin) ? ultQ.capital : (u && u.capital);
      if (cap && cap.deudaTotal != null && cap.patrimonio > 0) { d.deudaPatFinnhub = d.deudaPat; d.deudaPat = cap.deudaTotal / cap.patrimonio; }
      else if (cap && cap.patrimonio != null && cap.patrimonio <= 0) { d.deudaPatFinnhub = d.deudaPat; d.deudaPat = null; d.roe = null; d.roe5 = null; d.avisos.push('Patrimonio negativo (recompras): ROE y deuda / patrimonio no tienen sentido'); } }
    const roics = filas.filter(f => f.roic != null).slice(-5).map(f => f.roic);
    d.roicProm5 = roics.length >= 3 ? sum(roics) / roics.length : (Number(m.roi5Y) / 100 || null);
    d.roicProm5Fuente = roics.length >= 3 ? 'sec' : (d.roicProm5 != null ? 'finnhub' : null);
    d.roicSerie = filas.slice(-10).filter(f => f.roic != null).map(f => ({ anio: f.anio, roic: f.roic }));
    d.fcfSobreNeto = u && u.fcf != null && u.neto ? u.fcf / u.neto : null;
    if (d.fcfSobreNeto != null && Math.abs(d.fcfSobreNeto) > 15) { d.avisos.push(`Caja libre / ganancia: ${Math.round(d.fcfSobreNeto)}x no es creible; se oculta`); d.fcfSobreNeto = null; }
    // rango de 52 semanas: Finnhub a veces manda el de otro listado (BRK-A por BRK-B, VIST en pesos mexicanos, TSM en Taiwan)
    const px = state.cartera.precios[t] && state.cartera.precios[t].c;
    if (d.min52 != null && d.max52 != null && px && (px < d.min52 * 0.8 || px > d.max52 * 1.2 || d.max52 / d.min52 > 20)) { d.avisos.push(`Rango 52 semanas: ${Math.round(d.min52)}\u2013${Math.round(d.max52)} no corresponde a este listado; se oculta`); d.min52 = d.max52 = null; }
    const accIni = filas.filter(f => f.acciones).slice(0, 1)[0], accFin = filas.filter(f => f.acciones).slice(-1)[0];
    d.accionesCambio = accIni && accFin && accIni.acciones && accIni.anio !== accFin.anio ? { desde: accIni.anio, hasta: accFin.anio, pct: accFin.acciones / accIni.acciones - 1 } : null;
    d.aniosDatos = filas.length ? { desde: filas[0].anio, hasta: filas[filas.length - 1].anio } : null;
    // Contrastado con TradingView (28-sep, 16 tenencias). Lo que no se puede dejar igual, no se muestra:
    d.sec = filas.length > 0;
    if (llc) d.avisos.push('Finnhub trae los balances de una subsidiaria, no de la empresa que cotiza: sin ventas, ROIC ni m\u00e1rgenes');
    // margen neto del ultimo ejercicio (ganancia / ventas del 10-K): coincide con la columna del a\u00f1o de TradingView. El TTM de Finnhub no (corta en otra fecha)
    { const conM = filas.filter(f => f.ventas > 0 && f.neto != null); const uM = conM[conM.length - 1];
      d.margenNeto = uM && uM.anio === (u && u.anio) ? uM.neto / uM.ventas : null; d.margenNetoAnio = d.margenNeto != null ? uM.anio : null;
      const ult5 = conM.slice(-5).map(f => f.neto / f.ventas); d.margenNeto5 = ult5.length >= 3 ? sum(ult5) / ult5.length : null; }
    // margen bruto y operativo del ultimo ejercicio, con la misma cuenta que TradingView (columna del anio). Si el balance no los trae, el TTM de Finnhub
    { const pr = (campo) => { const xs = filas.filter(f => f.ventas > 0 && f[campo] != null); const uu = xs[xs.length - 1]; if (!uu || uu.anio !== (u && u.anio)) return null; const ult5 = xs.slice(-5).map(f => f[campo] / f.ventas); return { v: uu[campo] / uu.ventas, p5: ult5.length >= 3 ? sum(ult5) / ult5.length : null }; };
      const mb = pr('bruto'); if (mb) { d.margenBruto = mb.v; d.margenBruto5 = mb.p5; d.margenBrutoFY = true; }
      const mo = pr('operativo'); if (mo) { d.margenOper = mo.v; d.margenOper5 = mo.p5; d.margenOperFY = true; } }
    // Empresas con 20-F (solo balances de la SEC, sin Finnhub ni 10-Q): TradingView calcula ROIC y ROE distinto (ASML 43 vs 51, ROE 50 vs 54)
    // -> no se muestran; ventas, ganancia, margenes y crecimiento si (son cuentas directas del balance)
    d.solo20F = !!(sec && !(fin0 && fin0.data && fin0.data.length) && !trims.length);
    if (d.solo20F) d.avisos.push('Empresa extranjera (20-F): ventas, ganancia y m\u00e1rgenes salen de la SEC; ROIC y ROE no se muestran porque no se pueden igualar a TradingView');
    if (d.solo20F) { d.roicAct = d.roicFY = d.roicTTM = d.roicProm5 = null; d.roicFuente = null; d.roicCuenta = null; d.roicSerie = []; }
    // ROE: el TTM de Finnhub coincide con TradingView para las empresas con 10-Q. Las que presentan 20-F (sin trimestres) -> ROE del ejercicio propio
    if (d.solo20F) { d.roe = d.roe5 = null; }
    else if (d.sec && !trims.length && u && u.neto != null && u.patrimonio > 0) { const pv = filas[filas.length - 2]; const pp = pv && pv.anio === u.anio - 1 && pv.patrimonio > 0 ? (u.patrimonio + pv.patrimonio) / 2 : u.patrimonio; d.roe = u.neto / pp; d.roeFY = true; d.roe5 = null; }
    // sin balances de la SEC (20-F, subsidiaria): ROE y margenes de Finnhub no coinciden con TradingView (ASML ROE 41 vs 54) -> fuera
    if (!d.sec) { d.roe = null; d.roe5 = null; d.margenBruto = d.margenBruto5 = d.margenOper = d.margenOper5 = null; }
    // deuda / patrimonio y caja neta: los leases financieros (MSFT) y deudas propias (pagos con tarjeta de MELI) no vienen como renglon
    // del balance en Finnhub, asi que no se pueden igualar a TradingView -> no se muestran
    d.deudaPatFinnhub = d.deudaPatFinnhub ?? d.deudaPat; d.deudaPat = null; d.netCash = null;
    // dividendo anual por accion: el yield se calcula con el precio de hoy (el de Finnhub venia con un precio viejo: IBM 4,3 % vs 2,3 %)
    d.divAnual = Number(m.dividendIndicatedAnnual ?? m.dividendPerShareAnnual) || null;
    // control automatico: que un numero raro se vea en la ficha y en el export en vez de pasar como bueno
    { const ult = filas[filas.length - 1]; const anioHoy = Number(hoy.slice(0, 4));
      if (!filas.length) { if (!llc) d.avisos.push('Sin balances de la SEC (empresa extranjera, presenta 20-F): Finnhub no trae datos verificables de ROIC, ROE ni m\u00e1rgenes, as\u00ed que no se muestran'); }
      else { if (ult.fin && D.daysBetween(ult.fin, hoy) > 400) d.avisos.push(`${d.solo20F ? 'La SEC todav\u00eda no public\u00f3 en datos el 20-F' : 'Todav\u00eda no est\u00e1 el balance anual'} posterior a ${D.fmt(ult.fin, { year: true })}: el a\u00f1o fiscal que ves es ${ult.anio}${d.roicFuente === 'ttm' ? ` (el ROIC actual usa trimestres hasta ${D.fmt(d.roicCuenta.hasta, { year: true })})` : ''}`); if (ult.ventas == null) d.avisos.push(`Ventas ${ult.anio}: no se encontr\u00f3 el concepto en el balance`); }
      const fh = Number(m.roiTTM) / 100;
      if (d.roicFuente !== 'finnhub' && d.roicAct != null && Number.isFinite(fh) && fh > 0.02 && d.roicAct > 0 && (d.roicAct / fh > 2.5 || fh / d.roicAct > 2.5)) d.avisos.push(`ROIC ${Math.round(d.roicAct * 1000) / 10} % vs ROI de Finnhub ${Math.round(fh * 1000) / 10} %: diferencia grande, revisar`); }
    if (!state.cartera.fund) state.cartera.fund = {};
    if (!met) { d.parcial = true; d.at = Date.now() - 31 * 86400000; }
    state.cartera.fund[t] = d;
    try { window.dispatchEvent(new CustomEvent('fund-listo', { detail: t })); } catch (e) {}
    if (state.cartera.fundSinDatos) delete state.cartera.fundSinDatos[t];
    Persist.save();
    return d;
  },
  /** respuestas crudas de Finnhub (recortadas) para revisar una cuenta contra TradingView */
  async crudo(t) {
    const key = (state.settings.finnhubKey || '').trim(); if (!key || !t) return null;
    const s = encodeURIComponent(Precios.simbolo(t)); const hoy = D.today();
    const get = async q => { try { const r = await fetch(`https://finnhub.io/api/v1/${q}&token=${encodeURIComponent(key)}`, { cache: 'no-store' }); if (!r.ok) return { error: r.status }; return await r.json(); } catch (e) { return { error: String(e) }; } };
    const [met, fin, finQ] = await Promise.all([get(`stock/metric?symbol=${s}&metric=all`), get(`stock/financials-reported?symbol=${s}&freq=annual&from=${D.addDays(hoy, -2200)}&to=${hoy}`), get(`stock/financials-reported?symbol=${s}&freq=quarterly&from=${D.addDays(hoy, -800)}&to=${hoy}`)]);
    const recorte = fin => fin && Array.isArray(fin.data) ? fin.data.map(d => ({ year: d.year, quarter: d.quarter, form: d.form, startDate: d.startDate, endDate: d.endDate, ic: (d.report && d.report.ic || []).filter(x => /Revenue|Sales|NetIncome|ProfitLoss|OperatingIncome|EarningsPerShare|IncomeTax|Shares/.test(x.concept)).map(x => [x.concept, x.value]), bs: (d.report && d.report.bs || []).filter(x => /Equity|Debt|Borrow|CommercialPaper|Lease|Cash|Minority|Noncontrolling/.test(x.concept)).map(x => [x.concept, x.value]), cf: (d.report && d.report.cf || []).filter(x => /OperatingActivities|PaymentsToAcquire|Capital/.test(x.concept)).map(x => [x.concept, x.value]) })) : fin;
    return { ticker: t, fecha: hoy, calculado: Fund.de(t), metric: met && met.metric, seriesAnual: met && met.series && met.series.annual ? Object.fromEntries(Object.entries(met.series.annual).filter(([k]) => /pe|roi|roe|eps/i.test(k))) : null, anual: recorte(fin), trimestral: recorte(finQ) };
  },
  /** Barata contra su propia historia (Facu: "GOOGL con P/E 17 contra su historia, como no lo vimos"):
   *  P/E de hoy al menos 20 % por debajo de su mediana de 10 anios, en una empresa de calidad (ROIC >= 12 % o ROE >= 15 %). */
  /** P/E de hoy: el propio (precio de hoy x acciones diluidas / ganancia de los ultimos 12 meses de la SEC; coincide con
   *  TradingView: MELI 47,7 vs 47,69, MSFT 28,8 vs 28,76) y si no se puede, el de Finnhub. Solo si Finnhub tambien tiene P/E:
   *  asi un ETF o fideicomiso (GLD) que presenta 10-K no muestra un P/E sin sentido */
  pe(t, d = Fund.de(t)) {
    if (!d || !(d.pe > 0)) return null;
    const m = Fund.mult(t, d); return m.pe > 0 ? m.pe : d.pe;
  },
  barata(t, d = Fund.de(t)) {
    const pe = Fund.pe(t, d);
    if (!d || !(pe > 0) || !(d.peMediana > 0)) return null;
    const desc = 1 - pe / d.peMediana; if (desc < 0.2) return null;
    if (d.peN != null && d.peN < 7) return null;  // poca historia (GEV): la mediana no dice nada
    // confirmacion con ventas o caja libre: si el P/E baja por una ganancia extraordinaria (AMZN, inversiones) y P/S o P/FCF
    // no estan baratos contra su historia, no cuenta
    const mu = Fund.mult(t, d); const otros = [[mu.ps ?? d.ps, d.psMed], [mu.pfcf ?? d.pfcf, d.pfcfMed]].filter(([v, m]) => v > 0 && m > 0).map(([v, m]) => 1 - v / m);
    if (otros.length && !otros.some(x => x >= 0.15)) return null;
    const calidad = (d.roicAct != null && d.roicAct >= 0.12) || (d.roe != null && d.roe >= 0.15);
    if (!calidad) return null;
    return { pe, med: d.peMediana, desc };
  },
  baratas(tickers) { return tickers.map(t => ({ t, b: Fund.barata(t) })).filter(x => x.b).sort((a, b) => b.b.desc - a.b.desc); },
  /** dividend yield con el precio de hoy */
  yieldDe(t, d = Fund.de(t)) { if (!d) return null; const px = state.cartera.precios[t] && state.cartera.precios[t].c; if ((d.v || 1) >= 5) return d.divAnual && px ? d.divAnual / px : null; return d.yieldDiv || null; },
  /** cuanto dura una ficha: tenencias y A 7 dias, B 30, C / Ciclica / Especulativa 90 */
  /** sube cuando cambia como se arma la ficha: las anteriores se rehacen solas */
  VERSION: 9,
  ttl(t, tengo) { const tier = Tier.de(t); return (tengo || tier === 'A' ? 7 : tier === 'B' ? 30 : 90) * 86400000; },
  sinDatos(t) { const x = (state.cartera.fundSinDatos || {})[t]; return !!(x && Date.now() - x < 30 * 86400000); },
  /** fichas pendientes, en orden: cerca de zona, tenencias, A, B, C/Ciclica, Especulativa. Vence por tiempo (segun tier)
   *  o porque ya paso su balance (los numeros nuevos llegan ahi). */
  pendientes() {
    const tengo = new Set(E.cartera().posiciones.map(p => p.ticker)); const hoy = D.today();
    const plan = Precios.plan().filter(x => x.t !== 'SPY'); const orden = new Map(plan.map((x, i) => [x.t, i]));
    // los "sin fuente" de precio tambien se intentan (algunos OTC tienen fundamentales)
    const todos = [...new Set([...plan.map(x => x.t), ...Precios.tickers().filter(t => t !== 'SPY')])];
    return todos.filter(t => {
      if (Fund.sinDatos(t)) return false;
      const d = Fund.de(t); if (!d || d.parcial || (d.v || 1) < Fund.VERSION) return true;
      if (Date.now() - d.at > Fund.ttl(t, tengo.has(t))) return true;
      const b = Fund.calDe(t) || d.balance; if (b && b.fecha && b.fecha < hoy && d.at < D.parse(b.fecha).getTime() + 3 * 86400000 && Date.now() - D.parse(b.fecha).getTime() > 3 * 86400000) return true;
      return false;
    }).sort((a, b) => (orden.has(a) ? orden.get(a) : 1e6) - (orden.has(b) ? orden.get(b) : 1e6));
  },
  /** calendario de balances de TODO el mercado: una consulta por dia; se guardan solo los tickers que seguis */
  calendarioFresco() { const c = state.cartera.calendario; return !!(c && c.ok && Date.now() - c.at < 26 * 3600000); },
  calDe(t) { const c = state.cartera.calendario; if (!c || !c.ok) return null; const x = c.map[Precios.simbolo(t)] || c.map[t]; return x || null; },
  /** calendario de balances. Finnhub corta la respuesta en ~1.000 entradas y se queda con las fechas MAS LEJANAS
   *  (pedido de 75 dias devolvia solo del 17-nov en adelante: sin balances cercanos). Se pide dia por dia (60 consultas,
   *  una vez por dia) y sigue donde quedo si se corta. */
  async calendario() {
    const hoy = D.today(); let c = state.cartera.calendario;
    if (c && c.ok && Date.now() - c.at < 24 * 3600000) return;
    if (!c || c.hoy !== hoy || !c.hechos) c = state.cartera.calendario = { at: 0, ok: false, hoy, map: {}, hechos: {}, cortados: [] };
    const seguir = new Set(Precios.tickers().map(Precios.simbolo));
    for (let i = 0; i < 60; i++) {
      const dia = D.addDays(hoy, i); if (c.hechos[dia]) continue;
      if (document.hidden) return;
      const r = await Finnhub.get(`calendar/earnings?from=${dia}&to=${dia}`);
      if (!r.ok) return;  // 429 o error: sigue la proxima vuelta
      const lista = r.json && Array.isArray(r.json.earningsCalendar) ? r.json.earningsCalendar : [];
      if (lista.length >= 990) c.cortados.push(dia);
      for (const e of lista) if (e && e.symbol && seguir.has(e.symbol) && e.date >= hoy && (!c.map[e.symbol] || e.date < c.map[e.symbol].date)) c.map[e.symbol] = { fecha: e.date, date: e.date, hour: e.hour || '', hora: e.hour || '', epsEstimate: e.epsEstimate ?? null, epsEst: e.epsEstimate ?? null, quarter: e.quarter ?? null, trimestre: e.quarter ?? null };
      c.hechos[dia] = 1; Persist.save();
    }
    c.at = Date.now(); c.ok = true; Persist.save(); Motor.pintar();
  },
  /** compat: el export y la precarga vieja la llaman */
  async actualizarCartera(max = 8) { let n = 0; for (const t of Fund.pendientes().slice(0, max)) { try { if (await Fund.traer(t)) n++; } catch (e) {} } return n; },
  calentar() { return Motor.arrancar(); },
  /** próximo balance de un ticker, si está guardado: {fecha, dias} */
  /** balance "cerca": 14 dias antes si la tenes en cartera, 7 si solo la vigilas (Facu) */
  balanceCerca(t, tengo) { const b = Fund.balance(t); return b && b.dias <= (tengo ? 14 : 7) ? b : null; },
  balance(t) { const d = Fund.de(t); const b = Fund.calDe(t) || (d && d.balance); if (!b || !b.fecha) return null; const dias = D.daysBetween(D.today(), b.fecha); return dias >= 0 ? { ...b, dias } : null; },
};

/* ---------- Motor: mantiene al dia precios y fichas mientras la app esta abierta ----------
 * No guarda una cola aparte: en cada vuelta mira que esta vencido (por la fecha de lo ultimo que se bajo),
 * asi que si iOS frena la app, al volver sigue donde quedo. Primero precios vencidos, despues el
 * calendario del dia, despues una ficha; se repite. Con todo al dia, revisa cada minuto. */
const Motor = {
  _run: null, _ultimoRender: 0,
  arrancar() {
    if (Motor._run) return Motor._run;
    Motor._run = (async () => {
      if (Tec.dia !== D.today()) { await Tec.cargar(); Motor.pintar(); }
      for (;;) {
        if (document.hidden || !(state.settings.finnhubKey || '').trim() || window.claude) break;
        const venc = Precios.vencidos();
        if (venc.length) { let ok = 0; for (const x of venc.slice(0, 20)) { if (document.hidden) break; if (await Precios.quote(x.t) != null) ok++; } if (ok) Precios._despues(ok, venc.length); Motor.pintar(); continue; }
        await Fund.calendario();
        const pend = Fund.pendientes();
        if (pend.length) { try { await Fund.traer(pend[0]); } catch (e) {} Motor.pintar(); continue; }
        await new Promise(r => setTimeout(r, 60000));
      }
    })().finally(() => { Motor._run = null; });
    return Motor._run;
  },
  /** repinta Cartera como mucho cada 8 s (y nunca con una ficha o un form abierto) */
  pintar() {
    if (Date.now() - Motor._ultimoRender < 8000) return; Motor._ultimoRender = Date.now();
    try { if (ui.view === 'cartera' && !$('#overlay').classList.contains('open')) render(); } catch (e) {}
  },
  /** para el indicador: cuantas fichas al dia y cuanto falta */
  progreso() {
    const ts = Precios.tickers().filter(t => t !== 'SPY'); const pend = new Set(Fund.pendientes());
    const sinDatos = ts.filter(t => Fund.sinDatos(t)); const total = ts.length - sinDatos.length;
    const faltan = ts.filter(t => pend.has(t)).length; const min = Math.ceil(faltan * 4 / 45);
    const sinFuente = ts.filter(t => Precios.sinFuente(t));
    const conPrecio = ts.filter(t => { const q = state.cartera.precios[t]; return q && q.c && !Precios.sinFuente(t); }).length;
    return { total, alDia: total - faltan, faltan, min, sinDatos, sinFuente, conPrecio, totalPrecio: ts.length - sinFuente.length };
  },
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
  le: '<svg class="g" viewBox="0 0 24 24"><path d="M18.5 5.5L6 11.3l12.5 5.8"/><path d="M6 20.4h12.5"/></svg>',
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
