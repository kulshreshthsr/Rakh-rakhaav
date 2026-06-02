'use client';
import { useState, useEffect } from 'react';
import { apiUrl } from '../../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);

const REFUND_MODES = [
  { value: 'cash',        label: '💵 Cash' },
  { value: 'upi',         label: '📱 UPI' },
  { value: 'bank',        label: '🏦 Bank Transfer' },
  { value: 'credit_note', label: '📋 Credit Note' },
];

const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

export default function SaleReturnModal({ sale, onClose, onSuccess }) {
  const [quantities, setQuantities]             = useState({});
  const [reason, setReason]                     = useState('');
  const [refundMode, setRefundMode]             = useState('cash');
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState('');
  const [maxReturnableMap, setMaxReturnableMap] = useState({});
  const [loadingMax, setLoadingMax]             = useState(true);

  const allItems = sale?.items?.length > 0
    ? sale.items
    : (sale?.product
      ? [{ product: sale.product, product_name: sale.product_name, quantity: sale.quantity, price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate }]
      : []);

  useEffect(() => {
    if (!sale?._id) return;
    setLoadingMax(true);
    fetch(apiUrl(`/api/sale-returns/sale/${sale._id}`), {
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
          maxMap[pid] = Math.max(0, Number(item.quantity || 0) - (alreadyReturned[pid] || 0));
        }
        setMaxReturnableMap(maxMap);
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
  }, [sale?._id]);

  const handleQtyChange = (pid, value) => {
    setQuantities(q => ({ ...q, [pid]: Math.max(0, Math.min(Number(value) || 0, maxReturnableMap[pid] || 0)) }));
  };

  const selectedItems = allItems
    .filter(item => (quantities[String(item.product?._id || item.product)] || 0) > 0)
    .map(item => { const pid = String(item.product?._id || item.product); return { ...item, _pid: pid, _qty: quantities[pid] }; });

  const previewTotal = selectedItems.reduce((sum, item) => {
    const taxable = item._qty * Number(item.price_per_unit || 0);
    return sum + taxable + (taxable * Number(item.gst_rate || 0)) / 100;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (selectedItems.length === 0) { setError('Please enter a return quantity for at least one item.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/sale-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          sale_id:     sale._id,
          refund_mode: refundMode,
          reason,
          items: selectedItems.map(item => ({ product_id: item._pid, quantity: item._qty, price_per_unit: item.price_per_unit, gst_rate: item.gst_rate })),
        }),
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

  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pt-4 pb-20 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] sm:max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-[17px] font-black text-slate-900">Sale Return</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Invoice: <span className="font-mono font-bold text-green-700">{sale.invoice_number}</span>
              {sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' && <span> · {sale.buyer_name}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-lg font-bold">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* Items */}
            <div>
              <p className="text-[12px] font-black text-slate-500 uppercase tracking-wider mb-3">Return Quantities</p>
              {loadingMax ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {allItems.map(item => {
                    const pid = String(item.product?._id || item.product);
                    const max = maxReturnableMap[pid] ?? 0;
                    return (
                      <div key={pid} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${(quantities[pid] || 0) > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{item.product_name}</p>
                          <p className="text-[11px] text-slate-400">
                            ₹{fmt(item.price_per_unit)} · GST {item.gst_rate || 0}%
                            {max === 0 ? ' · fully returned' : ` · max ${max}`}
                          </p>
                        </div>
                        <input type="number" min={0} max={max} step={1}
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
              <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2">Refund Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {REFUND_MODES.map(m => (
                  <button key={m.value} type="button" onClick={() => setRefundMode(m.value)}
                    className={`h-10 rounded-xl text-[12px] font-bold border-2 transition-all ${refundMode === m.value ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2">Reason (optional)</label>
              <input type="text" className={INPUT} placeholder="e.g. Defective product, wrong size..."
                value={reason} onChange={e => setReason(e.target.value)} />
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
                <span className="font-black">!</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer — always visible */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting || loadingMax || selectedItems.length === 0}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[13px] font-black shadow-md shadow-amber-500/20 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0 transition-all">
              {submitting ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
