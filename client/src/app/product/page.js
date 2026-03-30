'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
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
  const [openMenuId, setOpenMenuId] = useState('');

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
  const liveMargin = (() => {
    const cost = Number(form.cost_price || 0);
    const price = Number(form.price || 0);
    if (!cost || !price || cost <= 0) return null;
    return ((price - cost) / cost) * 100;
  })();
  const liveMarginColor = liveMargin === null ? '#555870' : liveMargin > 20 ? '#00C896' : liveMargin >= 10 ? '#FFB347' : '#FF6B6B';
  const liveMarginBg = liveMargin === null ? '#1E2235' : liveMargin > 20 ? '#00C89618' : liveMargin >= 10 ? '#FFB34718' : '#FF6B6B18';
  // â”€â”€ Badge helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const StockBadge = ({ p }) => {
    if (p.quantity === 0) return <span className="badge badge-red">Out</span>;
    if (p.is_low_stock)   return <span className="badge badge-yellow">Low ({p.quantity})</span>;
    return <span className="badge badge-green">In Stock</span>;
  };

  const GSTBadge = ({ rate }) => {
    if (rate === null || rate === undefined) return <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>;
    return <span style={{ background: '#e0f2fe', color: '#0c4a6e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>GST {rate}%</span>;
  };

  const MarginBadge = ({ margin }) => {
    if (margin === null || margin === undefined) return <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>;
    const color = margin > 20 ? '#00C896' : margin >= 10 ? '#FFB347' : '#FF6B6B';
    const bg    = margin > 20 ? '#00C89618' : margin >= 10 ? '#FFB34718' : '#FF6B6B18';
    return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{margin}%</span>;
  };

  const historyTypeLabel = (type) => ({
    purchase: 'Purchase',
    sale: 'Sale',
    manual_add: 'Added',
    manual_remove: 'Removed',
    adjustment: 'Adjusted',
  }[type] || type);

  const getProductSubLabel = (product) => {
    if (product.description?.trim()) return product.description;
    const parts = [];
    if (product.barcode) parts.push(`Barcode ${product.barcode}`);
    if (product.hsn_code) parts.push(`HSN ${product.hsn_code}`);
    if (product.unit) parts.push(product.unit);
    return parts.join(' • ') || 'General stock item';
  };

  return (
    <Layout>
      <div className="page-shell product-shell">
        <section className="card page-header-card">
          <div className="page-toolbar">
            <div>
              <div className="page-title page-header-title">उत्पाद / Products</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Your complete product catalog</div>
            </div>
            <button onClick={openAdd} className="btn-primary" style={{ width: 'auto' }}>+ उत्पाद जोड़ें / Add Product</button>
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
            <div className="metric-value" style={{ color: '#0f766e' }}>₹{totalValue.toFixed(0)}</div>
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
          <div className="product-card-grid">
            {filtered.map((p) => (
              <article
                key={p._id}
                className="card product-stock-card"
                style={{ borderLeft: `3px solid ${p.quantity === 0 ? '#FF6B6B' : p.is_low_stock ? '#FFB347' : '#00C896'}` }}
              >
                <div className="product-card-top">
                  <div style={{ minWidth: 0 }}>
                    <div className="product-card-title">{p.name}</div>
                    <div className="product-card-subtitle">{getProductSubLabel(p)}</div>
                  </div>
                  <StockBadge p={p} />
                </div>

                <div className="product-data-row">
                  <div className="product-data-point">
                    <div className="product-data-label">Cost</div>
                    <div className="product-data-value">{p.cost_price ? `₹${p.cost_price}` : '-'}</div>
                  </div>
                  <div className="product-data-point">
                    <div className="product-data-label">Price</div>
                    <div className="product-data-value">₹{p.price}</div>
                  </div>
                  <div className="product-data-point">
                    <div className="product-data-label">Margin</div>
                    <div><MarginBadge margin={p.margin} /></div>
                  </div>
                  <div className="product-data-point">
                    <div className="product-data-label">Qty</div>
                    <div className="product-data-value" style={{ color: p.quantity === 0 ? '#FF6B6B' : p.is_low_stock ? '#FFB347' : '#00C896' }}>
                      {p.quantity} <span style={{ color: '#8B8FA8', fontWeight: 600 }}>{p.unit || ''}</span>
                    </div>
                  </div>
                  <div className="product-data-point">
                    <div className="product-data-label">GST</div>
                    <div><GSTBadge rate={p.gst_rate} /></div>
                  </div>
                </div>

                <div className="product-card-actions">
                  <button onClick={() => openStockAdjust(p)} className="btn-ghost product-action-btn">Stock</button>
                  <button onClick={() => openHistory(p)} className="btn-ghost product-action-btn">History</button>
                  <button onClick={() => openEdit(p)} className="btn-primary product-action-btn">Edit</button>
                  <div className="product-overflow">
                    <button
                      type="button"
                      className="btn-ghost product-overflow-trigger"
                      onClick={() => setOpenMenuId((current) => current === p._id ? '' : p._id)}
                      aria-label="More product actions"
                    >
                      ···
                    </button>
                    {openMenuId === p._id ? (
                      <div className="product-overflow-menu">
                        <button type="button" className="product-overflow-delete" onClick={() => { setOpenMenuId(''); handleDelete(p._id); }}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* â”€â”€ Add/Edit Modal â”€â”€ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal flow-modal product-form-modal product-form-modal--fullscreen">
            <div className="flow-modal-header product-form-header">
              <div>
                <h3 className="product-form-title">
              {editProduct ? 'उत्पाद अपडेट करें / Edit Product' : 'उत्पाद जोड़ें / Add Product'}
                </h3>
                <div className="product-form-subtitle">Pricing, stock, GST, and margin in one clean inventory form.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="flow-muted-chip">{editProduct ? 'Editing product' : 'New product'}</div>
                <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Close add product modal">×</button>
              </div>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.14)', color: '#fecaca', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <form onSubmit={handleSubmit} className="product-form-shell">
              <div className="flow-section-kicker"><span>बेसिक जानकारी / Basics</span></div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">नाम / NAME *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">विवरण / DESCRIPTION</label>
                  <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">बारकोड / BARCODE</label>
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

              <div className="flow-section-kicker"><span>मूल्य निर्धारण / Pricing</span></div>
              <div className="product-pricing-grid">
                <div className="form-group">
                  <label className="form-label">लागत मूल्य / COST PRICE</label>
                  <input className="form-input" type="number" step="0.01" placeholder="Cost price" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="product-margin-live-pill" style={{ background: liveMarginBg, color: liveMarginColor, borderColor: `${liveMarginColor}40` }}>
                  <span>MARGIN</span>
                  <strong>{liveMargin === null ? '--' : `${liveMargin.toFixed(1)}%`}</strong>
                </div>
                <div className="form-group">
                  <label className="form-label">बिक्री मूल्य / SELLING PRICE ₹ *</label>
                  <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
              </div>

              {liveMargin !== null && (
                <div className="product-margin-note">
                  <span>Live margin preview</span>
                  <strong style={{ color: liveMarginColor }}>₹{(Number(form.price) - Number(form.cost_price)).toFixed(2)} profit per unit</strong>
                </div>
              )}
              <div className="flow-section-kicker"><span>कर और स्टॉक / Tax & Stock</span></div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {editProduct ? 'मात्रा / QUANTITY' : 'शुरुआती स्टॉक / OPENING STOCK *'}
                  </label>
                  <input className="form-input" type="number" min="0"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    required={!editProduct} />
                    {editProduct && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Use the Stock action to adjust inventory.</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">इकाई / UNIT</label>
                  <input className="form-input" placeholder="pcs, kg, L, box..." value={form.unit || 'pcs'} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">एचएसएन / एसएसी कोड / HSN/SAC CODE</label>
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
                  <label className="form-label">जीएसटी दर / GST RATE</label>
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
                <label className="form-label">लो स्टॉक अलर्ट / LOW STOCK ALERT</label>
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
                    ₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% GST = <strong>₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="flow-actions">
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editProduct ? 'उत्पाद अपडेट करें / Update Product' : 'उत्पाद जोड़ें / Save Product'}
                </button>
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
        .product-shell .product-hero { border: 1px solid rgba(108, 99, 255, 0.22); }
        .product-shell .card[style*='borderLeft'] { background: rgba(22, 25, 41, 0.96) !important; }
        .product-card-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .product-stock-card {
          display: grid;
          gap: 16px;
        }
        .product-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .product-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #F0F0FF;
          line-height: 1.3;
        }
        .product-card-subtitle {
          margin-top: 6px;
          font-size: 12px;
          color: #8B8FA8;
          line-height: 1.5;
        }
        .product-data-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        .product-data-point {
          min-width: 0;
        }
        .product-data-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #555870;
          margin-bottom: 6px;
        }
        .product-data-value {
          font-size: 14px;
          font-weight: 600;
          color: #F0F0FF;
          white-space: nowrap;
        }
        .product-card-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          align-items: start;
        }
        .product-action-btn {
          width: 100%;
          justify-content: center;
        }
        .product-overflow {
          position: relative;
        }
        .product-overflow-trigger {
          width: 100%;
          justify-content: center;
          letter-spacing: 0.08em;
        }
        .product-overflow-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 120px;
          padding: 8px;
          background: #161929;
          border: 1px solid #FFFFFF0D;
          border-radius: 12px;
          z-index: 3;
        }
        .product-overflow-delete {
          width: 100%;
          min-height: 40px;
          border-radius: 10px;
          border: 1px solid #FF6B6B40;
          background: #FF6B6B18;
          color: #FF6B6B;
          font-size: 14px;
          font-weight: 600;
        }
        .product-form-modal--fullscreen {
          width: min(980px, calc(100vw - 24px));
          max-width: min(980px, calc(100vw - 24px)) !important;
          max-height: calc(100dvh - 24px) !important;
          overflow-y: auto !important;
          align-self: center !important;
          border-radius: 20px !important;
          padding: 24px;
        }
        .product-form-header {
          margin-bottom: 16px;
        }
        .product-form-title {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 700;
          color: #F0F0FF;
        }
        .product-form-subtitle {
          font-size: 14px;
          color: #8B8FA8;
        }
        .product-form-shell {
          display: grid;
          gap: 14px;
        }
        .product-pricing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          gap: 14px;
          align-items: end;
        }
        .product-margin-live-pill {
          min-width: 120px;
          min-height: 48px;
          display: grid;
          place-items: center;
          align-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #FFFFFF15;
          text-align: center;
        }
        .product-margin-live-pill span {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #555870;
        }
        .product-margin-live-pill strong {
          font-size: 14px;
          font-weight: 700;
        }
        .product-margin-note {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 10px 12px;
          border-radius: 12px;
          background: #1E2235;
          border: 1px solid #FFFFFF0D;
          font-size: 12px;
          color: #8B8FA8;
        }

        @media (max-width: 900px) {
          .product-card-grid {
            grid-template-columns: 1fr;
          }
          .product-pricing-grid {
            grid-template-columns: 1fr;
          }
          .product-form-modal--fullscreen {
            width: calc(100vw - 12px);
            max-width: calc(100vw - 12px) !important;
            max-height: calc(100dvh - 12px) !important;
            padding: 16px;
          }
        }

        @media (max-width: 640px) {
          .product-data-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .product-card-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </Layout>
  );
}

