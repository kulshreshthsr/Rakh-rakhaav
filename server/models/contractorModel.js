const mongoose = require('mongoose');

const contractorSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name: { type: String, required: true },
  phone: { type: String },
  gst_no: { type: String },
  address: { type: String },
  contractor_discount: { type: Number, default: 0 },   // % discount on all purchases
  credit_limit:        { type: Number, default: 0 },   // max credit allowed ₹
  current_outstanding: { type: Number, default: 0 },   // running credit balance ₹
  site_names:          [{ type: String }],              // sites they work on
  notes:               { type: String },
  isActive:            { type: Boolean, default: true },
}, { timestamps: true });

contractorSchema.index({ shop: 1, name: 1 });
contractorSchema.index({ shop: 1, phone: 1 });

module.exports = mongoose.model('Contractor', contractorSchema);
