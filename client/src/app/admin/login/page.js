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
          <h1>Rakhrakhaav Admin Dashboard</h1>
          <p>
            Registered shops, subscription health, expiring trials aur overall growth ko ek secure workspace se monitor karein.
          </p>

          <div className="admin-auth-points">
            <div className="admin-auth-point">
              <strong>Live shop data</strong>
              <span>Shop profile details aur subscription status ek hi jagah.</span>
            </div>
            <div className="admin-auth-point">
              <strong>Secure session</strong>
              <span>Admin access JWT aur HTTP-only cookies se protected hai.</span>
            </div>
          </div>
        </section>

        <section className="admin-auth-card">
          <div className="admin-auth-title">Owner Login / Admin Sign in</div>
          <div className="admin-auth-subtitle">Continue karne ke liye apne admin credentials use karein.</div>

          {error ? <div className="admin-auth-error">{error}</div> : null}

          <form onSubmit={handleSubmit} className="admin-auth-form">
            <label className="admin-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Admin username dijiye"
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
                placeholder="Admin password dijiye"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" className="admin-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Dashboard mein login karein'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
