const CACHE_NAME = 'rakhaav-pwa-v2';
const APP_SHELL = [
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache Next.js build assets or hot app bundles. These must stay fresh.
  if (isSameOrigin(url) && (url.pathname.startsWith('/_next/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations should prefer the network so new deploys show immediately.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/offline.html');
        return cached || Response.error();
      })
    );
    return;
  }

  // Cache-first only for a few static same-origin assets.
  if (isSameOrigin(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return response;
        });
      })
    );
  }
});
