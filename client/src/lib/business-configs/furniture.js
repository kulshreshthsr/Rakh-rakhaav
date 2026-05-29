export default {
  // Entity labels
  product:        'Furniture Item',
  products:       'Furniture Items',
  productHindi:   'फर्नीचर',
  item:           'Item',
  items:          'Items',
  inventory:      'Stock',

  // People
  supplier:       'Manufacturer / Supplier',
  suppliers:      'Suppliers',

  // Actions
  addProduct:     'Add Furniture',
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchProduct:  'Search furniture by name, material, dimensions...',
  searchSupplier: 'Search manufacturer or supplier name...',
  searchSale:     'Search invoice, customer, furniture...',

  // Empty states
  noProducts:   'No furniture items added yet.',
  noSales:      'No invoices yet.',

  // Section headers
  supplierSection: 'Manufacturer / Supplier Info',
  itemsSection:    'Furniture Items',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickAddStock:      'Add Furniture',
  quickAddStockHindi: 'Furniture जोड़ो',

  // Directory pages
  backToSales:  'Back to Invoices',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Furniture Items',
  kpiRecentSales:   'Recent Invoices',

  productFormSchema: {
    nameLabel:        'Furniture Name',
    descriptionLabel: 'Description / Dimensions',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Piece', 'Set', 'Pair', 'Unit'],
    attributesTitle:  'Furniture Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: false,
    defaultPayment:     'credit',
  },
  productAttributes: [
    { key: 'category',  label: 'Category',  type: 'select', options: ['Sofa', 'Bed', 'Wardrobe', 'Dining Table', 'Chair', 'Desk', 'Almirah', 'Showcase', 'TV Unit', 'Kids Furniture', 'Other'] },
    { key: 'material',  label: 'Material',  type: 'select', options: ['Wood', 'Engineered Wood', 'Metal', 'Plastic', 'Rattan', 'Glass', 'Mixed'] },
    { key: 'finish',    label: 'Finish',    type: 'text',   placeholder: 'e.g. Walnut, Oak, White' },
    { key: 'dimensions',label: 'Dimensions',type: 'text',   placeholder: 'L x W x H (inches/cm)' },
    { key: 'warranty',  label: 'Warranty',  type: 'select', options: ['No Warranty', '6 Months', '1 Year', '2 Years', '5 Years'] },
  ],
  invoiceExtraFields: [
    { key: 'delivery_date',    label: 'Delivery Date',    type: 'date' },
    { key: 'delivery_address', label: 'Delivery Address', type: 'textarea', placeholder: 'Full delivery address' },
    { key: 'carpenter_name',   label: 'Installation By',  type: 'text', placeholder: 'Carpenter / installer name' },
  ],
  invoiceLineFields: [],

  productAttributeSections: [
    {
      title: 'Furniture Details',
      fields: [
        { key: 'category',  label: 'Category',  type: 'select', options: ['Sofa', 'Sectional', 'Bed', 'Wardrobe', 'Dining Table', 'Chair', 'Desk', 'Almirah', 'Showcase', 'TV Unit', 'Side Table', 'Kids Furniture', 'Other'] },
        { key: 'material',  label: 'Material',  type: 'select', options: ['Solid Wood', 'Engineered Wood / MDF', 'Metal', 'Plastic', 'Rattan / Cane', 'Glass', 'Upholstered', 'Mixed'] },
        { key: 'finish',    label: 'Finish / Color', type: 'text', placeholder: 'e.g. Walnut, Oak, Matte White' },
        { key: 'dimensions',label: 'Dimensions', type: 'text', placeholder: 'L x W x H in inches or cm' },
      ],
    },
    {
      title: 'Customisation & Assembly',
      fields: [
        { key: 'is_custom',           label: 'Custom / Made-to-Order',  type: 'checkbox', defaultValue: false },
        { key: 'assembly_required',   label: 'Assembly Required',       type: 'checkbox', defaultValue: false },
        { key: 'assembly_notes',      label: 'Assembly Notes',          type: 'text', placeholder: 'Notes for assembly team', visibleWhen: { key: 'assembly_required', value: true } },
      ],
    },
    {
      title: 'Warranty & After-Sales',
      fields: [
        { key: 'warranty',      label: 'Warranty',           type: 'select', options: ['No Warranty', '6 Months', '1 Year', '2 Years', '5 Years'] },
        { key: 'warranty_by',   label: 'Warranty Provided By', type: 'select', options: ['Manufacturer', 'Our Shop'] },
        { key: 'delivery_days', label: 'Delivery In (Days)',    type: 'number', placeholder: 'Expected days for delivery' },
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
    allowedUnits: ['Piece', 'Set', 'Unit'],
    expiryAlertDays: 30,
    stockLabel:   'Pieces',
    batchLabel:   'Batch / Lot',
    expiryLabel:  'Expiry',
    variantLabel: 'Colour / Finish',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🛋️', color: 'teal',
      title: 'Furniture Mode Active',
      body: 'Custom orders, delivery tracking & showroom inventory.',
      cta: 'Furniture Catalog', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'orders',    icon: '📋', label: 'Custom Orders',   sublabel: 'Pending order queue',    href: '/sales',     color: 'teal',  permission: 'VIEW_SALES'       },
      { id: 'catalog',   icon: '🪑', label: 'Showroom Stock',  sublabel: 'Furniture catalog',      href: '/product',   color: 'slate', permission: 'MANAGE_INVENTORY' },
      { id: 'purchases', icon: '🛒', label: 'Material Orders', sublabel: 'Raw material purchases', href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Add customer address and delivery date to custom orders for better tracking.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Sales Staff',    emoji: '🪑', description: 'Billing, inventory & customer management' },
      { role: 'manager', businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, orders & reports' },
      { role: 'viewer',  businessLabel: 'Delivery Staff', emoji: '🚚', description: 'View orders & delivery details only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Furniture Reports',
    pageSubtitle:    'Order tracking, material usage & showroom performance',
    accentColor:     '#0f766e',
    topItemsLabel:   'Top Furniture Items',
    topItemsIcon:    '🛋️',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'orders',
    analyticsTitle:  'Furniture Analytics',
    chartColor:      '#0f766e',
    insights: [
      { icon: '🛋️', text: 'Add customer delivery address and expected delivery date to every custom order.' },
      { icon: '📋', text: 'Custom order lead time is critical to customer satisfaction — track production status.' },
      { icon: '🏠', text: 'Renovation season (Oct-Feb) drives peak furniture demand. Plan stock accordingly.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Sales Invoice',
    accentColor:      '#78350f',
    itemSectionTitle: 'Furniture Items',
    footerNote:       'Delivery as per agreed schedule. Assembly charges if applicable are separate. Warranty as per manufacturer terms.',
  },
};
