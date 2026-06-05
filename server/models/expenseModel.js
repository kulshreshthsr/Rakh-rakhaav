const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    shop:         { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    category:     { type: String, required: true },
    amount:       { type: Number, required: true },
    payment_mode: { type: String, enum: ['cash', 'bank', 'upi', null], default: null },
    reference_id: { type: String, default: '' },
    note:         { type: String, default: '' },
    date:         { type: Date, default: Date.now },

    // ─── Recurring ─────────────────────────────────────────────────────────────
    is_recurring:          { type: Boolean, default: false },
    frequency:             { type: String, enum: ['weekly', 'monthly', 'quarterly', null], default: null },
    next_due_date:         { type: Date, default: null },
    recurring_parent_id:   { type: mongoose.Schema.Types.ObjectId, default: null },
    is_recurring_template: { type: Boolean, default: false },

    // ─── Tax flag ──────────────────────────────────────────────────────────────
    is_tax_deductible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseSchema.index({ shop: 1, date: -1 });
expenseSchema.index({ shop: 1, is_recurring_template: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
