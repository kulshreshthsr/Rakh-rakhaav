export default {
  // Entity labels
  product:        'Equipment',
  products:       'Sports Equipment',
  productHindi:   'स्पोर्ट्स सामान',
  item:           'Equipment',
  items:          'Equipment',
  inventory:      'Stock',

  // Actions
  addProduct:     'Add Equipment',
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchProduct:  'Search sports equipment by name, sport, brand...',
  searchSale:     'Search invoice, customer, equipment...',

  // Empty states
  noProducts:   'No equipment added yet.',
  noSales:      'No invoices yet.',

  // Section headers
  itemsSection: 'Equipment',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickAddStock:      'Add Equipment',
  quickAddStockHindi: 'Equipment जोड़ो',

  // Directory pages
  backToSales:  'Back to Invoices',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Equipment Items',
  kpiRecentSales:   'Recent Invoices',

  productFormSchema: {
    nameLabel:        'Equipment Name',
    descriptionLabel: 'Description / Specifications',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Set', 'Pair', 'Pack', 'Kit'],
    attributesTitle:  'Equipment Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'e.g. Adidas, Nike, Cosco' },
    { key: 'sport',    label: 'Sport',    type: 'select', options: ['Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Hockey', 'Swimming', 'Cycling', 'Gym', 'Yoga', 'Other'] },
    { key: 'size',     label: 'Size',     type: 'text',   placeholder: 'Size or weight' },
    { key: 'material', label: 'Material', type: 'text',   placeholder: 'Material / composition' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Equipment Details',
      fields: [
        { key: 'sport',    label: 'Sport',    type: 'select', options: ['Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Hockey', 'Table Tennis', 'Swimming', 'Cycling', 'Gym & Fitness', 'Yoga', 'Martial Arts', 'Other'] },
        { key: 'category', label: 'Category', type: 'select', options: ['Ball', 'Bat / Racket', 'Protective Gear', 'Clothing', 'Footwear', 'Net / Goal', 'Fitness Equipment', 'Accessories', 'Kit / Set', 'Other'] },
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'e.g. Adidas, Nike, Cosco, SG' },
        { key: 'material', label: 'Material', type: 'text',   placeholder: 'e.g. Leather, Rubber, Fibre, Aluminum' },
      ],
    },
    {
      title: 'Specifications',
      fields: [
        { key: 'size',      label: 'Size / Weight', type: 'text',   placeholder: 'e.g. Size 5, 1.5 kg' },
        { key: 'color',     label: 'Color',         type: 'text',   placeholder: 'Color of item' },
        { key: 'age_group', label: 'Age Group',     type: 'select', options: ['Kids (Under 12)', 'Youth (12-18)', 'Adult', 'All Ages'] },
        { key: 'level',     label: 'Level',         type: 'select', options: ['Beginner', 'Intermediate', 'Professional', 'General'] },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'variant',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   true,
    variantDimensions: ['size', 'color'],
    sizeOptions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
    colorOptions: [],
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Pair', 'Set', 'Pack'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Size / Color',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'variant',
  },

  dashboardConfig: {
    callout: {
      icon: '⚽', color: 'green',
      title: 'Sports Store Mode Active',
      body: 'Sports equipment, apparel & accessory inventory management.',
      cta: 'Sports Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'equipment',   icon: '⚽', label: 'Equipment',   sublabel: 'All sports gear',         href: '/product',   color: 'green', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',       icon: '💰', label: 'Sales Today', sublabel: "Today's billing",          href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'bulk_orders', icon: '🏃', label: 'Bulk Orders', sublabel: 'Team/school orders',       href: '/sales',     color: 'teal',  permission: 'VIEW_SALES'       },
      { id: 'purchases',   icon: '📦', label: 'Purchases',   sublabel: 'Restock equipment',        href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Stock seasonal sports items. Cricket season and monsoon drive demand for different sports.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales Staff',   emoji: '⚽', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager', emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',      emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Sports Store Reports',
    pageSubtitle:    'Equipment sales, sport category trends & seasonal analytics',
    accentColor:     '#16a34a',
    topItemsLabel:   'Top Equipment',
    topItemsIcon:    '⚽',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'invoices',
    analyticsTitle:  'Sports Analytics',
    chartColor:      '#16a34a',
    insights: [
      { icon: '⚽', text: 'Stock seasonal sports items early. Cricket and monsoon seasons drive very different demands.' },
      { icon: '📦', text: 'Track size-wise variants for footwear and clothing separately per sport category.' },
      { icon: '🏅', text: 'Gym & fitness equipment is an emerging year-round demand — maintain consistent stock.' },
    ],
  },

  invoiceConfig: {
    documentTitle:      'Tax Invoice',
    accentColor:        '#16a34a',
    showVariantColumns: true,
    itemSectionTitle:   'Sports Equipment',
    showHsnColumn:      true,
    showGstColumns:     true,
    footerNote:         'Exchange within 7 days with original bill. Equipment once used cannot be returned.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',  sublabel: 'Total billed today'  },
    kpi2: { label: 'Bills',        sublabel: 'Customers served'    },
    kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'        },
    kpi4: { label: 'Udhaar',       sublabel: 'Team/club credit'    },
    kpi5: { label: 'GST Payable',  sublabel: 'This month'         },
    kpi6: { label: 'Stock Alerts', sublabel: 'Low stock items'    },
  },
};
