'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { hasWelcomePending, markTrialGateSeen, readStoredSubscription, setWelcomePending } from '../../lib/subscription';

const featureCards = [
  {
    title: 'Fast billing',
    copy: 'Create invoices, print bills and share them quickly from mobile.',
  },
  {
    title: 'GST ready',
    copy: 'Keep tax data, reports and exports prepared without extra effort.',
  },
  {
    title: 'Inventory + udhaar',
    copy: 'Track stock, purchases and customer dues from one clean workspace.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const subscription = useMemo(() => readStoredSubscription(), []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (!hasWelcomePending()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const startTrial = () => {
    setWelcomePending(false);
    markTrialGateSeen();
    router.push('/dashboard');
  };

  return (
    <div className="trial-gate-root welcome-gate-root">
      <div className="trial-gate-shell">
        <section className="trial-gate-hero">
          <div className="subscription-pill">Welcome to Rakhrakhaav</div>
          <h1>Everything your shop needs, ready from day one.</h1>
          <p>
            Billing, GST, stock, udhaar and reports are already part of your workspace. Start your free trial and
            move into the dashboard with a cleaner, premium-first onboarding.
          </p>

          <div className="trial-gate-chip-row">
            <span>5-day free trial</span>
            <span>Mobile-friendly dashboard</span>
            <span>Secure upgrades via Razorpay</span>
          </div>

          <div className="trial-gate-feature-grid">
            {featureCards.map((item) => (
              <article key={item.title} className="trial-gate-feature-card">
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="trial-gate-sidecard">
          <div className="trial-gate-side-kicker">Trial access</div>
          <div className="trial-gate-side-title">
            {subscription?.trialDaysLeft ? `${subscription.trialDaysLeft} days ready for you` : 'Trial ready to start'}
          </div>
          <p>
            Walk through the dashboard first, and upgrade later from the shining top tab whenever you are ready.
          </p>

          <button type="button" className="btn-primary" onClick={startTrial}>
            Start your free trial
          </button>
        </aside>
      </div>
    </div>
  );
}
