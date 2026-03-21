'use client';

import { formatCurrency } from '../../lib/subscription';

export default function PlanCard({ plan, selected, onSelect, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`subscription-plan-card${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`}
    >
      <div className="subscription-plan-top">
        <div>
          <div className="subscription-plan-name">{plan.label}</div>
          <div className="subscription-plan-price">{formatCurrency(plan.amount)}</div>
        </div>
        {plan.badge && <span className="subscription-plan-badge">{plan.badge}</span>}
      </div>
      <div className="subscription-plan-description">{plan.description}</div>
      {plan.savingsLabel && <div className="subscription-plan-saving">{plan.savingsLabel}</div>}
    </button>
  );
}
