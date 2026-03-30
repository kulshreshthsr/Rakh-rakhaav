'use client';
import { useState } from 'react';

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
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/forgot-password', {
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
                  रख<span style={{ color: '#a5b4fc' }}>रखाव</span>
                </div>
                <div className="auth-brand-sub">Account Recovery</div>
              </div>
            </div>

            <div style={{ marginTop: 18, maxWidth: 420 }}>
              <h1 style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.04em', fontWeight: 800 }}>
                Recover access without losing your business flow.
              </h1>
              <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 1.6 }}>
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
          <div className="auth-card" style={{ maxWidth: 420, padding: '24px 22px' }}>
            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>📩</div>
                <div className="auth-title" style={{ marginBottom: 8 }}>Check your email</div>
                <div className="auth-subtitle" style={{ marginBottom: 20 }}>
                  We sent a reset link to <strong>{email}</strong>. The link expires in 1 hour.
                </div>
                <a href="/login" className="btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
                  Back to login
                </a>
              </div>
            ) : (
              <>
                <div className="auth-title">पासवर्ड भूल गए? / Forgot Password?</div>
                <div className="auth-subtitle">Enter your email and we&apos;ll send you a password reset link.</div>

                {error && <div className="alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">ईमेल / EMAIL</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 6 }}>
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
