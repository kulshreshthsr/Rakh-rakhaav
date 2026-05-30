export default {
  // Entity labels
  product:        'Gift Item',
  products:       'Gift Items',
  productHindi:   'गिफ्ट',
  item:           'Item',
  items:          'Items',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Gift Item',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search gift items by name, occasion...',
  searchSale:     'Search bill, customer, gift...',

  // Empty states
  noProducts:   'No gift items added yet.',
  noSales:      'No bills yet.',

  // Section headers
  itemsSection: 'Gift Items',

  // Directory pages
  backToSales:  'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Gift Item',
  quickAddStockHindi: 'Gift जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Gift Items',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Gift Item Name',
    descriptionLabel: 'Description / Theme',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Set', 'Pack', 'Dozen', 'Box'],
    attributesTitle:  'Gift Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'category', label: 'Category', type: 'select', options: ['Soft Toys', 'Showpiece', 'Mugs & Frames', 'Decoration', 'Wrapping', 'Candles', 'Personalised', 'Hamper', 'Other'] },
    { key: 'occasion', label: 'Occasion', type: 'select', options: ['Birthday', 'Wedding', 'Anniversary', 'Diwali', 'Holi', 'Christmas', 'Valentine\'s', 'Baby Shower', 'General', 'Other'] },
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name (optional)' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Gift Details',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: ['Soft Toys / Stuffed', 'Showpiece / Décor', 'Mugs & Photo Frames', 'Candles & Diyas', 'Hamper / Gift Box', 'Wrapping & Packaging', 'Personalised / Custom', 'Festive Decoration', 'Other'] },
        { key: 'occasion', label: 'Occasion', type: 'multiselect', options: ['Birthday', 'Wedding', 'Anniversary', 'Diwali', 'Holi', 'Christmas', 'Eid', 'Valentine\'s Day', 'Baby Shower', 'Corporate', 'General'] },
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name (optional)' },
        { key: 'color',    label: 'Color / Theme', type: 'text', placeholder: 'e.g. Red, Gold, Multicolor' },
      ],
    },
    {
      title: 'Customisation',
      fields: [
        { key: 'is_customisable', label: 'Can Be Personalised', type: 'checkbox', defaultValue: false },
        { key: 'custom_options',  label: 'Customisation Options', type: 'text', placeholder: 'e.g. Name, Photo, Message', visibleWhen: { key: 'is_customisable', value: true } },
        { key: 'message_included',label: 'Message Card Included',  type: 'checkbox', defaultValue: false },
        { key: 'gift_wrapped',    label: 'Gift Wrapping Available', type: 'checkbox', defaultValue: false },
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
    allowedUnits: ['Piece', 'Pack', 'Set', 'Box'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Color / Design',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🎁', color: 'rose',
      title: 'Gift Shop Mode Active',
      body: 'Seasonal gifts, custom orders & festive inventory management.',
      cta: 'Gift Inventory', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'seasonal',  icon: '🎄', label: 'Seasonal Stock', sublabel: 'Festival & occasion items', href: '/product',   color: 'rose',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Gift Sales',     sublabel: "Today's gift sales",        href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Gifts',  sublabel: 'Purchase new items',        href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Stock seasonal items early. Festival demand spikes — be prepared with advance orders.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Counter Staff',  emoji: '🎁', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Gift Shop Reports',
    pageSubtitle:    'Seasonal gift sales, occasion trends & inventory analytics',
    accentColor:     '#ec4899',
    topItemsLabel:   'Top Gift Items',
    topItemsIcon:    '🎁',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Gift Shop Analytics',
    chartColor:      '#ec4899',
    insights: [
      { icon: '🎁', text: 'Stock seasonal items early. Diwali and festival demand spikes 2-3 weeks before the event.' },
      { icon: '🎀', text: 'Gift wrapping and personalisation add value — track revenue from value-added services.' },
      { icon: '📅', text: 'Plan advance orders from suppliers 4-6 weeks before the festival season.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Gift Invoice',
    accentColor:      '#db2777',
    itemSectionTitle: 'Gift Items',
    showHsnColumn:    false,
    showGstColumns:   true,
    footerNote:       'Gifts cannot be returned or exchanged. Gift wrapping charges non-refundable.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई', sublabel: 'Total billed today' },
    kpi2: { label: 'Bills',       sublabel: 'Gifts sold'         },
    kpi3: { label: 'मुनाफा',     sublabel: 'Gross profit'       },
    kpi4: { label: 'Udhaar',      sublabel: 'Customer credit'    },
    kpi5: { label: 'GST Payable', sublabel: 'This month'        },
    kpi6: { label: 'Stock Alerts',sublabel: 'Low stock items'   },
  },
};
