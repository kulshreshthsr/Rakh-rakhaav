'use client';

export default function MarkDeliveredModal({
  deliveredChallan,
  deliveredForm,
  setDeliveredForm,
  onClose,
  onConfirm,
  INPUT,
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-black text-slate-900">Mark as Delivered</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                {deliveredChallan.challan_number || deliveredChallan.invoice_number} — {deliveredChallan.consignee_name || deliveredChallan.buyer_name}
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Received By *</p>
            <input className={INPUT} placeholder="Name of person who received the goods"
              value={deliveredForm.received_by}
              onChange={e => setDeliveredForm(p => ({ ...p, received_by: e.target.value }))} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Delivery Date</p>
            <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
              type="date" value={deliveredForm.received_at}
              onChange={e => setDeliveredForm(p => ({ ...p, received_at: e.target.value }))} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notes (optional)</p>
            <input className={INPUT} placeholder="Any delivery notes or observations"
              value={deliveredForm.notes}
              onChange={e => setDeliveredForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button type="button" onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-green-600 text-white text-[14px] font-black hover:bg-green-700 transition-colors"
          >✓ Confirm Delivery</button>
          <button type="button" onClick={onClose}
            className="px-5 py-3 rounded-2xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}
