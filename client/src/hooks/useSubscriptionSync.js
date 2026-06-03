'use client';
import { useEffect, useCallback } from 'react';
import { API, readStoredSubscription, writeStoredSubscription } from '../lib/subscription';

const TTL_MS = 60_000;

export function useSubscriptionSync(onUpdate) {
  const sync = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/auth/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const sub = data.subscription || null;
      writeStoredSubscription(sub);
      onUpdate?.(sub);
    } catch { /* ignore */ }
  }, [onUpdate]);

  useEffect(() => {
    sync();
    const id = setInterval(sync, TTL_MS);
    return () => clearInterval(id);
  }, [sync]);

  return sync;
}
