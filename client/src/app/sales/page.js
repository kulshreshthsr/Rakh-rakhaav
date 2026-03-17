'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

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
    } catch { setError('बिक्री लोड नहीं हो सकी / Could not load sales'); }
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
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2 };
  };

  const gstPreview = calcGST();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); setForm({ product_id: '', quantity: '', price_per_unit: '', buyer_name: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' }); setSelectedProduct(null); fetchSales(); }
      else setError(data.message || 'विफल / Failed');
    } catch { setError('सर्वर त्रुटि / Server error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('इस बिक्री को हटाएं? स्टॉक वापस आएगा।\nDelete this sale? Stock will be restored.')) return;
    try {
      await fetch(`https://rakh-rakhaav.onrender.com/api/sales/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      fetchSales();
    } catch { setError('हटाने में विफल / Failed to delete'); }
  };

  const printInvoice = async (sale) => {
  const shopRes = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const shop = await shopRes.json();

  const numberToWords = (num) => {
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const convert = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
      if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+convert(n%100) : '');
      if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
      if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
      return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
    };
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    return convert(rupees) + ' Rupees' + (paise ? ' and ' + convert(paise) + ' Paise' : '') + ' Only';
  };

  const isIGST = sale.gst_type === 'IGST';
  const win = window.open('', '_blank');

  win.document.write(`<!DOCTYPE html><html><head><title>Invoice - ${sale.invoice_number}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}.invoice{max-width:800px;margin:0 auto;padding:20px;border:2px solid #000}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #1a1a2e;padding-bottom:10px}.shop-name{font-size:28px;font-weight:900;color:#1a1a2e;letter-spacing:-0.5px}.shop-name span{color:#6366f1}.title-bar{background:#1a1a2e;color:white;text-align:center;padding:6px;font-size:16px;font-weight:700;letter-spacing:2px;margin-bottom:8px}.gstin-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;margin-bottom:8px}.gstin-cell{padding:5px 10px;font-weight:700;font-size:12px;border-right:1px solid #000}.original-stamp{padding:5px 10px;font-size:10px;font-weight:700;color:#6366f1;border-left:1px solid #000}.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:0}.party-box{padding:8px}.party-box:first-child{border-right:1px solid #000}.party-label{font-size:10px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}.party-name{font-size:14px;font-weight:700;color:#1a1a2e}.party-detail{font-size:11px;color:#374151;margin-top:2px}.inv-details{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none;margin-bottom:8px}.inv-detail-box{padding:5px 8px;border-right:1px solid #e5e7eb;font-size:11px}table{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:0}th{background:#1a1a2e;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #374151}td{padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-size:11px}td:nth-child(2){text-align:left}tr:nth-child(even){background:#f9fafb}.totals-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.words-box{padding:10px;border-right:1px solid #000}.words-label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px}.words-value{font-size:11px;font-weight:600;color:#1a1a2e;font-style:italic}.amounts-box{padding:6px 10px}.amount-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f3f4f6}.amount-total{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:900;color:#1a1a2e;border-top:2px solid #1a1a2e;margin-top:4px}.footer-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.bank-box{padding:10px;border-right:1px solid #000}.bank-label{font-size:10px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:6px}.bank-row{font-size:11px;margin-bottom:3px}.sign-box{padding:10px;text-align:right}.terms-box{border:1px solid #000;border-top:none;padding:8px 10px}.logo-circle{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#1a1a2e,#6366f1);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:900}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}</style></head><body><div class="invoice">
  <div class="header">
    <div>
      <div class="shop-name">रख<span>रखाव</span></div>
      <div style="font-size:11px;color:#6366f1;font-weight:600;background:#eef2ff;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px">Inventory Management System</div>
      ${shop.address ? `<div style="font-size:11px;color:#374151;margin-top:4px">${shop.address}${shop.city ? ', '+shop.city : ''}${shop.pincode ? ' - '+shop.pincode : ''}</div>` : ''}
      ${shop.phone ? `<div style="font-size:11px;color:#374151">📞 ${shop.phone}${shop.email ? ' | ✉️ '+shop.email : ''}</div>` : ''}
    </div>
    <div class="logo-circle">र</div>
  </div>

  <div class="title-bar">TAX INVOICE / कर चालान</div>

  <div class="gstin-row">
    <div class="gstin-cell">GSTIN: ${shop.gstin || 'N/A'}</div>
    <div style="flex:1;text-align:center"></div>
    <div class="original-stamp">ORIGINAL FOR RECIPIENT</div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-label">विक्रेता / Seller</div>
      <div class="party-name">${shop.name || 'रखरखाव'}</div>
      ${shop.address ? `<div class="party-detail">📍 ${shop.address}${shop.city ? ', '+shop.city : ''}${shop.state ? ', '+shop.state : ''}${shop.pincode ? ' - '+shop.pincode : ''}</div>` : ''}
      ${shop.phone ? `<div class="party-detail">📞 ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div class="party-detail" style="font-weight:700">GSTIN: ${shop.gstin}</div>` : ''}
    </div>
    <div class="party-box">
      <div class="party-label">खरीदार / Buyer</div>
      <div class="party-name">${sale.buyer_name || 'Cash Customer'}</div>
      ${sale.buyer_address ? `<div class="party-detail">📍 ${sale.buyer_address}</div>` : ''}
      ${sale.buyer_state ? `<div class="party-detail">राज्य: ${sale.buyer_state}</div>` : ''}
      ${sale.buyer_gstin ? `<div class="party-detail" style="font-weight:700">GSTIN: ${sale.buyer_gstin}</div>` : ''}
    </div>
  </div>

  <div class="inv-details">
    <div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Invoice No.</div><div style="font-weight:700;color:#6366f1">${sale.invoice_number}</div></div>
    <div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">दिनांक / Date</div><div style="font-weight:700">${new Date(sale.sold_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">Sr.</th>
        <th style="text-align:left">उत्पाद / Product</th>
        <th>HSN</th>
        <th>मात्रा/Qty</th>
        <th>दर/Rate ₹</th>
        <th>कर योग्य ₹</th>
        ${isIGST ? '<th>IGST %</th><th>IGST Amt</th>' : '<th>CGST %</th><th>CGST ₹</th><th>SGST %</th><th>SGST ₹</th>'}
        <th>कुल/Total ₹</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td style="text-align:left"><strong>${sale.product_name}</strong></td>
        <td>${sale.hsn_code || '—'}</td>
        <td>1.00</td>
        <td>${sale.price_per_unit}</td>
        <td>${sale.taxable_amount?.toFixed(2)}</td>
        ${isIGST
          ? `<td>${sale.gst_rate}%</td><td>${sale.igst_amount?.toFixed(2)||'0.00'}</td>`
          : `<td>${(sale.gst_rate/2).toFixed(1)}%</td><td>${sale.cgst_amount?.toFixed(2)||'0.00'}</td><td>${(sale.gst_rate/2).toFixed(1)}%</td><td>${sale.sgst_amount?.toFixed(2)||'0.00'}</td>`
        }
        <td><strong>${sale.total_amount?.toFixed(2)}</strong></td>
      </tr>
      ${Array(4).fill(`<tr>${'<td style="height:20px"></td>'.repeat(isIGST ? 8 : 10)}</tr>`).join('')}
    </tbody>
    <tfoot>
      <tr style="background:#f3f4f6;font-weight:700">
        <td colspan="5" style="text-align:right">कुल / Total</td>
        <td>${sale.taxable_amount?.toFixed(2)}</td>
        ${isIGST
          ? `<td></td><td>${sale.igst_amount?.toFixed(2)||'0.00'}</td>`
          : `<td></td><td>${sale.cgst_amount?.toFixed(2)||'0.00'}</td><td></td><td>${sale.sgst_amount?.toFixed(2)||'0.00'}</td>`
        }
        <td><strong>${sale.total_amount?.toFixed(2)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="totals-section">
    <div class="words-box">
      <div class="words-label">राशि शब्दों में / Amount in Words</div>
      <div class="words-value">${numberToWords(parseFloat(sale.total_amount))}</div>
      <div style="margin-top:8px">
        <div class="words-label">GST प्रकार / Type</div>
        <div style="font-size:12px;font-weight:700;color:#6366f1">${isIGST ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}</div>
      </div>
    </div>
    <div class="amounts-box">
      <div class="amount-row"><span>कर योग्य / Taxable</span><span>₹${sale.taxable_amount?.toFixed(2)}</span></div>
      ${isIGST
        ? `<div class="amount-row"><span>Add: IGST @${sale.gst_rate}%</span><span>₹${sale.igst_amount?.toFixed(2)||'0.00'}</span></div>`
        : `<div class="amount-row"><span>Add: CGST @${(sale.gst_rate/2).toFixed(1)}%</span><span>₹${sale.cgst_amount?.toFixed(2)||'0.00'}</span></div>
           <div class="amount-row"><span>Add: SGST @${(sale.gst_rate/2).toFixed(1)}%</span><span>₹${sale.sgst_amount?.toFixed(2)||'0.00'}</span></div>`
      }
      <div class="amount-row"><span>कुल कर / Total Tax</span><span>₹${sale.total_gst?.toFixed(2)||'0.00'}</span></div>
      <div class="amount-total"><span>कुल राशि / TOTAL</span><span>₹${sale.total_amount?.toFixed(2)}</span></div>
      <div style="font-size:10px;color:#9ca3af;text-align:right">(E & O.E.)</div>
    </div>
  </div>

  <div class="footer-section">
    <div class="bank-box">
      ${shop.bank_name ? `
        <div class="bank-label">🏦 बैंक विवरण / Bank Details</div>
        <div class="bank-row">Bank: <strong>${shop.bank_name}</strong></div>
        ${shop.bank_branch ? `<div class="bank-row">Branch: <strong>${shop.bank_branch}</strong></div>` : ''}
        ${shop.bank_account ? `<div class="bank-row">A/C No.: <strong>${shop.bank_account}</strong></div>` : ''}
        ${shop.bank_ifsc ? `<div class="bank-row">IFSC: <strong>${shop.bank_ifsc}</strong></div>` : ''}
      ` : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Profile mein bank details bharen / Add bank details in Profile</div>'}
    </div>
    <div class="sign-box">
      <div style="font-size:12px;font-weight:700;margin-bottom:40px">For <strong>${shop.name || 'रखरखाव'}</strong></div>
      <div style="border-top:1px solid #000;padding-top:4px;font-size:11px;font-weight:700">Authorised Signatory</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:6px">यह कंप्यूटर जनित चालान है<br/>Computer generated invoice<br/>No signature required.</div>
    </div>
  </div>

  ${shop.terms ? `
    <div class="terms-box">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">नियम एवं शर्तें / Terms & Conditions</div>
      <div style="font-size:10px;color:#374151">${shop.terms.split('\n').map((t,i) => `${i+1}. ${t}`).join('<br/>')}</div>
    </div>
  ` : ''}

  <div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic">~ रखरखाव Inventory Management System ~</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
  win.document.close();
  };

  const total = sales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
  const totalGST = sales.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>बिक्री / Sales</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>कुल आय / Total Revenue: ₹{total.toFixed(2)}</div>
            {totalGST > 0 && <div style={{ color: '#6366f1', fontSize: 13, fontWeight: 600 }}>GST वसूला / Collected: ₹{totalGST.toFixed(2)}</div>}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-success">+ बिक्री दर्ज / Record Sale</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>लोड हो रहा है... / Loading...</div>
        : sales.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div>अभी कोई बिक्री नहीं / No sales yet. Click "+ बिक्री दर्ज" to start.</div>
          </div>
        ) : (
          <>
            <div className="table-container hidden-xs">
              <table>
                <thead><tr><th>Invoice</th><th>उत्पाद / Product</th><th>मात्रा / Qty</th><th>कर योग्य / Taxable</th><th>GST</th><th>कुल / Total</th><th>तारीख / Date</th><th>कार्य / Actions</th></tr></thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s._id}>
                      <td style={{ color: '#6366f1', fontWeight: 600, fontSize: 12 }}>{s.invoice_number}</td>
                      <td><div style={{ fontWeight: 600, color: '#1a1a2e' }}>{s.product_name}</div>{s.buyer_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>को / To: {s.buyer_name}</div>}</td>
                      <td>{s.quantity}</td>
                      <td>₹{s.taxable_amount?.toFixed(2)}</td>
                      <td>{s.gst_rate > 0 ? <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{s.gst_rate}% • ₹{s.total_gst?.toFixed(2)}</span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>GST नहीं</span>}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>₹{s.total_amount?.toFixed(2)}</td>
                      <td style={{ color: '#9ca3af', fontSize: 13 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button onClick={() => printInvoice(s)} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 8 }}>प्रिंट / Print</button>
                        <button onClick={() => handleDelete(s._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>हटाएं / Delete</button>
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
                      {s.buyer_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>को / To: {s.buyer_name}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>₹{s.total_amount?.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>मात्रा/QTY</div><div style={{ fontWeight: 600 }}>{s.quantity}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>कर योग्य/TAXABLE</div><div style={{ fontWeight: 600 }}>₹{s.taxable_amount?.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div><div style={{ fontWeight: 600 }}>{s.gst_rate > 0 ? `${s.gst_rate}% • ₹${s.total_gst?.toFixed(2)}` : 'नहीं/None'}</div></div>
                    <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>तारीख/DATE</div><div style={{ fontWeight: 600 }}>{new Date(s.sold_at).toLocaleDateString('en-IN')}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => printInvoice(s)} style={{ flex: 1, padding: '8px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ प्रिंट / Print</button>
                    <button onClick={() => handleDelete(s._id)} style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>हटाएं / Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>बिक्री दर्ज करें</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>Record Sale</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">उत्पाद / Product *</label>
                <select className="form-input" value={form.product_id} onChange={handleProductChange} required>
                  <option value="">उत्पाद चुनें / Select a product</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (स्टॉक/Stock: {p.quantity}) {p.gst_rate > 0 ? `• GST ${p.gst_rate}%` : ''}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">मात्रा / Quantity *</label><input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">मूल्य / Price/Unit ₹ *</label><input className="form-input" type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} required /></div>
              </div>
              {gstPreview && (
                <div style={{ background: gstPreview.gst_rate > 0 ? '#ede9fe' : '#f0fdf4', border: `1px solid ${gstPreview.gst_rate > 0 ? '#c4b5fd' : '#bbf7d0'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: gstPreview.gst_rate > 0 ? '#6d28d9' : '#059669', marginBottom: 6 }}>बिल पूर्वावलोकन / Bill Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: gstPreview.gst_rate > 0 ? '#7c3aed' : '#065f46' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>कर योग्य / Taxable:</span><strong>₹{gstPreview.taxable.toFixed(2)}</strong></div>
                    {gstPreview.gst_rate > 0 && <><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST @{gstPreview.gst_rate / 2}%:</span><span>₹{gstPreview.half_gst.toFixed(2)}</span></div></>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4, marginTop: 2 }}><span>कुल / Total:</span><span>₹{gstPreview.total.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>खरीदार विवरण / Buyer Details (वैकल्पिक / Optional)</div>
                <div className="form-group"><label className="form-label">खरीदार का नाम / Buyer Name</label><input className="form-input" placeholder="ग्राहक का नाम / Customer name" value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })} /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">खरीदार GSTIN</label><input className="form-input" placeholder="GSTIN (यदि हो / if any)" value={form.buyer_gstin} onChange={e => setForm({ ...form, buyer_gstin: e.target.value })} /></div>
                  <div className="form-group">
                    <label className="form-label">खरीदार राज्य / Buyer State</label>
                    <select className="form-input" value={form.buyer_state} onChange={e => setForm({ ...form, buyer_state: e.target.value })}>
                      <option value="">राज्य चुनें / Select State/UT</option>
                      <optgroup label="── राज्य / States ──">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label="── केंद्र शासित / Union Territories ──">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">पता / Buyer Address</label><input className="form-input" placeholder="पता / Address" value={form.buyer_address} onChange={e => setForm({ ...form, buyer_address: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">नोट / Notes</label><input className="form-input" placeholder="कोई नोट... / Any notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-success" style={{ flex: 1 }}>बिक्री दर्ज / Record Sale</button>
                <button type="button" onClick={() => { setShowModal(false); setError(''); setSelectedProduct(null); }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>रद्द / Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } } @media (min-width: 641px) { .show-xs { display: none !important; } }`}</style>
    </Layout>
  );
}