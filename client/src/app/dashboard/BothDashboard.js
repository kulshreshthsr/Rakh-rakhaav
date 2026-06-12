'use client';
import Link from 'next/link';
import { useState } from 'react';
import GstDeadlineBanner from '../../components/GstDeadlineBanner';
import { useAppLocale } from '../../components/AppLocale';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function DeltaBadge({ current, yesterday }) {
  if (!yesterday || yesterday === 0) return null;
  const pct = Math.round(((current - yesterday) / yesterday) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-lg ${
      up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

function MonthlyGoalCard({ monthRevenue, monthlyTarget }) {
  const { t }  = useAppLocale();
  const today    = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dismissKey = `rr-goal-dismissed-${monthKey}`;

  const [dismissed, setDismissed] = useState(() => {
    try { return Boolean(localStorage.getItem(dismissKey)); } catch { return false; }
  });

  if (!monthlyTarget || monthlyTarget <= 0 || dismissed) return null;

  const pct        = Math.min(100, Math.round((monthRevenue / monthlyTarget) * 100));
  const remaining  = Math.max(0, monthlyTarget - monthRevenue);
  const daysLeft   = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  const achieved   = pct >= 100;
  const isNear     = pct >= 80 && !achieved;

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
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl flex-shrink-0">{achieved ? '🏆' : isNear ? '🔥' : '🎯'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-900">{t('dash_goal_title')}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {achieved ? t('dash_goal_achieved') : isNear ? t('dash_goal_near') : t('dash_goal_remaining', { days: daysLeft, remaining: fmt(remaining) })}
          </p>
        </div>
        <button type="button" onClick={dismiss}
          className="text-slate-400 hover:text-slate-600 text-[14px] flex-shrink-0">✕</button>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="font-black text-slate-700">₹{fmt(monthRevenue)}</span>
          <span className="text-slate-400">₹{fmt(monthlyTarget)}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${
            achieved ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-green-600 to-emerald-500'
          }`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] font-black text-slate-600 text-right">{pct}%</p>
      </div>
    </div>
  );
}

function getRetailActions(t) {
  return [
    { icon: '🧾', label: t('qa_new_sale'),       href: '/sales?open=1',  tint: 'green'  },
    { icon: '📦', label: t('qa_add_stock'),       href: '/product',        tint: 'blue'   },
    { icon: '💸', label: t('qa_collect_udhaar'),  href: '/udhaar',         tint: 'amber'  },
    { icon: '📊', label: t('qa_view_report'),     href: '/reports',        tint: 'purple' },
  ];
}

function getB2BActions(t) {
  return [
    { icon: '📄', label: t('qa_make_bill'),    href: '/sales?open=1&type=invoice',   tint: 'blue'   },
    { icon: '📋', label: t('qa_send_challan'), href: '/sales?open=1&type=challan',   tint: 'amber'  },
    { icon: '💬', label: t('qa_make_quote'),   href: '/sales?open=1&type=quotation', tint: 'purple' },
    { icon: '📊', label: t('qa_gst_reports'),  href: '/gst',                          tint: 'orange' },
  ];
}

const TINT = {
  green:  'bg-green-50 border-green-200 text-green-700',
  blue:   'bg-blue-50  border-blue-200  text-blue-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
};

function QuickBtn({ href, icon, label, tint }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center hover:opacity-80 transition-opacity ${TINT[tint] || TINT.green}`}>
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] font-black leading-tight">{label}</span>
    </Link>
  );
}

