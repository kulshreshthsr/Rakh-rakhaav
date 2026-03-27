'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { StatCard, StatusBadge } from '../../components/ui/AppUI';

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
      color: '#e5e7eb',
      href: '/sales',
      icon: 'Sales',
    },
    {
      label: 'मुनाफ़ा / Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      color: '#e5e7eb',
      href: '/reports',
      icon: 'Profit',
    },
    {
      label: 'उधार / Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      color: '#e5e7eb',
      href: '/udhaar',
      icon: 'Credit',
    },
    {
      label: 'GST देय / Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      color: '#e5e7eb',
      href: '/gst',
      icon: 'GST',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'SL', hi: 'बिक्री', en: 'Sale', sub: 'Record sale', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'sales' },
    { href: '/purchases', icon: 'PU', hi: 'खरीद', en: 'Purchase', sub: 'Record purchase', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'purchase' },
    { href: '/udhaar', icon: 'CR', hi: 'उधार', en: 'Credit', sub: 'Manage ledger', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'credit' },
    { href: '/product', icon: 'PR', hi: 'उत्पाद', en: 'Product', sub: 'Update stock', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'stock' },
    { href: '/gst', icon: 'TX', hi: 'GST', en: 'GST', sub: 'Tax summary', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'gst' },
    { href: '/pricing', icon: 'UP', hi: 'प्रीमियम', en: 'Go Pro', sub: 'Unlock premium', tone: 'rgba(255,255,255,0.08)', color: '#e5e7eb', semantic: 'premium' },
  ];

  return (
    <Layout>
      <div className="page-shell dashboard-shell">
        <section className="hero-panel dashboard-hero">
          <div className="dashboard-hero-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ maxWidth: 680, flex: 1, minWidth: 0 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>Business overview</div>
              <div className="page-title" style={{ color: '#0f172a', marginBottom: 0 }}>डैशबोर्ड / Dashboard</div>
              <div style={{ marginTop: 10, color: '#475569', fontSize: 13.5, maxWidth: 420, lineHeight: 1.55 }}>
                Revenue, profit, credit and GST at one glance for the active month.
              </div>
              {refreshing && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: '#64748b' }}>
                  Refreshing latest data...
                </div>
              )}
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

        <section className="metric-grid">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              className="dashboard-stat-card"
              tone="secondary"
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
                <div className="section-title">मुनाफ़ा विवरण / Profit Breakdown</div>
                <div className="section-subtitle">Revenue, profit and GST health in one snapshot</div>
              </div>
              <StatusBadge tone="secondary">Margin {margin}%</StatusBadge>
            </div>

            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {[
                { label: 'Revenue', value: stats?.totalRevenue, color: '#e5e7eb', prefix: '' },
                { label: 'Profit', value: profit, color: '#e5e7eb', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: stats?.gstCollected, color: '#e5e7eb', prefix: '' },
                { label: 'ITC', value: stats?.gstITC, color: '#e5e7eb', prefix: '-' },
                { label: 'Net GST', value: netGST, color: '#e5e7eb', prefix: '' },
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
                <strong style={{ color: '#e5e7eb' }}>{margin}%</strong>
              </div>
              <div className="dashboard-progress-track" style={{ height: 10, borderRadius: 999, overflow: 'hidden' }}>
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.abs((profit / (revenue || 1)) * 100))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #475569, #cbd5e1)',
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
                <div className="section-title">कम स्टॉक / Low Stock</div>
                <div className="section-subtitle">
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
              <div className="section-title">त्वरित कार्य / Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <StatusBadge tone="neutral">{quickActions.length} shortcuts</StatusBadge>
          </div>
          <div className="quick-actions-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            {quickActions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className={`dashboard-quick-card dashboard-quick-card-${action.semantic}`}
                style={{
                  textDecoration: 'none',
                  borderRadius: 18,
                  padding: '12px 12px',
                  minHeight: 86,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3, color: '#0f172a' }}>{action.hi} / {action.en}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>{action.sub}</div>
                  </div>
                  <div className="dashboard-quick-icon" style={{ minWidth: 34, height: 34, borderRadius: 12, background: action.tone, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0 }}>{action.icon}</div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="card dashboard-section-card">
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
                        'linear-gradient(135deg, #475569, #1f2937)',
                        'linear-gradient(135deg, #475569, #1f2937)',
                        'linear-gradient(135deg, #475569, #1f2937)',
                        'linear-gradient(135deg, #475569, #1f2937)',
                        'linear-gradient(135deg, #475569, #1f2937)',
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
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#e5e7eb', flexShrink: 0 }}>₹{fmt(product.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .dashboard-shell {
          color: #e5e7eb;
        }

        .dashboard-hero {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at 85% 16%, rgba(255, 255, 255, 0.06), transparent 20%),
            radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.05), transparent 22%),
            radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.04), transparent 22%),
            linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(17,24,39,0.92) 48%, rgba(15,23,42,0.98) 100%);
          box-shadow: 0 28px 60px rgba(2, 6, 23, 0.32);
        }

        .dashboard-shell .page-title {
          color: #f8fafc !important;
          text-shadow: none;
          font-weight: 900;
          letter-spacing: -0.06em;
        }

        .dashboard-shell .section-title {
          color: #f3f4f6;
        }

        .dashboard-shell .section-subtitle,
        .dashboard-shell .metric-label,
        .dashboard-shell .metric-note,
        .dashboard-shell .page-subtitle {
          color: #9ca3af !important;
        }

        .dashboard-period-shell .form-input {
          background: rgba(15, 23, 42, 0.76) !important;
          color: #e5e7eb !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 28px rgba(2,6,23,0.24);
        }

        .dashboard-stat-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%), rgba(17,24,39,0.82) !important;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.28);
        }

        .dashboard-stat-card::before {
          background:
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.05), transparent 24%),
            radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.04), transparent 22%);
        }

        .dashboard-stat-card .metric-label,
        .dashboard-stat-card .metric-note {
          color: #94a3b8 !important;
        }

        .dashboard-stat-card .metric-value {
          color: #f8fafc !important;
          font-weight: 900;
        }

        .dashboard-stat-icon {
          background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)) !important;
          color: #f8fafc !important;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(2,6,23,0.24) !important;
        }

        .dashboard-section-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%), rgba(17,24,39,0.82) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 20px 46px rgba(2, 6, 23, 0.28) !important;
        }

        .dashboard-breakdown-card,
        .dashboard-top-card,
        .dashboard-quick-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025)) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 34px rgba(2,6,23,0.24);
        }

        .dashboard-quick-card:hover,
        .dashboard-top-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 20px 40px rgba(2,6,23,0.3);
        }

        .dashboard-quick-card-sales {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card-purchase {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card-credit {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card-stock {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card-gst {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card-premium {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .dashboard-quick-card,
        .dashboard-top-card {
          color: #e5e7eb !important;
        }

        .dashboard-shell div[style*='color: #0f172a'] {
          color: #f8fafc !important;
        }

        .dashboard-shell div[style*='color: #475569'],
        .dashboard-shell div[style*='color: #64748b'] {
          color: #94a3b8 !important;
        }

        .dashboard-quick-icon {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 24px rgba(2,6,23,0.28);
        }

        .dashboard-progress-track {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .dashboard-warning-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }

        .dashboard-warning-card .section-title {
          color: #f3f4f6 !important;
        }

        .dashboard-warning-card .section-subtitle {
          color: #9ca3af !important;
        }

        .dashboard-chip-warning {
          background: rgba(255, 255, 255, 0.05) !important;
          color: #cbd5e1 !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        .dashboard-shell .badge-navy {
          background: rgba(255,255,255,0.05);
          color: #cbd5e1;
          border-color: rgba(255,255,255,0.08);
        }

        .dashboard-shell .btn-warning {
          background: linear-gradient(135deg, #475569, #1f2937);
          color: #ffffff;
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
        }

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
