'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import { listIndustries } from '../../lib/industries';
import { writeStoredBusinessType } from '../../contexts/IndustryContext';
import { hasWelcomePending, setWelcomePending } from '../../lib/subscription';

const ONBOARDING_PENDING_KEY = 'rr-onboarding-pending';

export function setOnboardingPending() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_PENDING_KEY, '1');
}

export function clearOnboardingPending() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_PENDING_KEY);
}

export function hasOnboardingPending() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_PENDING_KEY) === '1';
}

const ALL_INDUSTRIES = listIndustries();

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    // If onboarding isn't pending (e.g. user navigated here manually), allow it anyway
  }, [router]);

  const handleContinue = async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessType: selected }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || 'Could not save. Please try again.');
        return;
      }

      // Store in localStorage so IndustryContext picks it up immediately
      writeStoredBusinessType(selected);
      clearOnboardingPending();

      // If welcome screen is still pending, go there; otherwise go to dashboard
      router.push(hasWelcomePending() ? '/welcome' : '/dashboard');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const selectedConfig = ALL_INDUSTRIES.find((i) => i.id === selected) || ALL_INDUSTRIES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center text-white font-black text-base shadow-md shadow-green-500/30">
          ₹
        </div>
        <div>
          <div className="text-[16px] font-black tracking-tight text-slate-900 leading-none">रखरखाव</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-green-700">Setup</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-8 max-w-3xl mx-auto w-full">

        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-800">Step 1 of 1</span>
          </div>
          <h1 className="text-[clamp(22px,4vw,32px)] font-black tracking-tight text-slate-900 leading-tight">
            आपका business किस type का है?
          </h1>
          <p className="mt-2 text-[14px] text-slate-500 leading-relaxed max-w-md mx-auto">
            यह चुनने से app आपके business के अनुसार terms, invoice fields और features show करेगा।
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] font-semibold text-red-700">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Industry Grid */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {ALL_INDUSTRIES.map((ind) => {
            const isActive = selected === ind.id;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => setSelected(ind.id)}
                className={`
                  relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-center
                  transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500/40
                  ${isActive
                    ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg shadow-green-500/15'
                    : 'border-slate-200 bg-white hover:border-green-300'
                  }
                `}
              >
                {/* Selection indicator */}
                {isActive && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}

                <span className="text-2xl leading-none">{ind.icon}</span>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[11px] font-black leading-tight ${isActive ? 'text-green-900' : 'text-slate-800'}`}>
                    {ind.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{ind.labelHindi}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected preview card */}
        {selectedConfig && (
          <div className="w-full mb-6 px-5 py-4 rounded-2xl border-2 border-green-200 bg-white/80 flex items-start gap-4">
            <span className="text-3xl flex-shrink-0 mt-0.5">{selectedConfig.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-black text-slate-900">{selectedConfig.label}</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {selectedConfig.terminology.product} inventory
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {selectedConfig.terminology.invoice}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {selectedConfig.terminology.supplier}
                </span>
                {selectedConfig.modules.batchTracking && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                    Batch tracking
                  </span>
                )}
                {selectedConfig.modules.expiryTracking && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                    Expiry alerts
                  </span>
                )}
                {selectedConfig.modules.variants && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700">
                    Size/Color variants
                  </span>
                )}
                {selectedConfig.modules.appointments && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-700">
                    Appointments
                  </span>
                )}
                {selectedConfig.modules.serviceJobs && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700">
                    Service jobs
                  </span>
                )}
              </div>
              {selectedConfig.invoiceLineFields.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-500">
                  Invoice line fields: {selectedConfig.invoiceLineFields.map((f) => f.label).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-green-700 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving...
            </>
          ) : (
            <>Continue with {selectedConfig?.label} →</>
          )}
        </button>

        <p className="mt-4 text-[12px] text-slate-400 text-center">
          आप यह setting बाद में Profile → Shop settings से बदल सकते हैं।
        </p>
      </div>
    </div>
  );
}