function FocusItem({ icon, title, color, href }) {
  const cls = color === 'red' ? 'bg-red-50 border-red-200 text-red-800' :
              color === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-800' :
              'bg-amber-50 border-amber-200 text-amber-800';
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl border hover:opacity-80 transition-opacity ${cls}`}>
      <span className="text-lg flex-shrink-0">{icon}</span>
      <span className="text-[13px] font-bold flex-1">{title}</span>
      <span className="text-[11px] font-bold flex-shrink-0">→</span>
    </Link>
  );
}

function buildFocusItems(intel, dashData, t) {
  const items = [];
  const expiryStats = dashData?.expiryStats || {};
  if ((expiryStats.expiredCount || 0) > 0)
    items.push({ icon: '☠️', title: `${expiryStats.expiredCount} items expired`, color: 'red', href: '/product?filter=expiring' });
  if ((intel?.b2bData?.overdueReceivablesTotal || 0) > 0)
    items.push({ icon: '💳', title: `₹${fmt(intel.b2bData.overdueReceivablesTotal)} B2B receivables overdue`, color: 'red', href: '/udhaar?filter=overdue' });
  if ((dashData?.pendingPickup || 0) > 0)
    items.push({ icon: '📱', title: `${dashData.pendingPickup} devices ready for pickup`, color: 'blue', href: '/sales?filter=ready' });
  if ((dashData?.stock?.lowStockCount || 0) > 0)
    items.push({ icon: '📦', title: t('dash_stock_low_msg', { n: dashData.stock.lowStockCount, item: 'items' }), color: 'amber', href: '/product' });
  if ((dashData?.udhaar?.pendingCount || 0) > 0)
    items.push({ icon: '💸', title: t('dash_collect_total', { amt: fmt(dashData.udhaar.totalDue) }), color: 'amber', href: '/udhaar' });
  return items;
}

// Mini bar chart for weekly pattern
function WeeklyMiniChart({ weekPattern }) {
  const { t } = useAppLocale();
  if (!weekPattern || weekPattern.length < 2) return null;
  const maxVal = Math.max(...weekPattern.map(d => d.revenue || 0), 1);
  const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-3">{t('dash_weekly_sales')}</p>
      <div className="flex items-end gap-1 h-16">
        {weekPattern.slice(0, 7).map((d, i) => {
          const pct = Math.round(((d.revenue || 0) / maxVal) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm bg-green-100 flex items-end justify-center" style={{ height: 48 }}>
                <div className="w-full rounded-t-sm bg-green-500 transition-all" style={{ height: `${pct}%` }} />
              </div>
              <span className="text-[8px] text-slate-400">{DAYS[i] || ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BothDashboard({ intel, dashData, loading, firstName, shop }) {
  const { t } = useAppLocale();
  const RETAIL_ACTIONS = getRetailActions(t);
  const B2B_ACTIONS    = getB2BActions(t);
  const todayRevenue    = dashData?.today?.revenue      || 0;
  const todayBills      = dashData?.today?.bills        || 0;
  const monthRevenue    = dashData?.month?.revenue      || 0;
  const yesterdayRev    = dashData?.yesterday?.revenue  || 0;
  const yesterdayProfit = dashData?.yesterday?.profit   || 0;
  const todayProfit     = dashData?.today?.profit       || 0;
  const b2cRevenue      = intel?.todayB2CRevenue        || 0;
  const b2bRevenue      = intel?.todayB2BRevenue        || 0;
  const cashInHand      = dashData?.paymentSplit?.cashInHand || 0;
  const b2cUdhaar       = dashData?.udhaar?.totalDue         || 0;
  const b2cUdhaarCount  = dashData?.udhaar?.pendingCount     || 0;
  const b2bReceivables  = intel?.b2bData?.overdueReceivablesTotal   || 0;
  const b2bReceivablesCount = intel?.b2bData?.overdueReceivables?.length || 0;
  const outstanding     = b2cUdhaar + b2bReceivables;
  const b2bCount        = b2bReceivablesCount;
  const monthlyTarget   = shop?.monthly_target || (() => {
    try { return Number(localStorage.getItem('rr-monthly-target') || 0); } catch { return 0; }
  })();
  const hasGstin = !!(shop?.gstin && shop.gstin.length === 15 && shop?.gst_type !== 'unregistered');
  const focusItems = buildFocusItems(intel, dashData, t);

  if (loading) {
    return (
      <div className="desktop-expand max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="desktop-expand max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">

      {/* GST Filing Deadline Banner */}
      {hasGstin && shop && <GstDeadlineBanner shop={shop} />}

      {/* 1. Split Header */}
      <div className="rr-page-hero">
        <p className="text-[12px] font-semibold text-green-700 mb-1">{t('dash_namaste')}{firstName ? `, ${firstName}` : ''} 🙏</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-[32px] font-black text-slate-900 leading-none">₹{fmt(todayRevenue)}</p>
          <DeltaBadge current={todayRevenue} yesterday={yesterdayRev} />
        </div>
        <p className="text-[12px] text-slate-400 mt-1">{t('dash_today_earn')} · {todayBills} bills</p>
        {(b2cRevenue > 0 || b2bRevenue > 0) && (
          <div className="flex gap-3 mt-2">
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              🛍️ Retail: ₹{fmt(b2cRevenue)}
            </span>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
              🏭 B2B: ₹{fmt(b2bRevenue)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-slate-500">{t('dash_profit_short')}: ₹{fmt(todayProfit)}</span>
          <DeltaBadge current={todayProfit} yesterday={yesterdayProfit} />
        </div>
      </div>

      {/* Monthly Goal */}
      <MonthlyGoalCard monthRevenue={monthRevenue} monthlyTarget={monthlyTarget} />

      {/* 2. KPI Grid */}
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-2 px-0.5">{t('dash_today_summary')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-slate-400 font-semibold">Retail bills</p>
            <p className="text-[22px] font-black text-amber-700 leading-none mt-1">{todayBills}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-slate-400 font-semibold">Trade orders</p>
            <p className="text-[22px] font-black text-blue-700 leading-none mt-1">{b2bCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-slate-400 font-semibold">{t('dash_cash_in')}</p>
            <p className="text-[22px] font-black text-green-700 leading-none mt-1">₹{fmt(cashInHand)}</p>
          </div>
          <div className={`rounded-2xl p-4 shadow-sm border ${outstanding > 0 ? 'bg-rose-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <p className="text-[10px] text-slate-400 font-semibold">{t('dash_pending_label')}</p>
            <p className={`text-[22px] font-black leading-none mt-1 ${outstanding > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {outstanding > 0 ? `₹${fmt(outstanding)}` : '✓ Zero'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-3 px-0.5">{t('dash_quick_actions')}</p>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2 px-1">{t('dash_for_retail')}</p>
            <div className="grid grid-cols-4 gap-2">
              {RETAIL_ACTIONS.map((a) => <QuickBtn key={a.href + a.label} href={a.href} icon={a.icon} label={a.label} tint={a.tint} />)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">{t('dash_for_b2b')}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {B2B_ACTIONS.map((a) => <QuickBtn key={a.href + a.label} href={a.href} icon={a.icon} label={a.label} tint={a.tint} />)}
          </div>
        </div>
      </div>

      {/* 4. Focus Items */}
      {focusItems.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-2 px-0.5">{t('dash_focus_items')}</p>
          <div className="space-y-2">
            {focusItems.map((item, i) => (
              <FocusItem key={i} icon={item.icon} title={item.title} color={item.color} href={item.href} />
            ))}
          </div>
        </div>
      )}

      {/* 5. Split Outstanding */}
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-2 px-0.5">{t('dash_outstanding')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-4 shadow-sm border-l-4 bg-white ${b2cUdhaar > 0 ? 'border-l-amber-400' : 'border-l-green-400'} border border-slate-200`}>
            <p className="text-[10px] text-slate-500 font-semibold">Retail Udhaar</p>
            {b2cUdhaar > 0 ? (
              <>
                <p className="text-[20px] font-black text-amber-700 leading-none mt-1">₹{fmt(b2cUdhaar)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{b2cUdhaarCount} customers</p>
                <Link href="/udhaar" className="block text-[11px] font-bold text-amber-600 mt-2">{t('dash_view_link')}</Link>
              </>
            ) : (
              <p className="text-[18px] font-black text-green-700 mt-1">✓ Zero</p>
            )}
          </div>
          <div className={`rounded-2xl p-4 shadow-sm border-l-4 bg-white ${b2bReceivables > 0 ? 'border-l-red-400' : 'border-l-green-400'} border border-slate-200`}>
            <p className="text-[10px] text-slate-500 font-semibold">B2B Receivables</p>
            {b2bReceivables > 0 ? (
              <>
                <p className="text-[20px] font-black text-red-600 leading-none mt-1">₹{fmt(b2bReceivables)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{b2bReceivablesCount} parties</p>
                <Link href="/udhaar?filter=overdue" className="block text-[11px] font-bold text-red-600 mt-2">{t('dash_view_link')}</Link>
              </>
            ) : (
              <p className="text-[18px] font-black text-green-700 mt-1">✓ Zero</p>
            )}
          </div>
        </div>
      </div>

      {/* 6. Weekly Chart */}
      {intel?.weekPattern && intel.weekPattern.length >= 2 && (
        <WeeklyMiniChart weekPattern={intel.weekPattern} />
      )}
    </div>
  );
}
