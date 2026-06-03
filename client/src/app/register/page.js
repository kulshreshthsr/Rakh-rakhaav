'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTrialGateSeen,
  getPostAuthRoute,
  readStoredSubscription,
  setWelcomePending,
  writeStoredSubscription,
} from '../../lib/subscription';
import { setOnboardingPending } from '../onboarding/page';
import { apiUrl } from '../../lib/api';

const PERKS = [
  { icon: '⚡', title: 'Quick setup', desc: 'Account बनाओ और real business kaam par jao।' },
  { icon: '🇮🇳', title: 'Indian retail के लिए', desc: 'GST, उधार, stock — daily shop workflow।' },
  { icon: '🆓', title: 'Free शुरू करो', desc: 'Trial-ready workspace के साथ start करें।' },
  { icon: '📱', title: 'Mobile-first', desc: 'छोटी screen पर भी perfectly काम करता है।' },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
  const usernameIsValid = normalizedUsername.length > 0 && /^[a-z0-9_]+$/.test(normalizedUsername);
  const usernameFeedback = normalizedUsername.length === 0
    ? ''
    : usernameIsValid
      ? 'Username format looks good ✓'
      : 'Use lowercase letters, numbers, and underscore only.';

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthBar = ['w-0', 'w-1/3', 'w-2/3', 'w-full'][strength];
  const strengthColor = ['bg-slate-300', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'][strength];
  const strengthText = ['', 'Weak', 'Fair', 'Strong'][strength];
  const strengthTextColor = ['text-slate-400', 'text-red-500', 'text-amber-500', 'text-emerald-700'][strength];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!usernameIsValid) {
      setError('Choose a valid username before creating your account.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!acceptTerms) {
      setError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username: normalizedUsername, password, email: email.trim() || undefined }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        setError('Server is starting up. Please wait 30 seconds and try again.');
        return;
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        writeStoredSubscription(data.user?.subscription || null);
        setWelcomePending(true);
        clearTrialGateSeen();
        setOnboardingPending();
        router.push('/onboarding');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Unable to connect. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col lg:flex-row">

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 relative overflow-hidden">

        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-green-500/8 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 no-underline">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-green-500/30">
              ₹
            </div>
            <div>
              <div className="text-[18px] font-black text-white tracking-tight leading-none">रखरखाव</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Simple Business App</div>
            </div>
          </Link>

          <div className="mt-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">नया account</p>
            <h1 className="text-[clamp(26px,3vw,38px)] font-black text-white leading-tight tracking-tight">
              एक बार setup करो,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                हमेशा के लिए clear।
              </span>
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-400 max-w-xs">
              पहले invoice से ही business professional लगेगा।
            </p>
          </div>

          {/* Perks */}
          <div className="mt-10 flex flex-col gap-3">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition">
                <span className="text-xl mt-0.5">{p.icon}</span>
                <div>
                  <div className="text-[13px] font-bold text-white">{p.title}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5 leading-snug">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="relative z-10 mt-8">
          <div className="px-4 py-4 rounded-2xl bg-white/5 border border-white/8">
            <p className="text-[12px] font-semibold text-slate-400">
              🔒 आपका data secure है। कोई credit card नहीं चाहिए।
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Register form */}
      <div className="flex-1 relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-20">

        {/* Soft background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-green-200/40 blur-3xl" />
          <div className="absolute bottom-6 -left-12 w-48 h-48 rounded-full bg-emerald-200/35 blur-3xl" />
        </div>

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center text-white font-black text-lg shadow-md shadow-green-500/30">
            ₹
          </div>
          <div>
            <div className="text-[17px] font-black tracking-tight text-slate-900 leading-none">रखरखाव</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-green-700 mt-0.5">Simple Business App</div>
          </div>
        </div>

        <div className="relative w-full max-w-sm mx-auto lg:mx-0">
          <div className="absolute -inset-3 rounded-3xl bg-white/60 blur-2xl" />
          <div className="relative bg-white/90 backdrop-blur-xl border-2 border-green-200 rounded-3xl shadow-[0_25px_60px_-35px_rgba(22,101,52,0.25)] p-6 sm:p-7 auth-card">

            {/* Heading */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-800">
                  Free account
                </p>
              </div>
              <h2 className="mt-3 text-[clamp(24px,4vw,30px)] font-black tracking-tight text-slate-900 leading-[1.12]">
                नया account बनाओ
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                आज ही अपना business workspace शुरू करें।
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 mb-5 rounded-xl bg-red-50 border border-red-200 text-[13px] font-semibold text-red-700">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="राजेश कुमार"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Sonaa_store"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
                />
                {usernameFeedback && (
                  <p className={`text-[11px] font-semibold ${usernameIsValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {usernameFeedback}
                  </p>
                )}
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email (optional — for password recovery)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
                />
                <p className="mt-1 text-[11px] text-slate-400">Only used if you forget your password.</p>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-300 bg-white text-[14px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-wider text-green-700 hover:text-green-800 transition-colors"
                  >
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${strengthColor} ${strengthBar} transition-all rounded-full`} />
                      </div>
                      <span className={`text-[11px] font-bold ${strengthTextColor}`}>
                        {strengthText}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-green-700"
                />
                <span className="text-[12px] text-slate-600 leading-snug">
                  I agree to the{' '}
                  <Link href="/terms" className="font-bold text-green-700 hover:text-green-800 hover:underline">
                    Terms
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="font-bold text-green-700 hover:text-green-800 hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 mt-1 rounded-xl text-[15px] font-black text-white bg-gradient-to-r from-green-700 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Creating account...
                  </>
                ) : 'Free Account बनाएं →'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Login link */}
            <p className="text-center text-[13px] text-slate-600">
              पहले से account है?{' '}
              <Link href="/login" className="font-bold text-green-700 hover:text-green-800 hover:underline transition-colors">
                Login करें
              </Link>
            </p>

            <p className="mt-4 text-center">
              <Link href="/" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
                ← Back to home
              </Link>
            </p>

            <div className="mt-5 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[11.5px] text-green-800 leading-relaxed">
              🎉 7 दिन का free trial। कोई credit card नहीं चाहिए।
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