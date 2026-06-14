'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';
import { fmt, fmtINR } from '../../lib/constants';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import { validateGSTINChecksum } from '../../lib/gstValidation';
import Gstr1PreflightModal from './components/Gstr1PreflightModal';
import Gstr2bReconciliation from './components/Gstr2bReconciliation';

/* ─── Constants & pure helpers ───────────────────────────────────── */
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_HI = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getToken  = () => localStorage.getItem('token');
const GST_CACHE_PREFIX = 'gst-page-v1';
const round2    = (value) => parseFloat(Number(value || 0).toFixed(2));
const getGSTCacheKey = (month, year) => `${GST_CACHE_PREFIX}:${year}:${month}`;
const safeText  = (value = '') => String(value || '')
  .replace(/â€"|â€"/g, '-').replace(/â€™/g, "'").replace(/â€œ|â€/g, '"').replace(/â€¦/g, '...');

const getRecordGstRate = (record = {}) => {
  if (record?.items?.length) {
    const itemRate = Number(record.items.find((item) => Number(item?.gst_rate || 0) > 0)?.gst_rate || 0);
    if (itemRate > 0) return itemRate;
  }
  return Number(record?.gst_rate || 0);
};
const getRecordGstType = (record = {}) => {
  if (record?.gst_type === 'IGST' || record?.gst_type === 'CGST_SGST') return record.gst_type;
  if (Number(record?.igst_amount || 0) > 0) return 'IGST';
  return 'CGST_SGST';
};
const getRecordInvoiceType = (record = {}, kind = 'sale') => {
  if (record?.invoice_type === 'B2B' || record?.invoice_type === 'B2C') return record.invoice_type;
  const gstin = kind === 'sale' ? record?.buyer_gstin : record?.supplier_gstin;
  return gstin ? 'B2B' : 'B2C';
};

// Bug 1 fix: floor/ceil split avoids floating-point asymmetry for odd paise values
const getRecordTaxHeads = (record = {}) => {
  const directCgst = Number(record?.cgst_amount || 0);
  const directSgst = Number(record?.sgst_amount || 0);
  const directIgst = Number(record?.igst_amount || 0);
  if (directCgst || directSgst || directIgst) {
    return { cgst: round2(directCgst), sgst: round2(directSgst), igst: round2(directIgst) };
  }
  const totalGst = Number(record?.total_gst || 0);
  if (!totalGst) return { cgst: 0, sgst: 0, igst: 0 };
  if (getRecordGstType(record) === 'IGST') return { cgst: 0, sgst: 0, igst: round2(totalGst) };
  const halfPaise = Math.round(totalGst * 100) / 2;
  const cgst = Math.floor(halfPaise) / 100;
  const sgst = round2(totalGst - cgst);
  return { cgst: round2(cgst), sgst, igst: 0 };
};

const sumTaxHeads = (records = []) => records.reduce((acc, record) => {
  const heads = getRecordTaxHeads(record);
  acc.cgst = round2(acc.cgst + heads.cgst);
  acc.sgst = round2(acc.sgst + heads.sgst);
  acc.igst = round2(acc.igst + heads.igst);
  return acc;
}, { cgst: 0, sgst: 0, igst: 0 });
const applyCredit = (availableCredit, liabilities, fromHead, targets, utilization) => {
  let remainingCredit = availableCredit[fromHead] || 0;
  for (const target of targets) {
    if (remainingCredit <= 0) break;
    const usable = Math.min(remainingCredit, liabilities[target] || 0);
    if (usable <= 0) continue;
    liabilities[target] = round2(liabilities[target] - usable);
    remainingCredit = round2(remainingCredit - usable);
    utilization[fromHead][target] = round2((utilization[fromHead][target] || 0) + usable);
  }
  availableCredit[fromHead] = remainingCredit;
};
const calculateGSTR3BSummary = (sales = [], purchases = []) => {
  const outputTax    = sumTaxHeads(sales);
  const inputCredit  = sumTaxHeads(purchases);
  const liabilities  = { ...outputTax };
  const remainingCredit = { ...inputCredit };
  const utilization  = { igst: { igst: 0, cgst: 0, sgst: 0 }, cgst: { igst: 0, cgst: 0, sgst: 0 }, sgst: { igst: 0, cgst: 0, sgst: 0 } };
  applyCredit(remainingCredit, liabilities, 'igst', ['igst', 'cgst', 'sgst'], utilization);
  applyCredit(remainingCredit, liabilities, 'cgst', ['cgst', 'igst'], utilization);
  applyCredit(remainingCredit, liabilities, 'sgst', ['sgst', 'igst'], utilization);
  return {
    outward_taxable: round2(sales.reduce((sum, r) => sum + Number(r?.taxable_amount || 0), 0)),
    output_gst: round2(outputTax.cgst + outputTax.sgst + outputTax.igst),
    input_gst:  round2(inputCredit.cgst + inputCredit.sgst + inputCredit.igst),
    output_tax: outputTax, input_tax_credit: inputCredit, credit_utilized: utilization,
    payable_by_head: { cgst: round2(liabilities.cgst), sgst: round2(liabilities.sgst), igst: round2(liabilities.igst) },
    payable_total: round2(liabilities.cgst + liabilities.sgst + liabilities.igst),
    excess_credit: { cgst: round2(remainingCredit.cgst), sgst: round2(remainingCredit.sgst), igst: round2(remainingCredit.igst) },
    net_payable: round2(liabilities.cgst + liabilities.sgst + liabilities.igst),
  };
};
const GST_INVOICE_TYPES = ['invoice', 'bill_of_supply'];
const isGSTInvoice = (s) => !s.document_type || GST_INVOICE_TYPES.includes(s.document_type);

