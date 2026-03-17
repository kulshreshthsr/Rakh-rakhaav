'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

export default function GSTPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');
  const API = 'https://rakh-rakhaav.onrender.com';

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/sales/gst-summary?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.status === 401) { router.push('/login'); return; }
      setSummary(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchSummary();
  }, []);

  // ── CSV Export ──
  const exportGSTR1CSV = () => {
    if (!summary) return;
    const rows = [
      ['GSTR-1 B2B Invoices', '', '', '', '', '', '', '', ''],
      ['Invoice No', 'Date', 'Buyer Name', 'Buyer GSTIN', 'Taxable Amount', 'GST Rate%', 'CGST', 'SGST', 'IGST', 'Total'],
      ...summary.gstr1.b2b_invoices.map(i => [
        i.invoice_number,
        new Date(i.date).toLocaleDateString('en-IN'),
        i.buyer_name || '',
        i.buyer_gstin || '',
        i.taxable_amount?.toFixed(2),
        i.gst_rate + '%',
        i.cgst?.toFixed(2),
        i.sgst?.toFixed(2),
        i.igst?.toFixed(2),
        i.total?.toFixed(2),
      ]),
      ['', '', '', '', '', '', '', '', '', ''],
      ['GSTR-1 B2C Summary', '', '', '', '', '', '', '', '', ''],
      ['Taxable Amount', 'Total GST', 'Total Amount'],
      [
        summary.gstr1.b2c_summary.taxable_amount?.toFixed(2),
        summary.gstr1.b2c_summary.total_gst?.toFixed(2),
        summary.gstr1.b2c_summary.total_amount?.toFixed(2),
      ],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${year}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGSTR3BCSV = () => {
    if (!summary) return;
    const rows = [
      ['GSTR-3B Summary', ''],
      ['Month/Year', `${month}/${year}`],
      ['', ''],
      ['Description', 'Amount (₹)'],
      ['Outward Taxable Supplies', summary.gstr3b.outward_taxable?.toFixed(2)],
      ['Output GST (Collected)', summary.gstr3b.output_gst?.toFixed(2)],
      ['Input Tax Credit (Purchases)', summary.gstr3b.input_gst?.toFixed(2)],
      ['Net GST Payable', summary.gstr3b.net_payable?.toFixed(2)],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR3B_${year}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Data_${year}_${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <Layout>
      <div className="page-title">GST सारांश / GST Summary</div>

      {/* Month/Year selector */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>महीना / Month:</div>
        <select className="form-input" style={{ minWidth: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" style={{ minWidth: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={fetchSummary} className="btn-primary">
          {loading ? '⏳ लोड...' : '🔍 देखें / View'}
        </button>
      </div>

      {!summary ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>महीना चुनें और देखें / Select month and click View</div>
      ) : (
        <>
          {/* GSTR-3B Summary */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📊 GSTR-3B सारांश / Summary</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">कर योग्य बिक्री / Taxable Sales</div>
              <div className="stat-value" style={{ color: '#10b981', fontSize: 22 }}>₹{summary.gstr3b.outward_taxable?.toFixed(0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Output GST</div>
              <div className="stat-value" style={{ color: '#6366f1', fontSize: 22 }}>₹{summary.gstr3b.output_gst?.toFixed(0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Input Credit / ITC</div>
              <div className="stat-value" style={{ color: '#f59e0b', fontSize: 22 }}>₹{summary.gstr3b.input_gst?.toFixed(0)}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
              <div className="stat-label">शुद्ध देय / Net Payable</div>
              <div className="stat-value" style={{ color: summary.gstr3b.net_payable >= 0 ? '#ef4444' : '#10b981', fontSize: 22 }}>
                {summary.gstr3b.net_payable >= 0 ? '▲' : '▼'} ₹{Math.abs(summary.gstr3b.net_payable)?.toFixed(0)}
              </div>
            </div>
          </div>

          {/* B2B vs B2C */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', marginBottom: 8 }}>🏢 B2B (GSTIN वाले)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2b_count}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>invoices</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 6 }}>₹{summary.sales.b2b_taxable?.toFixed(2)}</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981', marginBottom: 8 }}>👤 B2C (सामान्य ग्राहक)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2c_count}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>invoices</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 6 }}>₹{summary.sales.b2c_taxable?.toFixed(2)}</div>
            </div>
          </div>

          {/* GSTR-1 B2B Invoices */}
          {summary.gstr1.b2b_invoices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🧾 GSTR-1: B2B Invoices</div>
              <div className="table-container hidden-xs">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>खरीदार / Buyer</th>
                      <th>GSTIN</th>
                      <th>Taxable ₹</th>
                      <th>GST%</th>
                      <th>कुल / Total ₹</th>
                      <th>प्रकार / Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.gstr1.b2b_invoices.map((inv, i) => (
                      <tr key={i}>
                        <td style={{ color: '#6366f1', fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td style={{ fontWeight: 600 }}>{inv.buyer_name || '—'}</td>
                        <td style={{ fontSize: 11, color: '#9ca3af' }}>{inv.buyer_gstin}</td>
                        <td>₹{inv.taxable_amount?.toFixed(2)}</td>
                        <td>{inv.gst_rate}%</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>₹{inv.total?.toFixed(2)}</td>
                        <td><span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{inv.gst_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.gstr1.b2b_invoices.map((inv, i) => (
                  <div key={i} className="card" style={{ borderLeft: '3px solid #6366f1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, color: '#6366f1', fontSize: 13 }}>{inv.invoice_number}</div>
                      <div style={{ fontWeight: 700, color: '#10b981' }}>₹{inv.total?.toFixed(2)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151' }}>{inv.buyer_name} • {inv.buyer_gstin}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Taxable: ₹{inv.taxable_amount?.toFixed(2)} • GST {inv.gst_rate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B2C Summary */}
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>👥 GSTR-1: B2C Summary</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TAXABLE AMOUNT</div><div style={{ fontSize: 18, fontWeight: 700 }}>₹{summary.gstr1.b2c_summary.taxable_amount?.toFixed(2)}</div></div>
              <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TOTAL GST</div><div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>₹{summary.gstr1.b2c_summary.total_gst?.toFixed(2)}</div></div>
              <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TOTAL AMOUNT</div><div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>₹{summary.gstr1.b2c_summary.total_amount?.toFixed(2)}</div></div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>📤 निर्यात / Export</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={exportGSTR1CSV} style={{ padding: '10px 16px', background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-1 CSV
              </button>
              <button onClick={exportGSTR3BCSV} style={{ padding: '10px 16px', background: '#ede9fe', color: '#6d28d9', border: '1.5px solid #c4b5fd', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-3B CSV
              </button>
              <button onClick={exportJSON} style={{ padding: '10px 16px', background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📦 JSON Export
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
              💡 CA को CSV/JSON दे सकते हैं / Share CSV or JSON with your CA directly
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 640px) { .hidden-xs { display: none !important; } .show-xs { display: flex !important; } }
        @media (min-width: 641px) { .show-xs { display: none !important; } }
      `}</style>
    </Layout>
  );
}