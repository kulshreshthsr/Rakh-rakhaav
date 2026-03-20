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

            <div style={{ marginTop: 24, maxWidth: 420 }}>
              <h1 style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.04em', fontWeight: 800 }}>
                Fast login for your business dashboard.
              </h1>
            </div>

            <div className="auth-meta" style={{ marginTop: 14 }}>
              <div className="feature-chip">📦 Stock</div>
              <div className="feature-chip">🧾 GST</div>
              <div className="feature-chip">📒 Udhaar</div>
            </div>
          </div>

          <div />
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card" style={{ maxWidth: 420, padding: '24px 22px' }}>
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
