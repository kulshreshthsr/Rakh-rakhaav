/**
 * Industry Configuration Registry
 *
 * Reduced to Hardware and Electronics only.
 * 'general' is kept as an internal fallback — it is NOT selectable in onboarding.
 *
 * Each entry defines per-type terminology, enabled modules, product attributes,
 * and invoice fields. The system picks this up automatically from businessType.
 */

const INDUSTRIES = {

  // ─────────────────────────────────────────────────────────────────
  // GENERAL — internal fallback only, not selectable in onboarding
  // ─────────────────────────────────────────────────────────────────
  general: {
    id: 'general',
    label: 'General Store',
    labelHindi: 'जनरल स्टोर',
    icon: '🏪',
    selectable: false,
    terminology: {
      product: 'Product', products: 'Products', productHindi: 'सामान',
      inventory: 'Inventory', invoice: 'Invoice', sale: 'Sale',
      purchase: 'Purchase', supplier: 'Supplier', suppliers: 'Suppliers',
      customer: 'Customer', addProduct: 'Add Product', item: 'Item',
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
  // HARDWARE STORE
  // ─────────────────────────────────────────────────────────────────
  hardware: {
    id: 'hardware',
    label: 'Hardware Store',
    labelHindi: 'हार्डवेयर की दुकान',
    icon: '🔧',
    selectable: true,
    terminology: {
      product: 'Item', products: 'Items', productHindi: 'सामान',
      inventory: 'Stock', invoice: 'Invoice', sale: 'Sale',
      purchase: 'Purchase', supplier: 'Supplier', suppliers: 'Suppliers',
      customer: 'Customer / Contractor', addProduct: 'Add Item', item: 'Item',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: false,
    },
    productAttributes: [
      { key: 'brand',    label: 'Brand',        type: 'text',   placeholder: 'Brand name' },
      { key: 'material', label: 'Material',      type: 'text',   placeholder: 'Steel, Iron, PVC…' },
      { key: 'size_spec',label: 'Size / Spec',   type: 'text',   placeholder: '1 inch, 6mm…' },
      { key: 'category', label: 'Category',      type: 'select', options: ['Tools & Power Tools', 'Plumbing & Sanitary', 'Electrical', 'Building Materials', 'Paints & Finishes', 'Fasteners & Fittings', 'Wires & Cables', 'Safety Equipment', 'Other'] },
    ],
    invoiceLineFields: [],
    invoiceExtraFields: [
      { key: 'delivery_site',   label: 'Delivery Site / Address',     type: 'text', placeholder: 'Site name or delivery address' },
      { key: 'challan_no',      label: 'Challan No.',                 type: 'text', placeholder: 'Auto or manual challan number' },
      { key: 'challan_date',    label: 'Challan Date',                type: 'date' },
      { key: 'contractor_name', label: 'Contractor / Site In-charge', type: 'text' },
      { key: 'po_number',       label: 'Purchase Order No.',          type: 'text', placeholder: 'Client PO number if applicable' },
      { key: 'vehicle_no',      label: 'Delivery Vehicle No.',        type: 'text', placeholder: 'e.g. UP80 AB 1234' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ELECTRONICS STORE (includes Mobiles & Gadgets sub-category)
  // ─────────────────────────────────────────────────────────────────
  electronics: {
    id: 'electronics',
    label: 'Electronics Store',
    labelHindi: 'इलेक्ट्रॉनिक्स की दुकान',
    icon: '📺',
    selectable: true,
    terminology: {
      product: 'Product', products: 'Products', productHindi: 'सामान',
      inventory: 'Stock', invoice: 'Invoice', sale: 'Sale',
      purchase: 'Purchase', supplier: 'Distributor', suppliers: 'Distributors',
      customer: 'Customer', addProduct: 'Add Product', item: 'Product',
    },
    modules: {
      sales: true, purchases: true, inventory: true, udhaar: true,
      expenses: true, income: true, bank: true, reports: true, gst: true,
      batchTracking: false, expiryTracking: false,
      appointments: false, tableManagement: false, kot: false,
      variants: false, serviceJobs: true,
    },
    productAttributes: [
      { key: 'brand',    label: 'Brand',     type: 'text',   placeholder: 'Samsung, LG, Apple…' },
      { key: 'model_no', label: 'Model No.', type: 'text',   placeholder: 'Model number' },
      { key: 'category', label: 'Category',  type: 'select', options: ['Home Appliances', 'Mobiles & Gadgets', 'Computing', 'Audio / Visual', 'Accessories & Spares', 'Other'] },
      { key: 'warranty', label: 'Warranty',  type: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years'] },
      { key: 'serial_no',label: 'Serial No.', type: 'text',  placeholder: 'Serial / IMEI number' },
    ],
    invoiceLineFields: [
      { key: 'serial_no', label: 'Serial / IMEI', type: 'text', required: false, placeholder: 'Serial or IMEI number' },
      { key: 'warranty_end', label: 'Warranty Till', type: 'text', required: false, placeholder: 'MM/YY' },
    ],
    invoiceExtraFields: [
      { key: 'serial_no',       label: 'Serial Number',    type: 'text' },
      { key: 'imei_no',         label: 'IMEI (if mobile)', type: 'text' },
      { key: 'warranty_period', label: 'Warranty Period',  type: 'select', options: ['3 months', '6 months', '1 year', '2 years', '3 years', 'As per brand'] },
      { key: 'demo_date',       label: 'Demo Date',        type: 'date' },
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
 * Returns selectable industries for onboarding (excludes general fallback).
 */
function listIndustries() {
  return Object.values(INDUSTRIES).filter(ind => ind.selectable !== false);
}

module.exports = { INDUSTRIES, getIndustryConfig, listIndustries };
