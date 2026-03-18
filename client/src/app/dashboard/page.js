'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    products: 0, sales: 0, purchases: 0,
    revenue: 0, cost: 0, spent: 0,
    gstCollected: 0, gstPaid: 0, totalUdhaar: 0
  });
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [pRes, sRes, puRes, cRes] = await Promise.all([
        fetch('https://rakh-rakhaav.onrender.com/api/products', { headers }),
        fetch('https://rakh-rakhaav.onrender.com/api/sales', { headers }),
        fetch('https://rakh-rakhaav.onrender.com/api/purchases', { headers }),
        fetch('https://rakh-rakhaav.onrender.com/api/customers', { headers }),
      ]);
      const products = await pRes.json();
      const sales = await sRes.json();
      const purchases = await puRes.json();
      const customers = await cRes.json();

      const revenue = sales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const spent = purchases.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const gstCollected = sales.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);
      const gstPaid = purchases.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);
      const totalUdhaar = customers.reduce((s, x) => s + (x.totalUdhaar || 0), 0);

      // Real profit = revenue - cost of goods sold
      // taxable_amount = revenue without GST
      const taxableRevenue = sales.reduce((s, x) => s + parseFloat(x.taxable_amount || x.total_amount || 0), 0);
      const taxableSpent = purchases.reduce((s, x) => s + parseFloat(x.taxable_amount || x.total_amount || 0), 0);

      setStats({
        products: products.length,
        sales: sales.length,
        purchases: purchases.length,
        revenue, spent,
        taxableRevenue, taxableSpent,
        gstCollected, gstPaid,
        totalUdhaar
      });
      setLowStock(products.filter(p => p.quantity <= 5));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const profit = stats.revenue - stats.spent;
  const netGST = stats.gstCollected - stats.gstPaid;

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#9ca3af' }}>लोड हो रहा है...</div>
      </div>
    </Layout>
  );

  const cardStyle = (color) => ({
    background: '#fff',
    borderRadius: 16,
    padding: '18px 20px',
    border: '1px solid rgba(0,0,0,0.06)',
    borderTop: `3px solid ${color}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  });

  return (
    <Layout>
      <div className="page-title">डैशबोर्ड / Dashboard</div>

      {/* ── 4 MAIN CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>

        {/* 1. Total Sales */}
        <div
          style={cardStyle('#10b981')}
          onClick={() => router.push('/sales')}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>
            💰 कुल बिक्री / Sales
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', letterSpacing: -1 }}>
            ₹{stats.revenue.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            {stats.sales} invoices • देखें →
          </div>
        </div>

        {/* 2. Profit */}
        <div
          style={cardStyle(profit >= 0 ? '#6366f1' : '#ef4444')}
          onClick={() => router.push('/sales')}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px rgba(${profit >= 0 ? '99,102,241' : '239,68,68'},0.15)`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>
            📊 शुद्ध लाभ / Profit
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: profit >= 0 ? '#6366f1' : '#ef4444', letterSpacing: -1 }}>
            {profit >= 0 ? '+' : '-'}₹{Math.abs(profit).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            आय ₹{stats.revenue.toFixed(0)} − खर्च ₹{stats.spent.toFixed(0)}
          </div>
        </div>

        {/* 3. Udhaar */}
        <div
          style={cardStyle(stats.totalUdhaar > 0 ? '#ef4444' : '#10b981')}
          onClick={() => router.push('/udhaar')}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(239,68,68,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>
            📒 कुल उधार / Credit
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: stats.totalUdhaar > 0 ? '#ef4444' : '#10b981', letterSpacing: -1 }}>
            ₹{stats.totalUdhaar.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            {stats.totalUdhaar > 0 ? 'वसूलना बाकी है' : 'सब चुकता ✓'} • उधार बही →
          </div>
        </div>

        {/* 4. GST */}
        <div
          style={cardStyle(netGST >= 0 ? '#f59e0b' : '#10b981')}
          onClick={() => router.push('/gst')}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af', marginBottom: 6 }}>
            🧾 GST देय / Payable
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: netGST >= 0 ? '#f59e0b' : '#10b981', letterSpacing: -1 }}>
            ₹{Math.abs(netGST).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.6 }}>
            <span style={{ color: '#10b981' }}>वसूला ₹{stats.gstCollected.toFixed(0)}</span>
            {' − '}
            <span style={{ color: '#6366f1' }}>क्रेडिट ₹{stats.gstPaid.toFixed(0)}</span>
            <br />
            {netGST >= 0 ? '▲ सरकार को देना है' : '▼ वापसी मिलेगी'} • GST →
          </div>
        </div>
      </div>

      {/* ── LOW STOCK ALERT ── */}
      {lowStock.length > 0 && (
        <div
          onClick={() => router.push('/product')}
          style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 18px', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
                कम स्टॉक / Low Stock — {lowStock.length} items
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {lowStock.slice(0, 4).map(p => (
                  <span key={p._id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                    {p.name} ({p.quantity} बचा)
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>
            स्टॉक बढ़ाएं →
          </div>
        </div>
      )}

      {/* ── QUICK ACTIONS ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          त्वरित कार्य / Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { href: '/sales', label: 'बिक्री / Sale', sublabel: 'Record sale', icon: '📈', color: '#10b981', shadow: 'rgba(16,185,129,0.25)' },
            { href: '/purchases', label: 'खरीद / Purchase', sublabel: 'Record purchase', icon: '🛒', color: '#f59e0b', shadow: 'rgba(245,158,11,0.25)' },
            { href: '/udhaar', label: 'उधार / Credit', sublabel: 'Manage udhaar', icon: '📒', color: '#ef4444', shadow: 'rgba(239,68,68,0.25)' },
            { href: '/product', label: 'उत्पाद / Product', sublabel: 'Add product', icon: '📦', color: '#6366f1', shadow: 'rgba(99,102,241,0.25)' },
          ].map((action, i) => (
            
              key={i}
              href={action.href}
              style={{
                background: action.color,
                color: '#fff',
                padding: '14px 16px',
                borderRadius: 12,
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: `0 3px 10px ${action.shadow}`,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span style={{ fontSize: 20 }}>{action.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{action.label}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>{action.sublabel}</span>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}