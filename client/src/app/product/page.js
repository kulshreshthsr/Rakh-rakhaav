'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterStock, setFilterStock] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    cost_price: '',
    quantity: '',
    unit: 'pcs',
    hsn_code: '',
    gst_rate: 0,
    low_stock_threshold: 5,
  });

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ type: 'manual_add', quantity: '', note: '' });
  const [stockSubmitting, setStockSubmitting] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = [...products];

    if (search) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
      );
    }

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
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {
      setError('उत्पाद लोड नहीं हो सके');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({
      name: '',
      description: '',
      price: '',
      cost_price: '',
      quantity: '',
      unit: 'pcs',
      hsn_code: '',
      gst_rate: 0,
      low_stock_threshold: 5,
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      cost_price: p.cost_price || '',
      quantity: p.quantity,
      unit: p.unit || 'pcs',
      hsn_code: p.hsn_code || '',
      gst_rate: p.gst_rate || 0,
      low_stock_threshold: p.low_stock_threshold || 5,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const url = editProduct ? `${API}/api/products/${editProduct._id}` : `${API}/api/products`;
    try {
      const res = await fetch(url, {
        method: editProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        fetchProducts();
      } else {
        setError(data.message || 'सहेजने में विफल');
      }
    } catch {
      setError('Server error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('इस उत्पाद को हटाएं?\nDelete this product?')) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        fetchProducts();
      } else {
        const d = await res.json();
        setError(d.message || 'हटाने में विफल');
      }
    } catch {
      setError('Server error');
    }
  };

  const openStockAdjust = (p) => {
    setStockProduct(p);
    setStockForm({ type: 'manual_add', quantity: '', note: '' });
    setError('');
    setShowStockModal(true);
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    setError('');
    setStockSubmitting(true);
    try {
      const res = await fetch(`${API}/api/products/${stockProduct._id}/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(stockForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowStockModal(false);
        fetchProducts();
      } else {
        setError(data.message || 'Stock update failed');
      }
    } catch {
      setError('Server error');
    }
    setStockSubmitting(false);
  };

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

  const lowStockCount = products.filter((p) => p.is_low_stock && p.quantity > 0).length;
  const outOfStockCount = products.filter((p) => p.quantity === 0).length;
  const totalValue = products.reduce((s, p) => s + (p.cost_price || 0) * p.quantity, 0);
  const totalPotentialSalesValue = products.reduce((s, p) => s + (p.price || 0) * p.quantity, 0);
  const avgMargin =
    products.filter((p) => p.margin !== null && p.margin !== undefined).length > 0
      ? products
          .filter((p) => p.margin !== null && p.margin !== undefined)
          .reduce((s, p) => s + (p.margin || 0), 0) /
        products.filter((p) => p.margin !== null && p.margin !== undefined).length
      : 0;

  const StockBadge = ({ p }) => {
    if (p.quantity === 0) return <span className="badge badge-red">खत्म</span>;
    if (p.is_low_stock) return <span className="badge badge-yellow">कम ({p.quantity})</span>;
    return <span className="badge badge-green">✓ In Stock</span>;
  };

  const GSTBadge = ({ rate }) => {
    if (!rate) {
      return <span style={{ color: 'var(--text-5)', fontSize: 12 }}>No GST</span>;
    }
    return (
      <span
        style={{
          background: '#EEF2FF',
          color: '#4338CA',
          padding: '4px 9px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        GST {rate}%
      </span>
    );
  };

  const MarginBadge = ({ margin }) => {
    if (margin === null || margin === undefined) {
      return <span style={{ color: 'var(--text-5)', fontSize: 12 }}>—</span>;
    }
    const color = margin >= 30 ? '#15803D' : margin >= 15 ? '#B45309' : '#B91C1C';
    const bg = margin >= 30 ? '#DCFCE7' : margin >= 15 ? '#FEF3C7' : '#FEE2E2';
    return (
      <span
        style={{
          background: bg,
          color,
          padding: '4px 9px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {margin}%
      </span>
    );
  };

  const historyTypeLabel = (type) =>
    ({
      purchase: '🛒 Purchase',
      sale: '💰 Sale',
      manual_add: '➕ Added',
      manual_remove: '➖ Removed',
      adjustment: '🔧 Adjusted',
    }[type] || type);

  const stockAdjustTypes = [
    { val: 'manual_add', label: '➕ Add', color: '#16A34A', bg: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)', shadow: 'rgba(34,197,94,0.22)' },
    { val: 'manual_remove', label: '➖ Remove', color: '#DC2626', bg: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', shadow: 'rgba(239,68,68,0.22)' },
    { val: 'adjustment', label: '🔧 Fix', color: '#4338CA', bg: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', shadow: 'rgba(79,70,229,0.22)' },
  ];

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 22,
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div className="page-title" style={{ marginBottom: 6 }}>
            उत्पाद / Products
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 680 }}>
            Manage stock, pricing, GST, and product margins in one polished inventory workspace built for fast daily operations.
          </div>
        </div>

        <button onClick={openAdd} className="btn-primary">
          + उत्पाद जोड़ें
        </button>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 48%, #0F172A 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(79,70,229,0.20)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -20,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: 120,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.9fr)',
            gap: 18,
          }}
          className="product-hero-grid"
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: 14,
              }}
            >
              <span>📦</span>
              <span>Inventory workspace</span>
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.08,
                fontFamily: 'var(--font-display)',
                marginBottom: 10,
              }}
            >
              Stock control with premium clarity
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              See inventory value, spot low stock quickly, adjust quantities cleanly, and manage selling margins without leaving the page.
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 22,
              padding: '18px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 700 }}>
              Quick Pulse
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>{products.length} products</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              ₹{totalValue.toFixed(0)} current inventory cost value
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Low stock
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{lowStockCount}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Out of stock
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{outOfStockCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {[
          {
            label: 'Inventory Value',
            value: `₹${totalValue.toFixed(0)}`,
            sub: 'Based on cost price',
            tone: '#4338CA',
            soft: '#EEF2FF',
            icon: '💼',
          },
          {
            label: 'Potential Sales Value',
            value: `₹${totalPotentialSalesValue.toFixed(0)}`,
            sub: 'At current selling price',
            tone: '#16A34A',
            soft: '#F0FDF4',
            icon: '📈',
          },
          {
            label: 'Low Stock Items',
            value: `${lowStockCount}`,
            sub: 'Need replenishment soon',
            tone: '#D97706',
            soft: '#FFFBEB',
            icon: '⚠️',
          },
          {
            label: 'Average Margin',
            value: `${avgMargin.toFixed(1)}%`,
            sub: 'Across products with pricing',
            tone: avgMargin >= 20 ? '#16A34A' : avgMargin >= 10 ? '#D97706' : '#DC2626',
            soft: avgMargin >= 20 ? '#F0FDF4' : avgMargin >= 10 ? '#FFFBEB' : '#FEF2F2',
            icon: '💰',
          },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              background: card.soft,
              borderRadius: 22,
              padding: '18px',
              border: '1px solid rgba(255,255,255,0.95)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                marginBottom: 12,
              }}
            >
              {card.icon}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.label}
            </div>
            <div style={{ marginTop: 8, fontSize: 25, fontWeight: 800, color: card.tone, letterSpacing: '-0.04em' }}>
              {card.value}
            </div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-4)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{
          marginBottom: 18,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '16px 18px',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              color: 'var(--text-4)',
            }}
          >
            🔍
          </div>
          <input
            className="form-input"
            style={{ paddingLeft: 38 }}
            placeholder="उत्पाद खोजें / Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ minWidth: 160, flex: 'none' }}
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value)}
        >
          <option value="all">All Products</option>
          <option value="instock">✅ In Stock</option>
          <option value="low">⚠️ Low Stock</option>
          <option value="out">🔴 Out of Stock</option>
        </select>

        <select
          className="form-input"
          style={{ minWidth: 150, flex: 'none' }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="name">Sort: Name</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="quantity">Qty ↑</option>
          <option value="margin">Margin ↓</option>
        </select>

        {(search || filterStock !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setFilterStock('all');
            }}
            style={{
              color: '#DC2626',
              background: '#FEF2F2',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              padding: '10px 14px',
              borderRadius: 12,
              fontFamily: 'var(--font-body)',
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {error && !showModal && !showStockModal && (
        <div
          style={{
            background: '#FEF2F2',
            color: '#991B1B',
            padding: '13px 16px',
            borderRadius: 16,
            marginBottom: 16,
            fontSize: 13,
            border: '1px solid #FECACA',
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            minHeight: '42vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-4)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: '#4F46E5',
              animation: 'spin 0.7s linear infinite',
              marginBottom: 12,
            }}
          />
          लोड हो रहा है...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '72px 24px',
            color: 'var(--text-4)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(238,242,255,0.88))',
          }}
        >
          <div style={{ fontSize: 54, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-2)', marginBottom: 6 }}>
            {search || filterStock !== 'all' ? 'कोई उत्पाद नहीं मिला' : 'अभी कोई उत्पाद नहीं'}
          </div>
          {!search && filterStock === 'all' && (
            <div style={{ fontSize: 13.5, marginBottom: 18 }}>
              पहला product जोड़कर inventory शुरू करें
            </div>
          )}
          {!search && filterStock === 'all' && (
            <button onClick={openAdd} className="btn-primary">
              + पहला उत्पाद जोड़ें
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.9fr)',
              gap: 16,
              marginBottom: 22,
            }}
            className="product-main-grid"
          >
            <div className="table-container hidden-xs">
              <table>
                <thead>
                  <tr>
                    <th>नाम / Name</th>
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
                  {filtered.map((p) => (
                    <tr
                      key={p._id}
                      style={{
                        background: p.quantity === 0 ? '#FFF7F7' : p.is_low_stock ? '#FFFDF3' : 'transparent',
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 13.5 }}>
                          {p.name}
                        </div>
                        <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 3 }}>
                          {p.hsn_code ? `HSN: ${p.hsn_code}` : ''}
                          {p.unit ? ` · ${p.unit}` : ''}
                          {p.low_stock_threshold !== 5 ? ` · Alert ≤${p.low_stock_threshold}` : ''}
                        </div>
                      </td>

                      <td style={{ color: 'var(--text-3)', fontWeight: 600 }}>
                        {p.cost_price ? `₹${p.cost_price}` : '—'}
                      </td>

                      <td style={{ fontWeight: 800, color: 'var(--text)' }}>₹{p.price}</td>

                      <td>
                        <MarginBadge margin={p.margin} />
                      </td>

                      <td>
                        <GSTBadge rate={p.gst_rate} />
                      </td>

                      <td
                        style={{
                          fontWeight: 800,
                          color: p.quantity === 0 ? '#DC2626' : p.is_low_stock ? '#D97706' : 'var(--text-2)',
                        }}
                      >
                        {p.quantity}{' '}
                        <span style={{ fontWeight: 500, color: 'var(--text-4)', fontSize: 11 }}>
                          {p.unit || ''}
                        </span>
                      </td>

                      <td>
                        <StockBadge p={p} />
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openStockAdjust(p)}
                            style={{
                              color: '#15803D',
                              background: '#ECFDF5',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '7px 10px',
                              borderRadius: 10,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            Stock
                          </button>

                          <button
                            onClick={() => openHistory(p)}
                            style={{
                              color: '#4338CA',
                              background: '#EEF2FF',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '7px 10px',
                              borderRadius: 10,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            History
                          </button>

                          <button
                            onClick={() => openEdit(p)}
                            style={{
                              color: '#B45309',
                              background: '#FFFBEB',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '7px 10px',
                              borderRadius: 10,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(p._id)}
                            style={{
                              color: '#DC2626',
                              background: '#FEF2F2',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '7px 10px',
                              borderRadius: 10,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Inventory Alerts
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Stock health at a glance
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 16,
                      background: '#F0FDF4',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Healthy stock</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#15803D' }}>
                      {products.filter((p) => p.quantity > 0 && !p.is_low_stock).length}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 16,
                      background: '#FFFBEB',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Low stock</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#B45309' }}>{lowStockCount}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 16,
                      background: '#FEF2F2',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>Out of stock</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{outOfStockCount}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Product Workflow Tips
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Built for quick daily stock operations
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { title: 'Margin preview', sub: 'Cost and selling price instantly show profit percentage', bg: '#EEF2FF', color: '#4338CA', icon: '💰' },
                    { title: 'GST preview', sub: 'See price plus GST before saving the product', bg: '#F5F3FF', color: '#7C3AED', icon: '🧾' },
                    { title: 'Stock audit trail', sub: 'Every adjustment stays visible in product history', bg: '#ECFDF5', color: '#15803D', icon: '📋' },
                  ].map((tip, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: tip.bg,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {tip.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tip.color }}>
                          {tip.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                          {tip.sub}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((p) => (
              <div
                key={p._id}
                className="card"
                style={{
                  borderLeft: `4px solid ${p.quantity === 0 ? '#EF4444' : p.is_low_stock ? '#F59E0B' : '#22C55E'}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 10,
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-4)', fontSize: 11.5, marginTop: 3 }}>
                      {p.description || (p.unit ? `Unit: ${p.unit}` : '')}
                    </div>
                  </div>
                  <StockBadge p={p} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Cost
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 3 }}>
                      {p.cost_price ? `₹${p.cost_price}` : '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Price
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginTop: 3 }}>₹{p.price}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Margin
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <MarginBadge margin={p.margin} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Qty
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        marginTop: 3,
                        color: p.quantity === 0 ? '#DC2626' : p.is_low_stock ? '#D97706' : 'var(--text)',
                      }}
                    >
                      {p.quantity} {p.unit || ''}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      GST
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <GSTBadge rate={p.gst_rate} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      HSN
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 4, color: 'var(--text-3)' }}>
                      {p.hsn_code || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openStockAdjust(p)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      background: '#ECFDF5',
                      color: '#15803D',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    📦 Stock
                  </button>

                  <button
                    onClick={() => openHistory(p)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      background: '#EEF2FF',
                      color: '#4338CA',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    📋 History
                  </button>

                  <button
                    onClick={() => openEdit(p)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      background: '#FFFBEB',
                      color: '#B45309',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    ✏️ Edit
                  </button>

                  <button
                    onClick={() => handleDelete(p._id)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', maxWidth: 720 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {editProduct ? 'Edit Product' : 'Add Product'}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  {editProduct ? 'Update pricing, GST, and labels' : 'Create a premium product record for inventory'}
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  color: '#991B1B',
                  padding: '12px 14px',
                  borderRadius: 14,
                  fontSize: 13,
                  marginBottom: 16,
                  border: '1px solid #FECACA',
                  fontWeight: 600,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)',
                  gap: 18,
                }}
                className="product-modal-grid"
              >
                <div>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 20,
                      background: '#fff',
                      border: '1px solid var(--border-soft)',
                      marginBottom: 16,
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label">नाम / Name *</label>
                      <input
                        className="form-input"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">विवरण / Description</label>
                      <input
                        className="form-input"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Cost Price ₹</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          placeholder="खरीद मूल्य"
                          value={form.cost_price}
                          onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Selling Price ₹ *</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {form.cost_price && form.price && Number(form.cost_price) > 0 && (
                      <div
                        style={{
                          background: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: 16,
                          padding: '12px 14px',
                          marginBottom: 14,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                          Margin Preview
                        </div>
                        <span style={{ color: '#64748B' }}>Margin: </span>
                        <strong style={{ color: '#15803D', fontSize: 15 }}>
                          {(((Number(form.price) - Number(form.cost_price)) / Number(form.cost_price)) * 100).toFixed(1)}%
                        </strong>
                        <span style={{ color: '#94A3B8', marginLeft: 8 }}>
                          (₹{(Number(form.price) - Number(form.cost_price)).toFixed(2)} profit/unit)
                        </span>
                      </div>
                    )}

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">{editProduct ? 'Quantity' : 'Opening Stock *'}</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          value={form.quantity}
                          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                          required={!editProduct}
                        />
                        {editProduct && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 6 }}>
                            Stock adjust के लिए "Stock" button use करें
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Unit</label>
                        <input
                          className="form-input"
                          placeholder="kg, pcs, box..."
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 20,
                      background: '#fff',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">HSN/SAC Code</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 8471"
                          value={form.hsn_code}
                          onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GST Rate</label>
                        <select
                          className="form-input"
                          value={form.gst_rate}
                          onChange={(e) => setForm({ ...form, gst_rate: parseInt(e.target.value) })}
                        >
                          <option value={0}>0% — No GST</option>
                          <option value={5}>5% GST</option>
                          <option value={12}>12% GST</option>
                          <option value={18}>18% GST</option>
                          <option value={28}>28% GST</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Low Stock Alert Threshold</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        placeholder="e.g. 5"
                        value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      />
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 6 }}>
                        Default: 5 — इससे कम stock पर alert आएगा
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    {form.price && form.gst_rate > 0 && (
                      <div
                        style={{
                          background: '#EEF2FF',
                          border: '1px solid #C7D2FE',
                          borderRadius: 20,
                          padding: '16px',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#4338CA', marginBottom: 8, fontSize: 13 }}>
                          GST Preview
                        </div>
                        <div style={{ color: '#4338CA', fontSize: 13.5, lineHeight: 1.6 }}>
                          ₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% ={' '}
                          <strong>
                            ₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 20,
                        padding: '16px',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 10, fontSize: 13 }}>
                        Product Quality Checks
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Name added', ok: !!form.name },
                          { label: 'Selling price set', ok: !!form.price },
                          { label: 'Opening stock ready', ok: editProduct ? true : form.quantity !== '' },
                          { label: 'GST configured', ok: form.gst_rate !== null && form.gst_rate !== undefined },
                        ].map((check, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span style={{ color: check.ok ? '#16A34A' : '#94A3B8', fontWeight: 800 }}>
                              {check.ok ? '✓' : '•'}
                            </span>
                            <span style={{ color: check.ok ? 'var(--text)' : 'var(--text-4)', fontWeight: 600 }}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                        {editProduct ? 'Update Product' : 'Add Product'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        style={{
                          flex: 1,
                          minHeight: 44,
                          padding: '11px 14px',
                          background: 'var(--surface-2)',
                          color: 'var(--text-2)',
                          border: '1.5px solid var(--border-soft)',
                          borderRadius: 14,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && stockProduct && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 620 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Stock Adjust
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                  {stockProduct.name} · Current: <strong>{stockProduct.quantity} {stockProduct.unit || 'pcs'}</strong>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowStockModal(false);
                  setError('');
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  color: '#991B1B',
                  padding: '12px 14px',
                  borderRadius: 14,
                  fontSize: 13,
                  marginBottom: 16,
                  border: '1px solid #FECACA',
                  fontWeight: 600,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleStockAdjust}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stockAdjustTypes.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setStockForm({ ...stockForm, type: opt.val })}
                      style={{
                        flex: 1,
                        minWidth: 110,
                        padding: '11px 8px',
                        borderRadius: 14,
                        border: '1.5px solid',
                        borderColor: stockForm.type === opt.val ? opt.color : 'var(--border-soft)',
                        background: stockForm.type === opt.val ? opt.bg : '#fff',
                        color: stockForm.type === opt.val ? '#fff' : 'var(--text-2)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12.5,
                        fontFamily: 'var(--font-body)',
                        boxShadow: stockForm.type === opt.val ? `0 14px 26px ${opt.shadow}` : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  placeholder="How many units?"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  required
                />
                {stockForm.quantity && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-3)',
                      marginTop: 8,
                      fontWeight: 700,
                    }}
                  >
                    New stock →{' '}
                    <strong style={{ color: '#4338CA' }}>
                      {stockForm.type === 'manual_remove'
                        ? Math.max(0, stockProduct.quantity - Number(stockForm.quantity))
                        : stockProduct.quantity + Number(stockForm.quantity)}{' '}
                      {stockProduct.unit || 'pcs'}
                    </strong>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Note</label>
                <input
                  className="form-input"
                  placeholder="Reason for adjustment..."
                  value={stockForm.note}
                  onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={stockSubmitting} className="btn-success" style={{ flex: 1 }}>
                  {stockSubmitting ? 'Saving...' : 'Update Stock'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowStockModal(false);
                    setError('');
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '11px 14px',
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    border: '1.5px solid var(--border-soft)',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistory && historyProduct && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: 620 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Stock History
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                  {historyProduct.name} · Current: <strong>{historyProduct.quantity} {historyProduct.unit || 'pcs'}</strong>
                </div>
              </div>

              <button
                onClick={() => setShowHistory(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                }}
              >
                ✕
              </button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>
                ⏳ लोड हो रहा है...
              </div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>
                कोई history नहीं
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {historyData.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 14px',
                      background: 'var(--surface-2)',
                      borderRadius: 16,
                      borderLeft: `4px solid ${h.quantity_change > 0 ? '#22C55E' : '#EF4444'}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                        {historyTypeLabel(h.type)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                        {new Date(h.date).toLocaleDateString('en-IN')} · {h.note || '—'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: h.quantity_change > 0 ? '#22C55E' : '#EF4444',
                        }}
                      >
                        {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                        → {h.quantity_after} {historyProduct.unit || 'pcs'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .product-hero-grid,
          .product-main-grid,
          .product-modal-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .hidden-xs { display: none !important; }
          .show-xs { display: flex !important; }
        }

        @media (min-width: 641px) {
          .show-xs { display: none !important; }
        }
      `}</style>
    </Layout>
  );
}
