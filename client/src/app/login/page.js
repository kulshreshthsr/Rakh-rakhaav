'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
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
    <div className="auth-root">
      <div className="auth-shell">
        <section className="auth-showcase">
          <div>
            <div className="auth-brand">
              <div className="auth-logo">र</div>
              <div>
                <div className="auth-brand-name">
                  रख<span style={{ color: '#6ee7b7' }}>रखाव</span>
                </div>
                <div className="auth-brand-sub">Smart Business Manager</div>
              </div>
            </div>

            <div style={{ marginTop: 34, maxWidth: 520 }}>
              <div className="kicker" style={{ marginBottom: 16 }}>Premium business control</div>
              <h1 style={{ fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.05em', fontWeight: 800 }}>
                Inventory, billing and GST in one sharp bilingual workspace.
              </h1>
              <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.7 }}>
                Built for Indian businesses that want speed, clarity and trust from the first screen.
              </p>
            </div>

            <div className="auth-meta">
              <div className="feature-chip">📦 Stock Track</div>
              <div className="feature-chip">🧾 GST Billing</div>
              <div className="feature-chip">📒 Udhaar Ledger</div>
              <div className="feature-chip">📊 Profit Reports</div>
            </div>
          </div>

          <div className="feature-panel">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.58)', marginBottom: 14 }}>
              Why teams trust Rakhaav
            </div>
            <div className="feature-grid">
              {[
                { icon: '⚡', title: 'Fast workflows', text: 'Daily sales and stock updates feel instant.' },
                { icon: '🔒', title: 'Secure access', text: 'Private account-based dashboard for your business.' },
                { icon: '🌐', title: 'Bilingual ready', text: 'Hindi + English labels built into the product.' },
                { icon: '📱', title: 'Mobile friendly', text: 'Smooth usage from shop counter to on-the-go.' },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginTop: 6, lineHeight: 1.6 }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-title">Welcome back</div>
            <div className="auth-subtitle">Sign in to continue managing your business.</div>

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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: 18,
                    }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-success" style={{ width: '100%', marginTop: 6 }}>
                {loading ? '⏳ Signing in...' : 'Sign in / लॉगिन'}
              </button>
            </form>

            <div className="auth-note">
              Don&apos;t have an account?{' '}
              <a href="/register" style={{ color: '#059669', fontWeight: 800, textDecoration: 'none' }}>
                Create one free
              </a>
            </div>

            <div className="auth-meta" style={{ justifyContent: 'center' }}>
              {['Secure', 'Fast', 'Mobile Ready'].map((item) => (
                <div key={item} className="auth-meta-item">{item}</div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
