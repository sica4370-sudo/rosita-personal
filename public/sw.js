// Rosita Personal · service worker: la app abre aunque la señal esté mala
const CACHE = 'rosita-personal-v11';
const SHELL = ['./', 'index.html', 'app.js', 'base.css', 'app.css', 'rosita.svg', 'wordmark.svg', 'wordmark-dark.svg', 'manifest.json', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Primero la red (siempre la versión más nueva); si no hay señal, lo guardado
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
