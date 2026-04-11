'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';

/* ─── Constants (UNCHANGED) ─────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_CACHE_PREFIX = 'dashboard-summary-v3';

const getToken = () => localStorage.getItem('token');
const getUserCacheNamespace = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    return storedUser?.username || storedUser?.id || 'anonymous';
  } catch { return 'anonymous'; }
};
const getCacheKey          = (month, year) => `${DASHBOARD_CACHE_PREFIX}:${getUserCacheNamespace()}:${year}:${month}`;
const readDashboardCache   = (month, year) => readPageCache(getCacheKey(month, year));
const writeDashboardCache  = (month, year, value) => writePageCache(getCacheKey(month, year), value);

/* ─── Greeting ───────────────────────────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'सुप्रभात';
  if (h < 17) return 'नमस्ते';
  return 'शुभ संध्या';
};

/* ─── Icons ──────────────────────────────────────────────────────── */
function QuickActionGlyph({ name }) {
  const common = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.9,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  switch (name) {
    case 'sales':    return <svg {...common}><path d="M12 2v20"/><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/></svg>;
    case 'purchase': return <svg {...common}><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7"/></svg>;
    case 'credit':   return <svg {...common}><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3"/><path d="M6 3.5v20"/><path d="M9 7.5h6"/><path d="M9 11.5h6"/><path d="M9 15.5h4"/></svg>;
    case 'stock':    return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z"/><path d="M4 7.5V16.5L12 21l8-4.5V7.5"/><path d="M12 12v9"/></svg>;
    case 'gst':      return <svg {...common}><path d="M7 4.5h10"/><path d="M7 9.5h10"/><path d="M7 14.5h5"/><path d="M16.5 13v7"/><path d="M13.5 16h6"/><rect x="4" y="3" width="16" height="18" rx="2.5"/></svg>;
    case 'reports':  return <svg {...common}><path d="M5 19.5V10.5"/><path d="M12 19.5V5.5"/><path d="M19 19.5V13.5"/><path d="M3.5 19.5h17"/></svg>;
    default:         return <svg {...common}><path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z"/></svg>;
  }
}

