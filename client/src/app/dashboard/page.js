'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardPage() {
  const router = useRouter();
  const now    = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [customers,   setCustomers]   = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [selectedMonth, selectedYear]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const params  = `?month=${selectedMonth}&year=${selectedYear}`;
      const [profitRes, productsRes, customersRes, salesRes] = await Promise.all([
        fetch(`${API}/api/sales/profit-summary${params}`, { headers }),
        fetch(`${API}/api/products`, { headers }),
        fetch(`${API}/api/customers`, { headers }),
        fetch(`${API}/api/sales${params}`, { headers }),
      ]);
      const profitData    = await profitRes.json();
      const productsData  = await productsRes.json();
      const customersData = await customersRes.json();
      const salesData     = await salesRes.json();
      setStats(profitData);
      const productList = Array.isArray(productsData) ? productsData : productsData.products || [];
      setProducts(productList);
      const customerList = Array.isArray(customersData) ? customersData : [];
      setCustomers(customerList);
      const salesList = salesData.sales || salesData || [];
      const productSalesMap = {};
      salesList.forEach(sale => {
        const items = sale.items?.length > 0 ? sale.items : [{ product_name: sale.product_name, quantity: sale.quantity, total_amount: sale.total_amount }];
        items.forEach(item => {
          const key = item.product_name;
          if (!key) return;
          if (!productSalesMap[key]) productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
          productSalesMap[key].qty     += item.quantity     || 0;
          productSalesMap[key].revenue += item.total_amount || 0;
        });
      });
      setTopProducts(Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const lowStock            = products.filter(p => (p.quantity ?? p.stock ?? 0) <= 5);
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: '#94A3B8', fontSize: 14, fontWeight: 500 }}>लोड हो रहा है...</div>
      </div>
    </Layout>
  );

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;

  return (
    <Layout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        .stat-card-hover { transition: all 0.2s; cursor: pointer; }
        .stat-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important; }
        .quick-action-card { transition: all 0.2s; text-decoration: none; }
        .quick-action-card:hover { transform: translateY(-3px) !important; filter: brightness(1.05); }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .breakdown-grid { flex-direction: column !important; }
          .quick-grid { grid-template-columns: 1fr 1fr 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 2 }}>
            डैशबोर्ड 👋
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 400 }}>
            {MONTHS[selectedMonth - 1]} {selectedYear} का overview
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          {
            label: '💰 बिक्री / Sales', value: `₹${fmt(stats?.totalRevenue)}`,
            sub: `${stats?.salesCount || 0} invoices`, color: '#059669',
            bg: 'linear-gradient(135deg, #059669, #047857)', href: '/sales',
          },
          {
            label: '📊 मुनाफ़ा / Profit',
            value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
            sub: (stats?.totalRevenue || 0) > 0 ? `Margin: ${((profit / (stats?.totalRevenue || 1)) * 100).toFixed(1)}%` : 'रिपोर्ट देखें',
            color: profit >= 0 ? '#6366F1' : '#EF4444',
            bg: profit >= 0 ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'linear-gradient(135deg, #EF4444, #DC2626)',
            href: '/reports',
          },
          {
            label: '📒 उधार / Credit', value: `₹${fmt(totalCustomerUdhaar)}`,
            sub: totalCustomerUdhaar > 0 ? 'वसूलना बाकी है' : 'सब चुकता ✓',
            color: totalCustomerUdhaar > 0 ? '#EF4444' : '#059669',
            bg: totalCustomerUdhaar > 0 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #059669, #047857)',
            href: '/udhaar',
          },
          {
            label: '🧾 GST देय', value: `₹${fmt(Math.abs(netGST))}`,
            sub: netGST >= 0 ? '▲ देना है' : '▼ वापसी',
            color: netGST >= 0 ? '#F59E0B' : '#059669',
            bg: netGST >= 0 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #059669, #047857)',
            href: '/gst',
          },
        ].map((card, i) => (
          <div key={i} className="stat-card-hover" onClick={() => router.push(card.href)}
            style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', position: 'relative', animation: `fadeUp 0.4s ease ${i * 0.06}s both` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.bg }} />
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: card.color, opacity: 0.05 }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 800, color: card.color, letterSpacing: -1, lineHeight: 1, marginBottom: 6 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{card.sub} →</div>
          </div>
        ))}
      </div>

      {/* Profit Breakdown */}
      {(stats?.totalRevenue || 0) > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.25s both' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📊</span> मुनाफ़ा विवरण / Profit Breakdown
            <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
          </div>
          <div className="breakdown-grid" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'Revenue',      value: stats?.totalRevenue,  color: '#059669' },
              { label: 'मुनाफ़ा',       value: profit,               color: profit >= 0 ? '#6366F1' : '#EF4444', prefix: profit >= 0 ? '+' : '' },
              { label: 'GST Collected', value: stats?.gstCollected, color: '#F59E0B' },
              { label: 'ITC Input',    value: stats?.gstITC,        color: '#8B5CF6', prefix: '−' },
              { label: 'Net GST',      value: netGST,               color: netGST >= 0 ? '#F59E0B' : '#059669' },
            ].map((item, i) => (
              <div key={i} style={{ minWidth: 110 }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 800, color: item.color }}>{item.prefix || ''}₹{fmt(item.value)}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
              <span>Profit Margin</span>
              <span style={{ fontWeight: 700, color: profit >= 0 ? '#6366F1' : '#EF4444' }}>
                {((profit / (stats?.totalRevenue || 1)) * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.abs((profit / (stats?.totalRevenue || 1)) * 100))}%`, background: profit >= 0 ? 'linear-gradient(90deg, #6366F1, #8B5CF6)' : '#EF4444', borderRadius: 99, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div onClick={() => router.push('/product')} style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '14px 18px', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', animation: 'fadeUp 0.4s ease 0.3s both', transition: 'transform 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 6 }}>कम स्टॉक — {lowStock.length} items</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lowStock.slice(0, 4).map(p => (
                  <span key={p._id} style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#92400E' }}>
                    {p.name} ({p.quantity ?? 0})
                  </span>
                ))}
                {lowStock.length > 4 && <span style={{ background: '#FCD34D', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: '#92400E' }}>+{lowStock.length - 4} more</span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', whiteSpace: 'nowrap' }}>स्टॉक बढ़ाएं →</div>
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.35s both' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏆</span> Top Products — {MONTHS[selectedMonth - 1]} {selectedYear}
            <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topProducts.map((p, i) => {
              const colors = ['#059669', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];
              const maxRevenue = topProducts[0].revenue;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: colors[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{p.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors[i] }}>₹{fmt(p.revenue)}</span>
                    </div>
                    <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(p.revenue / maxRevenue) * 100}%`, background: colors[i], borderRadius: 99, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{p.qty} units sold</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ animation: 'fadeUp 0.4s ease 0.4s both' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚡ Quick Actions <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
        </div>
        <div className="quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { href: '/sales',     bg: 'linear-gradient(135deg, #059669, #047857)', shadow: 'rgba(5,150,105,0.3)',   icon: '📈', hi: 'बिक्री',  en: 'Sale',     sub: 'Record sale'     },
            { href: '/purchases', bg: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: 'rgba(245,158,11,0.3)',  icon: '🛒', hi: 'खरीद',   en: 'Purchase', sub: 'Record purchase' },
            { href: '/udhaar',    bg: 'linear-gradient(135deg, #EF4444, #DC2626)', shadow: 'rgba(239,68,68,0.3)',   icon: '📒', hi: 'उधार',   en: 'Credit',   sub: 'Manage udhaar'   },
            { href: '/product',   bg: 'linear-gradient(135deg, #6366F1, #4F46E5)', shadow: 'rgba(99,102,241,0.3)', icon: '📦', hi: 'उत्पाद', en: 'Product',  sub: 'Add product'     },
            { href: '/gst',       bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', shadow: 'rgba(139,92,246,0.3)', icon: '🧾', hi: 'GST',    en: 'GST',      sub: 'Tax summary'     },
          ].map(({ href, bg, shadow, icon, hi, en, sub }) => (
            <a key={href} href={href} className="quick-action-card"
              style={{ background: bg, color: '#fff', padding: '16px', borderRadius: 14, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: `0 4px 14px ${shadow}` }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{hi}<br />{en}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{sub}</div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}