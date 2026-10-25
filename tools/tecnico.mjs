// Medias moviles de 200 dias para las empresas con CEDEAR (Facu: "cuando toca la EMA de 200 pasa pocas veces").
// Corre en GitHub Actions: baja precios diarios (Stooq, si falla Yahoo) y deja sec/tecnico.json.
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (flujo-app)';
async function stooq(t) {
  const s = t.toLowerCase().replace('.', '-') + '.us';
  const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null; const txt = await r.text(); if (!/^Date,/.test(txt)) return null;
  // Stooq: cierre sin ajustar por dividendos (r = c)
  const filas = txt.trim().split('\n').slice(1).map(l => l.split(',')).map(c => ({ d: c[0], c: Number(c[4]), r: Number(c[4]) })).filter(x => x.d && Number.isFinite(x.c) && x.c > 0);
  return filas.length > 250 ? filas : null;
}
async function yahoo(t, conDivs = false) {
  const s = t.replace('.', '-');
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=12y&interval=1d&events=${conDivs ? 'div%7Csplit' : 'split'}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null; const j = await r.json(); const res = j && j.chart && j.chart.result && j.chart.result[0]; if (!res) return null;
  // c = cierre ajustado por splits y dividendos (para EMA, TWR); r = cierre ajustado solo por splits (para valuar la cartera un dia dado)
  const ts = res.timestamp || [], raw = res.indicators.quote[0].close, adj = (res.indicators.adjclose && res.indicators.adjclose[0].adjclose) || raw;
  const filas = ts.map((x, i) => ({ d: new Date(x * 1000).toISOString().slice(0, 10), c: Number(adj[i]), r: Number(raw[i]) })).filter(x => Number.isFinite(x.c) && x.c > 0 && Number.isFinite(x.r) && x.r > 0);
  if (filas.length <= 250) return null;
  if (conDivs) { const dv = res.events && res.events.dividends || {}; filas.divs = {}; for (const e of Object.values(dv)) { const d = new Date(e.date * 1000).toISOString().slice(0, 10); if (Number(e.amount) > 0) filas.divs[d] = +Number(e.amount).toFixed(5); } }
  return filas;
}
function analizar(f) {
  // EMA 200 y SMA 200 sobre cierres ajustados; "toques": veces que el cierre bajo a la EMA 200 (o por debajo)
  const k = 2 / 201; let ema = null; const out = [];
  for (let i = 0; i < f.length; i++) { ema = ema == null ? f[i].c : f[i].c * k + ema * (1 - k); out.push(ema); }
  const n = f.length; const u = f[n - 1];
  const sma = f.slice(-200).reduce((a, x) => a + x.c, 0) / Math.min(200, n);
  const desde = new Date(Date.parse(u.d) - 10 * 365.25 * 864e5).toISOString().slice(0, 10);
  // un toque = una bajada de verdad a la EMA: antes tuvo que estar al menos 60 ruedas seguidas arriba y llegar a 10 % arriba
  // (asi los ida y vuelta de una misma correccion cuentan una sola vez). Calibrado: MSFT 5 en 10 anios, SPY 6, KO 4.
  let armado = false, arriba = 0, toques = []; const ini = Math.max(200, f.findIndex(x => x.d >= desde));
  for (let i = ini; i < n; i++) {
    const r = f[i].c / out[i];
    arriba = r > 1 ? arriba + 1 : 0;
    if (r >= 1.10 && arriba >= 60) armado = true;
    else if (armado && r <= 1.0) { toques.push(f[i].d); armado = false; }
  }
  // cuanto estuvo por debajo en los ultimos 10 anios (% de dias)
  let abajo = 0, tot = 0; for (let i = ini; i < n; i++) { tot++; if (f[i].c < out[i]) abajo++; }
  const hace = d => { const x = f.findIndex(y => y.d >= d); return x >= 0 ? out[x] : null; };
  return { fecha: u.d, cierre: +u.c.toFixed(4), ema200: +ema.toFixed(4), sma200: +sma.toFixed(4), ema200hace30: +(out[Math.max(0, n - 22)]).toFixed(4),
    toques10: toques.length, ultimoToque: toques[toques.length - 1] || null, toques: toques.slice(-8), pctAbajo10: tot ? +(abajo / tot).toFixed(3) : null, anios: +((n - ini) / 252).toFixed(1) };
}
const main = async () => {
  const ced = JSON.parse(fs.readFileSync('cedears.json', 'utf8')).cedears;
  const universo = [...new Set([...ced.filter(c => !c.sinUS).map(c => c.us || c.code), 'SPY', 'QQQ'])];
  const out = {}; const series = {}; const dbg = { corrida: new Date().toISOString(), ok: 0, stooq: 0, yahoo: 0, falla: [] };
  // 4 a la vez, con tope de 20 minutos (si una fuente se cuelga no frena todo); Yahoo primero (trae 12 anios ajustados por splits)
  const t0 = Date.now(); let i = 0; let stooqMuerto = false;
  const uno = async t => {
    let f = null, src = null;
    try { f = await yahoo(t, t === 'SPY'); if (f) src = 'yahoo'; } catch (e) {}
    if (!f && !stooqMuerto) { try { f = await stooq(t); if (f) src = 'stooq'; } catch (e) { if (e.name === 'TimeoutError') stooqMuerto = true; } }
    if (!f) { dbg.falla.push(t); return; }
    series[t] = f.filter(x => x.d >= '2025-01-01');  // desde 2025: la app arma el indice diario de la cartera y valua cualquier dia pasado (toda la historia de Facu)
    if (f.divs) series[t].divs = f.divs;
    try { out[t] = analizar(f); dbg.ok++; dbg[src]++; } catch (e) { dbg.falla.push(t + ':' + e.message); }
  };
  await Promise.all([0, 1, 2, 3].map(async () => { while (i < universo.length && Date.now() - t0 < 20 * 60000) { const t = universo[i++]; await uno(t); await sleep(120); } }));
  dbg.segundos = Math.round((Date.now() - t0) / 1000);
  fs.mkdirSync('sec', { recursive: true });
  fs.writeFileSync('sec/tecnico.json', JSON.stringify(out));
  // sec/hist.json: cierres ajustados (splits y dividendos) alineados a las ruedas de SPY, compactos.
  // k[t] = escalones [indice, cierre sin dividendos / cierre ajustado]: cambia solo en cada ex-dividendo, asi el cierre "real"
  // de un dia es c[i] * k (ultimo escalon <= i). spyDivs = dividendos de SPY por ex-fecha (la sombra S&P total return).
  if (series.SPY) {
    const fechas = series.SPY.map(x => x.d); const c = {}, k = {};
    for (const [t, f] of Object.entries(series)) {
      const m = new Map(f.map(x => [x.d, x])); let ult = null; const arr = fechas.map(d => { const v = m.get(d); if (v != null) ult = v; return ult == null ? null : +Number(ult.c).toPrecision(6); });
      if (!arr.some(v => v != null)) continue; c[t] = arr;
      let prev = null; const esc = []; ult = null;
      fechas.forEach((d, i) => { const v = m.get(d); if (v != null) ult = v; if (!ult) return; const q = +(ult.r / ult.c).toFixed(6); if (prev == null || Math.abs(q - prev) > 5e-6) { esc.push([i, q]); prev = q; } });
      if (esc.length && !(esc.length === 1 && Math.abs(esc[0][1] - 1) < 5e-6)) k[t] = esc;
    }
    const spyDivs = Object.fromEntries(Object.entries(series.SPY.divs || {}).filter(([d]) => d >= '2025-01-01').sort());
    fs.writeFileSync('sec/hist.json', JSON.stringify({ generado: new Date().toISOString(), fechas, c, k, spyDivs }));
  }
  fs.writeFileSync('sec/_tecnico_debug.json', JSON.stringify(dbg, null, 1));
  console.log(`ok ${dbg.ok} (stooq ${dbg.stooq}, yahoo ${dbg.yahoo}) · falla ${dbg.falla.length}`);
};
main().catch(e => { console.error(e); process.exit(1); });
