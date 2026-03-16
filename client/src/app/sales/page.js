'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '', price_per_unit: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  const fetchSales = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/sales', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setSales(await res.json());
    } catch { setError('Could not load sales'); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    const res = await fetch('http://localhost:5000/api/products', { headers: { Authorization: `Bearer ${getToken()}` } });
    setProducts(await res.json());
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchSales(); fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); setForm({ product_id: '', quantity: '', price_per_unit: '' }); fetchSales(); }
      else setError(data.message || 'Failed');
    } catch { setError('Server error'); }
  };

  const printInvoice = (sale) => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice #${sale.id}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#333}.header{display:flex;justify-content:space-between;margin-bottom:30px}.title{font-size:28px;font-weight:bold;color:#6366f1}.divider{border:none;border-top:2px solid #e5e7eb;margin:20px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f3f4f6;padding:12px;text-align:left;font-size:13px;text-transform:uppercase}td{padding:12px;border-bottom:1px solid #f3f4f6}.total-amount{color:#10b981;font-size:20px;font-weight:bold}.footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:12px}</style></head><body><div class="header"><div><div class="title">रखरखाव</div><div style="color:#666;font-size:14px">Inventory Management</div></div><div style="text-align:right;font-size:14px"><div><strong>Invoice #${sale.id}</strong></div><div>Date: ${new Date(sale.sold_at).toLocaleDateString('en-IN')}</div></div></div><hr class="divider"/><table><thead><tr><th>Product</th><th>Qty</th><th>Price/Unit</th><th>Total</th></tr></thead><tbody><tr><td>${sale.product_name}</td><td>${sale.quantity}</td><td>₹${sale.price_per_unit}</td><td class="total-amount">₹${sale.total_amount}</td></tr></tbody><tfoot><tr><td colspan="3" style="text-align:right;padding-right:20px;font-weight:bold">Grand Total:</td><td class="total-amount">₹${sale.total_amount}</td></tr></tfoot></table><div class="footer">Thank you for your business! — रखरखाव</div></body></html>`);
    win.document.close(); win.print();
  };

  const total = sales.reduce((s, x) => s + parseFloat(x.total_amount), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Sales</div>
          <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>Total Revenue: ₹{total.toFixed(2)}</div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-success">+ Record Sale</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        : sales.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No sales recorded yet. Click "+ Record Sale" to get started.</div>
        ) : (
          <>
            <div className="table-container hidden-xs">
              <table>
                <thead><tr><th>Product</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Date</th><th>Invoice</th></tr></thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: '#1a1a2e' }}>{s.product_name}</td>
                      <td>{s.quantity}</td>
                      <td>₹{s.price_per_unit}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>₹{s.total_amount}</td>
                      <td style={{ color: '#9ca3af', fontSize: 13 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</td>
                      <td><button onClick={() => printInvoice(s)} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Print</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sales.map(s => (
                <div key={s.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{s.product_name}</div>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>₹{s.total_amount}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QTY</div><div style={{ fontWeight: 600 }}>{s.quantity}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>PRICE</div><div style={{ fontWeight: 600 }}>₹{s.price_per_unit}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>DATE</div><div style={{ fontWeight: 600 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</div></div>
                  </div>
                  <button onClick={() => printInvoice(s)} style={{ width: '100%', padding: '8px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print Invoice</button>
                </div>
              ))}
            </div>
          </>
        )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1a1a2e' }}>Record Sale</h3>
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
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
                  Total: <strong style={{ color: '#059669' }}>₹{(form.quantity * form.price_per_unit).toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-success" style={{ flex: 1 }}>Record Sale</button>
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