'use client';

import { useEffect, useMemo, useState } from 'react';
import useOfflineSync from '../hooks/useOfflineSync';

const bannerBaseClass = 'fixed left-0 right-0 top-0 z-[9999] flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold';
const actionButtonClass = 'cursor-pointer rounded-full border-0 bg-white/20 px-3 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition-colors ml-auto flex-shrink-0';

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
      <div className={`${bannerBaseClass} bg-blue-600/95 text-white backdrop-blur-sm`} style={{ boxShadow: '0 2px 12px rgba(37,99,235,0.25)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          {`Syncing${dots}`}
        </span>
      </div>
    );
  } else if (syncError) {
    topBanner = (
      <div className={`${bannerBaseClass} bg-rose-600/95 text-white backdrop-blur-sm`} style={{ boxShadow: '0 2px 12px rgba(220,38,38,0.25)' }}>
        <span className="flex-1 min-w-0 truncate">{`Sync failed — ${syncError}`}</span>
        <button type="button" onClick={() => syncNow()} className={actionButtonClass}>
          Retry
        </button>
      </div>
    );
  } else if (!isOnline) {
    topBanner = (
      <div className={`${bannerBaseClass} bg-slate-800/95 text-slate-100 backdrop-blur-sm`} style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.3)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="flex-1 min-w-0 truncate">Offline mode — {pendingCount > 0 ? `${pendingCount} entries saved locally` : 'working from cache'}</span>
        {pendingCount > 0 && (
          <span className="flex-shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-black">
            {pendingCount}
          </span>
        )}
      </div>
    );
  } else if (pendingCount > 0) {
    topBanner = (
      <div className={`${bannerBaseClass} bg-amber-500/95 text-amber-950 backdrop-blur-sm`} style={{ boxShadow: '0 2px 12px rgba(245,158,11,0.25)' }}>
        <span className="flex-1">{`${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} pending sync`}</span>
        <button type="button" onClick={() => syncNow()} className="cursor-pointer rounded-full border-0 bg-amber-900/20 px-3 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-900/30 transition-colors flex-shrink-0">
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
        <div className="fixed bottom-[90px] right-4 z-[9999] flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[12.5px] font-bold shadow-[0_8px_24px_rgba(15,23,42,0.15)] transition-all duration-200 ease-out"
          style={{ background: lastSyncResult.failed === 0 ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#dc2626,#ef4444)', color: '#fff' }}
        >
          <span className="w-2 h-2 rounded-full bg-white/70 flex-shrink-0" />
          <span>
            {lastSyncResult.failed === 0
              ? `${lastSyncResult.synced} entries synced`
              : `${lastSyncResult.synced} synced, ${lastSyncResult.failed} failed`}
          </span>
          {lastSyncResult.failed > 0 ? (
            <button type="button" onClick={() => syncNow()} className="cursor-pointer rounded-full border-0 bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-white/30 transition-colors">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
