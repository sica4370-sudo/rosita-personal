// Rosita Personal · service worker: la app abre aunque la señal esté mala
const CACHE = 'rosita-personal-v20';
const SHELL = ['./', 'index.html', 'app.js', 'base.css', 'app.css', 'rosita.svg', 'wordmark.svg', 'wordmark-dark.svg', 'manifest.json', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Primero la red (siempre la versión más nueva); si no hay señal, lo guardado
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

// Avisos al celular (Firebase Cloud Messaging): llegan aunque la app esté cerrada
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (er) { p = { data: { body: e.data ? e.data.text() : '' } }; }
  const d = p.data || {}, n = p.notification || {};
  const title = d.title || n.title || 'Rosita', body = d.body || n.body || '';
  e.waitUntil((async () => {
    // Si la app está abierta en pantalla, la campanita ya se actualiza sola
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.some(c => c.visibilityState === 'visible' && c.focused)) return;
    return self.registration.showNotification(title, { body, icon: 'icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { link: d.link || './' } });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = new URL((e.notification.data && e.notification.data.link) || './', self.registration.scope);
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) if (c.url.startsWith(self.registration.scope)) {
      await c.focus();
      c.postMessage({ open: { p: link.searchParams.get('p'), c: link.searchParams.get('c'), b: link.searchParams.get('b') } });
      return;
    }
    return self.clients.openWindow(link.href);
  })());
});
