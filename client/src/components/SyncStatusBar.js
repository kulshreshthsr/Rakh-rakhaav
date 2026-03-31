'use client';

import { useEffect, useMemo, useState } from 'react';
import useOfflineSync from '../hooks/useOfflineSync';

const bannerBaseStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const actionButtonStyle = {
  background: '#000',
  color: '#fff',
  border: 'none',
  padding: '4px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

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
      <div
        style={{
          ...bannerBaseStyle,
          background: '#1d4ed8',
          color: '#fff',
        }}
      >
        <span>{`Sync ho raha hai${dots}`}</span>
      </div>
    );
  } else if (syncError) {
    topBanner = (
      <div
        style={{
          ...bannerBaseStyle,
          background: '#dc2626',
          color: '#fff',
          justifyContent: 'space-between',
        }}
      >
        <span>{`Sync failed: ${syncError}`}</span>
        <button type="button" onClick={() => syncNow()} style={actionButtonStyle}>
          Retry
        </button>
      </div>
    );
  } else if (!isOnline) {
    topBanner = (
      <div
        style={{
          ...bannerBaseStyle,
          background: '#1e293b',
          color: '#f8fafc',
          flexWrap: 'wrap',
        }}
      >
        <span>Offline mode active - network available nahi hai</span>
        {pendingCount > 0 ? (
          <>
            <span>{`${pendingCount} entries locally saved hain, internet aate hi sync ho jayengi`}</span>
            <span
              style={{
                background: '#f59e0b',
                color: '#000',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
              }}
            >
              {pendingCount}
            </span>
          </>
        ) : null}
      </div>
    );
  } else if (pendingCount > 0) {
    topBanner = (
      <div
        style={{
          ...bannerBaseStyle,
          background: '#f59e0b',
          color: '#000',
          justifyContent: 'space-between',
        }}
      >
        <span>{`${pendingCount} entries sync pending`}</span>
        <button type="button" onClick={() => syncNow()} style={actionButtonStyle}>
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
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '16px',
            background: '#059669',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            transform: 'translateY(0)',
            opacity: 1,
            transition: 'transform 220ms ease, opacity 220ms ease',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>
            {lastSyncResult.failed === 0
              ? `${lastSyncResult.synced} entries synced successfully`
              : `${lastSyncResult.synced} synced, ${lastSyncResult.failed} failed - retry karein?`}
          </span>
          {lastSyncResult.failed > 0 ? (
            <button type="button" onClick={() => syncNow()} style={actionButtonStyle}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
