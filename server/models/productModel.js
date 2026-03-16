const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true }, // base price (without GST)
  quantity: { type: Number, default: 0 },
  unit: { type: String },
  hsn_code: { type: String }, // HSN/SAC code
  gst_rate: { type: Number, default: 0, enum: [0, 5, 12, 18, 28] }, // GST %
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);