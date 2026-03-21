'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);
const fmtN     = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

// ── Date range helpers (unchanged) ───────────────────────────────────────────
const getRange = (filter) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return {
      from:  today.toISOString(),
      to:    new Date(today.getTime() + 86400000 - 1).toISOString(),
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
  const [filter,  setFilter]  = useState('month');
  const [loading, setLoading] = useState(false);

  const [sales,     setSales]     = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary,   setSummary]   = useState({});

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers      = { Authorization: `Bearer ${getToken()}` };
    const params       = from ? `?from=${from}&to=${to}` : '';

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

      setSales(salesList);
      setPurchases(purchasesList);
      setCustomers(customersList);

      // UPGRADE 4: totalCOGS removed from summary computation
      // grossProfit from API kept — it represents Selling Price - Cost Price
      const totalRevenue  = salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST      = salesList.reduce((s, x) => s + (x.total_gst    || 0), 0);
      const grossProfit   = salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC      = purchasesList.reduce((s, x) => s + (x.total_gst    || 0), 0);
      const totalUdhaar   = customersList.reduce((s, c) => s + (c.totalUdhaar  || 0), 0);
      const taxableRev    = totalRevenue - totalGST;
      const margin        = taxableRev > 0 ? ((grossProfit / taxableRev) * 100) : 0;

      setSummary({
        totalRevenue, totalGST, grossProfit,
        totalPurchase, totalITC, totalUdhaar, margin,
        salesCount: salesList.length,
        netGST:     totalGST - totalITC,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [filter, router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // ── Top Products (unchanged) ─────────────────────────────────────────────────
  const topProducts = (() => {
    const map = {};
    sales.forEach(sale => {
      const items = sale.items?.length > 0 ? sale.items : [{
        product_name: sale.product_name,
        quantity:     sale.quantity     || 0,
        total_amount: sale.total_amount || 0,
        gross_profit: sale.gross_profit || 0,
      }];
      items.forEach(item => {
        const k = item.product_name;
        if (!k) return;
        if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, profit: 0, count: 0 };
        map[k].qty     += item.quantity     || 0;
        map[k].revenue += item.total_amount || 0;
        map[k].profit  += item.gross_profit || 0;
        map[k].count   += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  // ── Top Customers (unchanged) ────────────────────────────────────────────────
  const topCustomers = (() => {
    const map = {};
    sales.forEach(sale => {
      if (!sale.buyer_name || sale.buyer_name === 'Walk-in Customer') return;
      const k = sale.buyer_name;
      if (!map[k]) map[k] = { name: k, phone: sale.buyer_phone || '', revenue: 0, count: 0, udhaar: 0 };
      map[k].revenue += sale.total_amount || 0;
      map[k].count   += 1;
    });
    customers.forEach(c => {
      if (map[c.name]) map[c.name].udhaar = c.totalUdhaar || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  // ── Daily sales breakdown (unchanged) ────────────────────────────────────────
  const dailySales = (() => {
    const map = {};
    sales.forEach(sale => {
      const d = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN');
      if (!map[d]) map[d] = { date: d, revenue: 0, profit: 0, count: 0 };
      map[d].revenue += sale.total_amount || 0;
      map[d].profit  += sale.gross_profit || 0;
      map[d].count   += 1;
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  })();

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = [], filename = '';

    if (type === 'sales') {
      rows = [
        [`Sales Report — ${label}`],
        ['Invoice No', 'Date', 'Product', 'Buyer', 'Taxable', 'GST', 'Total', 'Profit', 'Payment'],
        ...sales.map(s => [
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
        ['Total', '', '', '',
          fmt((summary.totalRevenue || 0) - (summary.totalGST || 0)),
          fmt(summary.totalGST),
          fmt(summary.totalRevenue),
          fmt(summary.grossProfit),
        ],
      ];
      filename = `Sales_Report_${label.replace(' ', '_')}.csv`;
    }

    // UPGRADE 4: COGS row removed from profit CSV. Profit = Revenue - GST - Profit (from API)
    if (type === 'profit') {
      rows = [
        [`Profit Report — ${label}`],
        ['Metric', 'Amount'],
        ['Total Revenue',           `₹${fmt(summary.totalRevenue)}`],
        ['Total GST Collected',     `₹${fmt(summary.totalGST)}`],
        ['Net Revenue (Taxable)',   `₹${fmt((summary.totalRevenue || 0) - (summary.totalGST || 0))}`],
        ['Profit',                  `₹${fmt(summary.grossProfit)}`],
        ['Profit Margin',           `${fmt(summary.margin)}%`],
        ['Total Purchases',         `₹${fmt(summary.totalPurchase)}`],
        ['GST Input Credit (ITC)',  `₹${fmt(summary.totalITC)}`],
        ['Net GST Payable',         `₹${fmt(summary.netGST)}`],
        [],
        ['Daily Breakdown'],
        ['Date', 'Revenue', 'Profit', 'Orders'],
        ...dailySales.map(d => [d.date, fmt(d.revenue), fmt(d.profit), d.count]),
      ];
      filename = `Profit_Report_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'products') {
      rows = [
        [`Top Products — ${label}`],
        ['Product', 'Units Sold', 'Revenue', 'Profit', 'Orders'],
        ...topProducts.map(p => [p.name, p.qty, fmt(p.revenue), fmt(p.profit), p.count]),
      ];
      filename = `Top_Products_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'customers') {
      rows = [
        [`Top Customers — ${label}`],
        ['Customer', 'Phone', 'Orders', 'Total Spent', 'Udhaar Pending'],
        ...topCustomers.map(c => [c.name, c.phone, c.count, fmt(c.revenue), fmt(c.udhaar)]),
      ];
      filename = `Top_Customers_${label.replace(' ', '_')}.csv`;
    }

    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const { label }   = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#059669' : summary.margin >= 10 ? '#d97706' : '#ef4444';

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="page-title" style={{ marginBottom: 4, color: '#fff' }}>रिपोर्ट / Reports</div>
              <div className="kicker" style={{ marginBottom: 10 }}>Business analytics</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', maxWidth: 420 }}>
                Revenue, profit, GST and customer trends for {label.toLowerCase()} in one clean view.
              </div>
            </div>
            <div className="filter-pills">
          {[
            { val: 'today', label: 'आज / Today'        },
            { val: 'week',  label: 'इस हफ्ते / Week'   },
            { val: 'month', label: 'इस महीने / Month'  },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setFilter(f.val)}
              className={`filter-pill${filter === f.val ? ' is-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
            </div>
          </div>
        </section>

        {!loading && (
          <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div className="metric-card" style={{ cursor: 'default' }}>
              <div className="metric-label">Revenue</div>
              <div className="metric-value" style={{ color: '#10b981' }}>₹{fmtN(summary.totalRevenue)}</div>
              <div className="metric-note">{summary.salesCount || 0} invoices</div>
            </div>
            <div className="metric-card" style={{ cursor: 'default' }}>
              <div className="metric-label">Profit</div>
              <div className="metric-value" style={{ color: marginColor }}>₹{fmtN(summary.grossProfit)}</div>
              <div className="metric-note">Margin {fmt(summary.margin)}%</div>
            </div>
            <div className="metric-card" style={{ cursor: 'default' }}>
              <div className="metric-label">GST Payable</div>
              <div className="metric-value" style={{ color: '#f59e0b' }}>₹{fmtN(summary.netGST)}</div>
              <div className="metric-note">ITC ₹{fmtN(summary.totalITC)}</div>
            </div>
            <div className="metric-card" style={{ cursor: 'default' }}>
              <div className="metric-label">Udhaar</div>
              <div className="metric-value" style={{ color: '#ef4444' }}>₹{fmtN(summary.totalUdhaar)}</div>
              <div className="metric-note">Pending collection</div>
            </div>
          </section>
        )}

      {loading ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>रिपोर्ट लोड हो रही है...</div>
        </div>
      ) : (
        <>
          {/* ── SUMMARY CARDS ── */}
          {/* UPGRADE 4: COGS card removed. Gross Profit → renamed to Profit */}
          <div className="mini-stat-grid" style={{ marginBottom: 24 }}>
            {[
              { label: '💰 Revenue',      value: `₹${fmtN(summary.totalRevenue)}`,  sub: `${summary.salesCount} invoices`,      color: '#10b981', bg: '#f0fdf4' },
              { label: '📊 मुनाफ़ा',      value: `₹${fmtN(summary.grossProfit)}`,   sub: `Margin: ${fmt(summary.margin)}%`,     color: marginColor, bg: '#f8fafc' },
              { label: '🧾 GST Payable',  value: `₹${fmtN(summary.netGST)}`,        sub: `Collected ₹${fmtN(summary.totalGST)}`, color: '#f59e0b', bg: '#fffbeb' },
              { label: '📒 Udhaar',       value: `₹${fmtN(summary.totalUdhaar)}`,   sub: 'Total pending',                        color: '#ef4444', bg: '#fef2f2' },
              { label: '🛒 Purchases',    value: `₹${fmtN(summary.totalPurchase)}`, sub: `ITC: ₹${fmtN(summary.totalITC)}`,     color: '#6366f1', bg: '#eef2ff' },
            ].map((card, i) => (
              <div key={i} className="mini-stat">
                <div className="mini-stat-label">{card.label}</div>
                <div className="mini-stat-value" style={{ color: card.color }}>{card.value}</div>
                <div className="mini-stat-note">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── PROFIT BREAKDOWN ── */}
          {/* UPGRADE 4: COGS row removed. Layout: Revenue → −GST → =Taxable → =Profit */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>📊 मुनाफ़ा विवरण / Profit Breakdown</div>
              <button onClick={() => exportCSV('profit')} className="panel-action"
              >
                📥 CSV Download
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  label: 'कुल बिक्री / Total Revenue',
                  value: summary.totalRevenue,
                  color: '#10b981', prefix: '',
                },
                {
                  label: 'GST वसूला / GST Collected',
                  value: summary.totalGST,
                  color: '#6366f1', prefix: '−',
                  sub: 'सरकार का हिस्सा / not your income',
                },
                {
                  label: 'Taxable Revenue (बिक्री − GST)',
                  value: (summary.totalRevenue || 0) - (summary.totalGST || 0),
                  color: '#374151', prefix: '=',
                },
                {
                  label: 'मुनाफ़ा / Profit',
                  value: summary.grossProfit,
                  color: marginColor, prefix: '=', bold: true,
                },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 10,
                  background: row.bold
                    ? (summary.grossProfit >= 0 ? '#f0fdf4' : '#fef2f2')
                    : '#f9fafb',
                  border: row.bold ? `1.5px solid ${marginColor}33` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: '#374151' }}>
                      {row.prefix && (
                        <span style={{ color: row.color, marginRight: 6, fontWeight: 800 }}>{row.prefix}</span>
                      )}
                      {row.label}
                    </div>
                    {row.sub && <div style={{ fontSize: 11, color: '#9ca3af' }}>{row.sub}</div>}
                  </div>
                  <div style={{ fontSize: row.bold ? 18 : 15, fontWeight: row.bold ? 800 : 600, color: row.color }}>
                    ₹{fmtN(row.value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Margin bar */}
            {(summary.totalRevenue || 0) > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                  <span>Profit Margin</span>
                  <span style={{ fontWeight: 700, color: marginColor }}>{fmt(summary.margin)}%</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.abs(summary.margin || 0))}%`,
                    background: `linear-gradient(90deg, ${marginColor}, ${marginColor}aa)`,
                    borderRadius: 99,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* ── DAILY SALES (unchanged) ── */}
          {dailySales.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="panel-head">
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>📅 Daily Sales</div>
                <button onClick={() => exportCSV('sales')}
                  style={{ padding: '7px 14px', background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  📥 Sales CSV
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thS}>तारीख / Date</th>
                      <th style={thS}>Orders</th>
                      <th style={thS}>Revenue</th>
                      <th style={thS}>Profit</th>
                      <th style={thS}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySales.map((d, i) => {
                      const m = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={tdS}>{d.date}</td>
                          <td style={tdS}>{d.count}</td>
                          <td style={{ ...tdS, fontWeight: 700, color: '#10b981' }}>₹{fmtN(d.revenue)}</td>
                          <td style={{ ...tdS, fontWeight: 700, color: d.profit >= 0 ? '#6366f1' : '#ef4444' }}>
                            ₹{fmtN(d.profit)}
                          </td>
                          <td style={tdS}>
                            <span style={{ background: m >= 20 ? '#dcfce7' : m >= 10 ? '#fef9c3' : '#fee2e2', color: m >= 20 ? '#15803d' : m >= 10 ? '#854d0e' : '#991b1b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
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

          {/* ── TOP PRODUCTS + TOP CUSTOMERS (unchanged) ── */}
          <div className="split-grid" style={{ marginBottom: 20 }}>

            {/* Top Products */}
            <div className="card">
              <div className="panel-head">
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>🏆 Top Products</div>
                <button onClick={() => exportCSV('products')} className="panel-action"
                >
                  📥 CSV
                </button>
              </div>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>कोई data नहीं</div>
              ) : (
                <div className="stack-list">
                  {topProducts.map((p, i) => (
                    <div key={i} className="stack-row">
                      <div className="stack-row-rank" style={{
                        background: ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'][i] || '#9ca3af',
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="stack-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.qty} units • {p.count} orders</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{fmtN(p.revenue)}</div>
                        <div style={{ fontSize: 11, color: '#6366f1' }}>₹{fmtN(p.profit)} profit</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Customers */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>👥 Top Customers</div>
                <button onClick={() => exportCSV('customers')} className="panel-action"
                >
                  📥 CSV
                </button>
              </div>
              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>कोई data नहीं</div>
              ) : (
                <div className="stack-list">
                  {topCustomers.map((c, i) => (
                    <div key={i} className="stack-row">
                      <div className="stack-row-rank" style={{
                        background: ['#ef4444','#f59e0b','#10b981','#6366f1','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'][i] || '#9ca3af',
                      }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="stack-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.count} orders{c.phone ? ` • ${c.phone}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{fmtN(c.revenue)}</div>
                        {c.udhaar > 0 && (
                          <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>₹{fmtN(c.udhaar)} due</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {sales.length === 0 && purchases.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>कोई data नहीं / No data</div>
              <div style={{ fontSize: 13 }}>{label} mein koi sales ya purchases nahi hain</div>
            </div>
          )}
        </>
      )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .grid-reports { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Layout>
  );
}

// ── Table style helpers (unchanged) ─────────────────────────────────────────
const thS = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5,
  borderBottom: '1px solid #f3f4f6',
};
const tdS = { padding: '10px 12px', fontSize: 13, color: '#374151' };
