const mongoose = require('mongoose');
const { STATE_CODES } = require('../lib/gstUtils');

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
  gstin: { type: String, uppercase: true, trim: true },
  phone: { type: String },
  email: { type: String },
  bank_name: { type: String },
  bank_account: { type: String },
  bank_ifsc: { type: String },
  bank_branch: { type: String },
  cash_opening_balance: { type: Number, default: 0 },
  bank_opening_balance: { type: Number, default: 0 },
  owner_photo: { type: String, default: '', select: false },
  terms: { type: String, default: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.' },
  // Industry identity — drives terminology, invoice fields, and enabled modules
  businessType: { type: String, enum: BUSINESS_TYPES, default: 'general' },
  dashboardMode: {
    type: String,
    enum: ['b2c', 'b2b', 'hybrid'],
    default: 'b2c',
  },

  // ── GST Registration ─────────────────────────────────────────────────
  gst_state_code: { type: String },  // extracted from GSTIN chars 1-2
  gst_state_name: { type: String },  // human-readable state name

  // GST Scheme Type
  gst_type: {
    type: String,
    enum: ['regular', 'composition', 'unregistered', 'exempt'],
    default: 'regular',
  },

  // Composition details (only relevant when gst_type === 'composition')
  composition_category: {
    type: String,
    enum: ['trader', 'restaurant', 'service', null],
    default: null,
  },
  composition_rate: { type: Number, default: 0 }, // 1%, 5%, or 6% on turnover

  // Filing frequency (only relevant when gst_type === 'regular')
  filing_frequency: {
    type: String,
    enum: ['monthly', 'quarterly'],  // quarterly = QRMP scheme
    default: 'monthly',
  },

  // QRMP: first day of the current filing quarter
  qrmp_quarter_start: { type: Date },

  // ITC eligibility (blocked for composition dealers and some business types)
  itc_eligible: { type: Boolean, default: true },

  // ── Invoice number format ──────────────────────────────────────
  invoice_prefix:        { type: String, default: '', trim: true, maxlength: 10 },
  invoice_number_digits: { type: Number, default: 4, min: 1, max: 8 },
  invoice_start_number:  { type: Number, default: 1 },
  onboarding_completed:  { type: Boolean, default: false },
}, { timestamps: true });

// Auto-extract state code from GSTIN and set composition rate
shopSchema.pre('save', function () {
  if (this.gstin && this.gstin.length === 15) {
    this.gst_state_code = this.gstin.substring(0, 2);
    this.gst_state_name = STATE_CODES[this.gst_state_code] || 'Unknown';
  }
  if (this.gst_type === 'composition') {
    const rateMap = { trader: 1, restaurant: 5, service: 6 };
    this.composition_rate = rateMap[this.composition_category] || 1;
    this.itc_eligible = false; // composition dealers cannot claim ITC
  } else {
    if (!this.isModified('itc_eligible')) this.itc_eligible = true;
  }
});

const Shop = mongoose.model('Shop', shopSchema);
module.exports = Shop;
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;
