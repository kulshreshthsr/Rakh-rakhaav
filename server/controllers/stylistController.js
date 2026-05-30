const Stylist = require('../models/stylistModel');
const Sale    = require('../models/salesModel');
const Shop    = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getStylists = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const stylists = await Stylist.find({ shop: shop._id, isActive: true }).sort({ name: 1 });

    // Compute today's appointment count per stylist
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todaySales = await Sale.find({
      shop: shop._id,
      createdAt: { $gte: todayStart },
    }).select('extra_fields');

    const countMap = {};
    todaySales.forEach(s => {
      const ef = s.extra_fields instanceof Map ? Object.fromEntries(s.extra_fields) : (s.extra_fields || {});
      if (ef.stylist_id) countMap[ef.stylist_id] = (countMap[ef.stylist_id] || 0) + 1;
    });

    const result = stylists.map(s => ({ ...s.toJSON(), todayCount: countMap[String(s._id)] || 0 }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createStylist = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const stylist = await Stylist.create({ ...req.body, shop: shop._id });
    res.status(201).json(stylist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStylist = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const stylist = await Stylist.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      req.body,
      { new: true }
    );
    if (!stylist) return res.status(404).json({ message: 'Stylist not found' });
    res.json(stylist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deactivateStylist = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const stylist = await Stylist.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { isActive: false },
      { new: true }
    );
    if (!stylist) return res.status(404).json({ message: 'Stylist not found' });
    res.json({ message: 'Stylist deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStylists, createStylist, updateStylist, deactivateStylist };
