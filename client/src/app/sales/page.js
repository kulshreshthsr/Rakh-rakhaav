'use client';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { useAppLocale } from '../../components/AppLocale';
import { useIndustry } from '../../contexts/IndustryContext';
import DynamicFormField from '../../components/DynamicFormField';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { getDisplayQueue, queueSale, removeQueuedOperation } from '../../lib/offlineQueue';
import { cacheProducts, getCachedProducts } from '../../lib/offlineDB';
import { apiUrl } from '../../lib/api';
import { getInvBehavior, isBatchMode, isVariantMode, isSerialMode, isRecipeMode } from '../../lib/inventoryBehavior';
import { generateInvoiceHTML } from '../../lib/generateInvoice';
import { getWorkflowConfig, getStages, getSaleWorkflowStatus, getStageColors } from '../../lib/workflowEngine';
import WorkflowStatusBadge from '../../components/WorkflowStatusBadge';
import eventBus from '../../lib/eventBus';

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '', item_metadata: {} });
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_LENGTH = 15;
const SALES_CACHE_KEY = 'sales-page';
const normalizeBarcode = (value = '') => String(value).replace(/\s+/g, '').trim();
const normalizeGstin = (value) => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);
const normalizeState = (value = '') => value.trim().toLowerCase();
const formatDateInputValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getDefaultSaleDateValue = () => formatDateInputValue(new Date());
const getSaleRecordDateISO = (value, referenceValue = new Date()) => {
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
const getSaleSearchText = (sale) => {
  const itemNames = Array.isArray(sale.items) ? sale.items.map((item) => item.product_name || '').join(' ') : '';
  return [sale.invoice_number, sale.product_name, sale.buyer_name, sale.buyer_phone, sale.notes, itemNames].join(' ').toLowerCase();
};
const buildInitialForm = (overrides = {}) => ({
  payment_type: 'cash', amount_paid: '', buyer_name: '', buyer_phone: '',
  buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '',
  sale_date: getDefaultSaleDateValue(), ...overrides,
});
const formatFullDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const GST_STATE_CODE_MAP = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand',
  '06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim',
  '12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh',
  '23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'Andaman & Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh',
};
const getRoundedBillValues = (amount) => {
  const numericAmount = Number(amount || 0);
  const roundedTotal = Math.round(numericAmount);
  return { roundedTotal, roundOff: parseFloat((roundedTotal - numericAmount).toFixed(2)) };
};
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};
const QUICK_QUANTITY_OPTIONS = [1, 2, 5, 10];
const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'failed')    return { label: 'Sync failed', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (status === 'abandoned') return { label: 'Sync retry needed', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Sync pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
};
const buildOfflineSaleItems = (rawItems, products) => (
  (rawItems || []).map((item) => {
    const product = products.find((prod) => prod._id === item.product_id);
    return {
      product_id: item.product_id, product: item.product_id,
      quantity: Number(item.quantity || 0), price_per_unit: Number(item.price_per_unit || 0),
      product_name: product?.name || item.product_name || 'Product',
      hsn_code: product?.hsn_code || item.hsn_code || '',
      gst_rate: Number(item.gst_rate ?? product?.gst_rate ?? 0),
      cost_price: Number(item.cost_price ?? product?.cost_price ?? 0),
    };
  }).filter((item) => item.product_id && item.quantity > 0)
);
const buildWhatsAppShareMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const advancePaid = sale.payment_type === 'credit' ? parseFloat(sale.amount_paid || 0) : parseFloat(sale.total_amount || 0);
  const dueAmount = sale.payment_type === 'credit' ? Math.max(0, parseFloat(sale.total_amount || 0) - advancePaid) : 0;
  const payLabel = sale.payment_type === 'cash' ? 'Cash (Paid)' : sale.payment_type === 'upi' ? 'UPI (Paid)' : sale.payment_type === 'bank' ? 'Bank Transfer' : 'Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) => `  ${i + 1}. ${item.product_name} x ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`).join('\n')
    : `  1. ${sale.product_name} x ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;
  return [sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste ${sale.buyer_name} ji,` : 'Namaste,','',`Invoice / Bill Details`,`Shop: ${shopName || 'Rakh-Rakhaav'}`,`Invoice No: ${sale.invoice_number}`,`Date: ${saleDate}`,`Items:`,itemLines,`Taxable Amount: ₹${fmt(sale.taxable_amount)}`,`GST: ₹${fmt(sale.total_gst)}`,`Total Amount: ₹${fmt(sale.total_amount)}`,`Payment: ${payLabel}`,...(sale.payment_type === 'credit' ? [`Advance Payment: ₹${fmt(advancePaid)}`,`Udhaar / Due: ₹${fmt(dueAmount)}`] : []),'',`Thank you for choosing ${shopName || 'Rakh-Rakhaav'}`].join('\n');
};

/* ─── Payment badge ── */
const PAY_BADGE = {
  cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '💵 Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 उधार' },
  upi:    { cls: 'bg-green-50 text-green-700 border-green-200',        label: '📱 UPI'  },
  bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: '🏦 Bank' },
};