const buildLocalGSTSummary = (sales = [], purchases = [], month, year) => {
  const normalizedSales = sales.filter(isGSTInvoice).map((sale) => {
    const taxHeads = getRecordTaxHeads(sale);
    return { ...sale, invoice_type: getRecordInvoiceType(sale, 'sale'), gst_type: getRecordGstType(sale), gst_rate: getRecordGstRate(sale), cgst_amount: taxHeads.cgst, sgst_amount: taxHeads.sgst, igst_amount: taxHeads.igst, total_gst: round2(sale?.total_gst || taxHeads.cgst + taxHeads.sgst + taxHeads.igst) };
  });
  const normalizedPurchases = purchases.map((purchase) => {
    const taxHeads = getRecordTaxHeads(purchase);
    return { ...purchase, invoice_type: getRecordInvoiceType(purchase, 'purchase'), gst_type: getRecordGstType(purchase), gst_rate: getRecordGstRate(purchase), cgst_amount: taxHeads.cgst, sgst_amount: taxHeads.sgst, igst_amount: taxHeads.igst, total_gst: round2(purchase?.total_gst || taxHeads.cgst + taxHeads.sgst + taxHeads.igst) };
  });
  const b2b = normalizedSales.filter((s) => s?.invoice_type === 'B2B');
  const b2c = normalizedSales.filter((s) => s?.invoice_type !== 'B2B');
  const salesTaxHeads    = sumTaxHeads(normalizedSales);
  const purchaseTaxHeads = sumTaxHeads(normalizedPurchases);
  const gstr3b = calculateGSTR3BSummary(normalizedSales, normalizedPurchases);
  return {
    month: Number(month), year: Number(year),
    sales: { total: normalizedSales.length, taxable_amount: round2(normalizedSales.reduce((s, r) => s + Number(r?.taxable_amount || 0), 0)), total_gst: round2(normalizedSales.reduce((s, r) => s + Number(r?.total_gst || 0), 0)), cgst: salesTaxHeads.cgst, sgst: salesTaxHeads.sgst, igst: salesTaxHeads.igst, total_amount: round2(normalizedSales.reduce((s, r) => s + Number(r?.total_amount || 0), 0)), b2b_count: b2b.length, b2c_count: b2c.length, b2b_taxable: round2(b2b.reduce((s, r) => s + Number(r?.taxable_amount || 0), 0)), b2c_taxable: round2(b2c.reduce((s, r) => s + Number(r?.taxable_amount || 0), 0)) },
    purchases: { total: normalizedPurchases.length, taxable_amount: round2(normalizedPurchases.reduce((s, r) => s + Number(r?.taxable_amount || 0), 0)), total_gst: round2(normalizedPurchases.reduce((s, r) => s + Number(r?.total_gst || 0), 0)), cgst: purchaseTaxHeads.cgst, sgst: purchaseTaxHeads.sgst, igst: purchaseTaxHeads.igst },
    gstr1: { b2b_invoices: b2b.map((sale) => ({ invoice_number: sale.invoice_number, date: sale.createdAt || sale.sold_at, buyer_name: sale.buyer_name, buyer_gstin: sale.buyer_gstin, taxable_amount: round2(sale.taxable_amount), gst_rate: sale.items?.length ? [...new Set(sale.items.map((i) => i.gst_rate))].join('/') : sale.gst_rate, cgst: round2(sale.cgst_amount), sgst: round2(sale.sgst_amount), igst: round2(sale.igst_amount), total: round2(sale.total_amount), gst_type: sale.gst_type })), b2c_summary: { count: b2c.length, taxable_amount: round2(b2c.reduce((s, r) => s + Number(r?.taxable_amount || 0), 0)), total_gst: round2(b2c.reduce((s, r) => s + Number(r?.total_gst || 0), 0)), total_amount: round2(b2c.reduce((s, r) => s + Number(r?.total_amount || 0), 0)) } },
    gstr3b,
  };
};

/* ─── ITC blocked reason labels ─────────────────────────────────── */
const ITC_BLOCKED_LABELS = {
  personal_use:          'Personal use',
  motor_vehicle:         'Motor vehicle (non-commercial)',
  food_beverages:        'Food & beverages',
  club_membership:       'Club membership',
  travel_benefits:       'Travel benefits to employees',
  construction:          'Construction of immovable property',
  composition_purchase:  'Composition scheme purchase',
  unregistered_supplier: 'Unregistered supplier',
  other:                 'Other',
};

