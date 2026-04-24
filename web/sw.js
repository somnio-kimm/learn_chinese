/** Bump together with `version.json` → `v` and `cache` when shipping new assets. */
const CACHE = 'hsk1-v48';

/** Resolve paths relative to this script so the app works under a subpath (e.g. GitHub Pages /repo/). */
function assetUrl(path) {
  return new URL(path, self.location.href).href;
}

const ASSET_PATHS = [
  './index.html',
  './style.css',
  './js/app.js',
  './js/router.js',
  './js/components.js',
  './js/services/i18n.js',
  './js/services/theme.js',
  './js/services/vocabulary.js',
  './js/services/app-update.js',
  './js/services/store.js',
  './js/services/pinyin.js',
  './js/services/tts.js',
  './js/services/haptic.js',
  './js/services/srs.js',
  './js/views/home.js',
  './js/views/wrong.js',
  './js/views/settings.js',
  './js/quizzes/pinyin.js',
  './js/quizzes/tone.js',
  './js/quizzes/cloze.js',
  './js/quizzes/scramble.js',
  './js/quizzes/flashcard.js',
  './js/quizzes/wordlist.js',
  './data/hsk-1.json',
  './data/hsk-2.json',
  './data/hsk-3.json',
  './data/hsk-4.json',
  './data/hsk-5.json',
  './data/hsk-6.json',
  './data/hsk-7.json',
];

const ASSETS = ASSET_PATHS.map(assetUrl);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/** Online: fresh shell (HTML/JS/CSS). Offline: fall back to precache. Data JSON stays cache-first after warm. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') {
    e.respondWith(fetch(req));
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req));
    return;
  }
  const path = url.pathname;
  /** Static deploy marker: always hit network when online; never serve a stale precached copy. */
  if (path.endsWith('version.json')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(
        () => new Response('{"v":0}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }
  const shell =
    req.mode === 'navigate' ||
    path.endsWith('.html') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('manifest.json');

  if (shell) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
