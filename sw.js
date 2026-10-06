/* Flujo — service worker: la app funciona offline. Cambiar VERSION al publicar una versión nueva. */
const VERSION = '202610062212';
const SHELL = `flujo-shell-${VERSION}`;
const RUNTIME = 'flujo-runtime';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// cache: 'reload' = pedirlo al servidor, no a la cache HTTP del navegador (GitHub Pages la guarda 10 min): si no, una
// actualizacion hecha justo despues de publicar se quedaba con el index.html viejo bajo la version nueva (Facu, 30-sep)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ASSETS.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('flujo-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // cotización del dólar: siempre red, nunca cache
  if (url.hostname === 'dolarapi.com') return;
  // fuentes: cache con actualización en segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(RUNTIME).then(async c => { const hit = await c.match(e.request); const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit); return hit || net; }));
    return;
  }
  // tabla de CEDEARs: red primero (se actualiza en el repo sin recompilar la app), cache como respaldo
  if (url.origin === location.origin && url.pathname.endsWith('cedears.json')) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(RUNTIME).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  if (url.origin !== location.origin) return;
  // la app (index.html) y los datos (sec/*.json: balances y EMA del dia): red primero, sin cache HTTP; si no hay red o tarda, lo guardado
  const esApp = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (esApp || url.pathname.endsWith('.json')) {
    const cache = esApp ? SHELL : RUNTIME; const clave = esApp ? './index.html' : e.request;
    e.respondWith((async () => {
      const guardado = () => caches.match(clave).then(h => h || caches.match(e.request, { ignoreSearch: true }));
      try {
        const net = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
        const r = await (esApp ? Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]) : net);
        if (r && r.ok) { const cp = r.clone(); caches.open(cache).then(c => c.put(clave, cp)); return r; }
        return (await guardado()) || r;
      } catch (err) { const h = await guardado(); if (h) return h; return fetch(e.request); }
    })());
    return;
  }
  // iconos y manifest: cache primero, red como respaldo
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cp)); } return r; })));
});
