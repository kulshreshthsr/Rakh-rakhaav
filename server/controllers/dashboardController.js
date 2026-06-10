const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Shop = require('../models/shopModel');
const WarrantyClaim = require('../models/warrantyClaimModel');
const { checkUsageUpgrade } = require('../services/tierInference');
const { calculateGSTR3BSummary } = require('./salesController');

const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const getDateRange = (month, year) => {
  if (!month || !year) return null;
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
  return { $gte: start, $lte: end };
};

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

const getPrimaryRange = (rangeStr) => {
  const now = new Date();
  if (rangeStr === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: now };
  }
  if (rangeStr === 'month') return getCurrentMonthRange();
  if (rangeStr === 'last_month') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      $lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  return getTodayRange();
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const aggregateSalesSummary = async (match) => {
  const result = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total_amount' },
        totalTaxable: { $sum: '$taxable_amount' },
        totalGSTCollected: { $sum: '$total_gst' },
        totalCOGS: { $sum: '$total_cost' },
        totalGrossProfit: { $sum: '$gross_profit' },
        salesCount: { $sum: 1 },
      },
    },
  ]);

  return result[0] || {
    totalRevenue: 0,
    totalTaxable: 0,
    totalGSTCollected: 0,
    totalCOGS: 0,
    totalGrossProfit: 0,
    salesCount: 0,
  };
};

const aggregatePurchaseSummary = async (match) => {
  const result = await Purchase.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$total_amount' },
        totalITC: { $sum: '$total_gst' },
        purchasesCount: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalSpent: 0, totalITC: 0, purchasesCount: 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY_EXTRA_DATA — O(1) dispatch replacing if-chains
// Each function returns an object with the extra fields for that business type.
// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRY_EXTRA_DATA = {
  electronics: async (shopId) => {
    const [pendingCount, readyCount] = await Promise.all([
      WarrantyClaim.countDocuments({ shop: shopId, claimStatus: { $in: ['received', 'sent_to_brand', 'under_repair'] } }),
      WarrantyClaim.countDocuments({ shop: shopId, claimStatus: 'ready' }),
    ]);
    return { warrantySummary: { pendingCount, readyCount } };
  },
};

const EXTRA_DEFAULTS = {
  warrantySummary: null,
};

