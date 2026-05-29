export default {
  // Entity labels
  product:        'Mobile / Accessory',
  products:       'Mobiles & Accessories',
  productHindi:   'मोबाइल',
  item:           'Mobile / Accessory',
  items:          'Items',
  inventory:      'Stock',

  // People
  supplier:       'Distributor',
  suppliers:      'Distributors',
  supplierHindi:  'डिस्ट्रीब्यूटर',

  // Actions
  addProduct:     'Add Mobile / Item',
  newSale:        'New Invoice',
  newPurchase:    'New Purchase',
  editSale:       'Edit Invoice',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search mobiles by name, model, IMEI, brand...',
  searchSupplier: 'Search distributor name or phone...',
  searchSale:     'Search invoice, customer, mobile...',
  searchPurchase: 'Search purchase, distributor...',

  // Empty states
  noProducts:   'No mobiles or accessories added yet.',
  noSales:      'No invoices yet.',
  noSuppliers:  'No distributors found.',
  noPurchases:  'No purchases yet.',

  // Section headers
  supplierSection: 'Distributor Info',
  itemsSection:    'Items',

  // Directory pages
  supplierDirectory:      'Distributor Directory',
  supplierDirectoryHindi: 'डिस्ट्रीब्यूटर लिस्ट',
  refreshingSuppliers:    'Refreshing distributors...',
  allSuppliers:           'All Distributors',
  selectSupplier:         'Select a distributor to see details.',
  backToSales:            'Back to Invoices',
  backToPurchases:        'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Mobile',
  quickAddStockHindi: 'Mobile जोड़ो',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Mobiles & Accessories',
  kpiRecentSales:   'Recent Invoices',

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Model Name',
    descriptionLabel: 'Specifications',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Unit', 'Set', 'Pack'],
    attributesTitle:  'Device Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'brand',    label: 'Brand',       type: 'text',   placeholder: 'e.g. Samsung, Apple, Redmi' },
    { key: 'model_no', label: 'Model No.',   type: 'text',   placeholder: 'e.g. SM-G990B' },
    { key: 'color',    label: 'Color',       type: 'text',   placeholder: 'e.g. Midnight Black' },
    { key: 'storage',  label: 'Storage',     type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', 'N/A'] },
    { key: 'category', label: 'Category',    type: 'select', options: ['Smartphone', 'Feature Phone', 'Tablet', 'Charger', 'Earphones', 'Case/Cover', 'Screen Guard', 'Power Bank', 'Cable', 'Other Accessory'] },
    { key: 'imei_no',  label: 'IMEI Number', type: 'text',   placeholder: '15-digit IMEI' },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [
    { key: 'imei_no', label: 'IMEI', type: 'text', placeholder: 'IMEI number' },
    { key: 'color',   label: 'Color', type: 'text', placeholder: 'Color' },
  ],

  productAttributeSections: [
    {
      title: 'Device Details',
      fields: [
        { key: 'category',  label: 'Category',  type: 'select', options: ['Smartphone', 'Feature Phone', 'Tablet', 'Charger', 'Earphones / TWS', 'Case / Cover', 'Screen Guard', 'Power Bank', 'Cable', 'Smart Watch', 'Other Accessory'] },
        { key: 'brand',     label: 'Brand',     type: 'text',   placeholder: 'e.g. Samsung, Apple, Redmi' },
        { key: 'model_no',  label: 'Model No.', type: 'text',   placeholder: 'e.g. SM-G990B, iPhone 15 Pro' },
        { key: 'color',     label: 'Color',     type: 'text',   placeholder: 'e.g. Midnight Black, Starlight' },
      ],
    },
    {
      title: 'Specifications',
      fields: [
        { key: 'storage',    label: 'Storage',    type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', 'N/A'] },
        { key: 'ram',        label: 'RAM',        type: 'select', options: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB', 'N/A'] },
        { key: 'os',         label: 'OS',         type: 'select', options: ['Android', 'iOS', 'Windows', 'Other', 'N/A'] },
        { key: 'imei_no',    label: 'IMEI Number',type: 'text',   placeholder: '15-digit IMEI', hint: 'Also captured per line-item in invoice' },
      ],
    },
    {
      title: 'Warranty & Condition',
      fields: [
        { key: 'warranty',       label: 'Warranty',       type: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years'] },
        { key: 'warranty_by',    label: 'Warranty By',    type: 'select', options: ['Brand Service Centre', 'Our Shop', 'Manufacturer'] },
        { key: 'is_refurbished', label: 'Refurbished',    type: 'checkbox', defaultValue: false },
        { key: 'refurb_grade',   label: 'Refurb Grade',   type: 'select', options: ['Grade A', 'Grade B', 'Grade C'], visibleWhen: { key: 'is_refurbished', value: true }, hint: 'A=Like New, B=Good, C=Fair' },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'serial',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   false,
    trackSerials:    true,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Unit'],
    expiryAlertDays: 365,
    stockLabel:   'Handsets',
    batchLabel:   'Batch',
    expiryLabel:  'Warranty Expiry',
    variantLabel: 'Color / Storage',
    serialLabel:  'IMEI / Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'serial',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Sale',
    saleNounPlural: 'Sales',
    stages: [
      { id: 'pending',   label: 'Pending',   color: 'amber', icon: '⏳', terminal: false },
      { id: 'verified',  label: 'Verified',  color: 'blue',  icon: '✅', terminal: false },
      { id: 'completed', label: 'Completed', color: 'slate', icon: '💰', terminal: true  },
    ],
    initialStage: 'pending',
    transitions: {
      pending:   ['verified', 'completed'],
      verified:  ['completed'],
      completed: [],
    },
    actions: {
      pending:   [{ id: 'verify_imei', label: 'Verify IMEI',  icon: '✅', nextStage: 'verified',  color: 'blue'  }],
      verified:  [{ id: 'complete',    label: 'Complete Sale', icon: '💰', nextStage: 'completed', color: 'slate', triggerInvoice: true }],
      completed: [],
    },
    dashboardWidgets: [
      { id: 'pending_sales', label: 'Pending IMEI', stages: ['pending'],  icon: '⏳', color: 'amber' },
      { id: 'verified',      label: 'Verified',     stages: ['verified'], icon: '✅', color: 'blue'  },
    ],
    quickActions: [
      { id: 'new_sale',      label: 'New Sale',      labelHindi: 'नई Sale', icon: '📱', href: '/sales?open=1',    permission: 'CREATE_INVOICE' },
      { id: 'pending_sales', label: 'Pending Sales', labelHindi: 'Pending', icon: '⏳', href: '/sales?wf=pending', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '📱', color: 'indigo',
      title: 'Mobile Shop Mode Active',
      body: 'IMEI tracking, serial verification & warranty management.',
      cta: 'Mobile Inventory', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'imei_stock', icon: '📱', label: 'Device Stock',    sublabel: 'IMEI-wise inventory', href: '/product',   color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',      icon: '🧾', label: 'Mobile Sales',    sublabel: 'All device sales',    href: '/sales',     color: 'blue',   permission: 'VIEW_SALES'       },
      { id: 'purchases',  icon: '🛒', label: 'Stock Purchases', sublabel: 'Distributor orders',  href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Record IMEI number at point of sale for warranty claim reference.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales Staff',   emoji: '📱', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager', emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',      emoji: '📊', description: 'Financial records & GST reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Mobile Shop Reports',
    pageSubtitle:    'Device sales, IMEI inventory & accessory trends',
    accentColor:     '#4f46e5',
    topItemsLabel:   'Top Devices',
    topItemsIcon:    '📱',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'invoices',
    analyticsTitle:  'Mobile Sales Analytics',
    chartColor:      '#4f46e5',
    insights: [
      { icon: '📱', text: 'Record IMEI number at the time of every device sale for warranty and theft tracking.' },
      { icon: '🔒', text: 'Serial number tracking is mandatory for electronics warranty compliance.' },
      { icon: '📦', text: 'Accessory attach rate (covers, chargers) significantly boosts average bill value.' },
    ],
  },

  invoiceConfig: {
    accentColor:      '#1d4ed8',
    showSerialColumn: true,
    itemSectionTitle: 'Products',
    footerNote:       'IMEI warranty as per manufacturer policy. Keep this invoice safe for all warranty claims.',
  },
};
