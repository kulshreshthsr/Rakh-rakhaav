const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  gstin: { type: String },
  phone: { type: String },
  email: { type: String },
  bank_name: { type: String },
  bank_account: { type: String },
  bank_ifsc: { type: String },
  bank_branch: { type: String },
  cash_opening_balance: { type: Number, default: 0 },
  bank_opening_balance: { type: Number, default: 0 },
  owner_photo: { type: String, default: '' },
  terms: { type: String, default: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.' },
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);
