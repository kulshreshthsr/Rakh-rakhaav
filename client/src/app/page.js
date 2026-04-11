'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const FEATURES = [
  {
    icon: '🧾',
    titleHi: 'तेज़ Billing',
    desc: '10 seconds में GST bill बनाओ। Cash या उधार — सब record होता है।',
    accent: 'border-t-cyan-500',
    iconBg: 'bg-cyan-50',
  },
  {
    icon: '📦',
    titleHi: 'Stock Control',
    desc: 'हर product का stock real-time में दिखता है। कम होने पर alert आता है।',
    accent: 'border-t-emerald-500',
    iconBg: 'bg-emerald-50',
  },
  {
    icon: '💸',
    titleHi: 'उधार बही',
    desc: 'Customer का उधार कभी भूलो मत। WhatsApp से reminder भेजो।',
    accent: 'border-t-rose-500',
    iconBg: 'bg-rose-50',
  },
  {
    icon: '📊',
    titleHi: 'GST Summary',
    desc: 'GSTR-1, GSTR-3B ready। CA को CSV भेजो — एक click में।',
    accent: 'border-t-amber-500',
    iconBg: 'bg-amber-50',
  },
];

const STATS = [
  { value: '128+',   label: 'Bills आज' },
  { value: '1,240+', label: 'Products tracked' },
  { value: '100%',   label: 'GST Compliant' },
];

const TRUST = ['✓ GST Ready', '✓ उधार Track', '✓ Stock Alert', '✓ WhatsApp Bill'];

const STEPS = [
  { step: '01', title: 'Account बनाओ',    desc: 'बस नाम और phone — 30 seconds में ready।' },
  { step: '02', title: 'Products add करो', desc: 'Stock, price, GST rate — सब एक बार setup।' },
  { step: '03', title: 'Bill बनाओ',        desc: 'Customer को WhatsApp पर bill भेजो — तुरंत।' },
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-base shadow-md">
            र
          </div>
          <div>
            <div className="text-[17px] font-black tracking-tight text-slate-900 leading-none">
              रखरखाव
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              Simple Business App
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            Login करें
          </Link>
          <Link href="/register" className="inline-flex items-center px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:-translate-y-px hover:shadow-lg transition-all">
            Free शुरू करें
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-100/60 blur-3xl" />
          <div className="absolute -top-16 right-0 w-80 h-80 rounded-full bg-blue-100/50 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-5 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[11px] font-bold text-cyan-700 uppercase tracking-widest">
              Indian Dukaan के लिए बना है
            </span>
          </div>

          <h1 className="text-[clamp(34px,7vw,62px)] font-black leading-[1.08] tracking-tight text-slate-900 mb-5">
            रोज़ का हिसाब,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              GST, Stock
            </span>
            {' '}—<br />सब एक जगह।
          </h1>

          <p className="max-w-lg mx-auto text-[16px] leading-relaxed text-slate-500 mb-8">
            Bill बनाओ, उधार track करो, GST ready रखो।<br />
            बिल्कुल simple — किसी भी दुकान के लिए।
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all">
              Free में शुरू करें <span>→</span>
            </Link>
            <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-[15px] font-bold text-slate-700 bg-white border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
              Login करें
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {TRUST.map((t) => (
              <span key={t} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[12px] font-semibold text-slate-600 shadow-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="max-w-3xl mx-auto px-5 pb-6">
        <div className="flex items-stretch divide-x divide-slate-200 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {STATS.map((s) => (
            <div key={s.label} className="flex-1 flex flex-col items-center justify-center py-5 px-3 text-center">
              <div className="text-[26px] font-black tracking-tight text-cyan-600 leading-none">{s.value}</div>
              <div className="mt-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="max-w-4xl mx-auto px-5 pb-10">
        <div className="text-center mb-7">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Features</p>
          <h2 className="text-[clamp(22px,4vw,34px)] font-black tracking-tight text-slate-900">
            जो दुकान को चाहिए, वो सब है यहाँ
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.titleHi} className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${f.accent} p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all`}>
              <div className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center text-2xl mb-4`}>
                {f.icon}
              </div>
              <h3 className="text-[16px] font-black text-slate-900 mb-1">{f.titleHi}</h3>
              <p className="text-[13.5px] leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-3xl mx-auto px-5 pb-10">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-7 sm:p-10 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">कैसे काम करता है</p>
          <h2 className="text-[clamp(20px,4vw,30px)] font-black tracking-tight mb-8 leading-tight">
            3 steps में शुरू हो जाओ
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <div className="text-[38px] font-black text-slate-700 leading-none tracking-tighter">{item.step}</div>
                <div>
                  <div className="text-[15px] font-black text-white mb-1">{item.title}</div>
                  <div className="text-[13px] leading-relaxed text-slate-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="max-w-3xl mx-auto px-5 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600 p-7 sm:p-10 text-center shadow-2xl">
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10" />
          <div className="relative z-10">
            <h2 className="text-[clamp(22px,4vw,32px)] font-black text-white mb-3 leading-tight">
              अभी शुरू करो — Free है
            </h2>
            <p className="text-[14px] text-white/80 mb-7 max-w-sm mx-auto leading-relaxed">
              कोई credit card नहीं चाहिए।<br />बस account बनाओ और शुरू हो जाओ।
            </p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-[15px] font-black text-cyan-600 bg-white shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all">
              Free Account बनाएं →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-6 px-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow">
            र
          </div>
          <span className="text-[15px] font-black text-slate-800">रखरखाव</span>
        </div>
        <p className="text-[12px] text-slate-400">
          Simple business app for Indian shops · GST Ready · Made in India 🇮🇳
        </p>
      </footer>

    </div>
  );
}