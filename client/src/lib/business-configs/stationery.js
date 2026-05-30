export default {
  // Entity labels
  product:        'Stationery Item',
  products:       'Stationery Items',
  productHindi:   'सामान',
  item:           'Item',
  items:          'Items',
  inventory:      'Stationery Stock',

  // People
  supplier:       'Distributor',

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
      icon: '✏️',
      fields: [
        { key: 'brand',      label: 'Brand',            type: 'text',   placeholder: 'e.g. Classmate, Natraj, Camlin, Faber-Castell' },
        { key: 'category',   label: 'Category',         type: 'select', options: ['Pen / Pencil', 'Notebook / Diary', 'Art Supplies', 'Geometry Box', 'Bag / Pouch', 'Printer Paper', 'File / Folder', 'Adhesive / Tape', 'Craft Supplies', 'Other'] },
        { key: 'for_class',  label: 'For Class / Grade',type: 'select', options: ['Pre-School', 'Class 1-2', 'Class 3-5', 'Class 6-8', 'Class 9-10', 'Class 11-12', 'College', 'General / Office'] },
        { key: 'color',      label: 'Color / Variant',  type: 'text',   placeholder: 'e.g. Blue, Red, Ruled, Unruled' },
        { key: 'pack_size',  label: 'Pack Size',        type: 'text',   placeholder: 'e.g. Single, Box of 10, Pack of 5' },
      ],
    },
    {
      title: 'School Kit',
      icon: '🎒',
      fields: [
        { key: 'kit_category', label: 'Kit Category',    type: 'select', options: ['Individual Item', 'School Kit', 'Art Kit', 'Lab Kit', 'Sports Kit'] },
        { key: 'is_bulk_item', label: 'Bulk Order Item', type: 'boolean' },
        { key: 'bulk_unit',    label: 'Bulk Unit',       type: 'text',   placeholder: 'e.g. Gross (144), Dozen, Box of 100' },
      ],
    },
  ],

  modules: {
    udhaar:    true,
    purchases: true,
  },

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
      { id: 'stock',       icon: '✏️', label: 'Stock',       sublabel: 'All stationery',           href: '/product',   color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',       icon: '💰', label: 'Sales Today', sublabel: "Today's billing",           href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'school_kits', icon: '🎒', label: 'School Kits', sublabel: 'Bulk orders',              href: '/sales',     color: 'blue',   permission: 'VIEW_SALES'       },
      { id: 'purchases',   icon: '📦', label: 'Purchases',   sublabel: 'Reorder from supplier',    href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
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
    documentTitle:    'Bill',
    accentColor:      '#0891b2',
    itemSectionTitle: 'Stationery Items',
    showHsnColumn:    true,
    showGstColumns:   true,
    footerNote:       'Goods once sold will not be exchanged without original bill.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',  sublabel: 'Total billed today' },
    kpi2: { label: 'Bills',        sublabel: 'Customers served'   },
    kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit today' },
    kpi4: { label: 'Udhaar',       sublabel: 'School credit'      },
    kpi5: { label: 'GST Payable',  sublabel: 'This month'        },
    kpi6: { label: 'Stock Alerts', sublabel: 'Low stock items'   },
  },
};
