'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '', price_per_unit: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  const fetchPurchases = async () => {
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/purchases', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setPurchases(await res.json());
    } catch { setError('Could not load purchases'); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    const res = await fetch('https://rakh-rakhaav.onrender.com/api/products', { headers: { Authorization: `Bearer ${getToken()}` } });
    setProducts(await res.json());
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchPurchases(); fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); setForm({ product_id: '', quantity: '', price_per_unit: '' }); fetchPurchases(); }
      else setError(data.message || 'Failed');
    } catch { setError('Server error'); }
  };

  const total = purchases.reduce((s, x) => s + parseFloat(x.total_amount), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Purchases</div>
          <div style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600 }}>Total Spent: ₹{total.toFixed(2)}</div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-warning">+ Record Purchase</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        : purchases.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No purchases recorded yet. Click "+ Record Purchase" to get started.</div>
        ) : (
          <>
            <div className="table-container hidden-xs">
              <table>
                <thead><tr><th>Product</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Date</th></tr></thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: '#1a1a2e' }}>{p.product_name}</td>
                      <td>{p.quantity}</td>
                      <td>₹{p.price_per_unit}</td>
                      <td style={{ fontWeight: 700, color: '#f59e0b' }}>₹{p.total_amount}</td>
                      <td style={{ color: '#9ca3af', fontSize: 13 }}>{new Date(p.purchased_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {purchases.map(p => (
                <div key={p.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{p.product_name}</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>₹{p.total_amount}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QTY</div><div style={{ fontWeight: 600 }}>{p.quantity}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>PRICE</div><div style={{ fontWeight: 600 }}>₹{p.price_per_unit}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>DATE</div><div style={{ fontWeight: 600 }}>{new Date(p.purchased_at).toLocaleDateString('en-IN')}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1a1a2e' }}>Record Purchase</h3>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-input" value={form.product_id} onChange={e => { const p = products.find(x => x.id === parseInt(e.target.value)); setForm({ ...form, product_id: e.target.value, price_per_unit: p?.price || '' }); }} required>
                  <option value="">Select a product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price/Unit (₹)</label>
                  <input className="form-input" type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} required />
                </div>
              </div>
              {form.quantity && form.price_per_unit && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
                  Total: <strong style={{ color: '#d97706' }}>₹{(form.quantity * form.price_per_unit).toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-warning" style={{ flex: 1 }}>Record Purchase</button>
                <button type="button" onClick={() => { setShowModal(false); setError(''); }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }
      `}</style>
    </Layout>
  );
}
