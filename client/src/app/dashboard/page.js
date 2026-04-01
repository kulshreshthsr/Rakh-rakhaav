'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_CACHE_PREFIX = 'dashboard-summary-v3';

const getToken = () => localStorage.getItem('token');
const getBusinessName = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    return storedUser?.shopName || storedUser?.shop_name || storedUser?.businessName || storedUser?.name || 'Your Business';
  } catch {
    return 'Your Business';
  }
};
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
const writeDashboardCache = (month, year, value) => writePageCache(getCacheKey(month, year), value);

function QuickActionGlyph({ name }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'sales':
      return <svg {...common}><path d="M12 2v20" /><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg>;
    case 'purchase':
      return <svg {...common}><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" /></svg>;
    case 'stock':
      return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></svg>;
    case 'gst':
      return <svg {...common}><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></svg>;
    default:
      return <svg {...common}><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3" /><path d="M6 3.5v20" /><path d="M9 7.5h6" /><path d="M9 11.5h6" /><path d="M9 15.5h4" /></svg>;
  }
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;
    const finalValue = Number.isFinite(Number(target)) ? Number(target) : 0;

    const tick = (timestamp) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      setValue(Math.round(finalValue * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

function CountNumber({ value, prefix = '', suffix = '', sign = '', className = '', color }) {
  const animated = useCountUp(Math.abs(value));
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(animated);

  return (
    <div className={className} style={color ? { color } : undefined}>
      {sign}{prefix}{formatted}{suffix}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="premium-page">
      <div className="premium-panel p-6">
        <div className="grid gap-3">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-12 w-72" />
        </div>
      </div>
      <div className="premium-metric-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="premium-metric-card p-6">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-4 h-12 w-36" />
            <div className="skeleton mt-4 h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
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
  const businessName = getBusinessName();

  const statCards = [
    {
      label: 'Sales',
      value: stats?.totalRevenue || 0,
      note: `${stats?.salesCount || 0} invoices this month`,
      href: '/sales',
      accent: '#6366F1',
      color: '#0CAF60',
      prefix: '₹',
    },
    {
      label: 'Profit',
      value: profit,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      href: '/reports',
      accent: '#0CAF60',
      color: profit >= 0 ? '#0CAF60' : '#F43F5E',
      prefix: '₹',
      sign: profit >= 0 ? '+' : '-',
    },
    {
      label: 'Credit',
      value: totalCustomerUdhaar,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      href: '/udhaar',
      accent: '#F59E0B',
      color: '#F59E0B',
      prefix: '₹',
    },
    {
      label: 'GST',
      value: Math.abs(netGST),
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      href: '/gst',
      accent: '#FB923C',
      color: '#FB923C',
      prefix: '₹',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'sales', title: 'Sales', note: 'Record sale', tint: '#eef2ff', color: '#6366F1' },
    { href: '/purchases', icon: 'purchase', title: 'Purchases', note: 'Record purchase', tint: '#fffbeb', color: '#f59e0b' },
    { href: '/product', icon: 'stock', title: 'Products', note: 'Update stock', tint: '#ecfdf5', color: '#0caf60' },
    { href: '/gst', icon: 'gst', title: 'GST', note: 'Tax summary', tint: '#f5f3ff', color: '#8b5cf6' },
  ];

  const breakdown = [
    { label: 'Revenue', value: stats?.totalRevenue || 0, color: '#0CAF60', prefix: '₹' },
    { label: 'Profit', value: Math.abs(profit), color: profit >= 0 ? '#0CAF60' : '#F43F5E', prefix: '₹', sign: profit >= 0 ? '+' : '-' },
    { label: 'GST Collected', value: stats?.gstCollected || 0, color: '#F59E0B', prefix: '₹' },
    { label: 'ITC', value: stats?.gstITC || 0, color: '#6366F1', prefix: '₹', sign: '-' },
    { label: 'Net GST', value: Math.abs(netGST), color: netGST >= 0 ? '#FB923C' : '#0CAF60', prefix: '₹', sign: netGST < 0 ? '-' : '' },
  ];

  return (
    <Layout>
      <div className="premium-page">
        <section className="premium-panel stagger-item p-6" style={{ animationDelay: '0ms' }}>
          <div className="premium-header-row">
            <div className="grid gap-3">
              <div className="premium-kicker">Business overview</div>
              <div>
                <h1 className="premium-page-title">Dashboard</h1>
                <p className="mt-3 text-sm text-slate-400">
                  {businessName} summary for {MONTHS[selectedMonth - 1]} {selectedYear}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {refreshing
                    ? 'Refreshing latest data...'
                    : !isOnline
                      ? `Offline snapshot active${cacheLabel ? ` • last updated ${cacheLabel}` : ''}`
                      : cacheLoaded && cacheLabel
                        ? `Last synced ${cacheLabel}`
                        : 'Live business health at a glance'}
                </p>
              </div>
            </div>

            <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
              <div className="premium-select-wrap">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="form-input"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
                <span className="premium-select-chevron">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </div>
              <div className="premium-select-wrap">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="form-input"
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="premium-select-chevron">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </div>
            </div>
          </div>
        </section>

        {!isOnline ? (
          <section className="premium-alert stagger-item" style={{ animationDelay: '80ms' }}>
            <strong>Dashboard offline mode</strong>
            <div className="mt-2 text-sm">
              Cached business snapshot is visible right now. Sales, GST, credit, and stock alerts will refresh again when your connection returns.
            </div>
          </section>
        ) : null}

        <section className="premium-metric-grid">
          {statCards.map((card, index) => (
            <button
              key={card.label}
              type="button"
              onClick={() => router.push(card.href)}
              className="premium-metric-card stagger-item text-left"
              style={{ animationDelay: `${(index + 1) * 80}ms` }}
            >
              <span className="premium-metric-strip" style={{ background: card.accent }} />
              <div className="premium-metric-label">{card.label}</div>
              <CountNumber
                value={card.value}
                prefix={card.prefix}
                sign={card.sign || ''}
                className="premium-metric-value"
                color={card.color}
              />
              <div className="premium-metric-note">{card.note}</div>
            </button>
          ))}
        </section>

        {revenue > 0 ? (
          <section className="premium-panel stagger-item p-6" style={{ animationDelay: '400ms' }}>
            <div className="premium-header-row">
              <div>
                <div className="premium-kicker">Financial mix</div>
                <div className="mt-2 premium-section-title">Revenue, profit and GST in one frame</div>
              </div>
              <div className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600">
                Margin {margin}%
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-5">
              {breakdown.map((item, index) => (
                <div key={item.label} className="rounded-[20px] border border-indigo-50 bg-[#fbfcff] p-5">
                  <div className="premium-metric-label">{item.label}</div>
                  <CountNumber
                    value={item.value}
                    prefix={item.prefix}
                    sign={item.sign || ''}
                    className="mt-3 premium-stat-figure text-[1.75rem] font-bold"
                    color={item.color}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {lowStockCount > 0 ? (
          <section
            className="premium-panel stagger-item cursor-pointer p-6"
            style={{ animationDelay: '480ms' }}
            onClick={() => router.push('/product')}
          >
            <div className="premium-header-row">
              <div>
                <div className="premium-kicker">Attention needed</div>
                <div className="mt-2 premium-section-title">Low Stock</div>
                <p className="mt-2 text-sm text-slate-400">
                  {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} close to stockout.
                </p>
              </div>
              <div className="premium-secondary-btn">Open Products</div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {lowStockProducts.slice(0, 6).map((product) => (
                <span
                  key={product._id}
                  className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700"
                >
                  {product.name} ({product.quantity ?? 0})
                </span>
              ))}
              {lowStockCount > 6 ? (
                <span className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600">
                  +{lowStockCount - 6} more
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="premium-panel stagger-item p-6" style={{ animationDelay: '560ms' }}>
          <div className="premium-header-row">
            <div>
              <div className="premium-kicker">Work faster</div>
              <div className="mt-2 premium-section-title">Quick Actions</div>
            </div>
          </div>

          <div className="mt-6 premium-quick-grid">
            {quickActions.map((action, index) => (
              <a
                key={action.href}
                href={action.href}
                className="premium-quick-card stagger-item"
                style={{ animationDelay: `${640 + (index * 80)}ms` }}
              >
                <div className="premium-icon-box" style={{ background: action.tint, color: action.color }}>
                  <QuickActionGlyph name={action.icon} />
                </div>
                <div className="text-base font-bold text-slate-900">{action.title}</div>
                <div className="mt-2 text-sm text-slate-400">{action.note}</div>
              </a>
            ))}
          </div>
        </section>

        <section className="premium-panel stagger-item p-6" style={{ animationDelay: '720ms' }}>
          <div className="premium-header-row">
            <div>
              <div className="premium-kicker">Best performers</div>
              <div className="mt-2 premium-section-title">Top Products</div>
              <p className="mt-2 text-sm text-slate-400">{MONTHS[selectedMonth - 1]} {selectedYear}</p>
            </div>
          </div>

          {topProducts.length === 0 ? (
            <div className="premium-empty-state mt-6">
              <div className="text-lg font-semibold text-slate-500">No top products yet for this period.</div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="premium-card stagger-item flex items-center gap-4 p-5"
                  style={{ animationDelay: `${800 + (index * 80)}ms` }}
                >
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold text-white"
                    style={{
                      background: ['#6366F1', '#0CAF60', '#F59E0B', '#F43F5E'][index % 4],
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{product.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{product.qty} units sold</div>
                  </div>
                  <div className="premium-currency text-xl font-bold text-emerald-600">₹{fmt(product.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
