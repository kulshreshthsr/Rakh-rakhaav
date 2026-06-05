'use client';
import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

export default function ExchangeModal({
  exchangeSale,
  products,
  onClose,
  onExchangeComplete,
  apiUrl,
  getToken,
  fmt,
}) {
  const { showToast } = useToast();

  /* ── Internal state — no longer prop-drilled from page.js ── */
  const [exchangeReturned, setExchangeReturned] = useState(() =>
    (exchangeSale.items || []).map((item) => ({
      product_id: item.product?._id || item.product || '',
      product_name: item.product_name || '',
      quantity: item.quantity || 1,
      price: item.price_per_unit || 0,
      size: (() => { const m = item.item_metadata || {}; return m instanceof Map ? (m.get('size') || '') : (m.size || ''); })(),
      color: (() => { const m = item.item_metadata || {}; return m instanceof Map ? (m.get('color') || '') : (m.color || ''); })(),
      selected: true,
    }))
  );

  const [exchangeNewItems, setExchangeNewItems] = useState([
    { product_id: '', product_name: '', quantity: 1, price: 0, size: '', color: '' },
  ]);

  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);

  const returnedValue = exchangeReturned.filter(i => i.selected).reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const exchangeValue = exchangeNewItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
  const diff = exchangeValue - returnedValue;

  const handleSubmitExchange = async () => {
    const selectedReturned = exchangeReturned.filter(i => i.selected);
    if (selectedReturned.length === 0) {
      showToast('कम से कम एक item return के लिए select करें।', 'warning');
      return;
    }
    setExchangeSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/sales/exchange'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          original_invoice_no: exchangeSale.invoice_number,
          returned_items: selectedReturned.map(i => ({ product_id: i.product_id, quantity: i.quantity, reason: i.reason || 'exchange' })),
          exchange_items: exchangeNewItems.filter(i => i.product_id).map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, price: i.price, size: i.size, color: i.color })),
          customer_name: exchangeSale.buyer_name,
          customer_phone: exchangeSale.buyer_phone,
          price_difference: diff,
          payment_type: 'cash',
        }),
      });
      if (res.ok) {
        showToast('Exchange successfully processed!', 'success');
        onClose();
        onExchangeComplete();
      } else {
        const d = await res.json();
        showToast(d.message || 'Exchange failed. Please try again.', 'error');
      }
    } catch {
      showToast('Server error during exchange. Please try again.', 'error');
    }
    setExchangeSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-[18px] font-black text-slate-900">↩ Process Exchange</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">Invoice {exchangeSale.invoice_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1 — Items being returned */}
          <div>
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-2">Items Being Returned</p>
            <div className="space-y-2">
              {exchangeReturned.map((item, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${item.selected ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white opacity-50'}`}>
                  <input type="checkbox" checked={!!item.selected}
                    onChange={e => setExchangeReturned(prev => prev.map((x, i) => i === idx ? { ...x, selected: e.target.checked } : x))}
                    className="w-4 h-4 accent-rose-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900">{item.product_name}</p>
                    <p className="text-[11px] text-slate-500">{[item.size, item.color].filter(Boolean).join(' / ')} · ₹{item.price} × {item.quantity}</p>
                  </div>
                  {item.selected && (
                    <select value={item.reason || ''} onChange={e => setExchangeReturned(prev => prev.map((x, i) => i === idx ? { ...x, reason: e.target.value } : x))}
                      className="h-8 px-2 rounded-lg border border-slate-200 text-[11px] bg-white flex-shrink-0">
                      <option value="">Reason</option>
                      {['Wrong Size', 'Wrong Color', 'Defective', 'Changed Mind', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 — Items being taken */}
          <div>
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-2">Items Being Taken (Exchange)</p>
            <div className="space-y-2">
              {exchangeNewItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 flex-wrap items-center px-3 py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                  <select value={item.product_id} onChange={e => {
                    const prod = products.find(p => p._id === e.target.value);
                    setExchangeNewItems(prev => prev.map((x, i) => i === idx ? { ...x, product_id: e.target.value, product_name: prod?.name || '', price: prod?.price || 0 } : x));
                  }} className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-[12px] bg-white min-w-[120px]">
                    <option value="">Select product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <input type="text" placeholder="Size" value={item.size}
                    onChange={e => setExchangeNewItems(prev => prev.map((x, i) => i === idx ? { ...x, size: e.target.value } : x))}
                    className="h-8 w-16 px-2 rounded-lg border border-slate-200 text-[12px] bg-white" />
                  <input type="text" placeholder="Color" value={item.color}
                    onChange={e => setExchangeNewItems(prev => prev.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}
                    className="h-8 w-16 px-2 rounded-lg border border-slate-200 text-[12px] bg-white" />
                  <input type="number" placeholder="Qty" min="1" value={item.quantity}
                    onChange={e => setExchangeNewItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))}
                    className="h-8 w-14 px-2 rounded-lg border border-slate-200 text-[12px] bg-white text-center" />
                  <input type="number" placeholder="₹ Price" min="0" value={item.price}
                    onChange={e => setExchangeNewItems(prev => prev.map((x, i) => i === idx ? { ...x, price: Number(e.target.value) } : x))}
                    className="h-8 w-20 px-2 rounded-lg border border-slate-200 text-[12px] bg-white text-center" />
                  {exchangeNewItems.length > 1 && (
                    <button onClick={() => setExchangeNewItems(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 text-[12px] font-bold">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setExchangeNewItems(prev => [...prev, { product_id: '', product_name: '', quantity: 1, price: 0, size: '', color: '' }])}
                className="w-full py-2 rounded-xl border-2 border-dashed border-emerald-300 text-[12px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors">
                + Add Item
              </button>
            </div>
          </div>

          {/* Section 3 — Price difference */}
          <div className={`px-4 py-3 rounded-2xl border-2 ${diff > 0 ? 'border-amber-300 bg-amber-50' : diff < 0 ? 'border-blue-300 bg-blue-50' : 'border-emerald-300 bg-emerald-50'}`}>
            <div className="flex justify-between text-[12px] font-semibold text-slate-700 mb-1">
              <span>Returned value</span><span>₹{returnedValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[12px] font-semibold text-slate-700 mb-2">
              <span>Exchange value</span><span>₹{exchangeValue.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-[14px] font-black ${diff > 0 ? 'text-amber-800' : diff < 0 ? 'text-blue-800' : 'text-emerald-800'}`}>
              <span>{diff > 0 ? 'Customer pays' : diff < 0 ? 'Refund to customer' : 'Even exchange'}</span>
              <span>{diff !== 0 ? `₹${Math.abs(diff).toFixed(2)}` : '✓ No payment'}</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex-shrink-0">
          <button onClick={handleSubmitExchange} disabled={exchangeSubmitting || exchangeReturned.filter(i => i.selected).length === 0}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-700 text-white font-black text-[14px] shadow-lg shadow-rose-500/30 hover:-translate-y-0.5 disabled:opacity-60 transition-all"
          >{exchangeSubmitting ? 'Processing…' : 'Process Exchange'}</button>
        </div>
      </div>
    </div>
  );
}
