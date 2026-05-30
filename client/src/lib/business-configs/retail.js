export default {
  // Entity labels
  product:        'Product',
  products:       'Products',
  productHindi:   'प्रोडक्ट',
  item:           'Product',
  items:          'Products',
  inventory:      'Stock',

  // People
  customer:       'Customer',
  supplier:       'Brand / Supplier',

  // Transactions
  invoice:        'Tax Invoice',
  invoices:       'Tax Invoices',

  // Actions
  addProduct:     'Add Product',
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchProduct:  'Search products by name, brand, category...',
  searchSale:     'Search invoice, customer, product...',

  // Empty states
  noProducts:     'No products added yet.',
  noSales:        'No invoices yet.',

  // Directory pages
  backToSales:  'Back to Invoices',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickAddStock:      'Add Product',
  quickAddStockHindi: 'Product जोड़ो',

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
      icon: '🏷️',
      fields: [
        { key: 'brand',    label: 'Brand',    type: 'text', placeholder: 'Brand name' },
        { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Electronics, Apparel, Hardware, FMCG' },
        { key: 'model_no', label: 'Model No.',type: 'text', placeholder: 'Model number if applicable' },
        { key: 'mrp',      label: 'MRP',      type: 'number' },
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g. 1 year, 6 months' },
        { key: 'barcode',  label: 'Barcode',  type: 'text' },
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
      title: 'Retail Store Mode',
      body: 'General retail & trading.',
      cta: 'Retail Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'products',  icon: '📦', label: 'Products',    sublabel: 'All stock',             href: '/product',   color: 'blue',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '💰', label: 'Sales Today', sublabel: "Today's billing",        href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'udhaar',    icon: '📝', label: 'Udhaar',      sublabel: 'Customer credit',        href: '/udhaar',    color: 'amber', permission: 'VIEW_UDHAAR'      },
      { id: 'purchases', icon: '🚚', label: 'Purchases',   sublabel: 'Restock inventory',      href: '/purchases', color: 'slate', permission: 'CREATE_PURCHASE'  },
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
    documentTitle:    'Tax Invoice',
    accentColor:      '#1d4ed8',
    itemSectionTitle: 'Products',
    showHsnColumn:    true,
    showGstColumns:   true,
    footerNote:       'Thank you for your purchase! Exchange within 7 days with original bill.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई', sublabel: 'Total billed today' },
    kpi2: { label: 'Bills',       sublabel: 'Customers served'   },
    kpi3: { label: 'मुनाफा',     sublabel: 'Gross profit'       },
    kpi4: { label: 'Udhaar',      sublabel: 'Outstanding credit' },
    kpi5: { label: 'GST Payable', sublabel: 'This month'        },
    kpi6: { label: 'Stock Alerts',sublabel: 'Low stock items'   },
  },
};
