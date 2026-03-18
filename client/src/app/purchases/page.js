'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    product_id: '', quantity: '', price_per_unit: '',
    payment_type: 'cash',
    supplier_name: '', supplier_phone: '', supplier_gstin: '',
    supplier_address: '', supplier_state: '', notes: ''
  });
  const [error, setError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');
  const API = 'https://rakh-rakhaav.onrender.com';

  const fetchPurchases = async () => {
    try {
      const res = await fetch(`${API}/api/purchases`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setPurchases(await res.json());
    } catch { setError('खरीद लोड नहीं हो सकी'); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    const res = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setProducts(await res.json());
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchPurchases(); fetchProducts();
  }, []);

  const handleProductChange = (e) => {
    const p = products.find(x => x._id === e.target.value);
    setSelectedProduct(p);
    setForm({ ...form, product_id: e.target.value, price_per_unit: p?.cost_price || p?.price || '' });
  };

  const calcGST = () => {
    if (!form.quantity || !form.price_per_unit || !selectedProduct) return null;
    const taxable = parseFloat(form.quantity) * parseFloat(form.price_per_unit);
    const gst_rate = selectedProduct.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2 };
  };

  const gstPreview = calcGST();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.payment_type === 'credit' && !form.supplier_name) {
      setError('उधार खरीद के लिए supplier का नाम जरूरी है!');
      return;
    }
    try {
      const res = await fetch(`${API}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setForm({ product_id: '', quantity: '', price_per_unit: '', payment_type: 'cash', supplier_name: '', supplier_phone: '', supplier_gstin: '', supplier_address: '', supplier_state: '', notes: '' });
        setSelectedProduct(null);
        fetchPurchases();
      } else setError(data.message || 'विफल');
    } catch { setError('सर्वर त्रुटि'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('इस खरीद को हटाएं? स्टॉक वापस आएगा।')) return;
    try {
      await fetch(`${API}/api/purchases/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchPurchases();
    } catch { setError('हटाने में विफल'); }
  };

  const total = purchases.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
  const totalGST = purchases.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);
  const creditTotal = purchases.filter(p => p.payment_type === 'credit').reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>खरीद / Purchases</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>कुल खर्च: ₹{total.toFixed(2)}</div>
            {totalGST > 0 && <div style={{ color: '#6366f1', fontSize: 13, fontWeight: 600 }}>GST Input: ₹{totalGST.toFixed(2)}</div>}
            {creditTotal > 0 && <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>उधार: ₹{creditTotal.toFixed(2)}</div>}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-warning">+ खरीद दर्ज / Record Purchase</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>लोड हो रहा है...</div>
      ) : purchases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
          <div>अभी कोई खरीद नहीं / No purchases yet.</div>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>उत्पाद / Product</th>
                  <th>Qty</th>
                  <th>Taxable</th>
                  <th>GST</th>
                  <th>कुल / Total</th>
                  <th>भुगतान</th>
                  <th>तारीख</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p._id}>
                    <td style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>{p.invoice_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{p.product_name}</div>
                      {p.supplier_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>से / From: {p.supplier_name}</div>}
                    </td>
                    <td>{p.quantity}</td>
                    <td>₹{p.taxable_amount?.toFixed(2)}</td>
                    <td>
                      {p.gst_rate > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.gst_rate}%</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>₹{p.total_amount?.toFixed(2)}</td>
                    <td>
                      {p.payment_type === 'credit'
                        ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>📒 उधार</span>
                        : <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>💵 नकद</span>}
                    </td>
                    <td style={{ color: '#9ca3af', fontSize: 13 }}>{new Date(p.purchased_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <button onClick={() => handleDelete(p._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map(p => (
              <div key={p._id} className="card" style={{ borderLeft: `3px solid ${p.payment_type === 'credit' ? '#ef4444' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{p.product_name}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{p.invoice_number}</div>
                    {p.supplier_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>से: {p.supplier_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>₹{p.total_amount?.toFixed(2)}</div>
                    {p.payment_type === 'credit'
                      ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>📒 उधार</span>
                      : <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>💵 नकद</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QTY</div><div style={{ fontWeight: 600 }}>{p.quantity}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TAXABLE</div><div style={{ fontWeight: 600 }}>₹{p.taxable_amount?.toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div><div style={{ fontWeight: 600 }}>{p.gst_rate > 0 ? `${p.gst_rate}%` : '—'}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>DATE</div><div style={{ fontWeight: 600 }}>{new Date(p.purchased_at).toLocaleDateString('en-IN')}</div></div>
                </div>
                <button onClick={() => handleDelete(p._id)} style={{ width: '100%', padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>खरीद दर्ज करें</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>Record Purchase</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit}>

              {/* Product */}
              <div className="form-group">
                <label className="form-label">उत्पाद / Product *</label>
                <select className="form-input" value={form.product_id} onChange={handleProductChange} required>
                  <option value="">उत्पाद चुनें / Select product</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (Stock: {p.quantity}) {p.gst_rate > 0 ? `• GST ${p.gst_rate}%` : ''}</option>)}
                </select>
              </div>

              {/* Qty + Price */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">मात्रा / Quantity *</label>
                  <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">खरीद मूल्य / Purchase Price ₹ *</label>
                  <input className="form-input" type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} required />
                </div>
              </div>

              {/* GST Preview */}
              {gstPreview && (
                <div style={{ background: gstPreview.gst_rate > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${gstPreview.gst_rate > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: gstPreview.gst_rate > 0 ? '#92400e' : '#059669', marginBottom: 6 }}>बिल पूर्वावलोकन / Bill Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxable:</span><strong>₹{gstPreview.taxable.toFixed(2)}</strong></div>
                    {gstPreview.gst_rate > 0 && <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div>
                    </>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4, marginTop: 2 }}>
                      <span>कुल / Total:</span><span>₹{gstPreview.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Type */}
              <div className="form-group">
                <label className="form-label">भुगतान प्रकार / Payment Type *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    onClick={() => setForm({ ...form, payment_type: 'cash' })}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '2px solid', borderColor: form.payment_type === 'cash' ? '#10b981' : '#e5e7eb', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: form.payment_type === 'cash' ? '#10b981' : '#f9fafb', color: form.payment_type === 'cash' ? '#fff' : '#374151' }}>
                    💵 नकद / Cash
                  </button>
                  <button type="button"
                    onClick={() => setForm({ ...form, payment_type: 'credit' })}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '2px solid', borderColor: form.payment_type === 'credit' ? '#ef4444' : '#e5e7eb', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: form.payment_type === 'credit' ? '#ef4444' : '#f9fafb', color: form.payment_type === 'credit' ? '#fff' : '#374151' }}>
                    📒 उधार / Credit
                  </button>
                </div>
                {form.payment_type === 'credit' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#991b1b' }}>
                    ⚠️ Supplier ledger mein entry automatically hogi
                  </div>
                )}
              </div>

              {/* Supplier Details */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.payment_type === 'credit' ? '#ef4444' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  {form.payment_type === 'credit' ? '🏭 Supplier Details (जरूरी *)' : '🏭 Supplier Details (वैकल्पिक)'}
                </div>

                <div className="form-group">
                  <label className="form-label">Supplier नाम {form.payment_type === 'credit' && <span style={{ color: '#ef4444' }}>*</span>}</label>
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
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>GSTIN se B2B purchase classify hoga</div>
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
                <button type="submit" className="btn-warning" style={{ flex: 1 }}>
                  {form.payment_type === 'credit' ? '📒 उधार खरीद / Credit Purchase' : '💵 खरीद दर्ज / Record Purchase'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setError(''); setSelectedProduct(null); }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>रद्द / Cancel</button>
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