/**
 * Industry Configuration Registry
 *
 * Each entry defines how the app behaves for a specific business type:
 *   - terminology  : UI labels (product, invoice, supplier names, etc.)
 *   - modules      : which features are active (booleans)
 *   - productAttributes : extra fields stored in product.metadata
 *   - invoiceLineFields : extra columns on each invoice line (stored in item_metadata)
 *   - invoiceExtraFields: extra header-level fields on an invoice
 *
 * To add a new business type:
 *   1. Add its key to BUSINESS_TYPES in shopModel.js
 *   2. Add a config object here
 *   3. That's it — the rest of the system picks it up automatically.
 */

const INDUSTRIES = {

  // ─────────────────────────────────────────────────────────────────
  // GENERAL / DEFAULT — fallback for any unrecognised type
  // ─────────────────────────────────────────────────────────────────
  general: {
    id: 'general',
    label: 'General Store / Retail',
    labelHindi: 'जनरल स्टोर',
    icon: '🏪',
    terminology: {
      product: 'Product',
      products: 'Products',
      productHindi: 'सामान',
      inventory: 'Inventory',
      invoice: 'Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Product',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // PHARMACY
  // ─────────────────────────────────────────────────────────────────
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacy / Medical Store',
    labelHindi: 'दवाई की दुकान',
    icon: '💊',
    terminology: {
      product: 'Medicine',
      products: 'Medicines',
      productHindi: 'दवाई',
      inventory: 'Medicine Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Distributor',
      suppliers: 'Distributors',
      customer: 'Patient / Customer',
      addProduct: 'Add Medicine',
      item: 'Medicine',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: true, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'manufacturer', label: 'Manufacturer', type: 'text', placeholder: 'Cipla, Sun Pharma…' },
      { key: 'composition', label: 'Composition/Salt', type: 'text', placeholder: 'Paracetamol 500mg' },
      { key: 'schedule', label: 'Schedule', type: 'select', options: ['OTC', 'H', 'H1', 'G', 'X'], placeholder: 'OTC' },
      { key: 'pack_size', label: 'Pack Size', type: 'text', placeholder: '10 tablets / 100ml' },
    ],
    invoiceLineFields: [
      { key: 'batch_number', label: 'Batch No.', type: 'text', required: false, placeholder: 'B1234' },
      { key: 'expiry_date', label: 'Expiry', type: 'text', required: false, placeholder: 'MM/YY' },
      { key: 'mrp', label: 'MRP', type: 'number', required: false, placeholder: '0.00' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // CLOTHING / APPAREL
  // ─────────────────────────────────────────────────────────────────
  clothing: {
    id: 'clothing',
    label: 'Clothing / Apparel Store',
    labelHindi: 'कपड़े की दुकान',
    icon: '👗',
    terminology: {
      product: 'Item',
      products: 'Items',
      productHindi: 'कपड़े',
      inventory: 'Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: true, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'fabric', label: 'Fabric', type: 'text', placeholder: 'Cotton, Polyester…' },
      { key: 'gender', label: 'For', type: 'select', options: ['Men', 'Women', 'Kids', 'Unisex'], placeholder: 'Men' },
    ],
    invoiceLineFields: [
      { key: 'size', label: 'Size', type: 'text', required: false, placeholder: 'S/M/L/XL' },
      { key: 'color', label: 'Color', type: 'text', required: false, placeholder: 'Red, Blue…' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // HARDWARE STORE
  // ─────────────────────────────────────────────────────────────────
  hardware: {
    id: 'hardware',
    label: 'Hardware Store',
    labelHindi: 'हार्डवेयर की दुकान',
    icon: '🔧',
    terminology: {
      product: 'Item',
      products: 'Items',
      productHindi: 'सामान',
      inventory: 'Stock',
      invoice: 'Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'material', label: 'Material', type: 'text', placeholder: 'Steel, Iron, PVC…' },
      { key: 'size_spec', label: 'Size/Spec', type: 'text', placeholder: '1 inch, 6mm…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // ELECTRONICS STORE
  // ─────────────────────────────────────────────────────────────────
  electronics: {
    id: 'electronics',
    label: 'Electronics Store',
    labelHindi: 'इलेक्ट्रॉनिक्स की दुकान',
    icon: '📺',
    terminology: {
      product: 'Product',
      products: 'Products',
      productHindi: 'सामान',
      inventory: 'Stock',
      invoice: 'Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Product',
      item: 'Product',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Samsung, LG…' },
      { key: 'model_number', label: 'Model No.', type: 'text', placeholder: 'Model number' },
      { key: 'warranty', label: 'Warranty', type: 'text', placeholder: '1 Year / 6 Months' },
    ],
    invoiceLineFields: [
      { key: 'serial_number', label: 'Serial No.', type: 'text', required: false, placeholder: 'IMEI / Serial' },
      { key: 'warranty_end', label: 'Warranty Till', type: 'text', required: false, placeholder: 'MM/YY' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // RESTAURANT / DHABA / FOOD
  // ─────────────────────────────────────────────────────────────────
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / Dhaba / Food',
    labelHindi: 'रेस्टोरेंट / ढाबा',
    icon: '🍽️',
    terminology: {
      product: 'Dish',
      products: 'Menu Items',
      productHindi: 'खाना',
      inventory: 'Menu',
      invoice: 'Bill',
      sale: 'Order',
      purchase: 'Purchase',
      supplier: 'Vendor',
      suppliers: 'Vendors',
      customer: 'Guest',
      addProduct: 'Add Dish',
      item: 'Dish',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: true, kot: true,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Starter, Main, Dessert…' },
      { key: 'veg_nonveg', label: 'Type', type: 'select', options: ['Veg', 'Non-Veg', 'Egg'], placeholder: 'Veg' },
      { key: 'preparation_time', label: 'Prep Time (min)', type: 'number', placeholder: '15' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'table_number', label: 'Table No.', type: 'text', placeholder: 'T1' },
      { key: 'order_type', label: 'Order Type', type: 'select', options: ['Dine-in', 'Takeaway', 'Delivery'], placeholder: 'Dine-in' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // AUTOMOBILE SPARE PARTS
  // ─────────────────────────────────────────────────────────────────
  automobile: {
    id: 'automobile',
    label: 'Automobile / Spare Parts',
    labelHindi: 'ऑटोमोबाइल / स्पेयर पार्ट्स',
    icon: '🚗',
    terminology: {
      product: 'Part',
      products: 'Parts',
      productHindi: 'पार्ट्स',
      inventory: 'Parts Stock',
      invoice: 'Job Card / Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Vehicle Owner',
      addProduct: 'Add Part',
      item: 'Part',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: true,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand/OEM', type: 'text', placeholder: 'OEM / Bosch…' },
      { key: 'part_number', label: 'Part Number', type: 'text', placeholder: 'OEM part no.' },
      { key: 'compatible_vehicles', label: 'Compatible Vehicles', type: 'text', placeholder: 'Swift, Innova…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'vehicle_number', label: 'Vehicle No.', type: 'text', placeholder: 'MP04 AB 1234' },
      { key: 'vehicle_model', label: 'Model', type: 'text', placeholder: 'Swift Dzire 2020' },
      { key: 'km_reading', label: 'KM Reading', type: 'number', placeholder: '45000' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // RETAIL STORE (general retail, supermarket style)
  // ─────────────────────────────────────────────────────────────────
  retail: {
    id: 'retail',
    label: 'Retail Store',
    labelHindi: 'रिटेल स्टोर',
    icon: '🛍️',
    terminology: {
      product: 'Product', products: 'Products', productHindi: 'प्रोडक्ट',
      inventory: 'Stock', invoice: 'Invoice', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Product', item: 'Product',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Category' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // BOOKSTALL / SCHOOL ACCESSORIES
  // ─────────────────────────────────────────────────────────────────
  bookstall: {
    id: 'bookstall',
    label: 'Bookstall & School Accessories',
    labelHindi: 'किताब / स्कूल सामान',
    icon: '📚',
    terminology: {
      product: 'Book/Item',
      products: 'Books & Items',
      productHindi: 'किताब',
      inventory: 'Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Publisher/Supplier',
      suppliers: 'Publishers/Suppliers',
      customer: 'Customer',
      addProduct: 'Add Book/Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'author', label: 'Author', type: 'text', placeholder: 'Author name' },
      { key: 'publisher', label: 'Publisher', type: 'text', placeholder: 'Publisher name' },
      { key: 'class_standard', label: 'Class/Standard', type: 'text', placeholder: 'Class 6, Grade 10…' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Maths, Science…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // KIRANA / GENERAL STORE
  // ─────────────────────────────────────────────────────────────────
  kirana: {
    id: 'kirana',
    label: 'Kirana / General Store',
    labelHindi: 'किराना / जनरल स्टोर',
    icon: '🛒',
    terminology: {
      product: 'Item',
      products: 'Items',
      productHindi: 'सामान',
      inventory: 'Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand/Company', type: 'text', placeholder: 'Brand name' },
      { key: 'weight_volume', label: 'Weight/Volume', type: 'text', placeholder: '500g, 1L…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // SWEET SHOP / MITHAI
  // ─────────────────────────────────────────────────────────────────
  sweet_shop: {
    id: 'sweet_shop',
    label: 'Sweet Shop / Mithai',
    labelHindi: 'मिठाई की दुकान',
    icon: '🍬',
    terminology: {
      product: 'Sweet/Item',
      products: 'Sweets & Items',
      productHindi: 'मिठाई',
      inventory: 'Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Sweet/Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'ingredients', label: 'Main Ingredients', type: 'text', placeholder: 'Milk, Sugar, Cashew…' },
      { key: 'shelf_life', label: 'Shelf Life', type: 'text', placeholder: '3 days, 1 week…' },
    ],
    invoiceLineFields: [
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number', required: false, placeholder: '0.500' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // BAKERY
  // ─────────────────────────────────────────────────────────────────
  bakery: {
    id: 'bakery',
    label: 'Bakery',
    labelHindi: 'बेकरी',
    icon: '🍞',
    terminology: {
      product: 'Item',
      products: 'Bakery Items',
      productHindi: 'बेकरी आइटम',
      inventory: 'Stock',
      invoice: 'Bill',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'ingredients', label: 'Ingredients', type: 'text', placeholder: 'Flour, Sugar…' },
      { key: 'shelf_life', label: 'Shelf Life', type: 'text', placeholder: '2 days, 1 week…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // SALON / PARLOUR
  // ─────────────────────────────────────────────────────────────────
  salon: {
    id: 'salon',
    label: 'Salon / Beauty Parlour',
    labelHindi: 'सैलून / पार्लर',
    icon: '✂️',
    terminology: {
      product: 'Service',
      products: 'Services',
      productHindi: 'सर्विस',
      inventory: 'Services & Products',
      invoice: 'Bill',
      sale: 'Service',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Client',
      addProduct: 'Add Service',
      item: 'Service',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: true, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'service_category', label: 'Category', type: 'text', placeholder: 'Hair, Skin, Nail…' },
      { key: 'duration_min', label: 'Duration (min)', type: 'number', placeholder: '30' },
    ],
    invoiceLineFields: [
      { key: 'staff_name', label: 'Staff', type: 'text', required: false, placeholder: 'Staff member' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // STATIONERY
  // ─────────────────────────────────────────────────────────────────
  stationery: {
    id: 'stationery',
    label: 'Stationery Store',
    labelHindi: 'स्टेशनरी की दुकान',
    icon: '✏️',
    terminology: {
      product: 'Item', products: 'Items', productHindi: 'सामान',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Item', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Navneet, Camlin…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // MOBILE SHOP
  // ─────────────────────────────────────────────────────────────────
  mobile_shop: {
    id: 'mobile_shop',
    label: 'Mobile Shop',
    labelHindi: 'मोबाइल की दुकान',
    icon: '📱',
    terminology: {
      product: 'Mobile/Accessory',
      products: 'Mobiles & Accessories',
      productHindi: 'मोबाइल',
      inventory: 'Stock',
      invoice: 'Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Distributor',
      suppliers: 'Distributors',
      customer: 'Customer',
      addProduct: 'Add Mobile/Item',
      item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: true,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Samsung, Realme…' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'Galaxy A14, Note 30…' },
      { key: 'storage', label: 'Storage', type: 'text', placeholder: '128GB / 6GB RAM' },
      { key: 'color', label: 'Color', type: 'text', placeholder: 'Black, White…' },
    ],
    invoiceLineFields: [
      { key: 'imei', label: 'IMEI', type: 'text', required: false, placeholder: '15-digit IMEI' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // GROCERY STORE
  // ─────────────────────────────────────────────────────────────────
  grocery: {
    id: 'grocery',
    label: 'Grocery Store',
    labelHindi: 'ग्रोसरी स्टोर',
    icon: '🥕',
    terminology: {
      product: 'Item', products: 'Grocery Items', productHindi: 'किराना',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Item', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Amul, Fortune…' },
      { key: 'weight_volume', label: 'Weight/Volume', type: 'text', placeholder: '1kg, 500ml…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // COSMETICS STORE
  // ─────────────────────────────────────────────────────────────────
  cosmetics: {
    id: 'cosmetics',
    label: 'Cosmetics / Beauty Store',
    labelHindi: 'कॉस्मेटिक्स की दुकान',
    icon: '💄',
    terminology: {
      product: 'Product', products: 'Products', productHindi: 'सामान',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Product', item: 'Product',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Lakme, Loreal…' },
      { key: 'skin_type', label: 'Skin Type', type: 'text', placeholder: 'Oily, Dry, All types…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // FOOTWEAR STORE
  // ─────────────────────────────────────────────────────────────────
  footwear: {
    id: 'footwear',
    label: 'Footwear Store',
    labelHindi: 'जूते-चप्पल की दुकान',
    icon: '👟',
    terminology: {
      product: 'Footwear', products: 'Footwear Items', productHindi: 'जूते',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Footwear', item: 'Pair',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: true, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Bata, Nike…' },
      { key: 'material', label: 'Material', type: 'text', placeholder: 'Leather, Canvas…' },
      { key: 'gender', label: 'For', type: 'select', options: ['Men', 'Women', 'Kids', 'Unisex'], placeholder: 'Men' },
    ],
    invoiceLineFields: [
      { key: 'size', label: 'Size', type: 'text', required: false, placeholder: '7, 8, 9…' },
      { key: 'color', label: 'Color', type: 'text', required: false, placeholder: 'Black, Brown…' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // FURNITURE STORE
  // ─────────────────────────────────────────────────────────────────
  furniture: {
    id: 'furniture',
    label: 'Furniture Store',
    labelHindi: 'फर्नीचर की दुकान',
    icon: '🪑',
    terminology: {
      product: 'Furniture Item', products: 'Furniture Items', productHindi: 'फर्नीचर',
      inventory: 'Stock', invoice: 'Invoice', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Manufacturer/Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Furniture', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'material', label: 'Material', type: 'text', placeholder: 'Teak, Plywood, Iron…' },
      { key: 'dimensions', label: 'Dimensions', type: 'text', placeholder: '4x2 ft, L-shaped…' },
      { key: 'color_finish', label: 'Color/Finish', type: 'text', placeholder: 'Walnut, Natural…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'delivery_address', label: 'Delivery Address', type: 'text', placeholder: 'Delivery address' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // JEWELLERY STORE
  // ─────────────────────────────────────────────────────────────────
  jewellery: {
    id: 'jewellery',
    label: 'Jewellery Store',
    labelHindi: 'ज्वेलरी की दुकान',
    icon: '💍',
    terminology: {
      product: 'Jewellery Item',
      products: 'Jewellery Items',
      productHindi: 'ज्वेलरी',
      inventory: 'Stock',
      invoice: 'Invoice',
      sale: 'Sale',
      purchase: 'Purchase',
      supplier: 'Supplier/Manufacturer',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Jewellery',
      item: 'Piece',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'metal', label: 'Metal', type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Artificial'], placeholder: 'Gold' },
      { key: 'purity', label: 'Purity/Karat', type: 'text', placeholder: '22K, 18K, 925…' },
      { key: 'weight_gm', label: 'Weight (gm)', type: 'number', placeholder: '10.5' },
      { key: 'making_charges', label: 'Making Charges', type: 'number', placeholder: '500' },
    ],
    invoiceLineFields: [
      { key: 'weight_gm', label: 'Weight (gm)', type: 'number', required: false, placeholder: '10.5' },
      { key: 'purity', label: 'Purity', type: 'text', required: false, placeholder: '22K' },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // GIFT SHOP
  // ─────────────────────────────────────────────────────────────────
  gift_shop: {
    id: 'gift_shop',
    label: 'Gift Shop',
    labelHindi: 'गिफ्ट शॉप',
    icon: '🎁',
    terminology: {
      product: 'Gift Item', products: 'Gift Items', productHindi: 'गिफ्ट',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Gift Item', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'occasion', label: 'Occasion', type: 'text', placeholder: 'Birthday, Wedding…' },
    ],
    invoiceLineFields: [
      { key: 'gift_wrap', label: 'Gift Wrap', type: 'select', required: false, placeholder: 'Yes/No', options: ['Yes', 'No'] },
    ],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // TOY STORE
  // ─────────────────────────────────────────────────────────────────
  toy_store: {
    id: 'toy_store',
    label: 'Toy Store',
    labelHindi: 'खिलौने की दुकान',
    icon: '🧸',
    terminology: {
      product: 'Toy', products: 'Toys', productHindi: 'खिलौना',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Toy', item: 'Toy',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Funskool, Lego…' },
      { key: 'age_group', label: 'Age Group', type: 'text', placeholder: '3-6 years, 7+…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // SPORTS STORE
  // ─────────────────────────────────────────────────────────────────
  sports: {
    id: 'sports',
    label: 'Sports Store',
    labelHindi: 'स्पोर्ट्स स्टोर',
    icon: '⚽',
    terminology: {
      product: 'Equipment', products: 'Sports Equipment', productHindi: 'स्पोर्ट्स सामान',
      inventory: 'Stock', invoice: 'Invoice', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Customer',
      addProduct: 'Add Equipment', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: true, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Nivia, SG…' },
      { key: 'sport_type', label: 'Sport', type: 'text', placeholder: 'Cricket, Football…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // PET SHOP
  // ─────────────────────────────────────────────────────────────────
  pet_shop: {
    id: 'pet_shop',
    label: 'Pet Shop',
    labelHindi: 'पेट शॉप',
    icon: '🐾',
    terminology: {
      product: 'Item/Pet', products: 'Products & Pets', productHindi: 'पालतू जानवर',
      inventory: 'Stock', invoice: 'Bill', sale: 'Sale', purchase: 'Purchase',
      supplier: 'Supplier', suppliers: 'Suppliers', customer: 'Pet Owner',
      addProduct: 'Add Item', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'pet_type', label: 'For Pet', type: 'text', placeholder: 'Dog, Cat, Fish…' },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Pedigree, Royal Canin…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // SERVICE CENTER
  // ─────────────────────────────────────────────────────────────────
  service_center: {
    id: 'service_center',
    label: 'Service Center',
    labelHindi: 'सर्विस सेंटर',
    icon: '🔌',
    terminology: {
      product: 'Service/Part',
      products: 'Services & Parts',
      productHindi: 'सर्विस',
      inventory: 'Parts & Services',
      invoice: 'Job Card / Invoice',
      sale: 'Service',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Service/Part',
      item: 'Service',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: true, tableManagement: false, kot: false,
      variants: false, serviceJobs: true,
    },
    productAttributes: [
      { key: 'compatible_models', label: 'Compatible Models', type: 'text', placeholder: 'Samsung, LG…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'device_model', label: 'Device/Model', type: 'text', placeholder: 'Samsung A14' },
      { key: 'complaint', label: 'Complaint', type: 'text', placeholder: 'Screen broken, No power…' },
      { key: 'engineer_name', label: 'Engineer', type: 'text', placeholder: 'Technician name' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // REPAIR SHOP
  // ─────────────────────────────────────────────────────────────────
  repair_shop: {
    id: 'repair_shop',
    label: 'Repair Shop',
    labelHindi: 'मरम्मत की दुकान',
    icon: '🛠️',
    terminology: {
      product: 'Service/Part',
      products: 'Services & Parts',
      productHindi: 'सर्विस',
      inventory: 'Parts & Services',
      invoice: 'Job Card',
      sale: 'Repair Job',
      purchase: 'Purchase',
      supplier: 'Supplier',
      suppliers: 'Suppliers',
      customer: 'Customer',
      addProduct: 'Add Service/Part',
      item: 'Service',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: true, tableManagement: false, kot: false,
      variants: false, serviceJobs: true,
    },
    productAttributes: [],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'item_description', label: 'Item for Repair', type: 'text', placeholder: 'Fan, TV, Pump…' },
      { key: 'complaint', label: 'Problem', type: 'text', placeholder: 'Describe the issue' },
    ],
  },
};

/**
 * Get the industry config for a given business type.
 * Falls back to 'general' for any unknown type.
 */
function getIndustryConfig(businessType) {
  return INDUSTRIES[businessType] || INDUSTRIES.general;
}

/**
 * Returns all industry configs as an array (useful for listing in admin/onboarding).
 */
function listIndustries() {
  return Object.values(INDUSTRIES);
}

module.exports = { INDUSTRIES, getIndustryConfig, listIndustries };
