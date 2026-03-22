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

const getDashboardSummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;
    const createdAt = getDateRange(month, year);

    const salesFilter = { shop: shop._id, ...(createdAt ? { createdAt } : {}) };
    const purchaseFilter = { shop: shop._id, ...(createdAt ? { createdAt } : {}) };

    const [sales, products, customers, purchasesAgg, salesAgg] = await Promise.all([
      Sale.find(salesFilter).select('items product_name quantity total_amount createdAt taxable_amount total_gst total_cost gross_profit'),
      Product.find({ shop: shop._id }).select('name quantity stock is_low_stock'),
      Customer.find({ shop: shop._id }).select('totalUdhaar'),
      Purchase.aggregate([
        { $match: purchaseFilter },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$total_amount' },
            totalITC: { $sum: '$total_gst' },
            purchasesCount: { $sum: 1 },
          },
        },
      ]),
      Sale.aggregate([
        { $match: salesFilter },
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
      ]),
    ]);

    const purchaseSummary = purchasesAgg[0] || { totalSpent: 0, totalITC: 0, purchasesCount: 0 };
    const salesSummary = salesAgg[0] || {
      totalRevenue: 0,
      totalTaxable: 0,
      totalGSTCollected: 0,
      totalCOGS: 0,
      totalGrossProfit: 0,
      salesCount: 0,
    };

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

    const lowStockProducts = products
      .filter((product) => (product.quantity ?? product.stock ?? 0) <= 5)
      .sort((a, b) => (a.quantity ?? a.stock ?? 0) - (b.quantity ?? b.stock ?? 0))
      .slice(0, 6)
      .map((product) => ({
        _id: product._id,
        name: product.name,
        quantity: product.quantity ?? product.stock ?? 0,
      }));

    const totalCustomerUdhaar = customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0);
    const netGSTPayable = Number((salesSummary.totalGSTCollected - purchaseSummary.totalITC).toFixed(2));

    res.json({
      stats: {
        totalRevenue: Number((salesSummary.totalRevenue || 0).toFixed(2)),
        totalTaxable: Number((salesSummary.totalTaxable || 0).toFixed(2)),
        salesCount: salesSummary.salesCount || 0,
        totalCOGS: Number((salesSummary.totalCOGS || 0).toFixed(2)),
        grossProfit: Number((salesSummary.totalGrossProfit || 0).toFixed(2)),
        netProfit: Number((salesSummary.totalGrossProfit || 0).toFixed(2)),
        gstCollected: Number((salesSummary.totalGSTCollected || 0).toFixed(2)),
        gstITC: Number((purchaseSummary.totalITC || 0).toFixed(2)),
        netGSTPayable,
        totalSpent: Number((purchaseSummary.totalSpent || 0).toFixed(2)),
        purchasesCount: purchaseSummary.purchasesCount || 0,
      },
      topProducts,
      lowStockProducts,
      lowStockCount: lowStockProducts.length,
      totalCustomerUdhaar: Number(totalCustomerUdhaar.toFixed(2)),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
};