const getDashboardSummary = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { month, year, range } = req.query;
    const requestedRange = getDateRange(month, year);
    const monthRange    = requestedRange || getCurrentMonthRange();
    const primaryRange  = getPrimaryRange(range);
    const shopId        = shop._id;

    const now = new Date();
    const yesterdayRange = {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0),
      $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59),
    };

    const [
      primarySalesSummary,
      yesterdaySalesSummary,
      monthSalesSummary,
      monthPurchaseSummary,
      topProductsAgg,
      stockAlertItems,
      udhaarSummary,
      topCustomers,
      creditPurchasesDueAgg,
    ] = await Promise.all([
      aggregateSalesSummary({ shop: shopId, createdAt: primaryRange }),
      aggregateSalesSummary({ shop: shopId, createdAt: yesterdayRange }),
      aggregateSalesSummary({ shop: shopId, createdAt: monthRange }),
      aggregatePurchaseSummary({ shop: shopId, createdAt: monthRange }),
      Sale.aggregate([
        { $match: { shop: shopId } },
        {
          $facet: {
            fromItems: [
              { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
              { $match: { 'items.product_name': { $nin: [null, ''] } } },
              { $group: { _id: '$items.product_name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total_amount' } } },
            ],
            fromLegacy: [
              { $match: { $expr: { $eq: [{ $size: { $ifNull: ['$items', []] } }, 0] }, product_name: { $nin: [null, ''] } } },
              { $group: { _id: '$product_name', qty: { $sum: '$quantity' }, revenue: { $sum: '$total_amount' } } },
            ],
          },
        },
        { $project: { combined: { $concatArrays: ['$fromItems', '$fromLegacy'] } } },
        { $unwind: '$combined' },
        { $group: { _id: '$combined._id', qty: { $sum: '$combined.qty' }, revenue: { $sum: '$combined.revenue' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', qty: 1, revenue: 1 } },
      ]),
      Product.find({
        shop: shopId,
        $expr: { $lte: ['$quantity', '$low_stock_threshold'] },
      })
        .select('name quantity')
        .sort({ quantity: 1 })
        .limit(6)
        .lean(),
      Customer.aggregate([
        { $match: { shop: shopId } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalUdhaar' },
            pendingCount: { $sum: { $cond: [{ $gt: ['$totalUdhaar', 0] }, 1, 0] } },
          },
        },
      ]),
      Customer.find({ shop: shopId, totalUdhaar: { $gt: 0 } })
        .select('name phone totalUdhaar')
        .sort({ totalUdhaar: -1 })
        .limit(5)
        .lean(),
      Purchase.aggregate([
        { $match: { shop: shopId } },
        {
          $group: {
            _id: null,
            totalDue: {
              $sum: {
                $max: [{ $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] }, 0],
              },
            },
            creditCount: {
              $sum: {
                $cond: [
                  { $gt: [{ $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] }, 0] },
                  1, 0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    // Payment method split for primary range
    const paymentSplitAgg = await Sale.aggregate([
      { $match: { shop: shopId, createdAt: primaryRange } },
      {
        $group: {
          _id: null,
          cashReceived:  { $sum: { $cond: [{ $in: ['$payment_type', ['cash']] },  '$total_amount', 0] } },
          upiReceived:   { $sum: { $cond: [{ $in: ['$payment_type', ['upi']] },   '$total_amount', 0] } },
          bankReceived:  { $sum: { $cond: [{ $in: ['$payment_type', ['bank']] },  '$total_amount', 0] } },
          creditGiven:   { $sum: { $cond: [{ $eq:  ['$payment_type', 'credit'] }, '$total_amount', 0] } },
          partialCredit: { $sum: '$balance_due' },
          cashCount:     { $sum: { $cond: [{ $in: ['$payment_type', ['cash', 'upi', 'bank']] }, 1, 0] } },
          creditCount:   { $sum: { $cond: [{ $eq:  ['$payment_type', 'credit'] }, 1, 0] } },
        },
      },
    ]);
    const split = paymentSplitAgg[0] || {
      cashReceived: 0, upiReceived: 0, bankReceived: 0,
      creditGiven: 0, partialCredit: 0, cashCount: 0, creditCount: 0,
    };
    const cashInHand = split.cashReceived + split.upiReceived + split.bankReceived;
    const totalCreditToday = split.creditGiven + split.partialCredit;

    const totalCustomerUdhaar = udhaarSummary[0]?.total || 0;
    const pendingCount = udhaarSummary[0]?.pendingCount || 0;

    // Head-wise ITC set-off via GSTR-3B calculation (always calendar month)
    const [monthSalesRaw, monthPurchasesRaw] = await Promise.all([
      Sale.find({ shop: shopId, createdAt: monthRange }).select('taxable_amount cgst_amount sgst_amount igst_amount').lean(),
      Purchase.find({ shop: shopId, createdAt: monthRange }).select('taxable_amount cgst_amount sgst_amount igst_amount').lean(),
    ]);
    const gstr3b = calculateGSTR3BSummary(monthSalesRaw, monthPurchasesRaw);
    const netGSTPayable = gstr3b.net_payable;

    const outOfStockCount = stockAlertItems.filter((p) => (p.quantity ?? 0) <= 0).length;
    const lowStockCount   = stockAlertItems.filter((p) => (p.quantity ?? 0) > 0).length;

    const shopStateWarning = !shop.state;

    // Industry-specific extra data via O(1) map lookup
    const extraDataFn = INDUSTRY_EXTRA_DATA[shop.businessType];
    const rawExtra    = extraDataFn ? await extraDataFn(shopId, shop) : {};
    const extra       = { ...EXTRA_DEFAULTS, ...rawExtra };

    const creditPurchasesDue   = creditPurchasesDueAgg[0]?.totalDue   || 0;
    const creditPurchasesCount = creditPurchasesDueAgg[0]?.creditCount || 0;

    const responseObj = {
      today: {
        revenue: round2(primarySalesSummary.totalRevenue),
        bills:   primarySalesSummary.salesCount || 0,
        profit:  round2(primarySalesSummary.totalGrossProfit),
        range:   range || 'today',
      },
      yesterday: {
        revenue: round2(yesterdaySalesSummary.totalRevenue),
        profit:  round2(yesterdaySalesSummary.totalGrossProfit),
        bills:   yesterdaySalesSummary.salesCount || 0,
      },
      month: {
        revenue:        round2(monthSalesSummary.totalRevenue),
        profit:         round2(monthSalesSummary.totalGrossProfit),
        purchases:      round2(monthPurchaseSummary.totalSpent),
        purchasesCount: monthPurchaseSummary.purchasesCount || 0,
      },
      udhaar: {
        totalDue:     round2(totalCustomerUdhaar),
        pendingCount,
        topCustomers: topCustomers.map((c) => ({
          _id:   c._id,
          name:  c.name,
          phone: c.phone,
          due:   round2(c.totalUdhaar),
        })),
      },
      gst: {
        collected:     round2(monthSalesSummary.totalGSTCollected),
        itcAvailable:  round2(monthPurchaseSummary.totalITC),
        itc:           round2(monthPurchaseSummary.totalITC),
        netPayable:    netGSTPayable,
        payableByHead: gstr3b.payable_by_head,
        shopStateWarning,
      },
      stock: {
        lowStockCount,
        outOfStockCount,
        lowStockItems: stockAlertItems,
      },
      purchases: {
        totalDue:    round2(creditPurchasesDue),
        creditCount: creditPurchasesCount,
      },
      stats: {
        totalRevenue: round2(monthSalesSummary.totalRevenue),
        totalTaxable: round2(monthSalesSummary.totalTaxable),
        salesCount:   monthSalesSummary.salesCount || 0,
        totalCOGS:    round2(monthSalesSummary.totalCOGS),
        grossProfit:  round2(monthSalesSummary.totalGrossProfit),
        netProfit:    round2(monthSalesSummary.totalGrossProfit),
        gstCollected: round2(monthSalesSummary.totalGSTCollected),
        gstITC:       round2(monthPurchaseSummary.totalITC),
        netGSTPayable,
        gstPayableByHead: gstr3b.payable_by_head,
        totalSpent:      round2(monthPurchaseSummary.totalSpent),
        purchasesCount:  monthPurchaseSummary.purchasesCount || 0,
      },
      shopStateWarning,
      topProducts:     topProductsAgg,
      lowStockProducts: stockAlertItems,
      lowStockCount,
      outOfStockCount,
      totalCustomerUdhaar: round2(totalCustomerUdhaar),
      paymentSplit: {
        cashInHand:  round2(cashInHand),
        creditGiven: round2(totalCreditToday),
        cashCount:   split.cashCount,
        creditCount: split.creditCount,
        upiAmount:   round2(split.upiReceived),
        cashAmount:  round2(split.cashReceived),
      },
      expiryStats:      extra.expiryStats,
      insurancePending: extra.insurancePending,
      variantLowStock:  extra.variantLowStock,
      warrantySummary:  extra.warrantySummary,
      pendingPickup:    extra.pendingPickup,
      fetchedAt: new Date().toISOString(),
    };

    res.json(responseObj);

    // Fire-and-forget tier upgrade check
    setImmediate(async () => {
      try {
        const usageStats = {
          totalSales:     responseObj.stats?.salesCount     || 0,
          totalPurchases: responseObj.month?.purchasesCount || 0,
          totalSuppliers: 0,
          monthlyRevenue: responseObj.month?.revenue        || 0,
          creditSalesPct: responseObj.paymentSplit?.creditGiven > 0
            ? responseObj.paymentSplit.creditGiven / (responseObj.today?.revenue || 1)
            : 0,
          totalProducts:  (responseObj.lowStockCount || 0) + (responseObj.outOfStockCount || 0),
          subUserCount:   0,
        };
        const upgrade = checkUsageUpgrade(shop, usageStats);
        if (upgrade) {
          await Shop.findByIdAndUpdate(shop._id, {
            $set:  { businessTier: upgrade.newTier },
            $push: { tierHistory: { from: shop.businessTier, to: upgrade.newTier, reason: upgrade.reason } },
          });
        }
      } catch { /* never crash the response */ }
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const FINAL_WORKFLOW_STATUSES = new Set(['paid', 'delivered', 'completed', 'sold', 'served', 'dispensed']);

const workflowCounts = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const results = await Sale.aggregate([
      {
        $match: {
          shop: shop._id,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          'extra_fields.workflow_status': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$extra_fields.workflow_status', count: { $sum: 1 } } },
    ]);

    const counts = {};
    let pendingTotal = 0;
    results.forEach(r => {
      if (r._id) {
        counts[r._id] = r.count;
        if (!FINAL_WORKFLOW_STATUSES.has(r._id)) pendingTotal += r.count;
      }
    });

    res.json({ counts, pendingTotal, asOf: new Date().toISOString() });
  } catch (err) {
    logger.error('workflowCounts error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const creditAging = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const shopId = shop._id;
    const now = new Date();

    const agedCredits = await Sale.aggregate([
      {
        $match: {
          shop: shopId,
          payment_status: { $in: ['unpaid', 'partial'] },
          balance_due: { $gt: 0 },
        },
      },
      {
        $addFields: {
          ageDays: {
            $floor: {
              $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
      },
      {
        $group: {
          _id:           { customerId: '$customer', buyerName: '$buyer_name', buyerPhone: '$buyer_phone' },
          totalDue:      { $sum: '$balance_due' },
          billCount:     { $sum: 1 },
          oldestBillAge: { $max: '$ageDays' },
          newestBillAge: { $min: '$ageDays' },
          bills: {
            $push: {
              invoiceNumber: '$invoice_number',
              amount:        '$total_amount',
              balanceDue:    '$balance_due',
              ageDays:       '$ageDays',
              date:          '$createdAt',
            },
          },
        },
      },
      {
        $addFields: {
          agingBucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$oldestBillAge', 30] }, then: '0-30 days'  },
                { case: { $lte: ['$oldestBillAge', 60] }, then: '31-60 days' },
                { case: { $lte: ['$oldestBillAge', 90] }, then: '61-90 days' },
              ],
              default: '90+ days',
            },
          },
        },
      },
      { $sort: { oldestBillAge: -1 } },
    ]);

    const summary = {
      '0-30 days':  { count: 0, total: 0 },
      '31-60 days': { count: 0, total: 0 },
      '61-90 days': { count: 0, total: 0 },
      '90+ days':   { count: 0, total: 0 },
    };
    let grandTotal = 0;
    agedCredits.forEach(c => {
      if (summary[c.agingBucket]) {
        summary[c.agingBucket].count += 1;
        summary[c.agingBucket].total  = round2(summary[c.agingBucket].total + c.totalDue);
      }
      grandTotal += c.totalDue;
    });

    res.json({ customers: agedCredits, summary, grandTotal: round2(grandTotal), asOf: now.toISOString() });
  } catch (err) {
    logger.error('creditAging error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getDashboardSummary,
  workflowCounts,
  creditAging,
};
