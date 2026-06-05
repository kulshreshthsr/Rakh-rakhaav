const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  gstin: { type: String },

  totalSales: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalUdhaar: { type: Number, default: 0 },
  opening_balance: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  notes: { type: String },

  reminder_enabled: { type: Boolean, default: false },
  reminder_frequency: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
  last_reminded_at: { type: Date, default: null },
}, { timestamps: true });

customerSchema.index({ shop: 1, isActive: 1 });
customerSchema.index({ shop: 1, phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
