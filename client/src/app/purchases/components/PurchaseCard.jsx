'use client';
import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';
import { apiUrl } from '../../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);

const formatFullDateTime = (value) => {
  try {
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const PAY_BADGE = {
  cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 Udhaar' },
  upi:    { cls: 'bg-violet-50 text-violet-700 border-violet-200',    label: '📱 UPI' },
  bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',          label: '🏦 Bank' },
};

const PayBadge = ({ type }) => {
  const pillMap = { cash: 'rr-pill-green', credit: 'rr-pill-rose', upi: 'rr-pill-violet', bank: 'rr-pill-blue' };
  const s = PAY_BADGE[type] || PAY_BADGE.cash;
  return <span className={`rr-pill ${pillMap[type] || 'rr-pill-slate'}`}>{s.label}</span>;
};

const getOfflineBadgeMeta = (status) => {
  if (status === 'syncing')   return { label: 'Syncing...', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'failed')    return { label: 'Sync failed', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (status === 'abandoned') return { label: 'Sync retry needed', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Sync pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
};

/* Feature 6 — GSTR-2B status config */
const GSTR2B_STATUS = {
  not_checked: { label: '2B: Pending',   cls: 'bg-slate-100 border-slate-200 text-slate-500' },
  matched:     { label: '✓ 2B Matched',  cls: 'bg-green-50 border-green-200 text-green-700'  },
  not_in_2b:   { label: '✗ Not in 2B',  cls: 'bg-rose-50 border-rose-200 text-rose-700'     },
  mismatch:    { label: '⚠ Mismatch',   cls: 'bg-amber-50 border-amber-200 text-amber-700'  },
};
const GSTR2B_OPTIONS = [
  { value: 'not_checked', label: 'Not Checked' },
  { value: 'matched',     label: '✓ Matched' },
  { value: 'not_in_2b',  label: '✗ Not in 2B' },
  { value: 'mismatch',   label: '⚠ Mismatch' },
];

/* Feature 4 — Due date badge logic */
function DueBadge({ dueDate, balanceDue }) {
  if (!dueDate || !balanceDue || Number(balanceDue) <= 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-[11px] font-black text-rose-700 animate-pulse">
        ⚠️ {Math.abs(diffDays)}d overdue
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
        Due: {due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ({diffDays}d)
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-lg bg-green-50 border border-green-100 text-[11px] font-semibold text-green-700">
      Due: {due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
    </span>
  );
}

export default function PurchaseCard({
  p,
  isHighlighted,
  sendPurchaseWhatsApp,
  handleEditPurchase,   /* Bug 4 — guarded edit (was startEditPurchase) */
  editLoadingId,        /* Bug 4 — spinner on loading card */
  handleDelete,
  onReturnClick,
}) {
  const { showToast } = useToast();
  const meta = p._isOffline ? getOfflineBadgeMeta(p._queueStatus) : null;

  /* Bug 2 Part B — product-deleted error */
  const isProductDeletedError = p._isOffline && p._queueStatus === 'failed' && (p._queueError || '').toLowerCase().includes('product not found');

  /* Feature 6 — GSTR-2B inline picker state */
  const [showGstr2bPicker, setShowGstr2bPicker] = useState(false);
  const [selectedGstr2bStatus, setSelectedGstr2bStatus] = useState(p.gstr2b_status || 'not_checked');
  const [updatingGstr2b, setUpdatingGstr2b] = useState(false);

  const handleGstr2bUpdate = async () => {
    setUpdatingGstr2b(true);
    try {
      const res = await fetch(apiUrl(`/api/purchases/${p._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ gstr2b_status: selectedGstr2bStatus, gstr2b_checked_at: new Date().toISOString() }),
      });
      if (res.ok) {
        showToast('GSTR-2B status updated', 'success');
        setShowGstr2bPicker(false);
      } else {
        showToast('Update failed. Please try again.', 'error');
      }
    } catch {
      showToast('Update failed. Please try again.', 'error');
    }
    setUpdatingGstr2b(false);
  };

  const itemLabel = p.items && p.items.length > 1 ? `${p.items.length} products` : p.product_name;
  const itemNames = p.items && p.items.length > 1 ? p.items.map((item) => item.product_name).join(', ') : p.product_name;
  const isPO = p.document_type === 'purchase_order';
  const gstr2bMeta = GSTR2B_STATUS[p.gstr2b_status || 'not_checked'];
  const isEditLoading = editLoadingId === p._id;

  const accentCls = p._isOffline ? 'accent-amber' : isPO ? 'accent-blue' : p.payment_type === 'credit' ? 'accent-amber' : 'accent-green';

  return (
    <div
      data-purchase-anchor={p._id}
      className={`rr-accent-card ${accentCls} group transition-all duration-200 hover:-translate-y-[2px] ${isHighlighted ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
    >
      {meta && !isProductDeletedError && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b text-[11px] font-black ${meta.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {meta.label}
          {p._queueError && <span className="font-normal text-rose-600 ml-1">{p._queueError}</span>}
        </div>
      )}

      {/* Bug 2 Part B — product deleted error */}
      {isProductDeletedError && (
        <div className="flex items-start gap-2 px-4 py-2.5 border-b text-[11px] font-semibold bg-rose-50 border-rose-200 text-rose-700">
          <span className="font-black">🗑</span>
          <div>
            <span className="font-black">Product deleted</span>
            <span className="block text-[10px] text-rose-500 mt-0.5">
              {p._queueError?.replace('Product not found:', '').trim() || 'Item'} अब available नहीं — please edit करें
            </span>
          </div>
        </div>
      )}

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[13px] font-black text-green-700">{p.invoice_number}</span>
              {/* Feature 3 — PO badge */}
              {isPO && (
                <span className="px-2 py-0.5 rounded-full border text-[10px] font-black bg-blue-100 border-blue-300 text-blue-700">📋 PO</span>
              )}
            </div>
            <p className="text-[15px] font-bold text-slate-700 truncate mt-0.5">{itemLabel}</p>
          </div>
          <span className="rr-big-num text-[20px] text-slate-900 ml-3">
            <span className="rr-currency-sym text-slate-500">₹</span>{fmt(p.total_amount)}
          </span>
        </div>

        <div className="flex gap-2 mb-4 text-[12px]">
          <span className="text-slate-500">{p.supplier_name ? p.supplier_name : 'Supplier not added'}</span>
          {!isPO && <PayBadge type={p.payment_type} />}
          {isPO && <span className="rr-pill rr-pill-blue">Purchase Order</span>}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
            {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
          </span>
          {!isPO && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-semibold text-emerald-700">
              ITC ₹{fmt(p.total_gst)}
            </span>
          )}
          {!isPO && (
            <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${(p.balance_due || 0) > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              {(p.balance_due || 0) > 0 ? `Due ₹${fmt(p.balance_due)}` : 'Paid'}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
            {formatFullDateTime(p.createdAt || p.purchased_at)}
          </span>
          {/* Feature 4 — Due date badge */}
          <DueBadge dueDate={p.due_date} balanceDue={p.balance_due} />
          {/* Feature 6 — GSTR-2B status pill */}
          {!p._isOffline && !isPO && (
            <button type="button" onClick={() => setShowGstr2bPicker((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors hover:opacity-80 ${gstr2bMeta.cls}`}
              title="Click to update GSTR-2B status"
            >
              {gstr2bMeta.label}
            </button>
          )}
        </div>

        {/* Feature 6 — GSTR-2B inline picker */}
        {showGstr2bPicker && !p._isOffline && (
          <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide">GSTR-2B Status Update</p>
            <div className="grid grid-cols-2 gap-2">
              {GSTR2B_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSelectedGstr2bStatus(opt.value)}
                  className={`py-2 rounded-xl border text-[11px] font-bold transition-all ${
                    selectedGstr2bStatus === opt.value ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleGstr2bUpdate} disabled={updatingGstr2b}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white text-[12px] font-black hover:-translate-y-0.5 disabled:opacity-60 transition-all">
                {updatingGstr2b ? 'Updating...' : 'Update Status'}
              </button>
              <button type="button" onClick={() => setShowGstr2bPicker(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div className="text-slate-400">Taxable</div>
            <div className="font-black text-slate-900">₹{fmt(p.taxable_amount)}</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div className="text-slate-400">{isPO ? 'Status' : 'Paid'}</div>
            <div className={`font-black ${isPO ? 'text-blue-700' : 'text-emerald-600'}`}>
              {isPO ? 'Open' : `₹${fmt(p.amount_paid)}`}
            </div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div className="text-slate-400">GST</div>
            <div className="font-black text-emerald-700">₹{fmt(p.total_gst)}</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div className="text-slate-400">Items</div>
            <div className="font-black text-slate-900 truncate">{itemNames}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`grid gap-2 ${isPO ? 'grid-cols-2 min-[480px]:grid-cols-3' : 'grid-cols-2 min-[480px]:grid-cols-4'}`}>
          {!isPO && (
            <button type="button" onClick={() => sendPurchaseWhatsApp(p)} disabled={!p.supplier_phone}
              title={p.supplier_phone ? `Send WhatsApp to ${p.supplier_phone}` : 'Supplier phone number not added'}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              📤 WA
            </button>
          )}
          {/* Bug 4 — Edit button with loading spinner */}
          <button type="button" onClick={() => handleEditPurchase(p)} disabled={Boolean(p._isOffline) || isEditLoading}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all">
            {isEditLoading ? (
              <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : '✏️ Edit'}
          </button>

          {/* Feature 3 — PO: Convert to Invoice button */}
          {isPO && !p._isOffline && (
            <button type="button" onClick={() => handleEditPurchase({ ...p, _convertToInvoice: true })}
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all">
              📄 → Invoice
            </button>
          )}

          {!p._isOffline && !isPO && p.payment_status !== 'unpaid' && (
            <button type="button" onClick={() => onReturnClick(p)} title="Process a return for this purchase"
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition-all">
              ↩️ Return
            </button>
          )}
          <button type="button" onClick={() => handleDelete(p)}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all">
            {p._isOffline ? '✕' : '🗑️'}
          </button>
        </div>
      </div>
    </div>
  );
}
