'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../../lib/api';
import { getToken, fmt } from '../../../lib/constants';
import { useIndustry } from '../../../contexts/IndustryContext';
import { useToast } from '../../../hooks/useToast';

const STEPS = ['Customer', 'Items', 'Payment', 'Confirm'];

const PAYMENT_TYPES = [
  { id: 'cash',   label: 'Cash',   icon: '💵', desc: 'Full payment in cash' },
  { id: 'upi',    label: 'UPI',    icon: '📱', desc: 'Google Pay, PhonePe, Paytm' },
  { id: 'card',   label: 'Card',   icon: '💳', desc: 'Debit or credit card' },
  { id: 'credit', label: 'Udhaar', icon: '📒', desc: 'Pay later / credit' },
];

function total(items) {
  return items.reduce((s, i) => s + (Number(i.price_per_unit) || 0) * (Number(i.qty) || 0), 0);
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={[
              'w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center',
              done ? 'bg-green-600 text-white' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400',
            ].join(' ')}>
              {done ? '✓' : idx}
            </div>
            <span className={`text-[11px] font-bold ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-px w-6 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Customer ─────────────────────────────────────────── */
function StepCustomer({ form, setForm, onNext }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-[20px] font-black text-slate-900">Customer</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">Enter customer details or leave blank for walk-in</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Name</label>
          <input
            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none transition-colors"
            placeholder="Customer name (optional)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Phone</label>
          <input
            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none transition-colors"
            placeholder="98XXXXXXXX"
            type="tel"
            maxLength={10}
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">GSTIN (optional)</label>
          <input
            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-[14px] text-slate-900 font-mono focus:border-green-600 focus:outline-none transition-colors uppercase"
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            value={form.gstin}
            onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) }))}
          />
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full h-13 rounded-2xl bg-green-600 text-white font-black text-[15px] hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20 py-3.5"
      >
        {form.name ? `Continue with ${form.name}` : 'Continue as Walk-in'} →
      </button>
    </div>
  );
}

/* ── Step 2: Items ────────────────────────────────────────────── */
function StepItems({ cart, setCart, products, onNext, onBack }) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)).slice(0, 8);
  }, [search, products]);

  function addProduct(p) {
    setCart(c => {
      const existing = c.find(i => i.product_id === p._id);
      if (existing) return c.map(i => i.product_id === p._id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, {
        product_id: p._id,
        name: p.name,
        price_per_unit: p.price || 0,
        cost_price: p.cost_price || 0,
        gst_rate: p.gst_rate || 0,
        qty: 1,
        unit: p.unit || 'pcs',
        max_qty: p.quantity,
      }];
    });
    setSearch('');
    setShowSearch(false);
  }

  function removeItem(id) { setCart(c => c.filter(i => i.product_id !== id)); }
  function updateQty(id, v) { setCart(c => c.map(i => i.product_id === id ? { ...i, qty: Math.max(1, Number(v) || 1) } : i)); }
  function updatePrice(id, v) { setCart(c => c.map(i => i.product_id === id ? { ...i, price_per_unit: Number(v) || 0 } : i)); }

  const cartTotal = total(cart);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-black text-slate-900">Items</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{cart.length} item{cart.length !== 1 ? 's' : ''} · ₹{fmt(cartTotal)}</p>
        </div>
        <button
          onClick={() => setShowSearch(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-[13px] font-bold hover:bg-green-700 transition-colors"
        >+ Add</button>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <input
            autoFocus
            className="h-11 w-full rounded-xl border-2 border-green-500 px-4 text-[14px] text-slate-900 focus:outline-none"
            placeholder="Search product name or barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-2xl bg-white border-2 border-slate-200 shadow-xl overflow-hidden">
              {filtered.map(p => (
                <button
                  key={p._id}
                  onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b last:border-0 border-slate-100 text-left transition-colors"
                >
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.unit} · Stock: {p.quantity}</p>
                  </div>
                  <span className="text-[14px] font-black text-green-700">₹{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          )}
          {search.length > 0 && filtered.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-2xl bg-white border-2 border-slate-200 shadow-xl px-4 py-3">
              <p className="text-[13px] text-slate-400">No products found for "{search}"</p>
            </div>
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[32px] mb-2">🛒</p>
          <p className="text-[14px] font-bold text-slate-500">No items yet — click + Add to search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cart.map(item => (
            <div key={item.product_id} className="rounded-2xl border-2 border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[14px] font-black text-slate-800 leading-tight">{item.name}</p>
                <button onClick={() => removeItem(item.product_id)} className="text-rose-400 hover:text-rose-600 text-[18px] leading-none flex-shrink-0">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Qty ({item.unit})</label>
                  <input
                    type="number"
                    min={1}
                    max={item.max_qty || 9999}
                    className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-[14px] font-bold text-slate-900 focus:border-green-600 focus:outline-none"
                    value={item.qty}
                    onChange={e => updateQty(item.product_id, e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-[14px] font-bold text-slate-900 focus:border-green-600 focus:outline-none"
                    value={item.price_per_unit}
                    onChange={e => updatePrice(item.product_id, e.target.value)}
                  />
                </div>
              </div>
              <p className="text-right text-[12px] font-black text-emerald-700 mt-1.5">
                = ₹{fmt((item.qty || 0) * (item.price_per_unit || 0))}
              </p>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 flex justify-between items-center">
          <span className="text-[13px] font-bold text-slate-600">Total</span>
          <span className="text-[20px] font-black text-slate-900">₹{fmt(cartTotal)}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 h-12 rounded-2xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
        <button
          onClick={onNext}
          disabled={cart.length === 0}
          className="flex-[2] h-12 rounded-2xl bg-green-600 text-white font-black text-[15px] hover:bg-green-700 disabled:opacity-40 transition-colors shadow-lg shadow-green-500/20"
        >Continue →</button>
      </div>
    </div>
  );
}

/* ── Step 3: Payment ──────────────────────────────────────────── */
function StepPayment({ paymentType, setPaymentType, amountPaid, setAmountPaid, note, setNote, cartTotal, onNext, onBack }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-[20px] font-black text-slate-900">Payment</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">Total: ₹{fmt(cartTotal)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_TYPES.map(pt => (
          <button
            key={pt.id}
            onClick={() => setPaymentType(pt.id)}
            className={[
              'p-4 rounded-2xl border-2 text-left transition-all',
              paymentType === pt.id
                ? 'border-green-500 bg-green-50 ring-1 ring-green-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <div className="text-2xl mb-1">{pt.icon}</div>
            <p className="text-[14px] font-black text-slate-800">{pt.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{pt.desc}</p>
          </button>
        ))}
      </div>

      {paymentType === 'credit' && (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Advance paid (₹) — optional</label>
          <input
            type="number"
            min={0}
            max={cartTotal}
            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none transition-colors"
            placeholder="0"
            value={amountPaid}
            onChange={e => setAmountPaid(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Note (optional)</label>
        <input
          className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none transition-colors"
          placeholder="e.g. site name, PO number…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 h-12 rounded-2xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
        <button
          onClick={onNext}
          className="flex-[2] h-12 rounded-2xl bg-green-600 text-white font-black text-[15px] hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
        >Review Order →</button>
      </div>
    </div>
  );
}

/* ── Step 4: Confirm ──────────────────────────────────────────── */
function StepConfirm({ customer, cart, paymentType, amountPaid, note, onBack, onSubmit, submitting }) {
  const cartTotal = total(cart);
  const ptMeta = PAYMENT_TYPES.find(p => p.id === paymentType) || PAYMENT_TYPES[0];
  const due = paymentType === 'credit' ? cartTotal - (Number(amountPaid) || 0) : 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-[20px] font-black text-slate-900">Confirm Invoice</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">Review before creating</p>
      </div>

      {/* Customer */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Customer</p>
        <p className="text-[15px] font-black text-slate-800">{customer.name || 'Walk-in Customer'}</p>
        {customer.phone && <p className="text-[12px] text-slate-500 mt-0.5">{customer.phone}</p>}
        {customer.gstin && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{customer.gstin}</p>}
      </div>

      {/* Items */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{cart.length} Items</p>
        </div>
        <div className="divide-y divide-slate-100">
          {cart.map(item => (
            <div key={item.product_id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[13px] font-bold text-slate-800">{item.name}</p>
                <p className="text-[11px] text-slate-400">{item.qty} × ₹{fmt(item.price_per_unit)}</p>
              </div>
              <span className="text-[14px] font-black text-slate-700">₹{fmt(item.qty * item.price_per_unit)}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[13px] font-bold text-slate-600">Total</span>
          <span className="text-[18px] font-black text-slate-900">₹{fmt(cartTotal)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payment</p>
        <div className="flex justify-between">
          <span className="text-[13px] text-slate-600">Method</span>
          <span className="text-[13px] font-bold text-slate-800">{ptMeta.icon} {ptMeta.label}</span>
        </div>
        {paymentType === 'credit' && (
          <>
            <div className="flex justify-between">
              <span className="text-[13px] text-slate-600">Advance paid</span>
              <span className="text-[13px] font-bold text-slate-800">₹{fmt(Number(amountPaid) || 0)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-[13px] font-bold text-rose-600">Udhaar remaining</span>
              <span className="text-[14px] font-black text-rose-600">₹{fmt(due)}</span>
            </div>
          </>
        )}
        {note && (
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="text-[13px] text-slate-400">Note</span>
            <span className="text-[13px] text-slate-600 text-right max-w-[60%]">{note}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} disabled={submitting} className="flex-1 h-12 rounded-2xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">← Back</button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-[2] h-12 rounded-2xl bg-green-600 text-white font-black text-[15px] hover:bg-green-700 disabled:opacity-60 transition-colors shadow-lg shadow-green-500/20"
        >
          {submitting ? 'Creating…' : '✓ Create Invoice'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function NewInvoicePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { term } = useIndustry();

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ name: '', phone: '', gstin: '' });
  const [cart, setCart] = useState([]);
  const [paymentType, setPaymentType] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [note, setNote] = useState('');
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/api/products?all=true'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
  }, [router]);

  const cartTotal = useMemo(() => total(cart), [cart]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const token = getToken();
      const items = cart.map(i => ({
        product_id: i.product_id,
        product_name: i.name,
        quantity: Number(i.qty),
        price_per_unit: Number(i.price_per_unit),
        unit: i.unit,
        cost_price: i.cost_price,
        gst_rate: i.gst_rate,
      }));
      const payload = {
        buyer_name: customer.name || '',
        buyer_phone: customer.phone || '',
        buyer_gstin: customer.gstin || '',
        payment_type: paymentType,
        amount_paid: paymentType === 'credit' ? (Number(amountPaid) || 0) : cartTotal,
        notes: note,
        sale_date: new Date().toISOString().slice(0, 10),
        items,
      };
      const res = await fetch(apiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create invoice');
      showToast(`Invoice ${data.invoice_number || ''} created!`, 'success');
      router.push('/sales');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [cart, customer, paymentType, amountPaid, note, cartTotal, router, showToast]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[16px] font-black text-slate-900">New {term('invoice', 'Invoice')}</h1>
      </div>

      <StepIndicator current={step} />

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full pb-8">
        {step === 1 && (
          <StepCustomer form={customer} setForm={setCustomer} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepItems
            cart={cart}
            setCart={setCart}
            products={products}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepPayment
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            amountPaid={amountPaid}
            setAmountPaid={setAmountPaid}
            note={note}
            setNote={setNote}
            cartTotal={cartTotal}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepConfirm
            customer={customer}
            cart={cart}
            paymentType={paymentType}
            amountPaid={amountPaid}
            note={note}
            onBack={() => setStep(3)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
