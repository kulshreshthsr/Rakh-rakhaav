'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const params = `?month=${selectedMonth}&year=${selectedYear}`;

      const [profitRes, productsRes, customersRes, salesRes] = await Promise.all([
        fetch(`${API}/api/sales/profit-summary${params}`, { headers }),
        fetch(`${API}/api/products`, { headers }),
        fetch(`${API}/api/customers`, { headers }),
        fetch(`${API}/api/sales${params}`, { headers }),
      ]);

      const profitData = await profitRes.json();
      const productsData = await productsRes.json();
      const customersData = await customersRes.json();
      const salesData = await salesRes.json();

      setStats(profitData);

      const productList = Array.isArray(productsData) ? productsData : productsData.products || [];
      setProducts(productList);

      const customerList = Array.isArray(customersData) ? customersData : [];
      setCustomers(customerList);

      const salesList = salesData.sales || salesData || [];
      const productSalesMap = {};

      salesList.forEach((sale) => {
        const items = sale.items?.length > 0
          ? sale.items
          : [{
              product_name: sale.product_name,
              quantity: sale.quantity,
              total_amount: sale.total_amount,
            }];

        items.forEach((item) => {
          const key = item.product_name;
          if (!key) return;
          if (!productSalesMap[key]) productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
          productSalesMap[key].qty += item.quantity || 0;
          productSalesMap[key].revenue += item.total_amount || 0;
        });
      });

      const sorted = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
      setTopProducts(sorted.slice(0, 5));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    const timeoutId = setTimeout(() => {
      fetchAll();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [router, selectedMonth, selectedYear]);

  const lowStock = products.filter((p) => (p.quantity ?? p.stock ?? 0) <= 5);
  const totalCustomerUdhaar = customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0);
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

  if (loading) {
    return (
      <Layout>
        <div className="page-shell">
          <div className="hero-panel" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)' }}>लोड हो रहा है...</div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;
  const revenue = stats?.totalRevenue || 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';

  const statCards = [
    {
      label: 'बिक्री / Sales',
      value: `₹${fmt(stats?.totalRevenue)}`,
      note: `${stats?.salesCount || 0} invoices this month`,
      color: '#10b981',
      accent: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(110,231,183,0.06))',
      href: '/sales',
      icon: '📈',
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
      icon: '📊',
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
      icon: '📒',
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
      icon: '🧾',
    },
  ];

  const quickActions = [
    { href: '/sales', icon: '📈', hi: 'बिक्री', en: 'Sale', sub: 'Record sale', bg: 'linear-gradient(135deg, #10b981, #059669)' },
    { href: '/purchases', icon: '🛒', hi: 'खरीद', en: 'Purchase', sub: 'Record purchase', bg: 'linear-gradient(135deg, #f59e0b, #f97316)' },
    { href: '/udhaar', icon: '📒', hi: 'उधार', en: 'Credit', sub: 'Manage ledger', bg: 'linear-gradient(135deg, #ef4444, #dc2626)' },
    { href: '/product', icon: '📦', hi: 'उत्पाद', en: 'Product', sub: 'Update stock', bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)' },
    { href: '/gst', icon: '🧾', hi: 'GST', en: 'GST', sub: 'Tax summary', bg: 'linear-gradient(135deg, #7c3aed, #2563eb)' },
  ];

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: 680 }}>
              <div className="page-title" style={{ color: '#fff', marginBottom: 8 }}>डैशबोर्ड / Dashboard</div>
            </div>

            <div className="toolbar-card" style={{ minWidth: 216, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.54)', marginBottom: 10 }}>
                Active Period
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="form-input"
                  style={{ background: 'rgba(255,255,255,0.9) !important' }}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="form-input"
                  style={{ background: 'rgba(255,255,255,0.9) !important' }}
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
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
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    boxShadow: '0 12px 24px rgba(15,23,42,0.06)',
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

        {lowStock.length > 0 && (
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
                  {lowStock.length} item{lowStock.length > 1 ? 's are' : ' is'} close to stockout
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {lowStock.slice(0, 5).map((product) => (
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
                  {lowStock.length > 5 && <span className="badge badge-yellow">+{lowStock.length - 5} more</span>}
                </div>
              </div>
              <div className="btn-warning" style={{ width: 'auto' }}>Open Products</div>
            </div>
          </section>
        )}

        <section className="dashboard-two-col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18 }}>
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">🏆 टॉप उत्पाद / Top Products</div>
              <div className="section-subtitle">{MONTHS[selectedMonth - 1]} {selectedYear} best performers</div>
            </div>
            {topProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div>No top products yet for this period.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topProducts.map((product, index) => (
                  <div
                    key={product.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 18,
                      background: 'rgba(248,250,252,0.72)',
                      border: '1px solid rgba(226,232,240,0.84)',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        background: [
                          'linear-gradient(135deg, #10b981, #34d399)',
                          'linear-gradient(135deg, #2563eb, #38bdf8)',
                          'linear-gradient(135deg, #f59e0b, #fbbf24)',
                          'linear-gradient(135deg, #ef4444, #fb7185)',
                          'linear-gradient(135deg, #7c3aed, #60a5fa)',
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{product.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{product.qty} units sold</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>₹{fmt(product.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">त्वरित कार्य / Quick Actions</div>
              <div className="section-subtitle">Fast access to your most-used screens</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {quickActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  style={{
                    textDecoration: 'none',
                    borderRadius: 20,
                    padding: '16px 16px',
                    background: action.bg,
                    color: '#fff',
                    boxShadow: '0 18px 34px rgba(15,23,42,0.12)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{action.hi} / {action.en}</div>
                      <div style={{ fontSize: 11.5, opacity: 0.82, marginTop: 3 }}>{action.sub}</div>
                    </div>
                    <div style={{ fontSize: 24 }}>{action.icon}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dashboard-two-col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}
