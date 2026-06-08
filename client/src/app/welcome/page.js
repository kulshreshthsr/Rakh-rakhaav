'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasWelcomePending, markTrialGateSeen, setWelcomePending } from '../../lib/subscription';

const featureCards = [
  {
    title: 'Hardware & Electronics ERP',
    copy: 'Parts billing, serial tracking, warranty, contractor udhaar — ek hi jagah.',
  },
  {
    title: 'GST Trade Invoicing',
    copy: 'Challan, PO number, GSTIN — har invoice ek professional trade document.',
  },
  {
    title: 'Stock & Dealer Credit',
    copy: 'Item-wise stock alerts, IMEI tracking, aur B2B aging ek clean dashboard se.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
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
          <div className="subscription-pill">🔧 Hardware & Electronics ERP</div>
          <h1>आपका Hardware & Electronics ERP तैयार है।</h1>
          <p>
            Parts billing से लेकर serial tracking, contractor udhaar और GST returns तक — सब एक workspace में।
            Hardware और electronics की दुकान के लिए purpose-built।
          </p>

          <div className="trial-gate-chip-row">
            <span>7-day free trial</span>
            <span>GST trade invoicing</span>
            <span>Serial & warranty tracking</span>
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
            Dashboard खोलें
          </div>
          <p>
            पहला bill बनाएं, stock add करें, या dealer udhaar setup करें। Hardware & electronics ERP आपके साथ।
          </p>

          <div className="trust-mini-strip trust-mini-strip-dark">
            <span>Parts billing</span>
            <span>Contractor credit</span>
            <span>GST ready</span>
          </div>

          <button type="button" className="btn-primary trust-submit-btn" onClick={startTrial}>
            Dashboard खोलें →
          </button>
        </aside>
      </div>
    </div>
  );
}