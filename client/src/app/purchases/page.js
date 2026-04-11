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

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const getToken = () => localStorage.getItem('token');
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_LENGTH = 15;
const PURCHASES_CACHE_KEY = 'purchases-page';
const normalizeGstin = (value) => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);
const normalizeState = (value = '') => value.trim().toLowerCase();
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
  return [purchase.invoice_number, purchase.product_name, purchase.supplier_name, purchase.supplier_phone, purchase.notes, itemNames].join(' ').toLowerCase();
};
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
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};
const buildPurchaseWhatsAppMessage = (purchase) => {
  const purchaseDate = new Date(purchase.createdAt || purchase.purchased_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const itemLines = purchase.items && purchase.items.length > 0
    ? purchase.items.map((item, index) => `  ${index + 1}. ${item.product_name} x ${item.quantity} @ ₹${Number(item.price_per_unit || 0).toFixed(2)} = ₹${Number(item.total_amount || 0).toFixed(2)}`).join('\n')
    : `  1. ${purchase.product_name} x ${purchase.quantity || 1} @ ₹${Number(purchase.price_per_unit || 0).toFixed(2)} = ₹${Number(purchase.total_amount || 0).toFixed(2)}`;
  return [
    purchase.supplier_name ? `Namaste ${purchase.supplier_name} ji,` : 'Namaste,', '',
    'Purchase confirmation', `Bill No: ${purchase.invoice_number || '-'}`, `Date: ${purchaseDate}`,
    'Items:', itemLines,
    `Taxable Amount: ₹${Number(purchase.taxable_amount || 0).toFixed(2)}`,
    `GST / ITC: ₹${Number(purchase.total_gst || 0).toFixed(2)}`,
    `Total Amount: ₹${Number(purchase.total_amount || 0).toFixed(2)}`,
    `Paid: ₹${Number(purchase.amount_paid || 0).toFixed(2)}`,
    ...(Number(purchase.balance_due || 0) > 0 ? [`Balance Due: ₹${Number(purchase.balance_due || 0).toFixed(2)}`] : []),
    '', 'Please review and confirm the purchase details.',
  ].join('\n');
};
const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...',        bg: 'bg-blue-50',   text: 'text-blue-700'  };
  if (status === 'failed')    return { label: 'Sync failed',       bg: 'bg-rose-50',   text: 'text-rose-700'  };
  if (status === 'abandoned') return { label: 'Sync retry needed', bg: 'bg-amber-50',  text: 'text-amber-800' };
  return                             { label: 'Sync pending',      bg: 'bg-amber-50',  text: 'text-amber-700' };
};
const buildOfflinePurchaseItems = (rawItems, products) => (
  (rawItems || []).map((item) => {
    const product = products.find((prod) => prod._id === item.product_id);
    return {
      product_id: item.product_id, product: item.product_id,
      quantity: Number(item.quantity || 0), price_per_unit: Number(item.price_per_unit || 0),
      product_name: product?.name || item.product_name || 'Product',
      hsn_code: product?.hsn_code || item.hsn_code || '',
      gst_rate: Number(item.gst_rate ?? product?.gst_rate ?? 0),
    };
  }).filter((item) => item.product_id && item.quantity > 0)
);

/* ─── Payment badge ──────────────────────────────────────────────── */
const PayBadge = ({ type }) => {
  const map = {
    cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '💵 Cash'   },
    credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 Credit' },
    upi:    { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200',           label: '📱 UPI'    },
    bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: '🏦 Bank'   },
  };
  const s = map[type] || map.cash;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>{s.label}</span>;
};

