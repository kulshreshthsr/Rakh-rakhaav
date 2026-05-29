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
  searchProduct:  'Search items by name or brand...',
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
    descriptionLabel: 'Description',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Kg', 'Gram', 'Litre', 'ml', 'Piece', 'Pack', 'Packet', 'Bottle', 'Box', 'Dozen'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
    { key: 'category', label: 'Category', type: 'select', options: ['Grains & Pulses', 'Dairy', 'Snacks', 'Beverages', 'Spices', 'Oils', 'Personal Care', 'Other'] },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Item Details',
      fields: [
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
        { key: 'category', label: 'Category', type: 'select', options: ['Grains & Pulses', 'Dairy & Eggs', 'Snacks & Namkeen', 'Beverages', 'Spices & Masala', 'Oils & Ghee', 'Personal Care', 'Cleaning', 'Other'] },
        { key: 'is_loose', label: 'Sold Loose (by weight)', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      title: 'Expiry',
      fields: [
        { key: 'expiry_date',  label: 'Expiry Date',  type: 'date' },
        { key: 'is_perishable',label: 'Perishable',   type: 'checkbox', defaultValue: false },
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
    allowedUnits: ['Piece', 'Kg', 'Gram', '500g', '250g', 'Litre', 'ML', '500ml', 'Packet', 'Bundle', 'Dozen', 'Box'],
    expiryAlertDays: 7,
    stockLabel:   'Stock',
    batchLabel:   'Batch / Lot',
    expiryLabel:  'Expiry Date',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🛒', color: 'green',
      title: 'Kirana Store Mode Active',
      body: 'FMCG tracking, loose quantity sales & daily stock management.',
      cta: 'Grocery Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'fmcg',      icon: '🥫', label: 'FMCG Items',     sublabel: 'Fast-moving goods',       href: '/product',   color: 'green', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Daily Sales',    sublabel: "Today's grocery bills",   href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Stock Purchase', sublabel: 'Restock from supplier',   href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Track loose quantity items (rice, dal) by weight. Regular stock counts prevent shortages.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Counter Staff',  emoji: '🛒', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Shop Manager',   emoji: '👔', description: 'Full access — sales, purchases & reports' },
      { role: 'viewer',  businessLabel: 'Delivery Staff', emoji: '🚴', description: 'View orders only — no billing access' },
    ],
  },

  reportConfig: {
    pageTitle:       'Kirana Reports',
    pageSubtitle:    'FMCG movement, daily sales & grocery trends',
    accentColor:     '#15803d',
    topItemsLabel:   'Top FMCG Items',
    topItemsIcon:    '🛒',
    topBuyersLabel:  'Regular Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Kirana Analytics',
    chartColor:      '#15803d',
    insights: [
      { icon: '🛒', text: 'Track loose quantity items (rice, dal, flour) by weight for accurate stock accounting.' },
      { icon: '📅', text: 'Month-start salary days are peak purchase times. Stock essentials well in advance.' },
      { icon: '💳', text: 'Udhaar is common in kirana stores — review outstanding customer credit weekly.' },
    ],
  },

  invoiceConfig: {
    itemSectionTitle: 'Items',
    footerNote:       'Thank you for shopping! Fresh produce quality assured.',
  },
};
