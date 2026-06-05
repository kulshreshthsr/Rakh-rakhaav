/**
 * generateInvoice.js — Config-driven Dynamic Invoice Engine (Patch 5)
 *
 * Exports:
 *   getInvoiceConfig(businessConfig)  → merged invoice config
 *   generateInvoiceHTML(sale, shop, businessConfig, autoPrint, suggestedFileName, templateId)
 *
 * templateId: 'detailed' (default, existing behaviour) | 'minimal' | 'gst_tax'
 * Defaults to 'detailed' so all existing call-sites need zero changes.
 */

/* ─── Helpers ──────────────────────────────────────────────────────── */
const fmt = (n) => Number(n || 0).toFixed(2);
const INR = '&#8377;';

const STATE_CODE_BY_NAME = {
  'andaman & nicobar islands':'35','andhra pradesh':'37','arunachal pradesh':'12','assam':'18',
  'bihar':'10','chandigarh':'04','chhattisgarh':'22','dadra & nagar haveli and daman & diu':'26',
  'delhi':'07','goa':'30','gujarat':'24','haryana':'06','himachal pradesh':'02','jammu & kashmir':'01',
  'jharkhand':'20','karnataka':'29','kerala':'32','ladakh':'38','lakshadweep':'31','madhya pradesh':'23',
  'maharashtra':'27','manipur':'14','meghalaya':'17','mizoram':'15','nagaland':'13','odisha':'21',
  'puducherry':'34','punjab':'03','rajasthan':'08','sikkim':'11','tamil nadu':'33','telangana':'36',
  'tripura':'16','uttar pradesh':'09','uttarakhand':'05','west bengal':'19',
};

function getStateCode(stateName = '', gstin = '') {
  const gstCode = String(gstin || '').slice(0, 2);
  if (/^\d{2}$/.test(gstCode)) return gstCode;
  return STATE_CODE_BY_NAME[(stateName || '').trim().toLowerCase()] || '';
}

function getRoundedBillValues(amount) {
  const n = Number(amount || 0);
  const rounded = Math.round(n);
  return { roundedTotal: rounded, roundOff: parseFloat((rounded - n).toFixed(2)) };
}

function buildTaxSummaryRows(saleItems, isIGST) {
  const grouped = saleItems.reduce((acc, item) => {
    const rate = Number(item.gst_rate || 0);
    const key = String(rate);
    if (!acc[key]) acc[key] = { rate, cgst: 0, sgst: 0, igst: 0 };
    acc[key].cgst += Number(item.cgst_amount || 0);
    acc[key].sgst += Number(item.sgst_amount || 0);
    acc[key].igst += Number(item.igst_amount || 0);
    return acc;
  }, {});
  return Object.values(grouped).sort((a, b) => a.rate - b.rate).map((g) =>
    isIGST
      ? `<tr><td>IGST @ ${g.rate}%</td><td>${INR}${fmt(g.igst)}</td></tr>`
      : `<tr><td>CGST @ ${(g.rate / 2).toFixed(1)}%</td><td>${INR}${fmt(g.cgst)}</td></tr>`
        + `<tr><td>SGST @ ${(g.rate / 2).toFixed(1)}%</td><td>${INR}${fmt(g.sgst)}</td></tr>`
  ).join('');
}

function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = (n) => {
    if (n < 20)       return ones[n];
    if (n < 100)      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000)     return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000)   return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);
  return convert(rupees) + ' Rupees' + (paise ? ' and ' + convert(paise) + ' Paise' : '') + ' Only';
}

/* ─── Invoice Config Defaults ─────────────────────────────────────── */
const BASE_INVOICE_CONFIG = {
  documentTitle:    'Tax Invoice',
  documentSubtitle: 'Original For Recipient',
  accentColor:      '#111827',
  showPrescriptionBlock: false,
  showTableBlock:        false,
  showVehicleBlock:      false,
  showJobBlock:          false,
  showBatchColumns:  false,
  showVariantColumns:false,
  showSerialColumn:  false,
  showHsnColumn:     true,
  showGstColumns:    true,
  itemSectionTitle:  'Items',
  showSignatureBlock: true,
  footerNote:         '',
};

export function getInvoiceConfig(config = {}) {
  return { ...BASE_INVOICE_CONFIG, ...(config.invoiceConfig || {}) };
}

