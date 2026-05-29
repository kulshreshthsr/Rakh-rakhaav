'use client';

/**
 * useTerminology()
 *
 * The primary terminology hook. Returns pre-grouped terminology objects
 * so components never need to call term() repeatedly or build strings
 * by concatenation.
 *
 * Usage:
 *   const { labels, placeholders, actions, emptyStates, kpis, term } = useTerminology();
 *
 *   labels.product          → 'Medicine'        (pharmacy)
 *   labels.customer         → 'Guest'           (restaurant)
 *   placeholders.searchSale → 'Search order, guest, dish...'
 *   actions.newSale         → 'New Order'
 *   emptyStates.noProducts  → 'No dishes in menu yet.'
 *   kpis.kpiInvoices        → 'Orders'
 *   quickActions.newSaleHindi → 'नया Order लो'
 *
 * All group objects are memoized and only recompute when businessType changes
 * (i.e. essentially never during a user session).
 *
 * For one-off keys not covered by any group: use term('key').
 * For non-React contexts: use resolveTerms() from lib/terminology/resolver.js.
 */

import { useMemo } from 'react';
import { useIndustry } from '../contexts/IndustryContext';

export function useTerminology() {
  const { term, isEnabled, config, businessType, updateBusinessType } = useIndustry();

  // ─── Core entity labels ──────────────────────────────────────────────────
  const labels = useMemo(() => ({
    product:       term('product'),
    products:      term('products'),
    productHindi:  term('productHindi'),
    item:          term('item'),
    items:         term('items'),
    inventory:     term('inventory'),
    invoice:       term('invoice'),
    invoices:      term('invoices'),
    sale:          term('sale'),
    sales:         term('sales'),
    purchase:      term('purchase'),
    purchases:     term('purchases'),
    customer:      term('customer'),
    customers:     term('customers'),
    customerHindi: term('customerHindi'),
    supplier:      term('supplier'),
    suppliers:     term('suppliers'),
    supplierHindi: term('supplierHindi'),
  }), [term]);

  // ─── Search / filter placeholders ───────────────────────────────────────
  const placeholders = useMemo(() => ({
    searchProduct:   term('searchProduct'),
    searchCustomer:  term('searchCustomer'),
    searchSupplier:  term('searchSupplier'),
    searchSale:      term('searchSale'),
    searchPurchase:  term('searchPurchase'),
    customerName:    term('customerNamePlaceholder'),
    customerPhone:   term('customerPhonePlaceholder'),
    supplierName:    term('supplierNamePlaceholder'),
    supplierPhone:   term('supplierPhonePlaceholder'),
  }), [term]);

  // ─── Action / button labels ──────────────────────────────────────────────
  const actions = useMemo(() => ({
    addProduct:     term('addProduct'),
    newSale:        term('newSale'),
    newPurchase:    term('newPurchase'),
    editSale:       term('editSale'),
    editPurchase:   term('editPurchase'),
  }), [term]);

  // ─── Empty state messages ────────────────────────────────────────────────
  const emptyStates = useMemo(() => ({
    noProducts:   term('noProducts'),
    noCustomers:  term('noCustomers'),
    noSuppliers:  term('noSuppliers'),
    noSales:      term('noSales'),
    noPurchases:  term('noPurchases'),
  }), [term]);

  // ─── Section / table headers ─────────────────────────────────────────────
  const sections = useMemo(() => ({
    customer:  term('customerSection'),
    supplier:  term('supplierSection'),
    items:     term('itemsSection'),
  }), [term]);

  // ─── Directory page labels ───────────────────────────────────────────────
  const directory = useMemo(() => ({
    customerTitle:       term('customerDirectory'),
    customerTitleHindi:  term('customerDirectoryHindi'),
    supplierTitle:       term('supplierDirectory'),
    supplierTitleHindi:  term('supplierDirectoryHindi'),
    refreshingCustomers: term('refreshingCustomers'),
    refreshingSuppliers: term('refreshingSuppliers'),
    allSuppliers:        term('allSuppliers'),
    selectSupplier:      term('selectSupplier'),
    backToSales:         term('backToSales'),
    backToPurchases:     term('backToPurchases'),
  }), [term]);

  // ─── Dashboard quick action labels ──────────────────────────────────────
  const quickActions = useMemo(() => ({
    newSale:         term('quickNewSale'),
    newSaleHindi:    term('quickNewSaleHindi'),
    purchase:        term('quickPurchase'),
    purchaseHindi:   term('quickPurchaseHindi'),
    addStock:        term('quickAddStock'),
    addStockHindi:   term('quickAddStockHindi'),
  }), [term]);

  // ─── Dashboard KPI card labels ───────────────────────────────────────────
  const kpis = useMemo(() => ({
    totalSales:      term('kpiTotalSales'),
    totalPurchases:  term('kpiTotalPurchases'),
    invoices:        term('kpiInvoices'),
    lowStock:        term('kpiLowStock'),
    outOfStock:      term('kpiOutOfStock'),
    inventoryValue:  term('kpiInventoryValue'),
    totalProducts:   term('kpiTotalProducts'),
    totalCustomers:  term('kpiTotalCustomers'),
    recentSales:     term('kpiRecentSales'),
  }), [term]);

  return {
    // ── Raw access (for one-off keys not in any group) ──────────────────
    term,
    isEnabled,
    config,
    businessType,
    updateBusinessType,

    // ── Pre-grouped objects (preferred — use these in components) ───────
    labels,
    placeholders,
    actions,
    emptyStates,
    sections,
    directory,
    quickActions,
    kpis,
  };
}
