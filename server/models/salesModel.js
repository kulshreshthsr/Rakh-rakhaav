const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  total_amount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);