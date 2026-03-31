'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueueCount } from '../lib/offlineQueue';
import { getSyncStatus, syncQueue } from '../lib/syncManager';

function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const isSyncingRef = useRef(false);

  const setSyncingState = useCallback((value) => {
    isSyncingRef.current = value;
    setIsSyncing(value);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        return 0;
      }

      const count = await getQueueCount();
      setPendingCount(typeof count === 'number' ? count : 0);
      return typeof count === 'number' ? count : 0;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  const runSync = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      if (isSyncingRef.current) {
        return null;
      }

      setSyncingState(true);
      setSyncError(null);

      const beforeStatus = await getSyncStatus();

      const result = await syncQueue();
      const remainingCount = await refreshPendingCount();
      const afterStatus = await getSyncStatus();

      if ((result?.synced || 0) > 0 || (result?.failed || 0) > 0) {
        setLastSyncResult(result);
      } else {
        setLastSyncResult(null);
      }

      if (
        remainingCount > 0 &&
        (result?.synced || 0) === 0 &&
        (result?.failed || 0) === 0
      ) {
        const stuckCount =
          (afterStatus?.pending || 0) +
          (afterStatus?.syncing || 0) +
          (afterStatus?.failed || 0) +
          (afterStatus?.abandoned || 0);
        const hadWorkBefore =
          (beforeStatus?.pending || 0) +
          (beforeStatus?.syncing || 0) +
          (beforeStatus?.failed || 0) +
          (beforeStatus?.abandoned || 0);

        if (stuckCount > 0 || hadWorkBefore > 0) {
          setSyncError('Pending entries abhi sync nahi hui. Retry karein.');
        }
      } else if ((result?.failed || 0) > 0) {
        setSyncError('Kuch entries sync nahi hui. Retry karein.');
      } else {
        setSyncError(null);
      }

      window.dispatchEvent(new CustomEvent('offline-sync-complete', {
        detail: {
          result,
          remainingCount,
          afterStatus,
        },
      }));

      setSyncingState(false);
      return result;
    } catch (error) {
      setSyncError(error?.message || 'Sync failed');
      setSyncingState(false);
      return null;
    }
  }, [refreshPendingCount, setSyncingState]);

  const handleOnline = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      if (isSyncingRef.current) {
        return null;
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REGISTER_SYNC',
        });
      }

      return await runSync();
    } catch (error) {
      setSyncError(error?.message || 'Sync failed');
      setSyncingState(false);
      return null;
    }
  }, [runSync, setSyncingState]);

  const syncNow = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      if (isSyncingRef.current) {
        return null;
      }

      return await runSync();
    } catch (error) {
      setSyncError(error?.message || 'Sync failed');
      setSyncingState(false);
      return null;
    }
  }, [runSync, setSyncingState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    refreshPendingCount();

    const onOnline = async () => {
      setIsOnline(true);
      await handleOnline();
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    const handleSWMessage = (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
        handleOnline();
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [handleOnline, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isOnline) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshPendingCount();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOnline, refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    syncNow,
    syncError,
  };
}

export default useOfflineSync;
