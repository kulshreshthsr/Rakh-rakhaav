'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { StatCard, StatusBadge } from '../../components/ui/AppUI';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_CACHE_PREFIX = 'dashboard-summary-v3';

const getToken = () => localStorage.getItem('token');
const getUserCacheNamespace = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    return storedUser?.username || storedUser?.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
};
const getCacheKey = (month, year) => `${DASHBOARD_CACHE_PREFIX}:${getUserCacheNamespace()}:${year}:${month}`;

const readDashboardCache = (month, year) => readPageCache(getCacheKey(month, year));

const writeDashboardCache = (month, year, value) => {
  writePageCache(getCacheKey(month, year), value);
};

function QuickActionGlyph({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'sales':
      return <svg {...common}><path d="M12 2v20" /><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg>;
    case 'purchase':
      return <svg {...common}><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" /></svg>;
    case 'credit':
      return <svg {...common}><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3" /><path d="M6 3.5v20" /><path d="M9 7.5h6" /><path d="M9 11.5h6" /><path d="M9 15.5h4" /></svg>;
    case 'stock':
      return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></svg>;
    case 'gst':
      return <svg {...common}><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></svg>;
    default:
      return <svg {...common}><path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z" /></svg>;
  }
}

const DashboardSkeleton = () => (
  <div className="page-shell">
    <section className="card">
      <div className="page-toolbar">
        <div>
          <div className="skeleton mb-2 h-4 w-[110px]" />
          <div className="skeleton h-7 w-[180px]" />
        </div>
        <div className="grid w-full max-w-[260px] grid-cols-2 gap-2">
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
        </div>
      </div>
    </section>

    <section className="metric-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="card min-h-[138px]">
          <div className="skeleton mb-4 h-3 w-24" />
          <div className="skeleton mb-3 h-[34px] w-[120px]" />
          <div className="skeleton h-3 w-[140px]" />
        </div>
      ))}
    </section>

    <section className="card">
      <div className="skeleton mb-2.5 h-4 w-[180px]" />
      <div className="skeleton mb-[18px] h-3 w-[240px]" />
      <div className="quick-actions-row grid grid-cols-3 gap-[10px]">
        <div className="skeleton h-11" />
        <div className="skeleton h-11" />
      </div>
    </section>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [totalCustomerUdhaar, setTotalCustomerUdhaar] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

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

        if (!res.ok) {
          if (res.status === 401) router.push('/login');
          return;
        }

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
        if (error.name !== 'AbortError' && !cached) {
          setLoading(false);
        }
      } finally {
        setRefreshing(false);
      }
    });

    return () => {
      controller.abort();
      cancelDeferred(idleId);
    };
  }, [router, selectedMonth, selectedYear]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (loading && !cacheLoaded) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;
  const revenue = stats?.totalRevenue || 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
  const lowStockCount = lowStockProducts.length;
  const statCards = [
    {
      label: 'Sales',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      tone: 'money',
      href: '/sales',
    },
    {
      label: 'Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      tone: profit >= 0 ? 'secondary' : 'danger',
      href: '/reports',
    },
    {
      label: 'Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      tone: totalCustomerUdhaar > 0 ? 'danger' : 'money',
      href: '/udhaar',
    },
    {
      label: 'GST Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      tone: 'warning',
      href: '/gst',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'sales', hi: 'Sales', en: 'Sale', sub: 'Record sale', semantic: 'sales', iconClass: 'bg-emerald-500/10 text-emerald-500' },
    { href: '/purchases', icon: 'purchase', hi: 'Purchases', en: 'Purchase', sub: 'Record purchase', semantic: 'purchase', iconClass: 'bg-amber-500/10 text-amber-500' },
    { href: '/udhaar', icon: 'credit', hi: 'Ledger', en: 'Credit', sub: 'Manage ledger', semantic: 'credit', iconClass: 'bg-rose-500/10 text-rose-500' },
    { href: '/product', icon: 'stock', hi: 'Products', en: 'Product', sub: 'Update stock', semantic: 'stock', iconClass: 'bg-cyan-600/10 text-cyan-600' },
    { href: '/gst', icon: 'gst', hi: 'GST', en: 'GST', sub: 'Tax summary', semantic: 'gst', iconClass: 'bg-cyan-600/10 text-cyan-600' },
    { href: '/pricing', icon: 'premium', hi: 'Premium', en: 'Go Pro', sub: 'Unlock premium', semantic: 'premium', iconClass: 'bg-cyan-600/10 text-cyan-600' },
  ];
  const progressPct = Math.min(100, Math.abs((profit / (revenue || 1)) * 100));
  const progressWidthClass = progressPct >= 100 ? 'w-full'
    : progressPct >= 90 ? 'w-[90%]'
      : progressPct >= 80 ? 'w-[80%]'
        : progressPct >= 70 ? 'w-[70%]'
          : progressPct >= 60 ? 'w-[60%]'
            : progressPct >= 50 ? 'w-1/2'
              : progressPct >= 40 ? 'w-[40%]'
                : progressPct >= 30 ? 'w-[30%]'
                  : progressPct >= 20 ? 'w-1/5'
                    : progressPct >= 10 ? 'w-[10%]'
                      : progressPct > 0 ? 'w-[5%]'
                        : 'w-0';
  const topProductRankClass = [
    'bg-gradient-to-br from-emerald-500 to-emerald-400',
    'bg-gradient-to-br from-cyan-600 to-cyan-400',
    'bg-gradient-to-br from-amber-500 to-amber-300',
    'bg-gradient-to-br from-rose-500 to-rose-400',
    'bg-gradient-to-br from-blue-600 to-sky-400',
  ];

  return (
    <Layout>
      <div className="page-shell dashboard-shell">
        <section className="hero-panel dashboard-hero">
          <div className="page-toolbar dashboard-toolbar flex-nowrap items-start gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="rr-page-eyebrow">Business overview</p>
              <div className="page-title">Dashboard</div>
              {refreshing ? (
                <p className="rr-meta-line">Refreshing latest data…</p>
              ) : !isOnline ? (
                <p className="rr-meta-line is-warn">
                  Offline snapshot active{cacheLabel ? ` · last updated ${cacheLabel}` : ''}
                </p>
              ) : cacheLoaded && cacheLabel ? (
                <p className="rr-meta-line">Last synced {cacheLabel}</p>
              ) : null}
            </div>

            <div className="dashboard-period-controls dashboard-period-shell grid min-w-[170px] shrink-0 grid-cols-2 gap-1.5 sm:min-w-[236px] sm:gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="form-input h-10 min-w-0 px-2 text-[12px] sm:h-11 sm:px-3 sm:text-[13px]"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="form-input h-10 min-w-0 px-2 text-[12px] sm:h-11 sm:px-3 sm:text-[13px]"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {!isOnline ? (
          <section className="rr-banner-warn" role="status">
            <strong>Dashboard offline mode</strong>
            <div>
              Abhi cached business snapshot dikh raha hai. Sales, GST, low stock aur credit numbers live nahi hain jab tak internet wapas na aaye.
            </div>
          </section>
        ) : null}

        <section className="metric-grid">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              className="dashboard-stat-card"
              tone={card.tone}
              label={card.label}
              value={card.value}
              note={card.note}
              onClick={() => router.push(card.href)}
            />
          ))}
        </section>

        {revenue > 0 && (
          <section className="card dashboard-section-card">
            <div className="mb-[18px] flex flex-wrap justify-between gap-[14px]">
              <div>
                <div className="section-title">Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <StatusBadge tone="secondary">Margin {margin}%</StatusBadge>
            </div>

            <div className="metric-grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              {[
                { label: 'Revenue', value: stats?.totalRevenue, valueClass: 'text-emerald-500', prefix: '' },
                { label: 'Profit', value: profit, valueClass: profit >= 0 ? 'text-blue-600' : 'text-red-600', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: stats?.gstCollected, valueClass: 'text-amber-500', prefix: '' },
                { label: 'ITC', value: stats?.gstITC, valueClass: 'text-cyan-600', prefix: '-' },
                { label: 'Net GST', value: netGST, valueClass: netGST >= 0 ? 'text-amber-500' : 'text-emerald-500', prefix: '' },
              ].map((item) => (
                <div key={item.label} className="dashboard-breakdown-card rounded-[18px] p-[14px]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
                      {item.label}
                    </div>
                  <div className={`mt-2 text-[24px] font-extrabold tracking-[-0.05em] ${item.valueClass}`}>
                    {item.prefix}₹{fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex justify-between gap-3 text-[12px] text-slate-600">
                <span>Profit Margin</span>
                <strong className={profit >= 0 ? 'text-blue-600' : 'text-red-600'}>{margin}%</strong>
              </div>
              <div className="dashboard-progress-track h-2.5 overflow-hidden rounded-full">
                <div
                  className={`dashboard-progress-fill h-full rounded-full ${progressWidthClass} ${profit >= 0 ? 'bg-gradient-to-r from-green-600 to-cyan-600' : 'bg-gradient-to-r from-red-600 to-orange-500'}`}
                />
              </div>
            </div>
          </section>
        )}

        {lowStockCount > 0 && (
          <section
            className="card dashboard-section-card dashboard-warning-card cursor-pointer"
            onClick={() => router.push('/product')}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="section-title text-amber-700">Low Stock</div>
                <div className="section-subtitle text-amber-600">
                  {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} close to stockout
                </div>
                <div className="mt-[14px] flex flex-wrap gap-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <span
                      key={product._id}
                      className="dashboard-chip-warning px-[11px] py-[7px]"
                    >
                      {product.name} ({product.quantity ?? 0})
                    </span>
                  ))}
                  {lowStockCount > 5 && <StatusBadge tone="warning">+{lowStockCount - 5} more</StatusBadge>}
                </div>
              </div>
              <div className="btn-warning w-auto">Open Products</div>
            </div>
          </section>
        )}

        <section className="card dashboard-section-card pb-[18px]">
          <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[14px]">
            <div>
              <div className="section-title">Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <StatusBadge tone="neutral">{quickActions.length} shortcuts</StatusBadge>
          </div>
          <div className="quick-actions-carousel">
            <div className="quick-actions-row grid grid-cols-3 gap-[10px]">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`dashboard-quick-card dashboard-quick-card-${action.semantic} min-h-[94px] rounded-[18px] px-3 py-[14px] no-underline`}
                >
                  <div className="grid justify-items-start gap-[10px]">
                    <div className={`dashboard-quick-icon flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[10px] ${action.iconClass}`}><QuickActionGlyph name={action.icon} /></div>
                    <div>
                      <div className="text-[13px] font-extrabold leading-[1.3] text-slate-900">{action.hi}</div>
                      <div className="mt-0.5 text-[11px] leading-[1.45] text-slate-600">{action.sub}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="quick-actions-fade" aria-hidden="true" />
            <div className="quick-actions-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </section>

        <section className="card dashboard-section-card">
          <div className="mb-4">
            <div className="section-title">Top Products</div>
            <div className="section-subtitle">{MONTHS[selectedMonth - 1]} {selectedYear} best performers</div>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">PK</div>
              <div>No top products yet for this period.</div>
            </div>
          ) : (
            <div className="top-products-row grid grid-cols-4 gap-[10px]">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="dashboard-top-card flex min-w-0 items-center gap-[10px] rounded-[18px] p-[14px]"
                >
                  <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[14px] font-extrabold text-white ${topProductRankClass[index] || topProductRankClass[0]}`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate whitespace-nowrap text-[14px] font-bold text-slate-900">{product.name}</div>
                    <div className="text-[12px] text-slate-600">{product.qty} units sold</div>
                  </div>
                  <div className="shrink-0 text-[15px] font-extrabold text-emerald-600">₹{fmt(product.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

