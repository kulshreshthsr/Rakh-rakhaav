'use client';
import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt    = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtINR = (n) => `₹${fmt(n)}`;
const round2 = (n) => parseFloat((n || 0).toFixed(2));
const normalizeInvNo = (s = '') => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parsePeriodStr(rtnprd) {
  // GSTN format: "MMYYYY" e.g. "042025"
  if (!rtnprd || rtnprd.length < 6) return null;
  const mm   = parseInt(rtnprd.slice(0, 2), 10);
  const yyyy = parseInt(rtnprd.slice(2), 10);
  if (mm < 1 || mm > 12 || isNaN(yyyy)) return null;
  return `${MONTHS_FULL[mm - 1]} ${yyyy}`;
}

/* ─── Parse GSTR-2B portal JSON ───────────────────────────────── */
function parseGstr2bJson(raw) {
  const meta = {
    gstin:    raw?.data?.gstin    || '',
    period:   raw?.data?.rtnprd   || '',
    genDt:    raw?.data?.gendt    || '',
  };
  const b2bEntries = [];
  (raw?.data?.docdata?.b2b || []).forEach(supplier => {
    (supplier.inv || []).forEach(inv => {
      const igst = (inv.items || []).reduce((s, i) => s + (Number(i.itm_det?.iamt) || 0), 0);
      const cgst = (inv.items || []).reduce((s, i) => s + (Number(i.itm_det?.camt) || 0), 0);
      const sgst = (inv.items || []).reduce((s, i) => s + (Number(i.itm_det?.samt) || 0), 0);
      b2bEntries.push({
        supplier_gstin: supplier.ctin  || '',
        supplier_name:  supplier.trdnm || '',
        invoice_number: inv.inum  || '',
        invoice_date:   inv.dt    || '',
        total_val:      Number(inv.val || 0),
        igst, cgst, sgst,
        rev_charge: inv.rev === 'Y',
      });
    });
  });
  return { entries: b2bEntries, meta };
}

/* ─── Reconcile: exact + fuzzy matching ──────────────────────── */
function reconcile(systemPurchases, gstr2bEntries) {
  const results   = [];
  const usedIdx   = new Set();

  systemPurchases.forEach(purchase => {
    const sysGstin = purchase.supplier_gstin || purchase.gstin || '';
    const sysInv   = purchase.supplier_invoice_no || purchase.invoice_number || '';

    // Pass 1: exact match (GSTIN + invoice number)
    let idx   = gstr2bEntries.findIndex((e, i) =>
      !usedIdx.has(i) && e.supplier_gstin === sysGstin && e.invoice_number === sysInv
    );
    let fuzzy = false;

    // Pass 2: fuzzy match (same GSTIN, normalized invoice number)
    if (idx === -1 && sysGstin) {
      idx = gstr2bEntries.findIndex((e, i) =>
        !usedIdx.has(i) &&
        e.supplier_gstin === sysGstin &&
        normalizeInvNo(e.invoice_number) === normalizeInvNo(sysInv) &&
        normalizeInvNo(sysInv).length > 0
      );
      if (idx !== -1) fuzzy = true;
    }

    if (idx !== -1) {
      usedIdx.add(idx);
      const match  = gstr2bEntries[idx];
      const sysIgst = round2(purchase.igst_amount || 0);
      const sysCgst = round2(purchase.cgst_amount || 0);
      const sysSgst = round2(purchase.sgst_amount || 0);
      const sysGst  = round2(purchase.total_gst   || (sysIgst + sysCgst + sysSgst));
      const g2bGst  = round2((match.igst || 0) + (match.cgst || 0) + (match.sgst || 0));
      const diff    = round2(Math.abs(sysGst - g2bGst));

      results.push({
        purchase, gstr2bEntry: match, fuzzy,
        status: diff < 1 ? 'matched' : 'mismatch',
        diff,
        igstDiff: round2(Math.abs(sysIgst - (match.igst || 0))),
        cgstDiff: round2(Math.abs(sysCgst - (match.cgst || 0))),
        sgstDiff: round2(Math.abs(sysSgst - (match.sgst || 0))),
        sysGst, g2bGst,
        sysHigher: sysGst > g2bGst,
        sysIgst, sysCgst, sysSgst,
      });
    } else {
      const sysGst = round2(purchase.total_gst || 0);
      // Count how many entries this supplier has in 2B (hint for user)
      const sameGstinCount = gstr2bEntries.filter((e, i) =>
        !usedIdx.has(i) && e.supplier_gstin === sysGstin
      ).length;
      results.push({
        purchase, gstr2bEntry: null, fuzzy: false,
        status: 'not_in_2b', diff: sysGst,
        sysGst, g2bGst: 0,
        sameGstinCount,
        sysIgst: round2(purchase.igst_amount || 0),
        sysCgst: round2(purchase.cgst_amount || 0),
        sysSgst: round2(purchase.sgst_amount || 0),
      });
    }
  });

  // Entries in 2B but not in system
  gstr2bEntries.forEach((entry, i) => {
    if (!usedIdx.has(i)) {
      const g2bGst = round2((entry.igst || 0) + (entry.cgst || 0) + (entry.sgst || 0));
      results.push({
        purchase: null, gstr2bEntry: entry, fuzzy: false,
        status: 'not_in_system', diff: g2bGst,
        sysGst: 0, g2bGst,
      });
    }
  });

  return results;
}

