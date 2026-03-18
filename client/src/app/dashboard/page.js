'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [selectedMonth, selectedYear]);

  const fetchAll = async () => {
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

      // Top selling products this month
      const salesList = salesData.sales || salesData || [];
      const productSalesMap = {};
      salesList.forEach(sale => {
        const items = sale.items?.length > 0 ? sale.items : [{
          product_name: sale.product_name,
          quantity: sale.quantity,
          total_amount: sale.total_amount,
        }];
        items.forEach(item => {
          const key = item.product_name;
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
  };

  const lowStock = products.filter(p => (p.quantity ?? p.stock ?? 0) <= 5);
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#9ca3af' }}>लोड हो रहा है...</div>
      </div>
    </Layout>
  );

  const netGST = (stats?.netGSTPayable ?? 0);
  const grossProfit = stats?.grossProfit ?? 0;

  return (
    <Layout>
      {/* ── Header + Month Picker ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>डैशबोर्ड / Dashboard</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff' }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── 4 MAIN STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 20 }}>

        {/* Sales */}
        <div onClick={() => router.push('/sales')}
          style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)', borderTop: '3px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>💰 बिक्री / Sales</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981', letterSpacing: -1 }}>₹{fmt(stats?.totalRevenue)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{stats?.salesCount || 0} invoices • देखें →</div>
        </div>

        {/* Profit */}
        <div onClick={() => router.push('/sales')}
          style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${grossProfit >= 0 ? '#6366f1' : '#ef4444'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>📊 मुनाफ़ा / Profit</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: grossProfit >= 0 ? '#6366f1' : '#ef4444', letterSpacing: -1 }}>
            {grossProfit >= 0 ? '+' : ''}₹{fmt(grossProfit)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            बिक्री ₹{fmt(stats?.totalTaxable)} − लागत ₹{fmt(stats?.totalCOGS)}
          </div>
        </div>

        {/* Udhaar */}
        <div onClick={() => router.push('/udhaar')}
          style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${totalCustomerUdhaar > 0 ? '#ef4444' : '#10b981'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>📒 उधार / Credit</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: totalCustomerUdhaar > 0 ? '#ef4444' : '#10b981', letterSpacing: -1 }}>
            ₹{fmt(totalCustomerUdhaar)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {totalCustomerUdhaar > 0 ? 'वसूलना बाकी है' : 'सब चुकता ✓'} • उधार बही →
          </div>
        </div>

        {/* GST */}
        <div onClick={() => router.push('/gst')}
          style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${netGST >= 0 ? '#f59e0b' : '#10b981'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>🧾 GST देय / Payable</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: netGST >= 0 ? '#f59e0b' : '#10b981', letterSpacing: -1 }}>
            ₹{fmt(Math.abs(netGST))}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.6 }}>
            <span style={{ color: '#10b981' }}>वसूला ₹{fmt(stats?.gstCollected)}</span>
            {' − '}
            <span style={{ color: '#6366f1' }}>ITC ₹{fmt(stats?.gstITC)}</span>
            <br />{netGST >= 0 ? '▲ देना है' : '▼ वापसी'} • GST →
          </div>
        </div>
      </div>

      {/* ── PROFIT BREAKDOWN ── */}
      {(stats?.totalRevenue || 0) > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            📊 मुनाफ़ा विवरण / Profit Breakdown
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[
              { label: 'कुल बिक्री (Taxable)', value: stats?.totalTaxable, color: '#10b981' },
              { label: 'माल लागत (COGS)', value: stats?.totalCOGS, color: '#ef4444', prefix: '−' },
              { label: 'सकल मुनाफ़ा (Gross)', value: grossProfit, color: grossProfit >= 0 ? '#6366f1' : '#ef4444', prefix: grossProfit >= 0 ? '+' : '' },
              { label: 'GST वसूला', value: stats?.gstCollected, color: '#f59e0b' },
              { label: 'ITC (Input GST)', value: stats?.gstITC, color: '#8b5cf6', prefix: '−' },
              { label: 'Net GST देय', value: netGST, color: netGST >= 0 ? '#f59e0b' : '#10b981' },
            ].map((item, i) => (
              <div key={i} style={{ minWidth: 130 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>
                  {item.prefix || ''}₹{fmt(item.value)}
                </div>
              </div>
            ))}
          </div>

          {/* Profit margin bar */}
          {(stats?.totalTaxable || 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                <span>Profit Margin</span>
                <span style={{ fontWeight: 700, color: grossProfit >= 0 ? '#6366f1' : '#ef4444' }}>
                  {((grossProfit / (stats?.totalTaxable || 1)) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.abs((grossProfit / (stats?.totalTaxable || 1)) * 100))}%`,
                  background: grossProfit >= 0 ? '#6366f1' : '#ef4444',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOW STOCK ALERT ── */}
      {lowStock.length > 0 && (
        <div onClick={() => router.push('/product')}
          style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 18px', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
                कम स्टॉक / Low Stock — {lowStock.length} items
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {lowStock.slice(0, 4).map(p => (
                  <span key={p._id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                    {p.name} ({p.quantity ?? 0} बचा)
                  </span>
                ))}
                {lowStock.length > 4 && (
                  <span style={{ background: '#fcd34d', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                    +{lowStock.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>स्टॉक बढ़ाएं →</div>
        </div>
      )}

      {/* ── TOP SELLING PRODUCTS ── */}
      {topProducts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            🏆 टॉप उत्पाद / Top Products — {MONTHS[selectedMonth - 1]} {selectedYear}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topProducts.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.qty} units sold</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>₹{fmt(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── QUICK ACTIONS ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          त्वरित कार्य / Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { href: '/sales', bg: '#10b981', shadow: 'rgba(16,185,129,0.25)', icon: '📈', hi: 'बिक्री', en: 'Sale', sub: 'Record sale' },
            { href: '/purchases', bg: '#f59e0b', shadow: 'rgba(245,158,11,0.25)', icon: '🛒', hi: 'खरीद', en: 'Purchase', sub: 'Record purchase' },
            { href: '/udhaar', bg: '#ef4444', shadow: 'rgba(239,68,68,0.25)', icon: '📒', hi: 'उधार', en: 'Credit', sub: 'Manage udhaar' },
            { href: '/product', bg: '#6366f1', shadow: 'rgba(99,102,241,0.25)', icon: '📦', hi: 'उत्पाद', en: 'Product', sub: 'Add product' },
            { href: '/gst', bg: '#8b5cf6', shadow: 'rgba(139,92,246,0.25)', icon: '🧾', hi: 'GST', en: 'GST', sub: 'Tax summary' },
          ].map(({ href, bg, shadow, icon, hi, en, sub }) => (
            <a key={href} href={href}
              style={{ background: bg, color: '#fff', padding: '14px 16px', borderRadius: 12, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: `0 3px 10px ${shadow}` }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{hi} / {en}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>{sub}</span>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}