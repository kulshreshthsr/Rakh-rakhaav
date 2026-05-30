'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { hasPermission, getRoleLabel, getRoleColor } from '../../lib/permissions';
import { getSuggestedRoles } from '../../lib/roleConfig';
import { useIndustry } from '../../contexts/IndustryContext';
import { getWorkflowConfig, getDashboardWidgets, getQuickActions } from '../../lib/workflowEngine';
import { useNotifications } from '../../contexts/NotificationContext';

const DASHBOARD_CACHE_KEY = 'dashboard-page';

const DEFAULT_KPI_CONFIG = {
  kpi1: { label: 'आज की कमाई',  sublabel: "Today's Revenue"   },
  kpi2: { label: 'Bills',        sublabel: 'Invoices today'    },
  kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'      },
  kpi4: { label: 'Udhaar',       sublabel: 'Pending credit'    },
  kpi5: { label: 'GST Payable',  sublabel: 'This month'        },
  kpi6: { label: 'Stock Alerts', sublabel: 'Low / Out of stock'},
};

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'शुभ प्रभात 🌅';
  if (h < 17) return 'नमस्ते 🙏';
  if (h < 20) return 'शुभ संध्या 🌇';
  return 'शुभ रात्रि 🌙';
}

function getTodayLabel() {
  return new Date().toLocaleDateString('hi-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function buildUdhaarReminder(customer, shopName) {
  return `Namaste ${customer.name} ji 🙏\n\nHamari dukaan *${shopName || 'Rakh-Rakhaav'}* se aapka udhaar baaki hai:\n\n*₹${fmtD(customer.due)}*\n\nKripya jald se jald payment karein.\n\nDhanyawad 🙏`;
}

/* Enhanced Quick Action Card with Green Theme */
function QuickAction({ href, emoji, label, sublabel, gradient }) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${gradient} border-2 border-transparent text-center hover:border-green-300 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 active:scale-95`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="relative text-3xl transform group-hover:scale-110 transition-transform">{emoji}</span>
      <div className="relative">
        <span className="block text-[14px] font-black text-slate-900 leading-tight">{label}</span>
        {sublabel && <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{sublabel}</span>}
      </div>
    </Link>
  );
}

/* Stat Card Component */
function StatCard({ label, value, sub, gradient, icon, href }) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden bg-gradient-to-br ${gradient} border-2 border-white/50 rounded-2xl p-4 hover:border-green-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}
    >
      <div className="absolute top-2 right-2 text-3xl opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <p className="relative text-[18px] font-black leading-none text-slate-900 mb-1">{value}</p>
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </Link>
  );
}

const CALLOUT_COLORS = {
  cyan:   { border: 'border-cyan-200',   bg: 'from-cyan-50 to-sky-50',      icon: 'from-cyan-400 to-sky-500',      text: 'text-cyan-900',   sub: 'text-cyan-700'   },
  orange: { border: 'border-orange-200', bg: 'from-orange-50 to-amber-50',  icon: 'from-orange-400 to-amber-500',  text: 'text-orange-900', sub: 'text-orange-700' },
  purple: { border: 'border-purple-200', bg: 'from-purple-50 to-violet-50', icon: 'from-purple-400 to-violet-500', text: 'text-purple-900', sub: 'text-purple-700' },
  blue:   { border: 'border-blue-200',   bg: 'from-blue-50 to-cyan-50',     icon: 'from-blue-400 to-cyan-500',     text: 'text-blue-900',   sub: 'text-blue-700'   },
  green:  { border: 'border-green-200',  bg: 'from-green-50 to-emerald-50', icon: 'from-green-400 to-emerald-500', text: 'text-green-900',  sub: 'text-green-700'  },
  amber:  { border: 'border-amber-200',  bg: 'from-amber-50 to-yellow-50',  icon: 'from-amber-400 to-yellow-500',  text: 'text-amber-900',  sub: 'text-amber-700'  },
  rose:   { border: 'border-rose-200',   bg: 'from-rose-50 to-pink-50',     icon: 'from-rose-400 to-pink-500',     text: 'text-rose-900',   sub: 'text-rose-700'   },
  indigo: { border: 'border-indigo-200', bg: 'from-indigo-50 to-blue-50',   icon: 'from-indigo-400 to-blue-500',   text: 'text-indigo-900', sub: 'text-indigo-700' },
  teal:   { border: 'border-teal-200',   bg: 'from-teal-50 to-cyan-50',     icon: 'from-teal-400 to-cyan-500',     text: 'text-teal-900',   sub: 'text-teal-700'   },
  red:    { border: 'border-red-200',    bg: 'from-red-50 to-rose-50',      icon: 'from-red-400 to-rose-500',      text: 'text-red-900',    sub: 'text-red-700'    },
  pink:   { border: 'border-pink-200',   bg: 'from-pink-50 to-rose-50',     icon: 'from-pink-400 to-rose-500',     text: 'text-pink-900',   sub: 'text-pink-700'   },
  slate:  { border: 'border-slate-200',  bg: 'from-slate-50 to-gray-50',    icon: 'from-slate-400 to-gray-500',    text: 'text-slate-900',  sub: 'text-slate-700'  },
};

const TILE_GRADIENTS = {
  orange: 'from-orange-50 to-amber-100',
  blue:   'from-blue-50 to-cyan-100',
  amber:  'from-amber-50 to-yellow-100',
  purple: 'from-purple-50 to-violet-100',
  green:  'from-green-50 to-emerald-100',
  rose:   'from-rose-50 to-pink-100',
  cyan:   'from-cyan-50 to-sky-100',
  indigo: 'from-indigo-50 to-blue-100',
  teal:   'from-teal-50 to-cyan-100',
  red:    'from-red-50 to-rose-100',
  pink:   'from-pink-50 to-rose-100',
  slate:  'from-slate-50 to-gray-100',
};

function DashCallout({ callout }) {
  const c = CALLOUT_COLORS[callout.color] || CALLOUT_COLORS.green;
  return (
    <Link href={callout.href}
      className={`group flex items-center gap-4 px-4 py-4 rounded-2xl border-2 ${c.border} bg-gradient-to-br ${c.bg} hover:-translate-y-0.5 hover:shadow-lg transition-all`}
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.icon} flex items-center justify-center text-2xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
        {callout.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-black ${c.text}`}>{callout.title}</p>
        <p className={`text-[12px] ${c.sub} font-medium mt-0.5`}>{callout.body}</p>
      </div>
      {callout.cta && (
        <span className="flex-shrink-0 text-[11px] font-black text-slate-500 group-hover:translate-x-0.5 transition-transform">
          {callout.cta} →
        </span>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { term, config, businessType } = useIndustry();
  const { notifications, taskCount } = useNotifications();
  // terminology holds the business-config specific data (dashboardConfig, workflowConfig, kpiConfig)
  const bizConfig  = config?.terminology || {};
  const wfc        = getWorkflowConfig(bizConfig);
  const wfWidgets  = getDashboardWidgets(wfc);
  const wfActions  = getQuickActions(wfc);
  const dashCfg    = bizConfig.dashboardConfig || null;
  const kpiConfig  = bizConfig.kpiConfig || DEFAULT_KPI_CONFIG;

  const hasBootstrappedRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerPhoto, setOwnerPhoto] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [greeting] = useState(getGreeting);
  const [today] = useState(getTodayLabel);
  const [workflowCounts, setWorkflowCounts] = useState({});
  const [agingData, setAgingData] = useState(null);
  const [agingLoading, setAgingLoading] = useState(false);
  const [showAging, setShowAging] = useState(false);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      if (!silent) setError('');
      const [dashRes, shopRes] = await Promise.all([
        fetch(apiUrl('/api/dashboard/summary'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401 || shopRes.status === 401) { router.push('/login'); return; }
      if (!dashRes.ok || !shopRes.ok) throw new Error('Failed to load dashboard');
      const dashData = await dashRes.json();
      const shopData = await shopRes.json();
      const nextShopName = shopData.name || 'मेरी दुकान';
      const nextOwnerPhoto = shopData.owner_photo || '';
      setData(dashData);
      setShopName(nextShopName);
      setOwnerPhoto(nextOwnerPhoto);
      writePageCache(DASHBOARD_CACHE_KEY, { data: dashData, shopName: nextShopName, ownerPhoto: nextOwnerPhoto });
    } catch (err) {
      if (!silent) { setData(null); setError(err.message || 'Dashboard data load nahi ho paya.'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchWorkflowCounts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/dashboard/workflow-counts'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setWorkflowCounts(d.counts || {});
      }
    } catch {
      // non-critical — silently ignore
    }
  }, []);

  const fetchCreditAging = async () => {
    setAgingLoading(true);
    try {
      const res = await fetch(apiUrl('/api/dashboard/credit-aging'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const cdata = await res.json();
        setAgingData(cdata);
      }
    } catch (e) {
      console.error('credit aging fetch failed', e);
    } finally {
      setAgingLoading(false);
    }
  };

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(user.name || '');
    if (user.isSubUser) { setIsStaffUser(true); setUserRole(user.role || null); }

    const cached = readPageCache(DASHBOARD_CACHE_KEY);
    if (cached?.data) {
      setData(cached.data);
      setShopName(cached.shopName || 'मेरी दुकान');
      setOwnerPhoto(cached.ownerPhoto || '');
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.data));
      await Promise.all([
        fetchDashboard({ silent: Boolean(cached?.data) }),
        fetchWorkflowCounts(),
      ]);
      setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchDashboard, fetchWorkflowCounts, router]);

  useEffect(() => {
    if (!wfc) return;
    const interval = setInterval(fetchWorkflowCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchWorkflowCounts, wfc]);

  const expiryStats     = data?.expiryStats     || { expiredCount: 0, expiring7Days: 0, expiring30Days: 0 };
  const insurancePending = data?.insurancePending || 0;

  const today_sales = data?.today?.revenue || 0;
  const today_bills = data?.today?.bills || 0;
  const today_profit = data?.today?.profit || 0;
  const month_sales = data?.month?.revenue || 0;
  const month_profit = data?.month?.profit || 0;
  const total_udhaar = data?.udhaar?.totalDue || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable = data?.gst?.netPayable || 0;
  const low_stock = data?.stock?.lowStockCount || 0;
  const out_of_stock = data?.stock?.outOfStockCount || 0;

  const paymentSplit = data?.paymentSplit || {};
  const topUdhaarCustomers = (data?.udhaar?.topCustomers || []).slice(0, 5);
  const lowStockItems = (data?.stock?.lowStockItems || []).slice(0, 4);

  /* Skeleton loader — matches dashboard layout to prevent shift */
  if (loading) {
    return (
      <Layout>
        <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
          {/* Header card skeleton */}
          <div className="skeleton-card border border-slate-200/60" style={{ height: 96 }} />
          {/* Today stats section */}
          <div className="space-y-2">
            <div className="skeleton-text w-1/4" style={{ width: '25%' }} />
            <div className="skeleton-card border border-slate-200/60" style={{ height: 130 }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="skeleton-card border border-slate-200/60" style={{ height: 72 }} />
              <div className="skeleton-card border border-slate-200/60" style={{ height: 72 }} />
            </div>
          </div>
          {/* Quick actions skeleton */}
          <div className="space-y-2">
            <div className="skeleton-text" style={{ width: '18%' }} />
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card border border-slate-200/60" style={{ height: 80 }} />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-5">
            <p className="text-[16px] font-black text-red-900">Dashboard data load nahi ho paya.</p>
            <p className="mt-2 text-[13px] text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchDashboard}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-red-700 shadow-lg hover:shadow-xl transition-all"
            >
              Dobara load karo
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const hasUrgent = udhaar_count > 0 || low_stock > 0 || out_of_stock > 0;

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">
        {refreshing && (
          <div className="flex items-center justify-end gap-1.5 px-1 -mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Updating…</span>
          </div>
        )}

        {/* ══════════════════════════════════════
            1. GREETING HEADER - Enhanced Green Theme
        ══════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-6 shadow-xl">
          {/* Decorative green orbs */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-green-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{today}</p>
              <h1 className="text-[24px] sm:text-[26px] font-black text-white leading-tight">
                {greeting}
              </h1>
              {userName && (
                <p className="text-[14px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{userName}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 font-bold">
                    {shopName}
                  </span>
                </p>
              )}
            </div>

            {ownerPhoto ? (
              <img
                src={ownerPhoto}
                alt={userName || 'Shopkeeper'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-green-500/30 shadow-lg shadow-green-500/20 flex-shrink-0 hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 border-2 border-green-400/30 flex items-center justify-center text-white text-[28px] font-black flex-shrink-0 shadow-lg shadow-green-500/20 hover:scale-105 transition-transform">
                {(userName || shopName || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            1b. STAFF ROLE BANNER — visible only for sub-users
        ══════════════════════════════════════ */}
        {isStaffUser && userRole && (() => {
          const rc = getRoleColor(userRole);
          const suggestions = getSuggestedRoles(config);
          const match = suggestions.find(s => s.role === userRole);
          const roleEmoji = match?.emoji || '👤';
          const roleTitle = match?.businessLabel || getRoleLabel(userRole);
          const roleDesc  = match?.description || 'You have role-limited access to this shop.';
          return (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${rc.border} ${rc.bg}`}>
              <span className="text-2xl flex-shrink-0">{roleEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-black ${rc.text}`}>{roleTitle}</p>
                <p className={`text-[11px] font-medium mt-0.5 ${rc.text} opacity-75`}>{roleDesc}</p>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${rc.border} ${rc.bg} ${rc.text}`}>
                {getRoleLabel(userRole)}
              </span>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════
            2. आज का हाल - Today's Performance with Green Gradient
        ══════════════════════════════════════ */}
        <div>
          <div className="page-section-row px-0.5">
            <span className="page-section-label">आज का हाल</span>
            {hasPermission('VIEW_SALES') && (
              <Link href="/sales" className="page-section-link">सभी bills →</Link>
            )}
          </div>

          {/* Big today revenue card - Green gradient */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 p-6 mb-3 shadow-2xl shadow-green-500/30 hover:shadow-green-500/40 hover:-translate-y-0.5 transition-all">
            <div className="pointer-events-none absolute -top-8 right-4 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-emerald-400/20 blur-2xl" />
            
            <div className="relative z-10">
              <p className="text-[12px] font-bold text-white/80 uppercase tracking-wider mb-2">{kpiConfig.kpi1.label}</p>
              <p className="text-[42px] sm:text-[48px] font-black text-white leading-none tracking-tight mb-4">
                ₹{fmt(today_sales)}
              </p>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xl">{businessType === 'general' ? '💵' : '🧾'}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">{kpiConfig.kpi2.label}</p>
                    {businessType === 'general' ? (
                      <div>
                        <p className="text-[20px] font-black text-white">₹{fmt(paymentSplit.cashInHand)}</p>
                        {(paymentSplit.creditGiven || 0) > 0 && (
                          <p className="text-[10px] font-bold text-amber-300">+₹{fmt(paymentSplit.creditGiven)} credit</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[20px] font-black text-white">{today_bills}</p>
                    )}
                  </div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xl">💰</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">{kpiConfig.kpi3.label}</p>
                    <p className="text-[20px] font-black text-white">₹{fmt(today_profit)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary stats row - Enhanced with gradients */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
            {hasPermission('VIEW_UDHAAR') && (
              <StatCard
                label={kpiConfig.kpi4.label}
                value={`₹${fmt(total_udhaar)}`}
                sub={`${udhaar_count} ग्राहक`}
                gradient="from-red-50 to-rose-100"
                icon="💸"
                href="/udhaar"
              />
            )}
            {hasPermission('VIEW_GST') && (
              <StatCard
                label={kpiConfig.kpi5.label}
                value={`₹${fmt(gst_payable)}`}
                sub={kpiConfig.kpi5.sublabel}
                gradient="from-amber-50 to-orange-100"
                icon="📊"
                href="/gst"
              />
            )}
            {hasPermission('VIEW_REPORTS') && (
              <StatCard
                label="इस महीने"
                value={`₹${fmt(month_sales)}`}
                sub={`₹${fmt(month_profit)} profit`}
                gradient="from-green-50 to-emerald-100"
                icon="📈"
                href="/reports"
              />
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            2b. CREDIT AGING — General Store Only
        ══════════════════════════════════════ */}
        {businessType === 'general' && (
          <div id="credit-aging">
            <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 overflow-hidden shadow-md">
              {/* Collapsible header */}
              <button
                className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-white/30 transition-colors"
                onClick={() => {
                  const next = !showAging;
                  setShowAging(next);
                  if (next && agingData === null) fetchCreditAging();
                }}
              >
                <div>
                  <p className="text-[14px] font-black text-indigo-900">📊 Purana उधार रिपोर्ट</p>
                  <p className="text-[12px] text-indigo-700 font-medium mt-0.5">कितने दिन पुराना उधार है?</p>
                </div>
                <span className="flex-shrink-0 text-[11px] font-black text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-lg">
                  {showAging ? 'Collapse ▲' : 'Expand ▼'}
                </span>
              </button>

              {/* Expanded content */}
              {showAging && (
                <div className="border-t border-indigo-200 px-4 py-4 space-y-4">
                  {agingLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-indigo-100 animate-pulse" />
                      ))}
                    </div>
                  ) : agingData ? (
                    <>
                      {agingData.customers.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-[15px] font-black text-emerald-700">✅ कोई पुराना उधार नहीं — सब हिसाब बराबर है!</p>
                        </div>
                      ) : (
                        <>
                          {/* Bucket summary */}
                          <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2">
                            {[
                              { key: '0-30 days',  grad: 'from-emerald-50 to-green-100',  border: 'border-emerald-200', text: 'text-emerald-800', label: '0-30 दिन'  },
                              { key: '31-60 days', grad: 'from-amber-50 to-yellow-100',   border: 'border-amber-200',   text: 'text-amber-800',   label: '31-60 दिन' },
                              { key: '61-90 days', grad: 'from-orange-50 to-amber-100',   border: 'border-orange-200',  text: 'text-orange-800',  label: '61-90 दिन' },
                              { key: '90+ days',   grad: 'from-red-50 to-rose-100',       border: 'border-red-200',     text: 'text-red-800',     label: '90+ दिन'   },
                            ].map(b => {
                              const bkt = agingData.summary[b.key] || { count: 0, total: 0 };
                              return (
                                <div key={b.key} className={`bg-gradient-to-br ${b.grad} border-2 ${b.border} rounded-xl p-3 text-center`}>
                                  <p className={`text-[15px] font-black ${b.text}`}>₹{fmt(bkt.total)}</p>
                                  <p className={`text-[10px] font-bold ${b.text} mt-0.5`}>{b.label}</p>
                                  <p className="text-[10px] text-slate-500">{bkt.count} customers</p>
                                </div>
                              );
                            })}
                          </div>

                          {/* Grand total */}
                          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-50 border border-red-200">
                            <span className="text-[13px] font-bold text-red-900">कुल Outstanding</span>
                            <span className="text-[16px] font-black text-red-700">₹{fmt(agingData.grandTotal)}</span>
                          </div>

                          {/* Customer list */}
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {agingData.customers.map((c, i) => {
                              const cName  = c._id?.buyerName  || 'Unknown';
                              const cPhone = (c._id?.buyerPhone || '').replace(/\D/g, '');
                              const waMsg  = `Namaste ${cName} ji 🙏\n\nHamari General Store se aapka ₹${fmt(c.totalDue)} udhaar baaki hai.\n\nKripya jald se jald payment karein.\n\nDhanyawad 🙏`;
                              const dotColor = ({
                                '0-30 days': 'bg-emerald-500',
                                '31-60 days': 'bg-amber-500',
                                '61-90 days': 'bg-orange-500',
                                '90+ days': 'bg-red-500',
                              })[c.agingBucket] || 'bg-slate-400';
                              return (
                                <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                      <p className="text-[13px] font-black text-slate-900">{cName}</p>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      ₹{fmt(c.totalDue)} due • {c.billCount} bill{c.billCount !== 1 ? 's' : ''} • Oldest: {c.oldestBillAge} days
                                      {c._id?.buyerPhone ? ` • 📞 ${c._id.buyerPhone}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 flex-shrink-0">
                                    {cPhone && (
                                      <a
                                        href={`https://wa.me/91${cPhone}?text=${encodeURIComponent(waMsg)}`}
                                        target="_blank" rel="noreferrer"
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors"
                                      >WhatsApp</a>
                                    )}
                                    <Link href="/udhaar" className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-colors">
                                      View
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 text-right">
                            As of {new Date(agingData.asOf).toLocaleString('en-IN')}
                          </p>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            3. जल्दी काम - Quick Actions (industry-aware)
        ══════════════════════════════════════ */}
        {(() => {
          const workflowQuickItems = wfActions.map(a => ({
            href: a.href, emoji: a.icon,
            label: a.labelHindi || a.label, sublabel: a.label,
            gradient: 'from-indigo-50 to-blue-100', permission: a.permission || 'CREATE_INVOICE',
          }));
          const quickActions = [
            // workflow-specific actions first (e.g. "Kitchen Queue" for restaurant)
            ...workflowQuickItems,
            // standard actions
            { href: '/sales?open=1&payment=cash',   emoji: config.icon || '🧾', label: term('quickNewSaleHindi', 'Bill बनाओ'), sublabel: term('sale','Sale'),          gradient: 'from-green-50 to-emerald-100',  permission: 'CREATE_INVOICE'   },
            { href: '/sales?open=1&payment=credit',  emoji: '📒',                label: 'उधार दो',         sublabel: 'Credit',                    gradient: 'from-rose-50 to-red-100',       permission: 'CREATE_INVOICE'   },
            { href: '/purchases',                    emoji: '🛒',                label: term('quickPurchaseHindi', 'माल खरीदो'), sublabel: term('purchase','Purchase'), gradient: 'from-amber-50 to-orange-100',   permission: 'CREATE_PURCHASE'  },
            { href: '/product',                      emoji: '📦',                label: term('quickAddStockHindi','Product जोड़ो'), sublabel: term('inventory','स्टॉक'), gradient: 'from-blue-50 to-cyan-100', permission: 'MANAGE_INVENTORY' },
            { href: '/expenses',                     emoji: '💳',                label: 'खर्च लिखो',       sublabel: 'Expenses',                  gradient: 'from-purple-50 to-violet-100',  permission: 'VIEW_EXPENSES'    },
            { href: '/udhaar',                       emoji: '💸',                label: 'पैसे लो',         sublabel: 'Collect',                   gradient: 'from-pink-50 to-rose-100',      permission: 'VIEW_UDHAAR'      },
            { href: '/reports',                      emoji: '📊',                label: 'हिसाब देखो',      sublabel: 'Reports',                   gradient: 'from-slate-50 to-gray-100',     permission: 'VIEW_REPORTS'     },
          ].filter(a => hasPermission(a.permission));
          if (quickActions.length === 0) return null;
          return (
            <div>
              <div className="page-section-row px-0.5 mb-3">
                <span className="page-section-label">जल्दी काम</span>
              </div>
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
                {quickActions.map(a => (
                  <QuickAction key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} gradient={a.gradient} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════
            4. ज़रूरी काम - Urgent Tasks Enhanced
        ══════════════════════════════════════ */}
        {hasUrgent && (hasPermission('MANAGE_INVENTORY') || hasPermission('VIEW_UDHAAR')) && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">⚠️ ज़रूरी काम</span>
              {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
                <Link href="/product" className="page-section-link" style={{ color: '#d97706' }}>
                  सभी देखें →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {/* Stock alert - Enhanced */}
              {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
                <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-200/50 bg-white/50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                      ⚠️
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-0.5">{kpiConfig.kpi6.label}</p>
                      <p className="text-[14px] font-black text-amber-900">
                        {out_of_stock > 0 ? `${out_of_stock} ${term('product','product')} खत्म हो गया` : `${low_stock} ${term('product','product')} कम हो रहा है`}
                      </p>
                      <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                        {out_of_stock > 0 && low_stock > 0
                          ? `${out_of_stock} खत्म • ${low_stock} कम`
                          : out_of_stock > 0
                            ? 'Stock zero है — अभी order करो'
                            : 'जल्दी माल मंगाओ'}
                      </p>
                    </div>
                    <Link href="/product"
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-[11px] font-black text-white hover:bg-amber-700 transition-colors shadow-md"
                    >देखो</Link>
                  </div>

                  {lowStockItems.length > 0 && (
                    <div className="divide-y divide-amber-100">
                      {lowStockItems.map((item, i) => (
                        <div key={item._id || i} className="flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors">
                          <span className="text-[13px] font-bold text-slate-800">{item.name}</span>
                          <span className={`text-[12px] font-black px-3 py-1 rounded-lg shadow-sm ${
                            item.quantity === 0
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}>
                            {item.quantity === 0 ? 'खत्म' : `${item.quantity} बचा`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Udhaar collection - Enhanced */}
              {udhaar_count > 0 && hasPermission('VIEW_UDHAAR') && (
                <div className="rounded-2xl border-2 border-rose-200 bg-white overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-rose-100 bg-gradient-to-br from-rose-50 to-red-50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                      💸
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-black text-rose-900">
                        {udhaar_count} ग्राहक से पैसे लेने हैं
                      </p>
                      <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                        कुल ₹{fmtD(total_udhaar)} बाकी है
                      </p>
                    </div>
                    <Link href="/udhaar"
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-rose-600 text-[11px] font-black text-white hover:bg-rose-700 transition-colors shadow-md"
                    >सब देखो</Link>
                  </div>

                  {topUdhaarCustomers.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {topUdhaarCustomers.map((c, i) => {
                        const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
                        const msg = buildUdhaarReminder(c, shopName);
                        const waUrl = phone
                          ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
                          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                        return (
                          <div key={c._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                            {/* Avatar with gradient */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-red-600 flex items-center justify-center text-white font-black text-[14px] flex-shrink-0 shadow-md">
                              {c.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                              {c.phone && <p className="text-[11px] text-slate-500 font-medium">{c.phone}</p>}
                            </div>
                            {/* Due amount */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-[15px] font-black text-rose-600">₹{fmtD(c.due)}</p>
                            </div>
                            {/* WhatsApp button */}
                            <a href={waUrl} target="_blank" rel="noreferrer"
                              className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-[16px] hover:scale-110 transition-all shadow-lg shadow-emerald-500/30"
                              title={`WhatsApp reminder to ${c.name}`}
                            >
                              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.122 1.524 5.861L.057 23.57l5.866-1.54A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.034-1.385l-.361-.214-3.482.914.93-3.393-.235-.373A9.82 9.82 0 012.182 12C2.182 6.566 6.566 2.182 12 2.182S21.818 6.566 21.818 12 17.434 21.818 12 21.818z"/>
                              </svg>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            4b. BUSINESS CALLOUT & TILES (config-driven)
        ══════════════════════════════════════ */}

        {/* Business-specific featured callout */}
        {dashCfg?.callout && hasPermission(dashCfg.callout.permission || 'MANAGE_INVENTORY') && (
          <DashCallout callout={dashCfg.callout} />
        )}

        {/* Business-specific operational tiles */}
        {(() => {
          const dashTiles = (dashCfg?.tiles || []).filter(t => hasPermission(t.permission || 'CREATE_INVOICE'));
          if (dashTiles.length === 0) return null;
          return (
            <div>
              <div className="page-section-row px-0.5 mb-3">
                <span className="page-section-label">Business Tools</span>
              </div>
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
                {dashTiles.map(t => {
                  // Pharmacy-specific expiry tile — show live count badge
                  if (t.id === 'expiry' && businessType === 'pharmacy') {
                    const expired   = expiryStats.expiredCount;
                    const exp7      = expiryStats.expiring7Days;
                    const exp30     = expiryStats.expiring30Days;
                    const badgeCls  = expired > 0 ? 'bg-red-500' : exp7 > 0 ? 'bg-red-400' : 'bg-amber-500';
                    const badgeNum  = expired > 0 ? expired : exp7 > 0 ? exp7 : exp30;
                    const sublabelTxt = expired > 0
                      ? `⚠️ ${expired} already expired — remove now`
                      : exp7 > 0
                      ? `${exp7} expiring this week`
                      : exp30 > 0
                      ? `${exp30} expiring in 30 days`
                      : 'All stock within date ✓';
                    return (
                      <Link key={t.id} href="/product?filter=expiring"
                        className={`group relative overflow-hidden flex flex-col gap-2 p-4 rounded-2xl bg-gradient-to-br ${TILE_GRADIENTS[t.color] || 'from-orange-50 to-amber-100'} border-2 border-transparent hover:border-green-300 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 active:scale-95`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-3xl transform group-hover:scale-110 transition-transform">{t.icon}</span>
                          {badgeNum > 0 && (
                            <span className={`${badgeCls} text-white text-[11px] font-black px-2 py-0.5 rounded-full`}>{badgeNum}</span>
                          )}
                        </div>
                        <div>
                          <span className="block text-[14px] font-black text-slate-900 leading-tight">{t.label}</span>
                          <span className="block text-[10px] font-bold text-slate-500 mt-0.5 leading-snug">{sublabelTxt}</span>
                        </div>
                      </Link>
                    );
                  }
                  return (
                    <QuickAction key={t.id} href={t.href} emoji={t.icon} label={t.label} sublabel={t.sublabel || ''} gradient={TILE_GRADIENTS[t.color] || 'from-slate-50 to-gray-100'} />
                  );
                })}
              </div>
              {/* Insurance claims pending — pharmacy only */}
              {businessType === 'pharmacy' && insurancePending > 0 && (
                <Link href="/sales?filter=insurance_pending"
                  className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <span className="text-xl flex-shrink-0">🏥</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-blue-900">{insurancePending} Insurance Claims Pending</p>
                    <p className="text-[11px] text-blue-600 font-medium">Awaiting reimbursement →</p>
                  </div>
                </Link>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════
            4c. WORKFLOW OPERATIONS WIDGET
            Shows stage-based navigation tiles when the business has a workflow.
        ══════════════════════════════════════ */}
        {wfc && wfWidgets.length > 0 && hasPermission('CREATE_INVOICE') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">{wfc.saleNounPlural || 'Operations'}</span>
              <Link href="/sales" className="page-section-link">सभी देखें →</Link>
            </div>
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
              {wfWidgets.map(widget => {
                const count = widget.stages.reduce((sum, stage) => sum + (workflowCounts[stage] || 0), 0);
                return (
                  <Link
                    key={widget.id}
                    href={`/sales?wf=${widget.stages[0]}`}
                    className="group flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-green-300 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{widget.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-800 leading-tight">{widget.label}</p>
                      <p className="text-[10px] font-bold text-green-600 mt-0.5">View →</p>
                    </div>
                    {count > 0
                      ? <span className="flex-shrink-0 bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full min-w-[22px] text-center">{count}</span>
                      : <span className="flex-shrink-0 text-slate-400 text-[11px]">0</span>
                    }
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Business tip */}
        {dashCfg?.tip && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{dashCfg.tip}</p>
          </div>
        )}

        {/* ══════════════════════════════════════
            4c. OPERATIONAL STATUS — Alerts & Tasks
        ══════════════════════════════════════ */}
        {(() => {
          const urgentAlerts = notifications.filter(n => !n.isRead && ['critical','high'].includes(n.priority)).slice(0, 3);
          const hasOps = urgentAlerts.length > 0 || taskCount > 0;
          if (!hasOps) return null;
          const PRIORITY_DOT = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
          const TYPE_ICON = { low_stock: '📦', out_of_stock: '🚫', expiry_warning: '⏰', expired: '☠️', workflow_delay: '⚠️' };
          return (
            <div className="bg-white rounded-2xl border border-red-200/80 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚨</span>
                  <p className="text-[13px] font-black text-red-900">Needs Attention</p>
                </div>
                <div className="flex items-center gap-2">
                  {taskCount > 0 && (
                    <Link href="/tasks"
                      className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition-colors">
                      {taskCount} task{taskCount !== 1 ? 's' : ''} →
                    </Link>
                  )}
                  <Link href="/notifications"
                    className="text-[11px] font-black text-red-700 hover:underline">
                    See all →
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {urgentAlerts.map(alert => (
                  <Link key={alert._id} href="/notifications"
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICON[alert.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-slate-900 leading-snug">{alert.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{alert.message}</p>
                    </div>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[alert.priority] || '#d97706', flexShrink: 0, marginTop: 5 }} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════
            5. MOTIVATIONAL FOOTER - Enhanced Green Theme
        ══════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 px-5 py-4 flex items-center justify-between gap-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-green-300/20 blur-2xl" />
          <div className="relative z-10 flex-1">
            <p className="text-[13px] font-black text-slate-800">
              {today_bills === 0
                ? `आज का पहला ${term('invoice','bill')} बनाओ `
                : today_bills === 1
                  ? `एक ${term('invoice','bill')} हो गया, और करो! `
                  : `आज ${today_bills} ${term('invoice','bill')} बन गए — बढ़िया! `}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">
              {shopName} — रखरखाव के साथ
            </p>
          </div>
          {hasPermission('CREATE_INVOICE') && (
            <Link href="/sales"
              className="relative z-10 flex-shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-[13px] font-black text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px transition-all"
            >
              बिल बनाओ →
            </Link>
          )}
        </div>

      </div>
    </Layout>
  );
}