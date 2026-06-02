'use strict';

const Purchase = require('../models/purchaseModel');
const Shop     = require('../models/shopModel');
const { round2 } = require('../lib/gstUtils');

const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const sumGST = (arr) => arr.reduce((acc, p) => ({
  taxable: round2(acc.taxable + (p.taxable_amount || 0)),
  cgst:    round2(acc.cgst    + (p.cgst_amount    || 0)),
  sgst:    round2(acc.sgst    + (p.sgst_amount    || 0)),
  igst:    round2(acc.igst    + (p.igst_amount    || 0)),
  total:   round2(acc.total   + (p.total_gst      || p.total_tax || 0)),
}), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// ITC REGISTER
// GET /api/itc/register?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────

const getITCRegister = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate   = to   ? new Date(to)   : new Date();
    toDate.setHours(23, 59, 59, 999);

    const purchases = await Purchase.find({
      shop: shop._id,
      $or: [
        { supplier_invoice_date: { $gte: fromDate, $lte: toDate } },
        { createdAt: { $gte: fromDate, $lte: toDate } },
      ],
    }).sort({ supplier_invoice_date: 1, createdAt: 1 }).lean();

    // Categorise by ITC eligibility
    const eligible = purchases.filter(p => p.itc_eligible !== false && !p.is_reverse_charge);
    const rcm      = purchases.filter(p => p.is_reverse_charge);
    const blocked  = purchases.filter(p => p.itc_eligible === false && !p.is_reverse_charge);

    const eligibleTotals = sumGST(eligible);
    const rcmTotals      = sumGST(rcm);
    const blockedTotals  = sumGST(blocked);

    res.json({
      period: { from: fromDate, to: toDate },
      eligible: {
        purchases: eligible,
        totals:    eligibleTotals,
      },
      rcm: {
        purchases: rcm,
        totals:    rcmTotals,
        note:      'Claimable only after actual payment to supplier',
      },
      blocked: {
        purchases: blocked,
        totals:    blockedTotals,
      },
      net_itc_available: round2(eligibleTotals.total + rcmTotals.total),
      total_blocked:     round2(blockedTotals.total),
    });
  } catch (err) {
    logger.error('getITCRegister error:', err);
    res.status(500).json({ message: err.message || 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ITC SUMMARY — GSTR-3B Table 4 format
// GET /api/itc/summary?month=MM&year=YYYY
// ─────────────────────────────────────────────────────────────────────────────

const getITCSummary = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'month and year are required' });

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const fromDate = new Date(y, m - 1, 1);
    const toDate   = new Date(y, m, 0, 23, 59, 59, 999);

    const purchases = await Purchase.find({
      shop: shop._id,
      $or: [
        { supplier_invoice_date: { $gte: fromDate, $lte: toDate } },
        { createdAt: { $gte: fromDate, $lte: toDate } },
      ],
    }).lean();

    const eligible = purchases.filter(p => p.itc_eligible !== false && !p.is_reverse_charge);
    const rcm      = purchases.filter(p => p.is_reverse_charge);
    const blocked  = purchases.filter(p => p.itc_eligible === false && !p.is_reverse_charge);

    const eligibleTotals = sumGST(eligible);
    const rcmTotals      = sumGST(rcm);
    const blockedTotals  = sumGST(blocked);

    const netITC = round2(eligibleTotals.total + rcmTotals.total);

    // GSTR-3B Table 4 structure
    const table4 = {
      A_itc_available: {
        a_import_goods:    { igst: 0, cgst: 0, sgst: 0 },
        b_import_services: { igst: 0, cgst: 0, sgst: 0 },
        c_inward_rcm:      { igst: rcmTotals.igst, cgst: rcmTotals.cgst, sgst: rcmTotals.sgst },
        d_isd_credits:     { igst: 0, cgst: 0, sgst: 0 },
        e_all_other_itc:   { igst: eligibleTotals.igst, cgst: eligibleTotals.cgst, sgst: eligibleTotals.sgst },
      },
      B_itc_reversed: {
        a_rule_42_43: { igst: 0, cgst: 0, sgst: 0 },
        b_others:     { igst: 0, cgst: 0, sgst: 0 },
      },
      C_net_itc: {
        igst: round2(eligibleTotals.igst + rcmTotals.igst),
        cgst: round2(eligibleTotals.cgst + rcmTotals.cgst),
        sgst: round2(eligibleTotals.sgst + rcmTotals.sgst),
        total: netITC,
      },
      D_ineligible: {
        a_section_17_5: { igst: blockedTotals.igst, cgst: blockedTotals.cgst, sgst: blockedTotals.sgst, total: blockedTotals.total },
        b_others:       { igst: 0, cgst: 0, sgst: 0 },
      },
    };

    res.json({
      period: `${String(m).padStart(2, '0')}-${y}`,
      table4,
      summary: {
        eligible_purchases: eligible.length,
        rcm_purchases:      rcm.length,
        blocked_purchases:  blocked.length,
        eligible_itc:       eligibleTotals.total,
        rcm_itc:            rcmTotals.total,
        blocked_amount:     blockedTotals.total,
        net_itc_available:  netITC,
      },
    });
  } catch (err) {
    logger.error('getITCSummary error:', err);
    res.status(500).json({ message: err.message || 'Something went wrong' });
  }
};

module.exports = { getITCRegister, getITCSummary };
