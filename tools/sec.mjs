// Baja los balances oficiales de la SEC (companyfacts) para todas las empresas con CEDEAR en BYMA
// y los deja en sec/<TICKER>.json con el MISMO formato que Finnhub financials-reported, para que la app
// use su logica de siempre. Corre todos los dias en GitHub Actions (el telefono no puede consultar la SEC: no tiene CORS).
import fs from 'node:fs';
const UA = 'flujo-app facubo2001@gmail.com';
const OUT = 'sec';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (r.status === 404) return null;
    if (r.ok) return r.json();
    await sleep(1500 * (i + 1));
  }
  throw new Error('HTTP error ' + url);
}
// conceptos que usa la app (sin prefijo) + patrones de deuda y leases
const US = new Set(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet',
  'NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic',
  'OperatingIncomeLoss', 'GrossProfit', 'CostOfRevenue', 'CostOfGoodsAndServicesSold', 'IncomeTaxExpenseBenefit',
  'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxes',
  'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'MinorityInterest', 'StockholdersEquityAttributableToNoncontrollingInterest', 'MembersEquity',
  'CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
  'NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets',
  'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic', 'CommonStockSharesOutstanding',
  'CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid', 'PaymentsOfDividends', 'PaymentsOfDividendsCommonStock', 'PaymentsForRepurchaseOfCommonStock',
  'AssetsCurrent', 'LiabilitiesCurrent', 'Assets', 'Liabilities', 'InterestExpense', 'ResearchAndDevelopmentExpense', 'DepreciationDepletionAndAmortization']);
