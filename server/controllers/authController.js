const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const { BUSINESS_TYPES } = Shop;
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
  role: user.role || 'owner',
  isSubUser: user.isSubUser || false,
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
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });

    // Sub-users: check active status only — they don't have their own subscription
    if (user.isSubUser) {
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Your account has been disabled. Contact the shop owner.' });
      }
      const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
      return res.json({
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          role: user.role || 'cashier',
          isSubUser: true,
          isPro: false,
          subscription: null,
          permissions: [],  // populated by subscription-status refresh in Layout
        },
        token,
      });
    }

    // Owner: normal subscription sync flow
    ensureTrialDates(user);
    if (syncSubscriptionState(user)) {
      await user.save();
    } else if (user.isModified()) {
      await user.save();
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
    res.json({ user: serializeAuthUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.subUserId || req.user.id;
  try {
    const user = await User.findByIdAndUpdate(userId, { name }, { new: true });
    if (!req.user.isSubUser) ensureTrialDates(user);
    res.json({ id: user._id, name: user.name, username: user.username, subscription: req.user.isSubUser ? null : getSubscriptionSnapshot(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  // Use the actual user's ID (subUserId for sub-users, id for owners)
  const userId = req.user.subUserId || req.user.id;
  try {
    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getShop = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    res.json(shop);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateShop = async (req, res) => {
  const {
    name, address, city, state, pincode, gstin, phone, email,
    bank_name, bank_account, bank_ifsc, bank_branch,
    cash_opening_balance, bank_opening_balance,
    owner_photo, terms, businessType,
  } = req.body;
  try {
    if (!isValidOwnerPhoto(owner_photo)) {
      return res.status(400).json({ message: 'Owner photo must be a PNG, JPG, JPEG, or WEBP image up to 5MB.' });
    }
    if (businessType && !BUSINESS_TYPES.includes(businessType)) {
      return res.status(400).json({ message: 'Invalid business type.' });
    }

    const shop = await getOrCreateShop(req.user.id);
    const beforeValue = cloneForAudit(shop);
    const updatePayload = {
      name, address, city, state, pincode, gstin, phone, email,
      bank_name, bank_account, bank_ifsc, bank_branch,
      cash_opening_balance: Number(cash_opening_balance || 0),
      bank_opening_balance: Number(bank_opening_balance || 0),
      owner_photo,
      terms,
    };
    if (businessType) updatePayload.businessType = businessType;
    const updated = await Shop.findByIdAndUpdate(shop._id, updatePayload, { new: true });
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
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    // For sub-users req.user.id is the owner's ID — correct for subscription checks
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    ensureTrialDates(user);
    if (syncSubscriptionState(user) || user.isModified()) {
      await user.save();
    }

    // Build response user object — for sub-users use their own identity info
    let responseUser = serializeAuthUser(user);
    if (req.user.isSubUser && req.user.subUserId !== req.user.id) {
      const subUser = await User.findById(req.user.subUserId).select('name username role isSubUser');
      if (subUser) {
        responseUser = {
          ...responseUser,
          id: subUser._id,
          name: subUser.name,
          username: subUser.username,
          role: subUser.role || 'cashier',
          isSubUser: true,
          permissions: req.user.permissions || [],
        };
      }
    }

    // Include businessType from shop so frontend IndustryContext stays fresh
    const shopForBiz = await Shop.findOne({ owner: req.user.id }).select('businessType');
    responseUser.businessType = shopForBiz?.businessType || 'general';

    res.json({
      user: responseUser,
      subscription: getSubscriptionSnapshot(user),
      plans: serializePlans(),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus };
