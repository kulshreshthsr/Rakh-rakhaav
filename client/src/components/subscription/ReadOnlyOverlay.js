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
        <div className="subscription-pill">Trial ended</div>
        <h2>Your trial has ended</h2>
        <p>Subscribe to continue using the platform with billing, GST exports, reports, udhaar and premium workflows.</p>

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

        <div className="subscription-trust-row" style={{ marginTop: 18 }}>
          <span>Secure payment via Razorpay</span>
          <span>No hidden charges</span>
          <span>Cancel anytime</span>
          <span>Used by growing businesses</span>
        </div>

        <div className="read-only-actions">
          <button type="button" className="btn-primary" onClick={onUpgrade} disabled={loading}>
            {loading ? 'Preparing upgrade...' : 'Upgrade Now'}
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
