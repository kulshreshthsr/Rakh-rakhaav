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
    payment_type: 'cash',
    amount_paid: '',
    supplier_name: '',
    supplier_phone: '',
    supplier_gstin: '',
    supplier_address: '',
    supplier_state: '',
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
    await Promise.all([fetchPurchases(), fetchProducts()]);
    setLoading(false);
  };

  const fetchPurchases = async () => {
    try {
      const res = await fetch(`${API}/api/purchases`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setPurchases(data.purchases || []);
      setSummary(data.summary || {});
    } catch {
      setError('खरीद लोड नहीं हो सकी');
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

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find((p) => p._id === value);
      if (prod) updated[index].price_per_unit = prod.cost_price || prod.price || '';
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const calcRowGST = (item) => {
    const prod = products.find((p) => p._id === item.product_id);
    if (!prod || !item.quantity || !item.price_per_unit) return null;
    const taxable = parseFloat(item.quantity) * parseFloat(item.price_per_unit);
    const gst_rate = prod.gst_rate || 0;
    const gst = (taxable * gst_rate) / 100;
    return { taxable, gst_rate, gst, total: taxable + gst };
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.payment_type === 'credit' && !form.supplier_name) {
      setError('उधार खरीद के लिए supplier का नाम जरूरी है!');
      return;
    }

    const validItems = items.filter((i) => i.product_id && i.quantity && i.price_per_unit);
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setItems([emptyItem()]);
        setForm({
          payment_type: 'cash',
          amount_paid: '',
          supplier_name: '',
          supplier_phone: '',
          supplier_gstin: '',
          supplier_address: '',
          supplier_state: '',
          notes: '',
        });
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
    } catch {
      setError('हटाने में विफल');
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setError('');
    setItems([emptyItem()]);
    setForm({
      payment_type: 'cash',
      amount_paid: '',
      supplier_name: '',
      supplier_phone: '',
      supplier_gstin: '',
      supplier_address: '',
      supplier_state: '',
      notes: '',
    });
  };

  const PayBadge = ({ type }) => {
    const map = {
      cash: { bg: '#ECFDF5', color: '#065F46', label: '💵 Cash' },
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

  const payBtnStyle = (opt, selected) => ({
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

  const totalPurchaseValue = summary.totalPurchaseValue || 0;
  const totalITC = summary.totalITC || 0;
  const totalDue = summary.totalDue || 0;
  const purchaseCount = purchases.length;
  const creditPurchasesCount = purchases.filter((p) => p.payment_type === 'credit').length;
  const latestPurchases = purchases.slice(0, 5);

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
            खरीद / Purchases
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 640 }}>
            Record inward stock, capture supplier GST, manage balances, and keep purchase entries as polished as your billing flow.
          </div>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-warning">
          + खरीद दर्ज करें
        </button>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #7C2D12 0%, #D97706 48%, #0F172A 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(217,119,6,0.20)',
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
            background: 'radial-gradient(circle, rgba(251,191,36,0.20), transparent 70%)',
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
          className="purchase-hero-grid"
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
              <span>Purchase workspace</span>
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
              Smarter inward stock and supplier billing
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              Track purchase value, supplier balances, input tax credit, and stock inflow in one clean, high-trust interface.
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
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>₹{totalPurchaseValue.toFixed(2)}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              Total purchase value across {purchaseCount} bills
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
                  ITC
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>₹{totalITC.toFixed(2)}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Credit bills
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{creditPurchasesCount}</div>
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
              borderTopColor: '#D97706',
              animation: 'spin 0.7s linear infinite',
              marginBottom: 12,
            }}
          />
          लोड हो रहा है...
        </div>
      ) : purchases.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '72px 24px',
            color: 'var(--text-4)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,251,235,0.88))',
          }}
        >
          <div style={{ fontSize: 54, marginBottom: 12 }}>🛒</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-2)', marginBottom: 6 }}>
            अभी कोई खरीद नहीं
          </div>
          <div style={{ fontSize: 13.5, marginBottom: 18 }}>
            पहली purchase दर्ज करें और stock inflow शुरू करें
          </div>
          <button onClick={() => setShowModal(true)} className="btn-warning">
            + पहली खरीद दर्ज करें
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
                label: 'Total Purchases',
                value: `₹${totalPurchaseValue.toFixed(2)}`,
                sub: `${purchaseCount} bills`,
                tone: '#D97706',
                soft: '#FFFBEB',
                icon: '🛒',
              },
              {
                label: 'Input Tax Credit',
                value: `₹${totalITC.toFixed(2)}`,
                sub: 'GST claimable from purchases',
                tone: '#4338CA',
                soft: '#EEF2FF',
                icon: '🧾',
              },
              {
                label: 'Outstanding Due',
                value: `₹${totalDue.toFixed(2)}`,
                sub: 'Supplier balances pending',
                tone: totalDue > 0 ? '#DC2626' : '#16A34A',
                soft: totalDue > 0 ? '#FEF2F2' : '#F0FDF4',
                icon: '📒',
              },
              {
                label: 'Credit Purchases',
                value: `${creditPurchasesCount}`,
                sub: 'Bills with remaining balance',
                tone: '#7C3AED',
                soft: '#F5F3FF',
                icon: '🏦',
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
            className="purchase-main-grid"
          >
            <div className="table-container hidden-xs">
              <table>
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Product / Supplier</th>
                    <th>Items</th>
                    <th>Taxable</th>
                    <th>ITC</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <span
                          style={{
                            color: '#B45309',
                            fontWeight: 800,
                            fontSize: 12,
                            background: '#FFFBEB',
                            padding: '4px 9px',
                            borderRadius: 999,
                          }}
                        >
                          {p.invoice_number}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>
                          {p.items && p.items.length > 1
                            ? p.items.map((i) => i.product_name).join(', ')
                            : p.product_name}
                        </div>
                        {p.supplier_name && (
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>
                            {p.supplier_name}
                          </div>
                        )}
                      </td>

                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                        {p.items && p.items.length > 1 ? `${p.items.length} items` : `${p.quantity || 1} pcs`}
                      </td>

                      <td style={{ fontWeight: 600 }}>₹{(p.taxable_amount || 0).toFixed(2)}</td>

                      <td>
                        {p.total_gst > 0 ? (
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
                            ₹{p.total_gst.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-5)' }}>—</span>
                        )}
                      </td>

                      <td style={{ fontWeight: 800, color: '#D97706', fontSize: 14.5 }}>
                        ₹{(p.total_amount || 0).toFixed(2)}
                      </td>

                      <td style={{ color: '#15803D', fontWeight: 700 }}>
                        ₹{(p.amount_paid || 0).toFixed(2)}
                      </td>

                      <td>
                        {(p.balance_due || 0) > 0 ? (
                          <span style={{ color: '#DC2626', fontWeight: 800 }}>
                            ₹{p.balance_due.toFixed(2)}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#ECFDF5',
                              color: '#15803D',
                              padding: '4px 9px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            Paid
                          </span>
                        )}
                      </td>

                      <td>
                        <PayBadge type={p.payment_type} />
                      </td>

                      <td style={{ color: 'var(--text-4)', fontSize: 12 }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>

                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Recent Purchase Snapshot
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Latest purchase bills and payment status
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {latestPurchases.map((p) => (
                    <div
                      key={p._id}
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
                            {p.invoice_number}
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
                            {p.supplier_name || 'Unknown supplier'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#D97706' }}>
                            ₹{(p.total_amount || 0).toFixed(2)}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <PayBadge type={p.payment_type} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Purchase Flow Tips
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Workflow helpers inside the purchase modal
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { title: 'Auto cost fill', sub: 'Selecting a product prefills cost or fallback price', bg: '#FFF7ED', color: '#C2410C', icon: '⚡' },
                    { title: 'Live ITC preview', sub: 'Taxable, GST, and grand total update instantly', bg: '#EEF2FF', color: '#4338CA', icon: '🧾' },
                    { title: 'Balance due tracking', sub: 'Credit purchases instantly show supplier payable amount', bg: '#FEF2F2', color: '#B91C1C', icon: '📒' },
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
            {purchases.map((p) => (
              <div
                key={p._id}
                className="card"
                style={{
                  borderLeft: `4px solid ${p.payment_type === 'credit' ? '#EF4444' : '#D97706'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>
                      {p.items && p.items.length > 1 ? `${p.items.length} products` : p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#B45309', fontWeight: 800, marginTop: 3 }}>
                      {p.invoice_number}
                    </div>
                    {p.supplier_name && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                        {p.supplier_name}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: '#D97706', fontSize: 18 }}>
                      ₹{(p.total_amount || 0).toFixed(2)}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <PayBadge type={p.payment_type} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Taxable
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 3 }}>
                      ₹{(p.taxable_amount || 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      ITC
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#4338CA', marginTop: 3 }}>
                      ₹{(p.total_gst || 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Paid
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#15803D', marginTop: 3 }}>
                      ₹{(p.amount_paid || 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Due
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: (p.balance_due || 0) > 0 ? '#DC2626' : '#15803D',
                        marginTop: 3,
                      }}
                    >
                      {(p.balance_due || 0) > 0 ? `₹${p.balance_due.toFixed(2)}` : 'Paid'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(p._id)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', width: '100%', maxWidth: 760 }}>
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
                  खरीद दर्ज करें
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  Premium purchase entry with stock inflow and ITC preview
                </div>
              </div>

              <button
                onClick={resetModal}
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
                className="purchase-modal-grid"
              >
                <div>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 20,
                      background: 'linear-gradient(180deg, rgba(255,250,245,0.95), rgba(255,255,255,0.95))',
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
                      Products
                    </div>

                    {items.map((item, index) => {
                      const rowGST = calcRowGST(item);
                      const prod = products.find((p) => p._id === item.product_id);
                      const productCost = prod?.cost_price || prod?.price || 0;

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
                                  background: '#FFF7ED',
                                  color: '#C2410C',
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
                                  Product, quantity, cost, and ITC
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
                              placeholder="उत्पाद खोजें / Search product..."
                            />
                          </div>

                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Quantity *</label>
                              <input
                                className="form-input"
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Purchase Price ₹ *</label>
                              <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                value={item.price_per_unit}
                                onChange={(e) => updateItem(index, 'price_per_unit', e.target.value)}
                                required
                              />
                              {prod && (
                                <div style={{ fontSize: 11.5, marginTop: 6, color: 'var(--text-4)', fontWeight: 600 }}>
                                  Suggested cost: ₹{productCost}
                                </div>
                              )}
                            </div>
                          </div>

                          {rowGST && (
                            <div
                              style={{
                                fontSize: 12.5,
                                color: 'var(--text-3)',
                                background: rowGST.gst_rate > 0 ? '#FFF7ED' : '#F0FDF4',
                                borderRadius: 14,
                                padding: '10px 12px',
                                display: 'flex',
                                gap: 14,
                                flexWrap: 'wrap',
                                border: `1px solid ${rowGST.gst_rate > 0 ? '#FED7AA' : '#BBF7D0'}`,
                              }}
                            >
                              <span>
                                Taxable: <strong>₹{rowGST.taxable.toFixed(2)}</strong>
                              </span>
                              {rowGST.gst_rate > 0 && (
                                <span>
                                  GST {rowGST.gst_rate}%: <strong>₹{rowGST.gst.toFixed(2)}</strong>
                                </span>
                              )}
                              <span>
                                Total: <strong style={{ color: rowGST.gst_rate > 0 ? '#C2410C' : '#15803D' }}>₹{rowGST.total.toFixed(2)}</strong>
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
                        border: '1.5px dashed #F59E0B',
                        borderRadius: 16,
                        color: '#B45309',
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
                      Supplier Details
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Supplier नाम {form.payment_type === 'credit' && <span style={{ color: '#DC2626' }}>*</span>}
                      </label>
                      <input
                        className="form-input"
                        placeholder="Supplier ka naam"
                        value={form.supplier_name}
                        onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                        required={form.payment_type === 'credit'}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                          className="form-input"
                          placeholder="Mobile number"
                          value={form.supplier_phone}
                          onChange={(e) => setForm({ ...form, supplier_phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GSTIN</label>
                        <input
                          className="form-input"
                          placeholder="Supplier GSTIN"
                          value={form.supplier_gstin}
                          onChange={(e) => setForm({ ...form, supplier_gstin: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Supplier State</label>
                        <select
                          className="form-input"
                          value={form.supplier_state}
                          onChange={(e) => setForm({ ...form, supplier_state: e.target.value })}
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
                          placeholder="Supplier address"
                          value={form.supplier_address}
                          onChange={(e) => setForm({ ...form, supplier_address: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">नोट / Notes</label>
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
                        background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFBEB 100%)',
                        border: '1px solid #FED7AA',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#B45309',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 12,
                        }}
                      >
                        Bill Summary
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400E' }}>
                          <span>Taxable Amount</span>
                          <strong>₹{billTotals.taxable.toFixed(2)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4338CA' }}>
                          <span>Total GST (ITC)</span>
                          <strong>₹{billTotals.gst.toFixed(2)}</strong>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: 18,
                            borderTop: '1px solid #FCD34D',
                            paddingTop: 10,
                            marginTop: 4,
                            color: '#9A3412',
                          }}
                        >
                          <span>Grand Total</span>
                          <span>₹{billTotals.total.toFixed(2)}</span>
                        </div>

                        {form.payment_type === 'credit' && amountPaidNum > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginTop: 4,
                              color: '#DC2626',
                              fontWeight: 700,
                            }}
                          >
                            <span>Balance Due</span>
                            <span>₹{balanceDue.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
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
                            style={payBtnStyle(opt, form.payment_type === opt.val)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {form.payment_type === 'credit' && (
                        <div style={{ marginTop: 12 }}>
                          <label className="form-label">Advance Payment (optional)</label>
                          <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`Max ₹${billTotals.total.toFixed(2)}`}
                            value={form.amount_paid}
                            onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                          />
                          <div
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              borderRadius: 14,
                              padding: '11px 12px',
                              marginTop: 10,
                              fontSize: 12.5,
                              color: '#991B1B',
                              fontWeight: 600,
                            }}
                          >
                            ⚠️ बाकी ₹{balanceDue.toFixed(2)} supplier ledger में automatically जाएगा
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="submit"
                        className="btn-warning"
                        style={{ flex: 1 }}
                        disabled={submitting}
                      >
                        {submitting
                          ? 'दर्ज हो रहा है...'
                          : form.payment_type === 'credit'
                          ? '📒 Credit Purchase'
                          : '💵 Purchase दर्ज करें'}
                      </button>

                      <button
                        type="button"
                        onClick={resetModal}
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
          .purchase-hero-grid,
          .purchase-main-grid,
          .purchase-modal-grid {
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
