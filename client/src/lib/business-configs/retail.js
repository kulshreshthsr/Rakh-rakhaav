export default {
  // Entity labels
  productHindi:   'प्रोडक्ट',
  inventory:      'Stock',

  // Actions
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchSale:     'Search invoice, customer, product...',

  // Empty states
  noSales:        'No invoices yet.',

  // Directory pages
  backToSales:  'Back to Invoices',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',

  // KPIs
  kpiInvoices:    'Invoices',
  kpiRecentSales: 'Recent Invoices',

  productFormSchema: {
    nameLabel:        'Product Name',
    descriptionLabel: 'Description / Specifications',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      null,
    attributesTitle:  'Product Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes:  [],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Product Details',
      fields: [
        { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Electronics, Clothing, Food...' },
        { key: 'brand',    label: 'Brand',    type: 'text', placeholder: 'Brand name' },
        { key: 'size',     label: 'Size',     type: 'text', placeholder: 'Size, dimensions, or weight' },
        { key: 'color',    label: 'Color',    type: 'text', placeholder: 'Color or variant' },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'simple',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Box', 'Pack', 'Set', 'Dozen', 'Kg', 'Litre'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🏬', color: 'blue',
      title: 'Retail Mode Active',
      body: 'Product catalog, inventory management & customer billing.',
      cta: 'Retail Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'stock',     icon: '📦', label: 'Product Stock', sublabel: 'Inventory overview',      href: '/product',   color: 'blue',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Retail Sales',  sublabel: "Today's bills",           href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock',       sublabel: 'Purchase from suppliers', href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Set minimum stock levels to trigger low-stock alerts before items run out.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales Staff',   emoji: '🏪', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager', emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accountant',    emoji: '📊', description: 'Financial records, reports & GST only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Retail Reports',
    pageSubtitle:    'Product performance, customer trends & revenue analysis',
    accentColor:     '#1d4ed8',
    topItemsLabel:   'Top Products',
    topItemsIcon:    '🏬',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'invoices',
    analyticsTitle:  'Retail Analytics',
    chartColor:      '#1d4ed8',
    insights: [
      { icon: '🏬', text: 'Set minimum stock thresholds for all products to trigger timely reorders.' },
      { icon: '📊', text: 'Basket size (items per transaction) is a key retail performance metric to track.' },
      { icon: '🎯', text: 'Identify slow-moving stock monthly and plan promotions or clearance accordingly.' },
    ],
  },

  invoiceConfig: {
    itemSectionTitle: 'Products',
    footerNote:       'Thank you for your purchase! Exchange within 7 days with original bill.',
  },
};
