'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import GstDeadlineBanner from '../../components/GstDeadlineBanner';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { hasPermission, getRoleLabel, getRoleColor } from '../../lib/permissions';
import { getSuggestedRoles } from '../../lib/roleConfig';
import { useIndustry } from '../../contexts/IndustryContext';
import { getWorkflowConfig, getDashboardWidgets, getQuickActions } from '../../lib/workflowEngine';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTier } from '../../contexts/TierContext';
import DashboardNano from './DashboardNano';

const DASHBOARD_CACHE_KEY = 'dashboard-page';

const getToken = () => localStorage.getItem('token');
const fmt  = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
  return (
    <div className="rr-page-hero rr-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="rr-section-label mb-1">🔧 Hardware & Electronics · दुकान हिसाब</p>
          <h1 className="text-[24px] font-black text-slate-900 leading-tight tracking-[-0.03em]">{greeting}</h1>
          {(userName || shopName) && (
            <p className="text-[13px] font-bold text-green-700 mt-1 truncate flex items-center gap-1.5">
              {userName && <span>{userName}</span>}
              {userName && shopName && <span className="text-slate-300">·</span>}
              {shopName && <span>{shopName}</span>}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">{today}</p>
        </div>
        <Link href="/profile" className={`flex-shrink-0 rr-pill ${
          dashboardMode === 'b2b' ? 'rr-pill-amber' : dashboardMode === 'hybrid' ? 'rr-pill-violet' : 'rr-pill-green'
        } text-[11px]`}>
          {dashboardMode === 'b2b' ? '🏭 Wholesale' : dashboardMode === 'hybrid' ? '🔄 Hybrid' : '🛍️ Retail'}
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

// Date range selector pill group
const RANGE_OPTIONS = [
  { id: 'today',      label: 'आज'     },
  { id: 'week',       label: 'सप्ताह' },
  { id: 'month',      label: 'महीना'  },
  { id: 'last_month', label: 'पिछला'  },
];
const RANGE_LABELS = { today: 'आज', week: 'इस सप्ताह', month: 'इस महीने', last_month: 'पिछले महीने' };

function DateRangePicker({ selected, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {RANGE_OPTIONS.map((r) => (
        <button key={r.id} type="button" onClick={() => onChange(r.id)}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
            selected === r.id
              ? 'bg-green-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >{r.label}</button>
      ))}
    </div>
  );
}

// Delta indicator for yesterday P&L comparison
function DeltaBadge({ current, yesterday }) {
  if (!yesterday || yesterday === 0) return null;
  const pct = Math.round(((current - yesterday) / yesterday) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-lg ${
      up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs कल
    </span>
  );
}

function KPIStrip({ tiles }) {
  return (
    <div className="rr-stat-strip">
      {tiles.filter(Boolean).map((tile, i) => (
        <Link key={i} href={tile.href} className={`rr-stat-tile ${
          tile.alert === 'red' ? 'tone-rose' : tile.alert === 'amber' ? 'tone-amber' : ''
        }`}>
          <p className="rr-stat-tile-label">{tile.label}</p>
          <p className={`rr-stat-tile-value ${tile.alert === 'red' ? 'tone-rose' : tile.alert === 'amber' ? 'tone-amber' : ''}`}>{tile.value}</p>
          <p className="rr-stat-tile-sub">{tile.sublabel}</p>
        </Link>
      ))}
    </div>
  );
}

function QuickActionCard({ href, emoji, label, sublabel }) {
  return (
    <Link href={href} className="rr-quick-tile">
      <div className="rr-quick-tile-icon bg-green-50">{emoji}</div>
      <div>
        <span className="rr-quick-tile-label">{label}</span>
        {sublabel && <span className="rr-quick-tile-sub block">{sublabel}</span>}
      </div>
    </Link>
  );
}

// ── Hero dual-metric row: Today's Revenue | Total Udhaar ──────────────
function HeroDualMetric({ revenue, udhaar, udhaarCount, delta, term }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/sales" className="rounded-2xl bg-white border border-slate-200 p-4 hover:border-green-300 transition-colors">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">आज की कमाई</p>
        <p className="text-[26px] font-black text-slate-900 leading-tight mt-1">₹{fmt(revenue)}</p>
        {delta != null && (
          <span className={`text-[11px] font-bold mt-1 inline-block ${delta >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
          </span>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5">Today&apos;s sales</p>
      </Link>
      <Link href="/udhaar" className="rounded-2xl bg-white border border-slate-200 p-4 hover:border-amber-300 transition-colors">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">कुल उधार</p>
        <p className="text-[26px] font-black text-amber-700 leading-tight mt-1">₹{fmt(udhaar)}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{udhaarCount} ग्राहक</p>
        <p className="text-[10px] text-amber-600 font-bold mt-0.5">Total udhaar</p>
      </Link>
    </div>
  );
}

// ── Collapsed alert strip ─────────────────────────────────────────────
function AlertStrip({ alertCount, items }) {
  const [open, setOpen] = useState(false);
  if (!alertCount) return null;
  return (
    <div className="rounded-2xl border overflow-hidden border-red-200 bg-red-50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
        <span className="text-[13px] font-bold text-red-800 flex-1">{alertCount} alert{alertCount > 1 ? 's' : ''} — tap to view</span>
        <span className="text-red-600 text-[12px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && items.length > 0 && (
        <div className="border-t border-red-200 divide-y divide-red-100">
          {items.map((item, i) => (
            <Link key={i} href={item.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-100 transition-colors">
              <span className="text-base">{item.emoji}</span>
              <span className="text-[12px] font-medium text-red-900">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Monthly goal progress card
function MonthlyGoalCard({ monthRevenue, monthlyTarget }) {
  const today = new Date();
  const monthKey  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dismissKey = `rr-goal-dismissed-${monthKey}`;

  const [dismissed, setDismissed] = useState(() => {
    try { return Boolean(localStorage.getItem(dismissKey)); } catch { return false; }
  });

  if (!monthlyTarget || monthlyTarget <= 0 || dismissed) return null;

  const pct       = Math.min(100, Math.round((monthRevenue / monthlyTarget) * 100));
  const remaining = Math.max(0, monthlyTarget - monthRevenue);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - today.getDate();
  const achieved    = pct >= 100;
  const isNear      = pct >= 80 && !achieved;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      achieved ? 'bg-green-50 border-green-300' :
      isNear   ? 'bg-emerald-50 border-emerald-200' :
                 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-current/10">
        <span className="text-xl flex-shrink-0">{achieved ? '🏆' : isNear ? '🔥' : '🎯'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-900">इस महीने का Target</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {achieved
              ? 'Target पूरा! 🎉'
              : isNear
              ? 'लगभग target पूरा! 🔥'
              : `${daysLeft} दिन बाकी — ₹${fmt(remaining)} और चाहिए`}
          </p>
        </div>
        <button type="button" onClick={dismiss}
          className="text-slate-400 hover:text-slate-600 text-[14px] flex-shrink-0 transition-colors"
          aria-label="Dismiss goal card">✕</button>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-black text-slate-700">₹{fmt(monthRevenue)}</span>
          <span className="text-slate-400">₹{fmt(monthlyTarget)}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              achieved ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
              isNear   ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                         'bg-gradient-to-r from-green-600 to-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[12px] font-black text-slate-700 text-right">{pct}%</p>
      </div>
    </div>
  );
}

function UrgentTasksPanel({ data, shopName, term }) {
  const low_stock      = data?.stock?.lowStockCount   || 0;
  const out_of_stock   = data?.stock?.outOfStockCount || 0;
  const udhaar_count   = data?.udhaar?.pendingCount   || 0;
  const total_udhaar   = data?.udhaar?.totalDue       || 0;
  const lowStockItems  = (data?.stock?.lowStockItems  || []).slice(0, 4);
  const topUdhaarCusts = (data?.udhaar?.topCustomers  || []).slice(0, 5);
  const hasUrgent      = udhaar_count > 0 || low_stock > 0 || out_of_stock > 0;

  if (!hasUrgent) return null;
  if (!hasPermission('MANAGE_INVENTORY') && !hasPermission('VIEW_UDHAAR')) return null;

  return (
    <div>
      <div className="rr-section-head px-0.5">
        <span className="rr-section-label">⚠️ ज़रूरी काम</span>
        {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
          <Link href="/product" className="rr-section-link">सभी देखें →</Link>
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
                    <div key={c._id || i} className="rr-list-row">
                      <div className="rr-avatar rr-avatar-sm bg-gradient-to-br from-rose-500 to-red-600">
                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                        {c.phone && <p className="text-[11px] text-slate-500">{c.phone}</p>}
                      </div>
                      <p className="text-[14px] font-black text-rose-600 flex-shrink-0 mr-1">₹{fmtD(c.due)}</p>
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

// Bug 3 fix: retry feedback + Devanagari text
function DashboardError({ error, onRetry }) {
  const [retrying, setRetrying]     = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry();
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5">
          <p className="text-[16px] font-black text-red-900">Data load नहीं हो पाया</p>
          <p className="mt-2 text-[13px] text-red-700">{error}</p>
          {retryFailed && (
            <p className="mt-2 text-[12px] font-semibold text-red-600">
              फिर से error आई — internet connection check करें।
            </p>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-4 flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {retrying && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {retrying ? 'Load हो रहा है…' : 'दोबारा Load करो'}
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════
//  INDUSTRY PANELS — config-driven (Bug 1 fix)
// ═══════════════════════════════════════════════════

const COLOR_MAP = {
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  sub: 'text-amber-700',  chip: 'bg-amber-100 border-amber-300 text-amber-800'  },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', sub: 'text-orange-700', chip: 'bg-orange-100 border-orange-200 text-orange-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', sub: 'text-purple-700', chip: 'bg-purple-100 border-purple-200 text-purple-800' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   sub: 'text-blue-600',   chip: 'bg-blue-100 border-blue-200 text-blue-800'       },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    sub: 'text-red-700',    chip: 'bg-red-100 border-red-200 text-red-800'           },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  sub: 'text-green-700',  chip: 'bg-green-100 border-green-200 text-green-800'     },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-900',   sub: 'text-teal-700',   chip: 'bg-teal-100 border-teal-200 text-teal-800'        },
};

function IndustryPanelCard({ panel, value, data }) {
  const c = COLOR_MAP[panel.color] || COLOR_MAP.amber;

  // Chips mode (size-wise stock variants)
  if (panel.renderMode === 'chips') {
    const chips = panel.getChips ? panel.getChips(value, data) : [];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="page-section-label">{panel.icon} {panel.sectionLabel || 'Stock Alerts'}</span>
          <Link href={panel.href} className="page-section-link">View all →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link key={chip.key} href={chip.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold hover:opacity-80 transition-colors ${c.chip}`}
            >{chip.label}</Link>
          ))}
        </div>
      </div>
    );
  }

  const label      = panel.renderLabel    ? panel.renderLabel(value, data)    : '';
  const sublabel   = panel.renderSublabel ? panel.renderSublabel(value, data) : null;
  const extraItems = panel.renderExtra    ? panel.renderExtra(value, data)    : null;
  const hasExtra   = Array.isArray(extraItems) && extraItems.length > 0;

  const innerContent = (
    <>
      <span className="text-xl flex-shrink-0">{panel.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-black ${c.text}`}>{label}</p>
        {sublabel && <p className={`text-[11px] font-medium mt-0.5 ${c.sub}`}>{sublabel}</p>}
      </div>
      {!hasExtra && <span className={`text-[11px] font-bold ${c.sub} flex-shrink-0`}>→</span>}
    </>
  );

  if (hasExtra) {
    return (
      <div className={`rounded-2xl border overflow-hidden ${c.bg} ${c.border}`}>
        {panel.href
          ? <Link href={panel.href} className={`flex items-center gap-3 px-4 py-3.5 border-b ${c.border} hover:opacity-90 transition-opacity`}>{innerContent}</Link>
          : <div className="flex items-center gap-3 px-4 py-3.5">{innerContent}</div>
        }
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {extraItems.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
              {item.icon && <span className="text-sm">{item.icon}</span>}
              <span className={`text-[11px] font-black ${c.text}`}>{item.label}</span>
              {item.sublabel && <span className="text-[10px] text-slate-500 ml-1">{item.sublabel}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panel.href) {
    return (
      <Link href={panel.href}
        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border hover:opacity-90 transition-colors ${c.bg} ${c.border}`}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${c.bg} ${c.border}`}>
      {innerContent}
    </div>
  );
}

function IndustryPanels({ data, bizConfig }) {
  const panels = bizConfig?.dashboardPanels || [];
  if (!panels.length) return null;

  const dataLookup = {
    ...data,
    fmt,
  };

  return (
    <>
      {panels.map((panel) => {
        const val = dataLookup[panel.dataKey];
        try {
          if (!panel.condition(val, dataLookup)) return null;
        } catch {
          return null;
        }
        return <IndustryPanelCard key={panel.id} panel={panel} value={val} data={dataLookup} />;
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  AGING PANEL (B2B + Hybrid)
// ═══════════════════════════════════════════════════

/**
 * PendingChallansWidget — shows un-delivered challans for hardware/core+ shops.
 * Lazy-loads on first mount, refreshes after a delivery is marked.
 */
function PendingChallansWidget({ businessType, tier }) {
  const isHardware = businessType === 'hardware';
  const isEligible = isHardware && (tier === 'core' || tier === 'pro');
  const [challans, setChallans]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [marking, setMarking]     = useState(null); // challanId being marked
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/api/sales?document_type=challan&challan_status=dispatched&limit=10'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setChallans(Array.isArray(data) ? data : (data.sales || []));
    } catch { setError('Challans load नहीं हुए'); setChallans([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isEligible) load();
  }, [isEligible, load]);

  const markDelivered = useCallback(async (challan) => {
    setMarking(challan._id);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl(`/api/sales/${challan._id}/mark-delivered`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ received_by: 'site', received_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Failed');
      setChallans((prev) => prev.filter((c) => c._id !== challan._id));
    } catch { /* ignore — let user retry */ }
    finally { setMarking(null); }
  }, []);

  if (!isEligible) return null;
  if (loading) return <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />;
  if (!challans || challans.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200">
        <div>
          <p className="text-[14px] font-black text-amber-900">📋 Pending Deliveries</p>
          <p className="text-[11px] text-amber-700">{challans.length} challan{challans.length > 1 ? 's' : ''} dispatched — delivery pending</p>
        </div>
        <Link href="/sales?document_type=challan" className="text-[11px] font-black text-amber-800 hover:underline">सभी →</Link>
      </div>
      {error && <p className="px-4 py-2 text-[11px] text-red-600">{error}</p>}
      <div className="divide-y divide-amber-100">
        {challans.map((c) => (
          <div key={c._id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-slate-800 truncate">{c.buyer_name || 'Walk-in'}</p>
              <p className="text-[11px] text-slate-500">
                #{c.challan_number || c.invoice_number}
                {c.deliver_to && <> · 📍 {c.deliver_to}</>}
              </p>
            </div>
            <button
              onClick={() => markDelivered(c)}
              disabled={marking === c._id}
              className="flex-shrink-0 h-8 px-3 rounded-xl bg-amber-600 text-white text-[11px] font-black disabled:opacity-50 hover:bg-amber-700 transition-colors"
            >
              {marking === c._id ? '…' : '✓ Delivered'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const isFirstRangeRender = useRef(true);

  const [data,             setData]             = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [error,            setError]            = useState('');
  const [shopName,         setShopName]         = useState('');
  const [shop,             setShop]             = useState(null);
  const [hasGstin,         setHasGstin]         = useState(false);
  const [userName,         setUserName]         = useState('');
  const [userRole,         setUserRole]         = useState(null);
  const [isStaffUser,      setIsStaffUser]      = useState(false);
  const [greeting]                              = useState(getGreeting);
  const [today]                                 = useState(getTodayLabel);
  const [workflowCounts,   setWorkflowCounts]   = useState({});
  const [agingData,        setAgingData]        = useState(null);
  const [agingLoading,     setAgingLoading]     = useState(false);
  const [selectedRange,    setSelectedRange]    = useState('today');

  const fetchDashboard = useCallback(async ({ silent = false, range } = {}) => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const rangeParam = range || selectedRange;
    try {
      if (!silent) setError('');
      const [dashRes, shopRes] = await Promise.all([
        fetch(apiUrl(`/api/dashboard/summary?range=${rangeParam}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'),                              { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401 || shopRes.status === 401) { router.push('/login'); return; }
      if (!dashRes.ok || !shopRes.ok) throw new Error('Failed to load dashboard');
      const dashData = await dashRes.json();
      const shopData = await shopRes.json();
      const nextShopName = shopData.name || 'मेरी दुकान';
      const nextHasGstin = !!(shopData.gstin && shopData.gstin.length === 15 && shopData.gst_type !== 'unregistered');
      setData(dashData);
      setShopName(nextShopName);
      setHasGstin(nextHasGstin);
      setShop(shopData);
      writePageCache(DASHBOARD_CACHE_KEY, { data: dashData, shopName: nextShopName, hasGstin: nextHasGstin });
    } catch (err) {
      if (!silent) { setData(null); setError(err.message || 'Dashboard data load nahi ho paya.'); }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [router, selectedRange]);

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

  // Bootstrap
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
      await Promise.all([
        fetchDashboard({ silent: Boolean(cached?.data) }),
        fetchWorkflowCounts(),
      ]);
      setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchDashboard, fetchWorkflowCounts, router]);

  // Re-fetch when date range changes (skip initial mount)
  useEffect(() => {
    if (isFirstRangeRender.current) { isFirstRangeRender.current = false; return; }
    setRefreshing(true);
    fetchDashboard({ range: selectedRange }).finally(() => setRefreshing(false));
  }, [selectedRange, fetchDashboard]);

  // Workflow count polling
  useEffect(() => {
    if (!wfc) return;
    const interval = setInterval(fetchWorkflowCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchWorkflowCounts, wfc]);

  return {
    data, loading, refreshing, error, shopName, shop, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, workflowCounts, agingData, agingLoading,
    fetchCreditAging,
    notifications, taskCount, term, config, businessType,
    bizConfig, wfc, wfWidgets, wfActions, dashCfg,
    selectedRange, setSelectedRange,
  };
}

