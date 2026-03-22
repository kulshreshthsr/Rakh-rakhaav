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

  return (
    <div className="trial-gate-root">
      <div className="trial-gate-shell">
        <section className="trial-gate-hero">
          <div className="subscription-pill">{subscription?.isReadOnly ? 'Trial ended' : 'Trial countdown'}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>

          <div className="trial-gate-chip-row">
            <span>Billing + invoicing</span>
            <span>GST reports and exports</span>
            <span>Udhaar and customer records</span>
          </div>
        </section>

        <aside className="trial-gate-sidecard">
          <div className="trial-gate-side-kicker">Keep going</div>
          <div className="trial-gate-side-title">
            {subscription?.isReadOnly ? 'Reactivate premium access' : 'Upgrade and stay uninterrupted'}
          </div>
          <p>
            {subscription?.isReadOnly
              ? 'Your data is safe. Upgrade whenever you are ready, or continue to view your workspace.'
              : 'You can keep using Rakhrakhaav now and upgrade later from the top upgrade tab.'}
          </p>

          <div className="trial-gate-action-stack">
            <button type="button" className="btn-primary" onClick={() => router.push('/pricing')}>
              View subscription plans
            </button>
            <button type="button" className="btn-ghost" onClick={continueToApp}>
              Continue to Rakhrakhaav
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
