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

function GlowLineChart({ points, stroke = '#2be6a0' }) {
  const width = 320;
  const height = 120;
  const safe = points.length ? points : [24, 30, 26, 34, 32, 40];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const normalize = (value, index) => {
    const x = (index / (safe.length - 1 || 1)) * (width - 12) + 6;
    const y = height - ((value - min) / (max - min || 1)) * (height - 18) - 8;
    return `${x},${y}`;
  };
  const polylinePoints = safe.map(normalize).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="dash-glow-chart" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`gradient-${stroke.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={`url(#gradient-${stroke.replace('#', '')})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const totalStockValue = stats?.stockValue ?? stats?.inventoryValue ?? 0;
  const todayProfit = stats?.todayProfit ?? stats?.grossProfitToday ?? profit;
  const profitSeries = [0.44, 0.56, 0.48, 0.64, 0.59, 0.68, 0.82].map((point) => Math.round(Math.max(todayProfit, 1) * point));
  const gstSeries = [0.36, 0.4, 0.46, 0.56, 0.52, 0.67, 0.72].map((point) => Math.round(Math.max(Math.abs(netGST), 1) * point));
  const ledgerRows = [
    { label: 'Today Profit', amount: todayProfit, tone: todayProfit >= 0 ? 'up' : 'down', ref: 'P&L / Live' },
    { label: 'Total Stock Value', amount: totalStockValue, tone: 'stock', ref: 'Inventory / Live' },
    { label: 'Net GST Position', amount: netGST, tone: netGST >= 0 ? 'gst' : 'up', ref: 'GST / Compliance' },
    { label: 'Receivable Credit', amount: totalCustomerUdhaar, tone: totalCustomerUdhaar > 0 ? 'down' : 'stock', ref: 'Ledger / Customers' },
  ];

  const statCards = [
    {
      label: 'बिक्री / Sales',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      color: '#0f172a',
      href: '/sales',
      icon: 'Sales',
    },
    {
      label: 'मुनाफ़ा / Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      note: revenue > 0 ? `Margin ${margin}%` : 'See reports',
      color: profit >= 0 ? '#16a34a' : '#dc2626',
      href: '/reports',
      icon: 'Profit',
    },
    {
      label: 'उधार / Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      note: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All settled',
      color: totalCustomerUdhaar > 0 ? '#dc2626' : '#0f172a',
      href: '/udhaar',
      icon: 'Credit',
    },
    {
      label: 'GST देय / Payable',
      value: `₹${fmt(Math.abs(netGST))}`,
      note: netGST >= 0 ? 'Tax to pay' : 'Refund side',
      color: netGST >= 0 ? '#d97706' : '#2563eb',
      href: '/gst',
      icon: 'GST',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: 'SL', hi: 'बिक्री', en: 'Sale', sub: 'Record sale', tone: 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(22,163,74,0.08))', color: '#15803d', semantic: 'sales' },
    { href: '/purchases', icon: 'PU', hi: 'खरीद', en: 'Purchase', sub: 'Record purchase', tone: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.08))', color: '#b45309', semantic: 'purchase' },
    { href: '/udhaar', icon: 'CR', hi: 'उधार', en: 'Credit', sub: 'Manage ledger', tone: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(220,38,38,0.08))', color: '#b91c1c', semantic: 'credit' },
    { href: '/product', icon: 'PR', hi: 'उत्पाद', en: 'Product', sub: 'Update stock', tone: 'linear-gradient(135deg, rgba(37,99,235,0.14), rgba(14,165,233,0.08))', color: '#1d4ed8', semantic: 'stock' },
    { href: '/gst', icon: 'TX', hi: 'GST', en: 'GST', sub: 'Tax summary', tone: 'linear-gradient(135deg, rgba(6,182,212,0.14), rgba(37,99,235,0.08))', color: '#0f766e', semantic: 'gst' },
    { href: '/pricing', icon: 'UP', hi: 'प्रीमियम', en: 'Go Pro', sub: 'Unlock premium', tone: 'linear-gradient(135deg, rgba(37,99,235,0.14), rgba(15,23,42,0.1))', color: '#0f172a', semantic: 'premium' },
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

        <section className="dashboard-kpi-strip">
          <article className="dashboard-kpi-card dashboard-kpi-profit">
            <div className="dashboard-kpi-meta">
              <span>Live Profit Tracking</span>
              <strong>Today Profit: ₹{fmt(todayProfit)}</strong>
            </div>
            <GlowLineChart points={profitSeries} stroke="#2be6a0" />
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-stock">
            <div className="dashboard-kpi-meta">
              <span>GST Compliance Status</span>
              <strong>{netGST >= 0 ? 'Payable' : 'Refund'}: ₹{fmt(Math.abs(netGST))}</strong>
            </div>
            <GlowLineChart points={gstSeries} stroke="#2ea8ff" />
          </article>
        </section>

        <section className="dashboard-speed-cards">
          <article className="dashboard-speed-card">
            <span>Total Stock Value</span>
            <strong>₹{fmt(totalStockValue)}</strong>
          </article>
          <article className="dashboard-speed-card dashboard-speed-profit">
            <span>Today's Profit</span>
            <strong>₹{fmt(todayProfit)}</strong>
          </article>
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
                { label: 'Revenue', value: stats?.totalRevenue, color: '#0f172a', prefix: '' },
                { label: 'Profit', value: profit, color: profit >= 0 ? '#16a34a' : '#dc2626', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: stats?.gstCollected, color: '#1d4ed8', prefix: '' },
                { label: 'ITC', value: stats?.gstITC, color: '#0f766e', prefix: '-' },
                { label: 'Net GST', value: netGST, color: netGST >= 0 ? '#d97706' : '#2563eb', prefix: '' },
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
                <strong style={{ color: '#0f172a' }}>{margin}%</strong>
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

        <section className="card dashboard-section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="section-title">Real-time Ledger</div>
              <div className="section-subtitle">Hover rows for details, tap cards on mobile.</div>
            </div>
            <StatusBadge tone="secondary">Live</StatusBadge>
          </div>
          <div className="ui-table-wrap dashboard-ledger-table-wrap hidden-xs">
            <table className="ui-table dashboard-ledger-table">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Reference</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr key={row.label} className={`ledger-row ledger-row-${row.tone}`}>
                    <td data-label="Entry">{row.label}</td>
                    <td data-label="Reference">{row.ref}</td>
                    <td data-label="Amount" style={{ textAlign: 'right', fontWeight: 800 }}>₹{fmt(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dashboard-ledger-cards show-xs">
            {ledgerRows.map((row) => (
              <article key={row.label} className={`dashboard-ledger-card ledger-row-${row.tone}`}>
                <span>{row.label}</span>
                <small>{row.ref}</small>
                <strong>₹{fmt(row.amount)}</strong>
              </article>
            ))}
          </div>
        </section>

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
                        'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        'linear-gradient(135deg, #0ea5e9, #2563eb)',
                        'linear-gradient(135deg, #22c55e, #15803d)',
                        'linear-gradient(135deg, #f59e0b, #d97706)',
                        'linear-gradient(135deg, #0f172a, #334155)',
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
          color: #e2e8f0;
        }

        .dashboard-hero,
        .dashboard-stat-card,
        .dashboard-section-card,
        .dashboard-breakdown-card,
        .dashboard-top-card,
        .dashboard-quick-card {
          border: 1px solid rgba(148, 163, 184, 0.26) !important;
          background: linear-gradient(135deg, rgba(7, 18, 32, 0.94), rgba(8, 26, 44, 0.9)) !important;
          box-shadow: 0 20px 50px rgba(2, 8, 23, 0.36) !important;
        }

        .dashboard-shell .page-title,
        .dashboard-shell .section-title {
          color: #f8fafc !important;
        }

        .dashboard-shell .section-subtitle,
        .dashboard-shell .metric-label,
        .dashboard-shell .metric-note,
        .dashboard-shell .page-subtitle {
          color: #94a3b8 !important;
        }

        .dashboard-period-shell .form-input {
          background: rgba(8, 17, 29, 0.86) !important;
          color: #f8fafc !important;
          border: 1px solid rgba(96, 165, 250, 0.3) !important;
          box-shadow: none;
        }

        .dashboard-stat-card .metric-value {
          color: #f8fafc !important;
          font-weight: 900;
        }

        .dashboard-stat-icon {
          background: linear-gradient(135deg, rgba(46, 168, 255, 0.2), rgba(43, 230, 160, 0.16)) !important;
          color: #93c5fd !important;
          border: 1px solid rgba(96, 165, 250, 0.28);
          box-shadow: 0 10px 24px rgba(2, 8, 23, 0.28) !important;
        }

        .dashboard-kpi-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .dashboard-kpi-card {
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(8, 20, 35, 0.95), rgba(11, 30, 49, 0.92));
          box-shadow: 0 18px 40px rgba(2, 8, 23, 0.34);
          padding: 14px;
        }

        .dashboard-kpi-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .dashboard-kpi-meta span {
          color: #94a3b8;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .dashboard-kpi-profit strong {
          color: #2be6a0;
          font-size: 14px;
        }

        .dashboard-kpi-stock strong {
          color: #2ea8ff;
          font-size: 14px;
        }

        .dash-glow-chart {
          width: 100%;
          height: 90px;
          filter: drop-shadow(0 0 8px rgba(46, 168, 255, 0.38));
        }

        .dashboard-speed-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .dashboard-speed-card {
          border: 1px solid rgba(148, 163, 184, 0.26);
          border-radius: 8px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(7, 18, 31, 0.96), rgba(10, 27, 44, 0.92));
          display: grid;
          gap: 6px;
        }

        .dashboard-speed-card span {
          font-size: 10px;
          color: #93c5fd;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .dashboard-speed-card strong {
          font-size: 25px;
          letter-spacing: -0.04em;
          color: #f8fafc;
        }

        .dashboard-speed-card.dashboard-speed-profit strong {
          color: #2be6a0;
        }

        .dashboard-ledger-table-wrap {
          border-color: rgba(148, 163, 184, 0.24);
          border-radius: 8px;
        }

        .dashboard-ledger-table th {
          color: #93c5fd !important;
          background: rgba(5, 14, 25, 0.95) !important;
        }

        .dashboard-ledger-table tbody tr:nth-child(even) td {
          background: rgba(10, 24, 39, 0.74) !important;
        }

        .dashboard-ledger-table tbody tr:hover td {
          background: rgba(46, 168, 255, 0.14) !important;
          transform: translateY(-1px);
        }

        .ledger-row-up td:last-child {
          color: #2be6a0 !important;
        }

        .ledger-row-stock td:last-child,
        .ledger-row-gst td:last-child {
          color: #2ea8ff !important;
        }

        .ledger-row-down td:last-child {
          color: #f87171 !important;
        }

        .dashboard-ledger-cards {
          display: none;
          flex-direction: column;
          gap: 8px;
        }

        .dashboard-ledger-card {
          border: 1px solid rgba(148, 163, 184, 0.26);
          border-radius: 8px;
          padding: 10px 12px;
          background: linear-gradient(180deg, rgba(6, 17, 30, 0.95), rgba(11, 28, 46, 0.9));
          display: grid;
          gap: 4px;
        }

        .dashboard-ledger-card span {
          font-size: 13px;
          color: #f8fafc;
          font-weight: 700;
        }

        .dashboard-ledger-card small {
          color: #94a3b8;
          font-size: 11px;
        }

        .dashboard-ledger-card strong {
          font-size: 18px;
          letter-spacing: -0.03em;
          color: #2ea8ff;
        }

        .dashboard-ledger-card.ledger-row-up strong {
          color: #2be6a0;
        }

        .dashboard-ledger-card.ledger-row-down strong {
          color: #f87171;
        }

        .dashboard-shell div[style*='color: #475569'],
        .dashboard-shell div[style*='color: #64748b'],
        .dashboard-shell div[style*='color: #0f172a'],
        .dashboard-shell div[style*='color: #e5e7eb'] {
          color: #cbd5e1 !important;
        }

        .dashboard-quick-icon {
          box-shadow: 0 10px 26px rgba(2, 8, 23, 0.35);
        }

        .dashboard-progress-track {
          background: rgba(15, 23, 42, 0.62);
          border: 1px solid rgba(148, 163, 184, 0.24);
        }

        .dashboard-warning-card {
          background: linear-gradient(180deg, rgba(44, 26, 7, 0.92), rgba(27, 18, 9, 0.88)) !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
        }

        .dashboard-chip-warning {
          background: rgba(15, 23, 42, 0.86) !important;
          color: #fbbf24 !important;
          border: 1px solid rgba(251, 191, 36, 0.3) !important;
        }

        .top-products-row,
        .quick-actions-row {
          overflow-x: auto;
        }

        .show-xs {
          display: none !important;
        }

        .hidden-xs {
          display: block !important;
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

          .dashboard-kpi-strip,
          .dashboard-speed-cards {
            grid-template-columns: 1fr;
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

          .hidden-xs {
            display: none !important;
          }

          .show-xs {
            display: flex !important;
          }

          .dashboard-ledger-cards {
            display: flex;
          }
        }
      `}</style>
    </Layout>
  );
}
