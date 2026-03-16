'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, sales: 0, purchases: 0, revenue: 0, spent: 0, gstCollected: 0, gstPaid: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [pRes, sRes, puRes] = await Promise.all([
        fetch('https://rakh-rakhaav.onrender.com/api/products', { headers }),
        fetch('https://rakh-rakhaav.onrender.com/api/sales', { headers }),
        fetch('https://rakh-rakhaav.onrender.com/api/purchases', { headers }),
      ]);
      const products = await pRes.json();
      const sales = await sRes.json();
      const purchases = await puRes.json();

      setAllSales(sales);
      setAllPurchases(purchases);

      const revenue = sales.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const spent = purchases.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
      const gstCollected = sales.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);
      const gstPaid = purchases.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);

      setStats({ products: products.length, sales: sales.length, purchases: purchases.length, revenue, spent, gstCollected, gstPaid });
      setLowStock(products.filter(p => p.quantity <= 5));

      const sd = {};
      sales.forEach(s => {
        const d = new Date(s.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        sd[d] = (sd[d] || 0) + parseFloat(s.total_amount || 0);
      });
      setSalesData(Object.entries(sd).map(([date, amount]) => ({ date, amount })));

      const pd = {};
      purchases.forEach(p => {
        const d = new Date(p.purchased_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        pd[d] = (pd[d] || 0) + parseFloat(p.total_amount || 0);
      });
      setPurchaseData(Object.entries(pd).map(([date, amount]) => ({ date, amount })));
    } catch (err) { console.error(err); }
  };

  const profit = stats.revenue - stats.spent;
  const netGST = stats.gstCollected - stats.gstPaid;

  // ── CSV Export ──
  const exportCSV = (type) => {
    let rows, filename;
    if (type === 'sales') {
      rows = [
        ['Invoice No', 'Product', 'HSN', 'Qty', 'Price/Unit', 'Taxable', 'GST Rate', 'CGST', 'SGST', 'IGST', 'Total GST', 'Total', 'Buyer', 'Buyer GSTIN', 'Date'],
        ...allSales.map(s => [s.invoice_number, s.product_name, s.hsn_code || '', s.quantity, s.price_per_unit, s.taxable_amount, s.gst_rate, s.cgst_amount, s.sgst_amount, s.igst_amount, s.total_gst, s.total_amount, s.buyer_name || '', s.buyer_gstin || '', new Date(s.sold_at).toLocaleDateString('en-IN')])
      ];
      filename = 'sales_report.csv';
    } else {
      rows = [
        ['Bill No', 'Product', 'HSN', 'Qty', 'Price/Unit', 'Taxable', 'GST Rate', 'CGST', 'SGST', 'IGST', 'Total GST', 'Total', 'Supplier', 'Supplier GSTIN', 'Date'],
        ...allPurchases.map(p => [p.invoice_number, p.product_name, p.hsn_code || '', p.quantity, p.price_per_unit, p.taxable_amount, p.gst_rate, p.cgst_amount, p.sgst_amount, p.igst_amount, p.total_gst, p.total_amount, p.supplier_name || '', p.supplier_gstin || '', new Date(p.purchased_at).toLocaleDateString('en-IN')])
      ];
      filename = 'purchases_report.csv';
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ──
  const exportPDF = (type) => {
    const win = window.open('', '_blank');
    const data = type === 'sales' ? allSales : allPurchases;
    const title = type === 'sales' ? 'Sales Report' : 'Purchases Report';
    const totalAmount = data.reduce((s, x) => s + parseFloat(x.total_amount || 0), 0);
    const totalGST = data.reduce((s, x) => s + parseFloat(x.total_gst || 0), 0);

    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#333;font-size:13px}
        h1{color:#6366f1;font-size:22px;margin-bottom:4px}
        .subtitle{color:#9ca3af;font-size:12px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280}
        td{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px}
        .summary{display:flex;gap:32px;margin-bottom:24px;flex-wrap:wrap}
        .summary-item{background:#f9f9f7;padding:12px 16px;border-radius:10px;min-width:140px}
        .summary-label{font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase}
        .summary-value{font-size:20px;font-weight:700;margin-top:2px}
        .green{color:#059669} .red{color:#dc2626} .purple{color:#6366f1}
        .footer{margin-top:32px;text-align:center;color:#9ca3af;font-size:11px}
      </style></head>
      <body>
        <h1>रखरखाव — ${title}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        <div class="summary">
          <div class="summary-item"><div class="summary-label">Total Records</div><div class="summary-value purple">${data.length}</div></div>
          <div class="summary-item"><div class="summary-label">Total Amount</div><div class="summary-value ${type === 'sales' ? 'green' : 'red'}">₹${totalAmount.toFixed(2)}</div></div>
          <div class="summary-item"><div class="summary-label">Total GST</div><div class="summary-value purple">₹${totalGST.toFixed(2)}</div></div>
          <div class="summary-item"><div class="summary-label">Taxable Amount</div><div class="summary-value">₹${(totalAmount - totalGST).toFixed(2)}</div></div>
        </div>
        <table>
          <thead><tr>
            <th>Invoice</th><th>Product</th><th>HSN</th><th>Qty</th>
            <th>Taxable</th><th>GST%</th><th>GST Amt</th><th>Total</th>
            <th>${type === 'sales' ? 'Buyer' : 'Supplier'}</th><th>Date</th>
          </tr></thead>
          <tbody>
            ${data.map(item => `<tr>
              <td style="color:#6366f1;font-weight:600">${item.invoice_number || '—'}</td>
              <td style="font-weight:600">${item.product_name}</td>
              <td style="color:#9ca3af">${item.hsn_code || '—'}</td>
              <td>${item.quantity}</td>
              <td>₹${item.taxable_amount?.toFixed(2) || item.total_amount}</td>
              <td>${item.gst_rate > 0 ? item.gst_rate + '%' : '—'}</td>
              <td>${item.total_gst > 0 ? '₹' + item.total_gst?.toFixed(2) : '—'}</td>
              <td style="font-weight:700;color:${type === 'sales' ? '#059669' : '#d97706'}">₹${item.total_amount?.toFixed(2)}</td>
              <td style="color:#9ca3af">${(type === 'sales' ? item.buyer_name : item.supplier_name) || '—'}</td>
              <td style="color:#9ca3af">${new Date(type === 'sales' ? item.sold_at : item.purchased_at).toLocaleDateString('en-IN')}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f9f9f7;font-weight:700">
              <td colspan="4">TOTAL</td>
              <td>₹${(totalAmount - totalGST).toFixed(2)}</td>
              <td>—</td>
              <td>₹${totalGST.toFixed(2)}</td>
              <td style="color:${type === 'sales' ? '#059669' : '#d97706'}">₹${totalAmount.toFixed(2)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">रखरखाव Inventory Management • ${new Date().getFullYear()}</div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  return (
    <Layout>
      <div className="page-title">Dashboard</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Products', value: stats.products, color: '#6366f1' },
          { label: 'Sales', value: stats.sales, color: '#10b981' },
          { label: 'Purchases', value: stats.purchases, color: '#f59e0b' },
          { label: 'Revenue', value: `₹${stats.revenue.toFixed(0)}`, color: '#10b981' },
          { label: 'Amount Spent', value: `₹${stats.spent.toFixed(0)}`, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Profit card */}
      <div style={{
        background: profit >= 0 ? '#f0fdf4' : '#fef2f2',
        border: `1.5px solid ${profit >= 0 ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9ca3af' }}>Net Profit</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, color: profit >= 0 ? '#059669' : '#dc2626' }}>
            {profit >= 0 ? '+' : ''}₹{profit.toFixed(2)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>REVENUE</div><div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>₹{stats.revenue.toFixed(2)}</div></div>
          <div><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>SPENT</div><div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>₹{stats.spent.toFixed(2)}</div></div>
        </div>
      </div>

      {/* GST Summary */}
      {(stats.gstCollected > 0 || stats.gstPaid > 0) && (
        <div style={{
          background: '#ede9fe', border: '1.5px solid #c4b5fd',
          borderRadius: 16, padding: '20px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#7c3aed' }}>GST Liability</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: netGST >= 0 ? '#6d28d9' : '#059669' }}>
              {netGST >= 0 ? 'Pay ' : 'Refund '}₹{Math.abs(netGST).toFixed(2)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>GST COLLECTED</div><div style={{ fontSize: 18, fontWeight: 700, color: '#6d28d9' }}>₹{stats.gstCollected.toFixed(2)}</div></div>
            <div><div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>GST INPUT CREDIT</div><div style={{ fontSize: 18, fontWeight: 700, color: '#6d28d9' }}>₹{stats.gstPaid.toFixed(2)}</div></div>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📤 Export Reports</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => exportCSV('sales')} style={{ padding: '8px 16px', background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📊 Sales CSV</button>
          <button onClick={() => exportCSV('purchases')} style={{ padding: '8px 16px', background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📊 Purchases CSV</button>
          <button onClick={() => exportPDF('sales')} style={{ padding: '8px 16px', background: '#eef2ff', color: '#6366f1', border: '1.5px solid #c7d2fe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📄 Sales PDF</button>
          <button onClick={() => exportPDF('purchases')} style={{ padding: '8px 16px', background: '#eef2ff', color: '#6366f1', border: '1.5px solid #c7d2fe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📄 Purchases PDF</button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <a href="/product" style={{ background: '#6366f1', color: '#fff', padding: '10px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>+ Add Product</a>
        <a href="/sales" style={{ background: '#10b981', color: '#fff', padding: '10px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>+ Record Sale</a>
        <a href="/purchases" style={{ background: '#f59e0b', color: '#fff', padding: '10px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>+ Record Purchase</a>
      </div>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>Low Stock Alert</span>
            <span style={{ background: '#fcd34d', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{lowStock.length} items</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map(p => (
              <div key={p._id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#92400e' }}>{p.name}</span>
                <span style={{ color: '#d97706', marginLeft: 8 }}>{p.quantity} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 16 }}>📈 Sales Over Time</div>
          {salesData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={v => `₹${v}`} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 16 }}>📉 Purchases Over Time</div>
          {purchaseData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>No purchase data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={purchaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={v => `₹${v}`} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
}