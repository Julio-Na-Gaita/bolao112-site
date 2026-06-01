import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { minify as minifyCss } from 'csso';
import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const ensureCleanDir = async (dir) => {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
};

const copyFile = async (src, dest) => {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
};

const copyStaticAssets = async () => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const staticExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.mp3',
    '.mp4',
    '.webp',
    '.gif',
    '.svg',
    '.webmanifest'
  ]);

  const assetFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => staticExtensions.has(path.extname(name).toLowerCase()));

  await Promise.all(
    assetFiles.map((file) => copyFile(path.join(root, file), path.join(dist, file)))
  );

  return assetFiles;
};

const optimizeImages = async () => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => ['.png', '.jpg', '.jpeg'].includes(path.extname(name).toLowerCase()));

  if (images.length === 0) return [];

  const files = images.map((name) => path.join(root, name));
  await imagemin(files, {
    destination: dist,
    plugins: [
      imageminMozjpeg({ quality: 75 }),
      imageminPngquant({ quality: [0.65, 0.8] })
    ]
  });

  return images;
};

const extractAppVersion = (html) => {
  const match = html.match(/window\.APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  // A versão visual é apenas lida daqui; não incrementamos automaticamente no build.
  return match?.[1] || 'web-dev';
};

const build = async () => {
  await ensureCleanDir(dist);

  const [indexHtml, stylesCss, appJs] = await Promise.all([
    fs.readFile(path.join(root, 'index.html'), 'utf8'),
    fs.readFile(path.join(root, 'styles.css'), 'utf8'),
    fs.readFile(path.join(root, 'app.js'), 'utf8')
  ]);

  const appVersion = extractAppVersion(indexHtml);

  const minifiedCss = minifyCss(stylesCss).css;
  const minifiedJs = await minify(appJs, { module: true });

  if (!minifiedJs.code) {
    throw new Error('Falha ao minificar app.js');
  }

  const htmlForDist = indexHtml
    .replace(/styles\.css/g, 'styles.min.css')
    .replace(/app\.js/g, 'app.min.js');

  await Promise.all([
    fs.writeFile(path.join(dist, 'styles.min.css'), minifiedCss),
    fs.writeFile(path.join(dist, 'app.min.js'), minifiedJs.code),
    fs.writeFile(path.join(dist, 'index.html'), htmlForDist)
  ]);

  await copyStaticAssets();
  await optimizeImages();

  const minifiedStylesPath = '/styles.min.css';
  const minifiedAppPath = '/app.min.js';
  const versionedStylesPath = `${minifiedStylesPath}?v=${appVersion}`;
  const versionedAppPath = `${minifiedAppPath}?v=${appVersion}`;
  const versionedFaviconPath = `/favicon.png?v=${appVersion}`;
  const versionedManifestPath = `/manifest.webmanifest?v=${appVersion}`;
  const versionedIconPaths = [
    `/icon-192.png?v=${appVersion}`,
    `/icon-512.png?v=${appVersion}`,
    `/icon-maskable-192.png?v=${appVersion}`,
    `/icon-maskable-512.png?v=${appVersion}`,
    `/apple-touch-icon.png?v=${appVersion}`
  ];
  const precacheAssets = [
    '/',
    '/index.html',
    versionedStylesPath,
    versionedAppPath,
    versionedFaviconPath,
    versionedManifestPath,
    ...versionedIconPaths
  ];

  const swContent = `const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('v') || '${appVersion}';
const CACHE_NAME = \`bolao112-site-\${APP_VERSION}\`;

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

const ASSETS = ${JSON.stringify(precacheAssets, null, 2)};

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
  if (url.pathname.startsWith('/api/')) return;

  const isCriticalAsset =
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('${minifiedAppPath.replace(/^\//, '')}') ||
    url.pathname.endsWith('${minifiedStylesPath.replace(/^\//, '')}');

  // NETWORK FIRST para arquivos críticos
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

  // CACHE FIRST para o resto (imagens/assets) com fallback de rede
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
    )
  );
});
`;


  await fs.writeFile(path.join(dist, 'sw.js'), swContent);
};

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
