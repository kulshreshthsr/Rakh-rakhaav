'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => Number(n || 0).toFixed(2);

const REFUND_MODES = [
  { value: 'cash',        label: '💵 Cash' },
  { value: 'upi',         label: '📱 UPI' },
  { value: 'bank',        label: '🏦 Bank Transfer' },
  { value: 'credit_note', label: '📋 Credit Note' },
];

const INPUT = 'h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 transition-all';

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────
function SaleReturnInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleId = searchParams.get('saleId');

  const [sale, setSale]                     = useState(null);
  const [existingReturns, setExistingReturns] = useState([]);
  const [loadingPage, setLoadingPage]       = useState(true);
  const [pageError, setPageError]           = useState('');

  const [quantities, setQuantities]         = useState({});
  const [refundMode, setRefundMode]         = useState('cash');
  const [reason, setReason]                 = useState('');
  const [notes, setNotes]                   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [successReturn, setSuccessReturn]   = useState(null);

  // ── Load sale + existing returns ────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!saleId) { setPageError('No sale ID provided.'); setLoadingPage(false); return; }
    setLoadingPage(true);
    setPageError('');
    try {
      const [saleRes, returnsRes] = await Promise.all([
        fetch(apiUrl(`/api/sales/${saleId}`),             { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(apiUrl(`/api/sale-returns/sale/${saleId}`), { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (!saleRes.ok) {
        const d = await saleRes.json().catch(() => ({}));
        setPageError(d.message || 'Could not load sale.');
        return;
      }
      const saleData    = await saleRes.json();
      const returnsData = returnsRes.ok ? await returnsRes.json() : [];
      setSale(saleData);
      setExistingReturns(Array.isArray(returnsData) ? returnsData : []);

      const allItems = saleData.items?.length > 0
        ? saleData.items
        : (saleData.product ? [{ product: { _id: saleData.product } }] : []);
      const init = {};
      for (const item of allItems) {
        const pid = String(item.product?._id || item.product);
        init[pid] = 0;
      }
      setQuantities(init);
    } catch {
      setPageError('Could not load sale data. Please try again.');
    } finally {
      setLoadingPage(false);
    }
  }, [saleId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const allItems = sale
    ? (sale.items?.length > 0
        ? sale.items
        : (sale.product ? [{
            product:       { _id: sale.product },
            product_name:  sale.product_name,
            quantity:      sale.quantity,
            price_per_unit: sale.price_per_unit,
            gst_rate:      sale.gst_rate,
          }] : []))
    : [];

  const maxReturnableMap = (() => {
    if (!sale) return {};
    const alreadyReturned = {};
    for (const ret of existingReturns) {
      for (const item of ret.items || []) {
        const pid = String(item.product?._id || item.product);
        alreadyReturned[pid] = (alreadyReturned[pid] || 0) + Number(item.quantity || 0);
      }
    }
    const map = {};
    for (const item of allItems) {
      const pid = String(item.product?._id || item.product);
      map[pid] = Math.max(0, Number(item.quantity || 0) - (alreadyReturned[pid] || 0));
    }
    return map;
  })();

  const everythingReturned = allItems.length > 0 && allItems.every(item => {
    const pid = String(item.product?._id || item.product);
    return (maxReturnableMap[pid] ?? 0) === 0;
  });

  const selectedItems = allItems.filter(item => {
    const pid = String(item.product?._id || item.product);
    return (quantities[pid] || 0) > 0;
  });

  const previewTotal = selectedItems.reduce((sum, item) => {
    const pid     = String(item.product?._id || item.product);
    const qty     = quantities[pid] || 0;
    const taxable = qty * Number(item.price_per_unit || 0);
    const gst     = (taxable * Number(item.gst_rate || 0)) / 100;
    return sum + taxable + gst;
  }, 0);

  const handleQtyChange = (pid, value) => {
    const max = maxReturnableMap[pid] ?? 0;
    setQuantities(q => ({ ...q, [pid]: Math.max(0, Math.min(Number(value) || 0, max)) }));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (selectedItems.length === 0) { setSubmitError('Enter a return quantity for at least one item.'); return; }
    setSubmitting(true);
    try {
      const body = {
        sale_id:     saleId,
        refund_mode: refundMode,
        reason,
        notes,
        items: selectedItems.map(item => {
          const pid = String(item.product?._id || item.product);
          return { product_id: pid, quantity: quantities[pid], price_per_unit: item.price_per_unit, gst_rate: item.gst_rate };
        }),
      };
      const res  = await fetch(apiUrl('/api/sale-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.message || 'Return failed.'); return; }
      setSuccessReturn(data);
    } catch {
      setSubmitError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successReturn) {
    return (
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-28">
        <div className="relative overflow-hidden rounded-2xl border-2 border-green-200 bg-gradient-to-br from-white via-green-50/40 to-emerald-50/40 p-8 shadow-lg text-center">
          <div className="pointer-events-none absolute -top-12 -right-8 w-40 h-40 rounded-full bg-green-200/30 blur-3xl" />
          <div className="relative">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-[22px] font-black text-slate-900 mb-2">Return Processed</h2>
            <p className="text-[14px] text-slate-600 mb-1">
              Return No.{' '}
              <span className="font-mono font-black text-green-700">{successReturn.return_number}</span>
            </p>
            <p className="text-[14px] text-slate-600 mb-6">
              Refund{' '}
              <span className="font-black text-green-700">₹{fmt(successReturn.total_amount)}</span>
              {' · '}
              {REFUND_MODES.find(m => m.value === successReturn.refund_mode)?.label || successReturn.refund_mode}
            </p>

            <div className="text-left mb-6 space-y-2">
              {successReturn.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-green-50 border border-green-100">
                  <span className="text-[13px] font-bold text-slate-800">{item.product_name}</span>
                  <span className="text-[13px] font-black text-green-700">
                    {item.quantity} × ₹{fmt(item.price_per_unit)} = ₹{fmt(item.total_amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => router.push('/sales')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-black shadow-md hover:-translate-y-0.5 transition-all">
                ← Back to Sales
              </button>
              <button type="button" onClick={() => { setSuccessReturn(null); loadData(); }}
                className="px-6 py-3 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Another Return
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loadingPage) {
    return (
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-28 space-y-3">
        <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  // ── Error / not found ───────────────────────────────────────────────────────
  if (pageError || !sale) {
    return (
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-28">
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 mb-4">
          <span className="font-black text-base">!</span>
          <span className="text-[14px] font-semibold">{pageError || 'Sale not found.'}</span>
        </div>
        <button type="button" onClick={() => router.push('/sales')}
          className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all">
          ← Back to Sales
        </button>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">

      {/* Page header */}
      <div className="rr-page-hero rr-fade-in mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rr-section-label">↩️ Sale Return</span>
            <h1 className="mt-1 text-[22px] font-black text-slate-900">Process Return</h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Invoice{' '}
              <span className="font-mono font-bold text-green-700">{sale.invoice_number}</span>
              {sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' && <> · {sale.buyer_name}</>}
              {' · '}
              <span className="font-bold text-slate-600">₹{fmt(sale.total_amount)}</span>
            </p>
          </div>
          <button type="button" onClick={() => router.push('/sales')}
            className="shrink-0 px-3 py-2 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-all">
            ← Sales
          </button>
        </div>
      </div>

      {/* Fully returned banner */}
      {everythingReturned && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] font-semibold text-slate-500">
          <span>✓</span> All items from this sale have already been returned.
        </div>
      )}

      {/* Prior returns history */}
      {existingReturns.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-slate-100 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[12px] font-black text-slate-500 uppercase tracking-wider">
              Previous Returns
            </p>
            <span className="text-[11px] font-bold text-slate-400">{existingReturns.length} record{existingReturns.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {existingReturns.map(ret => (
              <div key={ret._id} className="rr-accent-card accent-blue m-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-[12px] font-bold text-blue-700">{ret.return_number}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {ret.items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[14px] font-black text-slate-700">₹{fmt(ret.total_amount)}</span>
                    {ret.refund_mode && (
                      <span className={`block mt-0.5 rr-pill ${ret.refund_mode === 'cash' ? 'rr-pill-green' : ret.refund_mode === 'credit_note' ? 'rr-pill-violet' : 'rr-pill-blue'}`}>
                        {ret.refund_mode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Items with qty inputs */}
        <div className="rounded-2xl border-2 border-slate-100 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-[12px] font-black text-slate-500 uppercase tracking-wider">Return Quantities</p>
          </div>
          <div className="divide-y divide-slate-50">
            {allItems.map(item => {
              const pid = String(item.product?._id || item.product);
              const max = maxReturnableMap[pid] ?? 0;
              const qty = quantities[pid] ?? 0;
              return (
                <div key={pid} className={`flex items-center gap-4 px-4 py-4 transition-colors ${qty > 0 ? 'bg-amber-50/50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-800 truncate">{item.product_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ₹{fmt(item.price_per_unit)} · GST {item.gst_rate || 0}%
                      {max === 0
                        ? <span className="ml-1 text-slate-300"> · fully returned</span>
                        : <span className="ml-1"> · up to {max}</span>}
                    </p>
                  </div>
                  <input
                    type="number" min={0} max={max} step={1}
                    value={qty}
                    onChange={e => handleQtyChange(pid, e.target.value)}
                    disabled={max === 0}
                    className="w-20 h-11 px-3 text-center rounded-xl border-2 border-slate-200 text-[15px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500 disabled:opacity-40 disabled:bg-slate-50 transition-all"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Refund mode */}
        <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-wider mb-3">Refund Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {REFUND_MODES.map(m => (
              <button key={m.value} type="button" onClick={() => setRefundMode(m.value)}
                className={`h-11 rounded-xl text-[12px] font-bold border-2 transition-all ${refundMode === m.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reason + Notes */}
        <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
            <input type="text" className={INPUT}
              placeholder="e.g. Defective product, wrong size…"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <input type="text" className={INPUT}
              placeholder="Any additional notes…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Preview total */}
        {selectedItems.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-amber-50 border-2 border-amber-200 shadow-sm">
            <div>
              <p className="text-[12px] font-black text-amber-700 uppercase tracking-wide">
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} · Refund
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                {REFUND_MODES.find(m => m.value === refundMode)?.label}
              </p>
            </div>
            <span className="text-[26px] font-black text-amber-800">₹{fmt(previewTotal)}</span>
          </div>
        )}

        {/* Error */}
        {submitError && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
            <span className="font-black">!</span>
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit */}
        <button type="submit"
          disabled={submitting || everythingReturned || selectedItems.length === 0}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[15px] font-black shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:translate-y-0 transition-all">
          {submitting ? 'Processing…' : 'Confirm Return ↩️'}
        </button>
      </form>
    </div>
  );
}

// ── Page shell — wraps inner component in Suspense (required for useSearchParams) ──
export default function SaleReturnsPage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-28 space-y-3">
          <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      }>
        <SaleReturnInner />
      </Suspense>
    </Layout>
  );
}
