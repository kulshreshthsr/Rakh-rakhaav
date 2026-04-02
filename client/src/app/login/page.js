'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  clearTrialGateSeen,
  getPostAuthRoute,
  markTrialGateSeen,
  readStoredSubscription,
  setWelcomePending,
  writeStoredSubscription,
} from '../../lib/subscription';
import { apiUrl } from '../../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace(getPostAuthRoute(readStoredSubscription()));
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
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
    <div className="trust-auth-root trust-auth-root-login">
      <div className="trust-auth-shell trust-auth-shell-login">
        <section className="trust-auth-showcase trust-auth-showcase-login trust-auth-showcase-compact">
          <div className="trust-auth-kicker">Premium retail operating system</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">रखरखाव</div>
              <div className="trust-auth-brand-subtitle">Focused retail control for Indian businesses</div>
            </div>
          </div>

          <div className="trust-auth-copy trust-auth-copy-compact">
            <h1>Run your business with clarity.</h1>
            <p>GST billing, inventory, purchases, and udhaar in one focused workspace.</p>
          </div>
        </section>

        <section className="trust-auth-card-wrap">
          <div className="trust-auth-card trust-auth-card-login">
            <div className="trust-form-topline">Secure sign in</div>
            <div className="auth-title">Welcome back</div>
            <div className="auth-subtitle">Sign in to continue running your business with confidence.</div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="trust-auth-form">
              <div className="form-group trust-auth-form-group">
                <label className="form-label">Username or Email</label>
                <input
                  type="text"
                  className="form-input trust-auth-input"
                  placeholder="you@business.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group trust-auth-form-group">
                <label className="form-label">Password</label>
                <div className="trust-password-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input trust-password-input trust-auth-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="trust-password-toggle">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="trust-auth-support-row">
                <label className="trust-auth-check">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <Link href="/forgot-password" className="trust-auth-link">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary trust-submit-btn">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="trust-auth-divider" />
            <div className="auth-note">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="cta-link">
                Create one free
              </Link>
            </div>
            <div className="trust-auth-legal-note">
              <Link href="/" className="trust-auth-link">Back to home</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
