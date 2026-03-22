const mongoose = require('mongoose');

// Each item in a multi-product sale
const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  cost_price: { type: Number, default: 0 },      // snapshot at time of sale
  gst_rate: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  total_amount: { type: Number, default: 0 },
});

const saleSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },

  // ── Multi-item support ────────────────────────────────────────
  items: [saleItemSchema],

  // ── Legacy single-product fields (backward compat) ────────────
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number },
  price_per_unit: { type: Number },
  cost_price: { type: Number, default: 0 },
  gst_rate: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  invoice_type: { type: String, enum: ['B2B', 'B2C'], default: 'B2C' },

  // ── Bill totals ───────────────────────────────────────────────
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  total_cost: { type: Number, default: 0 },      // ← COGS for this bill
  gross_profit: { type: Number, default: 0 },    // ← total_amount - total_cost - total_gst

  // ── Payment ───────────────────────────────────────────────────
  payment_type: {
    type: String,
    enum: ['cash', 'credit', 'upi', 'bank'],     // ← added upi/bank
    default: 'cash'
  },
  amount_paid: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },

  // ── Buyer / Customer ──────────────────────────────────────────
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  buyer_name: { type: String },
  buyer_phone: { type: String },
  buyer_gstin: { type: String },
  buyer_address: { type: String },
  buyer_state: { type: String },

  // ── Bill ──────────────────────────────────────────────────────
  invoice_number: { type: String, unique: true },
  notes: { type: String },

}, { timestamps: true });

saleSchema.pre('save', async function () {
  if (this.amount_paid >= this.total_amount) {
    this.payment_status = 'paid';
    this.balance_due = 0;
  } else if (this.amount_paid > 0) {
    this.payment_status = 'partial';
    this.balance_due = parseFloat((this.total_amount - this.amount_paid).toFixed(2));
  } else {
    this.payment_status = 'unpaid';
    this.balance_due = this.total_amount;
  }
});

module.exports = mongoose.model('Sale', saleSchema);
