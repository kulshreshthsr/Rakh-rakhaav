const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  shop:             { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',     required: true },
  project_number:   { type: String, required: true },
  name:             { type: String, required: true, trim: true },
  customer:         { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name:    { type: String, default: '' },
  site_address:     { type: String, default: '' },
  estimated_value:  { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'completed', 'on_hold', 'cancelled'],
    default: 'active',
  },
  start_date:        { type: Date, default: Date.now },
  expected_end_date: { type: Date, default: null },
  actual_end_date:   { type: Date, default: null },
  notes:             { type: String, default: '' },
}, { timestamps: true });

projectSchema.index({ shop: 1, status: 1, createdAt: -1 });
projectSchema.index({ shop: 1, customer: 1 });
projectSchema.index({ shop: 1, project_number: 1 }, { unique: true });

module.exports = mongoose.model('Project', projectSchema);
