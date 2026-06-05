export default {
  // Entity labels
  product:        'Apparel',
  products:       'Apparel',
  productHindi:   'कपड़े',
  item:           'Apparel',
  items:          'Apparel',
  inventory:      'Apparel Stock',
  customer:       'Customer',
  supplier:       'Supplier / Brand',

  // Transactions
  invoice:        'Invoice',
  invoices:       'Invoices',

  // Actions
  addProduct:     'Add Apparel',
  newSale:        'New Sale',
  newPurchase:    'New Purchase',
  editSale:       'Edit Sale',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search items by name, size, color, brand...',
  searchSale:     'Search bill, customer, item...',
  searchPurchase: 'Search purchase, supplier...',

  // Empty states
  noProducts:   'No items added yet.',
  noSales:      'No bills yet.',
  noPurchases:  'No purchases yet.',

  // Directory pages
  backToSales:     'Back to Bills',
  backToPurchases: 'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Apparel',
  quickAddStockHindi: 'Apparel जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Items',
  kpiRecentSales:   'Recent Bills',

  entityType: 'apparel',

  formSectionLabels: {
    basics:  'Item Information',
    pricing: 'Pricing',
    stock:   'Stock & Inventory',
    tax:     'GST & Tax',
  },

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Item Name',
    descriptionLabel: 'Description / Design',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Pair', 'Set', 'Pack', 'Dozen', 'Metre'],
    attributesTitle:  'Item Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'category', label: 'Category',  type: 'select', options: ['Shirt', 'T-Shirt', 'Jeans', 'Trouser', 'Saree', 'Salwar', 'Lehenga', 'Kurta', 'Jacket', 'Kids', 'Other'] },
    { key: 'brand',    label: 'Brand',     type: 'text',   placeholder: 'Brand name' },
    { key: 'size',     label: 'Size',      type: 'text',   placeholder: 'e.g. S, M, L, XL, 32' },
    { key: 'color',    label: 'Color',     type: 'text',   placeholder: 'e.g. Red, Navy Blue' },
    { key: 'material', label: 'Material',  type: 'select', options: ['Cotton', 'Polyester', 'Silk', 'Linen', 'Wool', 'Denim', 'Rayon', 'Blend', 'Other'] },
  ],

  // ─── Grouped product attribute sections ────────────────────────────────────
  productAttributeSections: [
    {
      title: 'Item Details',
      fields: [
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
        { key: 'category', label: 'Category', type: 'select', options: ['Shirt', 'T-Shirt', 'Jeans', 'Trouser', 'Saree', 'Salwar', 'Lehenga', 'Kurta', 'Jacket', 'Inner Wear', 'Kids', 'Other'] },
        { key: 'material', label: 'Material', type: 'select', options: ['Cotton', 'Polyester', 'Silk', 'Linen', 'Wool', 'Denim', 'Rayon', 'Blend', 'Khadi', 'Other'] },
        { key: 'gender',   label: 'For',      type: 'select', options: ['Men', 'Women', 'Boys', 'Girls', 'Unisex'] },
      ],
    },
    {
      title: 'Variant Details',
      fields: [
        { key: 'sizes',  label: 'Available Sizes',  type: 'multiselect', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42'], hint: 'Select all sizes this item comes in' },
        { key: 'colors', label: 'Available Colors', type: 'tags', placeholder: 'Red, Navy Blue, Black...', hint: 'Enter colors separated by commas' },
      ],
    },
    {
      title: 'Seasonal & Collection',
      fields: [
        { key: 'season',     label: 'Season',          type: 'select', options: ['Summer', 'Winter', 'Monsoon', 'All Season'] },
        { key: 'collection', label: 'Collection / Year', type: 'text', placeholder: 'e.g. 2024 Festive' },
        { key: 'sku',        label: 'SKU / Style Code',  type: 'text', placeholder: 'Internal code' },
      ],
    },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [
    { key: 'size',  label: 'Size',  type: 'text', placeholder: 'S/M/L/XL' },
    { key: 'color', label: 'Color', type: 'text', placeholder: 'Color' },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'variant',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   true,
    variantDimensions: ['size', 'color'],
    sizeOptions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42'],
    colorOptions: [],
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Pair', 'Set', 'Dozen'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Size / Color',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'variant',
  },

  dashboardConfig: {
    callout: {
      icon: '👗', color: 'rose',
      title: 'Apparel Mode Active',
      body: 'Size & variant tracking, seasonal inventory & exchange management.',
      cta: 'Clothing Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'variants',  icon: '📏', label: 'Size & Variants', sublabel: 'Stock by size/color',    href: '/product',   color: 'rose',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Apparel Sales',   sublabel: "Today's clothing sales", href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Apparel', sublabel: 'Purchase from suppliers', href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Track size-wise variants to avoid stockouts in popular sizes.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales Staff',    emoji: '👗', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Apparel Reports',
    pageSubtitle:    'Size-wise sales, variant trends & seasonal performance',
    accentColor:     '#7c3aed',
    topItemsLabel:   'Top Apparel',
    topItemsIcon:    '👗',
    topBuyersLabel:  'Top Shoppers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Apparel Analytics',
    chartColor:      '#7c3aed',
    insights: [
      { icon: '👗', text: 'Track size-wise variants separately. Low stock in popular sizes directly affects conversions.' },
      { icon: '🎨', text: 'Colour and style trends change seasonally. Review slow-moving stock every quarter.' },
      { icon: '🔄', text: 'Exchange requests are common in clothing. Track exchange ratio per category.' },
    ],
  },

  invoiceConfig: {
    documentTitle:      'Tax Invoice',
    accentColor:        '#7c3aed',
    showVariantColumns: true,
    itemSectionTitle:   'Apparel Items',
    showHsnColumn:      true,
    showGstColumns:     true,
    footerNote:         'Exchange within 7 days with original bill and tags intact. No exchange on innerwear or sale items.',
  },

  workflowConfig: {
    exchangeEnabled:    true,
    exchangeWindowDays: 7,
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',  sublabel: "Today's Revenue"   },
    kpi2: { label: 'Pieces Sold',  sublabel: 'Units today'        },
    kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'       },
    kpi4: { label: 'Udhaar',       sublabel: 'Pending credit'     },
    kpi5: { label: 'GST Payable',  sublabel: 'This month'         },
    kpi6: { label: 'Size Alerts',  sublabel: 'Sizes out of stock' },
  },

  dashboardPanels: [
    {
      id: 'variant_low_stock',
      dataKey: 'variantLowStock',
      condition: (val) => Array.isArray(val) && val.length > 0,
      href: '/product?filter=low_stock',
      icon: '📏',
      color: 'amber',
      renderMode: 'chips',
      sectionLabel: 'Size Stock Alerts',
      getChips: (val) => val.map((v) => ({
        key: String(v._id || 'unknown'),
        href: `/product?size=${encodeURIComponent(v._id || '')}&filter=low_stock`,
        label: `Size ${v._id || '?'} — ${v.productCount} item${v.productCount !== 1 ? 's' : ''}`,
      })),
    },
  ],

  // ─── Clothing-specific expense categories ────────────────────────────────
  expenseCategories: [
    { id: 'stock_purchase', labelHi: 'Stock खरीद',   labelEn: 'Stock Purchase', emoji: '👗' },
    { id: 'display',        labelHi: 'Display Setup', labelEn: 'Display Setup',  emoji: '🪟' },
    { id: 'rent',           labelHi: 'किराया',         labelEn: 'Rent',           emoji: '🏠' },
    { id: 'salary',         labelHi: 'वेतन',           labelEn: 'Salary',         emoji: '👷' },
    { id: 'utility',        labelHi: 'बिजली-पानी',     labelEn: 'Utility',        emoji: '💡' },
    { id: 'maintenance',    labelHi: 'मरम्मत',          labelEn: 'Maintenance',    emoji: '🔧' },
    { id: 'transport',      labelHi: 'परिवहन',          labelEn: 'Transport',      emoji: '🚛' },
    { id: 'misc',           labelHi: 'अन्य',            labelEn: 'Misc',           emoji: '📦' },
  ],
};
