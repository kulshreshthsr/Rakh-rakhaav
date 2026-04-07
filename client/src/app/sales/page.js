'use client';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { useAppLocale } from '../../components/AppLocale';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { getDisplayQueue, queueSale, removeQueuedOperation } from '../../lib/offlineQueue';
import { cacheProducts, getCachedProducts } from '../../lib/offlineDB';
import { apiUrl } from '../../lib/api';

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
  return [
    sale.invoice_number,
    sale.product_name,
    sale.buyer_name,
    sale.buyer_phone,
    sale.notes,
    itemNames,
  ].join(' ').toLowerCase();
};
const buildInitialForm = (overrides = {}) => ({
  payment_type: 'cash',
  amount_paid: '',
  buyer_name: '',
  buyer_phone: '',
  buyer_gstin: '',
  buyer_address: '',
  buyer_state: '',
  notes: '',
  sale_date: getDefaultSaleDateValue(),
  ...overrides,
});
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
const STATE_CODE_BY_NAME = {
  'andaman & nicobar islands': '35',
  'andhra pradesh': '37',
  'arunachal pradesh': '12',
  'assam': '18',
  'bihar': '10',
  'chandigarh': '04',
  'chhattisgarh': '22',
  'dadra & nagar haveli and daman & diu': '26',
  'delhi': '07',
  'goa': '30',
  'gujarat': '24',
  'haryana': '06',
  'himachal pradesh': '02',
  'jammu & kashmir': '01',
  'jharkhand': '20',
  'karnataka': '29',
  'kerala': '32',
  'ladakh': '38',
  'lakshadweep': '31',
  'madhya pradesh': '23',
  'maharashtra': '27',
  'manipur': '14',
  'meghalaya': '17',
  'mizoram': '15',
  'nagaland': '13',
  'odisha': '21',
  'puducherry': '34',
  'punjab': '03',
  'rajasthan': '08',
  'sikkim': '11',
  'tamil nadu': '33',
  'telangana': '36',
  'tripura': '16',
  'uttar pradesh': '09',
  'uttarakhand': '05',
  'west bengal': '19',
 };
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};
const QUICK_QUANTITY_OPTIONS = [1, 2, 5, 10];

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

