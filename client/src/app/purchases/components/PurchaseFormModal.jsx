'use client';
import { useState } from 'react';
import SearchableProductSelect from '../../../components/SearchableProductSelect';
import CameraBarcodeScanner from '../../../components/CameraBarcodeScanner';
import InlineProductForm from './InlineProductForm';
import PurchaseSummary from './PurchaseSummary';
import { ITC_BLOCKED_REASONS, RCM_CATEGORIES } from '../../../lib/gstValidation';
import { normalizeBarcode } from '../../../lib/constants';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];
const INPUT  = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';
const fmt    = (n) => Number(n || 0).toFixed(2);
const GSTIN_LENGTH = 15;

export default function PurchaseFormModal({
  showModal,
  resetModal,
  editingPurchaseId,
  term,
  form, updateForm,
  error,
  submitting,
  gstinValue,
  gstinTouched,
  showGstinError, showGstinLengthHint,
  handleSupplierGstinChange,
  items, setItems,
  products,
  updateItem, addItem, removeItem,
  openInlineProductForm,
  showInlineProductForm, inlineProductRowIndex,
  newProductForm, setNewProductForm,
  creatingProduct,
  resetInlineProductForm, createInlineProduct,
  calcRowGST,
  batchPurch, variantPurch, serialPurch, inv,
  billTotals, roundedBill, balanceDue,
  handleSubmit,
  isOnline,
  /* Bug 3 — RCM suggestion */
  rcmSuggestion, dismissRcmSuggestion, applyRcmFromSuggestion,
  /* Feature 3 — PO */
  documentType, setDocumentType,
  /* Feature 5 — duplicate */
  duplicateWarning, setDuplicateWarning, handleConfirmDuplicate,
}) {
  const gstinValid = !gstinValue || (gstinValue.length === GSTIN_LENGTH && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstinValue));

  /* Feature 2 — barcode scanner state */
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');

  const isPO = documentType === 'purchase_order';

  const handleBarcodeDetected = (detectedCode) => {
    const barcode = normalizeBarcode(detectedCode);
    const localMatch = products.find((p) => normalizeBarcode(p.barcode) === barcode);
    if (localMatch) {
      setBarcodeError('');
      setItems((current) => {
        const existingIndex = current.findIndex((item) => item.product_id === localMatch._id);
        if (existingIndex >= 0) {
          return current.map((item, i) => i === existingIndex ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1) } : item);
        }
        const emptyIndex = current.findIndex((item) => !item.product_id);
        const entry = { product_id: localMatch._id, quantity: 1, price_per_unit: localMatch.cost_price || localMatch.price || '', item_metadata: {} };
        if (emptyIndex >= 0) return current.map((item, i) => i === emptyIndex ? entry : item);
        return [...current, entry];
      });
    } else {
      setBarcodeError('Barcode का product नहीं मिला — manually search करें');
    }
  };

  return (
    <div className={`fixed inset-0 z-[70] transition-all duration-300 ${showModal ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="Close purchase modal overlay"
        onClick={resetModal}
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside className={`absolute inset-x-0 bottom-0 top-14 flex max-h-[calc(100dvh-56px)] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-3xl ${showModal ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}`}>

        <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-100 px-5 pt-3 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {editingPurchaseId ? term('editPurchase', 'Edit Purchase') : isPO ? 'Purchase Order' : term('newPurchase', 'New Purchase')}
              </p>
              <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                {editingPurchaseId ? term('editPurchase', 'Edit Purchase') : isPO ? '📋 Purchase Order' : term('newPurchase', 'Record Purchase')}
              </h3>
              <p className="text-[12px] text-slate-500 mt-1">
                {isPO ? 'Pre-order without payment — convert to invoice later.' : 'Ek compact form me items, payment aur supplier details.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Feature 2 — Barcode scanner button */}
              <button type="button" onClick={() => { setBarcodeError(''); setShowBarcodeScanner(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors"
                title="Barcode scan karke product add karein">
                📷
              </button>
              <button type="button" onClick={resetModal}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Close purchase modal">×</button>
            </div>
          </div>

          {/* Feature 3 — Document type toggle (Invoice vs PO) */}
          {!editingPurchaseId && (
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-2">
              {[{ id: 'invoice', label: '🧾 Invoice' }, { id: 'purchase_order', label: '📋 Purchase Order' }].map((d) => (
                <button key={d.id} type="button" onClick={() => setDocumentType(d.id)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-black transition-all ${documentType === d.id ? (d.id === 'purchase_order' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'text-slate-500 hover:text-slate-700'}`}
                >{d.label}</button>
              ))}
            </div>
          )}

          {/* Payment tabs — hidden for PO */}
          {!isPO && (
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
              {[
                { type: 'cash',   label: '💵 Cash',   active: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg' },
                { type: 'upi',    label: '📱 UPI',    active: 'bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg' },
                { type: 'bank',   label: '🏦 Bank',   active: 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg' },
                { type: 'credit', label: '📒 Udhaar', active: 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg' },
              ].map((opt) => (
                <button key={opt.type} type="button"
                  onClick={() => updateForm({ payment_type: opt.type, amount_paid: opt.type === 'credit' ? form.amount_paid : '' })}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-black tracking-wide transition-all ${form.payment_type === opt.type ? opt.active : 'text-slate-600 hover:text-slate-700'}`}
                >{opt.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
              <span className="text-base leading-none">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Barcode scan error */}
          {barcodeError && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-800">
              <span>📷</span>
              <span>{barcodeError}</span>
            </div>
          )}

          {/* Supplier section */}
          <div className={`rounded-2xl border p-4 ${!isPO && form.payment_type === 'credit' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-black text-slate-900">{term('supplierSection', 'Supplier Info')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {!isPO && form.payment_type === 'credit' ? 'Required for credit purchases' : 'Optional details for supplier record'}
                </p>
              </div>
              {!isPO && form.payment_type === 'credit' && (
                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-[10px] font-black text-rose-700 border border-rose-200">Required *</span>
              )}
            </div>

            <div className="space-y-3">
              <input className={INPUT} placeholder={term('supplierNamePlaceholder', 'Supplier ka naam')} value={form.supplier_name}
                onChange={(e) => updateForm({ supplier_name: e.target.value })} required={!isPO && form.payment_type === 'credit'} />
              <div className="grid grid-cols-2 gap-3">
                <input className={INPUT} placeholder={term('supplierPhonePlaceholder', 'Mobile number')} value={form.supplier_phone}
                  onChange={(e) => updateForm({ supplier_phone: e.target.value })} />
                <div>
                  <input className={INPUT} placeholder="Supplier GSTIN" value={form.supplier_gstin} maxLength={GSTIN_LENGTH}
                    onChange={(e) => handleSupplierGstinChange(e.target.value)} onBlur={() => {}} />
                  {showGstinError && <p className="mt-1 text-[11px] font-semibold text-rose-600">Invalid GSTIN format</p>}
                  {showGstinLengthHint && <p className="mt-1 text-[11px] text-slate-400">GSTIN should be 15 characters</p>}
                </div>
              </div>

              {/* Bug 3 — RCM suggestion banner */}
              {rcmSuggestion && (
                <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-base flex-shrink-0">💡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-amber-800">Supplier GSTIN नहीं है — क्या यह unregistered supplier से purchase है?</p>
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={applyRcmFromSuggestion}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-black hover:bg-amber-700 transition-colors">
                        हाँ, RCM लगाओ
                      </button>
                      <button type="button" onClick={dismissRcmSuggestion}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[11px] font-black hover:bg-amber-100 transition-colors">
                        नहीं, skip करो
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Purchase Date</label>
                  <input className={INPUT} type="date" value={form.purchase_date} onChange={(e) => updateForm({ purchase_date: e.target.value })} />
                </div>
                {!isPO && form.payment_type === 'credit' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-1 block">Payment Due Date</label>
                    <input className={INPUT} type="date" value={form.due_date || ''} onChange={(e) => updateForm({ due_date: e.target.value })} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select className={INPUT} value={form.supplier_state} onChange={(e) => updateForm({ supplier_state: e.target.value })}>
                    <option value="">Select State/UT</option>
                    <optgroup label="States">{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                    <optgroup label="Union Territories">{UTS.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                  </select>
                  {gstinValid && gstinValue.length >= 2 && form.supplier_state && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-600">State auto-detected from GSTIN</p>
                  )}
                </div>
              </div>

              <input className={INPUT} placeholder="Supplier address" value={form.supplier_address} onChange={(e) => updateForm({ supplier_address: e.target.value })} />

              {/* GST Compliance Fields — hidden for PO */}
              {!isPO && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Supplier Invoice Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1 block">Supplier Invoice No.</label>
                      <input className={INPUT} placeholder="Supplier's bill number" value={form.supplier_invoice_no}
                        onChange={(e) => updateForm({ supplier_invoice_no: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 mb-1 block">Supplier Invoice Date</label>
                      <input className={INPUT} type="date" value={form.supplier_invoice_date}
                        onChange={(e) => updateForm({ supplier_invoice_date: e.target.value })} />
                    </div>
                  </div>

                  {/* ITC Eligibility */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1.5">ITC Eligible?</p>
                    <div className="flex gap-2">
                      {[{ value: true, label: 'Yes — Eligible' }, { value: false, label: 'No — Blocked' }].map((opt) => (
                        <button key={String(opt.value)} type="button"
                          onClick={() => updateForm({ itc_eligible: opt.value, itc_blocked_reason: opt.value ? '' : form.itc_blocked_reason })}
                          className={`flex-1 py-2 rounded-xl border text-[12px] font-bold transition-all ${
                            form.itc_eligible === opt.value
                              ? opt.value ? 'border-green-500 bg-green-50 text-green-800' : 'border-rose-400 bg-rose-50 text-rose-800'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {form.itc_eligible === false && (
                      <select className={`${INPUT} mt-2`} value={form.itc_blocked_reason}
                        onChange={(e) => updateForm({ itc_blocked_reason: e.target.value })}>
                        <option value="">Select reason...</option>
                        {ITC_BLOCKED_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </div>

                  {/* Bug 3 Fix C — Reverse Charge with ITC auto-toggle */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1.5">Reverse Charge (RCM)?</p>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => updateForm({ is_reverse_charge: false, rcm_category: '', itc_eligible: !form.itc_blocked_reason })}
                        className={`flex-1 py-2 rounded-xl border text-[12px] font-bold transition-all ${
                          !form.is_reverse_charge ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >No</button>
                      <button type="button"
                        onClick={() => updateForm({ is_reverse_charge: true, rcm_category: form.rcm_category, itc_eligible: false })}
                        className={`flex-1 py-2 rounded-xl border text-[12px] font-bold transition-all ${
                          form.is_reverse_charge ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >Yes — RCM</button>
                    </div>
                    {form.is_reverse_charge && (
                      <>
                        <select className={`${INPUT} mt-2`} value={form.rcm_category}
                          onChange={(e) => updateForm({ rcm_category: e.target.value })}>
                          <option value="">Select RCM category...</option>
                          {RCM_CATEGORIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <p className="text-[11px] text-amber-700 mt-1.5">
                          ⚠️ RCM: You must pay GST to government directly. ITC claimable only after actual payment.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <input className={INPUT} placeholder="Any notes..." value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} />
            </div>
          </div>

          {/* Items section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-black text-slate-900">Items</p>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => {
                const rowGST = calcRowGST(item);
                const prod = products.find((p) => p._id === item.product_id);
                return (
                  <div key={item._rowId || index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Item {index + 1}</span>
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => openInlineProductForm(index)}
                          className="px-2.5 py-1 rounded-lg border border-green-200 bg-green-50 text-[10px] text-green-700 hover:bg-green-100 transition-colors">
                          + New Product
                        </button>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] text-rose-600 hover:bg-rose-100 transition-colors">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Product</p>
                      <SearchableProductSelect products={products} value={item.product_id}
                        onChange={(id) => updateItem(index, 'product_id', id)}
                        placeholder={term('searchProduct', 'Search product...')} />
                    </div>

                    {showInlineProductForm && inlineProductRowIndex === index && (
                      <InlineProductForm newProductForm={newProductForm} setNewProductForm={setNewProductForm}
                        creatingProduct={creatingProduct} onCancel={resetInlineProductForm}
                        onSubmit={createInlineProduct} INPUT={INPUT} />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Qty</p>
                        <input className={INPUT} type="number" min="1" placeholder="1"
                          value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} required />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cost Price (₹)</p>
                        <input className={INPUT} type="number" step="0.01" placeholder="0.00"
                          value={item.price_per_unit} onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)} required />
                      </div>
                    </div>

                    {prod && <div className="text-[11px] text-slate-500">GST {prod.gst_rate || 0}% {prod.hsn_code ? `• HSN ${prod.hsn_code}` : ''} {prod.unit ? `• ${prod.unit}` : ''}</div>}

                    {rowGST && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-100 text-[11px]">
                        <span className="text-slate-400">₹{fmt(rowGST.taxable)} + <span className="text-amber-600">₹{fmt(rowGST.gst)} GST</span></span>
                        <span className="font-black text-slate-900">= ₹{fmt(rowGST.total)}</span>
                      </div>
                    )}

                    {/* Batch fields */}
                    {batchPurch && prod && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{inv.batchLabel || 'Batch'} Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">Batch No. *</p>
                            <input className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] text-slate-800 focus:outline-none focus:border-green-600 bg-white placeholder-slate-400"
                              placeholder="e.g. BT2024001" value={(item.item_metadata || {}).batch_number || ''}
                              onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), batch_number: e.target.value } }; setItems(u); }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">{inv.expiryLabel || 'Expiry Date'}</p>
                            <input type="date" className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] text-slate-800 focus:outline-none focus:border-green-600 bg-white"
                              value={(item.item_metadata || {}).expiry_date || ''}
                              onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), expiry_date: e.target.value } }; setItems(u); }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">MRP (₹)</p>
                            <input type="number" step="0.01" className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] text-slate-800 focus:outline-none focus:border-green-600 bg-white placeholder-slate-400"
                              placeholder="0.00" value={(item.item_metadata || {}).mrp || ''}
                              onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), mrp: e.target.value } }; setItems(u); }} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1">Manufacturer</p>
                            <input className="h-9 w-full rounded-xl border-2 border-slate-200 px-3 text-[12px] text-slate-800 focus:outline-none focus:border-green-600 bg-white placeholder-slate-400"
                              placeholder="Company name" value={(item.item_metadata || {}).manufacturer || ''}
                              onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), manufacturer: e.target.value } }; setItems(u); }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Variant fields */}
                    {variantPurch && prod && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{inv.variantLabel || 'Variant'} Details</p>
                        <div className="flex gap-2">
                          {inv.variantDimensions?.includes('size') && inv.sizeOptions?.length > 0 && (
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 mb-0.5">Size</p>
                              <select className="h-9 w-full rounded-xl border-2 border-slate-200 px-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:border-green-600"
                                value={(item.item_metadata || {}).size || ''}
                                onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), size: e.target.value } }; setItems(u); }}>
                                <option value="">Size</option>
                                {inv.sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          )}
                          {inv.variantDimensions?.includes('color') && inv.colorOptions?.length > 0 && (
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 mb-0.5">Color</p>
                              <select className="h-9 w-full rounded-xl border-2 border-slate-200 px-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:border-green-600"
                                value={(item.item_metadata || {}).color || ''}
                                onChange={e => { const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), color: e.target.value } }; setItems(u); }}>
                                <option value="">Color</option>
                                {inv.colorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Serial fields */}
                    {serialPurch && prod && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{inv.serialLabel || 'Serial No.'} Numbers</p>
                        <textarea className="h-16 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-[12px] font-mono text-slate-800 focus:outline-none focus:border-green-600 bg-white placeholder-slate-400 resize-none"
                          placeholder="One serial per line or comma-separated"
                          value={((item.item_metadata || {}).serial_numbers || []).join('\n')}
                          onChange={e => { const vals = e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean); const u = [...items]; u[index] = { ...u[index], item_metadata: { ...(u[index].item_metadata || {}), serial_numbers: vals } }; setItems(u); }} />
                        <p className="text-[10px] text-slate-400">Each serial number will be added to stock</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addItem}
              className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-400 hover:border-cyan-300 hover:text-green-700 hover:bg-green-50/40 transition-all">
              + Add Another Product
            </button>
          </div>

          {/* Summary — hidden for PO */}
          {!isPO && (
            <PurchaseSummary
              billTotals={billTotals}
              roundedBill={roundedBill}
              balanceDue={balanceDue}
              paymentType={form.payment_type}
              amountPaid={form.amount_paid}
              onAmountPaidChange={(val) => updateForm({ amount_paid: val })}
              fmt={fmt}
              isReverseCharge={form.is_reverse_charge}
              itcEligible={form.itc_eligible}
              itcBlockedReason={form.itc_blocked_reason}
            />
          )}

          {/* PO value summary */}
          {isPO && billTotals.total > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-slate-800 p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-3">Order Value (No Payment Yet)</p>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-slate-300">Taxable</span>
                <span className="font-bold">₹{fmt(billTotals.taxable)}</span>
              </div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-slate-300">GST</span>
                <span className="text-amber-300 font-bold">₹{fmt(billTotals.gst)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-blue-700 pt-3">
                <span className="text-[14px] font-black">PO Total</span>
                <span className="text-[24px] font-black text-blue-300">₹{fmt(billTotals.total)}</span>
              </div>
            </div>
          )}
        </form>

        {/* Footer action bar */}
        <div className="rr-action-bar flex-shrink-0">
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all ${
              isPO ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-600/20' : 'bg-gradient-to-r from-green-600 to-emerald-700 shadow-green-600/20'
            }`}>
            {submitting ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
            ) : isPO ? '📋 Save Purchase Order'
              : !isOnline ? '📥 Offline Save'
              : editingPurchaseId ? `Update ${term('purchase', 'Purchase')}`
              : form.payment_type === 'credit' ? `Credit ${term('purchase', 'Purchase')}`
              : term('newPurchase', 'Record Purchase')}
          </button>
          <button type="button" onClick={resetModal}
            className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
        </div>
      </aside>

      {/* Feature 2 — Barcode scanner overlay */}
      <CameraBarcodeScanner
        open={showBarcodeScanner}
        title="Scan product barcode"
        description="Purchase item add karne ke liye barcode scan karein."
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={handleBarcodeDetected}
        continuous
      />

      {/* Feature 5 — Duplicate invoice warning dialog */}
      {duplicateWarning && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-[17px] font-black text-slate-900">Duplicate Invoice लग रहा है</h3>
              <p className="text-[13px] text-slate-500 mt-2">
                Supplier <strong>{duplicateWarning.supplierName}</strong> का invoice{' '}
                <strong>{duplicateWarning.invoiceNo}</strong> already{' '}
                <strong>{duplicateWarning.date}</strong> को ₹{Number(duplicateWarning.amount || 0).toFixed(2)} का enter हो चुका है।
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleConfirmDuplicate}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[14px] shadow-lg hover:-translate-y-0.5 transition-all">
                फिर भी Save करो
              </button>
              <button type="button" onClick={() => setDuplicateWarning(null)}
                className="w-full py-3 rounded-2xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel — वापस जाओ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
