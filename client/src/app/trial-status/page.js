'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API, getToken, markTrialGateSeen, readStoredSubscription, writeStoredSubscription } from '../../lib/subscription';

export default function TrialStatusPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState(() => readStoredSubscription());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    fetch(`${API}/api/auth/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const nextSubscription = data.subscription || null;
        setSubscription(nextSubscription);
        writeStoredSubscription(nextSubscription);
        if (nextSubscription?.isPro) {
          markTrialGateSeen();
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  const continueToApp = () => {
    markTrialGateSeen();
    router.push('/dashboard');
  };

  const title = subscription?.isReadOnly
    ? 'Your free trial has ended.'
    : `Your free trial ends in ${subscription?.trialDaysLeft || 0} day${subscription?.trialDaysLeft === 1 ? '' : 's'}.`;

  const subtitle = subscription?.isReadOnly
    ? 'Upgrade and continue using billing, GST reports, customer credit and daily workflows without interruption.'
    : 'Upgrade and continue using our services without interruption once the countdown ends.';
  const daysLeft = subscription?.trialDaysLeft || 0;

  return (
    <div className="trial-gate-root">
      <div className="trial-gate-shell grid-cols-1 max-w-[560px]">
        <section className="ui-card trial-status-card">
          <div className="trial-countdown-badge">
            {subscription?.isReadOnly ? 'Trial ended' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
          </div>
          <div>
            <h1 className="trial-gate-side-title">{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="trial-benefit-list">
            <div className="trial-benefit-row">
              <span className="trial-benefit-check">✓</span>
              <span>Continue billing and invoicing without interruption</span>
            </div>
            <div className="trial-benefit-row">
              <span className="trial-benefit-check">✓</span>
              <span>Keep GST exports and purchase records ready for filing</span>
            </div>
            <div className="trial-benefit-row">
              <span className="trial-benefit-check">✓</span>
              <span>Stay on top of udhaar, customers, and daily cash flow</span>
            </div>
          </div>

          <div className="trial-gate-action-stack">
            <button type="button" className="btn-primary" onClick={() => router.push('/pricing')}>
              View subscription plans
            </button>
            <button type="button" className="btn-ghost" onClick={continueToApp}>
              Continue to Rakhrakhaav
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
