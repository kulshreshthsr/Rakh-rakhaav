export default {
  // Entity labels
  product:        'Item',
  products:       'Grocery Items',
  productHindi:   'किराना',
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
  searchProduct:  'Search grocery items by name or brand...',
  searchSale:     'Search bill, customer, item...',

  // Empty states
  noProducts:   'No grocery items added yet.',
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
  kpiTotalProducts: 'Grocery Items',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Item Name',
    descriptionLabel: 'Description',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Kg', 'Gram', 'Litre', 'ml', 'Piece', 'Pack', 'Packet', 'Bottle', 'Box', 'Dozen', 'Bundle'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
    { key: 'category', label: 'Category', type: 'select', options: ['Grains & Pulses', 'Dairy', 'Fruits & Vegetables', 'Snacks', 'Beverages', 'Spices', 'Oils & Ghee', 'Personal Care', 'Cleaning', 'Other'] },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Product Details',
      fields: [
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
        { key: 'category', label: 'Category', type: 'select', options: ['Grains & Pulses', 'Dairy & Eggs', 'Fruits & Vegetables', 'Snacks & Namkeen', 'Beverages', 'Spices & Masala', 'Oils & Ghee', 'Frozen Foods', 'Personal Care', 'Cleaning & Home', 'Baby Care', 'Other'] },
        { key: 'is_loose',      label: 'Sold Loose (by weight/volume)', type: 'checkbox', defaultValue: false, hint: 'Enable for items sold by kg or litre' },
        { key: 'loose_unit',   label: 'Loose Measure Unit', type: 'select', options: ['Kg', 'Gram', '500g', '250g', 'Litre', 'ml', '500ml'], visibleWhen: { key: 'is_loose', value: true } },
        { key: 'min_loose_qty',label: 'Minimum Loose Qty',  type: 'text',   placeholder: 'e.g. 100g, 0.25 kg, 250 ml', visibleWhen: { key: 'is_loose', value: true }, hint: 'Minimum quantity per transaction' },
      ],
    },
    {
      title: 'Expiry & Storage',
      fields: [
        { key: 'expiry_date',  label: 'Expiry Date',  type: 'date' },
        { key: 'is_perishable',label: 'Perishable Item', type: 'checkbox', defaultValue: false },
        { key: 'storage_temp', label: 'Storage',       type: 'select', options: ['Dry / Room Temp', 'Cool & Dry', 'Refrigerate (2–8°C)', 'Freeze (below 0°C)'], visibleWhen: { key: 'is_perishable', value: true } },
        { key: 'country_origin', label: 'Country of Origin', type: 'text', placeholder: 'e.g. India' },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'simple',
    trackBatches:    false,
    trackExpiry:     true,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: true,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Kg', 'Gram', '500g', '250g', '100g', 'Litre', 'ML', '500ml', 'Packet', 'Dozen', 'Box', 'Can'],
    expiryAlertDays: 14,
    stockLabel:   'Stock',
    batchLabel:   'Batch / Lot No.',
    expiryLabel:  'Best Before / Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🥦', color: 'green',
      title: 'Grocery Mode Active',
      body: 'Fresh produce, FMCG management & daily stock tracking.',
      cta: 'Grocery Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'fresh',     icon: '🥬', label: 'Fresh Produce',  sublabel: 'Perishable stock check', href: '/product',   color: 'green', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Daily Sales',    sublabel: "Today's grocery bills",  href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Stock Purchase', sublabel: 'Restock from supplier',  href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Check expiry on perishables daily. Keep track of FMCG reorder levels.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Counter Staff',  emoji: '🥦', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, purchases & reports' },
      { role: 'viewer',  businessLabel: 'Delivery Staff', emoji: '🚴', description: 'View orders only — no billing access' },
    ],
  },

  reportConfig: {
    pageTitle:       'Grocery Reports',
    pageSubtitle:    'Fresh produce sales, perishable tracking & daily trends',
    accentColor:     '#16a34a',
    topItemsLabel:   'Top Grocery Items',
    topItemsIcon:    '🥦',
    topBuyersLabel:  'Regular Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Grocery Analytics',
    chartColor:      '#16a34a',
    insights: [
      { icon: '🥦', text: 'Check perishable expiry daily. Fruits and vegetables must be discarded promptly after expiry.' },
      { icon: '📊', text: 'Daily sales volume is the most important grocery KPI — track every day without gaps.' },
      { icon: '🌿', text: 'Seasonal produce demand shifts weekly. Monitor fast-moving items closely.' },
    ],
  },

  invoiceConfig: {
    itemSectionTitle: 'Grocery Items',
    footerNote:       'Fresh produce quality assured. Check expiry date before purchase. Cold chain products store as directed.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',   sublabel: "Today's Revenue"        },
    kpi2: { label: 'Bills',          sublabel: 'Customers served'        },
    kpi3: { label: 'मुनाफा',        sublabel: 'Gross profit'            },
    kpi4: { label: 'Udhaar',         sublabel: 'Regular customer dues'   },
    kpi5: { label: 'GST Payable',    sublabel: 'This month'              },
    kpi6: { label: 'Expiry Alerts',  sublabel: 'Perishables check'       },
  },
};
