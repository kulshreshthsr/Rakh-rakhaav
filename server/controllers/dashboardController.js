const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Shop = require('../models/shopModel');
const WarrantyClaim = require('../models/warrantyClaimModel');
const ruleEngine = require('../services/ruleEngine');
const { calculateGSTR3BSummary } = require('./salesController');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) {
    shop = await Shop.create({ name: 'My Shop', owner: userId });
  }
  return shop;
};

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

const getDashboardSummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;
    const requestedRange = getDateRange(month, year);
    const monthRange = requestedRange || getCurrentMonthRange();
    const todayRange = getTodayRange();
    const shopId = shop._id;

    const [
      todaySalesSummary,
      monthSalesSummary,
      monthPurchaseSummary,
      topProductsAgg,
      stockAlertItems,
      udhaarSummary,
      topCustomers,
    ] = await Promise.all([
      aggregateSalesSummary({ shop: shopId, createdAt: todayRange }),
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
    ]);

    // Payment method split for today's bills
    const paymentSplitAgg = await Sale.aggregate([
      { $match: { shop: shopId, createdAt: todayRange } },
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

    // Proper head-wise ITC set-off via GSTR-3B calculation
    const [monthSalesRaw, monthPurchasesRaw] = await Promise.all([
      Sale.find({ shop: shopId, createdAt: monthRange }).select('taxable_amount cgst_amount sgst_amount igst_amount').lean(),
      Purchase.find({ shop: shopId, createdAt: monthRange }).select('taxable_amount cgst_amount sgst_amount igst_amount').lean(),
    ]);
    const gstr3b = calculateGSTR3BSummary(monthSalesRaw, monthPurchasesRaw);
    const netGSTPayable = gstr3b.net_payable;

    const outOfStockCount = stockAlertItems.filter((p) => (p.quantity ?? 0) <= 0).length;
    const lowStockCount = stockAlertItems.filter((p) => (p.quantity ?? 0) > 0).length;

    const shopStateWarning = !shop.state;

    // Pharmacy-specific: near-expiry product counts
    let expiryStats = { expiredCount: 0, expiring7Days: 0, expiring30Days: 0 };
    let insurancePending = 0;
    if (shop.businessType === 'pharmacy') {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in7Days  = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000);

      const expiryPipeline = [
        {
          $match: {
            shop: shopId,
            isActive: { $ne: false },
            'metadata.expiry_date': { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $addFields: {
            expiryDateParsed: {
              $cond: {
                if:   { $eq: [{ $type: '$metadata.expiry_date' }, 'string'] },
                then: { $dateFromString: { dateString: '$metadata.expiry_date', onError: null } },
                else: '$metadata.expiry_date',
              },
            },
          },
        },
        { $match: { expiryDateParsed: { $ne: null, $lte: in30Days } } },
        {
          $group: {
            _id: null,
            expiredCount:   { $sum: { $cond: [{ $lt: ['$expiryDateParsed', now] },     1, 0] } },
            expiring7Days:  { $sum: { $cond: [{ $lte: ['$expiryDateParsed', in7Days] }, 1, 0] } },
            expiring30Days: { $sum: 1 },
          },
        },
      ];

      const [expiryResult, insCount] = await Promise.all([
        Product.aggregate(expiryPipeline),
        Sale.countDocuments({
          shop: shopId,
          insurance_status: 'pending_claim',
          insurance_type: { $exists: true, $nin: [null, '', 'none'] },
        }),
      ]);

      const e = expiryResult[0] || {};
      expiryStats = {
        expiredCount:   e.expiredCount   || 0,
        expiring7Days:  e.expiring7Days  || 0,
        expiring30Days: e.expiring30Days || 0,
      };
      insurancePending = insCount || 0;
    }

    // Electronics/mobile: warranty claims summary
    let warrantySummary = null;
    if (shop.businessType === 'electronics' || shop.businessType === 'mobile_shop') {
      const [pendingDocs, readyCount] = await Promise.all([
        WarrantyClaim.countDocuments({ shop: shopId, claimStatus: { $in: ['received', 'sent_to_brand', 'under_repair'] } }),
        WarrantyClaim.countDocuments({ shop: shopId, claimStatus: 'ready' }),
      ]);
      warrantySummary = { pendingCount: pendingDocs, readyCount };
    }

    // Clothing/footwear: size-wise low-stock aggregation from ProductVariant collection
    let variantLowStock = [];
    if (shop.businessType === 'clothing' || shop.businessType === 'footwear') {
      variantLowStock = await ProductVariant.aggregate([
        { $match: { shop: shopId, isActive: true } },
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'productDoc' } },
        { $unwind: '$productDoc' },
        { $match: { 'productDoc.isActive': { $ne: false }, $expr: { $lte: ['$quantity', '$productDoc.low_stock_threshold'] } } },
        { $group: { _id: '$size', productCount: { $sum: 1 }, products: { $push: '$productDoc.name' }, totalQty: { $sum: '$quantity' } } },
        { $sort: { productCount: -1 } },
        { $limit: 5 },
      ]);
    }

    res.json({
      today: {
        revenue: round2(todaySalesSummary.totalRevenue),
        bills: todaySalesSummary.salesCount || 0,
        profit: round2(todaySalesSummary.totalGrossProfit),
      },
      month: {
        revenue: round2(monthSalesSummary.totalRevenue),
        profit: round2(monthSalesSummary.totalGrossProfit),
        purchases: round2(monthPurchaseSummary.totalSpent),
        purchasesCount: monthPurchaseSummary.purchasesCount || 0,
      },
      udhaar: {
        totalDue: round2(totalCustomerUdhaar),
        pendingCount,
        topCustomers: topCustomers.map((c) => ({
          _id: c._id,
          name: c.name,
          phone: c.phone,
          due: round2(c.totalUdhaar),
        })),
      },
      gst: {
        collected: round2(monthSalesSummary.totalGSTCollected),
        itc: round2(monthPurchaseSummary.totalITC),
        netPayable: netGSTPayable,
        payableByHead: gstr3b.payable_by_head,
        shopStateWarning,
      },
      stock: {
        lowStockCount,
        outOfStockCount,
        lowStockItems: stockAlertItems,
      },
      stats: {
        totalRevenue: round2(monthSalesSummary.totalRevenue),
        totalTaxable: round2(monthSalesSummary.totalTaxable),
        salesCount: monthSalesSummary.salesCount || 0,
        totalCOGS: round2(monthSalesSummary.totalCOGS),
        grossProfit: round2(monthSalesSummary.totalGrossProfit),
        netProfit: round2(monthSalesSummary.totalGrossProfit),
        gstCollected: round2(monthSalesSummary.totalGSTCollected),
        gstITC: round2(monthPurchaseSummary.totalITC),
        netGSTPayable,
        gstPayableByHead: gstr3b.payable_by_head,
        totalSpent: round2(monthPurchaseSummary.totalSpent),
        purchasesCount: monthPurchaseSummary.purchasesCount || 0,
      },
      shopStateWarning,
      topProducts: topProductsAgg,
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
      expiryStats,
      insurancePending,
      variantLowStock,
      warrantySummary,
      fetchedAt: new Date().toISOString(),
    });

    // Fire-and-forget rule scan — never blocks the response
    ruleEngine.scanShop(shop._id, shop.businessType || 'general').catch(() => {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const FINAL_WORKFLOW_STATUSES = new Set(['paid', 'delivered', 'completed', 'sold', 'served', 'dispensed']);

const workflowCounts = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const results = await Sale.aggregate([
      {
        $match: {
          shop: shop._id,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          'extra_fields.workflow_status': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$extra_fields.workflow_status',
          count: { $sum: 1 },
        },
      },
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
    console.error('workflowCounts error:', err);
    res.status(500).json({ message: err.message });
  }
};

const creditAging = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
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
              $divide: [
                { $subtract: [now, '$createdAt'] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: {
            customerId: '$customer',
            buyerName:  '$buyer_name',
            buyerPhone: '$buyer_phone',
          },
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

    res.json({
      customers: agedCredits,
      summary,
      grandTotal: round2(grandTotal),
      asOf: now.toISOString(),
    });
  } catch (err) {
    console.error('creditAging error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TABLE STATUS (Restaurant only)
// ─────────────────────────────────────────────────────────────────────────────
const tableStatus = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    if (shop.businessType !== 'restaurant') {
      return res.status(400).json({ message: 'Not applicable' });
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // Daily reset: mark products available if availability_set_at < today
    const Product = require('../models/productModel');
    await Product.updateMany(
      {
        shop: shop._id,
        'metadata.availability_set_at': { $lt: todayStart.toISOString() },
        'metadata.is_available_today': 'false',
      },
      { $set: { 'metadata.is_available_today': 'true', 'metadata.unavailable_reason': '' } }
    );

    const activeTables = await Sale.find({
      shop: shop._id,
      createdAt: { $gte: todayStart },
      payment_status: { $in: ['unpaid', 'partial'] },
    }).select('extra_fields invoice_number total_amount createdAt buyer_name items');

    const tableMap = {};
    activeTables.forEach(sale => {
      const ef = sale.extra_fields instanceof Map ? Object.fromEntries(sale.extra_fields) : (sale.extra_fields || {});
      const tableNo = ef.table_no;
      if (!tableNo) return;
      if (!tableMap[tableNo]) {
        tableMap[tableNo] = { tableNo, status: 'occupied', orders: [], totalAmount: 0, occupiedSince: sale.createdAt };
      }
      tableMap[tableNo].orders.push({ invoiceNo: sale.invoice_number, amount: sale.total_amount, guestName: sale.buyer_name, itemCount: sale.items?.length || 0, time: sale.createdAt });
      tableMap[tableNo].totalAmount += sale.total_amount;
      if (sale.createdAt < tableMap[tableNo].occupiedSince) tableMap[tableNo].occupiedSince = sale.createdAt;
    });

    res.json({ occupiedTables: Object.values(tableMap), occupiedCount: Object.keys(tableMap).length, asOf: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDashboardSummary,
  workflowCounts,
  creditAging,
  tableStatus,
};
