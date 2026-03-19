'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const QUARTERS = [
  { label: 'Q1 (Apr–Jun)', from: '04-01', to: '06-30' },
  { label: 'Q2 (Jul–Sep)', from: '07-01', to: '09-30' },
  { label: 'Q3 (Oct–Dec)', from: '10-01', to: '12-31' },
  { label: 'Q4 (Jan–Mar)', from: '01-01', to: '03-31' },
];

const getYearRange = (year, fromMD, toMD) => {
  const actualYear = fromMD.startsWith('0') || fromMD.startsWith('1') ? year : year - 1;
  const toYear = toMD.startsWith('0') || toMD.startsWith('1') ? year : year;
  return { from: `${year}-${fromMD}`, to: `${toYear}-${toMD}` };
};

export default function GSTPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(false);
  const [year, setYear]             = useState(new Date().getFullYear());
  const [month, setMonth]           = useState(new Date().getMonth() + 1);
  const [period, setPeriod]         = useState('monthly');
  const [quarter, setQuarter]       = useState(0);
  const [sales, setSales]           = useState([]);
  const [purchases, setPurchases]   = useState([]);
  const [shopInfo, setShopInfo]     = useState({});
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetch(`${API}/api/auth/shop`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(d => setShopInfo(d || {})).catch(() => {});
    fetchData();
  }, []);

  useEffect(() => { fetchData(); }, [period, year, month, quarter]);

  const fetchData = async () => {
    setLoading(true); setError('');
    let from, to;
    if (period === 'monthly') { from = `${year}-${String(month).padStart(2, '0')}-01`; const lastDay = new Date(year, month, 0).getDate(); to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`; }
    else { const q = QUARTERS[quarter]; const { from: f, to: t } = getYearRange(year, q.from, q.to); from = f; to = t; }
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [sRes, pRes] = await Promise.all([fetch(`${API}/api/sales?from=${from}&to=${to}`, { headers }), fetch(`${API}/api/purchases?from=${from}&to=${to}`, { headers })]);
      const sData = await sRes.json(); const pData = await pRes.json();
      setSales(sData.sales || (Array.isArray(sData) ? sData : []));
      setPurchases(pData.purchases || (Array.isArray(pData) ? pData : []));
    } catch { setError('Data load nahi hua'); }
    setLoading(false);
  };

  // GST Output (from sales)
  const gstOutput = (() => {
    const map = {};
    sales.forEach(sale => {
      const items = sale.items?.length > 0 ? sale.items : [{ ...sale, gst_rate: sale.gst_rate || 0, cgst_amount: sale.cgst_amount, sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount, taxable_amount: sale.taxable_amount, gst_type: sale.gst_type }];
      items.forEach(item => {
        const rate = item.gst_rate || 0; const key = String(rate);
        if (!map[key]) map[key] = { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_gst: 0, count: 0, b2b_taxable: 0, b2c_taxable: 0, b2b_gst: 0, b2c_gst: 0 };
        const taxable = item.taxable_amount || ((item.quantity || 0) * (item.price_per_unit || 0));
        const isIGST = item.gst_type === 'IGST';
        map[key].taxable += taxable;
        if (isIGST) { map[key].igst += item.igst_amount || 0; map[key].total_gst += item.igst_amount || 0; }
        else { map[key].cgst += item.cgst_amount || 0; map[key].sgst += item.sgst_amount || 0; map[key].total_gst += (item.cgst_amount || 0) + (item.sgst_amount || 0); }
        map[key].count += 1;
        const isB2B = !!(sale.buyer_gstin || item.buyer_gstin);
        if (isB2B) { map[key].b2b_taxable += taxable; map[key].b2b_gst += isIGST ? (item.igst_amount || 0) : (item.cgst_amount || 0) + (item.sgst_amount || 0); }
        else { map[key].b2c_taxable += taxable; map[key].b2c_gst += isIGST ? (item.igst_amount || 0) : (item.cgst_amount || 0) + (item.sgst_amount || 0); }
      });
    });
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  })();

  // ITC (from purchases)
  const itcSlabs = (() => {
    const map = {};
    purchases.forEach(purchase => {
      const items = purchase.items?.length > 0 ? purchase.items : [{ ...purchase, gst_rate: purchase.gst_rate || 0, cgst_amount: purchase.cgst_amount, sgst_amount: purchase.sgst_amount, igst_amount: purchase.igst_amount, taxable_amount: purchase.taxable_amount }];
      items.forEach(item => {
        const rate = item.gst_rate || 0; const key = String(rate);
        if (!map[key]) map[key] = { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_itc: 0 };
        const taxable = item.taxable_amount || ((item.quantity || 0) * (item.price_per_unit || 0));
        map[key].taxable += taxable;
        map[key].cgst += item.cgst_amount || 0; map[key].sgst += item.sgst_amount || 0; map[key].igst += item.igst_amount || 0;
        map[key].total_itc += (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
      });
    });
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  })();

  const totalOutputGST = gstOutput.reduce((s, x) => s + x.total_gst, 0);
  const totalTaxable = gstOutput.reduce((s, x) => s + x.taxable, 0);
  const totalITC = itcSlabs.reduce((s, x) => s + x.total_itc, 0);
  const netGSTPayable = Math.max(0, totalOutputGST - totalITC);
  const totalCGST = gstOutput.reduce((s, x) => s + x.cgst, 0);
  const totalSGST = gstOutput.reduce((s, x) => s + x.sgst, 0);
  const totalIGST = gstOutput.reduce((s, x) => s + x.igst, 0);

  const periodLabel = period === 'monthly'
    ? new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : `${QUARTERS[quarter].label} ${year}`;

  const exportGSTCSV = () => {
    const rows = [
      ['GST Report — ' + periodLabel],
      ['Shop: ' + (shopInfo.name || '—'), 'GSTIN: ' + (shopInfo.gstin || '—')],
      [],
      ['OUTPUT TAX (from Sales)'],
      ['GST Rate', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total GST', 'B2B Taxable', 'B2C Taxable'],
      ...gstOutput.map(r => [r.rate + '%', fmt(r.taxable), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.total_gst), fmt(r.b2b_taxable), fmt(r.b2c_taxable)]),
      ['TOTAL', fmt(totalTaxable), fmt(totalCGST), fmt(totalSGST), fmt(totalIGST), fmt(totalOutputGST)],
      [],
      ['INPUT TAX CREDIT (from Purchases)'],
      ['GST Rate', 'Taxable', 'CGST ITC', 'SGST ITC', 'IGST ITC', 'Total ITC'],
      ...itcSlabs.map(r => [r.rate + '%', fmt(r.taxable), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.total_itc)]),
      ['TOTAL ITC', '', '', '', '', fmt(totalITC)],
      [],
      ['NET GST PAYABLE', '', '', '', '', fmt(netGSTPayable)],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GST_Report_${periodLabel.replace(/ /g, '_')}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const IS = { width: '100%', padding: '12px 14px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'DM Sans,sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s,box-shadow 0.2s' };
  const selStyle = { ...IS, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%2394A3B8' d='M5 6L0 0h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, appearance: 'none' };

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .gi:focus{border-color:#6366F1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.08)!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @media(max-width:640px){.gst-filters{flex-direction:column!important;}}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 4 }}>GST रिपोर्ट 🧾</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{shopInfo.gstin ? `GSTIN: ${shopInfo.gstin}` : 'GST summary for filing'}</div>
        </div>
        <button onClick={exportGSTCSV} style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: '0 3px 12px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>📥 Export CSV</button>
      </div>

      {/* Filters */}
      <div className="gst-filters" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, gap: 3 }}>
          {[{ val: 'monthly', label: '📅 Monthly' }, { val: 'quarterly', label: '📊 Quarterly' }].map(p => (
            <button key={p.val} onClick={() => setPeriod(p.val)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: period === p.val ? '#fff' : 'transparent', color: period === p.val ? '#6366F1' : '#94A3B8', fontSize: 12, fontWeight: period === p.val ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: period === p.val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
              {p.label}
            </button>
          ))}
        </div>
        <select className="gi" style={{ ...selStyle, minWidth: 90, flex: 'none' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {period === 'monthly' ? (
          <select className="gi" style={{ ...selStyle, minWidth: 130 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i + 1} value={i + 1}>{m} {year}</option>)}
          </select>
        ) : (
          <select className="gi" style={{ ...selStyle, minWidth: 160 }} value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}>
            {QUARTERS.map((q, i) => <option key={i} value={i}>{q.label}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6366F1', fontWeight: 700, background: '#EEF2FF', padding: '6px 14px', borderRadius: 9 }}>📅 {periodLabel}</div>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94A3B8', fontSize: 14 }}>GST data लोड हो रहा है...</div>
        </div>
      ) : (
        <>
          {/* GST Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20, animation: 'fadeUp 0.4s ease both' }}>
            {[
              { label: '📤 Output GST', value: fmtN(totalOutputGST), sub: `${sales.length} invoices`, color: '#DC2626', bg: '#FEF2F2' },
              { label: '📥 ITC (Input)', value: fmtN(totalITC), sub: `${purchases.length} purchases`, color: '#059669', bg: '#F0FDF4' },
              { label: '💰 Net Payable', value: fmtN(netGSTPayable), sub: 'Output − ITC', color: netGSTPayable > 0 ? '#6366F1' : '#059669', bg: '#EEF2FF', bold: true },
              { label: '📊 CGST', value: fmtN(totalCGST), sub: 'Intra-state', color: '#D97706', bg: '#FFFBEB' },
              { label: '📊 SGST', value: fmtN(totalSGST), sub: 'Intra-state', color: '#D97706', bg: '#FFFBEB' },
              { label: '📊 IGST', value: fmtN(totalIGST), sub: 'Inter-state', color: '#7C3AED', bg: '#EDE9FE' },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, borderRadius: 14, padding: '14px', border: `1.5px solid ${card.color}${card.bold ? '44' : '22'}`, animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>{card.label}</div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: card.bold ? 22 : 18, fontWeight: 800, color: card.color, marginBottom: 3 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Net GST Calculation */}
          <div style={{ background: 'linear-gradient(135deg,#EDE9FE,#F5F3FF)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid #C4B5FD', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.2s both' }}>
            <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#4C1D95', marginBottom: 14 }}>🧮 GST Calculation Summary</div>
            {[
              { label: 'Output GST (Collected from buyers)', value: totalOutputGST, color: '#DC2626' },
              { label: '− ITC (Paid to suppliers)', value: -totalITC, color: '#059669', prefix: '−' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.6)', borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: row.color }}>₹{fmt(Math.abs(row.value))}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 12, border: `2px solid ${netGSTPayable > 0 ? '#6366F1' : '#059669'}`, marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>= Net GST Payable (GSTR-3B)</div>
                {netGSTPayable === 0 && totalITC > 0 && <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>✅ ITC covers full output tax!</div>}
              </div>
              <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 800, color: netGSTPayable > 0 ? '#6366F1' : '#059669' }}>{fmtN(netGSTPayable)}</div>
            </div>
          </div>

          {/* GST Output Table (GSTR-1) */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.3s both' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>📤 Output GST (GSTR-1)</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>GST collected on sales</div>
              </div>
              <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{fmtN(totalOutputGST)}</span>
            </div>
            {gstOutput.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: 30, fontSize: 13 }}>इस period में GST वाली कोई sales नहीं</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                      {['GST Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total GST', 'B2B Taxable', 'B2C Taxable', 'Invoices'].map(h => (
                        <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h === 'GST Rate' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gstOutput.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <td style={{ padding: '12px', textAlign: 'left' }}><span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{r.rate}%</span></td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.taxable)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.cgst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.sgst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.igst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#DC2626', fontSize: 13 }}>₹{fmt(r.total_gst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, color: '#6366F1' }}>₹{fmt(r.b2b_taxable)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, color: '#064E3B' }}>₹{fmt(r.b2c_taxable)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, color: '#94A3B8' }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                      <td style={{ padding: '12px', fontWeight: 700, fontSize: 12, color: '#374151' }}>TOTAL</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>₹{fmt(totalTaxable)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>₹{fmt(totalCGST)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>₹{fmt(totalSGST)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>₹{fmt(totalIGST)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#DC2626', fontSize: 15 }}>₹{fmt(totalOutputGST)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ITC Table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.4s both' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>📥 Input Tax Credit (GSTR-2)</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>GST paid on purchases (ITC claim)</div>
              </div>
              <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{fmtN(totalITC)}</span>
            </div>
            {itcSlabs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: 30, fontSize: 13 }}>इस period में कोई ITC नहीं</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                      {['GST Rate', 'Taxable Amount', 'CGST ITC', 'SGST ITC', 'IGST ITC', 'Total ITC'].map(h => (
                        <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h === 'GST Rate' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itcSlabs.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <td style={{ padding: '12px' }}><span style={{ background: '#FEF9C3', color: '#92400E', padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{r.rate}%</span></td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.taxable)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.cgst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.sgst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>₹{fmt(r.igst)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 14 }}>₹{fmt(r.total_itc)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                      <td colSpan={5} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>TOTAL ITC</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 15 }}>₹{fmt(totalITC)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* GSTR-3B Summary */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease 0.5s both' }}>
            <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>📝 GSTR-3B Filing Summary</div>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#374151', lineHeight: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: '3.1 Outward taxable supplies', value: `₹${fmt(totalTaxable)}`, sub: '' },
                  { label: '3.1 Total output tax', value: `₹${fmt(totalOutputGST)}`, sub: '' },
                  { label: '4 ITC available', value: `₹${fmt(totalITC)}`, sub: '', color: '#059669' },
                  { label: '6.1 Net Tax Payable', value: `₹${fmt(netGSTPayable)}`, sub: '', color: netGSTPayable > 0 ? '#DC2626' : '#059669', bold: true },
                  { label: '  — IGST', value: `₹${fmt(totalIGST)}`, sub: '' },
                  { label: '  — CGST', value: `₹${fmt(totalCGST)}`, sub: '' },
                  { label: '  — SGST', value: `₹${fmt(totalSGST)}`, sub: '' },
                  { label: '4B ITC on purchases', value: `₹${fmt(totalITC)}`, sub: '' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#64748B' }}>{row.label}</span>
                    <span style={{ fontWeight: row.bold ? 800 : 700, color: row.color || '#0F172A' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
              ⚠️ <strong>Note:</strong> Ye summary approximate hai. Final filing ke liye CA ya GST portal se verify karein. Due date: 20th of next month (GSTR-3B)
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}