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

        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          background:
            radial-gradient(circle at top left, rgba(79,70,229,0.14), transparent 22%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.10), transparent 18%),
            #F8FAFC;
        }

        .login-brand {
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
          filter: blur(8px);
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
          font-size: 46px;
          line-height: 1.02;
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

        .login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 28px;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
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

        .signin-btn {
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

        .signin-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 22px 40px rgba(79,70,229,0.30);
        }

        .signin-btn:disabled {
          opacity: 0.68;
          cursor: not-allowed;
          box-shadow: none;
        }

        .login-footer {
          margin-top: 22px;
          font-size: 14px;
          color: #64748B;
          text-align: center;
        }

        .login-footer a {
          color: #4338CA;
          font-weight: 800;
          text-decoration: none;
        }

        .login-footer a:hover { text-decoration: underline; }

        .trust-row {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(226,232,240,0.95);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .trust-item {
          padding: 12px 10px;
          border-radius: 16px;
          background: #F8FAFC;
          text-align: center;
        }

        .trust-icon {
          font-size: 18px;
          margin-bottom: 6px;
        }

        .trust-label {
          font-size: 11.5px;
          color: #64748B;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .login-root { grid-template-columns: 1fr; }
          .login-brand { min-height: 420px; padding: 28px 24px; }
          .login-panel { padding: 22px 14px 28px; margin-top: -40px; position: relative; z-index: 2; }
          .brand-heading { font-size: 34px; max-width: 100%; }
          .brand-metrics { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .login-card { padding: 22px 18px; border-radius: 24px; }
          .brand-heading { font-size: 28px; }
          .card-title { font-size: 24px; }
          .trust-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="login-root">
        <section className="login-brand">
          <div className="brand-orb one" />
          <div className="brand-orb two" />
          <div className="brand-grid" />

          <div className="brand-top">
            <div className="brand-chip">
              <span>⚡</span>
              <span>Premium Inventory and GST Suite</span>
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
              Billing, inventory, GST, and business control in one place.
            </div>

            <div className="brand-text">
              Built for Indian businesses that want speed, clarity, and trust. Manage stock, sales, purchases, GST returns, and udhaar with a workflow that feels like paid software from the first click.
            </div>

            <div className="brand-feature-row">
              {['📦 Smart Stock', '🧾 GST Billing', '📊 Profit Reports', '📒 Udhaar Tracking'].map((f, i) => (
                <div key={i} className="brand-feature">
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="brand-bottom">
            <div className="brand-metrics">
              <div className="brand-metric">
                <div className="brand-metric-label">Sales</div>
                <div className="brand-metric-value">Fast</div>
                <div className="brand-metric-sub">Instant invoice workflows</div>
              </div>

              <div className="brand-metric">
                <div className="brand-metric-label">GST</div>
                <div className="brand-metric-value">Ready</div>
                <div className="brand-metric-sub">B2B, B2C, ITC, exports</div>
              </div>

              <div className="brand-metric">
                <div className="brand-metric-label">Mobile</div>
                <div className="brand-metric-value">Smooth</div>
                <div className="brand-metric-sub">Thumb-friendly experience</div>
              </div>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-card">
            <div className="card-badge">
              <span>🔐</span>
              <span>Secure sign in</span>
            </div>

            <div className="card-title">Welcome back</div>
            <div className="card-sub">
              Sign in to continue managing your inventory, GST billing, customer credit, and reports.
            </div>

            {error && <div className="error-box">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-wrap">
                <label className="field-label">Username</label>
                <input
                  type="text"
                  className="input-box"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="field-wrap">
                <label className="field-label">Password</label>
                <div className="pass-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-box"
                    placeholder="••••••••"
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
              </div>

              <button type="submit" disabled={loading} className="signin-btn">
                {loading ? '⏳ Signing in...' : 'Sign in to Dashboard'}
              </button>
            </form>

            <div className="login-footer">
              Don't have an account? <a href="/register">Create one free</a>
            </div>

            <div className="trust-row">
              {[
                { icon: '🔒', label: 'Secure access' },
                { icon: '⚡', label: 'Fast workflow' },
                { icon: '📱', label: 'Mobile ready' },
              ].map((item, i) => (
                <div key={i} className="trust-item">
                  <div className="trust-icon">{item.icon}</div>
                  <div className="trust-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
