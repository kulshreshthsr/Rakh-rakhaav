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
      <Link href="/udhaar" className="landing-udhaar-float" aria-label="उधार page खोलें">
        <span className="landing-udhaar-float-kicker">Quick Access</span>
        <strong>उधार</strong>
      </Link>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker">Blue business workspace for modern Indian dukaan teams</div>
          <h1>Rakhrakhaav को use करके stock से invoice तक पूरा काम simple और professional दिखता है.</h1>
          <p>
            Products, GST billing, purchases, उधार और reports को एक mobile-friendly workspace में manage करिए
            jo real market use ke liye bana hai.
          </p>

          <div className="landing-cta-row">
            <Link href="/register" className="landing-btn landing-btn-primary">Free trial शुरू करें</Link>
            <Link href="/login" className="landing-btn landing-btn-secondary">Login करें</Link>
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
                <div className="landing-dashboard-badge">आज का business pulse</div>
                <div className="landing-dashboard-title">Live दुकान workspace</div>
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
                <span>उधार follow-up</span>
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
                <span>उधार</span>
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
          <span>Register करने के बाद आप direct business workspace में रहते हैं, बार बार auth page पर नहीं जाते.</span>
        </div>
      </section>
    </div>
  );
}
