export default {
  // Entity labels
  product:        'Cosmetic',
  products:       'Cosmetics',
  productHindi:   'कॉस्मेटिक्स',
  item:           'Cosmetic',
  items:          'Cosmetics',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Cosmetic',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search cosmetics by name, brand, skin type...',
  searchSale:     'Search bill, customer, cosmetic...',

  // Empty states
  noProducts:   'No cosmetics added yet.',
  noSales:      'No bills yet.',

  // Section headers
  itemsSection: 'Cosmetics',

  // Directory pages
  backToSales:  'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Cosmetic',
  quickAddStockHindi: 'Cosmetic जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Cosmetics',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Product Name',
    descriptionLabel: 'Description / Key Ingredients',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Bottle', 'Tube', 'Jar', 'Pack', 'Combo', 'Set'],
    attributesTitle:  'Product Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',     label: 'Brand',      type: 'text',   placeholder: 'Brand name' },
    { key: 'category',  label: 'Category',   type: 'select', options: ['Skincare', 'Haircare', 'Makeup', 'Fragrance', 'Body Care', 'Nail Care', 'Men\'s Grooming', 'Baby Care', 'Oral Care', 'Other'] },
    { key: 'skin_type', label: 'Skin Type',  type: 'select', options: ['All Skin Types', 'Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'N/A'] },
    { key: 'expiry_date',label: 'Expiry Date', type: 'date' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Product Details',
      fields: [
        { key: 'category',  label: 'Category',  type: 'select', options: ['Skincare', 'Haircare', 'Makeup / Colour', 'Fragrance / Perfume', 'Body Care', 'Nail Care', 'Men\'s Grooming', 'Baby Care', 'Oral Care', 'Sun Care', 'Other'] },
        { key: 'brand',     label: 'Brand',     type: 'text',   placeholder: 'e.g. Lakme, L\'Oreal, Mamaearth' },
        { key: 'skin_type', label: 'Skin Type', type: 'select', options: ['All Skin Types', 'Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'N/A'] },
        { key: 'shade',     label: 'Shade / Variant', type: 'text', placeholder: 'e.g. Rose Beige, Nude' },
      ],
    },
    {
      title: 'Safety & Expiry',
      fields: [
        { key: 'expiry_date',           label: 'Expiry Date',              type: 'date' },
        { key: 'is_dermatologist_tested',label: 'Dermatologist Tested',    type: 'checkbox', defaultValue: false },
        { key: 'is_cruelty_free',        label: 'Cruelty-Free',            type: 'checkbox', defaultValue: false },
        { key: 'is_vegan',               label: 'Vegan',                   type: 'checkbox', defaultValue: false },
        { key: 'is_paraben_free',        label: 'Paraben-Free',            type: 'checkbox', defaultValue: false },
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
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Pack', 'Box', 'ML', 'Gram', 'Set'],
    expiryAlertDays: 60,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry Date',
    variantLabel: 'Shade / Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '💄', color: 'rose',
      title: 'Cosmetics Mode Active',
      body: 'Beauty product inventory, brand tracking & batch management.',
      cta: 'Cosmetics Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'brands',    icon: '💅', label: 'Brand Inventory', sublabel: 'Products by brand',      href: '/product',   color: 'rose',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Beauty Sales',    sublabel: "Today's cosmetic sales", href: '/sales',     color: 'pink',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Beauty',  sublabel: 'Purchase from brands',   href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Check expiry on beauty products. Verify genuine batch codes to avoid counterfeits.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Beauty Advisor', emoji: '💄', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Cosmetics Reports',
    pageSubtitle:    'Brand sales, expiry tracking & beauty trends',
    accentColor:     '#be185d',
    topItemsLabel:   'Top Beauty Products',
    topItemsIcon:    '💄',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Beauty Analytics',
    chartColor:      '#db2777',
    insights: [
      { icon: '💄', text: 'Check expiry dates and batch codes on all cosmetics. Remove expired products immediately.' },
      { icon: '🔍', text: 'Verify batch authenticity. Counterfeit cosmetics pose serious health and legal risks.' },
      { icon: '💆', text: 'Seasonal launches and festival offers drive demand spikes — plan stock accordingly.' },
    ],
  },

  invoiceConfig: {
    accentColor:      '#db2777',
    itemSectionTitle: 'Cosmetics',
    footerNote:       'Check expiry date before use. Do a patch test for sensitive skin. No returns on opened products.',
  },
};
