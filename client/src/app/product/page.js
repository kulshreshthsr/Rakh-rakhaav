'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import CameraBarcodeScanner from '../../components/CameraBarcodeScanner';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

/* ─── Constants & helpers (ALL UNCHANGED) ────────────────────────── */
const getToken = () => localStorage.getItem('token');
const HSN_GST_HINTS = { 84:18, 85:18, 30:12, 61:5, 62:5, 64:12, 90:18 };
const PRODUCTS_CACHE_KEY = 'products-page';
const normalizeBarcode = (v = '') => String(v).replace(/\s+/g, '').trim();

/* ─── Tiny SVG icons ─────────────────────────────────────────────── */
function Icon({ name, size = 16 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    scan:     <><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>,
    edit:     <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    stock:    <><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z"/><path d="M4 7.5V16.5L12 21l8-4.5V7.5"/><path d="M12 12v9"/></>,
    history:  <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    close:    <><path d="M18 6 6 18"/><path d="M6 6l12 12"/></>,
    alert:    <><path d="M10.3 3.3 1.5 18a2 2 0 0 0 1.7 3h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    package:  <><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z"/><path d="M4 7.5V16.5L12 21l8-4.5V7.5"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    filter:   <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  };
  return <svg {...p}>{icons[name]}</svg>;
}

/* ─── Stock badge ────────────────────────────────────────────────── */
function StockBadge({ p }) {
  if (p.quantity === 0)   return <span className="badge badge-red">Out of Stock</span>;
  if (p.is_low_stock)     return <span className="badge badge-yellow">Low ({p.quantity})</span>;
  return <span className="badge badge-green">In Stock</span>;
}

