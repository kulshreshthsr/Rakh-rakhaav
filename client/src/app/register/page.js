'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearTrialGateSeen, setWelcomePending, writeStoredSubscription } from '../../lib/subscription';
import { apiUrl } from '../../lib/api';

const FEATURES = [
  {
    title: 'Quick setup',
    description: 'Open your account and move directly into real business actions without extra complexity.',
  },
  {
    title: 'Made for Indian retail',
    description: 'Inventory, purchases, dues, and tax workflows are framed for everyday shop operations.',
  },
  {
    title: 'Free',
    description: 'Start with a trial-ready workspace',
  },
  {
    title: 'GST',
    description: 'Built around clean, dependable records',
  },
  {
    title: 'Mobile',
    description: 'Designed to feel strong on small screens too',
  },
  {
    title: 'Premium support',
    description: 'Get help when you need it, built for Indian business owners',
  },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
  const usernameIsValid = normalizedUsername.length > 0 && /^[a-z0-9_]+$/.test(normalizedUsername);
  const usernameFeedback = normalizedUsername.length === 0
    ? ''
    : usernameIsValid
      ? 'Username format looks good.'
      : 'Use lowercase letters, numbers, and underscore only.';

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ['#cbd5e1', '#ef4444', '#f59e0b', '#10b981'][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!usernameIsValid) {
      setError('Choose a valid username before creating your account.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!acceptTerms) {
      setError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username: normalizedUsername, password }),
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

  return (
    <div className="trust-auth-root trust-auth-root-login trust-auth-root-register">
      <div className="trust-auth-shell trust-auth-shell-login">
        <section className="trust-auth-showcase trust-auth-showcase-register trust-auth-showcase-compact">
          <div className="trust-auth-kicker">Premium onboarding experience</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">रखरखाव</div>
              <div className="trust-auth-brand-subtitle">Launch a focused retail workspace</div>
            </div>
          </div>

          <div className="trust-auth-copy trust-auth-copy-register">
            <h1>Set up once. Look professional from the very first invoice.</h1>
            <p>
              Create your workspace and step into a more premium business system for billing, stock control, GST, and
              customer dues.
            </p>
          </div>

          <div className="trust-feature-stack">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="trust-feature-card">
                <strong>{feature.title}</strong>
                <span>{feature.description}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="trust-auth-card-wrap">
          <div className="trust-auth-card trust-auth-card-login trust-auth-card-register">
            <div className="trust-form-topline">Create secure workspace</div>
            <div className="auth-title">Create account</div>
            <div className="auth-subtitle">Start managing your business today.</div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="trust-auth-form">
              <div className="form-group trust-auth-form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input trust-auth-input"
                  type="text"
                  placeholder="Sonaa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-group trust-auth-form-group">
                <label className="form-label">Username</label>
                <input
                  className={`form-input trust-auth-input${normalizedUsername.length > 0 && !usernameIsValid ? ' trust-auth-input-error' : ''}`}
                  type="text"
                  placeholder="sonaa_store"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <div className={`trust-helper-text ${normalizedUsername.length > 0 ? (usernameIsValid ? 'is-success' : 'is-error') : ''}`}>
                  {usernameFeedback || 'Use lowercase letters, numbers, and underscore only.'}
                </div>
              </div>

              <div className="form-group trust-auth-form-group">
                <label className="form-label">Password</label>
                <div className="trust-password-wrap">
                  <input
                    className="form-input trust-password-input trust-auth-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="trust-password-toggle">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="trust-helper-text">Minimum 6 characters for security</div>
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
                    <div className="trust-strength-label" style={{ color: strengthColor }}>{strengthLabel}</div>
                  </div>
                )}
              </div>

              <label className="trust-auth-check trust-auth-check-terms">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  I agree to the <a href="/terms" className="trust-auth-link">Terms</a> and <a href="/privacy" className="trust-auth-link">Privacy Policy</a>
                </span>
              </label>

              <button type="submit" className="btn-primary trust-submit-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="trust-auth-divider" />
            <div className="auth-note">
              Already have an account?{' '}
              <a href="/login" className="cta-link">
                Sign in
              </a>
            </div>
            <div className="trust-auth-legal-note">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
