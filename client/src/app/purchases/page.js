'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { getDisplayQueue, queuePurchase, removeQueuedOperation } from '../../lib/offlineQueue';
import { cacheProducts, getCachedProducts } from '../../lib/offlineDB';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';
import { getInvBehavior, isBatchMode, isVariantMode, isSerialMode } from '../../lib/inventoryBehavior';
import { validateGSTIN as _validateGSTIN, RCM_CATEGORIES, ITC_BLOCKED_REASONS } from '../../lib/gstValidation';
import usePurchasesData from './hooks/usePurchasesData';
import usePurchaseForm from './hooks/usePurchaseForm';
import PurchaseFormModal from './components/PurchaseFormModal';
import PurchaseCard from './components/PurchaseCard';
import PurchaseSummary from './components/PurchaseSummary';
import InlineProductForm from './components/InlineProductForm';
import PurchaseReturnModal from './components/PurchaseReturnModal';
import EmptyState from '../../components/ui/EmptyState';
import { INDIAN_STATES as STATES, UNION_TERRITORIES as UTS, GSTIN_REGEX, normalizeGstin, normalizeState, fmt } from '../../lib/constants';

const getToken = () => localStorage.getItem('token');
const GSTIN_LENGTH = 15;
const PURCHASES_CACHE_KEY = 'purchases-page';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const formatDateInputValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getDefaultPurchaseDateValue = () => formatDateInputValue(new Date());
const getPurchaseRecordDateISO = (value, referenceValue = new Date()) => {
  if (!value) return new Date().toISOString();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date().toISOString();
  const nextDate = new Date(referenceValue);
  if (Number.isNaN(nextDate.getTime())) return new Date().toISOString();
  nextDate.setFullYear(year, month - 1, day);
  return nextDate.toISOString();
};
const getMonthFilterValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const getPurchaseSearchText = (purchase) => {
  const itemNames = Array.isArray(purchase.items) ? purchase.items.map((item) => item.product_name || '').join(' ') : '';
  return [
    purchase.invoice_number,
    purchase.product_name,
    purchase.supplier_name,
    purchase.supplier_phone,
    purchase.notes,
    itemNames,
  ].join(' ').toLowerCase();
};
const formatFullDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const GST_STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};
const getRoundedBillValues = (amount) => {
  const numericAmount = Number(amount || 0);
  const roundedTotal = Math.round(numericAmount);
  return {
    roundedTotal,
    roundOff: parseFloat((roundedTotal - numericAmount).toFixed(2)),
  };
};

// Empty item row
const emptyItem = () => ({ _rowId: Math.random().toString(36).slice(2), product_id: '', quantity: 1, price_per_unit: '', item_metadata: {} });
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};

