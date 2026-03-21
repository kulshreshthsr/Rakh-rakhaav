'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { useAppLocale } from '../../components/AppLocale';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Empty item row
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });

export default function PurchasesPage() {
  const { locale } = useAppLocale();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({
    payment_type: 'cash',
    amount_paid: '',
    supplier_name: '', supplier_phone: '', supplier_gstin: '',
    supplier_address: '', supplier_state: '', notes: '',
  });
  const [purchaseStep, setPurchaseStep] = useState(0);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchPurchases(), fetchProducts()]);
    setLoading(false);
  }

  async function fetchPurchases() {
    try {
      const res = await fetch(`${API}/api/purchases`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setPurchases(data.purchases || []);
      setSummary(data.summary || {});
    } catch { setError('खरीद लोड नहीं हो सकी'); }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {}
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // ── Item row handlers ────────────────────────────────────────────────────────
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    // Auto-fill price when product selected
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index) => {
    if (items.length === 1) return; // keep at least 1
    setItems(items.filter((_, i) => i !== index));
  };

  // ── GST calculation per row ──────────────────────────────────────────────────
  const calcRowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2 };
  };

  // ── Bill totals ──────────────────────────────────────────────────────────────
  const billTotals = items.reduce((acc, item) => {
    const g = calcRowGST(item);
    if (!g) return acc;
    return {
      taxable: acc.taxable + g.taxable,
      gst: acc.gst + g.gst,
      total: acc.total + g.total,
    };
  }, { taxable: 0, gst: 0, total: 0 });

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const gstinValue = form.supplier_gstin.trim().toUpperCase();
  const gstinValid = !gstinValue || GSTIN_REGEX.test(gstinValue);
  const wizardSteps = [
    { title: locale === 'hi' ? 'आइटम्स' : 'Items', copy: locale === 'hi' ? 'खरीद सूची' : 'Purchase items' },
    { title: locale === 'hi' ? 'भुगतान' : 'Payment', copy: locale === 'hi' ? 'क्रेडिट या कैश' : 'Credit or cash' },
    { title: locale === 'hi' ? 'सप्लायर' : 'Supplier', copy: locale === 'hi' ? 'सप्लायर और GST' : 'Supplier and GST' },
  ];

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.payment_type === 'credit' && !form.supplier_name) {
      setError('उधार खरीद के लिए supplier का नाम जरूरी है!');
      return;
    }
    if (!gstinValid) {
      setError('Invalid GSTIN format');
      return;
    }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) {
      setError('कम से कम एक product चुनें');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: validItems,
        payment_type: form.payment_type,
        amount_paid: form.payment_type === 'cash' ? billTotals.total : (amountPaidNum || 0),
        supplier_name: form.supplier_name,
        supplier_phone: form.supplier_phone,
        supplier_gstin: form.supplier_gstin,
        supplier_address: form.supplier_address,
        supplier_state: form.supplier_state,
        notes: form.notes,
      };

      const res = await fetch(`${API}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        setItems([emptyItem()]);
        setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '' });
        fetchPurchases();
      } else {
        setError(data.message || 'विफल');
      }
    } catch {
      setError('सर्वर त्रुटि');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('इस खरीद को हटाएं? Stock वापस आएगा।')) return;
    try {
      await fetch(`${API}/api/purchases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchPurchases();
    } catch { setError('हटाने में विफल'); }
  };

  const resetModal = () => {
    setShowModal(false);
    setError('');
    setItems([emptyItem()]);
    setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '' });
    setPurchaseStep(0);
  }

  // ── Payment type badge helper ────────────────────────────────────────────────
  const PayBadge = ({ type }) => {
    const map = {
      cash:   { bg: '#dcfce7', color: '#166534', label: '💵 नकद' },
      credit: { bg: '#fee2e2', color: '#991b1b', label: '📒 उधार' },
      upi:    { bg: '#ede9fe', color: '#5b21b6', label: '📱 UPI' },
      bank:   { bg: '#dbeafe', color: '#1e40af', label: '🏦 Bank' },
    };
    const s = map[type] || map.cash;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
        {s.label}
      </span>
    );
  };

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>खरीद / Purchases</div>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-warning" style={{ width: 'auto' }}>
              + खरीद दर्ज / Record Purchase
            </button>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Total Spend</div>
            <div className="metric-value" style={{ color: '#f59e0b' }}>₹{(summary.totalPurchaseValue || 0).toFixed(2)}</div>
            <div className="metric-note">Purchase outflow</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Input GST</div>
            <div className="metric-value" style={{ color: '#6366f1' }}>₹{(summary.totalITC || 0).toFixed(2)}</div>
            <div className="metric-note">ITC available</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Balance Due</div>
            <div className="metric-value" style={{ color: (summary.totalDue || 0) > 0 ? '#ef4444' : '#10b981' }}>₹{(summary.totalDue || 0).toFixed(2)}</div>
            <div className="metric-note">Supplier credit outstanding</div>
          </div>
        </section>

        {error && !showModal && (
          <div className="alert-error">
          {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <div>लोड हो रहा है...</div>
          </div>
        ) : purchases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <div>अभी कोई खरीद नहीं / No purchases yet.</div>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>उत्पाद / Product</th>
                  <th>Items</th>
                  <th>Taxable</th>
                  <th>GST (ITC)</th>
                  <th>कुल / Total</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>भुगतान</th>
                  <th>तारीख</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p._id}>
                    <td style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>{p.invoice_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>
                        {/* Show all item names if multi-item */}
                        {p.items && p.items.length > 1
                          ? p.items.map(i => i.product_name).join(', ')
                          : p.product_name}
                      </div>
                      {p.supplier_name && (
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>से: {p.supplier_name}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>
                      {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
                    </td>
                    <td>₹{(p.taxable_amount || 0).toFixed(2)}</td>
                    <td>
                      {p.total_gst > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>₹{p.total_gst.toFixed(2)}</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>₹{(p.total_amount || 0).toFixed(2)}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>₹{(p.amount_paid || 0).toFixed(2)}</td>
                    <td>
                      {(p.balance_due || 0) > 0
                        ? <span style={{ color: '#ef4444', fontWeight: 700 }}>₹{p.balance_due.toFixed(2)}</span>
                        : <span style={{ color: '#10b981' }}>✓ Paid</span>}
                    </td>
                    <td><PayBadge type={p.payment_type} /></td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>
                      {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(p._id)}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map(p => (
              <div key={p._id} className="card"
                style={{ borderLeft: `3px solid ${p.payment_type === 'credit' ? '#ef4444' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                      {p.items && p.items.length > 1
                        ? `${p.items.length} products`
                        : p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{p.invoice_number}</div>
                    {p.supplier_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>से: {p.supplier_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>
                      ₹{(p.total_amount || 0).toFixed(2)}
                    </div>
                    <PayBadge type={p.payment_type} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>TAXABLE</div><div style={{ fontWeight: 600, fontSize: 13 }}>₹{(p.taxable_amount || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>ITC</div><div style={{ fontWeight: 600, fontSize: 13, color: '#6366f1' }}>₹{(p.total_gst || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>PAID</div><div style={{ fontWeight: 600, fontSize: 13, color: '#10b981' }}>₹{(p.amount_paid || 0).toFixed(2)}</div></div>
                  {(p.balance_due || 0) > 0 && (
                    <div><div style={{ fontSize: 11, color: '#9ca3af' }}>DUE</div><div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>₹{p.balance_due.toFixed(2)}</div></div>
                  )}
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>DATE</div><div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</div></div>
                </div>

                <button onClick={() => handleDelete(p._id)}
                  style={{ width: '100%', padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', width: '100%', maxWidth: 560 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>
              खरीद दर्ज करें / Record Purchase
            </h3>
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              {locale === 'hi' ? 'Guided wizard: products चुनें, payment तय करें, फिर supplier details जोड़ें।' : 'Guided wizard: choose products, confirm payment and finish supplier details.'}
            </div>
            <div className="wizard-progress" style={{ marginBottom: 16 }}>
              {wizardSteps.map((step, index) => (
                <div key={step.title} className={`wizard-step ${purchaseStep === index ? 'is-active' : ''}`}>
                  <div className="wizard-step-index">{index + 1}</div>
                  <div className="wizard-step-title">{step.title}</div>
                  <div className="wizard-step-copy">{step.copy}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>

              {/* ── ITEMS ── */}
              <div style={{ marginBottom: 12, display: purchaseStep === 0 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  🛒 Products
                </div>

                {items.map((item, index) => {
                  const rowGST = calcRowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                            ×
                          </button>
                        )}
                      </div>

                      {/* Product select */}
                      <div className="form-group">
                        <label className="form-label">Product *</label>
                        <SearchableProductSelect
                          products={products}
                          value={item.product_id}
                          onChange={(id) => updateItem(index, 'product_id', id)}
                          placeholder="उत्पाद खोजें / Search product..."
                        />
                      </div>

                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input className="form-input" type="number" min="1"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Purchase Price ₹ *</label>
                          <input className="form-input" type="number" step="0.01"
                            value={item.price_per_unit}
                            onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>

                      {/* Row GST preview */}
                      {rowGST && (
                        <div style={{ fontSize: 12, color: '#6b7280', background: rowGST.gst_rate > 0 ? '#fffbeb' : '#f0fdf4', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 16 }}>
                          <span>Taxable: <strong>₹{rowGST.taxable.toFixed(2)}</strong></span>
                          {rowGST.gst_rate > 0 && <span>GST {rowGST.gst_rate}%: <strong>₹{rowGST.gst.toFixed(2)}</strong></span>}
                          <span>Total: <strong>₹{rowGST.total.toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addItem}
                  style={{ width: '100%', padding: '9px', background: '#fff', border: '1.5px dashed #d1d5db', borderRadius: 8, color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Add Another Product
                </button>
              </div>

              {/* ── BILL SUMMARY ── */}
              {billTotals.total > 0 && purchaseStep === 1 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6 }}>📋 Bill Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal (Taxable):</span><strong>₹{billTotals.taxable.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total GST (ITC):</span><strong style={{ color: '#6366f1' }}>₹{billTotals.gst.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4, marginTop: 2 }}>
                      <span>Grand Total:</span><span>₹{billTotals.total.toFixed(2)}</span>
                    </div>
                    {form.payment_type === 'credit' && amountPaidNum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 700 }}>
                        <span>Balance Due:</span><span>₹{balanceDue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PAYMENT TYPE ── */}
              <div className="form-group" style={{ display: purchaseStep === 1 ? 'block' : 'none' }}>
                <label className="form-label">भुगतान प्रकार / Payment Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { val: 'cash',   label: '💵 Cash',  color: '#10b981' },
                    { val: 'credit', label: '📒 Credit', color: '#ef4444' },
                    { val: 'upi',    label: '📱 UPI',    color: '#8b5cf6' },
                    { val: 'bank',   label: '🏦 Bank',   color: '#3b82f6' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setForm({ ...form, payment_type: opt.val })}
                      style={{
                        flex: 1, minWidth: 80, padding: '9px 4px', borderRadius: 8, border: '2px solid',
                        borderColor: form.payment_type === opt.val ? opt.color : '#e5e7eb',
                        background: form.payment_type === opt.val ? opt.color : '#f9fafb',
                        color: form.payment_type === opt.val ? '#fff' : '#374151',
                        cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Partial payment for credit */}
                {form.payment_type === 'credit' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="form-label">Advance Payment (optional)</label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      placeholder={`Max ₹${billTotals.total.toFixed(2)}`}
                      value={form.amount_paid}
                      onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 6, fontSize: 12, color: '#991b1b' }}>
                      ⚠️ बाकी ₹{balanceDue.toFixed(2)} supplier ledger में automatically जाएगा
                    </div>
                  </div>
                )}
              </div>

              {/* ── SUPPLIER DETAILS ── */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginBottom: 14, display: purchaseStep === 2 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.payment_type === 'credit' ? '#ef4444' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  🏭 Supplier Details {form.payment_type === 'credit' ? '(जरूरी *)' : '(वैकल्पिक)'}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Supplier नाम {form.payment_type === 'credit' && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input className="form-input" placeholder="Supplier ka naam"
                    value={form.supplier_name}
                    onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                    required={form.payment_type === 'credit'} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="Mobile number"
                      value={form.supplier_phone}
                      onChange={e => setForm({ ...form, supplier_phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN (optional)</label>
                      <input className="form-input" placeholder="Supplier GSTIN"
                        value={form.supplier_gstin}
                        onChange={e => setForm({ ...form, supplier_gstin: e.target.value.toUpperCase() })} />
                      {gstinValue && !gstinValid && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Invalid GSTIN format</div>
                      )}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>GSTIN se B2B classify होगा</div>
                  </div>
                </div>

                {form.payment_type === 'credit' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Supplier State</label>
                      <select className="form-input" value={form.supplier_state}
                        onChange={e => setForm({ ...form, supplier_state: e.target.value })}>
                        <option value="">Select State/UT</option>
                        <optgroup label="── States ──">
                          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                        <optgroup label="── Union Territories ──">
                          {UTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input className="form-input" placeholder="Supplier address"
                        value={form.supplier_address}
                        onChange={e => setForm({ ...form, supplier_address: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">नोट / Notes</label>
                  <input className="form-input" placeholder="Any notes..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              {/* ── SUBMIT ── */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {purchaseStep > 0 && (
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setPurchaseStep((current) => current - 1)}>
                    Back
                  </button>
                )}
                {purchaseStep < 2 ? (
                  <button type="button" className="btn-warning" style={{ flex: 1 }} onClick={() => setPurchaseStep((current) => current + 1)}>
                    Continue
                  </button>
                ) : (
                <button type="submit" className="btn-warning" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'दर्ज हो रहा है...' : form.payment_type === 'credit' ? '📒 Credit Purchase' : '💵 Purchase दर्ज करें'}
                </button>
                )}
                <button type="button" onClick={resetModal}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  रद्द / Cancel
                </button>
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
