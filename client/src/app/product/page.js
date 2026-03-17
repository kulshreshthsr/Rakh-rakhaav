'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: '', hsn_code: '', gst_rate: 0 });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterStock, setFilterStock] = useState('all');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  const fetchProducts = async () => {
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/products', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setProducts(data); setFiltered(data);
    } catch { setError('उत्पाद लोड नहीं हो सके'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = [...products];
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.description && p.description.toLowerCase().includes(search.toLowerCase())));
    if (filterStock === 'low') result = result.filter(p => p.quantity <= 5);
    if (filterStock === 'out') result = result.filter(p => p.quantity === 0);
    if (filterStock === 'instock') result = result.filter(p => p.quantity > 5);
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price_asc') result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') result.sort((a, b) => b.price - a.price);
    if (sortBy === 'quantity') result.sort((a, b) => a.quantity - b.quantity);
    setFiltered(result);
  }, [search, sortBy, filterStock, products]);

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: '', hsn_code: '', gst_rate: 0 });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, cost_price: p.cost_price || '', quantity: p.quantity, unit: p.unit || '', hsn_code: p.hsn_code || '', gst_rate: p.gst_rate || 0 });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editProduct ? `https://rakh-rakhaav.onrender.com/api/products/${editProduct._id}` : 'https://rakh-rakhaav.onrender.com/api/products';
    try {
      const res = await fetch(url, { method: editProduct ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(form) });
      if (res.ok) { setShowModal(false); fetchProducts(); }
    } catch { setError('सहेजने में विफल'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('इस उत्पाद को हटाएं?\nDelete this product?')) return;
    try {
      await fetch(`https://rakh-rakhaav.onrender.com/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchProducts();
    } catch { setError('हटाने में विफल'); }
  };

  const getStockBadge = (qty) => {
    if (qty === 0) return <span className="badge badge-red">खत्म / Out</span>;
    if (qty <= 5) return <span className="badge badge-yellow">कम / Low</span>;
    return <span className="badge badge-green">उपलब्ध / In Stock</span>;
  };

  const getGSTBadge = (rate) => {
    if (!rate || rate === 0) return <span style={{ color: '#9ca3af', fontSize: 12 }}>No GST</span>;
    return <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>GST {rate}%</span>;
  };

  const getMargin = (price, cost) => {
    if (!cost || !price || cost <= 0) return null;
    const margin = ((price - cost) / cost * 100).toFixed(1);
    const profit = (price - cost).toFixed(0);
    return { margin, profit, positive: price > cost };
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>उत्पाद / Products</div>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>{filtered.length} आइटम / items</div>
        </div>
        <button onClick={openAdd} className="btn-primary">+ उत्पाद जोड़ें / Add Product</button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="उत्पाद खोजें / Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ minWidth: 140 }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="all">सभी / All Stock</option>
          <option value="instock">उपलब्ध / In Stock</option>
          <option value="low">कम / Low Stock</option>
          <option value="out">खत्म / Out of Stock</option>
        </select>
        <select className="form-input" style={{ minWidth: 150 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">नाम से / By Name</option>
          <option value="price_asc">कम कीमत / Price ↑</option>
          <option value="price_desc">ज्यादा कीमत / Price ↓</option>
          <option value="quantity">मात्रा से / By Qty</option>
        </select>
        {(search || filterStock !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStock('all'); }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>साफ / Clear</button>
        )}
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>लोड हो रहा है...</div>
        : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            {search || filterStock !== 'all' ? 'कोई उत्पाद नहीं मिला' : 'अभी कोई उत्पाद नहीं। "+ Add Product" से जोड़ें।'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="table-container hidden-xs">
              <table>
                <thead>
                  <tr><th>नाम / Name</th><th>लागत / Cost</th><th>बिक्री / Price</th><th>मार्जिन</th><th>GST</th><th>मात्रा / Qty</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const m = getMargin(p.price, p.cost_price);
                    return (
                      <tr key={p._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{p.name}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>{p.hsn_code ? `HSN: ${p.hsn_code}` : ''} {p.unit || ''}</div>
                        </td>
                        <td style={{ color: '#9ca3af' }}>{p.cost_price ? `₹${p.cost_price}` : '—'}</td>
                        <td style={{ fontWeight: 600 }}>₹{p.price}</td>
                        <td>
                          {m ? <span style={{ background: m.positive ? '#dcfce7' : '#fee2e2', color: m.positive ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                            {m.positive ? '+' : ''}₹{m.profit} ({m.margin}%)
                          </span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                        </td>
                        <td>{getGSTBadge(p.gst_rate)}</td>
                        <td>{p.quantity} {p.unit || ''}</td>
                        <td>{getStockBadge(p.quantity)}</td>
                        <td>
                          <button onClick={() => openEdit(p)} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginRight: 10 }}>Edit</button>
                          <button onClick={() => handleDelete(p._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(p => {
                const m = getMargin(p.price, p.cost_price);
                return (
                  <div key={p._id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>{p.name}</div>
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>{p.description || '—'}</div>
                      </div>
                      {getStockBadge(p.quantity)}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                      <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>लागत/COST</div><div style={{ fontWeight: 700 }}>{p.cost_price ? `₹${p.cost_price}` : '—'}</div></div>
                      <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>बिक्री/PRICE</div><div style={{ fontWeight: 700 }}>₹{p.price}</div></div>
                      <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>मात्रा/QTY</div><div style={{ fontWeight: 700 }}>{p.quantity}</div></div>
                      {m && <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>मार्जिन</div><div style={{ fontWeight: 700, color: m.positive ? '#10b981' : '#ef4444' }}>{m.margin}%</div></div>}
                      <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div><div>{getGSTBadge(p.gst_rate)}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(p)} style={{ flex: 1, padding: '8px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(p._id)} style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 20 }}>
              {editProduct ? 'उत्पाद संपादित / Edit Product' : 'उत्पाद जोड़ें / Add Product'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">नाम / Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">विवरण / Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Cost + Selling Price */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">लागत मूल्य / Cost Price ₹</label>
                  <input className="form-input" type="number" placeholder="खरीद मूल्य" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">बिक्री मूल्य / Selling Price ₹ *</label>
                  <input className="form-input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
              </div>

              {/* Margin Preview */}
              {form.cost_price && form.price && (
                <div style={{ background: parseFloat(form.price) > parseFloat(form.cost_price) ? '#f0fdf4' : '#fef2f2', border: `1px solid ${parseFloat(form.price) > parseFloat(form.cost_price) ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: parseFloat(form.price) > parseFloat(form.cost_price) ? '#059669' : '#ef4444', marginBottom: 2 }}>मार्जिन / Margin Preview</div>
                  <div style={{ color: '#374151' }}>
                    लाभ / Profit: ₹{(parseFloat(form.price) - parseFloat(form.cost_price)).toFixed(2)}
                    {' • '}
                    {(((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.cost_price)) * 100).toFixed(1)}%
                  </div>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">मात्रा / Quantity *</label>
                  <input className="form-input" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">इकाई / Unit</label>
                  <input className="form-input" placeholder="kg, pcs, box..." value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">HSN/SAC Code</label>
                  <input className="form-input" placeholder="e.g. 8471" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">GST दर / Rate</label>
                  <select className="form-input" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: parseInt(e.target.value) })}>
                    <option value={0}>0% — No GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
              </div>

              {form.price && form.gst_rate > 0 && (
                <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#6d28d9', marginBottom: 2 }}>GST Preview</div>
                  <div style={{ color: '#7c3aed' }}>
                    ₹{parseFloat(form.price).toFixed(2)} + {form.gst_rate}% GST = <strong>₹{(parseFloat(form.price) * (1 + form.gst_rate / 100)).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editProduct ? 'अपडेट / Update' : 'जोड़ें / Add'}</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>रद्द / Cancel</button>
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