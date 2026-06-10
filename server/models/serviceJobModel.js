const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
  part_name:  { type: String, required: true },
  part_cost:  { type: Number, default: 0 },
  quantity:   { type: Number, default: 1 },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status:     { type: String },
  changed_at: { type: Date, default: Date.now },
  changed_by: { type: String, default: '' },
  note:       { type: String, default: '' },
}, { _id: false });

const serviceJobSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  job_number:      { type: String, required: true },
  customer:        { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name:   { type: String, required: true },
  customer_phone:  { type: String, default: '' },
  received_date:   { type: Date, default: Date.now, required: true },
  product_name:    { type: String, required: true },
  brand:           { type: String, default: '' },
  model_number:    { type: String, default: '' },
  serial_number:   { type: String, default: '' },
  imei:            { type: String, default: '' },
  problem_reported:{ type: String, required: true },
  problem_type: {
    type: String,
    enum: ['screen', 'battery', 'speaker', 'charging', 'motherboard', 'software', 'other'],
    default: 'other',
  },
  job_type: {
    type: String,
    enum: ['warranty', 'out_of_warranty', 'amc', 'paid_repair'],
    default: 'paid_repair',
  },
  estimated_cost:   { type: Number, default: 0 },
  final_cost:       { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['received', 'diagnosed', 'repairing', 'waiting_parts', 'ready', 'delivered', 'cancelled'],
    default: 'received',
  },
  status_history:   [statusHistorySchema],
  parts_used:       [partSchema],
  technician_name:  { type: String, default: '' },
  estimated_delivery: { type: Date, default: null },
  actual_delivery:    { type: Date, default: null },
  warranty_claim_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'WarrantyClaim', default: null },
  customer_signature: { type: String, default: '' },
  payment_status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  },
  amount_paid: { type: Number, default: 0 },
  notes:       { type: String, default: '' },
}, { timestamps: true });

serviceJobSchema.index({ shop: 1, status: 1, createdAt: -1 });
serviceJobSchema.index({ shop: 1, customer: 1 });
serviceJobSchema.index({ shop: 1, job_number: 1 }, { unique: true });
serviceJobSchema.index({ shop: 1, serial_number: 1 }, { sparse: true });
serviceJobSchema.index({ shop: 1, imei: 1 }, { sparse: true });

module.exports = mongoose.model('ServiceJob', serviceJobSchema);
