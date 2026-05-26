const mongoose = require('mongoose');

// All supported business types. Add new entries here to extend the system.
const BUSINESS_TYPES = [
  'general', 'pharmacy', 'clothing', 'hardware', 'electronics',
  'restaurant', 'automobile', 'retail', 'bookstall', 'kirana',
  'sweet_shop', 'bakery', 'salon', 'stationery', 'mobile_shop',
  'grocery', 'cosmetics', 'footwear', 'furniture', 'gift_shop',
  'toy_store', 'sports', 'jewellery', 'pet_shop', 'service_center', 'repair_shop',
];

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
  // Industry identity — drives terminology, invoice fields, and enabled modules
  businessType: { type: String, enum: BUSINESS_TYPES, default: 'general' },
}, { timestamps: true });

const Shop = mongoose.model('Shop', shopSchema);
module.exports = Shop;
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;