/* ─── Context Block Builders ─────────────────────────────────────── */
function cell(label, value, accent) {
  if (!value) return '';
  return `<div class="ctx-cell"><div class="ctx-label" style="color:${accent}">${label}</div><div class="ctx-value">${value}</div></div>`;
}
function contextBlock(title, cells, accent) {
  const filled = cells.filter(Boolean);
  if (!filled.length) return '';
  const cols = Math.min(filled.length, 4);
  return `<div class="ctx-block"><div class="ctx-title" style="color:${accent};border-color:${accent}20">${title}</div>`
    + `<div class="ctx-row" style="grid-template-columns:repeat(${cols},1fr)">${filled.join('')}</div></div>`;
}
function buildPrescriptionBlock(ef, accent) {
  return contextBlock('Prescription Details', [cell('Rx / Prescription No.', ef.prescription_no, accent), cell("Doctor's Name", ef.doctor_name, accent)], accent);
}
function buildTableBlock(ef, accent) {
  return contextBlock('Order Details', [cell('Table No.', ef.table_no, accent), cell('Covers / Guests', ef.cover_count, accent), cell('Waiter / Staff', ef.waiter_name, accent), cell('Order Type', ef.order_type || (ef.table_no ? 'Dine-in' : 'Takeaway'), accent)], accent);
}
function buildVehicleBlock(ef, accent) {
  return contextBlock('Vehicle Details', [cell('Vehicle Number', ef.vehicle_no, accent), cell('Vehicle Model', ef.vehicle_model, accent), cell('KM Reading', ef.km_reading ? ef.km_reading + ' km' : '', accent), cell('Mechanic', ef.mechanic_name, accent)], accent);
}
function buildJobBlock(ef, accent) {
  return contextBlock('Job / Service Details', [cell('Job / Ref No.', ef.job_no || ef.serial_no, accent), cell('Device / Model', ef.device_model, accent), cell('Technician', ef.technician || ef.mechanic_name, accent), cell('Delivery Date', ef.delivery_date, accent)], accent);
}

