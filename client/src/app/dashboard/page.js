'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, sales: 0, purchases: 0, revenue: 0, spent: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [pRes, sRes, puRes] = await Promise.all([
        fetch('http://localhost:5000/api/products', { headers }),
        fetch('http://localhost:5000/api/sales', { headers }),
        fetch('http://localhost:5000/api/purchases', { headers }),
      ]);
      const products = await pRes.json();
      const sales = await sRes.json();
      const purchases = await puRes.json();

      const revenue = sales.reduce((s, x) => s + parseFloat(x.total_amount), 0);
      const spent = purchases.reduce((s, x) => s + parseFloat(x.total_amount), 0);
      setStats({ products: products.length, sales: sales.length, purchases: purchases.length, revenue, spent });
      setLowStock(products.filter(p => p.quantity <= 5));

      const sd = {};
      sales.forEach(s => {
        const d = new Date(s.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        sd[d] = (sd[d] || 0) + parseFloat(s.total_amount);
      });
      setSalesData(Object.entries(sd).map(([date, amount]) => ({ date, amount })));

      const pd = {};
      purchases.forEach(p => {
        const d = new Date(p.purchased_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        pd[d] = (pd[d] || 0) + parseFloat(p.total_amount);
      });
      setPurchaseData(Object.entries(pd).map(([date, amount]) => ({ date, amount })));
    } catch (err) { console.error(err); }
  };

  const profit = stats.revenue - stats.spent;

  return (
    <Layout>
      <div className="page-title">Dashboard</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Products', value: stats.products, color: '#6366f1' },
          { label: 'Sales', value: stats.sales, color: '#10b981' },
          { label: 'Purchases', value: stats.purchases, color: '#f59e0b' },
          { label: 'Revenue', value: `₹${stats.revenue.toFixed(0)}`, color: '#10b981' },
          { label: 'Amount Spent', value: `₹${stats.spent.toFixed(0)}`, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Profit card */}
      <div style={{
        background: profit >= 0 ? '#f0fdf4' : '#fef2f2',
        border: `1.5px solid ${profit >= 0 ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af' }}>Net Profit</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, color: profit >= 0 ? '#059669' : '#dc2626' }}>
            {profit >= 0 ? '+' : ''}₹{profit.toFixed(2)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>REVENUE</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>₹{stats.revenue.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>SPENT</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>₹{stats.spent.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <a href="/product" style={{ background: '#6366f1', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>+ Add Product</a>
        <a href="/sales" style={{ background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>+ Record Sale</a>
        <a href="/purchases" style={{ background: '#f59e0b', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>+ Record Purchase</a>
      </div>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>Low Stock Alert</span>
            <span style={{ background: '#fcd34d', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{lowStock.length} items</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#92400e' }}>{p.name}</span>
                <span style={{ color: '#d97706', marginLeft: 8 }}>{p.quantity} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts at bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 16 }}>Sales Over Time</div>
          {salesData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={v => `₹${v}`} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 16 }}>Purchases Over Time</div>
          {purchaseData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>No purchase data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={purchaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={v => `₹${v}`} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
}