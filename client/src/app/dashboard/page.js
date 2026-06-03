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
  return `नमस्ते ${customer.name} जी 🙏\n\nहमारी दुकान *${shopName || 'रखरखाव'}* से आपका उधार बाकी है:\n\n*₹${fmtD(customer.due)}*\n\nकृपया जल्द से जल्द payment करें।\n\nधन्यवाद 🙏`;
}

// ═══════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function DashboardHeader({ shopName, userName, greeting, today, dashboardMode }) {
  const badgeMap = {
    b2c:    { cls: 'bg-blue-50 text-blue-700 border border-blue-200',   text: '🛍️ Retail' },
    b2b:    { cls: 'bg-amber-50 text-amber-700 border border-amber-200', text: '🏭 Wholesale' },
    hybrid: { cls: 'bg-green-50 text-green-700 border border-green-200', text: '🔄 Hybrid' },
  };
  const badge = badgeMap[dashboardMode] || badgeMap.b2c;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-black text-slate-900 leading-tight">{greeting}</h1>
          {(userName || shopName) && (
            <p className="text-[13px] font-bold text-green-700 mt-0.5 truncate">
              {userName && <span>{userName}</span>}
              {userName && shopName && <span className="text-slate-400 mx-1.5">•</span>}
              {shopName && <span>{shopName}</span>}
            </p>
          )}
          <p className="text-[11px] text-slate-400 uppercase tracking-wide mt-0.5">{today}</p>
        </div>
        <Link href="/profile" className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors hover:opacity-80 ${badge.cls}`}>
          {badge.text}
        </Link>
      </div>
    </div>
  );
}

function StaffBanner({ userRole, config }) {
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
}

function KPIStrip({ tiles }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3">
      {tiles.filter(Boolean).map((tile, i) => (
        <Link key={i} href={tile.href}
          className={`flex-shrink-0 w-32 rounded-2xl p-3 shadow-sm border ${
            tile.alert === 'red'   ? 'bg-red-50 border-red-200' :
            tile.alert === 'amber' ? 'bg-amber-50 border-amber-200' :
            'bg-white border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{tile.label}</p>
          <p className="text-[18px] font-black text-slate-900 mt-1 leading-none">{tile.value}</p>
          <p className="text-[10px] text-slate-500 mt-1 leading-tight">{tile.sublabel}</p>
        </Link>
      ))}
    </div>
  );
}

function QuickActionCard({ href, emoji, label, sublabel }) {
  return (
    <Link href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 text-center hover:border-green-300 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <span className="block text-[13px] font-black text-slate-800 leading-tight">{label}</span>
        {sublabel && <span className="block text-[10px] text-slate-500 mt-0.5">{sublabel}</span>}
      </div>
    </Link>
  );
}