const buildPurchaseWhatsAppMessage = (purchase) => {
  const purchaseDate = new Date(purchase.createdAt || purchase.purchased_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const itemLines = purchase.items && purchase.items.length > 0
    ? purchase.items.map((item, index) => `  ${index + 1}. ${item.product_name} x ${item.quantity} @ ₹${Number(item.price_per_unit || 0).toFixed(2)} = ₹${Number(item.total_amount || 0).toFixed(2)}`).join('\n')
    : `  1. ${purchase.product_name} x ${purchase.quantity || 1} @ ₹${Number(purchase.price_per_unit || 0).toFixed(2)} = ₹${Number(purchase.total_amount || 0).toFixed(2)}`;

  return [
    purchase.supplier_name ? `Namaste ${purchase.supplier_name} ji,` : 'Namaste,',
    '',
    'Purchase confirmation',
    `Bill No: ${purchase.invoice_number || '-'}`,
    `Date: ${purchaseDate}`,
    'Items:',
    itemLines,
    `Taxable Amount: ₹${Number(purchase.taxable_amount || 0).toFixed(2)}`,
    `GST / ITC: ₹${Number(purchase.total_gst || 0).toFixed(2)}`,
    `Total Amount: ₹${Number(purchase.total_amount || 0).toFixed(2)}`,
    `Paid: ₹${Number(purchase.amount_paid || 0).toFixed(2)}`,
    ...(Number(purchase.balance_due || 0) > 0 ? [`Balance Due: ₹${Number(purchase.balance_due || 0).toFixed(2)}`] : []),
    '',
    'Please review and confirm the purchase details.',
  ].join('\n');
};

const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing') {
    return { label: 'Syncing...', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  }
  if (status === 'failed') {
    return { label: 'Sync failed', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  if (status === 'abandoned') {
    return { label: 'Sync retry needed', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  return { label: 'Sync pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
};
const PAY_BADGE = {
  cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 Udhaar' },
  upi:    { cls: 'bg-violet-50 text-violet-700 border-violet-200',    label: '📱 UPI' },
  bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',          label: '🏦 Bank' },
};
const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

const buildOfflinePurchaseItems = (rawItems, products) => (
  (rawItems || []).map((item) => {
    const product = products.find((prod) => prod._id === item.product_id);
    return {
      product_id: item.product_id,
      product: item.product_id,
      quantity: Number(item.quantity || 0),
      price_per_unit: Number(item.price_per_unit || 0),
      product_name: product?.name || item.product_name || 'Product',
      hsn_code: product?.hsn_code || item.hsn_code || '',
      gst_rate: Number(item.gst_rate ?? product?.gst_rate ?? 0),
    };
  }).filter((item) => item.product_id && item.quantity > 0)
);

export default function PurchasesPage() {
  const { term, config } = useIndustry();
  const inv          = getInvBehavior(config);
  const batchPurch   = isBatchMode(inv);
  const variantPurch = isVariantMode(inv);
  const serialPurch  = isSerialMode(inv);
  const router = useRouter();

  /* ── State that stays in page.js ── */
  const [products, setProducts] = useState([]);
  const [shopState, setShopState] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnToast, setReturnToast] = useState('');

  /* ── Callbacks that stay in page.js ── */
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const productList = Array.isArray(data) ? data : data.products || [];
      setProducts(productList);
      await cacheProducts(productList);
    } catch {
      if (!isOnline) {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) setProducts(cached);
      }
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
  const { purchases, setPurchases, summary, loading, refreshing, hasMorePurchases, loadingMore, highlightedPurchaseId, setHighlightedPurchaseId, fetchPurchases, loadMorePurchases, fetchAll } = usePurchasesData({ router, isOnline, products, setProducts, fetchProducts });

  const { showModal, setShowModal, submitting, editingPurchaseId, error, setError, gstinTouched, items, setItems, form, updateForm, showInlineProductForm, inlineProductRowIndex, creatingProduct, newProductForm, setNewProductForm, billTotals, roundedBill, balanceDue, gstinValue, gstinValid, showGstinError, showGstinLengthHint, calcRowGST, resetModal, updateItem, addItem, removeItem, handleSupplierGstinChange, handleSubmit, startEditPurchase, resetInlineProductForm, openInlineProductForm, createInlineProduct, sendPurchaseWhatsApp } = usePurchaseForm({ shopState, isOnline, fetchAll, products, setProducts, setPurchases });

  /* ── Functions that stay in page.js ── */
  const handleDelete = async (purchase) => {
    if (purchase?._isOffline) {
      if (!confirm('Is pending offline purchase ko local queue se hatana hai?')) return;
      const removed = await removeQueuedOperation(purchase._id);
      if (!removed) { setError('Pending offline purchase remove nahi ho paayi'); return; }
      setPurchases((current) => current.filter((entry) => entry._id !== purchase._id));
      setError(''); return;
    }
    if (!confirm('Delete this purchase? Stock will be restored.')) return;
    try {
      const res = await fetch(apiUrl(`/api/purchases/${purchase._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.message || 'Could not delete purchase'); return; }
      fetchPurchases();
    } catch { setError('Could not delete purchase'); }
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

  /* ── Effects that stay in page.js ── */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if (shopState || !localStorage.getItem('token')) return;
    fetchShopMeta();
  }, [fetchShopMeta, shopState]);

  /* ── PayBadge (kept for potential direct use) ── */
  const PayBadge = ({ type }) => {
    const s = PAY_BADGE[type] || PAY_BADGE.cash;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>{s.label}</span>;
  };

  /* ── Derived values ── */
  const pendingOfflinePurchases = purchases.filter((purchase) => purchase?._isOffline);
  const offlinePurchaseValue = pendingOfflinePurchases.reduce((sum, purchase) => sum + Number(purchase?.total_amount || 0), 0);
  const offlineItc = pendingOfflinePurchases.reduce((sum, purchase) => sum + Number(purchase?.total_gst || 0), 0);
  const offlineDue = pendingOfflinePurchases.reduce((sum, purchase) => sum + Number(purchase?.balance_due || 0), 0);
  const totalSpendDisplay = Number(summary.totalPurchaseValue || 0) + offlinePurchaseValue;
  const totalItcDisplay = Number(summary.totalITC || 0) + offlineItc;
  const totalDueDisplay = Number(summary.totalDue || 0) + offlineDue;
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch = !normalizedBillSearch || getPurchaseSearchText(purchase).includes(normalizedBillSearch);
    const matchesMonth = !billMonth || getMonthFilterValue(purchase.createdAt || purchase.purchased_at) === billMonth;
    return matchesSearch && matchesMonth;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth);

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
        <div className="relative overflow-hidden mb-5 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-white via-green-50/40 to-emerald-50/40 p-6 shadow-lg hover:shadow-xl transition-shadow">
          {/* Green decorative orbs */}
          <div className="pointer-events-none absolute -top-12 -right-8 w-40 h-40 rounded-full bg-green-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-200/30 blur-3xl" />
          
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-300 text-[11px] font-black uppercase tracking-widest text-green-800 shadow-sm">
                📦 खरीद • Purchase
              </span>
              <h1 className="mt-3 text-[26px] font-black text-slate-900">
                Purchases / खरीदिए
              </h1>
              <p className="mt-2 text-[14px] text-slate-600 font-medium">
                Supplier bills, ITC, and payable balance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/purchases/suppliers"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-md hover:border-green-300 hover:bg-green-50 hover:-translate-y-0.5 transition-all"
              >
                {term('supplierDirectoryHindi', 'सप्लायर लिस्ट')}
              </Link>
              <button
                type="button"
                onClick={() => { resetModal(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                + {term('newPurchase', 'New Purchase')}
              </button>
            </div>
          </div>
        </div>

        {pendingOfflinePurchases.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl">📶</span>
            <div className="flex-1">
              <div className="text-[13px] font-black text-amber-800">
                {pendingOfflinePurchases.length} offline purchase{pendingOfflinePurchases.length > 1 ? 's' : ''} pending
              </div>
              <div className="text-[11px] text-amber-600">
                Ye purchase entries local queue me saved hain. Internet aate hi sync ho jayengi.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3 mb-5">
          {/* Spend card — net after returns */}
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-200 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute top-2 right-2 text-3xl opacity-10">💸</div>
            <div className="text-[24px] font-black text-amber-800">₹{fmt(totalSpendDisplay)}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">Net Spend</div>
            {Number(summary.totalReturnedAmount || 0) > 0 && (
              <div className="text-[10px] font-bold text-rose-500 mt-0.5">↩ -₹{fmt(Number(summary.totalReturnedAmount || 0))} returned</div>
            )}
          </div>
          {/* ITC card — net after returns */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-sky-100 border-2 border-blue-200 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute top-2 right-2 text-3xl opacity-10">📊</div>
            <div className="text-[24px] font-black text-blue-800">₹{fmt(totalItcDisplay)}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">Net ITC</div>
            {Number(summary.totalReturnedGST || 0) > 0 && (
              <div className="text-[10px] font-bold text-rose-500 mt-0.5">↩ -{fmt(Number(summary.totalReturnedGST || 0))} adj.</div>
            )}
          </div>
          {/* Due card */}
          <div className={`relative overflow-hidden bg-gradient-to-br ${totalDueDisplay > 0 ? 'from-rose-50 to-red-100 border-rose-200' : 'from-emerald-50 to-green-100 border-emerald-200'} border-2 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
            <div className="absolute top-2 right-2 text-3xl opacity-10">{totalDueDisplay > 0 ? '⚠️' : '✅'}</div>
            <div className={`text-[24px] font-black ${totalDueDisplay > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>₹{fmt(totalDueDisplay)}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">Due</div>
            {totalDueDisplay > 0 && (
              <button type="button" onClick={focusPendingPurchase} className="mt-2 text-[11px] font-black text-green-700 hover:text-green-800">
                Pay Now
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-md mb-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
              placeholder={`🔍 ${term('searchPurchase', 'Search bill, supplier, phone or product...')}`}
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all sm:w-40"
              type="month"
              value={billMonth}
              onChange={(e) => setBillMonth(e.target.value)}
            />
            {hasBillFilters && (
              <button
                type="button"
                onClick={() => { setBillSearch(''); setBillMonth(''); }}
                className="h-11 px-4 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && !showModal && (
          <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
            <span className="text-base leading-none">!</span>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton-card border border-slate-200/60" style={{ height: 112 }} />
            ))}
          </div>
        ) : filteredPurchases.length === 0 ? (
          hasBillFilters ? (
            <div className="empty-state">
              <div className="empty-state-icon mx-auto mb-4 text-[26px]">🔍</div>
              <p className="text-[14px] font-extrabold text-slate-700 mb-1">कोई खरीदारी नहीं मिली</p>
              <p className="text-[12px] text-slate-400">Filter बदलें या search हटाएं</p>
            </div>
          ) : (
            <EmptyState
              emoji="📦"
              title="कोई खरीदारी दर्ज नहीं"
              subtitle="Supplier से माल खरीदा? यहाँ दर्ज करें और stock automatically update होगा।"
              actionLabel={`+ ${term('newPurchase', 'खरीदारी जोड़ें')}`}
              onAction={() => { resetModal(); setShowModal(true); }}
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPurchases.map((p) => {
              const isHighlighted = p._id === highlightedPurchaseId;
              return (
                <PurchaseCard
                  key={p._id}
                  p={p}
                  isHighlighted={isHighlighted}
                  sendPurchaseWhatsApp={sendPurchaseWhatsApp}
                  startEditPurchase={startEditPurchase}
                  handleDelete={handleDelete}
                  onReturnClick={setReturnPurchase}
                />
              );
            })}

            {/* Load older purchases */}
            {hasMorePurchases && !normalizedBillSearch && !billMonth && (
              <button
                onClick={loadMorePurchases}
                disabled={loadingMore}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 transition-all"
              >
                {loadingMore ? 'Loading...' : '↓ Load older purchases'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* RETURN SUCCESS TOAST */}
      {returnToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-green-300 shadow-xl text-[13px] font-bold text-green-800 animate-fade-in">
          <span className="text-base">✅</span>
          {returnToast}
        </div>
      )}

      {/* PURCHASE RETURN MODAL */}
      {returnPurchase && (
        <PurchaseReturnModal
          purchase={returnPurchase}
          onClose={() => setReturnPurchase(null)}
          onSuccess={(ret) => {
            setReturnPurchase(null);
            fetchPurchases();
            setReturnToast(`Credit Note ${ret.credit_note_number} created — ₹${Number(ret.total_amount || 0).toFixed(2)} returned`);
            window.setTimeout(() => setReturnToast(''), 4000);
          }}
        />
      )}

      {/* PURCHASE MODAL */}
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
        />
    </Layout>
  );
}