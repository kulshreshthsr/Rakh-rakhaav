/**
 * Frontend Industry Configuration Registry
 *
 * This is a mirror of server/config/industries/index.js.
 * Keeping it in the frontend means the app works fully offline
 * (no extra API call needed just to know what labels to show).
 *
 * Terminology is now fully driven by the central engine in
 * ../business-configs — do NOT add hardcoded labels here.
 * To change any label/placeholder/empty-state text, edit the
 * relevant file in client/src/lib/business-configs/.
 *
 * To add a new business type:
 *   1. Add its key to BUSINESS_TYPES in server/models/shopModel.js
 *   2. Add its structural config (modules, attributes, fields) below
 *   3. Create client/src/lib/business-configs/<type>.js with overrides
 *   4. Register it in client/src/lib/business-configs/index.js
 *   5. Mirror in server/config/industries/index.js
 */

import { getBusinessConfig } from '../business-configs/index.js';

export const INDUSTRIES = {

  general: {
    id: 'general',
    label: 'General Store / Retail',
    labelHindi: 'जनरल स्टोर',
    icon: '🏪',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacy / Medical Store',
    labelHindi: 'दवाई की दुकान',
    icon: '💊',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: true, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  clothing: {
    id: 'clothing',
    label: 'Clothing / Apparel Store',
    labelHindi: 'कपड़े की दुकान',
    icon: '👗',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: true, serviceJobs: false,
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

  hardware: {
    id: 'hardware',
    label: 'Hardware Store',
    labelHindi: 'हार्डवेयर की दुकान',
    icon: '🔧',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'material', label: 'Material', type: 'text', placeholder: 'Steel, Iron, PVC…' },
      { key: 'size_spec', label: 'Size/Spec', type: 'text', placeholder: '1 inch, 6mm…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  electronics: {
    id: 'electronics',
    label: 'Electronics Store',
    labelHindi: 'इलेक्ट्रॉनिक्स की दुकान',
    icon: '📺',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / Dhaba / Food',
    labelHindi: 'रेस्टोरेंट / ढाबा',
    icon: '🍽️',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: false,
      expenses: true, income: false, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: true, kot: true, variants: false, serviceJobs: false,
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

  automobile: {
    id: 'automobile',
    label: 'Automobile / Spare Parts',
    labelHindi: 'ऑटोमोबाइल / स्पेयर पार्ट्स',
    icon: '🚗',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: true,
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

  retail: {
    id: 'retail',
    label: 'Retail Store',
    labelHindi: 'रिटेल स्टोर',
    icon: '🛍️',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Category' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  bookstall: {
    id: 'bookstall',
    label: 'Bookstall & School Accessories',
    labelHindi: 'किताब / स्कूल सामान',
    icon: '📚',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  kirana: {
    id: 'kirana',
    label: 'Kirana / General Store',
    labelHindi: 'किराना / जनरल स्टोर',
    icon: '🛒',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand/Company', type: 'text', placeholder: 'Brand name' },
      { key: 'weight_volume', label: 'Weight/Volume', type: 'text', placeholder: '500g, 1L…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  sweet_shop: {
    id: 'sweet_shop',
    label: 'Sweet Shop / Mithai',
    labelHindi: 'मिठाई की दुकान',
    icon: '🍬',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: false,
      expenses: true, income: false, bank: false, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  bakery: {
    id: 'bakery',
    label: 'Bakery',
    labelHindi: 'बेकरी',
    icon: '🍞',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: false,
      expenses: true, income: false, bank: false, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'ingredients', label: 'Ingredients', type: 'text', placeholder: 'Flour, Sugar…' },
      { key: 'shelf_life', label: 'Shelf Life', type: 'text', placeholder: '2 days, 1 week…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  salon: {
    id: 'salon',
    label: 'Salon / Beauty Parlour',
    labelHindi: 'सैलून / पार्लर',
    icon: '✂️',
    modules: {
      sales: true, purchases: false, inventory: true, udhaar: false,
      expenses: true, income: false, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: true,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  stationery: {
    id: 'stationery',
    label: 'Stationery Store',
    labelHindi: 'स्टेशनरी की दुकान',
    icon: '✏️',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Navneet, Camlin…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  mobile_shop: {
    id: 'mobile_shop',
    label: 'Mobile Shop',
    labelHindi: 'मोबाइल की दुकान',
    icon: '📱',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: true,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Samsung, Realme…' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'Galaxy A14…' },
      { key: 'storage', label: 'Storage', type: 'text', placeholder: '128GB / 6GB RAM' },
      { key: 'color', label: 'Color', type: 'text', placeholder: 'Black, White…' },
    ],
    invoiceLineFields: [
      { key: 'imei', label: 'IMEI', type: 'text', required: false, placeholder: '15-digit IMEI' },
    ],
    invoiceExtraFields: [],
  },

  grocery: {
    id: 'grocery',
    label: 'Grocery Store',
    labelHindi: 'ग्रोसरी स्टोर',
    icon: '🥕',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Amul, Fortune…' },
      { key: 'weight_volume', label: 'Weight/Volume', type: 'text', placeholder: '1kg, 500ml…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  cosmetics: {
    id: 'cosmetics',
    label: 'Cosmetics / Beauty Store',
    labelHindi: 'कॉस्मेटिक्स की दुकान',
    icon: '💄',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Lakme, Loreal…' },
      { key: 'skin_type', label: 'Skin Type', type: 'text', placeholder: 'Oily, Dry, All types…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  footwear: {
    id: 'footwear',
    label: 'Footwear Store',
    labelHindi: 'जूते-चप्पल की दुकान',
    icon: '👟',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: true, serviceJobs: false,
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

  furniture: {
    id: 'furniture',
    label: 'Furniture Store',
    labelHindi: 'फर्नीचर की दुकान',
    icon: '🪑',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  gift_shop: {
    id: 'gift_shop',
    label: 'Gift Shop',
    labelHindi: 'गिफ्ट शॉप',
    icon: '🎁',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'occasion', label: 'Occasion', type: 'text', placeholder: 'Birthday, Wedding…' },
    ],
    invoiceLineFields: [
      { key: 'gift_wrap', label: 'Gift Wrap', type: 'select', required: false, placeholder: 'Yes/No', options: ['Yes', 'No'] },
    ],
    invoiceExtraFields: [],
  },

  toy_store: {
    id: 'toy_store',
    label: 'Toy Store',
    labelHindi: 'खिलौने की दुकान',
    icon: '🧸',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Funskool, Lego…' },
      { key: 'age_group', label: 'Age Group', type: 'text', placeholder: '3-6 years, 7+…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  sports: {
    id: 'sports',
    label: 'Sports Store',
    labelHindi: 'स्पोर्ट्स स्टोर',
    icon: '⚽',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: true, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Nivia, SG…' },
      { key: 'sport_type', label: 'Sport', type: 'text', placeholder: 'Cricket, Football…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  jewellery: {
    id: 'jewellery',
    label: 'Jewellery Store',
    labelHindi: 'ज्वेलरी की दुकान',
    icon: '💍',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
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

  pet_shop: {
    id: 'pet_shop',
    label: 'Pet Shop',
    labelHindi: 'पेट शॉप',
    icon: '🐾',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: true, appointments: false,
      tableManagement: false, kot: false, variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'pet_type', label: 'For Pet', type: 'text', placeholder: 'Dog, Cat, Fish…' },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Pedigree, Royal Canin…' },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [],
  },

  service_center: {
    id: 'service_center',
    label: 'Service Center',
    labelHindi: 'सर्विस सेंटर',
    icon: '🔌',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: true,
      tableManagement: false, kot: false, variants: false, serviceJobs: true,
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

  repair_shop: {
    id: 'repair_shop',
    label: 'Repair Shop',
    labelHindi: 'मरम्मत की दुकान',
    icon: '🛠️',
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false, appointments: true,
      tableManagement: false, kot: false, variants: false, serviceJobs: true,
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
 * Get full config for a given businessType.
 * Merges structural config (modules, attributes, fields) with the
 * complete terminology from the central business-configs engine.
 */
export function getIndustryConfig(businessType) {
  const base = INDUSTRIES[businessType] || INDUSTRIES.general;
  return {
    ...base,
    terminology: getBusinessConfig(businessType),
  };
}

/** All industries as an array — used for the onboarding picker.
 *  Each entry is fully enriched with `terminology` via getIndustryConfig(). */
export function listIndustries() {
  return Object.values(INDUSTRIES).map(ind => getIndustryConfig(ind.id));
}

/** Helper: read terminology term from the loaded config. */
export function getTerm(config, key, fallback = key) {
  return config?.terminology?.[key] || fallback;
}

/** Helper: check if a module is enabled for the loaded config. */
export function isModuleEnabled(config, moduleKey) {
  return config?.modules?.[moduleKey] !== false;
}
