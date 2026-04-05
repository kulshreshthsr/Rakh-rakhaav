'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, DataRow, StatCard, StatusBadge } from '../../components/ui/AppUI';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const REPORTS_CACHE_PREFIX = 'reports-page-v1';
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const formatShortReportDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
}).format(new Date(value));
const getReportsCacheKey = (filter) => `${REPORTS_CACHE_PREFIX}:${filter}`;

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
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  const applyCachedSnapshot = (cached) => {
    setSales(cached?.sales || []);
    setPurchases(cached?.purchases || []);
    setCustomers(cached?.customers || []);
    setSummary(cached?.summary || {});
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  const fetchAll = async (hasCachedSnapshot = false) => {
    setLoading(!hasCachedSnapshot);
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

      const nextSummary = {
        totalRevenue,
        totalGST,
        grossProfit,
        totalPurchase,
        totalITC,
        totalUdhaar,
        margin,
        salesCount: profitData.salesCount ?? salesList.length,
        netGST: profitData.netGSTPayable ?? (totalGST - totalITC),
      };

      setSummary(nextSummary);
      writePageCache(getReportsCacheKey(filter), {
        sales: salesList,
        purchases: purchasesList,
        customers: customersList,
        summary: nextSummary,
      });
      setCacheUpdatedAt(new Date().toISOString());
      setCacheLoaded(true);
    } catch (err) {
      console.error(err);
      if (!hasCachedSnapshot) {
        setSales([]);
        setPurchases([]);
        setCustomers([]);
        setSummary({});
      }
    }
    setLoading(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(getReportsCacheKey(filter));
    if (cached) {
      applyCachedSnapshot(cached);
      setLoading(false);
    } else {
      setCacheLoaded(false);
      setLoading(true);
    }

    const deferredId = scheduleDeferred(() => fetchAll(Boolean(cached)));
    return () => cancelDeferred(deferredId);
  }, [filter, router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const { label } = getRange(filter);
  const marginColor = summary.margin >= 20 ? '#22c55e' : summary.margin >= 10 ? '#f59e0b' : '#ef4444';
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const reportFilters = [
    { val: 'today', label: 'Today' },
    { val: 'week', label: 'Week' },
    { val: 'month', label: 'Month' },
  ];

  return (
    <Layout>
      <div className="page-shell reports-shell">
        <section className="hero-panel reports-hero">
          <div className="mb-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">Business analytics</p>
              <div className="page-title">Reports</div>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-600">
                Revenue, profit, GST and customer trends for {label.toLowerCase()} in one clean view.
              </p>
              {!isOnline ? (
                <p className="rr-meta-line is-warn mt-2">
                  Offline snapshot active{cacheLabel ? ` · last updated ${cacheLabel}` : ''}
                </p>
              ) : cacheLoaded && cacheLabel ? (
                <p className="rr-meta-line mt-2">Last synced {cacheLabel}</p>
              ) : null}
            </div>
            <div className="filter-pills reports-filter-pills shrink-0">
              {reportFilters.map((option) => (
                <button
                  key={option.val}
                  type="button"
                  onClick={() => setFilter(option.val)}
                  className={`filter-pill${filter === option.val ? ' is-active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!isOnline ? (
          <div className="rr-banner-warn" role="status">
            <strong>Offline reports view</strong>
            <div>
              Reports offline snapshot dikh raha hai. Fresh server data internet aane par update hoga.
            </div>
          </div>
        ) : null}

        {!loading ? (
          <section className="metric-grid reports-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <StatCard label="Revenue" value={`₹${fmtN(summary.totalRevenue)}`} note={`${summary.salesCount || 0} invoices`} tone="money" />
            <StatCard label="Profit" value={`₹${fmtN(summary.grossProfit)}`} note={`Margin ${fmt(summary.margin)}%`} tone={summary.grossProfit >= 0 ? 'secondary' : 'danger'} />
            <StatCard label="GST Payable" value={`₹${fmtN(summary.netGST)}`} note={`ITC ₹${fmtN(summary.totalITC)}`} tone="warning" />
            <StatCard label="Udhaar" value={`₹${fmtN(summary.totalUdhaar)}`} note="Pending collection" tone="danger" />
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
              subtitle="Revenue, GST and profit in one clear stack"
              actions={<ActionButton variant="secondary" onClick={() => exportCSV('profit')}>CSV Download</ActionButton>}
            >
              <DataRow label="Total Revenue" value={`₹${fmtN(summary.totalRevenue)}`} valueTone="ui-value-money" />
              <DataRow label="GST Collected" note="Tax collected on behalf of the government" prefix="-" value={`₹${fmtN(summary.totalGST)}`} valueTone="ui-value-secondary" />
              <DataRow label="Taxable Revenue (Revenue - GST)" prefix="=" value={`₹${fmtN((summary.totalRevenue || 0) - (summary.totalGST || 0))}`} />
              <DataRow label="Profit" prefix="=" value={`₹${fmtN(summary.grossProfit)}`} valueTone={summary.grossProfit >= 0 ? 'ui-value-money' : 'ui-value-danger'} tone={summary.grossProfit >= 0 ? 'success' : 'danger'} />

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
                title="Daily Sales"
                actions={<ActionButton variant="secondary" onClick={() => exportCSV('sales')}>Sales CSV</ActionButton>}
              >
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>Profit</th>
                        <th>Margin</th>
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
              <Card title="Top Products" actions={<ActionButton variant="secondary" onClick={() => exportCSV('products')}>CSV</ActionButton>}>
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

              <Card title="Top Customers" actions={<ActionButton variant="secondary" onClick={() => exportCSV('customers')}>CSV</ActionButton>}>
                {topCustomers.length === 0 ? (
                  <div className="ui-empty">No data</div>
                ) : (
                  <div className="stack-list">
                    {topCustomers.map((customer, index) => (
                      <div key={index} className="stack-row">
                        <div className="stack-row-rank" style={{ background: ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#0891b2'][index % 5] }}>
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
    </Layout>
  );
}

