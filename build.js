const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const css = src('style.css');
const dataJs = `/* ===== datos embebidos (generados por build.js desde /data) ===== */\nconst CEDEARS_EMBED = ${fs.readFileSync(path.join(__dirname, 'data', 'cedears.json'), 'utf8')};\nconst SPY_HIST = ${fs.readFileSync(path.join(__dirname, 'data', 'spy-hist.json'), 'utf8')};\nconst SPY_DIVS = ${fs.readFileSync(path.join(__dirname, 'data', 'spy-divs.json'), 'utf8')};\n`;
const js = [dataJs].concat(['01-core.js', '02-engine.js', '03-charts.js', '04-insights.js', '05-views-a.js', '05-views-b.js', '06-forms.js', '07-demo.js', '08-main.js'].map(src)).join('\n\n');
const preset = fs.existsSync(path.join(__dirname, 'src', 'preset.json')) ? src('preset.json').replace(/<\//g, '<\\/') : 'null';
const version0 = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const html = src('shell.html').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('/*__PRESET__*/', () => preset).replace("'__BUILD__'", `'${version0}'`);
fs.writeFileSync(path.join(__dirname, 'flujo.html'), html);
fs.writeFileSync(path.join(__dirname, 'flujo-full.html'), `<!doctype html>\n<html lang="es"><head><meta charset="utf-8">\n</head><body>\n${html}\n</body></html>`);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');

// ---- PWA package
const version = version0;
const pwaHead = `<meta charset="utf-8">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Gastos">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">`;
const swReg = `<script>
if ('serviceWorker' in navigator) { let recargando = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (recargando) return; recargando = true; try { toast('Actualizando a la versión nueva…', 2000); } catch (e) {} setTimeout(() => location.reload(), 600); }); window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) {} setInterval(() => { try { reg.update(); } catch (e) {} }, 30 * 60 * 1000); }).catch(() => {}); }); }
</script>`;
const pwaHtml = `<!doctype html>\n<html lang="es"><head>\n${pwaHead}\n</head><body>\n${html.replace('/*__PRESET__*/', () => preset)}\n${swReg}\n</body></html>`;
fs.mkdirSync(path.join(__dirname, 'pwa'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'data', 'cedears.json'), path.join(__dirname, 'pwa', 'cedears.json'));
fs.writeFileSync(path.join(__dirname, 'pwa', 'index.html'), pwaHtml);
const swSrc = fs.readFileSync(path.join(__dirname, 'pwa', 'sw.js'), 'utf8').replace(/const VERSION = '.*?';/, `const VERSION = '${version}';`);
fs.writeFileSync(path.join(__dirname, 'pwa', 'sw.js'), swSrc);
console.log('pwa built', version);