/* ─── All possible payment tab definitions ── */
const PAYMENT_TAB_DEFS = {
  cash:   { type: 'cash',   label: '💵 कैश',     active: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg',     isCredit: false },
  upi:    { type: 'upi',    label: '📱 UPI',      active: 'bg-gradient-to-r from-green-500 to-teal-600 text-white shadow-lg',         isCredit: false },
  bank:   { type: 'bank',   label: '🏦 Bank',     active: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg',          isCredit: false },
  credit: { type: 'credit', label: '📒 उधार',    active: 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg',           isCredit: true  },
};
const PayBadge = ({ type }) => {
  const s = PAY_BADGE[type] || PAY_BADGE.cash;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>{s.label}</span>;
};

/* ── Reusable input class ── */
const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

/* ══════════════════════════════════════════════════════════════════ */
export default function SalesPage() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const { term, config } = useIndustry();

  /* ── Schema-derived constants ── */
  const sSchema        = config.saleFormSchema || {};
  const barcodeEnabled = sSchema.showBarcodeScanner !== false;
  const paymentMethods = Array.isArray(sSchema.paymentMethods) && sSchema.paymentMethods.length
    ? sSchema.paymentMethods : ['cash', 'credit'];
  const activeTabs     = paymentMethods.map(m => PAYMENT_TAB_DEFS[m]).filter(Boolean);
  const defaultPayment = sSchema.defaultPayment || 'cash';

  /* ── Workflow config ── */
  const wfc = getWorkflowConfig(config);

  /* ── Inventory behavior ── */
  const inv          = getInvBehavior(config);
  const batchSales   = isBatchMode(inv);
  const variantSales = isVariantMode(inv);
  const serialSales  = isSerialMode(inv);
  const recipeSales  = isRecipeMode(inv);

  /* ── All state (UNCHANGED) ── */
  const [sales, setSales]           = useState([]);
  const [summary, setSummary]       = useState({});
  const [products, setProducts]     = useState([]);
  const [shopName, setShopName]     = useState('');
  const [shopState, setShopState]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [editingSaleId, setEditingSaleId] = useState('');
  const [error, setError]           = useState('');
  const [items, setItems]           = useState([emptyItem()]);
  const [gstinTouched, setGstinTouched] = useState(false);
  const [form, setForm]             = useState(() => buildInitialForm({ payment_type: defaultPayment }));
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth]   = useState('');
  const [extraFields, setExtraFields]           = useState({});
  const [wfFilter, setWfFilter]                 = useState('');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showMoreCustomerDetails, setShowMoreCustomerDetails] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Sub-inventory cache: productId → { batches: [], variants: [] }
  const [productBatches,  setProductBatches]  = useState({});
  const [productVariants, setProductVariants] = useState({});

  const amountPaidInputRef  = useRef(null);
  const buyerNameInputRef   = useRef(null);
  const customerComboRef    = useRef(null);
  const saleDateInputRef    = useRef(null);
  const hasBootstrappedRef  = useRef(false);

  /* ── All logic (100% UNCHANGED) ── */
  const loadPendingOfflineSales = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();
      if (!Array.isArray(queueItems) || queueItems.length === 0) return [];
      return queueItems.filter((operation) => operation?.type === 'CREATE_SALE').map((operation) => {
        const queuedItems = Array.isArray(operation?.payload?.items) ? operation.payload.items : [];
        const taxableAmount = queuedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0), 0);
        const totalGst = queuedItems.reduce((sum, item) => {
          const product = products.find((prod) => prod._id === item.product_id);
          const taxable = Number(item.quantity || 0) * Number(item.price_per_unit || 0);
          const gstRate = Number(item.gst_rate ?? product?.gst_rate ?? 0);
          return sum + (taxable * gstRate) / 100;
        }, 0);
        return {
          _id: operation.id, invoice_number: operation.tempId,
          _queueStatus: operation.status || 'pending', _queueError: operation.error || '',
          items: queuedItems.map((item) => {
            const product = products.find((prod) => prod._id === item.product_id);
            return { product_name: item.product_name || product?.name || 'Product', quantity: item.quantity, price_per_unit: item.price_per_unit, total_amount: Number(item.quantity || 0) * Number(item.price_per_unit || 0) };
          }),
          product_name: queuedItems[0]?.product_name || products.find((prod) => prod._id === queuedItems[0]?.product_id)?.name || 'Product',
          total_amount: taxableAmount + totalGst, taxable_amount: taxableAmount, total_gst: totalGst,
          payment_type: operation?.payload?.payment_type,
          buyer_name: operation?.payload?.buyer_name || 'Walk-in Customer',
          buyer_phone: operation?.payload?.buyer_phone,
          createdAt: operation?.createdAt || new Date().toISOString(), _isOffline: true,
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
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      const nextSummary = data.summary || {};
      const mergedSales = await mergeSalesWithPendingQueue(nextSales);
      setSales(mergedSales); setSummary(nextSummary);
      writePageCache(SALES_CACHE_KEY, { sales: mergedSales, summary: nextSummary });
    } catch { setError('Sales load nahi ho saki'); }
  }, [mergeSalesWithPendingQueue, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchSales();
    setLoading(false);
  }, [fetchSales]);

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

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(SALES_CACHE_KEY);
    if (cached?.sales) {
      mergeSalesWithPendingQueue(cached.sales).then((mergedSales) => setSales(mergedSales));
      setSummary(cached.summary || {}); setLoading(false);
    }
    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.sales));
      await fetchAll(); await fetchProducts(); setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchAll, fetchProducts, mergeSalesWithPendingQueue, router]);

  useEffect(() => {
    if ((!showModal && !sales.length) || (shopName && shopState) || !localStorage.getItem('token')) return;
    fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(shop => { setShopName(shop.name || ''); setShopState(shop.state || ''); }).catch(() => {});
  }, [showModal, sales.length, shopName, shopState]);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const className = 'sales-modal-open';
    if (showModal) document.body.classList.add(className);
    else document.body.classList.remove(className);
    return () => document.body.classList.remove(className);
  }, [showModal]);

  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) return undefined;
    const handleSyncComplete = () => fetchAll();
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('offline-sync-complete', handleSyncComplete);
  }, [fetchAll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const wf = params.get('wf');
    if (wf) { setWfFilter(wf); router.replace('/sales'); return; }
    if (params.get('open') !== '1' || params.get('payment') !== 'credit') return;
    setEditingSaleId(''); setItems([emptyItem()]); setForm(buildInitialForm({ payment_type: 'credit' }));
    setGstinTouched(false); setError(''); setShowModal(true); router.replace('/sales');
  }, [router]);

  const updateItem = (index, field, value) => {
    const updated = [...items]; updated[index][field] = value;
    if (field === 'product_id' && value) { const prod = products.find(p => p._id === value); if (prod) updated[index].price_per_unit = prod.price || ''; }
    setItems(updated);
  };
  const updateItemQuantityBy = (index, delta) => setItems((current) => current.map((item, itemIndex) => itemIndex !== index ? item : { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }));
  const applyQuickQuantity = (index, quantity) => updateItem(index, 'quantity', quantity);
  const duplicateItem = (index) => setItems((current) => { const source = current[index]; if (!source) return current; const nextItems = [...current]; nextItems.splice(index + 1, 0, { ...source }); return nextItems; });
  const loadBatchesFor = async (pid) => {
    if (productBatches[pid]) return;
    try {
      const res  = await fetch(apiUrl(`/inventory/batches/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProductBatches(prev => ({ ...prev, [pid]: (Array.isArray(data) ? data : []).filter(b => !b.is_depleted && b.quantity > 0) }));
    } catch {}
  };

  const loadVariantsFor = async (pid) => {
    if (productVariants[pid]) return;
    try {
      const res  = await fetch(apiUrl(`/inventory/variants/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProductVariants(prev => ({ ...prev, [pid]: Array.isArray(data) ? data : [] }));
    } catch {}
  };

  const handleProductSelect = (index, product) => {
    updateItem(index, 'product_id', product._id);
    const initialMeta = recipeSales ? { deduct_recipe: true } : {};
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity || 1, price_per_unit: product.price || item.price_per_unit, item_metadata: initialMeta } : item));
    if (batchSales)   loadBatchesFor(product._id);
    if (variantSales) loadVariantsFor(product._id);
  };
  const addOrIncrementProduct = (product) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.product_id === product._id);
      if (existingIndex >= 0) return current.map((item, itemIndex) => itemIndex === existingIndex ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1), price_per_unit: item.price_per_unit || product.price || '' } : item);
      const emptyIndex = current.findIndex((item) => !item.product_id);
      if (emptyIndex >= 0) return current.map((item, itemIndex) => itemIndex === emptyIndex ? { ...item, product_id: product._id, quantity: item.quantity || 1, price_per_unit: product.price || item.price_per_unit } : item);
      return [...current, { product_id: product._id, quantity: 1, price_per_unit: product.price || '' }];
    });
  };
  const handleBarcodeDetected = (detectedCode) => {
    const barcode = normalizeBarcode(detectedCode);
    const matchedProduct = products.find((product) => normalizeBarcode(product.barcode) === barcode);
    if (!matchedProduct) { setError('Scanned barcode did not match any product.'); return; }
    setError(''); addOrIncrementProduct(matchedProduct);
  };
  const addItem    = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const rowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable  = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst      = (taxable * gst_rate) / 100;
    const isIGST   = normalizeState(shopState) && normalizeState(form.buyer_state) ? normalizeState(shopState) !== normalizeState(form.buyer_state) : false;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2, isIGST };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = rowGST(item);
    if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });
  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill = getRoundedBillValues(billTotals.total);
  const gstinValue = normalizeGstin(form.buyer_gstin);
  const gstinComplete = gstinValue.length === GSTIN_LENGTH;
  const gstinValid = !gstinValue || (gstinComplete && GSTIN_REGEX.test(gstinValue));
  const showGstinError = gstinTouched && gstinComplete && !gstinValid;
  const showGstinLengthHint = gstinTouched && !!gstinValue && !gstinComplete;

  const handleBuyerGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    updateForm({ buyer_gstin: normalized, ...(detectedState ? { buyer_state: detectedState } : {}) });
    setGstinTouched(Boolean(normalized));
  };

  function resetForm(overrides = {}) {
    const nextPaymentType = overrides.payment_type || form.payment_type || defaultPayment;
    setEditingSaleId(''); setItems([emptyItem()]);
    setForm(buildInitialForm({ payment_type: nextPaymentType, amount_paid: '', ...overrides }));
    setGstinTouched(false); setError(''); setExtraFields({}); setCustomerQuery('');
    setShowCustomerInfo(false); setShowCustomerSuggestions(false); setShowMoreCustomerDetails(false);
  }

  async function handleSubmit(e) {
    e?.preventDefault(); setError(''); setGstinTouched(true);
    if (form.payment_type === 'credit' && !form.buyer_name) { setError('Customer name is required for credit sales.'); return; }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
    const validItems = items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('Select at least one product.'); return; }
    for (const item of validItems) {
      const prod = products.find((p) => p._id === item.product_id);
      if (prod && Number(item.quantity) > (prod.quantity || 0)) { setError(prod.name + ': only ' + prod.quantity + ' items are available in stock.'); return; }
    }
    setSubmitting(true);
    if (!isOnline) {
      if (editingSaleId) { setError('Editing existing sales requires internet connection.'); setSubmitting(false); return; }
      try {
        const offlineItems = buildOfflineSaleItems(validItems, products);
        const operation = await queueSale({ ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total }, offlineItems);
        if (!operation) throw new Error('Unable to save sale offline');
        setShowModal(false); resetForm();
        setSales(prev => [{ _id: operation.id, invoice_number: operation.tempId, items: offlineItems.map((item) => ({ product_name: item.product_name, quantity: item.quantity, total_amount: Number(item.quantity) * Number(item.price_per_unit) })), total_amount: billTotals.total, taxable_amount: billTotals.taxable, total_gst: billTotals.gst, payment_type: form.payment_type, buyer_name: form.buyer_name || 'Walk-in Customer', buyer_phone: form.buyer_phone, createdAt: getSaleRecordDateISO(form.sale_date), _isOffline: true }, ...prev]);
      } catch (err) { setError('Offline save failed: ' + (err?.message || 'Unknown error')); }
      setSubmitting(false); return;
    }
    try {
      const isEditing = Boolean(editingSaleId);
      const res = await fetch(isEditing ? apiUrl(`/api/sales/${editingSaleId}`) : apiUrl('/api/sales'), {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items: validItems, ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total, extra_fields: extraFields }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEditing && data?._id) setSales((current) => current.map((sale) => (sale._id === data._id ? data : sale)).sort((a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime()));
        if (!isEditing) eventBus.emit('INVOICE_CREATED', { saleId: data._id });
        setShowModal(false); resetForm(); fetchAll();
      } else { setError(data.message || 'Failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  }

  const handleShortcutSubmit = useEffectEvent(() => handleSubmit());
  const handleShortcutAddItem = useEffectEvent(() => addItem());

  useEffect(() => {
    if (!showModal) return undefined;
    const timeoutId = window.setTimeout(() => buyerNameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timeoutId);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onPointerDown = (event) => { if (customerComboRef.current && !customerComboRef.current.contains(event.target)) setShowCustomerSuggestions(false); };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') { event.preventDefault(); handleShortcutSubmit(); }
      if (event.altKey && event.key.toLowerCase() === 'a') { event.preventDefault(); handleShortcutAddItem(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  const startEditSale = (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale sync hone se pehle edit nahi hogi.'); return; }
    const sourceItems = sale.items && sale.items.length > 0 ? sale.items : [{ product: sale.product, quantity: sale.quantity, price_per_unit: sale.price_per_unit }];
    setEditingSaleId(sale._id);
    setItems(sourceItems.map((item) => ({ product_id: item.product?._id || item.product || '', quantity: item.quantity || 1, price_per_unit: item.price_per_unit || '', item_metadata: item.item_metadata && typeof item.item_metadata === 'object' ? { ...item.item_metadata } : {} })));
    setExtraFields(sale.extra_fields && typeof sale.extra_fields === 'object' ? { ...sale.extra_fields } : {});
    setForm(buildInitialForm({ payment_type: sale.payment_type || 'cash', amount_paid: sale.payment_type === 'credit' ? String(sale.amount_paid || '') : '', buyer_name: sale.buyer_name || '', buyer_phone: sale.buyer_phone || '', buyer_gstin: sale.buyer_gstin || '', buyer_address: sale.buyer_address || '', buyer_state: sale.buyer_state || '', notes: sale.notes || '', sale_date: formatDateInputValue(sale.createdAt || sale.sold_at) || getDefaultSaleDateValue() }));
    setGstinTouched(false); setError(''); setCustomerQuery(sale.buyer_name || '');
    setShowCustomerInfo(Boolean(sale.payment_type === 'credit' || sale.buyer_name || sale.buyer_phone || sale.buyer_gstin || sale.buyer_address || sale.buyer_state));
    setShowMoreCustomerDetails(Boolean(sale.buyer_gstin || sale.buyer_address || sale.buyer_state));
    setShowModal(true);
  };

  const handleDelete = async (sale) => {
    if (sale?._isOffline) {
      if (!confirm('Is pending offline sale ko local queue se hatana hai?')) return;
      const removed = await removeQueuedOperation(sale._id);
      if (!removed) { setError('Pending offline sale remove nahi ho paayi'); return; }
      setSales((current) => current.filter((entry) => entry._id !== sale._id)); setError(''); return;
    }
    if (!confirm('Are you sure? Stock will also adjust.')) return;
    try { await fetch(apiUrl(`/api/sales/${sale._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }); fetchAll(); }
    catch { setError('Delete failed'); }
  };

  const advanceWorkflowStage = async (saleId, nextStage, action) => {
    try {
      const res = await fetch(apiUrl(`/api/sales/${saleId}/workflow`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ workflow_status: nextStage }),
      });
      if (!res.ok) { setError('Status update failed'); return; }
      const updated = await res.json();
      setSales(current => current.map(s => s._id === saleId ? { ...s, extra_fields: updated.extra_fields } : s));
      eventBus.emit('WORKFLOW_ADVANCED', { saleId, newStage: nextStage });
      if (action?.triggerInvoice) {
        const sale = sales.find(s => s._id === saleId);
        if (sale) printInvoice({ ...sale, extra_fields: updated.extra_fields });
      }
    } catch { setError('Status update failed'); }
  };

  const printInvoice = async (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale ka invoice sync ke baad print hoga'); return; }
    try { const shopRes = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } }); const shop = await shopRes.json(); generateInvoiceHTML(sale, shop, config, true); }
    catch { alert('Invoice could not be generated.'); }
  };

  const shareWhatsApp = (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale ko sync ke baad share karein'); return; }
    const msg   = buildWhatsAppShareMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    const waUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  /* ── Derived (UNCHANGED) ── */
  const pendingOfflineSales = sales.filter((sale) => sale?._isOffline);
  const offlineRevenue = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0);
  const offlineGst     = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0);
  const revenueDisplay = Number(summary.totalRevenue || 0) + offlineRevenue;
  const gstDisplay     = Number(summary.totalGST || 0) + offlineGst;
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredSales = sales.filter((sale) => {
    const matchesSearch = !normalizedBillSearch || getSaleSearchText(sale).includes(normalizedBillSearch);
    const matchesMonth  = !billMonth || getMonthFilterValue(sale.createdAt || sale.sold_at) === billMonth;
    const matchesWf     = !wfFilter  || getSaleWorkflowStatus(sale, wfc) === wfFilter;
    return matchesSearch && matchesMonth && matchesWf;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth || wfFilter);
  const pastCustomers = useMemo(() => {
    const seen = new Set();
    return sales.filter((s) => s.buyer_name && s.buyer_name !== 'Walk-in Customer' && s.buyer_phone).filter((s) => { const key = s.buyer_phone; if (seen.has(key)) return false; seen.add(key); return true; }).map((s) => ({ name: s.buyer_name, phone: s.buyer_phone, state: s.buyer_state || '', address: s.buyer_address || '', gstin: s.buyer_gstin || '' }));
  }, [sales]);
  const filteredPastCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return pastCustomers.slice(0, 5);
    return pastCustomers.filter((customer) => customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query)).slice(0, 5);
  }, [customerQuery, pastCustomers]);
  const invoicePreview = editingSaleId
    ? (sales.find((sale) => sale._id === editingSaleId)?.invoice_number || 'Editing invoice')
    : `INV/${new Date().getFullYear().toString().slice(-2)}-${String(new Date().getFullYear() + 1).slice(-2)}/${String(sales.length + 1).padStart(4, '0')}`;
  const selectPastCustomer = (customer) => {
    updateForm({ buyer_name: customer.name, buyer_phone: customer.phone, buyer_state: customer.state, buyer_address: customer.address, buyer_gstin: customer.gstin });
    setCustomerQuery(customer.name); setShowCustomerInfo(true); setShowCustomerSuggestions(false);
    setShowMoreCustomerDetails(Boolean(customer.gstin || customer.address || customer.state));
  };
  const customerInfoVisible = form.payment_type === 'credit' || showCustomerInfo;
  const customerSummary = form.buyer_name || form.buyer_phone
    ? [form.buyer_name || 'Customer selected', form.buyer_phone || 'No phone'].join(' • ')
    : 'Walk-in customer';

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">

        {/* ── Page header ── */}
        <div className="relative overflow-hidden mb-5 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-white via-green-50/40 to-emerald-50/40 p-6 shadow-lg hover:shadow-xl transition-shadow">
          {/* Green decorative orbs */}
          <div className="pointer-events-none absolute -top-12 -right-8 w-40 h-40 rounded-full bg-green-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-200/30 blur-3xl" />
          
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-300 text-[11px] font-black uppercase tracking-widest text-green-800 shadow-sm">
                {config.icon || '🧾'} बिक्री • {term('sales', 'Sales')}
              </span>
              <h1 className="mt-3 text-[26px] font-black text-slate-900">
                {term('sales', 'Sales')} / बेचिए
              </h1>
              <p className="mt-2 text-[14px] text-slate-600 font-medium">
                {term('invoice', 'Invoice')} और {term('customer', 'customer')} payment flow
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/sales/customers"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-700 shadow-md hover:border-green-300 hover:bg-green-50 hover:-translate-y-0.5 transition-all"
              >
                👥 {term('customers', 'Customers')}
              </Link>
              <button
                type="button"
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                + {term('newSale', 'New Sale')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Mode</div>
              <div className="text-[11px] text-amber-600">Sales offline save होंगी, internet आने पर sync होंगी</div>
            </div>
          </div>
        )}

        {/* ── Workflow stage filter tabs (only shown when business has a workflow) ── */}
        {wfc && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            <button
              type="button"
              onClick={() => setWfFilter('')}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-black border-2 transition-all ${!wfFilter ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              All {wfc.saleNounPlural || 'Sales'}
            </button>
            {getStages(wfc).map(stage => {
              const colors  = getStageColors(stage);
              const isActive = wfFilter === stage.id;
              const count   = sales.filter(s => getSaleWorkflowStatus(s, wfc) === stage.id).length;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setWfFilter(isActive ? '' : stage.id)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black border-2 transition-all ${isActive ? `${colors.border} ${colors.bg} ${colors.text}` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                >
                  {stage.icon} {stage.label}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/70 ' + colors.text : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Revenue', value: `₹${fmt(revenueDisplay)}`, gradient: 'from-green-50 to-emerald-100', text: 'text-green-800', icon: '💰', border: 'border-green-200' },
            { label: 'GST', value: `₹${fmt(gstDisplay)}`, gradient: 'from-amber-50 to-orange-100', text: 'text-amber-800', icon: '📊', border: 'border-amber-200' },
            { label: term('kpiInvoices', 'Invoices'), value: filteredSales.length, gradient: 'from-slate-50 to-gray-100', text: 'text-slate-800', icon: '🧾', border: 'border-slate-200' },
          ].map((k) => (
            <div key={k.label} className={`relative overflow-hidden bg-gradient-to-br ${k.gradient} border-2 ${k.border} rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
              <div className="absolute top-2 right-2 text-3xl opacity-10">{k.icon}</div>
              <div className={`text-[24px] font-black ${k.text}`}>{k.value}</div>
              <div className="text-[11px] font-bold text-slate-600 uppercase">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-md mb-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
              placeholder={`🔍 ${term('searchSale', 'Search invoice, customer, product...')}`}
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-11 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all sm:w-40"
              type="month" value={billMonth}
              onChange={(e) => setBillMonth(e.target.value)}
            />
            {hasBillFilters && (
              <button type="button" onClick={() => { setBillSearch(''); setBillMonth(''); }}
                className="h-11 px-4 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >Clear</button>
            )}
          </div>
        </div>

        {/* ── Sales list ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">🧾</div>
            <div className="text-[15px] font-bold text-slate-700 mb-1">
              {hasBillFilters ? `कोई ${term('sale', 'sale')} नहीं मिली` : term('noSales', `अभी कोई ${term('sale', 'sale')} नहीं है`)}
            </div>
            <div className="text-[12px] text-slate-400 mb-5">
              {hasBillFilters ? 'Filter बदलकर देखें' : `पहला ${term('invoice', 'bill')} बनाओ और शुरू हो जाओ`}
            </div>
            {!hasBillFilters && (
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-md hover:shadow-lg transition-all"
              >
                + {term('newSale', 'पहला Bill बनाएं')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSales.map((s) => {
              const meta = s._isOffline ? getOfflineBadgeMeta(s._queueStatus) : null;
              return (
                <div key={s._id} className={`group relative overflow-hidden rounded-2xl border-2 bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all ${s._isOffline ? 'border-amber-200' : 'border-slate-200 hover:border-green-300'}`}>
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-emerald-50/0 group-hover:from-green-50/50 group-hover:to-emerald-50/30 transition-all pointer-events-none" />
                  
                  {/* Offline banner */}
                  {s._isOffline && (
                    <div className={`flex items-center gap-2 px-4 py-2 border-b text-[11px] font-black ${meta.color}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {meta.label}
                      {s._queueError && <span className="font-normal text-rose-600 ml-1">{s._queueError}</span>}
                    </div>
                  )}

                  <div className="relative p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-[13px] font-black text-green-700">{s.invoice_number}</span>
                        <p className="text-[15px] font-bold text-slate-700 mt-0.5">
                          {s.buyer_name || 'Walk-in Customer'}
                        </p>
                      </div>
                      <div className="text-[22px] font-black text-green-700">₹{fmt(s.total_amount)}</div>
                    </div>

                    {/* Items summary + payment badge */}
                    <div className="flex gap-2 mb-4 text-[12px]">
                      <span className="text-slate-500">
                        {s.items && s.items.length > 1
                          ? `${s.items.length} items`
                          : s.product_name || s.items?.[0]?.product_name || '—'}
                      </span>
                      <PayBadge type={s.payment_type} />
                    </div>

                    {/* Info chips */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
                        Taxable ₹{fmt(s.taxable_amount)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-600">
                        GST ₹{fmt(s.total_gst)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
                        {formatFullDateTime(s.createdAt || s.sold_at)}
                      </span>
                    </div>

                    {/* Workflow status badge + one-tap stage actions */}
                    {wfc && !s._isOffline && (
                      <div className="mb-4">
                        <WorkflowStatusBadge
                          sale={s}
                          wfc={wfc}
                          onAdvance={advanceWorkflowStage}
                        />
                      </div>
                    )}

                    {/* Invoice-level extra field chips (restaurant: Table/Order Type, automobile: Vehicle No/Model…) */}
                    {config.invoiceExtraFields && config.invoiceExtraFields.length > 0 && s.extra_fields && (() => {
                      const chips = config.invoiceExtraFields
                        .map(f => ({ label: f.label, value: s.extra_fields?.[f.key] }))
                        .filter(c => c.value);
                      if (!chips.length) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {chips.map(chip => (
                            <span key={chip.label} className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-600">
                              {chip.label}: {chip.value}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Per-line field chips for single-item sales (pharmacy: Batch/Expiry, clothing: Size/Color…) */}
                    {config.invoiceLineFields && config.invoiceLineFields.length > 0 && s.items?.length === 1 && (() => {
                      const meta = s.items[0]?.item_metadata || {};
                      const chips = config.invoiceLineFields
                        .map(f => ({ label: f.label, value: meta[f.key] }))
                        .filter(c => c.value);
                      if (!chips.length) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {chips.map(chip => (
                            <span key={chip.label} className="px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100 text-[11px] font-semibold text-violet-600">
                              {chip.label}: {chip.value}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2">
                      <button onClick={() => startEditSale(s)} disabled={Boolean(s._isOffline)}
                        className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all"
                      >✏️ Edit</button>
                      <button onClick={() => printInvoice(s)} disabled={Boolean(s._isOffline)}
                        className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all"
                      >🖨️ Print</button>
                      <button onClick={() => shareWhatsApp(s)} disabled={Boolean(s._isOffline)}
                        className="min-h-[44px] py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-all"
                      >📤 Send</button>
                      <button onClick={() => handleDelete(s)}
                        className="min-h-[44px] py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all"
                      >{s._isOffline ? '✕' : '🗑️'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          SALE MODAL — slide-up sheet
      ════════════════════════════════════════════════════════════ */}
      {/* Overlay */}
      <div className={`fixed inset-0 z-[70] transition-all duration-300 ${showModal ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close"
          onClick={() => { setShowModal(false); resetForm(); }}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Sheet */}
        <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100dvh-56px)] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300
          md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-3xl
          ${showModal ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}`}>

          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Modal header */}
          <div className="flex-shrink-0 border-b border-slate-100 px-5 pt-3 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {editingSaleId ? term('editSale', 'Edit Sale') : term('newSale', 'New Sale')}
                </p>
                <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                  {editingSaleId ? `${term('sale', 'Sale')} Edit करें` : term('quickNewSaleHindi', 'नया Bill बनाएं')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>

            {/* Payment method tabs — driven by saleFormSchema.paymentMethods */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
              {activeTabs.map((opt) => (
                <button key={opt.type} type="button"
                  onClick={() => {
                    updateForm({ payment_type: opt.type, ...(opt.isCredit ? {} : { amount_paid: '' }) });
                    setShowCustomerInfo(opt.isCredit);
                  }}
                  className={`flex-1 py-3 rounded-lg text-[13px] font-black tracking-wide transition-all ${form.payment_type === opt.type ? opt.active : 'text-slate-600 hover:text-slate-700'}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
                ⚠️ {error}
              </div>
            )}

            {/* Invoice + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Invoice No.</p>
                <div className="flex items-center h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 gap-2">
                  <span className="font-mono text-[11px] text-green-700 truncate flex-1 min-w-0">{invoicePreview}</span>
                  <button type="button" onClick={() => navigator?.clipboard?.writeText(invoicePreview)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 text-xs">📋</button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Date</p>
                <input className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/25 focus:border-green-600 transition-all"
                  type="date" ref={saleDateInputRef} value={form.sale_date}
                  onChange={(e) => updateForm({ sale_date: e.target.value })}
                />
              </div>
            </div>

            {/* ── Customer section ── */}
            <div className={`rounded-2xl border p-4 ${form.payment_type === 'credit' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-black text-slate-900">{term('customerSection', 'Customer Info')}</p>
                  {form.payment_type !== 'credit' && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{customerSummary}</p>
                  )}
                </div>
                {form.payment_type === 'credit'
                  ? <span className="px-2.5 py-1 rounded-full bg-rose-100 text-[10px] font-black text-rose-700 border border-rose-200">Required *</span>
                  : <button type="button" onClick={() => setShowCustomerInfo(v => !v)} className="text-[12px] font-bold text-green-700 hover:text-green-700">{customerInfoVisible ? '▴ Hide' : '▾ Add'}</button>
                }
              </div>

              {customerInfoVisible && (
                <div className="space-y-3">
                  {/* Customer name with autocomplete */}
                  <div ref={customerComboRef} className="relative">
                    <input
                      ref={buyerNameInputRef}
                      className={INPUT}
                      placeholder={term('customerNamePlaceholder', 'Customer का नाम')}
                      value={customerQuery}
                      onChange={(e) => { setCustomerQuery(e.target.value); updateForm({ buyer_name: e.target.value }); setShowCustomerSuggestions(true); }}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      required={form.payment_type === 'credit'}
                    />
                    {showCustomerSuggestions && filteredPastCustomers.length > 0 && (
                      <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        {filteredPastCustomers.map((c) => (
                          <button key={`${c.phone}-${c.name}`} type="button" onClick={() => selectPastCustomer(c)}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0"
                          >
                            <span className="text-[13px] font-semibold text-slate-900">{c.name}</span>
                            <span className="text-[11px] text-slate-400">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input className={INPUT} placeholder={term('customerPhonePlaceholder', 'Phone number')} value={form.buyer_phone} onChange={(e) => updateForm({ buyer_phone: e.target.value })} />

                  <button type="button" onClick={() => setShowMoreCustomerDetails(v => !v)}
                    className="text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                  >{showMoreCustomerDetails ? '▴ Less Details' : '▾ More Details (GSTIN, Address)'}</button>

                  {showMoreCustomerDetails && (
                    <div className="space-y-3">
                      <div>
                        <input
                          className={`${INPUT} ${showGstinError ? 'border-rose-400 bg-rose-50 focus:ring-rose-500/20 focus:border-rose-400' : ''}`}
                          placeholder="GSTIN (15 digits)" value={form.buyer_gstin} maxLength={GSTIN_LENGTH}
                          onChange={(e) => handleBuyerGstinChange(e.target.value)}
                          onBlur={() => setGstinTouched(true)}
                        />
                        {showGstinError && <p className="mt-1 text-[11px] font-semibold text-rose-600">Invalid GSTIN format</p>}
                        {showGstinLengthHint && <p className="mt-1 text-[11px] text-slate-400">{gstinValue.length}/{GSTIN_LENGTH} characters</p>}
                      </div>
                      <select className={INPUT} value={form.buyer_state} onChange={(e) => updateForm({ buyer_state: e.target.value })}>
                        <option value="">State / UT चुनें</option>
                        <optgroup label="States">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                        <optgroup label="Union Territories">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      </select>
                      <input className={INPUT} placeholder="Address" value={form.buyer_address} onChange={(e) => updateForm({ buyer_address: e.target.value })} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Industry-specific invoice-level fields ── */}
            {config.invoiceExtraFields && config.invoiceExtraFields.length > 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{term('invoice', 'Invoice')} Details</p>
                {config.invoiceExtraFields.map((field) => (
                  <div key={field.key}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}</p>
                    <DynamicFormField
                      field={field}
                      value={extraFields[field.key] || ''}
                      onChange={(v) => setExtraFields((prev) => ({ ...prev, [field.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ── Items section ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-black text-slate-900">{term('items', 'Items')}</p>
                {barcodeEnabled && (
                  <button type="button" onClick={() => setShowBarcodeScanner(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors"
                  >📷 Scan Barcode</button>
                )}
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const g    = rowGST(item);
                  const prod = products.find((p) => p._id === item.product_id);
                  return (
                    <div key={index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                      {/* Controls row */}
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => duplicateItem(index)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] text-slate-500 hover:bg-slate-100 transition-colors"
                        >⧉ Dupe</button>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] text-rose-600 hover:bg-rose-100 transition-colors"
                          >✕</button>
                        )}
                      </div>

                      <SearchableProductSelect
                        products={products} value={item.product_id}
                        onChange={(id) => updateItem(index, 'product_id', id)}
                        onSelectProduct={(product) => handleProductSelect(index, product)}
                        placeholder={`${term('product', 'Product')} चुनें`}
                        searchPlaceholder={term('searchProduct', 'Name, barcode, HSN...')}
                      />

                      {prod && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
                          Stock: {prod.quantity || 0} units
                        </span>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {/* Quantity */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Qty</p>
                          <div className="flex h-10 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <button type="button" onClick={() => updateItemQuantityBy(index, -1)}
                              className="w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-lg transition-colors"
                            >−</button>
                            <input
                              className="flex-1 text-center text-[14px] font-black text-slate-900 border-x border-slate-200 bg-white focus:outline-none"
                              type="number" min="1" max={prod ? prod.quantity : undefined}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            />
                            <button type="button" onClick={() => updateItemQuantityBy(index, 1)}
                              className="w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-lg transition-colors"
                            >+</button>
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {QUICK_QUANTITY_OPTIONS.map((qty) => (
                              <button key={qty} type="button" onClick={() => applyQuickQuantity(index, qty)}
                                className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition-colors ${Number(item.quantity) === qty ? 'bg-green-600 border-green-600 text-white' : 'border-slate-200 text-slate-500 hover:border-cyan-300 hover:text-green-700'}`}
                              >{qty}</button>
                            ))}
                          </div>
                        </div>

                        {/* Price */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Price (₹)</p>
                          <input
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-[14px] font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/25 focus:border-green-600 transition-all"
                            type="number" step="0.01" placeholder="0.00"
                            value={item.price_per_unit}
                            onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* GST breakdown */}
                      {g && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-100 text-[11px]">
                          <span className="text-slate-400">₹{fmt(g.taxable)} + <span className="text-amber-600">₹{fmt(g.gst)} GST</span></span>
                          <span className="font-black text-slate-900">= ₹{fmt(g.total)}</span>
                        </div>
                      )}

                      {/* ── Batch selector (pharmacy, bakery, grocery) ── */}
                      {batchSales && prod && (
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{inv.batchLabel || 'Batch'}</p>
                          <select
                            className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] text-slate-700 focus:outline-none focus:border-green-600 bg-white"
                            value={(item.item_metadata || {}).batch_id || ''}
                            onChange={e => {
                              const batch = (productBatches[prod._id] || []).find(b => b._id === e.target.value);
                              const updated = [...items];
                              updated[index] = { ...updated[index], item_metadata: { ...(updated[index].item_metadata || {}), batch_id: e.target.value, batch_number: batch?.batch_number || '' } };
                              if (batch?.mrp) updated[index].price_per_unit = String(batch.mrp);
                              setItems(updated);
                            }}
                          >
                            <option value="">— Select Batch —</option>
                            {(productBatches[prod._id] || []).map(b => (
                              <option key={b._id} value={b._id}>
                                {b.batch_number} · Qty:{b.quantity}{b.expiry_date ? ` · Exp:${b.expiry_date.slice(0,10)}` : ''}
                              </option>
                            ))}
                          </select>
                          {!(productBatches[prod._id]?.length) && (
                            <p className="text-[10px] text-amber-600">No batches found — add via Products → Inventory</p>
                          )}
                        </div>
                      )}

                      {/* ── Variant selector (clothing, footwear, sports) ── */}
                      {variantSales && prod && (
                        <div className="pt-2 border-t border-slate-200 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{inv.variantLabel || 'Variant'}</p>
                          <div className="flex gap-2">
                            {inv.variantDimensions?.includes('size') && inv.sizeOptions?.length > 0 && (
                              <div className="flex-1">
                                <p className="text-[10px] text-slate-400 mb-0.5">Size</p>
                                <select
                                  className="h-9 w-full rounded-xl border-2 border-slate-200 px-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:border-green-600"
                                  value={(item.item_metadata || {}).size || ''}
                                  onChange={e => {
                                    const sz  = e.target.value;
                                    const col = (item.item_metadata || {}).color || '';
                                    const variant = (productVariants[prod._id] || []).find(v => v.size === sz && (!col || v.color === col) && v.quantity > 0);
                                    const updated = [...items];
                                    updated[index] = { ...updated[index], item_metadata: { ...(updated[index].item_metadata || {}), size: sz, variant_id: variant?._id || '' } };
                                    if (variant?.price) updated[index].price_per_unit = String(variant.price);
                                    setItems(updated);
                                  }}
                                >
                                  <option value="">Size</option>
                                  {inv.sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            )}
                            {inv.variantDimensions?.includes('color') && inv.colorOptions?.length > 0 && (
                              <div className="flex-1">
                                <p className="text-[10px] text-slate-400 mb-0.5">Color</p>
                                <select
                                  className="h-9 w-full rounded-xl border-2 border-slate-200 px-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:border-green-600"
                                  value={(item.item_metadata || {}).color || ''}
                                  onChange={e => {
                                    const col = e.target.value;
                                    const sz  = (item.item_metadata || {}).size || '';
                                    const variant = (productVariants[prod._id] || []).find(v => v.color === col && (!sz || v.size === sz) && v.quantity > 0);
                                    const updated = [...items];
                                    updated[index] = { ...updated[index], item_metadata: { ...(updated[index].item_metadata || {}), color: col, variant_id: variant?._id || '' } };
                                    if (variant?.price) updated[index].price_per_unit = String(variant.price);
                                    setItems(updated);
                                  }}
                                >
                                  <option value="">Color</option>
                                  {inv.colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          {(item.item_metadata || {}).variant_id
                            ? <p className="text-[10px] text-emerald-600 font-semibold">✓ Variant selected — stock will be updated</p>
                            : <p className="text-[10px] text-slate-400">Select size/color to link variant stock</p>
                          }
                        </div>
                      )}

                      {/* ── Serial selector (electronics, mobile_shop) ── */}
                      {serialSales && prod && (
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{inv.serialLabel || 'Serial No.'}</p>
                          <input
                            className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] font-mono text-slate-800 focus:outline-none focus:border-green-600 bg-white placeholder-slate-400"
                            placeholder="Serial / IMEI (comma-separated for multiple)"
                            value={((item.item_metadata || {}).serial_ids || []).join(', ')}
                            onChange={e => {
                              const vals = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              const updated = [...items];
                              updated[index] = { ...updated[index], item_metadata: { ...(updated[index].item_metadata || {}), serial_ids: vals } };
                              setItems(updated);
                            }}
                          />
                        </div>
                      )}

                      {/* Industry-specific line fields (batch/expiry, size/color, IMEI, etc.) */}
                      {config.invoiceLineFields && config.invoiceLineFields.length > 0 && (
                        <div className="pt-1 space-y-2.5 border-t border-slate-200">
                          {config.invoiceLineFields.map((field) => (
                            <div key={field.key}>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{field.label}</p>
                              <DynamicFormField
                                field={field}
                                value={(item.item_metadata || {})[field.key] || ''}
                                onChange={(v) => { const updated = [...items]; updated[index] = { ...updated[index], item_metadata: { ...(updated[index].item_metadata || {}), [field.key]: v } }; setItems(updated); }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addItem}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-400 hover:border-cyan-300 hover:text-green-700 hover:bg-green-50/40 transition-all"
                >+ Item जोड़ें <span className="text-[10px] opacity-60">(Alt+A)</span></button>
              </div>
            </div>

            {/* ── Advance payment (credit only) ── */}
            {form.payment_type === 'credit' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                <p className="text-[13px] font-black text-slate-900 mb-0.5">Advance Payment</p>
                <p className="text-[11px] text-slate-400 mb-3">अभी कितना payment मिला?</p>
                <input
                  ref={amountPaidInputRef}
                  className="h-11 w-full px-4 rounded-xl border border-rose-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                  type="number" step="0.01" min="0"
                  placeholder={`Max ₹${fmt(billTotals.total)}`}
                  value={form.amount_paid}
                  onChange={(e) => updateForm({ amount_paid: e.target.value })}
                />
                <div className="flex gap-2 mt-2">
                  {[['₹0', '0'], ['50%', String((billTotals.total / 2).toFixed(2))], ['Full', String(billTotals.total.toFixed(2))]].map(([label, val]) => (
                    <button key={label} type="button" onClick={() => updateForm({ amount_paid: val })}
                      className="flex-1 py-1.5 rounded-lg border border-rose-200 bg-white text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                    >{label}</button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-100 border border-rose-200">
                  <span className="text-[12px] font-bold text-rose-700">Balance Due</span>
                  <span className="text-[16px] font-black text-rose-700">₹{fmt(balanceDue)}</span>
                </div>
              </div>
            )}

            {/* ── Bill summary ── */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <div className="space-y-1.5 mb-3">
                {[
                  { label: 'Taxable Amount', val: `₹${fmt(billTotals.taxable)}`, cls: 'text-white' },
                  { label: 'Total GST',      val: `₹${fmt(billTotals.gst)}`,     cls: 'text-amber-400' },
                  { label: 'Round Off',      val: `${roundedBill.roundOff >= 0 ? '+' : ''}₹${fmt(roundedBill.roundOff)}`, cls: 'text-emerald-400' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-[12px]">
                    <span className="text-slate-400">{row.label}</span>
                    <span className={`font-bold ${row.cls}`}>{row.val}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-700 pt-3">
                <span className="text-[14px] font-black">Grand Total</span>
                <span className="text-[24px] font-black text-green-600">₹{fmt(billTotals.total)}</span>
              </div>
              {form.payment_type === 'credit' && (
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
                  <span className="text-[12px] text-rose-300">Balance Due</span>
                  <span className="text-[14px] font-black text-rose-400">₹{fmt(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <div className="flex gap-3">
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-600/20 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
              >
                {submitting ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
                ) : !isOnline ? '📥 Offline Save'
                  : form.payment_type === 'credit' ? `📒 Credit ${term('sale','Sale')} Save करें`
                  : form.payment_type === 'upi'    ? `📱 UPI ${term('sale','Sale')} Save करें`
                  : form.payment_type === 'bank'   ? `🏦 Bank ${term('sale','Sale')} Save करें`
                  : `💵 ${term('sale','Sale')} Save करें`}
              </button>
              <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >Cancel</button>
            </div>
          </div>
        </aside>
      </div>

      {/* Barcode scanner (UNCHANGED) */}
      <CameraBarcodeScanner
        open={showBarcodeScanner}
        title="Scan product barcode"
        description="Continuous scan mode me har successful barcode bill me add hota rahega."
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={handleBarcodeDetected}
        continuous
      />
    </Layout>
  );
}
