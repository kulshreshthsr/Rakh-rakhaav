/**
 * TERM_GROUPS
 *
 * Maps semantic group names to the terminology keys they contain.
 * This is the single source of truth for which keys belong where.
 *
 * Used by:
 *  - resolver.js  → resolveTermGroup(businessType, groupName)
 *  - useTerminology.js → builds memoized group objects in React
 *
 * Rule: every key here must exist in business-configs/base.js.
 * Adding a key to base.js without adding it to a group means
 * components can still reach it via term('key') but won't get it
 * in any pre-built group object.
 */

export const TERM_GROUPS = {

  // ─── Core entity labels ─────────────────────────────────────────────────
  // What things are called in this business (products, customers, invoices…)
  labels: [
    'product', 'products', 'productHindi',
    'item', 'items',
    'inventory',
    'invoice', 'invoices',
    'sale', 'sales',
    'purchase', 'purchases',
    'customer', 'customers', 'customerHindi',
    'supplier', 'suppliers', 'supplierHindi',
  ],

  // ─── Search / filter placeholders ───────────────────────────────────────
  // Text that goes inside <input placeholder="...">
  placeholders: [
    'searchProduct',
    'searchCustomer',
    'searchSupplier',
    'searchSale',
    'searchPurchase',
    'customerNamePlaceholder',
    'customerPhonePlaceholder',
    'supplierNamePlaceholder',
    'supplierPhonePlaceholder',
  ],

  // ─── Action / button labels ──────────────────────────────────────────────
  // Text for buttons, CTAs, and action links
  actions: [
    'addProduct',
    'newSale',
    'newPurchase',
    'editSale',
    'editPurchase',
  ],

  // ─── Empty state messages ────────────────────────────────────────────────
  // Shown when a list is empty
  emptyStates: [
    'noProducts',
    'noCustomers',
    'noSuppliers',
    'noSales',
    'noPurchases',
  ],

  // ─── Section / table headers ─────────────────────────────────────────────
  // Labels for form sections, card headers, table group headers
  sections: [
    'customerSection',
    'supplierSection',
    'itemsSection',
  ],

  // ─── Directory page labels ───────────────────────────────────────────────
  // Text specific to the customers and suppliers directory pages
  directory: [
    'customerDirectory',
    'customerDirectoryHindi',
    'supplierDirectory',
    'supplierDirectoryHindi',
    'refreshingCustomers',
    'refreshingSuppliers',
    'allSuppliers',
    'selectSupplier',
    'backToSales',
    'backToPurchases',
  ],

  // ─── Dashboard quick actions ─────────────────────────────────────────────
  // Text for the dashboard's primary action buttons (Hindi-dominant UI)
  quickActions: [
    'quickNewSale',
    'quickNewSaleHindi',
    'quickPurchase',
    'quickPurchaseHindi',
    'quickAddStock',
    'quickAddStockHindi',
  ],

  // ─── Dashboard KPI card labels ───────────────────────────────────────────
  // Titles and sub-labels for metric cards on the dashboard
  kpis: [
    'kpiTotalSales',
    'kpiTotalPurchases',
    'kpiInvoices',
    'kpiLowStock',
    'kpiOutOfStock',
    'kpiInventoryValue',
    'kpiTotalProducts',
    'kpiTotalCustomers',
    'kpiRecentSales',
  ],
};

/** Flat list of every key that belongs to at least one group. */
export const ALL_GROUP_KEYS = [...new Set(Object.values(TERM_GROUPS).flat())];
