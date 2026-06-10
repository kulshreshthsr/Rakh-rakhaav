const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  visit_date:       { type: Date, default: Date.now },
  technician_name:  { type: String, default: '' },
  issue_reported:   { type: String, default: '' },
  work_done:        { type: String, default: '' },
  parts_used:       { type: String, default: '' },
  next_visit_date:  { type: Date, default: null },
}, { _id: true, timestamps: false });

const amcSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  amc_number:      { type: String, required: true },
  customer:        { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name:   { type: String, required: true },
  customer_phone:  { type: String, default: '' },
  product_name:    { type: String, required: true },
  product_brand:   { type: String, default: '' },
  serial_number:   { type: String, default: '' },
  model_number:    { type: String, default: '' },
  amc_start_date:  { type: Date, required: true },
  amc_end_date:    { type: Date, required: true },
  amc_amount:      { type: Number, default: 0 },
  payment_status:  { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'unpaid' },
  visits_included: { type: Number, default: 0 },
  visits_used:     { type: Number, default: 0 },
  status:          { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  notes:           { type: String, default: '' },
  visits:          [visitSchema],
}, { timestamps: true });

amcSchema.index({ shop: 1, status: 1, amc_end_date: 1 });
amcSchema.index({ shop: 1, customer: 1 });
amcSchema.index({ shop: 1, amc_number: 1 }, { unique: true });
amcSchema.index({ shop: 1, serial_number: 1 }, { sparse: true });

module.exports = mongoose.model('AMC', amcSchema);
