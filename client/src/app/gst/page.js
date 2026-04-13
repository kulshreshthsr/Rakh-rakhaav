'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

/* ─── Constants & pure helpers (ALL 100% UNCHANGED) ─────────────── */
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_HI = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getToken  = () => localStorage.getItem('token');
const GST_CACHE_PREFIX = 'gst-page-v1';
const fmt       = (n) => parseFloat(n || 0).toFixed(2);
const round2    = (value) => parseFloat(Number(value || 0).toFixed(2));
const getGSTCacheKey = (month, year) => `${GST_CACHE_PREFIX}:${year}:${month}`;
const safeText  = (value = '') => String(value || '')
  .replace(/â€"|â€"/g, '-').replace(/â€™/g, "'").replace(/â€œ|â€\u009d/g, '"').replace(/â€¦/g, '...');

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
const getRecordTaxHeads = (record = {}) => {
  const directCgst = Number(record?.cgst_amount || 0);
  const directSgst = Number(record?.sgst_amount || 0);
  const directIgst = Number(record?.igst_amount || 0);
  if (directCgst || directSgst || directIgst) return { cgst: round2(directCgst), sgst: round2(directSgst), igst: round2(directIgst) };
  const totalGst = Number(record?.total_gst || 0);
  if (!totalGst) return { cgst: 0, sgst: 0, igst: 0 };
  if (getRecordGstType(record) === 'IGST') return { cgst: 0, sgst: 0, igst: round2(totalGst) };
  const half = round2(totalGst / 2);
  return { cgst: half, sgst: round2(totalGst - half), igst: 0 };
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
const buildLocalGSTSummary = (sales = [], purchases = [], month, year) => {
  const normalizedSales = sales.map((sale) => {
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

/* ─── Small reusable UI pieces ───────────────────────────────────── */
const INPUT_CLS = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all';

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
    zip:      'border border-cyan-200 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 shadow-md shadow-cyan-500/20',
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px ${cls}`}
    >{children}</button>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function GSTPage() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
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

  /* ── All logic (100% UNCHANGED) ── */
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
      const [salesRes, purchasesRes] = await Promise.all([
        fetch(apiUrl(`/api/sales?from=${from}&to=${to}`), { headers }),
        fetch(apiUrl(`/api/purchases?from=${from}&to=${to}`), { headers }),
      ]);
      if (salesRes.status === 401 || purchasesRes.status === 401) { router.push('/login'); return; }
      const salesPayload     = salesRes.ok     ? await salesRes.json()     : { sales: [] };
      const purchasesPayload = purchasesRes.ok ? await purchasesRes.json() : { purchases: [] };
      const sales     = Array.isArray(salesPayload?.sales)         ? salesPayload.sales         : [];
      const purchases = Array.isArray(purchasesPayload?.purchases) ? purchasesPayload.purchases : [];
      const nextSummary = buildLocalGSTSummary(sales, purchases, month, year);
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
    if (!isOnline) { setDrillData(type === 'sales' ? recordsCache.sales : recordsCache.purchases); setDrillLoading(false); return; }
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 0, 23, 59, 59).toISOString();
    try {
      const url = type === 'sales' ? apiUrl(`/api/sales?from=${from}&to=${to}`) : apiUrl(`/api/purchases?from=${from}&to=${to}`);
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setDrillData(type === 'sales' ? (data.sales || data) : (data.purchases || data));
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
  const exportZIP = async () => {
    if (!summary) return;
    if (!isOnline && !window.JSZip) { alert('Offline mode me ZIP export abhi available nahi hai.'); return; }
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
    } catch (err) { console.error(err); alert('ZIP export failed. Please try individual CSV/JSON exports.'); }
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
                <td className="px-4 py-2.5 font-mono text-[11px] text-cyan-600">{safeText(item.invoice_number)}</td>
                <td className="px-4 py-2.5 text-slate-700">{safeText(item.product_name||(item.items?.length>1?`${item.items.length} items`:item.items?.[0]?.product_name))}</td>
                <td className="px-4 py-2.5 text-slate-600">{safeText(item.buyer_name||item.supplier_name||'-')}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">₹{fmt(item.taxable_amount)}</td>
                <td className={`px-4 py-2.5 font-bold ${type==='sales'?'text-emerald-600':'text-cyan-600'}`}>₹{fmt(item.total_gst)}</td>
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
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ── Page header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 border border-slate-200 p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                Tax & Compliance
              </span>
              <h1 className="mt-2.5 text-[22px] font-black text-slate-900 leading-tight">GST / Tax Summary</h1>
              <p className="mt-1 text-[13px] text-slate-500">
                GST collect किया, ITC क्लेम किया, filing-ready exports — सब यहाँ
              </p>
              {!isOnline
                ? <p className="mt-2 text-[11px] font-semibold text-amber-700">📶 Offline — cached data{cacheLabel ? ` · ${cacheLabel}` : ''}</p>
                : cacheLoaded && cacheLabel
                  ? <p className="mt-2 text-[11px] text-slate-400">Last synced {cacheLabel}</p>
                  : null}
            </div>

            {/* Month / Year selectors */}
            <div className="flex gap-2 flex-shrink-0">
              <select className={INPUT_CLS} style={{ width: 130 }} value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((m, i) => <option key={m} value={i+1}>{MONTHS_HI[i]} / {m}</option>)}
              </select>
              <select className={INPUT_CLS} style={{ width: 90 }} value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                {[2023,2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Offline warning ── */}
        {!isOnline && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl mt-0.5">📶</span>
            <div>
              <p className="text-[13px] font-black text-amber-900">Offline GST view</p>
              <p className="text-[11px] text-amber-700 mt-0.5">GST page cached data dikha rahi hai. ZIP export aur fresh figures internet ke saath best kaam karenge.</p>
            </div>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[14px] font-bold text-slate-700">Summary unavailable</p>
            <p className="text-[12px] text-slate-400 mt-1">Month/year बदलकर देखें या internet check करें</p>
          </div>
        )}

        {summary && (
          <>
            {/* ══════════════════════════════════════
                BLOCK 1 — GST POSITION (TOP CARD)
            ══════════════════════════════════════ */}
            <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${isPayable ? 'bg-gradient-to-br from-rose-50 to-orange-50 border-rose-200' : 'bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200'}`}>
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-50"
                style={{ background: isPayable ? '#fca5a5' : '#6ee7b7' }} />
              <div className="relative">
                {/* Status pill */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${isPayable ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
                    {isPayable ? '⚠️ GST देना बाकी है' : '✅ Return ready to file'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{monthEn} {year}</span>
                </div>

                {/* Big net payable */}
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {isPayable ? 'Net GST Payable' : 'ITC Balance / No Liability'}
                </p>
                <p className={`text-[38px] font-black leading-none tracking-tight mb-4 ${isPayable ? 'text-rose-700' : 'text-emerald-700'}`}>
                  ₹{fmt(isPayable ? payableTotal : excessCreditTotal)}
                </p>

                {/* 3-column breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Output GST', sublabel: 'Sales से collect हुआ', value: `₹${fmt(gstCollected)}`, color: 'text-slate-800' },
                    { label: 'Input ITC',  sublabel: 'Purchase से credit',   value: `₹${fmt(gstITC)}`,       color: 'text-cyan-700'  },
                    { label: isPayable ? 'Payable' : 'Excess ITC', sublabel: 'After set-off', value: `₹${fmt(isPayable ? payableTotal : excessCreditTotal)}`, color: isPayable ? 'text-rose-700' : 'text-emerald-700' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/70 rounded-xl p-3 border border-white">
                      <p className={`text-[17px] font-black leading-none ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] font-bold text-slate-600 mt-1">{s.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.sublabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════
                BLOCK 2 — GST CALCULATION DETAIL
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead title="GST Calculation" subtitle="Output tax और ITC का पूरा हिसाब" />

              {/* Output GST */}
              <NumberRow
                label="GST Collected (Output)"
                note={`Sales से। CGST ₹${fmt(summary.sales.cgst)} + SGST ₹${fmt(summary.sales.sgst)} + IGST ₹${fmt(summary.sales.igst)}`}
                value={`₹${fmt(gstCollected)}`}
                valueColor="text-emerald-600"
              />
              <div className="px-5 pb-3">
                <button onClick={() => openDrill('sales')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-black transition-all border ${drillType==='sales' ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {drillType === 'sales' ? '▴ Sales छुपाओ' : '▾ Sales देखो'}
                </button>
              </div>
              {drillType === 'sales' && (
                <div className="border-t border-slate-100">{renderDrill('sales')}</div>
              )}

              <div className="mx-5 border-t border-slate-100" />

              {/* ITC */}
              <NumberRow
                label="GST Input Credit (ITC)"
                note={`Purchases से। CGST ₹${fmt(summary.purchases.cgst)} + SGST ₹${fmt(summary.purchases.sgst)} + IGST ₹${fmt(summary.purchases.igst)}`}
                value={`₹${fmt(gstITC)}`}
                valueColor="text-cyan-600"
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
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-black transition-all border ${drillType==='purchases' ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {drillType === 'purchases' ? '▴ Purchases छुपाओ' : '▾ Purchases देखो'}
                </button>
              </div>
              {drillType === 'purchases' && (
                <div className="border-t border-slate-100">{renderDrill('purchases')}</div>
              )}

              <div className="mx-5 border-t border-slate-100" />

              {/* Net payable */}
              <div className={`flex items-center justify-between gap-3 px-5 py-4 ${isPayable ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                <div>
                  <p className="text-[13px] font-black text-slate-900">{isPayable ? 'Net GST Payable' : 'Excess ITC / Nil Liability'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">ITC set-off के बाद बचा हुआ</p>
                </div>
                <p className={`text-[22px] font-black ${isPayable ? 'text-rose-700' : 'text-emerald-600'}`}>
                  ₹{fmt(isPayable ? payableTotal : excessCreditTotal)}
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
                      <td className="px-4 py-3 font-black text-cyan-600">₹{fmt(summary.purchases.total_gst)}</td>
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
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'B2B Invoices', count: summary.sales.b2b_count, taxable: summary.sales.b2b_taxable, color: 'bg-blue-50 border-blue-200', tc: 'text-blue-700', note: 'Business customers (GSTIN)' },
                { label: 'B2C Invoices', count: summary.sales.b2c_count, taxable: summary.sales.b2c_taxable, color: 'bg-cyan-50 border-cyan-200',  tc: 'text-cyan-700',  note: 'Regular customers' },
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
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">🏢</div>
                  <p className="text-[13px] font-bold text-slate-600">No B2B Invoices</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sales में customer का GSTIN add करो to B2B invoice बनेगा</p>
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
                          <td className="px-4 py-2.5 font-mono text-[11px] text-cyan-600">{safeText(inv.invoice_number)}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{safeText(inv.buyer_name||'-')}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{safeText(inv.buyer_gstin)}</td>
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
                        <span className="font-mono text-[11px] text-cyan-600">{safeText(inv.invoice_number)}</span>
                        <span className="font-black text-emerald-600">₹{fmt(inv.total)}</span>
                      </div>
                      <p className="text-[13px] font-bold text-slate-900">{safeText(inv.buyer_name)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">GSTIN: {safeText(inv.buyer_gstin)} · GST {inv.gst_rate}%</p>
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
                BLOCK 7 — EXPORT FOR CA
            ══════════════════════════════════════ */}
            <SectionCard>
              <SectionHead
                title="Export for CA"
                subtitle="CA को सीधे share करो"
                right={<Pill color="bg-amber-50 text-amber-700">{monthEn} {year}</Pill>}
              />
              <div className="p-5 space-y-4">
                {/* Individual exports */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Individual Files</p>
                  <div className="flex flex-wrap gap-2">
                    <ExportBtn onClick={() => exportCSV('gstr1')} variant="primary">📄 GSTR-1 CSV</ExportBtn>
                    <ExportBtn onClick={() => exportCSV('gstr3b')} variant="blue">📄 GSTR-3B CSV</ExportBtn>
                    <ExportBtn onClick={exportJSON} variant="dark">🗂 JSON</ExportBtn>
                  </div>
                </div>

                {/* ZIP export */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">सब एक साथ</p>
                  <p className="text-[12px] text-slate-500 mb-3">
                    GSTR1 + GSTR3B — CSV और JSON दोनों एक ZIP में download करो
                  </p>
                  <ExportBtn onClick={exportZIP} disabled={zipping} variant="zip">
                    {zipping ? '⏳ Building ZIP...' : '⬇️ Download ZIP (GSTR1 + GSTR3B)'}
                  </ExportBtn>
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </Layout>
  );
}