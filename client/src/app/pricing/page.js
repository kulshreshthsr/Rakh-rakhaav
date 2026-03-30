'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlanCard from '../../components/subscription/PlanCard';
import UpgradeModal from '../../components/subscription/UpgradeModal';
import { API, FALLBACK_PLANS, formatCurrency, getToken, readStoredSubscription, writeStoredSubscription } from '../../lib/subscription';

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState(() => readStoredSubscription());
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('six_month');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoggedIn] = useState(() => Boolean(getToken()));

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${API}/api/auth/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const nextPlans = data.plans?.length ? data.plans : FALLBACK_PLANS;
        setPlans(nextPlans);
        setSubscription(data.subscription || null);
        writeStoredSubscription(data.subscription || null);
        setRazorpayKeyId(data.razorpayKeyId || '');
        setSelectedPlan((currentPlan) => (
          nextPlans.some((plan) => plan.id === currentPlan) ? currentPlan : (nextPlans[0]?.id || 'six_month')
        ));
      })
      .catch(() => {});
  }, []);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) || plans[0] || FALLBACK_PLANS[0],
    [plans, selectedPlan]
  );

  const membershipHeadline = subscription?.isPro
    ? 'Premium active'
    : subscription?.isReadOnly
      ? 'Reactivate premium'
      : 'Choose your plan';

  const membershipSubline = subscription?.isPro
    ? 'You can switch to a longer plan anytime.'
    : subscription?.isReadOnly
      ? 'Upgrade to unlock billing and reports again.'
      : subscription?.trialDaysLeft
        ? `${subscription.trialDaysLeft} trial day${subscription.trialDaysLeft === 1 ? '' : 's'} left.`
        : 'Simple plans. Secure payment.';

  return (
    <div className="pricing-page-shell membership-page-shell">
      <section className="card" style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="subscription-pill" style={{ background: 'rgba(8,17,31,0.06)', color: '#163654', borderColor: 'rgba(15,23,42,0.08)' }}>Premium access</div>
            <h1 className="page-title" style={{ marginTop: 14, marginBottom: 8 }}>{membershipHeadline}</h1>
            <p className="page-subtitle">{membershipSubline}</p>
          </div>

          <div className="soft-panel" style={{ padding: 16, minWidth: 240, maxWidth: 320 }}>
            <div className="membership-summary-label">Selected plan</div>
            <div className="membership-summary-plan" style={{ marginTop: 6 }}>{selected?.label || 'Choose a plan'}</div>
            <div className="membership-summary-price" style={{ marginTop: 10 }}>{formatCurrency(selected?.amount || 0)}</div>
            {selected?.savingsLabel && <div className="membership-summary-saving" style={{ marginTop: 10 }}>{selected.savingsLabel}</div>}
          </div>
        </div>

        <div className="subscription-plan-grid membership-plan-grid" style={{ marginTop: 0 }}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan === plan.id}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>

        <div className="soft-panel" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="membership-summary-label">Payment</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{selected?.label || 'Premium membership'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Secure Razorpay checkout. No extra steps.</div>
          </div>
          <div className="pricing-trust-strip membership-trust-strip" style={{ margin: 0 }}>
            <span>Secure payment</span>
            <span>No hidden charges</span>
            <span>Cancel anytime</span>
          </div>
        </div>

        <div className="membership-bottom-actions">
          {isLoggedIn ? (
            <button type="button" className="btn-primary membership-upgrade-button" onClick={() => setShowUpgradeModal(true)}>
              Unlock {selected?.label || 'Premium'}
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
      </section>

      <div className="membership-mobile-bar">
        <div className="membership-mobile-bar-copy">
          <strong>{selected?.label || 'Premium membership'}</strong>
          <span>{formatCurrency(selected?.amount || 0)}</span>
        </div>
        {isLoggedIn ? (
          <button type="button" className="btn-primary membership-mobile-button" onClick={() => setShowUpgradeModal(true)}>
            Unlock now
          </button>
        ) : (
          <Link href="/register" className="btn-primary membership-mobile-button" style={{ textDecoration: 'none' }}>
            Start trial
          </Link>
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
          writeStoredSubscription(nextSubscription || null);
          setShowUpgradeModal(false);
        }}
      />
    </div>
  );
}
