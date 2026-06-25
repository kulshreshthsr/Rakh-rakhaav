'use client';
import { useCallback, useMemo, useState } from 'react';
import { apiUrl } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import {
  getToken,
  formatDateInput as formatDateInputValue,
  todayInputValue as getDefaultDate,
} from '../../../lib/constants';

const uid = () => Math.random().toString(36).slice(2, 9);

export const CATEGORY_TRACKING = {
  'Mobiles & Gadgets': 'imei',
  'Computing':         'serial',
  'Home Appliances':   'serial',
  'Audio / Visual':    'serial',
  'Accessories & Spares': 'optional',
  'Other':             'optional',
};

export const CATEGORY_WARRANTY_MONTHS = {
  'Mobiles & Gadgets':    12,
  'Computing':            12,
  'Home Appliances':      12,
  'Audio / Visual':       12,
  'Accessories & Spares': 6,
  'Other':                0,
};

const EMPTY_FORM = () => ({
  payment_type:          'cash',
  amount_paid:           '',
  supplier_name:         '',
  supplier_phone:        '',
  supplier_gstin:        '',
  supplier_address:      '',
  supplier_state:        '',
  notes:                 '',
  purchase_date:         getDefaultDate(),
  due_date:              '',
  supplier_invoice_no:   '',
  supplier_invoice_date: getDefaultDate(),
  itc_eligible:          true,
  itc_blocked_reason:    '',
  is_reverse_charge:     false,
  rcm_category:          '',
});

export const emptyElecItem = () => ({
  _rowId:          uid(),
  product_id:      '',
  product_name:    '',
  _product:        null,
  quantity:        1,
  price_per_unit:  '',
  discount:        0,
  gst_rate:        18,
  brand:           '',
  model_no:        '',
  color:           '',
  storage:         '',
  ram:             '',
  tracking_mode:   'optional',
  serials:         [],
  imeis:           [],
  imeis2:          [],
  warranty_months: 12,
  warranty_by:     'Manufacturer',
});

function calcWarrantyExpiry(purchaseDate, warrantyMonths) {
  if (!purchaseDate || !warrantyMonths) return '';
  const d = new Date(purchaseDate);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(warrantyMonths));
  return d.toISOString().split('T')[0];
}

function buildItemMeta(item, purchaseDate) {
  const meta = {};
  if (item.brand)    meta.brand    = item.brand;
  if (item.model_no) meta.model_no = item.model_no;
  if (item.color)    meta.color    = item.color;
  if (item.storage)  meta.storage  = item.storage;
  if (item.ram)      meta.ram      = item.ram;

  const wMonths = Number(item.warranty_months || 0);
  if (wMonths > 0) {
    meta.warranty_months  = wMonths;
    meta.warranty_by      = item.warranty_by || 'Manufacturer';
    meta.warranty_expiry  = calcWarrantyExpiry(purchaseDate, wMonths);
  }

  if (item.tracking_mode === 'imei') {
    const primary = item.imeis.filter(Boolean);
    if (primary.length > 0) meta.serial_numbers = primary;
    const secondary = item.imeis2.filter(Boolean);
    if (secondary.length > 0) meta.imei2_list = secondary;
  } else {
    const serials = item.serials.filter(Boolean);
    if (serials.length > 0) meta.serial_numbers = serials;
  }

  return meta;
}

