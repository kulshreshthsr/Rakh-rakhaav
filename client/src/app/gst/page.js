'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_HI = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);

const thStyle = {
  padding: '10px 14px',
  textAlign: 'right',
  fontWeight: 800,
  fontSize: 11,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '11px 14px',
  textAlign: 'right',
  fontSize: 12.5,
  color: 'var(--text-2)',
  whiteSpace: 'nowrap',
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

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchSummary();
  }, [month, year]);

  const fetchSummary = async () => {
    setLoading(true);
    setDrillType(null);
    try {
      const res = await fetch(`${API}/api/sales/gst-summary?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      setSummary(await res.json());
    } catch {}
    setLoading(false);
  };

  const openDrill = async (type) => {
    if (drillType === type) {
      setDrillType(null);
      return;
    }

    setDrillType(type);
    setDrillLoading(true);

    const from = new Date(year, month - 1, 1).toISOString();
    const to = new Date(year, month, 0, 23, 59, 59).toISOString();

    try {
      const url =
        type === 'sales'
          ? `${API}/api/sales?from=${from}&to=${to}`
          : `${API}/api/purchases?from=${from}&to=${to}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setDrillData(type === 'sales' ? (data.sales || data) : (data.purchases || data));
    } catch {}
    setDrillLoading(false);
  };

  const buildGSTR1CSV = () => {
    const rows = [
      ['GSTR-1 B2B Invoices'],
      ['Invoice No','Date','Buyer Name','Buyer GSTIN','Taxable Amount','GST Rate%','CGST','SGST','IGST','Total'],
      ...summary.gstr1.b2b_invoices.map((i) => [
        i.invoice_number,
        new Date(i.date).toLocaleDateString('en-IN'),
        i.buyer_name || '',
        i.buyer_gstin || '',
        fmt(i.taxable_amount),
        i.gst_rate + '%',
        fmt(i.cgst),
        fmt(i.sgst),
        fmt(i.igst),
        fmt(i.total),
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
    return rows.map((r) => r.join(',')).join('\n');
  };

  const buildGSTR3BCSV = () => {
    const rows = [
      ['GSTR-3B Summary'],
      ['Month/Year', `${MONTHS[month - 1]} ${year}`],
      [''],
      ['Description', 'Amount (Rs)'],
      ['GST Collected (Output)', fmt(summary.gstr3b.output_gst)],
      ['GST Input Credit (ITC)', fmt(summary.gstr3b.input_gst)],
      ['Net GST Payable', fmt(summary.gstr3b.net_payable)],
      ['Outward Taxable Sales', fmt(summary.gstr3b.outward_taxable)],
      [''],
      ['Sales Breakup'],
      ['Total Sales', fmt(summary.sales.total_amount)],
      ['CGST Collected', fmt(summary.sales.cgst)],
      ['SGST Collected', fmt(summary.sales.sgst)],
      ['IGST Collected', fmt(summary.sales.igst)],
      [''],
      ['Purchase Breakup'],
      ['Total Purchases', fmt(summary.purchases.taxable_amount)],
      ['CGST Input', fmt(summary.purchases.cgst)],
      ['SGST Input', fmt(summary.purchases.sgst)],
      ['IGST Input', fmt(summary.purchases.igst)],
    ];
    return rows.map((r) => r.join(',')).join('\n');
  };

  const exportCSV = (type) => {
    if (!summary) return;
    const csv = type === 'gstr1' ? buildGSTR1CSV() : buildGSTR3BCSV();
    const filename =
      type === 'gstr1'
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
      gstr1Folder.file('gstr1.csv', buildGSTR1CSV());
      gstr1Folder.file(
        'gstr1.json',
        JSON.stringify(
          {
            period: { month: MONTHS[month - 1], year },
            b2b_invoices: summary.gstr1.b2b_invoices,
            b2c_summary: summary.gstr1.b2c_summary,
            sales_totals: {
              total_amount: summary.sales.total_amount,
              taxable: summary.sales.taxable_amount,
              cgst: summary.sales.cgst,
              sgst: summary.sales.sgst,
              igst: summary.sales.igst,
              total_gst: summary.sales.total_gst,
              b2b_count: summary.sales.b2b_count,
              b2c_count: summary.sales.b2c_count,
              b2b_taxable: summary.sales.b2b_taxable,
              b2c_taxable: summary.sales.b2c_taxable,
            },
          },
          null,
          2
        )
      );

      const gstr3bFolder = zip.folder('GSTR3B');
      gstr3bFolder.file('gstr3b.csv', buildGSTR3BCSV());
      gstr3bFolder.file(
        'gstr3b.json',
        JSON.stringify(
          {
            period: { month: MONTHS[month - 1], year },
            gstr3b: summary.gstr3b,
            purchases: {
              total_amount: summary.purchases.total_amount,
              taxable: summary.purchases.taxable_amount,
              cgst: summary.purchases.cgst,
              sgst: summary.purchases.sgst,
              igst: summary.purchases.igst,
              total_gst: summary.purchases.total_gst,
            },
            net_payable: summary.gstr3b.net_payable,
            output_gst: summary.gstr3b.output_gst,
            input_gst: summary.gstr3b.input_gst,
          },
          null,
          2
        )
      );

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
  const monthHi = MONTHS_HI[month - 1];
  const monthEn = MONTHS[month - 1];
  const isPayable = netPayable > 0;
  const isRefund = netPayable < 0;

  const returnStatus = summary
    ? summary.sales.total > 0
      ? { ok: true, msg: '✅ Return दाखिल करने के लिए तैयार / Ready to file' }
      : { ok: false, msg: '⚠️ इस महीने कोई sales नहीं / No sales this month' }
    : null;

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <div className="page-title" style={{ marginBottom: 6 }}>
            GST सारांश
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 660 }}>
            Premium tax overview for output GST, ITC, GSTR summaries, invoice classification, and CA-ready exports.
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #312E81 0%, #4F46E5 46%, #0F172A 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(79,70,229,0.22)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -20,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: 120,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.16), transparent 70%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(260px, 0.8fr)',
            gap: 18,
          }}
          className="gst-hero-grid"
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: 14,
              }}
            >
              <span>🧾</span>
              <span>{monthEn} {year} tax cycle</span>
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.08,
                fontFamily: 'var(--font-display)',
                marginBottom: 10,
              }}
            >
              GST position with clarity and control
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.82)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              Review payable tax, input credits, B2B/B2C split, invoice-level drilldowns, and return-ready exports in one view.
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 22,
              padding: '18px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 700 }}>
              Net Position
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8 }}>
              ₹{fmt(Math.abs(netPayable))}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              {isPayable ? 'GST payable this cycle' : isRefund ? 'Refund / extra credit' : 'No net payable'}
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Output GST
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>₹{fmt(gstCollected)}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  ITC
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>₹{fmt(gstITC)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 20,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '16px 18px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          महीना:
        </div>

        <select
          className="form-input"
          style={{ minWidth: 180, flex: 'none' }}
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>
              {MONTHS_HI[i]} / {m}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          style={{ minWidth: 110, flex: 'none' }}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {[2023, 2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-4)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: '#4F46E5',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            लोड हो रहा है...
          </div>
        )}
      </div>

      {!summary ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '72px 24px',
            color: 'var(--text-4)',
          }}
        >
          <div style={{ fontSize: 54, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-2)', marginBottom: 6 }}>
            Loading GST data...
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: 'Output GST',
                value: `₹${fmt(gstCollected)}`,
                sub: 'Collected from sales',
                tone: '#16A34A',
                soft: '#F0FDF4',
                icon: '📈',
              },
              {
                label: 'Input Tax Credit',
                value: `₹${fmt(gstITC)}`,
                sub: 'Claimable from purchases',
                tone: '#4338CA',
                soft: '#EEF2FF',
                icon: '🛒',
              },
              {
                label: 'Net GST',
                value: `₹${fmt(Math.abs(netPayable))}`,
                sub: isPayable ? 'Tax payable' : isRefund ? 'Refund / credit' : 'No payable',
                tone: isPayable ? '#D97706' : '#16A34A',
                soft: isPayable ? '#FFFBEB' : '#F0FDF4',
                icon: '⚖️',
              },
              {
                label: 'B2B Invoices',
                value: `${summary.sales.b2b_count}`,
                sub: 'Invoices with GSTIN',
                tone: '#7C3AED',
                soft: '#F5F3FF',
                icon: '🏢',
              },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: card.soft,
                  borderRadius: 22,
                  padding: '18px',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    marginBottom: 12,
                  }}
                >
                  {card.icon}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {card.label}
                </div>
                <div style={{ marginTop: 8, fontSize: 25, fontWeight: 800, color: card.tone, letterSpacing: '-0.04em' }}>
                  {card.value}
                </div>
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-4)' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: isPayable ? '#FEF2F2' : isRefund ? '#F0FDF4' : '#FFFFFF',
              border: `1.5px solid ${isPayable ? '#FECACA' : isRefund ? '#BBF7D0' : 'var(--border-soft)'}`,
              borderRadius: 24,
              padding: '22px 22px 20px',
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: isPayable ? '#EF4444' : isRefund ? '#22C55E' : '#4F46E5',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 38 }}>{isPayable ? '⚠️' : isRefund ? '🎉' : '✅'}</div>
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: isPayable ? '#991B1B' : isRefund ? '#166534' : 'var(--text)',
                      lineHeight: 1.25,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {isPayable
                      ? `${monthHi} ${year}: ₹${fmt(netPayable)} GST भरना है`
                      : isRefund
                      ? `${monthHi} ${year}: ₹${fmt(Math.abs(netPayable))} GST वापस मिलेगा`
                      : `${monthHi} ${year}: कोई GST देय नहीं`}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6 }}>
                    {isPayable
                      ? `${monthEn} ${year}: Pay ₹${fmt(netPayable)} GST`
                      : isRefund
                      ? `${monthEn} ${year}: GST refund ₹${fmt(Math.abs(netPayable))}`
                      : `${monthEn} ${year}: No GST payable`}
                  </div>

                  {returnStatus && (
                    <div
                      style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: returnStatus.ok ? '#DCFCE7' : '#FEF3C7',
                        color: returnStatus.ok ? '#166534' : '#92400E',
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {returnStatus.msg}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  minWidth: 220,
                  padding: '16px',
                  borderRadius: 20,
                  background: '#fff',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Summary
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Output GST</span>
                    <strong style={{ color: '#16A34A' }}>₹{fmt(gstCollected)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>ITC</span>
                    <strong style={{ color: '#4338CA' }}>₹{fmt(gstITC)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 800 }}>Net</span>
                    <strong style={{ color: isPayable ? '#D97706' : '#16A34A' }}>₹{fmt(Math.abs(netPayable))}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
              gap: 16,
              marginBottom: 20,
            }}
            className="gst-main-grid"
          >
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    GST Calculation
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                    Click any block to drill down into invoices and purchase bills
                  </div>
                </div>
              </div>

              <div
                onClick={() => openDrill('sales')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 16px',
                  background: drillType === 'sales' ? '#DCFCE7' : '#F0FDF4',
                  borderRadius: 18,
                  marginBottom: 12,
                  cursor: 'pointer',
                  border: `1.5px solid ${drillType === 'sales' ? '#86EFAC' : 'transparent'}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#166534' }}>
                    GST वसूला (Output)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                    CGST ₹{fmt(summary.sales.cgst)} + SGST ₹{fmt(summary.sales.sgst)} + IGST ₹{fmt(summary.sales.igst)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>+₹{fmt(gstCollected)}</div>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginTop: 4 }}>
                    {drillType === 'sales' ? '▲ Close' : '▼ Open'}
                  </div>
                </div>
              </div>

              {drillType === 'sales' && (
                <div
                  style={{
                    background: '#F0FDF4',
                    borderRadius: 18,
                    padding: 12,
                    marginBottom: 12,
                    overflowX: 'auto',
                    border: '1px solid #DCFCE7',
                  }}
                >
                  {drillLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>
                      ⏳ लोड हो रहा है...
                    </div>
                  ) : drillData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>
                      इस महीने कोई sales नहीं
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#DCFCE7' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Invoice</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                          <th style={thStyle}>Taxable</th>
                          <th style={thStyle}>GST</th>
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillData.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #D1FAE5' }}>
                            <td style={{ ...tdStyle, textAlign: 'left', color: '#4338CA', fontWeight: 700 }}>
                              {s.invoice_number}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                              {s.product_name || (s.items?.length > 1 ? `${s.items.length} items` : s.items?.[0]?.product_name)}
                            </td>
                            <td style={tdStyle}>₹{fmt(s.taxable_amount)}</td>
                            <td style={{ ...tdStyle, color: '#16A34A', fontWeight: 800 }}>₹{fmt(s.total_gst)}</td>
                            <td style={{ ...tdStyle, fontWeight: 800 }}>₹{fmt(s.total_amount)}</td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  background: s.invoice_type === 'B2B' ? '#EEF2FF' : '#DCFCE7',
                                  color: s.invoice_type === 'B2B' ? '#4338CA' : '#166534',
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                {s.invoice_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <div
                onClick={() => openDrill('purchases')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 16px',
                  background: drillType === 'purchases' ? '#DBEAFE' : '#EFF6FF',
                  borderRadius: 18,
                  marginBottom: 12,
                  cursor: 'pointer',
                  border: `1.5px solid ${drillType === 'purchases' ? '#93C5FD' : 'transparent'}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1D4ED8' }}>
                    GST Input Credit (ITC)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                    CGST ₹{fmt(summary.purchases.cgst)} + SGST ₹{fmt(summary.purchases.sgst)} + IGST ₹{fmt(summary.purchases.igst)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#2563EB' }}>−₹{fmt(gstITC)}</div>
                  <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, marginTop: 4 }}>
                    {drillType === 'purchases' ? '▲ Close' : '▼ Open'}
                  </div>
                </div>
              </div>

              {drillType === 'purchases' && (
                <div
                  style={{
                    background: '#EFF6FF',
                    borderRadius: 18,
                    padding: 12,
                    marginBottom: 12,
                    overflowX: 'auto',
                    border: '1px solid #DBEAFE',
                  }}
                >
                  {drillLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>
                      ⏳ लोड हो रहा है...
                    </div>
                  ) : drillData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 20 }}>
                      इस महीने कोई purchases नहीं
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#DBEAFE' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Bill No</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Supplier</th>
                          <th style={thStyle}>Taxable</th>
                          <th style={thStyle}>ITC</th>
                          <th style={thStyle}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillData.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #DBEAFE' }}>
                            <td style={{ ...tdStyle, textAlign: 'left', color: '#B45309', fontWeight: 700 }}>
                              {p.invoice_number}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                              {p.product_name || (p.items?.length > 1 ? `${p.items.length} items` : p.items?.[0]?.product_name)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>{p.supplier_name || '—'}</td>
                            <td style={tdStyle}>₹{fmt(p.taxable_amount)}</td>
                            <td style={{ ...tdStyle, color: '#2563EB', fontWeight: 800 }}>₹{fmt(p.total_gst)}</td>
                            <td style={{ ...tdStyle, fontWeight: 800 }}>₹{fmt(p.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {gstITC === 0 && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 16,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: '#92400E',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ कोई ITC claim नहीं — ज़्यादा tax भर रहे हैं / No ITC claimed
                </div>
              )}

              <div
                style={{
                  marginTop: 14,
                  padding: '16px',
                  borderRadius: 18,
                  background: isPayable ? '#FEF2F2' : isRefund ? '#F0FDF4' : '#F8FAFC',
                  border: `1px solid ${isPayable ? '#FECACA' : isRefund ? '#BBF7D0' : 'var(--border-soft)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: isPayable ? '#991B1B' : isRefund ? '#166534' : 'var(--text)' }}>
                      {isRefund ? 'Net Refund / Credit' : 'Net GST Position'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                      ₹{fmt(gstCollected)} − ₹{fmt(gstITC)} = ₹{fmt(netPayable)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: isPayable ? '#DC2626' : isRefund ? '#16A34A' : 'var(--text)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    ₹{fmt(Math.abs(netPayable))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  B2B / B2C Split
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Sales classification for GSTR-1
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 18,
                      background: '#EEF2FF',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#4338CA' }}>🏢 B2B</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
                      {summary.sales.b2b_count}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                      Taxable ₹{fmt(summary.sales.b2b_taxable)}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 18,
                      background: '#F0FDF4',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>👤 B2C</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
                      {summary.sales.b2c_count}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                      Taxable ₹{fmt(summary.sales.b2c_taxable)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  Export for CA
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>
                  Download return-ready summaries and supporting data
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => exportCSV('gstr1')}
                    style={{
                      padding: '11px 14px',
                      background: '#F0FDF4',
                      color: '#15803D',
                      border: '1px solid #BBF7D0',
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      textAlign: 'left',
                    }}
                  >
                    📊 GSTR-1 CSV
                  </button>

                  <button
                    onClick={() => exportCSV('gstr3b')}
                    style={{
                      padding: '11px 14px',
                      background: '#EEF2FF',
                      color: '#4338CA',
                      border: '1px solid #C7D2FE',
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      textAlign: 'left',
                    }}
                  >
                    📊 GSTR-3B CSV
                  </button>

                  <button
                    onClick={exportJSON}
                    style={{
                      padding: '11px 14px',
                      background: '#FFF7ED',
                      color: '#C2410C',
                      border: '1px solid #FED7AA',
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      textAlign: 'left',
                    }}
                  >
                    📦 GST JSON Export
                  </button>

                  <button
                    onClick={exportZIP}
                    disabled={zipping}
                    className={zipping ? '' : 'btn-primary'}
                    style={{
                      padding: '11px 14px',
                      background: zipping ? 'var(--surface-3)' : undefined,
                      color: zipping ? 'var(--text-4)' : undefined,
                      fontSize: 13,
                      cursor: zipping ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {zipping ? '⏳ बना रहे हैं...' : '🗜️ Download ZIP (GSTR1 + GSTR3B)'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 14 }}>
              GSTR-3B सारांश
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>विवरण / Description</th>
                    <th style={thStyle}>CGST</th>
                    <th style={thStyle}>SGST</th>
                    <th style={thStyle}>IGST</th>
                    <th style={thStyle}>कुल / Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#F0FDF4' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: '#166534' }}>📈 Output (Sales)</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.cgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.sgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.sales.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#16A34A' }}>₹{fmt(summary.sales.total_gst)}</td>
                  </tr>

                  <tr style={{ background: '#EFF6FF' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: '#1D4ED8' }}>🛒 Input / ITC (Purchase)</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.cgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.sgst)}</td>
                    <td style={tdStyle}>₹{fmt(summary.purchases.igst)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: '#2563EB' }}>₹{fmt(summary.purchases.total_gst)}</td>
                  </tr>

                  <tr style={{ background: isPayable ? '#FEF2F2' : '#F0FDF4', borderTop: '2px solid var(--border-soft)' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: isPayable ? '#991B1B' : '#166534' }}>
                      {isPayable ? '💸 Net Payable' : '💰 Net Refund'}
                    </td>
                    <td style={tdStyle}>₹{fmt((summary.sales.cgst || 0) - (summary.purchases.cgst || 0))}</td>
                    <td style={tdStyle}>₹{fmt((summary.sales.sgst || 0) - (summary.purchases.sgst || 0))}</td>
                    <td style={tdStyle}>₹{fmt((summary.sales.igst || 0) - (summary.purchases.igst || 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 900, fontSize: 15, color: isPayable ? '#DC2626' : '#16A34A' }}>
                      ₹{fmt(Math.abs(netPayable))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {summary.gstr1.b2b_invoices.length === 0 ? (
            <div
              className="card"
              style={{
                marginBottom: 20,
                textAlign: 'center',
                padding: '32px 24px',
                color: 'var(--text-4)',
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 800, color: 'var(--text-2)', marginBottom: 4 }}>
                कोई B2B Invoice नहीं
              </div>
              <div style={{ fontSize: 12.5 }}>
                Sales में customer GSTIN add करें to classify invoices as B2B
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 12, fontFamily: 'var(--font-display)' }}>
                B2B Invoices — GSTR-1 के लिए
              </div>

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
                        <td>
                          <span
                            style={{
                              color: '#4338CA',
                              fontWeight: 800,
                              background: '#EEF2FF',
                              padding: '4px 9px',
                              borderRadius: 999,
                              fontSize: 12,
                            }}
                          >
                            {inv.invoice_number}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{inv.buyer_name || '—'}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{inv.buyer_gstin}</td>
                        <td>₹{fmt(inv.taxable_amount)}</td>
                        <td>
                          <span
                            style={{
                              background: '#EEF2FF',
                              color: '#4338CA',
                              padding: '4px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {inv.gst_rate}%
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: '#16A34A' }}>₹{fmt(inv.total)}</td>
                        <td>
                          <span
                            style={{
                              background: '#F5F3FF',
                              color: '#7C3AED',
                              padding: '4px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {inv.gst_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="show-xs" style={{ flexDirection: 'column', gap: 10 }}>
                {summary.gstr1.b2b_invoices.map((inv, i) => (
                  <div key={i} className="card" style={{ borderLeft: '4px solid #4F46E5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, color: '#4338CA', fontSize: 13 }}>{inv.invoice_number}</div>
                      <div style={{ fontWeight: 800, color: '#16A34A' }}>₹{fmt(inv.total)}</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{inv.buyer_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>
                      GSTIN: {inv.buyer_gstin} • GST {inv.gst_rate}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>
              B2C सारांश / Summary
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginBottom: 14 }}>
              सामान्य ग्राहक — बिना GSTIN
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              {[
                { label: 'Invoices', value: summary.gstr1.b2c_summary.count, color: 'var(--text)' },
                { label: 'Taxable', value: `₹${fmt(summary.gstr1.b2c_summary.taxable_amount)}`, color: 'var(--text)' },
                { label: 'GST', value: `₹${fmt(summary.gstr1.b2c_summary.total_gst)}`, color: '#4338CA' },
                { label: 'Total', value: `₹${fmt(summary.gstr1.b2c_summary.total_amount)}`, color: '#16A34A' },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px',
                    borderRadius: 18,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 900px) {
          .gst-hero-grid,
          .gst-main-grid {
            grid-template-columns: 1fr !important;
          }
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
