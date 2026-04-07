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
    '.svg'
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

  const precacheAssets = [
    '/',
    '/index.html',
    '/styles.min.css',
    '/app.min.js',
    '/favicon.png'
  ];

  const swContent = `const CACHE_NAME = 'bolao112-site-${appVersion}';
const ASSETS = ${JSON.stringify(precacheAssets, null, 2)};

// Arquivos que DEVEM atualizar sempre (network-first)
const CRITICAL = ['/app.min.js', '/styles.min.css', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // NETWORK FIRST para arquivos críticos
  if (CRITICAL.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
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
