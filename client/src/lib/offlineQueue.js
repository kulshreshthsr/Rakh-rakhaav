import {
  addToQueue,
  deleteQueueItem,
  getDB,
  getAllQueueItems,
  getPendingQueue,
  updateQueueItem,
} from './offlineDB';

const OFFLINE_QUEUE_STORE = 'offline-queue';
const DISPLAYABLE_QUEUE_STATUSES = ['pending', 'syncing', 'failed', 'abandoned'];

function isBrowser() {
  return typeof window !== 'undefined';
}

export async function queueSale(formData, items) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const operation = {
      id: crypto.randomUUID(),
      type: 'CREATE_SALE',
      payload: {
        ...(formData || {}),
        items: items || [],
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      tempId: `TEMP-SALE-${Date.now()}`,
    };

    return await addToQueue(operation);
  } catch {
    return null;
  }
}

export async function queuePurchase(formData, items) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const operation = {
      id: crypto.randomUUID(),
      type: 'CREATE_PURCHASE',
      payload: {
        ...(formData || {}),
        items: items || [],
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      tempId: `TEMP-PUR-${Date.now()}`,
    };

    return await addToQueue(operation);
  } catch {
    return null;
  }
}

export async function getQueue() {
  try {
    if (!isBrowser()) {
      return [];
    }

    return (await getPendingQueue()) || [];
  } catch {
    return [];
  }
}

export async function markSyncing(id) {
  try {
    if (!isBrowser()) {
      return null;
    }

    return await updateQueueItem(id, {
      status: 'syncing',
      error: null,
    });
  } catch {
    return null;
  }
}

export async function markSynced(id) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const updatedItem = await updateQueueItem(id, { status: 'synced' });

    if (!updatedItem) {
      return null;
    }

    await deleteQueueItem(id);
    return updatedItem;
  } catch {
    return null;
  }
}

export async function markFailed(id, errorMessage) {
  try {
    if (!isBrowser()) {
      return null;
    }

    const existingItem = await updateQueueItem(id, {});

    if (!existingItem) {
      return null;
    }

    const retryCount = (existingItem.retryCount || 0) + 1;

    return await updateQueueItem(id, {
      status: 'failed',
      error: errorMessage,
      retryCount,
    });
  } catch {
    return null;
  }
}

export async function getQueueCount() {
  try {
    if (!isBrowser()) {
      return 0;
    }

    const queue = await getAllQueueItems();
    if (!Array.isArray(queue)) {
      return 0;
    }

    return queue.filter((item) => DISPLAYABLE_QUEUE_STATUSES.includes(item?.status)).length;
  } catch {
    return 0;
  }
}

export async function getDisplayQueue() {
  try {
    if (!isBrowser()) {
      return [];
    }

    const queue = await getAllQueueItems();
    if (!Array.isArray(queue)) {
      return [];
    }

    return queue.filter((item) => DISPLAYABLE_QUEUE_STATUSES.includes(item?.status));
  } catch {
    return [];
  }
}

export async function resetStuckSyncingOperations(maxAgeMs = 20000) {
  try {
    if (!isBrowser()) {
      return [];
    }

    const queue = await getAllQueueItems();
    if (!Array.isArray(queue)) {
      return [];
    }

    const now = Date.now();
    const recoveredItems = [];

    for (const item of queue) {
      if (item?.status !== 'syncing') {
        continue;
      }

      const createdAt = new Date(item.createdAt || 0).getTime();
      const updatedAt = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const referenceTime = Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : createdAt;

      if (!Number.isFinite(referenceTime) || now - referenceTime < maxAgeMs) {
        continue;
      }

      const recoveredItem = await updateQueueItem(item.id, {
        status: 'failed',
        error: 'Sync timed out. Retry karein.',
        updatedAt: new Date().toISOString(),
      });

      if (recoveredItem) {
        recoveredItems.push(recoveredItem);
      }
    }

    return recoveredItems;
  } catch {
    return [];
  }
}

export async function clearQueue() {
  try {
    if (!isBrowser()) {
      return null;
    }

    const db = await getDB();

    if (!db) {
      return null;
    }

    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const items = await tx.store.getAll();

    for (const item of items) {
      if (item?.status === 'synced') {
        await tx.store.delete(item.id);
      }
    }

    await tx.done;
    return true;
  } catch {
    return null;
  }
}

export async function removeQueuedOperation(id) {
  try {
    if (!isBrowser()) {
      return null;
    }

    await deleteQueueItem(id);
    return true;
  } catch {
    return null;
  }
}
