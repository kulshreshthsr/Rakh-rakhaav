'use client';
import Link from 'next/link';
import DashboardGreeting from '../../components/dashboard/DashboardGreeting';
import SectionLabel from '../../components/dashboard/SectionLabel';
import KPICard from '../../components/dashboard/KPICard';
import QuickActionButton from '../../components/dashboard/QuickActionButton';
import FocusSection from '../../components/dashboard/FocusSection';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
//knkn
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const RETAIL_ACTIONS = [
  { icon: '🧾', label: 'Naya Sale',    href: '/sales?open=1', tint: 'green'  },
  { icon: '📦', label: 'Stock Daalo',  href: '/product',       tint: 'blue'   },
  { icon: '💸', label: 'Udhaar Lo',   href: '/udhaar',         tint: 'amber'  },
  { icon: '📊', label: 'Report Dekho',href: '/reports',         tint: 'purple' },
];

const B2B_ACTIONS = [
  { icon: '📄', label: 'Bill Banao',    href: '/sales?open=1&type=invoice',   tint: 'blue'   },
  { icon: '📋', label: 'Challan Bhejo', href: '/sales?open=1&type=challan',   tint: 'amber'  },
  { icon: '💬', label: 'Quote Banao',   href: '/sales?open=1&type=quotation', tint: 'purple' },
  { icon: '📊', label: 'GST / Hisaab', href: '/gst',                          tint: 'orange' },
];

function buildFocusItems(intel, dashData) {
  const items = [];
  const expiryStats = dashData?.expiryStats || {};
  if (expiryStats.expiredCount > 0) items.push({ icon: '☠️', title: `${expiryStats.expiredCount} item expire ho gaye`, color: 'red', href: '/product?filter=expiring' });
  if ((intel?.b2bData?.overdueReceivablesTotal || 0) > 0) {
    items.push({ icon: '💳', title: `₹${fmt(intel.b2bData.overdueReceivablesTotal)} B2B receivables overdue`, color: 'red', href: '/udhaar?filter=overdue' });
  }
  if ((dashData?.pendingPickup || 0) > 0) items.push({ icon: '📱', title: `${dashData.pendingPickup} device ready for pickup`, color: 'blue', href: '/sales?filter=ready' });
  if ((dashData?.stock?.lowStockCount || 0) > 0) items.push({ icon: '📦', title: `${dashData.stock.lowStockCount} item maal kam hai`, color: 'amber', href: '/product' });
  if ((dashData?.udhaar?.pendingCount || 0) > 0) items.push({ icon: '💸', title: `₹${fmt(dashData.udhaar.totalDue)} udhaar collect karna hai`, color: 'amber', href: '/udhaar' });
  return items;
}

export default function BothDashboard({ intel, dashData, loading, firstName }) {
  const todayRevenue = dashData?.today?.revenue || 0;
  const todayBills = dashData?.today?.bills || 0;
  const delta = intel?.delta;
  const b2cRevenue = intel?.todayB2CRevenue || 0;
  const b2bRevenue = intel?.todayB2BRevenue || 0;
  const cashInHand = dashData?.paymentSplit?.cashInHand || 0;
  const outstanding = (dashData?.udhaar?.totalDue || 0) + (intel?.b2bData?.overdueReceivablesTotal || 0);
  const b2cCount = dashData?.today?.bills || 0;
  const b2bCount = intel?.b2bData?.overdueReceivables?.length || 0;
  const b2cUdhaar = dashData?.udhaar?.totalDue || 0;
  const b2cUdhaarCount = dashData?.udhaar?.pendingCount || 0;
  const b2bReceivables = intel?.b2bData?.overdueReceivablesTotal || 0;
  const b2bReceivablesCount = intel?.b2bData?.overdueReceivables?.length || 0;
  const focusItems = buildFocusItems(intel, dashData);

  return (
    <div className="desktop-expand max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-6">

      {/* 1. Split Header */}
      <DashboardGreeting
        firstName={firstName}
        todayRevenue={todayRevenue}
        delta={delta}
        todayBillCount={todayBills}
        mode="both"
        b2cRevenue={b2cRevenue}
        b2bRevenue={b2bRevenue}
      />

      {/* 2. Split KPI — 2x2 grid, no horizontal scroll */}
      <div>
        <SectionLabel hindi="आज का हिसाब" />
        <div className="grid grid-cols-2 gap-3">
          <KPICard label="Retail bills"   value={b2cCount}    money={false} tint="amber"  icon="🧾" />
          <KPICard label="Trade orders"   value={b2bCount}    money={false} tint="blue"   icon="📋" />
          <KPICard label="Cash aaya"      value={cashInHand}  money={true}  tint="green"  icon="💵" />
          <KPICard label="Baaki milna hai" value={outstanding} money={true}  tint="red"    icon="💸" />
        </div>
      </div>

      {/* 3. Unified Quick Panel */}
      <div>
        <SectionLabel hindi="सबसे ज़रूरी काम" />
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2 px-1">Retail ke liye</p>
            <div className="grid grid-cols-4 gap-2">
              {RETAIL_ACTIONS.map((a) => (
                <QuickActionButton key={a.href + a.label} href={a.href} icon={a.icon} label={a.label} tint={a.tint} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">B2B ke liye</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {B2B_ACTIONS.map((a) => (
              <QuickActionButton key={a.href + a.label} href={a.href} icon={a.icon} label={a.label} tint={a.tint} />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Focus Items */}
      <FocusSection items={focusItems} />

      {/* 5. Split Outstanding */}
      <div>
        <SectionLabel hindi="बाकी पैसे" />
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-4 ${b2cUdhaar > 0 ? 'bg-white dark:bg-slate-800 shadow-sm border-l-4 border-l-amber-400' : 'bg-white dark:bg-slate-800 shadow-sm border-l-4 border-l-green-400'}`}>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Retail Udhaar</p>
            {b2cUdhaar > 0 ? (
              <>
                <p className="text-[22px] font-black text-amber-700 dark:text-amber-400 leading-none mt-1">₹{fmt(b2cUdhaar)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{b2cUdhaarCount} customers</p>
                <Link href="/udhaar" className="block text-[11px] font-bold text-amber-600 mt-2">
                  Dekho <span aria-hidden="true">›</span>
                </Link>
              </>
            ) : (
              <p className="text-[18px] font-black text-green-700 dark:text-green-400 mt-1">✓ Zero</p>
            )}
          </div>

          <div className={`rounded-2xl p-4 ${b2bReceivables > 0 ? 'bg-white dark:bg-slate-800 shadow-sm border-l-4 border-l-red-400' : 'bg-white dark:bg-slate-800 shadow-sm border-l-4 border-l-green-400'}`}>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">B2B Receivables</p>
            {b2bReceivables > 0 ? (
              <>
                <p className="text-[22px] font-black text-red-600 dark:text-red-400 leading-none mt-1">₹{fmt(b2bReceivables)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{b2bReceivablesCount} parties</p>
                <Link href="/udhaar?filter=overdue" className="block text-[11px] font-bold text-red-600 mt-2">
                  Dekho <span aria-hidden="true">›</span>
                </Link>
              </>
            ) : (
              <p className="text-[18px] font-black text-green-700 dark:text-green-400 mt-1">✓ Zero</p>
            )}
          </div>
        </div>
      </div>

      {/* 6. Mini Week Chart */}
      {intel?.weekPattern && intel.weekPattern.length >= 2 && (
        <WeeklyChart weekPattern={intel.weekPattern} />
      )}

    </div>
  );
}
