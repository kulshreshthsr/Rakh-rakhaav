'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { getDisplayQueue, queuePurchase, removeQueuedOperation } from '../../lib/offlineQueue';
import { cacheProducts, getCachedProducts } from '../../lib/offlineDB';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';
import { useToast } from '../../hooks/useToast';
import { getInvBehavior, isBatchMode, isVariantMode, isSerialMode } from '../../lib/inventoryBehavior';
import { validateGSTIN as _validateGSTIN, RCM_CATEGORIES, ITC_BLOCKED_REASONS } from '../../lib/gstValidation';
import OfflineQueueDrawer, { OfflineQueueBadge } from '../../components/OfflineQueueDrawer';
import usePurchasesData from './hooks/usePurchasesData';
import usePurchaseForm from './hooks/usePurchaseForm';
import PurchaseFormModal from './components/PurchaseFormModal';
import PurchaseCard from './components/PurchaseCard';
import ErrorBoundary from '../../components/ErrorBoundary';
import PurchaseSummary from './components/PurchaseSummary';
import PurchaseReturnModal from './components/PurchaseReturnModal';
import EmptyState from '../../components/ui/EmptyState';
import {
  INDIAN_STATES as STATES, UNION_TERRITORIES as UTS, GSTIN_REGEX, GSTIN_LENGTH,
  normalizeGstin, normalizeState, fmt, getToken, cleanPhone,
  formatDateInput as formatDateInputValue, todayInputValue as getDefaultPurchaseDateValue,
  getSaleRecordDateISO as getPurchaseRecordDateISO, getMonthFilterValue,
  formatFullDateTime, GST_STATE_CODE_MAP, getRoundedBillValues, emptySaleItem as emptyItem,
} from '../../lib/constants';

const PURCHASES_CACHE_KEY = 'purchases-page';
const getPurchaseSearchText = (purchase) => {
  const itemNames = Array.isArray(purchase.items) ? purchase.items.map((item) => item.product_name || '').join(' ') : '';
  return [purchase.invoice_number, purchase.product_name, purchase.supplier_name, purchase.supplier_phone, purchase.notes, itemNames].join(' ').toLowerCase();
};
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};

