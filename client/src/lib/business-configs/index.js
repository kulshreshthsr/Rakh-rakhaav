/**
 * Central Terminology Engine
 *
 * Usage anywhere in the app:
 *   import { getBusinessConfig } from '../lib/business-configs';
 *   const t = getBusinessConfig('electronics');
 *   t.searchProduct  →  'Search electronics by name, model, brand...'
 *
 * In components, prefer using the `term()` shorthand from useIndustry():
 *   const { term } = useIndustry();
 *   term('searchProduct')   →  same result, no import needed
 *
 * How it works:
 *   Each industry file exports only the keys that DIFFER from the base.
 *   getBusinessConfig merges BASE_TERMINOLOGY + industry overrides.
 *   Unknown business types fall back to 'general' (which is the base itself).
 */

import { BASE_TERMINOLOGY } from './base.js';

import general     from './general.js';
import hardware    from './hardware.js';
import electronics from './electronics.js';

const OVERRIDES = {
  general,
  hardware,
  electronics,
};

/**
 * Returns the complete merged terminology config for a given business type.
 * Falls back to 'general' (base) for unknown types.
 *
 * @param {string} businessType
 * @returns {typeof BASE_TERMINOLOGY}
 */
export function getBusinessConfig(businessType) {
  const overrides = OVERRIDES[businessType] ?? OVERRIDES.general;
  return { ...BASE_TERMINOLOGY, ...overrides };
}

/** All base terminology keys — useful for type checking / documentation. */
export { BASE_TERMINOLOGY };

/** All registered business type keys — mirrors BUSINESS_TYPES in shopModel. */
export const BUSINESS_TYPE_KEYS = Object.keys(OVERRIDES);

const DEFAULT_KPI_CONFIG = {
  kpi1: { label: 'आज की कमाई',  sublabel: "Today's Revenue"   },
  kpi2: { label: 'Bills',        sublabel: 'Invoices today'    },
  kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'      },
  kpi4: { label: 'Udhaar',       sublabel: 'Pending credit'    },
  kpi5: { label: 'GST Payable',  sublabel: 'This month'        },
  kpi6: { label: 'Stock Alerts', sublabel: 'Low / Out of stock'},
};

/**
 * Returns the kpiConfig for a business type, falling back to the default.
 */
export function getKpiConfig(businessType) {
  const config = getBusinessConfig(businessType);
  return config.kpiConfig || DEFAULT_KPI_CONFIG;
}

export { DEFAULT_KPI_CONFIG };
