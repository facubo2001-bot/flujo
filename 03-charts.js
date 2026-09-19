/* ===================== FLUJO — charts (inline SVG, no deps) ===================== */

function niceMax(v, ticks = 4) {
  if (v <= 0) return { max: 1, step: 1 };
  const raw = v / ticks; const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p; const nf = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => x >= f - 1e-9) || 10;
  const step = nf * p; return { max: step * ticks, step };
}
const axisFmt = v => MENOS((() => { const cur = ui.cur; if (cur === 'USD') { const u = M.toUSD(v); return Math.abs(u) >= 1000 ? (u / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' k' : Math.round(u).toString(); } return Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : Math.abs(v) >= 1000 ? Math.round(v / 1000) + ' k' : Math.round(v).toString(); })());
const tipRow = (color, name, val) => `<div class="row"><span>${color ? `<i style="background:${color}"></i>` : ''}${esc(name)}</span><b>${val}</b></div>`;

const Charts = {
  /** Multi-series line/area on categorical x. series: [{name,color,values:[num|null],dashed,area,strong}] */
  /** cruce: {i, label, color} marca sutil donde una serie cruza refY (guía punteada hasta el eje + día resaltado) */
  line({ w = 640, series, labels, h = 220, yFmt = axisFmt, tipTitle = i => labels[i], tipFmt = v => M.f(v), marker = true, refY = null, refLabel = '', xSparse = false, cruce = null }) {
    const padL = 44, padR = 16, padT = 14, padB = 26;
    const iw = w - padL - padR, ih = h - padT - padB;
    const all = series.flatMap(s => s.values.filter(v => v != null)); if (refY != null) all.push(refY);
    const { max, step } = niceMax(Math.max(...all, 1));
    const n = labels.length; const x = i => padL + (n > 1 ? i / (n - 1) * iw : iw / 2); const y = v => padT + ih - v / max * ih;
    let g = '<g class="grid">';
    for (let v = 0; v <= max + 1e-9; v += step) g += `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${yFmt(v)}</text>`;
    g += '</g>';
    const every = Math.max(1, Math.ceil(30 / (n > 1 ? iw / (n - 1) : iw)));
    let xl = '';
    const ci = cruce && cruce.i != null && refY != null ? cruce.i : null;
    labels.forEach((l, i) => { if (ci != null && Math.abs(i - ci) <= 1) return; if (xSparse ? !!l : (i % every === 0 || (i === n - 1 && (n - 1) % every >= 2))) xl += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>`; });
    let paths = '', dots = '';
    for (const s of series) {
      let d = '', started = false, lastIdx = -1;
      s.values.forEach((v, i) => { if (v == null) { if (!s.connect) started = false; return; } d += (started ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); started = true; lastIdx = i; });
      if (s.dots) s.values.forEach((v, i) => { if (v != null) dots += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`; });
      if (s.area && d) { const first = s.values.findIndex(v => v != null); paths += `<path d="${d} L${x(lastIdx)} ${y(0)} L${x(first)} ${y(0)} Z" fill="${s.color}" opacity=".1"/>`; }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.strong ? 2.5 : 2}" stroke-linecap="round" stroke-linejoin="round" ${s.dashed ? 'stroke-dasharray="5 5"' : ''}/>`;
      if (marker && lastIdx >= 0 && !s.dashed) dots += `<circle cx="${x(lastIdx)}" cy="${y(s.values[lastIdx])}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    }
    let ref = '';
    if (refY != null) ref = `<line x1="${padL}" x2="${w - padR}" y1="${y(refY)}" y2="${y(refY)}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 4"/><text x="${w - padR}" y="${y(refY) - 4}" text-anchor="end" class="lbl">${esc(refLabel)}</text>`;
    let cr = '';
    if (ci != null) { const cx = x(ci), cy = y(refY), col = cruce.color || 'var(--warn)'; cr = `<line x1="${cx}" x2="${cx}" y1="${cy}" y2="${y(0)}" stroke="${col}" stroke-width="1" stroke-dasharray="2 3" opacity=".75"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--surface)" stroke="${col}" stroke-width="2"/><text x="${cx}" y="${h - 8}" text-anchor="middle" style="fill:${col};font-weight:700">${esc(cruce.label || labels[ci])}</text>`; }
    let hits = '';
    const bw = n > 1 ? iw / (n - 1) : iw;
    labels.forEach((l, i) => {
      const rows = series.filter(s => s.values[i] != null).map(s => tipRow(s.color, s.name, tipFmt(s.values[i], s))).join('');
      hits += `<rect class="hit" x="${x(i) - bw / 2}" y="${padT}" width="${bw}" height="${ih}" data-tip="${esc(`<b>${esc(tipTitle(i))}</b>${rows}`)}"/>`;
    });
    const guide = `<line class="guide" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" stroke="var(--ink-3)" stroke-width="1" opacity="0"/>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}<g class="axis"><line x1="${padL}" x2="${w - padR}" y1="${y(0)}" y2="${y(0)}"/></g>${ref}${paths}${cr}${dots}${xl}${hits}</svg>`;
  },

  /** Stacked columns. series: [{name,color,values}] ; optional line overlay {name,values,color} on the SAME axis */
  stacked({ w = 640, series, labels, h = 240, line = null, yFmt = axisFmt, tipTitle = i => labels[i], tipFmt = v => M.f(v), highlight = -1, thresholdPct = null }) {
    const padL = 44, padR = 12, padT = 14, padB = 26;
    const iw = w - padL - padR, ih = h - padT - padB; const n = labels.length;
    const totals = labels.map((_, i) => sum(series.map(s => s.values[i] || 0)));
    const all = totals.slice(); if (line) all.push(...line.values.filter(v => v != null));
    const { max, step } = niceMax(Math.max(...all, 1));
    const slot = iw / n; const bw = Math.min(24, slot * 0.6); const x = i => padL + slot * i + slot / 2; const y = v => padT + ih - v / max * ih;
    let g = '<g class="grid">';
    for (let v = 0; v <= max + 1e-9; v += step) g += `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${yFmt(v)}</text>`;
    g += '</g>';
    const every = Math.max(1, Math.ceil(44 / slot));
    let xl = ''; labels.forEach((l, i) => { if (i % every === 0) xl += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" ${i === highlight ? 'class="lbl strong"' : ''}>${esc(l)}</text>`; });
    let bars = '', hits = '';
    labels.forEach((_, i) => {
      let acc = 0;
      series.forEach((s, si) => {
        const v = s.values[i] || 0; if (v <= 0) return;
        const y1 = y(acc + v), y0 = y(acc); const hh = Math.max(0, y0 - y1 - (acc > 0 ? 2 : 0));
        const top = acc + v >= totals[i] - 1e-9;
        const r = top ? 4 : 0;
        const xx = x(i) - bw / 2;
        bars += r ? `<path d="M${xx} ${y0}V${y1 + r}q0 -${r} ${r} -${r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${y0}Z" fill="${s.color}" />` : `<rect x="${xx}" y="${y1}" width="${bw}" height="${hh}" fill="${s.color}" />`;
        acc += v;
      });
      const rows = series.filter(s => (s.values[i] || 0) > 0).map(s => tipRow(s.color, s.name, tipFmt(s.values[i]))).join('');
      const tot = totals[i] ? tipRow('', 'Total', tipFmt(totals[i])) : '';
      const ln = line && line.values[i] != null ? tipRow('', line.name, tipFmt(line.values[i])) : '';
      hits += `<rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${ih}" data-tip="${esc(`<b>${esc(tipTitle(i))}</b>${rows}${tot}${ln}`)}"/>`;
    });
    let lp = '';
    if (line) { let d = ''; line.values.forEach((v, i) => { if (v == null) return; d += (d ? 'L' : 'M') + x(i) + ' ' + y(v); }); lp = `<path d="${d}" fill="none" stroke="${line.color || 'var(--ink)'}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`; }
    let th = '';
    if (thresholdPct != null && line) { let d = ''; line.values.forEach((v, i) => { if (v == null) return; d += (d ? 'L' : 'M') + x(i) + ' ' + y(v * thresholdPct); }); th = `<path d="${d}" fill="none" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="2 4"/>`; }
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}<g class="axis"><line x1="${padL}" x2="${w - padR}" y1="${y(0)}" y2="${y(0)}"/></g>${bars}${th}${lp}${xl}${hits}</svg>`;
  },

  donut({ slices, size = 180, thick = 26, center = '' }) {
    const total = sum(slices.map(s => s.value)) || 1; const r = size / 2 - 4; const c = size / 2; const ri = r - thick;
    let a0 = -Math.PI / 2, paths = '';
    for (const s of slices) {
      if (s.value <= 0) continue;
      const a1 = a0 + s.value / total * Math.PI * 2; const gap = slices.length > 1 ? 0.02 : 0;
      const p = (a, rr) => [c + rr * Math.cos(a), c + rr * Math.sin(a)];
      const [x0, y0] = p(a0 + gap, r), [x1, y1] = p(a1 - gap, r), [x2, y2] = p(a1 - gap, ri), [x3, y3] = p(a0 + gap, ri);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      paths += `<path d="M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${large} 0 ${x3} ${y3}Z" fill="${s.color}" class="hit" data-tip="${esc(`<b>${esc(s.name)}</b>${tipRow('', 'Monto', M.f(s.value))}${tipRow('', 'Participación', M.pct(s.value / total))}`)}"/>`;
      a0 = a1;
    }
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex:none">${paths}<text x="${c}" y="${c - 4}" text-anchor="middle" style="font-size:11px;fill:var(--ink-3)">${esc(center.split('|')[0] || '')}</text><text x="${c}" y="${c + 14}" text-anchor="middle" style="font-family:var(--font-display);font-size:15px;font-weight:600;fill:var(--ink)">${esc(center.split('|')[1] || '')}</text></svg>`;
  },

  spark(values, color = 'var(--accent)', w = 84, h = 34) {
    const vals = values.filter(v => v != null); if (vals.length < 2) return '';
    const max = Math.max(...vals, 1), min = 0; const n = values.length;
    const x = i => 2 + i / (n - 1) * (w - 4); const y = v => h - 3 - (v - min) / (max - min || 1) * (h - 6);
    let d = ''; values.forEach((v, i) => { if (v == null) return; d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
    const li = values.length - 1;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${d} L${x(li)} ${h} L${x(0)} ${h} Z" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/><circle cx="${x(li)}" cy="${y(values[li])}" r="3" fill="${color}"/></svg>`;
  },

  /** calendar heatmap for a month; byDay: {day: amount} */
  heat(ym, byDay, maxRef) {
    const days = D.daysIn(ym); const first = D.dow(ym + '-01'); const offset = (first + 6) % 7; // monday first
    const vals = Object.values(byDay); const max = maxRef || Math.max(...vals, 1);
    const hoy = D.today(); const isCur = D.ym(hoy) === ym;
    let h = ['L','M','X','J','V','S','D'].map(d => `<div class="wd">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) h += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const v = byDay[d] || 0; const lvl = v <= 0 ? 0 : Math.min(5, Math.ceil(v / max * 5));
      const date = D.dateIn(ym, d); const fut = date > hoy;
      h += `<div class="d h${lvl} ${isCur && Number(hoy.slice(8, 10)) === d ? 'today' : ''} ${fut ? 'future' : ''}" data-tip="${esc(`<b>${D.fmt(date, { long: true })}</b>${tipRow('', 'Gastado', M.f(v))}`)}">${d}</div>`;
    }
    return `<div class="heat">${h}</div>`;
  },

  legend(items) { return `<div class="legend">${items.map(i => `<span><i class="${i.kind || ''}" style="background:${i.color};border-color:${i.color}"></i>${esc(i.name)}</span>`).join('')}</div>`; },
};

/* tooltip delegation */
(function () {
  const tip = $('#tooltip');
  let lastTouch = 0; document.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { passive: true });
  const show = (e) => { if (Date.now() - lastTouch < 800) return; const t = e.target.closest('[data-tip]'); if (!t) { tip.classList.remove('show'); return; } tip.innerHTML = t.dataset.tip; tip.classList.add('show'); move(e); };
  const move = (e) => { const x = e.clientX, y = e.clientY; tip.style.left = clamp(x, 130, window.innerWidth - 130) + 'px'; tip.style.top = (y < 90 ? y + 90 : y) + 'px'; };
  document.addEventListener('mouseover', show); document.addEventListener('mousemove', e => { if (tip.classList.contains('show')) move(e); });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tip.classList.remove('show'); });
  let ts = null;
  document.addEventListener('touchstart', e => { const t = e.target.closest && e.target.closest('[data-tip]'); ts = t ? { t, x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  document.addEventListener('touchend', e => { if (!ts) return; const c = e.changedTouches[0]; const moved = Math.abs(c.clientX - ts.x) + Math.abs(c.clientY - ts.y); const t = ts.t; ts = null; if (moved > 8) return; tip.innerHTML = t.dataset.tip; tip.classList.add('show'); const r = t.getBoundingClientRect(); tip.style.left = clamp(r.left + r.width / 2, 130, window.innerWidth - 130) + 'px'; tip.style.top = (r.top < 90 ? r.bottom + 90 : r.top) + 'px'; setTimeout(() => tip.classList.remove('show'), 2500); }, { passive: true });
  document.addEventListener('touchmove', () => { if (tip.classList.contains('show')) tip.classList.remove('show'); }, { passive: true });
})();

/* chart mounting: charts render against the real container width */
const ChartQ = { list: [], reg(fn, h) { const id = ChartQ.list.push(fn) - 1; return `<div class="chart" data-cid="${id}" style="min-height:${h || 200}px"></div>`; }, reset() { ChartQ.list = []; },
  mount() { for (const el of $$('[data-cid]')) { const fn = ChartQ.list[Number(el.dataset.cid)]; if (!fn) continue; const w = Math.max(280, Math.floor(el.clientWidth || el.parentElement.clientWidth || 640)); el.innerHTML = fn(w); el.style.minHeight = ''; } } };