const DEUDA = /Lease\w*Liabilit|Debt|Borrowing|LoansPayable|NotesPayable|CommercialPaper/;
const NO = /Securities|Receivable|Issuance|Repayment|Proceeds|Payment|Amortization|Interest|FairValue|Unamortized|Maturit|Covenant|Instrument|Discount|Premium|Extinguishment|Expense|Cost|Gain|Loss|Weighted|Rate|Increase|Decrease|Conversion|Converted|Excluding|Undiscounted|Future|Due|Payable[A-Z]*Year|Credit/;
// IFRS (ASML, NU, VIST y otros 20-F) -> nombre us-gaap equivalente
const IFRS = {
  Revenue: 'Revenues', RevenueFromContractsWithCustomers: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  ProfitLossAttributableToOwnersOfParent: 'NetIncomeLoss', ProfitLoss: 'ProfitLoss', GrossProfit: 'GrossProfit', ProfitLossFromOperatingActivities: 'OperatingIncomeLoss',
  IncomeTaxExpenseContinuingOperations: 'IncomeTaxExpenseBenefit', ProfitLossBeforeTax: 'IncomeLossFromContinuingOperationsBeforeIncomeTaxes',
  DilutedEarningsPerShare: 'EarningsPerShareDiluted', BasicEarningsPerShare: 'EarningsPerShareBasic',
  AdjustedWeightedAverageShares: 'WeightedAverageNumberOfDilutedSharesOutstanding', WeightedAverageShares: 'WeightedAverageNumberOfSharesOutstandingBasic',
  EquityAttributableToOwnersOfParent: 'StockholdersEquity', Equity: 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', NoncontrollingInterests: 'MinorityInterest',
  NoncurrentPortionOfNoncurrentBorrowings: 'LongTermDebtNoncurrent', LongtermBorrowings: 'LongTermDebtNoncurrent', NoncurrentBorrowings: 'LongTermDebtNoncurrent',
  CurrentPortionOfNoncurrentBorrowings: 'LongTermDebtCurrent', CurrentPortionOfLongtermBorrowings: 'LongTermDebtCurrent',
  ShorttermBorrowings: 'ShortTermBorrowings', CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings: 'DebtCurrent',
  NoncurrentLeaseLiabilities: 'OperatingLeaseLiabilityNoncurrent', CurrentLeaseLiabilities: 'OperatingLeaseLiabilityCurrent',
  CashAndCashEquivalents: 'CashAndCashEquivalentsAtCarryingValue', CurrentInvestments: 'ShortTermInvestments',
  CashFlowsFromUsedInOperatingActivities: 'NetCashProvidedByUsedInOperatingActivities',
  PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: 'PaymentsToAcquirePropertyPlantAndEquipment', PurchaseOfPropertyPlantAndEquipment: 'PaymentsToAcquirePropertyPlantAndEquipment',
  CurrentAssets: 'AssetsCurrent', CurrentLiabilities: 'LiabilitiesCurrent', Assets: 'Assets', Liabilities: 'Liabilities',
  DividendsPaidClassifiedAsFinancingActivities: 'PaymentsOfDividends', PaymentsToAcquireOrRedeemEntitysShares: 'PaymentsForRepurchaseOfCommonStock',
  DividendsRecognisedAsDistributionsToOwnersPerShare: 'CommonStockDividendsPerShareDeclared',
};
const FORMS_A = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '10-KT']);
const FORMS_Q = new Set(['10-Q', '10-Q/A']);
const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
function unidad(units, tipo) {
  const ks = Object.keys(units || {});
  if (tipo === 'eps') return ks.find(k => /\/shares$/.test(k));
  if (tipo === 'shares') return ks.find(k => k === 'shares');
  return ks.includes('USD') ? 'USD' : ks.find(k => /^[A-Z]{3}$/.test(k));
}
function extraer(j) {
  const facts = j.facts || {}; const filings = new Map(); let moneda = null;
  const add = (nombre, item) => {
    if (!item.accn || !(FORMS_A.has(item.form) || FORMS_Q.has(item.form))) return;
    let f = filings.get(item.accn); if (!f) filings.set(item.accn, f = { accn: item.accn, form: item.form.replace('/A', ''), filed: item.filed, fy: item.fy, fp: item.fp, items: [] });
    f.items.push({ c: nombre, ...item });
  };
  for (const [tx, conceptos] of Object.entries(facts)) {
    if (tx !== 'us-gaap' && tx !== 'ifrs-full' && tx !== 'dei') continue;
    for (const [c, obj] of Object.entries(conceptos)) {
      let nombre = null;
      if (tx === 'us-gaap') { if (US.has(c) || (DEUDA.test(c) && !NO.test(c))) nombre = 'us-gaap_' + c; }
      else if (tx === 'ifrs-full') { if (IFRS[c]) nombre = 'us-gaap_' + IFRS[c]; else if (DEUDA.test(c) && !NO.test(c)) nombre = 'ifrs-full_' + c; }
      else if (c === 'EntityCommonStockSharesOutstanding') nombre = 'dei_' + c;
      if (!nombre) continue;
      const tipo = /PerShare/.test(nombre) ? 'eps' : /Shares|SharesOutstanding/.test(nombre) && !/PerShare/.test(nombre) ? 'shares' : 'money';
      const u = unidad(obj.units, tipo); if (!u) continue;
      if (tipo === 'money' && /^us-gaap_(Revenues|RevenueFromContract)/.test(nombre) && !moneda) moneda = u;
      for (const it of obj.units[u]) add(nombre, { ...it, u });
    }
  }
  const out = { annual: [], quarterly: [] };
  for (const f of filings.values()) {
    const anual = FORMS_A.has(f.form);
    const durs = f.items.filter(x => x.start); if (!f.items.length) continue;
    // cierre del periodo: el fin mas nuevo entre las duraciones del largo esperado (la tapa, dei, trae fechas posteriores)
    const okDur = x => { const d = dias(x.start, x.end); return anual ? d >= 330 && d <= 400 : d >= 80 && d <= 285; };
    const fin = f.items.filter(x => x.start && !x.c.startsWith('dei_') && okDur(x)).reduce((m, x) => (x.end > m ? x.end : m), '');
    if (!fin) continue;
    const dei = f.items.find(x => x.c.startsWith('dei_'));
    // si la presentacion tiene conceptos de otras fechas mas nuevas (raro), el periodo es el de las duraciones anuales
    const ic = [], bs = []; const vistos = new Set(); let inicio = null;
    // duraciones que terminan al cierre: anual = ~12 meses; trimestral = la mas larga (acumulado del anio) hasta 12 meses
    const porC = {};
    for (const x of f.items) {
      if (x.end !== fin || x.c.startsWith('dei_')) continue;
      if (x.start) {
        const d = dias(x.start, x.end); if (anual ? (d < 330 || d > 400) : (d < 80 || d > 285)) continue;
        const p = porC[x.c]; if (!p || d > dias(p.start, p.end) || (d === dias(p.start, p.end) && x.filed > p.filed)) porC[x.c] = x;
      } else if (!vistos.has(x.c) || true) {
        const prev = bs.find(y => y.concept === x.c); if (prev) { if (x.filed > prev._f) { prev.value = x.val; prev._f = x.filed; } } else bs.push({ concept: x.c, value: x.val, unit: x.u, _f: x.filed });
      }
    }
    if (dei) bs.push({ concept: dei.c, value: dei.val, unit: dei.u });
    for (const x of Object.values(porC)) { ic.push({ concept: x.c, value: x.val, unit: x.u }); if (/Revenue|NetIncomeLoss/.test(x.c) && (!inicio || x.start < inicio)) inicio = x.start; }
    if (!ic.length && !bs.length) continue;
    bs.forEach(y => delete y._f);
    const trim = anual ? 0 : ({ Q1: 1, Q2: 2, Q3: 3 }[f.fp] || null);
    (anual ? out.annual : out.quarterly).push({ year: f.fy, quarter: trim, form: f.form, startDate: inicio || '', endDate: fin, filedDate: f.filed, report: { ic, bs } });
  }
  // una presentacion por periodo (la ultima, por si hubo enmiendas); de la mas nueva a la mas vieja
  const uno = arr => { const m = new Map(); for (const r of arr) { const p = m.get(r.endDate); if (!p || r.filedDate > p.filedDate) m.set(r.endDate, r); } return [...m.values()].sort((a, b) => b.endDate.localeCompare(a.endDate)); };
  out.annual = uno(out.annual).filter(r => r.report.ic.length).slice(0, 13);
  out.quarterly = uno(out.quarterly).slice(0, 10);
  return { moneda: moneda || 'USD', ...out };
}
const main = async () => {
  const ced = JSON.parse(fs.readFileSync('cedears.json', 'utf8')).cedears;
  const universo = [...new Set(ced.filter(c => !c.sinUS).map(c => c.us || c.code))];
  const mapa = await get('https://www.sec.gov/files/company_tickers.json');
  const cik = {}; for (const x of Object.values(mapa)) { const t = String(x.ticker).toUpperCase(); if (!cik[t]) cik[t] = x.cik_str; }
  try { const ex = await get('https://www.sec.gov/files/company_tickers_exchange.json'); const iC = ex.fields.indexOf('cik'), iT = ex.fields.indexOf('ticker'); for (const r of ex.data) { const t = String(r[iT]).toUpperCase(); if (!cik[t]) cik[t] = r[iC]; } } catch (e) {}
  fs.mkdirSync(OUT, { recursive: true });
  const dbg = { corrida: new Date().toISOString(), universo: universo.length, ok: 0, sinCik: [], sinDatos: [], errores: [], ifrs: {} };
  const indice = {};
  for (const t of universo) {
    const c = cik[t] || cik[t.replace('.', '-')] || cik[t.replace('-', '.')];
    if (!c) { dbg.sinCik.push(t); continue; }
    try {
      await sleep(130);
      const j = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(c).padStart(10, '0')}.json`);
      if (!j) { dbg.sinDatos.push(t); continue; }
      const x = extraer(j);
      if (!x.annual.length) { const formas = {}; for (const tx of Object.values(j.facts || {})) for (const o of Object.values(tx)) for (const arr of Object.values(o.units || {})) for (const it of arr) formas[it.form] = (formas[it.form] || 0) + 1; dbg.sinDatos.push(`${t} (${Object.entries(formas).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, n]) => f + ':' + n).join(' ')})`); continue; }
      if (j.facts && j.facts['ifrs-full']) dbg.ifrs[t] = Object.keys(j.facts['ifrs-full']).filter(k => /Revenue|Profit|Equity|Borrow|Lease|Cash|Share/.test(k)).slice(0, 80);
      const doc = { t, cik: c, nombre: j.entityName, moneda: x.moneda, annual: { data: x.annual }, quarterly: { data: x.quarterly } };
      const txt = JSON.stringify(doc);
      const ruta = `${OUT}/${t}.json`;
      if (!fs.existsSync(ruta) || fs.readFileSync(ruta, 'utf8') !== txt) fs.writeFileSync(ruta, txt);
      indice[t] = { a: x.annual[0] && x.annual[0].endDate.slice(0, 10), q: x.quarterly[0] && x.quarterly[0].endDate.slice(0, 10), m: x.moneda };
      dbg.ok++;
    } catch (e) { dbg.errores.push(`${t}: ${e.message}`); }
  }
  fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(indice));
  fs.writeFileSync(`${OUT}/_debug.json`, JSON.stringify(dbg, null, 1));
  console.log(`ok ${dbg.ok} / ${universo.length} · sin CIK ${dbg.sinCik.length} · sin datos ${dbg.sinDatos.length} · errores ${dbg.errores.length}`);
};
main().catch(e => { console.error(e); process.exit(1); });
