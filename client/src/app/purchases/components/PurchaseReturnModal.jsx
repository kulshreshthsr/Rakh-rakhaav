'use client';
import { useState, useEffect } from 'react';
import { apiUrl } from '../../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);

const REFUND_MODES = [
  { value: 'adjust', label: 'Adjust Against Next Purchase' },
  { value: 'cash',   label: 'Cash Refund' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'upi',    label: 'UPI' },
];

const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

export default function PurchaseReturnModal({ purchase, onClose, onSuccess }) {
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [refundMode, setRefundMode] = useState('adjust');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialise max-returnable quantities by fetching existing returns
  const [maxReturnableMap, setMaxReturnableMap] = useState({});
  const [loadingMax, setLoadingMax] = useState(true);

  const allItems = purchase?.items?.length > 0
    ? purchase.items
    : (purchase?.product
      ? [{ product: purchase.product, product_name: purchase.product_name, quantity: purchase.quantity, price_per_unit: purchase.price_per_unit, gst_rate: purchase.gst_rate }]
      : []);

  useEffect(() => {
    if (!purchase?._id) return;
    setLoadingMax(true);
    fetch(apiUrl(`/api/purchase-returns/purchase/${purchase._id}`), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(existingReturns => {
        const alreadyReturned = {};
        if (Array.isArray(existingReturns)) {
          for (const ret of existingReturns) {
            for (const item of ret.items || []) {
              const pid = String(item.product?._id || item.product);
              alreadyReturned[pid] = (alreadyReturned[pid] || 0) + Number(item.quantity || 0);
            }
          }
        }
        const maxMap = {};
        for (const item of allItems) {
          const pid = String(item.product?._id || item.product);
          const original = Number(item.quantity || 0);
          const returned = alreadyReturned[pid] || 0;
          maxMap[pid] = Math.max(0, original - returned);
        }
        setMaxReturnableMap(maxMap);
        // Default quantity to 0 for each item
        const init = {};
        for (const item of allItems) {
          const pid = String(item.product?._id || item.product);
          init[pid] = 0;
        }
        setQuantities(init);
      })
      .catch(() => setError('Could not load return history'))
      .finally(() => setLoadingMax(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?._id]);

  const handleQtyChange = (pid, value) => {
    const num = Math.max(0, Math.min(Number(value) || 0, maxReturnableMap[pid] || 0));
    setQuantities(q => ({ ...q, [pid]: num }));
  };

  const selectedItems = allItems
    .filter(item => {
      const pid = String(item.product?._id || item.product);
      return (quantities[pid] || 0) > 0;
    })
    .map(item => {
      const pid = String(item.product?._id || item.product);
      return { ...item, _pid: pid, _qty: quantities[pid] };
    });

  const previewTotal = selectedItems.reduce((sum, item) => {
    const taxable = item._qty * Number(item.price_per_unit || 0);
    const gst = (taxable * Number(item.gst_rate || 0)) / 100;
    return sum + taxable + gst;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (selectedItems.length === 0) {
      setError('Please enter a return quantity for at least one item.');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        purchase_id: purchase._id,
        refund_mode: refundMode,
        reason,
        items: selectedItems.map(item => ({
          product_id: item._pid,
          quantity: item._qty,
          price_per_unit: item.price_per_unit,
          gst_rate: item.gst_rate,
        })),
      };
      const res = await fetch(apiUrl('/api/purchase-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Return failed'); return; }
      onSuccess(data);
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[17px] font-black text-slate-900">Purchase Return</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Bill: <span className="font-mono font-bold text-green-700">{purchase.invoice_number}</span>
              {purchase.supplier_name && <span> · {purchase.supplier_name}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[70vh]">
          <div className="px-6 py-5 space-y-5">

            {/* Items */}
            <div>
              <p className="text-[12px] font-black text-slate-500 uppercase tracking-wider mb-3">
                Return Quantities
              </p>
              {loadingMax ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {allItems.map((item) => {
                    const pid = String(item.product?._id || item.product);
                    const max = maxReturnableMap[pid] ?? 0;
                    return (
                      <div key={pid} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${(quantities[pid] || 0) > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{item.product_name}</p>
                          <p className="text-[11px] text-slate-400">
                            ₹{fmt(item.price_per_unit)} · GST {item.gst_rate || 0}% · max {max} returnable
                          </p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={max}
                          step={1}
                          value={quantities[pid] ?? 0}
                          onChange={e => handleQtyChange(pid, e.target.value)}
                          disabled={max === 0}
                          className="w-20 h-10 px-3 text-center rounded-xl border-2 border-slate-200 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500 disabled:opacity-40 disabled:bg-slate-100 transition-all"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Refund mode */}
            <div>
              <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2">
                Refund Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REFUND_MODES.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setRefundMode(m.value)}
                    className={`h-10 rounded-xl text-[12px] font-bold border-2 transition-all ${refundMode === m.value ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                className={INPUT}
                placeholder="e.g. Damaged goods, Wrong product..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            {/* Preview total */}
            {selectedItems.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[13px] font-bold text-amber-800">
                  {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} · Refund Amount
                </span>
                <span className="text-[18px] font-black text-amber-800">₹{fmt(previewTotal)}</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
                <span className="text-base leading-none">!</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-white disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingMax || selectedItems.length === 0}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[13px] font-black shadow-md shadow-amber-500/20 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0 transition-all"
            >
              {submitting ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
