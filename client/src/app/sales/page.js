'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({ product_id: '', quantity: '', price_per_unit: '', buyer_name: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  const fetchSales = async () => {
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/sales', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setSales(await res.json());
    } catch { setError('Could not load sales'); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    const res = await fetch('https://rakh-rakhaav.onrender.com/api/products', { headers: { Authorization: `Bearer ${getToken()}` } });
    setProducts(await res.json());
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchSales(); fetchProducts();
  }, []);

  const handleProductChange = (e) => {
    const p = products.find(x => x._id === e.target.value);
    setSelectedProduct(p);
    setForm({ ...form, product_id: e.target.value, price_per_unit: p?.price || '' });
  };

  const calcGST = () => {
    if (!form.quantity || !form.price_per_unit || !selectedProduct) return null;
    const taxable = parseFloat(form.quantity) * parseFloat(form.price_per_unit);
    const gst_rate = selectedProduct.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    const total = taxable + gst;
    return { taxable, gst_rate, gst, total, half_gst: gst / 2 };
  };

  const gstPreview = calcGST();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); setForm({ product_id: '', quantity: '', price_per_unit: '', buyer_name: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' }); setSelectedProduct(null); fetchSales(); }
      else setError(data.message || 'Failed');
    } catch { setError('Server error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sale? Stock will be restored.')) return;
    try {
      await fetch(`https://rakh-rakhaav.onrender.com/api/sales/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchSales();
    } catch { setError('Failed to delete'); }
  };

  const printInvoice = (sale) => {
    const win = window.open('', '_blank');
    const gstRows = sale.gst_type === 'IGST'
      ? `<tr><td colspan="3" style="text-align:right;font-weight:600">IGST @${sale.gst_rate}%</td><td>₹${sale.igst_amount?.toFixed(2)}</td></tr>`
      : `<tr><td colspan="3" style="text-align:right;font-weight:600">CGST @${sale.gst_rate / 2}%</td><td>₹${sale.cgst_amount?.toFixed(2)}</td></tr>
         <tr><td colspan="3" style="text-align:right;font-weight:600">SGST @${sale.gst_rate / 2}%</td><td>₹${sale.sgst_amount?.toFixed(2)}</td></tr>`;
    win.document.write(`
      <html><head><title>${sale.invoice_number}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333;max-width:800px;margin:0 auto}
        .header{display:flex;justify-content:space-between;margin-bottom:30px}
        .title{font-size:28px;font-weight:bold;color:#6366f1}
        .divider{border:none;border-top:2px solid #e5e7eb;margin:20px 0}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th{background:#f3f4f6;padding:12px;text-align:left;font-size:13px;text-transform:uppercase}
        td{padding:12px;border-bottom:1px solid #f3f4f6}
        .total{color:#10b981;font-size:18px;font-weight:bold}
        .footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:12px}
        .badge{background:#ede9fe;color:#6d28d9;padding:3px 10px;border-radius:20px;font-size:12px}
      </style></head>
      <body>
        <div class="header">
          <div>
            <div class="title">रखरखाव</div>
            <div style="color:#666;font-size:13px">Inventory Management</div>
          </div>
          <div style="text-align:right;font-size:14px">
            <div><strong>${sale.invoice_number}</strong></div>
            <div>Date: ${new Date(sale.sold_at).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        ${sale.buyer_name ? `<div style="margin-bottom:20px"><strong>Bill To:</strong><br/>${sale.buyer_name}${sale.buyer_gstin ? `<br/>GSTIN: ${sale.buyer_gstin}` : ''}${sale.buyer_address ? `<br/>${sale.buyer_address}` : ''}</div>` : ''}
        <hr class="divider"/>
        <table>
          <thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable</th></tr></thead>
          <tbody>
            <tr>
              <td>${sale.product_name}</td>
              <td>${sale.hsn_code || '—'}</td>
              <td>${sale.quantity}</td>
              <td>₹${sale.price_per_unit}</td>
              <td>₹${sale.taxable_amount?.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colspan="4" style="text-align:right;font-weight:600">Taxable Amount</td><td>₹${sale.taxable_amount?.toFixed(2)}</td></tr>
            ${sale.gst_rate > 0 ? gstRows : ''}
            <tr><td colspan="4" style="text-align:right;font-weight:700;font-size:16px">Total</td><td class="total">₹${sale.total_amount?.toFixed(2)}</td></tr>
          </tfoot>
        </table>
        ${sale.gst_rate > 0 ? `<div style="margin-top:16px"><span class="badge">GST ${sale.gst_type === 'IGST' ? 'IGST' : 'CGST+SGST'} @ ${sale.gst_rate}%</span></div>` : ''}
        <div class="footer">Thank you for your business! — रखरखाव</div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  const total = sales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
  const totalGST = sales.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Sales</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>Total Revenue: ₹{total.toFixed(2)}</div>
            {totalGST > 0 && <div style={{ color: '#6366f1', fontSize: 13, fontWeight: 600 }}>GST Collected: ₹{totalGST.toFixed(2)}</div>}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-success">+ Record Sale</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        : sales.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No sales recorded yet. Click "+ Record Sale" to get started.</div>
        ) : (
          <>
            <div className="table-container hidden-xs">
              <table>
                <thead><tr><th>Invoice</th><th>Product</th><th>Qty</th><th>Taxable</th><th>GST</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s._id}>
                      <td style={{ color: '#6366f1', fontWeight: 600, fontSize: 12 }}>{s.invoice_number}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{s.product_name}</div>
                        {s.buyer_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>To: {s.buyer_name}</div>}
                      </td>
                      <td>{s.quantity}</td>
                      <td>₹{s.taxable_amount?.toFixed(2)}</td>
                      <td>
                        {s.gst_rate > 0
                          ? <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{s.gst_rate}% • ₹{s.total_gst?.toFixed(2)}</span>
                          : <span style={{ color: '#9ca3af', fontSize: 12 }}>No GST</span>}
                      </td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>₹{s.total_amount?.toFixed(2)}</td>
                      <td style={{ color: '#9ca3af', fontSize: 13 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button onClick={() => printInvoice(s)} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 8 }}>Print</button>
                        <button onClick={() => handleDelete(s._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sales.map(s => (
                <div key={s._id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{s.product_name}</div>
                      <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{s.invoice_number}</div>
                      {s.buyer_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>To: {s.buyer_name}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>₹{s.total_amount?.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QTY</div><div style={{ fontWeight: 600 }}>{s.quantity}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TAXABLE</div><div style={{ fontWeight: 600 }}>₹{s.taxable_amount?.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div><div style={{ fontWeight: 600 }}>{s.gst_rate > 0 ? `${s.gst_rate}% • ₹${s.total_gst?.toFixed(2)}` : 'None'}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>DATE</div><div style={{ fontWeight: 600 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => printInvoice(s)} style={{ flex: 1, padding: '8px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print Invoice</button>
                    <button onClick={() => handleDelete(s._id)} style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1a1a2e' }}>Record Sale</h3>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-input" value={form.product_id} onChange={handleProductChange} required>
                  <option value="">Select a product</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (Stock: {p.quantity}) {p.gst_rate > 0 ? `• GST ${p.gst_rate}%` : ''}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price/Unit ₹ *</label>
                  <input className="form-input" type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} required />
                </div>
              </div>

              {gstPreview && (
                <div style={{ background: gstPreview.gst_rate > 0 ? '#ede9fe' : '#f0fdf4', border: `1px solid ${gstPreview.gst_rate > 0 ? '#c4b5fd' : '#bbf7d0'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: gstPreview.gst_rate > 0 ? '#6d28d9' : '#059669', marginBottom: 6 }}>Bill Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: gstPreview.gst_rate > 0 ? '#7c3aed' : '#065f46' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxable Amount:</span><strong>₹{gstPreview.taxable.toFixed(2)}</strong></div>
                    {gstPreview.gst_rate > 0 && <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div>
                    </>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4, marginTop: 2 }}>
                      <span>Total:</span><span>₹{gstPreview.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Buyer Details (Optional)</div>
                <div className="form-group">
                  <label className="form-label">Buyer Name</label>
                  <input className="form-input" placeholder="Customer name" value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Buyer GSTIN</label>
                    <input className="form-input" placeholder="GSTIN (if any)" value={form.buyer_gstin} onChange={e => setForm({ ...form, buyer_gstin: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Buyer State</label>
                    {/* ✅ State dropdown */}
                    <select className="form-input" value={form.buyer_state} onChange={e => setForm({ ...form, buyer_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="── States ──">
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                      <optgroup label="── Union Territories ──">
                        {UTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Buyer Address</label>
                  <input className="form-input" placeholder="Address" value={form.buyer_address} onChange={e => setForm({ ...form, buyer_address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-success" style={{ flex: 1 }}>Record Sale</button>
                <button type="button" onClick={() => { setShowModal(false); setError(''); setSelectedProduct(null); }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
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