'use client';

/* Feature 1 — RCM and ITC-blocked callouts integrated into the summary */
export default function PurchaseSummary({
  billTotals,
  roundedBill,
  balanceDue,
  paymentType,
  amountPaid,
  onAmountPaidChange,
  fmt,
  isReverseCharge = false,
  itcEligible = true,
  itcBlockedReason = '',
}) {
  return (
    <>
      {/* Feature 1A — RCM information callout */}
      {isReverseCharge && billTotals.gst > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-base flex-shrink-0 mt-0.5">ℹ️</span>
          <div className="space-y-0.5">
            <p className="text-[12px] font-black text-blue-800">RCM Purchase</p>
            <p className="text-[11px] text-blue-700">
              GST: ₹{fmt(billTotals.gst)} — आपको यह amount government को directly pay करना होगा।
            </p>
            <p className="text-[11px] text-blue-600">
              ITC: ₹{fmt(billTotals.gst)} — यह credit तभी मिलेगा जब GST payment हो जाए।
            </p>
          </div>
        </div>
      )}

      {/* Feature 1B — ITC blocked callout */}
      {!itcEligible && itcBlockedReason && billTotals.gst > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200">
          <span className="text-base flex-shrink-0 mt-0.5">🚫</span>
          <div>
            <p className="text-[12px] font-black text-rose-800">ITC Blocked: {itcBlockedReason}</p>
            <p className="text-[11px] text-rose-600 mt-0.5">
              ₹{fmt(billTotals.gst)} tax इस purchase पर claim नहीं होगा।
            </p>
          </div>
        </div>
      )}

      {paymentType === 'credit' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
          <p className="text-[13px] font-black text-slate-900 mb-0.5">Advance Payment</p>
          <p className="text-[11px] text-slate-400 mb-3">Supplier ko abhi kitna payment diya?</p>
          <input
            className="h-11 w-full px-4 rounded-xl border border-rose-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
            type="number" step="0.01" min="0"
            placeholder={`Max ₹${fmt(billTotals.total)}`}
            value={amountPaid}
            onChange={(e) => onAmountPaidChange(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-100 border border-rose-200">
            <span className="text-[12px] font-bold text-rose-700">Balance Due</span>
            <span className="text-[16px] font-black text-rose-700">₹{fmt(balanceDue)}</span>
          </div>
        </div>
      )}

      {billTotals.total > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-400">Taxable Amount</span>
              <span className="font-bold text-white">₹{fmt(billTotals.taxable)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-400">{isReverseCharge ? 'GST (RCM — pay to govt)' : itcEligible ? 'Total GST / ITC' : 'Total GST (blocked)'}</span>
              <span className={`font-bold ${isReverseCharge ? 'text-blue-400' : itcEligible ? 'text-amber-400' : 'text-rose-400'}`}>
                ₹{fmt(billTotals.gst)}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-400">Round Off</span>
              <span className="font-bold text-emerald-400">{roundedBill.roundOff >= 0 ? '+' : ''}₹{fmt(roundedBill.roundOff)}</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline border-t border-slate-700 pt-3">
            <span className="text-[14px] font-black">Grand Total</span>
            <span className="text-[24px] font-black text-green-400">₹{fmt(billTotals.total)}</span>
          </div>
          {paymentType === 'credit' && (
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
              <span className="text-[12px] text-rose-300">Balance Due</span>
              <span className="text-[14px] font-black text-rose-400">₹{fmt(balanceDue)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
