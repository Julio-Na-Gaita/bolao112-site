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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || 'https://bolao112-site.vercel.app/';
  event.waitUntil(clients.openWindow(url));
});
