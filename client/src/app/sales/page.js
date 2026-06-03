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
import SaleFormModal from './components/SaleFormModal';
import SaleReturnModal from './components/SaleReturnModal';
import EmptyState from '../../components/ui/EmptyState';
import { getHeldBills, saveHeldBill, removeHeldBill, getRelativeTime } from '../../lib/heldBills';
import useSalesData from './hooks/useSalesData';
import useSaleForm from './hooks/useSaleForm';
import useIndustrySideData from './hooks/useIndustrySideData';
import {
  INDIAN_STATES as STATES, UNION_TERRITORIES as UTS, GSTIN_REGEX, GSTIN_LENGTH,
  normalizeGstin, normalizeState, fmt, getToken, normalizeBarcode,
  formatDateInput as formatDateInputValue, todayInputValue as getDefaultSaleDateValue,
  getSaleRecordDateISO, getMonthFilterValue,
  buildInitialSaleForm as buildInitialForm, formatFullDateTime, GST_STATE_CODE_MAP,
  getRoundedBillValues, emptySaleItem as emptyItem, buildWhatsAppShareMessage,
} from '../../lib/constants';

/* ─── Constants & pure helpers ───────────────────────────────────── */
const SALES_CACHE_KEY = 'sales-page';
const getSaleSearchText = (sale) => {
  const itemNames = Array.isArray(sale.items) ? sale.items.map((item) => item.product_name || '').join(' ') : '';
  return [sale.invoice_number, sale.product_name, sale.buyer_name, sale.buyer_phone, sale.notes, itemNames].join(' ').toLowerCase();
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
  const activeTabs   = paymentMethods.map(m => PAYMENT_TAB_DEFS[m]).filter(Boolean);
  const defaultPayment = sSchema.defaultPayment || 'cash';
  const wfc = getWorkflowConfig(config);
  const inv          = getInvBehavior(config);
  const batchSales   = isBatchMode(inv);
  const variantSales = isVariantMode(inv);
  const serialSales  = isSerialMode(inv);
  const recipeSales  = isRecipeMode(inv);

  /* ── State that stays in page.js ── */
  const [products, setProducts]         = useState([]);
  const [shopName, setShopName]         = useState('');
  const [shopState, setShopState]       = useState('');
  const [shopStateCode, setShopStateCode] = useState('');
  const [shopGstin, setShopGstin]       = useState('');
  const [shopAddress, setShopAddress]   = useState('');
  const [shopPhone, setShopPhone]       = useState('');
  const [isOnline, setIsOnline]         = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [productBatches, setProductBatches]   = useState({});
  const [productVariants, setProductVariants] = useState({});
  const [billSearch, setBillSearch]     = useState('');
  const [billMonth, setBillMonth]       = useState('');
  const [wfFilter, setWfFilter]         = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showMoreCustomerDetails, setShowMoreCustomerDetails] = useState(false);

  /* ── Return modal state ── */
  const [returnSale, setReturnSale]     = useState(null);
  const [returnToast, setReturnToast]   = useState('');

  /* ── Hold Bill state ── */
  const [heldBills, setHeldBills]       = useState(() => typeof window !== 'undefined' ? getHeldBills() : []);
  const [holdToast, setHoldToast]       = useState('');
  const [showHeldPicker, setShowHeldPicker] = useState(false);

  /* ── Split/exchange/delivery modal state stays in page.js ── */
  const [showSplitModal, setShowSplitModal]     = useState(false);
  const [splitSale, setSplitSale]               = useState(null);
  const [splitMode, setSplitMode]               = useState('equal');
  const [splitCount, setSplitCount]             = useState(2);
  const [splitAssignments, setSplitAssignments] = useState({});
  const [showExchangeModal, setShowExchangeModal]   = useState(false);
  const [exchangeSale, setExchangeSale]             = useState(null);
  const [exchangeReturned, setExchangeReturned]     = useState([]);
  const [exchangeNewItems, setExchangeNewItems]     = useState([]);
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [deliveredChallan, setDeliveredChallan]     = useState(null);
  const [deliveredForm, setDeliveredForm]           = useState({ received_by: '', received_at: getDefaultSaleDateValue(), notes: '' });

  /* ── Hooks (order: industry → sales data → sale form) ── */
  const industryData = useIndustrySideData({ businessType });
  const {
    contractors, selectedContractor, setSelectedContractor,
    contractorSearch, setContractorSearch, showContractorDrop, setShowContractorDrop,
    contractorsLoaded, petProfiles, setPetProfiles, stylists,
    clientHistory, setClientHistory, clientMemberships, setClientMemberships,
    redemptionMembershipId, setRedemptionMembershipId,
    fetchStylists, fetchClientHistory, loadContractors,
  } = industryData;

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

  const {
    sales, setSales, summary, loading, setLoading, refreshing,
    hasMoreSales, loadingMore, fetchSales, loadMoreSales, fetchAll,
  } = useSalesData({ router, isOnline, products, fetchProducts });

  const {
    showModal, setShowModal, submitting, editingSaleId, setEditingSaleId,
    error, setError, items, setItems, form, setForm, updateForm,
    extraFields, setExtraFields, gstinTouched, setGstinTouched,
    supplyType, gstinValidation, documentType, setDocumentType,
    challanForm, setChallanForm, isChallanMode, gstinValue, gstinValid,
    showGstinError, showGstinLengthHint,
    billTotals, amountPaidNum, balanceDue, roundedBill, rowGST, scheduleWarning,
    amountPaidInputRef, buyerNameInputRef, customerComboRef, saleDateInputRef,
    resetForm, updateItem, updateItemQuantityBy, applyQuickQuantity, duplicateItem,
    addItem, removeItem, handleProductSelect, addOrIncrementProduct,
    loadBatchesFor, loadVariantsFor, handleBuyerGstinChange,
    handleSubmit, startEditSale, buildWhatsAppShareMessage,
  } = useSaleForm({
    defaultPayment, businessType, config,
    shopState, shopGstin, shopStateCode, shopAddress, shopName,
    isOnline, router, fetchAll, setSales,
    products, productBatches, setProductBatches, productVariants, setProductVariants,
    selectedContractor, setSelectedContractor, setContractorSearch, setShowContractorDrop,
    setClientHistory, setClientMemberships, setPetProfiles,
    redemptionMembershipId, setRedemptionMembershipId,
    setCustomerQuery, setShowCustomerInfo, setShowCustomerSuggestions, setShowMoreCustomerDetails,
    recipeSales, batchSales, variantSales,
  });

  /* ── Effects that stay in page.js ── */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if ((!showModal && !sales.length) || (shopName && shopState) || !localStorage.getItem('token')) return;
    fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(shop => {
        setShopName(shop.name || ''); setShopState(shop.state || '');
        setShopStateCode(shop.gst_state_code || (shop.gstin ? shop.gstin.substring(0, 2) : ''));
        setShopGstin(shop.gstin || ''); setShopAddress(shop.address || ''); setShopPhone(shop.phone || '');
        setChallanForm(prev => ({ ...prev, dispatch_from: prev.dispatch_from || shop.address || '' }));
      }).catch(() => {});
  }, [showModal, sales.length, shopName, shopState]);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if (!showModal || businessType !== 'hardware' || contractorsLoaded) return;
    loadContractors();
  }, [showModal, businessType, contractorsLoaded, loadContractors]);

  useEffect(() => {
    if (!showModal || businessType !== 'salon') return;
    fetchStylists();
  }, [showModal, businessType, fetchStylists]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    const wf = params.get('wf');
    if (wf) { setWfFilter(wf); router.replace('/sales'); return; }
    if (params.get('filter') === 'insurance_pending') { setInsuranceFilter(true); return; }
    if (params.get('open') !== '1' || params.get('payment') !== 'credit') return;
    setEditingSaleId(''); setItems([emptyItem()]); setForm(buildInitialForm({ payment_type: 'credit' }));
    setGstinTouched(false); setError(''); setShowModal(true); router.replace('/sales');
  }, [router]);

  useEffect(() => {
    if (!showModal) return undefined;
    const handleShortcutSubmit = () => handleSubmit();
    const handleShortcutAddItem = () => addItem();
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') { event.preventDefault(); handleShortcutSubmit(); }
      if (event.altKey && event.key.toLowerCase() === 'a') { event.preventDefault(); handleShortcutAddItem(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  /* ── Functions that stay in page.js ── */
  const handleBarcodeDetected = async (detectedCode) => {
    const barcode = normalizeBarcode(detectedCode);
    const localMatch = products.find((p) => normalizeBarcode(p.barcode) === barcode);
    if (localMatch) { setError(''); addOrIncrementProduct(localMatch); return; }
    try {
      const res = await fetch(apiUrl(`/api/products/barcode/${encodeURIComponent(barcode)}`), { headers: { Authorization: `Bearer ${getToken()}` } });
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
      } else { addOrIncrementProduct(apiProduct); }
    } catch { setError('Barcode lookup failed. Please try again.'); }
  };

  const printKOT = (sale) => {
    const kotWindow = window.open('', '_blank', 'width=320,height=600');
    if (!kotWindow) { alert('Pop-up blocked. Please allow pop-ups to print KOT.'); return; }
    const ef = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const tableNo = ef.table_no || 'Counter'; const orderType = ef.order_type || 'Dine-In';
    const specialInstr = ef.special_instructions || ''; const waiter = ef.waiter_name || '';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN');
    const kotNo = `KOT-${sale.invoice_number || Date.now()}`;
    const itemRows = (sale.items || []).map(item => {
      const meta = item.item_metadata instanceof Map ? Object.fromEntries(item.item_metadata) : (item.item_metadata || {});
      const itemNote = meta.item_note || item.item_note || '';
      return `<tr><td style="padding:4px 2px;font-size:14px;font-weight:bold;">${item.quantity} x</td><td style="padding:4px 2px;font-size:14px;">${item.product_name}${itemNote ? `<br><span style="font-size:11px;color:#555;">* ${itemNote}</span>` : ''}</td></tr>`;
    }).join('');
    kotWindow.document.write(`<!DOCTYPE html><html><head><title>KOT - ${kotNo}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;width:280px;padding:8px;}.header{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;}.kot-no{font-size:18px;font-weight:bold;}.meta{font-size:12px;margin:2px 0;}.table-big{font-size:22px;font-weight:bold;text-align:center;border:2px solid #000;padding:4px;margin:8px 0;}table{width:100%;border-collapse:collapse;}.special{border:1px dashed #000;padding:6px;margin-top:8px;font-size:12px;font-weight:bold;}.footer{text-align:center;font-size:10px;margin-top:8px;border-top:1px dashed #000;padding-top:6px;}@media print{@page{margin:0;size:80mm auto;}body{width:72mm;}}</style></head><body><div class="header"><div class="kot-no">** KOT **</div><div class="meta">${kotNo}</div><div class="meta">${dateStr} | ${timeStr}</div>${waiter ? `<div class="meta">Waiter: ${waiter}</div>` : ''}</div><div class="table-big">${orderType !== 'Dine-In' ? orderType.toUpperCase() : `Table: ${tableNo}`}</div><table>${itemRows}</table>${specialInstr ? `<div class="special">⚠️ Special: ${specialInstr}</div>` : ''}<div class="footer">---- Kitchen Copy — No Prices ----</div><script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000);};<\/script></body></html>`);
    kotWindow.document.close();
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

  const sendRepairReadyWhatsApp = (sale) => {
    const ef      = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const phone   = sale.buyer_phone; const device = ef.device_model || 'your device';
    const jobNo   = sale.invoice_number; const balance = parseFloat(ef.balance_on_delivery || 0);
    const message = balance > 0
      ? `Namaste! 🙏\n\nAapka ${device} repair ho gaya hai aur pickup ke liye ready hai.\n\nJob No: ${jobNo}\nBalance amount: ₹${balance.toFixed(2)}\n\nKripya apna original receipt lekar aayein.\n\nDhanyawad! 🙏`
      : `Namaste! 🙏\n\nAapka ${device} repair ho gaya hai aur pickup ke liye ready hai.\n\nJob No: ${jobNo}\n\nKripya apna original receipt lekar aayein.\n\nDhanyawad! 🙏`;
    if (phone) window.open(`https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const advanceWorkflowStage = async (saleId, nextStage, action) => {
    try {
      const res = await fetch(apiUrl(`/api/sales/${saleId}/workflow`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ workflow_status: nextStage }) });
      if (!res.ok) { setError('Status update failed'); return; }
      const updated = await res.json();
      setSales((current) => current.map((s) => s._id === saleId ? { ...s, extra_fields: updated.extra_fields } : s));
      eventBus.emit('WORKFLOW_ADVANCED', { saleId, newStage: nextStage });
      if (businessType === 'restaurant' && nextStage === 'cooking') { const sale = sales.find((s) => s._id === saleId); if (sale) printKOT({ ...sale, extra_fields: updated.extra_fields }); }
      if (action?.triggerInvoice) { const sale = sales.find((s) => s._id === saleId); if (sale) printInvoice({ ...sale, extra_fields: updated.extra_fields }); }
      if (businessType === 'repair_shop' && nextStage === 'ready') { const sale = sales.find((s) => s._id === saleId); if (sale?.buyer_phone) { const shouldSend = window.confirm(`Job ready! Send WhatsApp notification to ${sale.buyer_name || 'customer'} (${sale.buyer_phone})?`); if (shouldSend) sendRepairReadyWhatsApp({ ...sale, extra_fields: updated.extra_fields }); } }
    } catch { setError('Status update failed'); }
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

  const selectPastCustomer = (customer) => {
    updateForm({ buyer_name: customer.name, buyer_phone: customer.phone, buyer_state: customer.state, buyer_address: customer.address, buyer_gstin: customer.gstin });
    setCustomerQuery(customer.name); setShowCustomerInfo(true); setShowCustomerSuggestions(false);
    setShowMoreCustomerDetails(Boolean(customer.gstin || customer.address || customer.state));
  };

  /* ── Hold Bill handlers ── */
  const handleHoldBill = () => {
    if (!items.some(i => i.product_id)) return;
    const id = `hold_${Date.now()}`;
    const label = form.buyer_name?.trim() || `Bill #${getHeldBills().length + 1}`;
    const bill = { id, label, items, form, extraFields, savedAt: new Date().toISOString(), customerName: form.buyer_name || '' };
    saveHeldBill(bill);
    setHeldBills(getHeldBills());
    resetForm();
    setShowModal(false);
    setHoldToast(`"${label}" hold हो गया ⏸`);
    setTimeout(() => setHoldToast(''), 3000);
  };

  const handleRestoreBill = (bill) => {
    removeHeldBill(bill.id);
    setHeldBills(getHeldBills());
    setItems(bill.items);
    setForm(bill.form);
    setExtraFields(bill.extraFields || {});
    setShowHeldPicker(false);
    setShowModal(true);
    setHoldToast(`"${bill.label}" वापस आ गया`);
    setTimeout(() => setHoldToast(''), 2500);
  };

  const handleRemoveHeldBill = (id) => {
    removeHeldBill(id);
    setHeldBills(getHeldBills());
  };

  /* ── Derived values ── */
  const pendingOfflineSales = sales.filter((sale) => sale?._isOffline);
  const offlineRevenue = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0);
  const offlineGst     = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0);
  const revenueDisplay = Number(summary.totalRevenue || 0) + offlineRevenue;
  const gstDisplay     = Number(summary.totalGST || 0) + offlineGst;
  const returnsDisplay = Number(summary.totalReturnedAmount || 0);
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredSales = sales.filter((sale) => {
    const matchesSearch    = !normalizedBillSearch || getSaleSearchText(sale).includes(normalizedBillSearch);
    const matchesMonth     = !billMonth || getMonthFilterValue(sale.createdAt || sale.sold_at) === billMonth;
    const matchesWf        = !wfFilter  || getSaleWorkflowStatus(sale, wfc) === wfFilter;
    const matchesInsurance = !insuranceFilter || (sale.insurance_status === 'pending_claim' && sale.insurance_type && sale.insurance_type !== 'none');
    const ef = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
    const matchesDelivery  = !deliveryFilter || ef.order_type === deliveryFilter || (deliveryFilter === 'Delivery' && ['Delivery', 'Swiggy', 'Zomato'].includes(ef.order_type));
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
  const invoicePreview = editingSaleId
    ? (sales.find((sale) => sale._id === editingSaleId)?.invoice_number || 'Editing invoice')
    : (() => { const now = new Date(); const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; const fy = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`; return `INV/${fy}/Auto`; })();
  const customerInfoVisible = form.payment_type === 'credit' || showCustomerInfo;
  const customerSummary = form.buyer_name || form.buyer_phone
    ? [form.buyer_name || 'Customer selected', form.buyer_phone || 'No phone'].join(' • ')
    : null;

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
            <div className="flex items-center gap-3 flex-wrap">
              {/* Held bills chip */}
              {heldBills.length > 0 && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowModal(true); setShowHeldPicker(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[12px] font-bold hover:bg-amber-100 transition-colors"
                >
                  ⏸ {heldBills.length} bill hold में
                </button>
              )}
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
          {/* Revenue card — shows net revenue with return deduction hint */}
          <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute top-2 right-2 text-3xl opacity-10">💰</div>
            <div className="text-[24px] font-black text-green-800">₹{fmt(revenueDisplay)}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">Net Revenue</div>
            {returnsDisplay > 0 && (
              <div className="text-[10px] font-bold text-rose-500 mt-0.5">↩ -₹{fmt(returnsDisplay)} returned</div>
            )}
          </div>
          {/* GST card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-200 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute top-2 right-2 text-3xl opacity-10">📊</div>
            <div className="text-[24px] font-black text-amber-800">₹{fmt(gstDisplay)}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">Net GST</div>
            {returnsDisplay > 0 && (
              <div className="text-[10px] font-bold text-rose-500 mt-0.5">↩ -{fmt(Number(summary.totalReturnedGST || 0))} adj.</div>
            )}
          </div>
          {/* Invoices card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-200 rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute top-2 right-2 text-3xl opacity-10">🧾</div>
            <div className="text-[24px] font-black text-slate-800">{filteredSales.length}</div>
            <div className="text-[11px] font-bold text-slate-600 uppercase">{term('kpiInvoices', 'Invoices')}</div>
          </div>
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
          hasBillFilters ? (
            <div className="empty-state">
              <div className="empty-state-icon mx-auto mb-4 text-[26px]">🔍</div>
              <p className="text-[14px] font-extrabold text-slate-700 mb-1">कोई {term('sale', 'sale')} नहीं मिली</p>
              <p className="text-[12px] text-slate-400">Filter बदलें या search हटाएं — bills मिलेंगे</p>
            </div>
          ) : (
            <EmptyState
              emoji="🧾"
              title="अभी तक कोई बिक्री नहीं"
              subtitle={`पहला ${term('invoice', 'bill')} बनाएं और अपनी बिक्री track करना शुरू करें।`}
              actionLabel={`+ ${term('newSale', 'नया Bill बनाएं')}`}
              onAction={() => { resetForm(); setShowModal(true); }}
            />
          )
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
                onReturnClick={setReturnSale}
              />
            ))}

            {/* Load more / pagination */}
            {hasMoreSales && (
              <button
                onClick={loadMoreSales}
                disabled={loadingMore}
                className="w-full py-3 mt-3 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:border-green-300 hover:text-green-700 disabled:opacity-50 transition-all"
              >
                {loadingMore ? 'Loading...' : 'और sales देखें →'}
              </button>
            )}
          </div>
        )}
      </div>

            {/* SALE MODAL */}
      <SaleFormModal
        showModal={showModal}
        setShowModal={setShowModal}
        resetForm={resetForm}
        form={form}
        updateForm={updateForm}
        items={items}
        setItems={setItems}
        extraFields={extraFields}
        setExtraFields={setExtraFields}
        editingSaleId={editingSaleId}
        error={error}
        submitting={submitting}
        isChallanMode={isChallanMode}
        gstinValue={gstinValue}
        gstinValidation={gstinValidation}
        gstinTouched={gstinTouched}
        showGstinError={showGstinError}
        showGstinLengthHint={showGstinLengthHint}
        billTotals={billTotals}
        amountPaidNum={amountPaidNum}
        challanForm={challanForm}
        setChallanForm={setChallanForm}
        documentType={documentType}
        setDocumentType={setDocumentType}
        supplyType={supplyType}
        balanceDue={balanceDue}
        roundedBill={roundedBill}
        rowGST={rowGST}
        scheduleWarning={scheduleWarning}
        invoicePreview={invoicePreview}
        handleSubmit={handleSubmit}
        addItem={addItem}
        removeItem={removeItem}
        updateItem={updateItem}
        updateItemQuantityBy={updateItemQuantityBy}
        duplicateItem={duplicateItem}
        applyQuickQuantity={applyQuickQuantity}
        handleProductSelect={handleProductSelect}
        loadBatchesFor={loadBatchesFor}
        loadVariantsFor={loadVariantsFor}
        handleBuyerGstinChange={handleBuyerGstinChange}
        contractors={contractors}
        selectedContractor={selectedContractor}
        setSelectedContractor={setSelectedContractor}
        contractorSearch={contractorSearch}
        setContractorSearch={setContractorSearch}
        showContractorDrop={showContractorDrop}
        setShowContractorDrop={setShowContractorDrop}
        stylists={stylists}
        clientHistory={clientHistory}
        fetchClientHistory={fetchClientHistory}
        clientMemberships={clientMemberships}
        redemptionMembershipId={redemptionMembershipId}
        setRedemptionMembershipId={setRedemptionMembershipId}
        petProfiles={petProfiles}
        setPetProfiles={setPetProfiles}
        products={products}
        productBatches={productBatches}
        productVariants={productVariants}
        shopName={shopName}
        shopState={shopState}
        shopGstin={shopGstin}
        shopAddress={shopAddress}
        shopPhone={shopPhone}
        businessType={businessType}
        config={config}
        term={term}
        sSchema={sSchema}
        activeTabs={activeTabs}
        barcodeEnabled={barcodeEnabled}
        inv={inv}
        batchSales={batchSales}
        variantSales={variantSales}
        serialSales={serialSales}
        recipeSales={recipeSales}
        isOnline={isOnline}
        onOpenBarcodeScanner={() => setShowBarcodeScanner(true)}
        apiUrl={apiUrl}
        getToken={getToken}
        showCustomerInfo={showCustomerInfo}
        setShowCustomerInfo={setShowCustomerInfo}
        showMoreCustomerDetails={showMoreCustomerDetails}
        setShowMoreCustomerDetails={setShowMoreCustomerDetails}
        customerQuery={customerQuery}
        setCustomerQuery={setCustomerQuery}
        showCustomerSuggestions={showCustomerSuggestions}
        setShowCustomerSuggestions={setShowCustomerSuggestions}
        filteredPastCustomers={filteredPastCustomers}
        selectPastCustomer={selectPastCustomer}
        customerInfoVisible={customerInfoVisible}
        customerSummary={customerSummary}
        buyerNameInputRef={buyerNameInputRef}
        amountPaidInputRef={amountPaidInputRef}
        customerComboRef={customerComboRef}
        saleDateInputRef={saleDateInputRef}
        heldBills={heldBills}
        showHeldPicker={showHeldPicker}
        setShowHeldPicker={setShowHeldPicker}
        onHoldBill={handleHoldBill}
        onRestoreHeldBill={handleRestoreBill}
        onRemoveHeldBill={handleRemoveHeldBill}
      />

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

      {/* RETURN SUCCESS TOAST */}
      {returnToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-green-300 shadow-xl text-[13px] font-bold text-green-800 whitespace-nowrap">
          <span className="text-base">✅</span>
          {returnToast}
        </div>
      )}

      {/* SALE RETURN MODAL */}
      {returnSale && (
        <SaleReturnModal
          sale={returnSale}
          onClose={() => setReturnSale(null)}
          onSuccess={(ret) => {
            setReturnSale(null);
            fetchSales();
            setReturnToast(`Return ${ret.return_number} — ₹${Number(ret.total_amount || 0).toFixed(2)} refunded`);
            window.setTimeout(() => setReturnToast(''), 4000);
          }}
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

      {/* Barcode scanner */}
      <CameraBarcodeScanner
        open={showBarcodeScanner}
        title="Scan product barcode"
        description="Continuous scan mode में हर successful barcode bill में add होता रहेगा।"
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={handleBarcodeDetected}
        continuous
      />

      {/* Hold bill toast */}
      {holdToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-amber-300 shadow-xl text-[13px] font-bold text-amber-800 whitespace-nowrap"
          style={{ animation: 'toastIn 0.2s ease' }}>
          ⏸ {holdToast}
        </div>
      )}
    </Layout>
  );
}
