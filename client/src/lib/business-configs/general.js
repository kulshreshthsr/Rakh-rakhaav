export default {
  productFormSchema: {
    nameLabel:        'Product Name',
    descriptionLabel: 'Description',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      null,
    attributesTitle:  'Additional Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes:  [],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

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
    allowedUnits: ['Piece', 'Box', 'Pack', 'Kg', 'Litre', 'Set', 'Dozen'],
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
      icon: '🏪', color: 'green',
      title: 'General Store Mode Active',
      body: 'Multi-category inventory, udhaar management & quick billing.',
      cta: 'View Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'stock',  icon: '📦', label: 'All Stock',       sublabel: 'Inventory overview',  href: '/product', color: 'green', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',  icon: '🧾', label: "Today's Sales",   sublabel: 'All bills today',      href: '/sales',   color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'udhaar', icon: '💸', label: 'Udhaar Recovery', sublabel: 'Pending collections', href: '/udhaar',  color: 'rose',  permission: 'VIEW_UDHAAR'      },
    ],
    tip: 'Keep low-stock alerts enabled. Regular udhaar collection keeps cash flow healthy.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Counter Staff', emoji: '🛒', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Shop Manager',  emoji: '👔', description: 'Full access except user management' },
      { role: 'accountant', businessLabel: 'Accountant',    emoji: '📊', description: 'View reports, expenses & financial records' },
    ],
  },

  reportConfig: {
    pageTitle:       'Store Reports',
    pageSubtitle:    'Sales analytics, stock movement & financial summary',
    accentColor:     '#16a34a',
    topItemsLabel:   'Top Products',
    topItemsIcon:    '🏪',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Store Analytics',
    chartColor:      '#16a34a',
    insights: [
      { icon: '🏪', text: 'Set minimum stock levels for fast-moving items to avoid stockouts.' },
      { icon: '💳', text: 'Monitor udhaar regularly. Outstanding credit affects your working capital.' },
      { icon: '📊', text: 'Review your top 10 products monthly to identify trends and adjust procurement.' },
    ],
  },

  invoiceConfig: {
    itemSectionTitle: 'Items',
  },
};
