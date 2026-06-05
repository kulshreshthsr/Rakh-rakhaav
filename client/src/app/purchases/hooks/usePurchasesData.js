'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../../lib/api';
import { getDisplayQueue } from '../../../lib/offlineQueue';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../../lib/pageCache';
import { cacheProducts, getCachedProducts } from '../../../lib/offlineDB';

const getToken = () => localStorage.getItem('token');
const PURCHASES_CACHE_KEY = 'purchases-page';

/* Bug 2 Part B — detect "Product not found" error in failed queue items */
const enrichQueueItemError = (op) => {
  const rawError = op.error || '';
  if (rawError.toLowerCase().includes('product not found')) {
    const match = rawError.match(/Product not found:?\s*([a-f0-9]{24})?/i);
    return `Product not found: ${match?.[1] ? `ID ${match[1]}` : 'deleted item'} अब available नहीं — please edit करें`;
  }
  return rawError;
};

export default function usePurchasesData({ router, isOnline, products, setProducts, fetchProducts }) {
  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMorePurchases, setHasMorePurchases] = useState(false);
  const [purchasesCursor, setPurchasesCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState('');
  const hasBootstrappedRef = useRef(false);

  const loadPendingOfflinePurchases = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();
      if (!Array.isArray(queueItems) || queueItems.length === 0) return [];
      return queueItems
        .filter((op) => op?.type === 'CREATE_PURCHASE')
        .map((op) => {
          const queuedItems = Array.isArray(op?.payload?.items) ? op.payload.items : [];
          const taxableAmount = queuedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0), 0);
          const totalGst = queuedItems.reduce((sum, item) => {
            const product = products.find((prod) => prod._id === item.product_id);
            const taxable = Number(item.quantity || 0) * Number(item.price_per_unit || 0);
            const gstRate = Number(item.gst_rate ?? product?.gst_rate ?? 0);
            return sum + (taxable * gstRate) / 100;
          }, 0);
          const amountPaid = Number(op?.payload?.amount_paid || 0);
          const totalAmount = taxableAmount + totalGst;

          /* Bug 2 Part B — surface product-deleted errors with specific message */
          const enrichedError = enrichQueueItemError(op);

          return {
            _id: op.id,
            invoice_number: op.tempId,
            _queueStatus: op.status || 'pending',
            _queueError: enrichedError,
            items: queuedItems.map((item) => {
              const product = products.find((prod) => prod._id === item.product_id);
              return {
                product_name: item.product_name || product?.name || 'Product',
                quantity: item.quantity,
                price_per_unit: item.price_per_unit,
                total_amount: Number(item.quantity || 0) * Number(item.price_per_unit || 0),
              };
            }),
            product_name: queuedItems[0]?.product_name || products.find((prod) => prod._id === queuedItems[0]?.product_id)?.name || 'Product',
            total_amount: totalAmount,
            taxable_amount: taxableAmount,
            total_gst: totalGst,
            amount_paid: amountPaid,
            balance_due: Math.max(0, totalAmount - amountPaid),
            payment_type: op?.payload?.payment_type,
            supplier_name: op?.payload?.supplier_name || '',
            supplier_phone: op?.payload?.supplier_phone,
            createdAt: op?.createdAt || new Date().toISOString(),
            _isOffline: true,
          };
        });
    } catch { return []; }
  }, [products]);

  const mergePurchasesWithPendingQueue = useCallback(async (nextPurchases) => {
    try {
      const pendingOfflinePurchases = await loadPendingOfflinePurchases();
      if (!pendingOfflinePurchases.length) return nextPurchases;
      const seenIds = new Set((nextPurchases || []).map((p) => p._id));
      const mergedOffline = pendingOfflinePurchases.filter((p) => !seenIds.has(p._id));
      return [...mergedOffline, ...(nextPurchases || [])].sort(
        (a, b) => new Date(b.createdAt || b.purchased_at || 0).getTime() - new Date(a.createdAt || a.purchased_at || 0).getTime()
      );
    } catch { return nextPurchases; }
  }, [loadPendingOfflinePurchases]);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/purchases'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setHasMorePurchases(data.hasMore || false);
      setPurchasesCursor(data.nextCursor || null);
      const nextPurchases = data.purchases || [];
      const nextSummary = data.summary || {};
      const mergedPurchases = await mergePurchasesWithPendingQueue(nextPurchases);
      setPurchases(mergedPurchases);
      setSummary(nextSummary);
      writePageCache(PURCHASES_CACHE_KEY, { purchases: mergedPurchases, summary: nextSummary });
    } catch { /* silent — user sees stale data */ }
  }, [mergePurchasesWithPendingQueue, router]);

  const loadMorePurchases = useCallback(async () => {
    if (!purchasesCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(apiUrl(`/api/purchases?cursor=${purchasesCursor}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setHasMorePurchases(data.hasMore || false);
      setPurchasesCursor(data.nextCursor || null);
      const more = data.purchases || [];
      setPurchases((prev) => [...prev, ...more.filter((p) => !prev.some((e) => e._id === p._id))]);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [purchasesCursor, loadingMore]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchPurchases();
    setLoading(false);
  }, [fetchPurchases]);

  // Bootstrap
  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PURCHASES_CACHE_KEY);
    if (cached?.purchases) {
      mergePurchasesWithPendingQueue(cached.purchases).then((merged) => setPurchases(merged));
      setSummary(cached.summary || {});
      setLoading(false);
    }
    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.purchases));
      await fetchAll();
      if (fetchProducts) await fetchProducts();
      setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchAll, fetchProducts, mergePurchasesWithPendingQueue, router]);

  // Sync-complete listener
  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) return undefined;
    const handleSyncComplete = () => fetchAll();
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('offline-sync-complete', handleSyncComplete);
  }, [fetchAll]);

  return {
    purchases, setPurchases,
    summary,
    loading, setLoading,
    refreshing,
    hasMorePurchases,
    loadingMore,
    highlightedPurchaseId, setHighlightedPurchaseId,
    fetchPurchases,
    loadMorePurchases,
    fetchAll,
  };
}
