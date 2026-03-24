'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTrialGateSeen,
  hasWelcomePending,
  markTrialGateSeen,
  readStoredSubscription,
  setWelcomePending,
  writeStoredSubscription,
} from '../../lib/subscription';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      if (hasWelcomePending()) {
        router.replace('/welcome');
        return;
      }

      const subscription = readStoredSubscription();
      if (subscription && !subscription.isPro) {
        router.replace('/trial-status');
        return;
      }

      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        writeStoredSubscription(data.user?.subscription || null);
        setWelcomePending(false);
        if (data.user?.subscription?.isPro) {
          markTrialGateSeen();
          router.push('/dashboard');
        } else {
          clearTrialGateSeen();
          router.push('/trial-status');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trust-auth-root">
      <div className="trust-auth-shell">
        <section className="trust-auth-showcase">
          <div className="trust-auth-kicker">Trusted retail operating system</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">Rakhrakhaav</div>
              <div className="trust-auth-brand-subtitle">Built for disciplined, modern shop management</div>
            </div>
          </div>

          <div className="trust-auth-copy">
            <h1>Bring authority to every bill, every stock count, and every customer ledger.</h1>
            <p>
              A sharper, more premium workspace for inventory, GST billing, purchases, and udhaar. Your first screen
              should feel like a business system people can trust instantly.
            </p>
          </div>

          <div className="trust-auth-proof-grid">
            <article className="trust-proof-card">
              <strong>GST-ready records</strong>
              <span>Invoices, tax details, and reports stay organized from the first login.</span>
            </article>
            <article className="trust-proof-card">
              <strong>Operational clarity</strong>
              <span>Stock, sales, and dues live together so daily decisions feel faster and cleaner.</span>
            </article>
          </div>

          <div className="trust-auth-stat-row">
            <div>
              <strong>01</strong>
              <span>One dashboard for billing, stock, and reports</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Mobile-friendly access for day-to-day shop work</span>
            </div>
            <div>
              <strong>Pro</strong>
              <span>Premium-first visual language that feels stable and credible</span>
            </div>
          </div>
        </section>

        <section className="trust-auth-card-wrap">
          <div className="trust-auth-card">
            <div className="trust-form-topline">Secure sign in</div>
            <div className="auth-title">Welcome back</div>
            <div className="auth-subtitle">Sign in to continue running your business with confidence.</div>

            <div className="trust-mini-strip">
              <span>Encrypted session</span>
              <span>Fast login</span>
              <span>Mobile ready</span>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="trust-password-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input trust-password-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="trust-password-toggle">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary trust-submit-btn">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="auth-note">
              Don&apos;t have an account?{' '}
              <a href="/register" className="cta-link">
                Create one free
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
