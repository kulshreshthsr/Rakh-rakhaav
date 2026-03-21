'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Unable to sign in.');
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-root">
      <div className="admin-auth-shell">
        <section className="admin-auth-panel">
          <div className="admin-auth-badge">Admin Access</div>
          <h1>Rakh-Rakhaav Admin Dashboard</h1>
          <p>
            Monitor registered shops, subscription health, expiring trials and overall growth from one secure workspace.
          </p>

          <div className="admin-auth-points">
            <div className="admin-auth-point">
              <strong>Live shop data</strong>
              <span>Shop profile details and subscription status in one place.</span>
            </div>
            <div className="admin-auth-point">
              <strong>Secure session</strong>
              <span>Admin access is protected with JWT and HTTP-only cookies.</span>
            </div>
          </div>
        </section>

        <section className="admin-auth-card">
          <div className="admin-auth-title">Owner Login</div>
          <div className="admin-auth-subtitle">Use your admin credentials to continue.</div>

          {error ? <div className="admin-auth-error">{error}</div> : null}

          <form onSubmit={handleSubmit} className="admin-auth-form">
            <label className="admin-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter admin username"
                autoComplete="username"
                required
              />
            </label>

            <label className="admin-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" className="admin-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in to dashboard'}
            </button>
          </form>
        </section>
      </div>

      <style>{`
        .admin-auth-root {
          min-height: 100vh;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 24%),
            radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.12), transparent 20%),
            linear-gradient(180deg, #eef4ff, #f8fafc);
        }

        .admin-auth-shell {
          width: min(1080px, 100%);
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          overflow: hidden;
          border-radius: 30px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
        }

        .admin-auth-panel {
          padding: 42px;
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.96)),
            #0f172a;
          color: white;
        }

        .admin-auth-badge {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(96, 165, 250, 0.14);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .admin-auth-panel h1 {
          margin: 18px 0 12px;
          font-size: clamp(32px, 4vw, 46px);
          line-height: 1.05;
          letter-spacing: -0.06em;
        }

        .admin-auth-panel p {
          margin: 0;
          max-width: 480px;
          color: rgba(226, 232, 240, 0.74);
          line-height: 1.7;
          font-size: 15px;
        }

        .admin-auth-points {
          margin-top: 34px;
          display: grid;
          gap: 14px;
        }

        .admin-auth-point {
          padding: 18px 20px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .admin-auth-point strong {
          display: block;
          font-size: 15px;
          margin-bottom: 6px;
        }

        .admin-auth-point span {
          color: rgba(226, 232, 240, 0.72);
          line-height: 1.6;
          font-size: 13px;
        }

        .admin-auth-card {
          padding: 42px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .admin-auth-title {
          font-size: 30px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.05em;
        }

        .admin-auth-subtitle {
          margin-top: 8px;
          color: #64748b;
          line-height: 1.6;
        }

        .admin-auth-error {
          margin-top: 18px;
          padding: 12px 14px;
          border-radius: 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 14px;
          font-weight: 700;
        }

        .admin-auth-form {
          margin-top: 22px;
          display: grid;
          gap: 16px;
        }

        .admin-field {
          display: grid;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }

        .admin-field input {
          min-height: 54px;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          padding: 0 16px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .admin-field input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .admin-submit-btn {
          min-height: 56px;
          border: none;
          border-radius: 18px;
          background: linear-gradient(135deg, #2563eb, #0891b2);
          color: white;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 20px 36px rgba(37, 99, 235, 0.2);
        }

        .admin-submit-btn:disabled {
          opacity: 0.72;
          cursor: wait;
        }

        @media (max-width: 920px) {
          .admin-auth-root {
            padding: 16px;
          }

          .admin-auth-shell {
            grid-template-columns: 1fr;
          }

          .admin-auth-panel,
          .admin-auth-card {
            padding: 28px 22px;
          }
        }
      `}</style>
    </div>
  );
}
