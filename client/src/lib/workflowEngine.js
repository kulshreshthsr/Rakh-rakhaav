/**
 * Workflow Engine — Patch 5: True Dynamic Business Workflow Engine
 *
 * Pure functions only. No React. No side-effects.
 * The workflow config lives in each business config under `workflowConfig`.
 * The current workflow stage is stored in sale.extra_fields.workflow_status.
 */

export function getWorkflowConfig(config = {}) {
  return config.workflowConfig?.enabled ? config.workflowConfig : null;
}

export function isWorkflowEnabled(config = {}) {
  return Boolean(config.workflowConfig?.enabled);
}

export function getStages(wfc) {
  return wfc?.stages || [];
}

export function getStageById(wfc, stageId) {
  return (wfc?.stages || []).find(s => s.id === stageId) || null;
}

export function getInitialStage(wfc) {
  return wfc?.initialStage || wfc?.stages?.[0]?.id || 'pending';
}

/** Read workflow_status from extra_fields (handles both Map and plain object). */
export function getSaleWorkflowStatus(sale, wfc) {
  if (!wfc) return null;
  const ef = sale?.extra_fields;
  const stored = ef instanceof Map ? ef.get('workflow_status') : ef?.workflow_status;
  return stored || getInitialStage(wfc);
}

export function getAllowedActions(wfc, currentStageId) {
  return wfc?.actions?.[currentStageId] || [];
}

/**
 * Like getAllowedActions but filtered by the current user's role.
 * Actions with no `allowedRoles` field (or an empty array) are visible to everyone.
 * Pass userRole = null / undefined to skip role filtering (e.g. for owners).
 */
export function getAvailableWorkflowActions(wfc, currentStageId, userRole) {
  const allActions = getAllowedActions(wfc, currentStageId);
  if (!userRole) return allActions;
  return allActions.filter(action => {
    if (!action.allowedRoles || action.allowedRoles.length === 0) return true;
    return action.allowedRoles.includes(userRole) || action.allowedRoles.includes('*');
  });
}

export function getNextStages(wfc, currentStageId) {
  return (wfc?.transitions?.[currentStageId] || [])
    .map(id => getStageById(wfc, id))
    .filter(Boolean);
}

export function getDashboardWidgets(wfc) {
  return wfc?.dashboardWidgets || [];
}

export function getQuickActions(wfc) {
  return wfc?.quickActions || [];
}

// ─── Color mapping ────────────────────────────────────────────────────────────

const COLOR_MAP = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200',  dot: 'bg-amber-500',  btn: 'bg-amber-500 hover:bg-amber-600'   },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-500', btn: 'bg-orange-500 hover:bg-orange-600'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-500',   btn: 'bg-blue-500 hover:bg-blue-600'    },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200',  dot: 'bg-green-500',  btn: 'bg-green-500 hover:bg-green-600'   },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200',    dot: 'bg-red-500',    btn: 'bg-red-500 hover:bg-red-600'      },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500', btn: 'bg-purple-500 hover:bg-purple-600'  },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-200',   dot: 'bg-pink-500',   btn: 'bg-pink-500 hover:bg-pink-600'    },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-200',   dot: 'bg-cyan-500',   btn: 'bg-cyan-500 hover:bg-cyan-600'    },
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200',  dot: 'bg-slate-400',  btn: 'bg-slate-500 hover:bg-slate-600'   },
};

export function getStageColors(stage) {
  return COLOR_MAP[stage?.color] || COLOR_MAP.slate;
}
