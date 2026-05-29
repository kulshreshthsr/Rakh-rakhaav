const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Shop = require('../models/shopModel');
const ruleEngine = require('../services/ruleEngine');

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

    const totalCustomerUdhaar = udhaarSummary[0]?.total || 0;
    const pendingCount = udhaarSummary[0]?.pendingCount || 0;
    const netGSTPayable = round2(monthSalesSummary.totalGSTCollected - monthPurchaseSummary.totalITC);
    const outOfStockCount = stockAlertItems.filter((p) => (p.quantity ?? 0) <= 0).length;
    const lowStockCount = stockAlertItems.filter((p) => (p.quantity ?? 0) > 0).length;

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
        totalSpent: round2(monthPurchaseSummary.totalSpent),
        purchasesCount: monthPurchaseSummary.purchasesCount || 0,
      },
      topProducts: topProductsAgg,
      lowStockProducts: stockAlertItems,
      lowStockCount,
      outOfStockCount,
      totalCustomerUdhaar: round2(totalCustomerUdhaar),
      fetchedAt: new Date().toISOString(),
    });

    // Fire-and-forget rule scan — never blocks the response
    ruleEngine.scanShop(shop._id, shop.businessType || 'general').catch(() => {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
};
