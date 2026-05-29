export default {
  // Entity labels
  product:        'Jewellery Item',
  products:       'Jewellery Items',
  productHindi:   'ज्वेलरी',
  item:           'Piece',
  items:          'Pieces',
  inventory:      'Stock',

  // People
  supplier:       'Supplier / Manufacturer',
  suppliers:      'Suppliers',

  // Actions
  addProduct:     'Add Jewellery',
  newSale:        'New Invoice',
  newPurchase:    'New Purchase',
  editSale:       'Edit Invoice',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search jewellery by name, metal, purity...',
  searchSale:     'Search invoice, customer, jewellery...',
  searchPurchase: 'Search purchase, supplier...',

  // Empty states
  noProducts:   'No jewellery items added yet.',
  noSales:      'No invoices yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  supplierSection: 'Supplier / Manufacturer Info',
  itemsSection:    'Jewellery Items',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Jewellery',
  quickAddStockHindi: 'Jewellery जोड़ो',

  // Directory pages
  backToSales:     'Back to Invoices',
  backToPurchases: 'Back to Purchases',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Jewellery Items',
  kpiRecentSales:   'Recent Invoices',

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Item Name / Design',
    descriptionLabel: 'Design Description',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Piece', 'Gram', 'Set', 'Pair', 'Bangle Set'],
    attributesTitle:  'Jewellery Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: false,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'metal',       label: 'Metal',       type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Diamond', 'Artificial / Imitation', 'Other'] },
    { key: 'purity',      label: 'Purity / Karat', type: 'select', options: ['24K / 999', '22K / 916', '18K / 750', '14K / 585', '92.5 Silver', 'Other'] },
    { key: 'weight_g',    label: 'Gross Weight (g)', type: 'number', placeholder: '0.00', min: 0 },
    { key: 'net_weight_g',label: 'Net Weight (g)',   type: 'number', placeholder: '0.00', min: 0 },
    { key: 'making_charges', label: 'Making Charges (%)', type: 'number', placeholder: 'e.g. 12', min: 0 },
    { key: 'hallmark_no', label: 'Hallmark No.',  type: 'text',   placeholder: 'BIS hallmark number' },
    { key: 'category',    label: 'Category',     type: 'select', options: ['Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 'Anklet', 'Pendant', 'Chain', 'Mangalsutra', 'Other'] },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [
    { key: 'net_weight_g', label: 'Net Wt (g)',  type: 'number', placeholder: '0.00' },
    { key: 'purity',       label: 'Purity',      type: 'text',   placeholder: '22K / 916' },
    { key: 'making_charges', label: 'Making %', type: 'number', placeholder: '0' },
  ],

  productAttributeSections: [
    {
      title: 'Jewellery Details',
      fields: [
        { key: 'category',    label: 'Category', type: 'select', options: ['Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 'Anklet', 'Pendant', 'Chain', 'Mangalsutra', 'Nose Ring', 'Maang Tikka', 'Other'] },
        { key: 'metal',       label: 'Metal',    type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Diamond', 'Artificial / Imitation', 'Other'] },
        { key: 'purity',      label: 'Purity / Karat', type: 'select', options: ['24K / 999', '22K / 916', '18K / 750', '14K / 585', '92.5 Silver', 'Other'] },
        { key: 'style',       label: 'Style',    type: 'select', options: ['Traditional', 'Contemporary', 'Bridal', 'Daily Wear', 'Antique', 'Temple', 'Other'] },
      ],
    },
    {
      title: 'Weight & Pricing',
      fields: [
        { key: 'weight_g',       label: 'Gross Weight (g)',    type: 'number', placeholder: '0.00' },
        { key: 'net_weight_g',   label: 'Net Weight (g)',      type: 'number', placeholder: '0.00', hint: 'Weight of metal only, excluding stones' },
        { key: 'making_charges', label: 'Making Charges (%)',  type: 'number', placeholder: 'e.g. 12' },
        { key: 'stone_weight',   label: 'Stone Weight (ct)',   type: 'number', placeholder: 'Carat weight of stones' },
      ],
    },
    {
      title: 'Certification & Hallmark',
      fields: [
        { key: 'hallmark_no',    label: 'BIS Hallmark No.',    type: 'text', placeholder: 'BIS hallmark number', hint: 'Required for gold jewellery sold in India' },
        { key: 'is_hallmarked',  label: 'BIS Hallmarked',      type: 'checkbox', defaultValue: false },
        { key: 'is_certified',   label: 'Comes with Certificate', type: 'checkbox', defaultValue: false },
        { key: 'cert_details',   label: 'Certificate Details', type: 'text', placeholder: 'IGI / GIA / Lab cert number', visibleWhen: { key: 'is_certified', value: true } },
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
    allowedUnits: ['Piece', 'Gram', 'Set', 'Pair'],
    expiryAlertDays: 30,
    stockLabel:   'Pieces',
    batchLabel:   'Batch / Lot',
    expiryLabel:  'Expiry',
    variantLabel: 'Design / Purity',
    serialLabel:  'Tag No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '💍', color: 'amber',
      title: 'Jewellery Mode Active',
      body: 'Gold/Silver item tracking, hallmark records & weight-based billing.',
      cta: 'Jewellery Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'stock',     icon: '💎', label: 'Jewellery Stock',  sublabel: 'Gold, silver & gems',  href: '/product',   color: 'amber',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Jewellery Sales',  sublabel: "Today's sales",        href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Stock Purchase',   sublabel: 'New lot purchase',     href: '/purchases', color: 'orange', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Record hallmark ID and weight for every item. Keep certification records updated.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Showroom Staff',    emoji: '💍', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Showroom Manager',  emoji: '👔', description: 'Full access — sales, valuations & reports' },
      { role: 'accountant', businessLabel: 'Accounts / Auditor',emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Jewellery Reports',
    pageSubtitle:    'Jewellery sales, metal movement & customer analytics',
    accentColor:     '#92400e',
    topItemsLabel:   'Top Jewellery',
    topItemsIcon:    '💍',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'invoices',
    analyticsTitle:  'Jewellery Analytics',
    chartColor:      '#d97706',
    insights: [
      { icon: '💍', text: 'Record hallmark ID, weight (grams) and karat purity for every jewellery item sold.' },
      { icon: '📈', text: 'Gold price fluctuations affect margins daily — monitor and adjust pricing regularly.' },
      { icon: '🔐', text: 'High-value stock needs physical security. Match inventory count with system records weekly.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Jewellery Bill',
    accentColor:      '#b45309',
    itemSectionTitle: 'Jewellery Items',
    footerNote:       'BIS Hallmarked jewellery. Buyback available as per prevailing rates. Keep this invoice for all future transactions.',
  },
};
