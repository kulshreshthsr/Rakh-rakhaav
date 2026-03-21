const User = require('../models/userModel');
const { getSubscriptionSnapshot, syncSubscriptionState } = require('../services/subscriptionService');

async function loadSubscriptionState(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (syncSubscriptionState(user)) {
      await user.save();
    }

    req.authUser = user;
    req.subscription = getSubscriptionSnapshot(user);
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function checkTrialStatus(req, res, next) {
  return loadSubscriptionState(req, res, next);
}

async function checkSubscriptionStatus(req, res, next) {
  try {
    await loadSubscriptionState(req, res, () => {});

    if (req.subscription?.isReadOnly) {
      return res.status(402).json({
        message: 'Your trial has ended. Upgrade to continue using the platform.',
        code: 'SUBSCRIPTION_REQUIRED',
        subscription: req.subscription,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  loadSubscriptionState,
  checkTrialStatus,
  checkSubscriptionStatus,
};
