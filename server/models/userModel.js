const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  isPro: { type: Boolean, default: false },
  subscriptionType: {
    type: String,
    enum: ['trial', 'monthly', '6months', 'yearly', null],
    default: 'trial',
  },
  trialStartDate: { type: Date, default: null },
  trialEndDate: { type: Date, default: null },
  subscriptionPlan: { type: String, enum: ['monthly', 'six_month', 'yearly', null], default: null },
  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  paymentStatus: {
    type: String,
    enum: ['trial', 'paid', 'failed', 'expired', 'pending', null],
    default: 'trial',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
