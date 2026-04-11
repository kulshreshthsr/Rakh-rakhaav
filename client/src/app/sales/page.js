'use client';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { useAppLocale } from '../../components/AppLocale';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { getDisplayQueue, queueSale, removeQueuedOperation } from '../../lib/offlineQueue';
import { cacheProducts, getCachedProducts } from '../../lib/offlineDB';
import { apiUrl } from '../../lib/api';

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });
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
const STATE_CODE_BY_NAME = {
  'andaman & nicobar islands':'35','andhra pradesh':'37','arunachal pradesh':'12','assam':'18',
  'bihar':'10','chandigarh':'04','chhattisgarh':'22','dadra & nagar haveli and daman & diu':'26',
  'delhi':'07','goa':'30','gujarat':'24','haryana':'06','himachal pradesh':'02','jammu & kashmir':'01',
  'jharkhand':'20','karnataka':'29','kerala':'32','ladakh':'38','lakshadweep':'31','madhya pradesh':'23',
  'maharashtra':'27','manipur':'14','meghalaya':'17','mizoram':'15','nagaland':'13','odisha':'21',
  'puducherry':'34','punjab':'03','rajasthan':'08','sikkim':'11','tamil nadu':'33','telangana':'36',
  'tripura':'16','uttar pradesh':'09','uttarakhand':'05','west bengal':'19',
};
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};
const QUICK_QUANTITY_OPTIONS = [1, 2, 5, 10];
const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...', background: '#dbeafe', color: '#1d4ed8' };
  if (status === 'failed')    return { label: 'Sync failed', background: '#fee2e2', color: '#b91c1c' };
  if (status === 'abandoned') return { label: 'Sync retry needed', background: '#fde68a', color: '#92400e' };
  return { label: 'Sync pending', background: '#f59e0b', color: '#000' };
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
const numberToWords = (num) => {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  };
  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);
  return convert(rupees) + ' Rupees' + (paise ? ' and '+convert(paise)+' Paise' : '') + ' Only';
};
const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const payLabel = sale.payment_type === 'cash' ? 'Cash (Paid)' : sale.payment_type === 'upi' ? 'UPI (Paid)' : sale.payment_type === 'bank' ? 'Bank Transfer' : 'Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) => `  ${i + 1}. ${item.product_name} ₹ ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`).join('\n')
    : `  1. ${sale.product_name} ₹ ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;
  const isIGST = sale.gst_type === 'IGST' || (sale.items && sale.items.some(i => i.gst_type === 'IGST'));
  const gstLine = (sale.total_gst && sale.total_gst > 0) ? isIGST ? `IGST: ₹${fmt(sale.igst_amount)}` : `CGST: ₹${fmt(sale.cgst_amount)} | SGST: ₹${fmt(sale.sgst_amount)}` : `GST: NIL`;
  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste *${sale.buyer_name}* ji!\n\n` : '';
  return [`${greeting}*Invoice / Bill Details*`,'--------------------',`Shop: *${shopName || 'Rakh-Rakhaav'}*`,`Invoice No: *${sale.invoice_number}*`,`Date: ${saleDate}`,'--------------------',`*Items:*`,itemLines,'--------------------',`Taxable Amount: ₹${fmt(sale.taxable_amount)}`,gstLine,`*Total Amount: ₹${fmt(sale.total_amount)}*`,'--------------------',`Payment: ${payLabel}`,'--------------------',`Aapka business hamare liye bahut important hai!`,`Thank you for choosing *${shopName || 'Rakh-Rakhaav'}*.`,``,`_Powered by Rakh-Rakhaav Business Manager_`].join('\n');
};
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

/* ─── Payment badge ──────────────────────────────────────────────── */
const PayBadge = ({ type }) => {
  const map = {
    cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '💵 Cash' },
    credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 उधार' },
    upi:    { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200',           label: '📱 UPI'  },
    bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: '🏦 Bank' },
  };
  const s = map[type] || map.cash;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>
      {s.label}
    </span>
  );
};