/* ─── Margin badge ───────────────────────────────────────────────── */
function MarginBadge({ margin }) {
  if (margin == null) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  const [bg, color] = margin >= 30 ? ['#ecfdf5', '#065f46'] : margin >= 15 ? ['#fffbeb', '#92400e'] : ['#fff1f2', '#9f1239'];
  return <span style={{ background: bg, color, padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>{margin}%</span>;
}

/* ─── GST badge ──────────────────────────────────────────────────── */
function GSTBadge({ rate }) {
  if (rate == null) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  return <span style={{ background: '#e0f2fe', color: '#0c4a6e', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>GST {rate}%</span>;
}

/* ─── History type label ─────────────────────────────────────────── */
const historyTypeLabel = (t) => ({ purchase: 'Purchase', sale: 'Sale', manual_add: 'Added', manual_remove: 'Removed', adjustment: 'Adjusted' }[t] || t);

/* ─── Modal overlay shell ────────────────────────────────────────── */
function ModalOverlay({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const router = useRouter();

  /* ── State (ALL UNCHANGED) ── */
  const [products,   setProducts]   = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [isOnline,   setIsOnline]   = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  const [search,      setSearch]      = useState('');
  const [sortBy,      setSortBy]      = useState('name');
  const [filterStock, setFilterStock] = useState('all');

  const [showModal,   setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', price:'', cost_price:'', quantity:'', unit:'pcs', barcode:'', hsn_code:'', gst_rate:0, low_stock_threshold:5 });
  const [showBarcodeScanner,  setShowBarcodeScanner]  = useState(false);
  const [lastScannedBarcode,  setLastScannedBarcode]  = useState('');

  const [showStockModal,  setShowStockModal]  = useState(false);
  const [stockProduct,    setStockProduct]    = useState(null);
  const [stockForm,       setStockForm]       = useState({ type:'manual_add', quantity:'', note:'' });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  const [showHistory,    setShowHistory]    = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData,    setHistoryData]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ── Effects (ALL UNCHANGED) ── */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(PRODUCTS_CACHE_KEY);
    if (cached?.products) { setProducts(cached.products); setCacheUpdatedAt(cached.cachedAt || null); setLoading(false); }
    const deferredId = scheduleDeferred(async () => { setRefreshing(Boolean(cached?.products)); await fetchProducts(); setRefreshing(false); });
    return () => cancelDeferred(deferredId);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    let r = [...products];
    if (search)              r = r.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.description && p.description.toLowerCase().includes(search.toLowerCase())) || (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())));
    if (filterStock === 'low')     r = r.filter(p => p.quantity > 0 && p.is_low_stock);
    if (filterStock === 'out')     r = r.filter(p => p.quantity === 0);
    if (filterStock === 'instock') r = r.filter(p => p.quantity > 0 && !p.is_low_stock);
    if (sortBy === 'name')         r.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price_asc')    r.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc')   r.sort((a, b) => b.price - a.price);
    if (sortBy === 'quantity')     r.sort((a, b) => a.quantity - b.quantity);
    if (sortBy === 'margin')       r.sort((a, b) => (b.margin || 0) - (a.margin || 0));
    setFiltered(r);
  }, [search, sortBy, filterStock, products]);

  /* ── All logic (ALL UNCHANGED) ── */
  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const next = Array.isArray(data) ? data : data.products || [];
      setProducts(next);
      writePageCache(PRODUCTS_CACHE_KEY, { products: next });
      setCacheUpdatedAt(new Date().toISOString());
    } catch { setError('Products could not be loaded'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name:'', description:'', price:'', cost_price:'', quantity:'', unit:'pcs', barcode:'', hsn_code:'', gst_rate:0, low_stock_threshold:5 });
    setLastScannedBarcode(''); setError(''); setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name:p.name, description:p.description||'', price:p.price, cost_price:p.cost_price||'', quantity:p.quantity, unit:p.unit||'pcs', barcode:p.barcode||'', hsn_code:p.hsn_code||'', gst_rate:p.gst_rate||0, low_stock_threshold:p.low_stock_threshold||5 });
    setLastScannedBarcode(''); setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!isOnline) { setError('Offline mode me product save nahi hoga.'); return; }
    const url = editProduct ? apiUrl(`/api/products/${editProduct._id}`) : apiUrl('/api/products');
    try {
      const res = await fetch(url, { method: editProduct ? 'PUT' : 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setShowModal(false); fetchProducts(); } else setError(data.message || 'Could not save product');
    } catch { setError('Server error'); }
  };

  const handleBarcodeDetected = (code) => {
    const nb = normalizeBarcode(code);
    setForm(c => ({ ...c, barcode: nb }));
    setLastScannedBarcode(nb);
    setShowBarcodeScanner(false);
  };

  const handleDelete = async (id) => {
    if (!isOnline) { setError('Offline mode me delete nahi hoga.'); return; }
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(apiUrl(`/api/products/${id}`), { method:'DELETE', headers:{ Authorization:`Bearer ${getToken()}` } });
      if (res.ok) fetchProducts(); else { const d = await res.json(); setError(d.message || 'Could not delete'); }
    } catch { setError('Server error'); }
  };

  const openStockAdjust = (p) => { setStockProduct(p); setStockForm({ type:'manual_add', quantity:'', note:'' }); setError(''); setShowStockModal(true); };

  const handleStockAdjust = async (e) => {
    e.preventDefault(); setError('');
    if (!isOnline) { setError('Offline mode me stock adjust nahi hoga.'); return; }
    setStockSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/products/${stockProduct._id}/adjust-stock`), { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` }, body: JSON.stringify(stockForm) });
      const data = await res.json();
      if (res.ok) { setShowStockModal(false); fetchProducts(); } else setError(data.message || 'Stock update failed');
    } catch { setError('Server error'); }
    setStockSubmitting(false);
  };

  const openHistory = async (p) => {
    if (!isOnline) { setError('Offline mode me stock history load nahi hogi.'); return; }
    setHistoryProduct(p); setShowHistory(true); setHistoryLoading(true);
    try {
      const res  = await fetch(apiUrl(`/api/products/${p._id}/stock-history`), { headers:{ Authorization:`Bearer ${getToken()}` } });
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch {}
    setHistoryLoading(false);
  };

  /* ── Computed stats ── */
  const lowStockCount   = products.filter(p => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const totalValue      = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);

  const suggestedGstRate = (() => {
    const prefix = parseInt(String(form.hsn_code || '').slice(0, 2), 10);
    return HSN_GST_HINTS[prefix];
  })();

  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : null;

  /* ── Live margin preview ── */
  const liveMargin = form.cost_price && form.price && Number(form.cost_price) > 0
    ? (((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)
    : null;
  const liveProfit = liveMargin != null
    ? (Number(form.price) - Number(form.cost_price)).toFixed(2)
    : null;

  /* ── Rank gradients for cards ── */
  const stockTypeConfig = {
    manual_add:    { label: 'Add Stock',   color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    manual_remove: { label: 'Remove Stock', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
    adjustment:    { label: 'Correction',  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="page-shell product-shell">

        {/* ── OFFLINE BANNER ── */}
        {!isOnline && (
          <div className="rr-banner-warn" role="status">
            <strong>Offline stock mode</strong>
            Products saved snapshot se dikh rahi hain. Add, edit, delete aur stock actions internet wapas aane par hi chalenge.
          </div>
        )}

        {/* ── HERO ── */}
        <div className="hero-panel product-hero">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p className="rr-page-eyebrow">Stock control · Inventory</p>
              <h1 className="page-title" style={{ marginTop:6 }}>स्टॉक / Products</h1>
              <p className={`rr-meta-line${!isOnline ? ' is-warn' : ''}`} style={{ marginTop:6 }}>
                {refreshing ? (
                  <><span className="status-dot is-yellow" style={{ marginRight:6 }} />Latest stock refresh ho raha hai...</>
                ) : !isOnline ? (
                  `Offline inventory snapshot${cacheLabel ? ` · last updated ${cacheLabel}` : ''}`
                ) : cacheLabel ? (
                  <><span className="status-dot is-green" style={{ marginRight:6 }} />Inventory ready · last synced {cacheLabel}</>
                ) : 'Aapka poora stock yahan ready hai'}
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              disabled={!isOnline}
              className="btn-primary"
              style={{ flexShrink:0, width:'auto', minHeight:42, padding:'0 20px', fontSize:13, gap:8 }}
            >
              <Icon name="plus" size={15} />
              Add Product
            </button>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12 }}>
          {[
            { label:'Total Products',   value:products.length,          sub:'In catalog',           bar:'linear-gradient(90deg,#6366f1,#8b5cf6)', valueColor:'#4338ca' },
            { label:'Low Stock',        value:lowStockCount,            sub:'Need reorder',          bar:'linear-gradient(90deg,#f59e0b,#f97316)', valueColor:'#92400e' },
            { label:'Out of Stock',     value:outOfStockCount,          sub:'Unavailable for sale',  bar:'linear-gradient(90deg,#f43f5e,#fb7185)', valueColor:'#9f1239' },
            { label:'Inventory Value',  value:`₹${Math.round(totalValue).toLocaleString('en-IN')}`, sub:'Based on cost price', bar:'linear-gradient(90deg,#10b981,#06b6d4)', valueColor:'#065f46' },
          ].map(k => (
            <div key={k.label} className="metric-card" style={{ borderRadius:20, overflow:'hidden', padding:0 }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:k.bar, borderRadius:'20px 20px 0 0' }} />
              <div style={{ padding:'18px 16px 14px' }}>
                <p className="metric-label" style={{ marginTop:3 }}>{k.label}</p>
                <p className="metric-value" style={{ color:k.valueColor, marginTop:8, fontSize:26 }}>{k.value}</p>
                <p className="page-subtitle" style={{ marginTop:6, fontSize:11 }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ── */}
        <div className="toolbar-card" style={{ borderRadius:20 }}>
          <div className="toolbar" style={{ gap:10, flexWrap:'wrap' }}>
            {/* Search */}
            <div style={{ flex:1, minWidth:200, position:'relative' }}>
              <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}>
                <Icon name="search" size={15} />
              </div>
              <input
                className="form-input"
                style={{ paddingLeft:36 }}
                placeholder="Search by name, barcode, description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* Stock filter */}
            <select className="form-input" style={{ width:140 }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
              <option value="all">All Stock</option>
              <option value="instock">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            {/* Sort */}
            <select className="form-input" style={{ width:160 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="quantity">Qty: Low → High</option>
              <option value="margin">Margin: High → Low</option>
            </select>
            {(search || filterStock !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterStock('all'); }} className="btn-ghost" style={{ width:'auto', minHeight:42, padding:'0 14px', fontSize:13 }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── PAGE ERROR ── */}
        {error && !showModal && !showStockModal && (
          <div className="alert-error">{error}</div>
        )}

        {/* ── LOADING SKELETON ── */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height:76, borderRadius:16 }} />
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="package" size={24} /></div>
            <p style={{ fontWeight:800, color:'#334155', fontSize:15, marginBottom:6 }}>
              {search || filterStock !== 'all' ? 'Koi product nahi mila' : 'Abhi koi product nahi hai'}
            </p>
            <p className="page-subtitle" style={{ maxWidth:220, margin:'0 auto 16px' }}>
              {search || filterStock !== 'all' ? 'Filter ya search badal kar dekhein' : 'Pehla product add karo aur inventory shuru karo'}
            </p>
            {!search && filterStock === 'all' && (
              <button onClick={openAdd} className="btn-primary" style={{ width:'auto', minHeight:40, padding:'0 18px', fontSize:13 }}>
                + First Product Add Karo
              </button>
            )}
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        {!loading && filtered.length > 0 && (
          <>
            <div className="table-container" style={{ display:'none' }} id="desktop-table">
              {/* shown via CSS below */}
            </div>

            {/* Desktop */}
            <div className="table-container products-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
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
                    <tr
                      key={p._id}
                      style={{ background: p.quantity === 0 ? 'rgba(239,68,68,0.05)' : p.is_low_stock ? 'rgba(245,158,11,0.05)' : 'transparent' }}
                    >
                      {/* Name */}
                      <td>
                        <div style={{ fontWeight:700, color:'#0f172a', fontSize:14 }}>{p.name}</div>
                        <div style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>
                          {p.barcode ? `${p.barcode} · ` : ''}
                          {p.hsn_code ? `HSN ${p.hsn_code}` : ''}
                          {p.unit ? ` · ${p.unit}` : ''}
                          {p.low_stock_threshold !== 5 ? ` · Alert ≤${p.low_stock_threshold}` : ''}
                        </div>
                      </td>
                      <td style={{ color:'#64748b', fontWeight:600 }}>{p.cost_price ? `₹${p.cost_price}` : '—'}</td>
                      <td style={{ fontWeight:800, color:'#0f172a' }}>₹{p.price}</td>
                      <td><MarginBadge margin={p.margin} /></td>
                      <td><GSTBadge rate={p.gst_rate} /></td>
                      <td>
                        <span style={{ fontWeight:800, fontSize:15, color: p.quantity === 0 ? '#f43f5e' : p.is_low_stock ? '#f59e0b' : '#10b981' }}>
                          {p.quantity}
                        </span>
                        <span style={{ color:'#94a3b8', fontSize:11, marginLeft:4 }}>{p.unit || ''}</span>
                      </td>
                      <td><StockBadge p={p} /></td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button onClick={() => openStockAdjust(p)} className="action-soft stock" style={{ borderRadius:99, padding:'5px 10px', fontSize:11, minHeight:30 }}>Stock</button>
                          <button onClick={() => openHistory(p)}    className="action-soft history" style={{ borderRadius:99, padding:'5px 10px', fontSize:11, minHeight:30 }}>History</button>
                          <button onClick={() => openEdit(p)}       className="action-soft edit"    style={{ borderRadius:99, padding:'5px 10px', fontSize:11, minHeight:30 }}>Edit</button>
                          <button onClick={() => handleDelete(p._id)} className="action-soft delete" style={{ borderRadius:99, padding:'5px 10px', fontSize:11, minHeight:30 }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── MOBILE CARDS ── */}
            <div className="products-mobile-cards" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(p => (
                <div
                  key={p._id}
                  className="card"
                  style={{
                    borderRadius:18, padding:'16px 16px 14px',
                    borderLeft:`3px solid ${p.quantity === 0 ? '#f43f5e' : p.is_low_stock ? '#f59e0b' : '#10b981'}`,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:800, fontSize:15, color:'#0f172a', margin:0 }}>{p.name}</p>
                      {(p.barcode || p.description) && (
                        <p style={{ color:'#94a3b8', fontSize:11, margin:'3px 0 0' }}>
                          {p.barcode ? `Barcode: ${p.barcode}` : p.description}
                        </p>
                      )}
                    </div>
                    <StockBadge p={p} />
                  </div>

                  {/* Stats row */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:12 }}>
                    {[
                      { l:'Cost',   v: p.cost_price ? `₹${p.cost_price}` : '—' },
                      { l:'Price',  v: `₹${p.price}` },
                      { l:'Margin', v: <MarginBadge margin={p.margin} /> },
                      { l:'Qty',    v: <span style={{ fontWeight:800, color: p.quantity===0?'#f43f5e':p.is_low_stock?'#f59e0b':'#10b981' }}>{p.quantity}</span> },
                      { l:'GST',    v: <GSTBadge rate={p.gst_rate} /> },
                    ].map(item => (
                      <div key={item.l}>
                        <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#94a3b8', margin:'0 0 3px' }}>{item.l}</p>
                        <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{item.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                    <button onClick={() => openStockAdjust(p)} className="action-soft stock"   style={{ padding:'8px 4px', fontSize:11, textAlign:'center' }}>Stock</button>
                    <button onClick={() => openHistory(p)}     className="action-soft history" style={{ padding:'8px 4px', fontSize:11, textAlign:'center' }}>History</button>
                    <button onClick={() => openEdit(p)}        className="action-soft edit"    style={{ padding:'8px 4px', fontSize:11, textAlign:'center' }}>Edit</button>
                    <button onClick={() => handleDelete(p._id)} className="action-soft delete" style={{ padding:'8px 4px', fontSize:11, textAlign:'center' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Result count ── */}
        {!loading && filtered.length > 0 && (
          <p style={{ textAlign:'center', fontSize:12, color:'#94a3b8', padding:'4px 0 8px' }}>
            {filtered.length} of {products.length} products
          </p>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          ADD / EDIT MODAL — slide-up sheet
      ════════════════════════════════════════════════════════════ */}
      {showModal && (
        <ModalOverlay onClose={() => setShowModal(false)}>
          <div
            className="flow-modal entry-form-shell"
            style={{ maxWidth:520, maxHeight:'90vh', overflowY:'auto', borderRadius:24, padding:'24px 22px' }}
          >
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <p className="rr-page-eyebrow" style={{ marginBottom:4 }}>{editProduct ? 'Edit product' : 'New product'}</p>
                <h3 style={{ fontSize:20, fontWeight:900, color:'#0f172a', margin:0, letterSpacing:'-0.03em' }}>
                  {editProduct ? editProduct.name : 'Product Add Karo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ width:36, height:36, borderRadius:10, border:'1px solid rgba(148,163,184,0.4)', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b' }}
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            {error && <div className="alert-error" style={{ marginBottom:14 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* ── Basics ── */}
              <div style={{ borderRadius:16, border:'1px solid rgba(148,163,184,0.25)', background:'rgba(248,250,252,0.8)', padding:'16px 14px' }}>
                <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:12 }}>Basics</p>
                <div className="form-group" style={{ marginBottom:10 }}>
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required placeholder="e.g. Tata Salt 1kg" />
                </div>
                <div className="form-group" style={{ marginBottom:10 }}>
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Optional details" />
                </div>
                {/* Barcode */}
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Barcode</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      className="form-input"
                      style={{ flex:1 }}
                      placeholder="Scan or type barcode"
                      value={form.barcode}
                      onChange={e => { const nb = normalizeBarcode(e.target.value); setForm({...form, barcode:nb}); setLastScannedBarcode(c => c===nb?c:''); }}
                    />
                    <button type="button" className="btn-ghost" style={{ width:'auto', minHeight:42, padding:'0 14px', gap:6, flexShrink:0 }} onClick={() => setShowBarcodeScanner(true)}>
                      <Icon name="scan" size={14} /> Scan
                    </button>
                  </div>
                  {lastScannedBarcode && (
                    <div style={{ marginTop:8, padding:'8px 12px', borderRadius:10, background:'#ecfdf5', border:'1px solid #a7f3d0', color:'#065f46', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                      <Icon name="check" size={13} />
                      Scanned: <span style={{ fontFamily:'monospace', fontWeight:800 }}>{lastScannedBarcode}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Pricing ── */}
              <div style={{ borderRadius:16, border:'1px solid rgba(148,163,184,0.25)', background:'rgba(248,250,252,0.8)', padding:'16px 14px' }}>
                <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:12 }}>Pricing</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Cost Price</label>
                    <input className="form-input" type="number" step="0.01" placeholder="Your cost" value={form.cost_price} onChange={e => setForm({...form, cost_price:e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Selling Price *</label>
                    <input className="form-input" type="number" step="0.01" placeholder="Customer pays" value={form.price} onChange={e => setForm({...form, price:e.target.value})} required />
                  </div>
                </div>
                {/* Live margin */}
                {liveMargin !== null && (
                  <div style={{ marginTop:12, padding:'10px 14px', borderRadius:12, background:'linear-gradient(135deg,#ecfdf5,#f0fdf4)', border:'1px solid #a7f3d0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#065f46' }}>
                      Margin: <strong>{liveMargin}%</strong>
                    </span>
                    <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>₹{liveProfit} per unit profit</span>
                  </div>
                )}
              </div>

              {/* ── Stock & Unit ── */}
              <div style={{ borderRadius:16, border:'1px solid rgba(148,163,184,0.25)', background:'rgba(248,250,252,0.8)', padding:'16px 14px' }}>
                <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:12 }}>Stock</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">{editProduct ? 'Quantity' : 'Opening Stock *'}</label>
                    <input className="form-input" type="number" min="0" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})} required={!editProduct} />
                    {editProduct && <p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Stock action se adjust karo</p>}
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Unit</label>
                    <input className="form-input" placeholder="pcs, kg, litre..." value={form.unit||'pcs'} onChange={e => setForm({...form, unit:e.target.value})} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop:10, marginBottom:0 }}>
                  <label className="form-label">Low Stock Alert Threshold</label>
                  <input className="form-input" type="number" min="0" placeholder="Default: 5" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold:e.target.value})} />
                  <p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Alert jab stock ≤ this number ho</p>
                </div>
              </div>

              {/* ── Tax ── */}
              <div style={{ borderRadius:16, border:'1px solid rgba(148,163,184,0.25)', background:'rgba(248,250,252,0.8)', padding:'16px 14px' }}>
                <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:12 }}>GST & Tax</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">HSN/SAC Code</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 8471"
                      value={form.hsn_code}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g,'').slice(0,8);
                        const prefix = parseInt(v.slice(0,2),10);
                        const suggested = HSN_GST_HINTS[prefix];
                        setForm(c => ({ ...c, hsn_code:v, gst_rate: suggested ?? c.gst_rate }));
                      }}
                    />
                    {suggestedGstRate !== undefined && (
                      <p style={{ fontSize:10, color:'#2563eb', marginTop:3 }}>HSN se suggested GST: {suggestedGstRate}%</p>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">GST Rate</label>
                    <select className="form-input" value={form.gst_rate} onChange={e => setForm({...form, gst_rate:parseInt(e.target.value)})}>
                      <option value={0}>0% — No GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>
                </div>
                {/* GST preview */}
                {form.price && form.gst_rate > 0 && (
                  <div style={{ marginTop:12, padding:'10px 14px', borderRadius:12, background:'#ecfeff', border:'1px solid #a5f3fc', fontSize:13 }}>
                    <span style={{ color:'#0f766e', fontWeight:600 }}>GST Preview: </span>
                    <span style={{ color:'#0891b2' }}>
                      ₹{parseFloat(form.price||0).toFixed(2)} + {form.gst_rate}% = <strong>₹{(parseFloat(form.price||0)*(1+form.gst_rate/100)).toFixed(2)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* ── Submit ── */}
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" className="btn-primary" style={{ flex:1, minHeight:46 }}>
                  {editProduct ? '✓ Update Product' : '+ Add Product'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost" style={{ flex:1, minHeight:46 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          STOCK ADJUST MODAL
      ════════════════════════════════════════════════════════════ */}
      {showStockModal && stockProduct && (
        <ModalOverlay onClose={() => { setShowStockModal(false); setError(''); }}>
          <div className="modal entry-form-shell" style={{ maxWidth:420, borderRadius:24, padding:'24px 22px' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <p className="rr-page-eyebrow" style={{ marginBottom:4 }}>Stock adjustment</p>
                <h3 style={{ fontSize:18, fontWeight:900, color:'#0f172a', margin:0, letterSpacing:'-0.03em' }}>{stockProduct.name}</h3>
                <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:99, background:'#f1f5f9', border:'1px solid rgba(148,163,184,0.3)' }}>
                  <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>Current stock:</span>
                  <span style={{ fontSize:13, fontWeight:900, color:'#0f172a' }}>{stockProduct.quantity} {stockProduct.unit || 'pcs'}</span>
                </div>
              </div>
              <button type="button" onClick={() => { setShowStockModal(false); setError(''); }} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(148,163,184,0.4)', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
                <Icon name="close" size={13} />
              </button>
            </div>

            {error && <div className="alert-error" style={{ marginBottom:14 }}>{error}</div>}

            <form onSubmit={handleStockAdjust} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Type toggle */}
              <div>
                <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:10 }}>Adjustment Type</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {Object.entries(stockTypeConfig).map(([val, cfg]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStockForm({...stockForm, type:val})}
                      style={{
                        padding:'10px 6px', borderRadius:12, border:`2px solid`,
                        borderColor: stockForm.type===val ? cfg.color : 'rgba(148,163,184,0.3)',
                        background: stockForm.type===val ? cfg.bg : '#f8fafc',
                        color: stockForm.type===val ? cfg.color : '#64748b',
                        fontWeight:700, fontSize:11, cursor:'pointer', transition:'all 0.15s',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Quantity *</label>
                <input
                  className="form-input"
                  type="number" min="1"
                  placeholder="Kitne units?"
                  value={stockForm.quantity}
                  onChange={e => setStockForm({...stockForm, quantity:e.target.value})}
                  required
                />
                {stockForm.quantity && (
                  <div style={{ marginTop:8, padding:'8px 12px', borderRadius:10, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:12, fontWeight:600, color:'#1d4ed8' }}>
                    New stock →{' '}
                    <strong>
                      {stockForm.type==='manual_remove'
                        ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity))
                        : stockProduct.quantity + Number(stockForm.quantity)
                      } {stockProduct.unit || 'pcs'}
                    </strong>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="Adjustment ka reason..." value={stockForm.note} onChange={e => setStockForm({...stockForm, note:e.target.value})} />
              </div>

              {/* Submit */}
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" disabled={stockSubmitting}
                  className="btn-success"
                  style={{ flex:1, minHeight:46, opacity:stockSubmitting?0.6:1 }}
                >
                  {stockSubmitting ? 'Saving...' : 'Stock Update Karo'}
                </button>
                <button type="button" onClick={() => { setShowStockModal(false); setError(''); }} className="btn-ghost" style={{ flex:1, minHeight:46 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          STOCK HISTORY MODAL
      ════════════════════════════════════════════════════════════ */}
      {showHistory && historyProduct && (
        <ModalOverlay onClose={() => setShowHistory(false)}>
          <div className="modal" style={{ maxWidth:480, maxHeight:'85vh', overflowY:'auto', borderRadius:24, padding:'22px 20px' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <p className="rr-page-eyebrow" style={{ marginBottom:4 }}>Stock history</p>
                <h3 style={{ fontSize:17, fontWeight:900, color:'#0f172a', margin:0 }}>{historyProduct.name}</h3>
                <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                  Current: <strong style={{ color:'#0f172a' }}>{historyProduct.quantity} {historyProduct.unit||'pcs'}</strong>
                </p>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(148,163,184,0.4)', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
                <Icon name="close" size={13} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height:58, borderRadius:12 }} />)}
              </div>
            ) : historyData.length === 0 ? (
              <div className="empty-state" style={{ padding:'28px 16px' }}>
                <div className="empty-state-icon"><Icon name="history" size={22} /></div>
                <p style={{ fontWeight:700, color:'#334155' }}>Koi history nahi mili</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {historyData.map((h, i) => {
                  const isAdd = h.quantity_change > 0;
                  return (
                    <div
                      key={i}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, background:'rgba(248,250,252,0.8)', border:`1px solid ${isAdd ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`, borderLeft:`3px solid ${isAdd ? '#10b981' : '#f43f5e'}` }}
                    >
                      {/* Icon dot */}
                      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:isAdd?'#ecfdf5':'#fff1f2', display:'flex', alignItems:'center', justifyContent:'center', color:isAdd?'#10b981':'#f43f5e', fontWeight:900, fontSize:14 }}>
                        {isAdd ? '+' : '−'}
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0 }}>{historyTypeLabel(h.type)}</p>
                        <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>
                          {new Date(h.date).toLocaleDateString('en-IN')}
                          {h.note ? ` · ${h.note}` : ''}
                        </p>
                      </div>
                      {/* Change */}
                      <div style={{ flexShrink:0, textAlign:'right' }}>
                        <p style={{ fontSize:15, fontWeight:900, color:isAdd?'#10b981':'#f43f5e', margin:0 }}>
                          {isAdd?'+':''}{h.quantity_change}
                        </p>
                        <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>→ {h.quantity_after} {historyProduct.unit||'pcs'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Barcode scanner (UNCHANGED) */}
      <CameraBarcodeScanner
        open={showBarcodeScanner}
        title="Scan product barcode"
        description="Camera scan se barcode field auto-fill ho jayegi."
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* Responsive: hide/show table vs cards */}
      <style>{`
        .products-desktop-table { display: none; }
        .products-mobile-cards  { display: flex;  }
        @media (min-width: 641px) {
          .products-desktop-table { display: block; }
          .products-mobile-cards  { display: none;  }
        }
      `}</style>
    </Layout>
  );
}