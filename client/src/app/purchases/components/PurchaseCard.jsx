'use client';

const fmt = (n) => Number(n || 0).toFixed(2);

const formatFullDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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

export default function PurchaseCard({
  p,
  isHighlighted,
  sendPurchaseWhatsApp,
  startEditPurchase,
  handleDelete,
  onReturnClick,
}) {
  const meta = p._isOffline ? getOfflineBadgeMeta(p._queueStatus) : null;
  const itemLabel = p.items && p.items.length > 1 ? `${p.items.length} products` : p.product_name;
  const itemNames = p.items && p.items.length > 1 ? p.items.map((item) => item.product_name).join(', ') : p.product_name;

  const accentCls = p._isOffline ? 'accent-amber' : p.payment_type === 'credit' ? 'accent-amber' : 'accent-green';
  return (
    <div
      data-purchase-anchor={p._id}
      className={`rr-accent-card ${accentCls} group transition-all duration-200 hover:-translate-y-[2px] ${isHighlighted ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
    >

      {meta && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b text-[11px] font-black ${meta.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {meta.label}
          {p._queueError && <span className="font-normal text-rose-600 ml-1">{p._queueError}</span>}
        </div>
      )}

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <span className="font-mono text-[13px] font-black text-green-700">{p.invoice_number}</span>
            <p className="text-[15px] font-bold text-slate-700 truncate mt-0.5">{itemLabel}</p>
          </div>
          <span className="rr-big-num text-[20px] text-slate-900 ml-3">
            <span className="rr-currency-sym text-slate-500">₹</span>{fmt(p.total_amount)}
          </span>
        </div>

        <div className="flex gap-2 mb-4 text-[12px]">
          <span className="text-slate-500">
            {p.supplier_name ? `${p.supplier_name}` : 'Supplier not added'}
          </span>
          <PayBadge type={p.payment_type} />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
            {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-semibold text-emerald-700">
            ITC ₹{fmt(p.total_gst)}
          </span>
          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${(p.balance_due || 0) > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            {(p.balance_due || 0) > 0 ? `Due ₹${fmt(p.balance_due)}` : 'Paid'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
            {formatFullDateTime(p.createdAt || p.purchased_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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
            <div className="font-black text-emerald-700">₹{fmt(p.total_gst)}</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
            <div className="text-slate-400">Items</div>
            <div className="font-black text-slate-900 truncate">{itemNames}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => sendPurchaseWhatsApp(p)}
            disabled={!p.supplier_phone}
            title={p.supplier_phone ? `Send WhatsApp to ${p.supplier_phone}` : 'Supplier phone number not added'}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            📤 WA
          </button>
          <button
            type="button"
            onClick={() => startEditPurchase(p)}
            disabled={Boolean(p._isOffline)}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-green-300 hover:bg-green-50 disabled:opacity-40 transition-all"
          >
            ✏️ Edit
          </button>
          {!p._isOffline && p.payment_status !== 'unpaid' && (
            <button
              type="button"
              onClick={() => onReturnClick(p)}
              title="Process a return for this purchase"
              className="min-h-[44px] py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition-all"
            >
              ↩️ Return
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDelete(p)}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all"
          >
            {p._isOffline ? '✕' : '🗑️'}
          </button>
        </div>
      </div>
    </div>
  );
}