/* ─── MINIMAL Template (58mm thermal) ──────────────────────────────── */
function buildMinimalHTML(sale, shop, autoPrint) {
  const shopName  = shop?.name?.trim() || 'My Shop';
  const saleItems = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ product_name: sale.product_name, quantity: sale.quantity, price_per_unit: sale.price_per_unit, total_amount: sale.total_amount }];
  const saleDate  = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const payLabel  = { cash: 'Cash', upi: 'UPI', bank: 'Bank Transfer', credit: 'Credit/Udhaar' }[sale.payment_type] || 'Paid';
  const roundedBill = getRoundedBillValues(sale.total_amount);
  const hasGst = saleItems.some(i => Number(i.gst_rate || 0) > 0);

  const rows = saleItems.map(item =>
    `<tr>
      <td style="padding:2px 0;font-size:11px">${item.product_name}</td>
      <td style="padding:2px 0;text-align:center;font-size:11px">${item.quantity}</td>
      <td style="padding:2px 0;text-align:right;font-size:11px;white-space:nowrap">&#8377;${fmt(item.price_per_unit)}</td>
      <td style="padding:2px 0;text-align:right;font-size:11px;font-weight:bold;white-space:nowrap">&#8377;${fmt(item.total_amount)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Bill - ${sale.invoice_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:10px;color:#111;background:#fff;width:280px;padding:6px}
.center{text-align:center}
.right{text-align:right}
.bold{font-weight:bold}
.dashed{border-bottom:1px dashed #555;margin:5px 0}
table{width:100%;border-collapse:collapse}
th{font-size:9px;padding:2px 0;border-bottom:1px solid #333}
@media print{@page{margin:0;size:80mm auto}body{width:72mm;padding:4px}}
</style></head>
<body>
<div class="center bold" style="font-size:16px;margin-bottom:2px">${shopName}</div>
${shop.address ? `<div class="center" style="font-size:9px">${shop.address}</div>` : ''}
${shop.phone ? `<div class="center" style="font-size:9px">Ph: ${shop.phone}</div>` : ''}
${shop.gstin ? `<div class="center" style="font-size:9px">GSTIN: ${shop.gstin}</div>` : ''}
<div class="dashed"></div>
<div style="font-size:10px">Invoice: <span class="bold">${sale.invoice_number}</span></div>
<div style="font-size:10px">Date: ${saleDate}</div>
<div style="font-size:10px">Customer: ${sale.buyer_name || 'Walk-in'}</div>
${sale.buyer_phone ? `<div style="font-size:10px">Ph: ${sale.buyer_phone}</div>` : ''}
<div class="dashed"></div>
<table>
  <thead><tr>
    <th style="text-align:left">Item</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:right">Amt</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="dashed"></div>
${hasGst ? `<div class="right" style="font-size:10px">Taxable: &#8377;${fmt(sale.taxable_amount)}</div><div class="right" style="font-size:10px">GST: &#8377;${fmt(sale.total_gst)}</div>` : ''}
<div class="right bold" style="font-size:13px;margin-top:3px">Total: &#8377;${fmt(sale.total_amount)}</div>
<div class="right" style="font-size:10px">Rounded: &#8377;${roundedBill.roundedTotal}</div>
<div style="font-size:10px;margin-top:3px">Payment: ${payLabel}</div>
<div class="dashed"></div>
<div class="center" style="font-size:9px;margin-top:4px">Thank you for your purchase!</div>
<div class="center" style="font-size:8px;margin-top:2px;color:#555">Powered by Rakh-Rakhaav</div>
${autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : ''}
</body></html>`;
}

/* ─── GST TAX INVOICE Template (govt-compliant) ─────────────────────── */
function buildGstTaxHTML(sale, shop, config, autoPrint, suggestedFileName) {
  const inv    = getInvoiceConfig(config);
  const ef     = (sale.extra_fields && typeof sale.extra_fields === 'object') ? sale.extra_fields : {};
  const accent = inv.accentColor || '#111827';

  const shopDisplayName = shop?.name?.trim() || 'My Shop';
  const saleItems = (sale.items && sale.items.length > 0) ? sale.items
    : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity,
         price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate,
         taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount,
         sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount,
         gst_type: sale.gst_type, total_amount: sale.total_amount }];

  const isIGST     = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate   = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const roundedBill = getRoundedBillValues(sale.total_amount);
  const placeOfSupplyCode  = getStateCode(sale.buyer_state, sale.buyer_gstin);
  const sellerStateCode    = getStateCode(shop.state, shop.gstin);
  const placeOfSupplyLabel = sale.buyer_state
    ? `${sale.buyer_state}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}` : 'Not specified';
  const payLabel = { cash: 'CASH', upi: 'UPI', bank: 'BANK', credit: 'CREDIT' }[sale.payment_type] || 'PAID';
  const payBg = sale.payment_type === 'cash' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)';

  const getMeta = (item) => {
    const m = item.item_metadata;
    if (!m || typeof m !== 'object') return {};
    return m;
  };

  const itemRows = saleItems.map((item, idx) => {
    const gstCells = isIGST
      ? `<td style="text-align:center">${item.gst_rate || 0}%</td><td>${INR}${fmt(item.igst_amount)}</td>`
      : `<td style="text-align:center">${((item.gst_rate || 0) / 2).toFixed(1)}%</td><td>${INR}${fmt(item.cgst_amount)}</td><td style="text-align:center">${((item.gst_rate || 0) / 2).toFixed(1)}%</td><td>${INR}${fmt(item.sgst_amount)}</td>`;
    return `<tr>
      <td>${idx + 1}</td>
      <td style="text-align:left"><strong>${item.product_name}</strong></td>
      <td>${item.hsn_code || '—'}</td>
      <td>${item.quantity}</td>
      <td>${INR}${fmt(item.price_per_unit)}</td>
      <td>${INR}${fmt(item.taxable_amount)}</td>
      ${gstCells}
      <td><strong>${INR}${fmt(item.total_amount)}</strong></td>
    </tr>`;
  }).join('');

  const taxRows = buildTaxSummaryRows(saleItems, isIGST);
  const discAmt  = Number(sale.discount_amount || 0);
  const discRow  = discAmt > 0 ? `<tr style="color:#16a34a"><td>Discount</td><td>- ${INR}${fmt(discAmt)}</td></tr>` : '';

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#111827;background:#fff}
    .invoice{max-width:820px;margin:0 auto;padding:18px;border:2px solid #111827}
    .header{display:grid;grid-template-columns:1.45fr .95fr;border:1.5px solid #111827}
    .header-left,.header-right{padding:14px 16px;min-height:110px}
    .header-left{border-right:1.5px solid #111827}
    .header-right{background:${accent};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
    .brand-tag{display:inline-block;padding:8px 14px;border:1.5px solid #111827;font-size:20px;font-weight:900;color:#111827;background:#f8fafc;margin-bottom:10px}
    .shop-line{font-size:11px;line-height:1.55;color:#374151;margin-top:6px}
    .invoice-title{font-size:20px;font-weight:900;letter-spacing:.14em;color:#fff;text-transform:uppercase}
    .invoice-copy{font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.75);text-transform:uppercase}
    .pay-chip{display:inline-block;padding:4px 14px;border:1px solid rgba(255,255,255,.35);border-radius:999px;font-size:10px;font-weight:800;color:#fff;background:${payBg}}
    .info-grid{display:grid;grid-template-columns:repeat(5,1fr);border:1.5px solid #111827;border-top:none}
    .info-cell{padding:8px 10px}.info-cell + .info-cell{border-left:1.5px solid #111827}
    .label{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin-bottom:4px}
    .value{font-size:11px;font-weight:700;color:#111827;line-height:1.4}
    .party-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}
    .party-box{padding:12px 14px;min-height:100px}.party-box + .party-box{border-left:1.5px solid #111827}
    .party-name{font-size:13px;font-weight:800;color:#111827;margin-bottom:4px}
    .party-detail{font-size:11px;line-height:1.55;color:#374151}
    .items-wrap{border:1.5px solid #111827;border-top:none}
    table{width:100%;border-collapse:collapse}
    thead th{padding:6px 5px;font-size:9px;font-weight:800;text-transform:uppercase;color:#111827;background:#f8fafc;border-bottom:1.5px solid #111827}
    th + th,td + td{border-left:1px solid #111827}
    tbody td,tfoot td{padding:6px 5px;font-size:10px;text-align:center;vertical-align:top}
    td:nth-child(2),th:nth-child(2){text-align:left}
    tfoot td{font-weight:800;background:#fafafa}
    .summary-grid{display:grid;grid-template-columns:1.15fr .85fr;border:1.5px solid #111827;border-top:none}
    .summary-box{padding:12px 14px;min-height:120px}.summary-box + .summary-box{border-left:1.5px solid #111827}
    .words-copy{font-size:11px;line-height:1.7;color:#1f2937;font-weight:600;font-style:italic;margin-top:6px}
    .amount-table{width:100%;border-collapse:collapse}
    .amount-table td{padding:3px 0;border:none!important;font-size:11px}
    .amount-table td:last-child{text-align:right;font-weight:700}
    .amount-grand td{padding-top:8px;font-size:14px;font-weight:900;border-top:1.5px solid #111827!important}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}
    .footer-box{padding:12px 14px;min-height:100px}.footer-box + .footer-box{border-left:1.5px solid #111827}
    .signature-block{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:right}
    .signature-space{height:40px}.signature-line{font-size:11px;font-weight:800}
    .footer-mark{margin-top:10px;text-align:center;font-size:10px;color:#6b7280}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}
  `;

  const gstTh = isIGST
    ? '<th>IGST%</th><th>IGST ₹</th>'
    : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>';

  const gstFooter = isIGST
    ? `<td></td><td>${INR}${fmt(sale.igst_amount)}</td>`
    : `<td></td><td>${INR}${fmt(sale.cgst_amount)}</td><td></td><td>${INR}${fmt(sale.sgst_amount)}</td>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>GST Tax Invoice - ${sale.invoice_number}</title>
<style>${css}</style></head><body>
<div class="invoice">
  <div class="header">
    <div class="header-left">
      <div class="brand-tag">${shopDisplayName}</div>
      ${shop.address ? `<div class="shop-line">${shop.address}${shop.state ? ', ' + shop.state : ''}</div>` : ''}
      ${shop.phone ? `<div class="shop-line">Ph: ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div class="shop-line"><strong>GSTIN:</strong> ${shop.gstin} &nbsp; <strong>State Code:</strong> ${sellerStateCode}</div>` : ''}
    </div>
    <div class="header-right" style="text-align:center">
      <div class="invoice-title">TAX INVOICE</div>
      <div class="invoice-copy">Original for Recipient</div>
      <span class="pay-chip">${payLabel}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-cell"><div class="label">Invoice No</div><div class="value">${sale.invoice_number}</div></div>
    <div class="info-cell"><div class="label">Invoice Date</div><div class="value">${saleDate}</div></div>
    <div class="info-cell"><div class="label">Place Of Supply</div><div class="value">${placeOfSupplyLabel}</div></div>
    <div class="info-cell"><div class="label">Reverse Charge</div><div class="value">No</div></div>
    <div class="info-cell"><div class="label">IRN</div><div class="value" style="font-size:9px;font-family:monospace">${sale.irn || '(Not Generated)'}</div></div>
  </div>

  <div class="party-grid">
    <div class="party-box">
      <div class="label">Bill From (Supplier)</div>
      <div class="party-name">${shopDisplayName}</div>
      ${shop.address ? `<div class="party-detail">${shop.address}${shop.state ? ', ' + shop.state : ''}</div>` : ''}
      ${shop.phone ? `<div class="party-detail">Ph: ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div class="party-detail">GSTIN: ${shop.gstin}</div>` : ''}
    </div>
    <div class="party-box">
      <div class="label">Bill To (Recipient)</div>
      <div class="party-name">${sale.buyer_name || 'Walk-in Customer'}</div>
      ${sale.buyer_address ? `<div class="party-detail">${sale.buyer_address}</div>` : ''}
      ${sale.buyer_state   ? `<div class="party-detail">State: ${sale.buyer_state}</div>` : ''}
      ${sale.buyer_phone   ? `<div class="party-detail">Ph: ${sale.buyer_phone}</div>` : ''}
      ${sale.buyer_gstin   ? `<div class="party-detail">GSTIN: ${sale.buyer_gstin}</div>` : ''}
    </div>
  </div>

  <div class="items-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:30px">Sr</th>
          <th>Description of Goods/Services</th>
          <th style="width:72px">HSN/SAC</th>
          <th style="width:48px">Qty</th>
          <th style="width:80px">Rate ${INR}</th>
          <th style="width:88px">Taxable ${INR}</th>
          ${gstTh}
          <th style="width:88px">Amount ${INR}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5" style="text-align:right;padding-right:10px">Total</td>
          <td>${INR}${fmt(sale.taxable_amount)}</td>
          ${gstFooter}
          <td>${INR}${fmt(sale.total_amount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">Amount in Words</div>
      <div class="words-copy">${numberToWords(parseFloat(sale.total_amount || 0))}</div>
      ${sale.notes ? `<div style="margin-top:8px;font-size:10px;color:#6b7280"><strong>Notes:</strong> ${sale.notes}</div>` : ''}
    </div>
    <div class="summary-box">
      <div class="label">Tax Summary</div>
      <table class="amount-table">
        ${discRow}
        <tr><td>Taxable Amount</td><td>${INR}${fmt(sale.taxable_amount)}</td></tr>
        ${taxRows}
        <tr><td>Total Tax</td><td>${INR}${fmt(sale.total_gst)}</td></tr>
        <tr class="amount-grand"><td>Grand Total</td><td>${INR}${fmt(sale.total_amount)}</td></tr>
      </table>
    </div>
  </div>

  <div class="footer-grid">
    <div class="footer-box">
      <div style="font-size:9px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:6px">Declaration</div>
      <div style="font-size:10px;color:#374151;line-height:1.5">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
    </div>
    <div class="footer-box">
      <div class="signature-block">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px">For <strong>${shopDisplayName}</strong></div>
        <div class="signature-space"></div>
        <div class="signature-line">Authorised Signatory</div>
        <div style="font-size:9px;color:#6b7280;margin-top:4px">This is a computer generated invoice</div>
      </div>
    </div>
  </div>

  <div class="footer-mark">Grow your business with — रखरखाव</div>
</div>
${autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : ''}
</body></html>`;
}

