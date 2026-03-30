'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Layout from '../../components/Layout';
import { ActionButton, Card, DataRow, StatCard, StatusBadge } from '../../components/ui/AppUI';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const formatShortReportDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
}).format(new Date(value));
const formatChartDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
}).format(new Date(value));

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
  const [monthSales, setMonthSales] = useState([]);
  const [trendSales, setTrendSales] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params = from ? `?from=${from}&to=${to}` : '';
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    const trendStartDate = new Date(now);
    trendStartDate.setDate(now.getDate() - 29);
    trendStartDate.setHours(0, 0, 0, 0);
    const monthParams = `?from=${monthStart}&to=${monthEnd}`;
    const trendParams = `?from=${trendStartDate.toISOString()}&to=${now.toISOString()}`;

    try {
      const [sRes, pRes, cRes, profitRes, monthSalesRes, trendSalesRes] = await Promise.all([
        fetch(`${API}/api/sales${params}`, { headers }),
        fetch(`${API}/api/purchases${params}`, { headers }),
        fetch(`${API}/api/customers`, { headers }),
        fetch(`${API}/api/sales/profit-summary${params}`, { headers }),
        fetch(`${API}/api/sales${monthParams}`, { headers }),
        fetch(`${API}/api/sales${trendParams}`, { headers }),
      ]);

      const sData = await sRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      const profitData = await profitRes.json();
      const monthSalesData = await monthSalesRes.json();
      const trendSalesData = await trendSalesRes.json();

      const salesList = sData.sales || (Array.isArray(sData) ? sData : []);
      const purchasesList = pData.purchases || (Array.isArray(pData) ? pData : []);
      const customersList = Array.isArray(cData) ? cData : [];
      const monthSalesList = monthSalesData.sales || (Array.isArray(monthSalesData) ? monthSalesData : []);
      const trendSalesList = trendSalesData.sales || (Array.isArray(trendSalesData) ? trendSalesData : []);

      setSales(salesList);
      setPurchases(purchasesList);
      setCustomers(customersList);
      setMonthSales(monthSalesList);
      setTrendSales(trendSalesList);

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

  const monthlyRevenueBars = (() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const map = {};

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      const key = date.toISOString().slice(0, 10);
      map[key] = { key, label: formatChartDate(date), revenue: 0 };
    }

    monthSales.forEach((sale) => {
      const sourceDate = sale.createdAt || sale.sold_at;
      const key = new Date(sourceDate).toISOString().slice(0, 10);
      if (!map[key]) return;
      map[key].revenue += sale.total_amount || 0;
    });

    return Object.values(map);
  })();

  const profitTrend = (() => {
    const map = {};

    for (let index = 29; index >= 0; index -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      map[key] = { key, label: formatChartDate(date), profit: 0 };
    }

    trendSales.forEach((sale) => {
      const sourceDate = sale.createdAt || sale.sold_at;
      const key = new Date(sourceDate).toISOString().slice(0, 10);
      if (!map[key]) return;
      map[key].profit += sale.gross_profit || 0;
    });

    return Object.values(map);
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

    if (type === 'revenue-bars') {
      rows = [
        ['Daily Revenue - Current Month'],
        ['Date', 'Revenue'],
        ...monthlyRevenueBars.map((day) => [day.label, fmt(day.revenue)]),
      ];
      filename = 'Daily_Revenue_Current_Month.csv';
    }

    if (type === 'profit-trend') {
      rows = [
        ['Profit Trend - Last 30 Days'],
        ['Date', 'Profit'],
        ...profitTrend.map((day) => [day.label, fmt(day.profit)]),
      ];
      filename = 'Profit_Trend_30_Days.csv';
    }

    if (type === 'daily-sales') {
      rows = [
        [`Daily Sales - ${label}`],
        ['Date', 'Orders', 'Revenue', 'Profit', 'Margin %'],
        ...dailySales.map((day) => [
          day.date,
          day.count,
          fmt(day.revenue),
          fmt(day.profit),
          fmt(day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0),
        ]),
      ];
      filename = `Daily_Sales_${label.replace(' ', '_')}.csv`;
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

  const { label } = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#22c55e' : summary.margin >= 10 ? '#f59e0b' : '#ef4444';
  const reportFilters = [
    { val: 'today', label: 'Today' },
    { val: 'week', label: 'Week' },
    { val: 'month', label: 'Month' },
  ];

  return (
    <Layout>
      <div className="page-shell reports-shell">
        <section className="hero-panel reports-hero page-header-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="page-title page-header-title" style={{ marginBottom: 4 }}>रिपोर्ट / Reports</div>
              <div className="kicker" style={{ marginBottom: 10 }}>Business analytics</div>
              <div style={{ fontSize: 13, color: '#5b6b82', maxWidth: 420 }}>
                Revenue, profit, GST and customer trends for {label.toLowerCase()} in one clean view.
              </div>
            </div>
            <div className="filter-pills reports-filter-pills">
              {reportFilters.map((option) => (
                <button
                  key={option.val}
                  onClick={() => setFilter(option.val)}
                  className={`filter-pill${filter === option.val ? ' is-active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!loading ? (
          <section className="metric-grid reports-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <StatCard label="Revenue" value={`₹${fmtN(summary.totalRevenue)}`} note={`${summary.salesCount || 0} invoices`} tone="money" />
            <StatCard label="Profit" value={`₹${fmtN(summary.grossProfit)}`} note={`Margin ${fmt(summary.margin)}%`} tone={summary.grossProfit >= 0 ? 'secondary' : 'danger'} />
            <StatCard label="GST Payable" value={`₹${fmtN(summary.netGST)}`} note={`ITC ₹${fmtN(summary.totalITC)}`} tone="warning" />
            <StatCard label="Udhaar" value={`₹${fmtN(summary.totalUdhaar)}`} note="Pending collection" tone="danger" />
          </section>
        ) : null}

        {loading ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <section className="metric-grid reports-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="ui-skeleton-card">
                  <div className="ui-skeleton-line is-short" />
                  <div className="ui-skeleton-line is-medium" style={{ marginTop: 16, height: 28 }} />
                  <div className="ui-skeleton-line is-long" style={{ marginTop: 14 }} />
                </div>
              ))}
            </section>
            <div className="split-grid reports-chart-grid">
              <div className="ui-skeleton-card"><div className="ui-skeleton-block" /></div>
              <div className="ui-skeleton-card"><div className="ui-skeleton-block" /></div>
            </div>
            <div className="ui-skeleton-card"><div className="ui-skeleton-block" style={{ height: 220 }} /></div>
          </div>
        ) : (
          <>
            <div className="split-grid reports-chart-grid" style={{ marginBottom: 20 }}>
              <Card
                title="दैनिक राजस्व / Daily Revenue"
                subtitle="Daily revenue bars for the current month"
                actions={<ActionButton variant="secondary" onClick={() => exportCSV('revenue-bars')}>CSV Download</ActionButton>}
              >
                <div className="reports-chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyRevenueBars}>
                      <CartesianGrid stroke="#FFFFFF12" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#8B8FA8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis tick={{ fill: '#8B8FA8', fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(value) => `₹${fmtN(value)}`} />
                      <Tooltip
                        cursor={{ fill: '#6C63FF10' }}
                        contentStyle={{ background: '#161929', border: '1px solid #FFFFFF15', borderRadius: 12, color: '#F0F0FF' }}
                        formatter={(value) => [`₹${fmtN(value)}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#6C63FF" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="लाभ ट्रेंड / Profit Trend"
                subtitle="Profit movement over the last 30 days"
                actions={<ActionButton variant="secondary" onClick={() => exportCSV('profit-trend')}>CSV Download</ActionButton>}
              >
                <div className="reports-chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={profitTrend}>
                      <CartesianGrid stroke="#FFFFFF12" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#8B8FA8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis tick={{ fill: '#8B8FA8', fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(value) => `₹${fmtN(value)}`} />
                      <Tooltip
                        contentStyle={{ background: '#161929', border: '1px solid #FFFFFF15', borderRadius: 12, color: '#F0F0FF' }}
                        formatter={(value) => [`₹${fmtN(value)}`, 'Profit']}
                      />
                      <Line type="monotone" dataKey="profit" stroke="#00C896" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: '#00C896' }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card
              className="reports-profit-card"
              title="लाभ विवरण / Profit Breakdown"
              subtitle="Revenue, GST and profit in one clear stack"
              actions={<ActionButton variant="secondary" onClick={() => exportCSV('profit')}>CSV Download</ActionButton>}
            >
              <DataRow label="Revenue" value={`₹${fmtN(summary.totalRevenue)}`} valueTone="ui-value-money" />
              <DataRow label="GST" note="Tax collected on behalf of the government" prefix="-" value={`₹${fmtN(summary.totalGST)}`} valueTone="ui-value-secondary" />
              <DataRow label="Taxable" note="Revenue after GST deduction" prefix="=" value={`₹${fmtN((summary.totalRevenue || 0) - (summary.totalGST || 0))}`} />
              <DataRow label="Profit" note="Final retained profit" prefix="=" value={`₹${fmtN(summary.grossProfit)}`} valueTone={summary.grossProfit >= 0 ? 'ui-value-money' : 'ui-value-danger'} tone={summary.grossProfit >= 0 ? 'success' : 'danger'} />

              {(summary.totalRevenue || 0) > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    <span>Profit Margin</span>
                    <strong style={{ color: marginColor }}>{fmt(summary.margin)}%</strong>
                  </div>
                  <div style={{ height: 10, background: 'rgba(148,163,184,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.abs(summary.margin || 0))}%`,
                        background: `linear-gradient(90deg, ${marginColor}, ${marginColor}cc)`,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {dailySales.length > 0 && (
              <Card
                title="दैनिक बिक्री / Daily Sales"
                actions={<ActionButton variant="secondary" onClick={() => exportCSV('daily-sales')}>CSV Download</ActionButton>}
              >
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>Profit</th>
                        <th>Margin%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySales.map((day, index) => {
                        const currentMargin = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0;
                        return (
                          <tr key={index}>
                            <td>{day.date}</td>
                            <td>{day.count}</td>
                            <td className="ui-value-money">₹{fmtN(day.revenue)}</td>
                            <td className={day.profit >= 0 ? 'ui-value-secondary' : 'ui-value-danger'}>₹{fmtN(day.profit)}</td>
                            <td>
                              <StatusBadge tone={currentMargin >= 20 ? 'success' : currentMargin >= 10 ? 'warning' : 'danger'}>
                                {currentMargin.toFixed(1)}%
                              </StatusBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="split-grid reports-split-grid" style={{ marginBottom: 20 }}>
              <Card title="टॉप उत्पाद / Top Products" actions={<ActionButton variant="secondary" onClick={() => exportCSV('products')}>CSV</ActionButton>}>
                {topProducts.length === 0 ? (
                  <div className="ui-empty">No data</div>
                ) : (
                  <div className="stack-list">
                    {topProducts.map((product, index) => (
                      <div key={index} className="stack-row">
                        <div className="stack-row-rank" style={{ background: ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#3b82f6'][index % 5] }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="stack-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{product.qty} units • {product.count} orders</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="ui-value-money" style={{ fontSize: 13 }}>₹{fmtN(product.revenue)}</div>
                          <div className="ui-value-secondary" style={{ fontSize: 11 }}>₹{fmtN(product.profit)} profit</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="टॉप ग्राहक / Top Customers" actions={<ActionButton variant="secondary" onClick={() => exportCSV('customers')}>CSV</ActionButton>}>
                {topCustomers.length === 0 ? (
                  <div className="ui-empty">No data</div>
                ) : (
                  <div className="stack-list">
                    {topCustomers.map((customer, index) => (
                      <div key={index} className="stack-row">
                        <div className="stack-row-rank" style={{ background: ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6'][index % 5] }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="stack-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{customer.count} orders{customer.phone ? ` • ${customer.phone}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="ui-value-money" style={{ fontSize: 13 }}>₹{fmtN(customer.revenue)}</div>
                          {customer.udhaar > 0 ? <div className="ui-value-danger" style={{ fontSize: 11 }}>₹{fmtN(customer.udhaar)} due</div> : null}
                        </div>
                      </div>
                    ))}
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

      <style>{`
        .reports-shell .reports-hero { border: 1px solid rgba(108, 99, 255, 0.22); }

        .reports-shell .reports-filter-pills {
          align-items: center;
        }

        .reports-shell .stack-row {
          background: linear-gradient(180deg, rgba(30,34,53,0.92), rgba(22,25,41,0.98));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .reports-shell .reports-split-grid {
          align-items: start;
        }

        .reports-shell .reports-chart-grid {
          align-items: stretch;
        }

        .reports-shell .reports-chart-wrap {
          width: 100%;
          height: 280px;
        }

        @media (max-width: 640px) {
          .reports-profit-card .ui-data-row-value {
            font-size: 16px;
          }
        }
      `}</style>
    </Layout>
  );
}

