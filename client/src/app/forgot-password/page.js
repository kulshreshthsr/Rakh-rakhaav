'use client';
import { useState } from 'react';
import { apiUrl } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setSuccess(true);
      else setError(data.message || 'Failed');
    } catch {
      setError('Server error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-shell">
        <section className="auth-showcase">
          <div>
            <div className="auth-brand">
              <div className="auth-logo">र</div>
              <div>
                <div className="auth-brand-name">
                  रख<span className="text-indigo-300">रखाव</span>
                </div>
                <div className="auth-brand-sub">Account Recovery</div>
              </div>
            </div>

            <div className="mt-[18px] max-w-[420px]">
              <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.04em]">
                Recover access without losing your business flow.
              </h1>
              <p className="mt-3 text-[14px] leading-[1.6] text-white/70">
                We will send a secure reset link so you can get back to billing, stock and reports quickly.
              </p>
            </div>

            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <div className="auth-feature-icon">🔐</div>
                <div>
                  <div className="auth-feature-title">Secure reset flow</div>
                  <div className="auth-feature-text">Password reset links are time-limited for account safety.</div>
                </div>
              </div>
              <div className="auth-feature-item">
                <div className="auth-feature-icon">⏱</div>
                <div>
                  <div className="auth-feature-title">Quick return to work</div>
                  <div className="auth-feature-text">Get back to your dashboard without any business data changes.</div>
                </div>
              </div>
            </div>
          </div>
          <div />
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card max-w-[420px] px-[22px] py-6">
            {success ? (
              <div className="text-center">
                <div className="mb-[14px] text-[46px]">📩</div>
                <div className="auth-title mb-2">Check your email</div>
                <div className="auth-subtitle mb-5">
                  We sent a reset link to <strong>{email}</strong>. The link expires in 1 hour.
                </div>
                <a href="/login" className="btn-primary w-full no-underline">
                  Back to login
                </a>
              </div>
            ) : (
              <>
                <div className="auth-title">Forgot password?</div>
                <div className="auth-subtitle">Enter your email and we&apos;ll send you a password reset link.</div>

                {error && <div className="alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary mt-1.5 w-full">
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>

                <div className="auth-note">
                  Remember your password?{' '}
                  <a href="/login" className="cta-link">Sign in</a>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
