/**
 * Delivery Challan print template — GST Rule 55 CGST Rules 2017
 * Generates a 3-copy A4 document (Original / Duplicate / Triplicate)
 * opened in a new window and auto-printed.
 *
 * Usage: printDeliveryChallan(challan, shop)
 */

const formatDate = (d) => {
  if (!d) return '___/___/______';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '___/___/______';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const numToWords = (num) => {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (x) => {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + convert(x % 100) : '');
    if (x < 100000) return convert(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + convert(x % 1000) : '');
    return convert(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + convert(x % 100000) : '');
  };
  return convert(n);
};

const challanTypeLabel = (t) => {
  const map = {
    supply_of_goods: 'Supply of Goods',
    job_work: 'Job Work',
    supply_on_approval: 'Supply on Approval',
    others: 'Others',
  };
  return map[t] || 'Supply of Goods';
};

export const printDeliveryChallan = (challan, shop) => {
  const challanNumber = challan.challan_number || challan.invoice_number || '';
  const challanDate = formatDate(challan.challan_date || challan.createdAt);
  const items = challan.items || [];
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const primaryUom = items[0]?.unit_of_measurement || 'NOS';
  const qtyInWords = numToWords(totalQty) + ' ' + primaryUom + ' only';
  const taxableValue = Number(challan.taxable_amount || 0);
  const gstRate = items[0]?.gst_rate || 0;

  const itemRows = items.map((item, idx) => `
    <tr>
      <td style="text-align:center;padding:5px 6px;border:1px solid #ccc;font-size:10px;">${idx + 1}</td>
      <td style="padding:5px 6px;border:1px solid #ccc;font-size:10px;">${item.product_name || ''}</td>
      <td style="text-align:center;padding:5px 6px;border:1px solid #ccc;font-size:10px;">${item.hsn_code || ''}</td>
      <td style="text-align:center;padding:5px 6px;border:1px solid #ccc;font-size:10px;font-weight:bold;">${item.quantity || ''}</td>
      <td style="text-align:center;padding:5px 6px;border:1px solid #ccc;font-size:10px;">${item.unit_of_measurement || 'NOS'}</td>
      <td style="padding:5px 6px;border:1px solid #ccc;font-size:10px;color:#555;">${item.remarks || ''}</td>
    </tr>
  `).join('');

  const refRow = (challan.po_number || challan.indent_number) ? `
    <div style="background:#f5f5f5;border:1px solid #000;border-top:none;padding:4px 8px;font-size:10px;">
      ${challan.po_number ? `PO No: <strong>${challan.po_number}</strong>${challan.po_date ? ` dated ${formatDate(challan.po_date)}` : ''}` : ''}
      ${challan.indent_number ? `&nbsp;&nbsp;|&nbsp;&nbsp;Indent No: <strong>${challan.indent_number}</strong>` : ''}
    </div>
  ` : '';

  const generateCopy = (copyLabel, badgeColor) => `
    <div class="challan-copy">

      <div style="background:${badgeColor};color:#fff;text-align:center;padding:5px;font-size:11px;font-weight:bold;letter-spacing:2px;">${copyLabel}</div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #000;">
        <tr>
          <td style="width:55%;vertical-align:top;padding:8px;border-right:1px solid #000;">
            ${shop.logo ? `<img src="${shop.logo}" style="height:45px;margin-bottom:6px;display:block;">` : ''}
            <div style="font-size:17px;font-weight:bold;margin-bottom:3px;">${shop.name || ''}</div>
            <div style="font-size:10px;color:#333;line-height:1.5;">${shop.address || ''}</div>
            ${shop.gstin ? `<div style="font-size:10px;margin-top:2px;">GSTIN: <strong>${shop.gstin}</strong></div>` : ''}
            ${shop.phone ? `<div style="font-size:10px;">Ph: ${shop.phone}</div>` : ''}
            ${shop.email ? `<div style="font-size:10px;">${shop.email}</div>` : ''}
          </td>
          <td style="width:45%;vertical-align:top;padding:8px;text-align:right;">
            <div style="font-size:21px;font-weight:bold;letter-spacing:2px;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px;">DELIVERY CHALLAN</div>
            <table style="width:100%;font-size:11px;border-collapse:collapse;">
              <tr><td style="color:#555;padding:2px 4px;">Challan No.</td><td style="padding:2px 4px;font-weight:bold;">${challanNumber}</td></tr>
              <tr><td style="color:#555;padding:2px 4px;">Date</td><td style="padding:2px 4px;font-weight:bold;">${challanDate}</td></tr>
              <tr><td style="color:#555;padding:2px 4px;">Type</td><td style="padding:2px 4px;">${challanTypeLabel(challan.challan_type)}</td></tr>
              ${challan.eway_bill_number ? `<tr><td style="color:#555;padding:2px 4px;">E-way Bill</td><td style="padding:2px 4px;font-weight:bold;">${challan.eway_bill_number}</td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;">
        <tr>
          <td style="width:50%;vertical-align:top;padding:7px 8px;border-right:1px solid #000;">
            <div style="font-size:9px;font-weight:bold;letter-spacing:1px;color:#555;text-transform:uppercase;margin-bottom:4px;">CONSIGNEE (Ship To)</div>
            <div style="font-size:13px;font-weight:bold;margin-bottom:2px;">${challan.consignee_name || challan.buyer_name || ''}</div>
            <div style="font-size:10px;line-height:1.5;color:#333;">${challan.consignee_address || challan.buyer_address || ''}</div>
            ${(challan.consignee_gstin || challan.buyer_gstin) ? `<div style="font-size:10px;margin-top:2px;">GSTIN: <strong>${challan.consignee_gstin || challan.buyer_gstin}</strong></div>` : ''}
            ${challan.consignee_contact ? `<div style="font-size:10px;">Attn: ${challan.consignee_contact}</div>` : ''}
            ${(challan.consignee_phone || challan.buyer_phone) ? `<div style="font-size:10px;">Ph: ${challan.consignee_phone || challan.buyer_phone}</div>` : ''}
          </td>
          <td style="width:50%;vertical-align:top;padding:7px 8px;">
            <div style="font-size:9px;font-weight:bold;letter-spacing:1px;color:#555;text-transform:uppercase;margin-bottom:4px;">TRANSPORT DETAILS</div>
            <table style="width:100%;font-size:10px;border-collapse:collapse;">
              <tr><td style="color:#555;padding:1px 4px 1px 0;width:38%;">From</td><td style="padding:1px 0;">${challan.dispatch_from || shop.address || ''}</td></tr>
              <tr><td style="color:#555;padding:1px 4px 1px 0;">To</td><td style="padding:1px 0;">${challan.deliver_to || challan.consignee_address || ''}</td></tr>
              ${challan.vehicle_number ? `<tr><td style="color:#555;padding:1px 4px 1px 0;">Vehicle</td><td style="padding:1px 0;font-weight:bold;">${challan.vehicle_number}</td></tr>` : ''}
              ${challan.transport_name ? `<tr><td style="color:#555;padding:1px 4px 1px 0;">Transporter</td><td style="padding:1px 0;">${challan.transport_name}</td></tr>` : ''}
              ${challan.lr_number ? `<tr><td style="color:#555;padding:1px 4px 1px 0;">LR No.</td><td style="padding:1px 0;">${challan.lr_number}</td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      ${refRow}

      <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;">
        <thead>
          <tr style="background:#1a1a1a;">
            <th style="width:5%;color:#fff;padding:5px 6px;font-size:10px;text-align:center;border:1px solid #000;">S.No</th>
            <th style="width:35%;color:#fff;padding:5px 6px;font-size:10px;text-align:left;border:1px solid #000;">Description of Goods</th>
            <th style="width:11%;color:#fff;padding:5px 6px;font-size:10px;text-align:center;border:1px solid #000;">HSN Code</th>
            <th style="width:10%;color:#fff;padding:5px 6px;font-size:10px;text-align:center;border:1px solid #000;">Qty</th>
            <th style="width:9%;color:#fff;padding:5px 6px;font-size:10px;text-align:center;border:1px solid #000;">Unit</th>
            <th style="width:30%;color:#fff;padding:5px 6px;font-size:10px;text-align:left;border:1px solid #000;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr style="background:#f0f0f0;">
            <td colspan="3" style="text-align:right;font-weight:bold;padding:5px 8px;border-top:2px solid #000;border:1px solid #ccc;font-size:11px;">Total</td>
            <td style="text-align:center;font-weight:bold;padding:5px 6px;border-top:2px solid #000;border:1px solid #ccc;font-size:11px;">${totalQty}</td>
            <td style="border-top:2px solid #000;border:1px solid #ccc;"></td>
            <td style="border-top:2px solid #000;border:1px solid #ccc;"></td>
          </tr>
        </tbody>
      </table>

      <div style="border:1px solid #000;border-top:none;padding:4px 8px;font-size:10px;background:#fafafa;">
        Total Quantity in Words: <strong>${qtyInWords}</strong>
      </div>

      <div style="border:1px solid #000;border-top:none;padding:4px 8px;font-size:10px;">
        Taxable Value (for reference only):&nbsp;<strong>₹${taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        &nbsp;&nbsp;&nbsp;
        Applicable GST Rate: <strong>${gstRate}%</strong>&nbsp;(not charged on this document)
      </div>

      <div style="background:#111;color:#fff;text-align:center;padding:5px;font-size:9px;font-weight:bold;letter-spacing:1px;margin-top:4px;">
        ★ &nbsp; THIS IS NOT A TAX INVOICE — GOODS MOVEMENT DOCUMENT ONLY &nbsp; ★
      </div>

      ${challan.special_instructions ? `
      <div style="border:1px solid #ccc;padding:4px 8px;font-size:10px;margin-top:4px;">
        <strong>Special Instructions:</strong> ${challan.special_instructions}
      </div>` : ''}

      <div style="font-size:9px;color:#555;padding:4px 0;border-top:1px dashed #ccc;margin-top:4px;line-height:1.5;">
        ${challan.challan_terms || 'Goods are dispatched subject to our standard terms and conditions. Please verify quantity and condition of goods on receipt. Any discrepancy must be reported within 24 hours of delivery.'}
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-top:6px;">
        <tr>
          <td style="width:33.33%;vertical-align:top;padding:8px 10px;border-right:1px solid #000;font-size:10px;">
            <div>For <strong>${shop.name || ''}</strong></div>
            <div style="border-bottom:1px solid #000;margin:28px 0 4px;"></div>
            <div style="font-size:9px;color:#555;text-align:center;">Authorised Signatory</div>
          </td>
          <td style="width:33.33%;vertical-align:top;padding:8px 10px;border-right:1px solid #000;font-size:10px;">
            <div>Received By:</div>
            <div style="border-bottom:1px solid #000;margin:28px 0 4px;"></div>
            <div style="font-size:9px;color:#555;text-align:center;">Name, Signature &amp; Stamp</div>
            <div style="margin-top:8px;font-size:10px;">Date: _____ / _____ / __________</div>
          </td>
          <td style="width:33.33%;vertical-align:top;padding:8px 10px;font-size:10px;">
            <div>Delivery Confirmed:</div>
            <div style="margin-top:8px;font-size:10px;">Date: _____ / _____ / __________</div>
            <div style="margin-top:8px;font-size:10px;">Time: ________________</div>
            <div style="border-bottom:1px solid #000;margin:12px 0 4px;"></div>
            <div style="font-size:9px;color:#555;text-align:center;">Driver / Transporter</div>
          </td>
        </tr>
      </table>

    </div>
  `;

  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Delivery Challan — ${challanNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #000;
          background: #fff;
        }
        .challan-copy {
          width: 210mm;
          padding: 8mm 10mm;
          border-bottom: 2px dashed #888;
        }
        .challan-copy:last-child { border-bottom: none; }
        .cut-line {
          text-align: center;
          font-size: 9px;
          color: #999;
          padding: 3px 0;
          letter-spacing: 2px;
        }
        @media print {
          @page {
            size: A4;
            margin: 4mm;
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .challan-copy { page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>

      <div class="cut-line no-print">✂ - - - - - - - - - - - - CUT HERE - - - - - - - - - - - - ✂</div>
      ${generateCopy('ORIGINAL — FOR CONSIGNEE', '#1a3c5e')}

      <div class="cut-line">✂ - - - - - - - - - - - - CUT HERE - - - - - - - - - - - - ✂</div>
      ${generateCopy('DUPLICATE — FOR TRANSPORTER', '#2d5a1b')}

      <div class="cut-line">✂ - - - - - - - - - - - - CUT HERE - - - - - - - - - - - - ✂</div>
      ${generateCopy('TRIPLICATE — FOR CONSIGNOR', '#5c1a1a')}

      <script>
        window.onload = function () {
          window.print();
          setTimeout(function () { window.close(); }, 3000);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
