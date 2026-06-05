export default {
  // Entity labels
  product:        'Footwear',
  products:       'Footwear Items',
  productHindi:   'जूते',
  item:           'Pair',
  items:          'Pairs',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // Actions
  addProduct:     'Add Footwear',
  newSale:        'New Bill',
  newPurchase:    'New Purchase',
  editSale:       'Edit Bill',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search footwear by name, size, color, brand...',
  searchSale:     'Search bill, customer, footwear...',
  searchPurchase: 'Search purchase, supplier...',

  // Empty states
  noProducts:   'No footwear added yet.',
  noSales:      'No bills yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  itemsSection: 'Footwear',

  // Directory pages
  backToSales:     'Back to Bills',
  backToPurchases: 'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Footwear',
  quickAddStockHindi: 'Footwear जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Total Footwear',
  kpiRecentSales:   'Recent Bills',

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Footwear Name',
    descriptionLabel: 'Description / Style',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Pair', 'Piece', 'Pack'],
    attributesTitle:  'Footwear Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'e.g. Bata, Adidas, Relaxo' },
    { key: 'category', label: 'Category', type: 'select', options: ['Casual', 'Formal', 'Sports', 'Sandal', 'Slipper', 'Boots', 'Heels', 'Kids', 'Other'] },
    { key: 'size',     label: 'Size',     type: 'text',   placeholder: 'e.g. 7, 8, 9, 10' },
    { key: 'color',    label: 'Color',    type: 'text',   placeholder: 'e.g. Black, Brown, White' },
    { key: 'material', label: 'Material', type: 'select', options: ['Leather', 'Synthetic', 'Canvas', 'Rubber', 'Rexine', 'Fabric', 'Other'] },
    { key: 'gender',   label: 'For',      type: 'select', options: ['Men', 'Women', 'Kids', 'Unisex'] },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [
    { key: 'size',  label: 'Size',  type: 'text', placeholder: 'Size' },
    { key: 'color', label: 'Color', type: 'text', placeholder: 'Color' },
  ],

  productAttributeSections: [
    {
      title: 'Footwear Details',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: ['Casual', 'Formal', 'Sports / Running', 'Sandal', 'Slipper / Chappal', 'Boots', 'Heels', 'Loafers', 'Sneakers', 'Kids', 'Safety Shoes', 'Other'] },
        { key: 'gender',   label: 'For',      type: 'select', options: ['Men', 'Women', 'Kids', 'Unisex'] },
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'e.g. Bata, Adidas, Relaxo, Liberty' },
        { key: 'material', label: 'Material', type: 'select', options: ['Genuine Leather', 'Synthetic / PU', 'Canvas', 'Rubber', 'Rexine', 'Fabric', 'Mesh', 'Other'] },
      ],
    },
    {
      title: 'Available Variants',
      fields: [
        { key: 'sizes',  label: 'Available Sizes',  type: 'multiselect', options: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'], hint: 'Select all sizes this style comes in' },
        { key: 'colors', label: 'Available Colors', type: 'tags', placeholder: 'Black, Brown, White, Navy...', hint: 'Enter colors separated by commas' },
      ],
    },
    {
      title: 'Compliance',
      fields: [
        { key: 'is_bis_certified', label: 'BIS / ISI Certified', type: 'checkbox', defaultValue: false },
        { key: 'sole_type',        label: 'Sole Type',           type: 'select', options: ['Rubber', 'EVA', 'TPR', 'PU', 'Leather', 'Other'] },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'variant',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   true,
    variantDimensions: ['size', 'color'],
    sizeOptions: ['UK 1', 'UK 2', 'UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
    colorOptions: [],
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pairs',
    allowedUnits: ['Pair', 'Piece'],
    expiryAlertDays: 30,
    stockLabel:   'Pairs',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Size / Color',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'variant',
  },

  dashboardConfig: {
    callout: {
      icon: '👟', color: 'blue',
      title: 'Footwear Mode Active',
      body: 'Size-wise inventory, brand tracking & seasonal sales management.',
      cta: 'Footwear Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'sizes',     icon: '📏', label: 'Size-wise Stock', sublabel: 'Stock by size & brand',  href: '/product',   color: 'blue',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Footwear Sales',  sublabel: "Today's shoe sales",     href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Shoes',   sublabel: 'Purchase new stock',     href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Track sizes separately for each model. Popular sizes sell fastest — reorder early.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales Staff',   emoji: '👟', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager', emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',      emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Footwear Reports',
    pageSubtitle:    'Size-wise sales, brand trends & inventory analytics',
    accentColor:     '#0369a1',
    topItemsLabel:   'Top Footwear',
    topItemsIcon:    '👟',
    topBuyersLabel:  'Top Shoppers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Footwear Analytics',
    chartColor:      '#0369a1',
    insights: [
      { icon: '👟', text: 'Track size-wise stock separately per model. Popular sizes run out fastest — reorder early.' },
      { icon: '🎨', text: 'Colour preference changes seasonally. Review slow-moving sizes and styles quarterly.' },
      { icon: '📦', text: 'Avoid overstocking unpopular sizes. Order in proportion to historical sales data.' },
    ],
  },

  invoiceConfig: {
    accentColor:        '#0369a1',
    showVariantColumns: true,
    itemSectionTitle:   'Footwear',
    footerNote:         'Exchange within 7 days with original bill and original packaging. No cash refund on sale items.',
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
      icon: '👟',
      color: 'amber',
      renderMode: 'chips',
      sectionLabel: 'Size Stock Alerts',
      getChips: (val) => val.map((v) => ({
        key: String(v._id || 'unknown'),
        href: `/product?size=${encodeURIComponent(v._id || '')}&filter=low_stock`,
        label: `Size ${v._id || '?'} — ${v.productCount} pair${v.productCount !== 1 ? 's' : ''}`,
      })),
    },
  ],

  // ─── Footwear-specific expense categories ────────────────────────────────
  expenseCategories: [
    { id: 'stock_purchase', labelHi: 'Stock खरीद',   labelEn: 'Stock Purchase', emoji: '👟' },
    { id: 'display',        labelHi: 'Display Setup', labelEn: 'Display Setup',  emoji: '🪟' },
    { id: 'rent',           labelHi: 'किराया',         labelEn: 'Rent',           emoji: '🏠' },
    { id: 'salary',         labelHi: 'वेतन',           labelEn: 'Salary',         emoji: '👷' },
    { id: 'utility',        labelHi: 'बिजली-पानी',     labelEn: 'Utility',        emoji: '💡' },
    { id: 'maintenance',    labelHi: 'मरम्मत',          labelEn: 'Maintenance',    emoji: '🔧' },
    { id: 'transport',      labelHi: 'परिवहन',          labelEn: 'Transport',      emoji: '🚛' },
    { id: 'misc',           labelHi: 'अन्य',            labelEn: 'Misc',           emoji: '📦' },
  ],
};
