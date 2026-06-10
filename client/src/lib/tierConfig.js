/**
 * Client-side mirror of backend lib/tierConfig.js
 * Keep in sync with the backend version manually when features change.
 */

const BASE_FEATURES = {
  nav_dashboard: true, nav_sales: true, nav_udhaar: true, nav_profile: true,
  module_billing: true, module_basic_stock: true,
  billing_cash: true, billing_credit: true, billing_discount: true,
  report_today_summary: true, invoice_print: true, invoice_whatsapp: true,
};

const TIER_FEATURES = {
  nano: {
    ...BASE_FEATURES,
    nav_stock: true, nav_expenses: true,
    report_basic_pl: false, report_gst: false,
    module_purchase: false, module_purchase_full: false,
    module_udhaar: true, module_expenses: true, module_gst: false,
    module_bulk_import: false, billing_quotation: false,
    invoice_gst: false, invoice_challan: false,
    erp_purchase_orders: false, erp_grn: false, erp_multi_location: false,
    erp_credit_aging: false, erp_pl_statement: false, erp_supplier_ledger: false,
    nav_purchases: false, nav_gst: false, nav_reports: false, nav_bank: false, nav_income: false,
    max_sub_users: 1,
  },
  core: {
    ...BASE_FEATURES,
    nav_stock: true, nav_expenses: true, nav_purchases: true, nav_udhaar: true,
    nav_gst: true, nav_reports: true, nav_bank: true, nav_income: true,
    module_purchase: true, module_purchase_full: true, module_udhaar: true,
    module_expenses: true, module_income: true, module_bank: true,
    module_gst: true, module_bulk_import: true, billing_quotation: true,
    invoice_gst: true, invoice_challan: true,
    report_basic_pl: true, report_gst: true,
    erp_purchase_orders: false, erp_grn: true, erp_multi_location: false,
    erp_credit_aging: true, erp_pl_statement: true, erp_supplier_ledger: true,
    max_sub_users: 5,
  },
  pro: {
    ...BASE_FEATURES,
    nav_stock: true, nav_expenses: true, nav_purchases: true, nav_udhaar: true,
    nav_gst: true, nav_reports: true, nav_bank: true, nav_income: true,
    module_purchase: true, module_purchase_full: true, module_udhaar: true,
    module_expenses: true, module_income: true, module_bank: true,
    module_gst: true, module_bulk_import: true, billing_quotation: true,
    invoice_gst: true, invoice_challan: true,
    report_basic_pl: true, report_gst: true, report_full_pl: true, report_balance_sheet: true,
    erp_purchase_orders: true, erp_grn: true, erp_multi_location: true,
    erp_credit_aging: true, erp_pl_statement: true, erp_supplier_ledger: true,
    erp_eway_bill: true, erp_einvoice: true,
    report_stock_valuation: true, report_stock_aging: true,
    max_sub_users: Infinity,
  },
};

const INDUSTRY_OVERRIDES = {};

export function getTierFeatures(tier = 'nano', industryType = 'hardware') {
  const base = TIER_FEATURES[tier] || TIER_FEATURES.nano;
  const overrides = INDUSTRY_OVERRIDES[industryType] || {};
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === false) result[key] = false;
  }
  return result;
}

export function isFeatureEnabled(feature, tier = 'nano', industryType = 'hardware') {
  return getTierFeatures(tier, industryType)[feature] === true;
}
