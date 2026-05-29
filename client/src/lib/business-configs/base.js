/**
 * BASE_TERMINOLOGY
 *
 * Complete set of every terminology key the app may ever read.
 * Industry-specific configs only override what differs from this baseline.
 * All keys here use "general store / retail" defaults.
 */
export const BASE_TERMINOLOGY = {

  // ─── Entity abstraction ───────────────────────────────────────────────────
  entityType: 'product',

  // ─── Form section labels (configurable per business type) ─────────────────
  formSectionLabels: {
    basics:  'Basic Information',
    pricing: 'Pricing',
    stock:   'Stock & Inventory',
    tax:     'GST & Tax',
  },

  // ─── Inventory behavior engine ────────────────────────────────────────────
  // Controls which advanced inventory features are active for this business type.
  // ALL features are opt-in; simple mode (no special tracking) is the default.
  inventoryBehavior: {
    // Primary mode determines the main UX panel shown in the product page
    mode: 'simple',          // 'simple' | 'batch' | 'variant' | 'serial' | 'recipe'

    // Feature flags (multiple can be true)
    trackBatches:    false,  // pharmacy, bakery, grocery → batch number + expiry per purchase
    trackExpiry:     false,  // pharmacy, cosmetics, grocery → expiry date alerts
    trackVariants:   false,  // clothing, footwear, sports → per-size/color stock
    trackSerials:    false,  // electronics, mobile → per-unit serial/IMEI tracking
    supportRecipes:  false,  // restaurant, bakery, sweet_shop → ingredient deduction on sale
    supportLooseQty: false,  // hardware, grocery, kirana → decimal + unit conversion

    // Variant configuration (only used when trackVariants = true)
    variantDimensions: [],   // e.g. ['size', 'color']
    sizeOptions: [],         // predefined size choices shown in variant matrix
    colorOptions: [],        // predefined color choices

    // Unit system
    stockUnit: 'pcs',
    allowedUnits: ['pcs'],

    // Expiry alert window (days before expiry to show warning)
    expiryAlertDays: 30,

    // Contextual UI labels
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry Date',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',

    // Stock deduction behavior (used server-side via item_metadata)
    // 'simple': deduct from product.quantity only (default)
    // 'fefo':   First Expired First Out — pharmacy auto-selects nearest-expiry batch
    // 'fifo':   First In First Out — oldest batch first
    // 'variant': deduct from specific variant
    // 'serial':  mark specific serial as sold
    // 'recipe':  deduct ingredients on sale (requires deduct_recipe: true in item_metadata)
    deductionMethod: 'simple',
  },

  // ─── Core entity labels ───────────────────────────────────────────────────
  product:        'Product',
  products:       'Products',
  productHindi:   'सामान',
  item:           'Item',
  items:          'Items',
  inventory:      'Inventory',

  // ─── Transaction labels ───────────────────────────────────────────────────
  invoice:        'Invoice',
  invoices:       'Invoices',
  sale:           'Sale',
  sales:          'Sales',
  purchase:       'Purchase',
  purchases:      'Purchases',

  // ─── People labels ────────────────────────────────────────────────────────
  customer:       'Customer',
  customers:      'Customers',
  customerHindi:  'ग्राहक',
  supplier:       'Supplier',
  suppliers:      'Suppliers',
  supplierHindi:  'सप्लायर',

  // ─── Primary actions ──────────────────────────────────────────────────────
  addProduct:     'Add Product',
  newSale:        'New Sale',
  newPurchase:    'New Purchase',
  editSale:       'Edit Sale',
  editPurchase:   'Edit Purchase',

  // ─── Search / filter placeholders ────────────────────────────────────────
  searchProduct:  'Search products by name or barcode...',
  searchCustomer: 'Search customer name or phone...',
  searchSupplier: 'Search supplier name or phone...',
  searchSale:     'Search invoice, customer, product...',
  searchPurchase: 'Search purchase, supplier, product...',

  // ─── Form field placeholders ─────────────────────────────────────────────
  customerNamePlaceholder:  'Customer का नाम',
  customerPhonePlaceholder: 'Phone number',
  supplierNamePlaceholder:  'Supplier का नाम',
  supplierPhonePlaceholder: 'Phone number',

  // ─── Empty states ─────────────────────────────────────────────────────────
  noProducts:   'No products added yet.',
  noCustomers:  'No customers found.',
  noSuppliers:  'No suppliers found.',
  noSales:      'No sales yet.',
  noPurchases:  'No purchases yet.',

  // ─── Section / table headers ─────────────────────────────────────────────
  customerSection: 'Customer Info',
  supplierSection: 'Supplier Info',
  itemsSection:    'Items',

  // ─── Directory page labels ────────────────────────────────────────────────
  customerDirectory:      'Customer Directory',
  customerDirectoryHindi: 'ग्राहक लिस्ट',
  supplierDirectory:      'Supplier Directory',
  supplierDirectoryHindi: 'सप्लायर लिस्ट',
  refreshingCustomers:    'Refreshing customers…',
  refreshingSuppliers:    'Refreshing suppliers...',
  allSuppliers:           'All Suppliers',
  selectSupplier:         'Select a supplier to see details.',
  backToSales:            'Back to Sales',
  backToPurchases:        'Back to Purchases',

  // ─── Dashboard quick actions (Hindi-dominant bilingual) ───────────────────
  quickNewSale:         'New Invoice',
  quickNewSaleHindi:    'नया Invoice बनाओ',
  quickPurchase:        'Buy Stock',
  quickPurchaseHindi:   'माल खरीदो',
  quickAddStock:        'Add Product',
  quickAddStockHindi:   'Product जोड़ो',

  // ─── Dashboard KPI labels ─────────────────────────────────────────────────
  kpiTotalSales:      'Total Sales',
  kpiTotalPurchases:  'Total Purchases',
  kpiInvoices:        'Invoices',
  kpiLowStock:        'Low Stock',
  kpiOutOfStock:      'Out of Stock',
  kpiInventoryValue:  'Inventory Value',
  kpiTotalProducts:   'Total Products',
  kpiTotalCustomers:  'Total Customers',
  kpiRecentSales:     'Recent Sales',
};
