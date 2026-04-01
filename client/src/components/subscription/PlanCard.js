'use client';

import { formatCurrency } from '../../lib/subscription';

export default function PlanCard({ plan, selected, onSelect, compact = false }) {
  const effectiveMonthlyPrice = plan.id === 'weekly'
    ? Math.round((plan.amount || 0) * (30 / 7))
    : Math.round((plan.amount || 0) / (plan.id === 'yearly' ? 12 : plan.id === 'six_month' ? 6 : 1));

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
          <div className="subscription-plan-meta">{formatCurrency(effectiveMonthlyPrice)}/month effective</div>
        </div>
        {plan.badge && <span className="subscription-plan-badge">{plan.badge}</span>}
      </div>
      <div className="subscription-plan-description">{plan.description}</div>
      {plan.savingsLabel && <div className="subscription-plan-saving">{plan.savingsLabel}</div>}
      {selected && <div className="subscription-plan-selected">Selected for checkout</div>}
    </button>
  );
}
