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
    </div>
  );
}
