import { getQueue, markFailed, markSynced, markSyncing } from './offlineQueue';
import { getCachedProducts, getDB, updateQueueItem } from './offlineDB';
import { apiUrl } from './api';

const getToken = () => localStorage.getItem('token');
const OFFLINE_QUEUE_STORE = 'offline-queue';

function isBrowser() {
  return typeof window !== 'undefined';
}

async function getAllQueueItems() {
  try {
    if (!isBrowser()) {
      return [];
    }

    const db = await getDB();

    if (!db) {
      return [];
    }

    const items = await db.getAll(OFFLINE_QUEUE_STORE);

    return items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

async function syncSale(operation) {
  try {
    if (!isBrowser()) {
      throw new Error('NETWORK_ERROR');
    }

    const response = await fetch(apiUrl('/api/sales'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(operation?.payload),
    });

    if (response.ok) {
      return {
        success: true,
        data: await response.json(),
      };
    }

    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }

    if (response.status === 400) {
      let errorBody = null;

      try {
        errorBody = await response.json();
      } catch {}

      throw new Error(errorBody?.message || 'Validation failed');
    }

    if (response.status >= 500) {
      throw new Error('SERVER_ERROR');
    }

    throw new Error('NETWORK_ERROR');
  } catch (error) {
    if (error?.message === 'AUTH_EXPIRED' || error?.message === 'SERVER_ERROR') {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new Error('NETWORK_ERROR');
    }

    throw new Error(error?.message || 'NETWORK_ERROR');
  }
}

async function syncPurchase(operation) {
  try {
    if (!isBrowser()) {
      throw new Error('NETWORK_ERROR');
    }

    const response = await fetch(apiUrl('/api/purchases'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(operation?.payload),
    });

    if (response.ok) {
      return {
        success: true,
        data: await response.json(),
      };
    }

    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }

    if (response.status === 400) {
      let errorBody = null;

      try {
        errorBody = await response.json();
      } catch {}

      throw new Error(errorBody?.message || 'Validation failed');
    }

    if (response.status >= 500) {
      throw new Error('SERVER_ERROR');
    }

    throw new Error('NETWORK_ERROR');
  } catch (error) {
    if (error?.message === 'AUTH_EXPIRED' || error?.message === 'SERVER_ERROR') {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new Error('NETWORK_ERROR');
    }

    throw new Error(error?.message || 'NETWORK_ERROR');
  }
}

export async function syncQueue() {
  try {
    if (!isBrowser()) {
      return { synced: 0, failed: 0 };
    }

    await getCachedProducts();

    const operations = await getQueue();

    if (!Array.isArray(operations) || operations.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        await markSyncing(operation.id);

        if (operation.type === 'CREATE_SALE') {
          await syncSale(operation);
        } else if (operation.type === 'CREATE_PURCHASE') {
          await syncPurchase(operation);
        } else {
          throw new Error('UNSUPPORTED_OPERATION');
        }

        await markSynced(operation.id);
        synced += 1;
      } catch (error) {
        await markFailed(operation.id, error?.message || 'NETWORK_ERROR');

        if (error?.message === 'AUTH_EXPIRED') {
          await updateQueueItem(operation.id, { status: 'abandoned' });
        }

        failed += 1;
      }
    }

    return { synced, failed };
  } catch {
    return { synced: 0, failed: 0 };
  }
}

export async function getSyncStatus() {
  try {
    if (!isBrowser()) {
      return {
        pending: 0,
        syncing: 0,
        failed: 0,
        abandoned: 0,
        total: 0,
      };
    }

    const items = await getAllQueueItems();

    return {
      pending: items.filter((item) => item?.status === 'pending').length,
      syncing: items.filter((item) => item?.status === 'syncing').length,
      failed: items.filter((item) => item?.status === 'failed').length,
      abandoned: items.filter((item) => item?.status === 'abandoned').length,
      total: items.length,
    };
  } catch {
    return {
      pending: 0,
      syncing: 0,
      failed: 0,
      abandoned: 0,
      total: 0,
    };
  }
}

export async function retryfailed() {
  try {
    if (!isBrowser()) {
      return { synced: 0, failed: 0 };
    }

    const items = await getAllQueueItems();
    const retryableItems = items.filter(
      (item) =>
        item?.status === 'failed' &&
        item?.error !== 'AUTH_EXPIRED' &&
        (item?.retryCount || 0) < 3
    );

    for (const item of retryableItems) {
      await updateQueueItem(item.id, {
        status: 'pending',
        error: null,
      });
    }

    return await syncQueue();
  } catch {
    return { synced: 0, failed: 0 };
  }
}
