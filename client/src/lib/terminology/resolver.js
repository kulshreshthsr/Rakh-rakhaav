/**
 * Pure terminology resolver — no React, no hooks.
 *
 * Use this when you need terminology outside of a React component:
 *  - utility functions (WhatsApp message builders, PDF generators…)
 *  - server components
 *  - unit tests
 *  - any module that can't call hooks
 *
 * Inside React components, prefer useTerminology() or useEntityTerms()
 * from client/src/hooks/ — they give you pre-grouped, memoized objects.
 */

import { getBusinessConfig } from '../business-configs/index.js';
import { TERM_GROUPS } from './groups.js';

/**
 * Returns the full merged terminology config for a business type.
 * Falls back to 'general' for unknown types.
 *
 * @param {string} businessType
 * @returns {Record<string, string>}
 */
export function resolveTerms(businessType) {
  return getBusinessConfig(businessType);
}

/**
 * Returns the value of a single terminology key for a given business type.
 *
 * @param {string} businessType
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveTerm(businessType, key, fallback = key) {
  const config = getBusinessConfig(businessType);
  return config[key] || fallback;
}

/**
 * Returns a subset of terminology keys for a named group.
 * Group names are defined in groups.js (labels, placeholders, actions…).
 *
 * @param {string} businessType
 * @param {keyof typeof TERM_GROUPS} groupName
 * @returns {Record<string, string>}
 */
export function resolveTermGroup(businessType, groupName) {
  const config = getBusinessConfig(businessType);
  const keys = TERM_GROUPS[groupName];
  if (!keys) return {};
  return Object.fromEntries(keys.map(k => [k, config[k] ?? k]));
}

/**
 * Returns all groups at once, keyed by group name.
 * Useful when you need several groups without multiple calls.
 *
 * @param {string} businessType
 * @returns {Record<keyof typeof TERM_GROUPS, Record<string, string>>}
 */
export function resolveAllGroups(businessType) {
  const config = getBusinessConfig(businessType);
  return Object.fromEntries(
    Object.entries(TERM_GROUPS).map(([groupName, keys]) => [
      groupName,
      Object.fromEntries(keys.map(k => [k, config[k] ?? k])),
    ])
  );
}
