'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearTrialGateSeen, getPostAuthRoute, readStoredSubscription, setWelcomePending, writeStoredSubscription } from '../../lib/subscription';
import { apiUrl } from '../../lib/api';

const FEATURES = [
  {
    title: 'Quick setup',
    description: 'Account kholo aur seedha real business kaam par jao, extra complexity ke bina.',
  },
  {
    title: 'Made for Indian retail',
    description: 'Inventory, purchases, dues aur tax workflows daily shop use ke hisaab se bane hain.',
  },
  {
    title: 'Free',
    description: 'Trial-ready workspace के साथ start करें',
  },
  {
    title: 'GST',
    description: 'Clean aur dependable records ke liye built',
  },
  {
    title: 'Mobile',
    description: 'Small screens par bhi easy use ke liye design kiya gaya hai',
  },
  {
    title: 'Premium support',
    description: 'Indian business owners ke liye jab zarurat ho tab help',
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
  const strengthFillClass = ['w-0 bg-slate-300', 'w-[33%] bg-rose-500', 'w-[66%] bg-amber-500', 'w-full bg-emerald-500'][strength];
  const strengthLabelClass = ['text-slate-300', 'text-rose-500', 'text-amber-500', 'text-emerald-500'][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strength];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace(getPostAuthRoute(readStoredSubscription()));
    }
  }, [router]);

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
          <div className="trust-auth-kicker">Blue onboarding experience</div>
          <div className="trust-auth-brand-row">
            <div className="trust-auth-logo">R</div>
            <div>
              <div className="trust-auth-brand-name">Rakhrakhaav</div>
              <div className="trust-auth-brand-subtitle">Launch a simple retail workspace</div>
            </div>
          </div>

          <div className="trust-auth-copy trust-auth-copy-register">
            <h1>एक बार setup करो. पहले invoice से ही business professional लगेगा.</h1>
            <p>
              अपना workspace बनाओ और billing, stock control, GST और customer dues के लिए एक clean system use करो.
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
            <div className="auth-title">Create account / नया account बनाएं</div>
            <div className="auth-subtitle">आज ही अपना business workspace शुरू करें.</div>

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
                  {usernameFeedback || 'सिर्फ lowercase letters, numbers और underscore use करें.'}
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
                <div className="trust-helper-text">Security के लिए कम से कम 6 characters</div>
                {password.length > 0 && (
                  <div className="trust-strength-wrap">
                    <div className="trust-strength-bar">
                      <div className={`trust-strength-fill ${strengthFillClass}`} />
                    </div>
                    <div className={`trust-strength-label ${strengthLabelClass}`}>{strengthLabel}</div>
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
                  मैं <a href="/terms" className="trust-auth-link">Terms</a> और <a href="/privacy" className="trust-auth-link">Privacy Policy</a> से agree करता/करती हूँ
                </span>
              </label>

              <button type="submit" className="btn-primary trust-submit-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Account बनाएं'}
              </button>
            </form>

            <div className="trust-auth-divider" />
            <div className="auth-note">
              Account पहले से है?{' '}
              <Link href="/login" className="cta-link">
                Login करें
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
