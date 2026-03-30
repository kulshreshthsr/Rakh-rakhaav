'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearTrialGateSeen, setWelcomePending, writeStoredSubscription } from '../../lib/subscription';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        writeStoredSubscription(data.user?.subscription || null);
        setWelcomePending(true);
        clearTrialGateSeen();
        router.push('/welcome');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ['#cbd5e1', '#ef4444', '#f59e0b', '#10b981'][strength];
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][strength];

  return (
    <div className="trust-auth-root trust-auth-root-register">
      <div className="trust-auth-shell">
        <section className="trust-auth-showcase trust-auth-showcase-register">
          <div className="trust-auth-kicker">Premium onboarding experience</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">रख-रखाव</div>
              <div className="trust-auth-brand-subtitle">Business owners ke liye ek focused shuruaat</div>
            </div>
          </div>

          <div className="trust-auth-copy">
            <h1>Set up once. Look professional from the very first invoice.</h1>
            <p>
              Create your workspace and step into a more premium business system for billing, stock control, GST, and
              customer dues.
            </p>
          </div>

          <div className="trust-auth-proof-grid">
            <article className="trust-proof-card">
              <strong>Quick setup</strong>
              <span>Open your account and move directly into real business actions without extra complexity.</span>
            </article>
            <article className="trust-proof-card">
              <strong>Made for Indian retail</strong>
              <span>Inventory, purchases, dues, and tax workflows are framed for everyday shop operations.</span>
            </article>
          </div>

          <div className="trust-auth-stat-row">
            <div>
              <strong>Free</strong>
              <span>Start with a trial-ready workspace</span>
            </div>
            <div>
              <strong>GST</strong>
              <span>Built around clean, dependable records</span>
            </div>
            <div>
              <strong>Mobile</strong>
              <span>Designed to feel strong on small screens too</span>
            </div>
          </div>
        </section>

        <section className="trust-auth-card-wrap">
          <div className="trust-auth-card">
            <div className="trust-form-topline">Create secure workspace</div>
            <div className="auth-title">खाता बनाएं / Create Account</div>
            <div className="auth-subtitle">Start managing your business today.</div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">पूरा नाम / FULL NAME</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Sonaa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">यूज़रनेम / USERNAME</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="sonaa_store"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                  required
                />
                <div className="trust-helper-text">Use lowercase letters, numbers, and underscore only.</div>
              </div>

              <div className="form-group">
                <label className="form-label">पासवर्ड / PASSWORD</label>
                <div className="trust-password-wrap">
                  <input
                    className="form-input trust-password-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="trust-password-toggle">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="trust-strength-wrap">
                    <div className="trust-strength-bar">
                      <div
                        className="trust-strength-fill"
                        style={{
                          width: `${[0, 33, 66, 100][strength]}%`,
                          background: strengthColor,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: strengthColor, fontWeight: 700, marginTop: 5 }}>{strengthLabel}</div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary trust-submit-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="auth-note">
              Already have an account?{' '}
              <a href="/login" className="cta-link">
                Sign in
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
