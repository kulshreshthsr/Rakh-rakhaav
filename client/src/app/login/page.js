'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  clearTrialGateSeen,
  getPostAuthRoute,
  markTrialGateSeen,
  readStoredSubscription,
  setWelcomePending,
  writeStoredSubscription,
} from '../../lib/subscription';
import { apiUrl } from '../../lib/api';

/* ── Small feature list shown on the left panel ── */
const PERKS = [
  { icon: '🧾', label: 'GST-ready billing' },
  { icon: '📦', label: 'Stock always visible' },
  { icon: '💸', label: 'उधार follow-up' },
  { icon: '📊', label: 'One-tap reports' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  /* ── Redirect if already logged in ── */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        writeStoredSubscription(data.user?.subscription || null);
        setWelcomePending(false);
        if (data.user?.subscription?.isPro) {
          markTrialGateSeen();
          router.push('/dashboard');
        } else {
          clearTrialGateSeen();
          router.push('/trial-status');
        }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/40 to-blue-50/40 flex flex-col lg:flex-row">

      {/* ══════════════════════════════════════
          LEFT PANEL  (hidden on mobile)
      ══════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 relative overflow-hidden">

        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/25">
              र
            </div>
            <div>
              <div className="text-[18px] font-black text-white tracking-tight leading-none">
                रखरखाव
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                Simple Business App
              </div>
            </div>
          </Link>

          <div className="mt-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Welcome back
            </p>
            <h1 className="text-[clamp(28px,3vw,40px)] font-black text-white leading-tight tracking-tight">
              अपनी दुकान का<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                हिसाब खोलो।
              </span>
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-400 max-w-xs">
              GST billing, inventory, purchases और उधार — सब एक जगह आपका इंतज़ार कर रहा है।
            </p>
          </div>

          {/* Perk chips */}
          <div className="mt-10 grid grid-cols-2 gap-3">
            {PERKS.map((p) => (
              <div key={p.label} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-white/5 border border-white/8">
                <span className="text-xl">{p.icon}</span>
                <span className="text-[12px] font-semibold text-slate-300">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 mt-10">
          <div className="px-4 py-4 rounded-2xl bg-white/5 border border-white/8">
            <p className="text-[13px] leading-relaxed text-slate-300 italic">
              &quot;पहले हाथ से सब लिखते थे, अब रखरखाव से सब clear है।&quot;
            </p>
            <p className="mt-2 text-[11px] font-bold text-slate-500">— Kirana store owner, Kanpur</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          RIGHT PANEL  — Login form
      ══════════════════════════════════════ */}
      <div className="flex-1 relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-20">

        {/* Soft background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute bottom-6 -left-12 w-48 h-48 rounded-full bg-blue-200/40 blur-3xl" />
        </div>

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-base shadow-md">
            र
          </div>
          <div>
            <div className="text-[17px] font-black tracking-tight text-slate-900 leading-none">रखरखाव</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Simple Business App</div>
          </div>
        </div>

        <div className="relative w-full max-w-sm mx-auto lg:mx-0">
          <div className="absolute -inset-3 rounded-3xl bg-white/60 blur-2xl" />
          <div className="relative bg-white/90 backdrop-blur-xl border border-white/70 rounded-3xl shadow-[0_25px_60px_-35px_rgba(15,23,42,0.45)] p-6 sm:p-7 auth-card">

          {/* Heading */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                Secure sign in
              </p>
            </div>
            <h2 className="mt-3 text-[clamp(24px,4vw,30px)] font-black tracking-tight text-slate-900 leading-[1.12]">
              दोबारा स्वागत है! 
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">
              Sign in करके अपना business workspace खोलिए।
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {['GST-ready', 'Mobile-first', 'Fast billing'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Username या Email
              </label>
              <input
                type="text"
                placeholder="you@business.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-wider text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Remember + forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-cyan-600"
                />
                <span className="text-[12px] font-semibold text-slate-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-[12px] font-bold text-cyan-600 hover:text-cyan-700 hover:underline transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 mt-1 rounded-xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </>
              ) : 'Login करें →'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Register link */}
          <p className="text-center text-[13px] text-slate-500">
            Account नहीं है?{' '}
            <Link href="/register" className="font-bold text-cyan-600 hover:text-cyan-700 hover:underline transition-colors">
              Free में account बनाएं
            </Link>
          </p>

          <p className="mt-4 text-center">
            <Link href="/" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
              ← Back to home
            </Link>
          </p>
          <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[11.5px] text-slate-500 leading-relaxed">
            Tip: Keep your login safe. We never ask for your password outside this screen.
          </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .auth-card {
          animation: auth-card-in 520ms ease-out both;
        }
        @keyframes auth-card-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
