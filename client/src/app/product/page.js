'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState('name');
  const [filterStock, setFilterStock] = useState('all');

  const [showModal, setShowModal]     = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', cost_price: '',
    quantity: '', unit: 'pcs', hsn_code: '', gst_rate: 0,
    low_stock_threshold: 5,
  });

  const [showStockModal, setShowStockModal]   = useState(false);
  const [stockProduct, setStockProduct]       = useState(null);
  const [stockForm, setStockForm] = useState({ type: 'manual_add', quantity: '', note: '' });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  const [showHistory, setShowHistory]       = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = [...products];
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.description && p.description.toLowerCase().includes(search.toLowerCase())));
    if (filterStock === 'low')     result = result.filter(p => p.quantity > 0 && p.is_low_stock);
    if (filterStock === 'out')     result = result.filter(p => p.quantity === 0);
    if (filterStock === 'instock') result = result.filter(p => p.quantity > 0 && !p.is_low_stock);
    if (sortBy === 'name')         result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price_asc')    result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc')   result.sort((a, b) => b.price - a.price);
    if (sortBy === 'quantity')     result.sort((a, b) => a.quantity - b.quantity);
    if (sortBy === 'margin')       result.sort((a, b) => (b.margin || 0) - (a.margin || 0));
    setFiltered(result);
  }, [search, sortBy, filterStock, products]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch { setError('उत्पाद लोड नहीं हो सके'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: 'pcs', hsn_code: '', gst_rate: 0, low_stock_threshold: 5 });
    setError(''); setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, cost_price: p.cost_price || '', quantity: p.quantity, unit: p.unit || 'pcs', hsn_code: p.hsn_code || '', gst_rate: p.gst_rate || 0, low_stock_threshold: p.low_stock_threshold || 5 });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const url = editProduct ? `${API}/api/products/${editProduct._id}` : `${API}/api/products`;
    try {
      const res = await fetch(url, { method: editProduct ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setShowModal(false); fetchProducts(); }
      else setError(data.message || 'सहेजने में विफल');
    } catch { setError('Server error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('इस उत्पाद को हटाएं?\nDelete this product?')) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) fetchProducts();
      else { const d = await res.json(); setError(d.message || 'हटाने में विफल'); }
    } catch { setError('Server error'); }
  };

  const openStockAdjust = (p) => { setStockProduct(p); setStockForm({ type: 'manual_add', quantity: '', note: '' }); setError(''); setShowStockModal(true); };

  const handleStockAdjust = async (e) => {
    e.preventDefault(); setError(''); setStockSubmitting(true);
    try {
      const res = await fetch(`${API}/api/products/${stockProduct._id}/adjust-stock`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(stockForm) });
      const data = await res.json();
      if (res.ok) { setShowStockModal(false); fetchProducts(); }
      else setError(data.message || 'Stock update failed');
    } catch { setError('Server error'); }
    setStockSubmitting(false);
  };

  const openHistory = async (p) => {
    setHistoryProduct(p); setShowHistory(true); setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/api/products/${p._id}/stock-history`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch {}
    setHistoryLoading(false);
  };

  const lowStockCount   = products.filter(p => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const totalValue      = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);

  const StockBadge = ({ p }) => {
    if (p.quantity === 0) return <span className="badge badge-red">खत्म</span>;
    if (p.is_low_stock)   return <span className="badge badge-yellow">कम ({p.quantity})</span>;
    return <span className="badge badge-green">✓ In Stock</span>;
  };

  const GSTBadge = ({ rate }) => {
    if (!rate) return <span style={{ color: 'var(--text-5)', fontSize: 12 }}>No GST</span>;
    return <span style={{ background: '#F5F3FF', color: '#6D28D9', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>GST {rate}%</span>;
  };

  const MarginBadge = ({ margin }) => {
    if (margin === null || margin === undefined) return <span style={{ color: 'var(--text-5)', fontSize: 12 }}>—</span>;
    const color = margin >= 30 ? '#15803D' : margin >= 15 ? '#B45309' : '#B91C1C';
    const bg    = margin >= 30 ? '#DCFCE7' : margin >= 15 ? '#FEF3C7' : '#FEE2E2';
    return <span style={{ background: bg, color, padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{margin}%</span>;
  };

  const historyTypeLabel = (type) => ({ purchase: '🛒 Purchase', sale: '💰 Sale', manual_add: '➕ Added', manual_remove: '➖ Removed', adjustment: '🔧 Adjusted' }[type] || type);

  const stockAdjustTypes = [
    { val: 'manual_add',    label: '➕ Add',      color: '#059669' },
    { val: 'manual_remove', label: '➖ Remove',   color: '#EF4444' },
    { val: 'adjustment',    label: '🔧 Fix',      color: '#4F46E5' },
  ];

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>उत्पाद / Products</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-4)', fontWeight: 500 }}>{products.length} products</span>
            {lowStockCount > 0 && <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700, background: 'var(--warning-dim)', padding: '2px 9px', borderRadius: 100 }}>⚠️ {lowStockCount} low stock</span>}
            {outOfStockCount > 0 && <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 700, background: 'var(--danger-dim)', padding: '2px 9px', borderRadius: 100 }}>🔴 {outOfStockCount} out of stock</span>}
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Inventory: <strong style={{ color: 'var(--text)' }}>₹{totalValue.toFixed(0)}</strong></span>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary">+ उत्पाद जोड़ें</button>
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '14px 18px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-4)' }}>🔍</div>
          <input className="form-input" style={{ paddingLeft: 36 }}
            placeholder="उत्पाद खोजें / Search..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ minWidth: 140, flex: 'none' }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="all">All Products</option>
          <option value="instock">✅ In Stock</option>
          <option value="low">⚠️ Low Stock</option>
          <option value="out">🔴 Out of Stock</option>
        </select>
        <select className="form-input" style={{ minWidth: 140, flex: 'none' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="quantity">Qty ↑</option>
          <option value="margin">Margin ↓</option>
        </select>
        {(search || filterStock !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStock('all'); }}
            style={{ color: '#EF4444', background: '#FEF2F2', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 8, fontFamily: 'var(--font-body)' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {error && !showModal && !showStockModal && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, border: '1px solid #FECACA' }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--text-4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#4F46E5', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          लोड हो रहा है...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-2)', marginBottom: 4 }}>{search || filterStock !== 'all' ? 'कोई उत्पाद नहीं मिला' : 'अभी कोई उत्पाद नहीं'}</div>
          {!search && filterStock === 'all' && <div style={{ fontSize: 13 }}>"+ जोड़ें" से पहला उत्पाद डालें</div>}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>नाम / Name</th><th>Cost</th><th>Price</th><th>Margin</th>
                  <th>GST</th><th>Qty</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p._id} style={{ background: p.quantity === 0 ? '#FFF5F5' : p.is_low_stock ? '#FFFDF0' : 'white' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{p.name}</div>
                      <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                        {p.hsn_code ? `HSN: ${p.hsn_code}` : ''} {p.unit ? `· ${p.unit}` : ''}
                        {p.low_stock_threshold !== 5 && ` · Alert ≤${p.low_stock_threshold}`}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{p.cost_price ? `₹${p.cost_price}` : '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text)' }}>₹{p.price}</td>
                    <td><MarginBadge margin={p.margin} /></td>
                    <td><GSTBadge rate={p.gst_rate} /></td>
                    <td style={{ fontWeight: 800, color: p.quantity === 0 ? '#EF4444' : p.is_low_stock ? '#D97706' : 'var(--text-2)' }}>
                      {p.quantity} <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 11 }}>{p.unit || ''}</span>
                    </td>
                    <td><StockBadge p={p} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => openStockAdjust(p)} style={{ color: '#059669', background: '#ECFDF5', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>Stock</button>
                        <button onClick={() => openHistory(p)}    style={{ color: '#4F46E5', background: '#EEF2FF', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>History</button>
                        <button onClick={() => openEdit(p)}       style={{ color: '#D97706', background: '#FFFBEB', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>Edit</button>
                        <button onClick={() => handleDelete(p._id)} style={{ color: '#EF4444', background: '#FEF2F2', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(p => (
              <div key={p._id} className="card" style={{ borderLeft: `4px solid ${p.quantity === 0 ? '#EF4444' : p.is_low_stock ? '#F59E0B' : '#22C55E'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-4)', fontSize: 11.5 }}>{p.description || (p.unit ? `Unit: ${p.unit}` : '')}</div>
                  </div>
                  <StockBadge p={p} />
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Cost</div><div style={{ fontWeight: 700, fontSize: 13 }}>{p.cost_price ? `₹${p.cost_price}` : '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Price</div><div style={{ fontWeight: 700, fontSize: 13 }}>₹{p.price}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Margin</div><div style={{ marginTop: 2 }}><MarginBadge margin={p.margin} /></div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Qty</div><div style={{ fontWeight: 800, fontSize: 13, color: p.quantity === 0 ? '#EF4444' : p.is_low_stock ? '#D97706' : 'var(--text)' }}>{p.quantity} {p.unit || ''}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>GST</div><div style={{ marginTop: 2 }}><GSTBadge rate={p.gst_rate} /></div></div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openStockAdjust(p)} style={{ flex: 1, padding: '8px', background: '#ECFDF5', color: '#059669', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📦 Stock</button>
                  <button onClick={() => openHistory(p)}    style={{ flex: 1, padding: '8px', background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📋 History</button>
                  <button onClick={() => openEdit(p)}       style={{ flex: 1, padding: '8px', background: '#FFFBEB', color: '#D97706', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(p._id)} style={{ flex: 1, padding: '8px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {editProduct ? '✏️ Edit Product' : '📦 Add Product'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{editProduct ? 'उत्पाद संपादित करें' : 'नया उत्पाद जोड़ें'}</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>⚠️ {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">नाम / Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">विवरण / Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Cost Price ₹</label>
                  <input className="form-input" type="number" step="0.01" placeholder="खरीद मूल्य" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price ₹ *</label>
                  <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
              </div>

              {form.cost_price && form.price && Number(form.cost_price) > 0 && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <span style={{ color: '#64748B' }}>Margin: </span>
                  <strong style={{ color: '#15803D', fontSize: 14 }}>{(((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)}%</strong>
                  <span style={{ color: '#94A3B8', marginLeft: 8 }}>(₹{(Number(form.price) - Number(form.cost_price)).toFixed(2)} profit/unit)</span>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{editProduct ? 'Quantity' : 'Opening Stock *'}</label>
                  <input className="form-input" type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required={!editProduct} />
                  {editProduct && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>Stock adjust के लिए "Stock" button use करें</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" placeholder="kg, pcs, box..." value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">HSN/SAC Code</label>
                  <input className="form-input" placeholder="e.g. 8471" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Rate</label>
                  <select className="form-input" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: parseInt(e.target.value) })}>
                    <option value={0}>0% — No GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">⚠️ Low Stock Alert Threshold</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 5" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} />
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>Default: 5 — इससे कम stock पर alert आएगा</div>
              </div>
              {form.price && form.gst_rate > 0 && (
                <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#6D28D9', marginBottom: 3 }}>GST Preview</div>
                  <div style={{ color: '#7C3AED' }}>₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% = <strong>₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editProduct ? '✅ Update Product' : '➕ Add Product'}</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock Adjust Modal ── */}
      {showStockModal && stockProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>📦 Stock Adjust</h3>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{stockProduct.name} · Current: <strong>{stockProduct.quantity} {stockProduct.unit || 'pcs'}</strong></div>
              </div>
              <button onClick={() => { setShowStockModal(false); setError(''); }} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>⚠️ {error}</div>}
            <form onSubmit={handleStockAdjust}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {stockAdjustTypes.map(opt => (
                    <button key={opt.val} type="button" onClick={() => setStockForm({ ...stockForm, type: opt.val })} style={{ flex: 1, padding: '9px 4px', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: stockForm.type === opt.val ? opt.color : 'var(--border)', background: stockForm.type === opt.val ? opt.color : 'var(--surface-2)', color: stockForm.type === opt.val ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-body)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" placeholder="How many units?" value={stockForm.quantity} onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })} required />
                {stockForm.quantity && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5, fontWeight: 600 }}>
                    New stock → <strong style={{ color: '#4F46E5' }}>{stockForm.type === 'manual_remove' ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity)) : stockProduct.quantity + Number(stockForm.quantity)} {stockProduct.unit || 'pcs'}</strong>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="Reason for adjustment..." value={stockForm.note} onChange={e => setStockForm({ ...stockForm, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={stockSubmitting} className="btn-success" style={{ flex: 1 }}>
                  {stockSubmitting ? '⏳ Saving...' : '✅ Update Stock'}
                </button>
                <button type="button" onClick={() => { setShowStockModal(false); setError(''); }} style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock History Modal ── */}
      {showHistory && historyProduct && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>📋 Stock History</h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{historyProduct.name} · Current: <strong>{historyProduct.quantity} {historyProduct.unit || 'pcs'}</strong></div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>⏳ लोड हो रहा है...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>कोई history नहीं</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historyData.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'var(--surface-2)', borderRadius: 10, borderLeft: `3px solid ${h.quantity_change > 0 ? '#22C55E' : '#EF4444'}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{historyTypeLabel(h.type)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{new Date(h.date).toLocaleDateString('en-IN')} · {h.note || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: h.quantity_change > 0 ? '#22C55E' : '#EF4444' }}>
                        {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>→ {h.quantity_after} {historyProduct.unit || 'pcs'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}