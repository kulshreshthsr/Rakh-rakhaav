'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        router.push('/dashboard');
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
                <div className="auth-brand-sub">Start Smart From Day One</div>
              </div>
            </div>

            <div style={{ marginTop: 24, maxWidth: 420 }}>
              <h1 style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.04em', fontWeight: 800 }}>
                Create your account and start quickly.
              </h1>
            </div>

            <div className="auth-meta" style={{ marginTop: 14 }}>
              {['Free', 'GST Ready', 'Mobile First'].map((item) => (
                <div key={item} className="feature-chip">{item}</div>
              ))}
            </div>
          </div>

          <div />
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card" style={{ maxWidth: 420, padding: '24px 22px' }}>
            <div className="auth-title">Create account</div>
            <div className="auth-subtitle">Start managing your business today.</div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
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
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="sonaa_store"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                  required
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Sirf lowercase letters, numbers aur underscore
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
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
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${[0, 33, 66, 100][strength]}%`,
                          height: '100%',
                          background: strengthColor,
                          borderRadius: 999,
                          transition: 'width 0.22s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: strengthColor, fontWeight: 700, marginTop: 5 }}>{strengthLabel}</div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-success" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
                {loading ? '⏳ Creating account...' : 'Create account / अकाउंट बनाएं'}
              </button>
            </form>

            <div className="auth-note">
              Already have an account?{' '}
              <a href="/login" style={{ color: '#059669', fontWeight: 800, textDecoration: 'none' }}>
                Sign in
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
