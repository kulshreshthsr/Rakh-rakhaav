'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { useAppLocale } from '../../components/AppLocale';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const HSN_GST_HINTS = {
  84: 18,
  85: 18,
  30: 12,
  61: 5,
  62: 5,
  64: 12,
  90: 18,
};
const PRODUCTS_CACHE_KEY = 'products-page';
const normalizeBarcode = (value = '') => String(value).replace(/\s+/g, '').trim();

export default function ProductsPage() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const [products, setProducts]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

  // Filters
  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState('name');
  const [filterStock, setFilterStock] = useState('all');

  // Add/Edit modal
  const [showModal, setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', cost_price: '',
    quantity: '', unit: 'pcs', barcode: '', hsn_code: '', gst_rate: 0,
    low_stock_threshold: 5,
  });
  const [productStep, setProductStep] = useState(0);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');

  // Stock adjust modal
  const [showStockModal, setShowStockModal]   = useState(false);
  const [stockProduct, setStockProduct]       = useState(null);
  const [stockForm, setStockForm] = useState({ type: 'manual_add', quantity: '', note: '' });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // Stock history modal
  const [showHistory, setShowHistory]   = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PRODUCTS_CACHE_KEY);
    if (cached?.products) {
      setProducts(cached.products);
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.products));
      await fetchProducts();
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    let result = [...products];
    if (search) result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    );
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
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextProducts = Array.isArray(data) ? data : data.products || [];
      setProducts(nextProducts);
      writePageCache(PRODUCTS_CACHE_KEY, { products: nextProducts });
    } catch { setError('Products could not be loaded'); }
    finally { setLoading(false); }
  };

  // â”€â”€ Add / Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: 'pcs', barcode: '', hsn_code: '', gst_rate: 0, low_stock_threshold: 5 });
    setLastScannedBarcode('');
    setError('');
    setProductStep(0);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({
      name: p.name, description: p.description || '',
      price: p.price, cost_price: p.cost_price || '',
      quantity: p.quantity, unit: p.unit || 'pcs',
      barcode: p.barcode || '', hsn_code: p.hsn_code || '', gst_rate: p.gst_rate || 0,
      low_stock_threshold: p.low_stock_threshold || 5,
    });
    setLastScannedBarcode('');
    setError('');
    setProductStep(0);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const url = editProduct
      ? `${API}/api/products/${editProduct._id}`
      : `${API}/api/products`;
    try {
      const res = await fetch(url, {
        method: editProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); fetchProducts(); }
      else setError(data.message || 'Could not save product');
    } catch { setError('Server error'); }
  };

  const handleBarcodeDetected = (detectedCode) => {
    const normalizedBarcode = normalizeBarcode(detectedCode);
    setForm((current) => ({ ...current, barcode: normalizedBarcode }));
    setLastScannedBarcode(normalizedBarcode);
    setShowBarcodeScanner(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) fetchProducts();
      else {
        const d = await res.json();
        setError(d.message || 'Could not delete product');
      }
    } catch { setError('Server error'); }
  };

  // â”€â”€ Stock Adjust â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openStockAdjust = (p) => {
    setStockProduct(p);
    setStockForm({ type: 'manual_add', quantity: '', note: '' });
    setError('');
    setShowStockModal(true);
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault(); setError('');
    setStockSubmitting(true);
    try {
      const res = await fetch(`${API}/api/products/${stockProduct._id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(stockForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowStockModal(false);
        fetchProducts();
      } else setError(data.message || 'Stock update failed');
    } catch { setError('Server error'); }
    setStockSubmitting(false);
  };

  // â”€â”€ Stock History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openHistory = async (p) => {
    setHistoryProduct(p);
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/api/products/${p._id}/stock-history`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch {}
    setHistoryLoading(false);
  };

  // â”€â”€ Computed stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const lowStockCount = products.filter(p => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const totalValue = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);
  const suggestedGstRate = (() => {
    const prefix = parseInt(String(form.hsn_code || '').slice(0, 2), 10);
    return HSN_GST_HINTS[prefix];
  })();
  const wizardSteps = [
    { title: 'Basics', copy: 'Name and description' },
    { title: 'Pricing', copy: 'Cost and margin' },
    { title: 'Tax / Stock', copy: 'HSN, GST and stock' },
  ];

  // â”€â”€ Badge helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const StockBadge = ({ p }) => {
    if (p.quantity === 0) return <span className="badge badge-red">Out</span>;
    if (p.is_low_stock)   return <span className="badge badge-yellow">Low ({p.quantity})</span>;
    return <span className="badge badge-green">In Stock</span>;
  };

  const GSTBadge = ({ rate }) => {
    if (margin === null || margin === undefined) return <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>;
    return <span style={{ background: '#e0f2fe', color: '#0c4a6e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>GST {rate}%</span>;
  };

  const MarginBadge = ({ margin }) => {
    if (margin === null || margin === undefined) return <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>;
    const color = margin >= 30 ? '#059669' : margin >= 15 ? '#d97706' : '#ef4444';
    const bg    = margin >= 30 ? '#dcfce7' : margin >= 15 ? '#fef3c7' : '#fee2e2';
    return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{margin}%</span>;
  };

  const historyTypeLabel = (type) => ({
    purchase: 'Purchase',
    sale: 'Sale',
    manual_add: 'Added',
    manual_remove: 'Removed',
    adjustment: 'Adjusted',
  }[type] || type);

  return (
    <Layout>
      <div className="page-shell product-shell">
        <section className="hero-panel product-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title" style={{ color: '#0f172a', marginBottom: 0 }}>Products</div>
              {refreshing && <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Refreshing inventory...</div>}
            </div>
            <button onClick={openAdd} className="btn-primary" style={{ width: 'auto' }}>+ Add Product</button>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Total Products</div>
            <div className="metric-value" style={{ color: '#1d4ed8' }}>{products.length}</div>
            <div className="metric-note">Catalog in your inventory</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Low Stock</div>
            <div className="metric-value" style={{ color: '#b45309' }}>{lowStockCount}</div>
            <div className="metric-note">Need reorder attention</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Out Of Stock</div>
            <div className="metric-value" style={{ color: '#ef4444' }}>{outOfStockCount}</div>
            <div className="metric-note">Unavailable for sale</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Inventory Value</div>
            <div className="metric-value" style={{ color: '#0f766e' }}>Rs {totalValue.toFixed(0)}</div>
            <div className="metric-note">Based on cost price</div>
          </div>
        </section>

        <div className="toolbar-card">
          <div className="toolbar">
            <input className="form-input" style={{ flex: 1, minWidth: 180 }}
              placeholder="Search products..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ minWidth: 140 }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
              <option value="all">All</option>
              <option value="instock">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <select className="form-input" style={{ minWidth: 150 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
              <option value="quantity">Qty Low to High</option>
              <option value="margin">Margin High to Low</option>
            </select>
            {(search || filterStock !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterStock('all'); }} className="btn-ghost" style={{ width: 'auto' }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {error && !showModal && !showStockModal && (
          <div className="alert-error">
          {error}
          </div>
        )}

        {loading ? (
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">PK</div>
            <div>{search || filterStock !== 'all' ? 'No products found' : 'No products yet. Add your first product.'}</div>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Margin</th>
                  <th>GST</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p._id} style={{ background: p.quantity === 0 ? 'rgba(239,68,68,0.08)' : p.is_low_stock ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>
                        {p.barcode ? `Barcode: ${p.barcode} • ` : ''}
                        {p.hsn_code ? `HSN: ${p.hsn_code}` : ''} {p.unit || ''}
                        {p.low_stock_threshold !== 5 && ` • Alert <= ${p.low_stock_threshold}`}
                      </div>
                    </td>
                    <td style={{ color: '#9ca3af' }}>{p.cost_price ? `Rs ${p.cost_price}` : '-'}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>Rs {p.price}</td>
                    <td><MarginBadge margin={p.margin} /></td>
                    <td><GSTBadge rate={p.gst_rate} /></td>
                    <td style={{ fontWeight: 700, color: p.quantity === 0 ? '#ef4444' : p.is_low_stock ? '#f59e0b' : '#059669' }}>
                      {p.quantity} <span style={{ color: '#64748b', fontWeight: 800 }}>{p.unit || ''}</span>
                    </td>
                    <td><StockBadge p={p} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openStockAdjust(p)}
                          className="action-soft stock"
                          style={{ borderRadius: 999, padding: '6px 10px' }}>
                          Stock
                        </button>
                        <button onClick={() => openHistory(p)}
                          className="action-soft history"
                          style={{ borderRadius: 999, padding: '6px 10px' }}>
                          History
                        </button>
                        <button onClick={() => openEdit(p)}
                          className="action-soft edit"
                          style={{ borderRadius: 999, padding: '6px 10px' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p._id)}
                          className="action-soft delete"
                          style={{ borderRadius: 999, padding: '6px 10px' }}>
                          Del
                        </button>
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
              <div key={p._id} className="card"
                style={{ borderLeft: `3px solid ${p.quantity === 0 ? '#ef4444' : p.is_low_stock ? '#f59e0b' : '#10b981'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      {p.barcode ? `Barcode: ${p.barcode} • ` : ''}
                      {p.description || (p.unit ? `Unit: ${p.unit}` : '')}
                    </div>
                  </div>
                  <StockBadge p={p} />
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>COST</div><div style={{ fontWeight: 700, color: '#0f172a' }}>{p.cost_price ? `Rs ${p.cost_price}` : '-'}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>PRICE</div><div style={{ fontWeight: 700, color: '#0f172a' }}>Rs {p.price}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>MARGIN</div><div><MarginBadge margin={p.margin} /></div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QTY</div><div style={{ fontWeight: 700, color: p.quantity === 0 ? '#ef4444' : p.is_low_stock ? '#f59e0b' : '#059669' }}>{p.quantity} <span style={{ color: '#64748b', fontWeight: 800 }}>{p.unit || ''}</span></div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div><GSTBadge rate={p.gst_rate} /></div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openStockAdjust(p)}
                    className="action-soft stock"
                    style={{ flex: 1, padding: '8px' }}>
                    Stock
                  </button>
                  <button onClick={() => openHistory(p)}
                    className="action-soft history"
                    style={{ flex: 1, padding: '8px' }}>
                    History
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="action-soft edit"
                    style={{ flex: 1, padding: '8px' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p._id)}
                    className="action-soft delete"
                    style={{ flex: 1, padding: '8px' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}
      </div>

      {/* â”€â”€ Add/Edit Modal â”€â”€ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal flow-modal">
            <div className="flow-modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {editProduct ? 'Edit Product' : 'Add Product'}
                </h3>
              </div>
              <div className="flow-muted-chip">{editProduct ? 'Editing product' : 'New product'}</div>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.14)', color: '#fecaca', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="flow-step-panel" style={{ display: productStep === 0 ? 'block' : 'none' }}>
              <div className="flow-section-kicker"><span>Basics</span><span>Identity + barcode</span></div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Barcode</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Scan or type barcode"
                    value={form.barcode}
                    onChange={e => {
                      const normalizedBarcode = normalizeBarcode(e.target.value);
                      setForm({ ...form, barcode: normalizedBarcode });
                      setLastScannedBarcode((current) => (current === normalizedBarcode ? current : ''));
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setShowBarcodeScanner(true)}
                  >
                    Scan
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  Mobile camera scan fills the barcode field automatically.
                </div>
                {lastScannedBarcode && (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12, fontWeight: 600 }}>
                    Scanned successfully: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{lastScannedBarcode}</span>
                  </div>
                )}
              </div>

              </div>

              <div className="flow-step-panel" style={{ display: productStep === 1 ? 'block' : 'none' }}>
              <div className="flow-section-kicker"><span>Pricing</span><span>Cost and margin</span></div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Cost Price</label>
                  <input className="form-input" type="number" step="0.01" placeholder="Cost price" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price *</label>
                  <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
              </div>

              {/* Live margin preview */}
              {form.cost_price && form.price && Number(form.cost_price) > 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Margin: </span>
                  <strong style={{ color: '#059669' }}>
                    {(((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)}%
                  </strong>
                  <span style={{ color: '#6b7280', marginLeft: 8 }}>
                    (Rs {(Number(form.price) - Number(form.cost_price)).toFixed(2)} profit per unit)
                  </span>
                </div>
              )}

              </div>

              <div className="flow-step-panel" style={{ display: productStep === 2 ? 'block' : 'none' }}>
              <div className="flow-section-kicker"><span>Tax & Stock</span><span>GST, unit and alerts</span></div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {editProduct ? 'Quantity' : 'Opening Stock *'}
                  </label>
                  <input className="form-input" type="number" min="0"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    required={!editProduct} />
                    {editProduct && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Use the Stock action to adjust inventory.</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" placeholder="kg, pcs, box, litre..." value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">HSN/SAC Code</label>
                  <input
                    className="form-input"
                    placeholder="e.g. 8471"
                    value={form.hsn_code}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                      const prefix = parseInt(value.slice(0, 2), 10);
                      const nextSuggestedRate = HSN_GST_HINTS[prefix];
                      setForm(current => ({
                        ...current,
                        hsn_code: value,
                        gst_rate: nextSuggestedRate ?? current.gst_rate,
                      }));
                    }}
                  />
                  {suggestedGstRate !== undefined && (
                    <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>
                      Suggested GST: {suggestedGstRate}% based on HSN
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">GST Rate</label>
                  <select className="form-input" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: parseInt(e.target.value) })}>
                    <option value={0}>0% - No GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                  {suggestedGstRate !== undefined && form.gst_rate !== suggestedGstRate && (
                    <button type="button" className="btn-ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => setForm(current => ({ ...current, gst_rate: suggestedGstRate }))}>
                      Apply suggested {suggestedGstRate}% GST
                    </button>
                  )}
                </div>
              </div>

              {/* Low stock threshold */}
              <div className="form-group">
                <label className="form-label">Low Stock Alert Threshold</label>
                <input className="form-input" type="number" min="0"
                  placeholder="e.g. 5 (alert when stock <= this)"
                  value={form.low_stock_threshold}
                  onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  Default: 5 - you will see an alert when stock falls below this.
                </div>
              </div>

              {form.price && form.gst_rate > 0 && (
                <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#6d28d9', marginBottom: 2 }}>GST Preview</div>
                  <div style={{ color: '#7c3aed' }}>
                    Rs {parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% GST = <strong>Rs {(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              </div>

              <div className="flow-actions">
                {productStep > 0 && (
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setProductStep((current) => current - 1)}>
                    Back
                  </button>
                )}
                {productStep < 2 ? (
                  <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setProductStep((current) => current + 1)}>
                    Continue
                  </button>
                ) : (
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                    {editProduct ? 'Update Product' : 'Add Product'}
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showStockModal && stockProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              Stock Adjust - {stockProduct.name}
            </h3>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>
              Current Stock: <strong style={{ color: '#0f172a' }}>{stockProduct.quantity} {stockProduct.unit || 'pcs'}</strong>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.14)', color: '#fecaca', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <form onSubmit={handleStockAdjust}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { val: 'manual_add', label: 'Add Stock', color: '#10b981' },
                    { val: 'manual_remove', label: 'Remove Stock', color: '#ef4444' },
                    { val: 'adjustment', label: 'Correction', color: '#6366f1' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setStockForm({ ...stockForm, type: opt.val })}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, border: '2px solid',
                        borderColor: stockForm.type === opt.val ? opt.color : '#e5e7eb',
                        background: stockForm.type === opt.val ? opt.color : '#f9fafb',
                        color: stockForm.type === opt.val ? '#fff' : '#374151',
                        cursor: 'pointer', fontWeight: 700, fontSize: 11,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1"
                  placeholder="How many units?"
                  value={stockForm.quantity}
                  onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })}
                  required />
                {stockForm.quantity && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    New stock will be: <strong>
                      {stockForm.type === 'manual_remove'
                        ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity))
                        : stockProduct.quantity + Number(stockForm.quantity)
                      } {stockProduct.unit || 'pcs'}
                    </strong>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="Reason for adjustment..."
                  value={stockForm.note}
                  onChange={e => setStockForm({ ...stockForm, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={stockSubmitting}
                  style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#04150b', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {stockSubmitting ? 'Saving...' : 'Update Stock'}
                </button>
                <button type="button" onClick={() => { setShowStockModal(false); setError(''); }}
                  style={{ flex: 1, padding: '10px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showHistory && historyProduct && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                  Stock History - {historyProduct.name}
                </h3>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Current: <strong>{historyProduct.quantity} {historyProduct.unit || 'pcs'}</strong>
                </div>
              </div>
              <button onClick={() => setShowHistory(false)}
                style={{ padding: '6px 12px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 30 }}>Loading stock history...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 30 }}>No stock history found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historyData.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: '#f8fafc', borderRadius: 8,
                    borderLeft: `3px solid ${h.quantity_change > 0 ? '#10b981' : '#ef4444'}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {historyTypeLabel(h.type)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {new Date(h.date).toLocaleDateString('en-IN')} • {h.note || '-'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: h.quantity_change > 0 ? '#10b981' : '#ef4444' }}>
                        {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {'->'} {h.quantity_after} {historyProduct.unit || 'pcs'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CameraBarcodeScanner
        open={showBarcodeScanner}
        title="Scan product barcode"
        description="Camera scan se barcode field auto-fill ho jayegi."
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={handleBarcodeDetected}
      />

      <style>{`
        .product-shell .product-hero { border: 1px solid rgba(186, 230, 253, 0.8); }
        .product-shell .card[style*='borderLeft'] { background: #ffffff !important; }

        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }
      `}</style>
    </Layout>
  );
}

