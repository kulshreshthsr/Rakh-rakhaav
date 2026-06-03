'use client';
import SearchableProductSelect from '../../../components/SearchableProductSelect';
import DynamicFormField from '../../../components/DynamicFormField';
import ChallanSection from './ChallanSection';
import { summariseCartGST } from '../../../lib/gstValidation';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];
const QUICK_QUANTITY_OPTIONS = [1, 2, 5, 10];
const INPUT  = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';
const fmt    = (n) => parseFloat(n || 0).toFixed(2);
const GSTIN_LENGTH = 15;
const GSTIN_REGEX  = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

import { getRelativeTime } from '../../../lib/heldBills';

export default function SaleFormModal({
  showModal, setShowModal, resetForm,
  form, updateForm, items, setItems, extraFields, setExtraFields,
  editingSaleId, error, submitting, isChallanMode, gstinValue, gstinValidation,
  gstinTouched, showGstinError, showGstinLengthHint, billTotals, amountPaidNum,
  challanForm, setChallanForm, documentType, setDocumentType, supplyType,
  balanceDue, roundedBill, rowGST, scheduleWarning, invoicePreview,
  handleSubmit, addItem, removeItem, updateItem, updateItemQuantityBy, duplicateItem,
  applyQuickQuantity, handleProductSelect, loadBatchesFor, loadVariantsFor,
  handleBuyerGstinChange,
  contractors, selectedContractor, setSelectedContractor,
  contractorSearch, setContractorSearch, showContractorDrop, setShowContractorDrop,
  stylists, clientHistory, fetchClientHistory, clientMemberships,
  redemptionMembershipId, setRedemptionMembershipId,
  petProfiles, setPetProfiles,
  products, productBatches, productVariants,
  shopName, shopState, shopGstin, shopAddress, shopPhone,
  businessType, config, term, sSchema, activeTabs, barcodeEnabled,
  inv, batchSales, variantSales, serialSales, recipeSales,
  isOnline, onOpenBarcodeScanner, apiUrl, getToken,
  showCustomerInfo, setShowCustomerInfo, showMoreCustomerDetails, setShowMoreCustomerDetails,
  customerQuery, setCustomerQuery, showCustomerSuggestions, setShowCustomerSuggestions,
  filteredPastCustomers, selectPastCustomer,
  customerInfoVisible, customerSummary,
  buyerNameInputRef, amountPaidInputRef, customerComboRef, saleDateInputRef,
  heldBills = [], showHeldPicker = false, setShowHeldPicker,
  onHoldBill, onRestoreHeldBill, onRemoveHeldBill,
}) {
  const hasItems = items.some(i => i.product_id);
  return (
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
              <div className="flex items-center gap-2">
                {/* Held bills badge */}
                {heldBills.length > 0 && (
                  <button type="button" onClick={() => setShowHeldPicker(!showHeldPicker)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 text-[11px] font-black hover:bg-amber-100 transition-colors"
                  >⏸ {heldBills.length} held</button>
                )}
                {/* Hold button — only when there are items */}
                {!editingSaleId && hasItems && (
                  <button type="button" onClick={onHoldBill}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-400 text-amber-700 bg-amber-50 text-[11px] font-black hover:bg-amber-100 transition-colors"
                    title="Bill hold करें"
                  >⏸ Hold</button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>
            </div>

            {/* Held bills picker */}
            {showHeldPicker && heldBills.length > 0 && (
              <div className="mb-3 rounded-2xl border-2 border-amber-200 bg-amber-50/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200 bg-amber-50">
                  <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">⏸ Hold में रखे Bills</p>
                  <button type="button" onClick={() => setShowHeldPicker(false)} className="text-amber-600 text-lg leading-none">✕</button>
                </div>
                <div className="divide-y divide-amber-100 max-h-52 overflow-y-auto">
                  {heldBills.map((bill) => {
                    const itemCount = bill.items?.filter(i => i.product_id).length || 0;
                    const approxTotal = bill.items?.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.price_per_unit || 0)), 0) || 0;
                    const isOld = Date.now() - new Date(bill.savedAt).getTime() > 86400000;
                    return (
                      <div key={bill.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-black text-slate-900 truncate">{bill.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {itemCount} items · {getRelativeTime(bill.savedAt)}{isOld ? ' (पुराना)' : ''} · ~₹{fmt(approxTotal)}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => {
                            if (hasItems) {
                              if (window.confirm(`मौजूदा bill में ${items.filter(i => i.product_id).length} items हैं। इसे hold करके दूसरा restore करें?`)) {
                                onHoldBill();
                                setTimeout(() => onRestoreHeldBill(bill), 100);
                              }
                            } else { onRestoreHeldBill(bill); }
                          }}
                            className="px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-black hover:bg-green-700 transition-colors"
                          >↩ वापस</button>
                          <button type="button" onClick={() => onRemoveHeldBill(bill.id)}
                            className="px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-black hover:bg-rose-100 transition-colors"
                          >🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* ── Discount row (hidden for challan) ── */}
            {!isChallanMode && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-black text-slate-700">🏷️ Discount</span>
                  <div className="flex items-center gap-2">
                    {/* Mode toggles */}
                    {[{ id: 'flat', label: '₹ Flat' }, { id: 'percent', label: '% Percent' }].map((opt) => (
                      <button key={opt.id} type="button"
                        onClick={() => updateForm({ discount_type: form.discount_type === opt.id ? 'none' : opt.id, discount_value: '' })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors ${
                          form.discount_type === opt.id
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >{opt.label}</button>
                    ))}
                    {/* Value input */}
                    {form.discount_type !== 'none' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] text-slate-400">{form.discount_type === 'flat' ? '₹' : ''}</span>
                        <input
                          type="number" min="0"
                          max={form.discount_type === 'percent' ? 100 : undefined}
                          value={form.discount_value}
                          onChange={(e) => updateForm({ discount_value: e.target.value })}
                          placeholder="0"
                          className="w-20 h-9 px-2 text-[14px] font-black text-center rounded-xl border-2 border-green-400 bg-green-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                        />
                        {form.discount_type === 'percent' && <span className="text-[13px] text-slate-400">%</span>}
                      </div>
                    )}
                    {form.discount_type !== 'none' && (
                      <button type="button" onClick={() => updateForm({ discount_type: 'none', discount_value: '' })}
                        className="text-slate-400 hover:text-slate-600 text-lg leading-none transition-colors">✕</button>
                    )}
                  </div>
                </div>
                {billTotals.discountAmount > 0 && (
                  <p className="mt-1.5 text-right text-[12px] font-bold text-green-700">
                    - ₹{fmt(billTotals.discountAmount)} की छूट
                  </p>
                )}
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
                  billTotals.discountAmount > 0 ? { label: 'Subtotal',       val: `₹${fmt(billTotals.subtotal)}`,    cls: 'text-slate-300' } : null,
                  billTotals.discountAmount > 0 ? { label: `Discount${form.discount_type === 'percent' ? ` (${form.discount_value}%)` : ''}`, val: `- ₹${fmt(billTotals.discountAmount)}`, cls: 'text-green-400' } : null,
                  { label: 'Taxable Amount', val: `₹${fmt(billTotals.taxable)}`, cls: 'text-white' },
                  { label: 'Total GST',      val: `₹${fmt(billTotals.gst)}`,     cls: 'text-amber-400' },
                  { label: 'Round Off',      val: `${roundedBill.roundOff >= 0 ? '+' : ''}₹${fmt(roundedBill.roundOff)}`, cls: 'text-emerald-400' },
                ].filter(Boolean).map((row) => (
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
  );
}
