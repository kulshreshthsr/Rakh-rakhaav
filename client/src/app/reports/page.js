// ============================================================
// REPORTS PAGE — client/src/app/reports/page.js
// ============================================================
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
  if (filter === 'today') return { from: today.toISOString(), to: new Date(today.getTime() + 86400000 - 1).toISOString(), label: 'Today' };
  if (filter === 'week') { const start = new Date(today); start.setDate(today.getDate() - today.getDay()); return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Week' }; }
  if (filter === 'month') { const start = new Date(now.getFullYear(), now.getMonth(), 1); return { from: start.toISOString(), to: new Date().toISOString(), label: 'This Month' }; }
  return { from: null, to: null, label: 'All Time' };
};

export default function ReportsPage() {
  const router = useRouter();
  const [filter, setFilter]   = useState('month');
  const [loading, setLoading] = useState(false);
  const [sales, setSales]         = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary]     = useState({});

  useEffect(() => { if (!localStorage.getItem('token')) { router.push('/login'); return; } fetchAll(); }, [filter]);

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params = from ? `?from=${from}&to=${to}` : '';
    try {
      const [sRes, pRes, cRes] = await Promise.all([fetch(`${API}/api/sales${params}`, { headers }), fetch(`${API}/api/purchases${params}`, { headers }), fetch(`${API}/api/customers`, { headers })]);
      const sData = await sRes.json(); const pData = await pRes.json(); const cData = await cRes.json();
      const salesList = sData.sales || (Array.isArray(sData) ? sData : []);
      const purchasesList = pData.purchases || (Array.isArray(pData) ? pData : []);
      const customersList = Array.isArray(cData) ? cData : [];
      setSales(salesList); setPurchases(purchasesList); setCustomers(customersList);
      const totalRevenue = salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST = salesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const grossProfit = salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC = purchasesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const totalUdhaar = customersList.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
      const taxableRev = totalRevenue - totalGST;
      const margin = taxableRev > 0 ? ((grossProfit / taxableRev) * 100) : 0;
      setSummary({ totalRevenue, totalGST, grossProfit, totalPurchase, totalITC, totalUdhaar, margin, salesCount: salesList.length, netGST: totalGST - totalITC });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const topProducts = (() => {
    const map = {};
    sales.forEach(sale => {
      const items = sale.items?.length > 0 ? sale.items : [{ product_name: sale.product_name, quantity: sale.quantity || 0, total_amount: sale.total_amount || 0, gross_profit: sale.gross_profit || 0 }];
      items.forEach(item => { const k = item.product_name; if (!k) return; if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, profit: 0, count: 0 }; map[k].qty += item.quantity || 0; map[k].revenue += item.total_amount || 0; map[k].profit += item.gross_profit || 0; map[k].count += 1; });
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
    sales.forEach(sale => { const d = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN'); if (!map[d]) map[d] = { date: d, revenue: 0, profit: 0, count: 0 }; map[d].revenue += sale.total_amount || 0; map[d].profit += sale.gross_profit || 0; map[d].count += 1; });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  })();

  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = [], filename = '';
    if (type === 'sales') { rows = [['Sales Report — ' + label], ['Invoice No', 'Date', 'Product', 'Buyer', 'Taxable', 'GST', 'Total', 'Profit', 'Payment'], ...sales.map(s => [s.invoice_number, new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN'), s.items?.length > 1 ? s.items.length + ' items' : s.product_name, s.buyer_name || 'Walk-in', fmt(s.taxable_amount), fmt(s.total_gst), fmt(s.total_amount), fmt(s.gross_profit), s.payment_type]), [], ['Total', '', '', '', fmt((summary.totalRevenue || 0) - (summary.totalGST || 0)), fmt(summary.totalGST), fmt(summary.totalRevenue), fmt(summary.grossProfit)]]; filename = `Sales_Report_${label.replace(' ', '_')}.csv`; }
    if (type === 'profit') { rows = [['Profit Report — ' + label], ['Metric', 'Amount'], ['Total Revenue', '₹' + fmt(summary.totalRevenue)], ['Total GST', '₹' + fmt(summary.totalGST)], ['Profit', '₹' + fmt(summary.grossProfit)], ['Margin', fmt(summary.margin) + '%'], [], ['Daily Breakdown'], ['Date', 'Revenue', 'Profit', 'Orders'], ...dailySales.map(d => [d.date, fmt(d.revenue), fmt(d.profit), d.count])]; filename = `Profit_Report_${label.replace(' ', '_')}.csv`; }
    if (type === 'products') { rows = [['Top Products — ' + label], ['Product', 'Units Sold', 'Revenue', 'Profit', 'Orders'], ...topProducts.map(p => [p.name, p.qty, fmt(p.revenue), fmt(p.profit), p.count])]; filename = `Top_Products_${label.replace(' ', '_')}.csv`; }
    if (type === 'customers') { rows = [['Top Customers — ' + label], ['Customer', 'Phone', 'Orders', 'Total Spent', 'Udhaar Pending'], ...topCustomers.map(c => [c.name, c.phone, c.count, fmt(c.revenue), fmt(c.udhaar)])]; filename = `Top_Customers_${label.replace(' ', '_')}.csv`; }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const { label } = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#059669' : summary.margin >= 10 ? '#D97706' : '#DC2626';
  const colors = ['#059669', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#14B8A6'];

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .filter-btn{transition:all 0.2s;}
        .filter-btn:hover{transform:translateY(-1px);}
        .export-btn{transition:all 0.2s;}
        .export-btn:hover{transform:translateY(-1px);filter:brightness(0.95);}
        @media(max-width:640px){.rep-grid{grid-template-columns:1fr!important;}}
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 4 }}>रिपोर्ट / Reports 📊</div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>{label} का data</div>
        </div>
        <div style={{ background: '#F1F5F9', borderRadius: 12, padding: 4, display: 'flex', gap: 4 }}>
          {[{ val: 'today', label: 'Today' }, { val: 'week', label: 'Week' }, { val: 'month', label: 'Month' }].map(f => (
            <button key={f.val} className="filter-btn" onClick={() => setFilter(f.val)}
              style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: filter === f.val ? '#fff' : 'transparent', color: filter === f.val ? '#6366F1' : '#94A3B8', fontSize: 13, fontWeight: filter === f.val ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: filter === f.val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94A3B8', fontSize: 14 }}>रिपोर्ट लोड हो रही है...</div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20, animation: 'fadeUp 0.4s ease both' }}>
            {[
              { label: '💰 Revenue', value: `₹${fmtN(summary.totalRevenue)}`, sub: `${summary.salesCount} invoices`, color: '#059669', bg: '#F0FDF4' },
              { label: '📊 मुनाफ़ा', value: `₹${fmtN(summary.grossProfit)}`, sub: `Margin: ${fmt(summary.margin)}%`, color: marginColor, bg: '#F8FAFC' },
              { label: '🧾 Net GST', value: `₹${fmtN(summary.netGST)}`, sub: `Collected ₹${fmtN(summary.totalGST)}`, color: '#F59E0B', bg: '#FFFBEB' },
              { label: '📒 Udhaar', value: `₹${fmtN(summary.totalUdhaar)}`, sub: 'Total pending', color: '#DC2626', bg: '#FEF2F2' },
              { label: '🛒 Purchases', value: `₹${fmtN(summary.totalPurchase)}`, sub: `ITC: ₹${fmtN(summary.totalITC)}`, color: '#6366F1', bg: '#EEF2FF' },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, borderRadius: 14, padding: '16px', border: `1px solid ${card.color}22`, animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, fontWeight: 800, color: card.color, letterSpacing: -0.5, marginBottom: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Profit Breakdown */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.2s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>📊 Profit Breakdown</div>
              <button className="export-btn" onClick={() => exportCSV('profit')} style={{ padding: '7px 14px', background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>📥 CSV</button>
            </div>
            {[
              { label: 'Total Revenue', value: summary.totalRevenue, color: '#059669', prefix: '' },
              { label: 'GST Collected', value: summary.totalGST, color: '#6366F1', prefix: '−', sub: 'Government ka hissa' },
              { label: 'Taxable Revenue', value: (summary.totalRevenue || 0) - (summary.totalGST || 0), color: '#374151', prefix: '=' },
              { label: 'Profit / मुनाफ़ा', value: summary.grossProfit, color: marginColor, prefix: '=', bold: true },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: row.bold ? (summary.grossProfit >= 0 ? '#F0FDF4' : '#FEF2F2') : '#F8FAFC', border: row.bold ? `1.5px solid ${marginColor}33` : 'none', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: '#374151' }}>{row.prefix && <span style={{ color: row.color, marginRight: 6, fontWeight: 800 }}>{row.prefix}</span>}{row.label}</div>
                  {row.sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{row.sub}</div>}
                </div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: row.bold ? 18 : 15, fontWeight: 800, color: row.color }}>₹{fmtN(row.value)}</div>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 6 }}><span>Profit Margin</span><span style={{ fontWeight: 700, color: marginColor }}>{fmt(summary.margin)}%</span></div>
              <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.abs(summary.margin || 0))}%`, background: `linear-gradient(90deg,${marginColor},${marginColor}88)`, borderRadius: 99, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          </div>

          {/* Daily Sales */}
          {dailySales.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.25s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>📅 Daily Sales</div>
                <button className="export-btn" onClick={() => exportCSV('sales')} style={{ padding: '7px 14px', background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>📥 CSV</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                    {['Date', 'Orders', 'Revenue', 'Profit', 'Margin'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {dailySales.map((d, i) => {
                      const m = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '11px 12px', color: '#475569', fontSize: 12 }}>{d.date}</td>
                          <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600 }}>{d.count}</td>
                          <td style={{ padding: '11px 12px', fontWeight: 700, color: '#059669', fontSize: 14 }}>₹{fmtN(d.revenue)}</td>
                          <td style={{ padding: '11px 12px', fontWeight: 700, color: d.profit >= 0 ? '#6366F1' : '#DC2626', fontSize: 14 }}>₹{fmtN(d.profit)}</td>
                          <td style={{ padding: '11px 12px' }}><span style={{ background: m >= 20 ? '#DCFCE7' : m >= 10 ? '#FEF9C3' : '#FEE2E2', color: m >= 20 ? '#166534' : m >= 10 ? '#854D0E' : '#991B1B', padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{m.toFixed(1)}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products + Customers */}
          <div className="rep-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease 0.3s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>🏆 Top Products</div>
                <button className="export-btn" onClick={() => exportCSV('products')} style={{ padding: '6px 12px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>📥</button>
              </div>
              {topProducts.length === 0 ? <div style={{ textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 }}>कोई data नहीं</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topProducts.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: colors[i] || '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.qty} units · {p.count} orders</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>₹{fmtN(p.revenue)}</div>
                        <div style={{ fontSize: 11, color: '#6366F1' }}>₹{fmtN(p.profit)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease 0.35s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>👥 Top Customers</div>
                <button className="export-btn" onClick={() => exportCSV('customers')} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>📥</button>
              </div>
              {topCustomers.length === 0 ? <div style={{ textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 }}>कोई data नहीं</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topCustomers.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: colors[i] || '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.count} orders{c.phone ? ` · ${c.phone}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>₹{fmtN(c.revenue)}</div>
                        {c.udhaar > 0 && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>₹{fmtN(c.udhaar)} due</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sales.length === 0 && purchases.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '60px 20px', textAlign: 'center', border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#475569', marginBottom: 4 }}>कोई data नहीं</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{label} mein koi sales nahi hain</div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}