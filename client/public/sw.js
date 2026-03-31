const STATIC_CACHE = 'rakhaav-static-v3';
const PAGE_CACHE = 'rakhaav-pages-v3';
const SYNC_TAG = 'rakhaav-sync';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;
const isSuccessfulResponse = (response) =>
  Boolean(response) && (response.status === 200 || response.type === 'opaque');

const shouldCacheStaticAsset = (url) =>
  isSameOrigin(url) &&
  (
    url.pathname.startsWith('/_next/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico')
  );

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isSuccessfulResponse(response) && isSameOrigin(url)) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cachedPage = await caches.match(request);
          if (cachedPage) {
            return cachedPage;
          }

          const offlineFallback = await caches.match('/offline.html');
          return offlineFallback || Response.error();
        }
      })()
    );
    return;
  }

  if (shouldCacheStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        if (isSuccessfulResponse(response)) {
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  if (isSameOrigin(url)) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);
          if (isSuccessfulResponse(response)) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return Response.error();
        }
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage({
      type: 'BACKGROUND_SYNC_TRIGGERED',
      tag: SYNC_TAG,
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC' && self.registration?.sync) {
    self.registration.sync.register(SYNC_TAG).catch(() => {});
  }
});
