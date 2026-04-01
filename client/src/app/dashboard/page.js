'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { StatusBadge } from '../../components/ui/AppUI';
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

function CountUpNumber({ value, prefix = '', suffix = '', decimals = 0, className = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 900;
    const start = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - ((1 - progress) * (1 - progress) * (1 - progress));
      setDisplayValue(target * eased);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayValue);

  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}

function SparklineBars({ seed = 0 }) {
  const heights = Array.from({ length: 9 }, (_, index) => {
    const wave = Math.abs(Math.sin((seed + 1) * (index + 1) * 0.67));
    return 18 + Math.round(wave * 28);
  });

  return (
    <div className="dashboard-sparkline" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={`${seed}-${index}`}
          className="dashboard-sparkline-bar"
          style={{ height, animationDelay: `${index * 70}ms` }}
        />
      ))}
    </div>
  );
}

const DashboardSkeleton = () => (
  <div className="page-shell dashboard-shell">
    <section className="card dashboard-hero-card dashboard-skeleton-card">
      <div className="dashboard-header-glow" aria-hidden="true" />
      <div className="page-toolbar dashboard-toolbar dashboard-hero-header">
        <div>
          <div className="skeleton dashboard-skeleton-line dashboard-skeleton-line-sm" />
          <div className="skeleton dashboard-skeleton-line dashboard-skeleton-line-lg" />
        </div>
        <div className="dashboard-period-controls dashboard-period-shell dashboard-period-skeleton">
          <div className="skeleton dashboard-skeleton-select" />
          <div className="skeleton dashboard-skeleton-select" />
        </div>
      </div>
    </section>

    <section className="metric-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="dashboard-metric-card dashboard-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
          <div className="skeleton dashboard-skeleton-dot-label" />
          <div className="skeleton dashboard-skeleton-value" />
          <div className="skeleton dashboard-skeleton-note" />
          <div className="dashboard-skeleton-bars">
            {Array.from({ length: 9 }).map((__, barIndex) => (
              <span key={barIndex} className="skeleton dashboard-skeleton-bar" />
            ))}
          </div>
        </div>
      ))}
    </section>

    <section className="dashboard-section-card">
      <div className="skeleton dashboard-skeleton-line dashboard-skeleton-line-md" />
      <div className="skeleton dashboard-skeleton-line dashboard-skeleton-line-sm-wide" />
      <div className="quick-actions-row dashboard-quick-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton dashboard-skeleton-quick-card" />
        ))}
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
      amount: stats?.totalRevenue || 0,
      note: `${stats?.salesCount || 0} invoices this month`,
      href: '/sales',
      icon: 'Sales',
      colorClass: 'is-emerald',
      accent: '#10b981',
      prefix: '₹',
    },
    {
      label: 'Profit',
      amount: Math.abs(profit),
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      href: '/reports',
      icon: 'Profit',
      colorClass: profit >= 0 ? 'is-emerald' : 'is-rose',
      accent: profit >= 0 ? '#10b981' : '#fb7185',
      prefix: profit >= 0 ? '+₹' : '-₹',
    },
    {
      label: 'Credit',
      amount: totalCustomerUdhaar,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      href: '/udhaar',
      icon: 'Credit',
      colorClass: 'is-gold',
      accent: '#f59e0b',
      prefix: '₹',
    },
    {
      label: 'GST Payable',
      amount: Math.abs(netGST),
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      href: '/gst',
      icon: 'GST',
      colorClass: 'is-amber',
      accent: '#fb923c',
      prefix: '₹',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'sales', hi: 'Sales', en: 'Sale', sub: 'Record sale', tone: 'rgba(16,185,129,0.12)', color: '#10b981', semantic: 'sales' },
    { href: '/purchases', icon: 'purchase', hi: 'Purchases', en: 'Purchase', sub: 'Record purchase', tone: 'rgba(245,158,11,0.12)', color: '#f59e0b', semantic: 'purchase' },
    { href: '/udhaar', icon: 'credit', hi: 'Ledger', en: 'Credit', sub: 'Manage ledger', tone: 'rgba(244,63,94,0.12)', color: '#f43f5e', semantic: 'credit' },
    { href: '/product', icon: 'stock', hi: 'Products', en: 'Product', sub: 'Update stock', tone: 'rgba(79,70,229,0.12)', color: '#4f46e5', semantic: 'stock' },
    { href: '/gst', icon: 'gst', hi: 'GST', en: 'GST', sub: 'Tax summary', tone: 'rgba(79,70,229,0.12)', color: '#4f46e5', semantic: 'gst' },
    { href: '/pricing', icon: 'premium', hi: 'Premium', en: 'Go Pro', sub: 'Unlock premium', tone: 'rgba(79,70,229,0.12)', color: '#4f46e5', semantic: 'premium' },
  ];

  return (
    <Layout>
      <div className="page-shell dashboard-shell">
        <section className="card dashboard-hero-card dashboard-fade-up" style={{ animationDelay: '0ms' }}>
          <div className="dashboard-header-glow" aria-hidden="true" />
          <div className="page-toolbar dashboard-toolbar dashboard-hero-header">
            <div style={{ minWidth: 0 }}>
              <div className="page-subtitle dashboard-page-kicker">Business overview</div>
              <div className="page-title dashboard-page-title">{businessName}</div>
              <div className="dashboard-page-copy">A premium operating view for revenue, liquidity, GST and stock health.</div>
              {refreshing ? (
                <div className="dashboard-sync-copy">Refreshing latest data...</div>
              ) : !isOnline ? (
                <div className="dashboard-sync-copy is-warning">
                  Offline snapshot active{cacheLabel ? ` • last updated ${cacheLabel}` : ''}
                </div>
              ) : cacheLoaded && cacheLabel ? (
                <div className="dashboard-sync-copy">Last synced {cacheLabel}</div>
              ) : null}
            </div>

            <div className="dashboard-period-controls dashboard-period-shell">
              <label className="dashboard-select-wrap">
                <span className="dashboard-select-label">Month</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="form-input dashboard-select"
                  style={{ minWidth: 0, height: 52 }}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </label>
              <label className="dashboard-select-wrap">
                <span className="dashboard-select-label">Year</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="form-input dashboard-select"
                  style={{ minWidth: 0, height: 52 }}
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {!isOnline ? (
          <section className="dashboard-section-card dashboard-offline-banner dashboard-fade-up" style={{ animationDelay: '80ms' }}>
            <strong>Dashboard offline mode</strong>
            <div className="dashboard-offline-copy">
              Abhi cached business snapshot dikh raha hai. Sales, GST, low stock aur credit numbers live nahi hain jab tak internet wapas na aaye.
            </div>
          </section>
        ) : null}

        <section className="metric-grid">
          {statCards.map((card, index) => (
            <button
              key={card.label}
              type="button"
              className={`dashboard-metric-card dashboard-fade-up ${card.colorClass}`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => router.push(card.href)}
            >
              <div className="dashboard-metric-top">
                <div className="dashboard-metric-label-row">
                  <span className="dashboard-metric-dot" style={{ backgroundColor: card.accent }} />
                  <span className="dashboard-metric-label">{card.label}</span>
                </div>
                <div className="dashboard-metric-icon">{card.icon}</div>
              </div>
              <div className={`dashboard-metric-value ${card.colorClass}`}>
                <CountUpNumber value={card.amount} prefix={card.prefix} />
              </div>
              <div className="dashboard-metric-note">{card.note}</div>
              <SparklineBars seed={card.amount + index + 1} />
            </button>
          ))}
        </section>

        {revenue > 0 && (
          <section className="dashboard-section-card dashboard-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="dashboard-section-head">
              <div>
                <div className="section-title">Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <StatusBadge tone="secondary" className="dashboard-section-badge">Margin {margin}%</StatusBadge>
            </div>

            <div className="metric-grid dashboard-breakdown-grid">
              {[
                { label: 'Revenue', value: stats?.totalRevenue, color: '#10b981', prefix: '' },
                { label: 'Profit', value: profit, color: profit >= 0 ? '#2563eb' : '#dc2626', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: stats?.gstCollected, color: '#f59e0b', prefix: '' },
                { label: 'ITC', value: stats?.gstITC, color: '#7c3aed', prefix: '-' },
                { label: 'Net GST', value: netGST, color: netGST >= 0 ? '#f59e0b' : '#10b981', prefix: '' },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="dashboard-breakdown-card"
                  style={{ animationDelay: `${120 + (index * 90)}ms` }}
                >
                  <div className="dashboard-breakdown-label">{item.label}</div>
                  <div className="dashboard-breakdown-value" style={{ color: item.color }}>
                    <CountUpNumber value={Math.abs(item.value)} prefix={`${item.prefix}₹`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-progress-shell">
              <div className="dashboard-progress-copy">
                <span>Profit Margin</span>
                <strong style={{ color: profit >= 0 ? '#8b5cf6' : '#dc2626' }}>{margin}%</strong>
              </div>
              <div className="dashboard-progress-track">
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.abs((profit / (revenue || 1)) * 100))}%`,
                    background: profit >= 0 ? 'linear-gradient(90deg, #16a34a, #3730a3)' : 'linear-gradient(90deg, #dc2626, #f97316)',
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {lowStockCount > 0 && (
          <section
            className="dashboard-section-card dashboard-warning-card dashboard-fade-up"
            onClick={() => router.push('/product')}
            style={{ cursor: 'pointer', animationDelay: '200ms' }}
          >
            <div className="dashboard-warning-layout">
              <div>
                <div className="section-title dashboard-warning-title">Low Stock</div>
                <div className="section-subtitle dashboard-warning-copy">
                  {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} close to stockout
                </div>
                <div className="dashboard-warning-chips">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <span
                      key={product._id}
                      className="dashboard-chip-warning"
                    >
                      {product.name} ({product.quantity ?? 0})
                    </span>
                  ))}
                  {lowStockCount > 5 && <StatusBadge tone="warning">+{lowStockCount - 5} more</StatusBadge>}
                </div>
              </div>
              <div className="btn-warning dashboard-warning-button" style={{ width: 'auto' }}>Open Products</div>
            </div>
          </section>
        )}

        <section className="dashboard-section-card dashboard-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="dashboard-section-head">
            <div>
              <div className="section-title">Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <StatusBadge tone="neutral" className="dashboard-section-badge">{quickActions.length} shortcuts</StatusBadge>
          </div>
          <div className="quick-actions-carousel">
            <div className="quick-actions-row dashboard-quick-grid">
              {quickActions.map((action, index) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={`dashboard-quick-card dashboard-quick-card-${action.semantic} dashboard-fade-up`}
                  style={{ animationDelay: `${280 + (index * 80)}ms` }}
                >
                  <div className="dashboard-quick-inner">
                    <div className={`dashboard-quick-icon dashboard-quick-icon-${action.semantic}`} style={{ color: action.color }}>
                      <QuickActionGlyph name={action.icon} />
                    </div>
                    <div>
                      <div className="dashboard-quick-title">{action.hi}</div>
                      <div className="dashboard-quick-subtitle">{action.sub}</div>
                    </div>
                  </div>
                </a>
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

        <section className="dashboard-section-card dashboard-fade-up" style={{ animationDelay: '320ms' }}>
          <div className="dashboard-section-head-simple">
            <div className="section-title">Top Products</div>
            <div className="section-subtitle">{MONTHS[selectedMonth - 1]} {selectedYear} best performers</div>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">PK</div>
              <div>No top products yet for this period.</div>
            </div>
          ) : (
            <div className="top-products-row dashboard-top-grid">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="dashboard-top-card dashboard-fade-up"
                  style={{ animationDelay: `${360 + (index * 80)}ms` }}
                >
                  <div
                    className="dashboard-top-rank"
                    style={{
                      background: [
                        'linear-gradient(135deg, #10b981, #34d399)',
                        'linear-gradient(135deg, #4f46e5, #818cf8)',
                        'linear-gradient(135deg, #f59e0b, #fbbf24)',
                        'linear-gradient(135deg, #ef4444, #fb7185)',
                        'linear-gradient(135deg, #2563eb, #38bdf8)',
                      ][index],
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="dashboard-top-copy">
                    <div className="dashboard-top-name">{product.name}</div>
                    <div className="dashboard-top-units">{product.qty} units sold</div>
                  </div>
                  <div className="dashboard-top-value">
                    <CountUpNumber value={product.revenue} prefix="₹" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

