/* Runner's Rings C-3: narrowly scoped, opt-in-lifecycle static asset cache.
   Keep this build identical to APP_BUILD in index.html. No skipWaiting or clients.claim. */
const RR_BUILD = '2026.11.06.03';
const RR_CACHE = 'rr-static-' + RR_BUILD;
const RR_OFFLINE = '/offline.html';
const RR_STATIC = [
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/icon-maskable-512.png',
  '/assets/pwa/apple-touch-icon.png'
];
const RR_PRECACHE = [...RR_STATIC, RR_OFFLINE];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(RR_CACHE).then(cache => cache.addAll(RR_PRECACHE)));
  // No skipWaiting: an active session must not be replaced mid-import or mid-sync.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(name => name.startsWith('rr-static-') && name !== RR_CACHE)
        .map(name => caches.delete(name))
    ))
  );
  // No clients.claim: existing tabs retain their lifecycle until reopened.
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only original public icons are cached. All API, authentication, user data,
  // uploads, JS modules and pages bypass the Service Worker entirely.
  if (RR_STATIC.includes(url.pathname) && !url.search) {
    event.respondWith(
      caches.open(RR_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request);
      })
    );
    return;
  }

  // The homepage is always network-first and NEVER written into CacheStorage.
  // Other documents (journal, admin, reviews, auth callbacks, etc.) bypass SW.
  if (request.mode === 'navigate' &&
      (url.pathname === '/' || url.pathname === '/index.html') &&
      !url.search) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(RR_CACHE);
        return (await cache.match(RR_OFFLINE)) ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      })
    );
  }
});
