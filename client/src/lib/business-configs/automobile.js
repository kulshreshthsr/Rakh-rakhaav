export default {
  // Entity labels
  product:        'Part',
  products:       'Parts',
  productHindi:   'पार्ट्स',
  item:           'Part',
  items:          'Parts',
  inventory:      'Parts Stock',

  // Transactions
  sale:           'Job Card',
  sales:          'Job Cards',
  invoice:        'Job Card / Invoice',
  invoices:       'Job Cards',

  // People
  customer:       'Vehicle Owner',
  customers:      'Vehicle Owners',
  customerHindi:  'वाहन मालिक',

  // Actions
  addProduct:     'Add Part',
  newSale:        'New Job Card',
  newPurchase:    'New Purchase',
  editSale:       'Edit Job Card',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search parts by name or part number...',
  searchCustomer: 'Search vehicle owner or phone...',
  searchSale:     'Search job card, vehicle owner, part...',

  // Form placeholders
  customerNamePlaceholder: 'Vehicle Owner का नाम',

  // Empty states
  noProducts:   'No parts added yet.',
  noCustomers:  'No vehicle owners found.',
  noSales:      'No job cards yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Vehicle Owner Info',
  itemsSection:    'Parts & Labour',

  // Directory pages
  customerDirectory:      'Vehicle Owner Directory',
  customerDirectoryHindi: 'वाहन मालिक लिस्ट',
  refreshingCustomers:    'Refreshing vehicle owners…',
  backToSales:            'Back to Job Cards',
  backToPurchases:        'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Job Card',
  quickNewSaleHindi:  'Job Card बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Part',
  quickAddStockHindi: 'Part जोड़ो',

  // KPIs
  kpiInvoices:       'Job Cards',
  kpiTotalProducts:  'Total Parts',
  kpiTotalCustomers: 'Vehicle Owners',
  kpiRecentSales:    'Recent Job Cards',

  entityType: 'part',

  formSectionLabels: {
    basics:  'Part Information',
    pricing: 'Pricing',
    stock:   'Parts Inventory',
    tax:     'GST & Tax',
  },

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Part Name',
    descriptionLabel: 'Part Description / Compatibility',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Set', 'Pair', 'Litre', 'Kg', 'Metre'],
    attributesTitle:  'Part Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'part_number',  label: 'Part Number',    type: 'text',   placeholder: 'OEM or aftermarket part no.' },
    { key: 'brand',        label: 'Brand',          type: 'text',   placeholder: 'e.g. Bosch, Denso' },
    { key: 'compatible',   label: 'Compatibility',  type: 'text',   placeholder: 'Vehicle model / year' },
    { key: 'part_type',    label: 'Type',           type: 'select', options: ['OEM', 'Aftermarket', 'Reconditioned', 'Consumable'] },
  ],

  // ─── Grouped product attribute sections ────────────────────────────────────
  productAttributeSections: [
    {
      title: 'Part Information',
      fields: [
        { key: 'part_number', label: 'Part Number',         type: 'text',   required: true, placeholder: 'OEM or aftermarket part no.' },
        { key: 'brand',       label: 'Brand / Manufacturer',type: 'text',   placeholder: 'e.g. Bosch, Denso, Minda' },
        { key: 'part_type',   label: 'Part Type',           type: 'select', options: ['OEM', 'Aftermarket', 'Reconditioned', 'Consumable', 'Accessory'] },
      ],
    },
    {
      title: 'Vehicle Compatibility',
      fields: [
        { key: 'vehicle_type',    label: 'Vehicle Type',       type: 'select', options: ['Car', '2-Wheeler', 'Commercial Vehicle', 'Tractor', 'Bus', 'Universal', 'Other'] },
        { key: 'compatible_make', label: 'Compatible Make',    type: 'tags',   placeholder: 'Maruti, Honda, Tata...', hint: 'Enter comma-separated vehicle makes' },
        { key: 'compatible_model',label: 'Compatible Model',   type: 'text',   placeholder: 'e.g. Swift, City, Nexon' },
        { key: 'compatible_year', label: 'Compatible Year',    type: 'text',   placeholder: 'e.g. 2015–2023' },
        { key: 'engine_type',     label: 'Engine Type',        type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'All', 'N/A'] },
      ],
    },
    {
      title: 'Warranty',
      fields: [
        { key: 'has_warranty',  label: 'Warranty Available',  type: 'checkbox', defaultValue: false },
        { key: 'warranty',      label: 'Warranty Period',     type: 'select', options: ['1 Month', '3 Months', '6 Months', '1 Year', '2 Years'], visibleWhen: { key: 'has_warranty', value: true } },
        { key: 'warranty_by',   label: 'Warranty Provided By',type: 'select', options: ['Manufacturer', 'Distributor', 'Our Shop'], visibleWhen: { key: 'has_warranty', value: true }, hint: 'Who covers the warranty claim' },
      ],
    },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [
    { key: 'vehicle_no',    label: 'Vehicle Number', type: 'text', placeholder: 'e.g. MH01AB1234' },
    { key: 'vehicle_model', label: 'Vehicle Model',  type: 'text', placeholder: 'e.g. Swift 2020' },
    { key: 'km_reading',    label: 'KM Reading',     type: 'number', placeholder: 'Odometer reading' },
    { key: 'mechanic_name', label: 'Mechanic',       type: 'text', placeholder: 'Assigned mechanic' },
  ],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [],

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
    allowedUnits: ['Piece', 'Unit', 'Set', 'Litre', 'Kg'],
    expiryAlertDays: 30,
    stockLabel:   'Parts Stock',
    batchLabel:   'Batch / Lot',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Part / OEM No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Job Card',
    saleNounPlural: 'Job Cards',
    stages: [
      { id: 'inspection', label: 'Inspection', color: 'amber',  icon: '🔍', terminal: false },
      { id: 'repairing',  label: 'Repairing',  color: 'orange', icon: '🔧', terminal: false },
      { id: 'ready',      label: 'Ready',      color: 'blue',   icon: '✅', terminal: false },
      { id: 'delivered',  label: 'Delivered',  color: 'green',  icon: '🚗', terminal: false },
      { id: 'paid',       label: 'Paid',       color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'inspection',
    transitions: {
      inspection: ['repairing', 'ready'],
      repairing:  ['ready'],
      ready:      ['delivered'],
      delivered:  ['paid'],
      paid:       [],
    },
    actions: {
      inspection: [{ id: 'start_repair',    label: 'Start Repair',    icon: '🔧', nextStage: 'repairing', color: 'orange' }],
      repairing:  [{ id: 'mark_ready',      label: 'Mark Ready',      icon: '✅', nextStage: 'ready',     color: 'blue'   }],
      ready:      [{ id: 'mark_delivered',  label: 'Mark Delivered',  icon: '🚗', nextStage: 'delivered', color: 'green'  }],
      delivered:  [{ id: 'collect_payment', label: 'Collect Payment', icon: '💰', nextStage: 'paid',      color: 'slate', triggerInvoice: true }],
      paid:       [],
    },
    dashboardWidgets: [
      { id: 'in_repair',    label: 'In Repair',        stages: ['repairing'],                       icon: '🔧', color: 'orange' },
      { id: 'ready_pickup', label: 'Ready for Pickup', stages: ['ready'],                           icon: '✅', color: 'blue'   },
      { id: 'active_jobs',  label: 'Active Jobs',      stages: ['inspection', 'repairing', 'ready'], icon: '🚗', color: 'amber'  },
    ],
    quickActions: [
      { id: 'new_job',   label: 'New Job Card', labelHindi: 'नया Job Card', icon: '🔧', href: '/sales?open=1', permission: 'CREATE_INVOICE' },
      { id: 'in_repair', label: 'In Repair',    labelHindi: 'Repair में',   icon: '🔧', href: '/sales?wf=repairing', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🔧', color: 'blue',
      title: 'Workshop Mode Active',
      body: 'Job card management, vehicle service tracking & mechanic workflow.',
      cta: 'New Job Card', href: '/sales?open=1', permission: 'CREATE_INVOICE',
    },
    tiles: [
      { id: 'job_cards',   icon: '📋', label: 'All Job Cards',   sublabel: 'Service history',      href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'spare_parts', icon: '⚙️',  label: 'Spare Parts',    sublabel: 'Parts inventory',      href: '/product',   color: 'slate', permission: 'MANAGE_INVENTORY' },
      { id: 'purchases',   icon: '🛒',  label: 'Parts Purchase',  sublabel: 'Supplier orders',      href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Record vehicle number, complaint & mechanic name in every job card for accountability.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Mechanic / Technician', emoji: '🔧', description: 'Manage job cards, parts & advance workflow stages' },
      { role: 'manager', businessLabel: 'Workshop Manager',      emoji: '👔', description: 'Full access — job cards, parts, staff & reports' },
      { role: 'viewer',  businessLabel: 'Service Advisor',       emoji: '🚗', description: 'View job cards & customer details only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Workshop Reports',
    pageSubtitle:    'Job cards, spare parts usage & mechanic productivity',
    accentColor:     '#1e40af',
    topItemsLabel:   'Top Spare Parts',
    topItemsIcon:    '🔧',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'job cards',
    analyticsTitle:  'Workshop Analytics',
    chartColor:      '#2563eb',
    insights: [
      { icon: '🔧', text: 'Record vehicle number, complaint & mechanic name on every job card for accountability.' },
      { icon: '📦', text: 'Track spare parts consumption to identify fast-moving stock for timely reorder.' },
      { icon: '⏱️', text: 'Average repair turnaround time directly impacts customer satisfaction — monitor daily.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Job Card / Invoice',
    accentColor:      '#1e40af',
    showVehicleBlock: true,
    itemSectionTitle: 'Parts & Labour',
    footerNote:       'Warranty on parts as per manufacturer. Labour warranty valid for 30 days from date of service.',
  },
};
