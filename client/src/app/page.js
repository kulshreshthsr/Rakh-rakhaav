'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const HIGHLIGHTS = [
  {
    title: 'Fast billing, simple flow',
    copy: 'Jaldi bill banao, print karo, aur GST-ready records ek clean screen mein rakho.',
  },
  {
    title: 'Stock always visible',
    copy: 'Stock, purchases aur product movement ko ek hi jagah clear tareeke se dekho.',
  },
  {
    title: 'Udhaar plus reports',
    copy: 'Customer dues, supplier balance aur reports ko ek hi business workspace se handle karo.',
  },
];

const TRUST_POINTS = [
  'Indian dukaan workflow ke liye',
  'Start karne ke liye free trial',
  'Mobile-first business control',
  'Billing, GST, stock aur reports ek app mein',
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  return (
    <div className="landing-root">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker">Blue business workspace for modern Indian dukaan teams</div>
          <h1>Rakhrakhaav ko use karke stock se invoice tak poora kaam simple aur professional dikhta hai.</h1>
          <p>
            Products, GST billing, purchases, udhaar aur reports ko ek mobile-friendly workspace mein manage kariye
            jo real market use ke liye bana hai.
          </p>

          <div className="landing-cta-row">
            <Link href="/register" className="landing-btn landing-btn-primary">Free trial shuru karein</Link>
            <Link href="/login" className="landing-btn landing-btn-secondary">Login karein</Link>
          </div>

          <div className="landing-trust-row">
            {TRUST_POINTS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="landing-hero-panel">
          <div className="landing-panel-glow" />
          <div className="landing-dashboard-card">
            <div className="landing-dashboard-top">
              <div>
                <div className="landing-dashboard-badge">Aaj ka business pulse</div>
                <div className="landing-dashboard-title">Live dukaan workspace</div>
              </div>
              <div className="landing-live-pill">Live</div>
            </div>

            <div className="landing-metric-grid">
              <article className="landing-metric-card">
                <span>Bills</span>
                <strong>128</strong>
                <small>Fast billing flow</small>
              </article>
              <article className="landing-metric-card">
                <span>Stock items</span>
                <strong>1,240</strong>
                <small>Clear product tracking</small>
              </article>
              <article className="landing-metric-card">
                <span>GST ready</span>
                <strong>100%</strong>
                <small>Reports and exports</small>
              </article>
              <article className="landing-metric-card">
                <span>Udhaar follow-up</span>
                <strong>24</strong>
                <small>Customer dues visible</small>
              </article>
            </div>

            <div className="landing-flow-card">
              <div className="landing-flow-heading">Sab kuch connected</div>
              <div className="landing-flow-steps">
                <span>Product</span>
                <span>Purchase</span>
                <span>Sales</span>
                <span>GST</span>
                <span>Udhaar</span>
                <span>Reports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-feature-section">
        <div className="landing-section-head">
          <div className="landing-kicker">Why shops choose it</div>
          <h2>Roz ke kaam ke liye fast, clear aur bharosemand business system</h2>
        </div>

        <div className="landing-feature-grid">
          {HIGHLIGHTS.map((item) => (
            <article key={item.title} className="landing-feature-card">
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-proof-strip">
        <div>
          <strong>Professional feel</strong>
          <span>Saaf invoices, better records aur customer-facing experience jo zyada strong lage.</span>
        </div>
        <div>
          <strong>Stay logged in</strong>
          <span>Register karne ke baad aap direct business workspace mein rehte hain, baar baar auth page par nahi jaate.</span>
        </div>
      </section>
    </div>
  );
}
