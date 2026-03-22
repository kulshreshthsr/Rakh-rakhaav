'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';
import { useAppLocale } from '../../components/AppLocale';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS    = ['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const emptyItem = () => ({ product_id: '', quantity: 1, price_per_unit: '' });
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SALES_CACHE_KEY = 'sales-page';
const normalizeGstin = (value) => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);
const normalizeState = (value = '') => value.trim().toLowerCase();
const STATE_CODE_BY_NAME = {
  'andaman & nicobar islands': '35',
  'andhra pradesh': '37',
  'arunachal pradesh': '12',
  'assam': '18',
  'bihar': '10',
  'chandigarh': '04',
  'chhattisgarh': '22',
  'dadra & nagar haveli and daman & diu': '26',
  'delhi': '07',
  'goa': '30',
  'gujarat': '24',
  'haryana': '06',
  'himachal pradesh': '02',
  'jammu & kashmir': '01',
  'jharkhand': '20',
  'karnataka': '29',
  'kerala': '32',
  'ladakh': '38',
  'lakshadweep': '31',
  'madhya pradesh': '23',
  'maharashtra': '27',
  'manipur': '14',
  'meghalaya': '17',
  'mizoram': '15',
  'nagaland': '13',
  'odisha': '21',
  'puducherry': '34',
  'punjab': '03',
  'rajasthan': '08',
  'sikkim': '11',
  'tamil nadu': '33',
  'telangana': '36',
  'tripura': '16',
  'uttar pradesh': '09',
  'uttarakhand': '05',
  'west bengal': '19',
 };

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

// ── WhatsApp message builder ──────────────────────────────────────────────────
const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const payLabel =
    sale.payment_type === 'cash'   ? '✅ Cash (Paid)'   :
    sale.payment_type === 'upi'    ? '✅ UPI (Paid)'    :
    sale.payment_type === 'bank'   ? '✅ Bank Transfer' : '📒 Udhaar (Credit)';

  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) =>
        `  ${i + 1}. ${item.product_name} × ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`
      ).join('\n')
    : `  1. ${sale.product_name} × ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;

  const isIGST = sale.gst_type === 'IGST' ||
    (sale.items && sale.items.some(i => i.gst_type === 'IGST'));

  const gstLine = (sale.total_gst && sale.total_gst > 0)
    ? isIGST
      ? `🔹 IGST: ₹${fmt(sale.igst_amount)}`
      : `🔹 CGST: ₹${fmt(sale.cgst_amount)}  |  SGST: ₹${fmt(sale.sgst_amount)}`
    : `🔹 GST: NIL`;

  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer'
    ? `Namaste *${sale.buyer_name}* ji! 🙏\n\n`
    : '';
  const advancePaid = sale.payment_type === 'credit'
    ? parseFloat(sale.amount_paid || 0)
    : parseFloat(sale.total_amount || 0);
  const dueAmount = sale.payment_type === 'credit'
    ? Math.max(0, parseFloat(sale.total_amount || 0) - advancePaid)
    : 0;

  return [
    `${greeting}🧾 *Invoice / Bill Details*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏪 Shop: *${shopName || 'Rakh-Rakhaav'}*`,
    `📄 Invoice No: *${sale.invoice_number}*`,
    `📅 Date: ${saleDate}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 *Items:*`,
    itemLines,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💵 Taxable Amount: ₹${fmt(sale.taxable_amount)}`,
    gstLine,
    `💰 *Total Amount: ₹${fmt(sale.total_amount)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💳 Payment: ${payLabel}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🙏 Aapka business hamare liye bahut important hai!`,
    `Thank you for choosing *${shopName || 'Rakh-Rakhaav'}* 😊`,
    ``,
    `_Powered by Rakh-Rakhaav Business Manager_`,
  ].join('\n');
};

const buildWhatsAppShareMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const advancePaid = sale.payment_type === 'credit'
    ? parseFloat(sale.amount_paid || 0)
    : parseFloat(sale.total_amount || 0);
  const dueAmount = sale.payment_type === 'credit'
    ? Math.max(0, parseFloat(sale.total_amount || 0) - advancePaid)
    : 0;
  const payLabel =
    sale.payment_type === 'cash' ? 'Cash (Paid)' :
    sale.payment_type === 'upi' ? 'UPI (Paid)' :
    sale.payment_type === 'bank' ? 'Bank Transfer' : 'Udhaar (Credit)';
  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) =>
        `  ${i + 1}. ${item.product_name} x ${item.quantity} @ Rs ${fmt(item.price_per_unit)} = Rs ${fmt(item.total_amount)}`
      ).join('\n')
    : `  1. ${sale.product_name} x ${sale.quantity} @ Rs ${fmt(sale.price_per_unit)} = Rs ${fmt(sale.total_amount)}`;

  return [
    sale.buyer_name && sale.buyer_name !== 'Walk-in Customer' ? `Namaste ${sale.buyer_name} ji,` : 'Namaste,',
    '',
    `Invoice / Bill Details`,
    `Shop: ${shopName || 'Rakh-Rakhaav'}`,
    `Invoice No: ${sale.invoice_number}`,
    `Date: ${saleDate}`,
    `Items:`,
    itemLines,
    `Taxable Amount: Rs ${fmt(sale.taxable_amount)}`,
    `GST: Rs ${fmt(sale.total_gst)}`,
    `Total Amount: Rs ${fmt(sale.total_amount)}`,
    `Payment: ${payLabel}`,
    ...(sale.payment_type === 'credit'
      ? [
          `Advance Payment: Rs ${fmt(advancePaid)}`,
          `Udhaar / Due: Rs ${fmt(dueAmount)}`,
        ]
      : []),
    '',
    `Thank you for choosing ${shopName || 'Rakh-Rakhaav'}`,
  ].join('\n');
};

