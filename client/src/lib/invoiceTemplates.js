export const INVOICE_TEMPLATES = {
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    labelHi: 'सादा',
    description: 'Clean, simple invoice. Fast to print. Optimised for 58mm thermal printers.',
    preview: 'minimal-preview',
  },
  detailed: {
    id: 'detailed',
    label: 'Detailed',
    labelHi: 'विस्तृत',
    description: 'Full invoice with HSN, GST breakup, terms, and bank details.',
    preview: 'detailed-preview',
  },
  gst_tax: {
    id: 'gst_tax',
    label: 'GST Tax Invoice',
    labelHi: 'GST Invoice',
    description: 'Government-compliant format with CGST/SGST/IGST columns, HSN, place of supply, and authorised signatory.',
    preview: 'gst-preview',
  },
};

export const DEFAULT_TEMPLATE_KEY = 'rr-invoice-template';

export function getSavedTemplate() {
  if (typeof window === 'undefined') return 'detailed';
  return localStorage.getItem(DEFAULT_TEMPLATE_KEY) || 'detailed';
}

export function saveTemplate(templateId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEFAULT_TEMPLATE_KEY, templateId);
}
