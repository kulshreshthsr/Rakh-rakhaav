'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, DataRow, StatCard, StatusBadge } from '../../components/ui/AppUI';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_HI = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);

export default function GSTPage() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [drillType, setDrillType] = useState(null);
  const [drillData, setDrillData] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

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

  const openDrill = async (type) => {
    if (drillType === type) { setDrillType(null); return; }
    setDrillType(type);
    setDrillLoading(true);

    const from = new Date(year, month - 1, 1).toISOString();
    const to = new Date(year, month, 0, 23, 59, 59).toISOString();

    try {
      const url = type === 'sales'
        ? `${API}/api/sales?from=${from}&to=${to}`
        : `${API}/api/purchases?from=${from}&to=${to}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setDrillData(type === 'sales' ? (data.sales || data) : (data.purchases || data));
    } catch {}
    setDrillLoading(false);
  };

  const buildGSTR1CSV = () => {
    const rows = [
      ['GSTR-1 B2B Invoices'],
      ['Invoice No', 'Date', 'Buyer Name', 'Buyer GSTIN', 'Taxable Amount', 'GST Rate%', 'CGST', 'SGST', 'IGST', 'Total'],
      ...summary.gstr1.b2b_invoices.map((invoice) => [
        invoice.invoice_number,
        new Date(invoice.date).toLocaleDateString('en-IN'),
        invoice.buyer_name || '',
        invoice.buyer_gstin || '',
        fmt(invoice.taxable_amount),
        `${invoice.gst_rate}%`,
        fmt(invoice.cgst),
        fmt(invoice.sgst),
        fmt(invoice.igst),
        fmt(invoice.total),
      ]),
      [''],
      ['GSTR-1 B2C Summary'],
      ['Count', 'Taxable Amount', 'Total GST', 'Total Amount'],
      [
        summary.gstr1.b2c_summary.count,
        fmt(summary.gstr1.b2c_summary.taxable_amount),
        fmt(summary.gstr1.b2c_summary.total_gst),
        fmt(summary.gstr1.b2c_summary.total_amount),
      ],
    ];
    return rows.map((row) => row.join(',')).join('\n');
  };

  const buildGSTR3BCSV = () => {
    const rows = [
      ['GSTR-3B Summary'],
      ['Month/Year', `${MONTHS[month - 1]} ${year}`],
      [''],
      ['Description', 'Amount (₹)'],
      ['GST Collected (Output)', fmt(summary.gstr3b.output_gst)],
      ['GST Input Credit (ITC)', fmt(summary.gstr3b.input_gst)],
      ['Net GST Payable After ITC Set-Off', fmt(summary.gstr3b.payable_total ?? summary.gstr3b.net_payable)],
      ['Outward Taxable Sales', fmt(summary.gstr3b.outward_taxable)],
    ];
    return rows.map((row) => row.join(',')).join('\n');
  };

  const exportCSV = (type) => {
    if (!summary) return;
    const csv = type === 'gstr1' ? buildGSTR1CSV() : buildGSTR3BCSV();
    const filename = type === 'gstr1'
      ? `GSTR1_${year}_${String(month).padStart(2, '0')}.csv`
      : `GSTR3B_${year}_${String(month).padStart(2, '0')}.csv`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_${year}_${String(month).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportZIP = async () => {
    if (!summary) return;
    setZipping(true);

    try {
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const zip = new window.JSZip();
      const monthPad = String(month).padStart(2, '0');
      const periodTag = `${year}_${monthPad}`;
      const gstr1Folder = zip.folder('GSTR1');
      const gstr3bFolder = zip.folder('GSTR3B');

      gstr1Folder.file('gstr1.csv', buildGSTR1CSV());
      gstr1Folder.file('gstr1.json', JSON.stringify({
        period: { month: MONTHS[month - 1], year },
        b2b_invoices: summary.gstr1.b2b_invoices,
        b2c_summary: summary.gstr1.b2c_summary,
        sales_totals: summary.sales,
      }, null, 2));

      gstr3bFolder.file('gstr3b.csv', buildGSTR3BCSV());
      gstr3bFolder.file('gstr3b.json', JSON.stringify({
        period: { month: MONTHS[month - 1], year },
        gstr3b: summary.gstr3b,
        purchases: summary.purchases,
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GST_Export_${periodTag}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed. Please try individual CSV/JSON exports.');
    }

    setZipping(false);
  };

  const netPayable = summary?.gstr3b?.net_payable || 0;
  const gstCollected = summary?.gstr3b?.output_gst || 0;
  const gstITC = summary?.gstr3b?.input_gst || 0;
  const payableByHead = summary?.gstr3b?.payable_by_head || { cgst: 0, sgst: 0, igst: 0 };
  const payableTotal = summary?.gstr3b?.payable_total ?? netPayable;
  const excessCredit = summary?.gstr3b?.excess_credit || { cgst: 0, sgst: 0, igst: 0 };
  const excessCreditTotal = (excessCredit.cgst || 0) + (excessCredit.sgst || 0) + (excessCredit.igst || 0);
  const monthHi = MONTHS_HI[month - 1];
  const monthEn = MONTHS[month - 1];
  const isPayable = payableTotal > 0;
  const years = [2024, 2025, 2026, 2027];
  const returnStatus = summary
    ? summary.sales.total > 0
      ? { ok: true, msg: 'Return दाखिल करने के लिए तैयार' }
      : { ok: false, msg: 'इस महीने कोई बिक्री नहीं' }
    : null;

  const renderDrillRows = (type) => {
    if (drillLoading) return <div className="ui-empty">Loading details...</div>;
    if (drillData.length === 0) return <div className="ui-empty">{type === 'sales' ? 'No sales found for this month' : 'No purchases found for this month'}</div>;

    return (
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{type === 'sales' ? 'Invoice' : 'Bill No'}</th>
              <th>Product</th>
              <th>{type === 'sales' ? 'Party' : 'Supplier'}</th>
              <th>Taxable</th>
              <th>{type === 'sales' ? 'GST' : 'ITC'}</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {drillData.map((item, index) => (
              <tr key={index}>
                <td>{item.invoice_number}</td>
                <td>{item.product_name || (item.items?.length > 1 ? `${item.items.length} items` : item.items?.[0]?.product_name)}</td>
                <td>{item.buyer_name || item.supplier_name || '-'}</td>
                <td>₹{fmt(item.taxable_amount)}</td>
                <td className={type === 'sales' ? 'ui-value-money' : 'ui-value-secondary'}>₹{fmt(item.total_gst)}</td>
                <td>₹{fmt(item.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Layout>
      <div className="page-shell gst-shell">
        <section className="page-header-card gst-header-card">
          <div className="gst-header-copy">
            <div className="page-title">GST सारांश / GST Summary</div>
            <div className="page-subtitle">
              Output GST, input tax credit, filing readiness, and CA-ready exports for the selected period.
            </div>
          </div>
          <div className="gst-period-group">
            <div className="gst-period-picker" aria-label="Select month">
              {MONTHS.map((item, index) => {
                const active = month === index + 1;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`gst-period-pill ${active ? 'is-active' : ''}`}
                    onClick={() => setMonth(index + 1)}
                  >
                    {MONTHS_HI[index]} / {item}
                  </button>
                );
              })}
            </div>
            <div className="gst-period-picker gst-year-picker" aria-label="Select year">
              {years.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`gst-period-pill ${year === item ? 'is-active' : ''}`}
                  onClick={() => setYear(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!summary ? (
          loading ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="ui-skeleton-card">
                <div className="ui-skeleton-line is-medium" />
                <div className="ui-skeleton-line is-long" style={{ marginTop: 14 }} />
              </div>
              <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="ui-skeleton-card">
                    <div className="ui-skeleton-line is-short" />
                    <div className="ui-skeleton-line is-medium" style={{ marginTop: 16, height: 28 }} />
                    <div className="ui-skeleton-line is-long" style={{ marginTop: 14 }} />
                  </div>
                ))}
              </section>
              <div className="ui-skeleton-card"><div className="ui-skeleton-block" style={{ height: 220 }} /></div>
            </div>
          ) : (
            <div className="ui-empty">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Summary unavailable</div>
            </div>
          )
        ) : (
          <>
            <section className={`card gst-alert-card ${isPayable ? 'is-payable' : 'is-balanced'}`}>
              <div className="gst-alert-head">
                <div className="gst-alert-icon" aria-hidden="true">{isPayable ? '!' : '✓'}</div>
                <div className="gst-alert-copy">
                  <h2>{monthHi} {year}: {isPayable ? `₹${fmt(payableTotal)} GST भरना है` : 'GST liability clear है'}</h2>
                  <p>{monthEn} {year} GST position after input tax credit set-off.</p>
                </div>
                {returnStatus ? (
                  <div className={`gst-status-pill ${returnStatus.ok ? 'is-success' : 'is-warning'}`}>
                    {returnStatus.ok ? '✓ ' : ''}{returnStatus.msg}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="metric-grid gst-calc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="metric-card metric-card--success">
                <div className="metric-label">OUTPUT GST</div>
                <div className="metric-value" style={{ color: '#00C896' }}>₹{fmt(gstCollected)}</div>
                <div className="metric-note">Collected from sales</div>
              </div>
              <div className="metric-card metric-card--accent">
                <div className="metric-label">INPUT GST / ITC</div>
                <div className="metric-value" style={{ color: '#6C63FF' }}>₹{fmt(gstITC)}</div>
                <div className="metric-note">Claimed from purchases</div>
              </div>
              <div className="metric-card metric-card--danger">
                <div className="metric-label">NET PAYABLE</div>
                <div className="metric-value" style={{ color: '#FF6B6B' }}>₹{fmt(isPayable ? payableTotal : 0)}</div>
                <div className="metric-note">
                  {isPayable ? 'Tax still payable after ITC' : excessCreditTotal > 0 ? `Excess ITC ₹${fmt(excessCreditTotal)}` : 'Return currently balanced'}
                </div>
              </div>
            </section>

            <Card title="जीएसटी गणना / GST Calculation" subtitle="Drill into output GST and purchase ITC">
              <DataRow
                label="GST Collected (Output)"
                note={`Collected from customers through sales. CGST ₹${fmt(summary.sales.cgst)} + SGST ₹${fmt(summary.sales.sgst)} + IGST ₹${fmt(summary.sales.igst)}`}
                value={`₹${fmt(gstCollected)}`}
                valueTone="ui-value-money"
              />
              <div style={{ marginTop: 10, marginBottom: 12 }}>
                <ActionButton variant="secondary" onClick={() => openDrill('sales')}>
                  {drillType === 'sales' ? 'Hide Sales' : 'View Sales'}
                </ActionButton>
              </div>
              {drillType === 'sales' ? renderDrillRows('sales') : null}

              <div style={{ height: 1, background: 'rgba(148,163,184,0.14)', margin: '16px 0' }} />

              <DataRow
                label="GST Input Credit (ITC)"
                note={`Paid to suppliers on purchases. CGST ₹${fmt(summary.purchases.cgst)} + SGST ₹${fmt(summary.purchases.sgst)} + IGST ₹${fmt(summary.purchases.igst)}`}
                value={`₹${fmt(gstITC)}`}
                valueTone="ui-value-secondary"
              />
              <div style={{ marginTop: 10, marginBottom: 12 }}>
                <ActionButton variant="secondary" onClick={() => openDrill('purchases')}>
                  {drillType === 'purchases' ? 'Hide Purchases' : 'View Purchases'}
                </ActionButton>
              </div>
              {drillType === 'purchases' ? renderDrillRows('purchases') : null}

              {gstITC === 0 ? (
                <div style={{ marginTop: 14 }}>
                  <StatusBadge tone="warning">No ITC claimed - you may be overpaying tax</StatusBadge>
                </div>
              ) : null}

              <div style={{ marginTop: 16 }}>
                <DataRow
                  label={isPayable ? 'Net GST Payable' : 'Excess ITC Available'}
                  note="Remaining position after ITC set-off"
                  value={`₹${fmt(isPayable ? payableTotal : excessCreditTotal)}`}
                  valueTone={isPayable ? 'ui-value-danger' : 'ui-value-money'}
                  tone={isPayable ? 'danger' : 'success'}
                />
              </div>
            </Card>

            <Card title="जीएसटीआर-3बी सारांश / GSTR-3B Summary">
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>IGST</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Output (Sales)</td>
                      <td>₹{fmt(summary.sales.cgst)}</td>
                      <td>₹{fmt(summary.sales.sgst)}</td>
                      <td>₹{fmt(summary.sales.igst)}</td>
                      <td className="ui-value-money">₹{fmt(summary.sales.total_gst)}</td>
                    </tr>
                    <tr>
                      <td>Input / ITC (Purchase)</td>
                      <td>₹{fmt(summary.purchases.cgst)}</td>
                      <td>₹{fmt(summary.purchases.sgst)}</td>
                      <td>₹{fmt(summary.purchases.igst)}</td>
                      <td className="ui-value-secondary">₹{fmt(summary.purchases.total_gst)}</td>
                    </tr>
                    <tr className="gstr3b-total-row">
                      <td>{isPayable ? 'Payable After ITC Set-Off' : 'Unused ITC / Nil Liability'}</td>
                      <td>₹{fmt(isPayable ? payableByHead.cgst : excessCredit.cgst)}</td>
                      <td>₹{fmt(isPayable ? payableByHead.sgst : excessCredit.sgst)}</td>
                      <td>₹{fmt(isPayable ? payableByHead.igst : excessCredit.igst)}</td>
                      <td className={isPayable ? 'ui-value-danger' : 'ui-value-money'}>₹{fmt(isPayable ? payableTotal : excessCreditTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <section className="gst-bucket-grid">
              <div className="card gst-bucket-card">
                <div className="gst-bucket-label">B2B</div>
                <div className="gst-bucket-title">Business invoices with GSTIN</div>
                <div className="gst-bucket-metrics">
                  <div>
                    <div className="metric-label">INVOICES</div>
                    <div className="metric-value" style={{ color: '#F0F0FF' }}>{summary.sales.b2b_count}</div>
                  </div>
                  <div>
                    <div className="metric-label">AMOUNT</div>
                    <div className="metric-value" style={{ color: '#6C63FF' }}>₹{fmt(summary.sales.b2b_taxable)}</div>
                  </div>
                </div>
              </div>
              <div className="card gst-bucket-card">
                <div className="gst-bucket-label">B2C</div>
                <div className="gst-bucket-title">Retail invoices without GSTIN</div>
                <div className="gst-bucket-metrics">
                  <div>
                    <div className="metric-label">INVOICES</div>
                    <div className="metric-value" style={{ color: '#F0F0FF' }}>{summary.sales.b2c_count}</div>
                  </div>
                  <div>
                    <div className="metric-label">AMOUNT</div>
                    <div className="metric-value" style={{ color: '#00C896' }}>₹{fmt(summary.sales.b2c_taxable)}</div>
                  </div>
                </div>
              </div>
            </section>

            {summary.gstr1.b2b_invoices.length === 0 ? (
              <div className="ui-empty">
                <div style={{ fontSize: 24, marginBottom: 8 }}>List</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No B2B Invoices</div>
                <div style={{ fontSize: 12 }}>Sales mein customer ka GSTIN add karo to B2B invoice banega</div>
              </div>
            ) : (
              <Card title="बी2बी चालान / B2B Invoices" subtitle="GSTR-1 filing list">
                <div className="ui-table-wrap hidden-xs">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Buyer</th>
                        <th>GSTIN</th>
                        <th>Taxable</th>
                        <th>GST%</th>
                        <th>Total</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.gstr1.b2b_invoices.map((invoice, index) => (
                        <tr key={index}>
                          <td>{invoice.invoice_number}</td>
                          <td>{invoice.buyer_name || '-'}</td>
                          <td>{invoice.buyer_gstin}</td>
                          <td>₹{fmt(invoice.taxable_amount)}</td>
                          <td>{invoice.gst_rate}%</td>
                          <td className="ui-value-money">₹{fmt(invoice.total)}</td>
                          <td><StatusBadge tone="secondary">{invoice.gst_type}</StatusBadge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="show-xs" style={{ flexDirection: 'column', gap: 10 }}>
                  {summary.gstr1.b2b_invoices.map((invoice, index) => (
                    <div key={index} className="ui-list-card" style={{ alignItems: 'stretch' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <strong style={{ color: '#67e8f9' }}>{invoice.invoice_number}</strong>
                          <span className="ui-value-money">₹{fmt(invoice.total)}</span>
                        </div>
                        <div style={{ color: '#0f172a', fontWeight: 700 }}>{invoice.buyer_name}</div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>GSTIN: {invoice.buyer_gstin} • GST {invoice.gst_rate}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card title="बी2सी सारांश / B2C Summary" subtitle="Regular customers without GSTIN">
              <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <StatCard label="Invoices" value={String(summary.gstr1.b2c_summary.count)} note="B2C count" />
                <StatCard label="Taxable" value={`₹${fmt(summary.gstr1.b2c_summary.taxable_amount)}`} />
                <StatCard label="GST" value={`₹${fmt(summary.gstr1.b2c_summary.total_gst)}`} tone="secondary" />
                <StatCard label="Total" value={`₹${fmt(summary.gstr1.b2c_summary.total_amount)}`} tone="money" />
              </div>
            </Card>

            <Card
              title="सीए एक्सपोर्ट / CA Export"
              subtitle="GSTR files ready to hand over"
              actions={<StatusBadge tone="neutral">{MONTHS[month - 1]} {year}</StatusBadge>}
            >
              <div className="gst-export-grid">
                <button type="button" className="gst-export-btn gst-export-btn--gstr1" onClick={() => exportCSV('gstr1')}>
                  <span>GSTR-1 CSV</span>
                  <small>B2B and B2C invoice export</small>
                </button>
                <button type="button" className="gst-export-btn gst-export-btn--gstr3b" onClick={() => exportCSV('gstr3b')}>
                  <span>GSTR-3B CSV</span>
                  <small>Monthly liability summary</small>
                </button>
                <button type="button" className="gst-export-btn gst-export-btn--json" onClick={exportJSON}>
                  <span>JSON</span>
                  <small>Structured data backup</small>
                </button>
                <button type="button" className="gst-export-btn gst-export-btn--zip" onClick={exportZIP} disabled={zipping}>
                  <span>{zipping ? 'Building ZIP...' : 'Download ZIP'}</span>
                  <small>CSV + JSON in one bundle</small>
                </button>
              </div>
            </Card>
          </>
        )}
      </div>

      <style>{`
        .gst-shell .gst-header-card {
          display: grid;
          gap: 18px;
          background: linear-gradient(135deg, #1A1D35 0%, #161929 100%);
          border-radius: 16px;
        }

        .gst-shell .gst-period-group {
          display: grid;
          gap: 12px;
        }

        .gst-shell .gst-period-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .gst-shell .gst-period-pill {
          min-height: 40px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #FFFFFF15;
          background: #1E2235;
          color: #8B8FA8;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .gst-shell .gst-period-pill.is-active {
          border-color: #6C63FF;
          background: #6C63FF22;
          color: #6C63FF;
        }

        .gst-shell .gst-alert-card.is-payable {
          background: linear-gradient(135deg, rgba(255, 179, 71, 0.14) 0%, rgba(255, 107, 107, 0.08) 100%), #161929;
        }

        .gst-shell .gst-alert-card.is-balanced {
          background: linear-gradient(135deg, rgba(0, 200, 150, 0.12) 0%, rgba(108, 99, 255, 0.08) 100%), #161929;
        }

        .gst-shell .gst-alert-head {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          align-items: start;
        }

        .gst-shell .gst-alert-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #FFB34718;
          border: 1px solid #FFB34740;
          color: #FFB347;
          font-size: 20px;
          font-weight: 700;
        }

        .gst-shell .gst-alert-copy h2 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 700;
          color: #F0F0FF;
        }

        .gst-shell .gst-alert-copy p {
          margin: 0;
          color: #8B8FA8;
        }

        .gst-shell .gst-status-pill {
          justify-self: start;
          margin-top: 12px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid #FFFFFF15;
          font-size: 12px;
          font-weight: 600;
        }

        .gst-shell .gst-status-pill.is-success {
          background: #00C89618;
          border-color: #00C89640;
          color: #00C896;
        }

        .gst-shell .gst-status-pill.is-warning {
          background: #FFB34718;
          border-color: #FFB34740;
          color: #FFB347;
        }

        .gst-shell .gst-calc-grid {
          margin-top: 0;
        }

        .gst-shell .metric-card--accent::before {
          background: #6C63FF;
        }

        .gst-shell .gst-bucket-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .gst-shell .gst-bucket-card {
          display: grid;
          gap: 12px;
        }

        .gst-shell .gst-bucket-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #555870;
        }

        .gst-shell .gst-bucket-title {
          font-size: 15px;
          font-weight: 600;
          color: #F0F0FF;
        }

        .gst-shell .gst-bucket-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .gst-shell .gst-export-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .gst-shell .gst-export-btn {
          min-height: 88px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid #FFFFFF15;
          background: #1E2235;
          color: #F0F0FF;
          text-align: left;
          transition: all 0.15s ease;
        }

        .gst-shell .gst-export-btn:hover {
          filter: brightness(1.08);
        }

        .gst-shell .gst-export-btn span {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 600;
        }

        .gst-shell .gst-export-btn small {
          display: block;
          color: #8B8FA8;
          font-size: 12px;
          line-height: 1.5;
        }

        .gst-shell .gst-export-btn--gstr1 {
          background: #6C63FF22;
          border-color: #6C63FF40;
          color: #6C63FF;
        }

        .gst-shell .gst-export-btn--gstr3b {
          background: #00C89618;
          border-color: #00C89640;
          color: #00C896;
        }

        .gst-shell .gst-export-btn--json {
          background: #1E2235;
          border-color: #FFFFFF15;
          color: #F0F0FF;
        }

        .gst-shell .gst-export-btn--zip {
          background: #FFB34718;
          border-color: #FFB34740;
          color: #FFB347;
        }

        .gst-shell .gst-export-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .gst-shell .ui-list-card strong { color: #F0F0FF; }

        @media (max-width: 640px) {
          .gst-shell .gst-bucket-grid {
            grid-template-columns: 1fr;
          }

          .hidden-xs { display: none !important; }
          .show-xs { display: flex !important; }
        }
        @media (min-width: 641px) {
          .show-xs { display: none !important; }
        }
      `}</style>
    </Layout>
  );
}

