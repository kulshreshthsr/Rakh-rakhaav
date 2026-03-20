'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });

const numberToWords = (num) => {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  };
  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);
  return convert(rupees) + ' Rupees' + (paise ? ' and '+convert(paise)+' Paise' : '') + ' Only';
};

const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const payLabel =
    sale.payment_type === 'cash'   ? '✅ Cash (Paid)'   :
    sale.payment_type === 'upi'    ? '✅ UPI (Paid)'    :
    sale.payment_type === 'bank'   ? '✅ Bank Transfer' : '📒 Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) => `  ${i + 1}. ${item.product_name} × ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`).join('\n')
    : `  1. ${sale.product_name} × ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;
  const isIGST = sale.gst_type === 'IGST' || (sale.items && sale.items.some(i => i.gst_type === 'IGST'));
  const gstLine = (sale.total_gst && sale.total_gst > 0)
    ? isIGST ? `🔹 IGST: ₹${fmt(sale.igst_amount)}` : `🔹 CGST: ₹${fmt(sale.cgst_amount)}  |  SGST: ₹${fmt(sale.sgst_amount)}`
    : `🔹 GST: NIL`;
  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste *${sale.buyer_name}* ji! 🙏\n\n` : '';
  return [`${greeting}🧾 *Invoice / Bill Details*`,`━━━━━━━━━━━━━━━━━━━━`,`🏪 Shop: *${shopName || 'Rakhaav'}*`,`📄 Invoice No: *${sale.invoice_number}*`,`📅 Date: ${saleDate}`,`━━━━━━━━━━━━━━━━━━━━`,`📦 *Items:*`,itemLines,`━━━━━━━━━━━━━━━━━━━━`,`💵 Taxable Amount: ₹${fmt(sale.taxable_amount)}`,gstLine,`💰 *Total Amount: ₹${fmt(sale.total_amount)}*`,`━━━━━━━━━━━━━━━━━━━━`,`💳 Payment: ${payLabel}`,`━━━━━━━━━━━━━━━━━━━━`,`🙏 Aapka business hamare liye bahut important hai!`,`Thank you for choosing *${shopName || 'Rakhaav'}* 😊`,``,`_Powered by Rakhaav Business Manager_`].join('\n');
};

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales]           = useState([]);
  const [summary, setSummary]       = useState({});
  const [products, setProducts]     = useState([]);
  const [shopName, setShopName]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [items, setItems]           = useState([emptyItem()]);
  const [form, setForm]             = useState({
    payment_type: 'cash',
    buyer_name: '', buyer_phone: '', buyer_gstin: '',
    buyer_address: '', buyer_state: '', notes: '',
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchProducts()]);
    setLoading(false);
  };

  const fetchSales = async () => {
    try {
      const res = await fetch(`${API}/api/sales`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setSales(data.sales || (Array.isArray(data) ? data : []));
      setSummary(data.summary || {});
    } catch { setError('बिक्री लोड नहीं हो सकी'); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {}
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(shop => setShopName(shop.name || '')).catch(() => {});
  }, []);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find(p => p._id === value);
      if (prod) updated[index].price_per_unit = prod.price || '';
    }
    setItems(updated);
  };

  const addItem    = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const rowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable  = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst      = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2 };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = rowGST(item);
    if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.payment_type === 'credit' && !form.buyer_name) {
      setError('उधार बिक्री के लिए ग्राहक का नाम जरूरी है!'); return;
    }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('कम से कम एक product चुनें'); return; }
    for (const item of validItems) {
      const prod = products.find(p => p._id === item.product_id);
      if (prod && Number(item.quantity) > (prod.quantity || 0)) {
        setError(prod.name + ': सिर्फ ' + prod.quantity + ' stock available है'); return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items: validItems, ...form }),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); resetForm(); fetchAll(); }
      else setError(data.message || 'विफल');
    } catch { setError('सर्वर त्रुटि'); }
    setSubmitting(false);
  };

  const resetForm = () => {
    setItems([emptyItem()]);
    setForm({ payment_type: 'cash', buyer_name: '', buyer_phone: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' });
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('इस बिक्री को हटाएं? Stock वापस आएगा।')) return;
    try {
      await fetch(`${API}/api/sales/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchAll();
    } catch { setError('हटाने में विफल'); }
  };

  const printInvoice = async (sale) => {
    try {
      const shopRes = await fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const shop = await shopRes.json();
      generateInvoiceHTML(sale, shop, true);
    } catch { alert('Invoice generate nahi hua'); }
  };

  const shareWhatsApp = (sale) => {
    const msg   = buildWhatsAppMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    const waUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const PayBadge = ({ type }) => {
    const map = {
      cash:   { bg: '#ECFDF5', color: '#065F46', label: '💵 Cash' },
      credit: { bg: '#FEF2F2', color: '#991B1B', label: '📒 Credit' },
      upi:    { bg: '#F5F3FF', color: '#5B21B6', label: '📱 UPI' },
      bank:   { bg: '#EFF6FF', color: '#1E40AF', label: '🏦 Bank' },
    };
    const s = map[type] || map.cash;
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{s.label}</span>;
  };

  const payBtnStyles = (opt, selected) => ({
    flex: 1, minWidth: 70, padding: '10px 6px', borderRadius: 'var(--radius-sm)',
    border: '2px solid', borderColor: selected ? opt.color : 'var(--border)',
    background: selected ? opt.color : 'var(--surface-2)',
    color: selected ? '#fff' : 'var(--text-2)',
    cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>बिक्री / Sales</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#059669', background: 'var(--emerald-dim)', padding: '3px 10px', borderRadius: 100 }}>
              ₹{fmt(summary.totalRevenue)} Revenue
            </span>
            {(summary.totalGST || 0) > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', background: 'var(--primary-dim)', padding: '3px 10px', borderRadius: 100 }}>
                GST ₹{fmt(summary.totalGST)}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-success">
          + बिक्री दर्ज करें
        </button>
      </div>

      {error && !showModal && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, fontWeight: 500, border: '1px solid #FECACA' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--text-4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#4F46E5', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          लोड हो रहा है...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : sales.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-2)', marginBottom: 4 }}>अभी कोई बिक्री नहीं</div>
          <div style={{ fontSize: 13 }}>पहली बिक्री दर्ज करें!</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th><th>Items / Buyer</th><th>Taxable</th><th>GST</th>
                  <th>Total</th><th>Payment</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s._id}>
                    <td>
                      <span style={{ color: '#4F46E5', fontWeight: 700, fontSize: 12, background: 'var(--primary-dim)', padding: '2px 8px', borderRadius: 6 }}>
                        {s.invoice_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>
                        {s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name}
                      </div>
                      {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>→ {s.buyer_name}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>₹{fmt(s.taxable_amount)}</td>
                    <td>
                      {(s.total_gst || 0) > 0
                        ? <span style={{ background: '#F5F3FF', color: '#6D28D9', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>₹{fmt(s.total_gst)}</span>
                        : <span style={{ color: 'var(--text-5)' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>₹{fmt(s.total_amount)}</td>
                    <td><PayBadge type={s.payment_type} /></td>
                    <td style={{ color: 'var(--text-4)', fontSize: 12 }}>
                      {new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => printInvoice(s)} style={{ color: '#4F46E5', background: '#EEF2FF', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>🖨️ Print</button>
                        <button onClick={() => shareWhatsApp(s)} style={{ color: '#059669', background: '#ECFDF5', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>📲 WA</button>
                        <button onClick={() => handleDelete(s._id)} style={{ color: '#EF4444', background: '#FEF2F2', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 7, fontFamily: 'var(--font-body)' }}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sales.map(s => (
              <div key={s._id} className="card" style={{ borderLeft: `4px solid ${s.payment_type === 'credit' ? '#EF4444' : '#059669'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>
                      {s.items && s.items.length > 1 ? `${s.items.length} products` : s.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700, marginTop: 2 }}>{s.invoice_number}</div>
                    {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>→ {s.buyer_name}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 17 }}>₹{fmt(s.total_amount)}</div>
                    <div style={{ marginTop: 4 }}><PayBadge type={s.payment_type} /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Taxable</div><div style={{ fontWeight: 600, fontSize: 13 }}>₹{fmt(s.taxable_amount)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>GST</div><div style={{ fontWeight: 600, fontSize: 13, color: '#6D28D9' }}>₹{fmt(s.total_gst)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Date</div><div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => printInvoice(s)} style={{ flex: 1, padding: '9px', background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>🖨️ Print</button>
                  <button onClick={() => shareWhatsApp(s)} style={{ flex: 1, padding: '9px', background: '#ECFDF5', color: '#059669', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📲 WhatsApp</button>
                  <button onClick={() => handleDelete(s._id)} style={{ flex: 1, padding: '9px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>बिक्री दर्ज करें</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Record new sale / नई बिक्री</div>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ── Items section ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🛍️ Items</div>
                {items.map((item, index) => {
                  const g    = rowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            style={{ background: '#FEF2F2', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Product *</label>
                        <SearchableProductSelect products={products} value={item.product_id} onChange={(id) => updateItem(index, 'product_id', id)} />
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input className="form-input" type="number" min="1" max={prod ? prod.quantity : undefined}
                            value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                          {prod && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>Available: {prod.quantity}</div>}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price/Unit ₹ *</label>
                          <input className="form-input" type="number" step="0.01"
                            value={item.price_per_unit} onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>
                      {g && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', background: g.gst_rate > 0 ? '#F5F3FF' : '#F0FDF4', borderRadius: 8, padding: '7px 12px', display: 'flex', gap: 16, flexWrap: 'wrap', border: `1px solid ${g.gst_rate > 0 ? '#DDD6FE' : '#BBF7D0'}` }}>
                          <span>Taxable: <strong>₹{fmt(g.taxable)}</strong></span>
                          {g.gst_rate > 0 && <span>GST {g.gst_rate}%: <strong>₹{fmt(g.gst)}</strong></span>}
                          <span>Total: <strong style={{ color: g.gst_rate > 0 ? '#6D28D9' : '#059669' }}>₹{fmt(g.total)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addItem}
                  style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                  + Add Another Product
                </button>
              </div>

              {/* Bill Summary */}
              {billTotals.total > 0 && (
                <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#6D28D9', marginBottom: 8, fontSize: 13 }}>📋 Bill Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7C3AED' }}><span>Taxable Amount:</span><strong>₹{fmt(billTotals.taxable)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7C3AED' }}><span>GST:</span><strong>₹{fmt(billTotals.gst)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15.5, borderTop: '1px solid #C4B5FD', paddingTop: 6, marginTop: 4, color: '#5B21B6' }}>
                      <span>Total:</span><span>₹{fmt(billTotals.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Type */}
              <div className="form-group">
                <label className="form-label">Payment Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { val: 'cash',   label: '💵 Cash',   color: '#059669' },
                    { val: 'credit', label: '📒 Credit', color: '#EF4444' },
                    { val: 'upi',    label: '📱 UPI',    color: '#8B5CF6' },
                    { val: 'bank',   label: '🏦 Bank',   color: '#3B82F6' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setForm({ ...form, payment_type: opt.val })}
                      style={payBtnStyles(opt, form.payment_type === opt.val)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.payment_type === 'credit' && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 13px', marginTop: 8, fontSize: 12.5, color: '#991B1B', fontWeight: 500 }}>
                    ⚠️ उधार बही में entry अपने आप होगी
                  </div>
                )}
              </div>

              {/* Buyer Details */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: form.payment_type === 'credit' ? '#EF4444' : 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  👤 {form.payment_type === 'credit' ? 'Customer Details (जरूरी *)' : 'Buyer Details (वैकल्पिक)'}
                </div>
                <div className="form-group">
                  <label className="form-label">नाम / Name {form.payment_type === 'credit' && <span style={{ color: '#EF4444' }}>*</span>}</label>
                  <input className="form-input" placeholder="ग्राहक का नाम"
                    value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })}
                    required={form.payment_type === 'credit'} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="Mobile" value={form.buyer_phone} onChange={e => setForm({ ...form, buyer_phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input className="form-input" placeholder="GSTIN for B2B" value={form.buyer_gstin} onChange={e => setForm({ ...form, buyer_gstin: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-input" value={form.buyer_state} onChange={e => setForm({ ...form, buyer_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="── States ──">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label="── Union Territories ──">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" placeholder="Address" value={form.buyer_address} onChange={e => setForm({ ...form, buyer_address: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-success" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? '⏳ दर्ज हो रहा है...' : form.payment_type === 'credit' ? '📒 Credit Sale दर्ज' : '💵 बिक्री दर्ज करें'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
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

// ── Invoice HTML Generator (UNCHANGED) ───────────────────────────────────────
function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity, price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate, taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount, sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount, gst_type: sale.gst_type, total_amount: sale.total_amount }];
  const isIGST   = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const colSpan  = isIGST ? 8 : 10;
  const gstCols = isIGST ? '<th>IGST%</th><th>IGST ₹</th>' : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';
  const itemRows = saleItems.map((item, idx) => { const gstCells = isIGST ? '<td>' + (item.gst_rate || 0) + '%</td><td>₹' + fmt(item.igst_amount) + '</td>' : '<td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.cgst_amount) + '</td><td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.sgst_amount) + '</td>'; return '<tr><td>' + (idx + 1) + '</td><td style="text-align:left"><strong>' + item.product_name + '</strong></td><td>' + (item.hsn_code || '—') + '</td><td>' + item.quantity + '</td><td>₹' + fmt(item.price_per_unit) + '</td><td>₹' + fmt(item.taxable_amount) + '</td>' + gstCells + '<td><strong>₹' + fmt(item.total_amount) + '</strong></td></tr>'; }).join('');
  const emptyCell  = '<td style="height:20px"></td>';
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill('<tr>' + emptyCell.repeat(colSpan) + '</tr>').join('');
  const footerGST = isIGST ? '<td></td><td>₹' + fmt(sale.igst_amount) + '</td>' : '<td></td><td>₹' + fmt(sale.cgst_amount) + '</td><td></td><td>₹' + fmt(sale.sgst_amount) + '</td>';
  const amountGSTRows = isIGST ? '<div class="amount-row"><span>IGST @' + (sale.gst_rate || 0) + '%</span><span>₹' + fmt(sale.igst_amount) + '</span></div>' : '<div class="amount-row"><span>CGST @' + ((sale.gst_rate || 0) / 2).toFixed(1) + '%</span><span>₹' + fmt(sale.cgst_amount) + '</span></div><div class="amount-row"><span>SGST @' + ((sale.gst_rate || 0) / 2).toFixed(1) + '%</span><span>₹' + fmt(sale.sgst_amount) + '</span></div>';
  const payBg    = sale.payment_type === 'cash' ? '#dcfce7' : sale.payment_type === 'upi' ? '#ede9fe' : '#fee2e2';
  const payColor = sale.payment_type === 'cash' ? '#166534' : sale.payment_type === 'upi' ? '#5b21b6' : '#991b1b';
  const payLabel = sale.payment_type === 'cash' ? '💵 CASH' : sale.payment_type === 'upi' ? '📱 UPI' : sale.payment_type === 'bank' ? '🏦 BANK' : '📒 CREDIT';
  const bankHTML = shop.bank_name ? '<div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px">🏦 Bank Details</div>' + '<div style="font-size:11px;margin-bottom:3px">Bank: <strong>' + shop.bank_name + '</strong></div>' + (shop.bank_branch ? '<div style="font-size:11px;margin-bottom:3px">Branch: <strong>' + shop.bank_branch + '</strong></div>' : '') + (shop.bank_account ? '<div style="font-size:11px;margin-bottom:3px">A/C: <strong>' + shop.bank_account + '</strong></div>' : '') + (shop.bank_ifsc ? '<div style="font-size:11px">IFSC: <strong>' + shop.bank_ifsc + '</strong></div>' : '') : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>';
  const termsHTML = shop.terms ? '<div class="terms-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div><div style="font-size:10px;color:#374151">' + shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>') + '</div></div>' : '';
  const creditNote = sale.payment_type === 'credit' ? '<div style="margin-top:8px;background:#fee2e2;border-radius:6px;padding:6px 8px"><div style="font-size:10px;font-weight:700;color:#991b1b">📒 CREDIT SALE — उधार</div><div style="font-size:11px;color:#991b1b">Amount added to customer ledger</div></div>' : '';
  const pdfBanner = suggestedFileName && !autoPrint ? '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px"><span style="font-size:18px">📄</span><div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → Change destination to <strong>"Save as PDF"</strong> → Save as <strong>' + suggestedFileName + '</strong><br/><span style="font-size:11px;opacity:0.8">Then attach this PDF file on WhatsApp</span></div></div>' : '';
  const html = '<!DOCTYPE html><html><head><title>Invoice - ' + sale.invoice_number + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}.invoice{max-width:800px;margin:0 auto;padding:20px;border:2px solid #000}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #0B1D35;padding-bottom:10px}.shop-name{font-size:26px;font-weight:900;color:#0B1D35}.shop-name span{color:#059669}.title-bar{background:#0B1D35;color:white;text-align:center;padding:6px;font-size:16px;font-weight:700;letter-spacing:2px;margin-bottom:8px}.gstin-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;margin-bottom:8px}.gstin-cell{padding:5px 10px;font-weight:700;font-size:12px;border-right:1px solid #000}.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:0}.party-box{padding:8px}.party-box:first-child{border-right:1px solid #000}.party-label{font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}.party-name{font-size:14px;font-weight:700;color:#0B1D35}.party-detail{font-size:11px;color:#374151;margin-top:2px}.inv-details{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #000;border-top:none;margin-bottom:8px}.inv-detail-box{padding:5px 8px;border-right:1px solid #e5e7eb;font-size:11px}table{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:0}th{background:#0B1D35;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #374151}td{padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-size:11px}td:nth-child(2){text-align:left}tr:nth-child(even){background:#f9fafb}.totals-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.words-box{padding:10px;border-right:1px solid #000}.amounts-box{padding:6px 10px}.amount-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f3f4f6}.amount-total{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:900;color:#0B1D35;border-top:2px solid #0B1D35;margin-top:4px}.footer-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.bank-box{padding:10px;border-right:1px solid #000}.sign-box{padding:10px;text-align:right}.terms-box{border:1px solid #000;border-top:none;padding:8px 10px}.logo-circle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0B1D35,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}@media print{.pdf-banner{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}</style></head><body><div class="pdf-banner" style="max-width:800px;margin:0 auto 0;">' + pdfBanner + '</div><div class="invoice"><div class="header"><div><div class="shop-name">रख<span>रखाव</span></div><div style="font-size:11px;color:#059669;font-weight:600;background:#ecfdf5;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px">Business Manager</div>' + (shop.address ? '<div style="font-size:11px;color:#374151;margin-top:4px">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '') + (shop.phone ? '<div style="font-size:11px;color:#374151">📞 ' + shop.phone + (shop.email ? ' | ✉️ ' + shop.email : '') + '</div>' : '') + '</div><div class="logo-circle">र</div></div><div class="title-bar">TAX INVOICE / कर चालान</div><div class="gstin-row"><div class="gstin-cell">GSTIN: ' + (shop.gstin || 'N/A') + '</div><div style="flex:1;text-align:center;padding:5px;font-size:11px"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div><div style="padding:5px 10px;font-size:10px;font-weight:700;color:#059669;border-left:1px solid #000">ORIGINAL FOR RECIPIENT</div></div><div class="parties"><div class="party-box"><div class="party-label">विक्रेता / Seller</div><div class="party-name">' + (shop.name || 'रखरखाव') + '</div>' + (shop.address ? '<div class="party-detail">📍 ' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '') + (shop.phone ? '<div class="party-detail">📞 ' + shop.phone + '</div>' : '') + (shop.gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + shop.gstin + '</div>' : '') + '</div><div class="party-box"><div class="party-label">खरीदार / Buyer</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>' + (sale.buyer_address ? '<div class="party-detail">📍 ' + sale.buyer_address + '</div>' : '') + (sale.buyer_state ? '<div class="party-detail">State: ' + sale.buyer_state + '</div>' : '') + (sale.buyer_gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + sale.buyer_gstin + '</div>' : '') + (sale.buyer_phone ? '<div class="party-detail">📞 ' + sale.buyer_phone + '</div>' : '') + '</div></div><div class="inv-details"><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Invoice No.</div><div style="font-weight:700;color:#059669">' + sale.invoice_number + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Date</div><div style="font-weight:700">' + saleDate + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Type</div><div style="font-weight:700">' + (sale.invoice_type || 'B2C') + ' | ' + (isIGST ? 'IGST' : 'CGST+SGST') + '</div></div></div><table><thead><tr><th style="width:28px">Sr.</th><th style="text-align:left">Product</th><th>HSN</th><th>Qty</th><th>Rate ₹</th><th>Taxable ₹</th>' + gstCols + '<th>Total ₹</th></tr></thead><tbody>' + itemRows + fillerRows + '</tbody><tfoot><tr style="background:#f3f4f6;font-weight:700"><td colspan="5" style="text-align:right">कुल / Total</td><td>₹' + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td><strong>₹' + fmt(sale.total_amount) + '</strong></td></tr></tfoot></table><div class="totals-section"><div class="words-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Amount in Words</div><div style="font-size:11px;font-weight:600;color:#0B1D35;font-style:italic">' + numberToWords(parseFloat(sale.total_amount)) + '</div>' + creditNote + '</div><div class="amounts-box"><div class="amount-row"><span>Taxable Amount</span><span>₹' + fmt(sale.taxable_amount) + '</span></div>' + amountGSTRows + '<div class="amount-row"><span>Total GST</span><span>₹' + fmt(sale.total_gst) + '</span></div><div class="amount-total"><span>GRAND TOTAL</span><span>₹' + fmt(sale.total_amount) + '</span></div></div></div><div class="footer-section"><div class="bank-box">' + bankHTML + '</div><div class="sign-box"><div style="font-size:12px;font-weight:700;margin-bottom:40px">For <strong>' + (shop.name || 'रखरखाव') + '</strong></div><div style="border-top:1px solid #000;padding-top:4px;font-size:11px;font-weight:700">Authorised Signatory</div><div style="font-size:10px;color:#9ca3af;margin-top:6px">Computer generated invoice<br/>No signature required.</div></div></div>' + termsHTML + '<div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic">~ Rakhaav Business Manager ~</div></div>' + (autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : '') + '</body></html>';
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}