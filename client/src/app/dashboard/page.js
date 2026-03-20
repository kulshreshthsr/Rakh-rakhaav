'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
        fetch(`${API}/api/products`,                      { headers }),
        fetch(`${API}/api/customers`,                     { headers }),
        fetch(`${API}/api/sales${params}`,                { headers }),
      ]);

      const profitData    = await profitRes.json();
      const productsData  = await productsRes.json();
      const customersData = await customersRes.json();
      const salesData     = await salesRes.json();

      setStats(profitData);

      const productList  = Array.isArray(productsData) ? productsData : productsData.products || [];
      setProducts(productList);

      const customerList = Array.isArray(customersData) ? customersData : [];
      setCustomers(customerList);

      const salesList       = salesData.sales || salesData || [];
      const productSalesMap = {};
      salesList.forEach(sale => {
        const items = sale.items?.length > 0 ? sale.items : [{
          product_name: sale.product_name,
          quantity:     sale.quantity,
          total_amount: sale.total_amount,
        }];
        items.forEach(item => {
          const key = item.product_name;
          if (!key) return;
          if (!productSalesMap[key]) productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
          productSalesMap[key].qty     += item.quantity     || 0;
          productSalesMap[key].revenue += item.total_amount || 0;
        });
      });
      const sorted = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
      setTopProducts(sorted.slice(0, 5));

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  };

  const lowStock            = products.filter(p => (p.quantity ?? p.stock ?? 0) <= 5);
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#4F46E5', animation: 'spin 0.7s linear infinite', marginBottom: 16 }} />
        <div style={{ color: 'var(--text-4)', fontSize: 14, fontWeight: 500 }}>लोड हो रहा है...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  );

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;

  return (
    <Layout>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">डैशबोर्ड</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 2 }}>{MONTHS[selectedMonth - 1]} {selectedYear} overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface)', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── 4 MAIN STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>

        {/* Sales */}
        <div onClick={() => router.push('/sales')} style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #059669, #10B981)', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-4)', marginBottom: 8 }}>💰 बिक्री / Sales</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', letterSpacing: -1.5, lineHeight: 1 }}>₹{fmt(stats?.totalRevenue)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ background: 'var(--emerald-dim)', color: 'var(--emerald)', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>{stats?.salesCount || 0} invoices</span>
            <span>· देखें →</span>
          </div>
        </div>

        {/* Profit */}
        <div onClick={() => router.push('/reports')} style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: profit >= 0 ? 'linear-gradient(90deg, #4F46E5, #6366F1)' : 'linear-gradient(90deg, #EF4444, #F87171)', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-4)', marginBottom: 8 }}>📊 मुनाफ़ा / Profit</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: profit >= 0 ? '#4F46E5' : '#EF4444', letterSpacing: -1.5, lineHeight: 1 }}>
            {profit >= 0 ? '+' : ''}₹{fmt(profit)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 8 }}>
            {(stats?.totalRevenue || 0) > 0
              ? <span style={{ background: 'var(--primary-dim)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>Margin: {((profit / (stats?.totalRevenue || 1)) * 100).toFixed(1)}%</span>
              : 'रिपोर्ट देखें →'}
          </div>
        </div>

        {/* Udhaar */}
        <div onClick={() => router.push('/udhaar')} style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: totalCustomerUdhaar > 0 ? 'linear-gradient(90deg, #EF4444, #F87171)' : 'linear-gradient(90deg, #22C55E, #4ADE80)', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-4)', marginBottom: 8 }}>📒 उधार / Credit</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: totalCustomerUdhaar > 0 ? '#EF4444' : '#22C55E', letterSpacing: -1.5, lineHeight: 1 }}>
            ₹{fmt(totalCustomerUdhaar)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 8 }}>
            <span style={{ background: totalCustomerUdhaar > 0 ? 'var(--danger-dim)' : 'var(--success-dim)', color: totalCustomerUdhaar > 0 ? '#B91C1C' : '#15803D', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>
              {totalCustomerUdhaar > 0 ? 'वसूलना बाकी' : 'सब चुकता ✓'}
            </span>
          </div>
        </div>

        {/* GST */}
        <div onClick={() => router.push('/gst')} style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: netGST >= 0 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #22C55E, #4ADE80)', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-4)', marginBottom: 8 }}>🧾 GST देय</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: netGST >= 0 ? '#D97706' : '#22C55E', letterSpacing: -1.5, lineHeight: 1 }}>
            ₹{fmt(Math.abs(netGST))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8, lineHeight: 1.7 }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>↑₹{fmt(stats?.gstCollected)}</span>
            {' − '}
            <span style={{ color: '#4F46E5', fontWeight: 600 }}>ITC ₹{fmt(stats?.gstITC)}</span>
          </div>
        </div>
      </div>

      {/* ── PROFIT BREAKDOWN ── */}
      {(stats?.totalRevenue || 0) > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            📊 मुनाफ़ा विवरण / Profit Breakdown
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {[
              { label: 'कुल बिक्री',      value: stats?.totalRevenue,  color: '#059669' },
              { label: 'मुनाफ़ा',          value: profit,               color: profit >= 0 ? '#4F46E5' : '#EF4444', prefix: profit >= 0 ? '+' : '' },
              { label: 'GST वसूला',       value: stats?.gstCollected,  color: '#D97706' },
              { label: 'ITC (Input GST)', value: stats?.gstITC,        color: '#8B5CF6', prefix: '−' },
              { label: 'Net GST देय',     value: netGST,               color: netGST >= 0 ? '#D97706' : '#22C55E' },
            ].map((item, i) => (
              <div key={i} style={{ minWidth: 120 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: item.color }}>
                  {item.prefix || ''}₹{fmt(item.value)}
                </div>
              </div>
            ))}
          </div>

          {/* Profit margin bar */}
          {(stats?.totalRevenue || 0) > 0 && (() => {
            const marginPct = ((profit / (stats?.totalRevenue || 1)) * 100).toFixed(1);
            return (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)', marginBottom: 6, fontWeight: 600 }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Profit Margin</span>
                  <span style={{ color: profit >= 0 ? '#4F46E5' : '#EF4444', fontWeight: 800, fontSize: 13 }}>{marginPct}%</span>
                </div>
                <div style={{ height: 7, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.abs(parseFloat(marginPct)))}%`,
                    background: profit >= 0 ? 'linear-gradient(90deg, #4F46E5, #6366F1)' : '#EF4444',
                    borderRadius: 99, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── LOW STOCK ALERT ── */}
      {lowStock.length > 0 && (
        <div onClick={() => router.push('/product')} style={{
          background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 'var(--radius)',
          padding: '16px 20px', marginBottom: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          transition: 'all 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#FEF9C3'; e.currentTarget.style.borderColor = '#FCD34D'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#FFFBEB'; e.currentTarget.style.borderColor = '#FDE68A'; }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 6 }}>
                कम स्टॉक / Low Stock — {lowStock.length} items
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lowStock.slice(0, 4).map(p => (
                  <span key={p._id} style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                    {p.name} ({p.quantity ?? 0})
                  </span>
                ))}
                {lowStock.length > 4 && (
                  <span style={{ background: '#FCD34D', borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    +{lowStock.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: 4 }}>
            स्टॉक बढ़ाएं →
          </div>
        </div>
      )}

      {/* ── TOP SELLING PRODUCTS ── */}
      {topProducts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
            🏆 टॉप उत्पाद — {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topProducts.map((p, i) => {
              const colors = ['#059669','#4F46E5','#D97706','#EF4444','#8B5CF6'];
              const bgs    = ['#ECFDF5','#EEF2FF','#FFFBEB','#FEF2F2','#F5F3FF'];
              const maxRevenue = topProducts[0]?.revenue || 1;
              const barWidth = (p.revenue / maxRevenue) * 100;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: bgs[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: colors[i], flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: colors[i] }}>₹{fmt(p.revenue)}</div>
                    </div>
                    <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, background: colors[i], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>{p.qty} units sold</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── QUICK ACTIONS ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
          ⚡ Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            { href: '/sales',     bg: '#059669', shadow: 'rgba(5,150,105,0.28)',    icon: '📈', hi: 'बिक्री',  en: 'New Sale',     sub: 'Record sale'     },
            { href: '/purchases', bg: '#D97706', shadow: 'rgba(217,119,6,0.28)',    icon: '🛒', hi: 'खरीद',   en: 'Purchase',     sub: 'Record purchase' },
            { href: '/udhaar',    bg: '#EF4444', shadow: 'rgba(239,68,68,0.28)',    icon: '📒', hi: 'उधार',   en: 'Credit',       sub: 'Manage udhaar'   },
            { href: '/product',   bg: '#4F46E5', shadow: 'rgba(79,70,229,0.28)',    icon: '📦', hi: 'उत्पाद', en: 'Product',      sub: 'Manage stock'    },
            { href: '/gst',       bg: '#8B5CF6', shadow: 'rgba(139,92,246,0.28)',   icon: '🧾', hi: 'GST',    en: 'GST',          sub: 'Tax summary'     },
          ].map(({ href, bg, shadow, icon, hi, en, sub }) => (
            <a key={href} href={href} style={{
              background: bg, color: '#fff', padding: '16px 18px', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 5,
              boxShadow: `0 4px 14px ${shadow}`,
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${shadow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 14px ${shadow}`; }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{en}</div>
                <div style={{ fontSize: 9.5, opacity: 0.72, fontWeight: 500, marginTop: 1 }}>{hi} · {sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}