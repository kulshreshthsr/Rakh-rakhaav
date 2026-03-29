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
          <div className="trust-auth-kicker">Premium retail operating system</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">Rakhrakhaav</div>
              <div className="trust-auth-brand-subtitle">Built for confident Indian shop owners</div>
            </div>
          </div>

          <div className="trust-auth-copy">
            <h1>Run your business with clarity.</h1>
            <p>GST billing, inventory, purchases, and udhaar in one focused workspace.</p>
          </div>

          <div className="trust-auth-pill-row">
            <div className="trust-auth-feature-pill">
              <span className="trust-auth-feature-icon">₹</span>
              <span>Fast GST billing</span>
            </div>
            <div className="trust-auth-feature-pill">
              <span className="trust-auth-feature-icon">□</span>
              <span>Live inventory</span>
            </div>
            <div className="trust-auth-feature-pill">
              <span className="trust-auth-feature-icon">◎</span>
              <span>Udhaar control</span>
            </div>
          </div>
        </section>

        <section className="trust-auth-card-wrap">
          <div className="trust-auth-card">
            <div className="trust-form-topline">Secure sign in</div>
            <div className="auth-title">Welcome back</div>
            <div className="auth-subtitle">Sign in to continue running your business with confidence.</div>

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
