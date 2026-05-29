export default {
  // Entity labels
  product:        'Item',
  products:       'Items',
  productHindi:   'सामान',
  item:           'Item',
  items:          'Items',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Item',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search stationery items by name, brand...',
  searchSale:     'Search bill, customer, item...',

  // Empty states
  noProducts:   'No items added yet.',
  noSales:      'No bills yet.',

  // Directory pages
  backToSales:  'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Item',
  quickAddStockHindi: 'Item जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Items',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Item Name',
    descriptionLabel: 'Description / Specification',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Pack', 'Box', 'Dozen', 'Ream', 'Set', 'Bundle', 'Roll'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
    { key: 'category', label: 'Category', type: 'select', options: ['Pen & Pencil', 'Notebook', 'Paper', 'File & Folder', 'Art Supplies', 'Office Supplies', 'Printing', 'School Kit', 'Other'] },
    { key: 'color',    label: 'Color',    type: 'text',   placeholder: 'Color (if applicable)' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Item Details',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: ['Pen & Pencil', 'Marker & Highlighter', 'Notebook & Register', 'Paper & Ream', 'File & Folder', 'Art & Craft Supplies', 'Office Supplies', 'Printing & Stationery', 'School Kit', 'Rubber Stamp', 'Other'] },
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'e.g. Classmate, Camlin, Reynolds' },
        { key: 'color',    label: 'Color',    type: 'text',   placeholder: 'Color (e.g. Blue ink, Red cover)' },
        { key: 'for_use',  label: 'For Use',  type: 'select', options: ['School', 'College', 'Office', 'Art / Creative', 'General'] },
      ],
    },
    {
      title: 'Packaging',
      fields: [
        { key: 'pack_size', label: 'Pack Size', type: 'text', placeholder: 'e.g. Box of 12, Pack of 100, Single' },
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
    allowedUnits: ['Piece', 'Pack', 'Box', 'Dozen', 'Ream', 'Set'],
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
      icon: '✏️', color: 'indigo',
      title: 'Stationery Mode Active',
      body: 'Office & school stationery, bulk order tracking.',
      cta: 'Stationery Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'stock',     icon: '📎', label: 'Stationery Stock', sublabel: 'Office & school items',  href: '/product',   color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Stationery Sales', sublabel: "Today's sales",          href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Items',    sublabel: 'Purchase from supplier', href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Season demand peaks at school opening. Keep notebooks and pens well stocked.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Counter Staff',  emoji: '✏️', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Stationery Reports',
    pageSubtitle:    'Office & school supply sales, bulk trends & analytics',
    accentColor:     '#4338ca',
    topItemsLabel:   'Top Stationery Items',
    topItemsIcon:    '✏️',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Stationery Analytics',
    chartColor:      '#4338ca',
    insights: [
      { icon: '✏️', text: 'School season (June-July) peaks demand for notebooks, pens and stationery kits.' },
      { icon: '📦', text: 'Bulk orders from schools and offices are high-value — nurture these accounts actively.' },
      { icon: '📊', text: 'Identify slow-moving stationery every quarter to avoid dead stock accumulation.' },
    ],
  },

  invoiceConfig: {
    itemSectionTitle: 'Stationery Items',
    footerNote:       'No returns on opened or used items. Bulk order discounts available on request.',
  },
};
