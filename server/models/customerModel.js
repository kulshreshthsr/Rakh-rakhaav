const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  gstin: { type: String },                       // for B2B customers

  // ── Ledger summary (auto-updated) ─────────────────────────────
  totalSales: { type: Number, default: 0 },      // lifetime credit sales to this customer
  totalPaid: { type: Number, default: 0 },       // total payments received
  totalUdhaar: { type: Number, default: 0 },     // balance still owed = totalSales - totalPaid

  isActive: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);