'use client';

import PlanCard from './PlanCard';
import { FALLBACK_PLANS } from '../../lib/subscription';

export default function ReadOnlyOverlay({
  visible,
  plans = FALLBACK_PLANS,
  selectedPlan,
  onSelectPlan,
  onUpgrade,
  onLogout,
  loading,
}) {
  if (!visible) return null;

  return (
    <div className="read-only-overlay">
      <div className="read-only-card">
        <div className="read-only-header">
          <div className="subscription-pill">Trial ended</div>
          <h2>Your trial has ended</h2>
          <p>Choose a plan to continue, or log out for now.</p>
        </div>

        <div className="subscription-plan-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan === plan.id}
              onSelect={onSelectPlan}
              compact
            />
          ))}
        </div>

        <div className="subscription-trust-row mt-[18px]">
          <span>Secure payment via Razorpay</span>
          <span>Cancel anytime</span>
        </div>

        <div className="read-only-actions">
          <button type="button" className="btn-primary" onClick={onUpgrade} disabled={loading}>
            {loading ? 'Preparing upgrade...' : 'Upgrade Now'}
          </button>
          <button type="button" className="read-only-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
