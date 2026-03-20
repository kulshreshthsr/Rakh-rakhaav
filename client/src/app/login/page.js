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
            radial-gradient(circle at top left, rgba(79,70,229,0.14), transparent 24%),
            radial-gradient(circle at bottom right, rgba(34,197,94,0.10), transparent 20%),
            #F8FAFC;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background:
            radial-gradient(circle at top left, rgba(79,70,229,0.10), transparent 22%),
            #F8FAFC;
        }

        .login-brand {
          position: relative;
          overflow: hidden;
          padding: 42px;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 46%, #4338CA 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .brand-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .brand-orb.one {
          width: 260px;
          height: 260px;
          top: -60px;
          right: -30px;
          background: radial-gradient(circle, rgba(255,255,255,0.14), transparent 68%);
        }

        .brand-orb.two {
          width: 220px;
          height: 220px;
          bottom: -60px;
          left: 30px;
          background: radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%);
        }

        .brand-grid {
          position: absolute;
          inset: 0;
          opacity: 0.07;
          background-image:
            linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 34px 34px;
        }

        .brand-content {
          position: relative;
          z-index: 1;
          max-width: 520px;
        }

        .brand-logo-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
        }

        .brand-logo {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: linear-gradient(135deg, #4F46E5 0%, #22C55E 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 24px;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
          box-shadow: 0 18px 34px rgba(79,70,229,0.26);
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
          color: rgba(255,255,255,0.56);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
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
          margin-bottom: 18px;
        }

        .brand-heading {
          font-size: 44px;
          line-height: 1.04;
          letter-spacing: -0.05em;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
          margin-bottom: 14px;
        }

        .brand-text {
          font-size: 15px;
          line-height: 1.75;
          color: rgba(255,255,255,0.78);
          max-width: 500px;
        }

        .brand-tags {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .brand-tag {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 12px;
          color: rgba(255,255,255,0.92);
          font-weight: 700;
        }

        .login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(226,232,240,0.92);
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 28px 70px rgba(15,23,42,0.12);
          backdrop-filter: blur(16px);
        }

        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #EEF2FF;
          color: #4338CA;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .login-title {
          font-size: 30px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -0.05em;
          line-height: 1.05;
          font-family: 'Sora', sans-serif;
          margin-bottom: 8px;
        }

        .login-sub {
          font-size: 14px;
          color: #64748B;
          margin-bottom: 22px;
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
          background: rgba(255,255,255,0.96);
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .input-box:focus {
          border-color: rgba(79,70,229,0.44);
          box-shadow: 0 0 0 4px rgba(79,70,229,0.10);
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

        .login-btn {
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
        }

        .login-btn:disabled {
          opacity: 0.68;
          cursor: not-allowed;
          box-shadow: none;
        }

        .login-footer {
          margin-top: 20px;
          text-align: center;
          font-size: 14px;
          color: #64748B;
        }

        .login-footer a {
          color: #4338CA;
          font-weight: 800;
          text-decoration: none;
        }

        .mini-trust {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(226,232,240,0.95);
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .mini-trust span {
          background: #F8FAFC;
          border: 1px solid rgba(226,232,240,0.9);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11.5px;
          color: #64748B;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .login-root {
            grid-template-columns: 1fr;
          }

          .login-brand {
            min-height: auto;
            padding: 24px 20px 18px;
          }

          .brand-heading {
            font-size: 28px;
            margin-bottom: 10px;
          }

          .brand-text {
            font-size: 13.5px;
            line-height: 1.65;
          }

          .brand-tags {
            margin-top: 16px;
          }

          .login-panel {
            padding: 0 14px 22px;
            margin-top: -4px;
          }

          .login-card {
            max-width: 100%;
            border-radius: 24px;
            padding: 22px 18px;
          }

          .brand-tag:nth-child(n+3) {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .login-brand {
            padding: 18px 16px 10px;
          }

          .brand-chip {
            margin-bottom: 14px;
            font-size: 10.5px;
            padding: 6px 10px;
          }

          .brand-logo-row {
            gap: 12px;
            margin-bottom: 14px;
          }

          .brand-logo {
            width: 48px;
            height: 48px;
            border-radius: 15px;
            font-size: 20px;
          }

          .brand-name {
            font-size: 24px;
          }

          .brand-sub {
            font-size: 10px;
            letter-spacing: 0.12em;
          }

          .brand-heading {
            font-size: 22px;
            line-height: 1.1;
          }

          .brand-text {
            font-size: 13px;
            line-height: 1.6;
          }

          .brand-tags {
            gap: 8px;
            margin-top: 14px;
          }

          .brand-tag {
            font-size: 11px;
            padding: 7px 10px;
          }

          .login-panel {
            padding: 8px 12px 18px;
          }

          .login-card {
            padding: 18px 16px;
            border-radius: 22px;
          }

          .login-badge {
            margin-bottom: 12px;
          }

          .login-title {
            font-size: 22px;
          }

          .login-sub {
            font-size: 13px;
            margin-bottom: 18px;
          }

          .field-wrap {
            margin-bottom: 14px;
          }

          .input-box {
            min-height: 46px;
            border-radius: 15px;
          }

          .login-btn {
            min-height: 48px;
            border-radius: 15px;
            font-size: 14px;
          }

          .mini-trust {
            gap: 6px;
          }

          .mini-trust span {
            font-size: 11px;
            padding: 6px 9px;
          }
        }
      `}</style>

      <div className="login-root">
        <section className="login-brand">
          <div className="brand-orb one" />
          <div className="brand-orb two" />
          <div className="brand-grid" />

          <div className="brand-content">
            <div className="brand-chip">
              <span>⚡</span>
              <span>Premium Inventory and GST Suite</span>
            </div>

            <div className="brand-logo-row">
              <div className="brand-logo">र</div>
              <div>
                <div className="brand-name">
                  रख<span>रखाव</span>
                </div>
                <div className="brand-sub">Business Manager</div>
              </div>
            </div>

            <div className="brand-heading">
              Billing, inventory, and GST in one place.
            </div>

            <div className="brand-text">
              Fast billing, stock control, GST reporting, and udhaar management for Indian businesses.
            </div>

            <div className="brand-tags">
              <div className="brand-tag">📦 Smart Stock</div>
              <div className="brand-tag">🧾 GST Billing</div>
              <div className="brand-tag">📊 Reports</div>
              <div className="brand-tag">📒 Udhaar</div>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-card">
            <div className="login-badge">
              <span>🔐</span>
              <span>Secure sign in</span>
            </div>

            <div className="login-title">Welcome back</div>
            <div className="login-sub">
              Sign in to continue to your dashboard.
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

              <button type="submit" disabled={loading} className="login-btn">
                {loading ? '⏳ Signing in...' : 'Sign in to Dashboard'}
              </button>
            </form>

            <div className="login-footer">
              Don't have an account? <a href="/register">Create one free</a>
            </div>

            <div className="mini-trust">
              <span>🔒 Secure</span>
              <span>⚡ Fast</span>
              <span>📱 Mobile Ready</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
