// Background Sync tag name — must match what we register from app
const SYNC_TAG = 'rakhaav-sync';

// Listen for background sync event
// This fires when internet comes back (browser managed)
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Notify all open clients (browser tabs) to run sync
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

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC') {
    // Register a background sync
    self.registration.sync.register(SYNC_TAG).catch(() => {
      // Background Sync not supported — app handles this
      // via online/offline events instead
    });
  }
});
