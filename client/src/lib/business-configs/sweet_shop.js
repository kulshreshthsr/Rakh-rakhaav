export default {
  // Entity labels
  product:        'Sweet / Item',
  products:       'Sweets & Items',
  productHindi:   'मिठाई',
  item:           'Item',
  items:          'Items',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Sweet / Item',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search sweets by name...',
  searchSale:     'Search bill, customer, sweet...',

  // Empty states
  noProducts:   'No sweets added yet.',
  noSales:      'No bills yet.',

  // Directory pages
  backToSales:  'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Sweet',
  quickAddStockHindi: 'Sweet जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Sweets',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Sweet / Item Name',
    descriptionLabel: 'Description / Ingredients',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Kg', 'Gram', '250g', '500g', 'Piece', 'Box', 'Pack', 'Dozen'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi'],
    showBarcodeScanner: false,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'category',   label: 'Category',   type: 'select', options: ['Barfi', 'Ladoo', 'Halwa', 'Gulab Jamun', 'Rasgulla', 'Jalebi', 'Peda', 'Khoya', 'Dry Fruit', 'Namkeen', 'Bakery', 'Seasonal', 'Other'] },
    { key: 'shelf_life', label: 'Shelf Life', type: 'select', options: ['Same Day', '1 Day', '2 Days', '3 Days', '1 Week', '2 Weeks', '1 Month'] },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Sweet Details',
      fields: [
        { key: 'category',    label: 'Category',    type: 'select', options: ['Barfi', 'Ladoo', 'Halwa', 'Gulab Jamun', 'Rasgulla', 'Jalebi', 'Peda', 'Khoya', 'Kaju Katli', 'Modak', 'Dry Fruit Sweet', 'Namkeen', 'Seasonal', 'Other'] },
        { key: 'base',        label: 'Made With',   type: 'select', options: ['Milk & Khoya', 'Besan', 'Maida', 'Suji', 'Rice', 'Dal', 'Dry Fruits', 'Sugar Syrup', 'Other'] },
        { key: 'is_sugarfree',label: 'Sugar-Free / Diabetic', type: 'checkbox', defaultValue: false },
        { key: 'is_jain',     label: 'Jain Friendly',         type: 'checkbox', defaultValue: false },
      ],
    },
    {
      title: 'Freshness & Packaging',
      fields: [
        { key: 'shelf_life',  label: 'Shelf Life',   type: 'select', options: ['Same Day', '1 Day', '2 Days', '3 Days', '1 Week', '2 Weeks', '1 Month'] },
        { key: 'storage',     label: 'Storage',      type: 'select', options: ['Room Temperature', 'Cool & Dry', 'Refrigerate'] },
        { key: 'box_sizes',   label: 'Box Sizes Available', type: 'tags', placeholder: '250g, 500g, 1kg...', hint: 'Enter available packaging sizes separated by commas' },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'batch',
    trackBatches:    true,
    trackExpiry:     true,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  true,
    supportLooseQty: true,
    stockUnit: 'kg',
    allowedUnits: ['Kg', 'Gram', '250g', '500g', 'Piece', 'Box'],
    expiryAlertDays: 3,
    stockLabel:   'Stock (Kg)',
    batchLabel:   'Batch / Production Date',
    expiryLabel:  'Best Before',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe / Ingredients',
    deductionMethod: 'fifo',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Order',
    saleNounPlural: 'Orders',
    stages: [
      { id: 'counter',   label: 'Counter',  color: 'pink',  icon: '🍬', terminal: false },
      { id: 'packed',    label: 'Packed',   color: 'green', icon: '📦', terminal: false },
      { id: 'completed', label: 'Sold',     color: 'slate', icon: '💰', terminal: true  },
    ],
    initialStage: 'counter',
    transitions: {
      counter:   ['packed'],
      packed:    ['completed'],
      completed: [],
    },
    actions: {
      counter:   [{ id: 'pack',  label: 'Pack & Weigh', icon: '📦', nextStage: 'packed',     color: 'green' }],
      packed:    [{ id: 'sell',  label: 'Collect & Bill', icon: '💰', nextStage: 'completed', color: 'slate', triggerInvoice: true }],
      completed: [],
    },
    dashboardWidgets: [
      { id: 'counter_sales', label: 'At Counter', stages: ['counter'], icon: '🍬', color: 'pink'  },
      { id: 'packed',        label: 'Packed',     stages: ['packed'],  icon: '📦', color: 'green' },
    ],
    quickActions: [
      { id: 'new_sale', label: 'New Sale', labelHindi: 'नई Sale', icon: '🍬', href: '/sales?open=1', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🍬', color: 'pink',
      title: 'Sweet Shop Mode Active',
      body: 'Shelf-life tracking, weight-based billing & counter sales.',
      cta: 'Sweet Inventory', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'freshness', icon: '⏰', label: 'Freshness Alert', sublabel: 'Check shelf-life stock', href: '/product',   color: 'orange', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: "Today's Sales",   sublabel: 'Counter & packed sales', href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Ingredients',     sublabel: 'Khoya, sugar & more',    href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Check shelf-life before counter display. Sugar-free items stored separately.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Counter Staff',       emoji: '🍮', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Shop Manager',        emoji: '👔', description: 'Full access — sales, production & reports' },
      { role: 'viewer',  businessLabel: 'Halwai / Production', emoji: '🍬', description: 'View inventory & batch records only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Sweet Shop Reports',
    pageSubtitle:    'Daily sales, freshness tracking & festive demand analytics',
    accentColor:     '#c026d3',
    topItemsLabel:   'Top Sweets',
    topItemsIcon:    '🍬',
    topBuyersLabel:  'Regular Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Sweet Shop Analytics',
    chartColor:      '#c026d3',
    insights: [
      { icon: '🍬', text: 'Check shelf-life daily. Sweets past expiry must be removed from display counters immediately.' },
      { icon: '⚖️', text: 'Weight-based items (ladoo, barfi) need accurate weighing — verify scales daily.' },
      { icon: '🎉', text: 'Festival periods (Diwali, Holi, Eid) drive 3-5x demand. Stock up well in advance.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Bill',
    accentColor:      '#f59e0b',
    itemSectionTitle: 'Items',
    showHsnColumn:    false,
    showGstColumns:   true,
    footerNote:       'Sweets are made fresh daily. Please consume within shelf life.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',   sublabel: "Today's Revenue"  },
    kpi2: { label: 'Items Sold',    sublabel: "Today's count"    },
    kpi3: { label: 'मुनाफा',       sublabel: 'Gross profit'     },
    kpi4: { label: 'Udhaar',        sublabel: 'Pending credit'   },
    kpi5: { label: 'GST Payable',   sublabel: 'This month'       },
    kpi6: { label: 'Expiry Alerts', sublabel: 'Fresh stock check'},
  },
};
