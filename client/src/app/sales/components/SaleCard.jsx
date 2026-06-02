'use client';
import WorkflowStatusBadge from '../../../components/WorkflowStatusBadge';
import { printDeliveryChallan } from '../../../lib/generateChallan';

const PAY_BADGE = {
  cash:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '💵 Cash' },
  credit: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '📒 उधार' },
  upi:    { cls: 'bg-green-50 text-green-700 border-green-200',        label: '📱 UPI'  },
  bank:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: '🏦 Bank' },
};

const PayBadge = ({ type }) => {
  const s = PAY_BADGE[type] || PAY_BADGE.cash;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${s.cls}`}>{s.label}</span>;
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
  sendRepairReadyWhatsApp,
  printKOT,
  startEditSale,
  handleDelete,
  advanceWorkflowStage,
  fetchAll,
  fetchSales,
  setSplitSale,
  setShowSplitModal,
  setSplitMode,
  setSplitCount,
  setSplitAssignments,
  setDeliveredChallan,
  setDeliveredForm,
  setShowDeliveredModal,
  setExchangeSale,
  setExchangeReturned,
  setExchangeNewItems,
  setShowExchangeModal,
  onReturnClick,
}) {
  const meta = s._isOffline ? getOfflineBadgeMeta(s._queueStatus) : null;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-[2px] ${s._isOffline ? 'border-amber-200 shadow-[0_2px_8px_rgba(245,158,11,0.1)]' : 'border-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)] hover:border-slate-300/80'}`}>
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-emerald-50/0 group-hover:from-green-50/50 group-hover:to-emerald-50/30 transition-all pointer-events-none" />

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
                  draft:       { cls: 'bg-slate-100 border-slate-300 text-slate-600',   label: '📋 Draft' },
                  dispatched:  { cls: 'bg-blue-100 border-blue-300 text-blue-700',       label: '🚚 Dispatched' },
                  delivered:   { cls: 'bg-green-100 border-green-300 text-green-700',    label: '✓ Delivered' },
                  returned:    { cls: 'bg-red-100 border-red-300 text-red-700',           label: '↩️ Returned' },
                  converted:   { cls: 'bg-purple-100 border-purple-300 text-purple-700', label: '📄 Converted' },
                };
                const st = statusMap[s.challan_status] || statusMap.draft;
                return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${st.cls}`}>{st.label}</span>;
              })()}
            </div>
            <p className="text-[15px] font-bold text-slate-700 mt-0.5">
              {s.buyer_name || 'Walk-in Customer'}
            </p>
          </div>
          <div className="text-[22px] font-black text-green-700">₹{fmt(s.total_amount)}</div>
        </div>

        {/* Items summary + payment badge */}
        <div className="flex gap-2 mb-4 text-[12px]">
          <span className="text-slate-500">
            {s.items && s.items.length > 1
              ? `${s.items.length} items`
              : s.product_name || s.items?.[0]?.product_name || '—'}
          </span>
          <PayBadge type={s.payment_type} />
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-500">
            Taxable ₹{fmt(s.taxable_amount)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-600">
            GST ₹{fmt(s.total_gst)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
            {formatFullDateTime(s.createdAt || s.sold_at)}
          </span>
        </div>

        {/* Workflow status badge + one-tap stage actions */}
        {wfc && !s._isOffline && (
          <div className="mb-4">
            <WorkflowStatusBadge
              sale={s}
              wfc={wfc}
              onAdvance={advanceWorkflowStage}
            />
          </div>
        )}

        {/* Invoice-level extra field chips (restaurant: Table/Order Type, automobile: Vehicle No/Model…) */}
        {config.invoiceExtraFields && config.invoiceExtraFields.length > 0 && s.extra_fields && (() => {
          const chips = config.invoiceExtraFields
            .map(f => ({ label: f.label, value: s.extra_fields?.[f.key] }))
            .filter(c => c.value);
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

        {/* Per-line field chips for single-item sales (pharmacy: Batch/Expiry, clothing: Size/Color…) */}
        {config.invoiceLineFields && config.invoiceLineFields.length > 0 && s.items?.length === 1 && (() => {
          const meta = s.items[0]?.item_metadata || {};
          const chips = config.invoiceLineFields
            .map(f => ({ label: f.label, value: meta[f.key] }))
            .filter(c => c.value);
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

        {/* Action buttons */}
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
          <button
            onClick={() => onReturnClick && onReturnClick(s)}
            disabled={Boolean(s._isOffline)}
            title="Process a return for this sale"
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-all"
          >↩️ Return</button>
          <button onClick={() => handleDelete(s)}
            className="min-h-[44px] py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all"
          >{s._isOffline ? '✕' : '🗑️'}</button>
        </div>

        {/* Restaurant extra actions */}
        {businessType === 'restaurant' && !s._isOffline && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => printKOT(s)}
              className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-orange-200 bg-orange-50 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition-all"
            >🖨️ KOT</button>
            <button onClick={() => { setSplitSale(s); setShowSplitModal(true); setSplitMode('equal'); setSplitCount(2); setSplitAssignments({}); }}
              className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-purple-200 bg-purple-50 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-all"
            >✂️ Split Bill</button>
          </div>
        )}

        {/* Challan actions — reprint + mark delivered + convert to invoice */}
        {s.document_type === 'challan' && !s._isOffline && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              {/* Reprint 3-copy challan */}
              <button onClick={() => printDeliveryChallan(s, { name: shopName, gstin: shopGstin, address: shopAddress, phone: shopPhone, logo: null })}
                className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all">
                🖨️ Print Challan
              </button>
              {/* Mark Delivered */}
              {s.challan_status !== 'delivered' && s.challan_status !== 'converted' && (
                <button onClick={() => { setDeliveredChallan(s); setDeliveredForm({ received_by: '', received_at: getDefaultSaleDateValue(), notes: '' }); setShowDeliveredModal(true); }}
                  className="flex-1 min-h-[38px] py-2 rounded-xl border-2 border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-all">
                  ✓ Mark Delivered
                </button>
              )}
            </div>
            {/* Convert to Invoice */}
            {!s.converted_to_invoice && s.challan_status !== 'converted' && (
              <button onClick={async () => {
                if (!confirm(`Convert Challan ${s.challan_number || s.invoice_number} to a Tax Invoice?\n\nThis will:\n• Generate a proper invoice number\n• Deduct stock from inventory\n• Allow price editing\n\nContinue?`)) return;
                try {
                  const r = await fetch(apiUrl(`/api/sales/${s._id}/convert-to-invoice`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                  });
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

        {/* Repair shop: advance/balance summary + notify button */}
        {businessType === 'repair_shop' && !s._isOffline && (() => {
          const ef = s.extra_fields instanceof Map ? Object.fromEntries(s.extra_fields) : (s.extra_fields || {});
          const adv = parseFloat(ef.advance_collected || 0);
          const bal = parseFloat(ef.balance_on_delivery || 0);
          const status = ef.workflow_status;
          return (
            <div className="mt-2 space-y-2">
              {(adv > 0 || bal > 0) && (
                <div className={`flex gap-3 px-3 py-2 rounded-xl ${status === 'ready' ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                  {adv > 0 && <span className="text-[11px] font-bold text-slate-600">Adv: ₹{adv.toFixed(2)}</span>}
                  {bal > 0 && <span className={`text-[11px] font-bold ${status === 'ready' ? 'text-green-700' : 'text-amber-700'}`}>
                    {status === 'ready' ? `Collect ₹${bal.toFixed(2)} on delivery` : `Bal: ₹${bal.toFixed(2)}`}
                  </span>}
                </div>
              )}
              {status === 'ready' && s.buyer_phone && (
                <button onClick={() => sendRepairReadyWhatsApp(s)}
                  className="w-full min-h-[38px] py-2 rounded-xl border-2 border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-all">
                  📱 Notify Customer (WhatsApp)
                </button>
              )}
            </div>
          );
        })()}

        {/* Clothing exchange action */}
        {businessType === 'clothing' && !s._isOffline && (!s.sale_type || s.sale_type === 'sale') && (
          <div className="mt-2">
            <button onClick={() => {
              const returned = (s.items || []).map(item => ({
                product_id: item.product?._id || item.product || '',
                product_name: item.product_name || '',
                quantity: item.quantity || 1,
                price: item.price_per_unit || 0,
                size: (() => { const m = item.item_metadata || {}; return m instanceof Map ? (m.get('size') || '') : (m.size || ''); })(),
                color: (() => { const m = item.item_metadata || {}; return m instanceof Map ? (m.get('color') || '') : (m.color || ''); })(),
                selected: true,
              }));
              setExchangeSale(s);
              setExchangeReturned(returned);
              setExchangeNewItems([{ product_id: '', product_name: '', quantity: 1, price: 0, size: '', color: '' }]);
              setShowExchangeModal(true);
            }}
              className="w-full min-h-[38px] py-2 rounded-xl border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-all"
            >↩ Exchange / Return</button>
          </div>
        )}
      </div>
    </div>
  );
}
