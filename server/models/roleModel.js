const mongoose = require('mongoose');

const ALL_PERMISSIONS = [
  'VIEW_DASHBOARD',
  'MANAGE_INVENTORY',
  'CREATE_INVOICE', 'VIEW_SALES', 'MANAGE_SALES',
  'CREATE_PURCHASE', 'VIEW_PURCHASES', 'MANAGE_PURCHASES',
  'VIEW_EXPENSES', 'MANAGE_EXPENSES',
  'VIEW_INCOME', 'MANAGE_INCOME',
  'VIEW_BANK', 'MANAGE_BANK',
  'VIEW_REPORTS', 'VIEW_GST',
  'VIEW_UDHAAR', 'MANAGE_UDHAAR',
  'MANAGE_CUSTOMERS', 'MANAGE_SUPPLIERS',
  'MANAGE_USERS', 'MANAGE_ROLES',
  'VIEW_NARCOTICS', 'MANAGE_NARCOTICS',
];

const SYSTEM_ROLES = {
  owner: {
    label: 'Owner',
    color: 'green',
    permissions: ALL_PERMISSIONS,
  },
  manager: {
    label: 'Manager',
    color: 'blue',
    permissions: ALL_PERMISSIONS.filter(p => !['MANAGE_USERS', 'MANAGE_ROLES'].includes(p)),
  },
  accountant: {
    label: 'Accountant',
    color: 'purple',
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_SALES', 'VIEW_PURCHASES',
      'VIEW_EXPENSES', 'MANAGE_EXPENSES',
      'VIEW_INCOME', 'MANAGE_INCOME',
      'VIEW_BANK', 'MANAGE_BANK',
      'VIEW_REPORTS', 'VIEW_GST',
    ],
  },
  cashier: {
    label: 'Cashier',
    color: 'orange',
    permissions: [
      'VIEW_DASHBOARD',
      'MANAGE_INVENTORY',
      'CREATE_INVOICE', 'VIEW_SALES',
      'MANAGE_CUSTOMERS',
      'VIEW_UDHAAR', 'MANAGE_UDHAAR',
    ],
  },
  viewer: {
    label: 'Viewer',
    color: 'slate',
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_SALES', 'VIEW_PURCHASES',
      'VIEW_EXPENSES', 'VIEW_INCOME', 'VIEW_BANK',
      'VIEW_REPORTS', 'VIEW_GST', 'VIEW_UDHAAR',
    ],
  },
};

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, lowercase: true },
  label: { type: String, required: true, trim: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  permissions: [{ type: String, enum: ALL_PERMISSIONS }],
  color: { type: String, default: 'green' },
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

roleSchema.index({ shopId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
module.exports.ALL_PERMISSIONS = ALL_PERMISSIONS;
module.exports.SYSTEM_ROLES = SYSTEM_ROLES;
