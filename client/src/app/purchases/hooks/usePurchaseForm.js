'use client';
import { useState } from 'react';
import { apiUrl } from '../../../lib/api';
import { queuePurchase } from '../../../lib/offlineQueue';
import { cacheProducts } from '../../../lib/offlineDB';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_LENGTH = 15;
const normalizeGstin = (value) => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);
const normalizeState = (value = '') => value.trim().toLowerCase();
const GST_STATE_CODE_MAP = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand',
  '06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim',
  '12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh',
  '23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'Andaman & Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh',
};
const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};
const getRoundedBillValues = (amount) => {
  const numericAmount = Number(amount || 0);
  const roundedTotal = Math.round(numericAmount);
  return { roundedTotal, roundOff: parseFloat((roundedTotal - numericAmount).toFixed(2)) };
};
const formatDateInputValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
const emptyItem = () => ({ _rowId: Math.random().toString(36).slice(2), product_id: '', quantity: 1, price_per_unit: '', item_metadata: {} });
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
const buildPurchaseWhatsAppMessage = (purchase) => {
  const purchaseDate = new Date(purchase.createdAt || purchase.purchased_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const itemLines = purchase.items && purchase.items.length > 0
    ? purchase.items.map((item, i) => `  ${i + 1}. ${item.product_name} x ${item.quantity} @ ₹${Number(item.price_per_unit || 0).toFixed(2)} = ₹${Number(item.total_amount || 0).toFixed(2)}`).join('\n')
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

const EMPTY_FORM = () => ({
  payment_type: 'cash', amount_paid: '',
  supplier_name: '', supplier_phone: '', supplier_gstin: '',
  supplier_address: '', supplier_state: '', notes: '',
  purchase_date: getDefaultPurchaseDateValue(), due_date: '',
  supplier_invoice_no: '', supplier_invoice_date: getDefaultPurchaseDateValue(),
  itc_eligible: true, itc_blocked_reason: '', is_reverse_charge: false, rcm_category: '',
});

export default function usePurchaseForm({ shopState, isOnline, fetchAll, products, setProducts, setPurchases }) {
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState('');
  const [error, setError] = useState('');
  const [gstinTouched, setGstinTouched] = useState(false);
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showInlineProductForm, setShowInlineProductForm] = useState(false);
  const [inlineProductRowIndex, setInlineProductRowIndex] = useState(0);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });

  const calcRowGST = (item) => {
    const prod = products.find((p) => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    const isIGST = normalizeState(shopState) && normalizeState(form.supplier_state)
      ? normalizeState(shopState) !== normalizeState(form.supplier_state) : false;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2, isIGST };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = calcRowGST(item);
    if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill = getRoundedBillValues(billTotals.total);
  const gstinValue = normalizeGstin(form.supplier_gstin || '');
  const gstinComplete = gstinValue.length === GSTIN_LENGTH;
  const gstinValid = !gstinValue || (gstinComplete && GSTIN_REGEX.test(gstinValue));
  const showGstinError = gstinTouched && gstinComplete && !gstinValid;
  const showGstinLengthHint = gstinTouched && !!gstinValue && !gstinComplete;

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find((p) => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)); };

  const handleSupplierGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    updateForm({ supplier_gstin: normalized, ...(detectedState ? { supplier_state: detectedState } : {}) });
    setGstinTouched(Boolean(normalized));
  };

  const resetInlineProductForm = () => {
    setShowInlineProductForm(false);
    setInlineProductRowIndex(0);
    setCreatingProduct(false);
    setNewProductForm({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });
  };

  const openInlineProductForm = (rowIndex) => {
    setError('');
    setInlineProductRowIndex(rowIndex);
    setShowInlineProductForm(true);
    setNewProductForm({ name: '', price: '', gst_rate: '0', unit: 'pcs', hsn_code: '' });
  };

  const resetModal = () => {
    setEditingPurchaseId('');
    setShowModal(false);
    setError('');
    setItems([emptyItem()]);
    setForm(EMPTY_FORM());
    setGstinTouched(false);
    resetInlineProductForm();
  };

  const createInlineProduct = async () => {
    if (!isOnline) { setError('Offline mode me naya product add nahi ho sakta. Internet on karke try karein.'); return; }
    if (!newProductForm.name.trim()) { setError('Product name required hai'); return; }
    const sellingPrice = Number(newProductForm.price);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) { setError('Valid selling price dijiye'); return; }
    const purchasePrice = Number(items[inlineProductRowIndex]?.price_per_unit || 0);
    setCreatingProduct(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name: newProductForm.name.trim(), price: sellingPrice,
          cost_price: Number.isFinite(purchasePrice) ? purchasePrice : 0,
          quantity: 0, unit: newProductForm.unit || 'pcs',
          hsn_code: newProductForm.hsn_code || '', gst_rate: Number(newProductForm.gst_rate || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Product create nahi ho paaya'); setCreatingProduct(false); return; }
      const nextProducts = [...products, data].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setProducts(nextProducts);
      await cacheProducts(nextProducts);
      updateItem(inlineProductRowIndex, 'product_id', data._id);
      resetInlineProductForm();
    } catch { setError('Product create karte waqt server error aayi'); setCreatingProduct(false); return; }
    setCreatingProduct(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setGstinTouched(true);
    if (form.payment_type === 'credit' && !form.supplier_name) { setError('Supplier name is required for credit purchases'); return; }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
    const validItems = items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('Select at least one product'); return; }
    setSubmitting(true);

    if (!isOnline) {
      try {
        const offlineItems = buildOfflinePurchaseItems(validItems, products);
        const payload = {
          items: offlineItems, payment_type: form.payment_type,
          amount_paid: form.payment_type === 'credit' ? (amountPaidNum || 0) : billTotals.total,
          supplier_name: form.supplier_name, supplier_phone: form.supplier_phone,
          supplier_gstin: gstinValue, supplier_address: form.supplier_address,
          supplier_state: form.supplier_state, purchase_date: form.purchase_date, notes: form.notes,
        };
        const operation = await queuePurchase(payload, offlineItems);
        if (!operation) throw new Error('Unable to save purchase offline');
        resetModal();
        setPurchases((prev) => [{
          _id: operation.id, invoice_number: operation.tempId,
          items: offlineItems.map((item) => ({ product_name: item.product_name, quantity: item.quantity, price_per_unit: item.price_per_unit, total_amount: Number(item.quantity) * Number(item.price_per_unit) })),
          product_name: offlineItems[0]?.product_name || 'Product',
          total_amount: billTotals.total, taxable_amount: billTotals.taxable, total_gst: billTotals.gst,
          amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total,
          balance_due: form.payment_type === 'credit' ? balanceDue : 0,
          payment_type: form.payment_type, supplier_name: form.supplier_name, supplier_phone: form.supplier_phone,
          createdAt: getPurchaseRecordDateISO(form.purchase_date), _isOffline: true,
        }, ...prev]);
      } catch (err) { setError('Offline save failed: ' + (err?.message || 'Unknown error')); }
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        items: validItems, payment_type: form.payment_type,
        amount_paid: ['credit', 'upi', 'bank'].includes(form.payment_type) ? (amountPaidNum || 0) : billTotals.total,
        amount_paid_mode: ['upi', 'bank'].includes(form.payment_type) ? form.payment_type : undefined,
        supplier_name: form.supplier_name, supplier_phone: form.supplier_phone,
        supplier_gstin: gstinValue, supplier_address: form.supplier_address,
        supplier_state: form.supplier_state, purchase_date: form.purchase_date,
        due_date: form.payment_type === 'credit' && form.due_date ? form.due_date : undefined,
        notes: form.notes,
        supplier_invoice_no: form.supplier_invoice_no || undefined,
        supplier_invoice_date: form.supplier_invoice_date || undefined,
        itc_eligible: form.itc_eligible,
        itc_blocked_reason: form.itc_eligible ? undefined : (form.itc_blocked_reason || undefined),
        is_reverse_charge: form.is_reverse_charge,
        rcm_category: form.is_reverse_charge ? (form.rcm_category || undefined) : undefined,
      };
      const isEditing = Boolean(editingPurchaseId);
      const res = await fetch(
        isEditing ? apiUrl(`/api/purchases/${editingPurchaseId}`) : apiUrl('/api/purchases'),
        { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (res.ok) {
        resetModal();
        fetchAll();
      } else { setError(data.message || 'Request failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  };

  const startEditPurchase = (purchase) => {
    if (purchase._isOffline) { setError('Yeh entry abhi sync nahi hui — internet aane pe edit kar sakte hain'); return; }
    const sourceItems = purchase.items && purchase.items.length > 0
      ? purchase.items
      : [{ product: purchase.product, quantity: purchase.quantity, price_per_unit: purchase.price_per_unit }];
    setEditingPurchaseId(purchase._id);
    setItems(sourceItems.map((item) => ({
      product_id: item.product?._id || item.product || '',
      quantity: item.quantity || 1,
      price_per_unit: item.price_per_unit || '',
      item_metadata: item.item_metadata && typeof item.item_metadata === 'object' ? { ...item.item_metadata } : {},
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
      purchase_date: formatDateInputValue(purchase.createdAt || purchase.purchased_at) || getDefaultPurchaseDateValue(),
      due_date: purchase.due_date ? formatDateInputValue(purchase.due_date) : '',
      supplier_invoice_no: purchase.supplier_invoice_no || '',
      supplier_invoice_date: purchase.supplier_invoice_date ? formatDateInputValue(purchase.supplier_invoice_date) : getDefaultPurchaseDateValue(),
      itc_eligible: purchase.itc_eligible !== false,
      itc_blocked_reason: purchase.itc_blocked_reason || '',
      is_reverse_charge: purchase.is_reverse_charge || false,
      rcm_category: purchase.rcm_category || '',
    });
    setGstinTouched(false);
    setError('');
    setShowModal(true);
  };

  const sendPurchaseWhatsApp = (purchase) => {
    const phone = cleanPhone(purchase.supplier_phone || '');
    if (!phone) { setError('Supplier phone number is missing'); return; }
    setError('');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(buildPurchaseWhatsAppMessage(purchase))}`, '_blank');
  };

  return {
    showModal, setShowModal,
    submitting,
    editingPurchaseId,
    error, setError,
    gstinTouched,
    items, setItems,
    form, updateForm,
    showInlineProductForm,
    inlineProductRowIndex,
    creatingProduct,
    newProductForm, setNewProductForm,
    billTotals,
    roundedBill,
    balanceDue,
    gstinValue,
    gstinValid,
    showGstinError,
    showGstinLengthHint,
    calcRowGST,
    resetModal,
    updateItem, addItem, removeItem,
    handleSupplierGstinChange,
    handleSubmit,
    startEditPurchase,
    resetInlineProductForm,
    openInlineProductForm,
    createInlineProduct,
    sendPurchaseWhatsApp,
  };
}
