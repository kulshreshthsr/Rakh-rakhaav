export default {
  // Entity labels
  product:        'Material',
  products:       'Materials',
  productHindi:   'सामान',
  item:           'Material',
  items:          'Materials',
  inventory:      'Material Stock',

  // People
  customer:       'Customer / Contractor',
  supplier:       'Supplier / Distributor',

  // Actions
  addProduct:     'Add Material',
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchProduct:  'Search items by name, size, spec...',
  searchSale:     'Search invoice, customer, item...',

  // Empty states
  noProducts:   'No items added yet.',
  noSales:      'No invoices yet.',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickAddStock:      'Add Item',
  quickAddStockHindi: 'Item जोड़ो',

  // Directory pages
  backToSales:  'Back to Invoices',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Total Items',
  kpiRecentSales:   'Recent Invoices',

  productFormSchema: {
    nameLabel:        'Item Name',
    descriptionLabel: 'Description / Specifications',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Kg', 'Metre', 'Litre', 'Bundle', 'Box', 'Pack', 'Set', 'Bag', 'Sheet', 'Roll'],
    attributesTitle:  'Item Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
    { key: 'category', label: 'Category', type: 'select', options: ['Pipes & Fittings', 'Electrical', 'Paint', 'Tools', 'Cement & Bricks', 'Steel & Iron', 'Wood', 'Sanitary', 'Wires & Cables', 'Other'] },
    { key: 'size_spec',label: 'Size / Spec', type: 'text', placeholder: 'e.g. 1 inch, 4mm, 10ft' },
  ],
  invoiceExtraFields: [
    { key: 'delivery_site',   label: 'Delivery Site / Address',     type: 'text', placeholder: 'Site name or delivery address' },
    { key: 'challan_no',      label: 'Challan No.',                 type: 'text', placeholder: 'Auto or manual challan number' },
    { key: 'challan_date',    label: 'Challan Date',                type: 'date' },
    { key: 'contractor_name', label: 'Contractor / Site In-charge', type: 'text' },
    { key: 'po_number',       label: 'Purchase Order No.',          type: 'text', placeholder: 'Client PO number if applicable' },
    { key: 'vehicle_no',      label: 'Delivery Vehicle No.',        type: 'text', placeholder: 'e.g. UP80 AB 1234' },
  ],
  invoiceLineFields:  [],

  categoryConfig: {
    categories: ['Tools & Power Tools', 'Plumbing & Sanitary', 'Electrical', 'Building Materials', 'Paints & Finishes', 'Fasteners & Fittings', 'Other'],
    subCategories: {
      'Tools & Power Tools':  ['Power Drills', 'Hand Tools', 'Measuring Tools', 'Safety Equipment', 'Cutting Tools'],
      'Plumbing & Sanitary':  ['Pipes & Fittings', 'Taps & Valves', 'Sanitary Ware', 'Water Heaters', 'Pumps'],
      'Electrical':           ['Wiring & Cables', 'Switches & Sockets', 'MCBs & Distribution', 'Lighting', 'Conduits'],
      'Building Materials':   ['Cement & Aggregates', 'Bricks & Blocks', 'Tiles & Stone', 'Steel & Iron', 'TMT Bars'],
      'Paints & Finishes':    ['Interior Paints', 'Exterior Paints', 'Primers', 'Varnishes & Polish', 'Waterproofing'],
      'Fasteners & Fittings': ['Nuts & Bolts', 'Screws', 'Nails', 'Anchors & Plugs', 'Hinges & Locks'],
      'Other': [],
    },
  },

  productAttributeSections: [
    {
      title: 'Item Details',
      fields: [
        { key: 'brand',    label: 'Brand',             type: 'text',   placeholder: 'Brand name' },
        { key: 'material', label: 'Material',          type: 'text',   placeholder: 'e.g. PVC, MS, SS304, GI' },
        { key: 'size_spec',label: 'Size / Specification', type: 'text',placeholder: 'e.g. 1 inch, 4mm, 10ft' },
      ],
    },
    {
      title: 'Trade Pricing',
      fields: [
        { key: 'contractor_discount', label: 'Contractor Discount (%)', type: 'number', placeholder: '0', min: 0, max: 50, step: '0.5', hint: 'Discount offered to regular contractors' },
        { key: 'is_loose_sold',       label: 'Sold by Loose Quantity',  type: 'checkbox', defaultValue: false, hint: 'Enable if sold per metre / per kg / per piece individually' },
        { key: 'bulk_threshold',      label: 'Bulk Order Threshold',    type: 'number', placeholder: '100', min: 0, hint: 'Units above which bulk discount applies', visibleWhen: { key: 'is_loose_sold', value: false } },
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
    supportLooseQty: true,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Kg', 'Gram', 'Litre', 'ML', 'Feet', 'Metre', 'Bag', 'Bundle', 'Roll', 'Box', 'Dozen'],
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
      icon: '🔨', color: 'amber',
      title: 'Hardware Store Mode Active',
      body: 'Bulk orders, contractor accounts & material inventory tracking.',
      cta: 'Material Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'bulk_orders',  icon: '📦', label: 'Bulk Orders',      sublabel: 'Contractor purchases',    href: '/sales',        color: 'amber',  permission: 'VIEW_SALES'       },
      { id: 'stock',        icon: '🧱', label: 'Material Stock',   sublabel: 'Building materials',      href: '/product',      color: 'slate',  permission: 'MANAGE_INVENTORY' },
      { id: 'purchases',    icon: '🛒', label: 'Restock Material', sublabel: 'Purchase from suppliers', href: '/purchases',    color: 'orange', permission: 'CREATE_PURCHASE'  },
      { id: 'contractors',  icon: '👷', label: 'Contractors',      sublabel: 'Credit & accounts',       href: '/contractors',  color: 'amber',  permission: 'VIEW_SALES'       },
    ],
    tip: 'Track contractor accounts with udhaar. Bulk discount applies automatically.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Counter Staff', emoji: '🔩', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Store Manager', emoji: '👔', description: 'Full access — sales, purchases & reports' },
      { role: 'viewer',  businessLabel: 'Delivery / Helper', emoji: '🚚', description: 'View inventory & orders — no billing' },
    ],
  },

  reportConfig: {
    pageTitle:       'Hardware Store Reports',
    pageSubtitle:    'Material sales, contractor accounts & bulk order trends',
    accentColor:     '#b45309',
    topItemsLabel:   'Top Materials',
    topItemsIcon:    '🔨',
    topBuyersLabel:  'Top Contractors',
    invoiceUnit:     'bills',
    analyticsTitle:  'Hardware Analytics',
    chartColor:      '#b45309',
    insights: [
      { icon: '🔨', text: 'Contractor udhaar accounts often run high. Reconcile outstanding dues monthly.' },
      { icon: '📦', text: 'Bulk order clients drive the most revenue — identify and retain top contractor accounts.' },
      { icon: '🏗️', text: 'Construction season (March-October) drives peak demand. Stock up before monsoon.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Tax Invoice',
    itemSectionTitle: 'Materials & Items',
    accentColor:      '#78716c',
    showHsnColumn:    true,
    showGstColumns:   true,
    footerNote:       'Goods once sold will not be taken back without prior approval. Subject to local jurisdiction.',
  },

  challanConfig: {
    enabled: true,
    defaultChallanType: 'supply_of_goods',
    requireVehicleNumber: true,
    requirePONumber: false,
    showEwayBillWarning: true,
    defaultTerms: 'Goods are dispatched in good condition. Please verify quantity and report discrepancies within 24 hours. Tax invoice will follow upon confirmation of delivery.',
    uomOptions: ['NOS', 'KGS', 'MTR', 'LTR', 'PCS', 'BOX', 'BAG', 'BUNDLE', 'SET', 'PAIR', 'SQM', 'CFT', 'RMT'],
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',      sublabel: "Today's Revenue"      },
    kpi2: { label: 'Bills',             sublabel: 'Invoices today'        },
    kpi3: { label: 'मुनाफा',           sublabel: 'Gross profit'          },
    kpi4: { label: 'Contractor Dues',   sublabel: 'Outstanding credit'    },
    kpi5: { label: 'GST Payable',       sublabel: 'This month'            },
    kpi6: { label: 'Stock Alerts',      sublabel: 'Low / Out of stock'    },
  },
};