function UrgentTasksPanel({ data, shopName, term }) {
  const low_stock       = data?.stock?.lowStockCount || 0;
  const out_of_stock    = data?.stock?.outOfStockCount || 0;
  const udhaar_count    = data?.udhaar?.pendingCount || 0;
  const total_udhaar    = data?.udhaar?.totalDue || 0;
  const lowStockItems   = (data?.stock?.lowStockItems || []).slice(0, 4);
  const topUdhaarCusts  = (data?.udhaar?.topCustomers || []).slice(0, 5);
  const hasUrgent       = udhaar_count > 0 || low_stock > 0 || out_of_stock > 0;

  if (!hasUrgent) return null;
  if (!hasPermission('MANAGE_INVENTORY') && !hasPermission('VIEW_UDHAAR')) return null;

  return (
    <div>
      <div className="page-section-row px-0.5">
        <span className="page-section-label">⚠️ ज़रूरी काम</span>
        {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
          <Link href="/product" className="page-section-link" style={{ color: '#d97706' }}>सभी देखें →</Link>
        )}
      </div>
      <div className="space-y-3">
        {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">⚠️</div>
              <div className="flex-1">
                <p className="text-[14px] font-black text-amber-900">
                  {out_of_stock > 0 ? `${out_of_stock} ${term('product','product')} खत्म हो गया` : `${low_stock} ${term('product','product')} कम हो रहा है`}
                </p>
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                  {out_of_stock > 0 && low_stock > 0 ? `${out_of_stock} खत्म • ${low_stock} कम` : out_of_stock > 0 ? 'Stock zero है — अभी order करो' : 'जल्दी माल मंगाओ'}
                </p>
              </div>
              <Link href="/product" className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-[11px] font-black text-white hover:bg-amber-700 transition-colors">देखो</Link>
            </div>
            {lowStockItems.length > 0 && (
              <div className="divide-y divide-amber-100">
                {lowStockItems.map((item, i) => (
                  <div key={item._id || i} className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] font-bold text-slate-800">{item.name}</span>
                    <span className={`text-[12px] font-black px-3 py-1 rounded-lg ${item.quantity === 0 ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                      {item.quantity === 0 ? 'खत्म' : `${item.quantity} बचा`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {udhaar_count > 0 && hasPermission('VIEW_UDHAAR') && (
          <div className="rounded-2xl border border-red-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-red-100 bg-red-50">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl flex-shrink-0">💸</div>
              <div className="flex-1">
                <p className="text-[14px] font-black text-red-900">{udhaar_count} ग्राहक से पैसे लेने हैं</p>
                <p className="text-[11px] text-red-700 font-medium mt-0.5">कुल ₹{fmtD(total_udhaar)} बाकी है</p>
              </div>
              <Link href="/udhaar" className="flex-shrink-0 px-4 py-2 rounded-xl bg-red-600 text-[11px] font-black text-white hover:bg-red-700 transition-colors">सब देखो</Link>
            </div>
            {topUdhaarCusts.length > 0 && (
              <div className="divide-y divide-slate-100">
                {topUdhaarCusts.map((c, i) => {
                  const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
                  const msg   = buildUdhaarReminder(c, shopName);
                  const waUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  return (
                    <div key={c._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-black text-[13px] flex-shrink-0">
                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                        {c.phone && <p className="text-[11px] text-slate-500">{c.phone}</p>}
                      </div>
                      <p className="text-[14px] font-black text-red-600 flex-shrink-0 mr-1">₹{fmtD(c.due)}</p>
                      <a href={waUrl} target="_blank" rel="noreferrer"
                        className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors"
                        title={`WhatsApp reminder to ${c.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
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
  );
}

function NotificationsPanel({ notifications, taskCount }) {
  const urgentAlerts = notifications.filter(n => !n.isRead && ['critical','high'].includes(n.priority)).slice(0, 3);
  const hasOps = urgentAlerts.length > 0 || taskCount > 0;
  if (!hasOps) return null;
  const PRIORITY_DOT = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
  const TYPE_ICON    = { low_stock: '📦', out_of_stock: '🚫', expiry_warning: '⏰', expired: '☠️', workflow_delay: '⚠️' };
  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🚨</span>
          <p className="text-[13px] font-black text-red-900">Needs Attention</p>
        </div>
        <div className="flex items-center gap-2">
          {taskCount > 0 && (
            <Link href="/tasks" className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition-colors">
              {taskCount} task{taskCount !== 1 ? 's' : ''} →
            </Link>
          )}
          <Link href="/notifications" className="text-[11px] font-black text-red-700 hover:underline">See all →</Link>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {urgentAlerts.map(alert => (
          <Link key={alert._id} href="/notifications" className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
            <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICON[alert.type] || '🔔'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-slate-900 leading-snug">{alert.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{alert.message}</p>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[alert.priority] || '#d97706', flexShrink: 0, marginTop: 5 }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
        <div className="skeleton-card border border-slate-200/60" style={{ height: 96 }} />
        <div className="space-y-2">
          <div className="skeleton-text w-1/4" />
          <div className="skeleton-card border border-slate-200/60" style={{ height: 130 }} />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton-card border border-slate-200/60" style={{ height: 72 }} />
            <div className="skeleton-card border border-slate-200/60" style={{ height: 72 }} />
          </div>
        </div>
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

function DashboardError({ error, onRetry }) {
  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5">
          <p className="text-[16px] font-black text-red-900">Data load नहीं हो पाया</p>
          <p className="mt-2 text-[13px] text-red-700">{error}</p>
          <button type="button" onClick={onRetry}
            className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-red-700 transition-colors"
          >
            Dobara load karo
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════
//  SHARED DATA HOOK
// ═══════════════════════════════════════════════════

function useDashboardData() {
  const router = useRouter();
  const { term, config, businessType } = useIndustry();
  const { notifications, taskCount }   = useNotifications();

  const bizConfig  = config?.terminology || {};
  const wfc        = getWorkflowConfig(bizConfig);
  const wfWidgets  = getDashboardWidgets(wfc);
  const wfActions  = getQuickActions(wfc);
  const dashCfg    = bizConfig.dashboardConfig || null;

  const hasBootstrappedRef = useRef(false);

  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState('');
  const [shopName,       setShopName]       = useState('');
  const [hasGstin,       setHasGstin]       = useState(false);
  const [userName,       setUserName]       = useState('');
  const [userRole,       setUserRole]       = useState(null);
  const [isStaffUser,    setIsStaffUser]    = useState(false);
  const [greeting]                          = useState(getGreeting);
  const [today]                             = useState(getTodayLabel);
  const [workflowCounts, setWorkflowCounts] = useState({});
  const [agingData,      setAgingData]      = useState(null);
  const [agingLoading,   setAgingLoading]   = useState(false);
  const [tableStatusData, setTableStatusData] = useState(null);
  const [appointmentData, setAppointmentData] = useState(null);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      if (!silent) setError('');
      const [dashRes, shopRes] = await Promise.all([
        fetch(apiUrl('/api/dashboard/summary'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'),          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401 || shopRes.status === 401) { router.push('/login'); return; }
      if (!dashRes.ok || !shopRes.ok) throw new Error('Failed to load dashboard');
      const dashData = await dashRes.json();
      const shopData = await shopRes.json();
      const nextShopName  = shopData.name || 'मेरी दुकान';
      const nextHasGstin  = !!(shopData.gstin && shopData.gstin.length === 15 && shopData.gst_type !== 'unregistered');
      setData(dashData);
      setShopName(nextShopName);
      setHasGstin(nextHasGstin);
      writePageCache(DASHBOARD_CACHE_KEY, { data: dashData, shopName: nextShopName, hasGstin: nextHasGstin });
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
      const res = await fetch(apiUrl('/api/dashboard/workflow-counts'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setWorkflowCounts(d.counts || {}); }
    } catch {}
  }, []);

  const fetchCreditAging = useCallback(async () => {
    setAgingLoading(true);
    try {
      const res = await fetch(apiUrl('/api/dashboard/credit-aging'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const cdata = await res.json(); setAgingData(cdata); }
    } catch (e) { console.error('credit aging fetch failed', e); }
    finally { setAgingLoading(false); }
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    let user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
    setUserName(user.name || '');
    if (user.isSubUser) { setIsStaffUser(true); setUserRole(user.role || null); }

    const cached = readPageCache(DASHBOARD_CACHE_KEY);
    if (cached?.data) {
      setData(cached.data);
      setShopName(cached.shopName || 'मेरी दुकान');
      setHasGstin(cached.hasGstin || false);
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.data));
      const bt = user.businessType || '';
      const extraFetches = [];
      if (bt === 'restaurant') {
        extraFetches.push(
          fetch(apiUrl('/api/dashboard/table-status'), { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null).then(d => d && setTableStatusData(d)).catch(() => {})
        );
      }
      if (bt === 'salon') {
        const todayDate = new Date().toISOString().split('T')[0];
        extraFetches.push(
          fetch(apiUrl(`/api/sales/appointments?date=${todayDate}`), { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null).then(d => d && setAppointmentData(d)).catch(() => {})
        );
      }
      await Promise.all([
        fetchDashboard({ silent: Boolean(cached?.data) }),
        fetchWorkflowCounts(),
        ...extraFetches,
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

  return {
    data, loading, refreshing, error, shopName, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, workflowCounts, agingData, agingLoading,
    fetchCreditAging, tableStatusData, appointmentData,
    notifications, taskCount, term, config, businessType,
    bizConfig, wfc, wfWidgets, wfActions, dashCfg,
  };
}

// ═══════════════════════════════════════════════════
//  AGING PANEL (reused in B2B expanded + Hybrid)
// ═══════════════════════════════════════════════════

function AgingBuckets({ agingData, agingLoading }) {
  if (agingLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
      </div>
    );
  }
  if (!agingData) return null;

  if (agingData.customers.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-[15px] font-black text-green-700">✅ कोई outstanding नहीं — सब हिसाब बराबर है!</p>
      </div>
    );
  }

  const BUCKETS = [
    { key: '0-30 days',  label: '0-30 दिन',  border: 'border-green-200',  bg: 'bg-green-50',  text: 'text-green-800'  },
    { key: '31-60 days', label: '31-60 दिन', border: 'border-amber-200',  bg: 'bg-amber-50',  text: 'text-amber-800'  },
    { key: '61-90 days', label: '61-90 दिन', border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-800' },
    { key: '90+ days',   label: '90+ दिन',   border: 'border-red-200',    bg: 'bg-red-50',    text: 'text-red-800'    },
  ];
  const AGE_DOT = { '0-30 days': 'bg-green-500', '31-60 days': 'bg-amber-500', '61-90 days': 'bg-orange-500', '90+ days': 'bg-red-500' };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2">
        {BUCKETS.map(b => {
          const bkt = agingData.summary[b.key] || { count: 0, total: 0 };
          return (
            <div key={b.key} className={`border rounded-xl p-3 text-center ${b.border} ${b.bg}`}>
              <p className={`text-[15px] font-black ${b.text}`}>₹{fmt(bkt.total)}</p>
              <p className={`text-[10px] font-bold ${b.text} mt-0.5`}>{b.label}</p>
              <p className="text-[10px] text-slate-500">{bkt.count} parties</p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-50 border border-red-200">
        <span className="text-[13px] font-bold text-red-900">कुल Outstanding</span>
        <span className="text-[16px] font-black text-red-700">₹{fmt(agingData.grandTotal)}</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {agingData.customers.map((c, i) => {
          const cName  = c._id?.buyerName  || 'Unknown';
          const cPhone = (c._id?.buyerPhone || '').replace(/\D/g, '');
          const waMsg  = `Namaste ${cName} ji 🙏\n\nHamari dukaan se aapka ₹${fmt(c.totalDue)} udhaar baaki hai.\n\nKripya jald se jald payment karein.\n\nDhanyawad 🙏`;
          const dotCls = AGE_DOT[c.agingBucket] || 'bg-slate-400';
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotCls}`} />
                  <p className="text-[13px] font-black text-slate-900">{cName}</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ₹{fmt(c.totalDue)} due • {c.billCount} bill{c.billCount !== 1 ? 's' : ''} • {c.oldestBillAge} days old
                  {c._id?.buyerPhone ? ` • 📞 ${c._id.buyerPhone}` : ''}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {cPhone && (
                  <a href={`https://wa.me/91${cPhone}?text=${encodeURIComponent(waMsg)}`}
                    target="_blank" rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-green-500 text-white text-[11px] font-bold hover:bg-green-600 transition-colors"
                  >WhatsApp</a>
                )}
                <Link href="/udhaar" className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-colors">View</Link>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-right">As of {new Date(agingData.asOf).toLocaleString('en-IN')}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  INDUSTRY-SPECIFIC PANELS (B2C + Hybrid)
// ═══════════════════════════════════════════════════

function IndustryPanels({ data, businessType, tableStatusData, appointmentData }) {
  const expiryStats      = data?.expiryStats     || { expiredCount: 0, expiring7Days: 0, expiring30Days: 0 };
  const insurancePending = data?.insurancePending || 0;
  const variantLowStock  = data?.variantLowStock  || [];

  return (
    <>
      {/* Pharmacy: expiry alerts */}
      {businessType === 'pharmacy' && (expiryStats.expiredCount > 0 || expiryStats.expiring7Days > 0 || expiryStats.expiring30Days > 0) && (
        <Link href="/product?filter=expiring"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
        >
          <span className="text-xl flex-shrink-0">⏰</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-amber-900">
              {expiryStats.expiredCount > 0 ? `${expiryStats.expiredCount} items expired` :
               expiryStats.expiring7Days > 0 ? `${expiryStats.expiring7Days} items expiring this week` :
               `${expiryStats.expiring30Days} items expiring in 30 days`}
            </p>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Expiry alerts →</p>
          </div>
        </Link>
      )}

      {/* Pharmacy: insurance claims */}
      {businessType === 'pharmacy' && insurancePending > 0 && (
        <Link href="/sales?filter=insurance_pending"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <span className="text-xl flex-shrink-0">🏥</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-blue-900">{insurancePending} Insurance Claims Pending</p>
            <p className="text-[11px] text-blue-600 font-medium">Awaiting reimbursement →</p>
          </div>
        </Link>
      )}

      {/* Restaurant: table status */}
      {businessType === 'restaurant' && tableStatusData && (
        <div className="space-y-3">
          <Link href="/tables"
            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🪑</span>
              <span className="text-[13px] font-black text-orange-900">{tableStatusData.occupiedCount} tables occupied</span>
            </div>
            <span className="text-[11px] font-bold text-orange-700">View Floor →</span>
          </Link>
          {data?.todayOrders && (() => {
            const channels = {};
            (data.todayOrders || []).forEach(s => {
              const ef = s.extra_fields instanceof Map ? Object.fromEntries(s.extra_fields) : (s.extra_fields || {});
              const ch = ef.order_type || 'Dine-In';
              if (!channels[ch]) channels[ch] = { count: 0, revenue: 0 };
              channels[ch].count++;
              channels[ch].revenue += s.total_amount || 0;
            });
            const channelIcons = { 'Dine-In': '🍽️', Takeaway: '📦', Delivery: '🛵', Swiggy: '🟠', Zomato: '🔴' };
            const entries = Object.entries(channels).filter(([, v]) => v.count > 0);
            if (!entries.length) return null;
            return (
              <div className="flex flex-wrap gap-2">
                {entries.map(([ch, v]) => (
                  <div key={ch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-sm">{channelIcons[ch] || '🍽️'}</span>
                    <span className="text-[11px] font-black text-slate-800">{ch}</span>
                    <span className="text-[10px] text-slate-500">₹{fmt(v.revenue)} ({v.count})</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Salon: appointments */}
      {businessType === 'salon' && appointmentData && (() => {
        const appts = appointmentData.appointments || [];
        const doneCount = appts.filter(a => {
          const ef = a.extra_fields instanceof Map ? Object.fromEntries(a.extra_fields) : (a.extra_fields || {});
          return ef.workflow_status === 'paid' || ef.workflow_status === 'completed';
        }).length;
        const remaining = appts.length - doneCount;
        return (
          <Link href="/appointments"
            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📅</span>
              <span className="text-[13px] font-black text-purple-900">
                {appts.length} appointments today — {doneCount} done, {remaining} remaining
              </span>
            </div>
            <span className="text-[11px] font-bold text-purple-700">View Calendar →</span>
          </Link>
        );
      })()}

      {/* Clothing: size-wise low stock */}
      {businessType === 'clothing' && variantLowStock.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="page-section-label">📏 Size Stock Alerts</span>
            <Link href="/product?filter=low_stock" className="page-section-link">View all →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {variantLowStock.map(v => (
              <Link key={v._id || 'unknown'}
                href={`/product?size=${encodeURIComponent(v._id || '')}&filter=low_stock`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 text-[12px] font-bold hover:bg-amber-200 transition-colors"
              >
                <span>Size {v._id || '?'}</span>
                <span className="opacity-70">—</span>
                <span>{v.productCount} item{v.productCount !== 1 ? 's' : ''}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Electronics / mobile: warranty claims */}
      {(businessType === 'electronics' || businessType === 'mobile_shop') && (() => {
        const wData = data?.warrantySummary;
        if (!wData) return null;
        const pendingCount = wData.pendingCount || 0;
        const readyCount   = wData.readyCount   || 0;
        if (pendingCount === 0 && readyCount === 0) return null;
        return (
          <Link href="/warranty"
            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🛡️</span>
              <span className="text-[13px] font-black text-teal-900">
                {pendingCount > 0 && `${pendingCount} warranty claim${pendingCount !== 1 ? 's' : ''} open`}
                {pendingCount > 0 && readyCount > 0 && '  •  '}
                {readyCount > 0 && `${readyCount} ready for pickup`}
              </span>
            </div>
            <span className="text-[11px] font-bold text-teal-700">View Claims →</span>
          </Link>
        );
      })()}

      {/* Repair shop: pending pickup */}
      {businessType === 'repair_shop' && (() => {
        const pickup = data?.pendingPickup || 0;
        if (pickup === 0) return null;
        return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-300 bg-amber-50">
            <span className="text-3xl flex-shrink-0">📱</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-amber-900">{pickup} device{pickup !== 1 ? 's' : ''} ready for pickup</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Customer hasn&apos;t collected yet — send a reminder</p>
            </div>
            <Link href="/sales?filter=ready" className="flex-shrink-0 text-[11px] font-black text-amber-700 border border-amber-400 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors">
              View All →
            </Link>
          </div>
        );
      })()}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  B2C DASHBOARD
// ═══════════════════════════════════════════════════

function B2CDashboard() {
  const {
    data, loading, refreshing, error, shopName, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, workflowCounts, tableStatusData, appointmentData,
    notifications, taskCount, term, config, businessType,
    wfc, wfWidgets, wfActions, dashCfg,
  } = useDashboardData();

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const today_profit = data?.today?.profit  || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable || 0;
  const low_stock    = data?.stock?.lowStockCount || 0;
  const out_of_stock = data?.stock?.outOfStockCount || 0;

  const b2cActions = [
    { href: '/sales?open=1&payment=cash',   emoji: config?.icon || '🧾', label: term('quickNewSaleHindi', 'Bill बनाओ'),        sublabel: 'New Invoice',   permission: 'CREATE_INVOICE'  },
    { href: '/sales?open=1&payment=credit', emoji: '📒',                  label: 'उधार दो',                                    sublabel: 'Credit Sale',   permission: 'CREATE_INVOICE'  },
    { href: '/product',                     emoji: '📦',                  label: term('quickAddStockHindi', 'Product जोड़ो'), sublabel: 'Add Stock',     permission: 'MANAGE_INVENTORY'},
    { href: '/purchases',                   emoji: '🛒',                  label: term('quickPurchaseHindi', 'माल खरीदो'),    sublabel: 'Purchase',      permission: 'CREATE_PURCHASE' },
    { href: '/expenses',                    emoji: '💳',                  label: 'खर्च लिखो',                                  sublabel: 'Expenses',      permission: 'VIEW_EXPENSES'   },
    { href: '/udhaar',                      emoji: '💸',                  label: 'उधार लो',                                   sublabel: 'Collect',       permission: 'VIEW_UDHAAR'     },
  ].filter(a => hasPermission(a.permission));

  const kpiTiles = [
    hasPermission('VIEW_UDHAAR')  && { label: 'उधार बाकी', value: `₹${fmt(total_udhaar)}`, sublabel: `${udhaar_count} ग्राहक`, href: '/udhaar', alert: udhaar_count > 5 ? 'red' : udhaar_count > 0 ? 'amber' : null },
    hasGstin && hasPermission('VIEW_GST') && { label: 'GST Payable', value: `₹${fmt(gst_payable)}`, sublabel: 'This month', href: '/gst' },
    hasPermission('VIEW_REPORTS') && { label: 'इस महीने', value: `₹${fmt(month_sales)}`, sublabel: 'Monthly revenue', href: '/reports' },
    (low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && { label: 'Stock Alerts', value: `${out_of_stock + low_stock}`, sublabel: `${out_of_stock} खत्म, ${low_stock} कम`, href: '/product', alert: out_of_stock > 0 ? 'red' : 'amber' },
  ].filter(Boolean);

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">
        {refreshing && (
          <div className="flex items-center justify-end gap-1.5 px-1 -mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Updating…</span>
          </div>
        )}

        <DashboardHeader shopName={shopName} userName={userName} greeting={greeting} today={today} dashboardMode="b2c" />
        {isStaffUser && userRole && <StaffBanner userRole={userRole} config={config} />}

        {/* 2. Today's snapshot */}
        {hasPermission('VIEW_SALES') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">आज का हाल</span>
              <Link href="/sales" className="page-section-link">सभी bills →</Link>
            </div>
            <Link href="/sales" className="metric-card accent-money block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">आज की कमाई</p>
              <p className="text-[36px] font-black text-slate-900 leading-none mt-1">₹{fmt(today_sales)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Today&apos;s Revenue</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Bills</p>
                  <p className="text-[18px] font-black text-slate-700">{today_bills}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">मुनाफा</p>
                  <p className="text-[18px] font-black text-green-700">₹{fmt(today_profit)}</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* 3. KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* 4. Quick actions */}
        {b2cActions.length > 0 && (
          <div>
            <div className="page-section-row px-0.5 mb-3">
              <span className="page-section-label">जल्दी काम</span>
            </div>
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
              {b2cActions.map(a => <QuickActionCard key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} />)}
            </div>
          </div>
        )}

        {/* Workflow widgets */}
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
                  <Link key={widget.id} href={`/sales?wf=${widget.stages[0]}`}
                    className="group flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-green-300 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{widget.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-800 leading-tight">{widget.label}</p>
                      <p className="text-[10px] font-bold text-green-600 mt-0.5">View →</p>
                    </div>
                    {count > 0
                      ? <span className="flex-shrink-0 bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">{count}</span>
                      : <span className="flex-shrink-0 text-slate-400 text-[11px]">0</span>
                    }
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Urgent tasks */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* 6. Industry-specific panels */}
        <IndustryPanels
          data={data}
          businessType={businessType}
          tableStatusData={tableStatusData}
          appointmentData={appointmentData}
        />

        {dashCfg?.tip && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{dashCfg.tip}</p>
          </div>
        )}

        {/* 7. Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* 8. Footer */}
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[13px] font-black text-slate-800">
              {today_bills === 0 ? `आज का पहला ${term('invoice','bill')} बनाओ ` :
               today_bills === 1 ? `एक ${term('invoice','bill')} हो गया, और करो! ` :
               `आज ${today_bills} ${term('invoice','bill')} बन गए — बढ़िया! `}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{shopName} — रखरखाव के साथ</p>
          </div>
          {hasPermission('CREATE_INVOICE') && (
            <Link href="/sales" className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-[13px] font-black text-white transition-colors">
              बिल बनाओ →
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════
//  B2B DASHBOARD
// ═══════════════════════════════════════════════════

function B2BDashboard() {
  const {
    data, loading, refreshing, error, shopName, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, agingData, agingLoading,
    fetchCreditAging, notifications, taskCount, term, config,
  } = useDashboardData();

  useEffect(() => {
    fetchCreditAging();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable || 0;
  const itc_avail    = data?.gst?.itcAvailable || 0;

  const b2bActions = [
    { href: '/sales?open=1&doc=invoice',  emoji: '🧾', label: 'Tax Invoice',      sublabel: 'GST Invoice',     permission: 'CREATE_INVOICE'   },
    { href: '/sales?open=1&doc=challan',  emoji: '📋', label: 'Delivery Challan', sublabel: 'Without GST',     permission: 'CREATE_INVOICE'   },
    { href: '/purchases',                 emoji: '🛒', label: 'Purchase Order',   sublabel: 'Procurement',     permission: 'CREATE_PURCHASE'  },
    { href: '/sales/customers',           emoji: '👥', label: 'Parties',          sublabel: 'Customers/Dealers', permission: 'VIEW_SALES'     },
    { href: '/product',                   emoji: '📦', label: 'Stock Check',      sublabel: 'Inventory',       permission: 'MANAGE_INVENTORY' },
    { href: '/reports',                   emoji: '📊', label: 'Reports',          sublabel: 'Analytics',       permission: 'VIEW_REPORTS'     },
    { href: '/udhaar',                    emoji: '💰', label: 'Collect Payment',  sublabel: 'Receivables',     permission: 'VIEW_UDHAAR'      },
    { href: '/bank-entries',              emoji: '🏦', label: 'Bank Entry',       sublabel: 'Ledger',          permission: 'VIEW_BANK'        },
  ].filter(a => hasPermission(a.permission));

  const kpiTiles = [
    hasPermission('VIEW_SALES')   && { label: 'आज की बिक्री', value: `₹${fmt(today_sales)}`, sublabel: `${today_bills} bills`, href: '/sales' },
    hasGstin && hasPermission('VIEW_GST') && { label: 'GST Payable', value: `₹${fmt(gst_payable)}`, sublabel: 'This month', href: '/gst' },
    hasGstin && hasPermission('VIEW_GST') && itc_avail > 0 && { label: 'ITC Available', value: `₹${fmt(itc_avail)}`, sublabel: 'Input credit', href: '/gst' },
    hasPermission('VIEW_REPORTS') && { label: 'इस महीने', value: `₹${fmt(month_sales)}`, sublabel: 'Monthly revenue', href: '/reports' },
  ].filter(Boolean);

  const recentSales = data?.recentSales || [];

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">
        {refreshing && (
          <div className="flex items-center justify-end gap-1.5 px-1 -mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Updating…</span>
          </div>
        )}

        <DashboardHeader shopName={shopName} userName={userName} greeting={greeting} today={today} dashboardMode="b2b" />
        {isStaffUser && userRole && <StaffBanner userRole={userRole} config={config} />}

        {/* 2. Business snapshot — 2-col metric grid */}
        <div>
          <div className="page-section-row px-0.5">
            <span className="page-section-label">Business Snapshot</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hasPermission('VIEW_SALES') && (
              <Link href="/sales" className="metric-card accent-money block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">आज की बिक्री</p>
                <p className="text-[22px] font-black text-slate-900 leading-none mt-1">₹{fmt(today_sales)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Today&apos;s Sales</p>
              </Link>
            )}
            {hasPermission('VIEW_REPORTS') && (
              <Link href="/reports" className="metric-card accent-blue block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">इस महीने</p>
                <p className="text-[22px] font-black text-slate-900 leading-none mt-1">₹{fmt(month_sales)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Monthly Revenue</p>
              </Link>
            )}
            {hasPermission('VIEW_UDHAAR') && (
              <Link href="/udhaar" className="metric-card accent-danger block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Outstanding</p>
                <p className="text-[22px] font-black text-slate-900 leading-none mt-1">₹{fmt(total_udhaar)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Receivables · {udhaar_count} parties</p>
              </Link>
            )}
            {hasGstin && hasPermission('VIEW_GST') && (
              <Link href="/gst" className="metric-card accent-warning block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">GST Liability</p>
                <p className="text-[22px] font-black text-slate-900 leading-none mt-1">₹{fmt(gst_payable)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">This Month</p>
              </Link>
            )}
          </div>
        </div>

        {/* 3. Quick actions */}
        {b2bActions.length > 0 && (
          <div>
            <div className="page-section-row px-0.5 mb-3">
              <span className="page-section-label">जल्दी काम</span>
            </div>
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
              {b2bActions.map(a => <QuickActionCard key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} />)}
            </div>
          </div>
        )}

        {/* 4. Outstanding Receivables — always expanded */}
        {hasPermission('VIEW_UDHAAR') && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
              <div>
                <p className="text-[14px] font-black text-slate-900">💰 Outstanding Receivables</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Party-wise बकाया</p>
              </div>
              <Link href="/udhaar" className="text-[11px] font-black text-green-700 hover:underline">सभी देखें →</Link>
            </div>
            <div className="px-4 py-4">
              <AgingBuckets agingData={agingData} agingLoading={agingLoading} />
            </div>
          </div>
        )}

        {/* 5. Recent transactions */}
        {recentSales.length > 0 && hasPermission('VIEW_SALES') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">Recent Transactions</span>
              <Link href="/sales" className="page-section-link">सभी देखें →</Link>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {recentSales.slice(0, 5).map((s, i) => {
                const statusMap = { paid: { cls: 'bg-green-100 text-green-700', label: 'Paid' }, partial: { cls: 'bg-amber-100 text-amber-700', label: 'Partial' }, unpaid: { cls: 'bg-red-100 text-red-700', label: 'Unpaid' } };
                const statusKey = s.payment_status || (s.total_amount === s.paid_amount ? 'paid' : s.paid_amount > 0 ? 'partial' : 'unpaid');
                const badge = statusMap[statusKey] || statusMap.unpaid;
                return (
                  <Link key={s._id || i} href="/sales" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-slate-900 truncate">{s.buyer_name || s.buyer?.name || 'Party'}</p>
                      <p className="text-[11px] text-slate-500">#{s.invoice_number || s._id?.slice(-6)}</p>
                    </div>
                    <p className="text-[14px] font-black text-slate-800 flex-shrink-0">₹{fmt(s.total_amount)}</p>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {recentSales.length === 0 && hasPermission('VIEW_SALES') && (
          <Link href="/sales" className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
            <span className="text-[13px] font-bold text-slate-600">Sales देखने के लिए यहाँ जाएं</span>
            <span className="text-[12px] font-black text-green-700">→</span>
          </Link>
        )}

        {/* 6. KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* 7. Urgent tasks (stock) */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* 8. GST compliance reminder */}
        {hasGstin && hasPermission('VIEW_GST') && (
          <Link href="/gst" className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <div>
                <p className="text-[13px] font-black text-blue-900">GST Filing</p>
                <p className="text-[11px] text-blue-600 font-medium mt-0.5">अगली filing याद रखें</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-700">देखें →</span>
          </Link>
        )}

        {/* 9. Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* 10. Footer */}
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[13px] font-black text-slate-800">
              {today_bills === 0 ? 'आज की पहली invoice बनाओ ' : `आज ${today_bills} invoice${today_bills !== 1 ? 's' : ''} बन गए — बढ़िया! `}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{shopName} — रखरखाव के साथ</p>
          </div>
          {hasPermission('CREATE_INVOICE') && (
            <Link href="/sales" className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-[13px] font-black text-white transition-colors">
              Invoice बनाओ →
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════
//  HYBRID DASHBOARD
// ═══════════════════════════════════════════════════

function HybridDashboard() {
  const {
    data, loading, refreshing, error, shopName, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, agingData, agingLoading,
    fetchCreditAging, tableStatusData, appointmentData,
    notifications, taskCount, term, config, businessType, dashCfg,
  } = useDashboardData();

  const [showAging, setShowAging] = useState(false);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const today_profit = data?.today?.profit  || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable || 0;
  const paymentSplit = data?.paymentSplit || {};

  const retailActions = [
    { href: '/sales?open=1&payment=cash',   emoji: config?.icon || '🧾', label: 'Bill बनाओ',    sublabel: 'Cash Invoice',   permission: 'CREATE_INVOICE'  },
    { href: '/sales?open=1&payment=credit', emoji: '📒',                  label: 'उधार दो',      sublabel: 'Credit Sale',    permission: 'CREATE_INVOICE'  },
    { href: '/product',                     emoji: '📦',                  label: 'Stock',        sublabel: 'Inventory',      permission: 'MANAGE_INVENTORY'},
    { href: '/expenses',                    emoji: '💳',                  label: 'खर्च लिखो',    sublabel: 'Expenses',       permission: 'VIEW_EXPENSES'   },
  ].filter(a => hasPermission(a.permission));

  const b2bActions = [
    { href: '/sales?open=1&doc=challan',  emoji: '📋', label: 'Challan बनाओ', sublabel: 'Delivery Challan', permission: 'CREATE_INVOICE'   },
    { href: '/sales/customers',           emoji: '👥', label: 'Parties',      sublabel: 'Dealers/Customers', permission: 'VIEW_SALES'      },
    { href: '/udhaar',                    emoji: '💰', label: 'Collect',      sublabel: 'Receivables',      permission: 'VIEW_UDHAAR'      },
    { href: '/reports',                   emoji: '📊', label: 'Reports',      sublabel: 'Analytics',        permission: 'VIEW_REPORTS'     },
  ].filter(a => hasPermission(a.permission));

  const kpiTiles = [
    hasPermission('VIEW_SALES')   && { label: 'आज', value: `₹${fmt(today_sales)}`, sublabel: `${today_bills} bills`, href: '/sales' },
    hasPermission('VIEW_UDHAAR')  && { label: 'उधार', value: `₹${fmt(total_udhaar)}`, sublabel: `${udhaar_count} ग्राहक`, href: '/udhaar', alert: udhaar_count > 0 ? 'amber' : null },
    hasPermission('VIEW_UDHAAR')  && total_udhaar > 0 && { label: 'Outstanding', value: `₹${fmt(total_udhaar)}`, sublabel: 'Receivables', href: '/udhaar', alert: 'amber' },
    hasGstin && hasPermission('VIEW_GST')    && { label: 'GST Payable', value: `₹${fmt(gst_payable)}`, sublabel: 'This month', href: '/gst' },
    hasPermission('VIEW_REPORTS') && { label: 'इस महीने', value: `₹${fmt(month_sales)}`, sublabel: 'Monthly', href: '/reports' },
  ].filter(Boolean);

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">
        {refreshing && (
          <div className="flex items-center justify-end gap-1.5 px-1 -mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Updating…</span>
          </div>
        )}

        <DashboardHeader shopName={shopName} userName={userName} greeting={greeting} today={today} dashboardMode="hybrid" />
        {isStaffUser && userRole && <StaffBanner userRole={userRole} config={config} />}

        {/* 2. Today's snapshot */}
        {hasPermission('VIEW_SALES') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">आज का हाल</span>
              <Link href="/sales" className="page-section-link">सभी bills →</Link>
            </div>
            <Link href="/sales" className="metric-card accent-money block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">आज की कमाई</p>
              <p className="text-[36px] font-black text-slate-900 leading-none mt-1">₹{fmt(today_sales)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Today&apos;s Revenue</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Bills</p>
                  <p className="text-[16px] font-black text-slate-700">{today_bills}</p>
                </div>
                <div className="w-px h-7 bg-slate-200" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">मुनाफा</p>
                  <p className="text-[16px] font-black text-green-700">₹{fmt(today_profit)}</p>
                </div>
                {paymentSplit.cashInHand > 0 && (
                  <>
                    <div className="w-px h-7 bg-slate-200" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Cash</p>
                      <p className="text-[16px] font-black text-slate-700">₹{fmt(paymentSplit.cashInHand)}</p>
                    </div>
                  </>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* 3. KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* 4. Quick actions — two sections */}
        {(retailActions.length > 0 || b2bActions.length > 0) && (
          <div className="space-y-4">
            <div className="page-section-row px-0.5 mb-0">
              <span className="page-section-label">जल्दी काम</span>
            </div>
            {retailActions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-0.5">Retail काम</p>
                <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-3">
                  {retailActions.map(a => <QuickActionCard key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} />)}
                </div>
              </div>
            )}
            {b2bActions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-0.5">Wholesale / B2B</p>
                <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-3">
                  {b2bActions.map(a => <QuickActionCard key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Outstanding receivables — collapsible */}
        {hasPermission('VIEW_UDHAAR') && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50 transition-colors"
              onClick={() => {
                const next = !showAging;
                setShowAging(next);
                if (next && agingData === null) fetchCreditAging();
              }}
            >
              <div>
                <p className="text-[14px] font-black text-slate-900">💰 Outstanding: ₹{fmt(total_udhaar)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Receivables aging • {udhaar_count} parties</p>
              </div>
              <span className="flex-shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                {showAging ? 'Collapse ▲' : 'Expand ▼'}
              </span>
            </button>
            {showAging && (
              <div className="border-t border-slate-100 px-4 py-4">
                <AgingBuckets agingData={agingData} agingLoading={agingLoading} />
              </div>
            )}
          </div>
        )}

        {/* 6. Urgent tasks */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* 7. Industry-specific panels */}
        <IndustryPanels
          data={data}
          businessType={businessType}
          tableStatusData={tableStatusData}
          appointmentData={appointmentData}
        />

        {dashCfg?.tip && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{dashCfg.tip}</p>
          </div>
        )}

        {/* 8. Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* 9. Footer */}
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[13px] font-black text-slate-800">
              {today_bills === 0 ? `आज का पहला ${term('invoice','bill')} बनाओ ` :
               today_bills === 1 ? `एक ${term('invoice','bill')} हो गया, और करो! ` :
               `आज ${today_bills} ${term('invoice','bill')} बन गए — बढ़िया! `}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{shopName} — रखरखाव के साथ</p>
          </div>
          {hasPermission('CREATE_INVOICE') && (
            <Link href="/sales" className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-[13px] font-black text-white transition-colors">
              बिल बनाओ →
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════

export default function DashboardPage() {
  const { dashboardMode } = useIndustry();
  const mode = dashboardMode || 'b2c';
  if (mode === 'b2b')    return <B2BDashboard />;
  if (mode === 'hybrid') return <HybridDashboard />;
  return <B2CDashboard />;
}
