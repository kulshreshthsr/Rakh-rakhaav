/**
 * Central Terminology Engine
 *
 * Usage anywhere in the app:
 *   import { getBusinessConfig } from '../lib/business-configs';
 *   const t = getBusinessConfig('pharmacy');
 *   t.searchProduct  →  'Search medicines by name, composition, batch...'
 *   t.noCustomers    →  'No patients found.'
 *   t.quickNewSale   →  'New Bill'
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

import general       from './general.js';
import pharmacy      from './pharmacy.js';
import restaurant    from './restaurant.js';
import salon         from './salon.js';
import clothing      from './clothing.js';
import hardware      from './hardware.js';
import electronics   from './electronics.js';
import automobile    from './automobile.js';
import retail        from './retail.js';
import bookstall     from './bookstall.js';
import kirana        from './kirana.js';
import sweet_shop    from './sweet_shop.js';
import bakery        from './bakery.js';
import stationery    from './stationery.js';
import mobile_shop   from './mobile_shop.js';
import grocery       from './grocery.js';
import cosmetics     from './cosmetics.js';
import footwear      from './footwear.js';
import furniture     from './furniture.js';
import gift_shop     from './gift_shop.js';
import toy_store     from './toy_store.js';
import sports        from './sports.js';
import jewellery     from './jewellery.js';
import pet_shop      from './pet_shop.js';
import service_center from './service_center.js';
import repair_shop   from './repair_shop.js';

const OVERRIDES = {
  general,
  pharmacy,
  restaurant,
  salon,
  clothing,
  hardware,
  electronics,
  automobile,
  retail,
  bookstall,
  kirana,
  sweet_shop,
  bakery,
  stationery,
  mobile_shop,
  grocery,
  cosmetics,
  footwear,
  furniture,
  gift_shop,
  toy_store,
  sports,
  jewellery,
  pet_shop,
  service_center,
  repair_shop,
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
 * Used to drive dashboard KPI label customisation per industry.
 */
export function getKpiConfig(businessType) {
  const config = getBusinessConfig(businessType);
  return config.kpiConfig || DEFAULT_KPI_CONFIG;
}

export { DEFAULT_KPI_CONFIG };
