import withPWAInit from '@uora/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?.*\/_next\/static\/.*$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https?.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'image-assets',
          expiration: {
            maxEntries: 80,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https?.*\.(?:woff2?|ttf|otf)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'font-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
  fallbacks: {
    document: '/offline.html',
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