const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'failed')    return { label: 'Sync failed', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (status === 'abandoned') return { label: 'Sync retry needed', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Sync pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
};

const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

export default function PurchasesPage() {
  const { term, config } = useIndustry();
  const { showToast } = useToast();
  const inv          = getInvBehavior(config);
  const batchPurch   = isBatchMode(inv);
  const variantPurch = isVariantMode(inv);
  const serialPurch  = isSerialMode(inv);
  const router = useRouter();

  /* ── Page state ── */
  const [products, setProducts] = useState([]);
  const [shopState, setShopState] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);

  /* Bug 4 — edit loading guard */
  const [editLoadingId, setEditLoadingId] = useState(null);

  /* Feature 4 — credit_due filter + Feature 6 — GSTR-2B filter */
  const [typeFilter, setTypeFilter] = useState('all'); // all | invoices | purchase_orders | returns
  const [creditDueFilter, setCreditDueFilter] = useState(false);
  const [gstr2bFilter, setGstr2bFilter] = useState(''); // '' | 'not_checked' | 'matched' | 'not_in_2b' | 'mismatch'

  /* ── Product and shop meta fetch ── */
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const productList = Array.isArray(data) ? data : data.products || [];
      setProducts(productList);
      await cacheProducts(productList);
    } catch {
      if (!isOnline) { const cached = await getCachedProducts(); if (cached && cached.length > 0) setProducts(cached); }
    }
  }, [isOnline]);

  const fetchShopMeta = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const shop = await res.json();
      setShopState(shop.state || '');
    } catch {}
  }, []);

  /* ── Hooks ── */
  const {
    purchases, setPurchases, summary, loading, refreshing,
    hasMorePurchases, loadingMore, highlightedPurchaseId, setHighlightedPurchaseId,
    fetchPurchases, loadMorePurchases, fetchAll,
  } = usePurchasesData({ router, isOnline, products, setProducts, fetchProducts });

  const {
    showModal, setShowModal, submitting, editingPurchaseId, error, setError,
    gstinTouched, items, setItems, form, updateForm,
    showInlineProductForm, inlineProductRowIndex, creatingProduct,
    newProductForm, setNewProductForm, billTotals, roundedBill, balanceDue,
    gstinValue, gstinValid, showGstinError, showGstinLengthHint, calcRowGST,
    rcmSuggestion, dismissRcmSuggestion, applyRcmFromSuggestion,
    documentType, setDocumentType,
    duplicateWarning, setDuplicateWarning, handleConfirmDuplicate,
    resetModal, updateItem, addItem, removeItem,
    handleSupplierGstinChange, handleSubmit, startEditPurchase,
    resetInlineProductForm, openInlineProductForm, createInlineProduct,
    sendPurchaseWhatsApp,
  } = usePurchaseForm({ shopState, isOnline, fetchAll, products, setProducts, setPurchases });

  /* ── Bug 4: Race-condition safe edit handler ── */
  const productsReady = products.length > 0;

  const handleEditPurchase = async (purchase) => {
    /* Feature 3 — "Convert to Invoice" from PO mode */
    if (purchase._convertToInvoice) {
      const { _convertToInvoice, document_type, ...rest } = purchase;
      await handleEditPurchase(rest);
      setDocumentType('invoice');
      return;
    }
    if (!productsReady) {
      setEditLoadingId(purchase._id);
      await fetchProducts();
      setEditLoadingId(null);
    }
    startEditPurchase(purchase);
  };

  /* ── handleDelete ── */
  const handleDelete = async (purchase) => {
    if (purchase?._isOffline) {
      if (!confirm('Is pending offline purchase ko local queue se hatana hai?')) return;
      const removed = await removeQueuedOperation(purchase._id);
      if (!removed) { showToast('Pending offline purchase remove nahi ho paayi', 'error'); return; }
      setPurchases((current) => current.filter((entry) => entry._id !== purchase._id));
      return;
    }
    if (!confirm('Delete this purchase? Stock will be restored.')) return;
    try {
      const res = await fetch(apiUrl(`/api/purchases/${purchase._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { const data = await res.json().catch(() => ({})); showToast(data.message || 'Could not delete purchase', 'error'); return; }
      fetchPurchases();
    } catch { showToast('Could not delete purchase', 'error'); }
  };

  const focusPendingPurchase = () => {
    const pendingPurchase = purchases.find((purchase) => Number(purchase.balance_due || 0) > 0);
    if (!pendingPurchase) return;
    setHighlightedPurchaseId(pendingPurchase._id);
    const anchors = Array.from(document.querySelectorAll(`[data-purchase-anchor="${pendingPurchase._id}"]`));
    const visibleAnchor = anchors.find((node) => node.offsetParent !== null) || anchors[0];
    visibleAnchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightedPurchaseId(''), 2200);
  };

  /* ── Effects ── */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    const timer = window.setTimeout(() => {
      fetchProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if (shopState || !localStorage.getItem('token')) return;
    const timer = window.setTimeout(() => {
      fetchShopMeta();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchShopMeta, shopState]);

  /* Feature 4 — Handle ?filter=credit_due URL param */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'credit_due') {
      const timer = window.setTimeout(() => {
        setCreditDueFilter(true);
        router.replace('/purchases');
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [router]);

  /* ── Derived values ── */
  const pendingOfflinePurchases = purchases.filter((purchase) => purchase?._isOffline);
  const offlinePurchaseValue = pendingOfflinePurchases.reduce((sum, p) => sum + Number(p?.total_amount || 0), 0);
  const offlineItc = pendingOfflinePurchases.reduce((sum, p) => sum + Number(p?.total_gst || 0), 0);
  const offlineDue = pendingOfflinePurchases.reduce((sum, p) => sum + Number(p?.balance_due || 0), 0);
  const totalSpendDisplay = Number(summary.totalPurchaseValue || 0) + offlinePurchaseValue;
  const totalItcDisplay   = Number(summary.totalITC || 0) + offlineItc;
  const totalDueDisplay   = Number(summary.totalDue || 0) + offlineDue;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch = !normalizedBillSearch || getPurchaseSearchText(purchase).includes(normalizedBillSearch);
    const matchesMonth  = !billMonth || getMonthFilterValue(purchase.createdAt || purchase.purchased_at) === billMonth;

    /* Feature 3 — type filter */
    const isPO = purchase.document_type === 'purchase_order';
    const isReturn = purchase.document_type === 'purchase_return';
    if (typeFilter === 'invoices' && (isPO || isReturn || purchase._isOffline)) return false;
    if (typeFilter === 'purchase_orders' && !isPO) return false;
    if (typeFilter === 'returns' && !isReturn) return false;

    /* Feature 4 — credit due filter */
    if (creditDueFilter) {
      if (purchase.payment_type !== 'credit') return false;
      if (Number(purchase.balance_due || 0) <= 0) return false;
    }

    /* Feature 6 — GSTR-2B filter */
    if (gstr2bFilter && (purchase.gstr2b_status || 'not_checked') !== gstr2bFilter) return false;

    return matchesSearch && matchesMonth;
  });

  /* Feature 4 — sort credit_due by due_date ascending */
  const sortedPurchases = creditDueFilter
    ? [...filteredPurchases].sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      })
    : filteredPurchases;

  const hasBillFilters = Boolean(normalizedBillSearch || billMonth || creditDueFilter || gstr2bFilter || typeFilter !== 'all');

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">

        {/* Page header */}
        <div className="rr-page-hero rr-fade-in mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rr-section-label">📦 खरीद • Purchase</span>
              <h1 className="mt-1 text-[26px] font-black text-slate-900">Purchases / खरीदिए</h1>
              <p className="mt-1 text-[14px] text-slate-600 font-medium">Supplier bills, ITC, and payable balance</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Offline queue badge */}
              <OfflineQueueBadge onClick={() => setShowQueueDrawer(true)} isOnline={isOnline} />

              <Link href="/purchases/suppliers"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-md hover:border-green-300 hover:bg-green-50 hover:-translate-y-0.5 transition-all">
                {term('supplierDirectoryHindi', 'सप्लायर लिस्ट')}
              </Link>
              <Link href="/purchase-orders"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50 text-[13px] font-bold text-amber-800 shadow-md hover:border-amber-300 hover:bg-amber-100 hover:-translate-y-0.5 transition-all">
                PO Flow
              </Link>
              <button type="button" onClick={() => { resetModal(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-1 hover:shadow-xl transition-all">
                + {term('newPurchase', 'New Purchase')}
              </button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="rr-stat-strip mb-5">
          <div className="rr-stat-tile tone-amber">
            <p className="rr-stat-tile-label">Net Spend</p>
            <p className="rr-stat-tile-value">₹{fmt(totalSpendDisplay)}</p>
            {Number(summary.totalReturnedAmount || 0) > 0 && (
              <p className="rr-stat-tile-sub text-rose-500">↩ -₹{fmt(Number(summary.totalReturnedAmount || 0))}</p>
            )}
          </div>
          <div className="rr-stat-tile tone-blue">
            <p className="rr-stat-tile-label">Net ITC</p>
            <p className="rr-stat-tile-value">₹{fmt(totalItcDisplay)}</p>
            {Number(summary.totalReturnedGST || 0) > 0 && (
              <p className="rr-stat-tile-sub text-rose-500">↩ -{fmt(Number(summary.totalReturnedGST || 0))} adj.</p>
            )}
          </div>
          <div className={`rr-stat-tile ${totalDueDisplay > 0 ? 'tone-rose' : 'tone-green'}`}>
            <p className="rr-stat-tile-label">Due</p>
            <p className="rr-stat-tile-value">₹{fmt(totalDueDisplay)}</p>
            {totalDueDisplay > 0 && (
              <button type="button" onClick={focusPendingPurchase} className="rr-stat-tile-sub text-green-700 font-black">Pay Now →</button>
            )}
          </div>
        </div>

        {/* Feature 3 — Type filter tabs */}
        <div className="rr-tab-bar mb-4">
          {[
            { id: 'all',            label: 'All' },
            { id: 'invoices',       label: '🧾 Invoices' },
            { id: 'purchase_orders', label: '📋 POs' },
            { id: 'returns',        label: '↩️ Returns' },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setTypeFilter(tab.id)}
              className={`rr-tab ${typeFilter === tab.id ? 'active' : ''}`}
            >{tab.label}</button>
          ))}
        </div>

        {/* Filters row */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-md mb-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
              placeholder={`🔍 ${term('searchPurchase', 'Search bill, supplier, phone or product...')}`}
              value={billSearch} onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all sm:w-40"
              type="month" value={billMonth} onChange={(e) => setBillMonth(e.target.value)}
            />
          </div>
          {/* Feature 4 + Feature 6 — extra filter chips */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCreditDueFilter((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border-2 text-[12px] font-bold transition-all ${
                creditDueFilter ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              📅 Credit Due
            </button>
            {/* Feature 6 — GSTR-2B filter */}
            {['', 'not_checked', 'matched', 'not_in_2b', 'mismatch'].map((val) => {
              const labels = { '': 'All 2B', not_checked: '2B: Pending', matched: '✓ Matched', not_in_2b: '✗ Not in 2B', mismatch: '⚠ Mismatch' };
              return (
                <button key={val} type="button" onClick={() => setGstr2bFilter(val)}
                  className={`px-3 py-1.5 rounded-xl border-2 text-[12px] font-bold transition-all ${
                    gstr2bFilter === val ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {labels[val]}
                </button>
              );
            })}
            {hasBillFilters && (
              <button type="button" onClick={() => { setBillSearch(''); setBillMonth(''); setCreditDueFilter(false); setGstr2bFilter(''); setTypeFilter('all'); }}
                className="px-3 py-1.5 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Active filter banners */}
        {creditDueFilter && (
          <div className="flex items-center justify-between px-4 py-2.5 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-semibold text-rose-800">
            <span>📅 Credit purchases by due date — oldest first</span>
            <button type="button" onClick={() => setCreditDueFilter(false)} className="text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {error && !showModal && (
          <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
            <span className="text-base leading-none">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* Purchase list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-card border border-slate-200/60" style={{ height: 112 }} />
            ))}
          </div>
        ) : sortedPurchases.length === 0 ? (
          hasBillFilters ? (
            <div className="empty-state">
              <div className="empty-state-icon mx-auto mb-4 text-[26px]">🔍</div>
              <p className="text-[14px] font-extrabold text-slate-700 mb-1">कोई खरीदारी नहीं मिली</p>
              <p className="text-[12px] text-slate-400">Filter बदलें या search हटाएं</p>
            </div>
          ) : (
            <EmptyState emoji="📦" title="कोई खरीदारी दर्ज नहीं"
              subtitle="Supplier से माल खरीदा? यहाँ दर्ज करें और stock automatically update होगा।"
              actionLabel={`+ ${term('newPurchase', 'खरीदारी जोड़ें')}`}
              onAction={() => { resetModal(); setShowModal(true); }} />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {sortedPurchases.map((p) => (
              <ErrorBoundary key={p._id}>
                <PurchaseCard
                  p={p}
                  isHighlighted={p._id === highlightedPurchaseId}
                  sendPurchaseWhatsApp={sendPurchaseWhatsApp}
                  handleEditPurchase={handleEditPurchase}
                  editLoadingId={editLoadingId}
                  handleDelete={handleDelete}
                  onReturnClick={setReturnPurchase}
                />
              </ErrorBoundary>
            ))}
            {hasMorePurchases && !normalizedBillSearch && !billMonth && (
              <button onClick={loadMorePurchases} disabled={loadingMore}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 transition-all">
                {loadingMore ? 'Loading...' : '↓ Load older purchases'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* PURCHASE RETURN MODAL */}
      {returnPurchase && (
        <PurchaseReturnModal
          purchase={returnPurchase}
          onClose={() => setReturnPurchase(null)}
          onSuccess={(ret) => {
            setReturnPurchase(null);
            fetchPurchases();
            showToast(`Credit Note ${ret.credit_note_number} created — ₹${Number(ret.total_amount || 0).toFixed(2)} returned`, 'success');
          }}
        />
      )}

      {/* PURCHASE FORM MODAL */}
      <PurchaseFormModal
        showModal={showModal}
        resetModal={resetModal}
        editingPurchaseId={editingPurchaseId}
        term={term}
        form={form}
        updateForm={updateForm}
        error={error}
        submitting={submitting}
        gstinValue={gstinValue}
        gstinTouched={gstinTouched}
        showGstinError={showGstinError}
        showGstinLengthHint={showGstinLengthHint}
        handleSupplierGstinChange={handleSupplierGstinChange}
        items={items}
        setItems={setItems}
        products={products}
        updateItem={updateItem}
        addItem={addItem}
        removeItem={removeItem}
        openInlineProductForm={openInlineProductForm}
        showInlineProductForm={showInlineProductForm}
        inlineProductRowIndex={inlineProductRowIndex}
        newProductForm={newProductForm}
        setNewProductForm={setNewProductForm}
        creatingProduct={creatingProduct}
        resetInlineProductForm={resetInlineProductForm}
        createInlineProduct={createInlineProduct}
        calcRowGST={calcRowGST}
        batchPurch={batchPurch}
        variantPurch={variantPurch}
        serialPurch={serialPurch}
        inv={inv}
        billTotals={billTotals}
        roundedBill={roundedBill}
        balanceDue={balanceDue}
        handleSubmit={handleSubmit}
        isOnline={isOnline}
        rcmSuggestion={rcmSuggestion}
        dismissRcmSuggestion={dismissRcmSuggestion}
        applyRcmFromSuggestion={applyRcmFromSuggestion}
        documentType={documentType}
        setDocumentType={setDocumentType}
        duplicateWarning={duplicateWarning}
        setDuplicateWarning={setDuplicateWarning}
        handleConfirmDuplicate={handleConfirmDuplicate}
      />

      {/* Offline queue drawer */}
      <OfflineQueueDrawer
        open={showQueueDrawer}
        onClose={() => setShowQueueDrawer(false)}
        isOnline={isOnline}
      />
    </Layout>
  );
}