/* ─── Skeleton ───────────────────────────────────────────────────── */
const DashboardSkeleton = () => (
  <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-3 w-28 bg-slate-200 rounded-full mb-3" />
      <div className="h-7 w-64 bg-slate-200 rounded-full mb-2" />
      <div className="h-3 w-44 bg-slate-100 rounded-full" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
          <div className="h-3 w-20 bg-slate-200 rounded-full mb-3" />
          <div className="h-7 w-28 bg-slate-200 rounded-full mb-2" />
          <div className="h-3 w-16 bg-slate-100 rounded-full" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse h-64" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse h-64" />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();

  /* ── All state (UNCHANGED) ── */
  const [selectedMonth,       setSelectedMonth]       = useState(now.getMonth() + 1);
  const [selectedYear,        setSelectedYear]        = useState(now.getFullYear());
  const [stats,               setStats]               = useState(null);
  const [topProducts,         setTopProducts]         = useState([]);
  const [lowStockProducts,    setLowStockProducts]    = useState([]);
  const [totalCustomerUdhaar, setTotalCustomerUdhaar] = useState(0);
  const [loading,             setLoading]             = useState(true);
  const [refreshing,          setRefreshing]          = useState(false);
  const [cacheLoaded,         setCacheLoaded]         = useState(false);
  const [isOnline,            setIsOnline]            = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheUpdatedAt,      setCacheUpdatedAt]      = useState(null);

  /* NEW: real user name */
  const [userName, setUserName] = useState('');
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      setUserName(stored?.name || stored?.shopName || '');
    } catch { /* silent */ }
  }, []);

  /* ── All effects / logic (UNCHANGED) ── */
  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    const cached = readDashboardCache(selectedMonth, selectedYear);
    if (cached) {
      setStats(cached.stats || null);
      setTopProducts(cached.topProducts || []);
      setLowStockProducts(cached.lowStockProducts || []);
      setTotalCustomerUdhaar(cached.totalCustomerUdhaar || 0);
      setCacheUpdatedAt(cached.cachedAt || null);
      setLoading(false);
      setCacheLoaded(true);
    } else {
      setLoading(true);
      setCacheLoaded(false);
    }

    const controller = new AbortController();
    const idleId = scheduleDeferred(async () => {
      try {
        setRefreshing(Boolean(cached));
        const params = `?month=${selectedMonth}&year=${selectedYear}`;
        const res = await fetch(apiUrl(`/api/dashboard/summary${params}`), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) { if (res.status === 401) router.push('/login'); return; }
        const data = await res.json();
        setStats(data.stats || null);
        setTopProducts(data.topProducts || []);
        setLowStockProducts(data.lowStockProducts || []);
        setTotalCustomerUdhaar(data.totalCustomerUdhaar || 0);
        setLoading(false);
        setCacheLoaded(true);
        writeDashboardCache(selectedMonth, selectedYear, data);
        setCacheUpdatedAt(new Date().toISOString());
      } catch (error) {
        if (error.name !== 'AbortError' && !cached) setLoading(false);
      } finally {
        setRefreshing(false);
      }
    });

    return () => { controller.abort(); cancelDeferred(idleId); };
  }, [router, selectedMonth, selectedYear]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Derived (UNCHANGED) ── */
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  if (loading && !cacheLoaded) return <Layout><DashboardSkeleton /></Layout>;

  const netGST        = stats?.netGSTPayable ?? 0;
  const profit        = stats?.grossProfit ?? 0;
  const revenue       = stats?.totalRevenue || 0;
  const margin        = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
  const lowStockCount = lowStockProducts.length;

  const kpiCards = [
    {
      label: 'महीने की बिक्री',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} bills`,
      href: '/sales',
      topBorder: 'border-t-cyan-500',
      valueColor: 'text-cyan-700',
      noteCls: 'bg-cyan-50 text-cyan-700',
      icon: '🧾',
      iconBg: 'bg-cyan-50',
    },
    {
      label: 'मुनाफा',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `${margin}% margin` : 'रिपोर्ट देखें',
      href: '/reports',
      topBorder: profit >= 0 ? 'border-t-emerald-500' : 'border-t-rose-500',
      valueColor: profit >= 0 ? 'text-emerald-700' : 'text-rose-600',
      noteCls: profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600',
      icon: '📈',
      iconBg: profit >= 0 ? 'bg-emerald-50' : 'bg-rose-50',
    },
    {
      label: 'उधार बाकी',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection बाकी' : 'सब clear ✓',
      href: '/udhaar',
      topBorder: totalCustomerUdhaar > 0 ? 'border-t-rose-500' : 'border-t-emerald-400',
      valueColor: totalCustomerUdhaar > 0 ? 'text-rose-600' : 'text-emerald-700',
      noteCls: totalCustomerUdhaar > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700',
      icon: '💸',
      iconBg: 'bg-rose-50',
    },
    {
      label: 'GST Due',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'जमा करना है' : 'Refund side',
      href: '/gst',
      topBorder: 'border-t-amber-500',
      valueColor: 'text-amber-700',
      noteCls: 'bg-amber-50 text-amber-700',
      icon: '📋',
      iconBg: 'bg-amber-50',
    },
  ];

  const quickActions = [
    { href: '/sales',     icon: 'sales',    hi: 'बेचिए',   sub: 'नया bill',         iconBg: 'bg-cyan-50',   iconColor: 'text-cyan-700'   },
    { href: '/purchases', icon: 'purchase', hi: 'खरीदिए',  sub: 'Purchase',         iconBg: 'bg-blue-50',   iconColor: 'text-blue-700'   },
    { href: '/udhaar',    icon: 'credit',   hi: 'उधार',    sub: 'Credit ledger',    iconBg: 'bg-rose-50',   iconColor: 'text-rose-600'   },
    { href: '/product',   icon: 'stock',    hi: 'स्टॉक',   sub: 'Inventory',        iconBg: 'bg-violet-50', iconColor: 'text-violet-700' },
    { href: '/gst',       icon: 'gst',      hi: 'GST',     sub: 'Tax summary',      iconBg: 'bg-amber-50',  iconColor: 'text-amber-700'  },
    { href: '/reports',   icon: 'reports',  hi: 'रिपोर्ट', sub: 'Hisaab',           iconBg: 'bg-indigo-50', iconColor: 'text-indigo-700' },
  ];

  const breakdownItems = [
    { label: 'Bikri',    value: stats?.totalRevenue, prefix: '',                     color: 'text-cyan-700'    },
    { label: 'Munafa',   value: profit,              prefix: profit >= 0 ? '+' : '', color: profit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
    { label: 'GST Mila', value: stats?.gstCollected, prefix: '',                     color: 'text-amber-700'   },
    { label: 'ITC',      value: stats?.gstITC,       prefix: '-',                    color: 'text-blue-600'    },
    { label: 'Net GST',  value: netGST,              prefix: '',                     color: netGST >= 0 ? 'text-slate-900' : 'text-emerald-600' },
  ];

  const rankColors = [
    'from-cyan-500 to-blue-600',
    'from-blue-500 to-indigo-600',
    'from-indigo-500 to-violet-600',
    'from-violet-500 to-purple-600',
    'from-slate-600 to-slate-800',
  ];

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      {/*
        KEY CHANGE vs old version:
        - Removed `max-w-2xl mx-auto` — that was capping width and causing dead space
        - Now: w-full with px-4/6/8 → fills the full content area beside sidebar
        - Desktop: 4-col KPI row + 3-col main grid (2 left + 1 right)
        - Mobile: single column, bottom nav padding
      */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-5">

        {/* ══ HERO HEADER ════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50/40 to-blue-50/60 px-5 py-5 lg:px-7 lg:py-6 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full bg-cyan-200/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-200/15 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left */}
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-cyan-200 text-[10px] font-bold uppercase tracking-widest text-cyan-700 shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-500'}`} />
                {refreshing ? 'Refreshing...' : isOnline ? 'Live' : 'Offline'}
              </span>

              <h1 className="mt-2.5 text-[24px] lg:text-[28px] font-black text-slate-900 leading-tight tracking-tight">
                {getGreeting()}{userName ? `, ${userName}` : ''} 👋
              </h1>
              <p className="mt-1 text-[13px] text-slate-500">
                {!isOnline
                  ? `📶 Offline snapshot${cacheLabel ? ` · last sync ${cacheLabel}` : ''}`
                  : cacheLabel
                    ? `Last synced ${cacheLabel} · ${MONTHS[selectedMonth - 1]} ${selectedYear}`
                    : `${MONTHS[selectedMonth - 1]} ${selectedYear} का पूरा हिसाब एक जगह`
                }
              </p>
            </div>

            {/* Right — month / year pickers */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              >
                {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ══ OFFLINE BANNER ═════════════════════════════════════════ */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl flex-shrink-0">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Mode</div>
              <div className="text-[11px] text-amber-600">
                Saved snapshot दिख रहा है। Internet आने पर live numbers update होंगे।
              </div>
            </div>
          </div>
        )}

        {/* ══ KPI ROW — 2 cols mobile → 4 cols desktop ══════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => router.push(card.href)}
              className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${card.topBorder} p-4 lg:p-5 shadow-sm text-left hover:-translate-y-0.5 hover:shadow-md transition-all group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center text-lg`}>
                  {card.icon}
                </div>
                <span className="text-slate-200 group-hover:text-slate-400 transition-colors text-sm">→</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                {card.label}
              </div>
              <div className={`text-[22px] lg:text-[24px] font-black leading-none tracking-tight ${card.valueColor} mb-2.5`}>
                {card.value}
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold ${card.noteCls}`}>
                {card.note}
              </span>
            </button>
          ))}
        </div>

        {/* ══ LOW STOCK ALERT ════════════════════════════════════════ */}
        {lowStockCount > 0 && (
          <button
            type="button"
            onClick={() => router.push('/product')}
            className="w-full text-left bg-white rounded-2xl border border-amber-200 border-l-4 border-l-amber-500 px-5 py-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl flex-shrink-0">⚠️</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Low Stock Alert</span>
                  </div>
                  <div className="text-[14px] font-black text-slate-900">
                    {lowStockCount} item{lowStockCount > 1 ? 's' : ''} जल्दी खत्म होंगे
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowStockProducts.slice(0, 5).map((p) => (
                  <span key={p._id} className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-800">
                    {p.name} <span className="opacity-60">({p.quantity ?? 0})</span>
                  </span>
                ))}
                {lowStockCount > 5 && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                    +{lowStockCount - 5} more
                  </span>
                )}
              </div>
              <span className="flex-shrink-0 text-[12px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                देखें →
              </span>
            </div>
          </button>
        )}

        {/* ══ MAIN GRID — 1 col mobile → 3 col desktop ══════════════
            lg:col-span-2  →  Financial breakdown + Top Products
            lg:col-span-1  →  Quick actions + Upgrade + Summary strip
        ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* ── LEFT: 2/3 width ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Financial breakdown */}
            {revenue > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {MONTHS[selectedMonth - 1]} {selectedYear}
                    </span>
                    <div className="text-[16px] font-black text-slate-900 mt-0.5">पैसों का हिसाब</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    profit >= 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-600'
                  }`}>
                    Margin {margin}%
                  </span>
                </div>

                {/* 5-chip breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
                  {breakdownItems.map((item) => (
                    <div key={item.label} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                        {item.label}
                      </div>
                      <div className={`text-[16px] font-black leading-none tracking-tight ${item.color}`}>
                        {item.prefix}₹{fmt(item.value)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-slate-500 font-semibold">Profit Margin</span>
                    <span className={`font-black ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {margin}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        profit >= 0
                          ? 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                          : 'bg-gradient-to-r from-rose-500 to-rose-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.abs(parseFloat(margin)))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Top Products */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {MONTHS[selectedMonth - 1]} {selectedYear}
                  </span>
                  <div className="text-[16px] font-black text-slate-900 mt-0.5">Top Products</div>
                </div>
                <Link href="/sales" className="text-[12px] font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                  सब देखें →
                </Link>
              </div>

              {topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">📦</div>
                  <div className="text-[14px] font-black text-slate-700 mb-1">अभी कोई data नहीं है</div>
                  <div className="text-[12px] text-slate-400 mb-4 max-w-[220px] leading-relaxed">
                    इस period में sales record करो — top products यहाँ दिखेंगे
                  </div>
                  <Link
                    href="/sales"
                    className="inline-flex items-center px-4 py-2 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:shadow-lg transition-all"
                  >
                    + पहला Bill बनाएं
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {topProducts.map((product, index) => (
                    <div
                      key={product.name}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 transition-all"
                    >
                      <div className={`w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${rankColors[index] || rankColors[0]} flex items-center justify-center text-[13px] font-black text-white shadow-sm`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-black text-slate-900 truncate">{product.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{product.qty} units sold</div>
                      </div>
                      <div className="flex-shrink-0 text-[15px] font-black text-emerald-700">
                        ₹{fmt(product.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: 1/3 width ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Shortcuts</span>
                <div className="text-[16px] font-black text-slate-900 mt-0.5">जल्दी काम</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex flex-col items-start gap-2.5 p-3.5 rounded-2xl border border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm transition-all no-underline"
                  >
                    <div className={`w-9 h-9 rounded-xl ${action.iconBg} ${action.iconColor} flex items-center justify-center flex-shrink-0`}>
                      <QuickActionGlyph name={action.icon} />
                    </div>
                    <div>
                      <div className="text-[13px] font-black text-slate-900 leading-tight">{action.hi}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{action.sub}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Month summary — desktop only */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">
                {MONTHS[selectedMonth - 1]} {selectedYear} · Summary
              </span>
              <div className="flex flex-col divide-y divide-slate-50">
                {[
                  { label: 'Total Bills',    value: `${stats?.salesCount || 0}`,    color: 'text-cyan-700'    },
                  { label: 'Udhaar Pending', value: `₹${fmt(totalCustomerUdhaar)}`, color: 'text-rose-600'    },
                  { label: 'Low Stock',      value: `${lowStockCount} items`,        color: 'text-amber-600'   },
                  { label: 'Profit Margin',  value: `${margin}%`,                    color: profit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2.5">
                    <span className="text-[12px] text-slate-500 font-semibold">{row.label}</span>
                    <span className={`text-[13px] font-black ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade CTA */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-sm">
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-cyan-500/10" />
              <div className="pointer-events-none absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-blue-500/10" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3">
                  ⚡ Pro Plan
                </span>
                <div className="text-[14px] font-black text-white leading-tight mb-1">
                  Full reports, GST export, unlimited billing
                </div>
                <div className="text-[11px] text-slate-400 mb-4">एक plan — सब कुछ unlock</div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-slate-900 bg-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
                >
                  Plans देखें →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}