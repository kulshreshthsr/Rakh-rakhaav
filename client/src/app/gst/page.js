'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

  const exportCSV = (type) => {
    if (!summary) return;
    let rows, filename;
    if (type === 'gstr1') {
      rows = [
        ['GSTR-1 B2B Invoices'],
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
        [''],
        ['GSTR-1 B2C Summary'],
        ['Count', 'Taxable Amount', 'Total GST', 'Total Amount'],
        [summary.gstr1.b2c_summary.count, summary.gstr1.b2c_summary.taxable_amount?.toFixed(2), summary.gstr1.b2c_summary.total_gst?.toFixed(2), summary.gstr1.b2c_summary.total_amount?.toFixed(2)],
      ];
      filename = `GSTR1_${year}_${String(month).padStart(2,'0')}.csv`;
    } else {
      rows = [
        ['GSTR-3B Summary'],
        ['Month/Year', `${MONTHS[month-1]} ${year}`],
        [''],
        ['Description', 'Amount (₹)'],
        ['GST Collected (Sales)', summary.gstr3b.output_gst?.toFixed(2)],
        ['GST Paid on Purchase', summary.gstr3b.input_gst?.toFixed(2)],
        ['Net GST Payable', summary.gstr3b.net_payable?.toFixed(2)],
        [''],
        ['Taxable Sales', summary.gstr3b.outward_taxable?.toFixed(2)],
      ];
      filename = `GSTR3B_${year}_${String(month).padStart(2,'0')}.csv`;
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_${year}_${String(month).padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const netPayable = summary?.gstr3b?.net_payable || 0;
  const gstCollected = summary?.gstr3b?.output_gst || 0;
  const gstPaidOnPurchase = summary?.gstr3b?.input_gst || 0;
  const monthName = MONTHS[month - 1];

  return (
    <Layout>
      <div className="page-title">GST सारांश / GST Summary</div>

      {/* Month/Year selector */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>महीना / Month:</div>
        <select className="form-input" style={{ minWidth: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" style={{ minWidth: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={fetchSummary} className="btn-primary" style={{ minWidth: 100 }}>
          {loading ? '⏳ लोड...' : '🔍 देखें'}
        </button>
      </div>

      {!summary ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
          <div>महीना चुनें और "देखें" पर क्लिक करें</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Select month and click View</div>
        </div>
      ) : (
        <>
          {/* ── TOP SUMMARY LINE ── */}
          <div style={{
            background: netPayable > 0 ? '#fef2f2' : netPayable < 0 ? '#f0fdf4' : '#f0fdf4',
            border: `2px solid ${netPayable > 0 ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 16, padding: '20px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 28 }}>{netPayable > 0 ? '⚠️' : '✅'}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: netPayable > 0 ? '#991b1b' : '#065f46' }}>
                {netPayable > 0
                  ? `${monthName} ${year}: आपको ₹${netPayable.toFixed(2)} GST भरना है`
                  : netPayable < 0
                  ? `${monthName} ${year}: आपको ₹${Math.abs(netPayable).toFixed(2)} GST वापस मिलेगा 🎉`
                  : `${monthName} ${year}: कोई GST नहीं भरना ✅`
                }
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {netPayable > 0
                  ? `${monthName} ${year}: You need to pay ₹${netPayable.toFixed(2)} GST`
                  : netPayable < 0
                  ? `${monthName} ${year}: GST refund of ₹${Math.abs(netPayable).toFixed(2)}`
                  : `${monthName} ${year}: No GST to pay ✅`
                }
              </div>
            </div>
          </div>

          {/* ── GSTR-3B: Simple Calculation ── */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 16 }}>
              🧮 GST हिसाब / Calculation
            </div>

            {/* GST Collected */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#065f46' }}>✅ GST वसूला / GST Collected</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Sales mein jo GST aapne customers se liya</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>₹{gstCollected.toFixed(2)}</div>
            </div>

            {/* GST Paid on Purchase */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#eff6ff', borderRadius: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af' }}>🛒 खरीद पर GST / GST Paid on Purchase</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Purchases mein aapne jo GST bhara (Input Credit)</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>₹{gstPaidOnPurchase.toFixed(2)}</div>
            </div>

            {/* ITC Warning */}
            {gstPaidOnPurchase === 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#92400e' }}>
                ⚠️ कोई खरीद GST नहीं मिली / No purchase GST claimed — आप ज्यादा tax भर रहे हो / You may be paying more tax
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '2px dashed #e5e7eb', margin: '6px 0 12px' }} />

            {/* Net Payable */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: netPayable > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 12, border: `2px solid ${netPayable > 0 ? '#fecaca' : '#bbf7d0'}` }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: netPayable > 0 ? '#991b1b' : '#065f46' }}>
                  {netPayable >= 0 ? '💸 सरकार को देना है / Net Payable' : '💰 वापसी मिलेगी / Refund'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  ₹{gstCollected.toFixed(2)} − ₹{gstPaidOnPurchase.toFixed(2)} = <strong style={{ color: netPayable > 0 ? '#ef4444' : '#059669' }}>₹{netPayable.toFixed(2)}</strong>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: netPayable > 0 ? '#ef4444' : '#059669' }}>
                ₹{Math.abs(netPayable).toFixed(2)}
              </div>
            </div>
          </div>

          {/* ── B2B vs B2C ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', marginBottom: 8 }}>🏢 B2B (GSTIN वाले)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2b_count}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>invoices</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>₹{summary.sales.b2b_taxable?.toFixed(2)}</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981', marginBottom: 8 }}>👤 B2C (सामान्य ग्राहक)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>{summary.sales.b2c_count}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>invoices</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>₹{summary.sales.b2c_taxable?.toFixed(2)}</div>
            </div>
          </div>

          {/* ── B2B Invoices ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 10 }}>
              🧾 B2B Invoices (GSTR-1 के लिए)
            </div>
            {summary.gstr1.b2b_invoices.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>कोई B2B Invoice नहीं</div>
                <div style={{ fontSize: 12 }}>💡 Sales mein GSTIN add karo to B2B invoice banega / Add GSTIN in sales to create B2B invoices</div>
              </div>
            ) : (
              <>
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
                        <th>Type</th>
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
                <div className="show-xs" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {summary.gstr1.b2b_invoices.map((inv, i) => (
                    <div key={i} className="card" style={{ borderLeft: '3px solid #6366f1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, color: '#6366f1', fontSize: 13 }}>{inv.invoice_number}</div>
                        <div style={{ fontWeight: 700, color: '#10b981' }}>₹{inv.total?.toFixed(2)}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#374151' }}>{inv.buyer_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>GSTIN: {inv.buyer_gstin} • GST {inv.gst_rate}%</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── B2C Summary ── */}
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>
              👥 B2C Summary (सामान्य ग्राहक)
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>INVOICES</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.gstr1.b2c_summary.count}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TAXABLE</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>₹{summary.gstr1.b2c_summary.taxable_amount?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>GST</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>₹{summary.gstr1.b2c_summary.total_gst?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>TOTAL</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>₹{summary.gstr1.b2c_summary.total_amount?.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* ── Export ── */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>
              📤 CA को दें / Export for CA
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => exportCSV('gstr1')} style={{ padding: '10px 16px', background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-1 CSV
              </button>
              <button onClick={() => exportCSV('gstr3b')} style={{ padding: '10px 16px', background: '#ede9fe', color: '#6d28d9', border: '1.5px solid #c4b5fd', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📊 GSTR-3B CSV
              </button>
              <button onClick={exportJSON} style={{ padding: '10px 16px', background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📦 JSON
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
              💡 यह फ़ाइल अपने CA को दे सकते हैं / Share these files directly with your CA
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