export default function SalesPage() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const [sales, setSales]           = useState([]);
  const [summary, setSummary]       = useState({});
  const [products, setProducts]     = useState([]);
  const [shopName, setShopName]     = useState('');
  const [shopState, setShopState]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState('');
  const [error, setError]           = useState('');
  const [items, setItems]           = useState([emptyItem()]);
  const [gstinTouched, setGstinTouched] = useState(false);
  const [form, setForm]             = useState({
    payment_type: 'cash',
    amount_paid: '',
    buyer_name: '', buyer_phone: '', buyer_gstin: '',
    buyer_address: '', buyer_state: '', notes: '',
  });
  const [saleStep, setSaleStep] = useState(0);

  async function fetchAll() {
    setLoading(true);
    await fetchSales();
    setLoading(false);
  }

  async function fetchSales() {
    try {
      const res = await fetch(`${API}/api/sales`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      const nextSummary = data.summary || {};
      setSales(nextSales);
      setSummary(nextSummary);
      writePageCache(SALES_CACHE_KEY, { sales: nextSales, summary: nextSummary });
    } catch { setError('बिक्री लोड नहीं हो सकी'); }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {}
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(SALES_CACHE_KEY);
    if (cached?.sales) {
      setSales(cached.sales);
      setSummary(cached.summary || {});
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.sales));
      await fetchAll();
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!showModal || products.length > 0 || !localStorage.getItem('token')) return;
    fetchProducts();
  }, [showModal, products.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if ((!showModal && !sales.length) || (shopName && shopState) || !localStorage.getItem('token')) return;
    fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(shop => {
        setShopName(shop.name || '');
        setShopState(shop.state || '');
      })
      .catch(() => {});
  }, [showModal, sales.length, shopName, shopState]);

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
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const rowGST = (item) => {
    const prod = products.find(p => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable  = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst      = (taxable * gst_rate) / 100;
    const isIGST = normalizeState(shopState) && normalizeState(form.buyer_state)
      ? normalizeState(shopState) !== normalizeState(form.buyer_state)
      : false;
    return { taxable, gst_rate, gst, total: taxable + gst, half_gst: gst / 2, isIGST };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = rowGST(item);
    if (!g) return acc;
    return { taxable: acc.taxable + g.taxable, gst: acc.gst + g.gst, total: acc.total + g.total };
  }, { taxable: 0, gst: 0, total: 0 });
  const amountPaidNum = parseFloat(form.amount_paid) || 0;
  const balanceDue = Math.max(0, billTotals.total - amountPaidNum);
  const gstinValue = normalizeGstin(form.buyer_gstin);
  const gstinValid = !gstinValue || GSTIN_REGEX.test(gstinValue);
  const showGstinError = gstinTouched && !!gstinValue && !gstinValid;
  const wizardSteps = [
    { title: locale === 'hi' ? 'आइटम्स' : 'Items', copy: locale === 'hi' ? 'प्रोडक्ट और मात्रा' : 'Products and quantity' },
    { title: locale === 'hi' ? 'भुगतान' : 'Payment', copy: locale === 'hi' ? 'टोटल और मोड' : 'Totals and method' },
    { title: locale === 'hi' ? 'ग्राहक' : 'Buyer', copy: locale === 'hi' ? 'ग्राहक और GST' : 'Buyer and GST' },
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setGstinTouched(true);
    if (form.payment_type === 'credit' && !form.buyer_name) {
      setError('उधार बिक्री के लिए ग्राहक का नाम जरूरी है!'); return;
    }
    if (!gstinValid) { setError('Invalid GSTIN format'); return; }
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
      const isEditing = Boolean(editingSaleId);
      const res = await fetch(isEditing ? `${API}/api/sales/${editingSaleId}` : `${API}/api/sales`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          items: validItems,
          ...form,
          buyer_gstin: gstinValue,
          amount_paid: form.payment_type === 'credit' ? amountPaidNum : billTotals.total,
        }),
      });
      const data = await res.json();
      if (res.ok) { setShowModal(false); resetForm(); fetchAll(); }
      else setError(data.message || 'विफल');
    } catch { setError('सर्वर त्रुटि'); }
    setSubmitting(false);
  };

  const resetForm = () => {
    setEditingSaleId('');
    setItems([emptyItem()]);
    setForm({ payment_type: 'cash', amount_paid: '', buyer_name: '', buyer_phone: '', buyer_gstin: '', buyer_address: '', buyer_state: '', notes: '' });
    setSaleStep(0);
    setGstinTouched(false);
    setError('');
  };

  const startEditSale = (sale) => {
    const sourceItems = sale.items && sale.items.length > 0
      ? sale.items
      : [{
          product: sale.product,
          quantity: sale.quantity,
          price_per_unit: sale.price_per_unit,
        }];

    setEditingSaleId(sale._id);
    setItems(sourceItems.map((item) => ({
      product_id: item.product?._id || item.product || '',
      quantity: item.quantity || 1,
      price_per_unit: item.price_per_unit || '',
    })));
    setForm({
      payment_type: sale.payment_type || 'cash',
      amount_paid: sale.payment_type === 'credit' ? String(sale.amount_paid || '') : '',
      buyer_name: sale.buyer_name || '',
      buyer_phone: sale.buyer_phone || '',
      buyer_gstin: sale.buyer_gstin || '',
      buyer_address: sale.buyer_address || '',
      buyer_state: sale.buyer_state || '',
      notes: sale.notes || '',
    });
    setSaleStep(0);
    setGstinTouched(false);
    setError('');
    setShowModal(true);
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

  // ── WhatsApp share — pure text, no API call, no PDF ──────────────────────
  const shareWhatsApp = (sale) => {
    const msg   = buildWhatsAppShareMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    // If phone number exists → open direct chat, else → open WhatsApp contact picker
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

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
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>बिक्री / Sales</div>
              {refreshing && <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(226,232,240,0.72)' }}>Refreshing sales data...</div>}
            </div>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-success" style={{ width: 'auto' }}>+ बिक्री दर्ज / Record Sale</button>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Revenue</div>
            <div className="metric-value" style={{ color: '#10b981' }}>₹{fmt(summary.totalRevenue)}</div>
            <div className="metric-note">Total billed amount</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">GST</div>
            <div className="metric-value" style={{ color: '#6366f1' }}>₹{fmt(summary.totalGST)}</div>
            <div className="metric-note">Collected in sales</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">Invoices</div>
            <div className="metric-value" style={{ color: '#2563eb' }}>{sales.length}</div>
            <div className="metric-note">Recorded sales entries</div>
          </div>
        </section>

        {error && !showModal && (
          <div className="alert-error">
          {error}
          </div>
        )}

        {loading ? (
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div>अभी कोई बिक्री नहीं / No sales yet.</div>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="table-container hidden-xs">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th><th>Items</th><th>Taxable</th><th>GST</th>
                  <th>Total</th><th>Payment</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s._id}>
                    <td style={{ color: '#6366f1', fontWeight: 600, fontSize: 12 }}>{s.invoice_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>
                        {s.items && s.items.length > 1 ? s.items.length + ' items' : s.product_name}
                      </div>
                      {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>को: {s.buyer_name}</div>
                      )}
                    </td>
                    <td>₹{fmt(s.taxable_amount)}</td>
                    <td>
                      {(s.total_gst || 0) > 0
                        ? <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>₹{fmt(s.total_gst)}</span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>₹{fmt(s.total_amount)}</td>
                    <td><PayBadge type={s.payment_type} /></td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>
                      {new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => printInvoice(s)}
                          title="Print Invoice"
                          style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          🖨️ Print
                        </button>
                        <button
                          onClick={() => shareWhatsApp(s)}
                          title="Share on WhatsApp"
                          style={{ color: '#25d366', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          📲 WA
                        </button>
                        <button
                          onClick={() => startEditSale(s)}
                          style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s._id)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Del
                        </button>
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
              <div key={s._id} className="card" style={{ borderLeft: '3px solid ' + (s.payment_type === 'credit' ? '#ef4444' : '#10b981') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                      {s.items && s.items.length > 1 ? s.items.length + ' products' : s.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{s.invoice_number}</div>
                    {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>को: {s.buyer_name}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>₹{fmt(s.total_amount)}</div>
                    <PayBadge type={s.payment_type} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>TAXABLE</div><div style={{ fontWeight: 600 }}>₹{fmt(s.taxable_amount)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>GST</div><div style={{ fontWeight: 600, color: '#6366f1' }}>₹{fmt(s.total_gst)}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af' }}>DATE</div><div style={{ fontWeight: 600 }}>{new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => startEditSale(s)} style={{ flex: 1, padding: '8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => printInvoice(s)} style={{ flex: 1, padding: '8px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🖨️ Print
                  </button>
                  <button
                    onClick={() => shareWhatsApp(s)}
                    title="Share on WhatsApp"
                    style={{ flex: 1, padding: '8px', background: '#f0fdf4', color: '#25d366', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    📲 WhatsApp
                  </button>
                  <button onClick={() => handleDelete(s._id)} style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', maxWidth: 560 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>बिक्री दर्ज करें / Record Sale</h3>
            {editingSaleId ? (
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, marginBottom: 10 }}>Editing existing invoice</div>
            ) : null}
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                {locale === 'hi' ? 'Guided wizard: item select करें, payment सेट करें, फिर buyer details review करें।' : 'Guided wizard: select items, confirm payment and finish buyer details.'}
              </div>
              <div className="wizard-progress" style={{ marginBottom: 16 }}>
                {wizardSteps.map((step, index) => (
                  <div key={step.title} className={`wizard-step ${saleStep === index ? 'is-active' : ''}`}>
                    <div className="wizard-step-index">{index + 1}</div>
                    <div className="wizard-step-title">{step.title}</div>
                    <div className="wizard-step-copy">{step.copy}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => e.preventDefault()}>

              {/* Items */}
              <div style={{ marginBottom: 12, display: saleStep === 0 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>🛍️ Items</div>
                {items.map((item, index) => {
                  const g    = rowGST(item);
                  const prod = products.find(p => p._id === item.product_id);
                  return (
                    <div key={index} style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Product *</label>
                        <SearchableProductSelect
                          products={products}
                          value={item.product_id}
                          onChange={(id) => updateItem(index, 'product_id', id)}
                        />
                      </div>

                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input className="form-input" type="number" min="1"
                            max={prod ? prod.quantity : undefined}
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)} required />
                          {prod && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Available: {prod.quantity}</div>}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price/Unit ₹ *</label>
                          <input className="form-input" type="number" step="0.01"
                            value={item.price_per_unit}
                            onChange={e => updateItem(index, 'price_per_unit', e.target.value)} required />
                        </div>
                      </div>
                      {g && (
                        <div style={{ fontSize: 12, color: '#6b7280', background: g.gst_rate > 0 ? '#ede9fe' : '#f0fdf4', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>Taxable: <strong>₹{fmt(g.taxable)}</strong></span>
                          {g.gst_rate > 0 && (
                            <span>
                              {g.isIGST
                                ? `IGST ${g.gst_rate}%: ₹${fmt(g.gst)}`
                                : `CGST ${(g.gst_rate / 2).toFixed(1)}% + SGST ${(g.gst_rate / 2).toFixed(1)}%: ₹${fmt(g.gst)}`}
                            </span>
                          )}
                          <span>Total: <strong>₹{fmt(g.total)}</strong></span>
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

              {/* Bill Summary */}
              {billTotals.total > 0 && saleStep === 1 && (
                <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#6d28d9', marginBottom: 6 }}>📋 Bill Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: '#7c3aed' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxable:</span><strong>₹{fmt(billTotals.taxable)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>GST:</span><strong>₹{fmt(billTotals.gst)}</strong></div>
                    {form.buyer_state && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tax split:</span>
                        <strong>{normalizeState(shopState) !== normalizeState(form.buyer_state) ? 'IGST' : 'CGST + SGST'}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4, marginTop: 2 }}>
                      <span>Total:</span><span>₹{fmt(billTotals.total)}</span>
                    </div>
                    {form.payment_type === 'credit' && amountPaidNum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 700 }}>
                        <span>Balance Due:</span><span>₹{fmt(balanceDue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Type */}
              <div className="form-group" style={{ display: saleStep === 1 ? 'block' : 'none' }}>
                <label className="form-label">Payment Type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { val: 'cash',   label: '💵 Cash',   color: '#10b981' },
                    { val: 'credit', label: '📒 Credit', color: '#ef4444' },
                    { val: 'upi',    label: '📱 UPI',    color: '#8b5cf6' },
                    { val: 'bank',   label: '🏦 Bank',   color: '#3b82f6' },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => updateForm({ payment_type: opt.val, amount_paid: opt.val === 'credit' ? form.amount_paid : '' })}
                      style={{
                        flex: 1, minWidth: 70, padding: '9px 4px', borderRadius: 8, border: '2px solid',
                        borderColor: form.payment_type === opt.val ? opt.color : '#e5e7eb',
                        background: form.payment_type === opt.val ? opt.color : '#f9fafb',
                        color: form.payment_type === opt.val ? '#fff' : '#374151',
                        cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.payment_type === 'credit' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="form-label">Advance Payment (optional)</label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      placeholder={`Max ₹${fmt(billTotals.total)}`}
                      value={form.amount_paid}
                      onChange={e => updateForm({ amount_paid: e.target.value })} />
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 6, fontSize: 12, color: '#991b1b' }}>
                      ⚠️ बाकी ₹{fmt(balanceDue)} customer ledger में automatically जाएगा
                    </div>
                  </div>
                )}
              </div>

              {/* Buyer Details */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginBottom: 14, display: saleStep === 2 ? 'block' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.payment_type === 'credit' ? '#ef4444' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  👤 {form.payment_type === 'credit' ? 'Customer Details (जरूरी *)' : 'Buyer Details (वैकल्पिक)'}
                </div>
                <div className="form-group">
                  <label className="form-label">नाम / Name {form.payment_type === 'credit' && <span style={{ color: '#ef4444' }}>*</span>}</label>
                  <input className="form-input" placeholder="ग्राहक का नाम"
                    value={form.buyer_name} onChange={e => updateForm({ buyer_name: e.target.value })}
                    required={form.payment_type === 'credit'} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="Mobile" value={form.buyer_phone} onChange={e => updateForm({ buyer_phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input
                      className="form-input"
                      placeholder="GSTIN for B2B"
                      value={form.buyer_gstin}
                      maxLength={15}
                      onChange={e => updateForm({ buyer_gstin: normalizeGstin(e.target.value) })}
                      onBlur={() => setGstinTouched(true)}
                    />
                    {showGstinError && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Invalid GSTIN format</div>
                    )}
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-input" value={form.buyer_state} onChange={e => updateForm({ buyer_state: e.target.value })}>
                      <option value="">Select State/UT</option>
                      <optgroup label="── States ──">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label="── Union Territories ──">{UTS.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" placeholder="Address" value={form.buyer_address} onChange={e => updateForm({ buyer_address: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Any notes..." value={form.notes} onChange={e => updateForm({ notes: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {saleStep > 0 && (
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setSaleStep((current) => current - 1)}>
                    Back
                  </button>
                )}
                {saleStep < 2 ? (
                  <button type="button" className="btn-success" style={{ flex: 1 }} onClick={() => setSaleStep((current) => current + 1)}>
                    Continue
                  </button>
                ) : (
                <button type="button" onClick={handleSubmit} className="btn-success" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? '⏳ दर्ज हो रहा है...' : editingSaleId ? '💾 Update Sale' : form.payment_type === 'credit' ? '📒 Credit Sale' : '💵 बिक्री दर्ज'}
                </button>
                )}
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
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

// ── Invoice HTML Generator (UNCHANGED) ───────────────────────────────────────
const getStateCode = (stateName = '', gstin = '') => {
  const gstStateCode = String(gstin || '').slice(0, 2);
  if (/^\d{2}$/.test(gstStateCode)) return gstStateCode;
  return STATE_CODE_BY_NAME[normalizeState(stateName)] || '';
};

const buildTaxSummaryRows = (saleItems, isIGST) => {
  const grouped = saleItems.reduce((acc, item) => {
    const rate = Number(item.gst_rate || 0);
    const key = String(rate);
    if (!acc[key]) acc[key] = { rate, cgst: 0, sgst: 0, igst: 0 };
    acc[key].cgst += Number(item.cgst_amount || 0);
    acc[key].sgst += Number(item.sgst_amount || 0);
    acc[key].igst += Number(item.igst_amount || 0);
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => a.rate - b.rate)
    .map((group) => (
      isIGST
        ? '<div class="amount-row"><span>IGST @' + group.rate + '%</span><span>₹' + fmt(group.igst) + '</span></div>'
        : '<div class="amount-row"><span>CGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.cgst) + '</span></div>'
          + '<div class="amount-row"><span>SGST @' + (group.rate / 2).toFixed(1) + '%</span><span>₹' + fmt(group.sgst) + '</span></div>'
    ))
    .join('');
};

function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{
    product_name: sale.product_name,
    hsn_code: sale.hsn_code,
    quantity: sale.quantity,
    price_per_unit: sale.price_per_unit,
    gst_rate: sale.gst_rate,
    taxable_amount: sale.taxable_amount,
    cgst_amount: sale.cgst_amount,
    sgst_amount: sale.sgst_amount,
    igst_amount: sale.igst_amount,
    gst_type: sale.gst_type,
    total_amount: sale.total_amount,
  }];

  const isIGST   = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const colSpan  = isIGST ? 8 : 10;
  const placeOfSupplyCode = getStateCode(sale.buyer_state, sale.buyer_gstin);
  const sellerStateCode = getStateCode(shop.state, shop.gstin);
  const placeOfSupplyLabel = sale.buyer_state
    ? `${sale.buyer_state}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}`
    : 'Not specified';

  const gstCols = isIGST
    ? '<th>IGST%</th><th>IGST ₹</th>'
    : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';

  const itemRows = saleItems.map((item, idx) => {
    const gstCells = isIGST
      ? '<td>' + (item.gst_rate || 0) + '%</td><td>₹' + fmt(item.igst_amount) + '</td>'
      : '<td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.cgst_amount) + '</td><td>' + ((item.gst_rate || 0) / 2).toFixed(1) + '%</td><td>₹' + fmt(item.sgst_amount) + '</td>';
    return '<tr><td>' + (idx + 1) + '</td><td style="text-align:left"><strong>' + item.product_name + '</strong></td><td>' + (item.hsn_code || '—') + '</td><td>' + item.quantity + '</td><td>₹' + fmt(item.price_per_unit) + '</td><td>₹' + fmt(item.taxable_amount) + '</td>' + gstCells + '<td><strong>₹' + fmt(item.total_amount) + '</strong></td></tr>';
  }).join('');

  const emptyCell  = '<td style="height:20px"></td>';
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill('<tr>' + emptyCell.repeat(colSpan) + '</tr>').join('');

  const footerGST = isIGST
    ? '<td></td><td>₹' + fmt(sale.igst_amount) + '</td>'
    : '<td></td><td>₹' + fmt(sale.cgst_amount) + '</td><td></td><td>₹' + fmt(sale.sgst_amount) + '</td>';

  const amountGSTRows = buildTaxSummaryRows(saleItems, isIGST);

  const payBg    = sale.payment_type === 'cash' ? '#dcfce7' : sale.payment_type === 'upi' ? '#ede9fe' : '#fee2e2';
  const payColor = sale.payment_type === 'cash' ? '#166534' : sale.payment_type === 'upi' ? '#5b21b6' : '#991b1b';
  const payLabel = sale.payment_type === 'cash' ? '💵 CASH' : sale.payment_type === 'upi' ? '📱 UPI' : sale.payment_type === 'bank' ? '🏦 BANK' : '📒 CREDIT';

  const bankHTML = shop.bank_name
    ? '<div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px">🏦 Bank Details</div>'
      + '<div style="font-size:11px;margin-bottom:3px">Bank: <strong>' + shop.bank_name + '</strong></div>'
      + (shop.bank_branch  ? '<div style="font-size:11px;margin-bottom:3px">Branch: <strong>' + shop.bank_branch  + '</strong></div>' : '')
      + (shop.bank_account ? '<div style="font-size:11px;margin-bottom:3px">A/C: <strong>'    + shop.bank_account + '</strong></div>' : '')
      + (shop.bank_ifsc    ? '<div style="font-size:11px">IFSC: <strong>'                     + shop.bank_ifsc    + '</strong></div>' : '')
    : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>';

  const termsHTML = shop.terms
    ? '<div class="terms-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div><div style="font-size:10px;color:#374151">'
      + shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>')
      + '</div></div>'
    : '';

  const creditNote = sale.payment_type === 'credit'
    ? '<div style="margin-top:8px;background:#fee2e2;border-radius:6px;padding:6px 8px"><div style="font-size:10px;font-weight:700;color:#991b1b">📒 CREDIT SALE — उधार</div><div style="font-size:11px;color:#991b1b">Amount added to customer ledger</div></div>'
    : '';

  const pdfBanner = suggestedFileName && !autoPrint
    ? '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:18px">📄</span>'
      + '<div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → Change destination to <strong>"Save as PDF"</strong> → Save as <strong>' + suggestedFileName + '</strong><br/>'
      + '<span style="font-size:11px;opacity:0.8">Then attach this PDF file on WhatsApp</span></div>'
      + '</div>'
    : '';

  const html = '<!DOCTYPE html><html><head><title>Invoice - ' + sale.invoice_number + '</title>'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}'
    + '.invoice{max-width:800px;margin:0 auto;padding:20px;border:2px solid #000}'
    + '.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #0B1D35;padding-bottom:10px}'
    + '.shop-name{font-size:26px;font-weight:900;color:#0B1D35}.shop-name span{color:#059669}'
    + '.title-bar{background:#0B1D35;color:white;text-align:center;padding:6px;font-size:16px;font-weight:700;letter-spacing:2px;margin-bottom:8px}'
    + '.gstin-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;margin-bottom:8px}'
    + '.gstin-cell{padding:5px 10px;font-weight:700;font-size:12px;border-right:1px solid #000}'
    + '.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:0}'
    + '.party-box{padding:8px}.party-box:first-child{border-right:1px solid #000}'
    + '.party-label{font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}'
    + '.party-name{font-size:14px;font-weight:700;color:#0B1D35}.party-detail{font-size:11px;color:#374151;margin-top:2px}'
    + '.inv-details{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;border:1px solid #000;border-top:none;margin-bottom:8px}'
    + '.inv-detail-box{padding:5px 8px;border-right:1px solid #e5e7eb;font-size:11px}'
    + 'table{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:0}'
    + 'th{background:#0B1D35;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #374151}'
    + 'td{padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-size:11px}'
    + 'td:nth-child(2){text-align:left}tr:nth-child(even){background:#f9fafb}'
    + '.totals-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}'
    + '.words-box{padding:10px;border-right:1px solid #000}.amounts-box{padding:6px 10px}'
    + '.amount-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f3f4f6}'
    + '.amount-total{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:900;color:#0B1D35;border-top:2px solid #0B1D35;margin-top:4px}'
    + '.footer-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}'
    + '.bank-box{padding:10px;border-right:1px solid #000}.sign-box{padding:10px;text-align:right}'
    + '.terms-box{border:1px solid #000;border-top:none;padding:8px 10px}'
    + '.logo-circle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0B1D35,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}'
    + '@media print{.pdf-banner{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}'
    + '</style></head><body>'
    + '<div class="pdf-banner" style="max-width:800px;margin:0 auto 0;">' + pdfBanner + '</div>'
    + '<div class="invoice">'
    + '<div class="header"><div>'
    + '<div class="shop-name">रख<span>रखाव</span></div>'
    + '<div style="font-size:11px;color:#059669;font-weight:600;background:#ecfdf5;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px">Business Manager</div>'
    + (shop.address ? '<div style="font-size:11px;color:#374151;margin-top:4px">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + (shop.phone   ? '<div style="font-size:11px;color:#374151">📞 ' + shop.phone + (shop.email ? ' | ✉️ ' + shop.email : '') + '</div>' : '')
    + '</div><div class="logo-circle">र</div></div>'
    + '<div class="title-bar">TAX INVOICE / कर चालान</div>'
    + '<div class="gstin-row"><div class="gstin-cell">GSTIN: ' + (shop.gstin || 'N/A') + '</div>'
    + '<div style="flex:1;text-align:center;padding:5px;font-size:11px"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div>'
    + '<div style="padding:5px 10px;font-size:10px;font-weight:700;color:#059669;border-left:1px solid #000">ORIGINAL FOR RECIPIENT</div></div>'
    + '<div class="parties">'
    + '<div class="party-box"><div class="party-label">विक्रेता / Seller</div><div class="party-name">' + (shop.name || 'रखरखाव') + '</div>'
    + (shop.address ? '<div class="party-detail">📍 ' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '')
    + (shop.phone   ? '<div class="party-detail">📞 ' + shop.phone + '</div>' : '')
    + (shop.gstin   ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + shop.gstin + '</div>' : '')
    + (shop.state   ? '<div class="party-detail">State Code: ' + (sellerStateCode || 'N/A') + '</div>' : '')
    + '</div>'
    + '<div class="party-box"><div class="party-label">खरीदार / Buyer</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>'
    + (sale.buyer_address ? '<div class="party-detail">📍 ' + sale.buyer_address + '</div>' : '')
    + (sale.buyer_state   ? '<div class="party-detail">State: ' + sale.buyer_state + '</div>' : '')
    + (sale.buyer_gstin   ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + sale.buyer_gstin + '</div>' : '')
    + (sale.buyer_phone   ? '<div class="party-detail">📞 ' + sale.buyer_phone + '</div>' : '')
    + '</div></div>'
    + '<div class="inv-details">'
    + '<div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Invoice No.</div><div style="font-weight:700;color:#059669">' + sale.invoice_number + '</div></div>'
    + '<div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Date</div><div style="font-weight:700">' + saleDate + '</div></div>'
    + '<div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Type</div><div style="font-weight:700">' + (sale.invoice_type || 'B2C') + ' | ' + (isIGST ? 'IGST' : 'CGST+SGST') + '</div></div>'
    + '<div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Place of Supply</div><div style="font-weight:700">' + placeOfSupplyLabel + '</div></div>'
    + '</div>'
    + '<table><thead><tr><th style="width:28px">Sr.</th><th style="text-align:left">Product</th><th>HSN</th><th>Qty</th><th>Rate ₹</th><th>Taxable ₹</th>' + gstCols + '<th>Total ₹</th></tr></thead>'
    + '<tbody>' + itemRows + fillerRows + '</tbody>'
    + '<tfoot><tr style="background:#f3f4f6;font-weight:700"><td colspan="5" style="text-align:right">कुल / Total</td><td>₹' + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td><strong>₹' + fmt(sale.total_amount) + '</strong></td></tr></tfoot></table>'
    + '<div class="totals-section">'
    + '<div class="words-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Amount in Words</div>'
    + '<div style="font-size:11px;font-weight:600;color:#0B1D35;font-style:italic">' + numberToWords(parseFloat(sale.total_amount)) + '</div>' + creditNote + '</div>'
    + '<div class="amounts-box">'
    + '<div class="amount-row"><span>Taxable Amount</span><span>₹' + fmt(sale.taxable_amount) + '</span></div>'
    + amountGSTRows
    + '<div class="amount-row"><span>Total GST</span><span>₹' + fmt(sale.total_gst) + '</span></div>'
    + '<div class="amount-total"><span>GRAND TOTAL</span><span>₹' + fmt(sale.total_amount) + '</span></div>'
    + '</div></div>'
    + '<div class="footer-section"><div class="bank-box">' + bankHTML + '</div>'
    + '<div class="sign-box"><div style="font-size:12px;font-weight:700;margin-bottom:40px">For <strong>' + (shop.name || 'रखरखाव') + '</strong></div>'
    + '<div style="border-top:1px solid #000;padding-top:4px;font-size:11px;font-weight:700">Authorised Signatory</div>'
    + '<div style="font-size:10px;color:#9ca3af;margin-top:6px">Computer generated invoice<br/>No signature required.</div>'
    + '</div></div>'
    + termsHTML
    + '<div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic">~ Rakh-Rakhaav Business Manager ~</div>'
    + '</div>'
    + (autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : '')
    + '</body></html>';

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
