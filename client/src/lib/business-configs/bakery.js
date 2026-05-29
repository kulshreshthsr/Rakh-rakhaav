export default {
  // Entity labels
  product:        'Item',
  products:       'Bakery Items',
  productHindi:   'बेकरी आइटम',
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
  searchProduct:  'Search bakery items by name...',
  searchSale:     'Search bill, customer, item...',

  // Empty states
  noProducts:   'No bakery items added yet.',
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
  kpiTotalProducts: 'Bakery Items',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Item Name',
    descriptionLabel: 'Ingredients / Description',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Piece', 'Kg', 'Gram', '250g', '500g', 'Slice', 'Dozen', 'Box', 'Pack'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi'],
    showBarcodeScanner: false,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'category',    label: 'Category',     type: 'select', options: ['Bread', 'Cake', 'Pastry', 'Cookie', 'Biscuit', 'Rusk', 'Puff', 'Muffin', 'Croissant', 'Other'] },
    { key: 'shelf_life',  label: 'Shelf Life',   type: 'select', options: ['Same Day', '1 Day', '2 Days', '3 Days', '1 Week', '2 Weeks', '1 Month', '3 Months'] },
    { key: 'is_veg',      label: 'Type',         type: 'select', options: ['Veg', 'Egg', 'Non-Veg'] },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Item Details',
      fields: [
        { key: 'category',    label: 'Category',    type: 'select', options: ['Bread', 'Cake', 'Pastry', 'Cookie', 'Biscuit', 'Rusk', 'Puff', 'Muffin', 'Croissant', 'Brownie', 'Doughnut', 'Pie', 'Other'] },
        { key: 'food_type',   label: 'Contains',    type: 'select', options: ['Veg', 'Eggless Veg', 'Contains Egg', 'Non-Veg'] },
        { key: 'is_sugarfree',label: 'Sugar-Free',  type: 'checkbox', defaultValue: false },
        { key: 'flavour',     label: 'Flavour',     type: 'text',   placeholder: 'e.g. Chocolate, Vanilla, Pineapple' },
      ],
    },
    {
      title: 'Freshness & Storage',
      fields: [
        { key: 'shelf_life',  label: 'Shelf Life',            type: 'select', options: ['Same Day', '1 Day', '2 Days', '3 Days', '1 Week', '2 Weeks', '1 Month', '3 Months'] },
        { key: 'storage',     label: 'Storage',               type: 'select', options: ['Room Temperature', 'Cool & Dry', 'Refrigerate', 'Freeze'] },
        { key: 'allergens',   label: 'Contains Allergens',    type: 'multiselect', options: ['Gluten', 'Dairy', 'Eggs', 'Tree Nuts', 'Peanuts', 'Soy', 'Sesame'], hint: 'Select all allergens present' },
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
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Kg', 'Gram', 'Dozen', 'Box', 'Tray', 'Slice'],
    expiryAlertDays: 2,
    stockLabel:   'Fresh Stock',
    batchLabel:   'Bake Batch',
    expiryLabel:  'Fresh Until',
    variantLabel: 'Flavour / Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe / Ingredients',
    deductionMethod: 'fifo',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Order',
    saleNounPlural: 'Orders',
    stages: [
      { id: 'received',  label: 'Order Received', color: 'amber',  icon: '📋', terminal: false },
      { id: 'baking',    label: 'Baking',         color: 'orange', icon: '🍞', terminal: false },
      { id: 'ready',     label: 'Ready',          color: 'green',  icon: '✅', terminal: false },
      { id: 'completed', label: 'Sold',           color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'received',
    transitions: {
      received:  ['baking', 'ready'],
      baking:    ['ready'],
      ready:     ['completed'],
      completed: [],
    },
    actions: {
      received:  [{ id: 'start_baking', label: 'Start Baking', icon: '🍞', nextStage: 'baking',     color: 'orange' }],
      baking:    [{ id: 'mark_ready',   label: 'Mark Ready',   icon: '✅', nextStage: 'ready',      color: 'green'  }],
      ready:     [{ id: 'sell',         label: 'Mark Sold',    icon: '💰', nextStage: 'completed',  color: 'slate', triggerInvoice: true }],
      completed: [],
    },
    dashboardWidgets: [
      { id: 'baking', label: 'In Oven', stages: ['baking'], icon: '🍞', color: 'orange' },
      { id: 'ready',  label: 'Ready',   stages: ['ready'],  icon: '✅', color: 'green'  },
    ],
    quickActions: [
      { id: 'new_order', label: 'New Order', labelHindi: 'नया Order', icon: '🍞', href: '/sales?open=1', permission: 'CREATE_INVOICE' },
      { id: 'in_oven',   label: 'In Oven',   labelHindi: 'Baking',    icon: '🔥', href: '/sales?wf=baking', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🥐', color: 'amber',
      title: 'Bakery Mode Active',
      body: 'Fresh batch tracking, production workflow & shelf-life management.',
      cta: 'Bakery Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'fresh',     icon: '🕐', label: 'Freshness Check', sublabel: 'Batch & expiry alerts', href: '/product',   color: 'orange', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: "Today's Sales",   sublabel: 'All bakery bills',      href: '/sales',     color: 'amber',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Ingredients',     sublabel: 'Raw material stock',    href: '/purchases', color: 'teal',   permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Always mark production date on batch. Discard items past shelf life.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Counter Staff',     emoji: '🥐', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Bakery Manager',    emoji: '👨‍🍳', description: 'Full access — sales, recipes & reports' },
      { role: 'viewer',  businessLabel: 'Baker / Production',emoji: '🍞', description: 'View inventory & recipe status only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Bakery Reports',
    pageSubtitle:    'Production performance, freshness waste & daily trends',
    accentColor:     '#d97706',
    topItemsLabel:   'Top Baked Items',
    topItemsIcon:    '🥐',
    topBuyersLabel:  'Regular Customers',
    invoiceUnit:     'orders',
    analyticsTitle:  'Bakery Analytics',
    chartColor:      '#d97706',
    insights: [
      { icon: '🥐', text: 'Mark production date on each batch. Discard items past shelf life to maintain quality.' },
      { icon: '📅', text: 'Morning hours drive the highest bakery revenue. Pre-bake popular items in advance.' },
      { icon: '📊', text: 'Weekend and festival demand spikes 2-3x — plan production 2 days in advance.' },
    ],
  },

  invoiceConfig: {
    accentColor:       '#d97706',
    showBatchColumns:  true,
    itemSectionTitle:  'Baked Goods',
    footerNote:        'Best consumed fresh. Check "Fresh Until" date before purchase. Store as directed on packaging.',
  },
};
