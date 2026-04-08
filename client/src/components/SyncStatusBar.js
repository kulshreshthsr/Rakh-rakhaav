'use client';

import { useEffect, useMemo, useState } from 'react';
import useOfflineSync from '../hooks/useOfflineSync';

const bannerBaseClass = 'fixed left-0 right-0 top-0 z-[9999] flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.3)]';
const actionButtonClass = 'cursor-pointer rounded-full border-0 bg-black px-3 py-1 text-[12px] font-bold text-white';

export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, lastSyncResult, syncNow, syncError } =
    useOfflineSync();
  const [syncTick, setSyncTick] = useState(0);
  const [dismissedToastAt, setDismissedToastAt] = useState(null);

  useEffect(() => {
    if (!isSyncing || typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSyncTick((current) => current + 1);
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSyncing]);

  useEffect(() => {
    if (typeof window === 'undefined' || !lastSyncResult) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDismissedToastAt(lastSyncResult.completedAt);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastSyncResult]);

  const dots = useMemo(() => {
    if (!isSyncing) {
      return '.';
    }

    const frames = ['.', '..', '...'];
    return frames[syncTick % frames.length];
  }, [isSyncing, syncTick]);

  const shouldHideAll =
    isOnline === true &&
    pendingCount === 0 &&
    lastSyncResult === null &&
    syncError === null;

  if (shouldHideAll) {
    return null;
  }

  let topBanner = null;

  if (isSyncing) {
    topBanner = (
      <div className={`${bannerBaseClass} bg-blue-700 text-white`}>
        <span>{`Sync ho raha hai${dots}`}</span>
      </div>
    );
  } else if (syncError) {
    topBanner = (
      <div className={`${bannerBaseClass} justify-between bg-red-600 text-white`}>
        <span>{`Sync failed: ${syncError}`}</span>
        <button type="button" onClick={() => syncNow()} className={actionButtonClass}>
          Retry
        </button>
      </div>
    );
  } else if (!isOnline) {
    topBanner = (
      <div className={`${bannerBaseClass} flex-wrap bg-slate-800 text-slate-50`}>
        <span>Offline mode active - network available nahi hai</span>
        {pendingCount > 0 ? (
          <>
            <span>{`${pendingCount} entries locally saved hain, internet aate hi sync ho jayengi`}</span>
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] text-black">
              {pendingCount}
            </span>
          </>
        ) : null}
      </div>
    );
  } else if (pendingCount > 0) {
    topBanner = (
      <div className={`${bannerBaseClass} justify-between bg-amber-500 text-black`}>
        <span>{`${pendingCount} entries sync pending`}</span>
        <button type="button" onClick={() => syncNow()} className={actionButtonClass}>
          Sync Now
        </button>
      </div>
    );
  }

  const shouldShowToast = Boolean(
    lastSyncResult &&
    lastSyncResult.completedAt &&
    dismissedToastAt !== lastSyncResult.completedAt
  );

  return (
    <>
      {topBanner}
      {shouldShowToast ? (
        <div className="fixed bottom-[90px] right-4 z-[9999] flex items-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-200 ease-out">
          <span>
            {lastSyncResult.failed === 0
              ? `${lastSyncResult.synced} entries synced successfully`
              : `${lastSyncResult.synced} synced, ${lastSyncResult.failed} failed - retry karein?`}
          </span>
          {lastSyncResult.failed > 0 ? (
            <button type="button" onClick={() => syncNow()} className={actionButtonClass}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
