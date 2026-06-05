'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDisplayQueue } from '../lib/offlineQueue';
import { getSyncStatus, retryfailed } from '../lib/syncManager';
import { useToast } from '../hooks/useToast';

const STATUS_META = {
  pending:   { label: 'Pending',  cls: 'bg-amber-50 border-amber-200 text-amber-700'  },
  syncing:   { label: 'Syncing…', cls: 'bg-blue-50 border-blue-200 text-blue-700'     },
  failed:    { label: 'Failed',   cls: 'bg-rose-50 border-rose-200 text-rose-700'     },
  abandoned: { label: 'Retry',    cls: 'bg-amber-50 border-amber-200 text-amber-800'  },
};

const TYPE_LABEL = {
  CREATE_SALE:     { label: 'Sale',     cls: 'bg-green-50 border-green-200 text-green-700' },
  CREATE_PURCHASE: { label: 'Purchase', cls: 'bg-blue-50 border-blue-200 text-blue-700'   },
};

function useSyncStatus(open) {
  const [status, setStatus] = useState({ pending: 0, syncing: 0, failed: 0, abandoned: 0, total: 0 });
  const [items,  setItems]  = useState([]);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    const [st, queue] = await Promise.all([getSyncStatus(), getDisplayQueue()]);
    setStatus(st);
    setItems(queue);
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = window.setInterval(refresh, open ? 2000 : 10000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [open, refresh]);

  return { status, items, refresh };
}

