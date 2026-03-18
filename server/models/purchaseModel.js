const mongoose = require('mongoose');

// Each item in a multi-product purchase
const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  gst_rate: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  total_amount: { type: Number, default: 0 },
});

const purchaseSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },

  // ── Items (multi-product support) ─────────────────────────────
  items: [purchaseItemSchema],

  // ── Legacy single-product fields (kept for backward compat) ───
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number },
  price_per_unit: { type: Number },
  gst_rate: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  invoice_type: { type: String, enum: ['B2B', 'B2C'], default: 'B2C' },

  // ── Totals ────────────────────────────────────────────────────
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },   // ← This IS your ITC (Input Tax Credit)
  total_amount: { type: Number, required: true },

  // ── Payment ───────────────────────────────────────────────────
  payment_type: { type: String, enum: ['cash', 'credit', 'upi', 'bank'], default: 'cash' },
  amount_paid: { type: Number, default: 0 },   // how much paid at time of purchase
  balance_due: { type: Number, default: 0 },   // total_amount - amount_paid
  payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },

  // ── Supplier ──────────────────────────────────────────────────
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplier_name: { type: String },
  supplier_phone: { type: String },
  supplier_gstin: { type: String },
  supplier_address: { type: String },
  supplier_state: { type: String },  // ← WAS MISSING — needed for IGST calculation

  // ── Bill ──────────────────────────────────────────────────────
  invoice_number: { type: String },
  notes: { type: String },

}, { timestamps: true });

// Auto-set payment_status before save
purchaseSchema.pre('save', function (next) {
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
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);