'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { StatCard, StatusBadge } from '../../components/ui/AppUI';
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
    width: 20,
    height: 20,
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

function MetricGlyph({ name }) {
  const common = {
    width: 24,
    height: 24,
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
      return <svg {...common}><path d="M12 3v18" /><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg>;
    case 'profit':
      return <svg {...common}><path d="M4 16 10 10l4 4 6-8" /><path d="M20 9V4h-5" /></svg>;
    case 'credit':
      return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h3" /></svg>;
    case 'gst':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="3" /></svg>;
  }
}

function ChevronRightGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DashboardSkeleton = () => (
  <div className="page-shell">
    <section className="card">
      <div className="page-toolbar">
        <div>
          <div className="skeleton" style={{ height: 16, width: 110, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 28, width: 180 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 260, width: '100%' }}>
          <div className="skeleton" style={{ height: 44 }} />
          <div className="skeleton" style={{ height: 44 }} />
        </div>
      </div>
    </section>

    <section className="metric-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="card" style={{ minHeight: 138 }}>
          <div className="skeleton" style={{ height: 12, width: 96, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 34, width: 120, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 12, width: 140 }} />
        </div>
      ))}
    </section>

    <section className="card">
      <div className="skeleton" style={{ height: 16, width: 180, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 12, width: 240, marginBottom: 18 }} />
      <div className="quick-actions-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 44 }} />
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
  const [animatedMargin, setAnimatedMargin] = useState(0);

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

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;
  const revenue = stats?.totalRevenue || 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
  const marginValue = Math.max(0, Math.min(100, Number.parseFloat(margin) || 0));
  const lowStockCount = lowStockProducts.length;
  const businessName = getBusinessName();

  useEffect(() => {
    setAnimatedMargin(0);
    if (typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => {
      setAnimatedMargin(marginValue);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [marginValue]);

  if (loading && !cacheLoaded) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  const statCards = [
    {
      label: 'Sales',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      tone: 'money',
      href: '/sales',
      icon: <MetricGlyph name="sales" />,
    },
    {
      label: 'Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      tone: profit >= 0 ? 'secondary' : 'danger',
      href: '/reports',
      icon: <MetricGlyph name="profit" />,
    },
    {
      label: 'Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      tone: totalCustomerUdhaar > 0 ? 'danger' : 'money',
      href: '/udhaar',
      icon: <MetricGlyph name="credit" />,
    },
    {
      label: 'GST Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      tone: 'warning',
      href: '/gst',
      icon: <MetricGlyph name="gst" />,
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
        <section className="card dashboard-overview-card">
          <div className="dashboard-overview-head">
            <div className="dashboard-overview-copy">
              <div className="dashboard-overview-kicker">Business overview</div>
              <div className="page-title">Dashboard</div>
              <div className="dashboard-overview-business">{businessName}</div>
              {refreshing ? (
                <div className="dashboard-overview-status">Refreshing latest data...</div>
              ) : !isOnline ? (
                <div className="dashboard-overview-status dashboard-overview-status-offline">
                  Offline snapshot active{cacheLabel ? ` • last updated ${cacheLabel}` : ''}
                </div>
              ) : cacheLoaded && cacheLabel ? (
                <div className="dashboard-overview-status">Last synced {cacheLabel}</div>
              ) : null}
            </div>

            <div className="dashboard-summary-panel">
              <div className="dashboard-summary-panel-copy">
                <div className="dashboard-summary-panel-label">Selected period</div>
                <div className="dashboard-summary-panel-value">{MONTHS[selectedMonth - 1]} {selectedYear}</div>
              </div>
              <div className="dashboard-period-controls dashboard-period-shell dashboard-period-grid">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="form-input dashboard-period-select"
                  style={{ minWidth: 0, height: 44 }}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="form-input dashboard-period-select"
                  style={{ minWidth: 0, height: 44 }}
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {!isOnline ? (
          <section className="card" style={{ border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' }}>
            <strong>Dashboard offline mode</strong>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Abhi cached business snapshot dikh raha hai. Sales, GST, low stock aur credit numbers live nahi hain jab tak internet wapas na aaye.
            </div>
          </section>
        ) : null}

        {lowStockCount > 0 && (
          <section className="dashboard-low-stock-banner">
            <div className="dashboard-low-stock-main">
              <div className="dashboard-low-stock-icon" aria-hidden="true">⚠️</div>
              <div className="dashboard-low-stock-copy">
                <div className="dashboard-low-stock-title">Low Stock Alert</div>
                <div className="dashboard-low-stock-text">
                  {lowStockCount} item{lowStockCount > 1 ? 's' : ''} close to stockout - {lowStockProducts.slice(0, 3).map((product) => `${product.name} (${product.quantity ?? 0})`).join(', ')}
                  {lowStockCount > 3 ? ` +${lowStockCount - 3} more` : ''}
                </div>
              </div>
            </div>
            <button type="button" className="btn-ghost dashboard-low-stock-cta" onClick={() => router.push('/product')}>
              Open Products
            </button>
          </section>
        )}

        <section className="dashboard-metric-grid">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              className={`dashboard-stat-card dashboard-stat-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
              tone={card.tone}
              label={card.label}
              value={card.value}
              note={card.note}
              icon={card.icon}
              onClick={() => router.push(card.href)}
            />
          ))}
        </section>

        {revenue > 0 && (
          <section className="card dashboard-section-card">
            <div className="dashboard-breakdown-head">
              <div>
                <div className="section-title">Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <div className="dashboard-margin-ring-wrap" aria-label={`Profit margin ${margin}%`}>
                <svg className="dashboard-margin-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                  <defs>
                    <linearGradient id="dashboardMarginGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#5B4FC9" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                  <circle cx="28" cy="28" r="22" className="dashboard-margin-ring-track" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    className="dashboard-margin-ring-progress"
                    style={{
                      strokeDasharray: 138.23,
                      strokeDashoffset: 138.23 - (138.23 * animatedMargin) / 100,
                    }}
                  />
                </svg>
                <div className="dashboard-margin-ring-center">{margin}%</div>
              </div>
            </div>

            <div className="dashboard-breakdown-grid">
              {[
                { label: 'Revenue', value: stats?.totalRevenue, color: '#10b981', prefix: '' },
                { label: 'Profit', value: profit, color: profit >= 0 ? '#2563eb' : '#dc2626', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: stats?.gstCollected, color: '#f59e0b', prefix: '' },
                { label: 'ITC', value: stats?.gstITC, color: '#7c3aed', prefix: '-' },
                { label: 'Net GST', value: netGST, color: netGST >= 0 ? '#f59e0b' : '#10b981', prefix: '' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="dashboard-breakdown-card"
                >
                  <div className="dashboard-breakdown-label">{item.label}</div>
                  <div className="dashboard-breakdown-value" style={{ color: item.color }}>
                    {item.prefix}₹{fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-gst-formula">
              <div className="dashboard-gst-formula-row">
                <span className="dashboard-gst-formula-label">GST Collected</span>
                <strong className="dashboard-gst-formula-value">₹{fmt(stats?.gstCollected)}</strong>
              </div>
              <div className="dashboard-gst-formula-row">
                <span className="dashboard-gst-formula-label">Less: ITC</span>
                <strong className="dashboard-gst-formula-value dashboard-gst-formula-value-muted">₹{fmt(stats?.gstITC)}</strong>
              </div>
              <div className="dashboard-gst-formula-total">
                <span className="dashboard-gst-formula-total-label">Net GST</span>
                <strong className="dashboard-gst-formula-total-value">₹{fmt(netGST)}</strong>
              </div>
            </div>

            <div className="dashboard-margin-block">
              <div className="dashboard-margin-row">
                <span>Profit Margin</span>
                <strong style={{ color: profit >= 0 ? '#16a34a' : '#dc2626' }}>{margin}%</strong>
              </div>
              <div className="dashboard-progress-track">
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${animatedMargin}%`,
                  }}
                >
                  <span className="dashboard-progress-pulse" />
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="card dashboard-section-card" style={{ paddingBottom: 18 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div className="section-title">Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <StatusBadge tone="neutral">{quickActions.length} shortcuts</StatusBadge>
          </div>
          <div className="quick-actions-carousel">
            <div className="dashboard-actions-grid">
              {quickActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={`dashboard-quick-card dashboard-quick-card-${action.semantic}`}
                >
                  <div className="dashboard-quick-main">
                    <div className="dashboard-quick-icon" style={{ background: action.tone, color: action.color }}>
                      <QuickActionGlyph name={action.icon} />
                    </div>
                    <div className="dashboard-quick-copy">
                      <div className="dashboard-quick-title">{action.hi}</div>
                      <div className="dashboard-quick-subtitle">{action.sub}</div>
                    </div>
                  </div>
                  <div className="dashboard-quick-arrow"><ChevronRightGlyph /></div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="card dashboard-section-card">
          <div style={{ marginBottom: 16 }}>
            <div className="section-title">Top Products</div>
            <div className="section-subtitle">{MONTHS[selectedMonth - 1]} {selectedYear} best performers</div>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">PK</div>
              <div>No top products yet for this period.</div>
            </div>
          ) : (
            <div className="top-products-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="dashboard-top-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 14,
                    borderRadius: 18,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      background: [
                        'linear-gradient(135deg, #10b981, #34d399)',
                        'linear-gradient(135deg, #4f46e5, #818cf8)',
                        'linear-gradient(135deg, #f59e0b, #fbbf24)',
                        'linear-gradient(135deg, #ef4444, #fb7185)',
                        'linear-gradient(135deg, #2563eb, #38bdf8)',
                      ][index],
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{product.qty} units sold</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', flexShrink: 0 }}>₹{fmt(product.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

