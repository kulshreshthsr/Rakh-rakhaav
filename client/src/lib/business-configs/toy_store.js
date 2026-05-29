export default {
  // Entity labels
  product:        'Toy',
  products:       'Toys',
  productHindi:   'खिलौना',
  item:           'Toy',
  items:          'Toys',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Toy',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search toys by name, age group, brand...',
  searchSale:     'Search bill, customer, toy...',

  // Empty states
  noProducts:   'No toys added yet.',
  noSales:      'No bills yet.',

  // Section headers
  itemsSection: 'Toys',

  // Directory pages
  backToSales:  'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Toy',
  quickAddStockHindi: 'Toy जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Toys',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Toy Name',
    descriptionLabel: 'Description / Features',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Set', 'Pack', 'Box'],
    attributesTitle:  'Toy Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',     label: 'Brand',      type: 'text',   placeholder: 'e.g. Lego, Fisher-Price' },
    { key: 'age_group', label: 'Age Group',  type: 'select', options: ['0-1 yr', '1-3 yrs', '3-5 yrs', '5-8 yrs', '8-12 yrs', '12+ yrs', 'All Ages'] },
    { key: 'category',  label: 'Category',   type: 'select', options: ['Action Figure', 'Doll', 'Vehicle', 'Board Game', 'Puzzle', 'Educational', 'Outdoor', 'Electronic', 'Stuffed Toy', 'Building Blocks', 'Other'] },
    { key: 'material',  label: 'Material',   type: 'select', options: ['Plastic', 'Wood', 'Metal', 'Fabric', 'Foam', 'Other'] },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Toy Details',
      fields: [
        { key: 'category',  label: 'Category',  type: 'select', options: ['Action Figure', 'Doll & Dollhouse', 'Vehicle & Remote Control', 'Board Game & Card Game', 'Puzzle & Brain Teaser', 'Educational', 'Outdoor & Sports', 'Electronic Toy', 'Stuffed / Plush Toy', 'Building Blocks / LEGO', 'Arts & Craft Kit', 'Musical Toy', 'Other'] },
        { key: 'brand',     label: 'Brand',     type: 'text',   placeholder: 'e.g. Lego, Fisher-Price, Funskool' },
        { key: 'age_group', label: 'Age Group', type: 'select', options: ['0-1 yr', '1-3 yrs', '3-5 yrs', '5-8 yrs', '8-12 yrs', '12+ yrs', 'All Ages'] },
        { key: 'material',  label: 'Material',  type: 'select', options: ['Plastic', 'Wood', 'Metal', 'Fabric / Plush', 'Foam', 'Paper / Cardboard', 'Other'] },
      ],
    },
    {
      title: 'Safety & Compliance',
      fields: [
        { key: 'is_battery_required', label: 'Battery Required',   type: 'checkbox', defaultValue: false },
        { key: 'battery_type',        label: 'Battery Type',       type: 'text', placeholder: 'e.g. AA x2, Rechargeable USB', visibleWhen: { key: 'is_battery_required', value: true } },
        { key: 'is_bis_certified',    label: 'BIS / ISI Certified', type: 'checkbox', defaultValue: false, hint: 'BIS certification is mandatory for certain toys sold in India' },
        { key: 'is_bpa_free',         label: 'BPA Free',            type: 'checkbox', defaultValue: false },
        { key: 'gender_target',       label: 'Targeted For',        type: 'select', options: ['Boys', 'Girls', 'Unisex'] },
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
    allowedUnits: ['Piece', 'Set', 'Pack', 'Box'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Color / Size',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🧸', color: 'amber',
      title: 'Toy Store Mode Active',
      body: 'Age-wise toy inventory, safety tracking & seasonal sales.',
      cta: 'Toy Inventory', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'toys',      icon: '🎮', label: 'Toy Inventory', sublabel: 'Age-wise toy stock',       href: '/product',   color: 'amber',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Toy Sales',     sublabel: "Today's toy sales",        href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Toys',  sublabel: 'Purchase new arrivals',   href: '/purchases', color: 'orange', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Track age group for each toy. Festival and holiday seasons drive highest demand.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Counter Staff',  emoji: '🧸', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Toy Store Reports',
    pageSubtitle:    'Toy sales, age group trends & seasonal performance',
    accentColor:     '#f59e0b',
    topItemsLabel:   'Top Toys',
    topItemsIcon:    '🧸',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Toy Store Analytics',
    chartColor:      '#f59e0b',
    insights: [
      { icon: '🧸', text: 'Track age group for each toy. Wrong age recommendation leads to returns and complaints.' },
      { icon: '🎉', text: 'Festival and holiday seasons drive 4-5x demand. Pre-stock popular toys well in advance.' },
      { icon: '🔒', text: 'BIS certification is mandatory for toys sold in India. Verify compliance on each purchase.' },
    ],
  },

  invoiceConfig: {
    accentColor:      '#f59e0b',
    itemSectionTitle: 'Toys',
    footerNote:       'Check age suitability before purchase. Keep small parts away from children under 3 years. Exchange within 7 days with original bill.',
  },
};
