'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

/* ─── Helpers (ALL UNCHANGED) ───────────────────────────────────── */
const getToken = () => localStorage.getItem('token');
const REPORTS_CACHE_PREFIX = 'reports-page-v1';
const fmt  = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const formatShortReportDate = (value) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
const getReportsCacheKey = (filter) => `${REPORTS_CACHE_PREFIX}:${filter}`;

const getRange = (filter) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') return { from: today.toISOString(), to: new Date(today.getTime() + 86400000 - 1).toISOString(), label: 'Today' };
  if (filter === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), label: 'This Week' };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), label: 'This Month' };
  }
  return { from: null, to: null, label: 'All Time' };
};

/* ─── Tiny icon ─────────────────────────────────────────────────── */
function Icon({ name, size = 16 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    trend_up: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    bar:      <><path d="M5 19.5V10.5"/><path d="M12 19.5V5.5"/><path d="M19 19.5V13.5"/><path d="M3.5 19.5h17"/></>,
    alert:    <><path d="M10.3 3.3 1.5 18a2 2 0 0 0 1.7 3h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    gst:      <><path d="M7 4.5h10"/><path d="M7 9.5h10"/><path d="M7 14.5h5"/><path d="M16.5 13v7"/><path d="M13.5 16h6"/><rect x="4" y="3" width="16" height="18" rx="2.5"/></>,
    users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    package:  <><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z"/><path d="M4 7.5V16.5L12 21l8-4.5V7.5"/><path d="M12 12v9"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>,
    rupee:    <><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3a4 4 0 0 0 0-8"/></>,
  };
  return <svg {...p}>{icons[name]}</svg>;
}