/* ─── Small reusable UI pieces ───────────────────────────────────── */
const INPUT_CLS = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
function SectionHead({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div>
        <p className="text-[14px] font-black text-slate-900">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
function NumberRow({ label, note, value, valueColor = 'text-slate-900', border = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${border ? 'border-t border-slate-100' : ''}`}>
      <div>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
      </div>
      <p className={`text-[17px] font-black flex-shrink-0 ${valueColor}`}>{value}</p>
    </div>
  );
}
function Pill({ children, color = 'bg-slate-100 text-slate-600' }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${color}`}>{children}</span>;
}
function ExportBtn({ onClick, disabled, children, variant = 'default' }) {
  const cls = {
    default:  'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    primary:  'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    blue:     'border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
    dark:     'border border-slate-300 bg-slate-800 text-white hover:bg-slate-700',
    zip:      'border border-green-200 bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:opacity-90 shadow-md shadow-green-600/20',
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px ${cls}`}
    >{children}</button>
  );
}

// Feature 4 — GST deadline card (non-dismissible, shows for selected period)
function GstDeadlineCard({ month, year }) {
  const today = new Date();
  // month is 1-indexed. new Date(year, month, 11) = 11th of the next calendar month.
  const gstr1Due  = new Date(year, month, 11);
  const gstr3bDue = new Date(year, month, 20);
  const daysToGstr1  = Math.ceil((gstr1Due  - today) / 86400000);
  const daysToGstr3b = Math.ceil((gstr3bDue - today) / 86400000);
  const monthName = MONTHS[month - 1];

  const statusColor = (days) => {
    if (days < 0)  return 'text-red-700 bg-red-50 border-red-200';
    if (days <= 3) return 'text-red-700 bg-red-50 border-red-200';
    if (days <= 7) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };
  const daysLabel = (days) => {
    if (days < 0)  return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today!';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };
  const formatDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Filing Deadlines</p>
          <p className="text-[14px] font-black text-slate-900">{monthName} {year}</p>
        </div>
        <span className="text-2xl">📅</span>
      </div>
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
        {[
          { label: 'GSTR-1', due: gstr1Due, days: daysToGstr1 },
          { label: 'GSTR-3B', due: gstr3bDue, days: daysToGstr3b },
        ].map(({ label, due, days }) => (
          <div key={label} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${statusColor(days)}`}>
            <div>
              <p className="text-[12px] font-black">{label}</p>
              <p className="text-[10px] font-semibold opacity-70">{formatDate(due)}</p>
            </div>
            <span className="text-[11px] font-black">{daysLabel(days)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function GSTPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const now = new Date();
  // Before the 20th, the filing period is the previous month (GSTR-3B not yet due for last month).
  const filingDate = now.getDate() <= 20
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const [month, setMonth] = useState(filingDate.getMonth() + 1);
  const [year,  setYear]  = useState(filingDate.getFullYear());
  const [summary, setSummary]           = useState(null);
  const [recordsCache, setRecordsCache] = useState({ sales: [], purchases: [] });
  const [loading, setLoading]   = useState(false);
  const [zipping, setZipping]   = useState(false);
  const [drillType, setDrillType]   = useState(null);
  const [drillData, setDrillData]   = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheLoaded, setCacheLoaded]       = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);
  const [shopGstin, setShopGstin] = useState('');
  // GSTR-1 portal JSON export
  const [gstr1Loading, setGstr1Loading] = useState(false);
  const [gstr1Error,   setGstr1Error]   = useState('');
  const [showPreflight, setShowPreflight] = useState(false);
  // GSTR-3B detailed worksheet
  const [gstr3bWs,        setGstr3bWs]        = useState(null);
  const [gstr3bWsLoading, setGstr3bWsLoading] = useState(false);
  const [gstr3bWsError,   setGstr3bWsError]   = useState('');
  const [showGstr3bWs,    setShowGstr3bWs]    = useState(false);
  const [showBlockedDetail, setShowBlockedDetail] = useState(false);

  /* ── Logic ── */
  const applyCachedSnapshot = (cached) => {
    setSummary(cached?.summary || null);
    setRecordsCache({ sales: cached?.sales || [], purchases: cached?.purchases || [] });
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  const fetchSummary = async (hasCachedSnapshot = false) => {
    setLoading(!hasCachedSnapshot); setDrillType(null);
    try {
      const from = new Date(year, month - 1, 1).toISOString();
      const to   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const headers = { Authorization: `Bearer ${getToken()}` };
      // Use dedicated GST summary endpoint (no pagination limit, proper document_type filter)
      // + fetch raw records separately for drill-down (max 500)
      const [summaryRes, salesRes, purchasesRes] = await Promise.all([
        fetch(apiUrl(`/api/sales/gst-summary?month=${month}&year=${year}`), { headers }),
        fetch(apiUrl(`/api/sales?from=${from}&to=${to}&limit=500`), { headers }),
        fetch(apiUrl(`/api/purchases?from=${from}&to=${to}&limit=500`), { headers }),
      ]);
      if (summaryRes.status === 401 || salesRes.status === 401 || purchasesRes.status === 401) { router.push('/login'); return; }
      const salesPayload     = salesRes.ok     ? await salesRes.json()     : { sales: [] };
      const purchasesPayload = purchasesRes.ok ? await purchasesRes.json() : { purchases: [] };
      const sales     = Array.isArray(salesPayload?.sales)         ? salesPayload.sales         : [];
      const purchases = Array.isArray(purchasesPayload?.purchases) ? purchasesPayload.purchases : [];
      const nextSummary = summaryRes.ok
        ? await summaryRes.json()
        : buildLocalGSTSummary(sales, purchases, month, year);
      setSummary(nextSummary); setRecordsCache({ sales, purchases });
      writePageCache(getGSTCacheKey(month, year), { summary: nextSummary, sales, purchases });
      setCacheUpdatedAt(new Date().toISOString()); setCacheLoaded(true);
    } catch {
      if (!hasCachedSnapshot) { setSummary(null); setRecordsCache({ sales: [], purchases: [] }); }
    }
    setLoading(false);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    // Fetch shop data to get the actual GSTIN (not from localStorage which lacks shop fields)
    fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null)
      .then(shop => { if (shop?.gstin) setShopGstin(shop.gstin); })
      .catch(() => {});
    const cached = readPageCache(getGSTCacheKey(month, year));
    if (cached) { applyCachedSnapshot(cached); setLoading(false); }
    else { setCacheLoaded(false); setLoading(true); }
    const deferredId = scheduleDeferred(() => fetchSummary(Boolean(cached)));
    return () => cancelDeferred(deferredId);
  }, [month, year, router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const openDrill = async (type) => {
    if (drillType === type) { setDrillType(null); return; }
    setDrillType(type); setDrillLoading(true);
    if (!isOnline) { setDrillData(type === 'sales' ? recordsCache.sales.filter(isGSTInvoice) : recordsCache.purchases); setDrillLoading(false); return; }
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 0, 23, 59, 59).toISOString();
    try {
      const url = type === 'sales' ? apiUrl(`/api/sales?from=${from}&to=${to}`) : apiUrl(`/api/purchases?from=${from}&to=${to}`);
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const raw = type === 'sales' ? (data.sales || data) : (data.purchases || data);
      setDrillData(type === 'sales' ? raw.filter(isGSTInvoice) : raw);
    } catch {}
    setDrillLoading(false);
  };

  const buildGSTR1CSV = () => {
    const rows = [['GSTR-1 B2B Invoices'],['Invoice No','Date','Buyer Name','Buyer GSTIN','Taxable Amount','GST Rate%','CGST','SGST','IGST','Total'],...summary.gstr1.b2b_invoices.map((inv) => [inv.invoice_number,new Date(inv.date).toLocaleDateString('en-IN'),inv.buyer_name||'',inv.buyer_gstin||'',fmt(inv.taxable_amount),`${inv.gst_rate}%`,fmt(inv.cgst),fmt(inv.sgst),fmt(inv.igst),fmt(inv.total)]),[''],['GSTR-1 B2C Summary'],['Count','Taxable Amount','Total GST','Total Amount'],[summary.gstr1.b2c_summary.count,fmt(summary.gstr1.b2c_summary.taxable_amount),fmt(summary.gstr1.b2c_summary.total_gst),fmt(summary.gstr1.b2c_summary.total_amount)]];
    return rows.map((r) => r.join(',')).join('\n');
  };
  const buildGSTR3BCSV = () => {
    const rows = [['GSTR-3B Summary'],['Month/Year',`${MONTHS[month-1]} ${year}`],[''],['Description','Amount (₹)'],['GST Collected (Output)',fmt(summary.gstr3b.output_gst)],['GST Input Credit (ITC)',fmt(summary.gstr3b.input_gst)],['Net GST Payable After ITC Set-Off',fmt(summary.gstr3b.payable_total??summary.gstr3b.net_payable)],['Outward Taxable Sales',fmt(summary.gstr3b.outward_taxable)]];
    return rows.map((r) => r.join(',')).join('\n');
  };
  const exportCSV = (type) => {
    if (!summary) return;
    const csv      = type === 'gstr1' ? buildGSTR1CSV() : buildGSTR3BCSV();
    const filename = type === 'gstr1' ? `GSTR1_${year}_${String(month).padStart(2,'0')}.csv` : `GSTR3B_${year}_${String(month).padStart(2,'0')}.csv`;
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };
  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary,null,2)], { type:'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GST_${year}_${String(month).padStart(2,'0')}.json`; a.click(); URL.revokeObjectURL(url);
  };

  // GSTR-1 Portal JSON — downloads server-generated GSTN portal JSON
  const downloadGSTR1JSON = async () => {
    setGstr1Loading(true); setGstr1Error('');
    try {
      const res  = await fetch(apiUrl(`/api/gst/gstr1?month=${month}&year=${year}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) { setGstr1Error(data.message || 'GSTR-1 generation failed'); return; }
      const blob = new Blob([JSON.stringify(data.gstr1, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${String(month).padStart(2,'0')}${year}_PORTAL.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('GSTIN not configured') || msg.includes('GSTIN')) {
        setGstr1Error('GSTIN profile में configure नहीं है। Profile → Shop Settings में GSTIN add करें।');
      } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
        setGstr1Error('Internet connection check करें और दोबारा try करें।');
      } else {
        setGstr1Error(`GSTR-1 generate नहीं हुआ: ${msg || 'Unknown error'}। Support को report करें।`);
      }
    }
    setGstr1Loading(false);
  };

  // GSTR-3B Detailed Worksheet
  const fetchGSTR3BWorksheet = async () => {
    if (gstr3bWs && !showGstr3bWs) { setShowGstr3bWs(true); return; }
    if (showGstr3bWs) { setShowGstr3bWs(false); return; }
    setGstr3bWsLoading(true); setGstr3bWsError('');
    try {
      const res  = await fetch(apiUrl(`/api/gst/gstr3b?month=${month}&year=${year}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) { setGstr3bWsError(data.message || 'GSTR-3B generation failed'); setGstr3bWsLoading(false); return; }
      setGstr3bWs(data);
      setShowGstr3bWs(true);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('GSTIN not configured') || msg.includes('GSTIN')) {
        setGstr3bWsError('GSTIN profile में configure नहीं है। Profile → Shop Settings में GSTIN add करें।');
      } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
        setGstr3bWsError('Internet connection check करें और दोबारा try करें।');
      } else {
        setGstr3bWsError(`GSTR-3B generate नहीं हुआ: ${msg || 'Unknown error'}। Support को report करें।`);
      }
    }
    setGstr3bWsLoading(false);
  };

  const exportZIP = async () => {
    if (!summary) return;
    if (!isOnline && !window.JSZip) {
      showToast('Offline mode में ZIP export available नहीं है। Online होने पर try करें।', 'warning');
      return;
    }
    setZipping(true);
    try {
      if (!window.JSZip) {
        await new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
      }
      const zip = new window.JSZip(); const monthPad = String(month).padStart(2,'0'); const periodTag = `${year}_${monthPad}`;
      const g1 = zip.folder('GSTR1'); const g3 = zip.folder('GSTR3B');
      g1.file('gstr1.csv', buildGSTR1CSV()); g1.file('gstr1.json', JSON.stringify({ period:{ month:MONTHS[month-1], year }, b2b_invoices:summary.gstr1.b2b_invoices, b2c_summary:summary.gstr1.b2c_summary, sales_totals:summary.sales }, null, 2));
      g3.file('gstr3b.csv', buildGSTR3BCSV()); g3.file('gstr3b.json', JSON.stringify({ period:{ month:MONTHS[month-1], year }, gstr3b:summary.gstr3b, purchases:summary.purchases }, null, 2));
      const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `GST_Export_${periodTag}.zip`; a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToast('ZIP export fail हुआ — individual CSV/JSON exports try करें।', 'error');
    }
    setZipping(false);
  };

  /* ── Derived ── */
  const netPayable    = summary?.gstr3b?.net_payable   || 0;
  const gstCollected  = summary?.gstr3b?.output_gst    || 0;
  const gstITC        = summary?.gstr3b?.input_gst     || 0;
  const payableByHead = summary?.gstr3b?.payable_by_head || { cgst:0, sgst:0, igst:0 };
  const payableTotal  = summary?.gstr3b?.payable_total ?? netPayable;
  const excessCredit  = summary?.gstr3b?.excess_credit  || { cgst:0, sgst:0, igst:0 };
  const excessCreditTotal = (excessCredit.cgst||0) + (excessCredit.sgst||0) + (excessCredit.igst||0);
  const monthEn = MONTHS[month-1];
  const isPayable = payableTotal > 0;
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : null;

  // Bug 1: fallback detection — records without per-head amounts but with total_gst
  const fallbackCount = recordsCache.sales.filter(s =>
    !s.cgst_amount && !s.sgst_amount && !s.igst_amount && (s.total_gst || 0) > 0
  ).length;

  // Blocked ITC from purchases cache (for KPI card)
  const blockedITC = recordsCache.purchases
    .filter(p => p.itc_eligible === false && !p.is_reverse_charge)
    .reduce((acc, p) => acc + (Number(p.igst_amount||0) + Number(p.cgst_amount||0) + Number(p.sgst_amount||0)), 0);

  /* ── Drill table renderer ── */
  const renderDrill = (type) => {
    if (drillLoading) return <div className="px-5 py-8 text-center text-[13px] text-slate-400">Loading...</div>;
    if (!drillData.length) return <div className="px-5 py-8 text-center text-[13px] text-slate-400">{type === 'sales' ? 'इस महीने कोई sale नहीं' : 'इस महीने कोई purchase नहीं'}</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {[type==='sales'?'Invoice':'Bill No','Product',type==='sales'?'Customer':'Supplier','Taxable',type==='sales'?'GST':'ITC','Total'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {drillData.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[11px] text-green-700">{safeText(item.invoice_number)}</td>
                <td className="px-4 py-2.5 text-slate-700">{safeText(item.product_name||(item.items?.length>1?`${item.items.length} items`:item.items?.[0]?.product_name))}</td>
                <td className="px-4 py-2.5 text-slate-600">{safeText(item.buyer_name||item.supplier_name||'-')}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">₹{fmt(item.taxable_amount)}</td>
                <td className={`px-4 py-2.5 font-bold ${type==='sales'?'text-emerald-600':'text-green-700'}`}>₹{fmt(item.total_gst)}</td>
                <td className="px-4 py-2.5 font-black text-slate-900">₹{fmt(item.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ── Page header ── */}
        <div className="rr-page-hero rr-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="rr-section-label">📊 Tax & Compliance</span>
              <PageHeader title="GST" subtitle="Tax filing और ITC हिसाब" />
              {!isOnline
                ? <p className="mt-2 text-[11px] font-semibold text-amber-700">📶 Offline — cached data{cacheLabel ? ` · ${cacheLabel}` : ''}</p>
                : cacheLoaded && cacheLabel
                  ? <p className="mt-2 text-[11px] text-slate-400">Last synced {cacheLabel}</p>
                  : null}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <select className={INPUT_CLS} style={{ width: 130 }} disabled={loading} value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((m, i) => <option key={m} value={i+1}>{MONTHS_HI[i]} / {m}</option>)}
              </select>
              <select className={INPUT_CLS} style={{ width: 90 }} disabled={loading} value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                {[2023,2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Feature 4 — GST Deadline Card */}
        <GstDeadlineCard month={month} year={year} />

        {/* ── Offline warning ── */}
        {!isOnline && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl mt-0.5">📶</span>
            <div>
              <p className="text-[13px] font-black text-amber-900">Offline GST view</p>
              <p className="text-[11px] text-amber-700 mt-0.5">GST page cached data दिखा रही है। ZIP export और fresh figures internet के साथ best काम करेंगे।</p>
            </div>
          </div>
        )}

        {/* Bug 1 — fallback count warning */}
        {summary && fallbackCount > 0 && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl mt-0.5">⚠️</span>
            <p className="text-[12px] font-semibold text-amber-800">
              {fallbackCount} invoices में per-head GST amounts नहीं हैं — estimated split use हो रहा है। Accuracy के लिए invoices re-generate करें।
            </p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !summary && (
          <div className="space-y-3">
            {[100, 160, 120].map((h, i) => <div key={i} className="rounded-2xl bg-white border border-slate-200 animate-pulse" style={{ height: h }} />)}
          </div>
        )}

        {/* ── No data ── */}
        {!loading && !summary && (
          <EmptyState
            emoji="🏛️"
            title="GST data अभी नहीं है"
            subtitle="GST-enabled bills बनाने के बाद यहाँ GSTR-1 और GSTR-3B ready मिलेगी।"
            actionLabel="Sale बनाएं"
            onAction={() => router.push('/sales')}
          />
        )}

        {/* ── Period has no invoices ── */}
        {!loading && summary && summary.sales?.total === 0 && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xl mt-0.5">📭</span>
            <div>
              <p className="text-[13px] font-black text-slate-800">{monthEn} {year} में कोई invoice नहीं मिला</p>
              <p className="text-[12px] text-slate-500 mt-0.5">ऊपर से अलग month/year select करें, या पहले Sales में invoice बनाएं।</p>
            </div>
          </div>
        )}

        {summary && (
          <>
            {/* ══════════════════════════════════════
                BLOCK 1 — GST POSITION (TOP CARD)
            ══════════════════════════════════════ */}
            <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${isPayable ? 'bg-gradient-to-br from-rose-50 to-orange-50 border-rose-200' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'}`}>
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-50"
                style={{ background: isPayable ? '#fca5a5' : '#6ee7b7' }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${isPayable ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
                    {isPayable ? '⚠️ GST देना बाकी है' : '✅ Return ready to file'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{monthEn} {year}</span>
                </div>
                <p className="rr-section-label mb-1">
                  {isPayable ? 'Net GST Payable' : 'ITC Balance / No Liability'}
                </p>
                <p className={`rr-big-num mb-4 ${isPayable ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {fmtINR(isPayable ? payableTotal : excessCreditTotal)}
                </p>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
                  {[
                    { label: 'Output GST', sublabel: 'Sales से collect हुआ', value: fmtINR(gstCollected), color: 'text-slate-800' },
                    { label: 'Input ITC',  sublabel: 'Purchase से credit',   value: fmtINR(gstITC),       color: 'text-green-700'  },
                    { label: isPayable ? 'Payable' : 'Excess ITC', sublabel: 'After set-off', value: fmtINR(isPayable ? payableTotal : excessCreditTotal), color: isPayable ? 'text-rose-700' : 'text-emerald-700' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/70 rounded-xl p-3 border border-white">
                      <p className={`text-[17px] font-black leading-none ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] font-bold text-slate-600 mt-1">{s.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.sublabel}</p>
                    </div>
                  ))}
                </div>
                {/* Bug 5 KPI — Blocked ITC */}
                {blockedITC > 0 && (
                  <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-100/60 border border-red-200">
                    <div className="flex-1">
                      <p className="text-[17px] font-black text-red-700 leading-none">{fmtINR(blockedITC)}</p>
                      <p className="text-[11px] font-bold text-red-600 mt-0.5">Blocked ITC (Section 17(5))</p>
                    </div>
                    <p className="text-[10px] text-red-400 text-right leading-tight max-w-[120px]">
                      Personal use, motor vehicle, etc. — claim नहीं होगा।
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════
                BLOCK 2 — GST CALCULATION DETAIL
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead title="GST Calculation" subtitle="Output tax और ITC का पूरा हिसाब" />
              <NumberRow
                label="GST Collected (Output)"
                note={`Sales से। CGST ${fmtINR(summary.sales.cgst)} + SGST ${fmtINR(summary.sales.sgst)} + IGST ${fmtINR(summary.sales.igst)}`}
                value={fmtINR(gstCollected)}
                valueColor="text-emerald-600"
              />
              <div className="px-5 pb-3">
                <button onClick={() => openDrill('sales')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-black transition-all border ${drillType==='sales' ? 'bg-green-600 border-green-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {drillType === 'sales' ? '▴ Sales छुपाओ' : '▾ Sales देखो'}
                </button>
              </div>
              {drillType === 'sales' && (
                <div className="border-t border-slate-100">{renderDrill('sales')}</div>
              )}
              <div className="mx-5 border-t border-slate-100" />
              <NumberRow
                label="GST Input Credit (ITC)"
                note={`Purchases से। CGST ${fmtINR(summary.purchases.cgst)} + SGST ${fmtINR(summary.purchases.sgst)} + IGST ${fmtINR(summary.purchases.igst)}`}
                value={fmtINR(gstITC)}
                valueColor="text-green-700"
              />
              {gstITC === 0 && (
                <div className="px-5 pb-3">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span>⚠️</span>
                    <p className="text-[12px] font-semibold text-amber-800">No ITC claimed — आप overpay कर सकते हैं</p>
                  </div>
                </div>
              )}
              <div className="px-5 pb-3">
                <button onClick={() => openDrill('purchases')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-black transition-all border ${drillType==='purchases' ? 'bg-green-600 border-green-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {drillType === 'purchases' ? '▴ Purchases छुपाओ' : '▾ Purchases देखो'}
                </button>
              </div>
              {drillType === 'purchases' && (
                <div className="border-t border-slate-100">{renderDrill('purchases')}</div>
              )}
              <div className="mx-5 border-t border-slate-100" />
              <div className={`flex items-center justify-between gap-3 px-5 py-4 ${isPayable ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                <div>
                  <p className="text-[13px] font-black text-slate-900">{isPayable ? 'Net GST Payable' : 'Excess ITC / Nil Liability'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">ITC set-off के बाद बचा हुआ</p>
                </div>
                <p className={`text-[22px] font-black ${isPayable ? 'text-rose-700' : 'text-emerald-600'}`}>
                  {fmtINR(isPayable ? payableTotal : excessCreditTotal)}
                </p>
              </div>
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 3 — GSTR-3B SUMMARY TABLE
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead title="GSTR-3B Summary" subtitle="CA को दिखाने के लिए ready" />
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Description','CGST','SGST','IGST','Total'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">Output (Sales)</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.sales.cgst)}</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.sales.sgst)}</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.sales.igst)}</td>
                      <td className="px-4 py-3 font-black text-emerald-600">₹{fmt(summary.sales.total_gst)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">Input / ITC (Purchase)</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.purchases.cgst)}</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.purchases.sgst)}</td>
                      <td className="px-4 py-3 text-slate-800">₹{fmt(summary.purchases.igst)}</td>
                      <td className="px-4 py-3 font-black text-green-700">₹{fmt(summary.purchases.total_gst)}</td>
                    </tr>
                    <tr className={isPayable ? 'bg-rose-50' : 'bg-emerald-50'}>
                      <td className="px-4 py-3 font-black text-slate-900">{isPayable ? 'Payable After ITC' : 'Unused ITC / Nil'}</td>
                      <td className={`px-4 py-3 font-bold ${isPayable?'text-rose-700':'text-emerald-600'}`}>₹{fmt(isPayable?payableByHead.cgst:excessCredit.cgst)}</td>
                      <td className={`px-4 py-3 font-bold ${isPayable?'text-rose-700':'text-emerald-600'}`}>₹{fmt(isPayable?payableByHead.sgst:excessCredit.sgst)}</td>
                      <td className={`px-4 py-3 font-bold ${isPayable?'text-rose-700':'text-emerald-600'}`}>₹{fmt(isPayable?payableByHead.igst:excessCredit.igst)}</td>
                      <td className={`px-4 py-3 font-black text-[16px] ${isPayable?'text-rose-700':'text-emerald-600'}`}>₹{fmt(isPayable?payableTotal:excessCreditTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 4 — B2B / B2C SPLIT
            ══════════════════════════════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'B2B Invoices', count: summary.sales.b2b_count, taxable: summary.sales.b2b_taxable, color: 'bg-blue-50 border-blue-200', tc: 'text-blue-700', note: 'Business customers (GSTIN)' },
                { label: 'B2C Invoices', count: summary.sales.b2c_count, taxable: summary.sales.b2c_taxable, color: 'bg-green-50 border-green-200',  tc: 'text-green-700',  note: 'Regular customers' },
              ].map((s) => (
                <div key={s.label} className={`${s.color} border rounded-2xl p-4 shadow-sm`}>
                  <p className={`text-[28px] font-black leading-none ${s.tc}`}>{s.count}</p>
                  <p className="text-[12px] font-black text-slate-700 mt-1">{s.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.note}</p>
                  <p className="text-[11px] font-bold text-slate-600 mt-2">Taxable ₹{fmt(s.taxable)}</p>
                </div>
              ))}
            </div>

            {/* ══════════════════════════════════════
                BLOCK 5 — B2B INVOICES LIST
            ══════════════════════════════════════ */}
            {summary.gstr1.b2b_invoices.length === 0 ? (
              <SectionCard>
                <div className="empty-state rounded-none border-0 bg-transparent py-10">
                  <div className="empty-state-icon mx-auto mb-3 text-[20px]">📄</div>
                  <p className="text-[13px] font-bold text-slate-700">इस महीने का कोई data नहीं</p>
                  <p className="text-[12px] text-slate-400 mt-1">Sales में customer का GSTIN add करें — B2B invoices यहाँ आएंगे</p>
                </div>
              </SectionCard>
            ) : (
              <SectionCard>
                <SectionHead
                  title="B2B Invoices"
                  subtitle="GSTR-1 filing list — business customers"
                  right={<Pill color="bg-blue-50 text-blue-700">{summary.gstr1.b2b_invoices.length} invoices</Pill>}
                />
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Invoice No','Buyer','GSTIN','Taxable','GST%','Total','Type'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {summary.gstr1.b2b_invoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-[11px] text-green-700">{safeText(inv.invoice_number)}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{safeText(inv.buyer_name||'-')}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[10px] text-slate-500">{safeText(inv.buyer_gstin)}</span>
                            {/* Bug 2 — checksum warning badge */}
                            {inv.buyer_gstin && !validateGSTINChecksum(inv.buyer_gstin) && (
                              <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full align-middle">
                                ⚠️ Checksum
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">₹{fmt(inv.taxable_amount)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{inv.gst_rate}%</td>
                          <td className="px-4 py-2.5 font-black text-emerald-600">₹{fmt(inv.total)}</td>
                          <td className="px-4 py-2.5"><Pill color="bg-blue-50 text-blue-700">{inv.gst_type}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {summary.gstr1.b2b_invoices.map((inv, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-mono text-[11px] text-green-700">{safeText(inv.invoice_number)}</span>
                        <span className="font-black text-emerald-600">₹{fmt(inv.total)}</span>
                      </div>
                      <p className="text-[13px] font-bold text-slate-900">{safeText(inv.buyer_name)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-400">GSTIN: {safeText(inv.buyer_gstin)} · GST {inv.gst_rate}%</p>
                        {inv.buyer_gstin && !validateGSTINChecksum(inv.buyer_gstin) && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚠️ Checksum</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ══════════════════════════════════════
                BLOCK 6 — B2C SUMMARY
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead title="B2C Summary" subtitle="Regular customers without GSTIN" />
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                {[
                  { label: 'Invoices',    value: summary.gstr1.b2c_summary.count,          pre: '',  color: 'text-slate-900' },
                  { label: 'Taxable',     value: fmt(summary.gstr1.b2c_summary.taxable_amount), pre: '₹', color: 'text-slate-800' },
                  { label: 'GST',         value: fmt(summary.gstr1.b2c_summary.total_gst),      pre: '₹', color: 'text-amber-600' },
                  { label: 'Total',       value: fmt(summary.gstr1.b2c_summary.total_amount),   pre: '₹', color: 'text-emerald-600' },
                ].map((s) => (
                  <div key={s.label} className="p-4 text-center">
                    <p className={`text-[20px] font-black leading-none ${s.color}`}>{s.pre}{s.value}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 7 — GSTR-1 PORTAL JSON UPLOAD
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead
                title="GSTR-1 Portal Upload"
                subtitle="GSTN portal पर directly upload करने के लिए JSON"
                right={<Pill color="bg-green-50 text-green-700">Portal Format</Pill>}
              />
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-base flex-shrink-0">ℹ️</span>
                  <p className="text-[12px] text-blue-800 leading-relaxed">
                    यह JSON सीधे <strong>GST portal → Returns → GSTR-1 → Upload JSON</strong> में upload होगा।
                    Upload करने से पहले अपने CA से verify करवाएं।
                    GSTIN profile में configure होना चाहिए।
                  </p>
                </div>
                {/* Bug 4 — improved error display with Profile link */}
                {gstr1Error && (
                  <div className="px-5 py-3 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-[12px] font-semibold text-red-700">⚠️ {gstr1Error}</p>
                    {gstr1Error.includes('GSTIN') && (
                      <Link href="/profile" className="mt-1 text-[11px] font-bold text-red-600 underline block">
                        Profile में जाएं →
                      </Link>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {/* Feature 1 — trigger preflight modal instead of direct download */}
                  <ExportBtn onClick={() => setShowPreflight(true)} disabled={gstr1Loading} variant="zip">
                    {gstr1Loading ? '⏳ Generating...' : '⬇️ Download GSTR-1 JSON (Portal)'}
                  </ExportBtn>
                  <ExportBtn onClick={() => exportCSV('gstr1')} variant="primary">📄 GSTR-1 CSV</ExportBtn>
                </div>
              </div>
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 8 — GSTR-3B WORKING WORKSHEET
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead
                title="GSTR-3B Working Sheet"
                subtitle="Table 3.1, 4 और 6.1 — CA को देने के लिए"
                right={
                  <ExportBtn onClick={fetchGSTR3BWorksheet} disabled={gstr3bWsLoading} variant="blue">
                    {gstr3bWsLoading ? '⏳' : showGstr3bWs ? '▴ Hide' : '▾ View Worksheet'}
                  </ExportBtn>
                }
              />
              {gstr3bWsError && (
                <div className="px-5 py-3 text-[12px] font-semibold text-rose-600">⚠️ {gstr3bWsError}</div>
              )}
              {showGstr3bWs && gstr3bWs && (
                <div className="p-5 space-y-5">
                  {/* Table 3.1 — Outward Supplies */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Table 3.1 — Outward Supplies</p>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          {['Supply Type','Taxable','IGST','CGST','SGST'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-semibold text-slate-700">Inter-State (3.1a)</td>
                            <td className="px-3 py-2">₹{fmt(gstr3bWs.table31?.a?.inter?.txval)}</td>
                            <td className="px-3 py-2 font-bold text-emerald-600">₹{fmt(gstr3bWs.table31?.a?.inter?.iamt)}</td>
                            <td className="px-3 py-2">—</td>
                            <td className="px-3 py-2">—</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-semibold text-slate-700">Intra-State (3.1a)</td>
                            <td className="px-3 py-2">₹{fmt(gstr3bWs.table31?.a?.intra?.txval)}</td>
                            <td className="px-3 py-2">—</td>
                            <td className="px-3 py-2 font-bold text-emerald-600">₹{fmt(gstr3bWs.table31?.a?.intra?.camt)}</td>
                            <td className="px-3 py-2 font-bold text-emerald-600">₹{fmt(gstr3bWs.table31?.a?.intra?.samt)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 4 — ITC */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Table 4 — ITC Available</p>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          {['Category','IGST','CGST','SGST','Total'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {[
                            { label: '4A(c) — RCM Inward',   data: gstr3bWs.table4?.A?.c },
                            { label: '4A(e) — All Other ITC', data: gstr3bWs.table4?.A?.e },
                          ].map(row => (
                            <tr key={row.label} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td>
                              <td className="px-3 py-2 text-green-700">₹{fmt(row.data?.iamt)}</td>
                              <td className="px-3 py-2 text-green-700">₹{fmt(row.data?.camt)}</td>
                              <td className="px-3 py-2 text-green-700">₹{fmt(row.data?.samt)}</td>
                              <td className="px-3 py-2 font-bold text-green-700">₹{fmt((row.data?.iamt||0)+(row.data?.camt||0)+(row.data?.samt||0))}</td>
                            </tr>
                          ))}
                          <tr className="bg-green-50 font-black">
                            <td className="px-3 py-2 text-green-800">4C — Net ITC Available</td>
                            <td className="px-3 py-2 text-green-800">₹{fmt(gstr3bWs.table4?.C?.iamt)}</td>
                            <td className="px-3 py-2 text-green-800">₹{fmt(gstr3bWs.table4?.C?.camt)}</td>
                            <td className="px-3 py-2 text-green-800">₹{fmt(gstr3bWs.table4?.C?.samt)}</td>
                            <td className="px-3 py-2 text-green-800">₹{fmt((gstr3bWs.table4?.C?.iamt||0)+(gstr3bWs.table4?.C?.camt||0)+(gstr3bWs.table4?.C?.samt||0))}</td>
                          </tr>
                          {/* Bug 5 — Table 4D: Ineligible ITC */}
                          {((gstr3bWs.table4?.D?.a?.iamt||0) + (gstr3bWs.table4?.D?.a?.camt||0) + (gstr3bWs.table4?.D?.a?.samt||0)) > 0 && (
                            <>
                              <tr className="bg-red-50/50">
                                <td className="px-3 py-2 font-semibold text-red-700">
                                  4D(a) — Ineligible ITC
                                  <span className="ml-1 text-[10px] font-normal text-red-500">(Section 17(5))</span>
                                </td>
                                <td className="px-3 py-2 text-red-600">₹{fmt(gstr3bWs.table4?.D?.a?.iamt)}</td>
                                <td className="px-3 py-2 text-red-600">₹{fmt(gstr3bWs.table4?.D?.a?.camt)}</td>
                                <td className="px-3 py-2 text-red-600">₹{fmt(gstr3bWs.table4?.D?.a?.samt)}</td>
                                <td className="px-3 py-2 font-bold text-red-600">
                                  ₹{fmt((gstr3bWs.table4?.D?.a?.iamt||0)+(gstr3bWs.table4?.D?.a?.camt||0)+(gstr3bWs.table4?.D?.a?.samt||0))}
                                </td>
                              </tr>
                              <tr>
                                <td colSpan={5} className="px-3 py-1.5 bg-red-50/30">
                                  <p className="text-[10px] text-red-600">
                                    ⚠️ यह ITC claim नहीं होगा — Section 17(5) के तहत blocked। इन purchases को GSTR-3B Table 4D में declare करें।
                                  </p>
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Feature 3 — Section 17(5) blocked ITC breakdown */}
                  {gstr3bWs.blocked_by_reason && Object.keys(gstr3bWs.blocked_by_reason).length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowBlockedDetail(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] font-black text-red-700 hover:bg-red-100 transition-colors mb-2"
                      >
                        <span>⛔ Blocked ITC — Section 17(5) Breakdown</span>
                        <span>{showBlockedDetail ? '▴ Hide' : '▾ Show'}</span>
                      </button>
                      {showBlockedDetail && (
                        <div className="rounded-xl border border-red-200 overflow-hidden">
                          <table className="w-full text-[12px]">
                            <thead><tr className="bg-red-50 border-b border-red-100">
                              {['Category','IGST','CGST','SGST','Total',''].map((h, i) => (
                                <th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-red-500 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr></thead>
                            <tbody className="divide-y divide-red-50">
                              {Object.entries(gstr3bWs.blocked_by_reason).map(([reason, vals]) => {
                                const label = ITC_BLOCKED_LABELS[reason] || reason;
                                const total = (vals.iamt||0) + (vals.camt||0) + (vals.samt||0);
                                return (
                                  <tr key={reason} className="hover:bg-red-50">
                                    <td className="px-3 py-2 text-slate-700">{label}</td>
                                    <td className="px-3 py-2 text-red-600">₹{fmt(vals.iamt)}</td>
                                    <td className="px-3 py-2 text-red-600">₹{fmt(vals.camt)}</td>
                                    <td className="px-3 py-2 text-red-600">₹{fmt(vals.samt)}</td>
                                    <td className="px-3 py-2 font-bold text-red-600">₹{fmt(total)}</td>
                                    <td className="px-3 py-2">
                                      <Link href={`/purchases?filter=itc_blocked&reason=${reason}`}
                                        className="text-[10px] text-blue-600 hover:underline font-bold whitespace-nowrap"
                                      >View →</Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table 6.1 — Tax Payable */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Table 6.1 — Tax Payable</p>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          {['Head','Payable','By ITC','Cash Required'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {[
                            { label: 'IGST', data: gstr3bWs.table61?.igst },
                            { label: 'CGST', data: gstr3bWs.table61?.cgst },
                            { label: 'SGST', data: gstr3bWs.table61?.sgst },
                          ].map(row => (
                            <tr key={row.label} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-bold text-slate-700">{row.label}</td>
                              <td className="px-3 py-2">₹{fmt(row.data?.tax_payable)}</td>
                              <td className="px-3 py-2 text-green-700">₹{fmt(row.data?.paid_through_itc)}</td>
                              <td className={`px-3 py-2 font-bold ${(row.data?.paid_cash||0)>0?'text-rose-600':'text-emerald-600'}`}>₹{fmt(row.data?.paid_cash)}</td>
                            </tr>
                          ))}
                          <tr className="bg-rose-50 font-black">
                            <td className="px-3 py-2 text-rose-800">Total Cash Required</td>
                            <td className="px-3 py-2 text-rose-800">₹{fmt(gstr3bWs.summary?.net_tax_payable)}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-rose-800">₹{fmt(gstr3bWs.summary?.net_tax_payable)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <ExportBtn onClick={() => exportCSV('gstr3b')} variant="blue">📄 Export GSTR-3B CSV</ExportBtn>
                </div>
              )}
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 9 — EXPORT FOR CA
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead
                title="Export for CA"
                subtitle="CA को सीधे share करो"
                right={<Pill color="bg-amber-50 text-amber-700">{monthEn} {year}</Pill>}
              />
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Individual Files</p>
                  <div className="flex flex-wrap gap-2">
                    <ExportBtn onClick={() => exportCSV('gstr1')} variant="primary">📄 GSTR-1 CSV</ExportBtn>
                    <ExportBtn onClick={() => exportCSV('gstr3b')} variant="blue">📄 GSTR-3B CSV</ExportBtn>
                    <ExportBtn onClick={exportJSON} variant="dark">🗂 JSON</ExportBtn>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">सब एक साथ</p>
                  <p className="text-[12px] text-slate-500 mb-3">GSTR1 + GSTR3B — CSV और JSON दोनों एक ZIP में</p>
                  <ExportBtn onClick={exportZIP} disabled={zipping} variant="zip">
                    {zipping ? '⏳ Building ZIP...' : '⬇️ Download ZIP (GSTR1 + GSTR3B)'}
                  </ExportBtn>
                </div>
              </div>
            </SectionCard>

            {/* ══════════════════════════════════════
                BLOCK 10 — GSTR-2B RECONCILIATION (Feature 2)
            ══════════════════════════════════════ */}
            <Gstr2bReconciliation
              month={month}
              year={year}
              systemPurchases={recordsCache.purchases}
            />
          </>
        )}

        {/* Feature 1 — GSTR-1 pre-flight modal */}
        {showPreflight && (
          <Gstr1PreflightModal
            sales={recordsCache.sales}
            shopGstin={shopGstin}
            onClose={() => setShowPreflight(false)}
            onProceed={() => { setShowPreflight(false); downloadGSTR1JSON(); }}
          />
        )}
      </div>
    </Layout>
  );
}
