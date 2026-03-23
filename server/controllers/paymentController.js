const User = require('../models/userModel');
const SubscriptionPayment = require('../models/subscriptionPaymentModel');
const {
  activatePlan,
  getPlanConfig,
  getSubscriptionSnapshot,
  serializePlans,
  syncSubscriptionState,
} = require('../services/subscriptionService');
const {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} = require('../services/razorpayService');

const ACTIVE_PAYMENT_STATUSES = ['verified', 'captured'];

const buildSubscriptionResponse = (user) => ({
  message: 'Subscription activated successfully',
  subscription: getSubscriptionSnapshot(user),
  user: {
    id: user._id,
    name: user.name,
    username: user.username,
  },
});

const activateSubscriptionFromPayment = async (user, payment) => {
  activatePlan(user, payment.plan);
  await user.save();
};

const createOrder = async (req, res) => {
  try {
    const planId = req.body.plan;
    const plan = getPlanConfig(planId);
    if (!plan) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (syncSubscriptionState(user)) {
      await user.save();
    }

    const { order, receipt } = await createRazorpayOrder({
      planId,
      userId: user._id,
      username: user.username,
    });

    await SubscriptionPayment.create({
      user: user._id,
      plan: planId,
      amount: plan.amount,
      currency: 'INR',
      status: 'created',
      razorpayOrderId: order.id,
      receipt,
      notes: order.notes || {},
    });

    res.json({
      keyId: process.env.RAZORPAY_KEY_ID || '',
      order,
      plan: {
        id: plan.id,
        amount: plan.amount,
        label: plan.label,
      },
      trustSignals: [
        'Secure payment via Razorpay',
        'No hidden charges',
        'Cancel anytime',
      ],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    const isValid = verifyCheckoutSignature({ orderId, paymentId, signature });
    if (!isValid) {
      await SubscriptionPayment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { status: 'failed', razorpayPaymentId: paymentId, razorpaySignature: signature }
      );

      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const payment = await SubscriptionPayment.findOne({ razorpayOrderId: orderId, user: req.user.id });
    if (!payment) {
      return res.status(404).json({ message: 'Payment session not found' });
    }

    if (payment.status === 'failed') {
      return res.status(409).json({ message: 'This payment is marked as failed.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
      if (payment.razorpayPaymentId && payment.razorpayPaymentId !== paymentId) {
        return res.status(409).json({ message: 'This order is already linked to another payment.' });
      }

      if (syncSubscriptionState(user)) {
        await user.save();
      }

      return res.json(buildSubscriptionResponse(user));
    }

    await activateSubscriptionFromPayment(user, payment);

    payment.status = 'verified';
    payment.razorpayPaymentId = paymentId;
    payment.razorpaySignature = signature;
    await payment.save();

    res.json(buildSubscriptionResponse(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const event = payload?.event;

    if (orderId) {
      const payment = await SubscriptionPayment.findOne({ razorpayOrderId: orderId });
      if (payment) {
        const wasAlreadyActivated = ACTIVE_PAYMENT_STATUSES.includes(payment.status);
        payment.webhookEvent = event;
        payment.razorpayPaymentId = paymentEntity.id || payment.razorpayPaymentId;
        if (event === 'payment.captured') {
          payment.status = 'captured';

          if (!wasAlreadyActivated) {
            const user = await User.findById(payment.user);
            if (user) {
              await activateSubscriptionFromPayment(user, payment);
            }
          }
        }
        if (event === 'payment.failed' && !wasAlreadyActivated) payment.status = 'failed';
        await payment.save();
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPricingConfig = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (syncSubscriptionState(user)) {
      await user.save();
    }

    res.json({
      plans: serializePlans(),
      subscription: getSubscriptionSnapshot(user),
      keyId: process.env.RAZORPAY_KEY_ID || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  verifyOrder,
  webhook,
  getPricingConfig,
};
