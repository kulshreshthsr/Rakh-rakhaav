'use client';
import { useState } from 'react';
import {
  getStageById,
  getSaleWorkflowStatus,
  getAllowedActions,
  getStageColors,
} from '../lib/workflowEngine';

/**
 * WorkflowStatusBadge
 *
 * Renders the current workflow stage badge for a sale and shows one-tap
 * action buttons that advance the stage (e.g. "Send to Kitchen", "Mark Ready").
 *
 * Props:
 *   sale      — the sale object (extra_fields.workflow_status is read)
 *   wfc       — the workflowConfig object from the business config
 *   onAdvance — async (saleId, nextStage, action) => void
 *   disabled  — boolean (hide action buttons, e.g. for offline sales)
 */
export default function WorkflowStatusBadge({ sale, wfc, onAdvance, disabled = false }) {
  const [advancing, setAdvancing] = useState(false);

  if (!wfc || !sale) return null;

  const currentStatus = getSaleWorkflowStatus(sale, wfc);
  const currentStage  = getStageById(wfc, currentStatus);
  if (!currentStage) return null;

  const colors  = getStageColors(currentStage);
  const actions = getAllowedActions(wfc, currentStatus);

  const handleAction = async (action) => {
    if (advancing || disabled) return;
    setAdvancing(true);
    try { await onAdvance(sale._id, action.nextStage, action); }
    finally { setAdvancing(false); }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── Current stage badge ── */}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${colors.bg} ${colors.text} ${colors.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot} ${!currentStage.terminal ? 'animate-pulse' : ''}`} />
        <span>{currentStage.icon} {currentStage.label}</span>
      </span>

      {/* ── Action buttons (hidden for terminal stages) ── */}
      {!currentStage.terminal && !disabled && actions.map(action => {
        const nextStage  = getStageById(wfc, action.nextStage);
        const nextColors = getStageColors(nextStage);
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action)}
            disabled={advancing}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-white transition-all disabled:opacity-50 active:scale-95 ${nextColors.btn}`}
          >
            {advancing ? '…' : `${action.icon} ${action.label}`}
          </button>
        );
      })}
    </div>
  );
}
