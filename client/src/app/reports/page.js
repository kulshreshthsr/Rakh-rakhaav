'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const fmtN     = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const getRange = (filter) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') return { from: today.toISOString(), to: new Date(today.getTime() + 86400000 - 1).toISOString(), label: 'Today' };
  if (filter === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Week' }; }
  if (filter === 'month') { const start = new Date(now.getFullYear(), now.getMonth(), 1); return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Month' }; }
  return { from: null, to: null, label: 'All Time' };
};

export default function ReportsPage() {
  const router = useRouter();
  const [filter,  setFilter]  = useState('month');
  const [loading, setLoading] = useState(false);
  const [sales,     setSales]     = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary,   setSummary]   = useState({});

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [filter]);

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params  = from ? `?from=${from}&to=${to}` : '';
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        fetch(`${API}/api/sales${params}`,     { headers }),
        fetch(`${API}/api/purchases${params}`, { headers }),
        fetch(`${API}/api/customers`,          { headers }),
      ]);
      const sData = await sRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      const salesList     = sData.sales     || (Array.isArray(sData) ? sData : []);
      const purchasesList = pData.purchases || (Array.isArray(pData) ? pData : []);
      const customersList = Array.isArray(cData) ? cData : [];
      setSales(salesList); setPurchases(purchasesList); setCustomers(customersList);
      const totalRevenue  = salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST      = salesList.reduce((s, x) => s + (x.total_gst    || 0), 0);
      const grossProfit   = salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC      = purchasesList.reduce((s, x) => s + (x.total_gst    || 0), 0);
      const totalUdhaar   = customersList.reduce((s, c) => s + (c.totalUdhaar  || 0), 0);
      const taxableRev    = totalRevenue - totalGST;
      const margin        = taxableRev > 0 ? ((grossProfit / taxableRev) * 100) : 0;
      setSummary({ totalRevenue, totalGST, grossProfit, totalPurchase, totalITC, totalUdhaar, margin, salesCount: salesList.length, netGST: totalGST - totalITC });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const topProducts = (() => {
    const map = {};
    sales.forEach(sale => {
      const items = sale.items?.length > 0 ? sale.items : [{ product_name: sale.product_name, quantity: sale.quantity || 0, total_amount: sale.total_amount || 0, gross_profit: sale.gross_profit || 0 }];
      items.forEach(item => {
        const k = item.product_name; if (!k) return;
        if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, profit: 0, count: 0 };
        map[k].qty += item.quantity || 0; map[k].revenue += item.total_amount || 0;
        map[k].profit += item.gross_profit || 0; map[k].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const topCustomers = (() => {
    const map = {};
    sales.forEach(sale => {
      if (!sale.buyer_name || sale.buyer_name === 'Walk-in Customer') return;
      const k = sale.buyer_name;
      if (!map[k]) map[k] = { name: k, phone: sale.buyer_phone || '', revenue: 0, count: 0, udhaar: 0 };
      map[k].revenue += sale.total_amount || 0; map[k].count += 1;
    });
    customers.forEach(c => { if (map[c.name]) map[c.name].udhaar = c.totalUdhaar || 0; });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const dailySales = (() => {
    const map = {};
    sales.forEach(sale => {
      const d = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN');
      if (!map[d]) map[d] = { date: d, revenue: 0, profit: 0, count: 0 };
      map[d].revenue += sale.total_amount || 0; map[d].profit += sale.gross_profit || 0; map[d].count += 1;
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  })();

  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = [], filename = '';
    if (type === 'sales') {
      rows = [
        [`Sales Report — ${label}`],
        ['Invoice No','Date','Product','Buyer','Taxable','GST','Total','Profit','Payment'],
        ...sales.map(s => [s.invoice_number, new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN'), s.items?.length > 1 ? `${s.items.length} items` : s.product_name, s.buyer_name || 'Walk-in', fmt(s.taxable_amount), fmt(s.total_gst), fmt(s.total_amount), fmt(s.gross_profit), s.payment_type]),
        [], ['Total','','','', fmt((summary.totalRevenue||0)-(summary.totalGST||0)), fmt(summary.totalGST), fmt(summary.totalRevenue), fmt(summary.grossProfit)],
      ]; filename = `Sales_Report_${label.replace(' ','_')}.csv`;
    }
    if (type === 'profit') {
      rows = [
        [`Profit Report — ${label}`], ['Metric','Amount'],
        ['Total Revenue', `₹${fmt(summary.totalRevenue)}`],
        ['Total GST Collected', `₹${fmt(summary.totalGST)}`],
        ['Net Revenue (Taxable)', `₹${fmt((summary.totalRevenue||0)-(summary.totalGST||0))}`],
        ['Profit', `₹${fmt(summary.grossProfit)}`],
        ['Profit Margin', `${fmt(summary.margin)}%`],
        ['Total Purchases', `₹${fmt(summary.totalPurchase)}`],
        ['GST Input Credit (ITC)', `₹${fmt(summary.totalITC)}`],
        ['Net GST Payable', `₹${fmt(summary.netGST)}`], [],
        ['Daily Breakdown'], ['Date','Revenue','Profit','Orders'],
        ...dailySales.map(d => [d.date, fmt(d.revenue), fmt(d.profit), d.count]),
      ]; filename = `Profit_Report_${label.replace(' ','_')}.csv`;
    }
    if (type === 'products') {
      rows = [
        [`Top Products — ${label}`], ['Product','Units Sold','Revenue','Profit','Orders'],
        ...topProducts.map(p => [p.name, p.qty, fmt(p.revenue), fmt(p.profit), p.count]),
      ]; filename = `Top_Products_${label.replace(' ','_')}.csv`;
    }
    if (type === 'customers') {
      rows = [
        [`Top Customers — ${label}`], ['Customer','Phone','Orders','Total Spent','Udhaar Pending'],
        ...topCustomers.map(c => [c.name, c.phone, c.count, fmt(c.revenue), fmt(c.udhaar)]),
      ]; filename = `Top_Customers_${label.replace(' ','_')}.csv`;
    }
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const { label }   = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#059669' : summary.margin >= 10 ? '#D97706' : '#EF4444';

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>रिपोर्ट / Reports</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>{label} का डेटा</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { val: 'today', label: 'आज' },
            { val: 'week',  label: 'हफ्ते' },
            { val: 'month', label: 'महीना' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)} style={{
              padding: '9px 18px', borderRadius: 10, border: '1.5px solid',
              borderColor: filter === f.val ? '#4F46E5' : 'var(--border)',
              background: filter === f.val ? '#4F46E5' : 'var(--surface)',
              color: filter === f.val ? '#fff' : 'var(--text-2)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--text-4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#4F46E5', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          रिपोर्ट लोड हो रही है...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <>
          {/* ── SUMMARY CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12, marginBottom: 22 }}>
            {[
              { label: '💰 Revenue',     value: `₹${fmtN(summary.totalRevenue)}`,  sub: `${summary.salesCount} invoices`,      color: '#059669', bg: '#F0FDF4',  border: '#BBF7D0' },
              { label: '📊 मुनाफ़ा',     value: `₹${fmtN(summary.grossProfit)}`,   sub: `Margin: ${fmt(summary.margin)}%`,     color: marginColor, bg: 'var(--surface-2)', border: 'var(--border)' },
              { label: '🧾 GST Payable', value: `₹${fmtN(summary.netGST)}`,        sub: `Collected ₹${fmtN(summary.totalGST)}`, color: '#D97706', bg: '#FFFBEB',  border: '#FDE68A' },
              { label: '📒 Udhaar',      value: `₹${fmtN(summary.totalUdhaar)}`,   sub: 'Total pending',                        color: '#EF4444', bg: '#FEF2F2',  border: '#FECACA' },
              { label: '🛒 Purchases',   value: `₹${fmtN(summary.totalPurchase)}`, sub: `ITC: ₹${fmtN(summary.totalITC)}`,     color: '#4F46E5', bg: '#EEF2FF',  border: '#C7D2FE' },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, borderRadius: 'var(--radius)', padding: '16px 18px', border: `1.5px solid ${card.border}`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.color, borderRadius: '14px 14px 0 0', opacity: 0.7 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: card.color, letterSpacing: -0.5, lineHeight: 1.1 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── PROFIT BREAKDOWN ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>📊 मुनाफ़ा विवरण / Profit Breakdown</div>
              <button onClick={() => exportCSV('profit')} style={{ padding: '8px 16px', background: 'var(--emerald-dim)', color: '#047857', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📥 CSV Download</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'कुल बिक्री / Total Revenue', value: summary.totalRevenue, color: '#059669', prefix: '' },
                { label: 'GST वसूला / GST Collected', value: summary.totalGST, color: '#4F46E5', prefix: '−', sub: 'सरकार का हिस्सा / not your income' },
                { label: 'Taxable Revenue (बिक्री − GST)', value: (summary.totalRevenue || 0) - (summary.totalGST || 0), color: 'var(--text-2)', prefix: '=' },
                { label: 'मुनाफ़ा / Profit', value: summary.grossProfit, color: marginColor, prefix: '=', bold: true },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                  background: row.bold ? (summary.grossProfit >= 0 ? '#F0FDF4' : '#FEF2F2') : 'var(--surface-2)',
                  border: row.bold ? `1.5px solid ${marginColor}44` : '1px solid var(--border-2)',
                }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: row.bold ? 700 : 500, color: 'var(--text-2)' }}>
                      {row.prefix && <span style={{ color: row.color, marginRight: 7, fontWeight: 800 }}>{row.prefix}</span>}
                      {row.label}
                    </div>
                    {row.sub && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{row.sub}</div>}
                  </div>
                  <div style={{ fontSize: row.bold ? 19 : 15, fontWeight: row.bold ? 900 : 700, color: row.color }}>
                    ₹{fmtN(row.value)}
                  </div>
                </div>
              ))}
            </div>
            {(summary.totalRevenue || 0) > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-4)', marginBottom: 6, fontWeight: 600 }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Profit Margin</span>
                  <span style={{ fontWeight: 800, color: marginColor, fontSize: 13 }}>{fmt(summary.margin)}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.abs(summary.margin || 0))}%`, background: `linear-gradient(90deg, ${marginColor}, ${marginColor}88)`, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )}
          </div>

          {/* ── DAILY SALES ── */}
          {dailySales.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>📅 Daily Sales</div>
                <button onClick={() => exportCSV('sales')} style={{ padding: '8px 16px', background: 'var(--primary-dim)', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📥 Sales CSV</button>
              </div>
              <div className="table-container" style={{ boxShadow: 'none', border: '1px solid var(--border-2)' }}>
                <table>
                  <thead><tr>
                    <th style={{ textAlign: 'left' }}>तारीख / Date</th>
                    <th>Orders</th><th>Revenue</th><th>Profit</th><th>Margin</th>
                  </tr></thead>
                  <tbody>
                    {dailySales.map((d, i) => {
                      const m = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{d.date}</td>
                          <td style={{ textAlign: 'center' }}><span style={{ background: 'var(--surface-3)', padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{d.count}</span></td>
                          <td style={{ fontWeight: 800, color: '#059669', textAlign: 'right' }}>₹{fmtN(d.revenue)}</td>
                          <td style={{ fontWeight: 700, color: d.profit >= 0 ? '#4F46E5' : '#EF4444', textAlign: 'right' }}>₹{fmtN(d.profit)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ background: m >= 20 ? '#DCFCE7' : m >= 10 ? '#FEF9C3' : '#FEE2E2', color: m >= 20 ? '#15803D' : m >= 10 ? '#854D0E' : '#991B1B', padding: '2px 9px', borderRadius: 100, fontSize: 11.5, fontWeight: 700 }}>{m.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TOP PRODUCTS + CUSTOMERS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>🏆 Top Products</div>
                <button onClick={() => exportCSV('products')} style={{ padding: '6px 12px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📥 CSV</button>
              </div>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24, fontSize: 13 }}>कोई data नहीं</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topProducts.map((p, i) => {
                    const colors = ['#059669','#4F46E5','#D97706','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899','#14B8A6'];
                    const maxRev = topProducts[0]?.revenue || 1;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: colors[i] || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(p.revenue/maxRev)*100}%`, background: colors[i], borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{p.qty} units · {p.count} orders</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>₹{fmtN(p.revenue)}</div>
                          <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600 }}>₹{fmtN(p.profit)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>👥 Top Customers</div>
                <button onClick={() => exportCSV('customers')} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📥 CSV</button>
              </div>
              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24, fontSize: 13 }}>कोई data नहीं</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCustomers.map((c, i) => {
                    const colors = ['#EF4444','#F59E0B','#059669','#4F46E5','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899','#14B8A6'];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: colors[i] || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{c.count} orders{c.phone ? ` · ${c.phone}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>₹{fmtN(c.revenue)}</div>
                          {c.udhaar > 0 && <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>₹{fmtN(c.udhaar)} due</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {sales.length === 0 && purchases.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-2)', marginBottom: 4 }}>कोई data नहीं</div>
              <div style={{ fontSize: 13 }}>{label} mein koi sales ya purchases nahi hain</div>
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 640px) { .grid-reports { grid-template-columns: 1fr !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}