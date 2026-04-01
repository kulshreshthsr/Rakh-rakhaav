const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['test_10', 'weekly', 'monthly', 'six_month', 'yearly'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'verified', 'captured'],
    default: 'created',
  },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },
  receipt: { type: String, default: null },
  notes: { type: Object, default: {} },
  webhookEvent: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
