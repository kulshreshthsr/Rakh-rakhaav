'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
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
  const paise = Math.round((num - rupees) * 100);
  return convert(rupees) + ' Rupees' + (paise ? ' and '+convert(paise)+' Paise' : '') + ' Only';
};

const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const payLabel = sale.payment_type === 'cash' ? '✅ Cash (Paid)' : sale.payment_type === 'upi' ? '✅ UPI (Paid)' : sale.payment_type === 'bank' ? '✅ Bank Transfer' : '📒 Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0) ? sale.items.map((item, i) => `  ${i + 1}. ${item.product_name} × ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`).join('\n') : `  1. ${sale.product_name} × ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;
  const isIGST = sale.gst_type === 'IGST' || (sale.items && sale.items.some(i => i.gst_type === 'IGST'));
  const gstLine = (sale.total_gst && sale.total_gst > 0) ? (isIGST ? `🔹 IGST: ₹${fmt(sale.igst_amount)}` : `🔹 CGST: ₹${fmt(sale.cgst_amount)}  |  SGST: ₹${fmt(sale.sgst_amount)}`) : '🔹 GST: NIL';
  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste *${sale.buyer_name}* ji! 🙏\n\n` : '';
  return [`${greeting}🧾 *Invoice / Bill Details*`, `━━━━━━━━━━━━━━━━━━━━`, `🏪 Shop: *${shopName || 'Rakhaav'}*`, `📄 Invoice No: *${sale.invoice_number}*`, `📅 Date: ${saleDate}`, `━━━━━━━━━━━━━━━━━━━━`, `📦 *Items:*`, itemLines, `━━━━━━━━━━━━━━━━━━━━`, `💵 Taxable Amount: ₹${fmt(sale.taxable_amount)}`, gstLine, `💰 *Total Amount: ₹${fmt(sale.total_amount)}*`, `━━━━━━━━━━━━━━━━━━━━`, `💳 Payment: ${payLabel}`, `━━━━━━━━━━━━━━━━━━━━`, `🙏 Aapka business hamare liye bahut important hai!`, `Thank you for choosing *${shopName || 'Rakhaav'}* 😊`, ``, `_Powered by Rakhaav Business Manager_`].join('\n');
};

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({});
  const [products, setProducts] = useState([]);
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({ payment_type: 'cash', buyer_name: '', buyer_phone: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' });

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(shop => setShopName(shop.name || '')).catch(() => {});
  }, []);

  const fetchAll = async () => { setLoading(true); await Promise.all([fetchSales(), fetchProducts()]); setLoading(false); };
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

  const updateItem = (index, field, value) => {
    const updated = [...items]; updated[index][field] = value;
    if (field === 'product_id' && value) { const prod = products.find(p => p._id === value); if (prod) updated[index].price_per_unit = prod.price || ''; }
    setItems(updated);
  };
  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const rowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst };
  };

  const billTotals = items.reduce((acc, item) => { const g = rowGST(item); if (!g) return acc; return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total }; }, { taxable: 0, gst: 0, total: 0 });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.payment_type === 'credit' && !form.buyer_name) { setError('उधार बिक्री के लिए ग्राहक का नाम जरूरी है!'); return; }
    const validItems = items.filter(i => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) { setError('कम से कम एक product चुनें'); return; }
    for (const item of validItems) { const prod = products.find(p => p._id === item.product_id); if (prod && Number(item.quantity) > (prod.quantity || 0)) { setError(prod.name + ': सिर्फ ' + prod.quantity + ' stock available है'); return; } }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ items: validItems, ...form }) });
      const data = await res.json();
      if (res.ok) { setShowModal(false); resetForm(); fetchAll(); }
      else setError(data.message || 'विफल');
    } catch { setError('सर्वर त्रुटि'); }
    setSubmitting(false);
  };

  const resetForm = () => { setItems([emptyItem()]); setForm({ payment_type: 'cash', buyer_name: '', buyer_phone: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' }); setError(''); };

  const handleDelete = async (id) => {
    if (!confirm('इस बिक्री को हटाएं?')) return;
    try { await fetch(`${API}/api/sales/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }); fetchAll(); } catch { setError('हटाने में विफल'); }
  };

  const printInvoice = async (sale) => {
    try { const shopRes = await fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } }); const shop = await shopRes.json(); generateInvoiceHTML(sale, shop, true); } catch { alert('Invoice generate nahi hua'); }
  };

  const shareWhatsApp = (sale) => {
    const msg = buildWhatsAppMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    window.open(phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const PayBadge = ({ type }) => {
    const map = { cash: { bg: '#DCFCE7', color: '#166534', label: '💵 नकद' }, credit: { bg: '#FEE2E2', color: '#991B1B', label: '📒 उधार' }, upi: { bg: '#EDE9FE', color: '#5B21B6', label: '📱 UPI' }, bank: { bg: '#DBEAFE', color: '#1E40AF', label: '🏦 Bank' } };
    const s = map[type] || map.cash;
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
  };

  const IS = { width: '100%', padding: '12px 14px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'DM Sans,sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s,box-shadow 0.2s' };
  const LS = { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 7 };
  const selStyle = { ...IS, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%2394A3B8' d='M5 6L0 0h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, appearance: 'none' };

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .si:focus{border-color:#059669!important;box-shadow:0 0 0 3px rgba(5,150,105,0.08)!important;}
        .srow:hover{background:#F8FAFC!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}
        @media(max-width:640px){.hidden-xs{display:none!important;}.show-xs{display:flex!important;}}
        @media(min-width:641px){.show-xs{display:none!important;}}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 5 }}>बिक्री / Sales 📈</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, background: '#F0FDF4', padding: '2px 10px', borderRadius: 20 }}>₹{fmt(summary.totalRevenue)} revenue</span>
            {(summary.totalGST || 0) > 0 && <span style={{ fontSize: 12, color: '#6366F1', fontWeight: 700, background: '#EEF2FF', padding: '2px 10px', borderRadius: 20 }}>GST: ₹{fmt(summary.totalGST)}</span>}
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: '0 3px 12px rgba(5,150,105,0.3)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>+ बिक्री दर्ज</button>
      </div>

      {error && !showModal && <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94A3B8', fontSize: 14 }}>लोड हो रहा है...</div>
        </div>
      ) : sales.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '60px 20px', textAlign: 'center', border: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#475569', marginBottom: 4 }}>अभी कोई बिक्री नहीं</div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>पहली बिक्री दर्ज करें</div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden-xs" style={{ background: '#fff', borderRadius: 16, border: '1px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease both' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#060D1A,#0B1D35)' }}>
                  {['Invoice', 'Items', 'Taxable', 'GST', 'Total', 'Payment', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '13px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={s._id} className="srow" style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s', animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}>
                    <td style={{ padding: '12px 14px', color: '#6366F1', fontWeight: 700, fontSize: 12 }}>{s.invoice_number}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name}</div>
                      {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>को: {s.buyer_name}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>₹{fmt(s.taxable_amount)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {(s.total_gst || 0) > 0 ? <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>₹{fmt(s.total_gst)}</span> : <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#059669', fontSize: 14 }}>₹{fmt(s.total_amount)}</td>
                    <td style={{ padding: '12px 14px' }}><PayBadge type={s.payment_type} /></td>
                    <td style={{ padding: '12px 14px', color: '#94A3B8', fontSize: 12 }}>{new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => printInvoice(s)} style={{ background: '#EEF2FF', color: '#6366F1', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '5px 9px', fontFamily: 'DM Sans,sans-serif' }}>🖨️</button>
                        <button onClick={() => shareWhatsApp(s)} style={{ background: '#F0FDF4', color: '#059669', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '5px 9px', fontFamily: 'DM Sans,sans-serif' }}>📲</button>
                        <button onClick={() => handleDelete(s._id)} style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '5px 9px', fontFamily: 'DM Sans,sans-serif' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="show-xs" style={{ flexDirection: 'column', gap: 12 }}>
            {sales.map((s, i) => (
              <div key={s._id} style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '1px solid #F1F5F9', borderLeft: `4px solid ${s.payment_type === 'credit' ? '#EF4444' : '#10B981'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{s.items && s.items.length > 1 ? `${s.items.length} products` : s.product_name}</div>
                    <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 700 }}>{s.invoice_number}</div>
                    {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && <div style={{ fontSize: 11, color: '#94A3B8' }}>को: {s.buyer_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 17 }}>₹{fmt(s.total_amount)}</div>
                    <PayBadge type={s.payment_type} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[{ l: 'TAXABLE', v: `₹${fmt(s.taxable_amount)}`, c: '#475569' }, { l: 'GST', v: `₹${fmt(s.total_gst)}`, c: '#6D28D9' }, { l: 'DATE', v: new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN'), c: '#475569' }].map(x => (
                    <div key={x.l}><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{x.l}</div><div style={{ fontWeight: 700, fontSize: 12, color: x.c }}>{x.v}</div></div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => printInvoice(s)} style={{ flex: 1, padding: '9px', background: '#EEF2FF', color: '#6366F1', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>🖨️ Print</button>
                  <button onClick={() => shareWhatsApp(s)} style={{ flex: 1, padding: '9px', background: '#F0FDF4', color: '#059669', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>📲 WA</button>
                  <button onClick={() => handleDelete(s._id)} style={{ flex: 1, padding: '9px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>🗑️ Del</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,13,26,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📈</div>
              <div><div style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>बिक्री दर्ज करें</div><div style={{ fontSize: 12, color: '#94A3B8' }}>New sale entry</div></div>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}
            <form onSubmit={handleSubmit}>
              {/* Items */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🛍️ Items</div>
                {items.map((item, index) => {
                  const g = rowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Item {index + 1}</span>
                        {items.length > 1 && <button type="button" onClick={() => removeItem(index)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>}
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={LS}>Product *</label>
                        <SearchableProductSelect products={products} value={item.product_id} onChange={(id) => updateItem(index, 'product_id', id)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={LS}>Quantity *</label>
                          <input className="si" style={IS} type="number" min="1" max={prod ? prod.quantity : undefined} value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                          {prod && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>Available: {prod.quantity}</div>}
                        </div>
                        <div>
                          <label style={LS}>Price/Unit ₹ *</label>
                          <input className="si" style={IS} type="number" step="0.01" value={item.price_per_unit} onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>
                      {g && (
                        <div style={{ fontSize: 12, color: '#64748B', background: g.gst_rate > 0 ? '#EDE9FE' : '#F0FDF4', borderRadius: 8, padding: '7px 12px', display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                          <span>Taxable: <strong>₹{fmt(g.taxable)}</strong></span>
                          {g.gst_rate > 0 && <span>GST {g.gst_rate}%: <strong>₹{fmt(g.gst)}</strong></span>}
                          <span>Total: <strong>₹{fmt(g.total)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addItem} style={{ width: '100%', padding: '10px', background: '#fff', border: '2px dashed #E2E8F0', borderRadius: 10, color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', transition: 'all 0.15s' }}>+ Add Another Product</button>
              </div>

              {/* Bill Summary */}
              {billTotals.total > 0 && (
                <div style={{ background: 'linear-gradient(135deg,#EDE9FE,#F5F3FF)', border: '1px solid #C4B5FD', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#6D28D9', marginBottom: 8, fontSize: 13 }}>📋 Bill Summary</div>
                  {[{ l: 'Taxable', v: `₹${fmt(billTotals.taxable)}` }, { l: 'GST', v: `₹${fmt(billTotals.gst)}` }].map(x => (
                    <div key={x.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7C3AED', marginBottom: 4 }}><span>{x.l}</span><strong>{x.v}</strong></div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, color: '#5B21B6', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 6, marginTop: 4 }}><span>Total</span><span>₹{fmt(billTotals.total)}</span></div>
                </div>
              )}

              {/* Payment Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={LS}>Payment Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[{ val: 'cash', label: '💵 Cash', color: '#059669' }, { val: 'credit', label: '📒 Credit', color: '#EF4444' }, { val: 'upi', label: '📱 UPI', color: '#8B5CF6' }, { val: 'bank', label: '🏦 Bank', color: '#3B82F6' }].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setForm({ ...form, payment_type: opt.val })}
                      style={{ flex: 1, minWidth: 70, padding: '10px 4px', borderRadius: 9, border: '2px solid', borderColor: form.payment_type === opt.val ? opt.color : '#E2E8F0', background: form.payment_type === opt.val ? opt.color : '#F8FAFC', color: form.payment_type === opt.val ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.payment_type === 'credit' && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#991B1B' }}>⚠️ उधार बही में entry अपने आप होगी</div>}
              </div>

              {/* Buyer Details */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: form.payment_type === 'credit' ? '#EF4444' : '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                  👤 {form.payment_type === 'credit' ? 'Customer Details (जरूरी *)' : 'Buyer Details (optional)'}
                </div>
                <div style={{ marginBottom: 12 }}><label style={LS}>नाम {form.payment_type === 'credit' && <span style={{ color: '#EF4444' }}>*</span>}</label><input className="si" style={IS} placeholder="ग्राहक का नाम" value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })} required={form.payment_type === 'credit'} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={LS}>Phone</label><input className="si" style={IS} placeholder="Mobile" value={form.buyer_phone} onChange={e => setForm({ ...form, buyer_phone: e.target.value })} /></div>
                  <div><label style={LS}>GSTIN</label><input className="si" style={IS} placeholder="B2B GSTIN" value={form.buyer_gstin} onChange={e => setForm({ ...form, buyer_gstin: e.target.value })} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LS}>State</label>
                    <select className="si" style={selStyle} value={form.buyer_state} onChange={e => setForm({ ...form, buyer_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="── States ──">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label="── Union Territories ──">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    </select>
                  </div>
                  <div><label style={LS}>Address</label><input className="si" style={IS} placeholder="Address" value={form.buyer_address} onChange={e => setForm({ ...form, buyer_address: e.target.value })} /></div>
                </div>
                <div><label style={LS}>Notes</label><input className="si" style={IS} placeholder="Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: '0 3px 12px rgba(5,150,105,0.3)' }}>
                  {submitting ? '⏳ दर्ज हो रहा है...' : form.payment_type === 'credit' ? '📒 Credit Sale' : '💵 बिक्री दर्ज'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ flex: 1, padding: '13px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity, price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate, taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount, sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount, gst_type: sale.gst_type, total_amount: sale.total_amount }];
  const fmt = (n) => parseFloat(n || 0).toFixed(2);
  const isIGST = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const colSpan = isIGST ? 8 : 10;
  const gstCols = isIGST ? '<th>IGST%</th><th>IGST ₹</th>' : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';
  const itemRows = saleItems.map((item, idx) => { const gstCells = isIGST ? '<td>' + (item.gst_rate || 0) + '%</td><td>₹' + fmt(item.igst_amount) + '</td>' : '<td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.cgst_amount) + '</td><td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.sgst_amount) + '</td>'; return '<tr><td>' + (idx + 1) + '</td><td style="text-align:left"><strong>' + item.product_name + '</strong></td><td>' + (item.hsn_code || '—') + '</td><td>' + item.quantity + '</td><td>₹' + fmt(item.price_per_unit) + '</td><td>₹' + fmt(item.taxable_amount) + '</td>' + gstCells + '<td><strong>₹' + fmt(item.total_amount) + '</strong></td></tr>'; }).join('');
  const emptyCell = '<td style="height:20px"></td>';
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill('<tr>' + emptyCell.repeat(colSpan) + '</tr>').join('');
  const footerGST = isIGST ? '<td></td><td>₹' + fmt(sale.igst_amount) + '</td>' : '<td></td><td>₹' + fmt(sale.cgst_amount) + '</td><td></td><td>₹' + fmt(sale.sgst_amount) + '</td>';
  const amountGSTRows = isIGST ? '<div class="amount-row"><span>IGST @' + (sale.gst_rate || 0) + '%</span><span>₹' + fmt(sale.igst_amount) + '</span></div>' : '<div class="amount-row"><span>CGST @' + ((sale.gst_rate || 0) / 2).toFixed(1) + '%</span><span>₹' + fmt(sale.cgst_amount) + '</span></div><div class="amount-row"><span>SGST @' + ((sale.gst_rate || 0) / 2).toFixed(1) + '%</span><span>₹' + fmt(sale.sgst_amount) + '</span></div>';
  const payBg = sale.payment_type === 'cash' ? '#dcfce7' : sale.payment_type === 'upi' ? '#ede9fe' : '#fee2e2';
  const payColor = sale.payment_type === 'cash' ? '#166534' : sale.payment_type === 'upi' ? '#5b21b6' : '#991b1b';
  const payLabel = sale.payment_type === 'cash' ? '💵 CASH' : sale.payment_type === 'upi' ? '📱 UPI' : sale.payment_type === 'bank' ? '🏦 BANK' : '📒 CREDIT';
  const bankHTML = shop.bank_name ? '<div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px">🏦 Bank Details</div><div style="font-size:11px;margin-bottom:3px">Bank: <strong>' + shop.bank_name + '</strong></div>' + (shop.bank_branch ? '<div style="font-size:11px;margin-bottom:3px">Branch: <strong>' + shop.bank_branch + '</strong></div>' : '') + (shop.bank_account ? '<div style="font-size:11px;margin-bottom:3px">A/C: <strong>' + shop.bank_account + '</strong></div>' : '') + (shop.bank_ifsc ? '<div style="font-size:11px">IFSC: <strong>' + shop.bank_ifsc + '</strong></div>' : '') : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>';
  const termsHTML = shop.terms ? '<div class="terms-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div><div style="font-size:10px;color:#374151">' + shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>') + '</div></div>' : '';
  const creditNote = sale.payment_type === 'credit' ? '<div style="margin-top:8px;background:#fee2e2;border-radius:6px;padding:6px 8px"><div style="font-size:10px;font-weight:700;color:#991b1b">📒 CREDIT SALE</div></div>' : '';
  const html = '<!DOCTYPE html><html><head><title>Invoice - ' + sale.invoice_number + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}.invoice{max-width:800px;margin:0 auto;padding:20px;border:2px solid #000}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #0B1D35;padding-bottom:10px}.shop-name{font-size:26px;font-weight:900;color:#0B1D35}.shop-name span{color:#059669}.title-bar{background:#0B1D35;color:white;text-align:center;padding:6px;font-size:16px;font-weight:700;letter-spacing:2px;margin-bottom:8px}.gstin-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;margin-bottom:8px}.gstin-cell{padding:5px 10px;font-weight:700;font-size:12px;border-right:1px solid #000}.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:0}.party-box{padding:8px}.party-box:first-child{border-right:1px solid #000}.party-label{font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}.party-name{font-size:14px;font-weight:700;color:#0B1D35}.party-detail{font-size:11px;color:#374151;margin-top:2px}.inv-details{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #000;border-top:none;margin-bottom:8px}.inv-detail-box{padding:5px 8px;border-right:1px solid #e5e7eb;font-size:11px}table{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:0}th{background:#0B1D35;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #374151}td{padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-size:11px}td:nth-child(2){text-align:left}tr:nth-child(even){background:#f9fafb}.totals-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.words-box{padding:10px;border-right:1px solid #000}.amounts-box{padding:6px 10px}.amount-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f3f4f6}.amount-total{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:900;color:#0B1D35;border-top:2px solid #0B1D35;margin-top:4px}.footer-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.bank-box{padding:10px;border-right:1px solid #000}.sign-box{padding:10px;text-align:right}.terms-box{border:1px solid #000;border-top:none;padding:8px 10px}.logo-circle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0B1D35,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}</style></head><body><div class="invoice"><div class="header"><div><div class="shop-name">रख<span>रखाव</span></div><div style="font-size:11px;color:#059669;font-weight:600;background:#ecfdf5;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px">Business Manager</div>' + (shop.address ? '<div style="font-size:11px;color:#374151;margin-top:4px">' + shop.address + (shop.city ? ', ' + shop.city : '') + '</div>' : '') + (shop.phone ? '<div style="font-size:11px;color:#374151">📞 ' + shop.phone + '</div>' : '') + '</div><div class="logo-circle">र</div></div><div class="title-bar">TAX INVOICE / कर चालान</div><div class="gstin-row"><div class="gstin-cell">GSTIN: ' + (shop.gstin || 'N/A') + '</div><div style="flex:1;text-align:center;padding:5px;font-size:11px"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div><div style="padding:5px 10px;font-size:10px;font-weight:700;color:#059669;border-left:1px solid #000">ORIGINAL FOR RECIPIENT</div></div><div class="parties"><div class="party-box"><div class="party-label">विक्रेता / Seller</div><div class="party-name">' + (shop.name || 'रखरखाव') + '</div>' + (shop.address ? '<div class="party-detail">📍 ' + shop.address + (shop.city ? ', ' + shop.city : '') + '</div>' : '') + (shop.phone ? '<div class="party-detail">📞 ' + shop.phone + '</div>' : '') + (shop.gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + shop.gstin + '</div>' : '') + '</div><div class="party-box"><div class="party-label">खरीदार / Buyer</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>' + (sale.buyer_address ? '<div class="party-detail">📍 ' + sale.buyer_address + '</div>' : '') + (sale.buyer_phone ? '<div class="party-detail">📞 ' + sale.buyer_phone + '</div>' : '') + (sale.buyer_gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + sale.buyer_gstin + '</div>' : '') + '</div></div><div class="inv-details"><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Invoice No.</div><div style="font-weight:700;color:#059669">' + sale.invoice_number + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Date</div><div style="font-weight:700">' + saleDate + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Type</div><div style="font-weight:700">' + (sale.invoice_type || 'B2C') + ' | ' + (isIGST ? 'IGST' : 'CGST+SGST') + '</div></div></div><table><thead><tr><th style="width:28px">Sr.</th><th style="text-align:left">Product</th><th>HSN</th><th>Qty</th><th>Rate ₹</th><th>Taxable ₹</th>' + gstCols + '<th>Total ₹</th></tr></thead><tbody>' + itemRows + fillerRows + '</tbody><tfoot><tr style="background:#f3f4f6;font-weight:700"><td colspan="5" style="text-align:right">कुल / Total</td><td>₹' + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td><strong>₹' + fmt(sale.total_amount) + '</strong></td></tr></tfoot></table><div class="totals-section"><div class="words-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Amount in Words</div><div style="font-size:11px;font-weight:600;color:#0B1D35;font-style:italic">See invoice for amount in words</div>' + creditNote + '</div><div class="amounts-box"><div class="amount-row"><span>Taxable Amount</span><span>₹' + fmt(sale.taxable_amount) + '</span></div>' + amountGSTRows + '<div class="amount-row"><span>Total GST</span><span>₹' + fmt(sale.total_gst) + '</span></div><div class="amount-total"><span>GRAND TOTAL</span><span>₹' + fmt(sale.total_amount) + '</span></div></div></div><div class="footer-section"><div class="bank-box">' + bankHTML + '</div><div class="sign-box"><div style="font-size:12px;font-weight:700;margin-bottom:40px">For <strong>' + (shop.name || 'रखरखाव') + '</strong></div><div style="border-top:1px solid #000;padding-top:4px;font-size:11px;font-weight:700">Authorised Signatory</div><div style="font-size:10px;color:#9ca3af;margin-top:6px">Computer generated invoice</div></div></div>' + termsHTML + '<div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic">~ Rakhaav Business Manager ~</div></div>' + (autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : '') + '</body></html>';
  const win = window.open('', '_blank'); win.document.write(html); win.document.close();
}