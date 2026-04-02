'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const HIGHLIGHTS = [
  {
    title: 'Fast GST billing',
    copy: 'Create professional invoices, print instantly, and keep tax-ready records without extra clutter.',
  },
  {
    title: 'Inventory that stays clear',
    copy: 'Track stock, purchases, and product movement in one place built for daily retail work.',
  },
  {
    title: 'Udhaar and reports together',
    copy: 'Follow customer dues, supplier balances, and business reports from the same focused workspace.',
  },
];

const TRUST_POINTS = [
  'Made for Indian retail workflows',
  'Free trial to start quickly',
  'Mobile-first business control',
  'Billing, GST, stock, and reports in one app',
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
          <div className="landing-kicker">Retail operating system for growing Indian businesses</div>
          <h1>Rakhrakhaav makes your business look professional from stock room to invoice.</h1>
          <p>
            Manage products, GST billing, purchases, udhaar, and business reports in one clean workspace designed for
            real market use.
          </p>

          <div className="landing-cta-row">
            <Link href="/register" className="landing-btn landing-btn-primary">Start free trial</Link>
            <Link href="/login" className="landing-btn landing-btn-secondary">Sign in</Link>
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
                <div className="landing-dashboard-badge">Today&apos;s business pulse</div>
                <div className="landing-dashboard-title">Live business workspace</div>
              </div>
              <div className="landing-live-pill">Active</div>
            </div>

            <div className="landing-metric-grid">
              <article className="landing-metric-card">
                <span>Invoices</span>
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
              <div className="landing-flow-heading">Everything connected</div>
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
          <h2>Built for speed, trust, and everyday business clarity</h2>
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
          <span>Sharper invoices, cleaner records, and a more serious customer-facing experience.</span>
        </div>
        <div>
          <strong>Stay logged in</strong>
          <span>Once you register, you stay inside your business workspace instead of bouncing back to auth pages.</span>
        </div>
      </section>
    </div>
  );
}
