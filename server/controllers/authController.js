const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const { BUSINESS_TYPES } = Shop;
const { STATE_CODES } = require('../lib/gstUtils');
const { logAuditEvent, cloneForAudit } = require('../utils/auditTrail');
const {
  TRIAL_DAYS,
  ensureTrialDates,
  getSubscriptionSnapshot,
  serializePlans,
  syncSubscriptionState,
} = require('../services/subscriptionService');

const AUTH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_OWNER_PHOTO_SIZE = 500 * 1024;

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

const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const serializeAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  isPro: user.isPro,
  subscription: getSubscriptionSnapshot(user),
  role: user.role || 'owner',
  isSubUser: user.isSubUser || false,
  ui_language: user.ui_language || 'hi_en',
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
      email: req.body.email ? req.body.email.toLowerCase().trim() : null,
      ui_language: req.body.ui_language || 'hi_en',
      trialStartDate: now,
      trialEndDate: new Date(now.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000)),
      paymentStatus: 'trial',
    });
    const shop = await Shop.create({ name: 'My Shop', owner: user._id });

    if (user.email) {
      emailService.sendWelcomeEmail(user.email, user.name, shop.name).catch(() => {});
    }

    const token         = jwt.sign({ id: user._id, username: user.username, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
    const refresh_token = await issueRefreshToken(user);
    res.status(201).json({ user: serializeAuthUser(user), token, refresh_token, requires_language_selection: true });
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateLanguage = async (req, res) => {
  const { ui_language } = req.body;
  const userId = req.user.subUserId || req.user.id;
  try {
    if (!['en', 'hi', 'hi_en'].includes(ui_language)) {
      return res.status(400).json({ message: 'Invalid language selection' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.ui_language = ui_language;
    await user.save();

    res.json({ user: serializeAuthUser(user) });
  } catch (err) {
    logger.error('[authController]', err.message || err);
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
      const token         = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
      const refresh_token = await issueRefreshToken(user);
      return res.json({
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          role: user.role || 'cashier',
          isSubUser: true,
          ui_language: user.ui_language || 'hi_en',
          isPro: false,
          subscription: null,
          permissions: [],  // populated by subscription-status refresh in Layout
        },
        token,
        refresh_token,
      });
    }

    // Owner: normal subscription sync flow
    ensureTrialDates(user);
    if (syncSubscriptionState(user)) {
      await user.save();
    } else if (user.isModified()) {
      await user.save();
    }

    const token         = jwt.sign({ id: user._id, username: user.username, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
    const refresh_token = await issueRefreshToken(user);
    res.json({ user: serializeAuthUser(user), token, refresh_token });
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.subUserId || req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (name !== undefined) user.name = name;
    if (req.body.email !== undefined) {
      user.email = req.body.email ? req.body.email.toLowerCase().trim() : null;
    }
    await user.save();
    if (!req.user.isSubUser) ensureTrialDates(user);
    res.json({ id: user._id, name: user.name, username: user.username, subscription: req.user.isSubUser ? null : getSubscriptionSnapshot(user) });
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  // Use the actual user's ID (subUserId for sub-users, id for owners)
  const userId = req.user.subUserId || req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User नहीं मिला' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();
    res.json({ message: 'Password updated!' });
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getShop = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    res.json(shop);
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const VALID_DASHBOARD_MODES = ['b2c', 'b2b', 'hybrid'];

const updateShop = async (req, res) => {
  const {
    name, address, city, state, pincode, gstin, phone, email,
    bank_name, bank_account, bank_ifsc, bank_branch,
    cash_opening_balance, bank_opening_balance,
    terms, businessType, dashboardMode,
    invoice_prefix, invoice_number_digits, invoice_start_number,
    gst_type, composition_category, filing_frequency,
    monthly_target,
  } = req.body;
  try {
    if (businessType && !BUSINESS_TYPES.includes(businessType)) {
      return res.status(400).json({ message: 'Invalid business type.' });
    }
    if (dashboardMode && !VALID_DASHBOARD_MODES.includes(dashboardMode)) {
      return res.status(400).json({ message: 'Invalid dashboard mode.' });
    }

    const shop = await getShopOrFail(req.user.id);
    const beforeValue = cloneForAudit(shop);
    const updatePayload = {
      name, address, city, state, pincode, gstin, phone, email,
      bank_name, bank_account, bank_ifsc, bank_branch,
      cash_opening_balance: Number(cash_opening_balance || 0),
      bank_opening_balance: Number(bank_opening_balance || 0),
      terms,
    };
    if (businessType) updatePayload.businessType = businessType;
    if (dashboardMode) updatePayload.dashboardMode = dashboardMode;
    if (gst_type) updatePayload.gst_type = gst_type;
    if (composition_category !== undefined) updatePayload.composition_category = composition_category;
    if (filing_frequency) updatePayload.filing_frequency = filing_frequency;
    if (invoice_prefix !== undefined) updatePayload.invoice_prefix = String(invoice_prefix || '').replace(/[^A-Z0-9\/\-_]/gi, '').toUpperCase().slice(0, 10);
    if (invoice_number_digits !== undefined) updatePayload.invoice_number_digits = Math.min(8, Math.max(1, Number(invoice_number_digits) || 4));
    if (invoice_start_number !== undefined) updatePayload.invoice_start_number = Math.max(1, Number(invoice_start_number) || 1);
    if (req.body.onboarding_completed === true) updatePayload.onboarding_completed = true;
    if (req.body.businessTier && ['nano', 'core', 'pro'].includes(req.body.businessTier)) updatePayload.businessTier = req.body.businessTier;
    if (monthly_target !== undefined) updatePayload.monthly_target = Math.max(0, Number(monthly_target) || 0);
    // findByIdAndUpdate bypasses pre-save hooks, so derive gst_state fields here
    if (gstin && String(gstin).length === 15) {
      const stateCode = String(gstin).substring(0, 2).toUpperCase();
      updatePayload.gst_state_code = stateCode;
      updatePayload.gst_state_name = STATE_CODES[stateCode] || 'Unknown';
    } else if (gstin === '' || gstin === null) {
      updatePayload.gst_state_code = '';
      updatePayload.gst_state_name = '';
    }
    const updated = await Shop.findByIdAndUpdate(shop._id, updatePayload, { new: true });
    try {
      await logAuditEvent({
        shopId: updated._id,
        userId: req.user.id,
        actionType: 'update',
        entity: 'shop',
        entityId: updated._id,
        beforeValue,
        afterValue: updated,
      });
    } catch (auditErr) {
      logger.warn('[updateShop] audit log failed (non-fatal):', auditErr.message);
    }
    res.json(updated);
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    // For sub-users req.user.id is the owner's ID — correct for subscription checks
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User नहीं मिला' });

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
          ui_language: subUser.ui_language || responseUser.ui_language || 'hi_en',
          permissions: req.user.permissions || [],
        };
      }
    }

    // Include businessType, dashboardMode, and businessTier so frontend context stays fresh
    const shopForBiz = await Shop.findOne({ owner: req.user.id }).select('businessType dashboardMode businessTier');
    responseUser.businessType  = shopForBiz?.businessType  || 'hardware';
    responseUser.dashboardMode = shopForBiz?.dashboardMode || 'b2c';
    responseUser.businessTier  = shopForBiz?.businessTier  || 'nano';

    res.json({
      user: responseUser,
      subscription: getSubscriptionSnapshot(user),
      plans: serializePlans(),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    });
  } catch (err) {
    logger.error('[authController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const crypto = require('crypto');

async function issueRefreshToken(user) {
  const raw = crypto.randomBytes(64).toString('hex');
  user.refresh_token_hash    = crypto.createHash('sha256').update(raw).digest('hex');
  user.refresh_token_expires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await user.save();
  return raw;
}

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ message: 'If this email is registered, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URLS || '').split(',')[0].trim() || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    emailService.sendPasswordResetEmail(user.email, resetLink).catch(() => {});

    const isDev = process.env.NODE_ENV !== 'production';
    logger.info(`[forgotPassword] Reset token for ${email}: ${token}`);
    return res.json({
      message: 'If this email is registered, a reset link has been sent.',
      ...(isDev && { dev_token: token }),
    });
  } catch (err) {
    logger.error('[forgotPassword]', err.message);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and new password are required.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  try {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired.' });

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.passwordChangedAt = new Date();
    await user.save();
    res.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (err) {
    logger.error('[resetPassword]', err.message);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { tokenVersion: 1 },
      $set: { refresh_token_hash: null, refresh_token_expires: null },
    });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('[logout]', err.message);
    res.status(500).json({ message: 'Logout failed' });
  }
};

const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ message: 'Refresh token required' });
  try {
    const hashed = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const user = await User.findOne({
      refresh_token_hash: hashed,
      refresh_token_expires: { $gt: new Date() },
    }).select('+refresh_token_hash');
    if (!user) return res.status(401).json({ message: 'Refresh token invalid or expired' });

    const token = jwt.sign(
      { id: user._id, username: user.username, tv: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: AUTH_TOKEN_TTL }
    );
    res.json({ token });
  } catch (err) {
    logger.error('[refreshToken]', err.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const { inferTier } = require('../services/tierInference');

const completeBusinessProfile = async (req, res) => {
  try {
    const { signals } = req.body;

    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const { tier, score, reasons } = inferTier(signals, shop.gst_type, shop.businessType);

    const prevTier = shop.businessTier;
    shop.profileSignals = { ...signals, filingGst: shop.gst_type === 'regular' };
    shop.businessTier = tier;

    // Derive dashboardMode from sellsTo signal
    const sellsTo = signals?.sellsTo;
    const dashboardMode = sellsTo === 'businesses' ? 'b2b'
      : sellsTo === 'both' ? 'hybrid' : 'b2c';
    shop.dashboardMode = dashboardMode;

    if (prevTier !== tier) {
      shop.tierHistory.push({
        from: prevTier,
        to: tier,
        reason: 'onboarding_profile',
      });
    }

    await shop.save();

    logger.info(`[tier] Shop ${shop._id} profiled → ${tier} (score: ${score}), mode: ${dashboardMode}`);

    res.json({ tier, score, reasons, dashboardMode, shop });
  } catch (err) {
    logger.error('[completeBusinessProfile]', err.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus, forgotPassword, resetPassword, logout, refreshToken, completeBusinessProfile, updateLanguage };
