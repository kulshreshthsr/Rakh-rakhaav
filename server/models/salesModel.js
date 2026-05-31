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
  // Industry-specific line fields (pharmacy: batch_number/expiry, clothing: size/color, etc.)
  item_metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: String, default: '' },
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
    enum: ['cash', 'credit', 'upi', 'bank', 'insurance'],
    default: 'cash'
  },
  amount_paid: { type: Number, default: 0 },
  amount_paid_mode: { type: String, enum: ['cash', 'bank', 'upi', ''], default: '' },
  balance_due: { type: Number, default: 0 },
  payment_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },

  // ── Buyer / Customer ──────────────────────────────────────────
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  buyer_name: { type: String },
  buyer_phone: { type: String },
  buyer_gstin: { type: String, uppercase: true },
  buyer_address: { type: String },
  buyer_state: { type: String },
  buyer_state_code: { type: String },    // 2-digit code from GSTIN chars 1-2
  buyer_state_name: { type: String },
  is_b2b: { type: Boolean, default: false }, // true when buyer_gstin is present

  // ── GST Place of Supply & Supply Type ─────────────────────────
  place_of_supply: { type: String },      // 2-digit state code
  place_of_supply_name: { type: String },
  supply_type: {
    type: String,
    enum: ['intra_state', 'inter_state'],
    default: 'intra_state',
  },
  is_reverse_charge: { type: Boolean, default: false },

  // ── Insurance billing (pharmacy) ──────────────────────────────
  insurance_type: {
    type: String,
    enum: ['none', 'CGHS', 'ESIC', 'Ayushman', 'private_insurance', 'other'],
    default: 'none',
  },
  insurance_card_no:   { type: String },
  insurance_company:   { type: String },
  insurance_amount:    { type: Number, default: 0 },
  patient_copay:       { type: Number, default: 0 },
  insurance_claim_no:  { type: String },
  insurance_status: {
    type: String,
    enum: ['not_applicable', 'pending_claim', 'claimed', 'rejected', 'partial'],
    default: 'not_applicable',
  },

  // ── Sale type & exchange ──────────────────────────────────────
  sale_type: {
    type: String,
    enum: ['sale', 'exchange', 'return', 'exchange_out'],
    default: 'sale',
  },
  exchange_reference: { type: String },   // original invoice number being exchanged

  // ── Challan / Document type (hardware + GST credit/debit notes) ──
  document_type: {
    type: String,
    enum: ['invoice', 'challan', 'quotation', 'credit_note', 'debit_note', 'revised_invoice'],
    default: 'invoice',
  },
  converted_to_invoice:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  converted_from_challan:   { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  challan_date:             { type: Date, default: null },

  // Credit / Debit note reference (required when document_type is credit_note or debit_note)
  original_invoice_no:   { type: String },
  original_invoice_date: { type: Date },
  credit_debit_reason: { type: String }, // 'return_of_goods', 'price_correction', 'post_sale_discount', 'additional_charges', etc.

  // ── Bill ──────────────────────────────────────────────────────
  invoice_number: { type: String, required: true },
  offline_operation_id: { type: String },
  notes: { type: String },
  // Industry-specific invoice-level fields (restaurant: table_number/order_type, automobile: vehicle_number, etc.)
  extra_fields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true });

saleSchema.path('createdAt').immutable(false);

saleSchema.index({ shop: 1, createdAt: -1 });
saleSchema.index({ shop: 1, payment_status: 1 });
saleSchema.index({ shop: 1, buyer_phone: 1 });
saleSchema.index({ shop: 1, 'extra_fields.workflow_status': 1 });

saleSchema.index(
  { shop: 1, invoice_number: 1 },
  { unique: true }
);

saleSchema.index(
  { shop: 1, offline_operation_id: 1 },
  { unique: true, partialFilterExpression: { offline_operation_id: { $type: 'string' } } }
);

saleSchema.pre('save', function () {
  if (this.total_amount) this.total_amount = Math.round(this.total_amount * 100) / 100;
  if (this.balance_due) this.balance_due = Math.round(this.balance_due * 100) / 100;
});

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
