/**
 * Role Config Engine — Patch 8: Business-Aware RBAC + Staff Experience
 *
 * Pure functions only. No React. No side-effects.
 * Each business config carries a `roleConfig.suggestedRoles` array that
 * maps system roles (manager / cashier / accountant / viewer) to
 * business-specific job titles so the Team page can show context-aware
 * quick-setup cards.
 */

const DEFAULTS = {
  suggestedRoles: [],
};

/** Returns the merged roleConfig (business overrides + safe defaults). */
export function getRoleConfig(businessConfig) {
  const rc = businessConfig?.roleConfig ?? {};
  return { ...DEFAULTS, ...rc };
}

/**
 * Returns the suggestedRoles array for a given business config.
 * Each entry: { role, businessLabel, emoji, description }
 *   role          — system role name (manager / cashier / accountant / viewer)
 *   businessLabel — how this role is referred to in this business (e.g. "Pharmacist")
 *   emoji         — icon for the card
 *   description   — one-line description of what this person does
 */
export function getSuggestedRoles(businessConfig) {
  return businessConfig?.roleConfig?.suggestedRoles ?? [];
}

/**
 * Returns true if the given userRole is allowed to transition to the target stage.
 * If the stage has no allowedRoles (or it's empty), everyone is allowed (backward compatible).
 */
export function canTransitionToStage(targetStageId, wfcStages, userRole) {
  if (!targetStageId || !wfcStages) return true;
  const stage = wfcStages.find(s => s.id === targetStageId);
  if (!stage) return true;
  if (!stage.allowedRoles || stage.allowedRoles.length === 0) return true;
  return stage.allowedRoles.includes(userRole) || stage.allowedRoles.includes('*');
}
