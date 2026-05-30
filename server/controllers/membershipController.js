const Membership = require('../models/membershipModel');
const Shop       = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getMemberships = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { status } = req.query;
    const filter = { shop: shop._id };
    if (status === 'active')    filter.isActive = true;
    if (status === 'completed') { filter.isActive = false; filter.usedSessions = { $gte: 1 }; }
    const memberships = await Membership.find(filter).sort({ createdAt: -1 });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getClientMemberships = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ message: 'phone required' });
    const shop = await getOrCreateShop(req.user.id);
    const memberships = await Membership.find({
      shop: shop._id,
      isActive: true,
      clientPhone: { $regex: phone.replace(/\D/g, '').slice(-10) },
    });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createMembership = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const membership = await Membership.create({ ...req.body, shop: shop._id });
    res.status(201).json(membership);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const redeemSession = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const membership = await Membership.findOne({ _id: req.params.id, shop: shop._id });
    if (!membership) return res.status(404).json({ message: 'Membership not found' });
    if (!membership.isActive) return res.status(400).json({ message: 'Membership is not active' });
    if (membership.validUntil && new Date() > membership.validUntil) return res.status(400).json({ message: 'Membership has expired' });
    if (membership.usedSessions >= membership.totalSessions) return res.status(400).json({ message: 'No sessions remaining' });

    const { saleId, notes, stylistId } = req.body;
    membership.usedSessions += 1;
    membership.usageLog.push({ usedAt: new Date(), saleId, notes, stylistId });
    if (membership.usedSessions >= membership.totalSessions) membership.isActive = false;
    await membership.save();
    res.json(membership);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMembership = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const membership = await Membership.findOne({ _id: req.params.id, shop: shop._id });
    if (!membership) return res.status(404).json({ message: 'Membership not found' });
    res.json(membership);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getMemberships, getClientMemberships, createMembership, redeemSession, getMembership };
