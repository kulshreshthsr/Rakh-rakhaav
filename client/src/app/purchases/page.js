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

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);
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
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });
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
  cash: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Credit' },
  upi: { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200', label: 'UPI' },
  bank: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Bank' },
};
const INPUT = 'h-11 w-full px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all';

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
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState('');
  const [error, setError] = useState('');
  const [gstinTouched, setGstinTouched] = useState(false);
  const [shopState, setShopState] = useState('');
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const router = useRouter();

  // â”€â”€ Form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({
    payment_type: 'cash',
    amount_paid: '',
    supplier_name: '', supplier_phone: '', supplier_gstin: '',
    supplier_address: '', supplier_state: '', notes: '',
    purchase_date: getDefaultPurchaseDateValue(),
  });
  const [showInlineProductForm, setShowInlineProductForm] = useState(false);
  const [inlineProductRowIndex, setInlineProductRowIndex] = useState(0);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    price: '',
    gst_rate: '0',
    unit: 'pcs',
    hsn_code: '',
  });
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const hasBootstrappedRef = useRef(false);

  const loadPendingOfflinePurchases = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();

      if (!Array.isArray(queueItems) || queueItems.length === 0) {
        return [];
      }

      return queueItems
        .filter((operation) => operation?.type === 'CREATE_PURCHASE')
        .map((operation) => {
          const queuedItems = Array.isArray(operation?.payload?.items)
            ? operation.payload.items
            : [];
          const taxableAmount = queuedItems.reduce((sum, item) => {
            return sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0);
          }, 0);
          const totalGst = queuedItems.reduce((sum, item) => {
            const product = products.find((prod) => prod._id === item.product_id);
            const taxable = Number(item.quantity || 0) * Number(item.price_per_unit || 0);
            const gstRate = Number(item.gst_rate ?? product?.gst_rate ?? 0);
            return sum + (taxable * gstRate) / 100;
          }, 0);
          const amountPaid = Number(operation?.payload?.amount_paid || 0);
          const totalAmount = taxableAmount + totalGst;

          return {
            _id: operation.id,
            invoice_number: operation.tempId,
            _queueStatus: operation.status || 'pending',
            _queueError: operation.error || '',
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
            payment_type: operation?.payload?.payment_type,
            supplier_name: operation?.payload?.supplier_name || '',
            supplier_phone: operation?.payload?.supplier_phone,
            createdAt: operation?.createdAt || new Date().toISOString(),
            _isOffline: true,
          };
        });
    } catch {
      return [];
    }
  }, [products]);

  const mergePurchasesWithPendingQueue = useCallback(async (nextPurchases) => {
    try {
      const pendingOfflinePurchases = await loadPendingOfflinePurchases();

      if (!pendingOfflinePurchases.length) {
        return nextPurchases;
      }

      const seenIds = new Set((nextPurchases || []).map((purchase) => purchase._id));
      const mergedOfflinePurchases = pendingOfflinePurchases.filter((purchase) => !seenIds.has(purchase._id));

      return [...mergedOfflinePurchases, ...(nextPurchases || [])].sort(
        (a, b) => new Date(b.createdAt || b.purchased_at || 0).getTime() - new Date(a.createdAt || a.purchased_at || 0).getTime()
      );
    } catch {
      return nextPurchases;
    }
  }, [loadPendingOfflinePurchases]);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/purchases'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextPurchases = data.purchases || [];
      const nextSummary = data.summary || {};
      const mergedPurchases = await mergePurchasesWithPendingQueue(nextPurchases);
      setPurchases(mergedPurchases);
      setSummary(nextSummary);
      writePageCache(PURCHASES_CACHE_KEY, { purchases: mergedPurchases, summary: nextSummary });
    } catch { setError('Purchases could not be loaded'); }
  }, [mergePurchasesWithPendingQueue, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchPurchases();
    setLoading(false);
  }, [fetchPurchases]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
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
      const res = await fetch(apiUrl('/api/auth/shop'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const shop = await res.json();
      setShopState(shop.state || '');
    } catch {}
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return undefined;
    }
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PURCHASES_CACHE_KEY);
    if (cached?.purchases) {
      mergePurchasesWithPendingQueue(cached.purchases).then((mergedPurchases) => {
        setPurchases(mergedPurchases);
      });
      setSummary(cached.summary || {});
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.purchases));
      await fetchAll();
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [fetchAll, mergePurchasesWithPendingQueue, router]);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if (shopState || !localStorage.getItem('token')) return;
    fetchShopMeta();
  }, [fetchShopMeta, shopState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) {
      return undefined;
    }

    const handleSyncComplete = () => {
      fetchAll();
    };

    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, [fetchAll]);

  // â”€â”€ Item row handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    // Auto-fill price when product selected
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const updateNewProductForm = (patch) => setNewProductForm((current) => ({ ...current, ...patch }));

  const removeItem = (index) => {
    if (items.length === 1) return; // keep at least 1
    setItems(items.filter((_, i) => i !== index));
  };

  const resetInlineProductForm = () => {
    setShowInlineProductForm(false);
    setInlineProductRowIndex(0);
    setCreatingProduct(false);
    setNewProductForm({
      name: '',
      price: '',
      gst_rate: '0',
      unit: 'pcs',
      hsn_code: '',
    });
  };

  const openInlineProductForm = (rowIndex) => {
    setError('');
    setInlineProductRowIndex(rowIndex);
    setShowInlineProductForm(true);
    setNewProductForm({
      name: '',
      price: '',
      gst_rate: '0',
      unit: 'pcs',
      hsn_code: '',
    });
  };

  const createInlineProduct = async () => {
    if (!isOnline) {
      setError('Offline mode me naya product add nahi ho sakta. Internet on karke try karein.');
      return;
    }

    if (!newProductForm.name.trim()) {
      setError('Product name required hai');
      return;
    }

    const sellingPrice = Number(newProductForm.price);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setError('Valid selling price dijiye');
      return;
    }

    const purchasePrice = Number(items[inlineProductRowIndex]?.price_per_unit || 0);
    setCreatingProduct(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: newProductForm.name.trim(),
          price: sellingPrice,
          cost_price: Number.isFinite(purchasePrice) ? purchasePrice : 0,
          quantity: 0,
          unit: newProductForm.unit || 'pcs',
          hsn_code: newProductForm.hsn_code || '',
          gst_rate: Number(newProductForm.gst_rate || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Product create nahi ho paaya');
        setCreatingProduct(false);
        return;
      }

      const nextProducts = [...products, data].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setProducts(nextProducts);
      await cacheProducts(nextProducts);
      updateItem(inlineProductRowIndex, 'product_id', data._id);
      resetInlineProductForm();
    } catch {
      setError('Product create karte waqt server error aayi');
      setCreatingProduct(false);
      return;
    }

    setCreatingProduct(false);
  };

  // â”€â”€ GST calculation per row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const calcRowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    const isIGST = normalizeState(shopState) && normalizeState(form.supplier_state)
      ? normalizeState(shopState) !== normalizeState(form.supplier_state)
      : false;
    return {
      taxable,
      gst_rate,
      gst,
      total: taxable + gst,
      half_gst: gst / 2,
      isIGST,
    };
  };

  // â”€â”€ Bill totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const billTotals = items.reduce((acc, item) => {
    const g = calcRowGST(item);
    if (!g) return acc;
    return {
      taxable: acc.taxable + g.taxable,
      gst: acc.gst + g.gst,
      total: acc.total + g.total,
    };
  }, { taxable: 0, gst: 0, total: 0 });

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill = getRoundedBillValues(billTotals.total);
  const gstinValue = normalizeGstin(form.supplier_gstin);
  const gstinComplete = gstinValue.length === GSTIN_LENGTH;
  const gstinValid = !gstinValue || (gstinComplete && GSTIN_REGEX.test(gstinValue));
  const showGstinError = gstinTouched && gstinComplete && !gstinValid;
  const showGstinLengthHint = gstinTouched && !!gstinValue && !gstinComplete;
  const handleSupplierGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    updateForm({
      supplier_gstin: normalized,
      ...(detectedState ? { supplier_state: detectedState } : {}),
    });
    setGstinTouched(Boolean(normalized));
  };
  const wizardSteps = [
    { title: 'Items', copy: 'Purchase items' },
    { title: 'Payment', copy: 'Credit or cash' },
    { title: 'Supplier', copy: 'Supplier and GST' },
  ];

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setGstinTouched(true);

    if (form.payment_type === 'credit' && !form.supplier_name) {
      setError('Supplier name is required for credit purchases');
      return;
    }
    if (!gstinValid) {
      setError('Invalid GSTIN format');
      return;
    }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) {
      setError('Select at least one product');
      return;
    }

    setSubmitting(true);

    if (!isOnline) {
      try {
        const offlineItems = buildOfflinePurchaseItems(validItems, products);
        const payload = {
          items: offlineItems,
          payment_type: form.payment_type,
          amount_paid: form.payment_type === 'credit'
            ? (amountPaidNum || 0)
            : billTotals.total,
          supplier_name: form.supplier_name,
          supplier_phone: form.supplier_phone,
          supplier_gstin: gstinValue,
          supplier_address: form.supplier_address,
          supplier_state: form.supplier_state,
          purchase_date: form.purchase_date,
          notes: form.notes,
        };

        const operation = await queuePurchase(payload, offlineItems);
        if (!operation) {
          throw new Error('Unable to save purchase offline');
        }

        resetModal();

        setPurchases(prev => [{
          _id: operation.id,
          invoice_number: operation.tempId,
          items: offlineItems.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price_per_unit: item.price_per_unit,
            total_amount: Number(item.quantity) * Number(item.price_per_unit),
          })),
          product_name: offlineItems[0]?.product_name || 'Product',
          total_amount: billTotals.total,
          taxable_amount: billTotals.taxable,
          total_gst: billTotals.gst,
          amount_paid: form.payment_type === 'credit'
            ? amountPaidNum
            : billTotals.total,
          balance_due: form.payment_type === 'credit'
            ? balanceDue
            : 0,
          payment_type: form.payment_type,
          supplier_name: form.supplier_name,
          supplier_phone: form.supplier_phone,
          createdAt: getPurchaseRecordDateISO(form.purchase_date),
          _isOffline: true,
        }, ...prev]);

      } catch (err) {
        setError('Offline save failed: ' + (err?.message || 'Unknown error'));
      }
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        items: validItems,
        payment_type: form.payment_type,
        amount_paid: form.payment_type === 'credit' ? (amountPaidNum || 0) : billTotals.total,
        supplier_name: form.supplier_name,
        supplier_phone: form.supplier_phone,
        supplier_gstin: gstinValue,
        supplier_address: form.supplier_address,
        supplier_state: form.supplier_state,
        purchase_date: form.purchase_date,
        notes: form.notes,
      };

      const isEditing = Boolean(editingPurchaseId);
      const res = await fetch(
        isEditing ? apiUrl(`/api/purchases/${editingPurchaseId}`) : apiUrl('/api/purchases'),
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        setItems([emptyItem()]);
        setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '', purchase_date: getDefaultPurchaseDateValue() });
        setGstinTouched(false);
        fetchPurchases();
      } else {
        setError(data.message || 'Request failed');
      }
    } catch {
      setError('Server error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (purchase) => {
    if (purchase?._isOffline) {
      if (!confirm('Is pending offline purchase ko local queue se hatana hai?')) return;

      const removed = await removeQueuedOperation(purchase._id);
      if (!removed) {
        setError('Pending offline purchase remove nahi ho paayi');
        return;
      }

      setPurchases((current) => current.filter((entry) => entry._id !== purchase._id));
      setError('');
      return;
    }

    if (!confirm('Delete this purchase? Stock will be restored.')) return;
    try {
      await fetch(apiUrl(`/api/purchases/${purchase._id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchPurchases();
    } catch { setError('Could not delete purchase'); }
  };

  const sendPurchaseWhatsApp = (purchase) => {
    const phone = cleanPhone(purchase.supplier_phone || '');
    if (!phone) {
      setError('Supplier phone number is missing');
      return;
    }
    setError('');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(buildPurchaseWhatsAppMessage(purchase))}`, '_blank');
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

  const resetModal = () => {
    setEditingPurchaseId('');
    setShowModal(false);
    setError('');
    setItems([emptyItem()]);
    setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '', purchase_date: getDefaultPurchaseDateValue() });
    setGstinTouched(false);
    resetInlineProductForm();
  }

  const startEditPurchase = (purchase) => {
    if (purchase._isOffline) {
      setError('Yeh entry abhi sync nahi hui — internet aane pe edit kar sakte hain');
      return;
    }

    const sourceItems = purchase.items && purchase.items.length > 0
      ? purchase.items
      : [{
          product: purchase.product,
          quantity: purchase.quantity,
          price_per_unit: purchase.price_per_unit,
        }];

    setEditingPurchaseId(purchase._id);
    setItems(sourceItems.map((item) => ({
      product_id: item.product?._id || item.product || '',
      quantity: item.quantity || 1,
      price_per_unit: item.price_per_unit || '',
    })));
    setForm({
      payment_type: purchase.payment_type || 'cash',
      amount_paid: purchase.payment_type === 'credit' ? String(purchase.amount_paid || '') : '',
      supplier_name: purchase.supplier_name || '',
      supplier_phone: purchase.supplier_phone || '',
      supplier_gstin: purchase.supplier_gstin || '',
      supplier_address: purchase.supplier_address || '',
      supplier_state: purchase.supplier_state || '',
      notes: purchase.notes || '',
      purchase_date: formatDateInputValue(purchase.createdAt || purchase.purchased_at || new Date()),
    });
    setGstinTouched(false);
    setError('');
    setShowModal(true);
  };

  const PayBadge = ({ type }) => {
    const s = PAY_BADGE[type] || PAY_BADGE.cash;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>{s.label}</span>;
  };

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
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
        <div className="relative overflow-hidden mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50/40 to-blue-50/40 p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-12 -right-8 w-40 h-40 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                Purchase Hub
              </span>
              <h1 className="mt-2.5 text-[22px] font-black text-slate-900 leading-tight tracking-tight">
                Purchases / खरीदिए
              </h1>
              <p className="mt-1 text-[13px] text-slate-500">
                Supplier bills, ITC, and payable balance in the same visual flow as sales.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/purchases/suppliers"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 shadow-sm hover:-translate-y-px hover:shadow-md transition-all"
              >
                सप्लायर लिस्ट
              </Link>
              <button
                type="button"
                onClick={() => { resetModal(); setShowModal(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
              >
                + New Purchase
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

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: 'Total Spend', value: `₹${fmt(totalSpendDisplay)}`, cls: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Input GST', value: `₹${fmt(totalItcDisplay)}`, cls: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Balance Due', value: `₹${fmt(totalDueDisplay)}`, cls: totalDueDisplay > 0 ? 'text-rose-700' : 'text-emerald-700', bg: totalDueDisplay > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200' },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} border rounded-2xl p-3 shadow-sm`}>
              <div className={`text-[18px] sm:text-[20px] font-black leading-none ${k.cls}`}>{k.value}</div>
              <div className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{k.label}</div>
              {k.label === 'Balance Due' && totalDueDisplay > 0 && (
                <button type="button" onClick={focusPendingPurchase} className="mt-2 text-[11px] font-black text-cyan-600 hover:text-cyan-700">
                  Pay Now
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm mb-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              placeholder="Search bill, supplier, phone or product..."
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <input
              className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all sm:w-40"
              type="month"
              value={billMonth}
              onChange={(e) => setBillMonth(e.target.value)}
            />
            {hasBillFilters && (
              <button
                type="button"
                onClick={() => { setBillSearch(''); setBillMonth(''); }}
                className="h-10 px-4 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
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
              <div key={index} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">📦</div>
            <div className="text-[15px] font-bold text-slate-700 mb-1">
              {hasBillFilters ? 'No purchases found for this search/filter.' : 'No purchases yet.'}
            </div>
            <div className="text-[12px] text-slate-400 mb-5">
              Add your first supplier bill to start tracking stock cost and ITC.
            </div>
            {!hasBillFilters && (
              <button
                type="button"
                onClick={() => { resetModal(); setShowModal(true); }}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:shadow-lg transition-all"
              >
                Record Purchase
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPurchases.map((p) => {
              const meta = p._isOffline ? getOfflineBadgeMeta(p._queueStatus) : null;
              const isHighlighted = highlightedPurchaseId === p._id;
              const itemLabel = p.items && p.items.length > 1 ? `${p.items.length} products` : p.product_name;
              const itemNames = p.items && p.items.length > 1 ? p.items.map((item) => item.product_name).join(', ') : p.product_name;

              return (
                <div
                  key={p._id}
                  data-purchase-anchor={p._id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${p._isOffline ? 'border-amber-200' : 'border-slate-200'} ${isHighlighted ? 'ring-2 ring-cyan-300 shadow-lg shadow-cyan-100/70' : 'hover:shadow-md'}`}
                >
                  {meta && (
                    <div className={`flex items-center gap-2 px-4 py-2 border-b text-[11px] font-black ${meta.color}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {meta.label}
                      {p._queueError && <span className="font-normal text-rose-600 ml-1">{p._queueError}</span>}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <div className="text-[14px] font-black text-slate-900 truncate">{itemLabel}</div>
                        <div className="font-mono text-[11px] text-cyan-600 mt-0.5">{p.invoice_number}</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-[18px] font-black text-slate-900">₹{fmt(p.total_amount)}</div>
                        <div className="mt-0.5"><PayBadge type={p.payment_type} /></div>
                      </div>
                    </div>

                    <div className="text-[12px] text-slate-500 mb-3">
                      {p.supplier_name ? `Supplier: ${p.supplier_name}` : 'Supplier not added'}
                      {' • '}
                      {formatFullDateTime(p.createdAt || p.purchased_at)}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
                        {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-600">
                        ITC ₹{fmt(p.total_gst)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${(p.balance_due || 0) > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                        {(p.balance_due || 0) > 0 ? `Due ₹${fmt(p.balance_due)}` : 'Paid'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                        <div className="text-slate-400">Taxable</div>
                        <div className="font-black text-slate-900">₹{fmt(p.taxable_amount)}</div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                        <div className="text-slate-400">Paid</div>
                        <div className="font-black text-emerald-600">₹{fmt(p.amount_paid)}</div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                        <div className="text-slate-400">GST</div>
                        <div className="font-black text-blue-600">₹{fmt(p.total_gst)}</div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                        <div className="text-slate-400">Items</div>
                        <div className="font-black text-slate-900 truncate">{itemNames}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => sendPurchaseWhatsApp(p)}
                        disabled={!p.supplier_phone}
                        className="py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditPurchase(p)}
                        disabled={Boolean(p._isOffline)}
                        className="py-2 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="py-2 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        {p._isOffline ? 'Remove' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`fixed inset-0 z-[70] transition-all duration-300 ${showModal ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close purchase modal overlay"
          onClick={resetModal}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100dvh-56px)] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ${showModal ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>
          <div className="flex-shrink-0 border-b border-slate-100 px-5 pt-3 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {editingPurchaseId ? 'Edit Purchase' : 'New Purchase'}
                </p>
                <h3 className="text-[20px] font-black text-slate-900 mt-0.5">Record Purchase</h3>
                <p className="text-[12px] text-slate-500 mt-1">Ek hi compact form me items, payment aur supplier details.</p>
              </div>
              <button
                type="button"
                onClick={resetModal}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Close purchase modal"
              >
                ×
              </button>
            </div>
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { type: 'cash', label: 'Cash', active: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' },
                { type: 'credit', label: 'Credit', active: 'bg-rose-500 text-white shadow-md shadow-rose-500/20' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => updateForm({ payment_type: opt.type, amount_paid: opt.type === 'credit' ? form.amount_paid : '' })}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-black tracking-wide transition-all ${form.payment_type === opt.type ? opt.active : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
                <span className="text-base leading-none">!</span>
                <span>{error}</span>
              </div>
            )}

            <div className={`rounded-2xl border p-4 ${form.payment_type === 'credit' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-black text-slate-900">Supplier Info</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {form.payment_type === 'credit' ? 'Required for credit purchases' : 'Optional details for supplier record'}
                  </p>
                </div>
                {form.payment_type === 'credit' && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-[10px] font-black text-rose-700 border border-rose-200">Required *</span>
                )}
              </div>

              <div className="space-y-3">
                <input className={INPUT} placeholder="Supplier ka naam" value={form.supplier_name} onChange={(e) => updateForm({ supplier_name: e.target.value })} required={form.payment_type === 'credit'} />
                <div className="grid grid-cols-2 gap-3">
                  <input className={INPUT} placeholder="Mobile number" value={form.supplier_phone} onChange={(e) => updateForm({ supplier_phone: e.target.value })} />
                  <div>
                    <input className={INPUT} placeholder="Supplier GSTIN" value={form.supplier_gstin} maxLength={GSTIN_LENGTH} onChange={(e) => handleSupplierGstinChange(e.target.value)} onBlur={() => setGstinTouched(true)} />
                    {showGstinError && <p className="mt-1 text-[11px] font-semibold text-rose-600">Invalid GSTIN format</p>}
                    {showGstinLengthHint && <p className="mt-1 text-[11px] text-slate-400">GSTIN should be 15 characters</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className={INPUT} type="date" value={form.purchase_date} onChange={(e) => updateForm({ purchase_date: e.target.value })} />
                  <div>
                    <select className={INPUT} value={form.supplier_state} onChange={(e) => updateForm({ supplier_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="States">{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label="Union Territories">{UTS.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                    </select>
                    {gstinValid && gstinValue.length >= 2 && form.supplier_state && <p className="mt-1 text-[11px] font-semibold text-emerald-600">State auto-detected from GSTIN</p>}
                  </div>
                </div>
                <input className={INPUT} placeholder="Supplier address" value={form.supplier_address} onChange={(e) => updateForm({ supplier_address: e.target.value })} />
                <input className={INPUT} placeholder="Any notes..." value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-3">
                {items.map((item, index) => {
                  const rowGST = calcRowGST(item);
                  const prod = products.find((p) => p._id === item.product_id);

                  return (
                    <div key={index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Item {index + 1}</span>
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => openInlineProductForm(index)} className="px-2.5 py-1 rounded-lg border border-cyan-200 bg-cyan-50 text-[10px] text-cyan-700 hover:bg-cyan-100 transition-colors">+ New Product</button>
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(index)} className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] text-rose-600 hover:bg-rose-100 transition-colors">Remove</button>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Product</p>
                        <SearchableProductSelect products={products} value={item.product_id} onChange={(id) => updateItem(index, 'product_id', id)} placeholder="Search product..." />
                      </div>

                      {showInlineProductForm && inlineProductRowIndex === index && (
                        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 space-y-3">
                          <p className="text-[13px] font-black text-cyan-700">Naya product yahin add karein</p>
                          <input className={INPUT} placeholder="Jaise: New Chips 45g" value={newProductForm.name} onChange={(e) => updateNewProductForm({ name: e.target.value })} />
                          <div className="grid grid-cols-2 gap-3">
                            <input className={INPUT} type="number" min="0" step="0.01" placeholder="MRP / selling price" value={newProductForm.price} onChange={(e) => updateNewProductForm({ price: e.target.value })} />
                            <select className={INPUT} value={newProductForm.gst_rate} onChange={(e) => updateNewProductForm({ gst_rate: e.target.value })}>
                              {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input className={INPUT} placeholder="pcs / box / kg" value={newProductForm.unit} onChange={(e) => updateNewProductForm({ unit: e.target.value })} />
                            <input className={INPUT} placeholder="Optional HSN" value={newProductForm.hsn_code} onChange={(e) => updateNewProductForm({ hsn_code: e.target.value })} />
                          </div>
                          <div className="flex gap-3">
                            <button type="button" onClick={createInlineProduct} disabled={creatingProduct} className="flex-1 py-3 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:shadow-lg disabled:opacity-60 transition-all">{creatingProduct ? 'Adding...' : 'Save Product'}</button>
                            <button type="button" onClick={resetInlineProductForm} disabled={creatingProduct} className="px-4 py-3 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-white transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Qty</p>
                          <input className={INPUT} type="number" min="1" placeholder="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} required />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cost Price (₹)</p>
                          <input className={INPUT} type="number" step="0.01" placeholder="0.00" value={item.price_per_unit} onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>

                      {prod && <div className="text-[11px] text-slate-500">GST {prod.gst_rate || 0}% {prod.hsn_code ? `• HSN ${prod.hsn_code}` : ''} {prod.unit ? `• ${prod.unit}` : ''}</div>}

                      {rowGST && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-100 text-[11px]">
                          <span className="text-slate-400">₹{fmt(rowGST.taxable)} + <span className="text-amber-600">₹{fmt(rowGST.gst)} GST</span></span>
                          <span className="font-black text-slate-900">= ₹{fmt(rowGST.total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={addItem} className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-400 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/40 transition-all">
                + Add Another Product
              </button>
            </div>

            {form.payment_type === 'credit' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                <p className="text-[13px] font-black text-slate-900 mb-0.5">Advance Payment</p>
                <p className="text-[11px] text-slate-400 mb-3">Supplier ko abhi kitna payment diya?</p>
                <input className="h-11 w-full px-4 rounded-xl border border-rose-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all" type="number" step="0.01" min="0" placeholder={`Max ₹${fmt(billTotals.total)}`} value={form.amount_paid} onChange={(e) => updateForm({ amount_paid: e.target.value })} />
                <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-100 border border-rose-200">
                  <span className="text-[12px] font-bold text-rose-700">Balance Due</span>
                  <span className="text-[16px] font-black text-rose-700">₹{fmt(balanceDue)}</span>
                </div>
              </div>
            )}

            {billTotals.total > 0 && (
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-[12px]"><span className="text-slate-400">Taxable Amount</span><span className="font-bold text-white">₹{fmt(billTotals.taxable)}</span></div>
                  <div className="flex justify-between text-[12px]"><span className="text-slate-400">Total GST / ITC</span><span className="font-bold text-amber-400">₹{fmt(billTotals.gst)}</span></div>
                  <div className="flex justify-between text-[12px]"><span className="text-slate-400">Round Off</span><span className="font-bold text-emerald-400">{roundedBill.roundOff >= 0 ? '+' : ''}₹{fmt(roundedBill.roundOff)}</span></div>
                </div>
                <div className="flex justify-between items-baseline border-t border-slate-700 pt-3">
                  <span className="text-[14px] font-black">Grand Total</span>
                  <span className="text-[24px] font-black text-cyan-400">₹{fmt(billTotals.total)}</span>
                </div>
                {form.payment_type === 'credit' && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
                    <span className="text-[12px] text-rose-300">Balance Due</span>
                    <span className="text-[14px] font-black text-rose-400">₹{fmt(balanceDue)}</span>
                  </div>
                )}
              </div>
            )}

          </form>

          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <div className="flex gap-3">
              <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all">
                {submitting ? 'Saving...' : !isOnline ? 'Offline Save' : editingPurchaseId ? 'Update Purchase' : form.payment_type === 'credit' ? 'Credit Purchase' : 'Record Purchase'}
              </button>
              <button type="button" onClick={resetModal} className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
