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
    console.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  }
}

async function checkSubscriptionStatus(req, res, next) {
  try {
    let settled = false;
    await loadSubscriptionState(req, res, () => { settled = true; });
    if (!settled) return; // loadSubscriptionState already sent an error response

    if (req.subscription?.isReadOnly) {
      return res.status(402).json({
        message: 'Your trial has ended. Upgrade to continue using the platform.',
        code: 'SUBSCRIPTION_REQUIRED',
        subscription: req.subscription,
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  }
}

module.exports = {
  loadSubscriptionState,
  checkSubscriptionStatus,
};
