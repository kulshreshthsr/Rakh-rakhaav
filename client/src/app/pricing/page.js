'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import UpgradeModal from '../../components/subscription/UpgradeModal';
import { API, FALLBACK_PLANS, formatCurrency, getToken, readStoredSubscription, writeStoredSubscription } from '../../lib/subscription';

const PLAN_STYLES = {
  monthly: {
    toneClass: 'pricing-plan-card-starter',
    badge: null,
  },
  six_month: {
    toneClass: 'pricing-plan-card-growth',
    badge: 'Most Chosen',
  },
  yearly: {
    toneClass: 'pricing-plan-card-business',
    badge: 'Best Savings',
  },
};

const COMPARISON_ROWS = [
  ['Premium billing', true, true, true],
  ['GST reports', true, true, true],
  ['Inventory & purchases', true, true, true],
  ['Lower effective monthly cost', false, true, true],
];

const getEffectiveMonthly = (plan) => {
  const months = plan.id === 'yearly' ? 12 : plan.id === 'six_month' ? 6 : 1;
  return Math.round((plan.amount || 0) / months);
};

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState(() => readStoredSubscription());
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('monthly');
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
          nextPlans.some((plan) => plan.id === currentPlan) ? currentPlan : (nextPlans[0]?.id || 'monthly')
        ));
      })
      .catch(() => {});
  }, []);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) || plans[0] || FALLBACK_PLANS[0],
    [plans, selectedPlan]
  );

  return (
    <div className="pricing-page-shell pricing-compact-shell">
      <section className="pricing-hero-card">
        <div className="pricing-hero-tag">Choose your plan</div>
        <h1 className="pricing-hero-title">Select the perfect plan for your business</h1>
        <p className="pricing-hero-subtitle">Flexible billing options designed for growing Indian retailers</p>
      </section>

      <section className="pricing-plan-stack">
        {plans.map((plan, index) => {
          const planStyle = PLAN_STYLES[plan.id] || PLAN_STYLES.monthly;
          const effective = getEffectiveMonthly(plan);
          const isSelected = selectedPlan === plan.id;
          const badge = plan.badge || planStyle.badge;

          return (
            <article
              key={plan.id}
              className={`pricing-plan-card ${planStyle.toneClass}${isSelected ? ' is-selected' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {badge ? (
                <div className={`pricing-plan-badge${plan.id === 'yearly' ? ' is-dark' : ''}`}>
                  {badge}
                </div>
              ) : null}

              <div className="pricing-plan-name">{plan.label}</div>
              <div className="pricing-plan-price">{formatCurrency(plan.amount)}</div>
              <div className="pricing-plan-effective">{formatCurrency(effective)}/month effective</div>
              <div className="pricing-plan-description">{plan.description}</div>
              {plan.savingsLabel ? <div className="pricing-plan-saving">{plan.savingsLabel}</div> : <div className="pricing-plan-saving is-empty" />}

              {isSelected ? (
                <div className="pricing-plan-selected">Selected for checkout</div>
              ) : (
                <button type="button" className="pricing-select-button" onClick={() => setSelectedPlan(plan.id)}>
                  Select plan
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="pricing-compare-card">
        <div className="pricing-compare-title">Plan comparison</div>
        <div className="pricing-compare-grid">
          {COMPARISON_ROWS.map(([label, monthly, sixMonth, yearly]) => (
            <div key={label} className="pricing-compare-row">
              <span>{label}</span>
              <span>{monthly ? '✓' : '-'}</span>
              <span>{sixMonth ? '✓' : '-'}</span>
              <span>{yearly ? '✓' : '-'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-payment-card">
        <div className="pricing-payment-label">Payment</div>
        <div className="pricing-payment-name">{selected?.label || 'Premium membership'}</div>
        <div className="pricing-payment-price">{formatCurrency(selected?.amount || 0)}</div>
        <div className="pricing-payment-note">
          <span aria-hidden="true">i</span>
          <span>Billed once</span>
        </div>

        {isLoggedIn ? (
          <button type="button" className="pricing-payment-button" onClick={() => setShowUpgradeModal(true)}>
            Proceed to checkout
          </button>
        ) : (
          <Link href="/register" className="pricing-payment-button pricing-payment-link">
            Unlock now
          </Link>
        )}
      </section>

      <div className="membership-mobile-bar pricing-mobile-bar">
        <div className="membership-mobile-bar-copy">
          <strong>{selected?.label || 'Premium membership'}</strong>
          <span>{formatCurrency(selected?.amount || 0)}</span>
        </div>
        {isLoggedIn ? (
          <button type="button" className="btn-primary membership-mobile-button" onClick={() => setShowUpgradeModal(true)}>
            Proceed to checkout
          </button>
        ) : (
          <Link href="/register" className="btn-primary membership-mobile-button" style={{ textDecoration: 'none' }}>
            Unlock now
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
