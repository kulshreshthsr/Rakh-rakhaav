'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/AppUI';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const formatShortReportDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
}).format(new Date(value));

const ReportMetricIcon = ({ kind }) => {
  const commonProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (kind === 'revenue') {
    return (
      <svg {...commonProps}>
        <path d="M12 2v20" />
        <path d="M17 6.5c0-1.933-2.239-3.5-5-3.5S7 4.567 7 6.5 9.239 10 12 10s5 1.567 5 3.5S14.761 17 12 17s-5-1.567-5-3.5" />
      </svg>
    );
  }

  if (kind === 'profit') {
    return (
      <svg {...commonProps}>
        <path d="m4 16 5-5 4 4 7-7" />
        <path d="M14 8h6v6" />
      </svg>
    );
  }

  if (kind === 'gst') {
    return (
      <svg {...commonProps}>
        <path d="M8 3.5h5l4 4V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M13 3.5v4h4" />
        <path d="M9.5 12H15" />
        <path d="M9.5 16H14" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
};

function ReportMetricCard({ kind, label, value, note }) {
  return (
    <div className={`reports-metric-card reports-metric-card-${kind}`}>
      <div className="reports-metric-top">
        <div className="reports-metric-label">{label}</div>
        <div className="reports-metric-icon">
          <ReportMetricIcon kind={kind} />
        </div>
      </div>
      <div className="reports-metric-value">{value}</div>
      <div className="reports-metric-note">{note}</div>
    </div>
  );
}

const CompactActionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

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
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), label: 'This Week' };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), label: 'This Month' };
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

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params = from ? `?from=${from}&to=${to}` : '';

    try {
      const [sRes, pRes, cRes, profitRes] = await Promise.all([
        fetch(apiUrl(`/api/sales${params}`), { headers }),
        fetch(apiUrl(`/api/purchases${params}`), { headers }),
        fetch(apiUrl('/api/customers'), { headers }),
        fetch(apiUrl(`/api/sales/profit-summary${params}`), { headers }),
      ]);

      if ([sRes.status, pRes.status, cRes.status, profitRes.status].includes(401)) {
        router.push('/login');
        return;
      }

      const sData = sRes.ok ? await sRes.json() : { sales: [] };
      const pData = pRes.ok ? await pRes.json() : { purchases: [] };
      const cData = cRes.ok ? await cRes.json() : [];
      const profitData = profitRes.ok ? await profitRes.json() : {};

      const salesList = sData.sales || (Array.isArray(sData) ? sData : []);
      const purchasesList = pData.purchases || (Array.isArray(pData) ? pData : []);
      const customersList = Array.isArray(cData) ? cData : [];

      setSales(salesList);
      setPurchases(purchasesList);
      setCustomers(customersList);

      const totalRevenue = profitData.totalRevenue ?? salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST = profitData.gstCollected ?? salesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const grossProfit = profitData.grossProfit ?? salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = profitData.totalSpent ?? purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC = profitData.gstITC ?? purchasesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const totalUdhaar = customersList.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
      const taxableRev = profitData.totalTaxable ?? (totalRevenue - totalGST);
      const margin = taxableRev > 0 ? ((grossProfit / taxableRev) * 100) : 0;

      setSummary({
        totalRevenue,
        totalGST,
        grossProfit,
        totalPurchase,
        totalITC,
        totalUdhaar,
        margin,
        salesCount: profitData.salesCount ?? salesList.length,
        netGST: profitData.netGSTPayable ?? (totalGST - totalITC),
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

  const topProducts = (() => {
    const map = {};
    sales.forEach((sale) => {
      const items = sale.items?.length > 0 ? sale.items : [{
        product_name: sale.product_name,
        quantity: sale.quantity || 0,
        total_amount: sale.total_amount || 0,
        gross_profit: sale.gross_profit || 0,
        taxable_amount: sale.taxable_amount || 0,
        cost_price: sale.cost_price || 0,
      }];
      items.forEach((item) => {
        const key = item.product_name;
        if (!key) return;
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0, profit: 0, count: 0 };
        const itemProfit = item.gross_profit != null
          ? item.gross_profit
          : (item.taxable_amount || 0) - ((item.cost_price || 0) * (item.quantity || 0));
        map[key].qty += item.quantity || 0;
        map[key].revenue += item.total_amount || 0;
        map[key].profit += itemProfit || 0;
        map[key].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const topCustomers = (() => {
    const map = {};
    sales.forEach((sale) => {
      if (!sale.buyer_name || sale.buyer_name === 'Walk-in Customer') return;
      const key = sale.buyer_name;
      if (!map[key]) map[key] = { name: key, phone: sale.buyer_phone || '', revenue: 0, count: 0, udhaar: 0 };
      map[key].revenue += sale.total_amount || 0;
      map[key].count += 1;
    });
    customers.forEach((customer) => {
      if (map[customer.name]) map[customer.name].udhaar = customer.totalUdhaar || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const dailySales = (() => {
    const map = {};
    sales.forEach((sale) => {
      const sourceDate = sale.createdAt || sale.sold_at;
      const dateKey = new Date(sourceDate).toISOString().slice(0, 10);
      if (!map[dateKey]) {
        map[dateKey] = {
          date: formatShortReportDate(sourceDate),
          sortValue: new Date(sourceDate).getTime(),
          revenue: 0,
          profit: 0,
          count: 0,
        };
      }
      map[dateKey].revenue += sale.total_amount || 0;
      map[dateKey].profit += sale.gross_profit || 0;
      map[dateKey].count += 1;
    });
    return Object.values(map).sort((a, b) => b.sortValue - a.sortValue);
  })();

  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = [];
    let filename = '';

    if (type === 'sales') {
      rows = [
        [`Sales Report - ${label}`],
        ['Invoice No', 'Date', 'Product', 'Buyer', 'Taxable', 'GST', 'Total', 'Profit', 'Payment'],
        ...sales.map((sale) => [
          sale.invoice_number,
          new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN'),
          sale.items?.length > 1 ? `${sale.items.length} items` : sale.product_name,
          sale.buyer_name || 'Walk-in',
          fmt(sale.taxable_amount),
          fmt(sale.total_gst),
          fmt(sale.total_amount),
          fmt(sale.gross_profit),
          sale.payment_type,
        ]),
      ];
      filename = `Sales_Report_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'profit') {
      rows = [
        [`Profit Report - ${label}`],
        ['Metric', 'Amount'],
        ['Total Revenue', `₹${fmt(summary.totalRevenue)}`],
        ['Total GST Collected', `₹${fmt(summary.totalGST)}`],
        ['Net Revenue (Taxable)', `₹${fmt((summary.totalRevenue || 0) - (summary.totalGST || 0))}`],
        ['Profit', `₹${fmt(summary.grossProfit)}`],
        ['Profit Margin', `${fmt(summary.margin)}%`],
        ['Total Purchases', `₹${fmt(summary.totalPurchase)}`],
        ['GST Input Credit (ITC)', `₹${fmt(summary.totalITC)}`],
        ['Net GST Payable', `₹${fmt(summary.netGST)}`],
      ];
      filename = `Profit_Report_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'products') {
      rows = [
        [`Top Products - ${label}`],
        ['Product', 'Units Sold', 'Revenue', 'Profit', 'Orders'],
        ...topProducts.map((product) => [product.name, product.qty, fmt(product.revenue), fmt(product.profit), product.count]),
      ];
      filename = `Top_Products_${label.replace(' ', '_')}.csv`;
    }

    if (type === 'customers') {
      rows = [
        [`Top Customers - ${label}`],
        ['Customer', 'Phone', 'Orders', 'Total Spent', 'Udhaar Pending'],
        ...topCustomers.map((customer) => [customer.name, customer.phone, customer.count, fmt(customer.revenue), fmt(customer.udhaar)]),
      ];
      filename = `Top_Customers_${label.replace(' ', '_')}.csv`;
    }

    const csv = rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const marginColor = summary.margin >= 20 ? '#22c55e' : summary.margin >= 10 ? '#f59e0b' : '#ef4444';
  const reportFilters = [
    { val: 'today', label: 'Today' },
    { val: 'week', label: 'Week' },
    { val: 'month', label: 'Month' },
  ];
  const maxProductRevenue = topProducts.reduce((max, product) => Math.max(max, product.revenue || 0), 0);
  const topProduct = topProducts[0] || null;
  const leadCustomer = topCustomers[0] || null;
  const leadDay = dailySales[0] || null;

  return (
    <Layout>
      <div className="page-shell reports-shell">
        <section className="card reports-hero">
          <div className="reports-hero-layout">
            <div className="reports-hero-copy">
              <div className="page-title" style={{ marginBottom: 4, color: '#1a1a1a' }}>Reports</div>
              <div className="reports-hero-badge">Business Analytics</div>
            </div>
            <div className="reports-toggle-group">
              {reportFilters.map((option) => (
                <button
                  key={option.val}
                  onClick={() => setFilter(option.val)}
                  className={`reports-toggle-button${filter === option.val ? ' is-active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!loading ? (
          <section className="reports-metric-grid">
            <ReportMetricCard kind="revenue" label="Revenue" value={`₹${fmtN(summary.totalRevenue)}`} note={`${summary.salesCount || 0} invoices`} />
            <ReportMetricCard kind="profit" label="Profit" value={`₹${fmtN(summary.grossProfit)}`} note={`Margin ${fmt(summary.margin)}%`} />
            <ReportMetricCard kind="gst" label="GST Payable" value={`₹${fmtN(summary.netGST)}`} note={`ITC ₹${fmtN(summary.totalITC)}`} />
            <ReportMetricCard kind="udhaar" label="Udhaar" value={`₹${fmtN(summary.totalUdhaar)}`} note="Pending collection" />
          </section>
        ) : null}

        {loading ? (
          <div className="ui-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>Loading</div>
            <div>Reports are loading...</div>
          </div>
        ) : (
          <>
            <Card
              className="reports-profit-card"
              title="Profit Breakdown"
              actions={
                <button type="button" className="reports-icon-action" onClick={() => exportCSV('profit')} aria-label="Download profit CSV">
                  <CompactActionIcon />
                </button>
              }
            >
              <div className="reports-breakdown-inline">
                <div className="reports-breakdown-line">
                  <span>Revenue <strong>₹{fmtN(summary.totalRevenue)}</strong></span>
                  <span>- GST <strong>₹{fmtN(summary.totalGST)}</strong></span>
                  <span>= Taxable <strong>₹{fmtN((summary.totalRevenue || 0) - (summary.totalGST || 0))}</strong></span>
                </div>
                <div className="reports-breakdown-line">
                  <span>Profit <strong>₹{fmtN(summary.grossProfit)}</strong></span>
                  <span>|</span>
                  <span>Margin <strong style={{ color: marginColor }}>{fmt(summary.margin)}%</strong></span>
                </div>
              </div>
            </Card>

            {leadDay && (
              <Card
                className="reports-daily-card"
                title="Daily Sales"
                actions={<button type="button" className="reports-icon-action" onClick={() => exportCSV('sales')} aria-label="Download sales CSV"><CompactActionIcon /></button>}
              >
                <div className="ui-table-wrap reports-table-wrap">
                  <table className="ui-table reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'center' }}>Orders</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>Profit</th>
                        <th style={{ textAlign: 'right' }}>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const currentMargin = leadDay.revenue > 0 ? (leadDay.profit / leadDay.revenue) * 100 : 0;
                        return (
                          <tr>
                            <td className="reports-date-cell">{leadDay.date}</td>
                            <td style={{ textAlign: 'center' }}>{leadDay.count}</td>
                            <td className="ui-value-money" style={{ textAlign: 'right' }}>₹{fmtN(leadDay.revenue)}</td>
                            <td className={leadDay.profit >= 0 ? 'ui-value-secondary' : 'ui-value-danger'} style={{ textAlign: 'right' }}>₹{fmtN(leadDay.profit)}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(currentMargin)}%</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="split-grid reports-split-grid" style={{ marginBottom: 12 }}>
              <Card className="reports-topline-card" title="Top Products" actions={<button type="button" className="reports-icon-action" onClick={() => exportCSV('products')} aria-label="Download products CSV"><CompactActionIcon /></button>}>
                {!topProduct ? (
                  <div className="ui-empty">No data</div>
                ) : (
                  <div className="reports-topline">
                    <div className="reports-topline-text">{topProduct.name} ({topProduct.qty} units, {topProduct.count} orders) <strong>₹{fmtN(topProduct.revenue)}</strong> sales <span>|</span> <strong>₹{fmtN(topProduct.profit)}</strong> profit</div>
                    <div className="reports-product-bar-track reports-topline-bar">
                      <div className="reports-product-bar-fill" style={{ width: maxProductRevenue > 0 ? `${Math.max(12, (topProduct.revenue / maxProductRevenue) * 100)}%` : '12%' }} />
                    </div>
                  </div>
                )}
              </Card>

              <Card className="reports-topline-card" title="Top Customers" actions={<button type="button" className="reports-icon-action" onClick={() => exportCSV('customers')} aria-label="Download customers CSV"><CompactActionIcon /></button>}>
                {!leadCustomer ? (
                  <div className="ui-empty">No data</div>
                ) : (
                  <div className="reports-customer-inline">
                    <div className="reports-customer-avatar">{leadCustomer.name.charAt(0).toUpperCase()}</div>
                    <div className="reports-customer-inline-copy">
                      <div className="reports-customer-inline-name">{leadCustomer.name}</div>
                      <div className="reports-customer-inline-meta">{leadCustomer.count} orders{leadCustomer.phone ? ` • ${leadCustomer.phone}` : ''}</div>
                    </div>
                    <div className="reports-customer-inline-value">
                      <div className="ui-value-money">₹{fmtN(leadCustomer.revenue)}</div>
                      {leadCustomer.udhaar > 0 ? <div className="ui-value-danger">₹{fmtN(leadCustomer.udhaar)} due</div> : null}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {sales.length === 0 && purchases.length === 0 && (
              <div className="ui-empty">
                <div style={{ fontSize: 40, marginBottom: 12 }}>Chart</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>No data</div>
                <div style={{ fontSize: 13 }}>No sales or purchases found for this period.</div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

