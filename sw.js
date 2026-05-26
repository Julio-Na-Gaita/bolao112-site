const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('v') || 'web-1.7.9';
const CACHE_NAME = `bolao112-site-${APP_VERSION}`;

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAEkEE2X5hWIqopoJ0D9jFzCjJHKR8b82k',
  authDomain: 'bolao112fc.firebaseapp.com',
  projectId: 'bolao112fc',
  storageBucket: 'bolao112fc.firebasestorage.app',
  messagingSenderId: '131329454158',
  appId: '1:131329454158:web:983e4544dd651ec942131f',
  measurementId: 'G-5SGWJE6EKK'
});

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

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'Bolão 112 FC';
    const options = {
      body: payload?.notification?.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: payload?.fcmOptions?.link || payload?.data?.link || 'https://bolao112-site.vercel.app/'
      }
    };

    self.registration.showNotification(title, options);
  });
} catch (error) {
  console.warn('Firebase Messaging indisponível no service worker:', error);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || 'https://bolao112-site.vercel.app/';
  event.waitUntil(clients.openWindow(url));
});

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
