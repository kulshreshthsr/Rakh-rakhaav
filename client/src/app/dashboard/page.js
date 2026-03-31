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
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      tone: 'money',
      href: '/sales',
      icon: 'Sales',
    },
    {
      label: 'Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      tone: profit >= 0 ? 'secondary' : 'danger',
      href: '/reports',
      icon: 'Profit',
    },
    {
      label: 'Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      tone: totalCustomerUdhaar > 0 ? 'danger' : 'money',
      href: '/udhaar',
      icon: 'Credit',
    },
    {
      label: 'GST Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      tone: 'warning',
      href: '/gst',
      icon: 'GST',
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
        <section className="card">
          <div className="page-toolbar dashboard-toolbar">
            <div style={{ minWidth: 0 }}>
              <div className="page-subtitle">Business overview</div>
              <div className="page-title">Dashboard</div>
              {refreshing ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Refreshing latest data...</div>
              ) : !isOnline ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#92400e' }}>
                  Offline snapshot active{cacheLabel ? ` • last updated ${cacheLabel}` : ''}
                </div>
              ) : cacheLoaded && cacheLabel ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Last synced {cacheLabel}</div>
              ) : null}
            </div>

            <div className="dashboard-period-controls dashboard-period-shell" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 236 }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="form-input"
                style={{ minWidth: 0, height: 44 }}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="form-input"
                style={{ minWidth: 0, height: 44 }}
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
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

        <section className="metric-grid">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              className="dashboard-stat-card"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div className="section-title">Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <StatusBadge tone="secondary">Margin {margin}%</StatusBadge>
            </div>

            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
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
                  style={{
                    padding: 14,
                    borderRadius: 18,
                  }}
                >
                    <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.label}
                    </div>
                  <div style={{ fontSize: 24, color: item.color, fontWeight: 800, letterSpacing: '-0.05em', marginTop: 8 }}>
                    {item.prefix}₹{fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#475569', marginBottom: 6 }}>
                <span>Profit Margin</span>
                <strong style={{ color: profit >= 0 ? '#2563eb' : '#dc2626' }}>{margin}%</strong>
              </div>
              <div className="dashboard-progress-track" style={{ height: 10, borderRadius: 999, overflow: 'hidden' }}>
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.abs((profit / (revenue || 1)) * 100))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: profit >= 0 ? 'linear-gradient(90deg, #16a34a, #3730a3)' : 'linear-gradient(90deg, #dc2626, #f97316)',
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {lowStockCount > 0 && (
          <section
            className="card dashboard-section-card dashboard-warning-card"
            onClick={() => router.push('/product')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="section-title" style={{ color: '#b45309' }}>Low Stock</div>
                <div className="section-subtitle" style={{ color: '#d97706' }}>
                  {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} close to stockout
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <span
                      key={product._id}
                      className="dashboard-chip-warning"
                      style={{ padding: '7px 11px' }}
                    >
                      {product.name} ({product.quantity ?? 0})
                    </span>
                  ))}
                  {lowStockCount > 5 && <StatusBadge tone="warning">+{lowStockCount - 5} more</StatusBadge>}
                </div>
              </div>
              <div className="btn-warning" style={{ width: 'auto' }}>Open Products</div>
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
            <div className="quick-actions-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {quickActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={`dashboard-quick-card dashboard-quick-card-${action.semantic}`}
                  style={{
                    textDecoration: 'none',
                    borderRadius: 18,
                    padding: '14px 12px',
                    minHeight: 94,
                  }}
                >
                  <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
                    <div className="dashboard-quick-icon" style={{ minWidth: 40, height: 40, borderRadius: 10, background: action.tone, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><QuickActionGlyph name={action.icon} /></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3, color: '#0f172a' }}>{action.hi}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 1.45 }}>{action.sub}</div>
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

      <style>{`
        .dashboard-shell { color: #111111; }
        .dashboard-period-shell .form-input { background: #ffffff !important; color: #111111 !important; border: 1px solid #d1d5db !important; box-shadow: none; }
        .dashboard-stat-card,
        .dashboard-section-card,
        .dashboard-breakdown-card,
        .dashboard-top-card,
        .dashboard-quick-card,
        .dashboard-warning-card {
          border: 1px solid #e5e7eb !important;
          color: #111111 !important;
        }
        .dashboard-stat-card {
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08) !important;
        }
        .dashboard-top-card {
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%) !important;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07) !important;
        }
        .dashboard-breakdown-card {
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06) !important;
        }
        .dashboard-quick-card:hover,
        .dashboard-top-card:hover { transform: translateY(-3px); border-color: #cbd5e1 !important; }
        .dashboard-quick-card div[style*='color: #64748b'],
        .dashboard-top-card div[style*='color: #64748b'],
        .dashboard-breakdown-card div[style*='color: #64748b'],
        .dashboard-warning-card .section-subtitle { color: #6b7280 !important; }
        .dashboard-quick-icon,
        .dashboard-stat-icon { box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08) !important; }
        .dashboard-progress-track { background: #f3f4f6; border: 1px solid #e5e7eb; }
        .dashboard-chip-warning,
        .dashboard-shell .badge-navy { background: #ffffff !important; color: #111111 !important; border-color: #d1d5db !important; }
        .dashboard-shell .btn-warning { background: linear-gradient(135deg, #ffffff, #f8fafc); color: #111111; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06); }
        .quick-actions-carousel {
          position: relative;
        }
        .quick-actions-fade,
        .quick-actions-chevron {
          display: none;
        }

        @media (max-width: 900px) {
          .quick-actions-row {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .top-products-row {
            grid-template-columns: repeat(3, minmax(220px, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .hero-panel {
            padding: 16px !important;
          }

          .dashboard-hero-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .dashboard-period-controls {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 8px !important;
            width: 100%;
            min-width: 0;
          }

          .dashboard-period-controls .form-input {
            min-width: 0 !important;
            width: 100%;
            font-size: 12.5px;
            padding: 10px 12px;
          }

          .quick-actions-row {
            grid-template-columns: repeat(3, minmax(160px, 1fr)) !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
            padding-right: 56px;
            scrollbar-width: none;
          }

          .quick-actions-row::-webkit-scrollbar {
            display: none;
          }

          .quick-actions-fade,
          .quick-actions-chevron {
            display: flex;
            pointer-events: none;
            position: absolute;
            top: 0;
            bottom: 0;
            right: 0;
          }

          .quick-actions-fade {
            width: 48px;
            background: linear-gradient(90deg, rgba(248, 250, 252, 0), #f8fafc 88%);
          }

          .quick-actions-chevron {
            width: 28px;
            align-items: center;
            justify-content: center;
            color: #64748b;
          }

          .top-products-row {
            grid-template-columns: repeat(4, minmax(210px, 1fr)) !important;
          }
        }
      `}</style>
    </Layout>
  );
}

