const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('v') || 'web-1.7.7';
const CACHE_NAME = `bolao112-site-${APP_VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  `/styles.css?v=${APP_VERSION}`,
  `/app.js?v=${APP_VERSION}`,
  `/favicon.png?v=${APP_VERSION}`,
  `/manifest.webmanifest?v=${APP_VERSION}`,
  `/icon-192.png?v=${APP_VERSION}`,
  `/icon-512.png?v=${APP_VERSION}`,
  `/icon-maskable-192.png?v=${APP_VERSION}`,
  `/icon-maskable-512.png?v=${APP_VERSION}`,
  `/apple-touch-icon.png?v=${APP_VERSION}`
];


self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});


self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))
    ).then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isCriticalAsset =
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/styles.css');

 if (event.request.mode === 'navigate' || isCriticalAsset) {
  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' }))
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
  return;
}


  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
    )
  );
});

