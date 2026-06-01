/**
 * inventoryBehavior.js
 *
 * Client-side helper for reading and using the inventoryBehavior config.
 * All logic reads from config.inventoryBehavior — no hardcoding of business types.
 *
 * Usage (in any component):
 *   import { getInvBehavior, isBatchMode, isVariantMode, isSerialMode } from '../lib/inventoryBehavior';
 *   const inv = getInvBehavior(config);
 *   if (isBatchMode(inv)) { ... }
 */

import { apiUrl } from './api';

const getToken = () => (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');

// ─────────────────────────────────────────────────────────────────────────────
// Config accessors
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the inventoryBehavior object from a business config, with safe defaults. */
export function getInvBehavior(config = {}) {
  return config.inventoryBehavior || {};
}

export const isBatchMode   = (inv) => !!inv.trackBatches;
export const isVariantMode = (inv) => !!inv.trackVariants;
export const isSerialMode  = (inv) => !!inv.trackSerials;
export const isRecipeMode  = (inv) => !!inv.supportRecipes;
export const isLooseMode   = (inv) => !!inv.supportLooseQty;
export const hasExpiry     = (inv) => !!inv.trackExpiry || !!inv.trackBatches;

/** Returns true if any advanced inventory panel should be shown in the product page. */
export function hasInventoryPanel(inv) {
  return isBatchMode(inv) || isVariantMode(inv) || isSerialMode(inv) || isRecipeMode(inv);
}

/** Returns the human-readable label for the primary panel tab. */
export function getPrimaryPanelLabel(inv) {
  if (isBatchMode(inv))   return inv.batchLabel   || 'Batches';
  if (isVariantMode(inv)) return inv.variantLabel || 'Variants';
  if (isSerialMode(inv))  return inv.serialLabel  || 'Serials';
  if (isRecipeMode(inv))  return inv.recipeLabel  || 'Recipe';
  return 'Inventory';
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatExpiryDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function expiryStatus(dateStr, alertDays = 30) {
  if (!dateStr) return { status: 'none', label: '', cls: '' };
  const d   = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / 86400000);
  if (diff < 0)         return { status: 'expired',    label: 'Expired',         cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (diff <= alertDays) return { status: 'expiring',  label: `${diff}d left`,   cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return                        { status: 'valid',     label: formatExpiryDate(dateStr), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers — all calls go through /api/inventory/:type/:productId
// ─────────────────────────────────────────────────────────────────────────────

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

export const invApi = {
  // Batch
  getBatches:  (pid)         => fetch(apiUrl(`/api/inventory/batches/${pid}`),                  { headers: authHeaders() }),
  addBatch:    (pid, data)   => fetch(apiUrl(`/api/inventory/batches/${pid}`),                  { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  updateBatch: (bid, data)   => fetch(apiUrl(`/api/inventory/batches/item/${bid}`),             { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(data) }),
  deleteBatch: (bid)         => fetch(apiUrl(`/api/inventory/batches/item/${bid}`),             { method: 'DELETE', headers: authHeaders() }),
  getExpiring: (days = 30)   => fetch(apiUrl(`/api/inventory/batches/expiring?days=${days}`),   { headers: authHeaders() }),

  // Variant
  getVariants:  (pid)        => fetch(apiUrl(`/api/inventory/variants/${pid}`),                 { headers: authHeaders() }),
  saveVariants: (pid, data)  => fetch(apiUrl(`/api/inventory/variants/${pid}`),                 { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  updateVariant:(vid, data)  => fetch(apiUrl(`/api/inventory/variants/item/${vid}`),            { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(data) }),

  // Recipe
  getRecipe:    (pid)        => fetch(apiUrl(`/api/inventory/recipe/${pid}`),                   { headers: authHeaders() }),
  saveRecipe:   (pid, data)  => fetch(apiUrl(`/api/inventory/recipe/${pid}`),                   { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(data) }),
  deleteRecipe: (pid)        => fetch(apiUrl(`/api/inventory/recipe/${pid}`),                   { method: 'DELETE', headers: authHeaders() }),

  // Serial
  getSerials:   (pid, status) => fetch(apiUrl(`/api/inventory/serials/${pid}${status ? `?status=${status}` : ''}`), { headers: authHeaders() }),
  addSerials:   (pid, data)   => fetch(apiUrl(`/api/inventory/serials/${pid}`),                 { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  deleteSerial: (sid)         => fetch(apiUrl(`/api/inventory/serials/item/${sid}`),            { method: 'DELETE', headers: authHeaders() }),

  // Summary
  getSummary:   (pid)        => fetch(apiUrl(`/api/inventory/summary/${pid}`),                  { headers: authHeaders() }),
};

/** Parse JSON from a fetch Response and throw on errors. */
export async function invFetch(responsePromise) {
  const res = await responsePromise;
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEFO batch selector — pick batches in First-Expired-First-Out order
// until `quantityNeeded` is fulfilled.  Used client-side to suggest batches.
// ─────────────────────────────────────────────────────────────────────────────

export function selectBatchesFEFO(batches = [], quantityNeeded) {
  const active = [...batches]
    .filter(b => !b.is_depleted && b.quantity > 0)
    .sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date) - new Date(b.expiry_date);
    });

  const selected = [];
  let remaining = quantityNeeded;
  for (const batch of active) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    selected.push({ batch, quantity: take });
    remaining -= take;
  }
  return { selected, shortfall: remaining };
}
