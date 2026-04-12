const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Shop = require('../models/shopModel');

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

    const [sales, products, customers, todaySalesSummary, monthSalesSummary, monthPurchaseSummary] = await Promise.all([
      Sale.find({ shop: shop._id }).select('items product_name quantity total_amount createdAt taxable_amount total_gst total_cost gross_profit'),
      Product.find({ shop: shop._id }).select('name quantity stock low_stock_threshold is_low_stock'),
      Customer.find({ shop: shop._id }).select('name phone totalUdhaar').sort({ totalUdhaar: -1 }),
      aggregateSalesSummary({ shop: shop._id, createdAt: todayRange }),
      aggregateSalesSummary({ shop: shop._id, createdAt: monthRange }),
      aggregatePurchaseSummary({ shop: shop._id, createdAt: monthRange }),
    ]);

    const productSalesMap = {};
    sales.forEach((sale) => {
      const items = sale.items?.length
        ? sale.items
        : [{
            product_name: sale.product_name,
            quantity: sale.quantity,
            total_amount: sale.total_amount,
          }];

      items.forEach((item) => {
        const key = item.product_name;
        if (!key) return;
        if (!productSalesMap[key]) {
          productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
        }
        productSalesMap[key].qty += item.quantity || 0;
        productSalesMap[key].revenue += item.total_amount || 0;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const outOfStockProducts = products.filter((product) => (product.quantity ?? product.stock ?? 0) <= 0);
    const lowStockProducts = products.filter((product) => {
      const quantity = product.quantity ?? product.stock ?? 0;
      const threshold = product.low_stock_threshold ?? 5;
      return quantity > 0 && quantity <= threshold;
    });

    const stockAlertItems = [...outOfStockProducts, ...lowStockProducts]
      .sort((a, b) => (a.quantity ?? a.stock ?? 0) - (b.quantity ?? b.stock ?? 0))
      .slice(0, 6)
      .map((product) => ({
        _id: product._id,
        name: product.name,
        quantity: product.quantity ?? product.stock ?? 0,
      }));

    const totalCustomerUdhaar = customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0);
    const pendingCustomers = customers.filter((customer) => Number(customer.totalUdhaar || 0) > 0);
    const topCustomers = pendingCustomers.slice(0, 5).map((customer) => ({
      _id: customer._id,
      name: customer.name,
      phone: customer.phone,
      due: round2(customer.totalUdhaar),
    }));
    const netGSTPayable = round2(monthSalesSummary.totalGSTCollected - monthPurchaseSummary.totalITC);

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
        pendingCount: pendingCustomers.length,
        topCustomers,
      },
      gst: {
        collected: round2(monthSalesSummary.totalGSTCollected),
        itc: round2(monthPurchaseSummary.totalITC),
        netPayable: netGSTPayable,
      },
      stock: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
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
      topProducts,
      lowStockProducts: stockAlertItems,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      totalCustomerUdhaar: round2(totalCustomerUdhaar),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
};
