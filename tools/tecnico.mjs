// Medias moviles de 200 dias para las empresas con CEDEAR (Facu: "cuando toca la EMA de 200 pasa pocas veces").
// Corre en GitHub Actions: baja precios diarios (Stooq, si falla Yahoo) y deja sec/tecnico.json.
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (flujo-app)';
async function stooq(t) {
  const s = t.toLowerCase().replace('.', '-') + '.us';
  const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null; const txt = await r.text(); if (!/^Date,/.test(txt)) return null;
  const filas = txt.trim().split('\n').slice(1).map(l => l.split(',')).map(c => ({ d: c[0], c: Number(c[4]) })).filter(x => x.d && Number.isFinite(x.c) && x.c > 0);
  return filas.length > 250 ? filas : null;
}
async function yahoo(t) {
  const s = t.replace('.', '-');
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=12y&interval=1d&events=split`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null; const j = await r.json(); const res = j && j.chart && j.chart.result && j.chart.result[0]; if (!res) return null;
  const ts = res.timestamp || [], adj = (res.indicators.adjclose && res.indicators.adjclose[0].adjclose) || res.indicators.quote[0].close;
  const filas = ts.map((x, i) => ({ d: new Date(x * 1000).toISOString().slice(0, 10), c: Number(adj[i]) })).filter(x => Number.isFinite(x.c) && x.c > 0);
  return filas.length > 250 ? filas : null;
}
function analizar(f) {
  // EMA 200 y SMA 200 sobre cierres ajustados; "toques": veces que el cierre bajo a la EMA 200 (o por debajo) viniendo de
  // al menos 5 % arriba. Un toque nuevo solo cuenta despues de volver a estar 5 % arriba.
  const k = 2 / 201; let ema = null; const out = [];
  for (let i = 0; i < f.length; i++) { ema = ema == null ? f[i].c : f[i].c * k + ema * (1 - k); out.push(ema); }
  const n = f.length; const u = f[n - 1];
  const sma = f.slice(-200).reduce((a, x) => a + x.c, 0) / Math.min(200, n);
  const desde = new Date(Date.parse(u.d) - 10 * 365.25 * 864e5).toISOString().slice(0, 10);
  let armado = false, toques = []; const ini = Math.max(200, f.findIndex(x => x.d >= desde));
  for (let i = ini; i < n; i++) {
    const r = f[i].c / out[i];
    if (r >= 1.05) armado = true;
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
  const series = {}; const out = {}; const dbg = { corrida: new Date().toISOString(), ok: 0, stooq: 0, yahoo: 0, falla: [] };
  // 4 a la vez, con tope de 20 minutos (si una fuente se cuelga no frena todo); Yahoo primero (trae 12 anios ajustados por splits)
  const t0 = Date.now(); let i = 0; let stooqMuerto = false;
  const uno = async t => {
    let f = null, src = null;
    try { f = await yahoo(t); if (f) src = 'yahoo'; } catch (e) {}
    if (!f && !stooqMuerto) { try { f = await stooq(t); if (f) src = 'stooq'; } catch (e) { if (e.name === 'TimeoutError') stooqMuerto = true; } }
    if (!f) { dbg.falla.push(t); return; }
    if (['MSFT','GOOGL','AAPL','KO','MELI','SPY','NVDA','MCD'].includes(t)) series[t] = f.map(x => [x.d, +x.c.toFixed(3)]);
    try { out[t] = analizar(f); dbg.ok++; dbg[src]++; } catch (e) { dbg.falla.push(t + ':' + e.message); }
  };
  await Promise.all([0, 1, 2, 3].map(async () => { while (i < universo.length && Date.now() - t0 < 20 * 60000) { const t = universo[i++]; await uno(t); await sleep(120); } }));
  dbg.segundos = Math.round((Date.now() - t0) / 1000);
  fs.mkdirSync('sec', { recursive: true });
  fs.writeFileSync('sec/tecnico.json', JSON.stringify(out));
  fs.writeFileSync('sec/_tecnico_debug.json', JSON.stringify(dbg, null, 1));
  fs.writeFileSync('sec/_series_debug.json', JSON.stringify(series));
  console.log(`ok ${dbg.ok} (stooq ${dbg.stooq}, yahoo ${dbg.yahoo}) · falla ${dbg.falla.length}`);
};
main().catch(e => { console.error(e); process.exit(1); });
