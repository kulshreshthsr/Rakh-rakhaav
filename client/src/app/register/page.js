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
  const strengthColor = ['#E2E8F0', '#EF4444', '#F59E0B', '#22C55E'][strength];
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][strength];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background:
            radial-gradient(circle at top left, rgba(79,70,229,0.18), transparent 26%),
            radial-gradient(circle at bottom right, rgba(34,197,94,0.14), transparent 22%),
            #F8FAFC;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .register-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 0.98fr 1.02fr;
          background:
            radial-gradient(circle at top left, rgba(79,70,229,0.14), transparent 22%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.10), transparent 18%),
            #F8FAFC;
        }

        .register-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 28px;
        }

        .register-card {
          width: 100%;
          max-width: 480px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(226,232,240,0.92);
          border-radius: 30px;
          padding: 30px;
          box-shadow: 0 34px 80px rgba(15,23,42,0.12);
          backdrop-filter: blur(16px);
        }

        .card-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #EEF2FF;
          color: #4338CA;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 30px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -0.05em;
          line-height: 1.05;
          font-family: 'Sora', sans-serif;
          margin-bottom: 8px;
        }

        .card-sub {
          font-size: 14px;
          color: #64748B;
          margin-bottom: 24px;
          line-height: 1.7;
        }

        .error-box {
          background: #FEF2F2;
          color: #991B1B;
          border: 1px solid #FECACA;
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .field-wrap { margin-bottom: 16px; }

        .field-label {
          display: block;
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 800;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .input-box {
          width: 100%;
          min-height: 48px;
          padding: 12px 14px;
          border: 1.5px solid rgba(226,232,240,0.96);
          border-radius: 16px;
          font-size: 14px;
          color: #0F172A;
          background: rgba(255,255,255,0.95);
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .input-box:focus {
          border-color: rgba(79,70,229,0.44);
          box-shadow: 0 0 0 4px rgba(79,70,229,0.10);
          background: #fff;
        }

        .input-box::placeholder { color: #94A3B8; }

        .hint {
          font-size: 11.5px;
          color: #94A3B8;
          margin-top: 6px;
          font-weight: 600;
        }

        .pass-wrap { position: relative; }

        .pass-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #94A3B8;
        }

        .strength-wrap { margin-top: 8px; }
        .strength-track {
          height: 6px;
          background: #E2E8F0;
          border-radius: 999px;
          overflow: hidden;
        }
        .strength-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.28s ease, background 0.28s ease;
        }
        .strength-label {
          font-size: 11.5px;
          font-weight: 700;
          margin-top: 6px;
        }

        .signup-btn {
          width: 100%;
          min-height: 50px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          box-shadow: 0 18px 34px rgba(79,70,229,0.24);
          transition: transform 0.16s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .signup-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 22px 40px rgba(79,70,229,0.30);
        }

        .signup-btn:disabled {
          opacity: 0.68;
          cursor: not-allowed;
          box-shadow: none;
        }

        .register-footer {
          margin-top: 22px;
          font-size: 14px;
          color: #64748B;
          text-align: center;
        }

        .register-footer a {
          color: #4338CA;
          font-weight: 800;
          text-decoration: none;
        }

        .register-footer a:hover { text-decoration: underline; }

        .trust-row {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(226,232,240,0.95);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .trust-item {
          padding: 13px 12px;
          border-radius: 16px;
          background: #F8FAFC;
        }

        .trust-title {
          font-size: 12.5px;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 4px;
        }

        .trust-sub {
          font-size: 11.5px;
          color: #64748B;
          line-height: 1.55;
        }

        .register-brand {
          position: relative;
          overflow: hidden;
          padding: 40px;
          background:
            linear-gradient(135deg, #0F172A 0%, #1E293B 38%, #4338CA 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .brand-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .brand-orb.one {
          width: 280px;
          height: 280px;
          top: -70px;
          right: -40px;
          background: radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%);
        }

        .brand-orb.two {
          width: 240px;
          height: 240px;
          bottom: -70px;
          left: 40px;
          background: radial-gradient(circle, rgba(34,197,94,0.20), transparent 70%);
        }

        .brand-grid {
          position: absolute;
          inset: 0;
          opacity: 0.08;
          background-image:
            linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 34px 34px;
          pointer-events: none;
        }

        .brand-top,
        .brand-bottom {
          position: relative;
          z-index: 1;
        }

        .brand-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-bottom: 18px;
        }

        .brand-logo-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
        }

        .brand-logo {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: linear-gradient(135deg, #4F46E5 0%, #22C55E 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 24px;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
          box-shadow: 0 18px 34px rgba(79,70,229,0.28);
          flex-shrink: 0;
        }

        .brand-name {
          font-size: 30px;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .brand-name span { color: #22C55E; }

        .brand-sub {
          margin-top: 6px;
          font-size: 11px;
          color: rgba(255,255,255,0.58);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
        }

        .brand-heading {
          font-size: 44px;
          line-height: 1.03;
          letter-spacing: -0.05em;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
          max-width: 520px;
          margin-bottom: 16px;
        }

        .brand-text {
          max-width: 540px;
          font-size: 15px;
          line-height: 1.75;
          color: rgba(255,255,255,0.78);
        }

        .brand-feature-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 26px;
        }

        .brand-feature {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 12px;
          color: rgba(255,255,255,0.90);
          font-weight: 700;
        }

        .brand-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .brand-metric {
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
        }

        .brand-metric-label {
          font-size: 11px;
          color: rgba(255,255,255,0.56);
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }

        .brand-metric-value {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.04em;
        }

        .brand-metric-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.72);
          margin-top: 6px;
        }

        @media (max-width: 980px) {
          .register-root { grid-template-columns: 1fr; }
          .register-brand { min-height: 420px; padding: 28px 24px; }
          .register-panel { padding: 22px 14px 28px; margin-top: -40px; position: relative; z-index: 2; }
          .brand-heading { font-size: 34px; max-width: 100%; }
          .brand-metrics { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .register-card { padding: 22px 18px; border-radius: 24px; }
          .brand-heading { font-size: 28px; }
          .card-title { font-size: 24px; }
          .trust-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="register-root">
        <section className="register-panel">
          <div className="register-card">
            <div className="card-badge">
              <span>🚀</span>
              <span>Create your workspace</span>
            </div>

            <div className="card-title">Start with Rakhaav</div>
            <div className="card-sub">
              Create your account to unlock inventory control, GST billing, supplier purchases, udhaar, and premium business reporting.
            </div>

            {error && <div className="error-box">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-wrap">
                <label className="field-label">Full Name</label>
                <input
                  className="input-box"
                  type="text"
                  placeholder="Sonaa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="field-wrap">
                <label className="field-label">Username</label>
                <input
                  className="input-box"
                  type="text"
                  placeholder="sona"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                  required
                />
                <div className="hint">Sirf lowercase letters, numbers aur underscore</div>
              </div>

              <div className="field-wrap">
                <label className="field-label">Password</label>
                <div className="pass-wrap">
                  <input
                    className="input-box"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="pass-toggle"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="strength-wrap">
                    <div className="strength-track">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${[0, 33, 66, 100][strength]}%`,
                          background: strengthColor,
                        }}
                      />
                    </div>
                    <div className="strength-label" style={{ color: strengthColor }}>
                      {strengthLabel}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="signup-btn" disabled={loading}>
                {loading ? '⏳ Creating account...' : 'Create account and continue'}
              </button>
            </form>

            <div className="register-footer">
              Already have an account? <a href="/login">Sign in</a>
            </div>

            <div className="trust-row">
              {[
                { title: 'Inventory Ready', sub: 'Add products, pricing, GST, and stock instantly.' },
                { title: 'Billing Ready', sub: 'Start sales invoices and purchase flows on day one.' },
                { title: 'GST Ready', sub: 'Track output tax and ITC without extra setup.' },
                { title: 'Mobile Ready', sub: 'Smooth experience across desktop and phone.' },
              ].map((item, i) => (
                <div key={i} className="trust-item">
                  <div className="trust-title">{item.title}</div>
                  <div className="trust-sub">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="register-brand">
          <div className="brand-orb one" />
          <div className="brand-orb two" />
          <div className="brand-grid" />

          <div className="brand-top">
            <div className="brand-chip">
              <span>💎</span>
              <span>Premium SaaS for Indian businesses</span>
            </div>

            <div className="brand-logo-wrap">
              <div className="brand-logo">र</div>
              <div>
                <div className="brand-name">
                  रख<span>रखाव</span>
                </div>
                <div className="brand-sub">Business Manager</div>
              </div>
            </div>

            <div className="brand-heading">
              Build your business control center in minutes.
            </div>

            <div className="brand-text">
              Create your workspace once and start running billing, inventory, GST, purchases, reports, and customer credit from a single premium dashboard.
            </div>

            <div className="brand-feature-row">
              {['🧾 GST Invoices', '📦 Stock Control', '📊 Reports', '🤝 Credit Tracking'].map((f, i) => (
                <div key={i} className="brand-feature">
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="brand-bottom">
            <div className="brand-metrics">
              <div className="brand-metric">
                <div className="brand-metric-label">Setup</div>
                <div className="brand-metric-value">Fast</div>
                <div className="brand-metric-sub">Create account and start quickly</div>
              </div>

              <div className="brand-metric">
                <div className="brand-metric-label">Billing</div>
                <div className="brand-metric-value">Live</div>
                <div className="brand-metric-sub">Sales and purchases from day one</div>
              </div>

              <div className="brand-metric">
                <div className="brand-metric-label">Reports</div>
                <div className="brand-metric-value">Clear</div>
                <div className="brand-metric-sub">Revenue, GST, and profit visibility</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
