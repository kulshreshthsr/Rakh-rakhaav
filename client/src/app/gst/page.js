'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, DataRow, StatCard, StatusBadge } from '../../components/ui/AppUI';
import { apiUrl } from '../../lib/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_HI = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));
const getRecordGstRate = (record = {}) => {
  if (record?.items?.length) {
    const itemRate = Number(record.items.find((item) => Number(item?.gst_rate || 0) > 0)?.gst_rate || 0);
    if (itemRate > 0) return itemRate;
  }

  return Number(record?.gst_rate || 0);
};

const getRecordGstType = (record = {}) => {
  if (record?.gst_type === 'IGST' || record?.gst_type === 'CGST_SGST') {
    return record.gst_type;
  }

  if (Number(record?.igst_amount || 0) > 0) return 'IGST';
  return 'CGST_SGST';
};

const getRecordInvoiceType = (record = {}, kind = 'sale') => {
  if (record?.invoice_type === 'B2B' || record?.invoice_type === 'B2C') {
    return record.invoice_type;
  }

  const gstin = kind === 'sale' ? record?.buyer_gstin : record?.supplier_gstin;
  return gstin ? 'B2B' : 'B2C';
};

const getRecordTaxHeads = (record = {}) => {
  const directCgst = Number(record?.cgst_amount || 0);
  const directSgst = Number(record?.sgst_amount || 0);
  const directIgst = Number(record?.igst_amount || 0);

  if (directCgst || directSgst || directIgst) {
    return {
      cgst: round2(directCgst),
      sgst: round2(directSgst),
      igst: round2(directIgst),
    };
  }

  const totalGst = Number(record?.total_gst || 0);
  if (!totalGst) {
    return { cgst: 0, sgst: 0, igst: 0 };
  }

  if (getRecordGstType(record) === 'IGST') {
    return { cgst: 0, sgst: 0, igst: round2(totalGst) };
  }

  const half = round2(totalGst / 2);
  return {
    cgst: half,
    sgst: round2(totalGst - half),
    igst: 0,
  };
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
  const outputTax = sumTaxHeads(sales);
  const inputCredit = sumTaxHeads(purchases);
  const liabilities = { ...outputTax };
  const remainingCredit = { ...inputCredit };
  const utilization = {
    igst: { igst: 0, cgst: 0, sgst: 0 },
    cgst: { igst: 0, cgst: 0, sgst: 0 },
    sgst: { igst: 0, cgst: 0, sgst: 0 },
  };

  applyCredit(remainingCredit, liabilities, 'igst', ['igst', 'cgst', 'sgst'], utilization);
  applyCredit(remainingCredit, liabilities, 'cgst', ['cgst', 'igst'], utilization);
  applyCredit(remainingCredit, liabilities, 'sgst', ['sgst', 'igst'], utilization);

  return {
    outward_taxable: round2(sales.reduce((sum, record) => sum + Number(record?.taxable_amount || 0), 0)),
    output_gst: round2(outputTax.cgst + outputTax.sgst + outputTax.igst),
    input_gst: round2(inputCredit.cgst + inputCredit.sgst + inputCredit.igst),
    output_tax: outputTax,
    input_tax_credit: inputCredit,
    credit_utilized: utilization,
    payable_by_head: {
      cgst: round2(liabilities.cgst),
      sgst: round2(liabilities.sgst),
      igst: round2(liabilities.igst),
    },
    payable_total: round2(liabilities.cgst + liabilities.sgst + liabilities.igst),
    excess_credit: {
      cgst: round2(remainingCredit.cgst),
      sgst: round2(remainingCredit.sgst),
      igst: round2(remainingCredit.igst),
    },
    net_payable: round2(liabilities.cgst + liabilities.sgst + liabilities.igst),
  };
};

