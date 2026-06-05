'use strict';

const Sale     = require('../models/salesModel');
const Purchase = require('../models/purchaseModel');
const Shop     = require('../models/shopModel');
const {
  validateGSTIN, round2, formatGSTNDate, classifyForGSTR1, getInvTyp,
  getQuarterDateRange, getFiscalQuarter,
} = require('../lib/gstUtils');

const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const sumField = (arr, field) => arr.reduce((s, i) => s + (Number(i[field]) || 0), 0);

// ─────────────────────────────────────────────────────────────────────────────
// GSTR-1 JSON EXPORT
// GET /api/gst/gstr1?month=MM&year=YYYY   (monthly filers)
// GET /api/gst/gstr1?quarter=Q1&year=YYYY (QRMP filers — Q1..Q4)
// ─────────────────────────────────────────────────────────────────────────────

const generateGSTR1 = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);

    if (!shop.gstin) {
      return res.status(400).json({
        message: 'GSTIN not configured. Please update your profile first.',
      });
    }

    const { month, year, quarter } = req.query;
    if (!year) return res.status(400).json({ message: 'year is required' });
    if (!month && !quarter) return res.status(400).json({ message: 'month or quarter is required' });

    let fromDate, toDate, periodStr;
    if (quarter) {
      const qNum = parseInt(quarter.replace('Q', ''), 10);
      if (qNum < 1 || qNum > 4) return res.status(400).json({ message: 'quarter must be Q1..Q4' });
      const fiscalYear = parseInt(year, 10);
      const r = getQuarterDateRange(fiscalYear, qNum);
      fromDate  = r.fromDate;
      toDate    = r.toDate;
      const quarterEndMonth = { 1: '06', 2: '09', 3: '12', 4: '03' }[qNum];
      const quarterEndYear = qNum === 4 ? fiscalYear + 1 : fiscalYear;
      periodStr = `${quarterEndMonth}${quarterEndYear}`;
    } else {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      fromDate  = new Date(y, m - 1, 1);
      toDate    = new Date(y, m, 0, 23, 59, 59, 999);
      periodStr = `${String(m).padStart(2, '0')}${y}`;
    }

    const allDocs = await Sale.find({
      shop: shop._id,
      createdAt: { $gte: fromDate, $lte: toDate },
      document_type: { $in: ['invoice', 'credit_note', 'debit_note'] },
    }).lean();

    const invoices    = allDocs.filter(d => d.document_type === 'invoice');
    const creditNotes = allDocs.filter(d => d.document_type === 'credit_note');
    const debitNotes  = allDocs.filter(d => d.document_type === 'debit_note');

    // ── TABLE 4: B2B Invoices (includes SEZ and DE supplies) ────────────────
    const b2bInvoices = invoices.filter(s =>
      s.is_b2b || s.buyer_gstin || s.invoice_type === 'B2B' || s.is_sez_supply || s.is_deemed_export
    );
    const b2bGrouped  = {};
    for (const sale of b2bInvoices) {
      const gstin = sale.buyer_gstin;
      if (!gstin) continue;
      if (!b2bGrouped[gstin]) b2bGrouped[gstin] = { ctin: gstin, inv: [] };
      b2bGrouped[gstin].inv.push({
        inum:    sale.invoice_number,
        idt:     formatGSTNDate(sale.createdAt),
        val:     round2(sale.total_amount),
        pos:     sale.place_of_supply || sale.buyer_state_code || shop.gst_state_code || '00',
        rchrg:   sale.is_reverse_charge ? 'Y' : 'N',
        inv_typ: getInvTyp(sale),
        itms:    (sale.items || []).map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            txval: round2(item.taxable_amount || 0),
            rt:    Number(item.gst_rate || 0),
            camt:  round2(item.cgst_amount || 0),
            samt:  round2(item.sgst_amount || 0),
            iamt:  round2(item.igst_amount || 0),
            csamt: 0,
          },
        })),
      });
    }
    const b2b = Object.values(b2bGrouped);

    // ── TABLE 5: B2CL ────────────────────────────────────────────────────────
    const b2clInvoices = invoices.filter(s =>
      !s.is_b2b && !s.buyer_gstin && s.invoice_type !== 'B2B' &&
      !s.is_sez_supply && !s.is_deemed_export &&
      s.supply_type === 'inter_state' &&
      (s.total_amount || 0) > 250000
    );
    const b2clGrouped = {};
    for (const sale of b2clInvoices) {
      const pos = sale.place_of_supply || sale.buyer_state_code || '00';
      if (!b2clGrouped[pos]) b2clGrouped[pos] = { pos, inv: [] };
      b2clGrouped[pos].inv.push({
        inum: sale.invoice_number,
        idt:  formatGSTNDate(sale.createdAt),
        val:  round2(sale.total_amount),
        itms: (sale.items || []).map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            txval: round2(item.taxable_amount || 0),
            rt:    Number(item.gst_rate || 0),
            iamt:  round2(item.igst_amount || 0),
            csamt: 0,
          },
        })),
      });
    }
    const b2cl = Object.values(b2clGrouped);

    // ── TABLE 7: B2CS ────────────────────────────────────────────────────────
    const b2csInvoices = invoices.filter(s =>
      !s.is_b2b && !s.buyer_gstin && s.invoice_type !== 'B2B' &&
      !s.is_sez_supply && !s.is_deemed_export &&
      !(s.supply_type === 'inter_state' && (s.total_amount || 0) > 250000)
    );
    const b2csGrouped = {};
    for (const sale of b2csInvoices) {
      for (const item of (sale.items || [])) {
        const pos     = sale.place_of_supply || shop.gst_state_code || '00';
        const splyTy  = sale.supply_type === 'inter_state' ? 'INTER' : 'INTRA';
        const key     = `${item.gst_rate}_${splyTy}_${pos}`;
        if (!b2csGrouped[key]) {
          b2csGrouped[key] = { sply_ty: splyTy, pos, typ: 'OE', rt: Number(item.gst_rate || 0), txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        }
        b2csGrouped[key].txval += item.taxable_amount || 0;
        b2csGrouped[key].iamt  += item.igst_amount    || 0;
        b2csGrouped[key].camt  += item.cgst_amount    || 0;
        b2csGrouped[key].samt  += item.sgst_amount    || 0;
      }
    }
    const b2cs = Object.values(b2csGrouped).map(r => ({
      ...r,
      txval: round2(r.txval), iamt: round2(r.iamt),
      camt:  round2(r.camt),  samt: round2(r.samt),
    }));

    // ── TABLE 9: CDNR ────────────────────────────────────────────────────────
    const cdnrNotes = [...creditNotes, ...debitNotes].filter(n => n.is_b2b || n.buyer_gstin);
    const cdnrGrouped = {};
    for (const note of cdnrNotes) {
      const gstin = note.buyer_gstin;
      if (!gstin) continue;
      if (!cdnrGrouped[gstin]) cdnrGrouped[gstin] = { ctin: gstin, nt: [] };
      cdnrGrouped[gstin].nt.push({
        ntty:   note.document_type === 'credit_note' ? 'C' : 'D',
        nt_num: note.invoice_number,
        nt_dt:  formatGSTNDate(note.createdAt),
        val:    Math.abs(round2(note.total_amount || 0)),
        pos:    note.place_of_supply || note.buyer_state_code || shop.gst_state_code || '00',
        rchrg:  note.is_reverse_charge ? 'Y' : 'N',
        itms:   (note.items || []).map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            txval: Math.abs(round2(item.taxable_amount || 0)),
            rt:    Number(item.gst_rate || 0),
            camt:  Math.abs(round2(item.cgst_amount || 0)),
            samt:  Math.abs(round2(item.sgst_amount || 0)),
            iamt:  Math.abs(round2(item.igst_amount || 0)),
            csamt: 0,
          },
        })),
      });
    }
    const cdnr = Object.values(cdnrGrouped);

    // ── TABLE 10: CDNUR ──────────────────────────────────────────────────────
    const cdnurNotes = [...creditNotes, ...debitNotes].filter(n => !n.is_b2b && !n.buyer_gstin);
    const cdnur = cdnurNotes.map(note => ({
      typ: note.supply_type === 'inter_state' && Math.abs(note.total_amount || 0) > 250000 ? 'B2CL' : 'B2CS',
      ntty:   note.document_type === 'credit_note' ? 'C' : 'D',
      nt_num: note.invoice_number,
      nt_dt:  formatGSTNDate(note.createdAt),
      val:    Math.abs(round2(note.total_amount || 0)),
      pos:    note.place_of_supply || shop.gst_state_code || '00',
      itms:   (note.items || []).map((item, idx) => ({
        num: idx + 1,
        itm_det: {
          txval: Math.abs(round2(item.taxable_amount || 0)),
          rt:    Number(item.gst_rate || 0),
          camt:  Math.abs(round2(item.cgst_amount || 0)),
          samt:  Math.abs(round2(item.sgst_amount || 0)),
          iamt:  Math.abs(round2(item.igst_amount || 0)),
          csamt: 0,
        },
      })),
    }));

    // ── TABLE 12: HSN Summary ────────────────────────────────────────────────
    const hsnMap = {};
    for (const sale of invoices) {
      for (const item of (sale.items || [])) {
        const key = `${item.hsn_code || '0000'}_${item.gst_rate || 0}`;
        if (!hsnMap[key]) {
          hsnMap[key] = {
            hsn_sc: String(item.hsn_code || ''),
            desc:   String(item.product_name || ''),
            uqc:    'NOS',
            qty:    0, val: 0, txval: 0,
            iamt: 0, camt: 0, samt: 0, csamt: 0,
            rt: Number(item.gst_rate || 0),
          };
        }
        hsnMap[key].qty   += Number(item.quantity   || 0);
        hsnMap[key].txval += Number(item.taxable_amount || 0);
        hsnMap[key].iamt  += Number(item.igst_amount || 0);
        hsnMap[key].camt  += Number(item.cgst_amount || 0);
        hsnMap[key].samt  += Number(item.sgst_amount || 0);
        hsnMap[key].val   += Number(item.taxable_amount || 0) +
                             Number(item.igst_amount || 0) +
                             Number(item.cgst_amount || 0) +
                             Number(item.sgst_amount || 0);
      }
    }
    const hsn = {
      data: Object.values(hsnMap).map(h => ({
        ...h,
        val:   round2(h.val),   txval: round2(h.txval),
        iamt:  round2(h.iamt),  camt:  round2(h.camt),
        samt:  round2(h.samt),
      })),
    };

    const grossTurnover = round2(sumField(invoices, 'total_amount'));

    const gstr1JSON = {
      gstin:  shop.gstin,
      fp:     periodStr,
      gt:     grossTurnover,
      cur_gt: grossTurnover,
      b2b, b2cl, b2cs,
      cdnr, cdnur,
      hsn,
      b2ba: [], b2cla: [], b2csa: [], cdnra: [], cdnura: [],
      exp:  [], expa:   [],
      at:   [], atadj:  [],
      txpd: [],
      nil:  { inv: [] },
    };

    const summary = {
      period: periodStr,
      gstin:  shop.gstin,
      b2b_count:    b2b.reduce((s, g) => s + g.inv.length, 0),
      b2cl_count:   b2cl.reduce((s, g) => s + g.inv.length, 0),
      b2cs_count:   b2csInvoices.length,
      cdnr_count:   cdnr.reduce((s, g) => s + g.nt.length, 0),
      cdnur_count:  cdnur.length,
      hsn_count:    hsn.data.length,
      total_taxable: round2(sumField(invoices, 'taxable_amount')),
      total_cgst:    round2(sumField(invoices, 'cgst_amount')),
      total_sgst:    round2(sumField(invoices, 'sgst_amount')),
      total_igst:    round2(sumField(invoices, 'igst_amount')),
      total_tax:     round2(sumField(invoices, 'total_gst')),
      gross_turnover: grossTurnover,
    };

    res.json({ gstr1: gstr1JSON, summary });
  } catch (err) {
    logger.error('generateGSTR1 error:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GSTR-3B WORKING SHEET
// GET /api/gst/gstr3b?month=MM&year=YYYY
// ─────────────────────────────────────────────────────────────────────────────

const ITC_BLOCKED_LABELS = {
  personal_use:          'Personal use',
  motor_vehicle:         'Motor vehicle (non-commercial)',
  food_beverages:        'Food & beverages',
  club_membership:       'Club membership',
  travel_benefits:       'Travel benefits to employees',
  construction:          'Construction of immovable property',
  composition_purchase:  'Composition scheme purchase',
  unregistered_supplier: 'Unregistered supplier',
  other:                 'Other',
};

const generateGSTR3B = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);

    if (!shop.gstin) {
      return res.status(400).json({ message: 'GSTIN not configured. Please update your profile first.' });
    }

    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'month and year are required' });

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const fromDate = new Date(y, m - 1, 1);
    const toDate   = new Date(y, m, 0, 23, 59, 59, 999);

    const [sales, purchases, creditNotes] = await Promise.all([
      Sale.find({
        shop: shop._id,
        createdAt: { $gte: fromDate, $lte: toDate },
        document_type: { $in: ['invoice', 'debit_note'] },
      }).lean(),
      Purchase.find({
        shop: shop._id,
        $or: [
          { supplier_invoice_date: { $gte: fromDate, $lte: toDate } },
          { createdAt: { $gte: fromDate, $lte: toDate } },
        ],
      }).lean(),
      Sale.find({
        shop: shop._id,
        createdAt: { $gte: fromDate, $lte: toDate },
        document_type: 'credit_note',
      }).lean(),
    ]);

    const R = round2;

    // ── Table 3.1: Outward Supplies ──────────────────────────────────────────
    const interStateSales = sales.filter(s => s.supply_type === 'inter_state');
    const intraStateSales = sales.filter(s => s.supply_type !== 'inter_state');
    const cnInter = creditNotes.filter(cn => cn.supply_type === 'inter_state');
    const cnIntra = creditNotes.filter(cn => cn.supply_type !== 'inter_state');

    const table31 = {
      a: {
        inter: {
          txval: R(sumField(interStateSales,'taxable_amount') - Math.abs(sumField(cnInter,'taxable_amount'))),
          iamt:  R(sumField(interStateSales,'igst_amount')    - Math.abs(sumField(cnInter,'igst_amount'))),
          camt: 0, samt: 0, csamt: 0,
        },
        intra: {
          txval: R(sumField(intraStateSales,'taxable_amount') - Math.abs(sumField(cnIntra,'taxable_amount'))),
          iamt: 0,
          camt:  R(sumField(intraStateSales,'cgst_amount')    - Math.abs(sumField(cnIntra,'cgst_amount'))),
          samt:  R(sumField(intraStateSales,'sgst_amount')    - Math.abs(sumField(cnIntra,'sgst_amount'))),
          csamt: 0,
        },
      },
      b: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      c: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      d: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    };

    // ── Table 3.2: Inter-state to unregistered ───────────────────────────────
    const b2clSales = sales.filter(s => !s.is_b2b && !s.buyer_gstin && s.supply_type === 'inter_state' && s.total_amount > 250000);
    const posGroups = {};
    for (const s of b2clSales) {
      const pos = s.place_of_supply || '00';
      if (!posGroups[pos]) posGroups[pos] = { txval: 0, iamt: 0 };
      posGroups[pos].txval += s.taxable_amount || 0;
      posGroups[pos].iamt  += s.igst_amount    || 0;
    }
    const table32 = Object.entries(posGroups).map(([pos, vals]) => ({ pos, txval: R(vals.txval), iamt: R(vals.iamt) }));

    // ── Table 4: ITC Available ───────────────────────────────────────────────
    const eligiblePurchases = purchases.filter(p => p.itc_eligible !== false && !p.is_reverse_charge);
    const rcmPurchases      = purchases.filter(p => p.is_reverse_charge);
    const blockedPurchases  = purchases.filter(p => p.itc_eligible === false && !p.is_reverse_charge);

    const itcEligIGST = R(sumField(eligiblePurchases, 'igst_amount'));
    const itcEligCGST = R(sumField(eligiblePurchases, 'cgst_amount'));
    const itcEligSGST = R(sumField(eligiblePurchases, 'sgst_amount'));
    const itcRcmIGST  = R(sumField(rcmPurchases, 'igst_amount'));
    const itcRcmCGST  = R(sumField(rcmPurchases, 'cgst_amount'));
    const itcRcmSGST  = R(sumField(rcmPurchases, 'sgst_amount'));

    const table4 = {
      A: {
        a: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
        b: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
        c: { iamt: itcRcmIGST, camt: itcRcmCGST, samt: itcRcmSGST, csamt: 0 },
        d: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
        e: { iamt: itcEligIGST, camt: itcEligCGST, samt: itcEligSGST, csamt: 0 },
      },
      B: {
        a: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
        b: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      },
      C: {
        iamt:  R(itcEligIGST + itcRcmIGST),
        camt:  R(itcEligCGST + itcRcmCGST),
        samt:  R(itcEligSGST + itcRcmSGST),
        csamt: 0,
      },
      D: {
        a: { iamt: R(sumField(blockedPurchases,'igst_amount')), camt: R(sumField(blockedPurchases,'cgst_amount')), samt: R(sumField(blockedPurchases,'sgst_amount')), csamt: 0 },
        b: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      },
    };

    // ── Section 17(5) — blocked ITC breakdown by reason ─────────────────────
    const blockedByReason = {};
    for (const p of blockedPurchases) {
      const reason = p.itc_blocked_reason || 'other';
      if (!blockedByReason[reason]) {
        blockedByReason[reason] = {
          label: ITC_BLOCKED_LABELS[reason] || reason,
          iamt: 0, camt: 0, samt: 0,
        };
      }
      blockedByReason[reason].iamt += Number(p.igst_amount || 0);
      blockedByReason[reason].camt += Number(p.cgst_amount || 0);
      blockedByReason[reason].samt += Number(p.sgst_amount || 0);
    }
    Object.keys(blockedByReason).forEach(k => {
      blockedByReason[k].iamt = R(blockedByReason[k].iamt);
      blockedByReason[k].camt = R(blockedByReason[k].camt);
      blockedByReason[k].samt = R(blockedByReason[k].samt);
    });

    // ── Table 5: Exempt, Nil, Non-GST outward supplies ──────────────────────
    const table5 = {
      a: { inter: 0, intra: 0 },
      b: { inter: 0, intra: 0 },
      c: { inter: 0, intra: 0 },
    };

    // ── Table 6.1: Tax Payable and Paid ─────────────────────────────────────
    const outIGST = table31.a.inter.iamt;
    const outCGST = table31.a.intra.camt;
    const outSGST = table31.a.intra.samt;
    const itcIGST = table4.C.iamt;
    const itcCGST = table4.C.camt;
    const itcSGST = table4.C.samt;

    let remIGST = itcIGST, remCGST = itcCGST, remSGST = itcSGST;
    let payIGST = outIGST, payCGST = outCGST, paySGST = outSGST;

    const useIGSTforIGST = Math.min(remIGST, payIGST);
    payIGST -= useIGSTforIGST; remIGST -= useIGSTforIGST;
    const useIGSTforCGST = Math.min(remIGST, payCGST);
    payCGST -= useIGSTforCGST; remIGST -= useIGSTforCGST;
    const useIGSTforSGST = Math.min(remIGST, paySGST);
    paySGST -= useIGSTforSGST;
    const useCGSTforCGST = Math.min(remCGST, payCGST);
    payCGST -= useCGSTforCGST;
    const useSGSTforSGST = Math.min(remSGST, paySGST);
    paySGST -= useSGSTforSGST;

    const table61 = {
      igst: { tax_payable: R(outIGST), paid_through_itc: R(useIGSTforIGST), paid_cash: R(Math.max(0, payIGST)), interest: 0, late_fee: 0 },
      cgst: { tax_payable: R(outCGST), paid_through_itc: R(useIGSTforCGST + useCGSTforCGST), paid_cash: R(Math.max(0, payCGST)), interest: 0, late_fee: 0 },
      sgst: { tax_payable: R(outSGST), paid_through_itc: R(useIGSTforSGST + useSGSTforSGST), paid_cash: R(Math.max(0, paySGST)), interest: 0, late_fee: 0 },
      cess: { tax_payable: 0, paid_through_itc: 0, paid_cash: 0 },
    };

    const netPayable = R(table61.igst.paid_cash + table61.cgst.paid_cash + table61.sgst.paid_cash);

    const gstr3bWorking = {
      gstin:  shop.gstin,
      period: `${String(m).padStart(2, '0')}-${y}`,
      table31, table32, table4, table5, table61,
      blocked_by_reason: blockedByReason,
      summary: {
        gross_turnover:    R(sumField(sales, 'total_amount')),
        total_taxable:     R(sumField(sales, 'taxable_amount')),
        output_igst:       R(outIGST),
        output_cgst:       R(outCGST),
        output_sgst:       R(outSGST),
        total_output_tax:  R(outIGST + outCGST + outSGST),
        itc_igst:          R(itcIGST),
        itc_cgst:          R(itcCGST),
        itc_sgst:          R(itcSGST),
        itc_available:     R(itcIGST + itcCGST + itcSGST),
        net_tax_payable:   netPayable,
        b2b_invoices:      sales.filter(s => s.is_b2b || s.buyer_gstin).length,
        b2c_invoices:      sales.filter(s => !s.is_b2b && !s.buyer_gstin).length,
        credit_notes:      creditNotes.length,
        purchase_count:    purchases.length,
        eligible_itc_purchases: eligiblePurchases.length,
        rcm_purchases:          rcmPurchases.length,
        blocked_purchases:      blockedPurchases.length,
      },
    };

    res.json(gstr3bWorking);
  } catch (err) {
    logger.error('generateGSTR3B error:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE GSTIN ENDPOINT
// POST /api/gst/validate-gstin  { gstin: "..." }
// ─────────────────────────────────────────────────────────────────────────────

const validateGSTINEndpoint = (req, res) => {
  const { gstin } = req.body;
  const result = validateGSTIN(gstin);
  res.json(result);
};

// ─────────────────────────────────────────────────────────────────────────────
// FILING PERIOD INFO
// GET /api/gst/filing-period
// ─────────────────────────────────────────────────────────────────────────────

const getFilingPeriodInfo = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { getCurrentFilingPeriod } = require('../lib/gstUtils');
    const period = getCurrentFilingPeriod(shop);
    res.json({ period, shop: { gstin: shop.gstin, gst_type: shop.gst_type, filing_frequency: shop.filing_frequency } });
  } catch (err) {
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

module.exports = { generateGSTR1, generateGSTR3B, validateGSTINEndpoint, getFilingPeriodInfo };
