'use client';
import { useState } from 'react';
import WorkflowStatusBadge from '../../../components/WorkflowStatusBadge';
import { printDeliveryChallan } from '../../../lib/generateChallan';
import RecurringInvoiceModal from './RecurringInvoiceModal';

const PAY_BADGE = {
  cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '💵 Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 उधार' },
  upi:    { cls: 'bg-green-50 text-green-700 border-green-200',        label: '📱 UPI'  },
  bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: '🏦 Bank' },
};

const PayBadge = ({ type }) => {
  const s = PAY_BADGE[type] || PAY_BADGE.cash;
  const pillMap = { cash: 'rr-pill-green', credit: 'rr-pill-rose', upi: 'rr-pill-green', bank: 'rr-pill-blue' };
  return <span className={`rr-pill ${pillMap[type] || 'rr-pill-slate'}`}>{s.label}</span>;
};

const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'failed')    return { label: 'Sync failed', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (status === 'abandoned') return { label: 'Sync retry needed', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Sync pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
};

export default function SaleCard({
  s,
  businessType,
  config,
  wfc,
  shopName,
  shopGstin,
  shopAddress,
  shopPhone,
  fmt,
  formatFullDateTime,
  getDefaultSaleDateValue,
  INPUT,
  apiUrl,
  getToken,
  printInvoice,
  shareWhatsApp,
  startEditSale,
  handleDelete,
  advanceWorkflowStage,
  fetchAll,
  fetchSales,
  setDeliveredChallan,
  setDeliveredForm,
  setShowDeliveredModal,
  onReturnClick,
}) {
  const meta = s._isOffline ? getOfflineBadgeMeta(s._queueStatus) : null;
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  const accentCls = s._isOffline ? 'accent-amber' : s.payment_type === 'credit' ? 'accent-amber' : 'accent-green';
  return (
    <>
      <div className={`rr-accent-card ${accentCls} group transition-all duration-200 hover:-translate-y-[2px]`}>

        {/* Offline banner */}
        {s._isOffline && (
          <div className={`flex items-center gap-2 px-4 py-2 border-b text-[11px] font-black ${meta.color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {meta.label}
            {s._queueError && <span className="font-normal text-rose-600 ml-1">{s._queueError}</span>}
          </div>
        )}

        <div className="relative p-5">
          {/* Top row */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[13px] font-black text-green-700">{s.invoice_number}</span>
                {s.document_type === 'challan' && (() => {
                  const statusMap = {
                    draft:      { cls: 'bg-slate-100 border-slate-300 text-slate-600',   label: '📋 Draft' },
                    dispatched: { cls: 'bg-blue-100 border-blue-300 text-blue-700',       label: '🚚 Dispatched' },
                    delivered:  { cls: 'bg-green-100 border-green-300 text-green-700',    label: '✓ Delivered' },
                    returned:   { cls: 'bg-red-100 border-red-300 text-red-700',           label: '↩️ Returned' },
                    converted:  { cls: 'bg-purple-100 border-purple-300 text-purple-700', label: '📄 Converted' },
                  };
                  const st = statusMap[s.challan_status] || statusMap.draft;
                  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${st.cls}`}>{st.label}</span>;
                })()}
              </div>
              <p className="text-[15px] font-bold text-slate-700 mt-0.5">{s.buyer_name || 'Walk-in Customer'}</p>
            </div>
            <span className="rr-big-num text-[22px] text-slate-900">
              <span className="rr-currency-sym text-slate-500">₹</span>{fmt(s.total_amount)}
            </span>
          </div>

          {/* Items summary + payment badge */}
          <div className="flex gap-2 mb-4 text-[12px]">
            <span className="text-slate-500">
              {s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name || s.items?.[0]?.product_name || '—'}
            </span>
            <PayBadge type={s.payment_type} />
          </div>

          {/* Info chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">Taxable ₹{fmt(s.taxable_amount)}</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-600">GST ₹{fmt(s.total_gst)}</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">{formatFullDateTime(s.createdAt || s.sold_at)}</span>
          </div>

          {/* Workflow badge */}
          {wfc && !s._isOffline && (
            <div className="mb-4">
              <WorkflowStatusBadge sale={s} wfc={wfc} onAdvance={advanceWorkflowStage} />
            </div>
          )}

          {/* Invoice-level extra field chips */}
          {config.invoiceExtraFields && config.invoiceExtraFields.length > 0 && s.extra_fields && (() => {
            const chips = config.invoiceExtraFields.map(f => ({ label: f.label, value: s.extra_fields?.[f.key] })).filter(c => c.value);
            if (!chips.length) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {chips.map(chip => (
                  <span key={chip.label} className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-600">
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Per-line field chips */}
          {config.invoiceLineFields && config.invoiceLineFields.length > 0 && s.items?.length === 1 && (() => {
            const meta = s.items[0]?.item_metadata || {};
            const chips = config.invoiceLineFields.map(f => ({ label: f.label, value: meta[f.key] })).filter(c => c.value);
            if (!chips.length) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {chips.map(chip => (
                  <span key={chip.label} className="px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100 text-[11px] font-semibold text-violet-600">
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Main action buttons */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-5 gap-2">
            <button onClick={() => startEditSale(s)} disabled={Boolean(s._isOffline)}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all"
            >✏️ Edit</button>
            <button onClick={() => printInvoice(s)} disabled={Boolean(s._isOffline)}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all"
            >🖨️ Print</button>
            <button onClick={() => shareWhatsApp(s)} disabled={Boolean(s._isOffline)}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-all"
            >📤 Send</button>
            <button onClick={() => onReturnClick && onReturnClick(s)} disabled={Boolean(s._isOffline)} title="Process a return for this sale"
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-all"
            >↩️ Return</button>
            <button onClick={() => handleDelete(s)}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all"
            >{s._isOffline ? '✕' : '🗑️'}</button>
          </div>

          {/* Feature 4: Recurring invoice button */}
          {!s._isOffline && (!s.sale_type || s.sale_type === 'sale') && (
            <div className="mt-2">
              <button type="button" onClick={() => setShowRecurringModal(true)}
                className="w-full min-h-[38px] py-2 rounded-xl border-2 border-violet-200 bg-violet-50 text-[11px] font-bold text-violet-700 hover:bg-violet-100 transition-all">
                🔁 Set as Recurring
              </button>
            </div>
          )}

          {/* Quotation actions */}
          {s.document_type === 'quotation' && !s._isOffline && (
            <div className="mt-2">
              {!s.converted_to_invoice ? (
                <button onClick={async () => {
                  if (!confirm(`Convert Quotation ${s.invoice_number} to a Tax Invoice?\n\nThis will generate an invoice number and deduct stock.\n\nContinue?`)) return;
                  try {
                    const r = await fetch(apiUrl(`/api/sales/${s._id}/convert-quotation`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } });
                    const d = await r.json();
                    if (!r.ok) { alert(d.message || 'Conversion failed'); return; }
                    fetchAll();
                    if (d.invoice) printInvoice(d.invoice);
                  } catch { alert('Server error'); }
                }} className="w-full min-h-[38px] py-2 rounded-xl border-2 border-violet-200 bg-violet-50 text-[11px] font-bold text-violet-700 hover:bg-violet-100 transition-all">
                  📄 Convert to Invoice →
                </button>
              ) : (
                <p className="text-center text-[10px] font-bold text-violet-600 py-1">✓ Converted → {s.converted_to_invoice}</p>
              )}
            </div>
          )}

          {/* E-Way Bill */}
          {!s._isOffline && (s.ewb_status === 'pending' || s.ewb_status === 'generated') && (
            <div className="mt-2">
              {s.ewb_status === 'pending' && (
                <button onClick={async () => {
                  if (!confirm(`Generate E-Way Bill for ${s.invoice_number}?\n\nThis will call the NIC EWB API and requires valid credentials in server config.`)) return;
                  try {
                    const r = await fetch(apiUrl(`/api/sales/${s._id}/generate-ewb`), { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
                    const d = await r.json();
                    if (!r.ok) { alert(d.message || 'EWB generation failed'); return; }
                    alert(`E-Way Bill generated!\nEWB No: ${d.ewb_number}\nValid until: ${d.ewb_valid_until ? new Date(d.ewb_valid_until).toLocaleDateString() : 'N/A'}`);
                    fetchAll();
                  } catch { alert('Server error'); }
                }} className="w-full min-h-[38px] py-2 rounded-xl border-2 border-orange-200 bg-orange-50 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition-all">
                  🛣️ Generate E-Way Bill
                </button>
              )}
              {s.ewb_status === 'generated' && (
                <div className="rounded-xl border-2 border-orange-200 bg-orange-50 px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-orange-700">E-Way Bill</span>
                    <span className="text-[10px] font-bold text-emerald-700">✓ Generated</span>
                  </div>
                  <p className="text-xs font-black text-slate-800">{s.ewb_number}</p>
                  {s.ewb_valid_until && <p className="text-[10px] text-slate-500">Valid till {new Date(s.ewb_valid_until).toLocaleDateString()}</p>}
                  <button onClick={async () => {
                    const reason = prompt('Cancellation reason:\n1. Duplicate\n2. Order Cancelled\n3. Data Entry Mistake\n4. Others\n\nEnter reason:') || 'Others';
                    try {
                      const r = await fetch(apiUrl(`/api/sales/${s._id}/cancel-ewb`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ reason }) });
                      const d = await r.json();
                      if (!r.ok) { alert(d.message || 'Cancellation failed'); return; }
                      alert('E-Way Bill cancelled.');
                      fetchAll();
                    } catch { alert('Server error'); }
                  }} className="w-full min-h-[32px] py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-600 hover:bg-rose-100 transition-all">
                    Cancel EWB
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Challan actions */}
          {s.document_type === 'challan' && !s._isOffline && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => printDeliveryChallan(s, { name: shopName, gstin: shopGstin, address: shopAddress, phone: shopPhone, logo: null })}
                  className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all">
                  🖨️ Print Challan
                </button>
                {s.challan_status !== 'delivered' && s.challan_status !== 'converted' && (
                  <button onClick={() => { setDeliveredChallan(s); setDeliveredForm({ received_by: '', received_at: getDefaultSaleDateValue(), notes: '' }); setShowDeliveredModal(true); }}
                    className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-all">
                    ✓ Mark Delivered
                  </button>
                )}
              </div>
              {!s.converted_to_invoice && s.challan_status !== 'converted' && (
                <button onClick={async () => {
                  if (!confirm(`Convert Challan ${s.challan_number || s.invoice_number} to a Tax Invoice?\n\nThis will:\n• Generate a proper invoice number\n• Deduct stock from inventory\n• Allow price editing\n\nContinue?`)) return;
                  try {
                    const r = await fetch(apiUrl(`/api/sales/${s._id}/convert-to-invoice`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } });
                    const d = await r.json();
                    if (!r.ok) { alert(d.message || 'Conversion failed'); return; }
                    fetchAll();
                    if (d.invoice) printInvoice(d.invoice);
                  } catch { alert('Server error'); }
                }} className="w-full min-h-[38px] py-2 rounded-xl border-2 border-purple-200 bg-purple-50 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-all">
                  📄 Convert to Tax Invoice →
                </button>
              )}
              {s.converted_to_invoice && (
                <p className="text-center text-[10px] font-bold text-purple-600 py-1">✓ Converted to Invoice</p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Feature 4: Recurring invoice modal */}
      {showRecurringModal && (
        <RecurringInvoiceModal
          sale={s}
          onClose={() => setShowRecurringModal(false)}
          onSaved={() => setShowRecurringModal(false)}
        />
      )}
    </>
  );
}
