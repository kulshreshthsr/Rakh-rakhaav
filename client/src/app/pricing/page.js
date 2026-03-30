'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  const displayPlans = useMemo(() => plans.map((plan) => {
    if (plan.id === 'monthly') {
      return { ...plan, displayLabel: 'Monthly', monthlyEquivalent: null, badge: null };
    }
    if (plan.id === 'six_month') {
      return { ...plan, displayLabel: '6 Months', monthlyEquivalent: '₹417/mo', badge: 'Most Popular' };
    }
    if (plan.id === 'yearly') {
      return { ...plan, displayLabel: 'Yearly', monthlyEquivalent: '₹375/mo', badge: null };
    }
    return { ...plan, displayLabel: plan.label, monthlyEquivalent: null };
  }), [plans]);

  return (
    <div className="pricing-page-shell membership-page-shell">
      <section className="pricing-centered-shell">
        <div className="pricing-centered-hero">
          <div className="subscription-pill pricing-page-pill">Premium Access</div>
          <h1 className="pricing-main-headline">प्लान चुनें / Choose a plan that keeps your business fully active.</h1>
          <p className="pricing-main-subline">
            Billing, inventory, GST, reports, and support in one always-on plan for your shop.
          </p>
          <div className="pricing-trust-strip pricing-trust-strip--centered">
            <span>No hidden charges</span>
            <span>Cancel anytime</span>
            <span>Secure via Razorpay</span>
          </div>
        </div>

        <div className="pricing-plan-center-grid">
          {displayPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={`pricing-plan-center-card ${selectedPlan === plan.id ? 'is-selected' : ''} ${plan.id === 'six_month' ? 'is-popular' : ''}`}
            >
              <div className="pricing-plan-center-top">
                <div>
                  <div className="pricing-plan-center-name">{plan.displayLabel}</div>
                  <div className="pricing-plan-center-price">{formatCurrency(plan.amount)}</div>
                </div>
                {plan.badge ? <span className="pricing-plan-center-badge">{plan.badge}</span> : null}
              </div>
              {plan.monthlyEquivalent ? (
                <div className="pricing-plan-center-meta">{plan.monthlyEquivalent}</div>
              ) : (
                <div className="pricing-plan-center-meta">Full monthly access</div>
              )}
              {plan.savingsLabel ? <div className="pricing-plan-center-saving">{plan.savingsLabel}</div> : <div className="pricing-plan-center-saving is-empty">No lock-in savings</div>}
              {selectedPlan === plan.id ? <div className="pricing-plan-center-selected">Selected for checkout</div> : null}
            </button>
          ))}
        </div>

        <div className="pricing-selection-card">
          <div className="pricing-selection-label">Selected Plan</div>
          <div className="pricing-selection-plan">{selected?.id === 'monthly' ? 'Monthly' : selected?.id === 'six_month' ? '6 Months' : selected?.id === 'yearly' ? 'Yearly' : selected?.label}</div>
          <div className="pricing-selection-price">{formatCurrency(selected?.amount || 0)}</div>
        </div>
      </section>

      <div className="pricing-sticky-bar">
        <div className="pricing-sticky-copy">
          <strong>{selected?.id === 'monthly' ? 'Monthly' : selected?.id === 'six_month' ? '6 Months' : selected?.id === 'yearly' ? 'Yearly' : selected?.label}</strong>
          <span>{formatCurrency(selected?.amount || 0)}</span>
        </div>
        {isLoggedIn ? (
          <button type="button" className="btn-primary pricing-sticky-button" onClick={() => setShowUpgradeModal(true)}>
            Upgrade Now
          </button>
        ) : (
          <div className="pricing-sticky-actions">
            <Link href="/register" className="btn-primary pricing-sticky-button" style={{ textDecoration: 'none' }}>
              Upgrade Now
            </Link>
            <Link href="/login" className="btn-ghost" style={{ textDecoration: 'none', width: 'auto' }}>
              Sign in
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .pricing-centered-shell {
          max-width: 920px;
          margin: 0 auto;
          padding: 24px 0 140px;
          display: grid;
          gap: 24px;
        }
        .pricing-centered-hero {
          text-align: center;
          display: grid;
          gap: 14px;
          justify-items: center;
        }
        .pricing-page-pill {
          background: #6C63FF18;
          border-color: #6C63FF40;
          color: #6C63FF;
        }
        .pricing-main-headline {
          margin: 0;
          max-width: 720px;
          font-size: 38px;
          line-height: 1.08;
          font-weight: 700;
          color: #F0F0FF;
        }
        .pricing-main-subline {
          margin: 0;
          max-width: 620px;
          font-size: 14px;
          color: #8B8FA8;
        }
        .pricing-trust-strip--centered {
          justify-content: center;
          margin-top: 4px;
        }
        .pricing-trust-strip--centered span {
          background: #161929;
          border: 1px solid #FFFFFF0D;
          color: #8B8FA8;
        }
        .pricing-plan-center-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .pricing-plan-center-card {
          text-align: left;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid #FFFFFF0D;
          background: #161929;
          transition: all 0.2s ease;
        }
        .pricing-plan-center-card:hover,
        .pricing-plan-center-card.is-selected {
          border-color: #6C63FF40;
          background: #1E2235;
        }
        .pricing-plan-center-card.is-popular {
          border-color: #6C63FF;
        }
        .pricing-plan-center-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .pricing-plan-center-name {
          font-size: 15px;
          font-weight: 600;
          color: #F0F0FF;
        }
        .pricing-plan-center-price {
          margin-top: 10px;
          font-size: 28px;
          font-weight: 700;
          color: #F0F0FF;
        }
        .pricing-plan-center-badge {
          padding: 6px 10px;
          border-radius: 999px;
          background: #6C63FF18;
          border: 1px solid #6C63FF40;
          color: #6C63FF;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .pricing-plan-center-meta {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #8B8FA8;
        }
        .pricing-plan-center-saving {
          margin-top: 14px;
          font-size: 12px;
          color: #00C896;
          font-weight: 600;
        }
        .pricing-plan-center-saving.is-empty {
          color: #555870;
        }
        .pricing-plan-center-selected {
          margin-top: 14px;
          font-size: 12px;
          color: #6C63FF;
          font-weight: 600;
        }
        .pricing-selection-card {
          width: min(320px, 100%);
          margin: 0 auto;
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid #FFFFFF0D;
          background: #161929;
          text-align: center;
        }
        .pricing-selection-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #555870;
        }
        .pricing-selection-plan {
          margin-top: 8px;
          font-size: 20px;
          font-weight: 700;
          color: #F0F0FF;
        }
        .pricing-selection-price {
          margin-top: 8px;
          font-size: 28px;
          font-weight: 700;
          color: #6C63FF;
        }
        .pricing-sticky-bar {
          position: sticky;
          bottom: 12px;
          margin: 0 auto;
          max-width: 920px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(22, 25, 41, 0.95);
          border: 1px solid #FFFFFF0D;
          backdrop-filter: blur(14px);
        }
        .pricing-sticky-copy {
          display: grid;
          gap: 4px;
        }
        .pricing-sticky-copy strong {
          font-size: 15px;
          color: #F0F0FF;
        }
        .pricing-sticky-copy span {
          font-size: 13px;
          color: #8B8FA8;
        }
        .pricing-sticky-button {
          width: auto;
          min-width: 180px;
        }
        .pricing-sticky-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        @media (max-width: 900px) {
          .pricing-plan-center-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .pricing-main-headline {
            font-size: 28px;
          }
          .pricing-sticky-bar {
            bottom: 8px;
            flex-direction: column;
            align-items: stretch;
          }
          .pricing-sticky-button {
            width: 100%;
          }
          .pricing-sticky-actions {
            flex-direction: column;
          }
        }
      `}</style>

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
