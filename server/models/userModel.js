const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  isPro: { type: Boolean, default: false },
  subscriptionType: {
    type: String,
    enum: ['trial', 'test_10', 'weekly', 'monthly', '6months', 'yearly', null],
    default: 'trial',
  },
  trialStartDate: { type: Date, default: null },
  trialEndDate: { type: Date, default: null },
  subscriptionPlan: { type: String, enum: ['test_10', 'weekly', 'monthly', 'six_month', 'yearly', null], default: null },
  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  paymentStatus: {
    type: String,
    enum: ['trial', 'paid', 'failed', 'expired', 'pending', null],
    default: 'trial',
  },
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true,
    sparse: true,
  },
  ui_language: { type: String, enum: ['en', 'hi', 'hi_en'], default: 'hi_en' },
  passwordResetToken: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0 },
  refresh_token_hash:    { type: String, default: null, select: false },
  refresh_token_expires: { type: Date,   default: null },
  // RBAC fields — safe defaults ensure backward compat for existing users
  role: { type: String, default: 'owner' },
  isSubUser: { type: Boolean, default: false },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

userSchema.index({ shopId: 1 });

module.exports = mongoose.model('User', userSchema);
