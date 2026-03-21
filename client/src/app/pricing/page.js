'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlanCard from '../../components/subscription/PlanCard';
import UpgradeModal from '../../components/subscription/UpgradeModal';
import { API, FALLBACK_PLANS, getToken } from '../../lib/subscription';

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('six_month');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(Boolean(token));

    if (!token) return;

    fetch(`${API}/api/auth/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setPlans(data.plans?.length ? data.plans : FALLBACK_PLANS);
        setSubscription(data.subscription || null);
        setRazorpayKeyId(data.razorpayKeyId || '');
      })
      .catch(() => {});
  }, []);

  return (
    <div className="pricing-page-shell">
      <div className="pricing-hero">
        <div className="subscription-pill">Premium plans</div>
        <h1>Choose a plan that keeps your business fully active.</h1>
        <p>
          Unlock GST exports, invoice printing, reports, WhatsApp workflows and customer credit tools
          with a simple premium subscription built for growing businesses.
        </p>

        <div className="pricing-trust-strip">
          <span>Used by growing businesses</span>
          <span>Secure payment via Razorpay</span>
          <span>No hidden charges</span>
          <span>Cancel anytime</span>
        </div>
      </div>

      <div className="subscription-plan-grid" style={{ marginTop: 0 }}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selectedPlan === plan.id}
            onSelect={setSelectedPlan}
          />
        ))}
      </div>

      <div className="subscription-modal-actions" style={{ marginTop: 24 }}>
        {isLoggedIn ? (
          <button type="button" className="btn-primary" onClick={() => setShowUpgradeModal(true)}>
            Upgrade Now
          </button>
        ) : (
          <>
            <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', width: 'auto' }}>
              Start free trial
            </Link>
            <Link href="/login" className="btn-ghost" style={{ textDecoration: 'none', width: 'auto' }}>
              Sign in
            </Link>
          </>
        )}
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        plans={plans}
        subscription={subscription}
        razorpayKeyId={razorpayKeyId}
        initialPlan={selectedPlan}
        onSuccess={(nextSubscription) => {
          setSubscription(nextSubscription || null);
          setShowUpgradeModal(false);
        }}
      />
    </div>
  );
}
