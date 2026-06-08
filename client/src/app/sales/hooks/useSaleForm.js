'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../../lib/api';
import { queueSale } from '../../../lib/offlineQueue';
import { printDeliveryChallan } from '../../../lib/generateChallan';
import eventBus from '../../../lib/eventBus';
import { validateGSTIN as _validateGSTINFull, getSupplyType as _getSupplyType } from '../../../lib/gstValidation';
import {
  getToken, fmt, GSTIN_REGEX, GSTIN_LENGTH, normalizeGstin, normalizeState, normalizeBarcode,
  GST_STATE_CODE_MAP, getRoundedBillValues, formatDateInput as formatDateInputValue,
  todayInputValue as getDefaultSaleDateValue, getSaleRecordDateISO,
  emptySaleItem as emptyItem, buildInitialSaleForm as buildInitialForm,
  buildWhatsAppShareMessage,
} from '../../../lib/constants';

const getStateFromGstin = (gstin) => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
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

const DUPLICATE_WINDOW_MS = 60 * 1000;
const LAST_SALE_KEY = 'rr-last-sale';

export default function useSaleForm({
  defaultPayment,
  businessType,
  config,
  shopState, shopGstin, shopStateCode, shopAddress,
  shopName,
  isOnline,
  router,
  fetchAll,
  setSales,
  products,
  productBatches, setProductBatches,
  productVariants, setProductVariants,
  selectedContractor,
  setSelectedContractor,
  setContractorSearch,
  setShowContractorDrop,
  setCustomerQuery,
  setShowCustomerInfo,
  setShowCustomerSuggestions,
  setShowMoreCustomerDetails,
  recipeSales,
  batchSales,
  variantSales,
}) {
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [gstinTouched, setGstinTouched] = useState(false);
  const [form, setForm] = useState(() => buildInitialForm({ payment_type: defaultPayment }));
  const [extraFields, setExtraFields] = useState({});
  const [supplyType, setSupplyType] = useState('intra_state');
  const [gstinValidation, setGstinValidation] = useState(null);
  const [documentType, setDocumentType] = useState('invoice');
  const [challanForm, setChallanForm] = useState({
    challan_type: 'supply_of_goods', challan_date: getDefaultSaleDateValue(),
    consignee_name: '', consignee_address: '', consignee_gstin: '',
    consignee_contact: '', consignee_phone: '',
    dispatch_from: '', deliver_to: '',
    vehicle_number: '', transport_name: '', lr_number: '', eway_bill_number: '',
    po_number: '', po_date: '', indent_number: '',
    special_instructions: '', challan_terms: '',
  });
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const amountPaidInputRef = useRef(null);
  const buyerNameInputRef  = useRef(null);
  const customerComboRef   = useRef(null);
  const saleDateInputRef   = useRef(null);

  /* ── Computed values ── */
  const rowGST = (item) => {
    const prod = products.find((p) => p._id === item.product_id);
    if (!prod || !item.quantity || (!item.price_per_unit && !item._isFreeItem)) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit || 0);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    const isIGST = normalizeState(shopState) && normalizeState(form.buyer_state)
      ? normalizeState(shopState) !== normalizeState(form.buyer_state) : false;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2, isIGST };
  };

  const rawTotals = items.reduce((acc, item) => {
    const g = rowGST(item);
    if (!g) return acc;
    return { subtotal: acc.subtotal + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { subtotal: 0, gst: 0, total: 0 });

  const discType  = form.discount_type || 'none';
  const discValue = parseFloat(form.discount_value) || 0;
  const discAmt   = discType === 'flat'
    ? Math.min(discValue, rawTotals.subtotal)
    : discType === 'percent'
    ? parseFloat(((rawTotals.subtotal * discValue) / 100).toFixed(2))
    : 0;
  const taxableAfterDisc = Math.max(0, rawTotals.subtotal - discAmt);
  const gstAfterDisc = rawTotals.subtotal > 0
    ? parseFloat((rawTotals.gst * (taxableAfterDisc / rawTotals.subtotal)).toFixed(2))
    : rawTotals.gst;

  const billTotals = {
    subtotal:       parseFloat(rawTotals.subtotal.toFixed(2)),
    discountAmount: parseFloat(discAmt.toFixed(2)),
    taxable:        parseFloat(taxableAfterDisc.toFixed(2)),
    gst:            parseFloat(gstAfterDisc.toFixed(2)),
    total:          parseFloat((taxableAfterDisc + gstAfterDisc).toFixed(2)),
  };

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue    = Math.max(0, billTotals.total - amountPaidNum);
  const roundedBill   = getRoundedBillValues(billTotals.total);
  const isChallanMode = (businessType === 'hardware' || config?.challanConfig?.enabled) && documentType === 'challan' && !editingSaleId;
  const gstinValue    = normalizeGstin(form.buyer_gstin);
  const gstinComplete = gstinValue.length === GSTIN_LENGTH;
  const gstinValid    = !gstinValue || (gstinComplete && GSTIN_REGEX.test(gstinValue));
  const showGstinError      = gstinTouched && gstinComplete && !gstinValid;
  const showGstinLengthHint = gstinTouched && !!gstinValue && !gstinComplete;


  /* ── Item handlers ── */
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === '_isFreeItem') {
      updated[index].price_per_unit = value ? '0' : '';
    }
    if (field === 'product_id' && value && !updated[index]._isFreeItem) {
      const prod = products.find((p) => p._id === value);
      if (prod) updated[index].price_per_unit = prod.price || '';
    }
    setItems(updated);
  };

  const updateItemQuantityBy = (index, delta) => setItems((current) => current.map((item, i) => i !== index ? item : { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }));
  const applyQuickQuantity = (index, quantity) => updateItem(index, 'quantity', quantity);
  const duplicateItem = (index) => setItems((current) => { const source = current[index]; if (!source) return current; const next = [...current]; next.splice(index + 1, 0, { ...source }); return next; });
  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const loadBatchesFor = async (pid) => {
    if (productBatches[pid]) return;
    try {
      const res = await fetch(apiUrl(`/api/inventory/batches/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProductBatches((prev) => ({ ...prev, [pid]: (Array.isArray(data) ? data : []).filter((b) => !b.is_depleted && b.quantity > 0) }));
    } catch {}
  };

  const loadVariantsFor = async (pid) => {
    if (productVariants[pid]) return;
    try {
      const res = await fetch(apiUrl(`/api/inventory/variants/${pid}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProductVariants((prev) => ({ ...prev, [pid]: Array.isArray(data) ? data : [] }));
    } catch {}
  };

  const handleProductSelect = (index, product) => {
    updateItem(index, 'product_id', product._id);
    const initialMeta = recipeSales ? { deduct_recipe: true } : {};
    setItems((current) => current.map((item, i) => i === index ? { ...item, quantity: item.quantity || 1, price_per_unit: item._isFreeItem ? '0' : (product.price || item.price_per_unit), item_metadata: initialMeta } : item));
    if (batchSales) loadBatchesFor(product._id);
    if (variantSales) loadVariantsFor(product._id);
  };

  const addOrIncrementProduct = (product) => {
    const discPct = (businessType === 'hardware' && selectedContractor?.contractor_discount > 0) ? selectedContractor.contractor_discount : 0;
    const applyDiscount = (basePrice) => { if (!basePrice || !discPct) return basePrice || ''; return parseFloat((Number(basePrice) * (1 - discPct / 100)).toFixed(2)); };
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.product_id === product._id);
      if (existingIndex >= 0) return current.map((item, i) => i === existingIndex ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1), price_per_unit: item.price_per_unit || applyDiscount(product.price) } : item);
      const emptyIndex = current.findIndex((item) => !item.product_id);
      const discountedPrice = applyDiscount(product.price);
      if (emptyIndex >= 0) return current.map((item, i) => i === emptyIndex ? { ...item, product_id: product._id, quantity: item.quantity || 1, price_per_unit: discountedPrice } : item);
      return [...current, { product_id: product._id, quantity: 1, price_per_unit: discountedPrice }];
    });
  };

  const handleBuyerGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    updateForm({ buyer_gstin: normalized, ...(detectedState ? { buyer_state: detectedState } : {}) });
    setGstinTouched(Boolean(normalized));
    if (normalized.length === GSTIN_LENGTH) {
      const validation = _validateGSTINFull(normalized);
      setGstinValidation(validation);
      if (validation.valid && shopStateCode) setSupplyType(_getSupplyType(shopStateCode, validation.stateCode));
      else setSupplyType('intra_state');
    } else { setGstinValidation(null); setSupplyType('intra_state'); }
  };

  function resetForm(overrides = {}) {
    const nextPaymentType = overrides.payment_type || form.payment_type || defaultPayment;
    setEditingSaleId(''); setItems([emptyItem()]);
    setForm(buildInitialForm({ payment_type: nextPaymentType, amount_paid: '', ...overrides }));
    setGstinTouched(false); setError(''); setExtraFields({});
    setDocumentType('invoice');
    setChallanForm({ challan_type: 'supply_of_goods', challan_date: getDefaultSaleDateValue(), consignee_name: '', consignee_address: '', consignee_gstin: '', consignee_contact: '', consignee_phone: '', dispatch_from: shopAddress || '', deliver_to: '', vehicle_number: '', transport_name: '', lr_number: '', eway_bill_number: '', po_number: '', po_date: '', indent_number: '', special_instructions: '', challan_terms: '' });
    setDuplicateWarning(false);
    if (setCustomerQuery) setCustomerQuery('');
    if (setShowCustomerInfo) setShowCustomerInfo(false);
    if (setShowCustomerSuggestions) setShowCustomerSuggestions(false);
    if (setShowMoreCustomerDetails) setShowMoreCustomerDetails(false);
    if (setSelectedContractor) setSelectedContractor(null);
    if (setContractorSearch) setContractorSearch('');
    if (setShowContractorDrop) setShowContractorDrop(false);
  }

  const startEditSale = (sale) => {
    if (sale?._isOffline) { setError('Pending offline sale sync hone se pehle edit nahi hogi.'); return; }
    const sourceItems = sale.items && sale.items.length > 0 ? sale.items : [{ product: sale.product, quantity: sale.quantity, price_per_unit: sale.price_per_unit }];
    setEditingSaleId(sale._id);
    setItems(sourceItems.map((item) => ({ product_id: item.product?._id || item.product || '', quantity: item.quantity || 1, price_per_unit: item.price_per_unit || '', item_metadata: item.item_metadata && typeof item.item_metadata === 'object' ? { ...item.item_metadata } : {} })));
    setExtraFields(sale.extra_fields && typeof sale.extra_fields === 'object' ? { ...sale.extra_fields } : {});
    setForm(buildInitialForm({ payment_type: sale.payment_type || 'cash', amount_paid: sale.payment_type === 'credit' ? String(sale.amount_paid || '') : '', buyer_name: sale.buyer_name || '', buyer_phone: sale.buyer_phone || '', buyer_gstin: sale.buyer_gstin || '', buyer_address: sale.buyer_address || '', buyer_state: sale.buyer_state || '', notes: sale.notes || '', sale_date: formatDateInputValue(sale.createdAt || sale.sold_at) || getDefaultSaleDateValue() }));
    setGstinTouched(false); setError('');
    if (setCustomerQuery) setCustomerQuery(sale.buyer_name || '');
    if (setShowCustomerInfo) setShowCustomerInfo(Boolean(sale.payment_type === 'credit' || sale.buyer_name || sale.buyer_phone || sale.buyer_gstin || sale.buyer_address || sale.buyer_state));
    if (setShowMoreCustomerDetails) setShowMoreCustomerDetails(Boolean(sale.buyer_gstin || sale.buyer_address || sale.buyer_state));
    setShowModal(true);
  };

  async function _doSubmit(validItems) {
    setSubmitting(true);
    if (!isOnline) {
      if (editingSaleId) { setError('Editing existing sales requires internet connection.'); setSubmitting(false); return; }
      try {
        const offlineItems = buildOfflineSaleItems(validItems, products);
        const operation = await queueSale({ ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total }, offlineItems);
        if (!operation) throw new Error('Unable to save sale offline');
        setShowModal(false); resetForm();
        setSales((prev) => [{ _id: operation.id, invoice_number: operation.tempId, items: offlineItems.map((item) => ({ product_name: item.product_name, quantity: item.quantity, total_amount: Number(item.quantity) * Number(item.price_per_unit) })), total_amount: billTotals.total, taxable_amount: billTotals.taxable, total_gst: billTotals.gst, payment_type: form.payment_type, buyer_name: form.buyer_name || 'Walk-in Customer', buyer_phone: form.buyer_phone, createdAt: getSaleRecordDateISO(form.sale_date), _isOffline: true }, ...prev]);
      } catch (err) { setError('Offline save failed: ' + (err?.message || 'Unknown error')); }
      setSubmitting(false); return;
    }
    try {
      const isEditing = Boolean(editingSaleId);
      const isChallan = isChallanMode;
      const isQuotation = !isEditing && documentType === 'quotation';
      const submitUrl = isEditing ? apiUrl(`/api/sales/${editingSaleId}`) : isChallan ? apiUrl('/api/sales/challan') : apiUrl('/api/sales');
      const submitItems = isChallan ? validItems.map((i) => ({ ...i, price_per_unit: Number(i.price_per_unit) || 0, unit_of_measurement: i.unit_of_measurement || 'NOS', remarks: i.remarks || '' })) : validItems;
      const challanPayload = isChallan ? { ...challanForm, challan_date: challanForm.challan_date || form.sale_date, consignee_name: challanForm.consignee_name || form.buyer_name || '', consignee_phone: challanForm.consignee_phone || form.buyer_phone || '' } : {};
      const res = await fetch(submitUrl, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items: submitItems, ...form, buyer_gstin: gstinValue, sale_date: form.sale_date, amount_paid: isChallan ? 0 : (form.payment_type === 'credit' ? amountPaidNum : billTotals.total), extra_fields: { ...extraFields, ...(businessType === 'hardware' && selectedContractor ? { contractor_id: String(selectedContractor._id), contractor_name: selectedContractor.name } : {}) }, ...challanPayload, ...(isQuotation ? { document_type: 'quotation' } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEditing && data?._id) setSales((current) => current.map((sale) => sale._id === data._id ? data : sale).sort((a, b) => new Date(b.createdAt || b.sold_at || 0).getTime() - new Date(a.createdAt || a.sold_at || 0).getTime()));
        if (!isEditing) eventBus.emit('INVOICE_CREATED', { saleId: data._id });
        if (isChallan && data?._id) {
          printDeliveryChallan(data, { name: shopName, gstin: shopGstin, address: shopAddress, phone: '', logo: null });
          fetch(apiUrl(`/api/sales/${data._id}/mark-dispatched`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).catch(() => {});
        }
        /* Record last sale for duplicate detection */
        try {
          localStorage.setItem(LAST_SALE_KEY, JSON.stringify({
            timestamp: Date.now(),
            totalAmount: billTotals.total,
            buyerPhone: form.buyer_phone || '',
            itemCount: validItems.length,
          }));
        } catch {}
        setShowModal(false); resetForm(); fetchAll();
      } else { setError(data.message || 'Failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  }

  async function handleSubmit(e, opts = {}) {
    e?.preventDefault();
    setError(''); setGstinTouched(true);
    if (!isChallanMode && form.payment_type === 'credit' && !form.buyer_name) { setError('Customer name is required for credit sales.'); return; }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
    const validItems = isChallanMode
      ? items.filter((i) => i.product_id && i.quantity)
      : items.filter((i) => i.product_id && i.quantity && (i._isFreeItem || i.price_per_unit));
    if (validItems.length === 0) { setError('Select at least one product.'); return; }

    /* ── Bug 2: Zero price guard ── */
    if (!isChallanMode) {
      const zeroItems = validItems.filter((i) => !i._isFreeItem && Number(i.price_per_unit) === 0);
      if (zeroItems.length > 0) {
        const prod = products.find((p) => p._id === zeroItems[0].product_id);
        setError(`${prod?.name || 'एक item'} की price ₹0 है। Free item है तो "Free" toggle करें।`);
        return;
      }
    }

    if (!isChallanMode) {
      for (const item of validItems) {
        const prod = products.find((p) => p._id === item.product_id);
        if (prod && Number(item.quantity) > (prod.quantity || 0)) { setError(prod.name + ': only ' + prod.quantity + ' items are available in stock.'); return; }
      }
    }

    /* ── Feature 5: Duplicate detection ── */
    if (!opts.skipDuplicateCheck) {
      try {
        const lastSale = JSON.parse(localStorage.getItem(LAST_SALE_KEY) || 'null');
        const now = Date.now();
        if (
          lastSale &&
          now - lastSale.timestamp < DUPLICATE_WINDOW_MS &&
          lastSale.totalAmount === billTotals.total &&
          lastSale.buyerPhone === (form.buyer_phone || '') &&
          lastSale.itemCount === validItems.length
        ) {
          setDuplicateWarning(true);
          return;
        }
      } catch {}
    }

    await _doSubmit(validItems);
  }

  /* Called when user confirms "yes, this is a new bill" on the duplicate warning dialog */
  const handleConfirmDuplicate = () => {
    setDuplicateWarning(false);
    const validItems = isChallanMode
      ? items.filter((i) => i.product_id && i.quantity)
      : items.filter((i) => i.product_id && i.quantity && (i._isFreeItem || i.price_per_unit));
    _doSubmit(validItems);
  };

  /* ── Effects ── */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const className = 'sales-modal-open';
    if (showModal) document.body.classList.add(className);
    else document.body.classList.remove(className);
    return () => document.body.classList.remove(className);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const timeoutId = window.setTimeout(() => buyerNameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timeoutId);
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return undefined;
    const onPointerDown = (event) => {
      if (customerComboRef.current && !customerComboRef.current.contains(event.target)) {
        if (setShowCustomerSuggestions) setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showModal, setShowCustomerSuggestions]);

  return {
    showModal, setShowModal,
    submitting,
    editingSaleId, setEditingSaleId,
    error, setError,
    items, setItems,
    form, setForm, updateForm,
    extraFields, setExtraFields,
    gstinTouched, setGstinTouched,
    supplyType,
    gstinValidation,
    documentType, setDocumentType,
    challanForm, setChallanForm,
    isChallanMode,
    gstinValue,
    gstinValid,
    showGstinError,
    showGstinLengthHint,
    billTotals,
    amountPaidNum,
    balanceDue,
    roundedBill,
    rowGST,
    duplicateWarning, setDuplicateWarning, handleConfirmDuplicate,
    amountPaidInputRef, buyerNameInputRef, customerComboRef, saleDateInputRef,
    resetForm,
    updateItem, updateItemQuantityBy, applyQuickQuantity, duplicateItem, addItem, removeItem,
    handleProductSelect,
    addOrIncrementProduct,
    loadBatchesFor, loadVariantsFor,
    handleBuyerGstinChange,
    handleSubmit,
    startEditSale,
    buildWhatsAppShareMessage,
  };
}