export default function useElectronicsPurchaseForm({ shopState, isOnline, fetchAll, products, setProducts, setPurchases }) {
  const { showToast } = useToast();

  const [showModal,          setShowModal]          = useState(false);
  const [editingPurchaseId,  setEditingPurchaseId]  = useState('');
  const [submitting,         setSubmitting]         = useState(false);
  const [error,              setError]              = useState('');
  const [form,               setForm]               = useState(EMPTY_FORM);
  const [items,              setItems]              = useState([emptyElecItem()]);
  const [suppliers,          setSuppliers]          = useState([]);
  const [suppliersLoaded,    setSuppliersLoaded]    = useState(false);

  const updateForm = useCallback((patch) => setForm(prev => ({ ...prev, ...patch })), []);

  const updateItem = useCallback((rowId, patch) =>
    setItems(prev => prev.map(it => it._rowId !== rowId ? it : { ...it, ...patch })),
  []);

  const addItem    = useCallback(() => setItems(prev => [...prev, emptyElecItem()]), []);
  const removeItem = useCallback((rowId) =>
    setItems(prev => prev.length > 1 ? prev.filter(it => it._rowId !== rowId) : prev),
  []);

  const openNew = useCallback(() => {
    setEditingPurchaseId('');
    setForm(EMPTY_FORM());
    setItems([emptyElecItem()]);
    setError('');
    setShowModal(true);
  }, []);

  const resetModal = useCallback(() => {
    setShowModal(false);
    setEditingPurchaseId('');
    setForm(EMPTY_FORM());
    setItems([emptyElecItem()]);
    setError('');
  }, []);

  const loadSuppliers = useCallback(async () => {
    if (suppliersLoaded) return;
    try {
      const res = await fetch(apiUrl('/api/suppliers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : (data.suppliers || []));
        setSuppliersLoaded(true);
      }
    } catch { /* non-fatal */ }
  }, [suppliersLoaded]);

  const fillSupplier = useCallback((supplier) => {
    setForm(prev => ({
      ...prev,
      supplier_name:    supplier.name    || '',
      supplier_phone:   supplier.phone   || '',
      supplier_gstin:   supplier.gstin   || '',
      supplier_address: supplier.address || '',
      supplier_state:   supplier.state   || '',
    }));
  }, []);

  const onProductSelect = useCallback((rowId, product) => {
    if (!product) {
      updateItem(rowId, { product_id: '', product_name: '', _product: null });
      return;
    }
    const category      = product.category || '';
    const trackingMode  = CATEGORY_TRACKING[category] || 'optional';
    const warrantyMonths = CATEGORY_WARRANTY_MONTHS[category] ?? 12;
    const meta = product.metadata || {};
    const getMeta = (k) => (meta instanceof Map ? meta.get(k) : meta[k]) || '';

    updateItem(rowId, {
      product_id:      product._id,
      product_name:    product.name,
      _product:        product,
      gst_rate:        product.gst_rate ?? 18,
      price_per_unit:  product.cost_price || product.price || '',
      brand:           getMeta('brand'),
      model_no:        getMeta('model_no'),
      tracking_mode:   trackingMode,
      warranty_months: warrantyMonths,
      serials:         [],
      imeis:           [],
      imeis2:          [],
    });
  }, [updateItem]);

  const billTotals = useMemo(() => {
    let taxable = 0, gst = 0;
    items.forEach(it => {
      const qty  = Number(it.quantity     || 0);
      const cost = Number(it.price_per_unit || 0);
      const disc = Number(it.discount     || 0);
      const rate = Number(it.gst_rate     || 0);
      const net  = qty * cost * (1 - disc / 100);
      taxable += net;
      gst     += net * rate / 100;
    });
    return { taxable, gst, total: taxable + gst };
  }, [items]);

  const startEditPurchase = useCallback((purchase) => {
    if (purchase._isOffline) {
      setError('Offline entries cannot be edited — wait for sync');
      return;
    }
    const sourceItems = Array.isArray(purchase.items) && purchase.items.length > 0
      ? purchase.items
      : [{ product: purchase.product, quantity: purchase.quantity, price_per_unit: purchase.price_per_unit }];

    setEditingPurchaseId(purchase._id);

    setItems(sourceItems.map(item => {
      const meta     = item.item_metadata || {};
      const getMeta  = (k) => (meta instanceof Map ? meta.get(k) : meta[k]) || '';
      const pid      = item.product?._id || item.product || item.product_id || '';
      const product  = products.find(p => p._id === pid);
      const category = product?.category || '';
      const trackingMode = CATEGORY_TRACKING[category] || 'optional';
      const isImei   = trackingMode === 'imei';
      return {
        _rowId:          uid(),
        product_id:      pid,
        product_name:    item.product_name || product?.name || '',
        _product:        product || null,
        quantity:        item.quantity || 1,
        price_per_unit:  item.price_per_unit || '',
        discount:        Number(getMeta('discount') || 0),
        gst_rate:        item.gst_rate ?? product?.gst_rate ?? 18,
        brand:           getMeta('brand'),
        model_no:        getMeta('model_no'),
        color:           getMeta('color'),
        storage:         getMeta('storage'),
        ram:             getMeta('ram'),
        tracking_mode:   trackingMode,
        serials:         !isImei && Array.isArray(meta.serial_numbers) ? meta.serial_numbers : [],
        imeis:           isImei  && Array.isArray(meta.serial_numbers) ? meta.serial_numbers : [],
        imeis2:          Array.isArray(meta.imei2_list) ? meta.imei2_list : [],
        warranty_months: Number(getMeta('warranty_months') || CATEGORY_WARRANTY_MONTHS[category] || 12),
        warranty_by:     getMeta('warranty_by') || 'Manufacturer',
      };
    }));

    setForm({
      payment_type:          purchase.payment_type    || 'cash',
      amount_paid:           purchase.payment_type === 'credit' ? String(purchase.amount_paid || '') : '',
      supplier_name:         purchase.supplier_name    || '',
      supplier_phone:        purchase.supplier_phone   || '',
      supplier_gstin:        purchase.supplier_gstin   || '',
      supplier_address:      purchase.supplier_address || '',
      supplier_state:        purchase.supplier_state   || '',
      notes:                 purchase.notes            || '',
      purchase_date:         formatDateInputValue(purchase.createdAt || purchase.purchased_at) || getDefaultDate(),
      due_date:              purchase.due_date ? formatDateInputValue(purchase.due_date) : '',
      supplier_invoice_no:   purchase.supplier_invoice_no   || '',
      supplier_invoice_date: purchase.supplier_invoice_date ? formatDateInputValue(purchase.supplier_invoice_date) : getDefaultDate(),
      itc_eligible:          purchase.itc_eligible !== false,
      itc_blocked_reason:    purchase.itc_blocked_reason || '',
      is_reverse_charge:     purchase.is_reverse_charge || false,
      rcm_category:          purchase.rcm_category || '',
    });
    setError('');
    setShowModal(true);
  }, [products]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    setError('');

    const validItems = items.filter(it =>
      it.product_id && Number(it.quantity) > 0 && it.price_per_unit !== ''
    );
    if (validItems.length === 0) {
      setError('Add at least one product with quantity and cost price');
      return;
    }

    for (const it of validItems) {
      const qty = Number(it.quantity);
      if (it.tracking_mode === 'imei') {
        const entered = it.imeis.filter(Boolean).length;
        if (entered > 0 && entered < qty) {
          setError(`${it.product_name || 'Product'}: ${entered} IMEI(s) entered but quantity is ${qty}`);
          return;
        }
      } else if (it.tracking_mode === 'serial') {
        const entered = it.serials.filter(Boolean).length;
        if (entered > 0 && entered < qty) {
          setError(`${it.product_name || 'Product'}: ${entered} serial(s) entered but quantity is ${qty}`);
          return;
        }
      }
    }

    const amountPaidNum = Number(form.amount_paid || 0);
    const payload = {
      items: validItems.map(it => ({
        product_id:     it.product_id,
        product_name:   it.product_name || it._product?.name || '',
        quantity:       Number(it.quantity),
        price_per_unit: Number(it.price_per_unit),
        gst_rate:       Number(it.gst_rate || 0),
        hsn_code:       it._product?.hsn_code || '',
        item_metadata:  buildItemMeta(it, form.purchase_date),
      })),
      payment_type:          form.payment_type,
      amount_paid:           ['credit', 'upi', 'bank'].includes(form.payment_type)
                               ? (amountPaidNum || 0)
                               : billTotals.total,
      amount_paid_mode:      ['upi', 'bank'].includes(form.payment_type) ? form.payment_type : undefined,
      supplier_name:         form.supplier_name,
      supplier_phone:        form.supplier_phone,
      supplier_gstin:        form.supplier_gstin,
      supplier_address:      form.supplier_address,
      supplier_state:        form.supplier_state,
      purchase_date:         form.purchase_date,
      due_date:              form.payment_type === 'credit' && form.due_date ? form.due_date : undefined,
      notes:                 form.notes || undefined,
      supplier_invoice_no:   form.supplier_invoice_no   || undefined,
      supplier_invoice_date: form.supplier_invoice_date || undefined,
      itc_eligible:          form.itc_eligible,
      itc_blocked_reason:    !form.itc_eligible ? (form.itc_blocked_reason || undefined) : undefined,
      is_reverse_charge:     form.is_reverse_charge,
      rcm_category:          form.is_reverse_charge ? (form.rcm_category || undefined) : undefined,
    };

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingPurchaseId);
      const res = await fetch(
        isEditing
          ? apiUrl(`/api/purchases/${editingPurchaseId}`)
          : apiUrl('/api/purchases'),
        {
          method:  isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body:    JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (res.ok) {
        resetModal();
        fetchAll();
        showToast(isEditing ? 'Purchase updated' : 'Purchase saved', 'success');
      } else {
        setError(data.message || 'Could not save purchase');
      }
    } catch {
      setError('Server error — please try again');
    }
    setSubmitting(false);
  }, [items, form, billTotals, editingPurchaseId, fetchAll, resetModal, showToast]);

  return {
    showModal,
    openNew,
    resetModal,
    editingPurchaseId,
    submitting,
    error,
    setError,
    form,
    updateForm,
    items,
    updateItem,
    addItem,
    removeItem,
    suppliers,
    loadSuppliers,
    fillSupplier,
    onProductSelect,
    billTotals,
    startEditPurchase,
    handleSubmit,
  };
}
