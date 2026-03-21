'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '../../components/Layout';
import { useAppLocale } from '../../components/AppLocale';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const accentPalette = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#7c3aed'];

function formatCurrency(value) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export default function DashboardPage() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        const params = `?month=${selectedMonth}&year=${selectedYear}`;

        const [profitRes, productsRes, customersRes, salesRes] = await Promise.all([
          fetch(`${API}/api/sales/profit-summary${params}`, { headers }),
          fetch(`${API}/api/products`, { headers }),
          fetch(`${API}/api/customers`, { headers }),
          fetch(`${API}/api/sales${params}`, { headers }),
        ]);

        const profitData = await profitRes.json();
        const productsData = await productsRes.json();
        const customersData = await customersRes.json();
        const salesData = await salesRes.json();

        setStats(profitData);

        const productList = Array.isArray(productsData) ? productsData : productsData.products || [];
        const customerList = Array.isArray(customersData) ? customersData : [];
        const salesList = salesData.sales || salesData || [];

        setProducts(productList);
        setCustomers(customerList);
        setSalesRows(salesList);

        const productSalesMap = {};

        salesList.forEach((sale) => {
          const items = sale.items?.length
            ? sale.items
            : [
                {
                  product_name: sale.product_name,
                  quantity: sale.quantity,
                  total_amount: sale.total_amount,
                },
              ];

          items.forEach((item) => {
            const key = item.product_name;
            if (!key) return;
            if (!productSalesMap[key]) {
              productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
            }
            productSalesMap[key].qty += item.quantity || 0;
            productSalesMap[key].revenue += item.total_amount || 0;
          });
        });

        setTopProducts(Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      }
      setLoading(false);
    };

    fetchAll();
  }, [router, selectedMonth, selectedYear]);

  const lowStock = useMemo(() => products.filter((p) => (p.quantity ?? p.stock ?? 0) <= 5), [products]);
  const totalCustomerUdhaar = useMemo(
    () => customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0),
    [customers]
  );

  const revenue = stats?.totalRevenue || 0;
  const profit = stats?.grossProfit || 0;
  const netGST = stats?.netGSTPayable ?? 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const trendSeries = useMemo(() => {
    const byDay = {};

    salesRows.forEach((sale) => {
      const date = new Date(sale.createdAt || sale.sold_at);
      const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
      if (!byDay[label]) byDay[label] = { day: label, revenue: 0, profit: 0, dues: 0 };
      byDay[label].revenue += sale.total_amount || 0;
      byDay[label].profit += sale.gross_profit || 0;
      if (sale.payment_type === 'credit') {
        byDay[label].dues += Math.max(0, (sale.total_amount || 0) - (sale.amount_paid || 0));
      }
    });

    return Object.values(byDay).slice(-7);
  }, [salesRows]);

  const ledgerHighlights = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.totalUdhaar > 0)
        .sort((a, b) => b.totalUdhaar - a.totalUdhaar)
        .slice(0, 4),
    [customers]
  );

  const donutData = [
    { name: 'Revenue', value: Math.max(revenue, 0), color: '#2563eb' },
    { name: 'Profit', value: Math.max(profit, 0), color: '#14b8a6' },
    { name: 'Dues', value: Math.max(totalCustomerUdhaar, 0), color: '#ef4444' },
  ].filter((item) => item.value > 0);

  const cardCopy =
    locale === 'hi'
      ? {
          heading: 'संचालन कमांड सेंटर',
          subtitle: 'आज की वित्तीय स्थिति, लेजर जोखिम और तेज़ shortcuts एक ही जगह।',
          sales: 'बिक्री',
          profit: 'मुनाफ़ा',
          credit: 'बकाया',
          gst: 'GST देय',
          recordSale: 'बिक्री दर्ज करें',
          reviewReports: 'रिपोर्ट्स खोलें',
          trendTitle: 'Revenue, profit और dues trend',
          trendSubtitle: 'चयनित अवधि के हाल के कारोबार का स्नैपशॉट',
          topTitle: 'सबसे अच्छे उत्पाद',
          topSubtitle: 'उच्च revenue देने वाले items',
          ledgerTitle: 'लेजर अलर्ट',
          ledgerSubtitle: 'जिन ग्राहकों से collection बाकी है',
          lowStock: 'Low stock items',
          lowStockSubtitle: 'इन products पर तुरंत restock plan बनाइए',
          profitTitle: 'Profit health',
          profitSubtitle: 'margin ring',
          healthy: 'स्वस्थ',
          attention: 'ध्यान दें',
        }
      : {
          heading: 'Operations command center',
          subtitle: 'Today’s financial pulse, ledger risk and quick shortcuts in one view.',
          sales: 'Sales',
          profit: 'Profit',
          credit: 'Pending dues',
          gst: 'GST payable',
          recordSale: 'Record sale',
          reviewReports: 'Open reports',
          trendTitle: 'Revenue, profit and dues trend',
          trendSubtitle: 'A compact view of recent movement for the selected period',
          topTitle: 'Top products',
          topSubtitle: 'Highest revenue contributors this month',
          ledgerTitle: 'Ledger watchlist',
          ledgerSubtitle: 'Customers needing collection attention',
          lowStock: 'Low stock items',
          lowStockSubtitle: 'Restock these products before they run out',
          profitTitle: 'Profit health',
          profitSubtitle: 'Margin ring',
          healthy: 'Healthy',
          attention: 'Needs attention',
        };

  if (loading) {
    return (
      <Layout>
        <div className="page-shell">
          <div className="hero-panel">
            <div className="skeleton" style={{ height: 24, width: 220, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 14, width: 320, marginBottom: 26 }} />
            <div className="metric-grid">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="metric-card" style={{ cursor: 'default' }}>
                  <div className="skeleton" style={{ height: 12, width: '35%' }} />
                  <div className="skeleton" style={{ height: 34, width: '60%', marginTop: 12 }} />
                  <div className="skeleton" style={{ height: 12, width: '50%', marginTop: 10 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel enterprise-hero">
          <div className="dashboard-hero-grid">
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                {locale === 'hi' ? 'बिज़नेस इंटेलिजेंस' : 'Business intelligence'}
              </div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 8 }}>
                {cardCopy.heading}
              </div>
              <div className="hero-copy">{cardCopy.subtitle}</div>

              <div className="dashboard-actions">
                <button type="button" className="btn-success" style={{ width: 'auto' }} onClick={() => router.push('/sales')}>
                  {cardCopy.recordSale}
                </button>
                <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => router.push('/reports')}>
                  {cardCopy.reviewReports}
                </button>
              </div>
            </div>

            <div className="hero-side-panel">
              <div className="hero-period-row">
                <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className="form-input hero-select">
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
                <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="form-input hero-select">
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hero-mini-strip">
                <div>
                  <span>{locale === 'hi' ? 'Invoices' : 'Invoices'}</span>
                  <strong>{stats?.salesCount || 0}</strong>
                </div>
                <div>
                  <span>{locale === 'hi' ? 'Products' : 'Products'}</span>
                  <strong>{products.length}</strong>
                </div>
                <div>
                  <span>{locale === 'hi' ? 'Customers' : 'Customers'}</span>
                  <strong>{customers.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="metric-grid">
          {[
            {
              label: cardCopy.sales,
              value: formatCurrency(revenue),
              note: `${stats?.salesCount || 0} ${locale === 'hi' ? 'इनवॉइस' : 'invoices'}`,
              color: '#2563eb',
              route: '/sales',
              badge: locale === 'hi' ? 'Live' : 'Live',
            },
            {
              label: cardCopy.profit,
              value: `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`,
              note: `${margin.toFixed(1)}% ${locale === 'hi' ? 'margin' : 'margin'}`,
              color: profit >= 0 ? '#14b8a6' : '#ef4444',
              route: '/reports',
              badge: margin >= 15 ? cardCopy.healthy : cardCopy.attention,
            },
            {
              label: cardCopy.credit,
              value: formatCurrency(totalCustomerUdhaar),
              note: ledgerHighlights.length
                ? `${ledgerHighlights.length} ${locale === 'hi' ? 'उच्च प्राथमिकता खाते' : 'priority accounts'}`
                : locale === 'hi'
                ? 'कोई बकाया नहीं'
                : 'No pending ledgers',
              color: totalCustomerUdhaar > 0 ? '#ef4444' : '#14b8a6',
              route: '/udhaar',
              badge: totalCustomerUdhaar > 0 ? 'Pending' : 'Paid',
            },
            {
              label: cardCopy.gst,
              value: formatCurrency(Math.abs(netGST)),
              note: netGST >= 0 ? (locale === 'hi' ? 'भुगतान के लिए तैयार' : 'Ready to file') : locale === 'hi' ? 'रिफंड साइड' : 'Refund side',
              color: netGST >= 0 ? '#f59e0b' : '#14b8a6',
              route: '/gst',
              badge: netGST >= 0 ? 'Review' : 'ITC',
            },
          ].map((card) => (
            <button key={card.label} type="button" className="metric-card premium-metric-card" onClick={() => router.push(card.route)}>
              <div className="metric-card-topline">
                <div className="metric-label">{card.label}</div>
                <span className={`badge ${card.badge === 'Pending' ? 'badge-red' : card.badge === 'Paid' ? 'badge-green' : 'badge-blue'}`}>
                  {card.badge}
                </span>
              </div>
              <div className="metric-value" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="metric-note">{card.note}</div>
            </button>
          ))}
        </section>

        <section className="split-grid dashboard-detail-grid">
          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{cardCopy.trendTitle}</div>
                <div className="section-subtitle">{cardCopy.trendSubtitle}</div>
              </div>
              <a href="/reports" className="panel-action">
                {locale === 'hi' ? 'विस्तार' : 'Explore'}
              </a>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendSeries}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid rgba(226,232,240,0.9)',
                      boxShadow: '0 16px 38px rgba(15,23,42,0.12)',
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revenueFill)" strokeWidth={2.4} />
                  <Area type="monotone" dataKey="profit" stroke="#14b8a6" fill="url(#profitFill)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{cardCopy.profitTitle}</div>
                <div className="section-subtitle">{cardCopy.profitSubtitle}</div>
              </div>
              <span className={`badge ${margin >= 15 ? 'badge-green' : 'badge-yellow'}`}>{margin.toFixed(1)}%</span>
            </div>

            <div className="dashboard-ring-wrap">
              <div
                className="dashboard-ring"
                style={{
                  background: `conic-gradient(#2563eb 0deg ${Math.min(360, margin * 3.6)}deg, rgba(226,232,240,0.9) ${Math.min(
                    360,
                    margin * 3.6
                  )}deg 360deg)`,
                }}
              >
                <div className="dashboard-ring-inner">
                  <strong>{margin.toFixed(1)}%</strong>
                  <span>{locale === 'hi' ? 'नेट margin' : 'Net margin'}</span>
                </div>
              </div>

              <div className="dashboard-pie-card">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2}>
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="split-grid dashboard-detail-grid">
          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{cardCopy.topTitle}</div>
                <div className="section-subtitle">{cardCopy.topSubtitle}</div>
              </div>
            </div>
            <div className="stack-list">
              {topProducts.length ? (
                topProducts.map((product, index) => (
                  <div key={product.name} className="stack-row">
                    <div className="stack-row-rank" style={{ background: accentPalette[index % accentPalette.length] }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="stack-row-title">{product.name}</div>
                      <div className="stack-row-subtitle">
                        {product.qty} {locale === 'hi' ? 'यूनिट्स' : 'units'}
                      </div>
                    </div>
                    <div className="stack-row-value">{formatCurrency(product.revenue)}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">{locale === 'hi' ? 'इस अवधि के लिए डेटा उपलब्ध नहीं है।' : 'No product performance data for this period.'}</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{cardCopy.ledgerTitle}</div>
                <div className="section-subtitle">{cardCopy.ledgerSubtitle}</div>
              </div>
              <a href="/udhaar" className="panel-action">
                {locale === 'hi' ? 'लेजर खोलें' : 'Open ledger'}
              </a>
            </div>

            <div className="stack-list">
              {ledgerHighlights.length ? (
                ledgerHighlights.map((customer, index) => (
                  <div key={customer._id || customer.name} className="stack-row">
                    <div className="customer-avatar" style={{ background: accentPalette[index % accentPalette.length] }}>
                      {initials(customer.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="stack-row-title">{customer.name}</div>
                      <div className="stack-row-subtitle">{customer.phone || (locale === 'hi' ? 'फोन उपलब्ध नहीं' : 'No phone')}</div>
                    </div>
                    <div className="stack-row-value" style={{ color: '#ef4444' }}>
                      {formatCurrency(customer.totalUdhaar)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">{locale === 'hi' ? 'सभी लेजर खाते साफ़ हैं।' : 'All customer ledgers are settled.'}</div>
              )}
            </div>
          </div>
        </section>

        {lowStock.length > 0 && (
          <section className="card low-stock-banner" onClick={() => router.push('/product')}>
            <div>
              <div className="section-title">{cardCopy.lowStock}</div>
              <div className="section-subtitle">{cardCopy.lowStockSubtitle}</div>
            </div>
            <div className="low-stock-pill-row">
              {lowStock.slice(0, 6).map((product) => (
                <span key={product._id} className="low-stock-pill">
                  {product.name}
                  <strong>{product.quantity ?? 0}</strong>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .enterprise-hero {
          padding-bottom: 28px !important;
        }

        .dashboard-hero-grid {
          display: grid;
          grid-template-columns: 1.3fr 0.8fr;
          gap: 18px;
          align-items: stretch;
        }

        .hero-copy {
          max-width: 540px;
          font-size: 14px;
          line-height: 1.65;
          color: rgba(226, 232, 240, 0.76);
        }

        .dashboard-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .hero-side-panel {
          padding: 18px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .hero-period-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .hero-select {
          background: rgba(255,255,255,0.94) !important;
          min-height: 46px;
        }

        .hero-mini-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .hero-mini-strip > div {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .hero-mini-strip span {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(226,232,240,0.52);
        }

        .hero-mini-strip strong {
          display: block;
          margin-top: 8px;
          font-size: 24px;
          color: white;
          letter-spacing: -0.05em;
        }

        .premium-metric-card {
          text-align: left;
        }

        .metric-card-topline {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .dashboard-detail-grid {
          grid-template-columns: 1.2fr 0.8fr;
        }

        .dashboard-ring-wrap {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 18px;
          align-items: center;
        }

        .dashboard-ring {
          width: 170px;
          height: 170px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          box-shadow: 0 22px 48px rgba(37,99,235,0.14);
        }

        .dashboard-ring-inner {
          width: 124px;
          height: 124px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,247,255,0.96));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.92);
        }

        .dashboard-ring-inner strong {
          font-size: 28px;
          line-height: 1;
          color: #0f172a;
          letter-spacing: -0.05em;
        }

        .dashboard-ring-inner span {
          margin-top: 6px;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .dashboard-pie-card {
          min-height: 180px;
          border-radius: 20px;
          background: rgba(248,250,252,0.78);
          border: 1px solid rgba(226,232,240,0.9);
        }

        .customer-avatar {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .low-stock-banner {
          cursor: pointer;
          background: linear-gradient(135deg, rgba(255,247,237,0.96), rgba(255,255,255,0.96)) !important;
          border: 1px solid rgba(251,146,60,0.2) !important;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
          align-items: center;
        }

        .low-stock-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .low-stock-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          background: white;
          border: 1px solid rgba(251,146,60,0.16);
          color: #9a3412;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(15,23,42,0.05);
        }

        .low-stock-pill strong {
          color: #ea580c;
        }

        @media (max-width: 900px) {
          .dashboard-hero-grid,
          .dashboard-detail-grid,
          .dashboard-ring-wrap {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .hero-mini-strip {
            grid-template-columns: 1fr 1fr;
          }

          .dashboard-actions .btn-success,
          .dashboard-actions .btn-ghost {
            width: 100% !important;
          }

          .hero-period-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}
