const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String, default: '' },
  hsn_code: { type: String, default: '' },
  ordered_quantity: { type: Number, required: true, default: 0 },
  received_quantity: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  agreed_price: { type: Number, default: 0 },
  gst_rate: { type: Number, default: 0 },
}, { _id: false });

purchaseOrderItemSchema.virtual('pending_quantity').get(function () {
  return Math.max(0, Number(this.ordered_quantity || 0) - Number(this.received_quantity || 0));
});

const purchaseOrderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  po_number: { type: String, required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplier_name: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'sent', 'partially_received', 'received', 'cancelled'], default: 'draft' },
  items: { type: [purchaseOrderItemSchema], default: [] },
  expected_delivery_date: { type: Date, default: null },
  delivery_site: { type: String, default: '' },
  notes: { type: String, default: '' },
  po_date: { type: Date, default: Date.now },
  total_amount: { type: Number, default: 0 },
  grn_number: { type: String, default: '' },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
}, { timestamps: true });

purchaseOrderSchema.index({ shop: 1, po_number: 1 }, { unique: true });
purchaseOrderSchema.index({ shop: 1, status: 1, po_date: -1 });
purchaseOrderSchema.index({ shop: 1, supplier: 1, po_date: -1 });

purchaseOrderSchema.set('toJSON', { virtuals: true });
purchaseOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
