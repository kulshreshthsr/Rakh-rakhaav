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
const monthInputWrapStyle = { position: 'relative', minWidth: 180 };
const monthInputHintStyle = {
  position: 'absolute',
  left: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#9ca3af',
  fontSize: 14,
  pointerEvents: 'none',
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
    return { label: 'Syncing...', background: '#dbeafe', color: '#1d4ed8' };
  }
  if (status === 'failed') {
    return { label: 'Sync failed', background: '#fee2e2', color: '#b91c1c' };
  }
  if (status === 'abandoned') {
    return { label: 'Sync retry needed', background: '#fde68a', color: '#92400e' };
  }
  return { label: 'Sync pending', background: '#f59e0b', color: '#000' };
};

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
  const [purchaseStep, setPurchaseStep] = useState(0);
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
    setPurchaseStep(0);
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
    setPurchaseStep(0);
    setGstinTouched(false);
    setError('');
    setShowModal(true);
  };

  // â”€â”€ Payment type badge helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const PayBadge = ({ type }) => {
    const map = {
      cash:   { bg: '#dcfce7', color: '#166534', label: 'Cash' },
      credit: { bg: '#fee2e2', color: '#991b1b', label: 'Credit' },
      upi:    { bg: '#ecfeff', color: '#0f766e', label: 'UPI' },
      bank:   { bg: '#dbeafe', color: '#1e40af', label: 'Bank' },
    };
    const s = map[type] || map.cash;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
        {s.label}
      </span>
    );
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
      <div className="page-shell purchases-shell">
        <section className="hero-panel purchases-hero">
          <div className="page-toolbar items-center gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">Stock inward</p>
              <div className="page-title">Purchases</div>
              {refreshing ? <p className="rr-meta-line">Refreshing purchase data…</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/purchases/suppliers" className="btn-ghost w-auto shrink-0 px-3 py-2 text-[12px] sm:px-4 sm:py-2.5 sm:text-[13px]">
                Suppliers
              </Link>
              <button type="button" onClick={() => { resetModal(); setShowModal(true); }} className="btn-primary w-auto shrink-0 px-3 py-2 text-[12px] sm:px-4 sm:py-2.5 sm:text-[13px]">
                + Purchase
              </button>
            </div>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Total Spend</div>
            <div className="metric-value" style={{ color: '#b45309' }}>₹{totalSpendDisplay.toFixed(2)}</div>
            <div className="metric-note">Purchase outflow</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Input GST</div>
            <div className="metric-value" style={{ color: '#1d4ed8' }}>₹{totalItcDisplay.toFixed(2)}</div>
            <div className="metric-note">ITC available</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Balance Due</div>
            <div className="metric-value" style={{ color: totalDueDisplay > 0 ? '#dc2626' : '#0f766e' }}>₹{totalDueDisplay.toFixed(2)}</div>
            <div className="metric-note">Supplier credit outstanding</div>
            {totalDueDisplay > 0 ? (
              <button
                type="button"
                onClick={focusPendingPurchase}
                style={{ marginTop: 10, padding: 0, border: 'none', background: 'none', color: '#0891b2', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                Pay Now
              </button>
            ) : null}
          </div>
        </section>

        {pendingOfflinePurchases.length > 0 ? (
          <div className="rr-banner-warn" role="status">
            <strong>{pendingOfflinePurchases.length} offline purchase{pendingOfflinePurchases.length > 1 ? 's' : ''} pending</strong>
            <div>
              Ye purchase entries local queue me saved hain. Internet aate hi sync ho jayengi. Pending entries ko ab remove bhi kar sakte ho.
            </div>
          </div>
        ) : null}

        <div className="toolbar-card">
          <div className="toolbar">
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Search bill, supplier, phone or product..."
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
            />
            <div style={monthInputWrapStyle}>
              {!billMonth ? <span style={monthInputHintStyle}>Select month and year</span> : null}
              <input
                className="form-input"
                style={{ minWidth: 180, position: 'relative', background: 'transparent' }}
                type="month"
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
              />
            </div>
            {hasBillFilters ? (
              <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => { setBillSearch(''); setBillMonth(''); }}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {error && !showModal && (
          <div className="alert-error">
          {error}
          </div>
        )}

        {loading ? (
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">PO</div>
            <div>{hasBillFilters ? 'No purchases found for this search/filter.' : 'No purchases yet.'}</div>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="table-container hidden min-[641px]:block">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Product</th>
                  <th>Items</th>
                  <th>Taxable</th>
                  <th>GST (ITC)</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Payment</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(p => (
                  <tr
                    key={p._id}
                    data-purchase-anchor={p._id}
                    className={highlightedPurchaseId === p._id ? 'purchase-row-highlight' : ''}
                  >
                    <td style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>
                      {p.invoice_number}
                      {p._isOffline && (
                        (() => {
                          const badge = getOfflineBadgeMeta(p._queueStatus);
                          return (
                        <span style={{
                          display: 'block',
                          fontSize: 9,
                          background: badge.background,
                          color: badge.color,
                          padding: '1px 6px',
                          borderRadius: 20,
                          fontWeight: 700,
                          marginTop: 2,
                        }}>
                          {badge.label}
                        </span>
                          );
                        })()
                      )}
                      {p._isOffline && p._queueError ? (
                        <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 4, maxWidth: 160 }}>
                          {p._queueError}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                        {/* Show all item names if multi-item */}
                        {p.items && p.items.length > 1
                          ? p.items.map(i => i.product_name).join(', ')
                          : p.product_name}
                      </div>
                      {p.supplier_name && (
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Supplier: {p.supplier_name}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>
                      {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
                    </td>
                    <td>₹{(p.taxable_amount || 0).toFixed(2)}</td>
                    <td>
                      {p.total_gst > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>₹{p.total_gst.toFixed(2)}</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>â€”</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>₹{(p.total_amount || 0).toFixed(2)}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>₹{(p.amount_paid || 0).toFixed(2)}</td>
                    <td>
                      {(p.balance_due || 0) > 0
                        ? <span style={{ color: '#ef4444', fontWeight: 700 }}>₹{p.balance_due.toFixed(2)}</span>
                        : <span style={{ color: '#10b981' }}>Paid</span>}
                    </td>
                    <td><PayBadge type={p.payment_type} /></td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>
                      {formatFullDateTime(p.createdAt)}
                    </td>
                    <td>
                      {p.supplier_phone ? (
                        <button
                          onClick={() => sendPurchaseWhatsApp(p)}
                          className="action-soft whatsapp"
                          style={{ borderRadius: 999, padding: '6px 10px', marginRight: 6, background: '#25D366', color: '#ffffff', borderColor: '#25D366' }}
                        >
                          WhatsApp
                        </button>
                      ) : null}
                      <button onClick={() => startEditPurchase(p)}
                        disabled={Boolean(p._isOffline)}
                        className="action-soft edit"
                        style={{ borderRadius: 999, padding: '6px 10px', opacity: p._isOffline ? 0.55 : 1, cursor: p._isOffline ? 'not-allowed' : 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p)}
                        className="action-soft delete"
                        style={{ borderRadius: 999, padding: '6px 10px' }}>
                        {p._isOffline ? 'Remove' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 min-[641px]:hidden">
            {filteredPurchases.map(p => (
              <div key={p._id} className="card"
                data-purchase-anchor={p._id}
                style={{
                  borderLeft: `3px solid ${p.payment_type === 'credit' ? '#ef4444' : '#f59e0b'}`,
                  boxShadow: highlightedPurchaseId === p._id ? '0 0 0 2px rgba(8, 145, 178, 0.22), 0 18px 32px rgba(8, 145, 178, 0.12)' : undefined,
                  transition: 'box-shadow 0.2s ease',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                      {p.items && p.items.length > 1
                        ? `${p.items.length} products`
                        : p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{p.invoice_number}</div>
                    {p._isOffline && (
                      (() => {
                        const badge = getOfflineBadgeMeta(p._queueStatus);
                        return (
                      <span style={{
                        display: 'block',
                        fontSize: 9,
                        background: badge.background,
                        color: badge.color,
                        padding: '1px 6px',
                        borderRadius: 20,
                        fontWeight: 700,
                        marginTop: 2,
                      }}>
                        {badge.label}
                      </span>
                        );
                      })()
                    )}
                    {p._isOffline && p._queueError ? (
                      <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 4, maxWidth: 180 }}>
                        {p._queueError}
                      </div>
                    ) : null}
                    {p.supplier_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>Supplier: {p.supplier_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>
                      ₹{(p.total_amount || 0).toFixed(2)}
                    </div>
                    <PayBadge type={p.payment_type} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>TAXABLE</div><div style={{ fontWeight: 600, fontSize: 13 }}>₹{(p.taxable_amount || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>ITC</div><div style={{ fontWeight: 600, fontSize: 13, color: '#0891b2' }}>₹{(p.total_gst || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>PAID</div><div style={{ fontWeight: 600, fontSize: 13, color: '#10b981' }}>₹{(p.amount_paid || 0).toFixed(2)}</div></div>
                  {(p.balance_due || 0) > 0 && (
                    <div><div style={{ fontSize: 11, color: '#9ca3af' }}>DUE</div><div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>₹{p.balance_due.toFixed(2)}</div></div>
                  )}
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>DATE</div><div style={{ fontWeight: 600, fontSize: 13 }}>{formatFullDateTime(p.createdAt)}</div></div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  {p.supplier_phone ? (
                    <button onClick={() => sendPurchaseWhatsApp(p)}
                      className="action-soft whatsapp"
                      style={{ width: '100%', padding: '9px', background: '#25D366', color: '#ffffff', borderColor: '#25D366' }}>
                      WhatsApp
                    </button>
                  ) : null}
                  <button onClick={() => startEditPurchase(p)}
                    disabled={Boolean(p._isOffline)}
                    className="action-soft edit"
                    style={{ width: '100%', padding: '9px', opacity: p._isOffline ? 0.55 : 1, cursor: p._isOffline ? 'not-allowed' : 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="action-soft delete"
                    style={{ width: '100%', padding: '9px', gridColumn: p.supplier_phone ? 'span 2 / span 2' : undefined }}>
                    {p._isOffline ? 'Remove' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}
      </div>

      {/* â”€â”€ Modal â”€â”€ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal flow-modal" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 0, color: '#0f172a' }}>
                Record Purchase
              </h3>
              <button type="button" className="modal-close-btn" onClick={resetModal} aria-label="Close record purchase modal">×</button>
            </div>
            {editingPurchaseId ? (
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, marginBottom: 10 }}>Editing existing purchase</div>
            ) : null}
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div className="flow-compact-note">
              Add products first, then choose payment and supplier details.
            </div>
            <form onSubmit={(e) => e.preventDefault()}>

              {/* Items */}
              <div className="flow-step-panel" style={{ display: purchaseStep === 0 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Products
                </div>

                {items.map((item, index) => {
                  const rowGST = calcRowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                            ×
                          </button>
                        )}
                      </div>

                      <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>Product *</label>
                          <button
                            type="button"
                            onClick={() => openInlineProductForm(index)}
                            style={{
                              border: 'none',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              padding: '6px 10px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            + New Product
                          </button>
                        </div>
                        <SearchableProductSelect
                          products={products}
                          value={item.product_id}
                          onChange={(id) => updateItem(index, 'product_id', id)}
                          placeholder='Search product...'
                        />
                      </div>

                      {showInlineProductForm && inlineProductRowIndex === index ? (
                        <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', marginBottom: 4 }}>
                            Naya product yahin add karein
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                            Opening stock 0 rahega. Is purchase ko save karte hi stock badh jayega.
                          </div>

                          <div className="form-group">
                            <label className="form-label">Product Name *</label>
                            <input
                              className="form-input"
                              placeholder="Jaise: New Chips 45g"
                              value={newProductForm.name}
                              onChange={(e) => updateNewProductForm({ name: e.target.value })}
                            />
                          </div>

                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Selling Price *</label>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="MRP / selling price"
                                value={newProductForm.price}
                                onChange={(e) => updateNewProductForm({ price: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">GST Rate</label>
                              <select
                                className="form-input"
                                value={newProductForm.gst_rate}
                                onChange={(e) => updateNewProductForm({ gst_rate: e.target.value })}
                              >
                                {[0, 5, 12, 18, 28].map((rate) => (
                                  <option key={rate} value={String(rate)}>{rate}%</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Unit</label>
                              <input
                                className="form-input"
                                placeholder="pcs / box / kg"
                                value={newProductForm.unit}
                                onChange={(e) => updateNewProductForm({ unit: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">HSN Code</label>
                              <input
                                className="form-input"
                                placeholder="Optional"
                                value={newProductForm.hsn_code}
                                onChange={(e) => updateNewProductForm({ hsn_code: e.target.value })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={createInlineProduct}
                              disabled={creatingProduct}
                              style={{
                                flex: 1,
                                border: 'none',
                                background: '#1d4ed8',
                                color: '#fff',
                                padding: '10px 12px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {creatingProduct ? 'Adding...' : 'Save Product'}
                            </button>
                            <button
                              type="button"
                              onClick={resetInlineProductForm}
                              disabled={creatingProduct}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#334155',
                                padding: '10px 12px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input className="form-input" type="number" min="1"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Purchase Price *</label>
                          <input className="form-input" type="number" step="0.01"
                            value={item.price_per_unit}
                            onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>

                      {prod ? (
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                          GST: {prod.gst_rate || 0}% {prod.hsn_code ? `• HSN ${prod.hsn_code}` : ''} {prod.unit ? `• ${prod.unit}` : ''}
                        </div>
                      ) : null}

                      {rowGST && (
                        <div style={{ fontSize: 12, color: '#6b7280', background: rowGST.gst_rate > 0 ? '#fffbeb' : '#f0fdf4', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <span>Taxable: <strong>₹{rowGST.taxable.toFixed(2)}</strong></span>
                          {rowGST.gst_rate > 0 ? (
                            <span>
                              {rowGST.isIGST
                                ? `IGST ${rowGST.gst_rate}%: ₹${rowGST.gst.toFixed(2)}`
                                : `CGST ${(rowGST.gst_rate / 2).toFixed(1)}% + SGST ${(rowGST.gst_rate / 2).toFixed(1)}%: ₹${rowGST.gst.toFixed(2)}`}
                            </span>
                          ) : (
                            <span>No GST</span>
                          )}
                          <span>Total: <strong>₹{rowGST.total.toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addItem}
                  className="btn-ghost"
                  style={{ width: '100%', marginTop: 4 }}
                >
                  + Add Another Product
                </button>

                {billTotals.total > 0 && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', marginTop: 14, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>Bill Summary</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal (Taxable):</span><strong>₹{billTotals.taxable.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Total GST (ITC):</span><strong style={{ color: '#1d4ed8' }}>₹{billTotals.gst.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Grand Total:</span><span>₹{billTotals.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="flow-step-panel" style={{ display: purchaseStep === 1 ? 'block' : 'none' }}>
                {billTotals.total > 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>Bill Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal (Taxable):</span><strong>₹{billTotals.taxable.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total GST (ITC):</span><strong style={{ color: '#1d4ed8' }}>₹{billTotals.gst.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Grand Total:</span><span>₹{billTotals.total.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Round Off:</span><strong>{roundedBill.roundOff >= 0 ? '+' : ''}₹{roundedBill.roundOff.toFixed(2)}</strong>
                    </div>
                    {form.supplier_state && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Tax Type:</span>
                        <strong>{normalizeState(shopState) !== normalizeState(form.supplier_state) ? 'IGST' : 'CGST + SGST'}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                      <span>Rounded Total:</span><span>₹{roundedBill.roundedTotal.toFixed(2)}</span>
                    </div>
                    {form.payment_type === 'credit' && amountPaidNum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 700 }}>
                        <span>Balance Due:</span><span>₹{balanceDue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
                )}
                <div className="flow-section-kicker"><span>Payment</span><span>Method + advance</span></div>
                <div className="form-group">
                  <label className="form-label">Payment Type *</label>
                  <div className="flow-choice-grid">
                    {[
                      { val: 'cash', label: 'Cash', color: '#10b981' },
                      { val: 'credit', label: 'Credit', color: '#ef4444' },
                      { val: 'upi', label: 'UPI', color: '#0891b2' },
                      { val: 'bank', label: 'Bank', color: '#3b82f6' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateForm({ payment_type: opt.val, amount_paid: opt.val === 'credit' ? form.amount_paid : '' })}
                        style={{
                          padding: '11px 10px',
                          borderRadius: 14,
                          border: '2px solid',
                          borderColor: form.payment_type === opt.val ? opt.color : '#e5e7eb',
                          background: form.payment_type === opt.val ? opt.color : '#f9fafb',
                          color: form.payment_type === opt.val ? '#fff' : '#374151',
                          fontWeight: 700,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.payment_type === 'credit' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="form-label">Advance Payment (optional)</label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      placeholder={`Max ₹${billTotals.total.toFixed(2)}`}
                      value={form.amount_paid}
                      onChange={e => updateForm({ amount_paid: e.target.value })} />
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 6, fontSize: 12, color: '#991b1b' }}>
                      Balance ₹{balanceDue.toFixed(2)} will be added to the supplier ledger automatically.
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier details */}

              <div className={`flow-step-panel ${form.payment_type === 'credit' ? 'is-warning' : ''}`} style={{ display: purchaseStep === 2 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.payment_type === 'credit' ? '#ef4444' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Supplier Details {form.payment_type === 'credit' ? '(required *)' : '(optional)'}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Supplier Name {form.payment_type === 'credit' && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                    <input className="form-input" placeholder="Supplier ka naam"
                      value={form.supplier_name}
                      onChange={e => updateForm({ supplier_name: e.target.value })}
                      required={form.payment_type === 'credit'} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="Mobile number"
                      value={form.supplier_phone}
                      onChange={e => updateForm({ supplier_phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN (optional)</label>
                      <input className="form-input" placeholder="Supplier GSTIN"
                        value={form.supplier_gstin}
                        maxLength={GSTIN_LENGTH}
                        onChange={e => handleSupplierGstinChange(e.target.value)}
                        onBlur={() => setGstinTouched(true)} />
                      {showGstinLengthHint && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>GSTIN should be 15 characters</div>
                      )}
                      {showGstinError && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Invalid GSTIN format</div>
                      )}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>GSTIN decides B2B classification</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.purchase_date}
                      onChange={e => updateForm({ purchase_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier State</label>
                    <select className="form-input" value={form.supplier_state}
                      onChange={e => updateForm({ supplier_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="States">
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                      <optgroup label="Union Territories">
                        {UTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                    </select>
                    {gstinValid && gstinValue.length >= 2 && form.supplier_state && (
                      <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>State auto-detected from GSTIN</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" placeholder="Supplier address"
                      value={form.supplier_address}
                      onChange={e => updateForm({ supplier_address: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Any notes..."
                    value={form.notes}
                    onChange={e => updateForm({ notes: e.target.value })} />
                </div>
              </div>

              {/* â”€â”€ SUBMIT â”€â”€ */}
              <div className="flow-actions">
                {purchaseStep > 0 && (
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setPurchaseStep((current) => current - 1)}>
                    Back
                  </button>
                )}
                {purchaseStep < 2 ? (
                  <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setPurchaseStep((current) => current + 1)}>
                    Continue
                  </button>
                ) : (
                <button type="button" onClick={handleSubmit} className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting
                    ? 'Saving...'
                    : !isOnline
                      ? '📥 Offline Save'
                      : editingPurchaseId
                        ? 'Update Purchase'
                        : form.payment_type === 'credit'
                          ? 'Credit Purchase'
                          : 'Record Purchase'}
                </button>
                )}
                <button type="button" onClick={resetModal}
                  style={{ flex: 1, padding: '10px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}

