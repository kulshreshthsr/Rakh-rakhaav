/**
 * Dynamic Report Config Engine — Patch 7
 *
 * Each business config exports a `reportConfig` block that defines:
 *   - pageTitle, accentColor, chartColor
 *   - topItemsLabel / topBuyersLabel (what "Top Products" / "Top Customers" should say)
 *   - invoiceUnit (bills / orders / prescriptions / appointments …)
 *   - analyticsTitle (chart section heading)
 *   - insights[] — static operational tips shown at the top of Reports
 *
 * This utility merges those overrides with safe defaults so the page always
 * renders correctly even for business types that don't have a reportConfig yet.
 */

const DEFAULTS = {
  pageTitle:       'Reports / हिसाब',
  pageSubtitle:    'Revenue, profit, GST और customer trends — एक clean view में।',
  accentColor:     '#16a34a',
  topItemsLabel:   'Top Products',
  topItemsIcon:    '📦',
  topBuyersLabel:  'Top Customers',
  invoiceUnit:     'invoices',
  analyticsTitle:  'Business Analytics',
  chartColor:      '#16a34a',
  insights:        [],
};

/**
 * Returns the merged report config for the current business type.
 * @param {object} businessConfig  — the full config object from getBusinessConfig()
 */
export function getReportConfig(businessConfig) {
  const rc = businessConfig?.reportConfig ?? {};
  return {
    ...DEFAULTS,
    ...rc,
    insights: rc.insights ?? DEFAULTS.insights,
  };
}

/**
 * Returns an array of insight objects to render on the Reports page.
 * Combines:
 *   1. Static operational tips from reportConfig.insights (always shown)
 *   2. Dynamic rule-based alerts computed from live sales / summary data
 *
 * Each insight: { icon: string, text: string, color?: 'green' | 'amber' | 'red' }
 *
 * @param {object} reportCfg  — result of getReportConfig()
 * @param {Array}  sales      — sales array fetched on the page
 * @param {object} summary    — profit / revenue summary object
 */
export function computeInsights(reportCfg, sales, summary) {
  const list = (reportCfg.insights ?? []).map(ins => ({ color: 'green', ...ins }));

  const revenue  = summary?.totalRevenue  ?? 0;
  const margin   = summary?.margin        ?? 0;
  const udhaar   = summary?.totalUdhaar   ?? 0;

  // Low-margin warning
  if (revenue > 0 && margin < 10) {
    list.push({
      icon:  '📉',
      text:  `Profit margin is ${margin.toFixed(1)}% — below 10%. Review pricing or reduce costs to improve profitability.`,
      color: 'red',
    });
  }

  // High-udhaar ratio warning
  const udhaarRatio = revenue > 0 ? (udhaar / revenue) * 100 : 0;
  if (udhaarRatio > 15 && udhaar > 0) {
    list.push({
      icon:  '💳',
      text:  `Udhaar is ${udhaarRatio.toFixed(0)}% of revenue — ₹${Math.round(udhaar).toLocaleString('en-IN')} pending. Follow up on collections promptly.`,
      color: 'amber',
    });
  }

  // Best seller callout (only if revenue exists and top product is identifiable)
  if (revenue > 0 && sales?.length > 0) {
    const productMap = {};
    sales.forEach(sale => {
      const items = sale.items?.length > 0
        ? sale.items
        : [{ product_name: sale.product_name, total_amount: sale.total_amount }];
      items.forEach(item => {
        if (!item.product_name) return;
        productMap[item.product_name] = (productMap[item.product_name] || 0) + (item.total_amount || 0);
      });
    });
    const best = Object.entries(productMap).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      list.push({
        icon:  '🏆',
        text:  `Best seller: "${best[0]}" with ₹${Math.round(best[1]).toLocaleString('en-IN')} revenue this period.`,
        color: 'green',
      });
    }
  }

  return list.slice(0, 4); // cap at 4 so the page doesn't get cluttered
}