/* ─── DETAILED Template (existing behaviour — no regression) ───────── */
function buildDetailedHTML(sale, shop, config, autoPrint, suggestedFileName) {
  const inv  = getInvoiceConfig(config);
  const ef   = (sale.extra_fields && typeof sale.extra_fields === 'object') ? sale.extra_fields : {};
  const accent = inv.accentColor || '#111827';

  const shopDisplayName = shop?.name?.trim() || 'My Shop';
  const saleItems = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ product_name: sale.product_name, hsn_code: sale.hsn_code, quantity: sale.quantity,
         price_per_unit: sale.price_per_unit, gst_rate: sale.gst_rate,
         taxable_amount: sale.taxable_amount, cgst_amount: sale.cgst_amount,
         sgst_amount: sale.sgst_amount, igst_amount: sale.igst_amount,
         gst_type: sale.gst_type, total_amount: sale.total_amount }];

  const isIGST     = sale.gst_type === 'IGST' || saleItems.some(i => i.gst_type === 'IGST');
  const saleDate   = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const roundedBill = getRoundedBillValues(sale.total_amount);

  const placeOfSupplyCode  = getStateCode(sale.buyer_state, sale.buyer_gstin);
  const sellerStateCode    = getStateCode(shop.state, shop.gstin);
  const placeOfSupplyLabel = sale.buyer_state
    ? `${sale.buyer_state}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}` : 'Not specified';

  const payBg    = sale.payment_type === 'cash' ? 'rgba(255,255,255,0.2)' : sale.payment_type === 'upi' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const payLabel = { cash: 'CASH', upi: 'UPI', bank: 'BANK', credit: 'CREDIT' }[sale.payment_type] || 'PAID';

  const useBatch   = !!inv.showBatchColumns;
  const useVariant = !!inv.showVariantColumns;
  const useSerial  = !!inv.showSerialColumn;
  const useHsn     = inv.showHsnColumn !== false;
  const useGst     = inv.showGstColumns !== false;

  const thExtra = [
    useBatch   ? '<th style="width:70px">Batch</th><th style="width:72px">Expiry</th>' : '',
    useVariant ? '<th style="width:50px">Size</th><th style="width:60px">Color</th>' : '',
    useSerial  ? '<th style="width:110px">Serial / IMEI</th>' : '',
  ].join('');
  const thHsn     = useHsn ? '<th style="width:78px">HSN/SAC</th>' : '';
  const thTaxable = useGst ? `<th style="width:94px">Taxable ${INR}</th>` : '';
  const thGst     = useGst
    ? (isIGST ? '<th>IGST%</th><th>IGST ₹</th>' : '<th>CGST%</th><th>CGST ₹</th><th>SGST%</th><th>SGST ₹</th>')
    : '';

  const footerColspan = 2
    + (useBatch ? 2 : 0)
    + (useVariant ? 2 : 0)
    + (useSerial ? 1 : 0)
    + (useHsn ? 1 : 0)
    + 2;

  const colSpan = footerColspan
    + (useGst ? 1 : 0)
    + (useGst ? (isIGST ? 2 : 4) : 0)
    + 1;

  const getMeta = (item) => {
    const m = item.item_metadata;
    if (!m || typeof m !== 'object') return {};
    return m;
  };

  const formatExpiry = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const itemRows = saleItems.map((item, idx) => {
    const meta = getMeta(item);
    const batchNo  = meta.batch_no  || meta.batch_number || '';
    const expiry   = formatExpiry(meta.expiry_date) || '';
    const size     = meta.size  || '';
    const color    = meta.color || '';
    const serialStr= Array.isArray(meta.serial_ids)
      ? meta.serial_ids.slice(0, 2).join(', ')
      : (meta.serial_no || meta.imei || meta.imei_number || '');

    const extraCells = [
      useBatch   ? `<td>${batchNo || '—'}</td><td style="white-space:nowrap">${expiry || '—'}</td>` : '',
      useVariant ? `<td>${size || '—'}</td><td>${color || '—'}</td>` : '',
      useSerial  ? `<td style="font-family:monospace;font-size:9px;word-break:break-all">${serialStr || '—'}</td>` : '',
    ].join('');

    const hsnCell     = useHsn ? `<td>${item.hsn_code || '—'}</td>` : '';
    const taxableCell = useGst ? `<td>${INR}${fmt(item.taxable_amount)}</td>` : '';
    const gstCells    = useGst
      ? (isIGST
          ? `<td>${item.gst_rate || 0}%</td><td>${INR}${fmt(item.igst_amount)}</td>`
          : `<td>${((item.gst_rate || 0) / 2).toFixed(1)}%</td><td>${INR}${fmt(item.cgst_amount)}</td><td>${((item.gst_rate || 0) / 2).toFixed(1)}%</td><td>${INR}${fmt(item.sgst_amount)}</td>`)
      : '';
    const subNote = item.item_notes ? `<br/><span style="font-size:9px;color:#6b7280;font-weight:400">${item.item_notes}</span>` : '';

    return `<tr>
      <td>${idx + 1}</td>
      <td style="text-align:left"><strong>${item.product_name}</strong>${subNote}</td>
      ${extraCells}${hsnCell}
      <td>${item.quantity}${item.unit ? `<br/><span style="font-size:9px;color:#9ca3af">${item.unit}</span>` : ''}</td>
      <td>${INR}${fmt(item.price_per_unit)}</td>
      ${taxableCell}${gstCells}
      <td><strong>${INR}${fmt(item.total_amount)}</strong></td>
    </tr>`;
  }).join('');

  const emptyCell  = `<td style="height:18px"></td>`;
  const fillerRows = Array(Math.max(0, 5 - saleItems.length)).fill(`<tr>${emptyCell.repeat(colSpan)}</tr>`).join('');

  const footerTaxable = useGst ? `<td>${INR}${fmt(sale.taxable_amount)}</td>` : '';
  const footerGst     = useGst
    ? (isIGST
        ? `<td></td><td>${INR}${fmt(sale.igst_amount)}</td>`
        : `<td></td><td>${INR}${fmt(sale.cgst_amount)}</td><td></td><td>${INR}${fmt(sale.sgst_amount)}</td>`)
    : '';

  const amountSummaryRows = useGst ? buildTaxSummaryRows(saleItems, isIGST) : '';

  let contextHTML = '';
  if (inv.showPrescriptionBlock) contextHTML = buildPrescriptionBlock(ef, accent);
  else if (inv.showTableBlock)   contextHTML = buildTableBlock(ef, accent);
  else if (inv.showVehicleBlock) contextHTML = buildVehicleBlock(ef, accent);
  else if (inv.showJobBlock)     contextHTML = buildJobBlock(ef, accent);

  const bankHTML = shop.bank_name
    ? `<div style="font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:6px">Bank Details</div>`
      + `<div style="font-size:11px;margin-bottom:3px">Bank: <strong>${shop.bank_name}</strong></div>`
      + (shop.bank_branch  ? `<div style="font-size:11px;margin-bottom:3px">Branch: <strong>${shop.bank_branch}</strong></div>`  : '')
      + (shop.bank_account ? `<div style="font-size:11px;margin-bottom:3px">A/C: <strong>${shop.bank_account}</strong></div>`    : '')
      + (shop.bank_ifsc    ? `<div style="font-size:11px">IFSC: <strong>${shop.bank_ifsc}</strong></div>`                        : '')
    : `<div style="color:#9ca3af;font-size:11px;font-style:italic">Add bank details in Profile</div>`;

  const termsHTML = shop.terms
    ? `<div class="terms-box"><div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Terms &amp; Conditions</div>`
      + `<div style="font-size:10px;color:#374151">${shop.terms.split('\n').map((t, i) => (i + 1) + '. ' + t).join('<br/>')}</div></div>`
    : '';

  const footerNoteHTML = inv.footerNote
    ? `<div style="border:1.5px solid #e5e7eb;border-top:none;padding:8px 14px;font-size:10px;color:#6b7280;font-style:italic;background:#fafafa">${inv.footerNote}</div>`
    : '';

  const pdfBanner = suggestedFileName && !autoPrint
    ? `<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#166534;display:flex;align-items:center;gap:8px">`
      + `<span style="font-size:18px">PDF</span>`
      + `<div><strong>Save as PDF:</strong> Press <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:11px">Ctrl+P</kbd> → Change destination to <strong>"Save as PDF"</strong> → Save as <strong>${suggestedFileName}</strong><br/>`
      + `<span style="font-size:11px;opacity:.8">Then attach this PDF file on WhatsApp</span></div></div>`
    : '';

  const discAmt = Number(sale.discount_amount || 0);
  const discLabel = sale.discount_type === 'percent'
    ? `Discount (${sale.discount_value}%)` : sale.discount_type === 'flat' ? 'Discount (Flat)' : '';
  const discRow = discAmt > 0 ? `<tr style="color:#16a34a"><td>${discLabel}</td><td>- ${INR}${fmt(discAmt)}</td></tr>` : '';

  const amountSection = useGst
    ? (discAmt > 0 ? `<tr><td>Subtotal</td><td>${INR}${fmt((sale.taxable_amount || 0) + discAmt)}</td></tr>` : '')
      + discRow
      + `<tr><td>Taxable Amount</td><td>${INR}${fmt(sale.taxable_amount)}</td></tr>`
      + amountSummaryRows
      + `<tr><td>Total GST</td><td>${INR}${fmt(sale.total_gst)}</td></tr>`
      + `<tr><td>Round Off</td><td>${roundedBill.roundOff >= 0 ? '+' : ''}${INR}${fmt(roundedBill.roundOff)}</td></tr>`
      + `<tr class="amount-grand"><td>Grand Total</td><td>${INR}${fmt(sale.total_amount)}</td></tr>`
      + `<tr class="amount-rounded"><td>Rounded Total</td><td>${INR}${fmt(roundedBill.roundedTotal)}</td></tr>`
    : discRow
      + `<tr class="amount-grand"><td>Total</td><td>${INR}${fmt(sale.total_amount)}</td></tr>`
      + `<tr class="amount-rounded"><td>Rounded</td><td>${INR}${fmt(roundedBill.roundedTotal)}</td></tr>`;

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;font-size:11px;color:#111827;background:#fff}
    .invoice{max-width:820px;margin:0 auto;padding:18px;border:2px solid #111827}
    .header{display:grid;grid-template-columns:1.45fr .95fr;border:1.5px solid #111827}
    .header-left,.header-right{padding:14px 16px;min-height:120px}
    .header-left{border-right:1.5px solid #111827}
    .header-right{background:${accent};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
    .brand-tag{display:inline-block;max-width:100%;padding:8px 14px;border:1.5px solid #111827;font-size:20px;font-weight:900;color:#111827;background:#f8fafc;margin-bottom:10px;line-height:1.2;word-break:break-word}
    .shop-line{font-size:11px;line-height:1.55;color:#374151;margin-top:6px}
    .invoice-title{font-size:20px;font-weight:900;letter-spacing:.14em;text-align:center;color:#fff;text-transform:uppercase}
    .invoice-copy{font-size:10px;letter-spacing:.1em;text-align:center;color:rgba(255,255,255,.75);text-transform:uppercase}
    .pay-chip{display:inline-block;padding:4px 14px;border:1px solid rgba(255,255,255,.35);border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.15)}
    .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;border:1.5px solid #111827;border-top:none}
    .info-cell{padding:9px 12px;min-height:52px}.info-cell + .info-cell{border-left:1.5px solid #111827}
    .label{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin-bottom:5px}
    .value{font-size:12px;font-weight:700;color:#111827;line-height:1.4}
    .party-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}
    .party-box{padding:12px 14px;min-height:116px}.party-box + .party-box{border-left:1.5px solid #111827}
    .party-name{font-size:14px;font-weight:800;color:#111827;margin-bottom:5px}
    .party-detail{font-size:11px;line-height:1.55;color:#374151}
    .ctx-block{border:1.5px solid #111827;border-top:none;background:#fafafa}
    .ctx-title{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:6px 14px;border-bottom:1px solid #e5e7eb}
    .ctx-row{display:grid;padding:2px 0}
    .ctx-cell{padding:7px 14px}.ctx-cell + .ctx-cell{border-left:1px solid #e5e7eb}
    .ctx-label{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
    .ctx-value{font-size:12px;font-weight:700;color:#111827}
    .section-title{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;padding:6px 14px;background:#f8fafc;border-bottom:1.5px solid #111827;border:1.5px solid #111827;border-top:none}
    .items-wrap{border:1.5px solid #111827;border-top:none}
    table{width:100%;border-collapse:collapse}
    thead th{padding:7px 6px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#111827;background:#f8fafc;border-bottom:1.5px solid #111827}
    th + th,td + td{border-left:1px solid #111827}
    tbody td,tfoot td{padding:7px 6px;font-size:11px;text-align:center;vertical-align:top}
    td:nth-child(2),th:nth-child(2){text-align:left}
    tbody td{min-height:24px}
    tfoot td{font-weight:800;background:#fafafa}
    .summary-grid{display:grid;grid-template-columns:1.15fr .85fr;border:1.5px solid #111827;border-top:none}
    .summary-box{padding:12px 14px;min-height:130px}.summary-box + .summary-box{border-left:1.5px solid #111827}
    .words-copy{font-size:11px;line-height:1.7;color:#1f2937;font-weight:600;font-style:italic;margin-top:6px}
    .amount-table{width:100%;border-collapse:collapse}
    .amount-table td{padding:4px 0;border:none!important;font-size:11px}
    .amount-table td:last-child{text-align:right;font-weight:700}
    .amount-grand td{padding-top:10px;font-size:15px;font-weight:900;border-top:1.5px solid #111827!important}
    .amount-rounded td{padding-top:4px;font-size:12px;font-weight:800;color:${accent}}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111827;border-top:none}
    .footer-box{padding:12px 14px;min-height:110px}.footer-box + .footer-box{border-left:1.5px solid #111827}
    .signature-block{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:right}
    .signature-space{height:44px}.signature-line{font-size:11px;font-weight:800;color:#111827}
    .signature-note{font-size:10px;line-height:1.5;color:#6b7280;margin-top:5px}
    .terms-box{border:1.5px solid #111827;border-top:none;padding:10px 14px}
    .footer-mark{margin-top:10px;text-align:center;font-size:10px;letter-spacing:.02em;color:#6b7280;font-family:"Noto Sans Devanagari","Mangal","Segoe UI",Arial,sans-serif}
    @media print{.pdf-banner{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{border:none;padding:0}}
  `;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${inv.documentTitle} - ${sale.invoice_number}</title>
<style>${css}</style></head><body>
<div class="pdf-banner" style="max-width:820px;margin:0 auto 0">${pdfBanner}</div>
<div class="invoice">
  <div class="header">
    <div class="header-left">
      <div class="brand-tag">${shopDisplayName}</div>
      ${shop.address ? `<div class="shop-line">${shop.address}${shop.city ? ', ' + shop.city : ''}${shop.state ? ', ' + shop.state : ''}${shop.pincode ? ' — ' + shop.pincode : ''}</div>` : ''}
      ${(shop.phone || shop.email) ? `<div class="shop-line">${shop.phone ? 'Phone: ' + shop.phone : ''}${shop.phone && shop.email ? ' | ' : ''}${shop.email ? shop.email : ''}</div>` : ''}
      ${shop.gstin ? `<div class="shop-line"><strong>GSTIN:</strong> ${shop.gstin}</div>` : ''}
      ${shop.state ? `<div class="shop-line"><strong>State Code:</strong> ${sellerStateCode || 'N/A'}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="invoice-title">${inv.documentTitle}</div>
      <div class="invoice-copy">${inv.documentSubtitle}</div>
      <span class="pay-chip">${payLabel}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-cell"><div class="label">Invoice No</div><div class="value">${sale.invoice_number}</div></div>
    <div class="info-cell"><div class="label">Invoice Date</div><div class="value">${saleDate}</div></div>
    <div class="info-cell"><div class="label">Invoice Type</div><div class="value">${sale.invoice_type || 'B2C'} / ${isIGST ? 'IGST' : 'CGST+SGST'}</div></div>
    <div class="info-cell"><div class="label">Place Of Supply</div><div class="value">${placeOfSupplyLabel}</div></div>
  </div>
  <div class="party-grid">
    <div class="party-box">
      <div class="label">Bill From</div>
      <div class="party-name">${shopDisplayName}</div>
      ${shop.address ? `<div class="party-detail">${shop.address}${shop.city ? ', ' + shop.city : ''}${shop.state ? ', ' + shop.state : ''}${shop.pincode ? ' — ' + shop.pincode : ''}</div>` : ''}
      ${shop.phone ? `<div class="party-detail">Phone: ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div class="party-detail">GSTIN: ${shop.gstin}</div>` : ''}
    </div>
    <div class="party-box">
      <div class="label">Bill To</div>
      <div class="party-name">${sale.buyer_name || 'Walk-in Customer'}</div>
      ${sale.buyer_address ? `<div class="party-detail">${sale.buyer_address}</div>` : ''}
      ${sale.buyer_state   ? `<div class="party-detail">State: ${sale.buyer_state}</div>` : ''}
      ${sale.buyer_phone   ? `<div class="party-detail">Phone: ${sale.buyer_phone}</div>` : ''}
      ${sale.buyer_gstin   ? `<div class="party-detail">GSTIN: ${sale.buyer_gstin}</div>` : ''}
    </div>
  </div>
  ${contextHTML}
  ${inv.itemSectionTitle !== 'Items' ? `<div class="section-title">${inv.itemSectionTitle}</div>` : ''}
  <div class="items-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:34px">Sr</th>
          <th>Particulars</th>
          ${thExtra}
          ${thHsn}
          <th style="width:52px">Qty</th>
          <th style="width:88px">Rate ${INR}</th>
          ${thTaxable}
          ${thGst}
          <th style="width:96px">Amount ${INR}</th>
        </tr>
      </thead>
      <tbody>${itemRows}${fillerRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="${footerColspan}" style="text-align:right;padding-right:12px">Total</td>
          ${footerTaxable}${footerGst}
          <td>${INR}${fmt(sale.total_amount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">Amount In Words</div>
      <div class="words-copy">${numberToWords(parseFloat(sale.total_amount || 0))}</div>
      ${sale.notes ? `<div style="margin-top:10px;font-size:10px;color:#6b7280"><strong>Notes:</strong> ${sale.notes}</div>` : ''}
    </div>
    <div class="summary-box">
      <div class="label">Amount Summary</div>
      <table class="amount-table">${amountSection}</table>
    </div>
  </div>
  <div class="footer-grid">
    <div class="footer-box">${bankHTML}</div>
    ${inv.showSignatureBlock
      ? `<div class="footer-box"><div class="signature-block">
           <div style="font-size:12px;font-weight:700;margin-bottom:10px">For <strong>${shopDisplayName}</strong></div>
           <div class="signature-space"></div>
           <div class="signature-line">Authorised Signatory</div>
           <div class="signature-note">Computer generated invoice. Signature not required.</div>
         </div></div>`
      : '<div class="footer-box"></div>'}
  </div>
  ${termsHTML}
  ${footerNoteHTML}
  <div class="footer-mark">Grow your business with — रखरखाव</div>
</div>
${autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : ''}
</body></html>`;
}

/* ─── Main Export ─────────────────────────────────────────────────── */
export function generateInvoiceHTML(sale, shop, config = {}, autoPrint = false, suggestedFileName = '', templateId = 'detailed') {
  let html;
  if (templateId === 'minimal') {
    html = buildMinimalHTML(sale, shop, autoPrint);
  } else if (templateId === 'gst_tax') {
    html = buildGstTaxHTML(sale, shop, config, autoPrint, suggestedFileName);
  } else {
    html = buildDetailedHTML(sale, shop, config, autoPrint, suggestedFileName);
  }

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
