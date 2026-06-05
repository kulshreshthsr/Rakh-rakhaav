'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DISMISS_DELAYS = { success: 3500, info: 3500, warning: 3500, error: 5000 };
const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* actions: [{ label, onClick }] — when present, toast is persistent until dismissed */
  const showToast = useCallback((message, variant = 'info', actions = []) => {
    if (typeof window === 'undefined') return null;
    const id = crypto.randomUUID();
    const delay = actions.length > 0 ? 0 : (DISMISS_DELAYS[variant] ?? 3500);
    setToasts((prev) => [{ id, message, variant, actions, createdAt: Date.now() }, ...prev].slice(0, MAX_TOASTS));
    if (delay > 0) timersRef.current[id] = window.setTimeout(() => dismiss(id), delay);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
