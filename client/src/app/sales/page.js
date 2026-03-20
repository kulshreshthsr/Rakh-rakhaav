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
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  return convert(rupees) + ' Rupees' + (paise ? ' and ' + convert(paise) + ' Paise' : '') + ' Only';
};

const buildWhatsAppMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const payLabel =
    sale.payment_type === 'cash' ? '✅ Cash (Paid)' :
    sale.payment_type === 'upi' ? '✅ UPI (Paid)' :
    sale.payment_type === 'bank' ? '✅ Bank Transfer' :
    '📒 Udhaar (Credit)';

  const itemLines = (sale.items && sale.items.length > 0)
    ? sale.items.map((item, i) => `  ${i + 1}. ${item.product_name} × ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`).join('\n')
    : `  1. ${sale.product_name} × ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;

  const isIGST = sale.gst_type === 'IGST' || (sale.items && sale.items.some((i) => i.gst_type === 'IGST'));
  const gstLine = (sale.total_gst && sale.total_gst > 0)
    ? isIGST
      ? `🔹 IGST: ₹${fmt(sale.igst_amount)}`
      : `🔹 CGST: ₹${fmt(sale.cgst_amount)}  |  SGST: ₹${fmt(sale.sgst_amount)}`
    : '🔹 GST: NIL';

  const greeting = sale.buyer_name && sale.buyer_name !== 'Walk-in Customer'
    ? `Namaste *${sale.buyer_name}* ji! 🙏\n\n`
    : '';

  return [
    `${greeting}🧾 *Invoice / Bill Details*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `🏪 Shop: *${shopName || 'Rakhaav'}*`,
    `📄 Invoice No: *${sale.invoice_number}*`,
    `📅 Date: ${saleDate}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '📦 *Items:*',
    itemLines,
    '━━━━━━━━━━━━━━━━━━━━',
    `💵 Taxable Amount: ₹${fmt(sale.taxable_amount)}`,
    gstLine,
    `💰 *Total Amount: ₹${fmt(sale.total_amount)}*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `💳 Payment: ${payLabel}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '🙏 Aapka business hamare liye bahut important hai!',
    `Thank you for choosing *${shopName || 'Rakhaav'}* 😊`,
    '',
    '_Powered by Rakhaav Business Manager_',
  ].join('\n');
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
  const [form, setForm] = useState({
    payment_type: 'cash',
    buyer_name: '',
    buyer_phone: '',
    buyer_gstin: '',
    buyer_address: '',
    buyer_state: '',
    notes: '',
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchProducts()]);
    setLoading(false);
  };

  const fetchSales = async () => {
    try {
      const res = await fetch(`${API}/api/sales`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setSales(data.sales || (Array.isArray(data) ? data : []));
      setSummary(data.summary || {});
    } catch {
      setError('बिक्री लोड नहीं हो सकी');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch {}
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    fetch(`${API}/api/auth/shop`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((shop) => setShopName(shop.name || ''))
      .catch(() => {});
  }, []);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find((p) => p._id === value);
      if (prod) updated[index].price_per_unit = prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => {
    if (items.length > 1) setItems(items.filter((_, idx) => idx !== i));
  };

  const rowGST = (item) => {
    const prod = products.find((p) => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return {
      taxable,
      gst_rate,
      gst,
      total: taxable + gst,
      half_gst: gst / 2,
    };
  };

  const billTotals = items.reduce((acc, item) => {
    const g = rowGST(item);
    if (!g) return acc;
    return {
      taxable: acc.taxable + g.taxable,
      gst: acc.gst + g.gst,
      total: acc.total + g.total,
    };
  }, { taxable: 0, gst: 0, total: 0 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.payment_type === 'credit' && !form.buyer_name) {
      setError('उधार बिक्री के लिए ग्राहक का नाम जरूरी है!');
      return;
    }

    const validItems = items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
    if (validItems.length === 0) {
      setError('कम से कम एक product चुनें');
      return;
    }

    for (const item of validItems) {
      const prod = products.find((p) => p._id === item.product_id);
      if (prod && Number(item.quantity) > (prod.quantity || 0)) {
        setError(prod.name + ': सिर्फ ' + prod.quantity + ' stock available है');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ items: validItems, ...form }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchAll();
      } else {
        setError(data.message || 'विफल');
      }
    } catch {
      setError('सर्वर त्रुटि');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setItems([emptyItem()]);
    setForm({
      payment_type: 'cash',
      buyer_name: '',
      buyer_phone: '',
      buyer_gstin: '',
      buyer_address: '',
      buyer_state: '',
      notes: '',
    });
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('इस बिक्री को हटाएं? Stock वापस आएगा।')) return;
    try {
      await fetch(`${API}/api/sales/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchAll();
    } catch {
      setError('हटाने में विफल');
    }
  };

  const printInvoice = async (sale) => {
    try {
      const shopRes = await fetch(`${API}/api/auth/shop`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const shop = await shopRes.json();
      generateInvoiceHTML(sale, shop, true);
    } catch {
      alert('Invoice generate nahi hua');
    }
  };

  const shareWhatsApp = (sale) => {
    const msg = buildWhatsAppMessage(sale, shopName);
    const phone = sale.buyer_phone ? sale.buyer_phone.replace(/\D/g, '') : '';
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const PayBadge = ({ type }) => {
    const map = {
      cash: { bg: '#ECFDF5', color: '#166534', label: '💵 Cash' },
      credit: { bg: '#FEF2F2', color: '#991B1B', label: '📒 Credit' },
      upi: { bg: '#F5F3FF', color: '#5B21B6', label: '📱 UPI' },
      bank: { bg: '#EFF6FF', color: '#1E40AF', label: '🏦 Bank' },
    };
    const s = map[type] || map.cash;
    return (
      <span
        style={{
          background: s.bg,
          color: s.color,
          padding: '5px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {s.label}
      </span>
    );
  };

  const payBtnStyles = (opt, selected) => ({
    flex: 1,
    minWidth: 88,
    padding: '11px 8px',
    borderRadius: 14,
    border: '1.5px solid',
    borderColor: selected ? opt.color : 'var(--border-soft)',
    background: selected ? opt.bgStrong : '#fff',
    color: selected ? '#fff' : 'var(--text-2)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12.5,
    fontFamily: 'var(--font-body)',
    boxShadow: selected ? `0 14px 26px ${opt.shadow}` : 'none',
    transition: 'all 0.15s',
  });

  const totalRevenue = summary.totalRevenue || 0;
  const totalGST = summary.totalGST || 0;
  const totalTaxable = Math.max(0, totalRevenue - totalGST);
  const creditSalesCount = sales.filter((s) => s.payment_type === 'credit').length;
  const latestSales = sales.slice(0, 5);

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
            बिक्री / Sales
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 640 }}>
            Fast billing, GST-ready invoices, customer credit tracking, and WhatsApp sharing in one premium workflow.
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-success"
        >
          + बिक्री दर्ज करें
        </button>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #052E16 0%, #166534 48%, #0F172A 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(22,163,74,0.18)',
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
            background: 'radial-gradient(circle, rgba(34,197,94,0.22), transparent 70%)',
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
          className="sales-hero-grid"
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
              <span>⚡</span>
              <span>Sales workspace</span>
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
              Billing that feels instant and premium
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              Create GST-ready sales, watch live totals, send invoices to WhatsApp, and track credit sales without friction.
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
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>₹{fmt(totalRevenue)}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              Total sales value across {sales.length} invoices
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
                  GST
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>₹{fmt(totalGST)}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Credit bills
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{creditSalesCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && !showModal && (
        <div
          style={{
            background: '#FEF2F2',
            color: '#991B1B',
            padding: '13px 16px',
            borderRadius: 16,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid #FECACA',
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
              borderTopColor: '#16A34A',
              animation: 'spin 0.7s linear infinite',
              marginBottom: 12,
            }}
          />
          लोड हो रहा है...
        </div>
      ) : sales.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '72px 24px',
            color: 'var(--text-4)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(240,253,244,0.88))',
          }}
        >
          <div style={{ fontSize: 54, marginBottom: 12 }}>📈</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-2)', marginBottom: 6 }}>
            अभी कोई बिक्री नहीं
          </div>
          <div style={{ fontSize: 13.5, marginBottom: 18 }}>
            पहली बिक्री दर्ज करें और invoice flow शुरू करें
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-success"
          >
            + पहली बिक्री दर्ज करें
          </button>
        </div>
      ) : (
        <>
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
                label: 'Total Revenue',
                value: `₹${fmt(totalRevenue)}`,
                sub: `${sales.length} invoices`,
                tone: '#16A34A',
                soft: '#F0FDF4',
                icon: '💰',
              },
              {
                label: 'Taxable Sales',
                value: `₹${fmt(totalTaxable)}`,
                sub: 'Before GST',
                tone: '#4338CA',
                soft: '#EEF2FF',
                icon: '🧾',
              },
              {
                label: 'Total GST',
                value: `₹${fmt(totalGST)}`,
                sub: 'Collected from invoices',
                tone: '#D97706',
                soft: '#FFFBEB',
                icon: '📊',
              },
              {
                label: 'Credit Sales',
                value: `${creditSalesCount}`,
                sub: 'Pending collection entries',
                tone: '#DC2626',
                soft: '#FEF2F2',
                icon: '📒',
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
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.9fr)',
              gap: 16,
              marginBottom: 22,
            }}
            className="sales-main-grid"
          >
            <div className="table-container hidden-xs">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Items / Buyer</th>
                    <th>Taxable</th>
                    <th>GST</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <span
                          style={{
                            color: '#4338CA',
                            fontWeight: 800,
                            fontSize: 12,
                            background: '#EEF2FF',
                            padding: '4px 9px',
                            borderRadius: 999,
                          }}
                        >
                          {s.invoice_number}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>
                          {s.items && s.items.length > 1 ? `${s.items.length} items` : s.product_name}
                        </div>
                        {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>
                            {s.buyer_name}
                          </div>
                        )}
                      </td>

                      <td style={{ fontWeight: 600 }}>₹{fmt(s.taxable_amount)}</td>

                      <td>
                        {(s.total_gst || 0) > 0 ? (
                          <span
                            style={{
                              background: '#F5F3FF',
                              color: '#6D28D9',
                              padding: '4px 9px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            ₹{fmt(s.total_gst)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-5)' }}>—</span>
                        )}
                      </td>

                      <td style={{ fontWeight: 800, color: '#16A34A', fontSize: 14.5 }}>
                        ₹{fmt(s.total_amount)}
                      </td>

                      <td>
                        <PayBadge type={s.payment_type} />
                      </td>

                      <td style={{ color: 'var(--text-4)', fontSize: 12 }}>
                        {new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => printInvoice(s)}
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
                            🖨️ Print
                          </button>

                          <button
                            onClick={() => shareWhatsApp(s)}
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
                            📲 WA
                          </button>

                          <button
                            onClick={() => handleDelete(s._id)}
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
                  Recent Billing Snapshot
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Latest invoices with payment mix
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {latestSales.map((s) => (
                    <div
                      key={s._id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {s.invoice_number}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--text-4)',
                              marginTop: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.buyer_name || 'Walk-in Customer'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16A34A' }}>
                            ₹{fmt(s.total_amount)}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <PayBadge type={s.payment_type} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Sales Flow Tips
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Small UX helpers built into the billing screen
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { title: 'Auto price fill', sub: 'Selecting a product fills selling price automatically', bg: '#EEF2FF', color: '#4338CA', icon: '⚡' },
                    { title: 'Live GST totals', sub: 'Taxable, GST, and total update instantly while billing', bg: '#F5F3FF', color: '#7C3AED', icon: '🧾' },
                    { title: 'Stock warning', sub: 'Sale blocks if quantity exceeds available stock', bg: '#FEF2F2', color: '#B91C1C', icon: '⚠️' },
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

          <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
            {sales.map((s) => (
              <div
                key={s._id}
                className="card"
                style={{
                  borderLeft: `4px solid ${s.payment_type === 'credit' ? '#EF4444' : '#22C55E'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>
                      {s.items && s.items.length > 1 ? `${s.items.length} products` : s.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#4338CA', fontWeight: 800, marginTop: 3 }}>
                      {s.invoice_number}
                    </div>
                    {s.buyer_name && s.buyer_name !== 'Walk-in Customer' && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                        {s.buyer_name}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: '#16A34A', fontSize: 18 }}>
                      ₹{fmt(s.total_amount)}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <PayBadge type={s.payment_type} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Taxable
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 3 }}>
                      ₹{fmt(s.taxable_amount)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      GST
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#7C3AED', marginTop: 3 }}>
                      ₹{fmt(s.total_gst)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Date
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 3 }}>
                      {new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => printInvoice(s)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#EEF2FF',
                      color: '#4338CA',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    🖨️ Print
                  </button>

                  <button
                    onClick={() => shareWhatsApp(s)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#ECFDF5',
                      color: '#15803D',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    📲 WA
                  </button>

                  <button
                    onClick={() => handleDelete(s._id)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', maxWidth: 760 }}>
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
                  बिक्री दर्ज करें
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  Premium billing flow with live GST calculation
                </div>
              </div>

              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
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

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(250px, 0.8fr)',
                  gap: 18,
                }}
                className="sales-modal-grid"
              >
                <div>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 20,
                      background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.95))',
                      border: '1px solid var(--border-soft)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 12,
                      }}
                    >
                      Items
                    </div>

                    {items.map((item, index) => {
                      const g = rowGST(item);
                      const prod = products.find((p) => p._id === item.product_id);
                      const stock = prod?.quantity ?? 0;
                      const isLow = prod && stock > 0 && stock <= 5;
                      const isOut = prod && stock === 0;

                      return (
                        <div
                          key={index}
                          style={{
                            background: '#fff',
                            borderRadius: 18,
                            padding: 14,
                            marginBottom: 12,
                            border: '1px solid var(--border-soft)',
                            boxShadow: 'var(--shadow-xs)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 10,
                              marginBottom: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 10,
                                  background: '#EEF2FF',
                                  color: '#4338CA',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {index + 1}
                              </div>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                                  Item {index + 1}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                                  Product, quantity, price, and GST
                                </div>
                              </div>
                            </div>

                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                style={{
                                  background: '#FEF2F2',
                                  border: 'none',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  fontSize: 15,
                                  width: 30,
                                  height: 30,
                                  borderRadius: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                }}
                              >
                                ×
                              </button>
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
                              <input
                                className="form-input"
                                type="number"
                                min="1"
                                max={prod ? prod.quantity : undefined}
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                required
                              />
                              {prod && (
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    marginTop: 6,
                                    fontWeight: 700,
                                    color: isOut ? '#B91C1C' : isLow ? '#B45309' : '#15803D',
                                  }}
                                >
                                  {isOut
                                    ? 'Out of stock'
                                    : isLow
                                    ? `Low stock: ${stock} available`
                                    : `Available: ${stock}`}
                                </div>
                              )}
                            </div>

                            <div className="form-group">
                              <label className="form-label">Price/Unit ₹ *</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={item.price_per_unit}
                                onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          {g && (
                            <div
                              style={{
                                fontSize: 12.5,
                                color: 'var(--text-3)',
                                background: g.gst_rate > 0 ? '#F5F3FF' : '#F0FDF4',
                                borderRadius: 14,
                                padding: '10px 12px',
                                display: 'flex',
                                gap: 14,
                                flexWrap: 'wrap',
                                border: `1px solid ${g.gst_rate > 0 ? '#DDD6FE' : '#BBF7D0'}`,
                              }}
                            >
                              <span>
                                Taxable: <strong>₹{fmt(g.taxable)}</strong>
                              </span>
                              {g.gst_rate > 0 && (
                                <span>
                                  GST {g.gst_rate}%: <strong>₹{fmt(g.gst)}</strong>
                                </span>
                              )}
                              <span>
                                Total:{' '}
                                <strong style={{ color: g.gst_rate > 0 ? '#6D28D9' : '#15803D' }}>
                                  ₹{fmt(g.total)}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addItem}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#fff',
                        border: '1.5px dashed #C7D2FE',
                        borderRadius: 16,
                        color: '#4338CA',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      + Add Another Product
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 20,
                      background: '#fff',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 12,
                      }}
                    >
                      Buyer Details
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        नाम / Name {form.payment_type === 'credit' && <span style={{ color: '#DC2626' }}>*</span>}
                      </label>
                      <input
                        className="form-input"
                        placeholder="ग्राहक का नाम"
                        value={form.buyer_name}
                        onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                        required={form.payment_type === 'credit'}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                          className="form-input"
                          placeholder="Mobile"
                          value={form.buyer_phone}
                          onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GSTIN</label>
                        <input
                          className="form-input"
                          placeholder="GSTIN for B2B"
                          value={form.buyer_gstin}
                          onChange={(e) => setForm({ ...form, buyer_gstin: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <select
                          className="form-input"
                          value={form.buyer_state}
                          onChange={(e) => setForm({ ...form, buyer_state: e.target.value })}
                        >
                          <option value="">Select State/UT</option>
                          <optgroup label="── States ──">
                            {STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="── Union Territories ──">
                            {UTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Address</label>
                        <input
                          className="form-input"
                          placeholder="Address"
                          value={form.buyer_address}
                          onChange={(e) => setForm({ ...form, buyer_address: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Notes</label>
                      <input
                        className="form-input"
                        placeholder="Any notes..."
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        padding: '18px',
                        borderRadius: 20,
                        background: 'linear-gradient(180deg, #F5F3FF 0%, #EEF2FF 100%)',
                        border: '1px solid #DDD6FE',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#5B21B6',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 12,
                        }}
                      >
                        Bill Summary
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5B21B6' }}>
                          <span>Taxable Amount</span>
                          <strong>₹{fmt(billTotals.taxable)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5B21B6' }}>
                          <span>GST</span>
                          <strong>₹{fmt(billTotals.gst)}</strong>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: 18,
                            borderTop: '1px solid #C4B5FD',
                            paddingTop: 10,
                            marginTop: 4,
                            color: '#4C1D95',
                          }}
                        >
                          <span>Total</span>
                          <span>₹{fmt(billTotals.total)}</span>
                        </div>
                      </div>

                      {billTotals.total > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: 'rgba(255,255,255,0.65)',
                            color: '#5B21B6',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {numberToWords(parseFloat(billTotals.total || 0))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: '18px',
                        borderRadius: 20,
                        background: '#fff',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: 'var(--text-3)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 12,
                        }}
                      >
                        Payment Type
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { val: 'cash', label: '💵 Cash', color: '#16A34A', bgStrong: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)', shadow: 'rgba(34,197,94,0.22)' },
                          { val: 'credit', label: '📒 Credit', color: '#DC2626', bgStrong: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', shadow: 'rgba(239,68,68,0.22)' },
                          { val: 'upi', label: '📱 UPI', color: '#7C3AED', bgStrong: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', shadow: 'rgba(139,92,246,0.22)' },
                          { val: 'bank', label: '🏦 Bank', color: '#2563EB', bgStrong: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', shadow: 'rgba(59,130,246,0.22)' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setForm({ ...form, payment_type: opt.val })}
                            style={payBtnStyles(opt, form.payment_type === opt.val)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {form.payment_type === 'credit' && (
                        <div
                          style={{
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: 14,
                            padding: '11px 12px',
                            marginTop: 12,
                            fontSize: 12.5,
                            color: '#991B1B',
                            fontWeight: 600,
                          }}
                        >
                          ⚠️ उधार बही में entry अपने आप होगी
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="submit"
                        className="btn-success"
                        style={{ flex: 1 }}
                        disabled={submitting}
                      >
                        {submitting
                          ? '⏳ दर्ज हो रहा है...'
                          : form.payment_type === 'credit'
                          ? '📒 Credit Sale दर्ज'
                          : '💵 बिक्री दर्ज करें'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          resetForm();
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
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .sales-hero-grid,
          .sales-main-grid,
          .sales-modal-grid {
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

// ── Invoice HTML Generator (UNCHANGED) ───────────────────────────────────────
function generateInvoiceHTML(sale, shop, autoPrint, suggestedFileName) {
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity, price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate, taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount, sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount, gst_type: sale.gst_type, total_amount: sale.total_amount }];
  const isIGST = sale.gst_type === 'IGST' || saleItems.some((i) => i.gst_type === 'IGST');
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
  const bankHTML = shop.bank_name ? '<div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:6px">🏦 Bank Details</div>' + '<div style="font-size:11px;margin-bottom:3px">Bank: <strong>' + shop.bank_name + '</strong></div>' + (shop.bank_branch ? '<div style="font-size:11px;margin-bottom:3px">Branch: <strong>' + shop.bank_branch + '</strong></div>' : '') + (shop.bank_account ? '<div style="font-size:11px;margin-bottom:3px">A/C: <strong>' + shop.bank_account + '</strong></div>' : '') + (shop.bank_ifsc ? '<div style="font-size:11px">IFSC: <strong>' + shop.bank_ifsc + '</strong></div>' : '') : '<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>';
  const termsHTML = shop.terms ? '<div class="terms-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div><div style="font-size:10px;color:#374151">' + shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>') + '</div></div>' : '';
  const creditNote = sale.payment_type === 'credit' ? '<div style="margin-top:8px;background:#fee2e2;border-radius:6px;padding:6px 8px"><div style="font-size:10px;font-weight:700;color:#991b1b">📒 CREDIT SALE — उधार</div><div style="font-size:11px;color:#991b1b">Amount added to customer ledger</div></div>' : '';
  const pdfBanner = suggestedFileName && !autoPrint ? '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px"><span style="font-size:18px">📄</span><div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → Change destination to <strong>"Save as PDF"</strong> → Save as <strong>' + suggestedFileName + '</strong><br/><span style="font-size:11px;opacity:0.8">Then attach this PDF file on WhatsApp</span></div></div>' : '';
  const html = '<!DOCTYPE html><html><head><title>Invoice - ' + sale.invoice_number + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}.invoice{max-width:800px;margin:0 auto;padding:20px;border:2px solid #000}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #0B1D35;padding-bottom:10px}.shop-name{font-size:26px;font-weight:900;color:#0B1D35}.shop-name span{color:#059669}.title-bar{background:#0B1D35;color:white;text-align:center;padding:6px;font-size:16px;font-weight:700;letter-spacing:2px;margin-bottom:8px}.gstin-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;margin-bottom:8px}.gstin-cell{padding:5px 10px;font-weight:700;font-size:12px;border-right:1px solid #000}.parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:0}.party-box{padding:8px}.party-box:first-child{border-right:1px solid #000}.party-label{font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}.party-name{font-size:14px;font-weight:700;color:#0B1D35}.party-detail{font-size:11px;color:#374151;margin-top:2px}.inv-details{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #000;border-top:none;margin-bottom:8px}.inv-detail-box{padding:5px 8px;border-right:1px solid #e5e7eb;font-size:11px}table{width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:0}th{background:#0B1D35;color:white;padding:6px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #374151}td{padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-size:11px}td:nth-child(2){text-align:left}tr:nth-child(even){background:#f9fafb}.totals-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.words-box{padding:10px;border-right:1px solid #000}.amounts-box{padding:6px 10px}.amount-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f3f4f6}.amount-total{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:900;color:#0B1D35;border-top:2px solid #0B1D35;margin-top:4px}.footer-section{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none}.bank-box{padding:10px;border-right:1px solid #000}.sign-box{padding:10px;text-align:right}.terms-box{border:1px solid #000;border-top:none;padding:8px 10px}.logo-circle{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0B1D35,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}@media print{.pdf-banner{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}</style></head><body><div class="pdf-banner" style="max-width:800px;margin:0 auto 0;">' + pdfBanner + '</div><div class="invoice"><div class="header"><div><div class="shop-name">रख<span>रखाव</span></div><div style="font-size:11px;color:#059669;font-weight:600;background:#ecfdf5;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px">Business Manager</div>' + (shop.address ? '<div style="font-size:11px;color:#374151;margin-top:4px">' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '') + (shop.phone ? '<div style="font-size:11px;color:#374151">📞 ' + shop.phone + (shop.email ? ' | ✉️ ' + shop.email : '') + '</div>' : '') + '</div><div class="logo-circle">र</div></div><div class="title-bar">TAX INVOICE / कर चालान</div><div class="gstin-row"><div class="gstin-cell">GSTIN: ' + (shop.gstin || 'N/A') + '</div><div style="flex:1;text-align:center;padding:5px;font-size:11px"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + payBg + ';color:' + payColor + '">' + payLabel + '</span></div><div style="padding:5px 10px;font-size:10px;font-weight:700;color:#059669;border-left:1px solid #000">ORIGINAL FOR RECIPIENT</div></div><div class="parties"><div class="party-box"><div class="party-label">विक्रेता / Seller</div><div class="party-name">' + (shop.name || 'रखरखाव') + '</div>' + (shop.address ? '<div class="party-detail">📍 ' + shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : '') + (shop.pincode ? ' - ' + shop.pincode : '') + '</div>' : '') + (shop.phone ? '<div class="party-detail">📞 ' + shop.phone + '</div>' : '') + (shop.gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + shop.gstin + '</div>' : '') + '</div><div class="party-box"><div class="party-label">खरीदार / Buyer</div><div class="party-name">' + (sale.buyer_name || 'Walk-in Customer') + '</div>' + (sale.buyer_address ? '<div class="party-detail">📍 ' + sale.buyer_address + '</div>' : '') + (sale.buyer_state ? '<div class="party-detail">State: ' + sale.buyer_state + '</div>' : '') + (sale.buyer_gstin ? '<div class="party-detail" style="font-weight:700">GSTIN: ' + sale.buyer_gstin + '</div>' : '') + (sale.buyer_phone ? '<div class="party-detail">📞 ' + sale.buyer_phone + '</div>' : '') + '</div></div><div class="inv-details"><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Invoice No.</div><div style="font-weight:700;color:#059669">' + sale.invoice_number + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Date</div><div style="font-weight:700">' + saleDate + '</div></div><div class="inv-detail-box"><div style="font-size:10px;color:#9ca3af">Type</div><div style="font-weight:700">' + (sale.invoice_type || 'B2C') + ' | ' + (isIGST ? 'IGST' : 'CGST+SGST') + '</div></div></div><table><thead><tr><th style="width:28px">Sr.</th><th style="text-align:left">Product</th><th>HSN</th><th>Qty</th><th>Rate ₹</th><th>Taxable ₹</th>' + gstCols + '<th>Total ₹</th></tr></thead><tbody>' + itemRows + fillerRows + '</tbody><tfoot><tr style="background:#f3f4f6;font-weight:700"><td colspan="5" style="text-align:right">कुल / Total</td><td>₹' + fmt(sale.taxable_amount) + '</td>' + footerGST + '<td><strong>₹' + fmt(sale.total_amount) + '</strong></td></tr></tfoot></table><div class="totals-section"><div class="words-box"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Amount in Words</div><div style="font-size:11px;font-weight:600;color:#0B1D35;font-style:italic">' + numberToWords(parseFloat(sale.total_amount)) + '</div>' + creditNote + '</div><div class="amounts-box"><div class="amount-row"><span>Taxable Amount</span><span>₹' + fmt(sale.taxable_amount) + '</span></div>' + amountGSTRows + '<div class="amount-row"><span>Total GST</span><span>₹' + fmt(sale.total_gst) + '</span></div><div class="amount-total"><span>GRAND TOTAL</span><span>₹' + fmt(sale.total_amount) + '</span></div></div></div><div class="footer-section"><div class="bank-box">' + bankHTML + '</div><div class="sign-box"><div style="font-size:12px;font-weight:700;margin-bottom:40px">For <strong>' + (shop.name || 'रखरखाव') + '</strong></div><div style="border-top:1px solid #000;padding-top:4px;font-size:11px;font-weight:700">Authorised Signatory</div><div style="font-size:10px;color:#9ca3af;margin-top:6px">Computer generated invoice<br/>No signature required.</div></div></div>' + termsHTML + '<div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:8px;font-style:italic">~ Rakhaav Business Manager ~</div></div>' + (autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : '') + '</body></html>';
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