/* ─── UI constants ────────────────────────────────────────────── */
const STATUS_META = {
  matched:       { label: 'Matched',        icon: '✅', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mismatch:      { label: 'Amount Mismatch', icon: '⚠️', cls: 'bg-amber-50  text-amber-700  border-amber-200'   },
  not_in_2b:     { label: 'Not in 2B',       icon: '❌', cls: 'bg-red-50    text-red-700    border-red-200'      },
  not_in_system: { label: 'Not in System',   icon: '🔵', cls: 'bg-blue-50   text-blue-700   border-blue-200'     },
};
const ACTIONS = {
  matched:       'ITC claim के लिए safe है ✓',
  mismatch:      'Supplier से invoice amount verify करें',
  not_in_2b:     'Supplier का GSTR-1 check करें',
  not_in_system: 'Purchase record में add करें',
};

/* ════════════════════════════════════════════════════════════════ */
export default function Gstr2bReconciliation({ month, year, systemPurchases = [] }) {
  const [results,      setResults]      = useState(null);
  const [fileError,    setFileError]    = useState('');
  const [fileMeta,     setFileMeta]     = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search,       setSearch]       = useState('');
  const [dragging,     setDragging]     = useState(false);
  const [expandedRow,  setExpandedRow]  = useState(null);

  const selectedPeriod = `${MONTHS_FULL[month - 1]} ${year}`;

  /* ── File processing ── */
  const processFile = useCallback((file) => {
    if (!file) return;
    setFileError('');
    if (!file.name.toLowerCase().endsWith('.json')) {
      setFileError('केवल .json file upload करें — GST portal से download की हुई GSTR-2B JSON file।');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const { entries, meta } = parseGstr2bJson(raw);
        if (!entries.length) {
          setFileError('इस GSTR-2B JSON में कोई B2B entry नहीं मिली। GST portal से सही महीने की file choose करें।');
          return;
        }
        setFileMeta({ ...meta, fileName: file.name, fileSize: file.size, entryCount: entries.length });
        setResults(reconcile(systemPurchases, entries));
        setFilterStatus('all');
        setSearch('');
        setExpandedRow(null);
      } catch {
        setFileError('Invalid JSON file। GST portal → Returns Dashboard → GSTR-2B → View → Download JSON से file लें।');
      }
    };
    reader.readAsText(file);
  }, [systemPurchases]);

  const handleFileChange  = (e) => processFile(e.target.files?.[0]);
  const handleDrop        = useCallback((e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files?.[0]); }, [processFile]);
  const handleDragOver    = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave   = () => setDragging(false);
  const handleReset       = () => { setResults(null); setFileMeta(null); setFileError(''); setFilterStatus('all'); setSearch(''); setExpandedRow(null); };

  /* ── Summary computed values ── */
  const summary = useMemo(() => {
    if (!results) return null;
    const matched       = results.filter(r => r.status === 'matched');
    const mismatch      = results.filter(r => r.status === 'mismatch');
    const notIn2b       = results.filter(r => r.status === 'not_in_2b');
    const notInSystem   = results.filter(r => r.status === 'not_in_system');
    const itcSafe       = round2(matched.reduce((s, r) => s + r.sysGst, 0));
    const itcNotIn2b    = round2(notIn2b.reduce((s, r) => s + r.sysGst, 0));
    const itcMismatch   = round2(mismatch.reduce((s, r) => s + r.diff, 0));
    const itcAtRisk     = round2(itcNotIn2b + itcMismatch);
    const itcMissing    = round2(notInSystem.reduce((s, r) => s + r.g2bGst, 0));
    const denominator   = matched.length + mismatch.length + notIn2b.length;
    const score         = denominator > 0 ? Math.round((matched.length / denominator) * 100) : 0;
    return { matched, mismatch, notIn2b, notInSystem, itcSafe, itcNotIn2b, itcMismatch, itcAtRisk, itcMissing, score };
  }, [results]);

  /* ── Filtered rows ── */
  const filtered = useMemo(() => {
    if (!results) return [];
    let list = filterStatus === 'all' ? results : results.filter(r => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => {
        const name  = (r.purchase?.supplier_name    || r.gstr2bEntry?.supplier_name    || '').toLowerCase();
        const gstin = (r.purchase?.supplier_gstin   || r.gstr2bEntry?.supplier_gstin   || '').toLowerCase();
        const inv   = (r.purchase?.supplier_invoice_no || r.purchase?.invoice_number   || r.gstr2bEntry?.invoice_number || '').toLowerCase();
        return name.includes(q) || gstin.includes(q) || inv.includes(q);
      });
    }
    return list;
  }, [results, filterStatus, search]);

  /* ── CSV export ── */
  const handleExportCSV = () => {
    if (!results) return;
    const data = results.map(r => ({
      'Supplier GSTIN':         r.gstr2bEntry?.supplier_gstin || r.purchase?.supplier_gstin || '',
      'Supplier Name':          r.purchase?.supplier_name || r.gstr2bEntry?.supplier_name || '',
      'Invoice No (System)':    r.purchase?.supplier_invoice_no || r.purchase?.invoice_number || '',
      'Invoice No (2B)':        r.gstr2bEntry?.invoice_number || '',
      'Invoice Date (2B)':      r.gstr2bEntry?.invoice_date || '',
      'System Total GST (₹)':   r.sysGst?.toFixed(2) || '0.00',
      'GSTR-2B Total GST (₹)':  r.g2bGst?.toFixed(2) || '0.00',
      'Difference (₹)':         r.diff?.toFixed(2)   || '0.00',
      'System IGST (₹)':        (r.sysIgst || 0).toFixed(2),
      'System CGST (₹)':        (r.sysCgst || 0).toFixed(2),
      'System SGST (₹)':        (r.sysSgst || 0).toFixed(2),
      '2B IGST (₹)':            (r.gstr2bEntry?.igst || 0).toFixed(2),
      '2B CGST (₹)':            (r.gstr2bEntry?.cgst || 0).toFixed(2),
      '2B SGST (₹)':            (r.gstr2bEntry?.sgst || 0).toFixed(2),
      'Fuzzy Match':            r.fuzzy ? 'Yes' : 'No',
      'Status':                 STATUS_META[r.status]?.label || r.status,
      'Recommended Action':     ACTIONS[r.status] || '',
    }));
    const csv  = Papa.unparse(data);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM → Excel opens correctly
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `GSTR2B_Recon_${MONTHS_FULL[month - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-[14px] font-black text-slate-900">GSTR-2B Reconciliation</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {fileMeta?.period ? (parsePeriodStr(fileMeta.period) ?? selectedPeriod) : selectedPeriod}
            {' '}— portal 2B से purchases match करें
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            🔒 Device-only
          </span>
          {results && (
            <button type="button" onClick={handleReset}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >Reset</button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ══════════ UPLOAD STATE ══════════ */}
        {!results && (
          <>
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-base flex-shrink-0 mt-0.5">ℹ️</span>
              <div className="text-[12px] text-blue-800 leading-relaxed space-y-0.5">
                <p className="font-black">GSTR-2B JSON कैसे download करें:</p>
                <p>GST portal → Returns Dashboard → GSTR-2B → <strong>View</strong> → <strong>Download JSON</strong></p>
                <p className="text-blue-600 text-[11px] mt-1">यह JSON आपके device पर ही process होगी — कहीं upload नहीं होगी।</p>
              </div>
            </div>

            {/* Drag & Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative rounded-2xl border-2 border-dashed transition-all ${
                dragging
                  ? 'border-green-500 bg-green-50 scale-[1.01] shadow-md shadow-green-200'
                  : 'border-slate-300 bg-slate-50/50 hover:border-green-400 hover:bg-green-50/20'
              }`}
            >
              <label className="block cursor-pointer select-none">
                <input type="file" accept=".json" onChange={handleFileChange} className="sr-only" />
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                  <span className="text-5xl">{dragging ? '📂' : '📥'}</span>
                  <div>
                    <p className="text-[15px] font-black text-slate-800">
                      {dragging ? 'Drop करें — ready है!' : 'GSTR-2B JSON file यहाँ drag करें'}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1">या नीचे button से file choose करें</p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-black shadow-md shadow-green-600/20 hover:opacity-90 transition-opacity">
                    📁 File Choose करें
                  </span>
                </div>
              </label>
            </div>

            {fileError && (
              <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200">
                <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                <p className="text-[12px] font-semibold text-red-700">{fileError}</p>
              </div>
            )}
          </>
        )}

        {/* ══════════ RESULTS STATE ══════════ */}
        {results && summary && (
          <>
            {/* ── File info bar ── */}
            {fileMeta && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xl flex-shrink-0">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-slate-800 truncate">{fileMeta.fileName}</p>
                  <p className="text-[10px] text-slate-400">
                    {fileMeta.entryCount} entries · {(fileMeta.fileSize / 1024).toFixed(1)} KB
                    {fileMeta.period && parsePeriodStr(fileMeta.period) && ` · Period: ${parsePeriodStr(fileMeta.period)}`}
                    {fileMeta.genDt && ` · Generated: ${fileMeta.genDt}`}
                  </p>
                </div>
                <button type="button" onClick={handleReset}
                  className="flex-shrink-0 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                >✕ Remove</button>
              </div>
            )}

            {/* ── Reconciliation Score Card ── */}
            <div className={`flex items-center gap-5 px-5 py-4 rounded-2xl border ${
              summary.score >= 80 ? 'bg-emerald-50 border-emerald-200'
              : summary.score >= 50 ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex-shrink-0 text-center min-w-[64px]">
                <p className={`text-[42px] font-black leading-none ${
                  summary.score >= 80 ? 'text-emerald-600' : summary.score >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>{summary.score}%</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                  summary.score >= 80 ? 'text-emerald-500' : summary.score >= 50 ? 'text-amber-500' : 'text-red-500'
                }`}>Reconciled</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-slate-900">
                  {summary.score >= 80 ? '✅ अच्छी reconciliation है'
                    : summary.score >= 50 ? '⚠️ कुछ mismatches हैं — ध्यान दें'
                    : '❌ बड़े issues हैं — CA से मिलें'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {summary.matched.length} of {summary.matched.length + summary.mismatch.length + summary.notIn2b.length} purchases matched
                </p>
                {summary.itcAtRisk > 0 && (
                  <p className="text-[13px] font-black text-red-600 mt-1.5">
                    ⚠️ {fmtINR(summary.itcAtRisk)} ITC at risk
                  </p>
                )}
                {summary.itcAtRisk === 0 && (
                  <p className="text-[12px] font-black text-emerald-600 mt-1.5">
                    🎉 सारा ITC safe है — {fmtINR(summary.itcSafe)} claim होगा
                  </p>
                )}
              </div>
            </div>

            {/* ── 4 KPI filter cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'matched',       label: 'Matched',       count: summary.matched.length,     amt: summary.itcSafe,    amtLabel: 'ITC safe',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', amtCls: 'text-emerald-600' },
                { key: 'mismatch',      label: 'Mismatch',      count: summary.mismatch.length,    amt: summary.itcMismatch, amtLabel: 'ITC diff',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     amtCls: 'text-amber-600' },
                { key: 'not_in_2b',     label: 'Not in 2B',     count: summary.notIn2b.length,     amt: summary.itcNotIn2b,  amtLabel: 'ITC at risk', color: 'text-red-700',   bg: 'bg-red-50 border-red-200',         amtCls: 'text-red-600' },
                { key: 'not_in_system', label: 'Not in System', count: summary.notInSystem.length, amt: summary.itcMissing,  amtLabel: 'ITC in 2B', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       amtCls: 'text-blue-600' },
              ].map(s => (
                <button key={s.key} type="button"
                  onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${s.bg} ${
                    filterStatus === s.key ? 'ring-2 ring-offset-1 ring-slate-500 shadow-sm scale-[1.02]' : 'hover:opacity-80'
                  }`}
                >
                  <p className={`text-[26px] font-black leading-none ${s.color}`}>{s.count}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${s.color}`}>{s.label}</p>
                  {s.amt > 0.005 && (
                    <p className={`text-[10px] font-black mt-1.5 ${s.amtCls}`}>{fmtINR(s.amt)}</p>
                  )}
                  {s.amt > 0.005 && (
                    <p className={`text-[9px] font-semibold ${s.amtCls} opacity-70`}>{s.amtLabel}</p>
                  )}
                </button>
              ))}
            </div>

            {/* ── Search + export row ── */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
                <input
                  type="text"
                  placeholder="Supplier, GSTIN, Invoice No..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-xl border-2 border-slate-200 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <button type="button" onClick={handleExportCSV}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
              >📄 Export CSV</button>
            </div>
            {(filterStatus !== 'all' || search.trim()) && (
              <div className="flex items-center justify-between text-[11px]">
                <p className="text-slate-500">
                  {filtered.length} of {results.length} records
                  {filterStatus !== 'all' && ` · ${STATUS_META[filterStatus]?.icon} ${STATUS_META[filterStatus]?.label}`}
                  {search.trim() && ` · "${search}"`}
                </p>
                <button type="button"
                  onClick={() => { setFilterStatus('all'); setSearch(''); }}
                  className="font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >✕ Clear</button>
              </div>
            )}

            {/* ── Desktop table ── */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['','Supplier','Invoice No','Date','Your GST','2B GST','Diff','Status','Action'].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((r, i) => {
                    const meta     = STATUS_META[r.status];
                    const isExp    = expandedRow === i;
                    const canExp   = r.status !== 'matched';
                    const supplier = r.purchase?.supplier_name || r.gstr2bEntry?.supplier_name || r.purchase?.supplier_gstin || r.gstr2bEntry?.supplier_gstin || '—';
                    const gstin    = r.purchase?.supplier_gstin || r.gstr2bEntry?.supplier_gstin || '';
                    const invNo    = r.purchase?.supplier_invoice_no || r.purchase?.invoice_number || r.gstr2bEntry?.invoice_number || '—';
                    const invDate  = r.gstr2bEntry?.invoice_date || '—';

                    return (
                      <React.Fragment key={i}>
                        <tr
                          onClick={() => canExp && setExpandedRow(isExp ? null : i)}
                          className={`transition-colors ${canExp ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/40'}`}
                        >
                          <td className="px-3 py-3 text-slate-400 text-[11px] w-4">
                            {canExp && <span className="select-none">{isExp ? '▴' : '▾'}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800 max-w-[140px] truncate">{supplier}</p>
                            <p className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">{gstin}</p>
                            {r.fuzzy && (
                              <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full">~ Fuzzy</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-slate-600 max-w-[120px] truncate">{invNo}</td>
                          <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-[11px]">{invDate}</td>
                          <td className="px-3 py-3 font-bold text-slate-800">{r.sysGst > 0 ? fmtINR(r.sysGst) : '—'}</td>
                          <td className="px-3 py-3 font-bold text-slate-800">{r.g2bGst > 0 ? fmtINR(r.g2bGst) : '—'}</td>
                          <td className="px-3 py-3 font-bold">
                            {r.status === 'mismatch' && r.diff > 0
                              ? <span className="text-amber-600">{fmtINR(r.diff)}</span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${meta.cls}`}>
                              {meta.icon} {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[130px] leading-snug">{ACTIONS[r.status]}</td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExp && (
                          <tr>
                            <td colSpan={9} className="px-5 py-4 bg-slate-50/70 border-b border-slate-100">
                              {r.status === 'mismatch' && (
                                <div className="space-y-3">
                                  <p className="text-[11px] font-black text-slate-700">Per-head breakdown (System vs GSTR-2B):</p>
                                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    {[
                                      ['IGST', r.igstDiff, r.sysIgst || 0, r.gstr2bEntry?.igst || 0],
                                      ['CGST', r.cgstDiff, r.sysCgst || 0, r.gstr2bEntry?.cgst || 0],
                                      ['SGST', r.sgstDiff, r.sysSgst || 0, r.gstr2bEntry?.sgst || 0],
                                    ].map(([head, diff, sys, g2b]) => (
                                      <div key={head} className={`p-2.5 rounded-xl border ${diff > 0.005 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <p className="font-black text-slate-700 mb-1">{head}</p>
                                        <p className="text-slate-600">System: {fmtINR(sys)}</p>
                                        <p className="text-slate-600">2B: {fmtINR(g2b)}</p>
                                        {diff > 0.005 && <p className="font-black text-amber-600 mt-1">Diff: {fmtINR(diff)}</p>}
                                      </div>
                                    ))}
                                  </div>
                                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-semibold ${r.sysHigher ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                    <span>{r.sysHigher ? '📌' : '📌'}</span>
                                    {r.sysHigher
                                      ? 'आपका system 2B से ज़्यादा दिखाता है। Supplier की GSTR-1 check करें — शायद उन्होंने कम amount file किया।'
                                      : '2B में ज़्यादा GST है। अपनी purchase entry verify करें — amount update करना हो सकता है।'}
                                  </div>
                                </div>
                              )}
                              {r.status === 'not_in_2b' && (
                                <div className="space-y-1.5 text-[11px]">
                                  <p className="font-black text-red-700">❌ यह invoice GSTR-2B में नहीं है।</p>
                                  {r.sameGstinCount > 0
                                    ? <p className="text-amber-700">⚠️ इस supplier के {r.sameGstinCount} और invoice(s) 2B में हैं — invoice number mismatch हो सकता है।</p>
                                    : <p className="text-slate-600">Supplier ने अभी तक GSTR-1 file नहीं किया होगा। अगले महीने फिर reconcile करें।</p>
                                  }
                                  <p className="text-red-600">ITC at risk: <strong className="font-black">{fmtINR(r.sysGst)}</strong> — जब तक 2B में नहीं आता, claim न करें।</p>
                                </div>
                              )}
                              {r.status === 'not_in_system' && (
                                <div className="space-y-1.5 text-[11px]">
                                  <p className="font-black text-blue-700">🔵 यह invoice आपके purchase records में नहीं है।</p>
                                  <p className="text-slate-600">Supplier: <strong>{r.gstr2bEntry?.supplier_gstin}</strong> · Invoice: <strong>{r.gstr2bEntry?.invoice_number}</strong> · Date: {r.gstr2bEntry?.invoice_date}</p>
                                  <p className="text-slate-600">2B GST amount: <strong className="text-blue-700">{fmtINR(r.g2bGst)}</strong></p>
                                  <p className="text-blue-700">इस purchase को add करें — तभी ITC claim होगा।</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-[12px] text-slate-400">
                        {filterStatus !== 'all' || search.trim() ? 'इस filter में कोई record नहीं मिला' : 'कोई record नहीं'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="sm:hidden space-y-2">
              {filtered.map((r, i) => {
                const meta     = STATUS_META[r.status];
                const isExp    = expandedRow === i;
                const canExp   = r.status !== 'matched';
                const supplier = r.purchase?.supplier_name || r.gstr2bEntry?.supplier_name || r.purchase?.supplier_gstin || r.gstr2bEntry?.supplier_gstin || '—';
                const invNo    = r.purchase?.supplier_invoice_no || r.purchase?.invoice_number || r.gstr2bEntry?.invoice_number || '—';
                const invDate  = r.gstr2bEntry?.invoice_date || '';

                return (
                  <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                    <button type="button"
                      onClick={() => canExp && setExpandedRow(isExp ? null : i)}
                      className={`w-full text-left p-4 space-y-2.5 transition-colors ${canExp ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-900 truncate">{supplier}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{invNo}</p>
                          {r.fuzzy && <span className="text-[9px] text-amber-600 font-bold">~ Fuzzy match</span>}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${meta.cls}`}>
                            {meta.icon} {meta.label}
                          </span>
                          {canExp && <span className="text-[10px] text-slate-400">{isExp ? '▴' : '▾'}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-slate-400 font-bold text-[10px]">Your GST</p>
                          <p className="font-black text-slate-900">{r.sysGst > 0 ? fmtINR(r.sysGst) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-bold text-[10px]">2B GST</p>
                          <p className="font-black text-slate-900">{r.g2bGst > 0 ? fmtINR(r.g2bGst) : '—'}</p>
                        </div>
                        {r.status === 'mismatch' && (
                          <div>
                            <p className="text-amber-600 font-bold text-[10px]">Difference</p>
                            <p className="font-black text-amber-600">{fmtINR(r.diff)}</p>
                          </div>
                        )}
                        {invDate && (
                          <div>
                            <p className="text-slate-400 font-bold text-[10px]">Date (2B)</p>
                            <p className="font-semibold text-slate-600">{invDate}</p>
                          </div>
                        )}
                      </div>
                    </button>
                    {isExp && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-2">
                        {r.status === 'mismatch' && (
                          <>
                            <p className="text-[11px] font-black text-slate-700">Per-head breakdown:</p>
                            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                              {[
                                ['IGST', r.igstDiff, r.sysIgst || 0, r.gstr2bEntry?.igst || 0],
                                ['CGST', r.cgstDiff, r.sysCgst || 0, r.gstr2bEntry?.cgst || 0],
                                ['SGST', r.sgstDiff, r.sysSgst || 0, r.gstr2bEntry?.sgst || 0],
                              ].map(([head, diff, sys, g2b]) => (
                                <div key={head} className={`p-2 rounded-lg border ${diff > 0.005 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                  <p className="font-black">{head}</p>
                                  <p>Sys: {fmtINR(sys)}</p>
                                  <p>2B: {fmtINR(g2b)}</p>
                                  {diff > 0.005 && <p className="font-black text-amber-600">{fmtINR(diff)}</p>}
                                </div>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-600 font-semibold">
                              {r.sysHigher ? '📌 System 2B से ज़्यादा — supplier GSTR-1 verify करें।' : '📌 2B में ज़्यादा — purchase entry check करें।'}
                            </p>
                          </>
                        )}
                        {r.status === 'not_in_2b' && (
                          <div className="text-[11px] space-y-1">
                            {r.sameGstinCount > 0
                              ? <p className="text-amber-700">⚠️ Supplier के {r.sameGstinCount} other invoices 2B में हैं — invoice number check करें।</p>
                              : <p className="text-slate-600">Supplier ने GSTR-1 file नहीं किया होगा। अगले महीने check करें।</p>
                            }
                            <p className="text-red-600 font-bold">ITC at risk: {fmtINR(r.sysGst)}</p>
                          </div>
                        )}
                        {r.status === 'not_in_system' && (
                          <div className="text-[11px] space-y-1">
                            <p className="text-blue-700 font-semibold">Date: {r.gstr2bEntry?.invoice_date} · GST: {fmtINR(r.g2bGst)}</p>
                            <p className="text-blue-600">यह purchase add करें — तभी ITC claim होगा।</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-[12px] text-slate-400">कोई record नहीं मिला</div>
              )}
            </div>

            {/* ── ITC Reconciliation Summary ── */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">ITC Reconciliation Summary</p>
              <div className="space-y-2">
                {[
                  { label: 'ITC Safe to Claim',         val: summary.itcSafe,     cls: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✅' },
                  { label: 'ITC at Risk (Not in 2B)',    val: summary.itcNotIn2b,  cls: 'text-red-700',     bg: 'bg-red-50/50',  icon: '❌' },
                  { label: 'ITC Disputed (Mismatch)',    val: summary.itcMismatch, cls: 'text-amber-700',   bg: 'bg-amber-50/50', icon: '⚠️' },
                  { label: 'Claimable ITC in 2B (Not in System)', val: summary.itcMissing, cls: 'text-blue-700', bg: 'bg-blue-50/50', icon: '🔵' },
                ].map(row => (
                  <div key={row.label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${row.bg}`}>
                    <span className="text-[12px] text-slate-700">{row.icon} {row.label}</span>
                    <span className={`text-[14px] font-black ${row.cls}`}>{fmtINR(row.val)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 border-t border-slate-200 mt-1">
                  <span className="text-[12px] font-black text-slate-800">Total ITC Reviewed</span>
                  <span className="text-[16px] font-black text-slate-900">{fmtINR(summary.itcSafe + summary.itcAtRisk)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Not started + no error ── */}
        {!results && !fileError && (
          <p className="text-center text-[12px] text-slate-400 py-4">
            GSTR-2B JSON upload होने के बाद यहाँ reconciliation दिखेगी।
          </p>
        )}

      </div>
    </div>
  );
}
