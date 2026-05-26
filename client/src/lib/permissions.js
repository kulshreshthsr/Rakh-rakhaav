// All available permissions — mirrors server/models/roleModel.js
export const PERMISSIONS = {
  VIEW_DASHBOARD:     'VIEW_DASHBOARD',
  MANAGE_INVENTORY:   'MANAGE_INVENTORY',
  CREATE_INVOICE:     'CREATE_INVOICE',
  VIEW_SALES:         'VIEW_SALES',
  MANAGE_SALES:       'MANAGE_SALES',
  CREATE_PURCHASE:    'CREATE_PURCHASE',
  VIEW_PURCHASES:     'VIEW_PURCHASES',
  MANAGE_PURCHASES:   'MANAGE_PURCHASES',
  VIEW_EXPENSES:      'VIEW_EXPENSES',
  MANAGE_EXPENSES:    'MANAGE_EXPENSES',
  VIEW_INCOME:        'VIEW_INCOME',
  MANAGE_INCOME:      'MANAGE_INCOME',
  VIEW_BANK:          'VIEW_BANK',
  MANAGE_BANK:        'MANAGE_BANK',
  VIEW_REPORTS:       'VIEW_REPORTS',
  VIEW_GST:           'VIEW_GST',
  VIEW_UDHAAR:        'VIEW_UDHAAR',
  MANAGE_UDHAAR:      'MANAGE_UDHAAR',
  MANAGE_CUSTOMERS:   'MANAGE_CUSTOMERS',
  MANAGE_SUPPLIERS:   'MANAGE_SUPPLIERS',
  MANAGE_USERS:       'MANAGE_USERS',
  MANAGE_ROLES:       'MANAGE_ROLES',
};

export const SYSTEM_ROLES = {
  owner:     { label: 'Owner',      color: 'green',  permissions: Object.values(PERMISSIONS) },
  manager:   { label: 'Manager',    color: 'blue',   permissions: Object.values(PERMISSIONS).filter(p => !['MANAGE_USERS','MANAGE_ROLES'].includes(p)) },
  accountant:{ label: 'Accountant', color: 'purple', permissions: ['VIEW_DASHBOARD','VIEW_SALES','VIEW_PURCHASES','VIEW_EXPENSES','MANAGE_EXPENSES','VIEW_INCOME','MANAGE_INCOME','VIEW_BANK','MANAGE_BANK','VIEW_REPORTS','VIEW_GST'] },
  cashier:   { label: 'Cashier',    color: 'orange', permissions: ['VIEW_DASHBOARD','MANAGE_INVENTORY','CREATE_INVOICE','VIEW_SALES','MANAGE_CUSTOMERS','VIEW_UDHAAR','MANAGE_UDHAAR'] },
  viewer:    { label: 'Viewer',     color: 'slate',  permissions: ['VIEW_DASHBOARD','VIEW_SALES','VIEW_PURCHASES','VIEW_EXPENSES','VIEW_INCOME','VIEW_BANK','VIEW_REPORTS','VIEW_GST','VIEW_UDHAAR'] },
};

export const ROLE_COLORS = {
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200'   },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-200'   },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200'  },
};

// Read the current user from localStorage
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

// Returns the current user's permission list.
// Owners get every permission; stored permissions used for sub-users.
export function getUserPermissions() {
  const user = getStoredUser();
  if (!user) return [];
  if (!user.isSubUser || user.role === 'owner') return Object.values(PERMISSIONS);
  return user.permissions || SYSTEM_ROLES[user.role]?.permissions || [];
}

// Check if current user has a specific permission
export function hasPermission(permission) {
  const user = getStoredUser();
  if (!user) return false;
  if (!user.isSubUser || user.role === 'owner') return true;
  const perms = user.permissions || SYSTEM_ROLES[user.role]?.permissions || [];
  return perms.includes(permission);
}

// Check if current user is the shop owner
export function isOwner() {
  const user = getStoredUser();
  return user ? !user.isSubUser && user.role === 'owner' : false;
}

// Returns role label for display
export function getRoleLabel(roleName) {
  return SYSTEM_ROLES[roleName]?.label || roleName || 'Unknown';
}

export function getRoleColor(roleName, colorOverride) {
  const color = colorOverride || SYSTEM_ROLES[roleName]?.color || 'slate';
  return ROLE_COLORS[color] || ROLE_COLORS.slate;
}
