const crypto = require('crypto');
const { getPlanConfig } = require('./subscriptionService');

function getRazorpayDebugMeta() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  return {
    hasKeyId: Boolean(keyId),
    hasKeySecret: Boolean(keySecret),
    keyIdPrefix: keyId ? keyId.slice(0, 12) : '',
    keyIdLength: keyId.length,
    keySecretLength: keySecret.length,
    keyIdHasWhitespace: /\s/.test(keyId),
    keySecretHasWhitespace: /\s/.test(keySecret),
  };
}

function getAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured');
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function createRazorpayOrder({ planId, userId, username }) {
  const plan = getPlanConfig(planId);
  if (!plan) {
    throw new Error('Invalid plan');
  }

  const receipt = `sub_${userId}_${Date.now()}`;
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: plan.amount * 100,
      currency: 'INR',
      receipt,
      notes: {
        userId: String(userId),
        username: username || '',
        plan: planId,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const debugMeta = getRazorpayDebugMeta();
    throw new Error(`${errorText || 'Unable to create Razorpay order'} | debug=${JSON.stringify(debugMeta)}`);
  }

  const order = await response.json();
  return { order, plan, receipt };
}

function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('Razorpay secret is not configured');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Razorpay webhook secret is not configured');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
}

module.exports = {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  getRazorpayDebugMeta,
};
