const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  phone: { type: String },
  gstin: { type: String },
  address: { type: String },
  state: { type: String },
  companyName: { type: String },

  totalPurchased: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalUdhaar: { type: Number, default: 0 },
  opening_balance: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  notes: { type: String },

  reminder_enabled: { type: Boolean, default: false },
  reminder_frequency: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
  last_reminded_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
