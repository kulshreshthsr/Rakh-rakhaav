function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getShopName() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.shopName || 'हमारी दुकान';
  } catch {
    return 'हमारी दुकान';
  }
}

export function generatePartyStatementHTML(party, entries = []) {
  const isCustomer = party.totalSales !== undefined;
  const shopName = getShopName();
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const sorted = [...entries].sort(
    (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
  );

  const rows = sorted.map((e) => {
    const isDebit = e.type === 'debit' || e.type === 'diya';
    const date = new Date(e.date || e.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const bal = parseFloat(e.running_balance || 0);
    return `
      <tr>
        <td class="cell">${date}</td>
        <td class="cell desc">${e.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}</td>
        <td class="cell ref">${e.reference_id || '—'}</td>
        <td class="cell amt ${isDebit ? 'debit' : 'credit'}">${isDebit ? '+' : '-'}₹${fmt(e.amount)}</td>
        <td class="cell bal ${bal > 0 ? 'debit' : 'credit'}">₹${fmt(bal)}</td>
      </tr>`;
  }).join('');

  const emptyRow = `<tr><td colspan="5" style="text-align:center;padding:32px 0;color:#94a3b8;font-size:14px;">कोई transaction नहीं मिली</td></tr>`;

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Statement — ${party.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#1e293b;font-size:14px}
.page{max-width:780px;margin:0 auto;padding:32px 24px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap;gap:16px}
.shop-name{font-size:22px;font-weight:900;color:#0f172a}
.subtitle{font-size:12px;color:#64748b;margin-top:4px}
.print-date{text-align:right;font-size:12px;color:#94a3b8}
.print-date b{display:block;color:#1e293b;font-size:13px}
.party-card{background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:28px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px;border:1px solid #e2e8f0}
.party-name{font-size:20px;font-weight:900;color:#0f172a;margin-bottom:4px}
.party-meta{font-size:12px;color:#64748b;margin-top:3px}
.balances{display:flex;gap:24px;flex-wrap:wrap}
.bal-block{text-align:right}
.bal-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8}
.bal-value{font-size:22px;font-weight:900;margin-top:2px}
.rose{color:#e11d48} .emerald{color:#059669} .slate{color:#475569}
table{width:100%;border-collapse:collapse}
thead tr{background:#f8fafc}
th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:2px solid #e2e8f0}
th.right{text-align:right}
.cell{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;vertical-align:top}
.cell.desc{color:#1e293b;font-weight:500}
.cell.ref{font-family:monospace;font-size:12px;color:#94a3b8}
.cell.amt{font-weight:700;text-align:right}
.cell.bal{font-weight:700;text-align:right}
.cell.debit{color:#e11d48}
.cell.credit{color:#059669}
.footer{margin-top:32px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px}
.gen-by{font-size:11px;color:#94a3b8}
.closing-label{font-size:12px;color:#64748b;margin-bottom:4px}
.closing-amount{font-size:26px;font-weight:900}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page{padding:16px 12px}
}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="shop-name">${shopName}</div>
      <div class="subtitle">Account Statement</div>
    </div>
    <div class="print-date">Printed on<b>${today}</b></div>
  </div>

  <div class="party-card">
    <div>
      <div class="party-name">${party.name}</div>
      <div class="slate" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${isCustomer ? 'Customer' : 'Supplier'}</div>
      ${party.phone ? `<div class="party-meta">📞 ${party.phone}</div>` : ''}
      ${party.gstin ? `<div class="party-meta" style="font-family:monospace">GSTIN: ${party.gstin}</div>` : ''}
      ${party.address ? `<div class="party-meta">📍 ${party.address}</div>` : ''}
    </div>
    <div class="balances">
      <div class="bal-block">
        <div class="bal-label">Opening</div>
        <div class="bal-value slate">₹${fmt(party.opening_balance)}</div>
      </div>
      <div class="bal-block">
        <div class="bal-label">${isCustomer ? 'Total Sales' : 'Total Purchased'}</div>
        <div class="bal-value slate">₹${fmt(isCustomer ? party.totalSales : party.totalPurchased)}</div>
      </div>
      <div class="bal-block">
        <div class="bal-label">Paid</div>
        <div class="bal-value emerald">₹${fmt(party.totalPaid)}</div>
      </div>
      <div class="bal-block">
        <div class="bal-label">Balance Due</div>
        <div class="bal-value ${(party.totalUdhaar || 0) > 0 ? 'rose' : 'emerald'}">₹${fmt(party.totalUdhaar)}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Reference</th>
        <th class="right">Amount</th>
        <th class="right">Balance</th>
      </tr>
    </thead>
    <tbody>${rows || emptyRow}</tbody>
  </table>

  <div class="footer">
    <div class="gen-by">Generated by Rakh-Rakhaav &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN')}</div>
    <div style="text-align:right">
      <div class="closing-label">Closing Balance</div>
      <div class="closing-amount ${(party.totalUdhaar || 0) > 0 ? 'rose' : 'emerald'}">₹${fmt(party.totalUdhaar)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
