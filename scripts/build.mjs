import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import csso from 'csso';
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

const build = async () => {
  await ensureCleanDir(dist);

  const [indexHtml, stylesCss, appJs] = await Promise.all([
    fs.readFile(path.join(root, 'index.html'), 'utf8'),
    fs.readFile(path.join(root, 'styles.css'), 'utf8'),
    fs.readFile(path.join(root, 'app.js'), 'utf8')
  ]);

  const minifiedCss = csso.minify(stylesCss).css;
  const minifiedJs = await minify(appJs, { module: true });

  if (!minifiedJs.code) {
    throw new Error('Falha ao minificar app.js');
  }

  const htmlForDist = indexHtml
    .replace('styles.css', 'styles.min.css')
    .replace('app.js', 'app.min.js');

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

  const swContent = `const CACHE_NAME = 'bolao112-site-v1';\nconst ASSETS = ${JSON.stringify(precacheAssets, null, 2)};\n\nself.addEventListener('install', (event) => {\n  event.waitUntil(\n    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))\n  );\n});\n\nself.addEventListener('activate', (event) => {\n  event.waitUntil(\n    caches.keys().then((keys) =>\n      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))\n    )\n  );\n});\n\nself.addEventListener('fetch', (event) => {\n  if (event.request.method !== 'GET') return;\n  const url = new URL(event.request.url);\n  if (url.origin !== self.location.origin) return;\n\n  event.respondWith(\n    caches.match(event.request).then((cached) =>\n      cached || fetch(event.request).then((response) => {\n        const clone = response.clone();\n        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));\n        return response;\n      })\n    )\n  );\n});\n`;

  await fs.writeFile(path.join(dist, 'sw.js'), swContent);
};

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
