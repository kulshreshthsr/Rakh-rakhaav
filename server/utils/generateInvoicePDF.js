// server/utils/generateInvoicePDF.js
// Generates a professional invoice PDF using PDFKit
// Returns a Buffer — no file system needed

const PDFDocument = require('pdfkit');

const fmt = (n) => parseFloat(n || 0).toFixed(2);

const numberToWords = (num) => {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight',
    'Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen',
    'Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const convert = (n) => {
    if (n === 0)    return '';
    if (n < 20)     return ones[n];
    if (n < 100)    return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000)   return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and ' + convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + convert(n%10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);
  let result   = convert(rupees) + ' Rupees';
  if (paise)   result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
};

/**
 * generateInvoicePDF(sale, shop)
 * @param {Object} sale  - sale document from MongoDB
 * @param {Object} shop  - shop document from MongoDB
 * @returns {Promise<Buffer>} - PDF as a Buffer
 */
const generateInvoicePDF = (sale, shop) => {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data',  chunk => chunks.push(chunk));
      doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
      doc.on('error', err   => reject(err));

      // ── Colors & Fonts ─────────────────────────────────────────────────────
      const NAVY    = '#0B1D35';
      const GREEN   = '#059669';
      const GREY    = '#6B7280';
      const LIGHT   = '#F3F4F6';
      const WHITE   = '#FFFFFF';
      const RED     = '#991B1B';
      const PURPLE  = '#6D28D9';

      const pageW   = doc.page.width  - 80; // usable width (margin 40 each side)
      const pageL   = 40;                    // left margin

      // ── Normalize sale items ───────────────────────────────────────────────
      const saleItems = (sale.items && sale.items.length > 0)
        ? sale.items
        : [{
            product_name:   sale.product_name,
            hsn_code:       sale.hsn_code       || '—',
            quantity:       sale.quantity,
            price_per_unit: sale.price_per_unit,
            gst_rate:       sale.gst_rate       || 0,
            taxable_amount: sale.taxable_amount,
            cgst_amount:    sale.cgst_amount    || 0,
            sgst_amount:    sale.sgst_amount    || 0,
            igst_amount:    sale.igst_amount    || 0,
            gst_type:       sale.gst_type,
            total_amount:   sale.total_amount,
          }];

      const isIGST  = sale.gst_type === 'IGST' ||
                      saleItems.some(i => i.gst_type === 'IGST');
      const saleDate = new Date(sale.createdAt || sale.sold_at)
        .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const payLabel = sale.payment_type === 'cash'   ? 'CASH'   :
                       sale.payment_type === 'upi'    ? 'UPI'    :
                       sale.payment_type === 'bank'   ? 'BANK'   : 'CREDIT';

      // ══════════════════════════════════════════════════════════════════════
      // HEADER
      // ══════════════════════════════════════════════════════════════════════
      // Navy header bar
      doc.rect(pageL, 40, pageW, 70).fill(NAVY);

      // Shop name
      doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold')
         .text('Rakhaav', pageL + 14, 52, { continued: true })
         .fillColor(GREEN).text(' Business Manager');

      // Shop details
      doc.fontSize(8).fillColor('rgba(255,255,255,0.7)').font('Helvetica');
      let shopLine = '';
      if (shop.address) shopLine += shop.address;
      if (shop.city)    shopLine += ', ' + shop.city;
      if (shop.phone)   shopLine += '  |  Ph: ' + shop.phone;
      if (shopLine)     doc.text(shopLine, pageL + 14, 76);
      if (shop.gstin)   doc.text('GSTIN: ' + shop.gstin, pageL + 14, 88);

      // Payment badge (top right)
      const badgeColor = sale.payment_type === 'cash'   ? '#16A34A' :
                         sale.payment_type === 'upi'    ? '#7C3AED' :
                         sale.payment_type === 'credit' ? '#DC2626' : '#1D4ED8';
      doc.rect(pageL + pageW - 90, 52, 80, 22).fill(badgeColor);
      doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
         .text(payLabel, pageL + pageW - 88, 59, { width: 76, align: 'center' });

      // ── Title bar ─────────────────────────────────────────────────────────
      doc.rect(pageL, 110, pageW, 22).fill(GREEN);
      doc.fontSize(11).fillColor(WHITE).font('Helvetica-Bold')
         .text('TAX INVOICE / कर चालान', pageL, 116, { width: pageW, align: 'center' });

      // ══════════════════════════════════════════════════════════════════════
      // PARTIES — Seller | Buyer
      // ══════════════════════════════════════════════════════════════════════
      const partiesY = 136;
      doc.rect(pageL, partiesY, pageW, 90).stroke('#E5E7EB');

      // Vertical divider
      doc.moveTo(pageL + pageW / 2, partiesY)
         .lineTo(pageL + pageW / 2, partiesY + 90).stroke('#E5E7EB');

      // Seller label
      doc.fontSize(7).fillColor(GREEN).font('Helvetica-Bold')
         .text('SELLER / विक्रेता', pageL + 10, partiesY + 8);
      doc.fontSize(11).fillColor(NAVY).font('Helvetica-Bold')
         .text(shop.name || 'Rakhaav', pageL + 10, partiesY + 20, { width: pageW/2 - 20 });
      doc.fontSize(8).fillColor(GREY).font('Helvetica');
      let sellerY = partiesY + 34;
      if (shop.address) {
        doc.text(shop.address + (shop.city ? ', ' + shop.city : '') + (shop.state ? ', ' + shop.state : ''), pageL + 10, sellerY, { width: pageW/2 - 20 });
        sellerY += 14;
      }
      if (shop.phone)  { doc.text('Ph: ' + shop.phone, pageL + 10, sellerY); sellerY += 12; }
      if (shop.gstin)  { doc.fontSize(8).fillColor(NAVY).font('Helvetica-Bold').text('GSTIN: ' + shop.gstin, pageL + 10, sellerY); }

      // Buyer label
      const bx = pageL + pageW / 2 + 10;
      doc.fontSize(7).fillColor(GREEN).font('Helvetica-Bold')
         .text('BUYER / खरीदार', bx, partiesY + 8);
      doc.fontSize(11).fillColor(NAVY).font('Helvetica-Bold')
         .text(sale.buyer_name || 'Walk-in Customer', bx, partiesY + 20, { width: pageW/2 - 20 });
      doc.fontSize(8).fillColor(GREY).font('Helvetica');
      let buyerY = partiesY + 34;
      if (sale.buyer_address) { doc.text(sale.buyer_address, bx, buyerY, { width: pageW/2 - 20 }); buyerY += 14; }
      if (sale.buyer_state)   { doc.text('State: ' + sale.buyer_state, bx, buyerY); buyerY += 12; }
      if (sale.buyer_phone)   { doc.text('Ph: ' + sale.buyer_phone, bx, buyerY); buyerY += 12; }
      if (sale.buyer_gstin)   { doc.fontSize(8).fillColor(NAVY).font('Helvetica-Bold').text('GSTIN: ' + sale.buyer_gstin, bx, buyerY); }

      // ── Invoice details bar ───────────────────────────────────────────────
      const detailY = partiesY + 90;
      doc.rect(pageL, detailY, pageW, 22).fill(LIGHT);
      const third = pageW / 3;

      doc.fontSize(7).fillColor(GREY).font('Helvetica')
         .text('Invoice No.', pageL + 8, detailY + 4)
         .text('Date', pageL + third + 8, detailY + 4)
         .text('Type', pageL + third * 2 + 8, detailY + 4);

      doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold')
         .text(sale.invoice_number, pageL + 8, detailY + 13);
      doc.fillColor(NAVY)
         .text(saleDate, pageL + third + 8, detailY + 13);
      doc.fillColor(NAVY)
         .text((sale.invoice_type || 'B2C') + ' | ' + (isIGST ? 'IGST' : 'CGST+SGST'), pageL + third * 2 + 8, detailY + 13);

      // ══════════════════════════════════════════════════════════════════════
      // ITEMS TABLE
      // ══════════════════════════════════════════════════════════════════════
      const tableY = detailY + 22;

      // Table header
      doc.rect(pageL, tableY, pageW, 20).fill(NAVY);

      // Column config
      const cols = isIGST
        ? [
            { label: '#',           w: 24,  align: 'center' },
            { label: 'Product',     w: 130, align: 'left'   },
            { label: 'HSN',         w: 50,  align: 'center' },
            { label: 'Qty',         w: 35,  align: 'center' },
            { label: 'Rate',        w: 55,  align: 'right'  },
            { label: 'Taxable',     w: 60,  align: 'right'  },
            { label: 'IGST',        w: 55,  align: 'right'  },
            { label: 'Total',       w: 60,  align: 'right'  },
          ]
        : [
            { label: '#',           w: 22,  align: 'center' },
            { label: 'Product',     w: 110, align: 'left'   },
            { label: 'HSN',         w: 45,  align: 'center' },
            { label: 'Qty',         w: 30,  align: 'center' },
            { label: 'Rate',        w: 50,  align: 'right'  },
            { label: 'Taxable',     w: 55,  align: 'right'  },
            { label: 'CGST',        w: 48,  align: 'right'  },
            { label: 'SGST',        w: 48,  align: 'right'  },
            { label: 'Total',       w: 61,  align: 'right'  },
          ];

      // Draw header labels
      let colX = pageL;
      doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold');
      cols.forEach(col => {
        doc.text(col.label, colX + 3, tableY + 7, { width: col.w - 6, align: col.align });
        colX += col.w;
      });

      // Item rows
      let rowY = tableY + 20;
      saleItems.forEach((item, idx) => {
        const rowH  = 20;
        const rowBg = idx % 2 === 0 ? WHITE : '#F9FAFB';
        doc.rect(pageL, rowY, pageW, rowH).fill(rowBg);

        const gstAmt    = isIGST ? item.igst_amount : item.cgst_amount;
        const gstLabel  = isIGST
          ? `${item.gst_rate || 0}%: ₹${fmt(item.igst_amount)}`
          : `${((item.gst_rate||0)/2).toFixed(1)}%: ₹${fmt(item.cgst_amount)}`;

        const values = isIGST
          ? [
              String(idx + 1),
              item.product_name,
              item.hsn_code || '—',
              String(item.quantity),
              '₹' + fmt(item.price_per_unit),
              '₹' + fmt(item.taxable_amount),
              gstLabel,
              '₹' + fmt(item.total_amount),
            ]
          : [
              String(idx + 1),
              item.product_name,
              item.hsn_code || '—',
              String(item.quantity),
              '₹' + fmt(item.price_per_unit),
              '₹' + fmt(item.taxable_amount),
              `${((item.gst_rate||0)/2).toFixed(1)}%: ₹${fmt(item.cgst_amount)}`,
              `${((item.gst_rate||0)/2).toFixed(1)}%: ₹${fmt(item.sgst_amount)}`,
              '₹' + fmt(item.total_amount),
            ];

        colX = pageL;
        doc.fontSize(7.5).fillColor('#1F2937').font('Helvetica');
        cols.forEach((col, ci) => {
          const isLast  = ci === cols.length - 1;
          const isBold  = isLast;
          if (isBold) doc.font('Helvetica-Bold');
          doc.text(values[ci], colX + 3, rowY + 6, { width: col.w - 6, align: col.align });
          if (isBold) doc.font('Helvetica');
          colX += col.w;
        });

        // Row border
        doc.rect(pageL, rowY, pageW, rowH).stroke('#E5E7EB');
        rowY += rowH;
      });

      // Table footer — totals row
      doc.rect(pageL, rowY, pageW, 20).fill(LIGHT);
      colX = pageL;
      const footerVals = isIGST
        ? ['', 'TOTAL', '', '', '', '₹'+fmt(sale.taxable_amount), '₹'+fmt(sale.igst_amount), '₹'+fmt(sale.total_amount)]
        : ['', 'TOTAL', '', '', '', '₹'+fmt(sale.taxable_amount), '₹'+fmt(sale.cgst_amount), '₹'+fmt(sale.sgst_amount), '₹'+fmt(sale.total_amount)];

      doc.fontSize(8).fillColor(NAVY).font('Helvetica-Bold');
      cols.forEach((col, ci) => {
        doc.text(footerVals[ci], colX + 3, rowY + 6, { width: col.w - 6, align: col.align });
        colX += col.w;
      });
      rowY += 20;

      // ══════════════════════════════════════════════════════════════════════
      // TOTALS SECTION
      // ══════════════════════════════════════════════════════════════════════
      const totalsY = rowY + 8;

      // Amount in words (left half)
      doc.fontSize(7).fillColor(GREY).font('Helvetica')
         .text('Amount in Words:', pageL, totalsY);
      doc.fontSize(8.5).fillColor(NAVY).font('Helvetica-BoldOblique')
         .text(numberToWords(parseFloat(sale.total_amount)), pageL, totalsY + 12,
               { width: pageW * 0.55 });

      // Credit note if applicable
      if (sale.payment_type === 'credit') {
        doc.rect(pageL, totalsY + 32, pageW * 0.55 - 4, 18).fill('#FEF2F2');
        doc.fontSize(7.5).fillColor(RED).font('Helvetica-Bold')
           .text('📒 CREDIT SALE — Amount added to customer ledger', pageL + 4, totalsY + 38);
      }

      // Amounts breakdown (right side box)
      const amtBoxX = pageL + pageW * 0.58;
      const amtBoxW = pageW * 0.42;
      doc.rect(amtBoxX, totalsY, amtBoxW, isIGST ? 78 : 90).stroke('#E5E7EB');

      const amtRows = [
        { label: 'Taxable Amount', value: '₹' + fmt(sale.taxable_amount) },
      ];
      if (isIGST) {
        amtRows.push({ label: `IGST @ ${sale.gst_rate || 0}%`, value: '₹' + fmt(sale.igst_amount) });
      } else {
        amtRows.push({ label: `CGST @ ${((sale.gst_rate||0)/2).toFixed(1)}%`, value: '₹' + fmt(sale.cgst_amount) });
        amtRows.push({ label: `SGST @ ${((sale.gst_rate||0)/2).toFixed(1)}%`, value: '₹' + fmt(sale.sgst_amount) });
      }
      amtRows.push({ label: 'Total GST', value: '₹' + fmt(sale.total_gst) });

      let amtY = totalsY + 6;
      doc.fontSize(8).font('Helvetica');
      amtRows.forEach(row => {
        doc.fillColor(GREY).text(row.label, amtBoxX + 6, amtY, { width: amtBoxW * 0.6 });
        doc.fillColor(NAVY).text(row.value, amtBoxX + amtBoxW * 0.6, amtY, { width: amtBoxW * 0.38, align: 'right' });
        amtY += 14;
      });

      // Grand total bar
      const gtY = totalsY + (isIGST ? 58 : 70);
      doc.rect(amtBoxX, gtY, amtBoxW, 20).fill(NAVY);
      doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
         .text('GRAND TOTAL', amtBoxX + 6, gtY + 6, { width: amtBoxW * 0.55 });
      doc.text('₹' + fmt(sale.total_amount), amtBoxX + amtBoxW * 0.6, gtY + 6, { width: amtBoxW * 0.38, align: 'right' });

      // ══════════════════════════════════════════════════════════════════════
      // FOOTER — Bank details | Signature
      // ══════════════════════════════════════════════════════════════════════
      const footY = doc.y + 20;

      // Bank details (left)
      if (shop.bank_name) {
        doc.fontSize(7).fillColor(GREEN).font('Helvetica-Bold')
           .text('BANK DETAILS', pageL, footY);
        doc.fontSize(8).fillColor(GREY).font('Helvetica');
        let by = footY + 12;
        doc.text('Bank: ' + shop.bank_name, pageL, by);       by += 12;
        if (shop.bank_branch)  { doc.text('Branch: ' + shop.bank_branch,   pageL, by); by += 12; }
        if (shop.bank_account) { doc.text('A/C No: ' + shop.bank_account,  pageL, by); by += 12; }
        if (shop.bank_ifsc)    { doc.text('IFSC: ' + shop.bank_ifsc,       pageL, by); }
      }

      // Signature (right)
      const sigX = pageL + pageW - 160;
      doc.fontSize(8).fillColor(NAVY).font('Helvetica-Bold')
         .text('For ' + (shop.name || 'Rakhaav'), sigX, footY, { width: 160, align: 'right' });
      doc.moveTo(sigX, footY + 45).lineTo(pageL + pageW, footY + 45).stroke(GREY);
      doc.fontSize(7).fillColor(GREY).font('Helvetica')
         .text('Authorised Signatory', sigX, footY + 48, { width: 160, align: 'right' });
      doc.text('Computer generated invoice. No signature required.', sigX, footY + 58, { width: 160, align: 'right' });

      // ── Terms ─────────────────────────────────────────────────────────────
      if (shop.terms) {
        const termsY = footY + 75;
        doc.rect(pageL, termsY, pageW, 2).fill(LIGHT);
        doc.fontSize(7).fillColor(GREY).font('Helvetica-Bold')
           .text('Terms & Conditions', pageL, termsY + 6);
        doc.font('Helvetica');
        shop.terms.split('\n').forEach((line, i) => {
          doc.text(`${i + 1}. ${line}`, pageL, termsY + 18 + (i * 11));
        });
      }

      // ── Footer watermark ──────────────────────────────────────────────────
      doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
         .text('~ Rakhaav Business Manager ~', pageL, doc.page.height - 30,
               { width: pageW, align: 'center' });

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoicePDF;