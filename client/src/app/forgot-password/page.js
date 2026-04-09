'use client';

import { useState } from 'react';
import { apiUrl } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Request failed');
      }
    } catch {
      setError('Server issue आया. थोड़ी देर बाद फिर try करें.');
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
              <div className="auth-logo">R</div>
              <div>
                <div className="auth-brand-name">Rakhrakhaav</div>
                <div className="auth-brand-sub">Account Recovery / Password Help</div>
              </div>
            </div>

            <div className="mt-[18px] max-w-[420px]">
              <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.04em]">
                Password reset करके बिना business flow lose किए वापस आइए.
              </h1>
              <p className="mt-3 text-[14px] leading-[1.6] text-white/70">
                हम secure reset link भेजेंगे ताकि आप जल्दी billing, stock और reports पर वापस आ सकें.
              </p>
            </div>

            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <div className="auth-feature-icon">Lock</div>
                <div>
                  <div className="auth-feature-title">Secure reset flow</div>
                  <div className="auth-feature-text">Password reset links account safety के लिए time-limited होते हैं.</div>
                </div>
              </div>
              <div className="auth-feature-item">
                <div className="auth-feature-icon">Fast</div>
                <div>
                  <div className="auth-feature-title">Quick return to work</div>
                  <div className="auth-feature-text">Business data change किए बिना dashboard पर वापस आएं.</div>
                </div>
              </div>
            </div>
          </div>
          <div />
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card max-w-[420px] px-[22px] py-6">
            {success ? (
              <div className="text-center">
                <div className="mb-[14px] text-[46px]">Mail Sent</div>
                <div className="auth-title mb-2">Email check kariye</div>
                <div className="auth-subtitle mb-5">
                  हमने <strong>{email}</strong> पर reset link भेजा है. Link 1 hour में expire हो जाएगा.
                </div>
                <a href="/login" className="btn-primary w-full no-underline">
                  Login par wapas
                </a>
              </div>
            ) : (
              <>
                <div className="auth-title">Forgot password / Reset help</div>
                <div className="auth-subtitle">अपना email दीजिए और हम reset link भेज देंगे.</div>

                {error && <div className="alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary mt-1.5 w-full">
                    {loading ? 'Sending...' : 'Reset link भेजें'}
                  </button>
                </form>

                <div className="auth-note">
                  Password याद आ गया?{' '}
                  <a href="/login" className="cta-link">Login करें</a>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
