'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { printDeliveryChallan } from '../../lib/generateChallan';
import { getWorkflowConfig, getStages, getSaleWorkflowStatus, getStageColors } from '../../lib/workflowEngine';
import WorkflowStatusBadge from '../../components/WorkflowStatusBadge';
import eventBus from '../../lib/eventBus';
import { validateGSTIN as _validateGSTINFull, getSupplyType as _getSupplyType, summariseCartGST } from '../../lib/gstValidation';
import SaleCard from './components/SaleCard';
import ChallanSection from './components/ChallanSection';
import MarkDeliveredModal from './components/MarkDeliveredModal';
import SplitBillModal from './components/SplitBillModal';
import ExchangeModal from './components/ExchangeModal';

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const emptyItem = () => ({ _rowId: Math.random().toString(36).slice(2), product_id: '', quantity: 1, price_per_unit: '', item_metadata: {}, unit_of_measurement: 'NOS', remarks: '' });
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
  const { term, config, businessType } = useIndustry();

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
  const [shopName, setShopName]         = useState('');
  const [shopState, setShopState]       = useState('');
  const [shopStateCode, setShopStateCode] = useState(''); // 2-digit GST state code from shop GSTIN
  const [shopGstin, setShopGstin]       = useState('');
  const [shopAddress, setShopAddress]   = useState('');
  const [shopPhone, setShopPhone]       = useState('');
  const [supplyType, setSupplyType]     = useState('intra_state'); // 'intra_state' | 'inter_state'
  const [gstinValidation, setGstinValidation] = useState(null); // result of validateGSTIN
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
  const [insuranceFilter, setInsuranceFilter]   = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showMoreCustomerDetails, setShowMoreCustomerDetails] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const [hasMoreSales, setHasMoreSales] = useState(false);
  const [salesCursor, setSalesCursor]   = useState(null);
  const [loadingMore, setLoadingMore]   = useState(false);

  // Sub-inventory cache: productId → { batches: [], variants: [] }
  const [productBatches,  setProductBatches]  = useState({});
  const [productVariants, setProductVariants] = useState({});

  // Restaurant-specific state
  const [deliveryFilter, setDeliveryFilter]   = useState('');
  const [showSplitModal, setShowSplitModal]   = useState(false);
  const [splitSale, setSplitSale]             = useState(null);
  const [splitMode, setSplitMode]             = useState('equal');
  const [splitCount, setSplitCount]           = useState(2);
  const [splitAssignments, setSplitAssignments] = useState({});

  // Clothing-specific state — exchange workflow
  const [showExchangeModal,  setShowExchangeModal]  = useState(false);
  const [exchangeSale,       setExchangeSale]       = useState(null);
  const [exchangeReturned,   setExchangeReturned]   = useState([]);
  const [exchangeNewItems,   setExchangeNewItems]   = useState([]);
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);

  // Hardware-specific state — contractor selector + document type
  const [contractors, setContractors]           = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [contractorSearch, setContractorSearch] = useState('');
  const [showContractorDrop, setShowContractorDrop] = useState(false);
  const [contractorsLoaded, setContractorsLoaded] = useState(false);
  const [documentType, setDocumentType]         = useState('invoice'); // 'invoice' | 'challan'
  const [challanForm, setChallanForm] = useState({
    challan_type: 'supply_of_goods', challan_date: getDefaultSaleDateValue(),
    consignee_name: '', consignee_address: '', consignee_gstin: '',
    consignee_contact: '', consignee_phone: '',
    dispatch_from: '', deliver_to: '',
    vehicle_number: '', transport_name: '', lr_number: '', eway_bill_number: '',
    po_number: '', po_date: '', indent_number: '',
    special_instructions: '', challan_terms: '',
  });
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [deliveredChallan, setDeliveredChallan] = useState(null);
  const [deliveredForm, setDeliveredForm] = useState({ received_by: '', received_at: getDefaultSaleDateValue(), notes: '' });

  // Pet shop-specific state
  const [petProfiles, setPetProfiles] = useState([]);

  // Salon-specific state
  const [stylists, setStylists]               = useState([]);
  const [clientHistory, setClientHistory]     = useState(null);
  const [clientMemberships, setClientMemberships] = useState([]);
  const [redemptionMembershipId, setRedemptionMembershipId] = useState(null);

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
      setHasMoreSales(data.hasMore || false);
      setSalesCursor(data.nextCursor || null);
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      const nextSummary = data.summary || {};
      const mergedSales = await mergeSalesWithPendingQueue(nextSales);
      setSales(mergedSales); setSummary(nextSummary);
      writePageCache(SALES_CACHE_KEY, { sales: mergedSales, summary: nextSummary });
    } catch { setError('Sales load nahi ho saki'); }
  }, [mergeSalesWithPendingQueue, router]);

  const loadMoreSales = useCallback(async () => {
    if (!salesCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(apiUrl(`/api/sales?cursor=${salesCursor}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { setError('Could not load older sales'); return; }
      const data = await res.json();
      setHasMoreSales(data.hasMore || false);
      setSalesCursor(data.nextCursor || null);
      const moreSales = data.sales || [];
      setSales(prev => [...prev, ...moreSales.filter(s => !prev.some(p => p._id === s._id))]);
    } catch { setError('Could not load older sales'); }
    setLoadingMore(false);
  }, [salesCursor, loadingMore]);

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
      .then(r => r.json()).then(shop => { setShopName(shop.name || ''); setShopState(shop.state || ''); setShopStateCode(shop.gst_state_code || (shop.gstin ? shop.gstin.substring(0, 2) : '')); setShopGstin(shop.gstin || ''); setShopAddress(shop.address || ''); setShopPhone(shop.phone || ''); setChallanForm(prev => ({ ...prev, dispatch_from: prev.dispatch_from || shop.address || '' })); }).catch(() => {});
  }, [showModal, sales.length, shopName, shopState]);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  // Fetch contractors for hardware on modal open (once per session)
  useEffect(() => {
    if (!showModal || businessType !== 'hardware' || contractorsLoaded) return;
    const token = getToken();
    if (!token) return;
    fetch(apiUrl('/api/contractors'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setContractors(data); setContractorsLoaded(true); })
      .catch(() => {});
  }, [showModal, businessType, contractorsLoaded]);

  // rowGST and billTotals are declared here (before the useEffects that list billTotals.total
  // in their dependency arrays) to avoid temporal dead zone ReferenceErrors at render time.
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

  // Fetch stylists for salon on modal open
  useEffect(() => {
    if (!showModal || businessType !== 'salon') return;
    fetchStylists();
  // fetchStylists is a useCallback whose only dep is businessType (already listed here)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, businessType]);

  // Auto-calculate balance_at_visit for salon when advance_paid or total changes
  useEffect(() => {
    if (businessType !== 'salon') return;
    const advance = parseFloat(extraFields.advance_paid) || 0;
    if (advance > 0) {
      const balance = Math.max(0, billTotals.total - advance);
      setExtraFields(prev => ({ ...prev, balance_at_visit: String(balance.toFixed(2)) }));
    }
  }, [extraFields.advance_paid, billTotals.total, businessType]);

  // Auto-calculate balance_on_delivery for repair_shop when advance_collected or total changes
  useEffect(() => {
    if (businessType !== 'repair_shop') return;
    const advance = parseFloat(extraFields.advance_collected) || 0;
    if (advance > 0) {
      const balance = Math.max(0, billTotals.total - advance);
      setExtraFields(prev => ({ ...prev, balance_on_delivery: String(balance.toFixed(2)) }));
    }
  }, [extraFields.advance_collected, billTotals.total, businessType]);

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
    if (params.get('filter') === 'insurance_pending') { setInsuranceFilter(true); return; }
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
      const res  = await fetch(apiUrl(`/api/inventory/batches/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProductBatches(prev => ({ ...prev, [pid]: (Array.isArray(data) ? data : []).filter(b => !b.is_depleted && b.quantity > 0) }));
    } catch {}
  };

  const loadVariantsFor = async (pid) => {
    if (productVariants[pid]) return;
    try {
      const res  = await fetch(apiUrl(`/api/inventory/variants/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
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
    const discPct = (businessType === 'hardware' && selectedContractor?.contractor_discount > 0)
      ? selectedContractor.contractor_discount : 0;
    const applyDiscount = (basePrice) => {
      if (!basePrice || !discPct) return basePrice || '';
      return parseFloat((Number(basePrice) * (1 - discPct / 100)).toFixed(2));
    };
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.product_id === product._id);
      if (existingIndex >= 0) return current.map((item, itemIndex) => itemIndex === existingIndex ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1), price_per_unit: item.price_per_unit || applyDiscount(product.price) } : item);
      const emptyIndex = current.findIndex((item) => !item.product_id);
      const discountedPrice = applyDiscount(product.price);
      if (emptyIndex >= 0) return current.map((item, itemIndex) => itemIndex === emptyIndex ? { ...item, product_id: product._id, quantity: item.quantity || 1, price_per_unit: discountedPrice } : item);
      return [...current, { product_id: product._id, quantity: 1, price_per_unit: discountedPrice }];
    });
  };
  const handleBarcodeDetected = async (detectedCode) => {
    const barcode = normalizeBarcode(detectedCode);

    // Fast path: product-level barcode in client cache
    const localMatch = products.find((p) => normalizeBarcode(p.barcode) === barcode);
    if (localMatch) { setError(''); addOrIncrementProduct(localMatch); return; }

    // Slow path: variant-level barcode — hit the API
    try {
      const res = await fetch(apiUrl(`/api/products/barcode/${encodeURIComponent(barcode)}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { setError('Scanned barcode did not match any product.'); return; }
      const { product: apiProduct, variant, matchType } = await res.json();
      setError('');
      if (matchType === 'variant' && variant) {
        const variantMeta = {};
        if (variant.size)  variantMeta.size  = variant.size;
        if (variant.color) variantMeta.color = variant.color;
        setItems((current) => {
          const emptyIndex = current.findIndex((item) => !item.product_id);
          const entry = { product_id: apiProduct._id, quantity: 1, price_per_unit: variant.price ?? apiProduct.price ?? '', item_metadata: variantMeta };
          if (emptyIndex >= 0) return current.map((item, idx) => idx === emptyIndex ? entry : item);
          return [...current, entry];
        });
      } else {
        addOrIncrementProduct(apiProduct);
      }
    } catch {
      setError('Barcode lookup failed. Please try again.');
    }
  };
  const addItem    = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill = getRoundedBillValues(billTotals.total);
  const isChallanMode = (businessType === 'hardware' || config?.challanConfig?.enabled) && documentType === 'challan' && !editingSaleId;
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
    // Compute supply type and validate GSTIN
    if (normalized.length === GSTIN_LENGTH) {
      const validation = _validateGSTINFull(normalized);
      setGstinValidation(validation);
      if (validation.valid && shopStateCode) {
        setSupplyType(_getSupplyType(shopStateCode, validation.stateCode));
      } else {
        setSupplyType('intra_state');
      }
    } else {
      setGstinValidation(null);
      setSupplyType('intra_state');
    }
  };

  function resetForm(overrides = {}) {
    const nextPaymentType = overrides.payment_type || form.payment_type || defaultPayment;
    setEditingSaleId(''); setItems([emptyItem()]);
    setForm(buildInitialForm({ payment_type: nextPaymentType, amount_paid: '', ...overrides }));
    setGstinTouched(false); setError(''); setExtraFields({}); setCustomerQuery('');
    setShowCustomerInfo(false); setShowCustomerSuggestions(false); setShowMoreCustomerDetails(false);
    setClientHistory(null); setClientMemberships([]); setRedemptionMembershipId(null);
    setSelectedContractor(null); setContractorSearch(''); setShowContractorDrop(false);
    setDocumentType('invoice');
    setPetProfiles([]);
    setChallanForm({ challan_type: 'supply_of_goods', challan_date: getDefaultSaleDateValue(), consignee_name: '', consignee_address: '', consignee_gstin: '', consignee_contact: '', consignee_phone: '', dispatch_from: shopAddress || '', deliver_to: '', vehicle_number: '', transport_name: '', lr_number: '', eway_bill_number: '', po_number: '', po_date: '', indent_number: '', special_instructions: '', challan_terms: '' });
  }

  // ─── KOT Print (Restaurant) ───────────────────────────────────────────────
  const printKOT = (sale) => {
    const kotWindow = window.open('', '_blank', 'width=320,height=600');
    if (!kotWindow) { alert('Pop-up blocked. Please allow pop-ups to print KOT.'); return; }
    const ef = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const tableNo      = ef.table_no || 'Counter';
    const orderType    = ef.order_type || 'Dine-In';
    const specialInstr = ef.special_instructions || '';
    const waiter       = ef.waiter_name || '';
    const now          = new Date();
    const timeStr      = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr      = now.toLocaleDateString('en-IN');
    const kotNo        = `KOT-${sale.invoice_number || Date.now()}`;
    const itemRows = (sale.items || []).map(item => {
      const meta = item.item_metadata instanceof Map ? Object.fromEntries(item.item_metadata) : (item.item_metadata || {});
      const itemNote = meta.item_note || item.item_note || '';
      return `<tr><td style="padding:4px 2px;font-size:14px;font-weight:bold;">${item.quantity} x</td><td style="padding:4px 2px;font-size:14px;">${item.product_name}${itemNote ? `<br><span style="font-size:11px;color:#555;">* ${itemNote}</span>` : ''}</td></tr>`;
    }).join('');
    kotWindow.document.write(`<!DOCTYPE html><html><head><title>KOT - ${kotNo}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;width:280px;padding:8px;}.header{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;}.kot-no{font-size:18px;font-weight:bold;}.meta{font-size:12px;margin:2px 0;}.table-big{font-size:22px;font-weight:bold;text-align:center;border:2px solid #000;padding:4px;margin:8px 0;}table{width:100%;border-collapse:collapse;}.special{border:1px dashed #000;padding:6px;margin-top:8px;font-size:12px;font-weight:bold;}.footer{text-align:center;font-size:10px;margin-top:8px;border-top:1px dashed #000;padding-top:6px;}@media print{@page{margin:0;size:80mm auto;}body{width:72mm;}}</style></head><body><div class="header"><div class="kot-no">** KOT **</div><div class="meta">${kotNo}</div><div class="meta">${dateStr} | ${timeStr}</div>${waiter ? `<div class="meta">Waiter: ${waiter}</div>` : ''}</div><div class="table-big">${orderType !== 'Dine-In' ? orderType.toUpperCase() : `Table: ${tableNo}`}</div><table>${itemRows}</table>${specialInstr ? `<div class="special">⚠️ Special: ${specialInstr}</div>` : ''}<div class="footer">---- Kitchen Copy — No Prices ----</div><script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000);};<\/script></body></html>`);
    kotWindow.document.close();
  };

  // ─── Fetch stylists (Salon) ───────────────────────────────────────────────
  const fetchStylists = useCallback(async () => {
    if (businessType !== 'salon') return;
    try {
      const res = await fetch(apiUrl('/api/stylists'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const data = await res.json(); setStylists(Array.isArray(data) ? data : []); }
    } catch {}
  }, [businessType]);

  // ─── Fetch client history (Salon) ────────────────────────────────────────
  const fetchClientHistory = useCallback(async (phone) => {
    if (businessType !== 'salon' || !phone || phone.replace(/\D/g, '').length < 10) return;
    try {
      const [histRes, memRes] = await Promise.all([
        fetch(apiUrl(`/api/sales/client-history?phone=${phone}`), { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(apiUrl(`/api/memberships/client?phone=${phone}`), { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (histRes.ok) { const d = await histRes.json(); setClientHistory(d.summary?.visitCount > 0 ? d : null); }
      if (memRes.ok) { const d = await memRes.json(); setClientMemberships(Array.isArray(d) ? d.filter(m => m.isActive) : []); }
    } catch {}
  }, [businessType]);

  async function handleSubmit(e) {
    e?.preventDefault(); setError(''); setGstinTouched(true);
    // Block Schedule X sale without prescription (Drugs & Cosmetics Act compliance)
    if (businessType === 'pharmacy' && scheduleWarning?.hasScheduleX && !scheduleWarning?.prescriptionFilled) {
      setError('Schedule X दवाई के लिए Prescription No. अनिवार्य है। Bill नहीं बनेगा।');
      const fieldEl = document.getElementById('invoice-field-prescription_no');
      fieldEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldEl?.querySelector('input, select, textarea')?.focus();
      return;
    }
    if (!isChallanMode && form.payment_type === 'credit' && !form.buyer_name) { setError('Customer name is required for credit sales.'); return; }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
    // For challans: price is optional (defaults to 0 for reference value)
    const validItems = isChallanMode
      ? items.filter((i) => i.product_id && i.quantity)
      : items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('Select at least one product.'); return; }
    // Skip stock check for challans — goods not yet sold
    if (!isChallanMode) {
      for (const item of validItems) {
        const prod = products.find((p) => p._id === item.product_id);
        if (prod && Number(item.quantity) > (prod.quantity || 0)) { setError(prod.name + ': only ' + prod.quantity + ' items are available in stock.'); return; }
      }
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
      const isChallan = isChallanMode;
      const submitUrl = isEditing ? apiUrl(`/api/sales/${editingSaleId}`) : isChallan ? apiUrl('/api/sales/challan') : apiUrl('/api/sales');
      // For challan items, ensure price_per_unit is at least 0
      const submitItems = isChallan
        ? validItems.map((i) => ({ ...i, price_per_unit: Number(i.price_per_unit) || 0, unit_of_measurement: i.unit_of_measurement || 'NOS', remarks: i.remarks || '' }))
        : validItems;
      const challanPayload = isChallan ? {
        ...challanForm,
        challan_date: challanForm.challan_date || form.sale_date,
        consignee_name: challanForm.consignee_name || form.buyer_name || '',
        consignee_phone: challanForm.consignee_phone || form.buyer_phone || '',
      } : {};
      const res = await fetch(submitUrl, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items: submitItems, ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: isChallan ? 0 : (form.payment_type === 'credit' ? amountPaidNum : billTotals.total), extra_fields: { ...extraFields, ...(businessType === 'hardware' && selectedContractor ? { contractor_id: String(selectedContractor._id), contractor_name: selectedContractor.name } : {}) }, ...challanPayload }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEditing && data?._id) setSales((current) => current.map((sale) => (sale._id === data._id ? data : sale)).sort((a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime()));
        if (!isEditing) eventBus.emit('INVOICE_CREATED', { saleId: data._id });
        // Print delivery challan — 3-copy A4 professional template
        if (isChallan && data?._id) {
          printDeliveryChallan(data, { name: shopName, gstin: shopGstin, address: shopAddress, phone: shopPhone, logo: null });
          // Update challan status to dispatched
          fetch(apiUrl(`/api/sales/${data._id}/mark-dispatched`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          }).catch(() => {});
        }
        // Redeem membership session if one was selected
        if (businessType === 'salon' && redemptionMembershipId && data?._id) {
          fetch(apiUrl(`/api/memberships/${redemptionMembershipId}/redeem`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ saleId: data._id, notes: 'Redeemed at visit' }),
          }).catch(() => {});
        }
        setShowModal(false); resetForm(); fetchAll();
      } else { setError(data.message || 'Failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  }

  const handleShortcutSubmit = useCallback(() => handleSubmit(), []);
  const handleShortcutAddItem = useCallback(() => addItem(), []);

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
    try {
      const res = await fetch(apiUrl(`/api/sales/${sale._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || 'Delete failed'); return; }
      fetchAll();
    } catch { setError('Delete failed'); }
  };

  const sendRepairReadyWhatsApp = (sale) => {
    const ef      = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const phone   = sale.buyer_phone;
    const device  = ef.device_model || 'your device';
    const jobNo   = sale.invoice_number;
    const balance = parseFloat(ef.balance_on_delivery || 0);
    const message = balance > 0
      ? `Namaste! 🙏\n\nAapka ${device} repair ho gaya hai aur pickup ke liye ready hai.\n\nJob No: ${jobNo}\nBalance amount: ₹${balance.toFixed(2)}\n\nKripya apna original receipt lekar aayein.\n\nDhanyawad! 🙏`
      : `Namaste! 🙏\n\nAapka ${device} repair ho gaya hai aur pickup ke liye ready hai.\n\nJob No: ${jobNo}\n\nKripya apna original receipt lekar aayein.\n\nDhanyawad! 🙏`;
    if (phone) {
      window.open(`https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(message)}`, '_blank');
    }
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
      // KOT print when restaurant order is sent to kitchen
      if (businessType === 'restaurant' && nextStage === 'cooking') {
        const sale = sales.find(s => s._id === saleId);
        if (sale) printKOT({ ...sale, extra_fields: updated.extra_fields });
      }
      if (action?.triggerInvoice) {
        const sale = sales.find(s => s._id === saleId);
        if (sale) printInvoice({ ...sale, extra_fields: updated.extra_fields });
      }
      // WhatsApp notification when repair job marked Ready
      if (businessType === 'repair_shop' && nextStage === 'ready') {
        const sale = sales.find(s => s._id === saleId);
        if (sale?.buyer_phone) {
          const shouldSend = window.confirm(`Job ready! Send WhatsApp notification to ${sale.buyer_name || 'customer'} (${sale.buyer_phone})?`);
          if (shouldSend) sendRepairReadyWhatsApp({ ...sale, extra_fields: updated.extra_fields });
        }
      }
    } catch { setError('Status update failed'); }
  };

  const handleMarkDelivered = async () => {
    if (!deliveredForm.received_by) { alert('Please enter the name of the person who received the goods.'); return; }
    try {
      const r = await fetch(apiUrl(`/api/sales/${deliveredChallan._id}/mark-delivered`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(deliveredForm),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.message || 'Failed'); return; }
      setShowDeliveredModal(false); setDeliveredChallan(null); fetchAll();
    } catch { alert('Server error'); }
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
    const matchesSearch    = !normalizedBillSearch || getSaleSearchText(sale).includes(normalizedBillSearch);
    const matchesMonth     = !billMonth || getMonthFilterValue(sale.createdAt || sale.sold_at) === billMonth;
    const matchesWf        = !wfFilter  || getSaleWorkflowStatus(sale, wfc) === wfFilter;
    const matchesInsurance = !insuranceFilter || (sale.insurance_status === 'pending_claim' && sale.insurance_type && sale.insurance_type !== 'none');
    const ef               = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const matchesDelivery  = !deliveryFilter || ef.order_type === deliveryFilter ||
      (deliveryFilter === 'Delivery' && ['Delivery', 'Swiggy', 'Zomato'].includes(ef.order_type));
    return matchesSearch && matchesMonth && matchesWf && matchesInsurance && matchesDelivery;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth || wfFilter || insuranceFilter);
  const pastCustomers = useMemo(() => {
    const seen = new Set();
    return sales.filter((s) => s.buyer_name && s.buyer_name !== 'Walk-in Customer' && s.buyer_phone).filter((s) => { const key = s.buyer_phone; if (seen.has(key)) return false; seen.add(key); return true; }).map((s) => ({ name: s.buyer_name, phone: s.buyer_phone, state: s.buyer_state || '', address: s.buyer_address || '', gstin: s.buyer_gstin || '' }));
  }, [sales]);
  const filteredPastCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return pastCustomers.slice(0, 5);
    return pastCustomers.filter((customer) => customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query)).slice(0, 5);
  }, [customerQuery, pastCustomers]);
  const scheduleWarning = useMemo(() => {
    if (businessType !== 'pharmacy') return null;
    const scheduleItems = items.filter(item => {
      if (!item.product_id) return false;
      const prod = products.find(p => p._id === item.product_id);
      const schedule = prod?.metadata?.schedule || '';
      return schedule && schedule !== 'OTC' && schedule !== '';
    });
    if (scheduleItems.length === 0) return null;
    const hasScheduleX  = scheduleItems.some(item => {
      const prod = products.find(p => p._id === item.product_id);
      return prod?.metadata?.schedule === 'Schedule X';
    });
    const hasScheduleH1 = scheduleItems.some(item => {
      const prod = products.find(p => p._id === item.product_id);
      return prod?.metadata?.schedule === 'Schedule H1';
    });
    const prescriptionFilled = !!(extraFields?.prescription_no?.trim());
    return {
      hasControlled: true,
      hasScheduleX,
      hasScheduleH1,
      prescriptionFilled,
      scheduleItems: scheduleItems.map(item => {
        const prod = products.find(p => p._id === item.product_id);
        return { name: prod?.name || 'Medicine', schedule: prod?.metadata?.schedule || '' };
      }),
    };
  }, [items, extraFields, businessType, products]);

  const invoicePreview = editingSaleId
    ? (sales.find((sale) => sale._id === editingSaleId)?.invoice_number || 'Editing invoice')
    : (() => {
        const now = new Date();
        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const fy = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
        return `INV/${fy}/Auto`;
      })();
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

        {/* ── Restaurant: delivery platform filter tabs ── */}
        {businessType === 'restaurant' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            {['', 'Dine-In', 'Takeaway', 'Delivery', 'Swiggy', 'Zomato'].map((f) => {
              const labels = { '': 'All', 'Dine-In': '🍽️ Dine-In', 'Takeaway': '📦 Takeaway', 'Delivery': '🛵 Delivery', 'Swiggy': '🟠 Swiggy', 'Zomato': '🔴 Zomato' };
              const isActive = deliveryFilter === f;
              return (
                <button key={f} type="button" onClick={() => setDeliveryFilter(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black border-2 transition-all ${isActive ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                >{labels[f]}</button>
              );
            })}
          </div>
        )}

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
              <button type="button" onClick={() => { setBillSearch(''); setBillMonth(''); setWfFilter(''); setInsuranceFilter(false); }}
                className="h-11 px-4 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >Clear</button>
            )}
          </div>
        </div>

        {/* ── Sales list ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton-card border border-slate-200/60" style={{ height: 112 }} />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon mx-auto mb-4 text-[26px]">🧾</div>
            <p className="text-[14px] font-extrabold text-slate-700 mb-1">
              {hasBillFilters
                ? `कोई ${term('sale', 'sale')} नहीं मिली`
                : term('noSales', `अभी कोई ${term('sale', 'sale')} नहीं है`)}
            </p>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              {hasBillFilters
                ? 'Filter बदलें या search हटाएं — bills मिलेंगे'
                : `पहला ${term('invoice', 'bill')} बनाओ और शुरू हो जाओ`}
            </p>
            {!hasBillFilters && (
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="empty-action-btn"
              >
                + {term('newSale', 'पहला Bill बनाएं')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSales.map((s) => (
              <SaleCard
                key={s._id}
                s={s}
                businessType={businessType}
                config={config}
                wfc={wfc}
                shopName={shopName}
                shopGstin={shopGstin}
                shopAddress={shopAddress}
                shopPhone={shopPhone}
                fmt={fmt}
                formatFullDateTime={formatFullDateTime}
                getDefaultSaleDateValue={getDefaultSaleDateValue}
                INPUT={INPUT}
                apiUrl={apiUrl}
                getToken={getToken}
                printInvoice={printInvoice}
                shareWhatsApp={shareWhatsApp}
                sendRepairReadyWhatsApp={sendRepairReadyWhatsApp}
                printKOT={printKOT}
                startEditSale={startEditSale}
                handleDelete={handleDelete}
                advanceWorkflowStage={advanceWorkflowStage}
                fetchAll={fetchAll}
                fetchSales={fetchSales}
                setSplitSale={setSplitSale}
                setShowSplitModal={setShowSplitModal}
                setSplitMode={setSplitMode}
                setSplitCount={setSplitCount}
                setSplitAssignments={setSplitAssignments}
                setDeliveredChallan={setDeliveredChallan}
                setDeliveredForm={setDeliveredForm}
                setShowDeliveredModal={setShowDeliveredModal}
                setExchangeSale={setExchangeSale}
                setExchangeReturned={setExchangeReturned}
                setExchangeNewItems={setExchangeNewItems}
                setShowExchangeModal={setShowExchangeModal}
              />
            ))}

            {/* Load more / pagination */}
            {hasMoreSales && !hasBillFilters && (
              <button
                onClick={loadMoreSales}
                disabled={loadingMore}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 transition-all"
              >
                {loadingMore ? 'Loading...' : '↓ Load older sales'}
              </button>
            )}
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

            {/* Document type toggle — hardware only, not when editing */}
            {businessType === 'hardware' && !editingSaleId && (
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mt-2">
                {[{id:'invoice',label:'Invoice'},{id:'challan',label:'Delivery Challan'}].map(d => (
                  <button key={d.id} type="button" onClick={() => setDocumentType(d.id)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-black transition-all ${documentType === d.id ? (d.id === 'challan' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'text-slate-500 hover:text-slate-700'}`}
                  >{d.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Shop state warning — IGST will be wrong without it */}
            {!shopState && !editingSaleId && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-800">
                <span className="text-base leading-none flex-shrink-0">⚠️</span>
                <span>Shop state not set — inter-state GST (IGST) won&apos;t be calculated correctly. <a href="/profile" className="underline font-bold text-amber-900">Set in Profile →</a></span>
              </div>
            )}

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

            {/* ── Contractor selector (hardware only) ── */}
            {businessType === 'hardware' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
                <p className="text-[12px] font-black text-amber-900 uppercase tracking-wider">Contractor / Walk-in</p>
                <div className="relative">
                  <input
                    className="w-full h-10 px-3 rounded-xl border-2 border-amber-200 bg-white text-[13px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="Select Contractor / Walk-in Customer ▾"
                    value={selectedContractor ? selectedContractor.name : contractorSearch}
                    onChange={e => { setContractorSearch(e.target.value); setSelectedContractor(null); setShowContractorDrop(true); }}
                    onFocus={() => setShowContractorDrop(true)}
                  />
                  {selectedContractor && (
                    <button type="button" onClick={() => { setSelectedContractor(null); setContractorSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-amber-200 text-amber-700 text-[12px] font-black hover:bg-amber-300 transition-colors">×</button>
                  )}
                  {showContractorDrop && !selectedContractor && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-amber-200 shadow-lg max-h-48 overflow-y-auto">
                      <button type="button" onClick={() => { setSelectedContractor(null); setContractorSearch(''); setShowContractorDrop(false); }}
                        className="w-full px-4 py-2.5 text-left text-[13px] text-slate-500 hover:bg-slate-50 border-b border-slate-100">Walk-in Customer</button>
                      {contractors.filter(c => !contractorSearch || c.name.toLowerCase().includes(contractorSearch.toLowerCase())).map(c => (
                        <button key={c._id} type="button"
                          onClick={() => { setSelectedContractor(c); setContractorSearch(''); setShowContractorDrop(false); if (c.name) updateForm({ buyer_name: c.name, buyer_phone: c.phone || '' }); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-amber-50 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <p className="text-[13px] font-black text-slate-900">{c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.contractor_discount > 0 ? `${c.contractor_discount}% discount` : 'No discount'} • Outstanding: ₹{parseFloat(c.current_outstanding || 0).toLocaleString('en-IN')}</p>
                        </button>
                      ))}
                      {contractors.length === 0 && <p className="px-4 py-3 text-[12px] text-slate-400">No contractors found. <a href="/contractors" className="text-amber-600 font-bold">Add one →</a></p>}
                    </div>
                  )}
                </div>
                {selectedContractor && (
                  <div className="space-y-1.5">
                    {selectedContractor.contractor_discount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300">
                        <span className="text-[12px] font-black text-amber-800">🏷️ Contractor discount: {selectedContractor.contractor_discount}% applied to all items</span>
                      </div>
                    )}
                    {selectedContractor.credit_limit > 0 && (() => {
                      const pct = Math.min(100, (selectedContractor.current_outstanding / selectedContractor.credit_limit) * 100);
                      const pillCls = pct > 100 ? 'bg-red-100 border-red-300 text-red-800' : pct > 80 ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-green-100 border-green-300 text-green-800';
                      return (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[11px] font-bold ${pillCls}`}>
                          <span>Outstanding: ₹{parseFloat(selectedContractor.current_outstanding || 0).toLocaleString('en-IN')}</span>
                          <span>Limit: ₹{parseFloat(selectedContractor.credit_limit || 0).toLocaleString('en-IN')}</span>
                          {pct > 100 && <span>⚠️ CREDIT LIMIT REACHED</span>}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

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

                  <input
                    className={INPUT}
                    placeholder={term('customerPhonePlaceholder', 'Phone number')}
                    value={form.buyer_phone}
                    onChange={(e) => {
                      updateForm({ buyer_phone: e.target.value });
                      if (businessType === 'pet_shop' && e.target.value.replace(/\D/g,'').length < 10) setPetProfiles([]);
                    }}
                    onBlur={(e) => {
                      fetchClientHistory(e.target.value);
                      if (businessType === 'pet_shop' && e.target.value.replace(/\D/g,'').length >= 10) {
                        fetch(apiUrl(`/api/pets/owner?phone=${encodeURIComponent(e.target.value)}`), { headers: { Authorization: `Bearer ${getToken()}` } })
                          .then(r => r.json()).then(d => {
                            setPetProfiles(Array.isArray(d) ? d : []);
                            if (Array.isArray(d) && d.length > 0 && !form.buyer_name) {
                              updateForm({ buyer_name: d[0].ownerName });
                            }
                          }).catch(() => {});
                      }
                    }}
                  />

                  <button type="button" onClick={() => setShowMoreCustomerDetails(v => !v)}
                    className="text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                  >{showMoreCustomerDetails ? '▴ Less Details' : '▾ More Details (GSTIN, Address)'}</button>

                  {/* Pet shop: Pet profile card */}
                  {businessType === 'pet_shop' && petProfiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {petProfiles.map(pet => {
                        const dueVacc = pet.vaccinations?.filter(v => v.nextDueDate).sort((a,b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0];
                        const dueDate = dueVacc?.nextDueDate ? new Date(dueVacc.nextDueDate).toLocaleDateString('en-IN') : null;
                        const isOverdue = dueVacc?.nextDueDate ? new Date(dueVacc.nextDueDate) < new Date() : false;
                        return (
                          <div key={pet._id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-teal-200 bg-teal-50/60">
                            <span className="text-xl flex-shrink-0">{{'Dog':'🐕','Cat':'🐈','Bird':'🐦','Fish':'🐠','Rabbit':'🐰','Hamster':'🐹','Reptile':'🦎'}[pet.species] || '🐾'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-black text-teal-900">{pet.petName} {pet.breed ? `(${pet.breed})` : ''}</p>
                              {dueDate && <p className={`text-[10px] font-bold mt-0.5 ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                                💉 Next vaccine: {dueDate}{isOverdue ? ' — OVERDUE' : ''}
                              </p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Salon: Client history card */}
                  {businessType === 'salon' && clientHistory && (
                    <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-1.5">
                      <p className="text-[12px] font-black text-purple-800">👤 Returning Client — {form.buyer_name || 'Known Client'}</p>
                      <p className="text-[11px] text-purple-700">🗓️ Last visit: {clientHistory.daysSince != null ? `${clientHistory.daysSince} days ago` : '—'}  •  {clientHistory.visitCount} visits</p>
                      <p className="text-[11px] text-purple-700">💰 Total spent: ₹{clientHistory.totalSpend?.toLocaleString('en-IN') || 0}</p>
                      {clientHistory.topServices?.length > 0 && (
                        <p className="text-[11px] text-purple-700">💆 Favourite: {clientHistory.topServices.map(s => `${s.name} (${s.count}x)`).join(', ')}</p>
                      )}
                      {clientHistory.lastNotes && (
                        <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 rounded-lg px-2 py-1">📝 Last visit notes: "{clientHistory.lastNotes}"</p>
                      )}
                      {/* Quick-add top services */}
                      {clientHistory.topServices?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {clientHistory.topServices.slice(0, 3).map(s => {
                            const prod = products.find(p => p.name === s.name);
                            if (!prod) return null;
                            return (
                              <button key={s.name} type="button" onClick={() => addOrIncrementProduct(prod)}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition-colors"
                              >+ {s.name}</button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Salon: Active memberships */}
                  {businessType === 'salon' && clientMemberships.length > 0 && (
                    <div className="mt-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2">
                      <p className="text-[11px] font-black text-teal-800">💳 Active Packages</p>
                      {clientMemberships.map(m => (
                        <div key={m._id} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-teal-900">{m.serviceName}</p>
                            <p className="text-[10px] text-teal-700">{m.totalSessions - m.usedSessions} sessions remaining</p>
                          </div>
                          {redemptionMembershipId === m._id ? (
                            <span className="text-[10px] font-black text-teal-700 px-2 py-1 bg-teal-100 rounded-lg">✓ Redeeming</span>
                          ) : (
                            <button type="button" onClick={() => {
                              setRedemptionMembershipId(m._id);
                              const prod = products.find(p => p._id === m.serviceId || p.name === m.serviceName);
                              if (prod) {
                                setItems(prev => {
                                  const exists = prev.findIndex(i => i.product_id === prod._id);
                                  if (exists >= 0) return prev.map((i, idx) => idx === exists ? { ...i, price_per_unit: '0', _isRedemption: true } : i);
                                  const emptyIdx = prev.findIndex(i => !i.product_id);
                                  const entry = { product_id: prod._id, quantity: 1, price_per_unit: '0', item_metadata: { _isRedemption: true } };
                                  if (emptyIdx >= 0) return prev.map((i, idx) => idx === emptyIdx ? entry : i);
                                  return [...prev, entry];
                                });
                              }
                            }}
                              className="text-[10px] font-black text-teal-700 px-2 py-1 bg-teal-100 rounded-lg hover:bg-teal-200 transition-colors flex-shrink-0"
                            >Redeem Now</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {showMoreCustomerDetails && (
                    <div className="space-y-3">
                      <div>
                        <input
                          className={`${INPUT} ${showGstinError ? 'border-rose-400 bg-rose-50 focus:ring-rose-500/20 focus:border-rose-400' : gstinValidation?.valid ? 'border-emerald-400 bg-emerald-50/30' : ''}`}
                          placeholder="Buyer GSTIN (15 digits) — B2B invoice ke liye"
                          value={form.buyer_gstin} maxLength={GSTIN_LENGTH}
                          onChange={(e) => handleBuyerGstinChange(e.target.value)}
                          onBlur={() => setGstinTouched(true)}
                        />
                        {/* Live GSTIN feedback */}
                        {gstinValidation?.valid && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                              ✓ {gstinValidation.stateName} ({gstinValidation.stateCode})
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                              supplyType === 'inter_state'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-green-50 border-green-200 text-green-700'
                            }`}>
                              {supplyType === 'inter_state' ? '🔵 Inter-State — IGST only' : '🟢 Intra-State — CGST+SGST'}
                            </span>
                          </div>
                        )}
                        {showGstinError && <p className="mt-1 text-[11px] font-semibold text-rose-600">✗ Invalid GSTIN format</p>}
                        {showGstinLengthHint && !gstinValidation && (
                          <p className="mt-1 text-[11px] text-slate-400">{GSTIN_LENGTH - gstinValue.length} more character{GSTIN_LENGTH - gstinValue.length === 1 ? '' : 's'} needed</p>
                        )}
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
                {config.invoiceExtraFields.map((field) => {
                  // Evaluate showWhen
                  if (field.showWhen) {
                    const sw = field.showWhen;
                    const watchVal = extraFields[sw.field];
                    if (sw.value !== undefined && watchVal !== sw.value) return null;
                    if (Array.isArray(sw.values) && !sw.values.includes(watchVal)) return null;
                    if (sw.notEmpty && (!watchVal || String(watchVal).trim() === '')) return null;
                  }
                  // stylist_id: also store stylist name in extra_fields
                  const handleChange = (v) => {
                    if (field.key === 'stylist_id') {
                      const stylist = stylists.find(s => s._id === v);
                      setExtraFields(prev => ({ ...prev, stylist_id: v, stylist_name: stylist?.name || '' }));
                    } else {
                      setExtraFields(prev => ({ ...prev, [field.key]: v }));
                    }
                  };
                  return (
                    <div key={field.key} id={`invoice-field-${field.key}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}</p>
                      <DynamicFormField
                        field={field}
                        value={extraFields[field.key] || ''}
                        onChange={handleChange}
                        allValues={extraFields}
                        availableStylists={stylists}
                      />
                    </div>
                  );
                })}
                {/* Prescription confirmed badge */}
                {businessType === 'pharmacy' && scheduleWarning?.hasControlled && scheduleWarning.prescriptionFilled && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-[11px] font-semibold text-green-700">
                    ✓ Prescription on file — Schedule H dispensing authorised
                  </div>
                )}
              </div>
            )}

            {/* ══ CHALLAN SECTIONS (hardware delivery challan) ══ */}
            {isChallanMode && (
              <ChallanSection
                challanForm={challanForm}
                setChallanForm={setChallanForm}
                form={form}
                INPUT={INPUT}
                billTotals={billTotals}
              />
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
                    <div key={item._rowId || index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
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

                        {/* Price — hidden for challan (not a tax document) */}
                        {!isChallanMode && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Price (₹)
                            {businessType === 'pharmacy' && prod?.metadata?.mrp && (
                              <span className="text-slate-400 font-normal ml-1">MRP: ₹{prod.metadata.mrp}</span>
                            )}
                          </p>
                          <input
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-[14px] font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/25 focus:border-green-600 transition-all"
                            type="number" step="0.01" placeholder="0.00"
                            value={item.price_per_unit}
                            onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                            max={businessType === 'pharmacy' && prod?.metadata?.mrp ? prod.metadata.mrp : undefined}
                          />
                        </div>
                        )}

                        {/* UOM — challan only */}
                        {isChallanMode && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Unit</p>
                          <select
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
                            value={item.unit_of_measurement || 'NOS'}
                            onChange={e => updateItem(index, 'unit_of_measurement', e.target.value)}
                          >
                            {['NOS','KGS','MTR','LTR','PCS','BOX','BAG','BUNDLE','SET','PAIR','SQM','CFT','RMT'].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        )}
                      </div>

                      {/* GST breakdown — hidden for challan */}
                      {g && !isChallanMode && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-100 text-[11px]">
                          <span className="text-slate-400">₹{fmt(g.taxable)} + <span className="text-amber-600">₹{fmt(g.gst)} GST</span></span>
                          <span className="font-black text-slate-900">= ₹{fmt(g.total)}</span>
                        </div>
                      )}

                      {/* Remarks — challan only */}
                      {isChallanMode && (
                        <input
                          className="h-9 w-full px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                          placeholder="Item remarks (e.g. Handle with care, Fragile)"
                          value={item.remarks || ''}
                          onChange={e => updateItem(index, 'remarks', e.target.value)}
                        />
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

                      {/* Industry-specific line fields (batch/expiry, size/color, item notes, etc.) */}
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

            {/* ── Schedule H/X Warning Banner (pharmacy) ── */}
            {scheduleWarning && !scheduleWarning.prescriptionFilled && (
              <div className={`flex items-start gap-3 p-3 rounded-xl border-2 ${scheduleWarning.hasScheduleX ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                <span className="text-2xl flex-shrink-0">{scheduleWarning.hasScheduleX ? '🚫' : '⚠️'}</span>
                <div className="flex-1">
                  <p className={`font-black text-sm ${scheduleWarning.hasScheduleX ? 'text-red-800' : 'text-amber-800'}`}>
                    {scheduleWarning.hasScheduleX
                      ? 'Schedule X दवाई — Prescription अनिवार्य है'
                      : 'Schedule H दवाई — Prescription नंबर डालें'}
                  </p>
                  <p className={`text-xs mt-0.5 ${scheduleWarning.hasScheduleX ? 'text-red-700' : 'text-amber-700'}`}>
                    {scheduleWarning.scheduleItems.map(i => `${i.name} (${i.schedule})`).join(', ')}
                  </p>
                  {scheduleWarning.hasScheduleX && (
                    <p className="text-xs font-semibold text-red-700 mt-1">
                      Drugs &amp; Cosmetics Act — Schedule X बिना valid prescription के नहीं बेच सकते।
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const fieldEl = document.getElementById('invoice-field-prescription_no');
                    fieldEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    fieldEl?.querySelector('input, select, textarea')?.focus();
                  }}
                  className={`text-xs font-black px-3 py-1.5 rounded-lg flex-shrink-0 ${scheduleWarning.hasScheduleX ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                >
                  Prescription भरें ↑
                </button>
              </div>
            )}

            {/* ── Insurance Payment Breakdown (pharmacy) ── */}
            {businessType === 'pharmacy' && extraFields.insurance_type && extraFields.insurance_type !== 'None' && extraFields.insurance_type !== '' && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <p className="text-[13px] font-black text-slate-900">Insurance Payment Breakdown</p>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Insurance Coverage (₹)</p>
                  <input
                    className={INPUT}
                    type="number" step="0.01" min="0"
                    placeholder="Amount covered by insurance"
                    value={extraFields.insurance_amount || ''}
                    onChange={e => setExtraFields(prev => ({ ...prev, insurance_amount: e.target.value }))}
                    max={billTotals.total}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-blue-200">
                  <span className="text-[12px] font-bold text-blue-700">Patient Copay</span>
                  <span className="text-[15px] font-black text-blue-700">
                    ₹{Math.max(0, billTotals.total - Number(extraFields.insurance_amount || 0)).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {extraFields.insurance_type} — {Number(extraFields.insurance_amount || 0) >= billTotals.total
                    ? 'Fully covered by insurance'
                    : `Patient pays ₹${Math.max(0, billTotals.total - Number(extraFields.insurance_amount || 0)).toFixed(2)}`}
                </p>
              </div>
            )}

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

            {/* ── Challan value summary + special instructions ── */}
            {isChallanMode && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                  <p className="text-[11px] font-black text-blue-800 mb-2">Value Summary (For Reference Only)</p>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-slate-600">Taxable Value</span>
                    <span className="font-bold text-slate-900">₹{fmt(billTotals.taxable)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] mb-2">
                    <span className="text-slate-600">Applicable GST Rate</span>
                    <span className="font-bold text-slate-900">{items[0]?.gst_rate || 0}% (not charged on this document)</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-slate-900 text-white text-center text-[10px] font-black tracking-wider">
                    TAX WILL BE CHARGED ON INVOICE — THIS CHALLAN IS FOR GOODS MOVEMENT ONLY
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-[12px] font-black text-slate-900">Special Instructions</p>
                  <textarea className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all resize-none"
                    rows={2} placeholder="Handle with care / Temperature sensitive / Fragile goods"
                    value={challanForm.special_instructions}
                    onChange={e => setChallanForm(p => ({ ...p, special_instructions: e.target.value }))} />
                  <textarea className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all resize-none"
                    rows={2} placeholder="Terms (leave blank for default)"
                    value={challanForm.challan_terms}
                    onChange={e => setChallanForm(p => ({ ...p, challan_terms: e.target.value }))} />
                </div>
              </div>
            )}

            {/* ── Bill summary — hidden for challan ── */}
            {!isChallanMode && <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              {/* GST breakdown — CGST+SGST for intra-state, IGST for inter-state */}
              {billTotals.gst > 0 && (() => {
                const gstBreakdown = summariseCartGST(
                  items.filter(i => i.product_id && i.quantity && i.price_per_unit).map(item => {
                    const prod = products.find(p => p._id === item.product_id);
                    return { price_per_unit: Number(item.price_per_unit || 0), quantity: Number(item.quantity || 0), gst_rate: prod?.gst_rate || 0 };
                  }),
                  supplyType
                );
                return (
                  <div className="mb-3 pb-3 border-b border-slate-700 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Taxable Amount</span>
                      <span className="text-white font-bold">₹{fmt(gstBreakdown.taxableAmount)}</span>
                    </div>
                    {supplyType === 'inter_state' ? (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">IGST</span>
                        <span className="text-amber-400 font-bold">₹{fmt(gstBreakdown.igstAmount)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">CGST</span>
                          <span className="text-amber-400 font-bold">₹{fmt(gstBreakdown.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">SGST</span>
                          <span className="text-amber-400 font-bold">₹{fmt(gstBreakdown.sgstAmount)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Total Tax</span>
                      <span className="text-amber-300 font-black">₹{fmt(gstBreakdown.totalTax)}</span>
                    </div>
                  </div>
                );
              })()}
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
            </div>}
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <div className="flex gap-3">
              {isChallanMode ? (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
                >
                  {submitting ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Creating Challan...</>
                  ) : '🚚 Dispatch — Print 3 Copies'}
                </button>
              ) : (
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
              )}
              <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >Cancel</button>
            </div>
          </div>
        </aside>
      </div>

      {/* ════════════════════════════════════════════════════════════
          CHALLAN — MARK DELIVERED MODAL
      ════════════════════════════════════════════════════════════ */}
      {showDeliveredModal && deliveredChallan && (
        <MarkDeliveredModal
          deliveredChallan={deliveredChallan}
          deliveredForm={deliveredForm}
          setDeliveredForm={setDeliveredForm}
          onClose={() => setShowDeliveredModal(false)}
          onConfirm={handleMarkDelivered}
          INPUT={INPUT}
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          SPLIT BILL MODAL (Restaurant only)
      ════════════════════════════════════════════════════════════ */}
      {showSplitModal && splitSale && businessType === 'restaurant' && (
        <SplitBillModal
          splitSale={splitSale}
          splitMode={splitMode}
          setSplitMode={setSplitMode}
          splitCount={splitCount}
          setSplitCount={setSplitCount}
          splitAssignments={splitAssignments}
          setSplitAssignments={setSplitAssignments}
          onClose={() => { setShowSplitModal(false); setSplitSale(null); }}
          onSplitComplete={() => { setShowSplitModal(false); setSplitSale(null); fetchAll(); }}
          apiUrl={apiUrl}
          getToken={getToken}
          fmt={fmt}
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          CLOTHING — EXCHANGE MODAL
      ════════════════════════════════════════════════════════════ */}
      {businessType === 'clothing' && showExchangeModal && exchangeSale && (
        <ExchangeModal
          exchangeSale={exchangeSale}
          exchangeReturned={exchangeReturned}
          setExchangeReturned={setExchangeReturned}
          exchangeNewItems={exchangeNewItems}
          setExchangeNewItems={setExchangeNewItems}
          exchangeSubmitting={exchangeSubmitting}
          setExchangeSubmitting={setExchangeSubmitting}
          products={products}
          onClose={() => setShowExchangeModal(false)}
          onExchangeComplete={fetchSales}
          apiUrl={apiUrl}
          getToken={getToken}
          setError={setError}
          fmt={fmt}
        />
      )}

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
