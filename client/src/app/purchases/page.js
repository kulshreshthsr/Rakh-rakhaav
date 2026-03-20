'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({
    payment_type: 'cash', amount_paid: '',
    supplier_name: '', supplier_phone: '', supplier_gstin: '',
    supplier_address: '', supplier_state: '', notes: '',
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchPurchases(), fetchProducts()]);
    setLoading(false);
  };

  const fetchPurchases = async () => {
    try {
      const res = await fetch(`${API}/api/purchases`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setPurchases(data.purchases || []);
      setSummary(data.summary || {});
    } catch { setError('खरीद लोड नहीं हो सकी'); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {}
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => { if (items.length === 1) return; setItems(items.filter((_, i) => i !== index)); };

  const calcRowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = calcRowGST(item);
    if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });

  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.payment_type === 'credit' && !form.supplier_name) { setError('उधार खरीद के लिए supplier का नाम जरूरी है!'); return; }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('कम से कम एक product चुनें'); return; }
    setSubmitting(true);
    try {
      const payload = { items: validItems, payment_type: form.payment_type, amount_paid: form.payment_type === 'cash' ? billTotals.total : (amountPaidNum || 0), supplier_name: form.supplier_name, supplier_phone: form.supplier_phone, supplier_gstin: form.supplier_gstin, supplier_address: form.supplier_address, supplier_state: form.supplier_state, notes: form.notes };
      const res = await fetch(`${API}/api/purchases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { setShowModal(false); setItems([emptyItem()]); setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '' }); fetchPurchases(); }
      else setError(data.message || 'विफल');
    } catch { setError('सर्वर त्रुटि'); }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('इस खरीद को हटाएं? Stock वापस आएगा।')) return;
    try {
      await fetch(`${API}/api/purchases/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchPurchases();
    } catch { setError('हटाने में विफल'); }
  };

  const resetModal = () => { setShowModal(false); setError(''); setItems([emptyItem()]); setForm({ payment_type: 'cash', amount_paid: '', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '' }); };

  const PayBadge = ({ type }) => {
    const map = {
      cash:   { bg: '#ECFDF5', color: '#065F46', label: '💵 Cash' },
      credit: { bg: '#FEF2F2', color: '#991B1B', label: '📒 Credit' },
      upi:    { bg: '#F5F3FF', color: '#5B21B6', label: '📱 UPI' },
      bank:   { bg: '#EFF6FF', color: '#1E40AF', label: '🏦 Bank' },
    };
    const s = map[type] || map.cash;
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
  };

  const payBtnStyle = (opt, selected) => ({
    flex: 1, minWidth: 80, padding: '10px 4px', borderRadius: 'var(--radius-sm)',
    border: '2px solid', borderColor: selected ? opt.color : 'var(--border)',
    background: selected ? opt.color : 'var(--surface-2)',
    color: selected ? '#fff' : 'var(--text-2)',
    cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>खरीद / Purchases</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D97706', background: 'var(--warning-dim)', padding: '3px 10px', borderRadius: 100 }}>
              ₹{(summary.totalPurchaseValue || 0).toFixed(2)} Total
            </span>
            {(summary.totalITC || 0) > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', background: 'var(--primary-dim)', padding: '3px 10px', borderRadius: 100 }}>ITC: ₹{(summary.totalITC || 0).toFixed(2)}</span>}
            {(summary.totalDue || 0) > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', background: 'var(--danger-dim)', padding: '3px 10px', borderRadius: 100 }}>Due: ₹{(summary.totalDue || 0).toFixed(2)}</span>}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-warning">+ खरीद दर्ज करें</button>
      </div>

      {error && !showModal && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, border: '1px solid #FECACA' }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--text-4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#D97706', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          लोड हो रहा है...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : purchases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-2)', marginBottom: 4 }}>अभी कोई खरीद नहीं</div>
          <div style={{ fontSize: 13 }}>पहली खरीद दर्ज करें!</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th><th>Product / Supplier</th><th>Items</th><th>Taxable</th>
                  <th>ITC</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p._id}>
                    <td><span style={{ color: '#D97706', fontWeight: 700, fontSize: 12, background: '#FFFBEB', padding: '2px 8px', borderRadius: 6 }}>{p.invoice_number}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>
                        {p.items && p.items.length > 1 ? p.items.map(i => i.product_name).join(', ') : p.product_name}
                      </div>
                      {p.supplier_name && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>से: {p.supplier_name}</div>}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}</td>
                    <td>₹{(p.taxable_amount || 0).toFixed(2)}</td>
                    <td>
                      {p.total_gst > 0
                        ? <span style={{ background: '#FFFBEB', color: '#92400E', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>₹{p.total_gst.toFixed(2)}</span>
                        : <span style={{ color: 'var(--text-5)' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 800, color: '#D97706', fontSize: 14 }}>₹{(p.total_amount || 0).toFixed(2)}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>₹{(p.amount_paid || 0).toFixed(2)}</td>
                    <td>{(p.balance_due || 0) > 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>₹{p.balance_due.toFixed(2)}</span> : <span style={{ color: '#059669', fontWeight: 600 }}>✓ Paid</span>}</td>
                    <td><PayBadge type={p.payment_type} /></td>
                    <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <button onClick={() => handleDelete(p._id)} style={{ color: '#EF4444', background: '#FEF2F2', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map(p => (
              <div key={p._id} className="card" style={{ borderLeft: `4px solid ${p.payment_type === 'credit' ? '#EF4444' : '#D97706'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>
                      {p.items && p.items.length > 1 ? `${p.items.length} products` : p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>{p.invoice_number}</div>
                    {p.supplier_name && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>से: {p.supplier_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#D97706', fontSize: 17 }}>₹{(p.total_amount || 0).toFixed(2)}</div>
                    <div style={{ marginTop: 4 }}><PayBadge type={p.payment_type} /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Taxable</div><div style={{ fontWeight: 600, fontSize: 13 }}>₹{(p.taxable_amount || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>ITC</div><div style={{ fontWeight: 600, fontSize: 13, color: '#4F46E5' }}>₹{(p.total_gst || 0).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Paid</div><div style={{ fontWeight: 600, fontSize: 13, color: '#059669' }}>₹{(p.amount_paid || 0).toFixed(2)}</div></div>
                  {(p.balance_due || 0) > 0 && <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Due</div><div style={{ fontWeight: 700, fontSize: 13, color: '#EF4444' }}>₹{p.balance_due.toFixed(2)}</div></div>}
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Date</div><div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</div></div>
                </div>
                <button onClick={() => handleDelete(p._id)} style={{ width: '100%', padding: '9px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', width: '100%', maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>खरीद दर्ज करें</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Record new purchase / नई खरीद</div>
              </div>
              <button onClick={resetModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              {/* Items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🛒 Products</div>
                {items.map((item, index) => {
                  const rowGST = calcRowGST(item);
                  return (
                    <div key={index} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)} style={{ background: '#FEF2F2', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Product *</label>
                        <SearchableProductSelect products={products} value={item.product_id} onChange={(id) => updateItem(index, 'product_id', id)} placeholder="उत्पाद खोजें / Search product..." />
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input className="form-input" type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Purchase Price ₹ *</label>
                          <input className="form-input" type="number" step="0.01" value={item.price_per_unit} onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>
                      {rowGST && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', background: rowGST.gst_rate > 0 ? '#FFFBEB' : '#F0FDF4', borderRadius: 8, padding: '7px 12px', display: 'flex', gap: 16, border: `1px solid ${rowGST.gst_rate > 0 ? '#FDE68A' : '#BBF7D0'}` }}>
                          <span>Taxable: <strong>₹{rowGST.taxable.toFixed(2)}</strong></span>
                          {rowGST.gst_rate > 0 && <span>GST {rowGST.gst_rate}%: <strong>₹{rowGST.gst.toFixed(2)}</strong></span>}
                          <span>Total: <strong>₹{rowGST.total.toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addItem}
                  style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.color = '#D97706'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                  + Add Another Product
                </button>
              </div>

              {/* Bill Summary */}
              {billTotals.total > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 8, fontSize: 13 }}>📋 Bill Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78350F' }}><span>Subtotal (Taxable):</span><strong>₹{billTotals.taxable.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4F46E5' }}><span>Total GST (ITC):</span><strong>₹{billTotals.gst.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15.5, borderTop: '1px solid #FCD34D', paddingTop: 6, marginTop: 4, color: '#92400E' }}>
                      <span>Grand Total:</span><span>₹{billTotals.total.toFixed(2)}</span>
                    </div>
                    {form.payment_type === 'credit' && amountPaidNum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}><span>Balance Due:</span><span>₹{balanceDue.toFixed(2)}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Type */}
              <div className="form-group">
                <label className="form-label">Payment Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { val: 'cash', label: '💵 Cash', color: '#059669' },
                    { val: 'credit', label: '📒 Credit', color: '#EF4444' },
                    { val: 'upi', label: '📱 UPI', color: '#8B5CF6' },
                    { val: 'bank', label: '🏦 Bank', color: '#3B82F6' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setForm({ ...form, payment_type: opt.val })} style={payBtnStyle(opt, form.payment_type === opt.val)}>{opt.label}</button>
                  ))}
                </div>
                {form.payment_type === 'credit' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="form-label">Advance Payment (optional)</label>
                    <input className="form-input" type="number" step="0.01" min="0" placeholder={`Max ₹${billTotals.total.toFixed(2)}`} value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 13px', marginTop: 8, fontSize: 12.5, color: '#991B1B' }}>
                      ⚠️ बाकी ₹{balanceDue.toFixed(2)} supplier ledger में automatically जाएगा
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier Details */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: form.payment_type === 'credit' ? '#EF4444' : 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  🏭 Supplier Details {form.payment_type === 'credit' ? '(जरूरी *)' : '(वैकल्पिक)'}
                </div>
                <div className="form-group">
                  <label className="form-label">Supplier नाम {form.payment_type === 'credit' && <span style={{ color: '#EF4444' }}>*</span>}</label>
                  <input className="form-input" placeholder="Supplier ka naam" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} required={form.payment_type === 'credit'} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="Mobile number" value={form.supplier_phone} onChange={e => setForm({ ...form, supplier_phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN (optional)</label>
                    <input className="form-input" placeholder="Supplier GSTIN" value={form.supplier_gstin} onChange={e => setForm({ ...form, supplier_gstin: e.target.value })} />
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>GSTIN se B2B classify होगा</div>
                  </div>
                </div>
                {form.payment_type === 'credit' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Supplier State</label>
                      <select className="form-input" value={form.supplier_state} onChange={e => setForm({ ...form, supplier_state: e.target.value })}>
                        <option value="">Select State/UT</option>
                        <optgroup label="── States ──">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                        <optgroup label="── Union Territories ──">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input className="form-input" placeholder="Supplier address" value={form.supplier_address} onChange={e => setForm({ ...form, supplier_address: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">नोट / Notes</label>
                  <input className="form-input" placeholder="Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-warning" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'दर्ज हो रहा है...' : form.payment_type === 'credit' ? '📒 Credit Purchase' : '💵 Purchase दर्ज करें'}
                </button>
                <button type="button" onClick={resetModal}
                  style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}