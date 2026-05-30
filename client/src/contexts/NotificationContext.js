'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';
import eventBus from '../lib/eventBus';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 60_000; // 60 seconds
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [taskCount, setTaskCount]         = useState(0);
  const [loading, setLoading]             = useState(false);
  const intervalRef = useRef(null);
  const mountedRef  = useRef(true);

  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/notifications?limit=30'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || !mountedRef.current) return;
      const { notifications: notifs, unreadCount: count } = await res.json();
      if (mountedRef.current) {
        setNotifications(notifs || []);
        setUnreadCount(count || 0);
      }
    } catch (_) {
      // network error — silently ignore, will retry on next poll
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  const fetchTaskCount = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/tasks?status=pending&limit=1'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || !mountedRef.current) return;
      const { pendingCount } = await res.json();
      if (mountedRef.current) setTaskCount(pendingCount || 0);
    } catch (_) {}
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchNotifications({ silent: true }), fetchTaskCount()]);
  }, [fetchNotifications, fetchTaskCount]);

  const markRead = useCallback(async (id) => {
    const token = getToken();
    if (!token) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch(apiUrl(`/api/notifications/${id}/read`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch(apiUrl('/api/notifications/read-all'), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, []);

  const dismiss = useCallback(async (id) => {
    const token = getToken();
    if (!token) return;
    setNotifications(prev => prev.filter(n => n._id !== id));
    setUnreadCount(prev => {
      const notif = notifications.find(n => n._id === id);
      return notif && !notif.isRead ? Math.max(0, prev - 1) : prev;
    });
    await fetch(apiUrl(`/api/notifications/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [notifications]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    const token = getToken();
    if (!token) return;

    fetchNotifications();
    fetchTaskCount();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current && getToken()) refresh();
    }, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalRef.current);
    };
  }, [fetchNotifications, fetchTaskCount, refresh]);

  // Listen for events that should trigger a refresh
  useEffect(() => {
    const events = ['INVOICE_CREATED', 'WORKFLOW_ADVANCED', 'STOCK_UPDATED'];
    const offs = events.map(ev => eventBus.on(ev, () => {
      setTimeout(() => refresh(), 1500); // small delay for server processing
    }));
    return () => offs.forEach(off => off());
  }, [refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, taskCount, loading, markRead, markAllRead, dismiss, refresh }),
    [notifications, unreadCount, taskCount, loading, markRead, markAllRead, dismiss, refresh]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

const SAFE_DEFAULTS = {
  notifications: [], unreadCount: 0, taskCount: 0, loading: false,
  markRead: async () => {}, markAllRead: async () => {},
  dismiss: async () => {}, refresh: async () => {},
};

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx ?? SAFE_DEFAULTS;
}