/* ─── Step indicator ─────────────────────────────────────────────── */
const StepDots = ({ current, total }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`rounded-full transition-all duration-300 ${
        i < current ? 'w-4 h-1.5 bg-blue-500' :
        i === current ? 'w-6 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500' :
        'w-1.5 h-1.5 bg-slate-200'
      }`} />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function PurchasesPage() {
  const [purchases,            setPurchases]            = useState([]);
  const [products,             setProducts]             = useState([]);
  const [summary,              setSummary]              = useState({});
  const [loading,              setLoading]              = useState(true);
  const [refreshing,           setRefreshing]           = useState(false);
  const [showModal,            setShowModal]            = useState(false);
  const [submitting,           setSubmitting]           = useState(false);
  const [editingPurchaseId,    setEditingPurchaseId]    = useState('');
  const [error,                setError]                = useState('');
  const [gstinTouched,         setGstinTouched]         = useState(false);
  const [shopState,            setShopState]            = useState('');
  const [highlightedPurchaseId,setHighlightedPurchaseId]= useState('');
  const [isOnline,             setIsOnline]             = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const router = useRouter();

  /* ── Form state (UNCHANGED) ── */
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({
    payment_type: 'cash', amount_paid: '',
    supplier_name: '', supplier_phone: '', supplier_gstin: '',
    supplier_address: '', supplier_state: '', notes: '',
    purchase_date: getDefaultPurchaseDateValue(),
  });
  const [showInlineProductForm, setShowInlineProductForm] = useState(false);
  const [inlineProductRowIndex, setInlineProductRowIndex] = useState(0);
  const [creatingProduct,       setCreatingProduct]       = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });
  const [purchaseStep,  setPurchaseStep]  = useState(0);
  const [billSearch,    setBillSearch]    = useState('');
  const [billMonth,     setBillMonth]     = useState('');
  const hasBootstrappedRef = useRef(false);

  /* ── All data-fetching logic (ALL UNCHANGED) ── */
  const loadPendingOfflinePurchases = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();
      if (!Array.isArray(queueItems) || queueItems.length === 0) return [];
      return queueItems.filter((op) => op?.type === 'CREATE_PURCHASE').map((operation) => {
        const queuedItems = Array.isArray(operation?.payload?.items) ? operation.payload.items : [];
        const taxableAmount = queuedItems.reduce((sum, item) => sum + Number(item.quantity||0)*Number(item.price_per_unit||0), 0);
        const totalGst = queuedItems.reduce((sum, item) => {
          const product = products.find((p) => p._id === item.product_id);
          const taxable = Number(item.quantity||0)*Number(item.price_per_unit||0);
          return sum + (taxable * Number(item.gst_rate ?? product?.gst_rate ?? 0)) / 100;
        }, 0);
        const amountPaid = Number(operation?.payload?.amount_paid || 0);
        const totalAmount = taxableAmount + totalGst;
        return {
          _id: operation.id, invoice_number: operation.tempId,
          _queueStatus: operation.status || 'pending', _queueError: operation.error || '',
          items: queuedItems.map((item) => {
            const product = products.find((p) => p._id === item.product_id);
            return { product_name: item.product_name || product?.name || 'Product', quantity: item.quantity, price_per_unit: item.price_per_unit, total_amount: Number(item.quantity||0)*Number(item.price_per_unit||0) };
          }),
          product_name: queuedItems[0]?.product_name || products.find((p) => p._id === queuedItems[0]?.product_id)?.name || 'Product',
          total_amount: totalAmount, taxable_amount: taxableAmount, total_gst: totalGst,
          amount_paid: amountPaid, balance_due: Math.max(0, totalAmount - amountPaid),
          payment_type: operation?.payload?.payment_type,
          supplier_name: operation?.payload?.supplier_name || '',
          supplier_phone: operation?.payload?.supplier_phone,
          createdAt: operation?.createdAt || new Date().toISOString(), _isOffline: true,
        };
      });
    } catch { return []; }
  }, [products]);

  const mergePurchasesWithPendingQueue = useCallback(async (nextPurchases) => {
    try {
      const pending = await loadPendingOfflinePurchases();
      if (!pending.length) return nextPurchases;
      const seenIds = new Set((nextPurchases||[]).map((p) => p._id));
      return [...pending.filter((p) => !seenIds.has(p._id)), ...(nextPurchases||[])].sort(
        (a,b) => new Date(b.createdAt||b.purchased_at||0).getTime() - new Date(a.createdAt||a.purchased_at||0).getTime()
      );
    } catch { return nextPurchases; }
  }, [loadPendingOfflinePurchases]);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/purchases'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const next = data.purchases || [];
      const merged = await mergePurchasesWithPendingQueue(next);
      setPurchases(merged); setSummary(data.summary || {});
      writePageCache(PURCHASES_CACHE_KEY, { purchases: merged, summary: data.summary || {} });
    } catch { setError('Purchases could not be loaded'); }
  }, [mergePurchasesWithPendingQueue, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true); await fetchPurchases(); setLoading(false);
  }, [fetchPurchases]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.products || [];
      setProducts(list); await cacheProducts(list);
    } catch {
      if (!isOnline) { const cached = await getCachedProducts(); if (cached?.length) setProducts(cached); }
    }
  }, [isOnline]);

  const fetchShopMeta = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const shop = await res.json(); setShopState(shop.state || '');
    } catch {}
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PURCHASES_CACHE_KEY);
    if (cached?.purchases) {
      mergePurchasesWithPendingQueue(cached.purchases).then(setPurchases);
      setSummary(cached.summary || {}); setLoading(false);
    }
    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.purchases));
      await fetchAll(); setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchAll, mergePurchasesWithPendingQueue, router]);

  useEffect(() => { if (!showModal || products.length > 0 || !localStorage.getItem('token')) return; fetchProducts(); }, [fetchProducts, products.length, showModal]);
  useEffect(() => { if (shopState || !localStorage.getItem('token')) return; fetchShopMeta(); }, [fetchShopMeta, shopState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setIsOnline(true); const off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) return undefined;
    const handler = () => fetchAll();
    window.addEventListener('offline-sync-complete', handler);
    return () => window.removeEventListener('offline-sync-complete', handler);
  }, [fetchAll]);

  /* ── Item row handlers (ALL UNCHANGED) ── */
  const updateItem = (index, field, value) => {
    const updated = [...items]; updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };
  const addItem    = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== index)); };
  const updateForm = (patch) => setForm((c) => ({ ...c, ...patch }));
  const updateNewProductForm = (patch) => setNewProductForm((c) => ({ ...c, ...patch }));

  const resetInlineProductForm = () => {
    setShowInlineProductForm(false); setInlineProductRowIndex(0); setCreatingProduct(false);
    setNewProductForm({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });
  };
  const openInlineProductForm = (rowIndex) => {
    setError(''); setInlineProductRowIndex(rowIndex); setShowInlineProductForm(true);
    setNewProductForm({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });
  };
  const createInlineProduct = async () => {
    if (!isOnline) { setError('Offline mode me naya product add nahi ho sakta.'); return; }
    if (!newProductForm.name.trim()) { setError('Product name required hai'); return; }
    const sellingPrice = Number(newProductForm.price);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) { setError('Valid selling price dijiye'); return; }
    const purchasePrice = Number(items[inlineProductRowIndex]?.price_per_unit || 0);
    setCreatingProduct(true); setError('');
    try {
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newProductForm.name.trim(), price: sellingPrice, cost_price: Number.isFinite(purchasePrice) ? purchasePrice : 0, quantity: 0, unit: newProductForm.unit || 'pcs', hsn_code: newProductForm.hsn_code || '', gst_rate: Number(newProductForm.gst_rate || 0) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Product create nahi ho paaya'); setCreatingProduct(false); return; }
      const nextProducts = [...products, data].sort((a, b) => String(a.name||'').localeCompare(String(b.name||'')));
      setProducts(nextProducts); await cacheProducts(nextProducts);
      updateItem(inlineProductRowIndex, 'product_id', data._id);
      resetInlineProductForm();
    } catch { setError('Product create karte waqt server error aayi'); }
    setCreatingProduct(false);
  };

  /* ── GST calc (UNCHANGED) ── */
  const calcRowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    const isIGST = normalizeState(shopState) && normalizeState(form.supplier_state) ? normalizeState(shopState) !== normalizeState(form.supplier_state) : false;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2, isIGST };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = calcRowGST(item); if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });

  const amountPaidNum  = parseFloat(form.amount_paid) || 0;
  const balanceDue     = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill    = getRoundedBillValues(billTotals.total);
  const gstinValue     = normalizeGstin(form.supplier_gstin);
  const gstinComplete  = gstinValue.length === GSTIN_LENGTH;
  const gstinValid     = !gstinValue || (gstinComplete && GSTIN_REGEX.test(gstinValue));
  const showGstinError = gstinTouched && gstinComplete && !gstinValid;
  const showGstinLengthHint = gstinTouched && !!gstinValue && !gstinComplete;

  const handleSupplierGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    updateForm({ supplier_gstin: normalized, ...(detectedState ? { supplier_state: detectedState } : {}) });
    setGstinTouched(Boolean(normalized));
  };

  /* ── Submit (UNCHANGED) ── */
  const handleSubmit = async (e) => {
    e?.preventDefault(); setError(''); setGstinTouched(true);
    if (form.payment_type === 'credit' && !form.supplier_name) { setError('Supplier name is required for credit purchases'); return; }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('Select at least one product'); return; }
    setSubmitting(true);

    if (!isOnline) {
      try {
        const offlineItems = buildOfflinePurchaseItems(validItems, products);
        const payload = { items: offlineItems, payment_type: form.payment_type, amount_paid: form.payment_type === 'credit' ? (amountPaidNum||0) : billTotals.total, supplier_name: form.supplier_name, supplier_phone: form.supplier_phone, supplier_gstin: gstinValue, supplier_address: form.supplier_address, supplier_state: form.supplier_state, purchase_date: form.purchase_date, notes: form.notes };
        const operation = await queuePurchase(payload, offlineItems);
        if (!operation) throw new Error('Unable to save purchase offline');
        resetModal();
        setPurchases(prev => [{
          _id: operation.id, invoice_number: operation.tempId,
          items: offlineItems.map((item) => ({ product_name: item.product_name, quantity: item.quantity, price_per_unit: item.price_per_unit, total_amount: Number(item.quantity)*Number(item.price_per_unit) })),
          product_name: offlineItems[0]?.product_name || 'Product',
          total_amount: billTotals.total, taxable_amount: billTotals.taxable, total_gst: billTotals.gst,
          amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total,
          balance_due: form.payment_type === 'credit' ? balanceDue : 0,
          payment_type: form.payment_type, supplier_name: form.supplier_name, supplier_phone: form.supplier_phone,
          createdAt: getPurchaseRecordDateISO(form.purchase_date), _isOffline: true,
        }, ...prev]);
      } catch (err) { setError('Offline save failed: ' + (err?.message || 'Unknown error')); }
      setSubmitting(false); return;
    }

    try {
      const isEditing = Boolean(editingPurchaseId);
      const res = await fetch(isEditing ? apiUrl(`/api/purchases/${editingPurchaseId}`) : apiUrl('/api/purchases'), {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items: validItems, payment_type: form.payment_type, amount_paid: form.payment_type === 'credit' ? (amountPaidNum||0) : billTotals.total, supplier_name: form.supplier_name, supplier_phone: form.supplier_phone, supplier_gstin: gstinValue, supplier_address: form.supplier_address, supplier_state: form.supplier_state, purchase_date: form.purchase_date, notes: form.notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false); setItems([emptyItem()]);
        setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '', purchase_date: getDefaultPurchaseDateValue() });
        setGstinTouched(false); fetchPurchases();
      } else { setError(data.message || 'Request failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  };

  const handleDelete = async (purchase) => {
    if (purchase?._isOffline) {
      if (!confirm('Is pending offline purchase ko local queue se hatana hai?')) return;
      const removed = await removeQueuedOperation(purchase._id);
      if (!removed) { setError('Pending offline purchase remove nahi ho paayi'); return; }
      setPurchases((c) => c.filter((e) => e._id !== purchase._id)); setError(''); return;
    }
    if (!confirm('Delete this purchase? Stock will be restored.')) return;
    try { await fetch(apiUrl(`/api/purchases/${purchase._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }); fetchPurchases(); }
    catch { setError('Could not delete purchase'); }
  };

  const sendPurchaseWhatsApp = (purchase) => {
    const phone = cleanPhone(purchase.supplier_phone || '');
    if (!phone) { setError('Supplier phone number is missing'); return; }
    setError('');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(buildPurchaseWhatsAppMessage(purchase))}`, '_blank');
  };

  const focusPendingPurchase = () => {
    const p = purchases.find((purchase) => Number(purchase.balance_due || 0) > 0);
    if (!p) return;
    setHighlightedPurchaseId(p._id);
    const anchors = Array.from(document.querySelectorAll(`[data-purchase-anchor="${p._id}"]`));
    const visible = anchors.find((n) => n.offsetParent !== null) || anchors[0];
    visible?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightedPurchaseId(''), 2200);
  };

  const resetModal = () => {
    setEditingPurchaseId(''); setShowModal(false); setError(''); setItems([emptyItem()]);
    setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '', purchase_date: getDefaultPurchaseDateValue() });
    setPurchaseStep(0); setGstinTouched(false); resetInlineProductForm();
  };

  const startEditPurchase = (purchase) => {
    if (purchase._isOffline) { setError('Yeh entry abhi sync nahi hui — internet aane pe edit kar sakte hain'); return; }
    const sourceItems = purchase.items?.length > 0 ? purchase.items : [{ product: purchase.product, quantity: purchase.quantity, price_per_unit: purchase.price_per_unit }];
    setEditingPurchaseId(purchase._id);
    setItems(sourceItems.map((item) => ({ product_id: item.product?._id || item.product || '', quantity: item.quantity || 1, price_per_unit: item.price_per_unit || '' })));
    setForm({ payment_type: purchase.payment_type || 'cash', amount_paid: purchase.payment_type === 'credit' ? String(purchase.amount_paid || '') : '', supplier_name: purchase.supplier_name || '', supplier_phone: purchase.supplier_phone || '', supplier_gstin: purchase.supplier_gstin || '', supplier_address: purchase.supplier_address || '', supplier_state: purchase.supplier_state || '', notes: purchase.notes || '', purchase_date: formatDateInputValue(purchase.createdAt || purchase.purchased_at || new Date()) });
    setPurchaseStep(0); setGstinTouched(false); setError(''); setShowModal(true);
  };

  /* ── Derived (UNCHANGED) ── */
  const pendingOfflinePurchases = purchases.filter((p) => p?._isOffline);
  const offlinePurchaseValue = pendingOfflinePurchases.reduce((s, p) => s + Number(p?.total_amount || 0), 0);
  const offlineItc           = pendingOfflinePurchases.reduce((s, p) => s + Number(p?.total_gst || 0), 0);
  const offlineDue           = pendingOfflinePurchases.reduce((s, p) => s + Number(p?.balance_due || 0), 0);
  const totalSpendDisplay    = Number(summary.totalPurchaseValue || 0) + offlinePurchaseValue;
  const totalItcDisplay      = Number(summary.totalITC || 0) + offlineItc;
  const totalDueDisplay      = Number(summary.totalDue || 0) + offlineDue;
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredPurchases    = purchases.filter((p) => {
    const matchesSearch = !normalizedBillSearch || getPurchaseSearchText(p).includes(normalizedBillSearch);
    const matchesMonth  = !billMonth || getMonthFilterValue(p.createdAt || p.purchased_at) === billMonth;
    return matchesSearch && matchesMonth;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth);

  const wizardSteps = [
    { title: 'Products',  icon: '📦', desc: 'Items add करें'      },
    { title: 'Payment',   icon: '💳', desc: 'Cash या credit'      },
    { title: 'Supplier',  icon: '🏪', desc: 'Details & GST'       },
  ];

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-5">

        {/* ══ HEADER ════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">खरीदारी</p>
            <h1 className="text-[22px] font-black text-slate-900 leading-tight">Purchases</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/purchases/suppliers"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 shadow-sm hover:-translate-y-px hover:shadow-md transition-all"
            >
              🏪 Suppliers
            </Link>
            <button
              type="button"
              onClick={() => { resetModal(); setShowModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
            >
              + नई खरीद
            </button>
          </div>
        </div>

        {/* ══ OFFLINE BANNER ════════════════════════════════════════ */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Mode</div>
              <div className="text-[11px] text-amber-600">Purchases offline save होंगी, sync बाद में होगी</div>
            </div>
          </div>
        )}

        {/* Pending offline banner */}
        {pendingOfflinePurchases.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-black text-blue-800">
                {pendingOfflinePurchases.length} purchase{pendingOfflinePurchases.length > 1 ? 's' : ''} sync pending
              </div>
              <div className="text-[11px] text-blue-600">Internet aate hi automatically sync ho jayengi</div>
            </div>
          </div>
        )}

        {/* ══ KPI STRIP ═════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Spend',   value: `₹${totalSpendDisplay.toFixed(2)}`,  note: 'Purchase outflow',           accent: 'border-t-amber-500',  val: 'text-amber-700',   icon: '🛒', bg: 'bg-amber-50'  },
            { label: 'Input GST',     value: `₹${totalItcDisplay.toFixed(2)}`,    note: 'ITC available',              accent: 'border-t-blue-500',   val: 'text-blue-700',    icon: '📋', bg: 'bg-blue-50'   },
            { label: 'Balance Due',   value: `₹${totalDueDisplay.toFixed(2)}`,    note: totalDueDisplay > 0 ? 'Supplier credit outstanding' : 'All paid ✓', accent: totalDueDisplay > 0 ? 'border-t-rose-500' : 'border-t-emerald-400', val: totalDueDisplay > 0 ? 'text-rose-600' : 'text-emerald-700', icon: '💸', bg: totalDueDisplay > 0 ? 'bg-rose-50' : 'bg-emerald-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${kpi.accent} p-4 lg:p-5 shadow-sm`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center text-lg`}>{kpi.icon}</div>
                {kpi.label === 'Balance Due' && totalDueDisplay > 0 && (
                  <button type="button" onClick={focusPendingPurchase}
                    className="text-[11px] font-black text-cyan-600 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg hover:bg-cyan-100 transition-colors"
                  >
                    Find →
                  </button>
                )}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{kpi.label}</div>
              <div className={`text-[22px] font-black leading-none tracking-tight ${kpi.val} mb-2`}>{kpi.value}</div>
              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold ${kpi.bg} ${kpi.val}`}>{kpi.note}</span>
            </div>
          ))}
        </div>

        {/* ══ FILTERS ═══════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              placeholder="🔍 Invoice, supplier, product..."
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all sm:w-44"
              type="month" value={billMonth} onChange={(e) => setBillMonth(e.target.value)}
            />
            {hasBillFilters && (
              <button type="button" onClick={() => { setBillSearch(''); setBillMonth(''); }}
                className="h-11 px-4 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >Clear</button>
            )}
          </div>
        </div>

        {/* Global error */}
        {error && !showModal && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {/* ══ PURCHASE LIST ═════════════════════════════════════════ */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">🛒</div>
            <div className="text-[15px] font-bold text-slate-700 mb-1">
              {hasBillFilters ? 'कोई purchase नहीं मिली' : 'अभी कोई purchase नहीं'}
            </div>
            <div className="text-[12px] text-slate-400 mb-5">
              {hasBillFilters ? 'Filter बदलकर देखें' : 'पहली खरीद record करें'}
            </div>
            {!hasBillFilters && (
              <button onClick={() => { resetModal(); setShowModal(true); }}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md hover:shadow-lg transition-all"
              >+ नई खरीद दर्ज करें</button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPurchases.map((p) => {
              const badge = p._isOffline ? getOfflineBadgeMeta(p._queueStatus) : null;
              const isHighlighted = highlightedPurchaseId === p._id;
              return (
                <div
                  key={p._id}
                  data-purchase-anchor={p._id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                    isHighlighted ? 'border-blue-400 ring-2 ring-blue-200' :
                    p._isOffline  ? 'border-amber-200' : 'border-slate-200'
                  }`}
                >
                  {/* Offline badge strip */}
                  {p._isOffline && (
                    <div className={`flex items-center gap-2 px-4 py-2 border-b ${badge.bg} border-amber-100`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className={`text-[11px] font-black ${badge.text}`}>{badge.label}</span>
                      {p._queueError && <span className="text-[11px] text-rose-600 ml-1">{p._queueError}</span>}
                    </div>
                  )}

                  <div className="p-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-black text-slate-900 truncate">
                          {p.items?.length > 1 ? `${p.items.length} products` : p.product_name}
                        </div>
                        <div className="font-mono text-[11px] text-blue-600 mt-0.5">{p.invoice_number}</div>
                        {p.supplier_name && (
                          <div className="text-[11px] text-slate-400 mt-0.5">🏪 {p.supplier_name}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-[18px] font-black text-slate-900">₹{(p.total_amount||0).toFixed(2)}</div>
                        <div className="mt-0.5"><PayBadge type={p.payment_type} /></div>
                      </div>
                    </div>

                    {/* Data chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
                        Taxable ₹{(p.taxable_amount||0).toFixed(2)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-600">
                        ITC ₹{(p.total_gst||0).toFixed(2)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-600">
                        Paid ₹{(p.amount_paid||0).toFixed(2)}
                      </span>
                      {(p.balance_due||0) > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-100 text-[11px] font-black text-rose-600">
                          Due ₹{p.balance_due.toFixed(2)}
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
                        {formatFullDateTime(p.createdAt || p.purchased_at)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className={`grid gap-2 ${p.supplier_phone ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {p.supplier_phone && (
                        <button onClick={() => sendPurchaseWhatsApp(p)}
                          className="py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >📲 WA</button>
                      )}
                      <button onClick={() => startEditPurchase(p)} disabled={Boolean(p._isOffline)}
                        className="py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                      >✏️ Edit</button>
                      <button onClick={() => handleDelete(p)}
                        className="py-2 rounded-xl border border-rose-200 bg-rose-50 text-[12px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                      >{p._isOffline ? '✕ Remove' : '🗑️ Delete'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL — 3-step wizard slide-up sheet
      ════════════════════════════════════════════════════════════ */}
      <div className={`fixed inset-0 z-[70] transition-opacity duration-300 ${showModal ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        {/* Backdrop */}
        <button type="button" onClick={resetModal} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

        {/* Sheet */}
        <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100vh-56px)] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[480px] md:max-h-screen md:rounded-none md:rounded-l-3xl ${showModal ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}`}>

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Modal header */}
          <div className="flex-shrink-0 bg-white border-b border-slate-100 px-5 pt-3 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {editingPurchaseId ? 'Purchase Edit करें' : 'नई खरीद'}
                </p>
                <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                  {editingPurchaseId ? 'Edit Purchase' : 'Record Purchase'}
                </h3>
              </div>
              <button type="button" onClick={resetModal}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors mt-1"
              >✕</button>
            </div>

            {/* Wizard step tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
              {wizardSteps.map((step, i) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setPurchaseStep(i)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-black transition-all ${
                    purchaseStep === i
                      ? 'bg-white text-slate-900 shadow-sm'
                      : i < purchaseStep
                        ? 'text-blue-600 hover:text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span className="hidden sm:inline">{step.title}</span>
                  {i < purchaseStep && <span className="text-emerald-500 text-[10px]">✓</span>}
                </button>
              ))}
            </div>

            {/* Step subtitle */}
            <div className="flex items-center justify-between mt-2.5">
              <p className="text-[12px] text-slate-400 font-semibold">
                Step {purchaseStep + 1}/3 · {wizardSteps[purchaseStep].desc}
              </p>
              <StepDots current={purchaseStep} total={3} />
            </div>
          </div>

          {/* Error */}
          {error && showModal && (
            <div className="flex-shrink-0 mx-5 mt-4">
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
                ⚠️ {error}
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* ── STEP 0: Products ─────────────────────────────── */}
            {purchaseStep === 0 && (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const rowGST = calcRowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      {/* Item header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          Item {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openInlineProductForm(index)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-black text-blue-700 hover:bg-blue-100 transition-colors"
                          >+ New Product</button>
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(index)}
                              className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-black hover:bg-rose-100 transition-colors flex items-center justify-center"
                            >✕</button>
                          )}
                        </div>
                      </div>

                      {/* Product select */}
                      <SearchableProductSelect
                        products={products}
                        value={item.product_id}
                        onChange={(id) => updateItem(index, 'product_id', id)}
                        placeholder="Product खोजें..."
                      />

                      {prod && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
                            GST {prod.gst_rate || 0}%
                          </span>
                          {prod.hsn_code && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">HSN {prod.hsn_code}</span>}
                          {prod.unit   && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{prod.unit}</span>}
                        </div>
                      )}

                      {/* Inline new product form */}
                      {showInlineProductForm && inlineProductRowIndex === index && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                          <div>
                            <p className="text-[12px] font-black text-blue-700 mb-0.5">नया Product जोड़ें</p>
                            <p className="text-[11px] text-blue-500">Opening stock 0 रहेगा, purchase save होने पर बढ़ेगा</p>
                          </div>
                          <input
                            className="h-11 w-full px-4 rounded-xl border border-blue-200 bg-white text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            placeholder="Product का नाम *"
                            value={newProductForm.name}
                            onChange={(e) => updateNewProductForm({ name: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              className="h-11 px-4 rounded-xl border border-blue-200 bg-white text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                              type="number" min="0" step="0.01"
                              placeholder="Selling price *"
                              value={newProductForm.price}
                              onChange={(e) => updateNewProductForm({ price: e.target.value })}
                            />
                            <select
                              className="h-11 px-3 rounded-xl border border-blue-200 bg-white text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                              value={newProductForm.gst_rate}
                              onChange={(e) => updateNewProductForm({ gst_rate: e.target.value })}
                            >
                              {[0,5,12,18,28].map(r => <option key={r} value={String(r)}>{r}% GST</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              className="h-11 px-4 rounded-xl border border-blue-200 bg-white text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                              placeholder="Unit (pcs/kg/box)"
                              value={newProductForm.unit}
                              onChange={(e) => updateNewProductForm({ unit: e.target.value })}
                            />
                            <input
                              className="h-11 px-4 rounded-xl border border-blue-200 bg-white text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                              placeholder="HSN Code"
                              value={newProductForm.hsn_code}
                              onChange={(e) => updateNewProductForm({ hsn_code: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={createInlineProduct} disabled={creatingProduct}
                              className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >{creatingProduct ? 'Saving...' : 'Save Product'}</button>
                            <button type="button" onClick={resetInlineProductForm} disabled={creatingProduct}
                              className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            >Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Qty + Price */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Quantity *</p>
                          <input
                            className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            type="number" min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Purchase Price *</p>
                          <input
                            className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            type="number" step="0.01"
                            value={item.price_per_unit}
                            onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* GST breakdown */}
                      {rowGST && (
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-[11px]">
                          <div className="text-slate-400">
                            ₹{rowGST.taxable.toFixed(2)} + <span className="text-amber-600">₹{rowGST.gst.toFixed(2)} GST</span>
                            <span className="ml-1.5 text-[10px] text-slate-300">
                              ({rowGST.isIGST ? `IGST ${rowGST.gst_rate}%` : `CGST+SGST ${rowGST.gst_rate}%`})
                            </span>
                          </div>
                          <span className="font-black text-slate-900">= ₹{rowGST.total.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addItem}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                >+ दूसरा Product जोड़ें</button>

                {/* Bill summary */}
                {billTotals.total > 0 && (
                  <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Bill Summary</p>
                    <div className="flex justify-between text-[12px] mb-1.5">
                      <span className="text-slate-400">Taxable Amount</span>
                      <span className="font-bold">₹{billTotals.taxable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] mb-3">
                      <span className="text-slate-400">Total GST (ITC)</span>
                      <span className="font-bold text-blue-400">₹{billTotals.gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-3">
                      <span className="text-[14px] font-black">Grand Total</span>
                      <span className="text-[22px] font-black text-cyan-400">₹{billTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 1: Payment ──────────────────────────────── */}
            {purchaseStep === 1 && (
              <div className="space-y-4">
                {/* Summary recap */}
                {billTotals.total > 0 && (
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Bill Recap</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Taxable', value: `₹${billTotals.taxable.toFixed(2)}`, color: 'text-slate-700' },
                        { label: 'GST',     value: `₹${billTotals.gst.toFixed(2)}`,     color: 'text-blue-700'  },
                        { label: 'Total',   value: `₹${billTotals.total.toFixed(2)}`,   color: 'text-slate-900' },
                      ].map((r) => (
                        <div key={r.label} className="bg-white rounded-xl p-2.5">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{r.label}</div>
                          <div className={`text-[14px] font-black ${r.color}`}>{r.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-[11px] text-slate-500">Round Off</span>
                      <span className="text-[11px] font-bold text-slate-700">
                        {roundedBill.roundOff >= 0 ? '+' : ''}₹{roundedBill.roundOff.toFixed(2)} → ₹{roundedBill.roundedTotal}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment type */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Payment Type</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { val: 'cash',   label: '💵 Cash',   active: 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/25' },
                      { val: 'credit', label: '📒 Credit', active: 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/25' },
                      { val: 'upi',    label: '📱 UPI',    active: 'bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-500/25' },
                      { val: 'bank',   label: '🏦 Bank',   active: 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/25' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateForm({ payment_type: opt.val, amount_paid: opt.val === 'credit' ? form.amount_paid : '' })}
                        className={`py-3 rounded-xl border-2 text-[13px] font-black transition-all ${
                          form.payment_type === opt.val
                            ? opt.active
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                {/* Advance payment for credit */}
                {form.payment_type === 'credit' && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                    <div>
                      <p className="text-[13px] font-black text-slate-900 mb-0.5">Advance Payment</p>
                      <p className="text-[11px] text-slate-400">अभी कितना दिया? (optional)</p>
                    </div>
                    <input
                      className="h-11 w-full px-4 rounded-xl border border-rose-200 bg-white text-[14px] font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                      type="number" step="0.01" min="0"
                      placeholder={`Max ₹${billTotals.total.toFixed(2)}`}
                      value={form.amount_paid}
                      onChange={(e) => updateForm({ amount_paid: e.target.value })}
                    />
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-100 border border-rose-200">
                      <span className="text-[12px] font-bold text-rose-700">Supplier Ledger में जाएगा</span>
                      <span className="text-[16px] font-black text-rose-700">₹{balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Supplier ─────────────────────────────── */}
            {purchaseStep === 2 && (
              <div className="space-y-4">
                <div className={`rounded-2xl border p-4 space-y-3 ${form.payment_type === 'credit' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-black text-slate-900">Supplier Details</p>
                    {form.payment_type === 'credit'
                      ? <span className="px-2.5 py-1 rounded-full bg-rose-100 border border-rose-200 text-[10px] font-black text-rose-700">Required *</span>
                      : <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">Optional</span>
                    }
                  </div>

                  {/* Name */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Supplier Name {form.payment_type === 'credit' && <span className="text-rose-500">*</span>}
                    </p>
                    <input
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      placeholder="Supplier का नाम"
                      value={form.supplier_name}
                      onChange={(e) => updateForm({ supplier_name: e.target.value })}
                      required={form.payment_type === 'credit'}
                    />
                  </div>

                  {/* Phone + GSTIN */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Phone</p>
                      <input
                        className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        placeholder="Mobile number"
                        value={form.supplier_phone}
                        onChange={(e) => updateForm({ supplier_phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">GSTIN</p>
                      <input
                        className={`h-11 w-full px-4 rounded-xl border text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${showGstinError ? 'border-rose-400 bg-rose-50 focus:ring-rose-500/20' : 'border-slate-200 bg-white focus:ring-blue-500/30 focus:border-blue-400'}`}
                        placeholder="15-digit GSTIN"
                        value={form.supplier_gstin}
                        maxLength={GSTIN_LENGTH}
                        onChange={(e) => handleSupplierGstinChange(e.target.value)}
                        onBlur={() => setGstinTouched(true)}
                      />
                      {showGstinError      && <p className="mt-1 text-[11px] font-semibold text-rose-600">Invalid GSTIN</p>}
                      {showGstinLengthHint && <p className="mt-1 text-[11px] text-slate-400">{gstinValue.length}/{GSTIN_LENGTH}</p>}
                      {gstinValid && gstinValue.length >= 2 && form.supplier_state && (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-600">✓ State auto-detected</p>
                      )}
                    </div>
                  </div>

                  {/* Date + State */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Purchase Date</p>
                      <input
                        className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        type="date"
                        value={form.purchase_date}
                        onChange={(e) => updateForm({ purchase_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supplier State</p>
                      <select
                        className="h-11 w-full px-3 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        value={form.supplier_state}
                        onChange={(e) => updateForm({ supplier_state: e.target.value })}
                      >
                        <option value="">State / UT चुनें</option>
                        <optgroup label="States">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                        <optgroup label="Union Territories">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Address</p>
                    <input
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      placeholder="Supplier address"
                      value={form.supplier_address}
                      onChange={(e) => updateForm({ supplier_address: e.target.value })}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notes</p>
                    <input
                      className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      placeholder="कोई note..."
                      value={form.notes}
                      onChange={(e) => updateForm({ notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Tax type indicator */}
                {form.supplier_state && shopState && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-lg">📋</span>
                    <div>
                      <span className="text-[12px] font-black text-blue-700">
                        {normalizeState(shopState) !== normalizeState(form.supplier_state) ? 'IGST applicable' : 'CGST + SGST applicable'}
                      </span>
                      <div className="text-[11px] text-blue-500 mt-0.5">
                        {normalizeState(shopState) !== normalizeState(form.supplier_state)
                          ? 'Inter-state purchase — full IGST'
                          : 'Intra-state purchase — split CGST/SGST'
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sticky footer ── */}
          <div className="flex-shrink-0 bg-white border-t border-slate-100 px-5 py-4">
            <div className="flex gap-3">
              {purchaseStep > 0 && (
                <button type="button" onClick={() => setPurchaseStep((c) => c - 1)}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >← Back</button>
              )}
              {purchaseStep < 2 ? (
                <button type="button" onClick={() => setPurchaseStep((c) => c + 1)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
                >
                  Continue → <span className="text-[13px] opacity-70">{wizardSteps[purchaseStep + 1].icon}</span>
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
                >
                  {submitting ? 'Saving...' : !isOnline ? '📥 Offline Save' : editingPurchaseId ? 'Update Purchase' : form.payment_type === 'credit' ? '📒 Credit Purchase' : '✓ Purchase Save करें'}
                </button>
              )}
              {purchaseStep === 0 && (
                <button type="button" onClick={resetModal}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >Cancel</button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}