/* ── Badge chip — exported for use in both sales and purchases pages ── */
export function OfflineQueueBadge({ onClick, isOnline }) {
  const { status } = useSyncStatus(false);

  if (status.total === 0) {
    if (!isOnline) return (
      <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[12px] font-bold hover:bg-amber-100 transition-colors">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
        Offline
      </button>
    );
    return (
      <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-[12px] font-bold hover:bg-green-100 transition-colors">
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        Synced
      </button>
    );
  }

  if (status.failed > 0 || status.abandoned > 0) {
    const failCount = status.failed + status.abandoned;
    return (
      <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-[12px] font-bold hover:bg-rose-100 transition-colors">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
        {failCount} failed
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[12px] font-bold hover:bg-amber-100 transition-colors">
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
      {status.pending + status.syncing} pending
    </button>
  );
}

/* ── Main Drawer ── */
export default function OfflineQueueDrawer({ open, onClose, isOnline }) {
  const { showToast } = useToast();
  const { status, items, refresh } = useSyncStatus(open);
  const [retrying, setRetrying] = useState(false);

  const handleRetryAll = async () => {
    setRetrying(true);
    try {
      const result = await retryfailed();
      await refresh();
      if (result.synced > 0) showToast(`${result.synced} item${result.synced > 1 ? 's' : ''} sync ho gayi!`, 'success');
      if (result.failed > 0) showToast(`${result.failed} item sync nahi ho paaya. Network check karein.`, 'warning');
      if (result.synced === 0 && result.failed === 0) showToast('Koi item retry ke liye nahi mila.', 'info');
    } catch {
      showToast('Retry failed. Please try again.', 'error');
    }
    setRetrying(false);
  };

  const formatTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  /* Derive display name and amount per item type */
  const getItemMeta = (item) => {
    const isSale = item.type === 'CREATE_SALE';
    const name = isSale
      ? (item?.payload?.buyer_name || 'Walk-in Customer')
      : (item?.payload?.supplier_name || 'Supplier');
    const total = (item?.payload?.items || []).reduce(
      (s, i) => s + (Number(i.quantity || 0) * Number(i.price_per_unit || 0)), 0
    );
    return { name, total, typeLabel: TYPE_LABEL[item.type] || TYPE_LABEL.CREATE_SALE };
  };

  const hasFailures = status.failed > 0 || status.abandoned > 0;

  /* Group items by type for display */
  const saleItems     = items.filter((i) => i.type === 'CREATE_SALE');
  const purchaseItems = items.filter((i) => i.type === 'CREATE_PURCHASE');
  const otherItems    = items.filter((i) => !['CREATE_SALE', 'CREATE_PURCHASE'].includes(i.type));

  return (
    <>
      {open && (
        <button type="button" aria-label="Close queue drawer" onClick={onClose}
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm" />
      )}

      <div className={`fixed z-[61] bg-white shadow-2xl transition-transform duration-300
        inset-x-0 bottom-0 rounded-t-3xl max-h-[85dvh] flex flex-col
        sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:top-0 sm:w-[380px] sm:rounded-none sm:rounded-l-3xl sm:max-h-screen
        ${open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'}`}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-[17px] font-black text-slate-900">Offline Queue</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {status.total === 0
                ? 'सब sync हो गया'
                : `${saleItems.length} sale${saleItems.length !== 1 ? 's' : ''} · ${purchaseItems.length} purchase${purchaseItems.length !== 1 ? 's' : ''} pending`}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">✕</button>
        </div>

        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2.5 mx-5 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-800 flex-shrink-0">
            <span>📶</span>
            <span>आप offline हैं — bills save हो रहे हैं</span>
          </div>
        )}

        {/* Queue items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {status.total === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-[15px] font-black text-slate-700">सब sync हो गया ✓</p>
              <p className="text-[12px] text-slate-400 mt-1">कोई pending item नहीं है।</p>
            </div>
          ) : (
            <>
              {/* Sales group */}
              {saleItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Sales ({saleItems.length})
                  </p>
                  <div className="space-y-2">
                    {saleItems.map((item) => {
                      const m = STATUS_META[item.status] || STATUS_META.pending;
                      const { name, total } = getItemMeta(item);
                      return (
                        <div key={item.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-black text-slate-900 truncate">{name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                ₹{Number(total).toFixed(2)} · {formatTime(item.createdAt)}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black flex-shrink-0 ml-3 ${m.cls}`}>{m.label}</span>
                          </div>
                          {item._queueError || item.error ? (
                            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">
                              {item._queueError || item.error}
                            </p>
                          ) : null}
                          {(item.status === 'failed' || item.status === 'abandoned') && (
                            <button type="button" onClick={async () => {
                              setRetrying(true);
                              try {
                                const { updateQueueItem } = await import('../lib/offlineDB');
                                await updateQueueItem(item.id, { status: 'pending', error: null });
                                const { syncQueue } = await import('../lib/syncManager');
                                await syncQueue();
                                await refresh();
                                showToast('Retry शुरू हो गया।', 'info');
                              } catch { showToast('Retry failed.', 'error'); }
                              setRetrying(false);
                            }} disabled={retrying}
                              className="text-[11px] font-black text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors">
                              ↻ Retry this item
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Purchases group */}
              {purchaseItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Purchases ({purchaseItems.length})
                  </p>
                  <div className="space-y-2">
                    {purchaseItems.map((item) => {
                      const m = STATUS_META[item.status] || STATUS_META.pending;
                      const { name, total } = getItemMeta(item);
                      return (
                        <div key={item.id} className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-black">PURCHASE</span>
                                <p className="text-[13px] font-black text-slate-900 truncate">{name}</p>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                ₹{Number(total).toFixed(2)} · {formatTime(item.createdAt)}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black flex-shrink-0 ml-3 ${m.cls}`}>{m.label}</span>
                          </div>
                          {item._queueError || item.error ? (
                            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">
                              {item._queueError || item.error}
                            </p>
                          ) : null}
                          {(item.status === 'failed' || item.status === 'abandoned') && (
                            <button type="button" onClick={async () => {
                              setRetrying(true);
                              try {
                                const { updateQueueItem } = await import('../lib/offlineDB');
                                await updateQueueItem(item.id, { status: 'pending', error: null });
                                const { syncQueue } = await import('../lib/syncManager');
                                await syncQueue();
                                await refresh();
                                showToast('Retry शुरू हो गया।', 'info');
                              } catch { showToast('Retry failed.', 'error'); }
                              setRetrying(false);
                            }} disabled={retrying}
                              className="text-[11px] font-black text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors">
                              ↻ Retry this item
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other queue items */}
              {otherItems.map((item) => {
                const m = STATUS_META[item.status] || STATUS_META.pending;
                return (
                  <div key={item.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-slate-600">{item.type}</p>
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black ${m.cls}`}>{m.label}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer — Retry All */}
        {hasFailures && (
          <div className="p-5 border-t border-slate-100 flex-shrink-0">
            <button type="button" onClick={handleRetryAll} disabled={retrying || !isOnline}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black text-[14px] shadow-lg shadow-blue-500/20 disabled:opacity-60 hover:-translate-y-0.5 transition-all">
              {retrying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Retrying…
                </span>
              ) : !isOnline
                ? '📶 Internet आने पर retry होगा'
                : `↻ Retry All (${status.failed + status.abandoned} failed)`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
