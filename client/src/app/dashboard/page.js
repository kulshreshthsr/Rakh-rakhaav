'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, sales: 0, purchases: 0, revenue: 0, spent: 0, gstCollected: 0, gstPaid: 0, totalUdhaar: 0 });
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

      setStats({ products: products.length, sales: sales.length, purchases: purchases.length, revenue, spent, gstCollected, gstPaid, totalUdhaar });
      setLowStock(products.filter(p => p.quantity <= 5));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const profit = stats.revenue - stats.spent;
  const netGST = stats.gstCollected - stats.gstPaid;

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>लोड हो रहा है...</div></Layout>;

  return (
    <Layout>
      <div className="page-title">डैशबोर्ड / Dashboard</div>

      {/* 4 Main Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderTop: '3px solid #10b981' }}>
          <div className="stat-label">कुल बिक्री / Total Sales</div>
          <div className="stat-value" style={{ color: '#10b981' }}>₹{stats.revenue.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{stats.sales} invoices</div>
        </div>

        <div className="stat-card" style={{ borderTop: `3px solid ${profit >= 0 ? '#6366f1' : '#ef4444'}` }}>
          <div className="stat-label">शुद्ध लाभ / Net Profit</div>
          <div className="stat-value" style={{ color: profit >= 0 ? '#6366f1' : '#ef4444' }}>
            {profit >= 0 ? '+' : ''}₹{profit.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>खर्च / Spent: ₹{stats.spent.toFixed(0)}</div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div className="stat-label">कुल उधार / Total Credit</div>
          <div className="stat-value" style={{ color: stats.totalUdhaar > 0 ? '#ef4444' : '#10b981' }}>
            ₹{stats.totalUdhaar.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <a href="/udhaar" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>उधार बही देखें →</a>
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: `3px solid ${netGST >= 0 ? '#ef4444' : '#10b981'}` }}>
          <div className="stat-label">GST देय / Payable</div>
          <div className="stat-value" style={{ color: netGST >= 0 ? '#ef4444' : '#10b981', fontSize: 24 }}>
            ₹{Math.abs(netGST).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {netGST >= 0 ? '▲ भरना है' : '▼ वापसी'}
            {' • '}<a href="/gst" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>GST देखें →</a>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>त्वरित कार्य / Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/sales" style={{ background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>+ बिक्री / Sale</a>
          <a href="/purchases" style={{ background: '#f59e0b', color: '#fff', padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}>+ खरीद / Purchase</a>
          <a href="/product" style={{ background: '#6366f1', color: '#fff', padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>+ उत्पाद / Product</a>
          <a href="/udhaar" style={{ background: '#1a1a2e', color: '#fff', padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>📒 उधार बही</a>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>कम स्टॉक / Low Stock Alert</span>
            <span style={{ background: '#fcd34d', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{lowStock.length} items</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map(p => (
              <div key={p._id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#92400e' }}>{p.name}</span>
                <span style={{ color: '#d97706', marginLeft: 8 }}>{p.quantity} बचा</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}