// ─── AMC Expiry Banner (electronics only) ───────────────────────────────────

function AMCExpiryBanner() {
  const [amcs, setAmcs] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(apiUrl('/api/amc/expiring'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setAmcs(Array.isArray(d) ? d : d.amcs || []))
      .catch(() => {});
  }, []);

  if (dismissed || amcs.length === 0) return null;

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <span className="text-xl flex-shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-black text-amber-900">
          {amcs.length} AMC{amcs.length > 1 ? 's' : ''} expiring this month
        </p>
        <p className="text-[11px] text-amber-700 font-medium mt-0.5">
          {amcs.slice(0, 2).map(a => a.product_name || a.customer_name).join(', ')}
          {amcs.length > 2 && ` +${amcs.length - 2} more`}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        <Link href="/amc" className="text-[11px] font-black text-amber-700 underline">View</Link>
        <button onClick={() => setDismissed(true)} className="text-amber-400 text-lg leading-none">×</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  B2C DASHBOARD
// ═══════════════════════════════════════════════════

function B2CDashboard() {
  const {
    data, loading, refreshing, error, shopName, shop, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, workflowCounts,
    notifications, taskCount, term, config, businessType,
    wfc, wfWidgets, wfActions, dashCfg, bizConfig,
    selectedRange, setSelectedRange,
  } = useDashboardData();

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const today_profit = data?.today?.profit  || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue     || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable      || 0;
  const low_stock    = data?.stock?.lowStockCount    || 0;
  const out_of_stock = data?.stock?.outOfStockCount  || 0;
  const yest_revenue = data?.yesterday?.revenue || 0;
  const yest_profit  = data?.yesterday?.profit  || 0;
  const monthlyTarget = shop?.monthly_target || (() => {
    try { return Number(localStorage.getItem('rr-monthly-target') || 0); } catch { return 0; }
  })();

  const primaryLabel  = RANGE_LABELS[selectedRange] || 'आज';

  const b2cActions = [
    { href: '/sales/new',       emoji: config?.icon || '🧾', label: term('quickNewSaleHindi', 'Bill बनाओ'),       sublabel: 'New Invoice',   permission: 'CREATE_INVOICE'  },
    { href: '/purchases',      emoji: '🛒',                  label: term('quickPurchaseHindi', 'माल खरीदो'),    sublabel: 'New Purchase',  permission: 'CREATE_PURCHASE' },
    { href: '/udhaar',         emoji: '💸',                  label: 'Payment लो',                                sublabel: 'Add Payment',   permission: 'VIEW_UDHAAR'     },
    { href: '/product',        emoji: '📦',                  label: term('quickAddStockHindi', 'Stock जोड़ो'),  sublabel: 'Receive Stock', permission: 'MANAGE_INVENTORY'},
  ].filter(a => hasPermission(a.permission));

  const deltaRevenuePct = yest_revenue > 0
    ? ((today_sales - yest_revenue) / yest_revenue) * 100
    : null;

  const alertItems = [
    out_of_stock > 0 && { emoji: '🔴', label: `${out_of_stock} items out of stock`, href: '/product' },
    low_stock > 0    && { emoji: '🟡', label: `${low_stock} items low on stock`, href: '/product' },
    gst_payable > 0 && hasPermission('VIEW_GST') && { emoji: '🧾', label: `GST payable ₹${fmt(gst_payable)}`, href: '/gst' },
    payablesDue > 0  && { emoji: '💳', label: `Supplier dues ₹${fmt(payablesDue)}`, href: '/purchases?filter=credit_due' },
  ].filter(Boolean);
  const alertCount = alertItems.length;

  const payablesDue   = data?.purchases?.totalDue    || 0;
  const payablesCount = data?.purchases?.creditCount || 0;

  const kpiTiles = [
    hasPermission('VIEW_UDHAAR') && { label: 'उधार बाकी', value: `₹${fmt(total_udhaar)}`, sublabel: `${udhaar_count} ग्राहक`, href: '/udhaar', alert: udhaar_count > 5 ? 'red' : udhaar_count > 0 ? 'amber' : null },
    hasPermission('CREATE_PURCHASE') && payablesDue > 0 && { label: 'Payables Due', value: `₹${fmt(payablesDue)}`, sublabel: `${payablesCount} supplier${payablesCount !== 1 ? 's' : ''}`, href: '/purchases?filter=credit_due', alert: 'amber' },
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
        {hasGstin && <GstDeadlineBanner shop={shop} />}

        {/* ── Hero: Revenue | Udhaar side-by-side ── */}
        {hasPermission('VIEW_SALES') && (
          <HeroDualMetric
            revenue={today_sales}
            udhaar={total_udhaar}
            udhaarCount={udhaar_count}
            delta={deltaRevenuePct}
          />
        )}

        {/* ── Primary action grid 2×2 ── */}
        {b2cActions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {b2cActions.map(a => <QuickActionCard key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} />)}
          </div>
        )}

        {/* ── AMC expiry banner (electronics only) ── */}
        {businessType === 'electronics' && <AMCExpiryBanner />}

        {/* ── Collapsed alert strip ── */}
        <AlertStrip alertCount={alertCount} items={alertItems} />

        {/* ── Monthly Goal ── */}
        <MonthlyGoalCard monthRevenue={month_sales} monthlyTarget={monthlyTarget} />

        {/* ── Full revenue detail (range picker) ── */}
        {hasPermission('VIEW_SALES') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">{primaryLabel} का हाल</span>
              <Link href="/sales" className="page-section-link">सभी bills →</Link>
            </div>
            <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
            <div className="mt-3">
              <Link href="/sales" className="metric-card accent-money block">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{primaryLabel} की कमाई</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className="text-[36px] font-black text-slate-900 leading-none">₹{fmt(today_sales)}</p>
                  {selectedRange === 'today' && <DeltaBadge current={today_sales} yesterday={yest_revenue} />}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Bills</p>
                    <p className="text-[18px] font-black text-slate-700">{today_bills}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">मुनाफा</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[18px] font-black text-green-700">₹{fmt(today_profit)}</p>
                      {selectedRange === 'today' && <DeltaBadge current={today_profit} yesterday={yest_profit} />}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* Workflow widgets */}
        {wfc && wfWidgets.length > 0 && hasPermission('CREATE_INVOICE') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">{wfc.saleNounPlural || 'Operations'}</span>
              <Link href="/sales" className="page-section-link">सभी देखें →</Link>
            </div>
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
              {wfWidgets.map(widget => {
                const count = (widget.stages || []).reduce((sum, stage) => sum + (workflowCounts[stage] || 0), 0);
                return (
                  <Link key={widget.id} href={`/sales?wf=${(widget.stages || [])[0] || ''}`}
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

        {/* Urgent tasks */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* Industry-specific panels (config-driven) */}
        <IndustryPanels
          data={data}
          bizConfig={bizConfig}
        />

        {dashCfg?.tip && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{dashCfg.tip}</p>
          </div>
        )}

        {/* Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* Footer */}
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
    data, loading, refreshing, error, shopName, shop, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, agingData, agingLoading,
    fetchCreditAging, notifications, taskCount, term, config, businessType,
    selectedRange, setSelectedRange,
  } = useDashboardData();
  const { tier } = useTier();

  // Bug 2 fix: only fetch if agingData is null, stable deps
  useEffect(() => {
    if (agingData === null) fetchCreditAging();
  }, [fetchCreditAging, agingData]);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue     || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable      || 0;
  const itc_avail    = data?.gst?.itcAvailable    || 0;
  const yest_revenue = data?.yesterday?.revenue   || 0;
  const yest_profit  = data?.yesterday?.profit    || 0;
  const monthlyTarget = shop?.monthly_target || (() => {
    try { return Number(localStorage.getItem('rr-monthly-target') || 0); } catch { return 0; }
  })();

  const primaryLabel = RANGE_LABELS[selectedRange] || 'आज';

  const b2bActions = [
    { href: '/sales?open=1&doc=invoice',  emoji: '🧾', label: 'Tax Invoice',      sublabel: 'GST Invoice',       permission: 'CREATE_INVOICE'   },
    { href: '/sales?open=1&doc=challan',  emoji: '📋', label: 'Delivery Challan', sublabel: 'Without GST',       permission: 'CREATE_INVOICE'   },
    { href: '/purchases',                 emoji: '🛒', label: 'Purchase Order',   sublabel: 'Procurement',       permission: 'CREATE_PURCHASE'  },
    { href: '/sales/customers',           emoji: '👥', label: 'Parties',          sublabel: 'Customers/Dealers', permission: 'VIEW_SALES'       },
    { href: '/product',                   emoji: '📦', label: 'Stock Check',      sublabel: 'Inventory',         permission: 'MANAGE_INVENTORY' },
    { href: '/reports',                   emoji: '📊', label: 'Reports',          sublabel: 'Analytics',         permission: 'VIEW_REPORTS'     },
    { href: '/udhaar',                    emoji: '💰', label: 'Collect Payment',  sublabel: 'Receivables',       permission: 'VIEW_UDHAAR'      },
    { href: '/bank-entries',              emoji: '🏦', label: 'Bank Entry',       sublabel: 'Ledger',            permission: 'VIEW_BANK'        },
  ].filter(a => hasPermission(a.permission));

  const kpiTiles = [
    hasPermission('VIEW_SALES')   && { label: `${primaryLabel} की बिक्री`, value: `₹${fmt(today_sales)}`, sublabel: `${today_bills} bills`, href: '/sales' },
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

        {/* GST Filing Deadline Banner */}
        {hasGstin && <GstDeadlineBanner shop={shop} />}

        {/* Business snapshot */}
        <div>
          <div className="page-section-row px-0.5">
            <span className="page-section-label">Business Snapshot</span>
          </div>
          <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
          <div className="grid grid-cols-2 gap-3 mt-3">
            {hasPermission('VIEW_SALES') && (
              <Link href="/sales" className="metric-card accent-money block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{primaryLabel} की बिक्री</p>
                <p className="text-[22px] font-black text-slate-900 leading-none mt-1">₹{fmt(today_sales)}</p>
                {selectedRange === 'today' && <DeltaBadge current={today_sales} yesterday={yest_revenue} />}
                <p className="text-[10px] text-slate-500 mt-0.5">Sales</p>
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

        {/* Monthly Goal */}
        <MonthlyGoalCard monthRevenue={month_sales} monthlyTarget={monthlyTarget} />

        {/* Quick actions */}
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

        {/* Pending delivery challans — hardware core+ only */}
        <PendingChallansWidget businessType={businessType} tier={tier} />

        {/* Outstanding Receivables */}
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

        {/* Recent transactions */}
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

        {/* KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* Urgent tasks (stock) */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* Footer */}
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
    data, loading, refreshing, error, shopName, shop, hasGstin,
    userName, userRole, isStaffUser, greeting, today,
    fetchDashboard, agingData, agingLoading,
    fetchCreditAging,
    notifications, taskCount, term, config, businessType, dashCfg, bizConfig,
    selectedRange, setSelectedRange,
  } = useDashboardData();

  const [showAging, setShowAging] = useState(false);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchDashboard} />;

  const today_sales  = data?.today?.revenue || 0;
  const today_bills  = data?.today?.bills   || 0;
  const today_profit = data?.today?.profit  || 0;
  const month_sales  = data?.month?.revenue || 0;
  const total_udhaar = data?.udhaar?.totalDue     || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable  = data?.gst?.netPayable      || 0;
  const paymentSplit = data?.paymentSplit || {};
  const yest_revenue = data?.yesterday?.revenue || 0;
  const yest_profit  = data?.yesterday?.profit  || 0;
  const monthlyTarget = shop?.monthly_target || (() => {
    try { return Number(localStorage.getItem('rr-monthly-target') || 0); } catch { return 0; }
  })();

  const primaryLabel = RANGE_LABELS[selectedRange] || 'आज';

  const retailActions = [
    { href: '/sales?open=1&payment=cash',   emoji: config?.icon || '🧾', label: 'Bill बनाओ',  sublabel: 'Cash Invoice',  permission: 'CREATE_INVOICE'  },
    { href: '/sales?open=1&payment=credit', emoji: '📒',                  label: 'उधार दो',    sublabel: 'Credit Sale',   permission: 'CREATE_INVOICE'  },
    { href: '/product',                     emoji: '📦',                  label: 'Stock',       sublabel: 'Inventory',     permission: 'MANAGE_INVENTORY'},
    { href: '/expenses',                    emoji: '💳',                  label: 'खर्च लिखो',  sublabel: 'Expenses',      permission: 'VIEW_EXPENSES'   },
  ].filter(a => hasPermission(a.permission));

  const b2bActions = [
    { href: '/sales?open=1&doc=challan', emoji: '📋', label: 'Challan बनाओ', sublabel: 'Delivery Challan',  permission: 'CREATE_INVOICE'  },
    { href: '/sales/customers',          emoji: '👥', label: 'Parties',      sublabel: 'Dealers/Customers', permission: 'VIEW_SALES'      },
    { href: '/udhaar',                   emoji: '💰', label: 'Collect',      sublabel: 'Receivables',       permission: 'VIEW_UDHAAR'     },
    { href: '/reports',                  emoji: '📊', label: 'Reports',      sublabel: 'Analytics',         permission: 'VIEW_REPORTS'    },
  ].filter(a => hasPermission(a.permission));

  const kpiTiles = [
    hasPermission('VIEW_SALES')   && { label: 'आज', value: `₹${fmt(today_sales)}`, sublabel: `${today_bills} bills`, href: '/sales' },
    hasPermission('VIEW_UDHAAR')  && { label: 'उधार', value: `₹${fmt(total_udhaar)}`, sublabel: `${udhaar_count} ग्राहक`, href: '/udhaar', alert: udhaar_count > 0 ? 'amber' : null },
    hasGstin && hasPermission('VIEW_GST') && { label: 'GST Payable', value: `₹${fmt(gst_payable)}`, sublabel: 'This month', href: '/gst' },
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

        {/* GST Filing Deadline Banner */}
        {hasGstin && <GstDeadlineBanner shop={shop} />}

        {/* Today's snapshot */}
        {hasPermission('VIEW_SALES') && (
          <div>
            <div className="page-section-row px-0.5">
              <span className="page-section-label">{primaryLabel} का हाल</span>
              <Link href="/sales" className="page-section-link">सभी bills →</Link>
            </div>
            <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
            <div className="mt-3">
              <Link href="/sales" className="metric-card accent-money block">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{primaryLabel} की कमाई</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className="text-[36px] font-black text-slate-900 leading-none">₹{fmt(today_sales)}</p>
                  {selectedRange === 'today' && <DeltaBadge current={today_sales} yesterday={yest_revenue} />}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Revenue</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Bills</p>
                    <p className="text-[16px] font-black text-slate-700">{today_bills}</p>
                  </div>
                  <div className="w-px h-7 bg-slate-200" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">मुनाफा</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-black text-green-700">₹{fmt(today_profit)}</p>
                      {selectedRange === 'today' && <DeltaBadge current={today_profit} yesterday={yest_profit} />}
                    </div>
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
          </div>
        )}

        {/* Monthly Goal */}
        <MonthlyGoalCard monthRevenue={month_sales} monthlyTarget={monthlyTarget} />

        {/* KPI strip */}
        {kpiTiles.length > 0 && <KPIStrip tiles={kpiTiles} />}

        {/* Quick actions — two sections */}
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

        {/* Outstanding receivables — collapsible */}
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

        {/* Urgent tasks */}
        <UrgentTasksPanel data={data} shopName={shopName} term={term} />

        {/* Industry-specific panels (config-driven) */}
        <IndustryPanels
          data={data}
          bizConfig={bizConfig}
        />

        {dashCfg?.tip && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{dashCfg.tip}</p>
          </div>
        )}

        {/* Notifications */}
        <NotificationsPanel notifications={notifications} taskCount={taskCount} />

        {/* Footer */}
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
  const { tier } = useTier();
  const mode = dashboardMode || 'b2c';
  // Nano tier (micro retailer): three numbers + two buttons. No analytics suite.
  if (tier === 'nano')   return <DashboardNano />;
  if (mode === 'b2b')    return <B2BDashboard />;
  if (mode === 'hybrid') return <HybridDashboard />;
  return <B2CDashboard />;
}