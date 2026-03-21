'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { useAppLocale } from '../../components/AppLocale';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(value) {
  return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
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
        setProducts(Array.isArray(productsData) ? productsData : productsData.products || []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setSalesRows(salesData.sales || salesData || []);
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      }
      setLoading(false);
    };

    fetchAll();
  }, [router, selectedMonth, selectedYear]);

  const lowStock = useMemo(() => products.filter((product) => (product.quantity ?? product.stock ?? 0) <= 5), [products]);
  const ledgerList = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.totalUdhaar > 0)
        .sort((a, b) => b.totalUdhaar - a.totalUdhaar)
        .slice(0, 5),
    [customers]
  );
  const recentSales = useMemo(() => salesRows.slice(0, 5), [salesRows]);

  const revenue = stats?.totalRevenue || 0;
  const profit = stats?.grossProfit || 0;
  const gstDue = Math.abs(stats?.netGSTPayable ?? 0);
  const totalUdhaar = customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0);

  const copy =
    locale === 'hi'
      ? {
          title: 'डैशबोर्ड',
          subtitle: 'आज का काम एक जगह देखिए।',
          sales: 'कुल बिक्री',
          profit: 'मुनाफा',
          dues: 'बाकी पैसा',
          gst: 'GST',
          addSale: 'नई बिक्री',
          openReport: 'रिपोर्ट',
          recentSales: 'हाल की बिक्री',
          recentSalesSub: 'अभी की एंट्री',
          ledger: 'बाकी वाले ग्राहक',
          ledgerSub: 'जिनसे पैसा लेना है',
          stock: 'कम स्टॉक',
          stockSub: 'जिन चीजों का स्टॉक कम है',
          noSales: 'अभी कोई बिक्री नहीं है।',
          noLedger: 'अभी कोई बाकी नहीं है।',
          noStock: 'अभी सब ठीक है।',
          invoices: 'बिल',
          products: 'प्रोडक्ट',
          customers: 'ग्राहक',
        }
      : {
          title: 'Dashboard',
          subtitle: 'See today’s business status in one place.',
          sales: 'Total sales',
          profit: 'Profit',
          dues: 'Pending dues',
          gst: 'GST',
          addSale: 'New sale',
          openReport: 'Reports',
          recentSales: 'Recent sales',
          recentSalesSub: 'Latest entries',
          ledger: 'Customers with due',
          ledgerSub: 'Customers pending payment',
          stock: 'Low stock',
          stockSub: 'Products that need refill',
          noSales: 'No recent sales found.',
          noLedger: 'No pending ledger accounts.',
          noStock: 'Stock looks fine right now.',
          invoices: 'Invoices',
          products: 'Products',
          customers: 'Customers',
        };

  if (loading) {
    return (
      <Layout>
        <div className="page-shell">
          <div className="card">
            <div className="skeleton-line" style={{ height: 24, width: 180, marginBottom: 12 }} />
            <div className="skeleton-line" style={{ height: 14, width: 260, marginBottom: 20 }} />
            <div className="metric-grid">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="metric-card" style={{ cursor: 'default' }}>
                  <div className="skeleton-line" style={{ height: 12, width: '40%' }} />
                  <div className="skeleton-line" style={{ height: 32, width: '70%', marginTop: 10 }} />
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
        <section className="hero-panel" style={{ paddingBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 8 }}>
                {copy.title}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.76)', fontSize: 14 }}>{copy.subtitle}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button type="button" className="btn-success" style={{ width: 'auto' }} onClick={() => router.push('/sales')}>
                  {copy.addSale}
                </button>
                <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => router.push('/reports')}>
                  {copy.openReport}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minWidth: 220 }}>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className="form-input" style={{ background: 'rgba(255,255,255,0.95)' }}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="form-input" style={{ background: 'rgba(255,255,255,0.95)' }}>
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="metric-grid">
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">{copy.sales}</div>
            <div className="metric-value" style={{ color: '#2563eb' }}>{formatCurrency(revenue)}</div>
            <div className="metric-note">{stats?.salesCount || 0} {copy.invoices}</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">{copy.profit}</div>
            <div className="metric-value" style={{ color: profit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(profit)}</div>
            <div className="metric-note">{products.length} {copy.products}</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">{copy.dues}</div>
            <div className="metric-value" style={{ color: '#ef4444' }}>{formatCurrency(totalUdhaar)}</div>
            <div className="metric-note">{customers.length} {copy.customers}</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default' }}>
            <div className="metric-label">{copy.gst}</div>
            <div className="metric-value" style={{ color: '#f59e0b' }}>{formatCurrency(gstDue)}</div>
            <div className="metric-note">{locale === 'hi' ? 'इस महीने का हिसाब' : 'For this month'}</div>
          </div>
        </section>

        <section className="split-grid" style={{ marginTop: 18 }}>
          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{copy.recentSales}</div>
                <div className="section-subtitle">{copy.recentSalesSub}</div>
              </div>
            </div>
            <div className="stack-list">
              {recentSales.length ? (
                recentSales.map((sale, index) => (
                  <div key={sale._id || index} className="stack-row">
                    <div className="stack-row-rank" style={{ background: '#2563eb' }}>{index + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="stack-row-title">{sale.buyer_name || (locale === 'hi' ? 'ग्राहक' : 'Customer')}</div>
                      <div className="stack-row-subtitle">{sale.invoice_number || (locale === 'hi' ? 'बिल' : 'Invoice')}</div>
                    </div>
                    <div className="stack-row-value">{formatCurrency(sale.total_amount)}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">{copy.noSales}</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <div>
                <div className="section-title">{copy.ledger}</div>
                <div className="section-subtitle">{copy.ledgerSub}</div>
              </div>
            </div>
            <div className="stack-list">
              {ledgerList.length ? (
                ledgerList.map((customer, index) => (
                  <div key={customer._id || index} className="stack-row">
                    <div className="customer-chip-avatar" style={{ width: 40, height: 40, fontSize: 13, background: '#fee2e2', color: '#b91c1c' }}>
                      {initials(customer.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="stack-row-title">{customer.name}</div>
                      <div className="stack-row-subtitle">{customer.phone || '-'}</div>
                    </div>
                    <div className="stack-row-value" style={{ color: '#ef4444' }}>
                      {formatCurrency(customer.totalUdhaar)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">{copy.noLedger}</div>
              )}
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div>
              <div className="section-title">{copy.stock}</div>
              <div className="section-subtitle">{copy.stockSub}</div>
            </div>
          </div>
          <div className="stack-list">
            {lowStock.length ? (
              lowStock.slice(0, 6).map((product, index) => (
                <div key={product._id || index} className="stack-row">
                  <div className="stack-row-rank" style={{ background: '#f59e0b' }}>{index + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="stack-row-title">{product.name}</div>
                    <div className="stack-row-subtitle">{locale === 'hi' ? 'मात्रा' : 'Qty'}: {product.quantity ?? 0}</div>
                  </div>
                  <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => router.push('/product')}>
                    {locale === 'hi' ? 'देखें' : 'View'}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">{copy.noStock}</div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
