'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_HI = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);

export default function GSTPage() {
  const router = useRouter();
  const now    = new Date();

  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);

  // Drill-down state
  const [drillType,    setDrillType]    = useState(null);
  const [drillData,    setDrillData]    = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── Fetch GST summary ────────────────────────────────────────────────────────
  const fetchSummary = async () => {
    setLoading(true);
    setDrillType(null);
    try {
      const res = await fetch(`${API}/api/sales/gst-summary?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      setSummary(await res.json());
    } catch {}
    setLoading(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchSummary();
  }, [month, year, router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // ── Drill-down ───────────────────────────────────────────────────────────────
  const openDrill = async (type) => {
    if (drillType === type) { setDrillType(null); return; }
    setDrillType(type);
    setDrillLoading(true);

    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 0, 23, 59, 59).toISOString();

    try {
      const url = type === 'sales'
        ? `${API}/api/sales?from=${from}&to=${to}`
        : `${API}/api/purchases?from=${from}&to=${to}`;

      const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setDrillData(type === 'sales' ? (data.sales || data) : (data.purchases || data));
    } catch {}
    setDrillLoading(false);
  };

  // ── Helpers: build CSV string ─────────────────────────────────────────────────
  const buildGSTR1CSV = () => {
    const rows = [
      ['GSTR-1 B2B Invoices'],
      ['Invoice No','Date','Buyer Name','Buyer GSTIN','Taxable Amount','GST Rate%','CGST','SGST','IGST','Total'],
      ...summary.gstr1.b2b_invoices.map(i => [
        i.invoice_number,
        new Date(i.date).toLocaleDateString('en-IN'),
        i.buyer_name  || '',
        i.buyer_gstin || '',
        fmt(i.taxable_amount),
        i.gst_rate + '%',
        fmt(i.cgst), fmt(i.sgst), fmt(i.igst), fmt(i.total),
      ]),
      [''],
      ['GSTR-1 B2C Summary'],
      ['Count','Taxable Amount','Total GST','Total Amount'],
      [
        summary.gstr1.b2c_summary.count,
        fmt(summary.gstr1.b2c_summary.taxable_amount),
        fmt(summary.gstr1.b2c_summary.total_gst),
        fmt(summary.gstr1.b2c_summary.total_amount),
      ],
    ];
    return rows.map(r => r.join(',')).join('\n');
  };

  const buildGSTR3BCSV = () => {
    const rows = [
      ['GSTR-3B Summary'],
      ['Month/Year', `${MONTHS[month - 1]} ${year}`],
      [''],
      ['Description', 'Amount (Rs)'],
      ['GST Collected (Output)',  fmt(summary.gstr3b.output_gst)],
      ['GST Input Credit (ITC)', fmt(summary.gstr3b.input_gst)],
      ['Net GST Payable After ITC Set-Off', fmt(summary.gstr3b.payable_total ?? summary.gstr3b.net_payable)],
      ['Outward Taxable Sales',  fmt(summary.gstr3b.outward_taxable)],
      [''],
      ['Remaining Liability By Head'],
      ['CGST Payable', fmt(summary.gstr3b.payable_by_head?.cgst)],
      ['SGST Payable', fmt(summary.gstr3b.payable_by_head?.sgst)],
      ['IGST Payable', fmt(summary.gstr3b.payable_by_head?.igst)],
      [''],
      ['Sales Breakup'],
      ['Total Sales',            fmt(summary.sales.total_amount)],
      ['CGST Collected',         fmt(summary.sales.cgst)],
      ['SGST Collected',         fmt(summary.sales.sgst)],
      ['IGST Collected',         fmt(summary.sales.igst)],
      [''],
      ['Purchase Breakup'],
      ['Total Purchases',        fmt(summary.purchases.taxable_amount)],
      ['CGST Input',             fmt(summary.purchases.cgst)],
      ['SGST Input',             fmt(summary.purchases.sgst)],
      ['IGST Input',             fmt(summary.purchases.igst)],
    ];
    return rows.map(r => r.join(',')).join('\n');
  };

  // ── Individual CSV exports (unchanged behaviour) ─────────────────────────────
  const exportCSV = (type) => {
    if (!summary) return;
    const csv      = type === 'gstr1' ? buildGSTR1CSV() : buildGSTR3BCSV();
    const filename = type === 'gstr1'
      ? `GSTR1_${year}_${String(month).padStart(2, '0')}.csv`
      : `GSTR3B_${year}_${String(month).padStart(2, '0')}.csv`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `GST_${year}_${String(month).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── UPGRADE 3: ZIP Export ────────────────────────────────────────────────────
  // Structure:
  //   /GSTR1/gstr1.csv
  //   /GSTR1/gstr1.json
  //   /GSTR3B/gstr3b.csv
  //   /GSTR3B/gstr3b.json
  const exportZIP = async () => {
    if (!summary) return;
    setZipping(true);

    try {
      // Dynamically load JSZip from CDN (no install needed)
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const script   = document.createElement('script');
          script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload  = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const zip        = new window.JSZip();
      const monthPad   = String(month).padStart(2, '0');
      const periodTag  = `${year}_${monthPad}`;

      // ── GSTR1 folder ──────────────────────────────────────────────────────
      const gstr1Folder = zip.folder('GSTR1');

      // gstr1.csv
      gstr1Folder.file('gstr1.csv', buildGSTR1CSV());

      // gstr1.json — only GSTR1 slice of summary
      const gstr1Json = {
        period: { month: MONTHS[month - 1], year },
        b2b_invoices: summary.gstr1.b2b_invoices,
        b2c_summary:  summary.gstr1.b2c_summary,
        sales_totals: {
          total_amount:  summary.sales.total_amount,
          taxable:       summary.sales.taxable_amount,
          cgst:          summary.sales.cgst,
          sgst:          summary.sales.sgst,
          igst:          summary.sales.igst,
          total_gst:     summary.sales.total_gst,
          b2b_count:     summary.sales.b2b_count,
          b2c_count:     summary.sales.b2c_count,
          b2b_taxable:   summary.sales.b2b_taxable,
          b2c_taxable:   summary.sales.b2c_taxable,
        },
      };
      gstr1Folder.file('gstr1.json', JSON.stringify(gstr1Json, null, 2));

      // ── GSTR3B folder ─────────────────────────────────────────────────────
      const gstr3bFolder = zip.folder('GSTR3B');

      // gstr3b.csv
      gstr3bFolder.file('gstr3b.csv', buildGSTR3BCSV());

      // gstr3b.json — only GSTR3B slice of summary
      const gstr3bJson = {
        period: { month: MONTHS[month - 1], year },
        gstr3b: summary.gstr3b,
        purchases: {
          total_amount:  summary.purchases.total_amount,
          taxable:       summary.purchases.taxable_amount,
          cgst:          summary.purchases.cgst,
          sgst:          summary.purchases.sgst,
          igst:          summary.purchases.igst,
          total_gst:     summary.purchases.total_gst,
        },
        payable_by_head: summary.gstr3b.payable_by_head,
        excess_credit: summary.gstr3b.excess_credit,
        net_payable:  summary.gstr3b.payable_total ?? summary.gstr3b.net_payable,
        output_gst:   summary.gstr3b.output_gst,
        input_gst:    summary.gstr3b.input_gst,
      };
      gstr3bFolder.file('gstr3b.json', JSON.stringify(gstr3bJson, null, 2));

      // ── Generate and download ZIP ─────────────────────────────────────────
      const blob    = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = url;
      a.download    = `GST_Export_${periodTag}.zip`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed. Please try individual CSV/JSON exports.');
    }

    setZipping(false);
  };

  // ── Derived values ───────────────────────────────────────────────────────────
  const netPayable   = summary?.gstr3b?.net_payable || 0;
  const gstCollected = summary?.gstr3b?.output_gst  || 0;
  const gstITC       = summary?.gstr3b?.input_gst   || 0;
  const payableByHead = summary?.gstr3b?.payable_by_head || { cgst: 0, sgst: 0, igst: 0 };
  const payableTotal = summary?.gstr3b?.payable_total ?? netPayable;
  const excessCredit = summary?.gstr3b?.excess_credit || { cgst: 0, sgst: 0, igst: 0 };
  const excessCreditTotal = (excessCredit.cgst || 0) + (excessCredit.sgst || 0) + (excessCredit.igst || 0);
  const monthHi      = MONTHS_HI[month - 1];
  const monthEn      = MONTHS[month - 1];
  const isPayable    = payableTotal > 0;
  const isRefund     = false;

  const returnStatus = summary
    ? summary.sales.total > 0
      ? { ok: true,  msg: '✅ Return दाखिल करने के लिए तैयार / Ready to file' }
      : { ok: false, msg: '⚠️ इस महीने कोई sales नहीं / No sales this month' }
    : null;

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div className="gst-hero-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Tax centre</div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>GST सारांश / GST Summary</div>
              <div style={{ marginTop: 10, color: 'rgba(226,232,240,0.7)', fontSize: 13.5, maxWidth: 420, lineHeight: 1.55 }}>
                Track collected GST, ITC and filing-ready exports for the selected period.
              </div>
            </div>
            <div className="gst-period-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{
                  minWidth: 128,
                  height: 44,
                  background: 'rgba(255,255,255,0.92)',
                  borderColor: 'rgba(255,255,255,0.28)',
                  boxShadow: '0 12px 24px rgba(13,19,43,0.12)',
                }}
                value={month}
                onChange={e => setMonth(parseInt(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{MONTHS_HI[i]} / {m}</option>
                ))}
              </select>
              <select
                className="form-input"
                style={{
                  minWidth: 96,
                  height: 44,
                  background: 'rgba(255,255,255,0.92)',
                  borderColor: 'rgba(255,255,255,0.28)',
                  boxShadow: '0 12px 24px rgba(13,19,43,0.12)',
                }}
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
              >
                {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {loading && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>⏳ लोड हो रहा है...</div>}
            </div>
          </div>
        </section>

      {!summary ? (
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⏳ लोड हो रहा है...</div>
        </div>
      ) : (
        <>
          {/* ── SECTION 1: NET PAYABLE BANNER ── */}
          <div className="soft-panel" style={{
            background: isPayable
              ? 'linear-gradient(180deg, rgba(255,245,245,0.96), rgba(255,255,255,0.94))'
              : isRefund
              ? 'linear-gradient(180deg, rgba(240,253,244,0.96), rgba(255,255,255,0.94))'
              : 'linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,0.94))',
            border: `1px solid ${isPayable ? '#fecaca' : isRefund ? '#bbf7d0' : '#e2e8f0'}`,
            padding: '18px 20px', marginBottom: 20,
          }}>
            <div className="gst-status-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="gst-status-main" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  background: isPayable ? '#fee2e2' : isRefund ? '#dcfce7' : '#eef2ff',
                }}>{isPayable ? '⚠️' : isRefund ? '🎉' : '✅'}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isPayable ? '#991b1b' : isRefund ? '#065f46' : '#374151', lineHeight: 1.25 }}>
                    {isPayable
                      ? `${monthHi} ${year}: ₹${fmt(netPayable)} GST भरना है`
                      : isRefund
                      ? `${monthHi} ${year}: ₹${fmt(Math.abs(netPayable))} GST वापस मिलेगा`
                      : `${monthHi} ${year}: कोई GST देय नहीं ✅`}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                    {isPayable
                      ? `${monthEn} ${year}: Pay ₹${fmt(netPayable)} GST`
                      : isRefund
                      ? `${monthEn} ${year}: GST refund ₹${fmt(Math.abs(netPayable))}`
                      : `${monthEn} ${year}: No GST payable`}
                  </div>
                </div>
              </div>
              {returnStatus && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: returnStatus.ok ? '#dcfce7' : '#fef9c3',
                  color: returnStatus.ok ? '#166534' : '#854d0e',
                  padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>
                  {returnStatus.msg}
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 2: GST CALCULATION ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e', marginBottom: 16 }}>
              🧮 GST हिसाब / Calculation
            </div>

            <div className="mini-stat-grid" style={{ marginBottom: 16 }}>
              <div className="mini-stat">
                <div className="mini-stat-label">Output GST</div>
                <div className="mini-stat-value" style={{ color: '#059669' }}>₹{fmt(gstCollected)}</div>
                <div className="mini-stat-note">Collected from sales</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Input GST / ITC</div>
                <div className="mini-stat-value" style={{ color: '#2563eb' }}>₹{fmt(gstITC)}</div>
                <div className="mini-stat-note">Claimed from purchases</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Net Position</div>
                <div className="mini-stat-value" style={{ color: isPayable ? '#dc2626' : excessCreditTotal > 0 ? '#059669' : '#475569' }}>₹{fmt(isPayable ? payableTotal : excessCreditTotal)}</div>
                <div className="mini-stat-note">{isPayable ? 'Payable after ITC set-off' : excessCreditTotal > 0 ? 'Unused ITC left' : 'Balanced'}</div>
              </div>
            </div>

            {/* GST Collected — clickable drill-down */}
            <div
              onClick={() => openDrill('sales')}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', background: drillType === 'sales' ? '#dcfce7' : '#f0fdf4',
                borderRadius: 10, marginBottom: 10, cursor: 'pointer',
                border: `1.5px solid ${drillType === 'sales' ? '#86efac' : 'transparent'}`,
                transition: 'all 0.2s',
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#065f46' }}>
                  ✅ GST वसूला (Output) &nbsp;
                  <span style={{ fontSize: 11, background: '#bbf7d0', color: '#065f46', padding: '2px 8px', borderRadius: 20 }}>
                    {drillType === 'sales' ? '▲ बंद करें' : '▼ Sales देखें'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Customers से बिक्री में लिया • CGST ₹{fmt(summary.sales.cgst)} + SGST ₹{fmt(summary.sales.sgst)} + IGST ₹{fmt(summary.sales.igst)}
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>+₹{fmt(gstCollected)}</div>
            </div>

            {/* Sales Drill-down */}
            {drillType === 'sales' && (
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                {drillLoading ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>⏳ लोड हो रहा है...</div>
                ) : drillData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>इस महीने कोई sales नहीं</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#dcfce7' }}>
                          <th style={thStyle}>Invoice</th>
                          <th style={thStyle}>Product</th>
                          <th style={thStyle}>Taxable</th>
                          <th style={thStyle}>GST</th>
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillData.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={tdStyle}>{s.invoice_number}</td>
                            <td style={tdStyle}>{s.product_name || (s.items?.length > 1 ? `${s.items.length} items` : s.items?.[0]?.product_name)}</td>
                            <td style={tdStyle}>₹{fmt(s.taxable_amount)}</td>
                            <td style={{ ...tdStyle, color: '#059669', fontWeight: 700 }}>₹{fmt(s.total_gst)}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>₹{fmt(s.total_amount)}</td>
                            <td style={tdStyle}>
                              <span style={{ background: s.invoice_type === 'B2B' ? '#ede9fe' : '#dcfce7', color: s.invoice_type === 'B2B' ? '#6d28d9' : '#065f46', padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                                {s.invoice_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* GST Input Credit (ITC) — clickable drill-down */}
            <div
              onClick={() => openDrill('purchases')}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', background: drillType === 'purchases' ? '#dbeafe' : '#eff6ff',
                borderRadius: 10, marginBottom: 10, cursor: 'pointer',
                border: `1.5px solid ${drillType === 'purchases' ? '#93c5fd' : 'transparent'}`,
                transition: 'all 0.2s',
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af' }}>
                  🛒 GST Input Credit (ITC) &nbsp;
                  <span style={{ fontSize: 11, background: '#bfdbfe', color: '#1e40af', padding: '2px 8px', borderRadius: 20 }}>
                    {drillType === 'purchases' ? '▲ बंद करें' : '▼ Purchases देखें'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Suppliers को खरीद में दिया • CGST ₹{fmt(summary.purchases.cgst)} + SGST ₹{fmt(summary.purchases.sgst)} + IGST ₹{fmt(summary.purchases.igst)}
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>−₹{fmt(gstITC)}</div>
            </div>

            {/* Purchases Drill-down */}
            {drillType === 'purchases' && (
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                {drillLoading ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>⏳ लोड हो रहा है...</div>
                ) : drillData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>इस महीने कोई purchases नहीं</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#dbeafe' }}>
                          <th style={thStyle}>Bill No</th>
                          <th style={thStyle}>Product</th>
                          <th style={thStyle}>Supplier</th>
                          <th style={thStyle}>Taxable</th>
                          <th style={thStyle}>ITC</th>
                          <th style={thStyle}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillData.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={tdStyle}>{p.invoice_number}</td>
                            <td style={tdStyle}>{p.product_name || (p.items?.length > 1 ? `${p.items.length} items` : p.items?.[0]?.product_name)}</td>
                            <td style={tdStyle}>{p.supplier_name || '—'}</td>
                            <td style={tdStyle}>₹{fmt(p.taxable_amount)}</td>
                            <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 700 }}>₹{fmt(p.total_gst)}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>₹{fmt(p.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {gstITC === 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>
                ⚠️ कोई ITC claim नहीं — ज़्यादा tax भर रहे हैं / No ITC claimed — you may be overpaying tax
              </div>
            )}

            <div style={{ borderTop: '2px dashed #e5e7eb', margin: '8px 0 14px' }} />

            {/* Net Payable */}
            <div style={{
              padding: '18px 20px', borderRadius: 18,
              background: isPayable ? '#fef2f2' : isRefund ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${isPayable ? '#fecaca' : isRefund ? '#bbf7d0' : '#e2e8f0'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: isPayable ? '#991b1b' : isRefund ? '#065f46' : '#374151' }}>
                    {isPayable ? '💸 शुद्ध देय (Net Payable)' : excessCreditTotal > 0 ? '🧾 Excess ITC Available' : '✅ Liability Balanced'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    ITC set-off ke baad remaining liability by head dikhayi gayi hai.
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: isPayable ? '#ef4444' : excessCreditTotal > 0 ? '#059669' : '#374151' }}>
                    ₹{fmt(isPayable ? payableTotal : excessCreditTotal)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isPayable ? '#ef4444' : excessCreditTotal > 0 ? '#059669' : '#374151' }}>
                    {isPayable ? '▲ भरना है / You Pay' : excessCreditTotal > 0 ? 'ITC carry forward' : 'All Clear ✅'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: GSTR-3B TABLE ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e', marginBottom: 14 }}>
              📋 GSTR-3B सारांश / Summary
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>विवरण / Description</th>
                    <th style={thStyle}>CGST</th>
                    <th style={thStyle}>SGST</th>
                    <th style={thStyle}>IGST</th>
                    <th style={thStyle}>कुल / Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#065f46' }}>📈 Output (Sales)</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.cgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.sgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#059669' }}>₹{fmt(summary.sales.total_gst)}</td>
                  </tr>
                  <tr style={{ background: '#eff6ff' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1e40af' }}>🛒 Input / ITC (Purchase)</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.cgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.sgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#2563eb' }}>₹{fmt(summary.purchases.total_gst)}</td>
                  </tr>
                  <tr style={{ background: isPayable ? '#fef2f2' : '#f0fdf4', borderTop: '2px solid #e5e7eb' }}>
                    <td style={{ ...tdStyle, fontWeight: 800, color: isPayable ? '#991b1b' : '#065f46' }}>
                      {isPayable ? '💸 Payable After ITC Set-Off' : '🧾 Unused ITC / Nil Liability'}
                    </td>
                    <td style={tdStyle}>₹{fmt(isPayable ? payableByHead.cgst : excessCredit.cgst)}</td>
                    <td style={tdStyle}>₹{fmt(isPayable ? payableByHead.sgst : excessCredit.sgst)}</td>
                    <td style={tdStyle}>₹{fmt(isPayable ? payableByHead.igst : excessCredit.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 900, fontSize: 15, color: isPayable ? '#ef4444' : '#059669' }}>
                      ₹{fmt(isPayable ? payableTotal : excessCreditTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 4: B2B / B2C CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', marginBottom: 4 }}>🏢 B2B</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>GSTIN वाले ग्राहक</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2b_count}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>invoices</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: '#6366f1' }}>₹{fmt(summary.sales.b2b_taxable)}</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981', marginBottom: 4 }}>👤 B2C</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>बिना GSTIN ग्राहक</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2c_count}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>invoices</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: '#10b981' }}>₹{fmt(summary.sales.b2c_taxable)}</div>
            </div>
          </div>

          {/* ── SECTION 5: B2B INVOICE LIST ── */}
          {summary.gstr1.b2b_invoices.length === 0 ? (
            <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24, color: '#9ca3af' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>कोई B2B Invoice नहीं / No B2B Invoices</div>
              <div style={{ fontSize: 12 }}>💡 Sales mein customer ka GSTIN add karo to B2B invoice banega</div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>
                🧾 B2B Invoices — GSTR-1 के लिए
              </div>

              {/* Desktop */}
              <div className="table-container hidden-xs">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>खरीदार / Buyer</th>
                      <th>GSTIN</th>
                      <th>Taxable ₹</th>
                      <th>GST%</th>
                      <th>कुल / Total</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.gstr1.b2b_invoices.map((inv, i) => (
                      <tr key={i}>
                        <td style={{ color: '#6366f1', fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td style={{ fontWeight: 600 }}>{inv.buyer_name || '—'}</td>
                        <td style={{ fontSize: 11, color: '#9ca3af' }}>{inv.buyer_gstin}</td>
                        <td>₹{fmt(inv.taxable_amount)}</td>
                        <td>{inv.gst_rate}%</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>₹{fmt(inv.total)}</td>
                        <td>
                          <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                            {inv.gst_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="show-xs" style={{ flexDirection: 'column', gap: 10 }}>
                {summary.gstr1.b2b_invoices.map((inv, i) => (
                  <div key={i} className="card" style={{ borderLeft: '3px solid #6366f1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, color: '#6366f1', fontSize: 13 }}>{inv.invoice_number}</div>
                      <div style={{ fontWeight: 700, color: '#10b981' }}>₹{fmt(inv.total)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{inv.buyer_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>GSTIN: {inv.buyer_gstin} • GST {inv.gst_rate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 6: B2C SUMMARY ── */}
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 4 }}>👥 B2C सारांश / Summary</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>सामान्य ग्राहक — बिना GSTIN</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'INVOICES', value: summary.gstr1.b2c_summary.count,          color: '#374151' },
                { label: 'TAXABLE', value: `₹${fmt(summary.gstr1.b2c_summary.taxable_amount)}`, color: '#374151' },
                { label: 'GST',     value: `₹${fmt(summary.gstr1.b2c_summary.total_gst)}`,      color: '#6366f1' },
                { label: 'TOTAL',   value: `₹${fmt(summary.gstr1.b2c_summary.total_amount)}`,   color: '#10b981' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 7: EXPORT ── */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 4 }}>
              📤 CA को दें / Export for CA
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
              यह फ़ाइल अपने CA को दे सकते हैं / Share directly with your CA
            </div>

            {/* Individual exports (unchanged) */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => exportCSV('gstr1')}
                style={{ padding: '10px 16px', background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-1 CSV
              </button>
              <button onClick={() => exportCSV('gstr3b')}
                style={{ padding: '10px 16px', background: '#ede9fe', color: '#6d28d9', border: '1.5px solid #c4b5fd', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-3B CSV
              </button>
              <button onClick={exportJSON}
                style={{ padding: '10px 16px', background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📦 JSON
              </button>
            </div>

            {/* ── ZIP Export button ── */}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                📁 <strong>ZIP में सब एक साथ:</strong> GSTR1 + GSTR3B, CSV और JSON दोनों
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                  Structure: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>GSTR1/gstr1.csv</code>,{' '}
                  <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>GSTR1/gstr1.json</code>,{' '}
                  <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>GSTR3B/gstr3b.csv</code>,{' '}
                  <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>GSTR3B/gstr3b.json</code>
                </div>
              </div>
              <button
                onClick={exportZIP}
                disabled={zipping}
                style={{
                  padding: '11px 22px',
                  background: zipping ? '#f3f4f6' : 'linear-gradient(135deg, #1e40af, #6366f1)',
                  color: zipping ? '#9ca3af' : '#fff',
                  border: 'none', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, cursor: zipping ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: zipping ? 'none' : '0 2px 8px rgba(99,102,241,0.3)',
                  transition: 'all 0.2s',
                }}>
                {zipping ? '⏳ बना रहे हैं...' : '🗜️ Download ZIP (GSTR1 + GSTR3B)'}
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      <style>{`
        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }

        @media (max-width: 640px) {
          .hero-panel {
            padding: 16px !important;
          }

          .gst-hero-header {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-items: start !important;
            gap: 12px !important;
          }

          .gst-period-controls {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 8px !important;
            width: 100%;
            min-width: 0;
          }

          .gst-period-controls .form-input {
            min-width: 0 !important;
            width: 100%;
            font-size: 12.5px;
            padding: 10px 12px;
          }

          .gst-status-banner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          .gst-status-main {
            align-items: flex-start !important;
          }

          .gst-status-main > div:last-child > div:first-child {
            font-size: 16px !important;
            line-height: 1.35 !important;
          }

          .gst-status-main > div:last-child > div:last-child {
            font-size: 12px !important;
            margin-top: 2px !important;
          }
        }

        @media (max-width: 420px) {
          .gst-hero-header {
            grid-template-columns: 1fr 1fr;
          }

          .gst-period-controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}

// ── Table style helpers (unchanged) ─────────────────────────────────────────
const thStyle = {
  padding: '8px 12px',
  textAlign: 'right',
  fontWeight: 700,
  fontSize: 12,
  color: '#6b7280',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '8px 12px',
  textAlign: 'right',
  fontSize: 12,
  color: '#374151',
  whiteSpace: 'nowrap',
};
