const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  phone: { type: String },
  gstin: { type: String },
  address: { type: String },
  state: { type: String },        // ← needed for IGST logic
  companyName: { type: String },

  // ── Ledger summary (auto-updated) ─────────────────────────────
  totalPurchased: { type: Number, default: 0 }, // total credit purchases
  totalPaid: { type: Number, default: 0 },      // total payments made
  totalUdhaar: { type: Number, default: 0 },    // balance still owed = totalPurchased - totalPaid
  opening_balance: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
