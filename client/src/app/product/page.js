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
const historyTypeLabel = (t) => ({ purchase:'Purchase', sale:'Sale', manual_add:'Added', manual_remove:'Removed', adjustment:'Adjusted' }[t] || t);

/* ─── Shared classes ── */
const INP = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all';
const SEL = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all';

/* ─── Stock status helpers ── */
function stockStatus(p) {
  if (p.quantity === 0) return { label: 'खत्म',    cls: 'bg-rose-100 text-rose-700 border-rose-200',     dot: 'bg-rose-500'   };
  if (p.is_low_stock)   return { label: `कम (${p.quantity})`, cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  return                       { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
}
function marginColor(m) {
  if (m == null) return 'text-slate-400';
  if (m >= 30)   return 'text-emerald-600';
  if (m >= 15)   return 'text-amber-600';
  return 'text-rose-600';
}

/* ─── Modal backdrop ── */
function Backdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const router = useRouter();

  /* ── All state (UNCHANGED) ── */
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
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');

  const [showStockModal,  setShowStockModal]  = useState(false);
  const [stockProduct,    setStockProduct]    = useState(null);
  const [stockForm,       setStockForm]       = useState({ type:'manual_add', quantity:'', note:'' });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  const [showHistory,    setShowHistory]    = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData,    setHistoryData]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ── All effects (UNCHANGED) ── */
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
    const on = () => setIsOnline(true); const off = () => setIsOnline(false);
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

  /* ── All logic (UNCHANGED) ── */
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

  /* ── Computed ── */
  const lowStockCount   = products.filter(p => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const totalValue      = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);
  const suggestedGstRate = (() => { const prefix = parseInt(String(form.hsn_code || '').slice(0,2), 10); return HSN_GST_HINTS[prefix]; })();
  const liveMargin = form.cost_price && form.price && Number(form.cost_price) > 0
    ? (((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1) : null;
  const liveProfit = liveMargin != null ? (Number(form.price) - Number(form.cost_price)).toFixed(2) : null;
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;

  const STOCK_TYPES = {
    manual_add:    { label:'Stock जोड़ो',   color:'border-emerald-400 bg-emerald-50 text-emerald-800', active:'bg-emerald-500 text-white border-emerald-500' },
    manual_remove: { label:'Stock हटाओ',   color:'border-rose-400 bg-rose-50 text-rose-800',         active:'bg-rose-500 text-white border-rose-500' },
    adjustment:    { label:'Correction',   color:'border-cyan-400 bg-cyan-50 text-cyan-800',          active:'bg-cyan-500 text-white border-cyan-500' },
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ── OFFLINE BANNER ── */}
        {!isOnline && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl">📶</span>
            <div>
              <p className="text-[13px] font-black text-amber-900">Offline Stock Mode</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Add, edit, delete aur stock actions internet wapas aane par hi chalenge.</p>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/30 border border-slate-200 p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                📦 Stock Control
              </span>
              <h1 className="mt-2.5 text-[22px] font-black text-slate-900 leading-tight">स्टॉक / Products</h1>
              <p className="mt-1 text-[12px] text-slate-400">
                {refreshing ? '🔄 Refreshing...'
                  : !isOnline ? `📶 Offline snapshot${cacheLabel ? ` · ${cacheLabel}` : ''}`
                  : cacheLabel ? `✓ Last synced ${cacheLabel}`
                  : 'Aapka poora stock yahan ready hai'}
              </p>
            </div>
            <button onClick={openAdd} disabled={!isOnline}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:-translate-y-px hover:shadow-lg disabled:opacity-50 transition-all"
            >+ Product</button>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label:'Total Products',  value: products.length,                                            bg:'bg-purple-50 border-purple-200', vc:'text-purple-700' },
            { label:'Low Stock',       value: lowStockCount,                                              bg:'bg-amber-50 border-amber-200',   vc:'text-amber-700'  },
            { label:'Out of Stock',    value: outOfStockCount,                                            bg:'bg-rose-50 border-rose-200',     vc:'text-rose-700'   },
            { label:'Inventory Value', value: `₹${Math.round(totalValue).toLocaleString('en-IN')}`,       bg:'bg-emerald-50 border-emerald-200', vc:'text-emerald-700' },
          ].map(k => (
            <div key={k.label} className={`${k.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-[20px] font-black leading-none ${k.vc}`}>{k.value}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-wide leading-tight">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-2">
          <input className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
            placeholder="🔍 Search name, barcode, description..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            <select className={`flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none transition-all`}
              value={filterStock} onChange={e => setFilterStock(e.target.value)}>
              <option value="all">All Stock</option>
              <option value="instock">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <select className={`flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none transition-all`}
              value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="quantity">Qty: Low → High</option>
              <option value="margin">Margin: Best</option>
            </select>
            {(search || filterStock !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterStock('all'); }}
                className="px-4 h-10 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >Clear</button>
            )}
          </div>
        </div>

        {/* ── PAGE ERROR ── */}
        {error && !showModal && !showStockModal && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-[14px] font-bold text-slate-700 mb-1">
              {search || filterStock !== 'all' ? 'कोई product नहीं मिला' : 'अभी कोई product नहीं है'}
            </p>
            <p className="text-[12px] text-slate-400 mb-4">
              {search || filterStock !== 'all' ? 'Filter या search बदलकर देखो' : 'पहला product add करो और inventory शुरू करो'}
            </p>
            {!search && filterStock === 'all' && (
              <button onClick={openAdd}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:shadow-lg transition-all"
              >+ पहला Product Add करो</button>
            )}
          </div>
        )}

        {/* ── PRODUCT CARDS ── */}
        {!loading && filtered.length > 0 && (
          <>
            <div className="flex flex-col gap-3">
              {filtered.map(p => {
                const s = stockStatus(p);
                return (
                  <div key={p._id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${
                      p.quantity === 0 ? 'border-rose-200' : p.is_low_stock ? 'border-amber-200' : 'border-slate-200'
                    }`}
                  >
                    {/* Color bar */}
                    <div className={`h-0.5 ${p.quantity === 0 ? 'bg-rose-400' : p.is_low_stock ? 'bg-amber-400' : 'bg-emerald-400'}`} />

                    <div className="p-4">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-black text-slate-900 leading-tight">{p.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {[p.barcode && `📷 ${p.barcode}`, p.hsn_code && `HSN ${p.hsn_code}`, p.unit].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black border flex-shrink-0 ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {[
                          { label: 'Cost',   value: p.cost_price ? `₹${p.cost_price}` : '—',  cls: 'text-slate-600' },
                          { label: 'Price',  value: `₹${p.price}`,                             cls: 'text-slate-900 font-black' },
                          { label: 'Margin', value: p.margin != null ? `${p.margin}%` : '—',  cls: marginColor(p.margin) + ' font-black' },
                          { label: 'Qty',    value: `${p.quantity}`,                           cls: (p.quantity === 0 ? 'text-rose-600' : p.is_low_stock ? 'text-amber-600' : 'text-emerald-600') + ' font-black text-[16px]' },
                          { label: 'GST',    value: p.gst_rate > 0 ? `${p.gst_rate}%` : 'NIL', cls: 'text-cyan-700 font-bold' },
                        ].map(item => (
                          <div key={item.label} className="text-center">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{item.label}</p>
                            <p className={`text-[13px] font-semibold text-slate-800 ${item.cls}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => openStockAdjust(p)}
                          className="py-2 rounded-xl border border-cyan-200 bg-cyan-50 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 transition-colors"
                        >📦 Stock</button>
                        <button onClick={() => openHistory(p)}
                          className="py-2 rounded-xl border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                        >🕐 History</button>
                        <button onClick={() => openEdit(p)}
                          className="py-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >✏️ Edit</button>
                        <button onClick={() => handleDelete(p._id)}
                          className="py-2 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                        >🗑️ Del</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Result count */}
            <p className="text-center text-[11px] text-slate-400 pb-2">
              {filtered.length} of {products.length} products
            </p>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ════════════════════════════════════════════════════════════ */}
      {showModal && (
        <Backdrop onClose={() => setShowModal(false)}>
          <div className="w-full sm:max-w-[520px] max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{editProduct ? 'Edit Product' : 'New Product'}</p>
                  <h3 className="text-[18px] font-black text-slate-900 mt-0.5">{editProduct ? editProduct.name : 'Product Add करो'}</h3>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">⚠️ {error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── BASICS ── */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basics</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Product Name *</p>
                    <input className={INP} value={form.name} onChange={e => setForm({...form, name:e.target.value})} required placeholder="e.g. Tata Salt 1kg" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</p>
                    <input className={INP} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Optional details" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Barcode</p>
                    <div className="flex gap-2">
                      <input className={`${INP} flex-1`} placeholder="Scan or type barcode"
                        value={form.barcode}
                        onChange={e => { const nb = normalizeBarcode(e.target.value); setForm({...form, barcode:nb}); setLastScannedBarcode(c => c===nb?c:''); }}
                      />
                      <button type="button" onClick={() => setShowBarcodeScanner(true)}
                        className="px-4 h-11 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-colors"
                      >📷 Scan</button>
                    </div>
                    {lastScannedBarcode && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-semibold text-emerald-700">
                        ✓ Scanned: <span className="font-mono font-black">{lastScannedBarcode}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── PRICING ── */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pricing</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cost Price</p>
                      <input className={INP} type="number" step="0.01" placeholder="Your cost" value={form.cost_price} onChange={e => setForm({...form, cost_price:e.target.value})} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Selling Price *</p>
                      <input className={INP} type="number" step="0.01" placeholder="Customer pays" value={form.price} onChange={e => setForm({...form, price:e.target.value})} required />
                    </div>
                  </div>
                  {liveMargin !== null && (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[13px] font-bold text-emerald-700">Margin: <strong>{liveMargin}%</strong></span>
                      <span className="text-[12px] text-emerald-600 font-semibold">₹{liveProfit} per unit</span>
                    </div>
                  )}
                </div>

                {/* ── STOCK ── */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{editProduct ? 'Quantity' : 'Opening Stock *'}</p>
                      <input className={INP} type="number" min="0" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})} required={!editProduct} />
                      {editProduct && <p className="text-[10px] text-slate-400 mt-1">Stock action se adjust karo</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Unit</p>
                      <input className={INP} placeholder="pcs, kg, litre..." value={form.unit||'pcs'} onChange={e => setForm({...form, unit:e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Low Stock Alert ≤</p>
                    <input className={INP} type="number" min="0" placeholder="Default: 5" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold:e.target.value})} />
                  </div>
                </div>

                {/* ── GST & TAX ── */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST & Tax</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">HSN/SAC Code</p>
                      <input className={INP} placeholder="e.g. 8471"
                        value={form.hsn_code}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g,'').slice(0,8);
                          const prefix = parseInt(v.slice(0,2),10);
                          const suggested = HSN_GST_HINTS[prefix];
                          setForm(c => ({ ...c, hsn_code:v, gst_rate: suggested ?? c.gst_rate }));
                        }}
                      />
                      {suggestedGstRate !== undefined && (
                        <p className="text-[10px] text-cyan-600 mt-1">Suggested GST: {suggestedGstRate}%</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">GST Rate</p>
                      <select className={SEL} value={form.gst_rate} onChange={e => setForm({...form, gst_rate:parseInt(e.target.value)})}>
                        <option value={0}>0% — No GST</option>
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST</option>
                        <option value={28}>28% GST</option>
                      </select>
                    </div>
                  </div>
                  {form.price && form.gst_rate > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-[12px]">
                      <span className="text-slate-500">GST Preview</span>
                      <span className="font-bold text-cyan-700">
                        ₹{parseFloat(form.price||0).toFixed(2)} + {form.gst_rate}% = <strong>₹{(parseFloat(form.price||0)*(1+form.gst_rate/100)).toFixed(2)}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex gap-3 pb-2">
                  <button type="submit"
                    className="flex-1 py-3.5 rounded-2xl text-[14px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 transition-all"
                  >{editProduct ? '✓ Update Product' : '+ Add Product'}</button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════════════════════
          STOCK ADJUST MODAL
      ════════════════════════════════════════════════════════════ */}
      {showStockModal && stockProduct && (
        <Backdrop onClose={() => { setShowStockModal(false); setError(''); }}>
          <div className="w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stock Adjustment</p>
                <h3 className="text-[17px] font-black text-slate-900 mt-0.5">{stockProduct.name}</h3>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[12px] font-semibold text-slate-700">
                  Current: <strong className="text-slate-900">{stockProduct.quantity} {stockProduct.unit || 'pcs'}</strong>
                </div>
              </div>
              <button onClick={() => { setShowStockModal(false); setError(''); }}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">⚠️ {error}</div>}

              <form onSubmit={handleStockAdjust} className="space-y-4">
                {/* Type toggle */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Adjustment Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(STOCK_TYPES).map(([val, cfg]) => (
                      <button key={val} type="button" onClick={() => setStockForm({...stockForm, type:val})}
                        className={`py-3 rounded-xl border-2 text-[11px] font-black transition-all ${
                          stockForm.type === val ? cfg.active : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >{cfg.label}</button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Quantity *</p>
                  <input className={INP} type="number" min="1" placeholder="Kitne units?"
                    value={stockForm.quantity} onChange={e => setStockForm({...stockForm, quantity:e.target.value})} required
                  />
                  {stockForm.quantity && (
                    <div className="mt-2 flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[12px] font-semibold text-blue-700">
                      <span>New stock →</span>
                      <strong className="text-[14px]">
                        {stockForm.type === 'manual_remove'
                          ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity))
                          : stockProduct.quantity + Number(stockForm.quantity)
                        } {stockProduct.unit || 'pcs'}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Note (optional)</p>
                  <input className={INP} placeholder="Adjustment का reason..." value={stockForm.note} onChange={e => setStockForm({...stockForm, note:e.target.value})} />
                </div>

                <div className="flex gap-3 pb-2">
                  <button type="submit" disabled={stockSubmitting}
                    className="flex-1 py-3.5 rounded-2xl text-[14px] font-black text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 transition-all"
                  >{stockSubmitting ? '⏳ Saving...' : '✓ Stock Update करो'}</button>
                  <button type="button" onClick={() => { setShowStockModal(false); setError(''); }}
                    className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════════════════════
          STOCK HISTORY MODAL
      ════════════════════════════════════════════════════════════ */}
      {showHistory && historyProduct && (
        <Backdrop onClose={() => setShowHistory(false)}>
          <div className="w-full sm:max-w-[480px] max-h-[85dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
            <div className="flex justify-center pt-3 pb-1 sm:hidden sticky top-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stock History</p>
                <h3 className="text-[16px] font-black text-slate-900 mt-0.5">{historyProduct.name}</h3>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Current: <strong className="text-slate-900">{historyProduct.quantity} {historyProduct.unit||'pcs'}</strong>
                </p>
              </div>
              <button onClick={() => setShowHistory(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>

            <div className="px-4 py-4">
              {historyLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
              ) : historyData.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">🕐</div>
                  <p className="text-[13px] font-bold text-slate-600">कोई history नहीं मिली</p>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {historyData.map((h, i) => {
                    const isAdd = h.quantity_change > 0;
                    return (
                      <div key={i}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 ${isAdd ? 'bg-emerald-50 border-emerald-400' : 'bg-rose-50 border-rose-400'}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-black flex-shrink-0 ${isAdd ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isAdd ? '+' : '−'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-900">{historyTypeLabel(h.type)}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(h.date).toLocaleDateString('en-IN')}{h.note ? ` · ${h.note}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[15px] font-black ${isAdd ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isAdd ? '+' : ''}{h.quantity_change}
                          </p>
                          <p className="text-[10px] text-slate-400">→ {h.quantity_after} {historyProduct.unit||'pcs'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Backdrop>
      )}

      {/* Barcode scanner (UNCHANGED) */}
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