/* ══════════════════════════════════════════════════════════════════ */
export default function SalesPage() {
  const router = useRouter();
  const { locale } = useAppLocale();

  /* ── All state (UNCHANGED) ───────────────────────────────────── */
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
  const [form, setForm]             = useState(buildInitialForm());
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth]   = useState('');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showMoreCustomerDetails, setShowMoreCustomerDetails] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const amountPaidInputRef  = useRef(null);
  const buyerNameInputRef   = useRef(null);
  const customerComboRef    = useRef(null);
  const saleDateInputRef    = useRef(null);
  const hasBootstrappedRef  = useRef(false);

  /* ── All logic (UNCHANGED) ───────────────────────────────────── */
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
  const handleProductSelect = (index, product) => {
    updateItem(index, 'product_id', product._id);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity || 1, price_per_unit: product.price || item.price_per_unit } : item));
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
    const nextPaymentType = overrides.payment_type || form.payment_type || 'cash';
    setEditingSaleId(''); setItems([emptyItem()]);
    setForm(buildInitialForm({ payment_type: nextPaymentType, amount_paid: '', ...overrides }));
    setGstinTouched(false); setError(''); setCustomerQuery('');
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
        body: JSON.stringify({ items: validItems, ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEditing && data?._id) setSales((current) => current.map((sale) => (sale._id === data._id ? data : sale)).sort((a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime()));
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
    setItems(sourceItems.map((item) => ({ product_id: item.product?._id || item.product || '', quantity: item.quantity || 1, price_per_unit: item.price_per_unit || '' })));
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

  const printInvoice = async (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale ka invoice sync ke baad print hoga'); return; }
    try { const shopRes = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } }); const shop = await shopRes.json(); generateInvoiceHTML(sale, shop, true); }
    catch { alert('Invoice could not be generated.'); }
  };

  const shareWhatsApp = (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale ko sync ke baad share karein'); return; }
    const msg   = buildWhatsAppShareMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    const waUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  /* ── Derived (UNCHANGED) ──────────────────────────────────────── */
  const pendingOfflineSales = sales.filter((sale) => sale?._isOffline);
  const offlineRevenue = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0);
  const offlineGst     = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0);
  const revenueDisplay = Number(summary.totalRevenue || 0) + offlineRevenue;
  const gstDisplay     = Number(summary.totalGST || 0) + offlineGst;
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredSales = sales.filter((sale) => {
    const matchesSearch = !normalizedBillSearch || getSaleSearchText(sale).includes(normalizedBillSearch);
    const matchesMonth  = !billMonth || getMonthFilterValue(sale.createdAt || sale.sold_at) === billMonth;
    return matchesSearch && matchesMonth;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth);
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
  const customerSummary = form.buyer_name || form.buyer_phone ? [form.buyer_name || 'Customer selected', form.buyer_phone || 'No phone'].join(' • ') : 'Walk-in customer';

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28">

        {/* ── Header ── */}
        <div className="relative overflow-hidden mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50/60 p-5 sm:p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-cyan-200/40 blur-3xl" />
            <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-blue-200/35 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-700 shadow-sm">
                बिक्री • Sales
              </div>
              <h1 className="mt-3 text-[clamp(22px,4.5vw,30px)] font-black leading-[1.12] text-slate-900">
                रोज़ की बिक्री अब super clear
              </h1>
              <p className="mt-2 text-[13.5px] text-slate-500">
                Invoice बनाओ, ग्राहक जोड़ो, और payments track करो — सब एक जगह।
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/sales/customers"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 shadow-sm hover:-translate-y-px hover:shadow-md transition-all"
              >
                👥 Customers
              </Link>
              <button
                type="button"
                onClick={() => { resetForm(); setShowModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
              >
                + नया Bill
              </button>
            </div>
          </div>
        </div>

        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 mb-5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Mode</div>
              <div className="text-[11px] text-amber-600">Sales offline save होंगी, sync बाद में होगी</div>
            </div>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Revenue', value: `₹${fmt(revenueDisplay)}`, accent: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-100' },
            { label: 'GST Collected', value: `₹${fmt(gstDisplay)}`, accent: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
            { label: 'Invoices', value: filteredSales.length, accent: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-100' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl p-3.5 shadow-sm`}>
              <div className={`text-[20px] font-black leading-none ${kpi.accent}`}>{kpi.value}</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-400">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm mb-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
              placeholder="🔍 Invoice, customer, product..."
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all sm:w-44"
              type="month"
              value={billMonth}
              onChange={(e) => setBillMonth(e.target.value)}
            />
            {hasBillFilters && (
              <button
                type="button"
                onClick={() => { setBillSearch(''); setBillMonth(''); }}
                className="h-11 px-4 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Sales list ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">🧾</div>
            <div className="text-[15px] font-bold text-slate-700 mb-1">
              {hasBillFilters ? 'कोई sale नहीं मिली' : 'अभी कोई sale नहीं'}
            </div>
            <div className="text-[12px] text-slate-400 mb-4">
              {hasBillFilters ? 'Filter बदलकर देखें' : 'पहला bill बनाओ और शुरू हो जाओ'}
            </div>
            {!hasBillFilters && (
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:shadow-lg transition-all"
              >
                + पहला Bill बनाएं
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSales.map((s) => (
              <div key={s._id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${s._isOffline ? 'border-amber-200' : 'border-slate-200'}`}>
                {/* Offline badge */}
                {s._isOffline && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[11px] font-black text-amber-700">
                      {getOfflineBadgeMeta(s._queueStatus).label}
                    </span>
                    {s._queueError && <span className="text-[11px] text-rose-600 ml-1">{s._queueError}</span>}
                  </div>
                )}

                <div className="p-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[14px] font-black text-slate-900">
                        {s.buyer_name || 'Walk-in Customer'}
                      </div>
                      <div className="font-mono text-[11px] text-cyan-600 mt-0.5">{s.invoice_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-black text-slate-900">₹{fmt(s.total_amount)}</div>
                      <div className="mt-0.5"><PayBadge type={s.payment_type} /></div>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="text-[12px] text-slate-500 mb-2">
                    {s.items && s.items.length > 1
                      ? `${s.items.length} items`
                      : s.product_name || s.items?.[0]?.product_name || '—'}
                  </div>

                  {/* Chips row */}
                  <div className="flex flex-wrap gap-2 mb-3">
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

                  {/* Action buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => startEditSale(s)}
                      disabled={Boolean(s._isOffline)}
                      className="py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => printInvoice(s)}
                      disabled={Boolean(s._isOffline)}
                      className="py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => shareWhatsApp(s)}
                      disabled={Boolean(s._isOffline)}
                      className="py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                    >
                      📲 WA
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="py-2 rounded-xl border border-rose-200 bg-rose-50 text-[12px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                    >
                      {s._isOffline ? '✕ Remove' : '🗑️ Del'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          NEW / EDIT SALE MODAL — slide-up sheet
      ════════════════════════════════════════════════════════════ */}
      <div className={`fixed inset-0 z-[70] transition-opacity duration-300 ${showModal ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        {/* Backdrop */}
        <button
          type="button"
          onClick={() => { setShowModal(false); resetForm(); }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Sheet */}
        <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100vh-56px)] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-3xl ${showModal ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}`}>

          {/* Handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Modal header */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-5 pt-3 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {editingSaleId ? 'Sale Edit करें' : 'नया Bill'}
                </p>
                <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                  {editingSaleId ? 'Edit Sale' : 'New Sale'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors mt-1"
              >
                ✕
              </button>
            </div>

            {/* Cash / Udhaar toggle */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => { updateForm({ payment_type: 'cash', amount_paid: '' }); setShowCustomerInfo(false); }}
                className={`flex-1 py-2.5 rounded-lg text-[13px] font-black tracking-wide transition-all ${
                  form.payment_type === 'cash'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                💵 कैश
              </button>
              <button
                type="button"
                onClick={() => { updateForm({ payment_type: 'credit' }); setShowCustomerInfo(true); }}
                className={`flex-1 py-2.5 rounded-lg text-[13px] font-black tracking-wide transition-all ${
                  form.payment_type === 'credit'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                📒 उधार
              </button>
            </div>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
                ⚠️ {error}
              </div>
            )}

            {/* Invoice + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Invoice No.</p>
                <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] text-cyan-600">
                  <span className="truncate">{invoicePreview}</span>
                  <button type="button" onClick={() => navigator?.clipboard?.writeText(invoicePreview)} className="text-slate-400 hover:text-slate-600 ml-1 flex-shrink-0">📋</button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Date</p>
                <input
                  className="h-11 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                  type="date" value={form.sale_date} onChange={(e) => updateForm({ sale_date: e.target.value })}
                />
              </div>
            </div>

            {/* Customer section */}
            <div className={`rounded-2xl border p-4 ${form.payment_type === 'credit' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-black text-slate-900">Customer Info</p>
                  {form.payment_type !== 'credit' && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{customerSummary}</p>
                  )}
                </div>
                {form.payment_type === 'credit'
                  ? <span className="px-2.5 py-1 rounded-full bg-rose-100 text-[10px] font-black text-rose-700 border border-rose-200">Required *</span>
                  : <button type="button" onClick={() => setShowCustomerInfo(v => !v)} className="text-[12px] font-bold text-cyan-600">{customerInfoVisible ? 'Hide ▴' : 'Add ▾'}</button>
                }
              </div>

              {customerInfoVisible && (
                <div className="space-y-3">
                  <div ref={customerComboRef} className="relative">
                    <input
                      ref={buyerNameInputRef}
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                      placeholder="Customer का नाम"
                      value={customerQuery}
                      onChange={(e) => { setCustomerQuery(e.target.value); updateForm({ buyer_name: e.target.value }); setShowCustomerSuggestions(true); }}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      required={form.payment_type === 'credit'}
                    />
                    {showCustomerSuggestions && filteredPastCustomers.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        {filteredPastCustomers.map((customer) => (
                          <button key={`${customer.phone}-${customer.name}`} type="button" onClick={() => selectPastCustomer(customer)}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0"
                          >
                            <span className="font-semibold text-slate-900">{customer.name}</span>
                            <span className="text-[11px] text-slate-400">{customer.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                    placeholder="Phone number"
                    value={form.buyer_phone}
                    onChange={(e) => updateForm({ buyer_phone: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowMoreCustomerDetails(v => !v)}
                    className="text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showMoreCustomerDetails ? '▴ Less Details' : '▾ More Details (GSTIN, Address)'}
                  </button>
                  {showMoreCustomerDetails && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <input
                          className={`h-11 w-full px-4 rounded-xl border text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${showGstinError ? 'border-rose-400 bg-rose-50 focus:ring-rose-500/20' : 'border-slate-200 bg-white focus:ring-cyan-500/30 focus:border-cyan-400'}`}
                          placeholder="GSTIN (15 digits)"
                          value={form.buyer_gstin}
                          maxLength={GSTIN_LENGTH}
                          onChange={(e) => handleBuyerGstinChange(e.target.value)}
                          onBlur={() => setGstinTouched(true)}
                        />
                        {showGstinError && <p className="mt-1 text-[11px] font-semibold text-rose-600">Invalid GSTIN format</p>}
                        {showGstinLengthHint && <p className="mt-1 text-[11px] text-slate-400">{gstinValue.length}/{GSTIN_LENGTH} characters</p>}
                      </div>
                      <select
                        className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                        value={form.buyer_state}
                        onChange={(e) => updateForm({ buyer_state: e.target.value })}
                      >
                        <option value="">State / UT चुनें</option>
                        <optgroup label="States">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                        <optgroup label="Union Territories">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      </select>
                      <input
                        className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                        placeholder="Address"
                        value={form.buyer_address}
                        onChange={(e) => updateForm({ buyer_address: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-black text-slate-900">Items</p>
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-200 bg-cyan-50 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 transition-colors"
                >
                  📷 Scan Barcode
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const g = rowGST(item);
                  const prod = products.find((p) => p._id === item.product_id);
                  return (
                    <div key={index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                      {/* Item controls */}
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => duplicateItem(index)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-500 hover:bg-slate-100 transition-colors"
                        >⧉ Dupe</button>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] text-rose-600 hover:bg-rose-100 transition-colors"
                          >✕</button>
                        )}
                      </div>

                      <SearchableProductSelect
                        products={products}
                        value={item.product_id}
                        onChange={(id) => updateItem(index, 'product_id', id)}
                        onSelectProduct={(product) => handleProductSelect(index, product)}
                        placeholder="Product चुनें"
                        searchPlaceholder="Name, barcode, HSN..."
                      />

                      {prod && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
                          Stock: {prod.quantity || 0} units
                        </span>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {/* Qty */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Qty</p>
                          <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <button type="button" onClick={() => updateItemQuantityBy(index, -1)}
                              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-lg transition-colors"
                            >−</button>
                            <input
                              className="flex-1 h-10 text-center text-[14px] font-black text-slate-900 border-x border-slate-200 bg-white focus:outline-none"
                              type="number" min="1"
                              max={prod ? prod.quantity : undefined}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            />
                            <button type="button" onClick={() => updateItemQuantityBy(index, 1)}
                              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-lg transition-colors"
                            >+</button>
                          </div>
                          <div className="flex gap-1.5 mt-1.5">
                            {QUICK_QUANTITY_OPTIONS.map((qty) => (
                              <button key={qty} type="button" onClick={() => applyQuickQuantity(index, qty)}
                                className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition-colors ${Number(item.quantity) === qty ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-200 text-slate-500 hover:border-cyan-300 hover:text-cyan-600'}`}
                              >{qty}</button>
                            ))}
                          </div>
                        </div>

                        {/* Price */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Price (₹)</p>
                          <input
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-[14px] font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                            type="number" step="0.01"
                            value={item.price_per_unit}
                            onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                            placeholder="0.00"
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
                    </div>
                  );
                })}

                <button type="button" onClick={addItem}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-400 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/50 transition-all"
                >
                  + Item जोड़ें <span className="text-[11px] opacity-60">(Alt+A)</span>
                </button>
              </div>
            </div>

            {/* Advance payment (credit only) */}
            {form.payment_type === 'credit' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
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

            {/* Bill summary */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-slate-400">Taxable Amount</span>
                <span className="font-bold">₹{fmt(billTotals.taxable)}</span>
              </div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-slate-400">Total GST</span>
                <span className="font-bold text-amber-400">₹{fmt(billTotals.gst)}</span>
              </div>
              <div className="flex justify-between text-[12px] mb-3">
                <span className="text-slate-400">Round Off</span>
                <span className="font-bold text-emerald-400">{roundedBill.roundOff >= 0 ? '+' : ''}₹{fmt(roundedBill.roundOff)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-3">
                <span className="text-[14px] font-black">Grand Total</span>
                <span className="text-[22px] font-black text-cyan-400">₹{fmt(billTotals.total)}</span>
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
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
              >
                {submitting ? 'Saving...' : !isOnline ? '📥 Offline Save' : form.payment_type === 'credit' ? '📒 Credit Sale' : '💵 Sale Save करें'}
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Barcode scanner (UNCHANGED usage) */}
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

/* ─── Invoice HTML Generator (100% UNCHANGED) ───────────────────── */
const getStateCode = (stateName = '', gstin = '') => {
  const gstStateCode = String(gstin || '').slice(0, 2);
  if (/^\d{2}$/.test(gstStateCode)) return gstStateCode;
  return STATE_CODE_BY_NAME[normalizeState(stateName)] || '';
};

const buildTaxSummaryRows = (saleItems, isIGST) => {
  const grouped = saleItems.reduce((acc, item) => {
    const rate = Number(item.gst_rate || 0);
    const key = String(rate);
    if (!acc[key]) acc[key] = { rate, cgst: 0, sgst: 0, igst: 0 };
    acc[key].cgst += Number(item.cgst_amount || 0);
    acc[key].sgst += Number(item.sgst_amount || 0);
    acc[key].igst += Number(item.igst_amount || 0);
    return acc;
  }, {});
  return Object.values(grouped).sort((a, b) => a.rate - b.rate).map((group) => (
    isIGST
      ? '<div class="amount-row"><span>IGST @' + group.rate + '%</span><span>₹' + fmt(group.igst) + '</span></div>'
      : '<div class="amount-row"><span>CGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.cgst) + '</span></div>'
        + '<div class="amount-row"><span>SGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.sgst) + '</span></div>'
  )).join('');
};

function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const INR = '&#8377;';
  const roundedBill = getRoundedBillValues(sale.total_amount);
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity, price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate, taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount, sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount, gst_type: sale.gst_type, total_amount: sale.total_amount }];
  const isIGST   = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const colSpan  = isIGST ? 8 : 10;
  const placeOfSupplyCode  = getStateCode(sale.buyer_state, sale.buyer_gstin);
  const sellerStateCode    = getStateCode(shop.state, shop.gstin);
  const placeOfSupplyLabel = sale.buyer_state ? `${sale.buyer_state}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}` : 'Not specified';
  const gstCols = isIGST ? '<th>IGST%</th><th>IGST ₹</th>' : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';
  const itemRows = saleItems.map((item, idx) => {
    const gstCells = isIGST
      ? '<td>' + (item.gst_rate || 0) + '%</td><td>' + INR + fmt(item.igst_amount) + '</td>'
      : '<td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>' + INR + fmt(item.cgst_amount) + '</td><td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>' + INR + fmt(item.sgst_amount) + '</td>';
    return '<tr><td>' + (idx + 1) + '</td><td style="text-align:left"><strong>' + item.product_name + '</strong></td><td>' + (item.hsn_code || '-') + '</td><td>' + item.quantity + '</td><td>' + INR + fmt(item.price_per_unit) + '</td><td>' + INR + fmt(item.taxable_amount) + '</td>' + gstCells + '<td><strong>' + INR + fmt(item.total_amount) + '</strong></td></tr>';
  }).join('');
  const emptyCell  = '<td style="height:20px"></td>';
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill('<tr>' + emptyCell.repeat(colSpan) + '</tr>').join('');
  const footerGST  = isIGST ? '<td></td><td>' + INR + fmt(sale.igst_amount) + '</td>' : '<td></td><td>' + INR + fmt(sale.cgst_amount) + '</td><td></td><td>' + INR + fmt(sale.sgst_amount) + '</td>';
  const amountGSTRows = buildTaxSummaryRows(saleItems, isIGST);
  const payBg    = sale.payment_type === 'cash' ? '#dcfce7' : sale.payment_type === 'upi' ? '#ecfeff' : '#fee2e2';
  const payColor = sale.payment_type === 'cash' ? '#166534' : sale.payment_type === 'upi' ? '#0f766e' : '#991b1b';
  const payLabel = sale.payment_type === 'cash' ? 'CASH' : sale.payment_type === 'upi' ? 'UPI' : sale.payment_type === 'bank' ? 'BANK' : 'CREDIT';
  const bankHTML = shop.bank_name
    ? '<div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px">Bank Details</div>'
      + '<div style="font-size:11px;margin-bottom:3px">Bank: <strong>' + shop.bank_name + '</strong></div>'
      + (shop.bank_branch  ? '<div style="font-size:11px;margin-bottom:3px">Branch: <strong>' + shop.bank_branch  + '</strong></div>' : '')
      + (shop.bank_account ? '<div style="font-size:11px;margin-bottom:3px">A/C: <strong>'    + shop.bank_account + '</strong></div>' : '')
      + (shop.bank_ifsc    ? '<div style="font-size:11px">IFSC: <strong>'                     + shop.bank_ifsc    + '</strong></div>' : '')
    : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>';
  const termsHTML = shop.terms
    ? '<div class="terms-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div><div style="font-size:10px;color:#374151">'
      + shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>')
      + '</div></div>'
    : '';
  const pdfBanner = suggestedFileName && !autoPrint
    ? '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:18px">PDF</span>'
      + '<div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → Change destination to <strong>"Save as PDF"</strong> → Save as <strong>' + suggestedFileName + '</strong><br/>'
      + '<span style="font-size:11px;opacity:0.8">Then attach this PDF file on WhatsApp</span></div>'
      + '</div>'
    : '';
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice - ' + sale.invoice_number + '</title>'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#111827;background:#fff}'
    + '.invoice{max-width:820px;margin:0 auto;padding:18px;border:2px solid #111827}'
    + '.header{display:grid;grid-template-columns:1.45fr .95fr;border:1.5px solid #111827}'
    + '.header-left,.header-right{padding:14px 16px;min-height:120px}.header-left{border-right:1.5px solid #111827}'
    + '.brand-tag{display:inline-block;padding:8px 16px;border:1.5px solid #111827;font-size:22px;font-weight:900;letter-spacing:0;color:#3B82F6;background:#f8fafc;margin-bottom:12px;line-height:1;font-family:"Noto Sans Devanagari","Mangal","Segoe UI",Arial,sans-serif}'
    + '.seller-name{font-size:17px;font-weight:800;color:#111827;margin-top:4px}'
    + '.shop-line{font-size:11px;line-height:1.55;color:#374151;margin-top:8px}'
    + '.invoice-title{font-size:22px;font-weight:900;letter-spacing:.16em;text-align:center;color:#111827;text-transform:uppercase;margin-top:4px}'
    + '.invoice-copy{font-size:10px;letter-spacing:.12em;text-align:center;color:#6b7280;text-transform:uppercase;margin-top:6px}'
    + '.pay-chip{display:inline-block;padding:4px 12px;border:1px solid #111827;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-top:14px}'
    + '.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;border:1.5px solid #111827;border-top:none}'
    + '.info-cell{padding:10px 12px;min-height:58px}.info-cell + .info-cell{border-left:1.5px solid #111827}'
    + '.label{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin-bottom:6px}'
    + '.value{font-size:12px;font-weight:700;color:#111827;line-height:1.4}'
    + '.party-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}'
    + '.party-box{padding:12px 14px;min-height:126px}.party-box + .party-box{border-left:1.5px solid #111827}'
    + '.party-name{font-size:15px;font-weight:800;color:#111827;margin-bottom:6px}'
    + '.party-detail{font-size:11px;line-height:1.55;color:#374151}'
    + '.items-wrap{border:1.5px solid #111827;border-top:none}'
    + 'table{width:100%;border-collapse:collapse}thead th{padding:8px 6px;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#111827;background:#f8fafc;border-bottom:1.5px solid #111827}'
    + 'th + th,td + td{border-left:1px solid #111827}tbody td,tfoot td{padding:7px 6px;font-size:11px;text-align:center;vertical-align:top}td:nth-child(2),th:nth-child(2){text-align:left}'
    + 'tbody td{height:28px}tfoot td{font-weight:800;background:#fafafa}'
    + '.summary-grid{display:grid;grid-template-columns:1.15fr .85fr;border:1.5px solid #111827;border-top:none}'
    + '.summary-box{padding:12px 14px;min-height:140px}.summary-box + .summary-box{border-left:1.5px solid #111827}'
    + '.words-copy{font-size:11px;line-height:1.7;color:#1f2937;font-weight:600;font-style:italic}'
    + '.amount-table{width:100%;border-collapse:collapse}.amount-table td{padding:5px 0;border:none!important;font-size:11px}.amount-table td:last-child{text-align:right;font-weight:700}'
    + '.amount-grand td{padding-top:10px;font-size:15px;font-weight:900}.amount-rounded td{padding-top:6px;font-size:12px;font-weight:800;color:#0f766e}'
    + '.footer-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}'
    + '.footer-box{padding:12px 14px;min-height:120px}.footer-box + .footer-box{border-left:1.5px solid #111827}'
    + '.signature-block{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:right}'
    + '.signature-space{height:48px}.signature-line{font-size:11px;font-weight:800;color:#111827}.signature-note{font-size:10px;line-height:1.5;color:#6b7280;margin-top:6px}'
    + '.terms-box{border:1.5px solid #111827;border-top:none;padding:10px 14px;font-size:10px;line-height:1.6;color:#374151}'
    + '.footer-mark{margin-top:10px;text-align:center;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}'
    + '@media print{.pdf-banner{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}'
    + '</style></head><body>'
    + '<div class="pdf-banner" style="max-width:820px;margin:0 auto 0;">' + pdfBanner + '</div>'
    + '<div class="invoice">'
    + '<div class="header"><div class="header-left"><div class="brand-tag">रखरखाव</div><div class="seller-name">' + (shop.name || 'My Shop') + '</div>'
    + (shop.address ? '<div class="shop-line">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + ((shop.phone || shop.email) ? '<div class="shop-line">' + (shop.phone ? 'Phone: ' + shop.phone : '') + (shop.phone && shop.email ? ' | ' : '') + (shop.email ? 'Email: ' + shop.email : '') + '</div>' : '')
    + (shop.gstin ? '<div class="shop-line"><strong>GSTIN:</strong> ' + shop.gstin + '</div>' : '')
    + (shop.state ? '<div class="shop-line"><strong>State Code:</strong> ' + (sellerStateCode || 'N/A') + '</div>' : '')
    + '</div><div class="header-right"><div class="invoice-title">Invoice</div><div class="invoice-copy">Original For Recipient</div><div style="text-align:center"><span class="pay-chip" style="background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div></div></div>'
    + '<div class="info-grid"><div class="info-cell"><div class="label">Invoice No</div><div class="value">' + sale.invoice_number + '</div></div><div class="info-cell"><div class="label">Invoice Date</div><div class="value">' + saleDate + '</div></div><div class="info-cell"><div class="label">Invoice Type</div><div class="value">' + (sale.invoice_type || 'B2C') + ' / ' + (isIGST ? 'IGST' : 'CGST + SGST') + '</div></div><div class="info-cell"><div class="label">Place Of Supply</div><div class="value">' + placeOfSupplyLabel + '</div></div></div>'
    + '<div class="party-grid"><div class="party-box"><div class="label">Bill From</div><div class="party-name">' + (shop.name || 'RakhRakhaav') + '</div>'
    + (shop.address ? '<div class="party-detail">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + (shop.phone ? '<div class="party-detail">Phone: ' + shop.phone + '</div>' : '')
    + (shop.gstin ? '<div class="party-detail">GSTIN: ' + shop.gstin + '</div>' : '')
    + '</div><div class="party-box"><div class="label">Bill To</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>'
    + (sale.buyer_address ? '<div class="party-detail">' + sale.buyer_address + '</div>' : '')
    + (sale.buyer_state   ? '<div class="party-detail">State: ' + sale.buyer_state + '</div>' : '')
    + (sale.buyer_phone   ? '<div class="party-detail">Phone: ' + sale.buyer_phone + '</div>' : '')
    + (sale.buyer_gstin   ? '<div class="party-detail">GSTIN: ' + sale.buyer_gstin + '</div>' : '')
    + '</div></div>'
    + '<div class="items-wrap"><table><thead><tr><th style="width:34px">Sr</th><th>Particulars</th><th style="width:78px">HSN</th><th style="width:52px">Qty</th><th style="width:88px">Rate ' + INR + '</th><th style="width:94px">Taxable ' + INR + '</th>' + gstCols + '<th style="width:96px">Amount ' + INR + '</th></tr></thead>'
    + '<tbody>' + itemRows + fillerRows + '</tbody>'
    + '<tfoot><tr><td colspan="5" style="text-align:right;padding-right:12px">Total</td><td>' + INR + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td>' + INR + fmt(sale.total_amount) + '</td></tr></tfoot></table></div>'
    + '<div class="summary-grid"><div class="summary-box"><div class="label">Amount In Words</div><div class="words-copy">' + numberToWords(parseFloat(sale.total_amount)) + '</div></div>'
    + '<div class="summary-box"><div class="label">Amount Summary</div><table class="amount-table">'
    + '<tr><td>Taxable Amount</td><td>' + INR + fmt(sale.taxable_amount) + '</td></tr>'
    + amountGSTRows.replace(/<div class="amount-row"><span>/g, '<tr><td>').replace(/<\/span><span>/g, '</td><td>').replace(/<\/span><\/div>/g, '</td></tr>')
    + '<tr><td>Total GST</td><td>' + INR + fmt(sale.total_gst) + '</td></tr>'
    + '<tr><td>Round Off</td><td>' + (roundedBill.roundOff >= 0 ? '+' : '') + INR + fmt(roundedBill.roundOff) + '</td></tr>'
    + '<tr class="amount-grand"><td>Grand Total</td><td>' + INR + fmt(sale.total_amount) + '</td></tr>'
    + '<tr class="amount-rounded"><td>Rounded Total</td><td>' + INR + fmt(roundedBill.roundedTotal) + '</td></tr>'
    + '</table></div></div>'
    + '<div class="footer-grid"><div class="footer-box">' + bankHTML + '</div>'
    + '<div class="footer-box"><div class="signature-block"><div style="font-size:12px;font-weight:700;margin-bottom:10px">For <strong>' + (shop.name || 'RakhRakhaav') + '</strong></div><div class="signature-space"></div><div class="signature-line">Authorised Signatory</div><div class="signature-note">Computer generated invoice. Signature not required.</div></div></div></div>'
    + termsHTML
    + '<div class="footer-mark">Rakh-Rakhaav Business Manager</div>'
    + '</div>'
    + (autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : '')
    + '</body></html>';
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