const buildLocalGSTSummary = (sales = [], purchases = [], month, year) => {
  const normalizedSales = sales.map((sale) => {
    const taxHeads = getRecordTaxHeads(sale);
    return {
      ...sale,
      invoice_type: getRecordInvoiceType(sale, 'sale'),
      gst_type: getRecordGstType(sale),
      gst_rate: getRecordGstRate(sale),
      cgst_amount: taxHeads.cgst,
      sgst_amount: taxHeads.sgst,
      igst_amount: taxHeads.igst,
      total_gst: round2(sale?.total_gst || taxHeads.cgst + taxHeads.sgst + taxHeads.igst),
    };
  });

  const normalizedPurchases = purchases.map((purchase) => {
    const taxHeads = getRecordTaxHeads(purchase);
    return {
      ...purchase,
      invoice_type: getRecordInvoiceType(purchase, 'purchase'),
      gst_type: getRecordGstType(purchase),
      gst_rate: getRecordGstRate(purchase),
      cgst_amount: taxHeads.cgst,
      sgst_amount: taxHeads.sgst,
      igst_amount: taxHeads.igst,
      total_gst: round2(purchase?.total_gst || taxHeads.cgst + taxHeads.sgst + taxHeads.igst),
    };
  });

  const b2b = normalizedSales.filter((sale) => sale?.invoice_type === 'B2B');
  const b2c = normalizedSales.filter((sale) => sale?.invoice_type !== 'B2B');
  const salesTaxHeads = sumTaxHeads(normalizedSales);
  const purchaseTaxHeads = sumTaxHeads(normalizedPurchases);
  const gstr3b = calculateGSTR3BSummary(normalizedSales, normalizedPurchases);

  return {
    month: Number(month),
    year: Number(year),
    sales: {
      total: normalizedSales.length,
      taxable_amount: round2(normalizedSales.reduce((sum, sale) => sum + Number(sale?.taxable_amount || 0), 0)),
      total_gst: round2(normalizedSales.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0)),
      cgst: salesTaxHeads.cgst,
      sgst: salesTaxHeads.sgst,
      igst: salesTaxHeads.igst,
      total_amount: round2(normalizedSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0)),
      b2b_count: b2b.length,
      b2c_count: b2c.length,
      b2b_taxable: round2(b2b.reduce((sum, sale) => sum + Number(sale?.taxable_amount || 0), 0)),
      b2c_taxable: round2(b2c.reduce((sum, sale) => sum + Number(sale?.taxable_amount || 0), 0)),
    },
    purchases: {
      total: normalizedPurchases.length,
      taxable_amount: round2(normalizedPurchases.reduce((sum, purchase) => sum + Number(purchase?.taxable_amount || 0), 0)),
      total_gst: round2(normalizedPurchases.reduce((sum, purchase) => sum + Number(purchase?.total_gst || 0), 0)),
      cgst: purchaseTaxHeads.cgst,
      sgst: purchaseTaxHeads.sgst,
      igst: purchaseTaxHeads.igst,
    },
    gstr1: {
      b2b_invoices: b2b.map((sale) => ({
        invoice_number: sale.invoice_number,
        date: sale.createdAt || sale.sold_at,
        buyer_name: sale.buyer_name,
        buyer_gstin: sale.buyer_gstin,
        taxable_amount: round2(sale.taxable_amount),
        gst_rate: sale.items?.length
          ? [...new Set(sale.items.map((item) => item.gst_rate))].join('/')
          : sale.gst_rate,
        cgst: round2(sale.cgst_amount),
        sgst: round2(sale.sgst_amount),
        igst: round2(sale.igst_amount),
        total: round2(sale.total_amount),
        gst_type: sale.gst_type,
      })),
      b2c_summary: {
        count: b2c.length,
        taxable_amount: round2(b2c.reduce((sum, sale) => sum + Number(sale?.taxable_amount || 0), 0)),
        total_gst: round2(b2c.reduce((sum, sale) => sum + Number(sale?.total_gst || 0), 0)),
        total_amount: round2(b2c.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0)),
      },
    },
    gstr3b,
  };
};

