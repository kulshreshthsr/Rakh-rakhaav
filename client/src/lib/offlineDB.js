import { openDB } from 'idb';

const DB_NAME = 'rakhaav-offline';
const DB_VERSION = 1;
const OFFLINE_QUEUE_STORE = 'offline-queue';
const CACHED_PRODUCTS_STORE = 'cached-products';
const CACHED_DATA_STORE = 'cached-data';

let dbPromise = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export async function getDB() {
  try {
    if (!isBrowser()) {
      return null;
    }

    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
            const queueStore = db.createObjectStore(OFFLINE_QUEUE_STORE, {
              keyPath: 'id',
            });
            queueStore.createIndex('type', 'type');
            queueStore.createIndex('status', 'status');
            queueStore.createIndex('createdAt', 'createdAt');
          }

          if (!db.objectStoreNames.contains(CACHED_PRODUCTS_STORE)) {
            db.createObjectStore(CACHED_PRODUCTS_STORE, {
              keyPath: '_id',
            });
          }

          if (!db.objectStoreNames.contains(CACHED_DATA_STORE)) {
            db.createObjectStore(CACHED_DATA_STORE, {
              keyPath: 'key',
            });
          }
        },
      });
    }

    return await dbPromise;
  } catch {
    dbPromise = null;
    return null;
  }
}

export async function addToQueue(operation) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const savedOperation = {
      id: operation?.id || crypto.randomUUID(),
      type: operation?.type ?? null,
      payload: operation?.payload ?? {},
      status: 'pending',
      createdAt: operation?.createdAt || new Date().toISOString(),
      retryCount: operation?.retryCount ?? 0,
      tempId: operation?.tempId || `TEMP-${Date.now()}`,
    };

    await db.put(OFFLINE_QUEUE_STORE, savedOperation);
    return savedOperation;
  } catch {
    return null;
  }
}

export async function getPendingQueue() {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const items = await db.getAllFromIndex(
      OFFLINE_QUEUE_STORE,
      'status',
      'pending'
    );

    return items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return null;
  }
}

export async function getAllQueueItems() {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const items = await db.getAll(OFFLINE_QUEUE_STORE);

    return items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return null;
  }
}

export async function updateQueueItem(id, patch) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const existingItem = await db.get(OFFLINE_QUEUE_STORE, id);

    if (!existingItem) {
      return null;
    }

    const updatedItem = {
      ...existingItem,
      ...patch,
      id: existingItem.id,
      updatedAt: patch?.updatedAt || new Date().toISOString(),
    };

    await db.put(OFFLINE_QUEUE_STORE, updatedItem);
    return updatedItem;
  } catch {
    return null;
  }
}

export async function deleteQueueItem(id) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    await db.delete(OFFLINE_QUEUE_STORE, id);
    return true;
  } catch {
    return null;
  }
}

export async function cacheProducts(products) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const tx = db.transaction(CACHED_PRODUCTS_STORE, 'readwrite');

    for (const product of products || []) {
      await tx.store.put(product);
    }

    await tx.done;
    return products || [];
  } catch {
    return null;
  }
}

export async function getCachedProducts() {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    return await db.getAll(CACHED_PRODUCTS_STORE);
  } catch {
    return null;
  }
}

export async function cacheData(key, value) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const cachedEntry = {
      key,
      value,
      cachedAt: new Date().toISOString(),
    };

    await db.put(CACHED_DATA_STORE, cachedEntry);
    return cachedEntry;
  } catch {
    return null;
  }
}

export async function getCachedData(key) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const cachedEntry = await db.get(CACHED_DATA_STORE, key);
    return cachedEntry?.value ?? null;
  } catch {
    return null;
  }
}
