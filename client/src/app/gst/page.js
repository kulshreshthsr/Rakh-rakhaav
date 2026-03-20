'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_HI = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);

const thStyle = { padding: '9px 14px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' };
const tdStyle = { padding: '9px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' };

export default function GSTPage() {
  const router = useRouter();
  const now = new Date();

  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);

  const [drillType,    setDrillType]    = useState(null);
  const [drillData,    setDrillData]    = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchSummary();
  }, [month, year]);

  const fetchSummary = async () => {
    setLoading(true); setDrillType(null);
    try {
      const res = await fetch(`${API}/api/sales/gst-summary?month=${month}&year=${year}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setSummary(await res.json());
    } catch {}
    setLoading(false);
  };

  const openDrill = async (type) => {
    if (drillType === type) { setDrillType(null); return; }
    setDrillType(type); setDrillLoading(true);
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 0, 23, 59, 59).toISOString();
    try {
      const url  = type === 'sales' ? `${API}/api/sales?from=${from}&to=${to}` : `${API}/api/purchases?from=${from}&to=${to}`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setDrillData(type === 'sales' ? (data.sales || data) : (data.purchases || data));
    } catch {}
    setDrillLoading(false);
  };

  const buildGSTR1CSV = () => {
    const rows = [
      ['GSTR-1 B2B Invoices'],
      ['Invoice No','Date','Buyer Name','Buyer GSTIN','Taxable Amount','GST Rate%','CGST','SGST','IGST','Total'],
      ...summary.gstr1.b2b_invoices.map(i => [i.invoice_number, new Date(i.date).toLocaleDateString('en-IN'), i.buyer_name || '', i.buyer_gstin || '', fmt(i.taxable_amount), i.gst_rate + '%', fmt(i.cgst), fmt(i.sgst), fmt(i.igst), fmt(i.total)]),
      [''],
      ['GSTR-1 B2C Summary'],
      ['Count','Taxable Amount','Total GST','Total Amount'],
      [summary.gstr1.b2c_summary.count, fmt(summary.gstr1.b2c_summary.taxable_amount), fmt(summary.gstr1.b2c_summary.total_gst), fmt(summary.gstr1.b2c_summary.total_amount)],
    ];
    return rows.map(r => r.join(',')).join('\n');
  };

  const buildGSTR3BCSV = () => {
    const rows = [
      ['GSTR-3B Summary'], ['Month/Year', `${MONTHS[month - 1]} ${year}`], [''],
      ['Description', 'Amount (Rs)'],
      ['GST Collected (Output)', fmt(summary.gstr3b.output_gst)],
      ['GST Input Credit (ITC)', fmt(summary.gstr3b.input_gst)],
      ['Net GST Payable', fmt(summary.gstr3b.net_payable)],
      ['Outward Taxable Sales', fmt(summary.gstr3b.outward_taxable)], [''],
      ['Sales Breakup'], ['Total Sales', fmt(summary.sales.total_amount)],
      ['CGST Collected', fmt(summary.sales.cgst)], ['SGST Collected', fmt(summary.sales.sgst)], ['IGST Collected', fmt(summary.sales.igst)], [''],
      ['Purchase Breakup'], ['Total Purchases', fmt(summary.purchases.taxable_amount)],
      ['CGST Input', fmt(summary.purchases.cgst)], ['SGST Input', fmt(summary.purchases.sgst)], ['IGST Input', fmt(summary.purchases.igst)],
    ];
    return rows.map(r => r.join(',')).join('\n');
  };

  const exportCSV = (type) => {
    if (!summary) return;
    const csv      = type === 'gstr1' ? buildGSTR1CSV() : buildGSTR3BCSV();
    const filename = type === 'gstr1' ? `GSTR1_${year}_${String(month).padStart(2, '0')}.csv` : `GSTR3B_${year}_${String(month).padStart(2, '0')}.csv`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `GST_${year}_${String(month).padStart(2, '0')}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const exportZIP = async () => {
    if (!summary) return;
    setZipping(true);
    try {
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = resolve; script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const zip = new window.JSZip();
      const monthPad  = String(month).padStart(2, '0');
      const periodTag = `${year}_${monthPad}`;
      const gstr1Folder = zip.folder('GSTR1');
      gstr1Folder.file('gstr1.csv', buildGSTR1CSV());
      gstr1Folder.file('gstr1.json', JSON.stringify({ period: { month: MONTHS[month - 1], year }, b2b_invoices: summary.gstr1.b2b_invoices, b2c_summary: summary.gstr1.b2c_summary, sales_totals: { total_amount: summary.sales.total_amount, taxable: summary.sales.taxable_amount, cgst: summary.sales.cgst, sgst: summary.sales.sgst, igst: summary.sales.igst, total_gst: summary.sales.total_gst, b2b_count: summary.sales.b2b_count, b2c_count: summary.sales.b2c_count, b2b_taxable: summary.sales.b2b_taxable, b2c_taxable: summary.sales.b2c_taxable } }, null, 2));
      const gstr3bFolder = zip.folder('GSTR3B');
      gstr3bFolder.file('gstr3b.csv', buildGSTR3BCSV());
      gstr3bFolder.file('gstr3b.json', JSON.stringify({ period: { month: MONTHS[month - 1], year }, gstr3b: summary.gstr3b, purchases: { total_amount: summary.purchases.total_amount, taxable: summary.purchases.taxable_amount, cgst: summary.purchases.cgst, sgst: summary.purchases.sgst, igst: summary.purchases.igst, total_gst: summary.purchases.total_gst }, net_payable: summary.gstr3b.net_payable, output_gst: summary.gstr3b.output_gst, input_gst: summary.gstr3b.input_gst }, null, 2));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `GST_Export_${periodTag}.zip`; a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed. Please try individual CSV/JSON exports.');
    }
    setZipping(false);
  };

  const netPayable   = summary?.gstr3b?.net_payable || 0;
  const gstCollected = summary?.gstr3b?.output_gst  || 0;
  const gstITC       = summary?.gstr3b?.input_gst   || 0;
  const monthHi      = MONTHS_HI[month - 1];
  const monthEn      = MONTHS[month - 1];
  const isPayable    = netPayable > 0;
  const isRefund     = netPayable < 0;

  const returnStatus = summary
    ? summary.sales.total > 0
      ? { ok: true,  msg: '✅ Return दाखिल करने के लिए तैयार / Ready to file' }
      : { ok: false, msg: '⚠️ इस महीने कोई sales नहीं / No sales this month' }
    : null;

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <div className="page-title" style={{ marginBottom: 2 }}>GST सारांश</div>
        <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Monthly GST Summary · {monthEn} {year}</div>
      </div>

      {/* ── Month/Year Selector ── */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>महीना:</div>
        <select className="form-input" style={{ minWidth: 160, flex: 'none' }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{MONTHS_HI[i]} / {m}</option>)}
        </select>
        <select className="form-input" style={{ minWidth: 100, flex: 'none' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-4)', fontSize: 13 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#4F46E5', animation: 'spin 0.7s linear infinite' }} />
            लोड हो रहा है...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {!summary ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-2)', marginBottom: 4 }}>Loading GST data...</div>
        </div>
      ) : (
        <>
          {/* ── SECTION 1: NET PAYABLE BANNER ── */}
          <div style={{
            background: isPayable ? '#FEF2F2' : isRefund ? '#F0FDF4' : 'var(--surface)',
            border: `2px solid ${isPayable ? '#FCA5A5' : isRefund ? '#86EFAC' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 20,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: isPayable ? '#EF4444' : isRefund ? '#22C55E' : '#4F46E5', borderRadius: '14px 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ fontSize: 40 }}>{isPayable ? '⚠️' : isRefund ? '🎉' : '✅'}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isPayable ? '#991B1B' : isRefund ? '#065F46' : 'var(--text)', lineHeight: 1.3, letterSpacing: -0.5 }}>
                  {isPayable ? `${monthHi} ${year}: ₹${fmt(netPayable)} GST भरना है` : isRefund ? `${monthHi} ${year}: ₹${fmt(Math.abs(netPayable))} GST वापस मिलेगा` : `${monthHi} ${year}: कोई GST देय नहीं ✅`}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
                  {isPayable ? `${monthEn} ${year}: Pay ₹${fmt(netPayable)} GST` : isRefund ? `${monthEn} ${year}: GST refund ₹${fmt(Math.abs(netPayable))}` : `${monthEn} ${year}: No GST payable`}
                </div>
              </div>
            </div>
            {returnStatus && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: returnStatus.ok ? '#DCFCE7' : '#FEF9C3',
                color: returnStatus.ok ? '#166534' : '#854D0E',
                padding: '5px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: 700,
              }}>{returnStatus.msg}</div>
            )}
          </div>

          {/* ── SECTION 2: GST CALCULATION ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 16, fontFamily: 'var(--font-display)' }}>🧮 GST हिसाब / Calculation</div>

            {/* Output (Sales) */}
            <div onClick={() => openDrill('sales')} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', background: drillType === 'sales' ? '#DCFCE7' : '#F0FDF4',
              borderRadius: 'var(--radius-sm)', marginBottom: 10, cursor: 'pointer',
              border: `1.5px solid ${drillType === 'sales' ? '#86EFAC' : 'transparent'}`,
              transition: 'all 0.18s',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#065F46' }}>
                  ✅ GST वसूला (Output) &nbsp;
                  <span style={{ fontSize: 10.5, background: '#BBF7D0', color: '#065F46', padding: '2px 9px', borderRadius: 100, fontWeight: 700 }}>
                    {drillType === 'sales' ? '▲ बंद करें' : '▼ Sales देखें'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>
                  CGST ₹{fmt(summary.sales.cgst)} + SGST ₹{fmt(summary.sales.sgst)} + IGST ₹{fmt(summary.sales.igst)}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#059669' }}>+₹{fmt(gstCollected)}</div>
            </div>

            {drillType === 'sales' && (
              <div style={{ background: '#F0FDF4', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 10, overflowX: 'auto' }}>
                {drillLoading ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>⏳ लोड हो रहा है...</div>
                ) : drillData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>इस महीने कोई sales नहीं</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: '#DCFCE7' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Invoice</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={thStyle}>Taxable</th><th style={thStyle}>GST</th><th style={thStyle}>Total</th><th style={thStyle}>Type</th>
                    </tr></thead>
                    <tbody>{drillData.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', color: '#4F46E5', fontWeight: 700 }}>{s.invoice_number}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{s.product_name || (s.items?.length > 1 ? `${s.items.length} items` : s.items?.[0]?.product_name)}</td>
                        <td style={tdStyle}>₹{fmt(s.taxable_amount)}</td>
                        <td style={{ ...tdStyle, color: '#059669', fontWeight: 700 }}>₹{fmt(s.total_gst)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>₹{fmt(s.total_amount)}</td>
                        <td style={tdStyle}><span style={{ background: s.invoice_type === 'B2B' ? '#EEF2FF' : '#DCFCE7', color: s.invoice_type === 'B2B' ? '#4338CA' : '#065F46', padding: '2px 8px', borderRadius: 100, fontSize: 10.5, fontWeight: 700 }}>{s.invoice_type}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* Input (Purchases) */}
            <div onClick={() => openDrill('purchases')} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', background: drillType === 'purchases' ? '#DBEAFE' : '#EFF6FF',
              borderRadius: 'var(--radius-sm)', marginBottom: 10, cursor: 'pointer',
              border: `1.5px solid ${drillType === 'purchases' ? '#93C5FD' : 'transparent'}`,
              transition: 'all 0.18s',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF' }}>
                  🛒 GST Input Credit (ITC) &nbsp;
                  <span style={{ fontSize: 10.5, background: '#BFDBFE', color: '#1E40AF', padding: '2px 9px', borderRadius: 100, fontWeight: 700 }}>
                    {drillType === 'purchases' ? '▲ बंद करें' : '▼ Purchases देखें'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>
                  CGST ₹{fmt(summary.purchases.cgst)} + SGST ₹{fmt(summary.purchases.sgst)} + IGST ₹{fmt(summary.purchases.igst)}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#2563EB' }}>−₹{fmt(gstITC)}</div>
            </div>

            {drillType === 'purchases' && (
              <div style={{ background: '#EFF6FF', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 10, overflowX: 'auto' }}>
                {drillLoading ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>⏳ लोड हो रहा है...</div>
                ) : drillData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>इस महीने कोई purchases नहीं</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: '#DBEAFE' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Bill No</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Supplier</th>
                      <th style={thStyle}>Taxable</th><th style={thStyle}>ITC</th><th style={thStyle}>Total</th>
                    </tr></thead>
                    <tbody>{drillData.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', color: '#D97706', fontWeight: 700 }}>{p.invoice_number}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{p.product_name || (p.items?.length > 1 ? `${p.items.length} items` : p.items?.[0]?.product_name)}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{p.supplier_name || '—'}</td>
                        <td style={tdStyle}>₹{fmt(p.taxable_amount)}</td>
                        <td style={{ ...tdStyle, color: '#2563EB', fontWeight: 700 }}>₹{fmt(p.total_gst)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>₹{fmt(p.total_amount)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {gstITC === 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#92400E' }}>
                ⚠️ कोई ITC claim नहीं — ज़्यादा tax भर रहे हैं / No ITC claimed — you may be overpaying tax
              </div>
            )}

            <div style={{ borderTop: '2px dashed var(--border)', margin: '8px 0 14px' }} />

            {/* Net Payable */}
            <div style={{
              padding: '18px 20px', borderRadius: 'var(--radius-sm)',
              background: isPayable ? '#FEF2F2' : isRefund ? '#F0FDF4' : 'var(--surface-2)',
              border: `2px solid ${isPayable ? '#FCA5A5' : isRefund ? '#86EFAC' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: isPayable ? '#991B1B' : isRefund ? '#065F46' : 'var(--text)' }}>
                    {isRefund ? '💰 वापसी (Refund)' : '💸 शुद्ध देय (Net Payable)'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>₹{fmt(gstCollected)} − ₹{fmt(gstITC)} = ₹{fmt(netPayable)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: isPayable ? '#EF4444' : isRefund ? '#059669' : 'var(--text)', letterSpacing: -1 }}>
                    ₹{fmt(Math.abs(netPayable))}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isPayable ? '#EF4444' : isRefund ? '#059669' : 'var(--text-3)' }}>
                    {isPayable ? '▲ भरना है / You Pay' : isRefund ? '▼ वापस मिलेगा / Refund' : 'All Clear ✅'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: GSTR-3B TABLE ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 14, fontFamily: 'var(--font-display)' }}>📋 GSTR-3B सारांश</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>विवरण / Description</th>
                  <th style={thStyle}>CGST</th><th style={thStyle}>SGST</th><th style={thStyle}>IGST</th><th style={thStyle}>कुल / Total</th>
                </tr></thead>
                <tbody>
                  <tr style={{ background: '#F0FDF4' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#065F46' }}>📈 Output (Sales)</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.cgst)}</td><td style={tdStyle}>₹{fmt(summary.sales.sgst)}</td><td style={tdStyle}>₹{fmt(summary.sales.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#059669' }}>₹{fmt(summary.sales.total_gst)}</td>
                  </tr>
                  <tr style={{ background: '#EFF6FF' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#1E40AF' }}>🛒 Input / ITC (Purchase)</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.cgst)}</td><td style={tdStyle}>₹{fmt(summary.purchases.sgst)}</td><td style={tdStyle}>₹{fmt(summary.purchases.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#2563EB' }}>₹{fmt(summary.purchases.total_gst)}</td>
                  </tr>
                  <tr style={{ background: isPayable ? '#FEF2F2' : '#F0FDF4', borderTop: '2px solid var(--border)' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: isPayable ? '#991B1B' : '#065F46' }}>{isPayable ? '💸 Net Payable' : '💰 Net Refund'}</td>
                    <td style={tdStyle}>₹{fmt((summary.sales.cgst || 0) - (summary.purchases.cgst || 0))}</td>
                    <td style={tdStyle}>₹{fmt((summary.sales.sgst || 0) - (summary.purchases.sgst || 0))}</td>
                    <td style={tdStyle}>₹{fmt((summary.sales.igst || 0) - (summary.purchases.igst || 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 900, fontSize: 15, color: isPayable ? '#EF4444' : '#059669' }}>₹{fmt(Math.abs(netPayable))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 4: B2B / B2C CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ borderLeft: '4px solid #4F46E5', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 48, opacity: 0.05, lineHeight: 1 }}>🏢</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#4F46E5', marginBottom: 4 }}>🏢 B2B</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>GSTIN वाले ग्राहक</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -1 }}>{summary.sales.b2b_count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>invoices</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#4F46E5' }}>₹{fmt(summary.sales.b2b_taxable)}</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #059669', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 48, opacity: 0.05, lineHeight: 1 }}>👤</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#059669', marginBottom: 4 }}>👤 B2C</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>बिना GSTIN ग्राहक</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -1 }}>{summary.sales.b2c_count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>invoices</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>₹{fmt(summary.sales.b2c_taxable)}</div>
            </div>
          </div>

          {/* ── SECTION 5: B2B INVOICE LIST ── */}
          {summary.gstr1.b2b_invoices.length === 0 ? (
            <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '28px 24px', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>कोई B2B Invoice नहीं</div>
              <div style={{ fontSize: 12 }}>💡 Sales mein customer ka GSTIN add karo to B2B invoice banega</div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)', marginBottom: 10 }}>🧾 B2B Invoices — GSTR-1 के लिए</div>
              <div className="table-container hidden-xs">
                <table>
                  <thead><tr><th>Invoice No</th><th>खरीदार / Buyer</th><th>GSTIN</th><th>Taxable ₹</th><th>GST%</th><th>कुल / Total</th><th>Type</th></tr></thead>
                  <tbody>
                    {summary.gstr1.b2b_invoices.map((inv, i) => (
                      <tr key={i}>
                        <td><span style={{ color: '#4F46E5', fontWeight: 700, background: 'var(--primary-dim)', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{inv.invoice_number}</span></td>
                        <td style={{ fontWeight: 600 }}>{inv.buyer_name || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-4)' }}>{inv.buyer_gstin}</td>
                        <td>₹{fmt(inv.taxable_amount)}</td>
                        <td><span style={{ background: 'var(--primary-dim)', color: '#4338CA', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{inv.gst_rate}%</span></td>
                        <td style={{ fontWeight: 800, color: '#059669' }}>₹{fmt(inv.total)}</td>
                        <td><span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{inv.gst_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="show-xs" style={{ flexDirection: 'column', gap: 10 }}>
                {summary.gstr1.b2b_invoices.map((inv, i) => (
                  <div key={i} className="card" style={{ borderLeft: '4px solid #4F46E5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, color: '#4F46E5', fontSize: 13 }}>{inv.invoice_number}</div>
                      <div style={{ fontWeight: 800, color: '#059669' }}>₹{fmt(inv.total)}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{inv.buyer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>GSTIN: {inv.buyer_gstin} • GST {inv.gst_rate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 6: B2C SUMMARY ── */}
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #059669' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>👥 B2C सारांश / Summary</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>सामान्य ग्राहक — बिना GSTIN</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'INVOICES', value: summary.gstr1.b2c_summary.count,                            color: 'var(--text)' },
                { label: 'TAXABLE', value: `₹${fmt(summary.gstr1.b2c_summary.taxable_amount)}`,         color: 'var(--text)' },
                { label: 'GST',     value: `₹${fmt(summary.gstr1.b2c_summary.total_gst)}`,              color: '#4F46E5' },
                { label: 'TOTAL',   value: `₹${fmt(summary.gstr1.b2c_summary.total_amount)}`,           color: '#059669' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 7: EXPORT ── */}
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>📤 CA को दें / Export for CA</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginBottom: 18 }}>यह फ़ाइल अपने CA को दे सकते हैं / Share directly with your CA</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => exportCSV('gstr1')} style={{ padding: '10px 18px', background: '#F0FDF4', color: '#059669', border: '1.5px solid #BBF7D0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📊 GSTR-1 CSV</button>
              <button onClick={() => exportCSV('gstr3b')} style={{ padding: '10px 18px', background: 'var(--primary-dim)', color: '#4338CA', border: '1.5px solid #C4B5FD', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📊 GSTR-3B CSV</button>
              <button onClick={exportJSON} style={{ padding: '10px 18px', background: '#FFF7ED', color: '#C2410C', border: '1.5px solid #FED7AA', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📦 JSON</button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>
                📁 <strong>ZIP में सब एक साथ:</strong> GSTR1 + GSTR3B, CSV और JSON दोनों
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                  Structure: <code style={{ background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5, fontSize: 11 }}>GSTR1/gstr1.csv</code>{' '}
                  <code style={{ background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5, fontSize: 11 }}>GSTR3B/gstr3b.csv</code>
                </div>
              </div>
              <button onClick={exportZIP} disabled={zipping} className={zipping ? '' : 'btn-primary'} style={{ padding: '11px 24px', background: zipping ? 'var(--surface-3)' : undefined, color: zipping ? 'var(--text-4)' : undefined, fontSize: 13.5, cursor: zipping ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                {zipping ? '⏳ बना रहे हैं...' : '🗜️ Download ZIP (GSTR1 + GSTR3B)'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}