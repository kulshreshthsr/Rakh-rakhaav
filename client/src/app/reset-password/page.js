'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) { setSuccess(true); setTimeout(() => router.push('/login'), 2000); }
      else setError(data.message || 'Reset failed.');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  if (!token) return <p className="p-8 text-center text-red-600">Invalid reset link.</p>;
  if (success) return <p className="p-8 text-center text-green-700">Password reset! Redirecting to login…</p>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-black text-slate-900">Set New Password</h1>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="New password" minLength={6} required
          className="h-11 w-full border-2 border-slate-200 rounded-xl px-4 text-[14px] focus:border-green-600 outline-none" />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Confirm password" required
          className="h-11 w-full border-2 border-slate-200 rounded-xl px-4 text-[14px] focus:border-green-600 outline-none" />
        {error && <p className="text-[13px] text-red-600 font-semibold">{error}</p>}
        <button type="submit" disabled={loading}
          className="py-3 rounded-xl bg-green-700 text-white font-black disabled:opacity-60">
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