const GstStepIcon = ({ kind }) => {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (kind === 'output') {
    return (
      <svg {...commonProps}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (kind === 'input') {
    return (
      <svg {...commonProps}>
        <path d="M8 3.5h5l4 4V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M13 3.5v4h4" />
        <path d="M9.5 12H15" />
        <path d="M9.5 16H14" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
};

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
      const from = new Date(year, month - 1, 1).toISOString();
      const to = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [salesRes, purchasesRes] = await Promise.all([
        fetch(apiUrl(`/api/sales?from=${from}&to=${to}`), { headers }),
        fetch(apiUrl(`/api/purchases?from=${from}&to=${to}`), { headers }),
      ]);

      if (salesRes.status === 401 || purchasesRes.status === 401) {
        router.push('/login');
        return;
      }

      const salesPayload = salesRes.ok ? await salesRes.json() : { sales: [] };
      const purchasesPayload = purchasesRes.ok ? await purchasesRes.json() : { purchases: [] };
      const sales = Array.isArray(salesPayload?.sales) ? salesPayload.sales : [];
      const purchases = Array.isArray(purchasesPayload?.purchases) ? purchasesPayload.purchases : [];

      setSummary(buildLocalGSTSummary(sales, purchases, month, year));
    } catch {
      setSummary(null);
    }
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
        ? apiUrl(`/api/sales?from=${from}&to=${to}`)
        : apiUrl(`/api/purchases?from=${from}&to=${to}`);

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
        <section className="card gst-hero">
          <div className="gst-hero-layout">
            <div className="gst-hero-copy" style={{ minWidth: 0 }}>
              <div className="page-title">GST Summary</div>
              <div className="page-subtitle gst-hero-subtitle">
                Track collected GST, ITC and filing-ready exports for the selected period.
              </div>
            </div>
            <div className="gst-period-grid">
              <select className="form-input gst-period-select" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                {MONTHS.map((item, index) => (
                  <option key={item} value={index + 1}>{MONTHS_HI[index]} / {item}</option>
                ))}
              </select>
              <select className="form-input gst-period-select" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
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
              className="gst-status-card"
              title={
                <div className="gst-status-copy">
                  <div className="gst-status-amount">
                    {isPayable ? `₹${fmt(payableTotal)} GST payable` : `₹${fmt(excessCreditTotal)} excess ITC`}
                  </div>
                  <div className="gst-status-subtitle">{`${monthEn} ${year} GST position after ITC set-off`}</div>
                </div>
              }
              subtitle={null}
              actions={returnStatus ? <StatusBadge className="gst-status-badge" tone={returnStatus.ok ? 'success' : 'warning'}>{returnStatus.msg}</StatusBadge> : null}
            >
              <div className="gst-step-stack">
                <div className="gst-step-card gst-step-output">
                  <div className="gst-step-left">
                    <div className="gst-step-icon"><GstStepIcon kind="output" /></div>
                    <div>
                      <div className="gst-step-label">Output GST</div>
                      <div className="gst-step-note">Collected from sales</div>
                    </div>
                  </div>
                  <div className="gst-step-value">₹{fmt(gstCollected)}</div>
                </div>
                <div className="gst-step-card gst-step-input">
                  <div className="gst-step-left">
                    <div className="gst-step-icon"><GstStepIcon kind="input" /></div>
                    <div>
                      <div className="gst-step-label">Input GST / ITC</div>
                      <div className="gst-step-note">Claimed from purchases</div>
                    </div>
                  </div>
                  <div className="gst-step-value">₹{fmt(gstITC)}</div>
                </div>
                <div className="gst-step-card gst-step-net">
                  <div className="gst-step-left">
                    <div className="gst-step-icon"><GstStepIcon kind="net" /></div>
                    <div>
                      <div className="gst-step-label">Net Position</div>
                      <div className="gst-step-note">{isPayable ? 'Payable after ITC' : excessCreditTotal > 0 ? 'Unused ITC left' : 'Balanced'}</div>
                    </div>
                  </div>
                  <div className="gst-step-value">₹{fmt(isPayable ? payableTotal : excessCreditTotal)}</div>
                </div>
              </div>
            </Card>

            <Card className="gst-calc-card" title="GST Input Credit (ITC)" subtitle={`Paid to suppliers on purchases. CGST ₹${fmt(summary.purchases.cgst)} + SGST ₹${fmt(summary.purchases.sgst)} + IGST ₹${fmt(summary.purchases.igst)}`}>
              <div className="gst-calc-block">
                <DataRow
                  label="GST Collected (Output)"
                  note={`Collected from customers through sales. CGST ₹${fmt(summary.sales.cgst)} + SGST ₹${fmt(summary.sales.sgst)} + IGST ₹${fmt(summary.sales.igst)}`}
                  value={`₹${fmt(gstCollected)}`}
                  valueTone="ui-value-money"
                />
                <div className="gst-action-row">
                  <ActionButton className="gst-drill-button" variant="primary" onClick={() => openDrill('sales')}>
                    <span aria-hidden="true">↗</span>
                    <span>{drillType === 'sales' ? 'Hide Sales' : 'View Sales'}</span>
                  </ActionButton>
                </div>
              </div>
              {drillType === 'sales' ? renderDrillRows('sales') : null}

              <div className="gst-divider" />

              <div className="gst-calc-block">
                <DataRow
                  label="GST Input Credit (ITC)"
                  note={`Paid to suppliers on purchases. CGST ₹${fmt(summary.purchases.cgst)} + SGST ₹${fmt(summary.purchases.sgst)} + IGST ₹${fmt(summary.purchases.igst)}`}
                  value={`₹${fmt(gstITC)}`}
                  valueTone="ui-value-secondary"
                />
                <div className="gst-action-row">
                  <ActionButton className="gst-drill-button" variant="primary" onClick={() => openDrill('purchases')}>
                    <span aria-hidden="true">↘</span>
                    <span>{drillType === 'purchases' ? 'Hide Purchases' : 'View Purchases'}</span>
                  </ActionButton>
                </div>
              </div>
              {drillType === 'purchases' ? renderDrillRows('purchases') : null}

              {gstITC === 0 ? (
                <div className="gst-warning-banner">
                  <span className="gst-warning-icon" aria-hidden="true">⚠️</span>
                  <span>No ITC claimed - you may be overpaying tax</span>
                </div>
              ) : null}

              <div className="gst-net-highlight">
                <div className="gst-net-highlight-label">{isPayable ? 'Net GST Payable' : 'Excess ITC Available'}</div>
                <div className={`gst-net-highlight-value ${isPayable ? 'is-payable' : 'is-favorable'}`}>
                  ₹{fmt(isPayable ? payableTotal : excessCreditTotal)}
                </div>
                <div className="gst-net-highlight-note">Remaining position after ITC set-off</div>
              </div>
            </Card>

            <Card className="gst-gstr-card" title="GSTR-3B Summary">
              <div className="ui-table-wrap gst-gstr-table-wrap">
                <table className="ui-table gst-gstr-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>CGST</th>
                      <th style={{ textAlign: 'right' }}>SGST</th>
                      <th style={{ textAlign: 'right' }}>IGST</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Output (Sales)</td>
                      <td>₹{fmt(summary.sales.cgst)}</td>
                      <td>₹{fmt(summary.sales.sgst)}</td>
                      <td>₹{fmt(summary.sales.igst)}</td>
                      <td className={summary.sales.total_gst > 0 ? 'gst-total-payable' : 'gst-total-favorable'}>₹{fmt(summary.sales.total_gst)}</td>
                    </tr>
                    <tr>
                      <td>Input / ITC (Purchase)</td>
                      <td>₹{fmt(summary.purchases.cgst)}</td>
                      <td>₹{fmt(summary.purchases.sgst)}</td>
                      <td>₹{fmt(summary.purchases.igst)}</td>
                      <td className={summary.purchases.total_gst > 0 ? 'gst-total-favorable' : 'gst-total-neutral'}>₹{fmt(summary.purchases.total_gst)}</td>
                    </tr>
                    <tr className="gst-gstr-final-row">
                      <td>{isPayable ? 'Payable After ITC Set-Off' : 'Unused ITC / Nil Liability'}</td>
                      <td>₹{fmt(isPayable ? payableByHead.cgst : excessCredit.cgst)}</td>
                      <td>₹{fmt(isPayable ? payableByHead.sgst : excessCredit.sgst)}</td>
                      <td>₹{fmt(isPayable ? payableByHead.igst : excessCredit.igst)}</td>
                      <td className={isPayable ? 'gst-total-payable' : 'gst-total-favorable'}>₹{fmt(isPayable ? payableTotal : excessCreditTotal)}</td>
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
    </Layout>
  );
}

