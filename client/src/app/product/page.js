'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const HSN_GST_HINTS = { 84: 18, 85: 18, 30: 12, 61: 5, 62: 5, 64: 12, 90: 18 };
const PRODUCTS_CACHE_KEY = 'products-page';
const normalizeBarcode = (value = '') => String(value).replace(/\s+/g, '').trim();

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;
    const finalValue = Number.isFinite(Number(target)) ? Number(target) : 0;
    const tick = (timestamp) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      setValue(Math.round(finalValue * eased));
      if (progress < 1) frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, duration]);
  return value;
}

function CountNumber({ value, prefix = '', className = '', color }) {
  const animated = useCountUp(Math.abs(value));
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(animated);
  return <div className={className} style={color ? { color } : undefined}>{prefix}{formatted}</div>;
}

const SearchGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ChevronGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterStock, setFilterStock] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: 'pcs', barcode: '', hsn_code: '', gst_rate: 0, low_stock_threshold: 5 });
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ type: 'manual_add', quantity: '', note: '' });
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
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
    if (search) result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.description && p.description.toLowerCase().includes(search.toLowerCase())) || (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())));
    if (filterStock === 'low') result = result.filter((p) => p.quantity > 0 && p.is_low_stock);
    if (filterStock === 'out') result = result.filter((p) => p.quantity === 0);
    if (filterStock === 'instock') result = result.filter((p) => p.quantity > 0 && !p.is_low_stock);
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price_asc') result.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') result.sort((a, b) => b.price - a.price);
    if (sortBy === 'quantity') result.sort((a, b) => a.quantity - b.quantity);
    if (sortBy === 'margin') result.sort((a, b) => (b.margin || 0) - (a.margin || 0));
    setFiltered(result);
  }, [search, sortBy, filterStock, products]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextProducts = Array.isArray(data) ? data : data.products || [];
      setProducts(nextProducts);
      writePageCache(PRODUCTS_CACHE_KEY, { products: nextProducts });
      setCacheUpdatedAt(new Date().toISOString());
    } catch { setError('Products could not be loaded'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', cost_price: '', quantity: '', unit: 'pcs', barcode: '', hsn_code: '', gst_rate: 0, low_stock_threshold: 5 });
    setLastScannedBarcode('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, cost_price: p.cost_price || '', quantity: p.quantity, unit: p.unit || 'pcs', barcode: p.barcode || '', hsn_code: p.hsn_code || '', gst_rate: p.gst_rate || 0, low_stock_threshold: p.low_stock_threshold || 5 });
    setLastScannedBarcode('');
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!isOnline) { setError('Offline mode me product save nahi hoga. Internet on karke try karein.'); return; }
    const url = editProduct ? apiUrl(`/api/products/${editProduct._id}`) : apiUrl('/api/products');
    try {
      const res = await fetch(url, { method: editProduct ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(form) });
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
    if (!isOnline) { setError('Offline mode me product delete nahi hoga.'); return; }
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(apiUrl(`/api/products/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) fetchProducts();
      else {
        const d = await res.json();
        setError(d.message || 'Could not delete product');
      }
    } catch { setError('Server error'); }
  };

  const openStockAdjust = (p) => {
    setStockProduct(p);
    setStockForm({ type: 'manual_add', quantity: '', note: '' });
    setError('');
    setShowStockModal(true);
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault(); setError('');
    if (!isOnline) { setError('Offline mode me stock adjust nahi hoga.'); return; }
    setStockSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/products/${stockProduct._id}/adjust-stock`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(stockForm) });
      const data = await res.json();
      if (res.ok) { setShowStockModal(false); fetchProducts(); }
      else setError(data.message || 'Stock update failed');
    } catch { setError('Server error'); }
    setStockSubmitting(false);
  };

  const openHistory = async (p) => {
    if (!isOnline) { setError('Offline mode me stock history load nahi hogi.'); return; }
    setHistoryProduct(p);
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/products/${p._id}/stock-history`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch {}
    setHistoryLoading(false);
  };

  const lowStockCount = products.filter((p) => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter((p) => p.quantity === 0).length;
  const totalValue = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);
  const suggestedGstRate = (() => HSN_GST_HINTS[parseInt(String(form.hsn_code || '').slice(0, 2), 10)])();
  const cacheLabel = cacheUpdatedAt ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const historyTypeLabel = (type) => ({ purchase: 'Purchase', sale: 'Sale', manual_add: 'Added', manual_remove: 'Removed', adjustment: 'Adjusted' }[type] || type);
  const formatCurrency = (value) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
  const getStatusMeta = (product) => product.quantity === 0
    ? { border: '#F43F5E', badgeClass: 'bg-rose-50 text-rose-600 border border-rose-200', badgeLabel: 'Out of Stock', qtyColor: '#F43F5E' }
    : product.is_low_stock
      ? { border: '#F59E0B', badgeClass: 'bg-amber-50 text-amber-600 border border-amber-200', badgeLabel: `Low Stock • ${product.quantity}`, qtyColor: '#F59E0B' }
      : { border: '#34D399', badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200', badgeLabel: 'In Stock', qtyColor: '#6366F1' };
  const getMarginMeta = (margin) => margin === null || margin === undefined ? { className: 'bg-slate-100 text-slate-500', label: '-' } : margin > 30 ? { className: 'bg-emerald-50 text-emerald-700', label: `${margin}%` } : margin >= 10 ? { className: 'bg-amber-50 text-amber-700', label: `${margin}%` } : { className: 'bg-rose-50 text-rose-700', label: `${margin}%` };
  const metricCards = [
    { label: 'Total Products', value: products.length, note: 'Catalog in your inventory', color: '#6366F1', border: '#6366F1', prefix: '' },
    { label: 'Low Stock', value: lowStockCount, note: 'Need reorder attention', color: '#F59E0B', border: '#F59E0B', prefix: '' },
    { label: 'Out of Stock', value: outOfStockCount, note: 'Unavailable for sale', color: '#F43F5E', border: '#F43F5E', prefix: '' },
    { label: 'Inventory Value', value: totalValue, note: 'Based on cost price', color: '#0CAF60', border: '#0CAF60', prefix: '₹' },
  ];

  return (
    <Layout>
      <div className="premium-page">
        <section className="premium-panel stagger-item p-6" style={{ animationDelay: '0ms' }}>
          <div className="premium-header-row">
            <div className="grid gap-3">
              <div className="premium-kicker">Inventory control</div>
              <div>
                <h1 className="premium-page-title" style={{ fontSize: '2rem' }}>Products</h1>
                <div className="mt-4 premium-sync-inline">
                  <span className="premium-sync-dot" />
                  <span>{refreshing ? 'Refreshing latest inventory...' : !isOnline ? `Offline inventory snapshot${cacheLabel ? ` • last updated ${cacheLabel}` : ''}` : cacheLabel ? `Inventory ready • last synced ${cacheLabel}` : 'Inventory synced and ready'}</span>
                </div>
              </div>
            </div>
            <button onClick={openAdd} className="premium-primary-btn premium-shimmer-btn" disabled={!isOnline} type="button">+ Add Product</button>
          </div>
        </section>

        {!isOnline ? <section className="premium-alert stagger-item" style={{ animationDelay: '80ms' }}><strong>Offline inventory mode</strong><div className="mt-2 text-sm">Products are visible from the cached snapshot. Add, edit, delete, and stock actions will work again once internet is back.</div></section> : null}

        <section className="premium-metric-grid">
          {metricCards.map((card, index) => (
            <div key={card.label} className="premium-metric-card premium-metric-left-accent stagger-item p-6" style={{ animationDelay: `${(index + 1) * 80}ms`, borderLeftColor: card.border }}>
              <div className="premium-metric-label">{card.label}</div>
              <CountNumber value={card.value} prefix={card.prefix} className="premium-metric-value" color={card.color} />
              <div className="premium-metric-note">{card.note}</div>
            </div>
          ))}
        </section>

        <section className="premium-toolbar-card stagger-item" style={{ animationDelay: '400ms' }}>
          <div className="premium-toolbar-grid">
            <div className="premium-search-wrap">
              <span className="premium-search-icon"><SearchGlyph /></span>
              <input className="form-input premium-search-input" placeholder="Search products, descriptions, or barcodes" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="premium-select-wrap">
              <select className="form-input" value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
                <option value="all">All Status</option><option value="instock">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
              </select>
              <span className="premium-select-chevron"><ChevronGlyph /></span>
            </div>
            <div className="premium-select-wrap">
              <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Name</option><option value="price_asc">Price Low to High</option><option value="price_desc">Price High to Low</option><option value="quantity">Qty Low to High</option><option value="margin">Margin High to Low</option>
              </select>
              <span className="premium-select-chevron"><ChevronGlyph /></span>
            </div>
            {(search || filterStock !== 'all') ? <button type="button" onClick={() => { setSearch(''); setFilterStock('all'); }} className="premium-secondary-btn">Clear</button> : <div />}
          </div>
        </section>

        {error && !showModal && !showStockModal ? <div className="alert-error">{error}</div> : null}

        {loading ? (
          <div className="premium-product-grid">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="premium-product-card p-6"><div className="skeleton h-6 w-40" /><div className="skeleton mt-3 h-4 w-56" /><div className="skeleton mt-6 h-20 w-full" /></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="premium-empty-state"><div className="text-lg font-semibold text-slate-500">{search || filterStock !== 'all' ? 'No products found' : 'No products yet. Add your first product.'}</div></div>
        ) : (
          <section className="premium-product-grid">
            {filtered.map((product, index) => {
              const status = getStatusMeta(product);
              const margin = getMarginMeta(product.margin);
              return (
                <article key={product._id} className="premium-product-card stagger-item" style={{ animationDelay: `${480 + (index * 80)}ms`, borderLeftColor: status.border }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="premium-product-name">{product.name}</div>
                      <div className="mt-2 text-sm text-slate-400">{product.description || 'No description'}{product.barcode ? ` • Barcode ${product.barcode}` : ''}{product.hsn_code ? ` • HSN ${product.hsn_code}` : ''}</div>
                    </div>
                    <span className={`premium-status-badge ${status.badgeClass}`}>{status.badgeLabel}</span>
                  </div>
                  <div className="premium-stat-grid">
                    <div><div className="premium-mini-label">Cost</div><div className="premium-mini-value">{product.cost_price ? formatCurrency(product.cost_price) : '-'}</div></div>
                    <div><div className="premium-mini-label">Price</div><div className="premium-mini-value">{formatCurrency(product.price)}</div></div>
                    <div><div className="premium-mini-label">Margin</div><div className="mt-2"><span className={`premium-margin-pill ${margin.className}`}>{margin.label}</span></div></div>
                    <div><div className="premium-mini-label">Qty</div><div className="premium-mini-value" style={{ color: status.qtyColor }}>{product.quantity} <span className="text-slate-400">{product.unit || 'pcs'}</span></div></div>
                    <div><div className="premium-mini-label">GST</div><div className="mt-2"><span className="premium-gst-pill bg-slate-100 text-slate-500">{product.gst_rate === null || product.gst_rate === undefined ? '-' : `GST ${product.gst_rate}%`}</span></div></div>
                  </div>
                  <div className="mt-4 text-sm text-slate-400">Unit: {product.unit || 'pcs'}{product.low_stock_threshold !== 5 ? ` • Alert <= ${product.low_stock_threshold}` : ''}</div>
                  <div className="premium-product-actions">
                    <button type="button" onClick={() => openStockAdjust(product)} className="premium-action-pill stock">Stock</button>
                    <button type="button" onClick={() => openHistory(product)} className="premium-action-pill history">History</button>
                    <button type="button" onClick={() => openEdit(product)} className="premium-action-pill edit">Edit</button>
                    <button type="button" onClick={() => handleDelete(product._id)} className="premium-action-pill delete">Delete</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {showModal ? (
        <div className="modal-overlay premium-modal-shell">
          <div className="modal flow-modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flow-modal-header">
              <div>
                <div className="premium-kicker">{editProduct ? 'Update item' : 'New inventory item'}</div>
                <h3 className="premium-modal-title mt-2">{editProduct ? 'Edit Product' : 'Add Product'}</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{editProduct ? 'Editing' : 'Create'}</div>
                <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Close add product modal">×</button>
              </div>
            </div>
            {error ? <div className="alert-error mt-4">{error}</div> : null}
            <form onSubmit={handleSubmit} className="mt-6">
              <div className="flow-section-kicker"><span>Basics</span></div>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Barcode</label>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input className="form-input" placeholder="Scan or type barcode" value={form.barcode} onChange={(e) => {
                    const normalizedBarcode = normalizeBarcode(e.target.value);
                    setForm({ ...form, barcode: normalizedBarcode });
                    setLastScannedBarcode((current) => (current === normalizedBarcode ? current : ''));
                  }} />
                  <button type="button" className="premium-secondary-btn" onClick={() => setShowBarcodeScanner(true)}>Scan</button>
                </div>
                <div className="mt-2 text-xs text-slate-400">Mobile camera scan fills the barcode field automatically.</div>
                {lastScannedBarcode ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Scanned successfully: <span className="font-mono">{lastScannedBarcode}</span></div> : null}
              </div>

              <div className="flow-section-kicker"><span>Pricing</span></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-group"><label className="form-label">Cost Price</label><input className="form-input" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Selling Price *</label><input className="form-input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
              </div>
              {form.cost_price && form.price && Number(form.cost_price) > 0 ? <div className="mb-4 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Margin: {(((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)}%<span className="ml-2 text-emerald-600">• ₹{(Number(form.price) - Number(form.cost_price)).toFixed(2)} per unit</span></div> : null}

              <div className="flow-section-kicker"><span>Tax & Stock</span></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">{editProduct ? 'Quantity' : 'Opening Stock *'}</label>
                  <input className="form-input" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required={!editProduct} />
                  {editProduct ? <div className="mt-2 text-xs text-slate-400">Use the Stock action to adjust inventory.</div> : null}
                </div>
                <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={form.unit || 'pcs'} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-group">
                  <label className="form-label">HSN/SAC Code</label>
                  <input className="form-input" placeholder="e.g. 8471" value={form.hsn_code} onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                    const prefix = parseInt(value.slice(0, 2), 10);
                    const nextSuggestedRate = HSN_GST_HINTS[prefix];
                    setForm((current) => ({ ...current, hsn_code: value, gst_rate: nextSuggestedRate ?? current.gst_rate }));
                  }} />
                  {suggestedGstRate !== undefined ? <div className="mt-2 text-xs text-indigo-600">Suggested GST: {suggestedGstRate}% based on HSN</div> : null}
                </div>
                <div className="form-group">
                  <label className="form-label">GST Rate</label>
                  <div className="premium-select-wrap">
                    <select className="form-input" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: parseInt(e.target.value) })}>
                      <option value={0}>0% - No GST</option><option value={5}>5% GST</option><option value={12}>12% GST</option><option value={18}>18% GST</option><option value={28}>28% GST</option>
                    </select>
                    <span className="premium-select-chevron"><ChevronGlyph /></span>
                  </div>
                  {suggestedGstRate !== undefined && form.gst_rate !== suggestedGstRate ? <button type="button" className="premium-secondary-btn mt-3 w-full" onClick={() => setForm((current) => ({ ...current, gst_rate: suggestedGstRate }))}>Apply suggested {suggestedGstRate}% GST</button> : null}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Low Stock Alert Threshold</label>
                <input className="form-input" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                <div className="mt-2 text-xs text-slate-400">Default: 5 - you will see an alert when stock falls below this.</div>
              </div>
              {form.price && form.gst_rate > 0 ? <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-700"><div className="font-semibold">GST Preview</div><div className="mt-1">₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% GST =<strong> ₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong></div></div> : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" className="premium-primary-btn flex-1">{editProduct ? 'Update Product' : 'Add Product'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="premium-secondary-btn flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showStockModal && stockProduct ? (
        <div className="modal-overlay premium-modal-shell">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="premium-kicker">Inventory movement</div>
            <h3 className="premium-modal-title mt-2">Stock Adjust - {stockProduct.name}</h3>
            <div className="mt-3 text-sm text-slate-400">Current Stock: <strong className="text-slate-900">{stockProduct.quantity} {stockProduct.unit || 'pcs'}</strong></div>
            {error ? <div className="alert-error mt-4">{error}</div> : null}
            <form onSubmit={handleStockAdjust} className="mt-6">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <div className="premium-choice-group">
                  {[{ val: 'manual_add', label: 'Add Stock', color: '#0CAF60' }, { val: 'manual_remove', label: 'Remove Stock', color: '#F43F5E' }, { val: 'adjustment', label: 'Correction', color: '#6366F1' }].map((opt) => (
                    <button key={opt.val} type="button" onClick={() => setStockForm({ ...stockForm, type: opt.val })} className={`premium-choice-chip${stockForm.type === opt.val ? ' is-active' : ''}`} style={stockForm.type === opt.val ? { background: opt.color } : undefined}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} required />
                {stockForm.quantity ? <div className="mt-2 text-xs text-slate-400">New stock will be:<strong className="ml-1 text-slate-900">{stockForm.type === 'manual_remove' ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity)) : stockProduct.quantity + Number(stockForm.quantity)} {stockProduct.unit || 'pcs'}</strong></div> : null}
              </div>
              <div className="form-group"><label className="form-label">Note</label><input className="form-input" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} /></div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" disabled={stockSubmitting} className="premium-primary-btn flex-1">{stockSubmitting ? 'Saving...' : 'Update Stock'}</button>
                <button type="button" onClick={() => { setShowStockModal(false); setError(''); }} className="premium-secondary-btn flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showHistory && historyProduct ? (
        <div className="modal-overlay premium-modal-shell">
          <div className="modal" style={{ maxWidth: 620, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="premium-kicker">Activity log</div>
                <h3 className="premium-modal-title mt-2">Stock History - {historyProduct.name}</h3>
                <div className="mt-2 text-sm text-slate-400">Current: <strong className="text-slate-900">{historyProduct.quantity} {historyProduct.unit || 'pcs'}</strong></div>
              </div>
              <button type="button" onClick={() => setShowHistory(false)} className="premium-secondary-btn">Close</button>
            </div>
            {historyLoading ? <div className="py-10 text-center text-slate-400">Loading stock history...</div> : historyData.length === 0 ? <div className="py-10 text-center text-slate-400">No stock history found</div> : <div className="mt-6 grid gap-3">{historyData.map((item, index) => <div key={index} className="premium-history-row"><div><div className="font-semibold text-slate-900">{historyTypeLabel(item.type)}</div><div className="mt-1 text-sm text-slate-400">{new Date(item.date).toLocaleDateString('en-IN')} • {item.note || '-'}</div></div><div className="text-right"><div className="text-base font-bold" style={{ color: item.quantity_change > 0 ? '#0CAF60' : '#F43F5E' }}>{item.quantity_change > 0 ? '+' : ''}{item.quantity_change}</div><div className="mt-1 text-sm text-slate-400">→ {item.quantity_after} {historyProduct.unit || 'pcs'}</div></div></div>)}</div>}
          </div>
        </div>
      ) : null}

      <CameraBarcodeScanner open={showBarcodeScanner} title="Scan product barcode" description="Camera scan se barcode field auto-fill ho jayegi." onClose={() => setShowBarcodeScanner(false)} onDetected={handleBarcodeDetected} />
    </Layout>
  );
}
