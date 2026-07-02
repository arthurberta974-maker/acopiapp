// AcopiApp Service Worker — cache offline
const CACHE_NAME = 'acopiapp-v3';
const ASSETS = [
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Installation : pré-cache tous les assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : app.html (app shell) en "red primero" para recibir siempre la
// última versión durante el desarrollo activo — con la caché como respaldo
// si no hay conexión. El resto de assets estáticos siguen en cache-first.
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET et non-http(s)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const isAppShell = event.request.mode === 'navigate' || event.request.url.includes('app.html');

  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./app.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Ne mettre en cache que les réponses valides
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Fallback : app.html pour toute navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./app.html');
        }
      });
    })
  );
});
