// Service Worker for LEGO Inventory Tracker

const CACHE_NAME = 'lego-tracker-v6';
const LOCAL_ASSETS = [
  '/Lego-Tracker/',
  '/Lego-Tracker/index.html',
  '/Lego-Tracker/css/style.css',
  '/Lego-Tracker/js/config.js',
  '/Lego-Tracker/js/auth.js',
  '/Lego-Tracker/js/sheets.js',
  '/Lego-Tracker/js/scanner.js',
  '/Lego-Tracker/js/rebrickable.js',
  '/Lego-Tracker/js/market.js',
  '/Lego-Tracker/js/app.js',
  '/Lego-Tracker/icons/icon-192.png',
  '/Lego-Tracker/icons/icon-512.png',
  '/Lego-Tracker/manifest.json',
];

// Install: cache local static assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for local assets, network-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Google API scripts, CDN libraries, or API calls
  if (
    url.hostname === 'apis.google.com' ||
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'sheets.googleapis.com' ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'rebrickable.com' ||
    url.hostname === 'api.brickowl.com' ||
    url.hostname === 'api.upcitemdb.com' ||
    url.hostname === 'brickset.com' ||
    url.hostname === 'api.allorigins.win'
  ) {
    return; // Let the browser handle these normally
  }

  // Cache-first for local assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
