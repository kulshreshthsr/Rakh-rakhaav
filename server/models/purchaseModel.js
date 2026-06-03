const mongoose = require('mongoose');

// Each item in a multi-product purchase
const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  gst_rate: { type: Number, default: 0 },
  cgst_rate: { type: Number, default: 0 },
  sgst_rate: { type: Number, default: 0 },
  igst_rate: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  total_amount: { type: Number, default: 0 },
  itc_eligible: { type: Boolean, default: true },  // false for composition dealers or blocked items
  // batch/variant/serial data entered during purchase — drives sub-inventory
  item_metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
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
  total_tax: { type: Number, default: 0 },   // alias of total_gst for GSTR-3B consistency

  // ── Payment ───────────────────────────────────────────────────
  payment_type: { type: String, enum: ['cash', 'credit', 'upi', 'bank'], default: 'cash' },
  amount_paid: { type: Number, default: 0 },   // how much paid at time of purchase
  amount_paid_mode: { type: String, enum: ['cash', 'bank', 'upi', ''], default: '' },
  balance_due: { type: Number, default: 0 },   // total_amount - amount_paid
  payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },

  // ── Supplier ──────────────────────────────────────────────────
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplier_name: { type: String },
  supplier_phone: { type: String },
  supplier_gstin: { type: String, uppercase: true },
  supplier_address: { type: String },
  supplier_state: { type: String },
  supplier_state_code: { type: String },   // 2-digit code extracted from supplier GSTIN
  supplier_state_name: { type: String },

  // Supplier's own invoice details (required for GSTR-2B reconciliation)
  supplier_invoice_no: { type: String },    // supplier's bill number (not our internal number)
  supplier_invoice_date: { type: Date },    // supplier's bill date

  // ── GST Supply Type ───────────────────────────────────────────
  supply_type: {
    type: String,
    enum: ['intra_state', 'inter_state'],
    default: 'intra_state',
  },

  // ── ITC Eligibility ───────────────────────────────────────────
  itc_eligible: { type: Boolean, default: true },
  itc_blocked_reason: { type: String }, // 'personal_use', 'motor_vehicle', 'food_beverages', etc.

  // ── Reverse Charge Mechanism (RCM) ────────────────────────────
  is_reverse_charge: { type: Boolean, default: false },
  rcm_category: { type: String }, // 'GTA', 'legal', 'security', 'unregistered_supplier', etc.

  // ── GSTR-2B Reconciliation Status ────────────────────────────
  gstr2b_status: {
    type: String,
    enum: ['not_checked', 'matched', 'not_in_2b', 'mismatch'],
    default: 'not_checked',
  },
  gstr2b_checked_at: { type: Date },

  // ── Bill ──────────────────────────────────────────────────────
  invoice_number: { type: String, required: true },
  offline_operation_id: { type: String },
  notes: { type: String },

  // ── Credit terms ──────────────────────────────────────────────
  due_date: { type: Date, default: null },  // payment due date for credit purchases

  // ── Goods Receipt ─────────────────────────────────────────────
  receipt_status: {
    type: String,
    enum: ['received', 'ordered', 'partial'],
    default: 'received',
  },
  grn_number:     { type: String, default: null },
  received_items: [{
    product:           { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity_ordered:  { type: Number, default: 0 },
    quantity_received: { type: Number, default: 0 },
  }],

}, { timestamps: true });

purchaseSchema.index({ shop: 1, createdAt: -1 });
purchaseSchema.index({ shop: 1, payment_status: 1 });

purchaseSchema.index(
  { shop: 1, invoice_number: 1 },
  { unique: true }
);

purchaseSchema.index(
  { shop: 1, offline_operation_id: 1 },
  { unique: true, partialFilterExpression: { offline_operation_id: { $type: 'string' } } }
);

// Auto-set payment_status before save
purchaseSchema.pre('save', async function () {
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

module.exports = mongoose.model('Purchase', purchaseSchema);
