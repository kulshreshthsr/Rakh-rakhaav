'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import UpgradeModal from '../../components/subscription/UpgradeModal';
import {
  API, FALLBACK_PLANS, formatCurrency, getToken,
  mergePlansWithFallback, readStoredSubscription, writeStoredSubscription,
} from '../../lib/subscription';

/* ── Plan metadata (UNCHANGED) ── */
const PLAN_STYLES = {
  weekly:    { badge: 'Trial Pack' },
  monthly:   { badge: null },
  six_month: { badge: 'Most Chosen' },
  yearly:    { badge: 'Best Savings' },
};

const COMPARISON_ROWS = [
  ['Premium billing',        true, true, true, true],
  ['GST reports',            true, true, true, true],
  ['Inventory & purchases',  true, true, true, true],
  ['Lower monthly cost',     false, false, true, true],
];

const getEffectiveMonthly = (plan) => {
  if (plan.id === 'weekly') return Math.round((plan.amount || 0) * (30 / 7));
  const months = plan.id === 'yearly' ? 12 : plan.id === 'six_month' ? 6 : 1;
  return Math.round((plan.amount || 0) / months);
};

/* ── Border accent per plan ── */
const PLAN_BORDER = {
  weekly:    'border-l-cyan-400',
  monthly:   'border-l-blue-400',
  six_month: 'border-l-indigo-500',
  yearly:    'border-l-slate-800',
};

/* ── Badge color per plan ── */
const BADGE_CLS = {
  weekly:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  monthly:   'bg-blue-50 text-blue-700 border-blue-200',
  six_month: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  yearly:    'bg-slate-900 text-white border-slate-900',
};

/* ════════════════════════════════════════════════════════════════ */
export default function PricingPage() {
  /* ── All state (UNCHANGED) ── */
  const [plans,         setPlans]         = useState(FALLBACK_PLANS);
  const [subscription,  setSubscription]  = useState(() => readStoredSubscription());
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [selectedPlan,  setSelectedPlan]  = useState('weekly');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoggedIn] = useState(() => Boolean(getToken()));

  /* ── Fetch logic (UNCHANGED) ── */
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/auth/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const nextPlans = mergePlansWithFallback(data.plans);
        setPlans(nextPlans);
        setSubscription(data.subscription || null);
        writeStoredSubscription(data.subscription || null);
        setRazorpayKeyId(data.razorpayKeyId || '');
        setSelectedPlan((currentPlan) => (
          nextPlans.some((plan) => plan.id === currentPlan) ? currentPlan : (nextPlans[0]?.id || 'weekly')
        ));
      })
      .catch(() => {});
  }, []);

  /* ── Derived (UNCHANGED) ── */
  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) || plans[0] || FALLBACK_PLANS[0],
    [plans, selectedPlan]
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-16">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* ── HERO ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-6 text-white shadow-xl">
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-widest text-white/80 mb-3">
              Choose Your Plan
            </span>
            <h1 className="text-[22px] font-black leading-tight tracking-tight mb-2">
              अपने business के लिए<br />सही plan चुनिए
            </h1>
            <p className="text-[13px] text-white/70 leading-relaxed">
              Flexible billing plans जो Indian retailers के daily काम के लिए बने हैं
            </p>
          </div>
        </div>

        {/* ── PLAN CARDS ── */}
        <div className="space-y-3">
          {plans.map((plan) => {
            const badge = plan.badge || PLAN_STYLES[plan.id]?.badge;
            const isSelected = selectedPlan === plan.id;
            const effective = getEffectiveMonthly(plan);
            const borderCls = PLAN_BORDER[plan.id] || 'border-l-slate-300';
            const badgeCls  = BADGE_CLS[plan.id]  || 'bg-slate-100 text-slate-600 border-slate-200';

            return (
              <article
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative bg-white rounded-2xl border-2 border-l-4 ${borderCls} cursor-pointer transition-all overflow-hidden ${
                  isSelected
                    ? 'border-cyan-400 shadow-lg shadow-cyan-500/15 -translate-y-0.5'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Selected indicator bar */}
                {isSelected && (
                  <div className="h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500" />
                )}

                <div className="px-5 py-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[15px] font-black text-slate-900">{plan.label}</p>
                      {plan.description && (
                        <p className="text-[12px] text-slate-500 mt-0.5 leading-snug max-w-[240px]">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[24px] font-black text-slate-900 leading-none">{formatCurrency(plan.amount)}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{formatCurrency(effective)}/month</p>
                    </div>
                  </div>

                  {/* Badge + saving row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {badge && (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${badgeCls}`}>
                        {badge}
                      </span>
                    )}
                    {plan.savingsLabel && (
                      <span className="text-[11px] font-bold text-emerald-600">{plan.savingsLabel}</span>
                    )}
                  </div>

                  {/* Select / Selected indicator */}
                  <div className="mt-3">
                    {isSelected ? (
                      <div className="flex items-center gap-2 text-[12px] font-black text-cyan-700">
                        <div className="w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[8px]">✓</div>
                        Checkout के लिए selected
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan.id); }}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Plan select करें
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── COMPARISON TABLE ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[14px] font-black text-slate-900">Plan Comparison</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">Feature</th>
                  {['Weekly', 'Monthly', '6 Month', 'Yearly'].map((h) => (
                    <th key={h} className="px-3 py-3 text-center font-bold text-slate-500 text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {COMPARISON_ROWS.map(([label, weekly, monthly, sixMonth, yearly]) => (
                  <tr key={label} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{label}</td>
                    {[weekly, monthly, sixMonth, yearly].map((val, i) => (
                      <td key={i} className="px-3 py-3 text-center">
                        {val
                          ? <span className="text-emerald-500 font-black">✓</span>
                          : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CHECKOUT CARD (desktop) ── */}
        <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
          <div className="px-5 py-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment</p>
                <p className="text-[16px] font-black text-slate-900">{selected?.label || 'Premium membership'}</p>
                <p className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black">i</span>
                  One-time billing
                </p>
              </div>
              <p className="text-[28px] font-black text-slate-900 flex-shrink-0">{formatCurrency(selected?.amount || 0)}</p>
            </div>

            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="w-full py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                Checkout पर जाओ →
              </button>
            ) : (
              <Link
                href="/register"
                className="flex items-center justify-center w-full py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl transition-all no-underline"
              >
                अभी unlock करें →
              </Link>
            )}
          </div>
        </div>

      </div>

      {/* ── MOBILE STICKY BOTTOM BAR ── */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[13px] font-black text-slate-900">{selected?.label || 'Premium membership'}</p>
            <p className="text-[11px] text-slate-400">One-time billing</p>
          </div>
          <p className="text-[20px] font-black text-slate-900 flex-shrink-0">{formatCurrency(selected?.amount || 0)}</p>
        </div>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="w-full py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:shadow-xl transition-all"
          >
            Checkout पर जाओ →
          </button>
        ) : (
          <Link
            href="/register"
            className="flex items-center justify-center w-full py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 transition-all no-underline"
          >
            अभी unlock करें →
          </Link>
        )}
      </div>

      {/* ── UPGRADE MODAL (100% UNCHANGED — same props, same handlers) ── */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        plans={plans}
        subscription={subscription}
        razorpayKeyId={razorpayKeyId}
        initialPlan={selectedPlan}
        onSuccess={(nextSubscription) => {
          setSubscription(nextSubscription || null);
          writeStoredSubscription(nextSubscription || null);
          setShowUpgradeModal(false);
        }}
      />
    </div>
  );
}