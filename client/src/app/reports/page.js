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
const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

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
function CsvBtn({ onClick, label = 'CSV', busy = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="btn-ghost"
      style={{ minHeight: 34, padding: '0 12px', fontSize: 12, borderRadius: 10, gap: 6, opacity: busy || disabled ? 0.7 : 1, cursor: busy || disabled ? 'not-allowed' : 'pointer' }}
    >
      <Icon name="download" size={13} />
      {busy ? 'Preparing...' : label}
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
  const [accounting,   setAccounting]   = useState(null);
  const [downloadState, setDownloadState] = useState({ active: false, tone: 'info', message: '', key: '' });
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryForm, setEntryForm] = useState({
    kind: 'expense',
    amount: '',
    date: getTodayInputValue(),
    category: 'rent',
    source: '',
    entry_type: 'deposit',
    payment_mode: 'cash',
    reference_id: '',
    note: '',
  });
  const [isOnline,     setIsOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheLoaded,  setCacheLoaded]  = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  /* ── ALL LOGIC UNCHANGED ── */
  const applyCachedSnapshot = (cached) => {
    setSales(cached?.sales || []);
    setPurchases(cached?.purchases || []);
    setCustomers(cached?.customers || []);
    setSummary(cached?.summary || {});
    setAccounting(cached?.accounting || null);
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  const fetchAll = async (hasCachedSnapshot = false) => {
    setLoading(!hasCachedSnapshot);
    const { from, to } = getRange(filter);
    const headers = { Authorization: `Bearer ${getToken()}` };
    const params  = from ? `?from=${from}&to=${to}` : '';
    try {
      const [sRes, pRes, cRes, profitRes, accountingRes] = await Promise.all([
        fetch(apiUrl(`/api/sales${params}`), { headers }),
        fetch(apiUrl(`/api/purchases${params}`), { headers }),
        fetch(apiUrl('/api/customers'), { headers }),
        fetch(apiUrl(`/api/sales/profit-summary${params}`), { headers }),
        fetch(apiUrl(`/api/accounting/summary${params}`), { headers }),
      ]);
      if ([sRes.status, pRes.status, cRes.status, profitRes.status, accountingRes.status].includes(401)) { router.push('/login'); return; }
      const sData      = sRes.ok      ? await sRes.json()      : { sales: [] };
      const pData      = pRes.ok      ? await pRes.json()      : { purchases: [] };
      const cData      = cRes.ok      ? await cRes.json()      : [];
      const profitData = profitRes.ok ? await profitRes.json() : {};
      const accountingData = accountingRes.ok ? await accountingRes.json() : null;
      const salesList      = sData.sales      || (Array.isArray(sData) ? sData : []);
      const purchasesList  = pData.purchases  || (Array.isArray(pData) ? pData : []);
      const customersList  = Array.isArray(cData) ? cData : [];
      setSales(salesList); setPurchases(purchasesList); setCustomers(customersList); setAccounting(accountingData);
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
      writePageCache(getReportsCacheKey(filter), { sales: salesList, purchases: purchasesList, customers: customersList, summary: nextSummary, accounting: accountingData });
      setCacheUpdatedAt(new Date().toISOString());
      setCacheLoaded(true);
    } catch (err) {
      console.error(err);
      if (!hasCachedSnapshot) { setSales([]); setPurchases([]); setCustomers([]); setSummary({}); setAccounting(null); }
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

  useEffect(() => {
    if (!downloadState.active || downloadState.tone === 'info') return undefined;
    const timeoutId = setTimeout(() => {
      setDownloadState((current) => ({ ...current, active: false }));
    }, 2600);
    return () => clearTimeout(timeoutId);
  }, [downloadState]);

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

  const markDownloadStarted = (message, key = 'download') => {
    setDownloadState({ active: true, tone: 'info', message, key });
  };

  const markDownloadDone = (message, key = 'download') => {
    setDownloadState({ active: true, tone: 'success', message, key });
  };

  const markDownloadFailed = (message, key = 'download') => {
    setDownloadState({ active: true, tone: 'error', message, key });
  };

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
    markDownloadStarted(`Preparing ${filename}...`, type);
    setTimeout(() => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      markDownloadDone(`${filename} download started.`, type);
    }, 180);
  };

  const downloadFile = (content, filename, mimeType, key = 'download') => {
    markDownloadStarted(`Preparing ${filename}...`, key);
    setTimeout(() => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      markDownloadDone(`${filename} download started.`, key);
    }, 180);
  };

  const fetchGSTReport = async () => {
    const { from, to } = getRange(filter);
    if (!from || !to) return null;

    setReportLoading(true);
    try {
      markDownloadStarted('Preparing GST compliance report...', 'gst-fetch');
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
      markDownloadFailed('GST report load nahi ho paaya. Please try again.', 'gst-fetch');
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
    downloadFile(JSON.stringify(report, null, 2), `GST_Report_${filter}.json`, 'application/json', 'gst-json');
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
      markDownloadFailed('CSV data available nahi hai.', type);
      alert('CSV data available nahi hai.');
      return;
    }

    const filenameMap = {
      gstr1: `GSTR1_${filter}.csv`,
      sales_register: `Sales_Register_${filter}.csv`,
      purchase_register: `Purchase_Register_${filter}.csv`,
    };

    downloadFile(csv, filenameMap[type], 'text/csv;charset=utf-8;', type);
  };

  const exportPDFReady = async () => {
    const report = await ensureGSTReport();
    if (!report?.pdf_data) {
      markDownloadFailed('PDF-ready data available nahi hai.', 'pdf-data');
      alert('PDF-ready data available nahi hai.');
      return;
    }
    downloadFile(JSON.stringify(report.pdf_data, null, 2), `GST_PDF_Data_${filter}.json`, 'application/json', 'pdf-data');
  };

  const submitAccountingEntry = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      markDownloadFailed('Offline mode me accounting entry save nahi hogi.', 'accounting-entry');
      return;
    }
    setEntrySubmitting(true);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
      const endpoint = entryForm.kind === 'expense'
        ? '/api/expenses'
        : entryForm.kind === 'income'
          ? '/api/income'
          : '/api/bank-entries';
      const payload = entryForm.kind === 'expense'
        ? {
            category: entryForm.category,
            amount: Number(entryForm.amount || 0),
            payment_mode: entryForm.payment_mode,
            reference_id: entryForm.reference_id,
            note: entryForm.note,
            date: entryForm.date,
          }
        : entryForm.kind === 'income'
          ? {
              source: entryForm.source,
              category: entryForm.category,
              amount: Number(entryForm.amount || 0),
              payment_mode: entryForm.payment_mode,
              reference_id: entryForm.reference_id,
              note: entryForm.note,
              date: entryForm.date,
            }
          : {
              entry_type: entryForm.entry_type,
              amount: Number(entryForm.amount || 0),
              reference_id: entryForm.reference_id,
              note: entryForm.note,
              date: entryForm.date,
            };

      const res = await fetch(apiUrl(endpoint), { method: 'POST', headers, body: JSON.stringify(payload) });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Entry save failed');

      markDownloadDone(`${entryForm.kind} entry saved.`, 'accounting-entry');
      setEntryForm((current) => ({
        ...current,
        amount: '',
        reference_id: '',
        note: '',
        source: current.kind === 'income' ? current.source : '',
      }));
      await fetchAll(true);
    } catch (err) {
      markDownloadFailed(err.message || 'Accounting entry save nahi hui.', 'accounting-entry');
    } finally {
      setEntrySubmitting(false);
    }
  };

  /* ── Derived display values ── */
  const partyLedgers = accounting?.party_ledgers || [];
  const customerLedgers = partyLedgers.filter((entry) => entry.type === 'customer');
  const supplierLedgers = partyLedgers.filter((entry) => entry.type === 'supplier');
  const accountingErrors = accounting?.errors || [];
  const auditTrail = accounting?.audit_trail || [];
  const expensesList = accounting?.expenses || [];
  const incomeList = accounting?.income || [];
  const { label } = getRange(filter);
  const marginPct   = Math.min(100, Math.abs(summary.margin || 0));
  const marginColor = summary.margin >= 20 ? '#10b981' : summary.margin >= 10 ? '#f59e0b' : '#f43f5e';
  const cacheLabel  = cacheUpdatedAt ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const topPartyLedgers = [...partyLedgers]
    .sort((a, b) => Math.abs(b.closing_balance || 0) - Math.abs(a.closing_balance || 0))
    .slice(0, 6);

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

        {downloadState.active && (
          <div
            role="status"
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 60,
              maxWidth: 360,
              padding: '12px 14px',
              borderRadius: 16,
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.16)',
              border: downloadState.tone === 'success'
                ? '1px solid #bbf7d0'
                : downloadState.tone === 'info'
                  ? '1px solid #bfdbfe'
                  : '1px solid #fecaca',
              background: downloadState.tone === 'success'
                ? '#ecfdf5'
                : downloadState.tone === 'info'
                  ? '#eff6ff'
                  : '#fff1f2',
              color: downloadState.tone === 'success'
                ? '#166534'
                : downloadState.tone === 'info'
                  ? '#1d4ed8'
                  : '#be123c',
            }}
          >
            <strong>{downloadState.tone === 'success' ? 'Download' : downloadState.tone === 'info' ? 'Preparing' : 'Issue'}</strong>
            {` · ${downloadState.message}`}
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
              action={<CsvBtn onClick={() => exportCSV('profit')} label="Export CSV" busy={downloadState.active && downloadState.key === 'profit'} />}
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
              action={<CsvBtn onClick={fetchGSTReport} label={reportLoading ? 'Loading...' : 'Refresh GST'} busy={reportLoading || (downloadState.active && downloadState.key === 'gst-fetch')} />}
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
                <CsvBtn onClick={() => exportGSTCsv('gstr1')} label="GSTR-1 CSV" busy={downloadState.active && downloadState.key === 'gstr1'} />
                <CsvBtn onClick={() => exportGSTCsv('sales_register')} label="Sales CSV" busy={downloadState.active && downloadState.key === 'sales_register'} />
                <CsvBtn onClick={() => exportGSTCsv('purchase_register')} label="Purchase CSV" busy={downloadState.active && downloadState.key === 'purchase_register'} />
                <CsvBtn onClick={exportGSTJson} label="GST JSON" busy={downloadState.active && downloadState.key === 'gst-json'} />
                <CsvBtn onClick={exportPDFReady} label="PDF Data" busy={downloadState.active && downloadState.key === 'pdf-data'} />
              </div>

              {(gstReport?.errors?.length ?? 0) > 0 && (
                <div className="rr-banner-warn" role="status" style={{ marginTop: 16 }}>
                  <strong>Validation issues found</strong>
                  {`: ${gstReport.errors.slice(0, 3).map((error) => `${error.identifier} ${error.message}`).join(' · ')}`}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Accounting Overview"
              eyebrow={`${label} · Double-entry ledger view`}
              badge={accountingErrors.length ? `${accountingErrors.length} issues` : 'Reconciled'}
              accentColor="linear-gradient(90deg,#0f766e,#2563eb)"
              action={<CsvBtn onClick={() => fetchAll(true)} label="Refresh" busy={entrySubmitting || (downloadState.active && downloadState.key === 'accounting-entry')} />}
            >
              <form onSubmit={submitAccountingEntry} style={{ marginBottom: 18 }}>
                <div className="reports-section-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {[
                    { value: 'expense', label: 'Add Expense' },
                    { value: 'income', label: 'Add Income' },
                    { value: 'bank', label: 'Add Bank Entry' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEntryForm((current) => ({ ...current, kind: option.value }))}
                      className="btn-ghost"
                      style={{
                        minHeight: 34,
                        padding: '0 12px',
                        borderRadius: 10,
                        background: entryForm.kind === option.value ? '#e0f2fe' : undefined,
                        color: entryForm.kind === option.value ? '#0c4a6e' : undefined,
                        borderColor: entryForm.kind === option.value ? '#7dd3fc' : undefined,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="reports-breakdown-grid" style={{ marginBottom: 12 }}>
                  <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                    <p className="reports-breakdown-label">Amount</p>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={entryForm.amount}
                      onChange={(e) => setEntryForm((current) => ({ ...current, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                    <p className="reports-breakdown-label">Date</p>
                    <input
                      className="form-input"
                      type="date"
                      value={entryForm.date}
                      onChange={(e) => setEntryForm((current) => ({ ...current, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                    <p className="reports-breakdown-label">{entryForm.kind === 'income' ? 'Source / Category' : entryForm.kind === 'expense' ? 'Expense Category' : 'Bank Entry Type'}</p>
                    {entryForm.kind === 'bank' ? (
                      <select className="form-input" value={entryForm.entry_type} onChange={(e) => setEntryForm((current) => ({ ...current, entry_type: e.target.value }))}>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="charge">Bank Charge</option>
                        <option value="interest">Interest</option>
                        <option value="transfer_in">Transfer In</option>
                        <option value="transfer_out">Transfer Out</option>
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        value={entryForm.kind === 'income' ? entryForm.source : entryForm.category}
                        onChange={(e) => setEntryForm((current) => entryForm.kind === 'income'
                          ? { ...current, source: e.target.value }
                          : { ...current, category: e.target.value }
                        )}
                        placeholder={entryForm.kind === 'income' ? 'Interest / Commission / Rent' : 'Rent / Salary / Misc'}
                        required
                      />
                    )}
                  </div>
                  <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                    <p className="reports-breakdown-label">{entryForm.kind === 'bank' ? 'Reference ID' : 'Payment Mode'}</p>
                    {entryForm.kind === 'bank' ? (
                      <input
                        className="form-input"
                        value={entryForm.reference_id}
                        onChange={(e) => setEntryForm((current) => ({ ...current, reference_id: e.target.value }))}
                        placeholder="Bank ref / cheque no."
                      />
                    ) : (
                      <select className="form-input" value={entryForm.payment_mode} onChange={(e) => setEntryForm((current) => ({ ...current, payment_mode: e.target.value }))}>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank</option>
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <input
                    className="form-input"
                    value={entryForm.note}
                    onChange={(e) => setEntryForm((current) => ({ ...current, note: e.target.value }))}
                    placeholder="Note / narration"
                  />
                  <button type="submit" className="btn-primary" disabled={entrySubmitting || !entryForm.amount} style={{ width: 'auto', minHeight: 42, padding: '0 18px' }}>
                    {entrySubmitting ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </form>

            </SectionCard>

            <SectionCard
              title="Ledger Snapshot"
              eyebrow={`${label} · Closing positions`}
              badge={partyLedgers.length ? `${partyLedgers.length} ledgers` : 'No activity'}
              accentColor="linear-gradient(90deg,#0f766e,#2563eb)"
            >
              <div className="reports-breakdown-grid" style={{ marginBottom: 16 }}>
                {[
                  { l: 'Cash Closing', v: accounting?.cash_account?.closing_balance ?? 0, color: '#065f46', bg: '#f0fdf4', hint: `Opening ₹${fmtN(accounting?.cash_account?.opening_balance ?? 0)}` },
                  { l: 'Bank Closing', v: accounting?.bank_account?.closing_balance ?? 0, color: '#1d4ed8', bg: '#eff6ff', hint: `Opening ₹${fmtN(accounting?.bank_account?.opening_balance ?? 0)}` },
                  { l: 'Customer Ledgers', v: customerLedgers.length, color: '#9f1239', bg: '#fff1f2', hint: 'parties tracked' },
                  { l: 'Supplier Ledgers', v: supplierLedgers.length, color: '#92400e', bg: '#fffbeb', hint: 'parties tracked' },
                ].map((item) => (
                  <div
                    key={item.l}
                    className="dashboard-breakdown-card reports-breakdown-card"
                    style={{ background: item.bg, borderColor: item.bg }}
                  >
                    <p className="reports-breakdown-label">{item.l}</p>
                    <p className="reports-breakdown-value" style={{ color: item.color }}>{typeof item.v === 'number' && item.l.includes('Ledgers') ? fmtN(item.v) : `₹${fmtN(item.v)}`}</p>
                    <p className="page-subtitle" style={{ marginTop: 4 }}>{item.hint}</p>
                  </div>
                ))}
              </div>

              {topPartyLedgers.length > 0 && (
                <div className="reports-stack-list">
                  {topPartyLedgers.map((party) => (
                    <div key={`${party.type}-${party.party_id}`} className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-customer-avatar" style={{ background: party.type === 'customer' ? 'linear-gradient(135deg,#fb7185,#f43f5e)' : 'linear-gradient(135deg,#f59e0b,#f97316)' }}>
                        {party.party_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">{party.party_name}</p>
                        <p className="reports-stack-meta">Opening ₹{fmtN(party.opening_balance)} · {party.transactions.length} entries</p>
                      </div>
                      <div className="reports-stack-metrics">
                        <p className="reports-stack-value">₹{fmtN(party.closing_balance)}</p>
                        <p className="reports-stack-note">{party.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {accountingErrors.length > 0 && (
                <div className="rr-banner-warn" role="status" style={{ marginTop: 16 }}>
                  <strong>Accounting validation</strong>
                  {`: ${accountingErrors.slice(0, 3).map((error) => error.message).join(' · ')}`}
                </div>
              )}
            </SectionCard>

            <div className="reports-two-col reports-split-grid">
              <SectionCard
                title="Expenses"
                eyebrow={`${label} · Categorized outflow`}
                badge={`${expensesList.length} entries`}
                accentColor="linear-gradient(90deg,#ef4444,#f97316)"
                action={<CsvBtn onClick={() => router.push('/expenses')} label="Open Expenses" />}
              >
                {expensesList.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <p style={{ fontWeight: 700, color: '#334155' }}>No expenses recorded</p>
                  </div>
                ) : (
                  <div className="reports-stack-list">
                    {expensesList.slice(0, 6).map((expense) => (
                      <div key={expense.id} className="dashboard-top-card stack-row reports-stack-row">
                        <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>₹</div>
                        <div className="reports-stack-copy">
                          <p className="reports-stack-title">{expense.category}</p>
                          <p className="reports-stack-meta">{new Date(expense.date).toLocaleDateString('en-IN')} · {expense.payment_mode || 'mode missing'}</p>
                        </div>
                        <div className="reports-stack-metrics">
                          <p className="reports-stack-value">₹{fmtN(expense.amount)}</p>
                          <p className="reports-stack-note">{expense.reference_id || 'manual'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Other Income & Audit"
                eyebrow={`${label} · Non-sales + change history`}
                badge={`${auditTrail.length} audit rows`}
                accentColor="linear-gradient(90deg,#2563eb,#7c3aed)"
              >
                <div className="reports-stack-list" style={{ marginBottom: 14 }}>
                  {incomeList.length === 0 ? (
                    <div className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>i</div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">No non-sales income</p>
                        <p className="reports-stack-meta">Interest, rent, commission ya other receipts yahan aayenge</p>
                      </div>
                    </div>
                  ) : incomeList.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>+</div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">{entry.source}</p>
                        <p className="reports-stack-meta">{entry.category} · {entry.payment_mode}</p>
                      </div>
                      <div className="reports-stack-metrics">
                        <p className="reports-stack-value">₹{fmtN(entry.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="reports-stack-list">
                  {auditTrail.slice(0, 5).map((entry, index) => (
                    <div key={`${entry.entity}-${entry.entity_id}-${index}`} className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#cbd5e1,#94a3b8)', color: '#0f172a' }}>{entry.action_type.charAt(0).toUpperCase()}</div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">{entry.entity}</p>
                        <p className="reports-stack-meta">{new Date(entry.timestamp).toLocaleString('en-IN')} · user {String(entry.user_id).slice(-6)}</p>
                      </div>
                      <div className="reports-stack-metrics">
                        <p className="reports-stack-note">{entry.reference_id || entry.entity_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* ══════════════════════════════════════════════════════
                DAILY SALES TABLE
            ══════════════════════════════════════════════════════ */}
            {dailySales.length > 0 && (
              <SectionCard
                title="Daily Sales Breakdown"
                eyebrow={`${label} · Day-by-day`}
                badge={`${dailySales.length} days`}
                accentColor="linear-gradient(90deg,#6366f1,#8b5cf6)"
                action={<CsvBtn onClick={() => exportCSV('sales')} label="Sales CSV" busy={downloadState.active && downloadState.key === 'sales'} />}
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
                action={<CsvBtn onClick={() => exportCSV('products')} busy={downloadState.active && downloadState.key === 'products'} />}
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
                action={<CsvBtn onClick={() => exportCSV('customers')} busy={downloadState.active && downloadState.key === 'customers'} />}
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