/* ─── Reusable section card ─────────────────────────────────────── */
function SectionCard({ title, eyebrow, badge, action, children, accentColor = '#06b6d4' }) {
  return (
    <div className="card reports-section-card">
      {/* Top accent line */}
      <div className="reports-section-accent" style={{ background: accentColor }} />
      <div className="reports-section-head">
        <div>
          {eyebrow && <p className="rr-page-eyebrow reports-section-eyebrow">{eyebrow}</p>}
          <h2 className="section-title reports-section-title">{title}</h2>
        </div>
        <div className="reports-section-actions">
          {badge && <span className="badge">{badge}</span>}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── CSV export button ─────────────────────────────────────────── */
function CsvBtn({ onClick, label = 'CSV' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-ghost"
      style={{ minHeight: 34, padding: '0 12px', fontSize: 12, borderRadius: 10, gap: 6 }}
    >
      <Icon name="download" size={13} />
      {label}
    </button>
  );
}

/* ─── Metric mini-card ──────────────────────────────────────────── */
function KpiCard({ label, value, sub, barColor, valueColor, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="metric-card reports-kpi-card"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="reports-kpi-bar" style={{ background: barColor }} />
      <div className="reports-kpi-body">
        <div className="reports-kpi-top">
          <p className="metric-label reports-kpi-label">{label}</p>
          {icon && (
            <div className="reports-kpi-icon">
              <Icon name={icon} size={15} />
            </div>
          )}
        </div>
        <p className="metric-value reports-kpi-value" style={{ color: valueColor }}>{value}</p>
        {sub && <p className="page-subtitle reports-kpi-sub">{sub}</p>}
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const router = useRouter();
  const [filter,       setFilter]       = useState('month');
  const [loading,      setLoading]      = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [sales,        setSales]        = useState([]);
  const [purchases,    setPurchases]    = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [summary,      setSummary]      = useState({});
  const [gstReport,    setGstReport]    = useState(null);
  const [isOnline,     setIsOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheLoaded,  setCacheLoaded]  = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  /* ── ALL LOGIC UNCHANGED ── */
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
    const params  = from ? `?from=${from}&to=${to}` : '';
    try {
      const [sRes, pRes, cRes, profitRes] = await Promise.all([
        fetch(apiUrl(`/api/sales${params}`), { headers }),
        fetch(apiUrl(`/api/purchases${params}`), { headers }),
        fetch(apiUrl('/api/customers'), { headers }),
        fetch(apiUrl(`/api/sales/profit-summary${params}`), { headers }),
      ]);
      if ([sRes.status, pRes.status, cRes.status, profitRes.status].includes(401)) { router.push('/login'); return; }
      const sData      = sRes.ok      ? await sRes.json()      : { sales: [] };
      const pData      = pRes.ok      ? await pRes.json()      : { purchases: [] };
      const cData      = cRes.ok      ? await cRes.json()      : [];
      const profitData = profitRes.ok ? await profitRes.json() : {};
      const salesList      = sData.sales      || (Array.isArray(sData) ? sData : []);
      const purchasesList  = pData.purchases  || (Array.isArray(pData) ? pData : []);
      const customersList  = Array.isArray(cData) ? cData : [];
      setSales(salesList); setPurchases(purchasesList); setCustomers(customersList);
      const totalRevenue  = profitData.totalRevenue  ?? salesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalGST      = profitData.gstCollected  ?? salesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const grossProfit   = profitData.grossProfit   ?? salesList.reduce((s, x) => s + (x.gross_profit || 0), 0);
      const totalPurchase = profitData.totalSpent    ?? purchasesList.reduce((s, x) => s + (x.total_amount || 0), 0);
      const totalITC      = profitData.gstITC        ?? purchasesList.reduce((s, x) => s + (x.total_gst || 0), 0);
      const totalUdhaar   = customersList.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
      const taxableRev    = profitData.totalTaxable  ?? (totalRevenue - totalGST);
      const margin        = taxableRev > 0 ? ((grossProfit / taxableRev) * 100) : 0;
      const nextSummary   = { totalRevenue, totalGST, grossProfit, totalPurchase, totalITC, totalUdhaar, margin, salesCount: profitData.salesCount ?? salesList.length, netGST: profitData.netGSTPayable ?? (totalGST - totalITC) };
      setSummary(nextSummary);
      writePageCache(getReportsCacheKey(filter), { sales: salesList, purchases: purchasesList, customers: customersList, summary: nextSummary });
      setCacheUpdatedAt(new Date().toISOString());
      setCacheLoaded(true);
    } catch (err) {
      console.error(err);
      if (!hasCachedSnapshot) { setSales([]); setPurchases([]); setCustomers([]); setSummary({}); }
    }
    setLoading(false);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(getReportsCacheKey(filter));
    if (cached) { applyCachedSnapshot(cached); setLoading(false); } else { setCacheLoaded(false); setLoading(true); }
    const deferredId = scheduleDeferred(() => fetchAll(Boolean(cached)));
    return () => cancelDeferred(deferredId);
  }, [filter, router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    setGstReport(null);
  }, [filter]);

  /* ── Derived data (ALL UNCHANGED) ── */
  const topProducts = (() => {
    const map = {};
    sales.forEach((sale) => {
      const items = sale.items?.length > 0 ? sale.items : [{ product_name: sale.product_name, quantity: sale.quantity || 0, total_amount: sale.total_amount || 0, gross_profit: sale.gross_profit || 0, taxable_amount: sale.taxable_amount || 0, cost_price: sale.cost_price || 0 }];
      items.forEach((item) => {
        const key = item.product_name; if (!key) return;
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0, profit: 0, count: 0 };
        const itemProfit = item.gross_profit != null ? item.gross_profit : (item.taxable_amount || 0) - ((item.cost_price || 0) * (item.quantity || 0));
        map[key].qty += item.quantity || 0; map[key].revenue += item.total_amount || 0; map[key].profit += itemProfit || 0; map[key].count += 1;
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
      map[key].revenue += sale.total_amount || 0; map[key].count += 1;
    });
    customers.forEach((c) => { if (map[c.name]) map[c.name].udhaar = c.totalUdhaar || 0; });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  const dailySales = (() => {
    const map = {};
    sales.forEach((sale) => {
      const src     = sale.createdAt || sale.sold_at;
      const dateKey = new Date(src).toISOString().slice(0, 10);
      if (!map[dateKey]) map[dateKey] = { date: formatShortReportDate(src), sortValue: new Date(src).getTime(), revenue: 0, profit: 0, count: 0 };
      map[dateKey].revenue += sale.total_amount || 0; map[dateKey].profit += sale.gross_profit || 0; map[dateKey].count += 1;
    });
    return Object.values(map).sort((a, b) => b.sortValue - a.sortValue);
  })();

  const exportCSV = (type) => {
    const { label } = getRange(filter);
    let rows = []; let filename = '';
    if (type === 'sales') {
      rows = [['Sales Report - ' + label], ['Invoice No','Date','Product','Buyer','Taxable','GST','Total','Profit','Payment'], ...sales.map((s) => [s.invoice_number, new Date(s.createdAt || s.sold_at).toLocaleDateString('en-IN'), s.items?.length > 1 ? `${s.items.length} items` : s.product_name, s.buyer_name || 'Walk-in', fmt(s.taxable_amount), fmt(s.total_gst), fmt(s.total_amount), fmt(s.gross_profit), s.payment_type])];
      filename = `Sales_Report_${label.replace(' ', '_')}.csv`;
    }
    if (type === 'profit') {
      rows = [['Profit Report - ' + label], ['Metric','Amount'], ['Total Revenue', `₹${fmt(summary.totalRevenue)}`], ['Total GST Collected', `₹${fmt(summary.totalGST)}`], ['Net Revenue (Taxable)', `₹${fmt((summary.totalRevenue || 0) - (summary.totalGST || 0))}`], ['Profit', `₹${fmt(summary.grossProfit)}`], ['Profit Margin', `${fmt(summary.margin)}%`], ['Total Purchases', `₹${fmt(summary.totalPurchase)}`], ['GST Input Credit (ITC)', `₹${fmt(summary.totalITC)}`], ['Net GST Payable', `₹${fmt(summary.netGST)}`]];
      filename = `Profit_Report_${label.replace(' ', '_')}.csv`;
    }
    if (type === 'products') {
      rows = [['Top Products - ' + label], ['Product','Units Sold','Revenue','Profit','Orders'], ...topProducts.map((p) => [p.name, p.qty, fmt(p.revenue), fmt(p.profit), p.count])];
      filename = `Top_Products_${label.replace(' ', '_')}.csv`;
    }
    if (type === 'customers') {
      rows = [['Top Customers - ' + label], ['Customer','Phone','Orders','Total Spent','Udhaar Pending'], ...topCustomers.map((c) => [c.name, c.phone, c.count, fmt(c.revenue), fmt(c.udhaar)])];
      filename = `Top_Customers_${label.replace(' ', '_')}.csv`;
    }
    const csv  = rows.map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchGSTReport = async () => {
    const { from, to } = getRange(filter);
    if (!from || !to) return null;

    setReportLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/sales/gst-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (res.status === 401) { router.push('/login'); return null; }
      if (!res.ok) throw new Error('GST report fetch failed');
      const data = await res.json();
      setGstReport(data);
      return data;
    } catch (err) {
      console.error(err);
      alert('GST report load nahi ho paaya. Please try again.');
      return null;
    } finally {
      setReportLoading(false);
    }
  };

  const ensureGSTReport = async () => gstReport || await fetchGSTReport();

  const exportGSTJson = async () => {
    const report = await ensureGSTReport();
    if (!report) return;
    downloadFile(JSON.stringify(report, null, 2), `GST_Report_${filter}.json`, 'application/json');
  };

  const exportGSTCsv = async (type) => {
    const report = await ensureGSTReport();
    if (!report) return;

    const csv = type === 'gstr1'
      ? report?.gstr1?.csv
      : type === 'sales_register'
        ? report?.sales_register?.csv
        : report?.purchase_register?.csv;

    if (!csv) {
      alert('CSV data available nahi hai.');
      return;
    }

    const filenameMap = {
      gstr1: `GSTR1_${filter}.csv`,
      sales_register: `Sales_Register_${filter}.csv`,
      purchase_register: `Purchase_Register_${filter}.csv`,
    };

    downloadFile(csv, filenameMap[type], 'text/csv;charset=utf-8;');
  };

  const exportPDFReady = async () => {
    const report = await ensureGSTReport();
    if (!report?.pdf_data) {
      alert('PDF-ready data available nahi hai.');
      return;
    }
    downloadFile(JSON.stringify(report.pdf_data, null, 2), `GST_PDF_Data_${filter}.json`, 'application/json');
  };

  /* ── Derived display values ── */
  const { label } = getRange(filter);
  const marginPct   = Math.min(100, Math.abs(summary.margin || 0));
  const marginColor = summary.margin >= 20 ? '#10b981' : summary.margin >= 10 ? '#f59e0b' : '#f43f5e';
  const cacheLabel  = cacheUpdatedAt ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  const FILTERS = [
    { val: 'today', label: 'Today' },
    { val: 'week',  label: 'Week'  },
    { val: 'month', label: 'Month' },
  ];

  /* ── Rank gradient backgrounds ── */
  const rankBg = [
    'linear-gradient(135deg,#06b6d4,#6366f1)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
    'linear-gradient(135deg,#f59e0b,#f97316)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#64748b,#475569)',
  ];

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="page-shell reports-shell">

        {/* ── OFFLINE BANNER ── */}
        {!isOnline && (
          <div className="rr-banner-warn" role="status">
            <strong>Offline reports view</strong>
            Saved snapshot dikh raha hai{cacheLabel ? ` · last updated ${cacheLabel}` : ''}. Internet aane par fresh data load hoga.
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════ */}
        <div className="hero-panel reports-hero">
          <div className="reports-hero-header">
            {/* Left */}
            <div className="reports-hero-copy">
              <p className="rr-page-eyebrow">Business analytics</p>
              <h1 className="page-title reports-hero-title">Reports / हिसाब</h1>
              <p className="reports-hero-subtitle">
                {label.toLowerCase()} ke liye revenue, profit, GST aur customer trends ek clean view mein.
              </p>
              {!isOnline ? (
                <p className="rr-meta-line is-warn reports-hero-meta">Offline snapshot · {cacheLabel || 'no network'}</p>
              ) : cacheLoaded && cacheLabel ? (
                <p className="rr-meta-line reports-hero-meta">
                  <span className="status-dot is-green" style={{ marginRight: 6 }} />
                  Last synced {cacheLabel}
                </p>
              ) : null}
            </div>

            {/* Period filter pills */}
            <div className="reports-filter-pills">
              {FILTERS.map((f) => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => setFilter(f.val)}
                  className={`filter-pill${filter === f.val ? ' is-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="reports-hero-summary">
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">Revenue Snapshot</span>
              <strong className="reports-hero-summary-value">₹{fmtN(summary.totalRevenue)}</strong>
              <span className="reports-hero-summary-note">{summary.salesCount || 0} invoices tracked</span>
            </div>
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">Net Profit</span>
              <strong className="reports-hero-summary-value is-emerald">₹{fmtN(summary.grossProfit)}</strong>
              <span className="reports-hero-summary-note">Margin {fmt(summary.margin)}%</span>
            </div>
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">GST Position</span>
              <strong className="reports-hero-summary-value is-amber">₹{fmtN(summary.netGST)}</strong>
              <span className="reports-hero-summary-note">Payable after ITC</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            KPI STRIP — 4 cards
        ══════════════════════════════════════════════════════════ */}
        {!loading && (
          <div className="reports-kpi-grid">
            <KpiCard
              label="Revenue"
              value={`₹${fmtN(summary.totalRevenue)}`}
              sub={`${summary.salesCount || 0} invoices`}
              barColor="linear-gradient(90deg,#06b6d4,#6366f1)"
              valueColor="#0e7490"
              icon="rupee"
            />
            <KpiCard
              label="Profit"
              value={`₹${fmtN(summary.grossProfit)}`}
              sub={`Margin ${fmt(summary.margin)}%`}
              barColor={summary.grossProfit >= 0 ? 'linear-gradient(90deg,#10b981,#06b6d4)' : 'linear-gradient(90deg,#f43f5e,#fb923c)'}
              valueColor={summary.grossProfit >= 0 ? '#065f46' : '#9f1239'}
              icon="trend_up"
            />
            <KpiCard
              label="GST Payable"
              value={`₹${fmtN(summary.netGST)}`}
              sub={`ITC ₹${fmtN(summary.totalITC)}`}
              barColor="linear-gradient(90deg,#f59e0b,#f97316)"
              valueColor="#92400e"
              icon="gst"
            />
            <KpiCard
              label="Udhaar Pending"
              value={`₹${fmtN(summary.totalUdhaar)}`}
              sub="Collection बाकी"
              barColor={summary.totalUdhaar > 0 ? 'linear-gradient(90deg,#f43f5e,#fb7185)' : 'linear-gradient(90deg,#10b981,#34d399)'}
              valueColor={summary.totalUdhaar > 0 ? '#9f1239' : '#065f46'}
              icon="users"
            />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="reports-kpi-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 20 }} />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ══════════════════════════════════════════════════════
                PROFIT BREAKDOWN — full width premium card
            ══════════════════════════════════════════════════════ */}
            <SectionCard
              title="Profit Breakdown"
              eyebrow={`${label} · Financial Summary`}
              accentColor="linear-gradient(90deg,#10b981,#06b6d4)"
              action={<CsvBtn onClick={() => exportCSV('profit')} label="Export CSV" />}
            >
              {/* Two-column breakdown grid */}
              <div className="reports-breakdown-grid">
                {[
                  { l: 'Total Revenue',    v: summary.totalRevenue,                                      color: '#0e7490',  bg: '#ecfeff' },
                  { l: 'GST Collected',    v: summary.totalGST,                                          color: '#92400e',  bg: '#fffbeb' },
                  { l: 'Taxable Revenue',  v: (summary.totalRevenue || 0) - (summary.totalGST || 0),     color: '#1e40af',  bg: '#eff6ff' },
                  { l: 'Gross Profit',     v: summary.grossProfit,                                        color: summary.grossProfit >= 0 ? '#065f46' : '#9f1239', bg: summary.grossProfit >= 0 ? '#f0fdf4' : '#fff1f2' },
                  { l: 'Total Purchase',   v: summary.totalPurchase,                                     color: '#6d28d9',  bg: '#f5f3ff' },
                  { l: 'Input Tax Credit', v: summary.totalITC,                                          color: '#0891b2',  bg: '#ecfeff' },
                ].map(item => (
                  <div
                    key={item.l}
                    className="dashboard-breakdown-card reports-breakdown-card"
                    style={{ background: item.bg, borderColor: item.bg }}
                  >
                    <p className="reports-breakdown-label">{item.l}</p>
                    <p className="reports-breakdown-value" style={{ color: item.color }}>₹{fmtN(item.v)}</p>
                  </div>
                ))}
              </div>

              {/* Margin progress bar */}
              {(summary.totalRevenue || 0) > 0 && (
                <div className="reports-margin-card">
                  <div className="reports-margin-head">
                    <span className="reports-margin-title">Profit Margin Progress</span>
                    <strong style={{ color: marginColor, fontSize: 15 }}>{fmt(summary.margin)}%</strong>
                  </div>
                  <div className="reports-margin-track">
                    <div style={{ height: '100%', borderRadius: 99, width: `${marginPct}%`, background: `linear-gradient(90deg,${marginColor},${marginColor}aa)`, transition: 'width 600ms ease' }} />
                  </div>
                  <div className="reports-margin-foot">
                    <span>0%</span>
                    <span style={{ color: marginColor, fontWeight: 700 }}>
                      {summary.margin >= 20 ? '✓ Healthy margin' : summary.margin >= 10 ? '⚡ Improving' : '↗ Needs attention'}
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Net GST payable highlight */}
              <div className="reports-gst-highlight">
                <div>
                  <p className="reports-gst-highlight-label">Net GST Payable</p>
                  <p className="reports-gst-highlight-note">GST Collected − Input Tax Credit</p>
                </div>
                <p className="reports-gst-highlight-value">₹{fmtN(summary.netGST)}</p>
              </div>
            </SectionCard>

            <SectionCard
              title="GST Compliance Exports"
              eyebrow={`${label} · Filing-ready formats`}
              badge={gstReport?.errors?.length ? `${gstReport.errors.length} validation issues` : 'Validated output'}
              accentColor="linear-gradient(90deg,#f59e0b,#ef4444)"
              action={<CsvBtn onClick={fetchGSTReport} label={reportLoading ? 'Loading...' : 'Refresh GST'} />}
            >
              <div className="reports-breakdown-grid" style={{ marginBottom: 16 }}>
                {[
                  { l: 'GSTR-1 CSV', v: gstReport?.gstr1?.json?.total_invoices ?? sales.length, color: '#92400e', bg: '#fffbeb', hint: 'sales invoices' },
                  { l: 'Sales Register', v: gstReport?.sales_register?.json?.length ?? sales.length, color: '#0e7490', bg: '#ecfeff', hint: 'rows ready' },
                  { l: 'Purchase Register', v: gstReport?.purchase_register?.json?.length ?? purchases.length, color: '#6d28d9', bg: '#f5f3ff', hint: 'rows ready' },
                  { l: 'Validation Errors', v: gstReport?.errors?.length ?? 0, color: (gstReport?.errors?.length ?? 0) > 0 ? '#9f1239' : '#065f46', bg: (gstReport?.errors?.length ?? 0) > 0 ? '#fff1f2' : '#f0fdf4', hint: 'must review' },
                ].map((item) => (
                  <div
                    key={item.l}
                    className="dashboard-breakdown-card reports-breakdown-card"
                    style={{ background: item.bg, borderColor: item.bg }}
                  >
                    <p className="reports-breakdown-label">{item.l}</p>
                    <p className="reports-breakdown-value" style={{ color: item.color }}>{fmtN(item.v)}</p>
                    <p className="page-subtitle" style={{ marginTop: 4 }}>{item.hint}</p>
                  </div>
                ))}
              </div>

              <div className="reports-section-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <CsvBtn onClick={() => exportGSTCsv('gstr1')} label="GSTR-1 CSV" />
                <CsvBtn onClick={() => exportGSTCsv('sales_register')} label="Sales CSV" />
                <CsvBtn onClick={() => exportGSTCsv('purchase_register')} label="Purchase CSV" />
                <CsvBtn onClick={exportGSTJson} label="GST JSON" />
                <CsvBtn onClick={exportPDFReady} label="PDF Data" />
              </div>

              {(gstReport?.errors?.length ?? 0) > 0 && (
                <div className="rr-banner-warn" role="status" style={{ marginTop: 16 }}>
                  <strong>Validation issues found</strong>
                  {`: ${gstReport.errors.slice(0, 3).map((error) => `${error.identifier} ${error.message}`).join(' · ')}`}
                </div>
              )}
            </SectionCard>

            {/* ══════════════════════════════════════════════════════
                DAILY SALES TABLE
            ══════════════════════════════════════════════════════ */}
            {dailySales.length > 0 && (
              <SectionCard
                title="Daily Sales Breakdown"
                eyebrow={`${label} · Day-by-day`}
                badge={`${dailySales.length} days`}
                accentColor="linear-gradient(90deg,#6366f1,#8b5cf6)"
                action={<CsvBtn onClick={() => exportCSV('sales')} label="Sales CSV" />}
              >
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Date</th>
                        <th style={{ width: 70 }}>Orders</th>
                        <th>Revenue</th>
                        <th>Profit</th>
                        <th style={{ width: 90 }}>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySales.map((day, i) => {
                        const dm = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0;
                        const mc = dm >= 20 ? '#065f46' : dm >= 10 ? '#92400e' : '#9f1239';
                        const mb = dm >= 20 ? '#ecfdf5' : dm >= 10 ? '#fffbeb' : '#fff1f2';
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>{day.date}</td>
                            <td>
                              <span className="badge" style={{ fontSize: 11 }}>{day.count}</span>
                            </td>
                            <td style={{ fontWeight: 800, color: '#0e7490' }}>₹{fmtN(day.revenue)}</td>
                            <td style={{ fontWeight: 800, color: day.profit >= 0 ? '#065f46' : '#9f1239' }}>₹{fmtN(day.profit)}</td>
                            <td>
                              <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 800, background: mb, color: mc }}>
                                {dm.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* ══════════════════════════════════════════════════════
                TWO-COLUMN: Top Products + Top Customers
            ══════════════════════════════════════════════════════ */}
            <div className="reports-two-col reports-split-grid">
              {/* Top Products */}
              <SectionCard
                title="Top Products"
                eyebrow={`${label} · Most sold`}
                badge={topProducts.length > 0 ? `${topProducts.length} items` : null}
                accentColor="linear-gradient(90deg,#06b6d4,#10b981)"
                action={<CsvBtn onClick={() => exportCSV('products')} />}
              >
                {topProducts.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <div className="empty-state-icon" style={{ fontSize: 28 }}>📦</div>
                    <p style={{ fontWeight: 700, color: '#334155' }}>No product data</p>
                    <p className="page-subtitle" style={{ marginTop: 4 }}>Is period mein koi sale nahi mili</p>
                  </div>
                ) : (
                  <div className="reports-stack-list">
                    {topProducts.map((p, i) => (
                      <div
                        key={i}
                        className="dashboard-top-card stack-row reports-stack-row"
                        style={{ background: i === 0 ? 'rgba(6,182,212,0.05)' : undefined }}
                      >
                        {/* Rank */}
                        <div className="reports-rank-badge" style={{ background: rankBg[i % rankBg.length] }}>
                          {i + 1}
                        </div>
                        {/* Name + meta */}
                        <div className="reports-stack-copy">
                          <p className="reports-stack-title">{p.name}</p>
                          <p className="reports-stack-meta">{p.qty} units · {p.count} orders</p>
                        </div>
                        {/* Revenue + profit */}
                        <div className="reports-stack-metrics">
                          <p className="reports-stack-value">₹{fmtN(p.revenue)}</p>
                          <p className="reports-stack-note">₹{fmtN(p.profit)} profit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Top Customers */}
              <SectionCard
                title="Top Customers"
                eyebrow={`${label} · Best buyers`}
                badge={topCustomers.length > 0 ? `${topCustomers.length} customers` : null}
                accentColor="linear-gradient(90deg,#8b5cf6,#ec4899)"
                action={<CsvBtn onClick={() => exportCSV('customers')} />}
              >
                {topCustomers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <div className="empty-state-icon" style={{ fontSize: 28 }}>👥</div>
                    <p style={{ fontWeight: 700, color: '#334155' }}>No customer data</p>
                    <p className="page-subtitle" style={{ marginTop: 4 }}>Is period mein koi named sale nahi mili</p>
                  </div>
                ) : (
                  <div className="reports-stack-list">
                    {topCustomers.map((c, i) => (
                      <div
                        key={i}
                        className="dashboard-top-card stack-row reports-stack-row"
                        style={{ background: i === 0 ? 'rgba(139,92,246,0.05)' : undefined }}
                      >
                        {/* Avatar with initial */}
                        <div className="reports-customer-avatar" style={{ background: rankBg[i % rankBg.length] }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Name + meta */}
                        <div className="reports-stack-copy">
                          <p className="reports-stack-title">{c.name}</p>
                          <p className="reports-stack-meta">{c.count} orders{c.phone ? ` · ${c.phone}` : ''}</p>
                        </div>
                        {/* Revenue + udhaar */}
                        <div className="reports-stack-metrics">
                          <p className="reports-stack-value">₹{fmtN(c.revenue)}</p>
                          {c.udhaar > 0 && (
                            <p className="reports-stack-note reports-stack-note-danger">₹{fmtN(c.udhaar)} due</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Empty state */}
            {sales.length === 0 && purchases.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p style={{ fontWeight: 800, color: '#334155', fontSize: 15, marginBottom: 6 }}>Is period mein koi data nahi</p>
                <p className="page-subtitle">Sales ya purchases record karo — reports yahan dikhenge</p>
              </div>
            )}
          </>
        )}
      </div>

    </Layout>
  );
}
