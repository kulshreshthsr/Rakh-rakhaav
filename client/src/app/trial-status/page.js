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
    ? 'Aapka free trial khatam ho gaya hai.'
    : `Aapka free trial ${subscription?.trialDaysLeft || 0} day${subscription?.trialDaysLeft === 1 ? '' : 's'} mein end hoga.`;

  const subtitle = subscription?.isReadOnly
    ? 'Upgrade karke billing, GST reports, customer credit aur daily workflows ko bina rukawat continue rakhiye.'
    : 'Countdown khatam hone ke baad bhi bina interruption service continue rakhne ke liye upgrade kariye.';
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
              <span>Billing aur invoicing bina interruption continue rakhiye</span>
            </div>
            <div className="trial-benefit-row">
              <span className="trial-benefit-check">✓</span>
              <span>GST exports aur purchase records filing ke liye ready rakhiye</span>
            </div>
            <div className="trial-benefit-row">
              <span className="trial-benefit-check">✓</span>
              <span>Udhaar, customers aur daily cash flow par control rakhiye</span>
            </div>
          </div>

          <div className="trial-gate-action-stack">
            <button type="button" className="btn-primary" onClick={() => router.push('/pricing')}>
              Plans dekhein
            </button>
            <button type="button" className="btn-ghost" onClick={continueToApp}>
              App mein continue karein
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
