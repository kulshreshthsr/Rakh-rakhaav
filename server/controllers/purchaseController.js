const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getPurchases = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const purchases = await Purchase.find({ shop: shop._id })
      .populate('product', 'name')
      .sort({ createdAt: -1 });
    const result = purchases.map(p => ({
      id: p._id,
      product_name: p.product?.name,
      quantity: p.quantity,
      price_per_unit: p.price_per_unit,
      total_amount: p.total_amount,
      purchased_at: p.createdAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPurchase = async (req, res) => {
  const { product_id, quantity, price_per_unit } = req.body;
  const total_amount = quantity * price_per_unit;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const purchase = await Purchase.create({ shop: shop._id, product: product_id, quantity, price_per_unit, total_amount });
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: quantity } });
    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPurchases, createPurchase };