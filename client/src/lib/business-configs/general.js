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
  productAttributeSections: [
    {
      title: 'Product Details',
      icon: '🏷️',
      fields: [
        {
          key: 'brand',
          label: 'Brand',
          type: 'text',
          placeholder: 'e.g. Hindustan Unilever, ITC, Nestlé, Amul',
          required: false,
        },
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: [
            'FMCG',
            'Personal Care',
            'Household',
            'Food & Grocery',
            'Beverages',
            'Dairy & Eggs',
            'Cleaning Supplies',
            'Stationery',
            'Health & Medicine',
            'Baby Products',
            'Tobacco & Pan',
            'Other',
          ],
          required: false,
        },
        {
          key: 'sub_category',
          label: 'Sub-Category',
          type: 'text',
          placeholder: 'e.g. Shampoo, Biscuits, Detergent',
          required: false,
        },
        {
          key: 'pack_size',
          label: 'Pack Size / Weight',
          type: 'text',
          placeholder: 'e.g. 500g, 1L, 6-pack',
          required: false,
        },
      ],
    },
    {
      title: 'Stock & Storage',
      icon: '📦',
      fields: [
        {
          key: 'rack_location',
          label: 'Rack / Shelf Location',
          type: 'text',
          placeholder: 'e.g. Rack A2, Counter shelf',
          required: false,
        },
        {
          key: 'is_loose_sold',
          label: 'Sold Loose / Unpackaged',
          type: 'checkbox',
          required: false,
        },
        {
          key: 'expiry_date',
          label: 'Expiry Date',
          type: 'date',
          required: false,
        },
      ],
    },
  ],
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
    supportLooseQty: true,
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
      { id: 'udhaar',       icon: '💸', label: 'Udhaar Recovery', sublabel: 'Pending collections',   href: '/udhaar',              color: 'rose',   permission: 'VIEW_UDHAAR'      },
      { id: 'credit-aging', icon: '📊', label: 'Credit Aging',    sublabel: 'Overdue customer report', href: '/dashboard#credit-aging', color: 'indigo', permission: 'VIEW_UDHAAR'      },
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

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',      sublabel: 'Total billed today'          },
    kpi2: { label: 'Cash & UPI Today', sublabel: 'Cash received today'         },
    kpi3: { label: 'मुनाफा',          sublabel: 'Gross profit today'           },
    kpi4: { label: 'Udhaar',           sublabel: 'Customer credit outstanding' },
    kpi5: { label: 'GST Payable',      sublabel: 'This month estimate'         },
    kpi6: { label: 'Stock Alerts',     sublabel: 'Low / Out of stock items'    },
  },
};
