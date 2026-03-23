'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlanCard from '../../components/subscription/PlanCard';
import UpgradeModal from '../../components/subscription/UpgradeModal';
import { API, FALLBACK_PLANS, formatCurrency, getToken, readStoredSubscription, writeStoredSubscription } from '../../lib/subscription';

const MEMBERSHIP_FEATURES = [
  'Unlimited billing and invoice printing',
  'GST reports and exports ready anytime',
  'Customer credit and collection workflows',
  'WhatsApp sharing and daily business reporting',
];

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState(() => readStoredSubscription());
  const [previewSubscription, setPreviewSubscription] = useState(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('six_month');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoggedIn] = useState(() => Boolean(getToken()));
  const activeSubscription = previewSubscription || subscription;

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

  const membershipHeadline = activeSubscription?.isPro
    ? 'Your premium access is active.'
    : activeSubscription?.isReadOnly
      ? 'Reactivate premium and unlock your full workspace again.'
      : 'Keep your business workflows active before the trial ends.';

  const membershipSubline = activeSubscription?.isPro
    ? 'You already have full access. You can still switch to a longer plan for better savings.'
    : activeSubscription?.isReadOnly
      ? 'Your data is safe. Upgrade to resume billing, GST exports, reports and credit actions.'
      : activeSubscription?.trialDaysLeft
        ? `Free trial has ${activeSubscription.trialDaysLeft} day${activeSubscription.trialDaysLeft === 1 ? '' : 's'} left.`
        : 'Choose a plan once and continue billing, GST and reports without interruption.';

  const handlePreviewMonthlyState = () => {
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    setPreviewSubscription({
      isPro: true,
      subscriptionType: 'monthly',
      trialStartDate: activeSubscription?.trialStartDate || null,
      trialEndDate: activeSubscription?.trialEndDate || null,
      subscriptionPlan: 'monthly',
      subscriptionStartDate: start.toISOString(),
      subscriptionEndDate: end.toISOString(),
      paymentStatus: 'paid',
      isTrialActive: false,
      isTrialExpired: true,
      trialDaysLeft: 0,
      shouldWarnTrial: false,
      isSubscriptionActive: true,
      hasFullAccess: true,
      isReadOnly: false,
    });
  };

  const resetPreviewMonthlyState = () => {
    setPreviewSubscription(null);
  };

  return (
    <div className="pricing-page-shell membership-page-shell">
      <section className="pricing-hero membership-hero">
        <div className="subscription-pill">Premium access</div>
        <h1>Make premium impossible to miss.</h1>
        <p>
          Billing, GST, udhaar, reports and daily operations should feel worth paying for. This membership page now
          makes the value obvious and keeps upgrade actions within thumb reach on mobile.
        </p>

        <div className="membership-hero-grid">
          <div className="membership-spotlight-card">
            <div className="membership-status-kicker">Business membership</div>
            <h2>{membershipHeadline}</h2>
            <p>{membershipSubline}</p>

            <div className="membership-feature-list">
              {MEMBERSHIP_FEATURES.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>

            <div className="membership-metrics-row">
              <div>
                <strong>5-day</strong>
                <span>free trial</span>
              </div>
              <div>
                <strong>24x7</strong>
                <span>secure checkout</span>
              </div>
              <div>
                <strong>{selected ? formatCurrency(selected.amount) : formatCurrency(449)}</strong>
                <span>selected today</span>
              </div>
            </div>
          </div>

          <div className="membership-summary-card">
            <div className="membership-summary-label">Selected membership</div>
            <div className="membership-summary-plan">{selected?.label || 'Choose a plan'}</div>
            <div className="membership-summary-price">{formatCurrency(selected?.amount || 0)}</div>
            <div className="membership-summary-copy">
              {selected?.description || 'Choose the plan that fits your workflow.'}
            </div>
            {selected?.savingsLabel && <div className="membership-summary-saving">{selected.savingsLabel}</div>}

            <div className="pricing-trust-strip membership-trust-strip">
              <span>Secure payment via Razorpay</span>
              <span>No hidden charges</span>
              <span>Mobile-first checkout</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="membership-plan-section">
        <div className="membership-section-head">
          <div>
            <div className="membership-status-kicker">Choose what fits</div>
            <h2>Pick a plan and upgrade without hunting for buttons.</h2>
          </div>
          <div className="membership-section-note">The selected plan stays pinned at the bottom on mobile.</div>
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
      </section>

      <section className="membership-bottom-panel">
        <div className="membership-bottom-copy">
          <div className="membership-summary-label">Ready to unlock</div>
          <div className="membership-bottom-title">{selected?.label || 'Premium membership'}</div>
          <div className="membership-bottom-subtitle">
            {selected?.savingsLabel || 'All premium workflows unlock instantly after successful payment.'}
          </div>
        </div>

        <div className="membership-bottom-actions">
          {isLoggedIn ? (
            <>
              <button type="button" className="btn-primary membership-upgrade-button" onClick={() => setShowUpgradeModal(true)}>
                Unlock {selected?.label || 'Premium'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={previewSubscription ? resetPreviewMonthlyState : handlePreviewMonthlyState}
              >
                {previewSubscription ? 'Reset preview' : 'Preview Monthly State'}
              </button>
            </>
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
        subscription={activeSubscription}
        razorpayKeyId={razorpayKeyId}
        initialPlan={selectedPlan}
        onSuccess={(nextSubscription) => {
          setSubscription(nextSubscription || null);
          writeStoredSubscription(nextSubscription || null);
          setPreviewSubscription(null);
          setShowUpgradeModal(false);
        }}
      />
    </div>
  );
}
