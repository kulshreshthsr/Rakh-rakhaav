const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getSales = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const sales = await Sale.find({ shop: shop._id })
      .populate('product', 'name')
      .sort({ createdAt: -1 });
    const result = sales.map(s => ({
      id: s._id,
      product_name: s.product?.name,
      quantity: s.quantity,
      price_per_unit: s.price_per_unit,
      total_amount: s.total_amount,
      sold_at: s.createdAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSale = async (req, res) => {
  const { product_id, quantity, price_per_unit } = req.body;
  const total_amount = quantity * price_per_unit;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const sale = await Sale.create({ shop: shop._id, product: product_id, quantity, price_per_unit, total_amount });
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: -quantity } });
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSales, createSale };