'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../../lib/api';
import { getDisplayQueue } from '../../../lib/offlineQueue';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../../lib/pageCache';

const getToken = () => localStorage.getItem('token');
const SALES_CACHE_KEY = 'sales-page';

export default function useSalesData({ router, isOnline, products, fetchProducts }) {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreSales, setHasMoreSales] = useState(false);
  const [salesCursor, setSalesCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasBootstrappedRef = useRef(false);

  const loadPendingOfflineSales = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();
      if (!Array.isArray(queueItems) || queueItems.length === 0) return [];
      return queueItems.filter((op) => op?.type === 'CREATE_SALE').map((op) => {
        const queuedItems = Array.isArray(op?.payload?.items) ? op.payload.items : [];
        const taxableAmount = queuedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0), 0);
        const totalGst = queuedItems.reduce((sum, item) => {
          const product = products.find((prod) => prod._id === item.product_id);
          const taxable = Number(item.quantity || 0) * Number(item.price_per_unit || 0);
          const gstRate = Number(item.gst_rate ?? product?.gst_rate ?? 0);
          return sum + (taxable * gstRate) / 100;
        }, 0);
        return {
          _id: op.id, invoice_number: op.tempId,
          _queueStatus: op.status || 'pending', _queueError: op.error || '',
          items: queuedItems.map((item) => {
            const product = products.find((prod) => prod._id === item.product_id);
            return { product_name: item.product_name || product?.name || 'Product', quantity: item.quantity, price_per_unit: item.price_per_unit, total_amount: Number(item.quantity || 0) * Number(item.price_per_unit || 0) };
          }),
          product_name: queuedItems[0]?.product_name || products.find((prod) => prod._id === queuedItems[0]?.product_id)?.name || 'Product',
          total_amount: taxableAmount + totalGst, taxable_amount: taxableAmount, total_gst: totalGst,
          payment_type: op?.payload?.payment_type,
          buyer_name: op?.payload?.buyer_name || 'Walk-in Customer',
          buyer_phone: op?.payload?.buyer_phone,
          createdAt: op?.createdAt || new Date().toISOString(), _isOffline: true,
        };
      });
    } catch { return []; }
  }, [products]);

  const mergeSalesWithPendingQueue = useCallback(async (nextSales) => {
    try {
      const pendingOfflineSales = await loadPendingOfflineSales();
      if (!pendingOfflineSales.length) return nextSales;
      const seenIds = new Set((nextSales || []).map((sale) => sale._id));
      const mergedOfflineSales = pendingOfflineSales.filter((sale) => !seenIds.has(sale._id));
      return [...mergedOfflineSales, ...(nextSales || [])].sort((a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime());
    } catch { return nextSales; }
  }, [loadPendingOfflineSales]);

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/sales'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setHasMoreSales(data.hasMore || false);
      setSalesCursor(data.nextCursor || null);
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      const nextSummary = data.summary || {};
      const mergedSales = await mergeSalesWithPendingQueue(nextSales);
      setSales(mergedSales); setSummary(nextSummary);
      writePageCache(SALES_CACHE_KEY, { sales: mergedSales, summary: nextSummary });
    } catch { /* silent */ }
  }, [mergeSalesWithPendingQueue, router]);

  const loadMoreSales = useCallback(async () => {
    if (!salesCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(apiUrl(`/api/sales?cursor=${salesCursor}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return;
      const data = await res.json();
      setHasMoreSales(data.hasMore || false);
      setSalesCursor(data.nextCursor || null);
      const moreSales = data.sales || [];
      setSales((prev) => [...prev, ...moreSales.filter((s) => !prev.some((p) => p._id === s._id))]);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [salesCursor, loadingMore]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchSales();
    setLoading(false);
  }, [fetchSales]);

  // Bootstrap
  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(SALES_CACHE_KEY);
    let cachedTimer = null;
    if (cached?.sales) {
      cachedTimer = window.setTimeout(() => {
        mergeSalesWithPendingQueue(cached.sales).then((mergedSales) => setSales(mergedSales));
        setSummary(cached.summary || {});
        setLoading(false);
      }, 0);
    }
    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.sales));
      await fetchAll();
      if (fetchProducts) await fetchProducts();
      setRefreshing(false);
    });
    return () => {
      if (cachedTimer) window.clearTimeout(cachedTimer);
      cancelDeferred(deferredId);
    };
  }, [fetchAll, fetchProducts, mergeSalesWithPendingQueue, router]);

  // Sync-complete listener
  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) return undefined;
    const handleSyncComplete = () => fetchAll();
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('offline-sync-complete', handleSyncComplete);
  }, [fetchAll]);

  return {
    sales, setSales,
    summary,
    loading, setLoading,
    refreshing,
    hasMoreSales,
    loadingMore,
    fetchSales,
    loadMoreSales,
    fetchAll,
  };
}
