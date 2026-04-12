const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const { logAuditEvent, cloneForAudit } = require('../utils/auditTrail');
const {
  TRIAL_DAYS,
  ensureTrialDates,
  getSubscriptionSnapshot,
  serializePlans,
  syncSubscriptionState,
} = require('../services/subscriptionService');

const AUTH_TOKEN_TTL = '365d';
const MAX_OWNER_PHOTO_SIZE = 5 * 1024 * 1024;

const isValidOwnerPhoto = (value = '') => {
  if (!value) return true;
  if (typeof value !== 'string') return false;
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value)) return false;

  const base64 = value.split(',')[1] || '';
  const normalized = base64.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const sizeInBytes = Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
  return sizeInBytes <= MAX_OWNER_PHOTO_SIZE;
};

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const serializeAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  isPro: user.isPro,
  subscription: getSubscriptionSnapshot(user),
});

const register = async (req, res) => {
  const { name, username, password } = req.body;
  try {
    const userExists = await User.findOne({ username: username.toLowerCase() });
    if (userExists) return res.status(400).json({ message: 'Username already taken. Please choose another.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const user = await User.create({
      name,
      username: username.toLowerCase(),
      password: hashedPassword,
      trialStartDate: now,
      trialEndDate: new Date(now.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000)),
      paymentStatus: 'trial',
    });
    await Shop.create({ name: 'My Shop', owner: user._id });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
    res.status(201).json({ user: serializeAuthUser(user), token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });
    ensureTrialDates(user);
    if (syncSubscriptionState(user)) {
      await user.save();
    } else if (user.isModified()) {
      await user.save();
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
    res.json({ user: serializeAuthUser(user), token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
    ensureTrialDates(user);
    res.json({ id: user._id, name: user.name, username: user.username, subscription: getSubscriptionSnapshot(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getShop = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateShop = async (req, res) => {
  const {
    name, address, city, state, pincode, gstin, phone, email,
    bank_name, bank_account, bank_ifsc, bank_branch,
    cash_opening_balance, bank_opening_balance,
    owner_photo, terms,
  } = req.body;
  try {
    if (!isValidOwnerPhoto(owner_photo)) {
      return res.status(400).json({ message: 'Owner photo must be a PNG, JPG, JPEG, or WEBP image up to 5MB.' });
    }

    const shop = await getOrCreateShop(req.user.id);
    const beforeValue = cloneForAudit(shop);
    const updated = await Shop.findByIdAndUpdate(
      shop._id,
      {
        name, address, city, state, pincode, gstin, phone, email,
        bank_name, bank_account, bank_ifsc, bank_branch,
        cash_opening_balance: Number(cash_opening_balance || 0),
        bank_opening_balance: Number(bank_opening_balance || 0),
        owner_photo,
        terms,
      },
      { new: true }
    );
    await logAuditEvent({
      shopId: updated._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'shop',
      entityId: updated._id,
      beforeValue,
      afterValue: updated,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    ensureTrialDates(user);
    if (syncSubscriptionState(user) || user.isModified()) {
      await user.save();
    }

    res.json({
      user: serializeAuthUser(user),
      subscription: getSubscriptionSnapshot(user),
      plans: serializePlans(),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus };
