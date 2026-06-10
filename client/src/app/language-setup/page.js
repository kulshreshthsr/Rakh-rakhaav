'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import { useAppLocale } from '../../components/AppLocale';

const LANGUAGES = [
  {
    id:       'en',
    flag:     '🇬🇧',
    label:    'English',
    desc:     'All text in English',
    sample:   'New Invoice · Stock · Reports',
  },
  {
    id:       'hi',
    flag:     '🇮🇳',
    label:    'हिंदी',
    desc:     'सारा text हिंदी में',
    sample:   'नया बिल · स्टॉक · रिपोर्ट',
  },
  {
    id:       'hi_en',
    flag:     '🇮🇳',
    label:    'Hindi + English',
    desc:     'Mix of both — most popular',
    sample:   'नया Invoice · Stock · Reports',
    badge:    'Recommended',
  },
];

export default function LanguageSetupPage() {
  const router = useRouter();
  const { setLocale } = useAppLocale();
  const [selected, setSelected] = useState('hi_en');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleContinue = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(apiUrl('/api/auth/language'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ui_language: selected }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem('user', JSON.stringify({ ...data.user }));
          }
        }
      }

      // Apply locale immediately so onboarding is already translated
      setLocale(selected);
      router.push('/onboarding');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 shadow-lg shadow-green-500/30 mb-4">
            <span className="text-white font-black text-2xl">₹</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Choose your language</h1>
          <p className="text-slate-300 text-base mt-1 font-medium">भाषा चुनें</p>
          <p className="text-slate-400 text-sm mt-1">You can change this anytime from Profile</p>
        </div>

        {/* Language cards */}
        <div className="space-y-3 mb-6">
          {LANGUAGES.map((lang) => {
            const isActive = selected === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() => setSelected(lang.id)}
                className={[
                  'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                  'min-h-[110px]',
                  isActive
                    ? 'bg-green-500/10 border-green-500 ring-1 ring-green-500/30'
                    : 'bg-white/5 border-white/10 hover:border-white/30',
                ].join(' ')}
              >
                <div className="text-3xl leading-none select-none">{lang.flag}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={['font-bold text-base', isActive ? 'text-green-400' : 'text-white'].join(' ')}>
                      {lang.label}
                    </span>
                    {lang.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                        {lang.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">{lang.desc}</div>
                  <div className="text-xs text-slate-500 mt-1 font-mono truncate">{lang.sample}</div>
                </div>
                <div className={[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  isActive ? 'border-green-500 bg-green-500' : 'border-white/30',
                ].join(' ')}>
                  {isActive && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold text-base transition-colors shadow-lg shadow-green-500/20"
        >
          {loading ? 'Saving…' : 'Continue →'}
        </button>

        <p className="text-center text-slate-500 text-xs mt-4">
          This can be changed anytime from Profile Settings
        </p>
      </div>
    </div>
  );
}
