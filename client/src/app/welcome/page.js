'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { hasWelcomePending, markTrialGateSeen, readStoredSubscription, setWelcomePending } from '../../lib/subscription';

const featureCards = [
  {
    title: 'Fast billing',
    copy: 'Mobile se jaldi invoice banao, bill print karo aur share karo.',
  },
  {
    title: 'GST ready',
    copy: 'Tax data, reports aur exports ko bina extra tension ke ready rakho.',
  },
  {
    title: 'Inventory + udhaar',
    copy: 'Stock, purchases aur customer dues ko ek clean workspace se track karo.',
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
          <h1>Yeh aapka naya blue business workspace hai jo har screen par professional feel deta hai.</h1>
          <p>
            Is experience ko aise design kiya gaya hai ki pehli screen se final bill tak aapka business zyada clear,
            reliable aur modern lage.
          </p>

          <div className="trial-gate-chip-row">
            <span>7-day free trial</span>
            <span>Blue premium theme</span>
            <span>Mobile-friendly flow</span>
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
            {subscription?.trialDaysLeft ? `${subscription.trialDaysLeft} din ready hain` : 'Trial ready to start'}
          </div>
          <p>
            Dashboard kholo aur naya clean visual system explore karo, jo product ko modern bhi banata hai aur
            business credibility bhi maintain karta hai.
          </p>

          <div className="trust-mini-strip trust-mini-strip-dark">
            <span>Premium visuals</span>
            <span>Business credibility</span>
            <span>Cleaner hierarchy</span>
          </div>

          <button type="button" className="btn-primary trust-submit-btn" onClick={startTrial}>
            Free trial start karein
          </button>
        </aside>
      </div>
    </div>
  );
}
