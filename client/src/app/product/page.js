'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

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

function ProductGlyph({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'plus':
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'warning':
      return <svg {...common}><path d="M12 3 2.5 19h19L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    case 'stock':
      return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></svg>;
    case 'out':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9 9l6 6" /><path d="m15 9-6 6" /></svg>;
    case 'value':
      return <svg {...common}><path d="M12 3v18" /><path d="M16 7.5c0-2-1.8-3.5-4-3.5S8 5.5 8 7.5 9.8 11 12 11s4 1.5 4 3.5S14.2 18 12 18s-4-1.5-4-3.5" /></svg>;
    case 'box':
      return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /></svg>;
    case 'history':
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>;
    case 'edit':
      return <svg {...common}><path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" /><path d="m13.5 6.5 3 3" /></svg>;
    case 'delete':
      return <svg {...common}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 12h10l1-12" /><path d="M9 7V4h6v3" /></svg>;
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="3" /></svg>;
  }
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');
  const [isOnline, setIsOnline]   = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  // Filters
  const [search, setSearch]           = useState('');
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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PRODUCTS_CACHE_KEY);
    if (cached?.products) {
      setProducts(cached.products);
      setCacheUpdatedAt(cached.cachedAt || null);
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
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let result = [...products];
    if (search) result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    );
    result.sort((a, b) => a.name.localeCompare(b.name));
    setFiltered(result);
  }, [search, products]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextProducts = Array.isArray(data) ? data : data.products || [];
      setProducts(nextProducts);
      writePageCache(PRODUCTS_CACHE_KEY, { products: nextProducts });
      setCacheUpdatedAt(new Date().toISOString());
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
    if (!isOnline) {
      setError('Offline mode me product save nahi hoga. Internet on karke try karein.');
      return;
    }
    const url = editProduct
      ? apiUrl(`/api/products/${editProduct._id}`)
      : apiUrl('/api/products');
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
    if (!isOnline) {
      setError('Offline mode me product delete nahi hoga.');
      return;
    }
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(apiUrl(`/api/products/${id}`), {
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
    if (!isOnline) {
      setError('Offline mode me stock adjust nahi hoga.');
      return;
    }
    setStockSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/products/${stockProduct._id}/adjust-stock`), {
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
    if (!isOnline) {
      setError('Offline mode me stock history load nahi hogi.');
      return;
    }
    setHistoryProduct(p);
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/products/${p._id}/stock-history`), {
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
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const formatMoney = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value || 0));
  const getStatusTone = (p) => (p.quantity === 0 ? 'out' : p.is_low_stock ? 'low' : 'ok');
  const getStatusLabel = (p) => (p.quantity === 0 ? 'Out' : p.is_low_stock ? 'Low stock' : 'In stock');
  // â”€â”€ Badge helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const StockBadge = ({ p }) => {
    if (p.quantity === 0) return <span className="product-status-badge is-out">Out (0)</span>;
    if (p.is_low_stock)   return <span className="product-status-badge is-low">Low ({p.quantity})</span>;
    return <span className="product-status-badge is-in">In Stock</span>;
  };

  const GSTBadge = ({ rate }) => {
    if (rate === null || rate === undefined) return <span className="product-metric-muted">-</span>;
    return <span className="product-gst-badge">GST {rate}%</span>;
  };

  const MarginBadge = ({ margin }) => {
    if (margin === null || margin === undefined) return <span className="product-metric-muted">-</span>;
    const tierClass = margin > 50 ? 'is-high' : margin >= 30 ? 'is-mid' : 'is-low';
    return <span className={`product-margin-badge ${tierClass}`}>{margin}%</span>;
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
        <section className="card product-hero">
          <div className="page-toolbar product-hero-toolbar">
            <div className="product-hero-copy">
              <div className="page-title" style={{ color: '#0f172a', marginBottom: 0 }}>Products</div>
              <div className="product-hero-subtitle">
                Manage catalog with precision
              </div>
            </div>
            <button onClick={openAdd} className="btn-primary product-add-button" disabled={!isOnline}>
              <ProductGlyph name="plus" size={18} /> Add Product
            </button>
          </div>
        </section>

        {!isOnline ? (
          <div className="card" style={{ border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' }}>
            <strong>Offline inventory mode</strong>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Products list cached snapshot se dikh rahi hai. Add, edit, delete aur stock actions internet wapas aane par hi chalenge.
            </div>
          </div>
        ) : null}

        <section className="product-stats-grid">
          <div className="product-stat-card product-stat-total">
            <div className="product-stat-top">
              <div className="product-stat-label">TOTAL PRODUCTS</div>
              <div className="product-stat-icon"><ProductGlyph name="box" /></div>
            </div>
            <div className="product-stat-value">{products.length}</div>
            <div className="product-stat-note">Catalog items</div>
          </div>
          <div className="product-stat-card product-stat-low">
            <div className="product-stat-top">
              <div className="product-stat-label">LOW STOCK</div>
              <div className="product-stat-icon"><ProductGlyph name="warning" /></div>
            </div>
            <div className="product-stat-value">{lowStockCount}</div>
            <div className="product-stat-note">Needs reorder</div>
          </div>
          <div className="product-stat-card product-stat-out">
            <div className="product-stat-top">
              <div className="product-stat-label">OUT OF STOCK</div>
              <div className="product-stat-icon"><ProductGlyph name="out" /></div>
            </div>
            <div className="product-stat-value">{outOfStockCount}</div>
            <div className="product-stat-note">Unavailable now</div>
          </div>
          <div className="product-stat-card product-stat-value-card">
            <div className="product-stat-top">
              <div className="product-stat-label">INVENTORY VALUE</div>
              <div className="product-stat-icon"><ProductGlyph name="value" /></div>
            </div>
            <div className="product-stat-value">₹{formatMoney(totalValue)}</div>
            <div className="product-stat-note">At cost value</div>
          </div>
        </section>

        <div className="toolbar-card product-filters-card">
          <div className="product-filters-toolbar">
            <div className="product-search-wrap">
              <span className="product-search-icon"><ProductGlyph name="search" /></span>
              <input className="form-input product-search-input"
                placeholder="Search products by name, barcode, or description"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="btn-ghost product-search-clear" style={{ width: 'auto' }}>
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
              <div key={index} className="skeleton" style={{ height: 110 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">PK</div>
            <div>{search ? 'No products found' : 'No products yet. Add your first product.'}</div>
          </div>
        ) : (
          <div className="product-list">
            {filtered.map(p => (
              <article key={p._id} className={`product-card product-card-${getStatusTone(p)}`}>
                <div className="product-card-top">
                  <div className="product-card-main">
                    <div className="product-card-copy">
                      <div className="product-card-title">{p.name}</div>
                    </div>
                  </div>
                  <div className={`product-status-badge ${getStatusTone(p) === 'out' ? 'is-out' : getStatusTone(p) === 'low' ? 'is-low' : 'is-in'}`}>
                    {getStatusLabel(p)}
                  </div>
                </div>

                <div className="product-metrics-row">
                  <span className="product-metric-inline">Cost <strong>{p.cost_price ? `₹${formatMoney(p.cost_price)}` : '-'}</strong></span>
                  <span className="product-metric-inline">Price <strong>₹{formatMoney(p.price)}</strong></span>
                  <span className={`product-metric-inline product-metric-inline-margin ${p.margin > 50 ? 'is-high' : p.margin >= 30 ? 'is-mid' : 'is-low'}`}>Margin <strong>{p.margin ?? '-'}%</strong></span>
                  <span className={`product-metric-inline product-metric-inline-qty is-${getStatusTone(p)}`}>Qty <strong>{p.quantity}</strong></span>
                </div>

                <div className="product-card-footer">
                  <div className="product-card-taxline">
                    <GSTBadge rate={p.gst_rate} />
                  </div>
                  <div className="product-card-actions">
                  <button onClick={() => openStockAdjust(p)}
                    className="product-icon-button stock"
                    aria-label={`Adjust stock for ${p.name}`}>
                    <ProductGlyph name="stock" size={16} />
                  </button>
                  <button onClick={() => openHistory(p)}
                    className="product-icon-button history"
                    aria-label={`View history for ${p.name}`}>
                    <ProductGlyph name="history" size={16} />
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="product-icon-button edit"
                    aria-label={`Edit ${p.name}`}>
                    <ProductGlyph name="edit" size={16} />
                  </button>
                  <button onClick={() => handleDelete(p._id)}
                    className="product-icon-button delete"
                    aria-label={`Delete ${p.name}`}>
                    <ProductGlyph name="delete" size={16} />
                  </button>
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
          <div className="modal flow-modal" style={{ maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', alignSelf: 'flex-end', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <div className="flow-modal-header">
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {editProduct ? 'Edit Product' : 'Add Product'}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="flow-muted-chip">{editProduct ? 'Editing product' : 'New product'}</div>
                <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Close add product modal">×</button>
              </div>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.14)', color: '#fecaca', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="flow-section-kicker"><span>Basics</span></div>
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

              <div className="flow-section-kicker"><span>Pricing</span></div>
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#166534', fontWeight: 700 }}>
                  <span>
                    Margin: {(((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)}%
                  </span>
                  <span style={{ color: '#15803d' }}>• ₹{(Number(form.price) - Number(form.cost_price)).toFixed(2)} per unit</span>
                </div>
              )}
              <div className="flow-section-kicker"><span>Tax & Stock</span></div>
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
                  <input className="form-input" placeholder="kg, pcs, box, litre..." value={form.unit || 'pcs'} onChange={e => setForm({ ...form, unit: e.target.value })} />
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
                    ₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% GST = <strong>₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="flow-actions">
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editProduct ? 'Update Product' : 'Add Product'}
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
    </Layout>
  );
}

