'use client';
/**
 * QUICK SALE — single-screen counter mode.
 * Drop-in replacement for: frontend/src/app/sales/new/page.js
 *
 * Replaces the old 4-step wizard. Design goals:
 *   • Cash walk-in sale in 3 interactions: search → tap item → Save.
 *   • Sticky bottom money bar (total + payment + save) — thumb reachable.
 *   • Customer optional; required only for Udhaar (with saved-customer autocomplete).
 *   • Decimal quantities supported (loose items: metre / kg).
 *   • Barcode scanner (reuses CameraBarcodeScanner, continuous mode).
 *   • Hold / resume bills (reuses lib/heldBills).
 *   • Offline-safe: falls back to queueSale() like SaleFormModal does.
 *   • Fully i18n'd via useAppLocale — see i18n-quick-sale-keys.md for the
 *     keys to append to en.js / hi.js / hi_en.js. Falls back to inline
 *     Hinglish defaults until keys are added, so it works immediately.
 *
 * API contract is identical to the old wizard (POST /api/sales with
 * buyer_name/buyer_phone/buyer_gstin/payment_type/amount_paid/notes/
 * sale_date/items[]) — no backend change needed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { apiUrl } from '../../../lib/api';
import { getToken, fmt } from '../../../lib/constants';
import { useToast } from '../../../hooks/useToast';
import { useIndustry } from '../../../contexts/IndustryContext';
import { useAppLocale } from '../../../components/AppLocale';
import { queueSale } from '../../../lib/offlineQueue';
import {
  getHeldBills, saveHeldBill, removeHeldBill, getRelativeTime,
} from '../../../lib/heldBills';

const CameraBarcodeScanner = dynamic(
  () => import('../../../components/CameraBarcodeScanner'),
  { ssr: false }
);

const PAY_TYPES = ['cash', 'upi', 'card', 'credit'];
const PAY_KEY = 'rr-qs-paytype';

const lineTotal = (i) => (Number(i.qty) || 0) * (Number(i.price_per_unit) || 0);
const cartTotal = (cart) => cart.reduce((s, i) => s + lineTotal(i), 0);

export default function QuickSalePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { term } = useIndustry();
  const { t } = useAppLocale();
  // i18n with inline fallback (works before keys are added)
  const tx = useCallback((k, fb, vars) => {
    const v = t(k, vars);
    return v === k ? fb : v;
  }, [t]);

  /* ── state ─────────────────────────────────────────────────── */
  const [products, setProducts]   = useState([]);
  const [customers, setCustomers] = useState(null); // lazy-loaded
  const [cart, setCart]           = useState([]);
  const [search, setSearch]       = useState('');
  const [payType, setPayType]     = useState('cash');
  const [amountPaid, setAmountPaid] = useState(''); // udhaar advance
  const [buyer, setBuyer]         = useState({ name: '', phone: '', gstin: '' });
  const [showCustomer, setShowCustomer] = useState(false);
  const [custQuery, setCustQuery] = useState('');
  const [note, setNote]           = useState('');
  const [showNote, setShowNote]   = useState(false);
  const [scanOpen, setScanOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [held, setHeld]           = useState([]);
  const [done, setDone]           = useState(null); // { invoice_number, total, offline }
  const searchRef = useRef(null);

  /* ── boot ──────────────────────────────────────────────────── */
  useEffect(() => {
    const token = getToken?.() || localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    setHeld(getHeldBills());
    try {
      const last = localStorage.getItem(PAY_KEY);
      if (PAY_TYPES.includes(last)) setPayType(last);
    } catch {}
    fetch(apiUrl('/api/products?all=true'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
    searchRef.current?.focus();
  }, [router]);

  // Lazy-load customers the first time they're needed (udhaar / add-customer)
  const ensureCustomers = useCallback(() => {
    if (customers !== null) return;
    setCustomers([]);
    const token = getToken?.() || localStorage.getItem('token');
    fetch(apiUrl('/api/customers'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : (d.customers || [])))
      .catch(() => setCustomers([]));
  }, [customers]);

  /* ── product search ────────────────────────────────────────── */
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q) ||
        ((p.attributes?.size_spec || p.size_spec || '')).toLowerCase().includes(q) ||
        ((p.attributes?.brand || p.brand || '')).toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, products]);

  const addProduct = useCallback((p) => {
    setCart((c) => {
      const ex = c.find((i) => i.product_id === p._id);
      if (ex) return c.map((i) => i.product_id === p._id ? { ...i, qty: (Number(i.qty) || 0) + 1 } : i);
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
    searchRef.current?.focus();
  }, []);

  const onSearchKey = (e) => {
    if (e.key === 'Enter' && results.length > 0) addProduct(results[0]);
  };

  const onBarcode = useCallback(async (code) => {
    const p = products.find((x) => (x.barcode || '') === String(code).trim());
    if (p) {
      addProduct(p);
      showToast(`+ ${p.name}`, 'success');
    } else {
      showToast(tx('qs_barcode_not_found', 'Barcode नहीं मिला'), 'error');
    }
  }, [products, addProduct, showToast, tx]);

  /* ── cart ops ──────────────────────────────────────────────── */
  const setQty = (id, v) =>
    setCart((c) => c.map((i) => i.product_id === id ? { ...i, qty: v } : i));
  const bumpQty = (id, d) =>
    setCart((c) => c.flatMap((i) => {
      if (i.product_id !== id) return [i];
      const next = Math.round(((Number(i.qty) || 0) + d) * 1000) / 1000;
      return next <= 0 ? [] : [{ ...i, qty: next }];
    }));
  const setPrice = (id, v) =>
    setCart((c) => c.map((i) => i.product_id === id ? { ...i, price_per_unit: v } : i));
  const total = useMemo(() => cartTotal(cart), [cart]);

  /* ── customer pick (for udhaar) ────────────────────────────── */
  const custResults = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    const q = custQuery.trim().toLowerCase();
    const list = q
      ? customers.filter((c) =>
          (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
      : customers.slice(0, 6); // recent/first few when empty
    return list.slice(0, 6);
  }, [customers, custQuery]);

  const pickPay = (p) => {
    setPayType(p);
    try { localStorage.setItem(PAY_KEY, p); } catch {}
    if (p === 'credit') { setShowCustomer(true); ensureCustomers(); }
  };

  /* ── hold / resume ─────────────────────────────────────────── */
  const holdBill = () => {
    if (cart.length === 0) return;
    saveHeldBill({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      cart, buyer, payType, note,
    });
    setHeld(getHeldBills());
    setCart([]); setBuyer({ name: '', phone: '', gstin: '' });
    setNote(''); setShowCustomer(false);
    showToast(tx('qs_held', 'Bill hold हो गया'), 'success');
    searchRef.current?.focus();
  };
  const resumeBill = (b) => {
    setCart(b.cart || []); setBuyer(b.buyer || { name: '', phone: '', gstin: '' });
    setPayType(b.payType || 'cash'); setNote(b.note || '');
    removeHeldBill(b.id); setHeld(getHeldBills());
  };

  /* ── submit ────────────────────────────────────────────────── */
  const reset = () => {
    setCart([]); setBuyer({ name: '', phone: '', gstin: '' });
    setAmountPaid(''); setNote(''); setShowCustomer(false);
    setCustQuery(''); setDone(null);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const submit = useCallback(async () => {
    if (cart.length === 0 || submitting) return;
    if (payType === 'credit' && !buyer.name && !buyer.phone) {
      setShowCustomer(true); ensureCustomers();
      showToast(tx('qs_need_customer', 'Udhaar के लिए customer चुनें'), 'error');
      return;
    }
    setSubmitting(true);
    const items = cart.map((i) => ({
      product_id: i.product_id,
      product_name: i.name,
      quantity: Number(i.qty) || 0,
      price_per_unit: Number(i.price_per_unit) || 0,
      unit: i.unit,
      cost_price: i.cost_price,
      gst_rate: i.gst_rate,
    }));
    const payload = {
      buyer_name:  buyer.name || '',
      buyer_phone: buyer.phone || '',
      buyer_gstin: buyer.gstin || '',
      payment_type: payType,
      amount_paid: payType === 'credit' ? (Number(amountPaid) || 0) : total,
      notes: note,
      sale_date: new Date().toISOString().slice(0, 10),
      items,
    };
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('__offline__');
      const token = getToken?.() || localStorage.getItem('token');
      const res = await fetch(apiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || tx('qs_failed', 'Bill नहीं बना'));
      setDone({ invoice_number: data.invoice_number || data.sale?.invoice_number || '', total, offline: false, phone: buyer.phone });
    } catch (err) {
      // Network failure → offline queue (same behaviour as SaleFormModal)
      if (err.message === '__offline__' || err.name === 'TypeError') {
        try {
          await queueSale(payload, items);
          setDone({ invoice_number: '', total, offline: true, phone: buyer.phone });
        } catch {
          showToast(tx('qs_failed', 'Bill नहीं बना'), 'error');
        }
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }, [cart, buyer, payType, amountPaid, note, total, submitting, ensureCustomers, showToast, tx]);

  const payLabel = {
    cash:   tx('qs_pay_cash', 'Cash'),
    upi:    tx('qs_pay_upi', 'UPI'),
    card:   tx('qs_pay_card', 'Card'),
    credit: tx('qs_pay_udhaar', 'Udhaar'),
  };

  /* ── success overlay ───────────────────────────────────────── */
  if (done) {
    const waText = encodeURIComponent(
      `${tx('qs_wa_msg', 'आपका bill')} ${done.invoice_number ? `#${done.invoice_number}` : ''}\nTotal: ₹${fmt(done.total)}\n${tx('qs_wa_thanks', 'धन्यवाद 🙏')}`
    );
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-3xl">✓</div>
          <h2 className="text-[20px] font-black text-slate-900">
            {done.offline
              ? tx('qs_saved_offline', 'Offline save हो गया — net आने पर bill बन जाएगा')
              : tx('qs_saved', 'Bill बन गया!')}
          </h2>
          {done.invoice_number && (
            <p className="text-[14px] font-bold text-slate-500">#{done.invoice_number} · ₹{fmt(done.total)}</p>
          )}
          <div className="space-y-2 pt-2">
            <button onClick={reset}
              className="w-full h-13 py-3.5 rounded-2xl bg-green-600 text-white font-black text-[15px] shadow-lg shadow-green-500/20">
              + {tx('qs_new_bill', 'नया Bill')}
            </button>
            {done.phone && (
              <a href={`https://wa.me/91${done.phone}?text=${waText}`} target="_blank" rel="noreferrer"
                className="block w-full py-3 rounded-2xl border-2 border-green-600 text-green-700 font-bold text-[14px]">
                {tx('qs_whatsapp', 'WhatsApp पर भेजें')}
              </a>
            )}
            <button onClick={() => router.push('/sales')}
              className="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-[14px]">
              {tx('qs_view_bills', 'सारे bills देखें')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── main screen ───────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.back()}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-500">←</button>
        <h1 className="text-[16px] font-black text-slate-900 flex-1">
          {tx('qs_title', 'Quick Sale')} <span className="text-slate-300 font-bold">·</span>{' '}
          <span className="text-[12px] text-slate-400 font-bold">{term('invoice', 'Invoice')}</span>
        </h1>
        {cart.length > 0 && (
          <button onClick={holdBill}
            className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-bold">
            ⏸ {tx('qs_hold', 'Hold')}
          </button>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 pb-44 space-y-3">

        {/* Search + barcode — always on top, always focused */}
        <div className="relative flex gap-2">
          <input
            ref={searchRef}
            className="h-12 flex-1 rounded-2xl border-2 border-slate-200 px-4 text-[15px] text-slate-900 focus:border-green-600 focus:outline-none bg-white"
            placeholder={tx('qs_search_ph', 'Item ka naam / barcode / size…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            autoFocus
          />
          <button onClick={() => setScanOpen(true)}
            className="w-12 h-12 rounded-2xl bg-slate-900 text-white text-xl flex items-center justify-center" aria-label="scan">
            ▥
          </button>
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-14 z-30 mt-1 rounded-2xl bg-white border-2 border-slate-200 shadow-xl overflow-hidden">
              {results.map((p) => (
                <button key={p._id} onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 active:bg-green-100 border-b last:border-0 border-slate-100 text-left">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.unit || 'pcs'} · {tx('qs_stock', 'Stock')}: {p.quantity ?? '—'}
                    </p>
                  </div>
                  <span className="text-[14px] font-black text-green-700 pl-2">₹{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Held bills — shown when cart is empty */}
        {cart.length === 0 && held.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {held.map((b) => (
              <button key={b.id} onClick={() => resumeBill(b)}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-left">
                <p className="text-[12px] font-bold text-amber-800">
                  ⏸ {b.buyer?.name || tx('qs_walkin', 'Walk-in')} · ₹{fmt(cartTotal(b.cart || []))}
                </p>
                <p className="text-[10px] text-amber-600">{getRelativeTime(b.at)}</p>
              </button>
            ))}
          </div>
        )}

        {/* Cart */}
        {cart.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-[36px] mb-2">🧾</p>
            <p className="text-[14px] font-bold text-slate-500">
              {tx('qs_empty', 'Item search karo ya barcode scan karo')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((i) => (
              <div key={i.product_id} className="rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-black text-slate-800 leading-tight flex-1 min-w-0 truncate">{i.name}</p>
                  <p className="text-[14px] font-black text-emerald-700 tabular-nums">₹{fmt(lineTotal(i))}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {/* qty stepper */}
                  <div className="flex items-center rounded-xl border-2 border-slate-200 overflow-hidden">
                    <button onClick={() => bumpQty(i.product_id, -1)}
                      className="w-9 h-9 text-[18px] font-black text-slate-500 active:bg-slate-100">−</button>
                    <input
                      type="number" inputMode="decimal" step="any" min="0"
                      className="w-14 h-9 text-center text-[14px] font-black text-slate-900 focus:outline-none"
                      value={i.qty}
                      onChange={(e) => setQty(i.product_id, e.target.value)}
                    />
                    <button onClick={() => bumpQty(i.product_id, 1)}
                      className="w-9 h-9 text-[18px] font-black text-green-700 active:bg-green-50">+</button>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">{i.unit}</span>
                  <span className="text-slate-300">×</span>
                  <div className="flex items-center flex-1">
                    <span className="text-[13px] text-slate-400 mr-1">₹</span>
                    <input
                      type="number" inputMode="decimal" step="any" min="0"
                      className="h-9 w-full rounded-xl border-2 border-slate-200 px-2 text-[14px] font-bold text-slate-900 focus:border-green-600 focus:outline-none"
                      value={i.price_per_unit}
                      onChange={(e) => setPrice(i.product_id, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customer (optional / required for udhaar) */}
        {cart.length > 0 && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-3">
            {!showCustomer && !buyer.name ? (
              <button onClick={() => { setShowCustomer(true); ensureCustomers(); }}
                className="w-full text-left text-[13px] font-bold text-green-700">
                + {tx('qs_add_customer', 'Customer जोड़ें')}{' '}
                <span className="text-slate-400 font-medium">({tx('qs_optional', 'optional')})</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {tx('qs_customer', 'Customer')}{payType === 'credit' && ' *'}
                  </p>
                  {buyer.name && (
                    <button onClick={() => { setBuyer({ name: '', phone: '', gstin: '' }); setCustQuery(''); }}
                      className="text-[11px] font-bold text-rose-500">✕ {tx('qs_remove', 'हटाएं')}</button>
                  )}
                </div>
                {buyer.name ? (
                  <p className="text-[14px] font-black text-slate-800">
                    {buyer.name} {buyer.phone && <span className="text-slate-400 font-bold text-[12px]">· {buyer.phone}</span>}
                  </p>
                ) : (
                  <>
                    <input
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none"
                      placeholder={tx('qs_cust_search_ph', 'नाम या phone लिखें…')}
                      value={custQuery}
                      onChange={(e) => setCustQuery(e.target.value)}
                    />
                    {custResults.length > 0 && (
                      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        {custResults.map((c) => (
                          <button key={c._id} onClick={() => { setBuyer({ name: c.name || '', phone: c.phone || '', gstin: c.gstin || '' }); setCustQuery(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-green-50 active:bg-green-100">
                            <span className="text-[13px] font-bold text-slate-800">{c.name}</span>
                            {c.phone && <span className="text-[11px] text-slate-400 ml-2">{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {custQuery.trim() && (
                      <button
                        onClick={() => {
                          const isPhone = /^\d{10}$/.test(custQuery.trim());
                          setBuyer((b) => ({
                            ...b,
                            name: isPhone ? b.name || tx('qs_walkin', 'Walk-in') : custQuery.trim(),
                            phone: isPhone ? custQuery.trim() : b.phone,
                          }));
                          setCustQuery('');
                        }}
                        className="w-full py-2 rounded-xl bg-slate-100 text-[12px] font-bold text-slate-600">
                        + {tx('qs_new_customer', 'नया customer')}: “{custQuery.trim()}”
                      </button>
                    )}
                  </>
                )}
                {payType === 'credit' && (
                  <input
                    type="number" inputMode="decimal" min="0" max={total}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[14px] text-slate-900 focus:border-green-600 focus:outline-none"
                    placeholder={tx('qs_advance_ph', 'Advance मिला (₹) — optional')}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Note (collapsed) */}
        {cart.length > 0 && (
          showNote ? (
            <input
              className="h-11 w-full rounded-2xl border-2 border-slate-200 px-4 text-[13px] text-slate-900 focus:border-green-600 focus:outline-none bg-white"
              placeholder={tx('qs_note_ph', 'Note — site / PO no. (optional)')}
              value={note} onChange={(e) => setNote(e.target.value)} autoFocus
            />
          ) : (
            <button onClick={() => setShowNote(true)} className="text-[12px] font-bold text-slate-400 px-1">
              + {tx('qs_add_note', 'Note जोड़ें')}
            </button>
          )
        )}
      </div>

      {/* ── Sticky money bar ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 pt-3 pb-4 max-w-lg mx-auto w-full space-y-2.5"
        style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.08)' }}>
        <div className="grid grid-cols-4 gap-1.5">
          {PAY_TYPES.map((p) => (
            <button key={p} onClick={() => pickPay(p)}
              className={[
                'h-10 rounded-xl text-[12px] font-black transition-colors',
                payType === p
                  ? (p === 'credit' ? 'bg-rose-600 text-white' : 'bg-green-600 text-white')
                  : 'bg-slate-100 text-slate-500',
              ].join(' ')}>
              {payLabel[p]}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={cart.length === 0 || submitting}
          className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-[16px] disabled:opacity-30 flex items-center justify-between px-5 active:scale-[0.99] transition-transform">
          <span>{submitting ? tx('qs_saving', 'बन रहा है…') : `✓ ${tx('qs_save_bill', 'Bill बनाओ')}`}</span>
          <span className="tabular-nums">₹{fmt(total)}{payType === 'credit' && Number(amountPaid) > 0
            ? `  (${tx('qs_due', 'बाकी')} ₹${fmt(total - Number(amountPaid))})` : ''}</span>
        </button>
      </div>

      {/* Barcode scanner */}
      {scanOpen && (
        <CameraBarcodeScanner
          open={scanOpen}
          continuous
          onDetected={onBarcode}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}