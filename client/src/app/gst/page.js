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
      ['Description', 'Amount (Rs)'],
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
  const returnStatus = summary
    ? summary.sales.total > 0
      ? { ok: true, msg: 'Return ready to file' }
      : { ok: false, msg: 'No sales this month' }
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
                <td data-label={type === 'sales' ? 'Invoice' : 'Bill No'}>{item.invoice_number}</td>
                <td data-label="Product">{item.product_name || (item.items?.length > 1 ? `${item.items.length} items` : item.items?.[0]?.product_name)}</td>
                <td data-label={type === 'sales' ? 'Party' : 'Supplier'}>{item.buyer_name || item.supplier_name || '-'}</td>
                <td data-label="Taxable">₹{fmt(item.taxable_amount)}</td>
                <td data-label={type === 'sales' ? 'GST' : 'ITC'} className={type === 'sales' ? 'ui-value-money' : 'ui-value-secondary'}>₹{fmt(item.total_gst)}</td>
                <td data-label="Total">₹{fmt(item.total_amount)}</td>
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
        <section className="hero-panel gst-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Tax centre</div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>GST Summary</div>
              <div style={{ marginTop: 10, color: '#64748b', fontSize: 13.5, maxWidth: 420, lineHeight: 1.55 }}>
                Track collected GST, ITC and filing-ready exports for the selected period.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 220 }}>
              <select className="form-input" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((item, index) => (
                  <option key={item} value={index + 1}>{MONTHS_HI[index]} / {item}</option>
                ))}
              </select>
              <select className="form-input" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                {[2023, 2024, 2025, 2026, 2027].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </section>

        {!summary ? (
          <div className="ui-empty">
            <div style={{ fontSize: 40, marginBottom: 12 }}>Tax</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{loading ? 'Loading summary...' : 'Summary unavailable'}</div>
          </div>
        ) : (
          <>
            <Card
              tone={isPayable ? 'danger' : 'success'}
              title={`${monthHi} ${year}: ${isPayable ? `₹${fmt(payableTotal)} GST payable` : 'No GST payable'}`}
              subtitle={`${monthEn} ${year} GST position after ITC set-off`}
              actions={returnStatus ? <StatusBadge tone={returnStatus.ok ? 'success' : 'warning'}>{returnStatus.msg}</StatusBadge> : null}
            >
              <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard label="Output GST" value={`₹${fmt(gstCollected)}`} note="Collected from sales" tone="money" />
                <StatCard label="Input GST / ITC" value={`₹${fmt(gstITC)}`} note="Claimed from purchases" tone="secondary" />
                <StatCard label="Net Position" value={`₹${fmt(isPayable ? payableTotal : excessCreditTotal)}`} note={isPayable ? 'Payable after ITC' : excessCreditTotal > 0 ? 'Unused ITC left' : 'Balanced'} tone={isPayable ? 'danger' : excessCreditTotal > 0 ? 'money' : 'warning'} />
              </div>
            </Card>

            <section className="tax-pillar-grid">
              <Card title="Tax Pillar" subtitle="Dedicated CGST, SGST and IGST view">
                <div className="tax-pillar-stack">
                  <div className="tax-pillar-row">
                    <div>
                      <span>Output CGST</span>
                      <h3>Sales side</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.sales.cgst)}</strong>
                  </div>
                  <div className="tax-pillar-row">
                    <div>
                      <span>Output SGST</span>
                      <h3>Sales side</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.sales.sgst)}</strong>
                  </div>
                  <div className="tax-pillar-row">
                    <div>
                      <span>Output IGST</span>
                      <h3>Sales side</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.sales.igst)}</strong>
                  </div>
                </div>
              </Card>
              <Card title="ITC Pillar" subtitle="Purchase credits ready for set-off">
                <div className="tax-pillar-stack">
                  <div className="tax-pillar-row">
                    <div>
                      <span>Input CGST</span>
                      <h3>Purchase ITC</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.purchases.cgst)}</strong>
                  </div>
                  <div className="tax-pillar-row">
                    <div>
                      <span>Input SGST</span>
                      <h3>Purchase ITC</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.purchases.sgst)}</strong>
                  </div>
                  <div className="tax-pillar-row">
                    <div>
                      <span>Input IGST</span>
                      <h3>Purchase ITC</h3>
                    </div>
                    <strong>â‚¹{fmt(summary.purchases.igst)}</strong>
                  </div>
                </div>
              </Card>
            </section>

            <Card title="GST Calculation" subtitle="Drill into output GST and purchase ITC">
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

            <Card title="GSTR-3B Summary">
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
                      <td data-label="Description">Output (Sales)</td>
                      <td data-label="CGST">₹{fmt(summary.sales.cgst)}</td>
                      <td data-label="SGST">₹{fmt(summary.sales.sgst)}</td>
                      <td data-label="IGST">₹{fmt(summary.sales.igst)}</td>
                      <td data-label="Total" className="ui-value-money">₹{fmt(summary.sales.total_gst)}</td>
                    </tr>
                    <tr>
                      <td data-label="Description">Input / ITC (Purchase)</td>
                      <td data-label="CGST">₹{fmt(summary.purchases.cgst)}</td>
                      <td data-label="SGST">₹{fmt(summary.purchases.sgst)}</td>
                      <td data-label="IGST">₹{fmt(summary.purchases.igst)}</td>
                      <td data-label="Total" className="ui-value-secondary">₹{fmt(summary.purchases.total_gst)}</td>
                    </tr>
                    <tr>
                      <td data-label="Description">{isPayable ? 'Payable After ITC Set-Off' : 'Unused ITC / Nil Liability'}</td>
                      <td data-label="CGST">₹{fmt(isPayable ? payableByHead.cgst : excessCredit.cgst)}</td>
                      <td data-label="SGST">₹{fmt(isPayable ? payableByHead.sgst : excessCredit.sgst)}</td>
                      <td data-label="IGST">₹{fmt(isPayable ? payableByHead.igst : excessCredit.igst)}</td>
                      <td data-label="Total" className={isPayable ? 'ui-value-danger' : 'ui-value-money'}>₹{fmt(isPayable ? payableTotal : excessCreditTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <StatCard label="B2B Invoices" value={String(summary.sales.b2b_count)} note={`Taxable ₹${fmt(summary.sales.b2b_taxable)}`} tone="secondary" />
              <StatCard label="B2C Invoices" value={String(summary.sales.b2c_count)} note={`Taxable ₹${fmt(summary.sales.b2c_taxable)}`} tone="money" />
            </div>

            {summary.gstr1.b2b_invoices.length === 0 ? (
              <div className="ui-empty">
                <div style={{ fontSize: 24, marginBottom: 8 }}>List</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No B2B Invoices</div>
                <div style={{ fontSize: 12 }}>Sales mein customer ka GSTIN add karo to B2B invoice banega</div>
              </div>
            ) : (
              <Card title="B2B Invoices" subtitle="GSTR-1 filing list">
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
                          <td data-label="Invoice No">{invoice.invoice_number}</td>
                          <td data-label="Buyer">{invoice.buyer_name || '-'}</td>
                          <td data-label="GSTIN">{invoice.buyer_gstin}</td>
                          <td data-label="Taxable">₹{fmt(invoice.taxable_amount)}</td>
                          <td data-label="GST%">{invoice.gst_rate}%</td>
                          <td data-label="Total" className="ui-value-money">₹{fmt(invoice.total)}</td>
                          <td data-label="Type"><StatusBadge tone="secondary">{invoice.gst_type}</StatusBadge></td>
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
                        <div style={{ color: '#fff', fontWeight: 700 }}>{invoice.buyer_name}</div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>GSTIN: {invoice.buyer_gstin} • GST {invoice.gst_rate}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card title="B2C Summary" subtitle="Regular customers without GSTIN">
              <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <StatCard label="Invoices" value={String(summary.gstr1.b2c_summary.count)} note="B2C count" />
                <StatCard label="Taxable" value={`₹${fmt(summary.gstr1.b2c_summary.taxable_amount)}`} />
                <StatCard label="GST" value={`₹${fmt(summary.gstr1.b2c_summary.total_gst)}`} tone="secondary" />
                <StatCard label="Total" value={`₹${fmt(summary.gstr1.b2c_summary.total_amount)}`} tone="money" />
              </div>
            </Card>

            <Card
              title="Export for CA"
              subtitle="Share directly with your CA"
              actions={<StatusBadge tone="neutral">{MONTHS[month - 1]} {year}</StatusBadge>}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <ActionButton variant="primary" onClick={() => exportCSV('gstr1')}>GSTR-1 CSV</ActionButton>
                <ActionButton variant="secondary" onClick={() => exportCSV('gstr3b')}>GSTR-3B CSV</ActionButton>
                <ActionButton variant="dark" onClick={exportJSON}>JSON</ActionButton>
              </div>
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.14)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                  Download everything in one ZIP: GSTR1 + GSTR3B, CSV and JSON together.
                </div>
                <ActionButton variant="secondary" onClick={exportZIP} disabled={zipping}>
                  {zipping ? 'Building ZIP...' : 'Download ZIP (GSTR1 + GSTR3B)'}
                </ActionButton>
              </div>
            </Card>
          </>
        )}
      </div>

      <style>{`
        .gst-shell .gst-hero {
          border: 1px solid rgba(6, 182, 212, 0.14);
          background:
            radial-gradient(circle at 85% 16%, rgba(6, 182, 212, 0.16), transparent 20%),
            radial-gradient(circle at 14% 16%, rgba(59, 130, 246, 0.14), transparent 22%),
            linear-gradient(135deg, #ffffff 0%, #f4fdff 54%, #eef8ff 100%);
          box-shadow: 0 22px 48px rgba(14, 165, 233, 0.1);
        }
        .gst-shell .ui-stat-card,
        .gst-shell .ui-card {
          background:
            radial-gradient(circle at top right, rgba(6,182,212,0.08), transparent 24%),
            linear-gradient(180deg, #ffffff, #f4fdff) !important;
        }

        .gst-shell .page-title,
        .gst-shell .ui-list-card strong,
        .gst-shell div[style*="color: '#fff'"],
        .gst-shell div[style*="color: '#ffffff'"] {
          color: #0f172a !important;
        }

        .gst-shell .ui-empty,
        .gst-shell .ui-list-card {
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
        }

        @media (max-width: 640px) {
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
