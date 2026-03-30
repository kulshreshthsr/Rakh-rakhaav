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
    <div className="trial-gate-root welcome-gate-root trust-welcome-root">
      <div className="trial-gate-shell trust-welcome-shell">
        <section className="trial-gate-hero trust-welcome-hero">
          <div className="subscription-pill">Welcome to Rakhrakhaav</div>
          <h1>प्रीमियम अनुभव / A premium business cockpit your customers will feel in every interaction.</h1>
          <p>
            This experience is built to make your business feel more serious, more reliable, and more modern from the
            first screen to the final bill.
          </p>

          <div className="trial-gate-chip-row">
            <span>5-day free trial</span>
            <span>Sharper premium theme</span>
            <span>Razorpay-ready upgrades</span>
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

        <aside className="trial-gate-sidecard trust-welcome-sidecard">
          <div className="trial-gate-side-kicker">Trial access</div>
          <div className="trial-gate-side-title">
            {subscription?.trialDaysLeft ? `${subscription.trialDaysLeft} days ready for you` : 'Trial ready to start'}
          </div>
          <p>
            Enter the dashboard and explore the new trust-focused visual system, built to make the product feel bold
            without losing credibility.
          </p>

          <div className="trust-mini-strip trust-mini-strip-dark">
            <span>Premium visuals</span>
            <span>Business credibility</span>
            <span>Cleaner hierarchy</span>
          </div>

          <button type="button" className="btn-primary trust-submit-btn" onClick={startTrial}>
            Start your free trial
          </button>
        </aside>
      </div>
    </div>
  );
}
