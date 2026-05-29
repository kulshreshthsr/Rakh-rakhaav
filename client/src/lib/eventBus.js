/**
 * Client-side Event Bus — Patch 9
 *
 * Lightweight pub/sub for in-browser business events.
 * Components emit events after API calls succeed; other components
 * (e.g. NotificationBell) listen and refresh their data.
 *
 * Usage:
 *   import eventBus from '../lib/eventBus';
 *   eventBus.emit('INVOICE_CREATED', { saleId: '...' });
 *   const off = eventBus.on('INVOICE_CREATED', handler);
 *   off(); // unsubscribe
 */

const listeners = {};

const eventBus = {
  on(event, handler) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(handler);
    return () => listeners[event]?.delete(handler); // returns unsubscribe fn
  },

  emit(event, payload) {
    listeners[event]?.forEach(handler => {
      try { handler(payload); } catch (_) { /* never crash the emitter */ }
    });
  },

  off(event, handler) {
    listeners[event]?.delete(handler);
  },
};

export default eventBus;
