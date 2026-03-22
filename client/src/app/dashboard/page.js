'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_CACHE_PREFIX = 'dashboard-summary-v2';

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

const readDashboardCache = (month, year) => {
  try {
    const raw = localStorage.getItem(getCacheKey(month, year));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeDashboardCache = (month, year, value) => {
  try {
    localStorage.setItem(
      getCacheKey(month, year),
      JSON.stringify({
        ...value,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch {}
};

const scheduleIdle = (callback) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 1200 });
  }
  return window.setTimeout(callback, 150);
};

const cancelIdle = (id) => {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
    return;
  }
  clearTimeout(id);
};

const DashboardSkeleton = () => (
  <div className="page-shell">
    <section className="hero-panel" style={{ minHeight: 220 }}>
      <div className="skeleton" style={{ height: 18, width: 140, marginBottom: 18 }} />
      <div className="skeleton" style={{ height: 42, width: 'min(360px, 88%)', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: 'min(420px, 92%)', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: 'min(320px, 82%)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 260, marginTop: 18 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 44 }} />
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
      <div className="quick-actions-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: 92, borderRadius: 18 }} />
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
      setLoading(false);
      setCacheLoaded(true);
    } else {
      setLoading(true);
      setCacheLoaded(false);
    }

    const controller = new AbortController();
    const idleId = scheduleIdle(async () => {
      try {
        setRefreshing(Boolean(cached));
        const params = `?month=${selectedMonth}&year=${selectedYear}`;
        const res = await fetch(`${API}/api/dashboard/summary${params}`, {
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
      cancelIdle(idleId);
    };
  }, [router, selectedMonth, selectedYear]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

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
      label: 'बिक्री / Sales',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      color: '#10b981',
      accent: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(110,231,183,0.04))',
      href: '/sales',
      icon: 'Sales',
    },
    {
      label: 'मुनाफ़ा / Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      color: profit >= 0 ? '#2563eb' : '#dc2626',
      accent: profit >= 0
        ? 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(59,130,246,0.06))'
        : 'linear-gradient(135deg, rgba(220,38,38,0.14), rgba(248,113,113,0.05))',
      href: '/reports',
      icon: 'Profit',
    },
    {
      label: 'उधार / Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      color: totalCustomerUdhaar > 0 ? '#dc2626' : '#10b981',
      accent: totalCustomerUdhaar > 0
        ? 'linear-gradient(135deg, rgba(220,38,38,0.14), rgba(248,113,113,0.05))'
        : 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(110,231,183,0.06))',
      href: '/udhaar',
      icon: 'Credit',
    },
    {
      label: 'GST देय / Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      color: netGST >= 0 ? '#f59e0b' : '#10b981',
      accent: netGST >= 0
        ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(251,191,36,0.06))'
        : 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(110,231,183,0.06))',
      href: '/gst',
      icon: 'GST',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'SL', hi: 'बिक्री', en: 'Sale', sub: 'Record sale', tone: 'rgba(16,185,129,0.12)', color: '#059669' },
    { href: '/purchases', icon: 'PU', hi: 'खरीद', en: 'Purchase', sub: 'Record purchase', tone: 'rgba(245,158,11,0.12)', color: '#d97706' },
    { href: '/udhaar', icon: 'CR', hi: 'उधार', en: 'Credit', sub: 'Manage ledger', tone: 'rgba(220,38,38,0.1)', color: '#dc2626' },
    { href: '/product', icon: 'PR', hi: 'उत्पाद', en: 'Product', sub: 'Update stock', tone: 'rgba(79,70,229,0.12)', color: '#4f46e5' },
    { href: '/gst', icon: 'TX', hi: 'GST', en: 'GST', sub: 'Tax summary', tone: 'rgba(14,165,233,0.12)', color: '#2563eb' },
    { href: '/pricing', icon: 'UP', hi: 'प्लान', en: 'Pricing', sub: 'Upgrade plans', tone: 'rgba(168,85,247,0.12)', color: '#7c3aed' },
  ];

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div className="dashboard-hero-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ maxWidth: 680, flex: 1, minWidth: 0 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>Business overview</div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>डैशबोर्ड / Dashboard</div>
              <div style={{ marginTop: 10, color: 'rgba(226,232,240,0.72)', fontSize: 13.5, maxWidth: 420, lineHeight: 1.55 }}>
                Revenue, profit, credit and GST at one glance for the active month.
              </div>
              {refreshing && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'rgba(226,232,240,0.62)' }}>
                  Refreshing latest data...
                </div>
              )}
            </div>

            <div className="dashboard-period-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 236 }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="form-input"
                style={{
                  minWidth: 0,
                  height: 44,
                  background: 'rgba(255,255,255,0.92)',
                  borderColor: 'rgba(255,255,255,0.28)',
                  boxShadow: '0 12px 24px rgba(13,19,43,0.12)',
                }}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="form-input"
                style={{
                  minWidth: 0,
                  height: 44,
                  background: 'rgba(255,255,255,0.92)',
                  borderColor: 'rgba(255,255,255,0.28)',
                  boxShadow: '0 12px 24px rgba(13,19,43,0.12)',
                }}
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="metric-grid">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="metric-card"
              onClick={() => router.push(card.href)}
              style={{ background: `${card.accent}, linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.92))` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="metric-label">{card.label}</div>
                  <div className="metric-value" style={{ color: card.color, marginTop: 8 }}>{card.value}</div>
                </div>
                <div
                  style={{
                    minWidth: 56,
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.76)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#334155',
                    boxShadow: '0 12px 24px rgba(15,23,42,0.05)',
                  }}
                >
                  {card.icon}
                </div>
              </div>
              <div className="metric-note">{card.note}</div>
            </div>
          ))}
        </section>

        {revenue > 0 && (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div className="section-title">मुनाफ़ा विवरण / Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <div className="badge badge-blue">Margin {margin}%</div>
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
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: 'rgba(248,250,252,0.72)',
                    border: '1px solid rgba(226,232,240,0.84)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 24, color: item.color, fontWeight: 800, letterSpacing: '-0.05em', marginTop: 8 }}>
                    {item.prefix}₹{fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                <span>Profit Margin</span>
                <strong style={{ color: profit >= 0 ? '#2563eb' : '#dc2626' }}>{margin}%</strong>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.abs((profit / (revenue || 1)) * 100))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: profit >= 0 ? 'linear-gradient(90deg, #2563eb, #38bdf8)' : 'linear-gradient(90deg, #dc2626, #fb7185)',
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {lowStockCount > 0 && (
          <section
            className="card"
            onClick={() => router.push('/product')}
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(180deg, rgba(255,251,235,0.96), rgba(255,247,237,0.92))',
              borderColor: 'rgba(245,158,11,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="section-title" style={{ color: '#92400e' }}>कम स्टॉक / Low Stock</div>
                <div className="section-subtitle" style={{ color: '#a16207' }}>
                  {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} close to stockout
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <span
                      key={product._id}
                      className="badge"
                      style={{
                        background: '#fff',
                        color: '#92400e',
                        border: '1px solid rgba(245,158,11,0.22)',
                        padding: '7px 11px',
                      }}
                    >
                      {product.name} ({product.quantity ?? 0})
                    </span>
                  ))}
                  {lowStockCount > 5 && <span className="badge badge-yellow">+{lowStockCount - 5} more</span>}
                </div>
              </div>
              <div className="btn-warning" style={{ width: 'auto' }}>Open Products</div>
            </div>
          </section>
        )}

        <section className="card" style={{ paddingBottom: 18 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div className="section-title">त्वरित कार्य / Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <div className="badge badge-navy">{quickActions.length} shortcuts</div>
          </div>
          <div className="quick-actions-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            {quickActions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                style={{
                  textDecoration: 'none',
                  borderRadius: 18,
                  padding: '12px 12px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,255,0.94))',
                  color: '#0f172a',
                  boxShadow: '0 14px 28px rgba(15,23,42,0.06)',
                  minHeight: 86,
                  border: '1px solid rgba(255,255,255,0.78)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{action.hi} / {action.en}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.45 }}>{action.sub}</div>
                  </div>
                  <div style={{ minWidth: 34, height: 34, borderRadius: 12, background: action.tone, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0 }}>{action.icon}</div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="card">
          <div style={{ marginBottom: 16 }}>
            <div className="section-title">टॉप उत्पाद / Top Products</div>
            <div className="section-subtitle">{MONTHS[selectedMonth - 1]} {selectedYear} best performers</div>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div>No top products yet for this period.</div>
            </div>
          ) : (
            <div className="top-products-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 14,
                    borderRadius: 18,
                    background: 'rgba(248,250,252,0.72)',
                    border: '1px solid rgba(226,232,240,0.84)',
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
                    <div style={{ fontSize: 12, color: '#64748b' }}>{product.qty} units sold</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', flexShrink: 0 }}>₹{fmt(product.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .top-products-row,
        .quick-actions-row {
          overflow-x: auto;
        }

        @media (max-width: 900px) {
          .quick-actions-row {
            grid-template-columns: repeat(3, minmax(180px, 1fr)) !important;
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
          }

          .top-products-row {
            grid-template-columns: repeat(4, minmax(210px, 1fr)) !important;
          }
        }
      `}</style>
    </Layout>
  );
}
