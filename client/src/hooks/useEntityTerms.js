'use client';

/**
 * Domain-specific terminology hooks.
 *
 * Each hook returns ONLY the keys relevant to its domain,
 * with readable short names so JSX stays self-documenting.
 *
 * Pattern — import one hook per domain, destructure what you need:
 *
 *   const { label, searchPlaceholder, emptyState } = useCustomerTerms();
 *   const { addButton, searchPlaceholder, emptyState } = useProductTerms();
 *   const { invoiceLabel, newButton, itemsSection } = useSaleTerms();
 *
 * All values are derived from useTerminology(), which is memoized and
 * only recomputes when businessType changes.
 *
 * No if/else. No switch. No hardcoded strings. No key repetition.
 */

import { useTerminology } from './useTerminology';

// ─── Product / Inventory ──────────────────────────────────────────────────────

/**
 * Terms for the product/inventory page, modals, and search.
 *
 *   const { label, labelPlural, addButton, searchPlaceholder, emptyState } = useProductTerms();
 */
export function useProductTerms() {
  const { labels, placeholders, actions, emptyStates, sections } = useTerminology();
  return {
    label:              labels.product,
    labelPlural:        labels.products,
    labelHindi:         labels.productHindi,
    itemLabel:          labels.item,
    inventoryLabel:     labels.inventory,
    addButton:          actions.addProduct,
    searchPlaceholder:  placeholders.searchProduct,
    emptyState:         emptyStates.noProducts,
    itemsSection:       sections.items,
  };
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * Terms for the customer directory, customer info sections, and customer search.
 *
 *   const { label, labelPlural, searchPlaceholder, emptyState, sectionHeader, pageTitle } = useCustomerTerms();
 */
export function useCustomerTerms() {
  const { labels, placeholders, emptyStates, sections, directory } = useTerminology();
  return {
    label:              labels.customer,
    labelPlural:        labels.customers,
    labelHindi:         labels.customerHindi,
    searchPlaceholder:  placeholders.searchCustomer,
    namePlaceholder:    placeholders.customerName,
    phonePlaceholder:   placeholders.customerPhone,
    emptyState:         emptyStates.noCustomers,
    sectionHeader:      sections.customer,
    pageTitle:          directory.customerTitle,
    pageTitleHindi:     directory.customerTitleHindi,
    refreshing:         directory.refreshingCustomers,
    backToSales:        directory.backToSales,
  };
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

/**
 * Terms for the supplier directory, supplier info sections, and supplier search.
 *
 *   const { label, labelPlural, searchPlaceholder, emptyState, allLabel, selectPrompt } = useSupplierTerms();
 */
export function useSupplierTerms() {
  const { labels, placeholders, emptyStates, sections, directory } = useTerminology();
  return {
    label:              labels.supplier,
    labelPlural:        labels.suppliers,
    labelHindi:         labels.supplierHindi,
    searchPlaceholder:  placeholders.searchSupplier,
    namePlaceholder:    placeholders.supplierName,
    phonePlaceholder:   placeholders.supplierPhone,
    emptyState:         emptyStates.noSuppliers,
    sectionHeader:      sections.supplier,
    pageTitle:          directory.supplierTitle,
    pageTitleHindi:     directory.supplierTitleHindi,
    refreshing:         directory.refreshingSuppliers,
    allLabel:           directory.allSuppliers,
    selectPrompt:       directory.selectSupplier,
    backToPurchases:    directory.backToPurchases,
  };
}

// ─── Sale / Invoice ───────────────────────────────────────────────────────────

/**
 * Terms for the sales page, sale modals, and invoice sections.
 *
 *   const { label, invoiceLabel, newButton, searchPlaceholder, customerSection, itemsSection } = useSaleTerms();
 */
export function useSaleTerms() {
  const { labels, placeholders, actions, emptyStates, sections, directory } = useTerminology();
  return {
    label:              labels.sale,
    labelPlural:        labels.sales,
    invoiceLabel:       labels.invoice,
    invoiceLabelPlural: labels.invoices,
    customerLabel:      labels.customer,
    newButton:          actions.newSale,
    editButton:         actions.editSale,
    searchPlaceholder:  placeholders.searchSale,
    emptyState:         emptyStates.noSales,
    customerSection:    sections.customer,
    itemsSection:       sections.items,
    backToSales:        directory.backToSales,
  };
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Terms for the purchases page and purchase modals.
 *
 *   const { label, supplierLabel, newButton, searchPlaceholder, emptyState } = usePurchaseTerms();
 */
export function usePurchaseTerms() {
  const { labels, placeholders, actions, emptyStates, sections } = useTerminology();
  return {
    label:              labels.purchase,
    labelPlural:        labels.purchases,
    invoiceLabel:       labels.invoice,
    supplierLabel:      labels.supplier,
    newButton:          actions.newPurchase,
    editButton:         actions.editPurchase,
    searchPlaceholder:  placeholders.searchPurchase,
    emptyState:         emptyStates.noPurchases,
    supplierSection:    sections.supplier,
    itemsSection:       sections.items,
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * Terms for the dashboard — quick actions and KPI card labels.
 *
 *   const { quickNewSale, quickNewSaleHindi, kpiInvoices, kpiTotalProducts } = useDashboardTerms();
 */
export function useDashboardTerms() {
  const { quickActions, kpis, labels } = useTerminology();
  return {
    // Quick action buttons
    quickNewSale:        quickActions.newSale,
    quickNewSaleHindi:   quickActions.newSaleHindi,
    quickPurchase:       quickActions.purchase,
    quickPurchaseHindi:  quickActions.purchaseHindi,
    quickAddStock:       quickActions.addStock,
    quickAddStockHindi:  quickActions.addStockHindi,

    // KPI card labels
    kpiTotalSales:       kpis.totalSales,
    kpiTotalPurchases:   kpis.totalPurchases,
    kpiInvoices:         kpis.invoices,
    kpiLowStock:         kpis.lowStock,
    kpiOutOfStock:       kpis.outOfStock,
    kpiInventoryValue:   kpis.inventoryValue,
    kpiTotalProducts:    kpis.totalProducts,
    kpiTotalCustomers:   kpis.totalCustomers,
    kpiRecentSales:      kpis.recentSales,

    // Entity labels (for dashboard section headings)
    productLabel:        labels.product,
    productsLabel:       labels.products,
    saleLabel:           labels.sale,
    salesLabel:          labels.sales,
    invoiceLabel:        labels.invoice,
    customerLabel:       labels.customer,
  };
}