const buildOfflineSaleItems = (rawItems, products) => (
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

//  WhatsApp message builder 
const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const payLabel =
    sale.payment_type === 'cash'   ? 'Cash (Paid)'   :
    sale.payment_type === 'upi'    ? 'UPI (Paid)'    :
    sale.payment_type === 'bank'   ? 'Bank Transfer' : 'Udhaar (Credit)';

  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) =>
        `  ${i + 1}. ${item.product_name} ₹ ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`
      ).join('\n')
    : `  1. ${sale.product_name} ₹ ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;

  const isIGST = sale.gst_type === 'IGST' ||
    (sale.items && sale.items.some(i => i.gst_type === 'IGST'));

  const gstLine = (sale.total_gst && sale.total_gst > 0)
    ? isIGST
      ? `IGST: ₹${fmt(sale.igst_amount)}`
      : `CGST: ₹${fmt(sale.cgst_amount)} | SGST: ₹${fmt(sale.sgst_amount)}`
    : `GST: NIL`;

  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer'
    ? `Namaste *${sale.buyer_name}* ji!\n\n`
    : '';
  const advancePaid = sale.payment_type === 'credit'
    ? parseFloat(sale.amount_paid || 0)
    : parseFloat(sale.total_amount || 0);
  const dueAmount = sale.payment_type === 'credit'
    ? Math.max(0, parseFloat(sale.total_amount || 0) - advancePaid)
    : 0;

  return [
    `${greeting}*Invoice / Bill Details*`,
    `--------------------`,
    `Shop: *${shopName || 'Rakh-Rakhaav'}*`,
    `Invoice No: *${sale.invoice_number}*`,
    `Date: ${saleDate}`,
    `--------------------`,
    `*Items:*`,
    itemLines,
    `--------------------`,
    `Taxable Amount: ₹${fmt(sale.taxable_amount)}`,
    gstLine,
    `*Total Amount: ₹${fmt(sale.total_amount)}*`,
    `--------------------`,
    `Payment: ${payLabel}`,
    `--------------------`,
    `Aapka business hamare liye bahut important hai!`,
    `Thank you for choosing *${shopName || 'Rakh-Rakhaav'}*.`,
    ``,
    `_Powered by Rakh-Rakhaav Business Manager_`,
  ].join('\n');
};

const buildWhatsAppShareMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const advancePaid = sale.payment_type === 'credit'
    ? parseFloat(sale.amount_paid || 0)
    : parseFloat(sale.total_amount || 0);
  const dueAmount = sale.payment_type === 'credit'
    ? Math.max(0, parseFloat(sale.total_amount || 0) - advancePaid)
    : 0;
  const payLabel =
    sale.payment_type === 'cash' ? 'Cash (Paid)' :
    sale.payment_type === 'upi' ? 'UPI (Paid)' :
    sale.payment_type === 'bank' ? 'Bank Transfer' : 'Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) =>
        `  ${i + 1}. ${item.product_name} x ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`
      ).join('\n')
    : `  1. ${sale.product_name} x ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;

  return [
    sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste ${sale.buyer_name} ji,` : 'Namaste,',
    '',
    `Invoice / Bill Details`,
    `Shop: ${shopName || 'Rakh-Rakhaav'}`,
    `Invoice No: ${sale.invoice_number}`,
    `Date: ${saleDate}`,
    `Items:`,
    itemLines,
    `Taxable Amount: ₹${fmt(sale.taxable_amount)}`,
    `GST: ₹${fmt(sale.total_gst)}`,
    `Total Amount: ₹${fmt(sale.total_amount)}`,
    `Payment: ${payLabel}`,
    ...(sale.payment_type === 'credit'
      ? [
          `Advance Payment: ₹${fmt(advancePaid)}`,
          `Udhaar / Due: ₹${fmt(dueAmount)}`,
        ]
      : []),
    '',
    `Thank you for choosing ${shopName || 'Rakh-Rakhaav'}`,
  ].join('\n');
};

export default function SalesPage() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const [sales, setSales]           = useState([]);
  const [summary, setSummary]       = useState({});
  const [products, setProducts]     = useState([]);
  const [shopName, setShopName]     = useState('');
  const [shopState, setShopState]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [editingSaleId, setEditingSaleId] = useState('');
  const [error, setError]           = useState('');
  const [items, setItems]           = useState([emptyItem()]);
  const [gstinTouched, setGstinTouched] = useState(false);
  const [form, setForm]             = useState(buildInitialForm());
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const [showMoreCustomerDetails, setShowMoreCustomerDetails] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const amountPaidInputRef = useRef(null);
  const buyerNameInputRef = useRef(null);
  const customerComboRef = useRef(null);
  const saleDateInputRef = useRef(null);
  const hasBootstrappedRef = useRef(false);

  const loadPendingOfflineSales = useCallback(async () => {
    try {
      const queueItems = await getDisplayQueue();

      if (!Array.isArray(queueItems) || queueItems.length === 0) {
        return [];
      }

      return queueItems
        .filter((operation) => operation?.type === 'CREATE_SALE')
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
            total_amount: taxableAmount + totalGst,
            taxable_amount: taxableAmount,
            total_gst: totalGst,
            payment_type: operation?.payload?.payment_type,
            buyer_name: operation?.payload?.buyer_name || 'Walk-in Customer',
            buyer_phone: operation?.payload?.buyer_phone,
            createdAt: operation?.createdAt || new Date().toISOString(),
            _isOffline: true,
          };
        });
    } catch {
      return [];
    }
  }, [products]);

  const mergeSalesWithPendingQueue = useCallback(async (nextSales) => {
    try {
      const pendingOfflineSales = await loadPendingOfflineSales();

      if (!pendingOfflineSales.length) {
        return nextSales;
      }

      const seenIds = new Set((nextSales || []).map((sale) => sale._id));
      const mergedOfflineSales = pendingOfflineSales.filter((sale) => !seenIds.has(sale._id));

      return [...mergedOfflineSales, ...(nextSales || [])].sort(
        (a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime()
      );
    } catch {
      return nextSales;
    }
  }, [loadPendingOfflineSales]);

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/sales'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      const nextSummary = data.summary || {};
      const mergedSales = await mergeSalesWithPendingQueue(nextSales);
      setSales(mergedSales);
      setSummary(nextSummary);
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
    if (hasBootstrappedRef.current) {
      return undefined;
    }
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(SALES_CACHE_KEY);
    if (cached?.sales) {
      mergeSalesWithPendingQueue(cached.sales).then((mergedSales) => {
        setSales(mergedSales);
      });
      setSummary(cached.summary || {});
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.sales));
      await fetchAll();
      await fetchProducts();
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [fetchAll, fetchProducts, mergeSalesWithPendingQueue, router]);

  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [fetchProducts, products.length, showModal]);

  useEffect(() => {
    if ((!showModal && !sales.length) || (shopName && shopState) || !localStorage.getItem('token')) return;
    fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(shop => {
        setShopName(shop.name || '');
        setShopState(shop.state || '');
      })
      .catch(() => {});
  }, [showModal, sales.length, shopName, shopState]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') !== '1' || params.get('payment') !== 'credit') return;
    setEditingSaleId('');
    setItems([emptyItem()]);
    setForm(buildInitialForm({
      payment_type: 'credit',
    }));
    setGstinTouched(false);
    setError('');
    setShowModal(true);
    router.replace('/sales');
  }, [router]);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.price || '';
    }
    setItems(updated);
  };

  const updateItemQuantityBy = (index, delta) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextQuantity = Math.max(1, Number(item.quantity || 1) + delta);
      return { ...item, quantity: nextQuantity };
    }));
  };

  const applyQuickQuantity = (index, quantity) => {
    updateItem(index, 'quantity', quantity);
  };

  const duplicateItem = (index) => {
    setItems((current) => {
      const source = current[index];
      if (!source) return current;
      const nextItems = [...current];
      nextItems.splice(index + 1, 0, { ...source });
      return nextItems;
    });
  };

  const handleProductSelect = (index, product) => {
    updateItem(index, 'product_id', product._id);
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, quantity: item.quantity || 1, price_per_unit: product.price || item.price_per_unit } : item
    )));
  };

  const addOrIncrementProduct = (product) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.product_id === product._id);
      if (existingIndex >= 0) {
        return current.map((item, itemIndex) => (
          itemIndex === existingIndex
            ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1), price_per_unit: item.price_per_unit || product.price || '' }
            : item
        ));
      }

      const emptyIndex = current.findIndex((item) => !item.product_id);
      if (emptyIndex >= 0) {
        return current.map((item, itemIndex) => (
          itemIndex === emptyIndex
            ? { ...item, product_id: product._id, quantity: item.quantity || 1, price_per_unit: product.price || item.price_per_unit }
            : item
        ));
      }

      return [...current, { product_id: product._id, quantity: 1, price_per_unit: product.price || '' }];
    });
  };

  const handleBarcodeDetected = (detectedCode) => {
    const barcode = normalizeBarcode(detectedCode);
    const matchedProduct = products.find((product) => normalizeBarcode(product.barcode) === barcode);

    if (!matchedProduct) {
      setError('Scanned barcode did not match any product.');
      return;
    }

    setError('');
    addOrIncrementProduct(matchedProduct);
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
    const isIGST = normalizeState(shopState) && normalizeState(form.buyer_state)
      ? normalizeState(shopState) !== normalizeState(form.buyer_state)
      : false;
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
    updateForm({
      buyer_gstin: normalized,
      ...(detectedState ? { buyer_state: detectedState } : {}),
    });
    setGstinTouched(Boolean(normalized));
  };
  const selectedItemsCount = items.filter((item) => item.product_id).length;

  function resetForm() {
    setEditingSaleId('');
    setItems([emptyItem()]);
    setForm(buildInitialForm());
    setGstinTouched(false);
    setError('');
    setCustomerQuery('');
    setShowCustomerSuggestions(false);
    setShowMoreCustomerDetails(false);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');
    setGstinTouched(true);
    if (form.payment_type === 'credit' && !form.buyer_name) {
      setError('Customer name is required for credit sales.');
      return;
    }
    if (!gstinValid) {
      setError('Invalid GSTIN format');
      return;
    }
    const validItems = items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) {
      setError('Select at least one product.');
      return;
    }
    for (const item of validItems) {
      const prod = products.find((p) => p._id === item.product_id);
      if (prod && Number(item.quantity) > (prod.quantity || 0)) {
        setError(prod.name + ': only ' + prod.quantity + ' items are available in stock.');
        return;
      }
    }
    setSubmitting(true);

    if (!isOnline) {
      if (editingSaleId) {
        setError('Editing existing sales requires internet connection.');
        setSubmitting(false);
        return;
      }

      try {
        const offlineItems = buildOfflineSaleItems(validItems, products);
        const operation = await queueSale(
          {
            ...form,
            buyer_gstin: gstinValue,
            sale_date: form.sale_date,
            amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total,
          },
          offlineItems
        );
        if (!operation) {
          throw new Error('Unable to save sale offline');
        }
        setShowModal(false);
        resetForm();
        setSales(prev => [{
          _id: operation.id,
          invoice_number: operation.tempId,
          items: offlineItems.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            total_amount: Number(item.quantity) * Number(item.price_per_unit),
          })),
          total_amount: billTotals.total,
          taxable_amount: billTotals.taxable,
          total_gst: billTotals.gst,
          payment_type: form.payment_type,
          buyer_name: form.buyer_name || 'Walk-in Customer',
          buyer_phone: form.buyer_phone,
          createdAt: getSaleRecordDateISO(form.sale_date),
          _isOffline: true,
        }, ...prev]);
      } catch (err) {
        setError('Offline save failed: ' + (err?.message || 'Unknown error'));
      }
      setSubmitting(false);
      return;
    }

    try {
      const isEditing = Boolean(editingSaleId);
      const res = await fetch(
        isEditing ? apiUrl(`/api/sales/${editingSaleId}`) : apiUrl('/api/sales'),
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            items: validItems,
            ...form,
            buyer_gstin: gstinValue,
            sale_date: form.sale_date,
            amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        if (isEditing && data?._id) {
          setSales((current) => current
            .map((sale) => (sale._id === data._id ? data : sale))
            .sort(
              (a, b) =>
                new Date(b.createdAt || b.sold_at || 0).getTime() -
                new Date(a.createdAt || a.sold_at || 0).getTime()
            ));
        }
        setShowModal(false);
        resetForm();
        fetchAll();
      } else {
        setError(data.message || 'Failed');
      }
    } catch {
      setError('Server error');
    }
    setSubmitting(false);
  }

  const handleShortcutSubmit = useEffectEvent(() => {
    handleSubmit();
  });

  const handleShortcutAddItem = useEffectEvent(() => {
    addItem();
  });

  useEffect(() => {
    if (!showModal) return undefined;
    const timeoutId = window.setTimeout(() => buyerNameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timeoutId);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onPointerDown = (event) => {
      if (customerComboRef.current && !customerComboRef.current.contains(event.target)) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;

    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
        event.preventDefault();
        handleShortcutSubmit();
      }

      if (event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        handleShortcutAddItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onPointerDown = (event) => {
      if (customerComboRef.current && !customerComboRef.current.contains(event.target)) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showModal]);

  async function handleSubmitLegacy(e) {
    return handleSubmit(e);
  }

  function resetFormLegacy() {
    setEditingSaleId('');
    setItems([emptyItem()]);
    setForm(buildInitialForm());
    setGstinTouched(false);
    setError('');
  }

  const startEditSale = (sale) => {
    if (sale?._isOffline) {
      setError('Pending offline sale sync hone se pehle edit nahi hogi. Zarurat ho to delete karke dobara save karein.');
      return;
    }

    const sourceItems = sale.items && sale.items.length > 0
      ? sale.items
      : [{
          product: sale.product,
          quantity: sale.quantity,
          price_per_unit: sale.price_per_unit,
        }];

    setEditingSaleId(sale._id);
    setItems(sourceItems.map((item) => ({
      product_id: item.product?._id || item.product || '',
      quantity: item.quantity || 1,
      price_per_unit: item.price_per_unit || '',
    })));
    setForm(buildInitialForm({
      payment_type: sale.payment_type || 'cash',
      amount_paid: sale.payment_type === 'credit' ? String(sale.amount_paid || '') : '',
      buyer_name: sale.buyer_name || '',
      buyer_phone: sale.buyer_phone || '',
      buyer_gstin: sale.buyer_gstin || '',
      buyer_address: sale.buyer_address || '',
      buyer_state: sale.buyer_state || '',
      notes: sale.notes || '',
      sale_date: formatDateInputValue(sale.createdAt || sale.sold_at) || getDefaultSaleDateValue(),
    }));
    setGstinTouched(false);
    setError('');
    setCustomerQuery(sale.buyer_name || '');
    setShowMoreCustomerDetails(Boolean(sale.buyer_gstin || sale.buyer_address || sale.buyer_state));
    setShowModal(true);
  };

  const handleDelete = async (sale) => {
    if (sale?._isOffline) {
      if (!confirm('Is pending offline sale ko local queue se hatana hai?')) return;

      const removed = await removeQueuedOperation(sale._id);
      if (!removed) {
        setError('Pending offline sale remove nahi ho paayi');
        return;
      }

      setSales((current) => current.filter((entry) => entry._id !== sale._id));
      setError('');
      return;
    }

    if (!confirm('Are you sure? Stock will also adjust.')) return;
    try {
      await fetch(apiUrl(`/api/sales/${sale._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchAll();
    } catch { setError('Delete failed'); }
  };

  const printInvoice = async (sale) => {
    if (sale?._isOffline) {
      setError('Pending offline sale ka invoice sync ke baad print hoga');
      return;
    }

    try {
      const shopRes = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const shop = await shopRes.json();
      generateInvoiceHTML(sale, shop, true);
    } catch { alert('Invoice could not be generated.'); }
  };

  // WhatsApp share: pure text, no API call, no PDF
  const shareWhatsApp = (sale) => {
    if (sale?._isOffline) {
      setError('Pending offline sale ko sync ke baad share karein');
      return;
    }

    const msg   = buildWhatsAppShareMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    // If phone number exists ₹ open direct chat, else ₹ open WhatsApp contact picker
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

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

  const pendingOfflineSales = sales.filter((sale) => sale?._isOffline);
  const offlineRevenue = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0);
  const offlineGst = pendingOfflineSales.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0);
  const revenueDisplay = Number(summary.totalRevenue || 0) + offlineRevenue;
  const gstDisplay = Number(summary.totalGST || 0) + offlineGst;
  const normalizedBillSearch = billSearch.trim().toLowerCase();
  const filteredSales = sales.filter((sale) => {
    const matchesSearch = !normalizedBillSearch || getSaleSearchText(sale).includes(normalizedBillSearch);
    const matchesMonth = !billMonth || getMonthFilterValue(sale.createdAt || sale.sold_at) === billMonth;
    return matchesSearch && matchesMonth;
  });
  const hasBillFilters = Boolean(normalizedBillSearch || billMonth);
  const pastCustomers = useMemo(() => {
    const seen = new Set();
    return sales
      .filter((s) => s.buyer_name && s.buyer_name !== 'Walk-in Customer' && s.buyer_phone)
      .filter((s) => {
        const key = s.buyer_phone;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => ({
        name: s.buyer_name,
        phone: s.buyer_phone,
        state: s.buyer_state || '',
        address: s.buyer_address || '',
        gstin: s.buyer_gstin || '',
      }));
  }, [sales]);
  const filteredPastCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return pastCustomers.slice(0, 5);
    return pastCustomers
      .filter((customer) => (
        customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query)
      ))
      .slice(0, 5);
  }, [customerQuery, pastCustomers]);
  const invoicePreview = editingSaleId
    ? (sales.find((sale) => sale._id === editingSaleId)?.invoice_number || 'Editing invoice')
    : `INV/${new Date().getFullYear().toString().slice(-2)}-${String(new Date().getFullYear() + 1).slice(-2)}/${String(sales.length + 1).padStart(4, '0')}`;

  const selectPastCustomer = (customer) => {
    updateForm({
      buyer_name: customer.name,
      buyer_phone: customer.phone,
      buyer_state: customer.state,
      buyer_address: customer.address,
      buyer_gstin: customer.gstin,
    });
    setCustomerQuery(customer.name);
    setShowCustomerSuggestions(false);
    setShowMoreCustomerDetails(Boolean(customer.gstin || customer.address || customer.state));
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 text-slate-900">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Sales</h1>
              <p className="text-xs text-slate-400">Billing &amp; Invoices</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`inline-flex h-11 items-center rounded-full border px-1 ${form.payment_type === 'credit' ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50'}`}>
                <button type="button" onClick={() => updateForm({ payment_type: 'cash', amount_paid: '' })} className={`h-9 rounded-full px-4 text-sm font-semibold ${form.payment_type === 'cash' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}>Cash</button>
                <button type="button" onClick={() => updateForm({ payment_type: 'credit' })} className={`h-9 rounded-full px-4 text-sm font-semibold ${form.payment_type === 'credit' ? 'bg-red-500 text-white' : 'text-slate-600'}`}>Credit</button>
              </div>
              <button type="button" onClick={() => { resetForm(); setShowModal(true); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-semibold text-white">✚ New Sale</button>
            </div>
          </header>
          <section className="-mx-1 mb-4 flex gap-3 overflow-x-auto px-1 pb-1">
            <div className="min-w-[180px] rounded-2xl border border-gray-200 border-l-4 border-l-teal-500 bg-white p-3 shadow-sm"><p className="text-xs text-slate-400">Revenue</p><p className="text-2xl font-bold">₹{fmt(revenueDisplay)}</p></div>
            <div className="min-w-[180px] rounded-2xl border border-gray-200 border-l-4 border-l-cyan-500 bg-white p-3 shadow-sm"><p className="text-xs text-slate-400">GST Collected</p><p className="text-2xl font-bold">₹{fmt(gstDisplay)}</p></div>
            <div className="min-w-[180px] rounded-2xl border border-gray-200 border-l-4 border-l-indigo-500 bg-white p-3 shadow-sm"><p className="text-xs text-slate-400">Total Invoices</p><p className="text-2xl font-bold">{filteredSales.length}</p></div>
          </section>

          <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-teal-500" placeholder="Search invoice, customer, phone, product..." value={billSearch} onChange={(e) => setBillSearch(e.target.value)} />
              <input className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-teal-500 sm:w-52" type="month" value={billMonth} onChange={(e) => setBillMonth(e.target.value)} />
              {hasBillFilters ? <button type="button" onClick={() => { setBillSearch(''); setBillMonth(''); }} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-slate-600">Clear</button> : null}
            </div>
          </section>

          <div className="grid gap-3">
            {loading ? Array.from({ length: 4 }).map((_, idx) => <div key={idx} className="h-16 animate-pulse rounded-2xl bg-white shadow-sm" />) : null}
            {!loading && filteredSales.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-slate-500">{hasBillFilters ? 'No sales found for this filter.' : 'No sales yet.'}</div> : null}
            {!loading && filteredSales.length > 0 ? (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-slate-400">
                      <tr><th className="px-3 py-3 text-left">Invoice No</th><th className="px-3 py-3 text-left">Customer</th><th className="px-3 py-3 text-left">Items</th><th className="px-3 py-3 text-left">Taxable</th><th className="px-3 py-3 text-left">GST</th><th className="px-3 py-3 text-left">Total</th><th className="px-3 py-3 text-left">Payment</th><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((s) => (
                        <tr key={s._id} className="border-t border-gray-100">
                          <td className="px-3 py-3 align-top"><div className="font-mono text-xs font-semibold text-cyan-600">{s.invoice_number}</div>{s._isOffline ? <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Pending Sync</div> : null}{s._isOffline && s._queueError ? <div className="mt-1 text-xs text-red-600">{s._queueError}</div> : null}</td>
                          <td className="px-3 py-3 align-top">{s.buyer_name || 'Walk-in Customer'}</td>
                          <td className="px-3 py-3 align-top">{s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name}</td>
                          <td className="px-3 py-3 align-top">₹{fmt(s.taxable_amount)}</td><td className="px-3 py-3 align-top">₹{fmt(s.total_gst)}</td><td className="px-3 py-3 align-top font-semibold text-teal-600">₹{fmt(s.total_amount)}</td><td className="px-3 py-3 align-top"><PayBadge type={s.payment_type} /></td><td className="px-3 py-3 align-top text-xs text-slate-500">{formatFullDateTime(s.createdAt || s.sold_at)}</td>
                          <td className="px-3 py-3 align-top"><div className="flex flex-wrap gap-1.5"><button onClick={() => startEditSale(s)} disabled={Boolean(s._isOffline)} className="rounded-full border border-gray-200 px-2 py-1 text-xs disabled:opacity-50">Edit</button><button onClick={() => printInvoice(s)} disabled={Boolean(s._isOffline)} className="rounded-full border border-gray-200 px-2 py-1 text-xs disabled:opacity-50">Print</button><button onClick={() => shareWhatsApp(s)} disabled={Boolean(s._isOffline)} className="rounded-full border border-gray-200 px-2 py-1 text-xs disabled:opacity-50">WhatsApp</button><button onClick={() => handleDelete(s)} className="rounded-full border border-red-200 px-2 py-1 text-xs text-red-600">{s._isOffline ? 'Remove' : 'Delete'}</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {filteredSales.map((s) => (
                    <div key={s._id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-start justify-between"><div><p className="text-sm font-semibold">{s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name}</p><p className="font-mono text-xs text-cyan-600">{s.invoice_number}</p></div><div className="text-right"><p className="text-base font-bold text-teal-600">₹{fmt(s.total_amount)}</p><PayBadge type={s.payment_type} /></div></div>
                      <p className="mb-2 text-xs text-slate-500">{formatFullDateTime(s.createdAt || s.sold_at)}</p>
                      <div className="mb-2 flex gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Taxable ₹{fmt(s.taxable_amount)}</span><span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">GST ₹{fmt(s.total_gst)}</span></div>
                      <div className="grid grid-cols-2 gap-2"><button onClick={() => startEditSale(s)} disabled={Boolean(s._isOffline)} className="rounded-xl border border-gray-200 py-2 text-xs disabled:opacity-50">Edit</button><button onClick={() => printInvoice(s)} disabled={Boolean(s._isOffline)} className="rounded-xl border border-gray-200 py-2 text-xs disabled:opacity-50">Print</button><button onClick={() => shareWhatsApp(s)} disabled={Boolean(s._isOffline)} className="rounded-xl border border-gray-200 py-2 text-xs disabled:opacity-50">WhatsApp</button><button onClick={() => handleDelete(s)} className="rounded-xl border border-red-200 py-2 text-xs text-red-600">{s._isOffline ? 'Remove' : 'Delete'}</button></div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${showModal ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100vh-56px)] flex-col rounded-t-2xl bg-white shadow-xl transition-transform duration-300 md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[420px] md:max-h-screen md:rounded-none ${showModal ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}`}>
          <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 md:px-6"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold">{editingSaleId ? 'Edit Sale' : 'New Sale'}</h3><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${form.payment_type === 'credit' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{form.payment_type === 'credit' ? 'Credit Sale' : 'Cash Sale'}</span></div><button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="h-9 w-9 rounded-full border border-gray-200 text-xl text-slate-500">×</button></div></div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Invoice No.</p><div className="flex h-11 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 font-mono text-xs text-cyan-600"><span>{invoicePreview}</span><button type="button" onClick={() => navigator?.clipboard?.writeText(invoicePreview)}>📋</button></div></div>
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</p><input className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" type="date" value={form.sale_date} onChange={(e) => updateForm({ sale_date: e.target.value })} /></div>
            </div>
            <section className={`rounded-2xl border p-3 ${form.payment_type === 'credit' ? 'border-red-200 bg-red-50/60' : 'border-gray-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Customer</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${form.payment_type === 'credit' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{form.payment_type === 'credit' ? 'Required' : 'Optional'}</span></div>
              <div ref={customerComboRef} className="grid gap-2 md:grid-cols-2"><div className="relative"><input className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" placeholder="Customer name" ref={buyerNameInputRef} value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); updateForm({ buyer_name: e.target.value }); setShowCustomerSuggestions(true); }} onFocus={() => setShowCustomerSuggestions(true)} required={form.payment_type === 'credit'} />{showCustomerSuggestions && filteredPastCustomers.length > 0 ? <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">{filteredPastCustomers.map((customer) => <button key={`${customer.phone}-${customer.name}`} type="button" onClick={() => selectPastCustomer(customer)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"><span>{customer.name}</span><span className="text-xs text-slate-400">{customer.phone}</span></button>)}</div> : null}</div><input className="h-11 rounded-xl border border-gray-200 px-3 text-sm" placeholder="Phone number" value={form.buyer_phone} onChange={(e) => updateForm({ buyer_phone: e.target.value })} /></div>
              <button type="button" onClick={() => setShowMoreCustomerDetails((v) => !v)} className="mt-2 text-xs font-semibold text-slate-500">More Details {showMoreCustomerDetails ? '▴' : '▾'}</button>
              {showMoreCustomerDetails ? <div className="mt-2 space-y-2"><input className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" placeholder="GSTIN" value={form.buyer_gstin} maxLength={GSTIN_LENGTH} onChange={(e) => handleBuyerGstinChange(e.target.value)} onBlur={() => setGstinTouched(true)} />{showGstinError ? <p className="text-xs text-red-600">Invalid GSTIN format</p> : null}<select className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" value={form.buyer_state} onChange={(e) => updateForm({ buyer_state: e.target.value })}><option value="">Select State/UT</option><optgroup label=" States ">{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup><optgroup label=" Union Territories ">{UTS.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup></select><input className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" placeholder="Address" value={form.buyer_address} onChange={(e) => updateForm({ buyer_address: e.target.value })} /></div> : null}
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items</p><button type="button" onClick={() => setShowBarcodeScanner(true)} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Scan Barcode</button></div><div className="space-y-2">{items.map((item, index) => { const g = rowGST(item); const prod = products.find((p) => p._id === item.product_id); return <div key={index} className="rounded-xl border border-gray-200 p-2"><div className="mb-2 flex justify-end gap-1"><button type="button" className="rounded-full border border-gray-200 px-2 py-0.5 text-xs" onClick={() => duplicateItem(index)}>⧉</button>{items.length > 1 ? <button type="button" className="rounded-full border border-red-200 px-2 py-0.5 text-xs text-red-600" onClick={() => removeItem(index)}>×</button> : null}</div><SearchableProductSelect products={products} value={item.product_id} onChange={(id) => updateItem(index, 'product_id', id)} onSelectProduct={(product) => handleProductSelect(index, product)} placeholder="Select product" searchPlaceholder="Search name, barcode or HSN" />{prod ? <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Stock: {prod.quantity || 0}</span> : null}<div className="mt-2 grid gap-2 sm:grid-cols-2"><div><div className="flex h-8 items-center rounded-lg border border-gray-200"><button type="button" className="h-8 w-8 text-sm" onClick={() => updateItemQuantityBy(index, -1)}>-</button><input className="h-8 w-full border-x border-gray-200 text-center text-sm outline-none" type="number" min="1" max={prod ? prod.quantity : undefined} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /><button type="button" className="h-8 w-8 text-sm" onClick={() => updateItemQuantityBy(index, 1)}>+</button></div><div className="mt-1 flex gap-1">{QUICK_QUANTITY_OPTIONS.map((quantity) => <button key={quantity} type="button" className={`rounded-full border px-2 py-0.5 text-[10px] ${Number(item.quantity) === quantity ? 'border-teal-600 bg-teal-600 text-white' : 'border-gray-200 text-slate-500'}`} onClick={() => applyQuickQuantity(index, quantity)}>{quantity}</button>)}</div></div><input className="h-8 rounded-lg border border-gray-200 px-2 text-sm" type="number" step="0.01" value={item.price_per_unit} onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)} placeholder="Price" /></div>{g ? <p className="mt-1 text-xs text-slate-400">₹{fmt(g.taxable)} + ₹{fmt(g.gst)} GST = ₹{fmt(g.total)}</p> : null}</div>; })}<button type="button" onClick={addItem} className="w-full rounded-xl border border-dashed border-gray-300 py-2 text-sm font-semibold text-slate-600">+ Add Item</button><p className="text-[10px] text-slate-400">Alt+A on keyboard</p></div></section>
            <section className="rounded-2xl border border-gray-200 bg-white p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment</p><div className="grid grid-cols-4 gap-1.5">{['cash', 'credit', 'upi', 'bank'].map((opt) => <button key={opt} type="button" onClick={() => updateForm({ payment_type: opt, amount_paid: opt === 'credit' ? form.amount_paid : '' })} className={`h-9 rounded-full text-xs font-semibold capitalize ${form.payment_type === opt ? 'bg-teal-600 text-white' : 'border border-gray-200 text-slate-600'}`}>{opt}</button>)}</div>{form.payment_type === 'credit' ? <div className="mt-2"><input ref={amountPaidInputRef} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" type="number" step="0.01" min="0" placeholder={`Advance payment (max ₹${fmt(billTotals.total)})`} value={form.amount_paid} onChange={(e) => updateForm({ amount_paid: e.target.value })} /><div className="mt-2 flex gap-1"><button type="button" className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px]" onClick={() => updateForm({ amount_paid: '0' })}>0</button><button type="button" className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px]" onClick={() => updateForm({ amount_paid: String((billTotals.total / 2).toFixed(2)) })}>50%</button><button type="button" className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px]" onClick={() => updateForm({ amount_paid: String(billTotals.total.toFixed(2)) })}>Full</button></div><div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Balance Due: ₹{fmt(balanceDue)}</div></div> : null}</section>
            <div className="sticky bottom-0 rounded-2xl border border-teal-100 bg-teal-50 px-3 py-2"><p className="text-xs text-slate-600">Taxable: ₹{fmt(billTotals.taxable)} | GST: ₹{fmt(billTotals.gst)}</p><p className="text-lg font-bold">Total: ₹{fmt(billTotals.total)}</p><p className="text-xs text-slate-500">Round Off: {roundedBill.roundOff >= 0 ? '+' : ''}₹{fmt(roundedBill.roundOff)}</p>{form.payment_type === 'credit' ? <p className="text-xs font-semibold text-red-600">Balance Due: ₹{fmt(balanceDue)}</p> : null}</div>
          </div>
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 md:px-6"><div className="flex gap-2"><button type="button" onClick={handleSubmit} className="h-11 flex-1 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={submitting}>{submitting ? 'Saving...' : !isOnline ? '📥 Save Offline' : form.payment_type === 'credit' ? '📒 Credit Sale' : '💵 Save Sale'}</button><button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-slate-600">Cancel</button></div></div>
        </aside>
      </div>
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

//  Invoice HTML Generator (UNCHANGED) 
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

  return Object.values(grouped)
    .sort((a, b) => a.rate - b.rate)
    .map((group) => (
      isIGST
        ? '<div class="amount-row"><span>IGST @' + group.rate + '%</span><span>₹' + fmt(group.igst) + '</span></div>'
        : '<div class="amount-row"><span>CGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.cgst) + '</span></div>'
          + '<div class="amount-row"><span>SGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.sgst) + '</span></div>'
    ))
    .join('');
};

function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const INR = '&#8377;';
  const roundedBill = getRoundedBillValues(sale.total_amount);
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{
    product_name: sale.product_name,
    hsn_code: sale.hsn_code,
    quantity: sale.quantity,
    price_per_unit: sale.price_per_unit,
    gst_rate: sale.gst_rate,
    taxable_amount: sale.taxable_amount,
    cgst_amount: sale.cgst_amount,
    sgst_amount: sale.sgst_amount,
    igst_amount: sale.igst_amount,
    gst_type: sale.gst_type,
    total_amount: sale.total_amount,
  }];

  const isIGST   = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const colSpan  = isIGST ? 8 : 10;
  const placeOfSupplyCode = getStateCode(sale.buyer_state, sale.buyer_gstin);
  const sellerStateCode = getStateCode(shop.state, shop.gstin);
  const placeOfSupplyLabel = sale.buyer_state
    ? `${sale.buyer_state}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}`
    : 'Not specified';

  const gstCols = isIGST
    ? '<th>IGST%</th><th>IGST ₹</th>'
    : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';

  const itemRows = saleItems.map((item, idx) => {
    const gstCells = isIGST
      ? '<td>' + (item.gst_rate || 0) + '%</td><td>' + INR + fmt(item.igst_amount) + '</td>'
      : '<td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>' + INR + fmt(item.cgst_amount) + '</td><td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>' + INR + fmt(item.sgst_amount) + '</td>';
    return '<tr><td>' + (idx + 1) + '</td><td style="text-align:left"><strong>' + item.product_name + '</strong></td><td>' + (item.hsn_code || '-') + '</td><td>' + item.quantity + '</td><td>' + INR + fmt(item.price_per_unit) + '</td><td>' + INR + fmt(item.taxable_amount) + '</td>' + gstCells + '<td><strong>' + INR + fmt(item.total_amount) + '</strong></td></tr>';
  }).join('');

  const emptyCell  = '<td style="height:20px"></td>';
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill('<tr>' + emptyCell.repeat(colSpan) + '</tr>').join('');

  const footerGST = isIGST
    ? '<td></td><td>' + INR + fmt(sale.igst_amount) + '</td>'
    : '<td></td><td>' + INR + fmt(sale.cgst_amount) + '</td><td></td><td>' + INR + fmt(sale.sgst_amount) + '</td>';

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

  const creditNote = sale.payment_type === 'credit'
    ? '<div style="margin-top:8px;background:#fee2e2;border-radius:6px;padding:6px 8px"><div style="font-size:10px;font-weight:700;color:#991b1b">CREDIT SALE</div><div style="font-size:11px;color:#991b1b">Amount added to customer ledger</div></div>'
    : '';

  const pdfBanner = suggestedFileName && !autoPrint
    ? '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:18px">PDF</span>'
      + '<div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> ? Change destination to <strong>"Save as PDF"</strong> ? Save as <strong>' + suggestedFileName + '</strong><br/>'
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
    + '.credit-note{margin-top:10px;padding:8px 10px;border:1px solid #111827;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#991b1b;background:#fff7f7}'
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
    + '<div class="header">'
    + '<div class="header-left">'
    + '<div class="brand-tag">रखरखाव</div>'
    + '<div class="seller-name">' + (shop.name || 'My Shop') + '</div>'
    + (shop.address ? '<div class="shop-line">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + ((shop.phone || shop.email) ? '<div class="shop-line">' + (shop.phone ? 'Phone: ' + shop.phone : '') + (shop.phone && shop.email ? ' | ' : '') + (shop.email ? 'Email: ' + shop.email : '') + '</div>' : '')
    + (shop.gstin ? '<div class="shop-line"><strong>GSTIN:</strong> ' + shop.gstin + '</div>' : '')
    + (shop.state ? '<div class="shop-line"><strong>State Code:</strong> ' + (sellerStateCode || 'N/A') + '</div>' : '')
    + '</div>'
    + '<div class="header-right">'
    + '<div class="invoice-title">Invoice</div>'
    + '<div class="invoice-copy">Original For Recipient</div>'
    + '<div style="text-align:center"><span class="pay-chip" style="background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div>'
    + '</div>'
    + '</div>'
    + '<div class="info-grid">'
    + '<div class="info-cell"><div class="label">Invoice No</div><div class="value">' + sale.invoice_number + '</div></div>'
    + '<div class="info-cell"><div class="label">Invoice Date</div><div class="value">' + saleDate + '</div></div>'
    + '<div class="info-cell"><div class="label">Invoice Type</div><div class="value">' + (sale.invoice_type || 'B2C') + ' / ' + (isIGST ? 'IGST' : 'CGST + SGST') + '</div></div>'
    + '<div class="info-cell"><div class="label">Place Of Supply</div><div class="value">' + placeOfSupplyLabel + '</div></div>'
    + '</div>'
    + '<div class="party-grid">'
    + '<div class="party-box"><div class="label">Bill From</div><div class="party-name">' + (shop.name || 'RakhRakhaav') + '</div>'
    + (shop.address ? '<div class="party-detail">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + (shop.phone ? '<div class="party-detail">Phone: ' + shop.phone + '</div>' : '')
    + (shop.gstin ? '<div class="party-detail">GSTIN: ' + shop.gstin + '</div>' : '')
    + '</div>'
    + '<div class="party-box"><div class="label">Bill To</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>'
    + (sale.buyer_address ? '<div class="party-detail">' + sale.buyer_address + '</div>' : '')
    + (sale.buyer_state ? '<div class="party-detail">State: ' + sale.buyer_state + '</div>' : '')
    + (sale.buyer_phone ? '<div class="party-detail">Phone: ' + sale.buyer_phone + '</div>' : '')
    + (sale.buyer_gstin ? '<div class="party-detail">GSTIN: ' + sale.buyer_gstin + '</div>' : '')
    + '</div>'
    + '</div>'
    + '<div class="items-wrap"><table><thead><tr><th style="width:34px">Sr</th><th>Particulars</th><th style="width:78px">HSN</th><th style="width:52px">Qty</th><th style="width:88px">Rate ' + INR + '</th><th style="width:94px">Taxable ' + INR + '</th>' + gstCols + '<th style="width:96px">Amount ' + INR + '</th></tr></thead>'
    + '<tbody>' + itemRows + fillerRows + '</tbody>'
    + '<tfoot><tr><td colspan="5" style="text-align:right;padding-right:12px">Total</td><td>' + INR + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td>' + INR + fmt(sale.total_amount) + '</td></tr></tfoot></table></div>'
    + '<div class="summary-grid">'
    + '<div class="summary-box"><div class="label">Amount In Words</div><div class="words-copy">' + numberToWords(parseFloat(sale.total_amount)) + '</div>' + creditNote + '</div>'
    + '<div class="summary-box"><div class="label">Amount Summary</div><table class="amount-table">'
    + '<tr><td>Taxable Amount</td><td>' + INR + fmt(sale.taxable_amount) + '</td></tr>'
    + amountGSTRows.replace(/<div class="amount-row"><span>/g, '<tr><td>').replace(/<\/span><span>/g, '</td><td>').replace(/<\/span><\/div>/g, '</td></tr>')
    + '<tr><td>Total GST</td><td>' + INR + fmt(sale.total_gst) + '</td></tr>'
    + '<tr><td>Round Off</td><td>' + (roundedBill.roundOff >= 0 ? '+' : '') + INR + fmt(roundedBill.roundOff) + '</td></tr>'
    + '<tr class="amount-grand"><td>Grand Total</td><td>' + INR + fmt(sale.total_amount) + '</td></tr>'
    + '<tr class="amount-rounded"><td>Rounded Total</td><td>' + INR + fmt(roundedBill.roundedTotal) + '</td></tr>'
    + '</table></div>'
    + '</div>'
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

