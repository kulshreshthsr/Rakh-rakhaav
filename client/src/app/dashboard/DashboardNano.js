'use client';
/**
 * DashboardNano — the micro-retailer home screen.
 * Save as: frontend/src/app/dashboard/DashboardNano.js
 *
 * Philosophy: a one-man shop needs THREE numbers and TWO buttons, not an
 * analytics suite. Everything heavier stays in core/pro dashboards.
 *
 *   ┌──────────────────────────────┐
 *   │  नमस्ते 🙏  ·  मेरी दुकान      │
 *   │  आज की बिक्री   ₹X (N bills) │
 *   │  गल्ला (cash)    ₹X           │
 *   │  उधार बाकी      ₹X (N log)   │
 *   │  [  + Bill बनाओ  ] [ उधार ]  │
 *   │  ⚠ low stock strip            │
 *   │  top udhaar + WhatsApp 📲     │
 *   └──────────────────────────────┘
 *
 * Uses the existing /api/dashboard/summary endpoint (no backend change).
 * Fully i18n'd via useAppLocale with inline fallbacks (same pattern as
 * the Quick Sale page) — keys listed in i18n-quick-sale-keys.md addendum.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useAppLocale } from '../../components/AppLocale';

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function greetingKeyByHour() {
  const h = new Date().getHours();
  if (h < 12) return ['nd_morning', 'शुभ प्रभात 🌅'];
  if (h < 17) return ['nd_noon', 'नमस्ते 🙏'];
  if (h < 20) return ['nd_evening', 'शुभ संध्या 🌇'];
  return ['nd_night', 'शुभ रात्रि 🌙'];
}

export default function DashboardNano() {
  const router = useRouter();
  const { t, locale } = useAppLocale();
  const tf = useCallback((k, fb, vars) => {
    const v = t(k, vars);
    return v === k ? fb : v;
  }, [t]);

  const [data, setData]       = useState(null);
  const [shopName, setShop]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const [dRes, sRes] = await Promise.all([
        fetch(apiUrl('/api/dashboard/summary?range=today'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dRes.status === 401) { router.push('/login'); return; }
      if (!dRes.ok) throw new Error('load failed');
      const d = await dRes.json();
      setData(d);
      if (sRes.ok) {
        const s = await sRes.json();
        setShop(s?.name || '');
      }
    } catch {
      setError(tf('nd_error', 'Data load नहीं हुआ — दोबारा try करें'));
    } finally {
      setLoading(false);
    }
  }, [router, tf]);

  useEffect(() => { load(); }, [load]);

  const [gKey, gFb] = greetingKeyByHour();
  const today = data?.today || {};
  const cash  = data?.paymentSplit?.cashInHand || 0;
  const udhaarDue   = data?.totalCustomerUdhaar ?? data?.udhaar?.totalDue ?? 0;
  const udhaarCount = data?.udhaar?.pendingCount || 0;
  const lowStock    = data?.stock?.lowStockItems || data?.lowStockProducts || [];
  const topDue      = (data?.udhaar?.topCustomers || []).slice(0, 3);

  const waReminder = (c) => {
    const msg =
      `${tf('nd_wa_greet', 'नमस्ते')} ${c.name} ${tf('nd_wa_ji', 'जी')} 🙏\n\n` +
      `${tf('nd_wa_body', 'हमारी दुकान')} *${shopName || 'रखरखाव'}* ${tf('nd_wa_body2', 'से आपका उधार बाकी है:')}\n\n` +
      `*₹${fmt(c.due)}*\n\n${tf('nd_wa_pay', 'कृपया जल्द से जल्द payment करें।')}\n\n${tf('nd_wa_thanks', 'धन्यवाद 🙏')}`;
    return `https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto w-full p-4 space-y-4 pb-24">

        {/* Greeting */}
        <div>
          <h1 className="text-[22px] font-black text-slate-900 leading-tight">{tf(gKey, gFb)}</h1>
          <p className="text-[13px] font-bold text-green-700 mt-0.5">
            {shopName || tf('nd_my_shop', 'मेरी दुकान')}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {new Date().toLocaleDateString(locale === 'en' ? 'en-IN' : 'hi-IN',
              { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {error && (
          <button onClick={load} className="w-full rounded-2xl bg-rose-50 border-2 border-rose-200 px-4 py-3 text-[13px] font-bold text-rose-700 text-left">
            {error} ↻
          </button>
        )}

        {/* The three numbers */}
        <div className="space-y-2">
          <div className="rounded-2xl bg-white border-2 border-slate-200 px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tf('nd_today_sales', 'आज की बिक्री')}
              </p>
              <p className="text-[12px] text-slate-400 mt-0.5">
                {loading ? '…' : tf('nd_bills_count', '{n} bills', { n: today.bills || 0 })}
              </p>
            </div>
            <p className="text-[24px] font-black text-slate-900 tabular-nums">
              {loading ? '—' : `₹${fmt(today.revenue)}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-4 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                {tf('nd_cash_box', 'गल्ला (आज)')}
              </p>
              <p className="text-[19px] font-black text-emerald-800 tabular-nums mt-1">
                {loading ? '—' : `₹${fmt(cash)}`}
              </p>
            </div>
            <Link href="/udhaar" className="rounded-2xl bg-rose-50 border-2 border-rose-200 px-4 py-3.5 no-underline active:scale-[0.98] transition-transform">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                {tf('nd_udhaar_due', 'उधार बाकी')} →
              </p>
              <p className="text-[19px] font-black text-rose-700 tabular-nums mt-1">
                {loading ? '—' : `₹${fmt(udhaarDue)}`}
              </p>
              {udhaarCount > 0 && (
                <p className="text-[10px] font-bold text-rose-400 mt-0.5">
                  {tf('nd_people_count', '{n} लोग', { n: udhaarCount })}
                </p>
              )}
            </Link>
          </div>
        </div>

        {/* The two buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/sales/new"
            className="h-16 rounded-2xl bg-green-600 text-white font-black text-[16px] flex items-center justify-center gap-2 no-underline shadow-lg shadow-green-500/25 active:scale-[0.98] transition-transform">
            + {tf('nd_make_bill', 'Bill बनाओ')}
          </Link>
          <Link href="/product"
            className="h-16 rounded-2xl bg-white border-2 border-slate-300 text-slate-800 font-black text-[15px] flex items-center justify-center gap-2 no-underline active:scale-[0.98] transition-transform">
            📦 {tf('nd_stock', 'Stock')}
          </Link>
        </div>

        {/* Low stock strip */}
        {lowStock.length > 0 && (
          <Link href="/product" className="block rounded-2xl bg-amber-50 border-2 border-amber-200 px-4 py-3 no-underline">
            <p className="text-[12px] font-black text-amber-800">
              ⚠ {tf('nd_low_stock', '{n} items खत्म होने वाले हैं', { n: lowStock.length })}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5 truncate">
              {lowStock.slice(0, 3).map((p) => p.name).join(' · ')}
            </p>
          </Link>
        )}

        {/* Top udhaar — one-tap WhatsApp reminder */}
        {topDue.length > 0 && (
          <div className="rounded-2xl bg-white border-2 border-slate-200 overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tf('nd_top_udhaar', 'सबसे ज़्यादा उधार')}
              </p>
              <Link href="/udhaar" className="text-[11px] font-bold text-green-700 no-underline">
                {tf('btn_view_all', 'सब देखें')} →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {topDue.map((c) => (
                <div key={c._id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[12px] font-black text-rose-600 tabular-nums">₹{fmt(c.due)}</p>
                  </div>
                  {c.phone && (
                    <a href={waReminder(c)} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 px-3 py-2 rounded-xl bg-green-50 border border-green-300 text-[12px] font-bold text-green-800 no-underline">
                      📲 {tf('nd_remind', 'याद दिलाओ')}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}