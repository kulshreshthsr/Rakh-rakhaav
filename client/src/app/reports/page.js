'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const getRange = (filter) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') {
    return {
      from: today.toISOString(),
      to: new Date(today.getTime() + 86400000 - 1).toISOString(),
      label: 'Today',
    };
  }
  if (filter === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Week' };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Month' };
  }
  return { from: null, to: null, label: 'All Time' };
};

export default function ReportsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('month');
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, [filter]);

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params = from ? `?from=${from}&to=${to}` : '';

    try {
      const [sRes, pRes, cRes] = await Promise.all([
        fetch(`${API}/api/sales${params}`, { headers }),
        fetch(`${API}/api/purchases${params}`, { headers }),
        fetch(`${API}/api/customers`, { headers }),
      ]);

      const sData = await sRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();

      const salesList = sData.sales || (Array.isArray(sData) ? sData : []);
      const purchasesList = pData.purchases || (Array.isArray(pData) ? pData : []);
      const customersList = Array.isArray(cData) ? cData : [];

      setSales(salesList);
      setPurchases(purchasesList);
      setCustomers(customersList);

      const totalRevenue = salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST = salesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const grossProfit = salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC = purchasesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const totalUdhaar = customersList.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
      const taxableRev = totalRevenue - totalGST;
      const margin = taxableRev > 0 ? (grossProfit / taxableRev) * 100 : 0;

      setSummary({
        totalRevenue,
        totalGST,
        grossProfit,
        totalPurchase,
        totalITC,
        totalUdhaar,
        margin,
        salesCount: salesList.length,
        netGST: totalGST - totalITC,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const topProducts = (() => {
    const map = {};
    sales.forEach((sale) => {
      const items =
        sale.items?.length > 0
          ? sale.items
          : [
              {
                product_name: sale.product_name,
                quantity: sale.quantity || 0,
                total_amount: sale.total_amount || 0,
                gross_profit: sale.gross_profit || 0,
              },
            ];

      items.forEach((item) => {
        const k = item.product_name;
        if (!k) return;
        if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, profit: 0, count: 0 };
        map[k].qty += item.quantity || 0;
        map[k].revenue += item.total_amount || 0;
        map[k].profit += item.gross_profit || 0;
        map[k].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const topCustomers = (() => {
    const map = {};
    sales.forEach((sale) => {
      if (!sale.buyer_name || sale.buyer_name === 'Walk-in Customer') return;
      const k = sale.buyer_name;
      if (!map[k]) map[k] = { name: k, phone: sale.buyer_phone || '', revenue: 0, count: 0, udhaar: 0 };
      map[k].revenue += sale.total_amount || 0;
      map[k].count += 1;
    });
    customers.forEach((c) => {
      if (map[c.name]) map[c.name].udhaar = c.totalUdhaar || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const dailySales = (() => {
    const map = {};
    sales.forEach((sale) => {
      const d = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN');
      if (!map[d]) map[d] = { date: d, revenue: 0, profit: 0, count: 0 };
      map[d].revenue += sale.total_amount || 0;
      map[d].profit += sale.gross_profit || 0;
      map[d].count += 1;
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  })();

  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = [];
    let filename = '';

    if (type === 'sales') {
      rows = [
        [`Sales Report — ${label}`],
        ['Invoice No','Date','Product','Buyer','Taxable','GST','Total','Profit','Payment'],
        ...sales.map((s) => [
          s.invoice_number,
          new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN'),
          s.items?.length > 1 ? `${s.items.length} items` : s.product_name,
          s.buyer_name || 'Walk-in',
          fmt(s.taxable_amount),
          fmt(s.total_gst),
          fmt(s.total_amount),
          fmt(s.gross_profit),
          s.payment_type,
        ]),
        [],
        ['Total','','','', fmt((summary.totalRevenue || 0) - (summary.totalGST || 0)), fmt(summary.totalGST), fmt(summary.totalRevenue), fmt(summary.grossProfit)],
      ];
      filename = `Sales_Report_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'profit') {
      rows = [
        [`Profit Report — ${label}`],
        ['Metric','Amount'],
        ['Total Revenue', `₹${fmt(summary.totalRevenue)}`],
        ['Total GST Collected', `₹${fmt(summary.totalGST)}`],
        ['Net Revenue (Taxable)', `₹${fmt((summary.totalRevenue || 0) - (summary.totalGST || 0))}`],
        ['Profit', `₹${fmt(summary.grossProfit)}`],
        ['Profit Margin', `${fmt(summary.margin)}%`],
        ['Total Purchases', `₹${fmt(summary.totalPurchase)}`],
        ['GST Input Credit (ITC)', `₹${fmt(summary.totalITC)}`],
        ['Net GST Payable', `₹${fmt(summary.netGST)}`],
        [],
        ['Daily Breakdown'],
        ['Date','Revenue','Profit','Orders'],
        ...dailySales.map((d) => [d.date, fmt(d.revenue), fmt(d.profit), d.count]),
      ];
      filename = `Profit_Report_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'products') {
      rows = [
        [`Top Products — ${label}`],
        ['Product','Units Sold','Revenue','Profit','Orders'],
        ...topProducts.map((p) => [p.name, p.qty, fmt(p.revenue), fmt(p.profit), p.count]),
      ];
      filename = `Top_Products_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'customers') {
      rows = [
        [`Top Customers — ${label}`],
        ['Customer','Phone','Orders','Total Spent','Udhaar Pending'],
        ...topCustomers.map((c) => [c.name, c.phone, c.count, fmt(c.revenue), fmt(c.udhaar)]),
      ];
      filename = `Top_Customers_${label.replace(' ', '_')}.csv`;
    }

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { label } = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#16A34A' : summary.margin >= 10 ? '#D97706' : '#DC2626';

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
            रिपोर्ट / Reports
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 680 }}>
            Revenue, profit, GST impact, top products, and customer performance in a premium business intelligence view.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { val: 'today', label: 'आज' },
            { val: 'week', label: 'हफ्ते' },
            { val: 'month', label: 'महीना' },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => setFilter(f.val)}
              style={{
                padding: '10px 18px',
                borderRadius: 14,
                border: '1.5px solid',
                borderColor: filter === f.val ? '#4F46E5' : 'var(--border-soft)',
                background: filter === f.val ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)' : '#fff',
                color: filter === f.val ? '#fff' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: filter === f.val ? '0 16px 28px rgba(79,70,229,0.22)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 42%, #4F46E5 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(15,23,42,0.20)',
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
            background: 'radial-gradient(circle, rgba(34,197,94,0.14), transparent 70%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.85fr)',
            gap: 18,
          }}
          className="reports-hero-grid"
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
              <span>📊</span>
              <span>{label} business snapshot</span>
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
              Reports that feel like your control tower
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.82)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              Understand growth, margin, GST pressure, credit exposure, and product/customer trends with decision-ready visibility.
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
              Main KPI
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>₹{fmtN(summary.totalRevenue)}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              Revenue from {summary.salesCount || 0} invoices
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
                  Profit
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>₹{fmtN(summary.grossProfit)}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Margin
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{fmt(summary.margin)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              borderTopColor: '#4F46E5',
              animation: 'spin 0.7s linear infinite',
              marginBottom: 12,
            }}
          />
          रिपोर्ट लोड हो रही है...
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginBottom: 22,
            }}
          >
            {[
              {
                label: 'Revenue',
                value: `₹${fmtN(summary.totalRevenue)}`,
                sub: `${summary.salesCount} invoices`,
                color: '#16A34A',
                bg: '#F0FDF4',
                icon: '💰',
              },
              {
                label: 'Profit',
                value: `₹${fmtN(summary.grossProfit)}`,
                sub: `Margin ${fmt(summary.margin)}%`,
                color: marginColor,
                bg: summary.margin >= 20 ? '#F0FDF4' : summary.margin >= 10 ? '#FFFBEB' : '#FEF2F2',
                icon: '📈',
              },
              {
                label: 'Net GST',
                value: `₹${fmtN(summary.netGST)}`,
                sub: `Collected ₹${fmtN(summary.totalGST)}`,
                color: '#D97706',
                bg: '#FFFBEB',
                icon: '🧾',
              },
              {
                label: 'Udhaar',
                value: `₹${fmtN(summary.totalUdhaar)}`,
                sub: 'Customer pending',
                color: '#DC2626',
                bg: '#FEF2F2',
                icon: '📒',
              },
              {
                label: 'Purchases',
                value: `₹${fmtN(summary.totalPurchase)}`,
                sub: `ITC ₹${fmtN(summary.totalITC)}`,
                color: '#4338CA',
                bg: '#EEF2FF',
                icon: '🛒',
              },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: card.bg,
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
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: card.color, letterSpacing: '-0.04em' }}>
                  {card.value}
                </div>
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-4)' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div
            className="card"
            style={{
              marginBottom: 20,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92))',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Profit Breakdown
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  Clean view of revenue, GST, profit, and purchase pressure
                </div>
              </div>

              <button
                onClick={() => exportCSV('profit')}
                style={{
                  padding: '9px 16px',
                  background: '#ECFDF5',
                  color: '#15803D',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                📥 CSV Download
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'कुल बिक्री / Total Revenue', value: summary.totalRevenue, color: '#16A34A', prefix: '' },
                { label: 'GST वसूला / GST Collected', value: summary.totalGST, color: '#4338CA', prefix: '−', sub: 'सरकार का हिस्सा / not your income' },
                { label: 'Taxable Revenue (बिक्री − GST)', value: (summary.totalRevenue || 0) - (summary.totalGST || 0), color: 'var(--text-2)', prefix: '=' },
                { label: 'मुनाफ़ा / Profit', value: summary.grossProfit, color: marginColor, prefix: '=', bold: true },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '13px 16px',
                    borderRadius: 18,
                    background: row.bold ? (summary.grossProfit >= 0 ? '#F0FDF4' : '#FEF2F2') : 'var(--surface-2)',
                    border: row.bold ? `1px solid ${marginColor}33` : '1px solid var(--border-soft)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: row.bold ? 800 : 600, color: 'var(--text-2)' }}>
                      {row.prefix && (
                        <span style={{ color: row.color, marginRight: 7, fontWeight: 800 }}>
                          {row.prefix}
                        </span>
                      )}
                      {row.label}
                    </div>
                    {row.sub && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                        {row.sub}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: row.bold ? 20 : 15, fontWeight: row.bold ? 900 : 800, color: row.color }}>
                    ₹{fmtN(row.value)}
                  </div>
                </div>
              ))}
            </div>

            {(summary.totalRevenue || 0) > 0 && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--text-4)',
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  <span>Profit Margin</span>
                  <span style={{ fontWeight: 800, color: marginColor }}>{fmt(summary.margin)}%</span>
                </div>
                <div
                  style={{
                    height: 10,
                    background: 'var(--surface-3)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.abs(summary.margin || 0))}%`,
                      background: `linear-gradient(90deg, ${marginColor}, ${marginColor}AA)`,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {dailySales.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    Daily Sales
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                    Revenue, orders, and daily profit movement
                  </div>
                </div>

                <button
                  onClick={() => exportCSV('sales')}
                  style={{
                    padding: '9px 16px',
                    background: '#EEF2FF',
                    color: '#4338CA',
                    border: '1px solid #C7D2FE',
                    borderRadius: 12,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  📥 Sales CSV
                </button>
              </div>

              <div className="table-container" style={{ boxShadow: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>तारीख / Date</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySales.map((d, i) => {
                      const m = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: 'var(--text)' }}>{d.date}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                background: 'var(--surface-3)',
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {d.count}
                            </span>
                          </td>
                          <td style={{ fontWeight: 800, color: '#16A34A', textAlign: 'right' }}>₹{fmtN(d.revenue)}</td>
                          <td style={{ fontWeight: 800, color: d.profit >= 0 ? '#4338CA' : '#DC2626', textAlign: 'right' }}>
                            ₹{fmtN(d.profit)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                background: m >= 20 ? '#DCFCE7' : m >= 10 ? '#FEF3C7' : '#FEE2E2',
                                color: m >= 20 ? '#15803D' : m >= 10 ? '#92400E' : '#991B1B',
                                padding: '4px 9px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 700,
                              }}
                            >
                              {m.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
            className="reports-duo-grid"
          >
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    Top Products
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                    Best-performing products by revenue
                  </div>
                </div>

                <button
                  onClick={() => exportCSV('products')}
                  style={{
                    padding: '8px 12px',
                    background: '#FFF7ED',
                    color: '#C2410C',
                    border: '1px solid #FED7AA',
                    borderRadius: 10,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  📥 CSV
                </button>
              </div>

              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24, fontSize: 13 }}>
                  कोई data नहीं
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topProducts.map((p, i) => {
                    const colors = ['#16A34A','#4338CA','#D97706','#DC2626','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899','#14B8A6'];
                    const maxRev = topProducts[0]?.revenue || 1;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 10,
                            background: colors[i] || '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.name}
                          </div>

                          <div
                            style={{
                              height: 5,
                              background: 'var(--surface-3)',
                              borderRadius: 999,
                              marginTop: 5,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${(p.revenue / maxRev) * 100}%`,
                                background: colors[i],
                                borderRadius: 999,
                              }}
                            />
                          </div>

                          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                            {p.qty} units · {p.count} orders
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16A34A' }}>
                            ₹{fmtN(p.revenue)}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#4338CA', fontWeight: 700, marginTop: 3 }}>
                            ₹{fmtN(p.profit)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    Top Customers
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                    Highest spending customers and dues
                  </div>
                </div>

                <button
                  onClick={() => exportCSV('customers')}
                  style={{
                    padding: '8px 12px',
                    background: '#FEF2F2',
                    color: '#991B1B',
                    border: '1px solid #FECACA',
                    borderRadius: 10,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  📥 CSV
                </button>
              </div>

              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24, fontSize: 13 }}>
                  कोई data नहीं
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCustomers.map((c, i) => {
                    const colors = ['#DC2626','#D97706','#16A34A','#4338CA','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899','#14B8A6'];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            background: colors[i] || '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                            {c.count} orders{c.phone ? ` · ${c.phone}` : ''}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16A34A' }}>
                            ₹{fmtN(c.revenue)}
                          </div>
                          {c.udhaar > 0 && (
                            <div style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 700, marginTop: 3 }}>
                              ₹{fmtN(c.udhaar)} due
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {sales.length === 0 && purchases.length === 0 && (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '72px 24px',
                color: 'var(--text-4)',
              }}
            >
              <div style={{ fontSize: 54, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-2)', marginBottom: 6 }}>
                कोई data नहीं
              </div>
              <div style={{ fontSize: 13.5 }}>{label} में कोई sales या purchases नहीं हैं</div>
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 900px) {
          .reports-hero-grid,
          .reports-duo-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Layout>
  );
}
