'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, [selectedMonth, selectedYear]);

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
      setProducts(productList);

      const customerList = Array.isArray(customersData) ? customersData : [];
      setCustomers(customerList);

      const salesList = salesData.sales || salesData || [];
      const productSalesMap = {};

      salesList.forEach((sale) => {
        const items =
          sale.items?.length > 0
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

      const sorted = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
      setTopProducts(sorted.slice(0, 5));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  };

  const lowStock = products.filter((p) => (p.quantity ?? p.stock ?? 0) <= 5);
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);

  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(n || 0);

  if (loading) {
    return (
      <Layout>
        <div
          style={{
            minHeight: '58vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '60px 0',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              border: '4px solid rgba(226,232,240,0.95)',
              borderTopColor: '#4F46E5',
              animation: 'spin 0.75s linear infinite',
              marginBottom: 18,
              boxShadow: '0 14px 34px rgba(79,70,229,0.12)',
            }}
          />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>डैशबोर्ड लोड हो रहा है...</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
            Preparing sales, GST, credit, and inventory insights
          </div>
        </div>
      </Layout>
    );
  }

  const netGST = stats?.netGSTPayable ?? 0;
  const profit = stats?.grossProfit ?? 0;
  const totalRevenue = stats?.totalRevenue || 0;
  const gstCollected = stats?.gstCollected || 0;
  const gstITC = stats?.gstITC || 0;
  const salesCount = stats?.salesCount || 0;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const lowStockCount = lowStock.length;
  const healthyStockCount = products.filter((p) => (p.quantity ?? p.stock ?? 0) > 5).length;

  const quickLinks = [
    {
      href: '/sales',
      icon: '📈',
      title: 'New Sale',
      subtitle: 'Create invoice and bill instantly',
      gradient: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
      shadow: 'rgba(34,197,94,0.24)',
    },
    {
      href: '/purchases',
      icon: '🛒',
      title: 'Add Purchase',
      subtitle: 'Record inward stock and GST',
      gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      shadow: 'rgba(245,158,11,0.24)',
    },
    {
      href: '/product',
      icon: '📦',
      title: 'Manage Stock',
      subtitle: 'Review quantity, price, margin',
      gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)',
      shadow: 'rgba(79,70,229,0.24)',
    },
    {
      href: '/gst',
      icon: '🧾',
      title: 'GST Summary',
      subtitle: 'Check payable and export returns',
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
      shadow: 'rgba(139,92,246,0.24)',
    },
    {
      href: '/udhaar',
      icon: '📒',
      title: 'Udhaar',
      subtitle: 'Track customer collections',
      gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      shadow: 'rgba(239,68,68,0.24)',
    },
  ];

  const highlights = [
    {
      label: 'Revenue',
      value: `₹${fmt(totalRevenue)}`,
      sub: `${salesCount} invoices this month`,
      tone: '#22C55E',
      soft: '#F0FDF4',
      action: () => router.push('/sales'),
      chip: totalRevenue > 0 ? 'Sales active' : 'No sales yet',
      chipBg: '#DCFCE7',
      chipColor: '#166534',
      icon: '💰',
    },
    {
      label: 'Profit',
      value: `${profit >= 0 ? '+' : ''}₹${fmt(profit)}`,
      sub: totalRevenue > 0 ? `Margin ${profitMargin.toFixed(1)}%` : 'Report opens when sales exist',
      tone: profit >= 0 ? '#4F46E5' : '#EF4444',
      soft: profit >= 0 ? '#EEF2FF' : '#FEF2F2',
      action: () => router.push('/reports'),
      chip: profit >= 0 ? 'Healthy margin' : 'Loss alert',
      chipBg: profit >= 0 ? '#E0E7FF' : '#FEE2E2',
      chipColor: profit >= 0 ? '#4338CA' : '#B91C1C',
      icon: '📊',
    },
    {
      label: 'Customer Credit',
      value: `₹${fmt(totalCustomerUdhaar)}`,
      sub: totalCustomerUdhaar > 0 ? 'Collection pending' : 'All cleared',
      tone: totalCustomerUdhaar > 0 ? '#EF4444' : '#22C55E',
      soft: totalCustomerUdhaar > 0 ? '#FEF2F2' : '#F0FDF4',
      action: () => router.push('/udhaar'),
      chip: totalCustomerUdhaar > 0 ? 'Attention needed' : 'Up to date',
      chipBg: totalCustomerUdhaar > 0 ? '#FEE2E2' : '#DCFCE7',
      chipColor: totalCustomerUdhaar > 0 ? '#B91C1C' : '#166534',
      icon: '🤝',
    },
    {
      label: 'Net GST',
      value: `₹${fmt(Math.abs(netGST))}`,
      sub: netGST >= 0 ? 'Payable this cycle' : 'Refund / excess ITC',
      tone: netGST >= 0 ? '#F59E0B' : '#22C55E',
      soft: netGST >= 0 ? '#FFFBEB' : '#F0FDF4',
      action: () => router.push('/gst'),
      chip: netGST >= 0 ? 'Tax due' : 'Credit available',
      chipBg: netGST >= 0 ? '#FEF3C7' : '#DCFCE7',
      chipColor: netGST >= 0 ? '#92400E' : '#166534',
      icon: '🧾',
    },
  ];

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <div>
          <div className="page-title" style={{ marginBottom: 6 }}>
            डैशबोर्ड
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 620 }}>
            Premium control center for inventory, GST billing, collections, and business performance.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '10px 12px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="form-input"
            style={{ minWidth: 120, minHeight: 40, paddingTop: 9, paddingBottom: 9 }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="form-input"
            style={{ minWidth: 104, minHeight: 40, paddingTop: 9, paddingBottom: 9 }}
          >
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background:
            'linear-gradient(135deg, rgba(79,70,229,0.96) 0%, rgba(67,56,202,0.96) 48%, rgba(15,23,42,0.96) 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(79,70,229,0.22)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 68%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -70,
            left: 80,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 18,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ maxWidth: 620 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                <span>⚡</span>
                <span>{MONTHS[selectedMonth - 1]} {selectedYear} overview</span>
              </div>

              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1.08,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  marginBottom: 10,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Business pulse at a glance
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: 'rgba(255,255,255,0.80)',
                }}
              >
                See your sales momentum, GST position, stock alerts, and credit exposure without digging through screens.
              </div>
            </div>

            <div
              style={{
                minWidth: 240,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 22,
                padding: '18px 18px 16px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', fontWeight: 700 }}>
                Quick Insight
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                {salesCount > 0 ? `${salesCount} active invoices` : 'No invoices yet'}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.76)', marginTop: 6 }}>
                {lowStockCount > 0
                  ? `${lowStockCount} low stock items need attention`
                  : `Inventory looks healthy with ${healthyStockCount} well-stocked items`}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.10)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 700 }}>
                    GST In
                  </div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                    ₹{fmt(gstCollected)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.10)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 700 }}>
                    ITC
                  </div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                    ₹{fmt(gstITC)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {highlights.map((item, index) => (
          <div
            key={index}
            onClick={item.action}
            style={{
              cursor: 'pointer',
              borderRadius: 24,
              padding: '18px 18px 16px',
              background: item.soft,
              border: '1px solid rgba(255,255,255,0.95)',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.16s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: item.tone,
              }}
            />
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
                marginBottom: 14,
              }}
            >
              {item.icon}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
              {item.label}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 28,
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: '-0.05em',
                color: item.tone,
              }}
            >
              {item.value}
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-3)', minHeight: 20 }}>
              {item.sub}
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: item.chipColor,
                  background: item.chipBg,
                  padding: '5px 9px',
                  borderRadius: 999,
                }}
              >
                {item.chip}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: item.tone }}>Open →</span>
            </div>
          </div>
        ))}
      </div>

      {(totalRevenue > 0 || lowStockCount > 0 || topProducts.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
            gap: 16,
            marginBottom: 22,
          }}
          className="dashboard-grid-main"
        >
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Profit Breakdown
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  Revenue, GST, ITC, and margin on one clean view
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: profit >= 0 ? '#4338CA' : '#B91C1C',
                  background: profit >= 0 ? '#E0E7FF' : '#FEE2E2',
                  padding: '6px 10px',
                  borderRadius: 999,
                }}
              >
                {profit >= 0 ? 'Positive month' : 'Loss month'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Sales', value: totalRevenue, color: '#16A34A' },
                { label: 'Gross Profit', value: profit, color: profit >= 0 ? '#4F46E5' : '#EF4444', prefix: profit >= 0 ? '+' : '' },
                { label: 'GST Collected', value: gstCollected, color: '#D97706' },
                { label: 'Input Tax Credit', value: gstITC, color: '#8B5CF6', prefix: '−' },
                { label: 'Net GST', value: netGST, color: netGST >= 0 ? '#F59E0B' : '#22C55E' },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px',
                    borderRadius: 18,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 800,
                      marginBottom: 6,
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: item.color, letterSpacing: '-0.04em' }}>
                    {item.prefix || ''}₹{fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            {totalRevenue > 0 && (
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                    marginBottom: 8,
                    fontSize: 12,
                    color: 'var(--text-3)',
                    fontWeight: 700,
                  }}
                >
                  <span>Profit margin</span>
                  <span style={{ color: profit >= 0 ? '#4338CA' : '#B91C1C' }}>
                    {profitMargin.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: 'var(--surface-3)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.abs(profitMargin))}%`,
                      borderRadius: 999,
                      background:
                        profit >= 0
                          ? 'linear-gradient(90deg, #4F46E5 0%, #6366F1 100%)'
                          : 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lowStockCount > 0 && (
              <div
                onClick={() => router.push('/product')}
                style={{
                  cursor: 'pointer',
                  borderRadius: 24,
                  padding: '18px',
                  background: 'linear-gradient(135deg, #FFF8E7 0%, #FFFBEB 100%)',
                  border: '1px solid #FDE68A',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    marginBottom: 12,
                  }}
                >
                  ⚠️
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#92400E' }}>
                  Low Stock Alert
                </div>
                <div style={{ fontSize: 12.5, color: '#A16207', marginTop: 4 }}>
                  {lowStockCount} items are running low and need replenishment.
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {lowStock.slice(0, 4).map((p) => (
                    <span
                      key={p._id}
                      style={{
                        background: '#fff',
                        border: '1px solid #FDE68A',
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#92400E',
                      }}
                    >
                      {p.name} ({p.quantity ?? p.stock ?? 0})
                    </span>
                  ))}
                  {lowStockCount > 4 && (
                    <span
                      style={{
                        background: '#FCD34D',
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: '#78350F',
                      }}
                    >
                      +{lowStockCount - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {topProducts.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Top Products
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Highest revenue items for {MONTHS[selectedMonth - 1]} {selectedYear}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topProducts.map((p, i) => {
                    const colors = ['#22C55E', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6'];
                    const maxRevenue = topProducts[0]?.revenue || 1;
                    const barWidth = (p.revenue / maxRevenue) * 100;

                    return (
                      <div key={i}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 5,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 10,
                                background: `${colors[i]}18`,
                                color: colors[i],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {i + 1}
                            </div>
                            <div style={{ minWidth: 0 }}>
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
                              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                                {p.qty} units sold
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: 13, fontWeight: 800, color: colors[i] }}>
                            ₹{fmt(p.revenue)}
                          </div>
                        </div>

                        <div
                          style={{
                            height: 7,
                            borderRadius: 999,
                            background: 'var(--surface-3)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${barWidth}%`,
                              borderRadius: 999,
                              background: colors[i],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              Quick Actions
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
              Fastest route to the workflows you use every day
            </div>
          </div>

          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: '#4338CA',
              background: '#EEF2FF',
              padding: '6px 10px',
              borderRadius: 999,
            }}
          >
            Built for daily billing speed
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {quickLinks.map((item, index) => (
            <a
              key={index}
              href={item.href}
              style={{
                textDecoration: 'none',
                color: '#fff',
                padding: '18px',
                borderRadius: 22,
                background: item.gradient,
                boxShadow: `0 18px 34px ${item.shadow}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  right: -10,
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    marginBottom: 14,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)', marginTop: 6 }}>
                  {item.subtitle}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            Inventory Snapshot
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
            Current product health and stock posture
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Total products', value: products.length, color: '#4338CA', bg: '#EEF2FF' },
              { label: 'Healthy stock', value: healthyStockCount, color: '#166534', bg: '#DCFCE7' },
              { label: 'Low stock', value: lowStockCount, color: '#92400E', bg: '#FEF3C7' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: item.bg,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{item.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            Credit Status
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
            Understand how much money is still recoverable
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: 18,
              background: totalCustomerUdhaar > 0 ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${totalCustomerUdhaar > 0 ? '#FECACA' : '#BBF7D0'}`,
            }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--text-4)' }}>
              Pending amount
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.05em',
                color: totalCustomerUdhaar > 0 ? '#B91C1C' : '#15803D',
              }}
            >
              ₹{fmt(totalCustomerUdhaar)}
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: totalCustomerUdhaar > 0 ? '#991B1B' : '#166534' }}>
              {totalCustomerUdhaar > 0
                ? 'Customer collections need follow-up'
                : 'No outstanding udhaar at the moment'}
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            GST Position
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
            Output tax vs input credit for this cycle
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: '#FFFBEB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>GST collected</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#D97706' }}>₹{fmt(gstCollected)}</span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: '#F5F3FF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9' }}>ITC available</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#7C3AED' }}>₹{fmt(gstITC)}</span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: netGST >= 0 ? '#FEF2F2' : '#F0FDF4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: netGST >= 0 ? '#991B1B' : '#166534',
                }}
              >
                Net {netGST >= 0 ? 'payable' : 'credit'}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: netGST >= 0 ? '#DC2626' : '#16A34A',
                }}
              >
                ₹{fmt(Math.abs(netGST))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dashboard-grid-main {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Layout>
  );
}
