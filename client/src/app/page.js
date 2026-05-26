'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const FEATURES = [
  {
    icon: '🧾',
    titleHi: 'तेज़ Billing',
    titleEn: 'Fast Billing',
    desc: 'GST bill 10 second में बनाओ। Customer को WhatsApp पे भेजो — printed copy भी निकालो।',
    accent: 'border-t-emerald-700',
    iconBg: 'bg-emerald-50',
  },
  {
    icon: '📦',
    titleHi: 'Stock Control',
    titleEn: 'Inventory Management',
    desc: 'हर product का stock real-time में दिखता है। कम होने पर alert मिलता है।',
    accent: 'border-t-green-700',
    iconBg: 'bg-green-50',
  },
  {
    icon: '💸',
    titleHi: 'उधार बही',
    titleEn: 'Credit Ledger',
    desc: 'Customer का उधार कभी भूलो मत। WhatsApp से reminder भेजो — payment track करो।',
    accent: 'border-t-teal-700',
    iconBg: 'bg-teal-50',
  },
  {
    icon: '📊',
    titleHi: 'GST Summary',
    titleEn: 'GST Reports',
    desc: 'GSTR-1, GSTR-3B ready। CA को CSV भेजो — एक click में काम हो जाए।',
    accent: 'border-t-lime-600',
    iconBg: 'bg-lime-50',
  },
];

const TESTIMONIALS = [
  {
    name: 'राजेश कुमार',
    shop: 'राजेश किराना स्टोर, दिल्ली',
    text: 'पहले रजिस्टर में लिखता था, अब mobile में। सब organized रहता है। बढ़िया app है भाई।',
    rating: 5,
    photo: '👨‍💼'
  },
  {
    name: 'सुनील पाटिल',
    shop: 'पाटिल ट्रेडर्स, पुणे',
    text: 'GST filing आसान हो गई। CA को CSV file देता हूँ — 5 मिनट में काम हो जाता है।',
    rating: 5,
    photo: '👨'
  },
  {
    name: 'अमित शर्मा',
    shop: 'शर्मा इलेक्ट्रॉनिक्स, कानपुर',
    text: 'उधार का पूरा हिसाब रहता है। Customer को WhatsApp reminder — पैसा समय पे आ जाता है।',
    rating: 5,
    photo: '👨‍💻'
  },
];

const TRUST_BADGES = [
  { icon: '✓', text: 'GST Ready', color: 'text-emerald-700' },
  { icon: '🇮🇳', text: 'Made in India', color: 'text-orange-600' },
  { icon: '🔒', text: 'Data Safe', color: 'text-green-700' },
  { icon: '📱', text: 'Offline चले', color: 'text-teal-700' },
];

const PRICING = [
  { 
    duration: '7 दिन',
    price: 'FREE',
    priceHi: 'बिल्कुल मुफ्त',
    features: ['सभी features unlock', 'कोई limit नहीं', 'Credit card की ज़रूरत नहीं'],
    popular: false
  },
  { 
    duration: 'हफ्ता',
    price: '₹120',
    priceHi: 'बस ₹17/दिन',
    features: ['Unlimited bills', 'WhatsApp support', 'GST reports'],
    popular: false
  },
  { 
    duration: 'साल',
    price: '₹3,600',
    priceHi: 'सिर्फ ₹300/महीना',
    features: ['सबसे सस्ता plan', '38% बचत', 'Priority support'],
    popular: true,
    badge: '⭐ सबसे ज्यादा लोग यही लेते हैं'
  },
];

const STATS = [
  { value: '1,000+', label: 'दुकानें trust करती हैं', icon: '🏪' },
  { value: '50,000+', label: 'Bills बने', icon: '🧾' },
  { value: '100%', label: 'GST Compliant', icon: '✓' },
  { value: '4.8★', label: 'Rating', icon: '⭐' },
];

export default function HomePage() {
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-emerald-50">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-green-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">₹</span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-slate-900 leading-none tracking-tight">
                रखरखाव
              </div>
              <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                Simple Business App
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:bg-green-50 rounded-lg transition">
              Login करें
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-green-700 to-emerald-700 text-white text-sm font-black rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Free शुरू करें
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-28">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-200/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 sm:gap-3 px-4 py-2.5 bg-white border-2 border-green-200 rounded-full mb-8 shadow-md">
              <span className="text-xl sm:text-2xl">🇮🇳</span>
              <span className="text-xs sm:text-sm font-bold text-green-800">
                Indian Dukaan के लिए बना है
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 mb-6 leading-[1.1] px-4">
              रोज़ का<br />
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-700 via-emerald-700 to-green-800">
                  हिसाब, GST & Stock
                </span>
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full" />
              </span>
              <br />सब एक जगह।
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 mb-3 max-w-2xl mx-auto leading-relaxed px-4">
              Bill बनाओ, उधार track करो, GST ready रखो।
            </p>
            <p className="text-sm sm:text-base text-slate-500 mb-10 max-w-xl mx-auto px-4">
              बिल्कुल simple — किसी भी दुकान के लिए। Internet नहीं तो भी चलता है।
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 px-4">
              <Link href="/register" className="w-full sm:w-auto px-6 sm:px-10 py-4 bg-gradient-to-r from-green-700 to-emerald-700 text-white text-base sm:text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all">
                Free में शुरू करें →
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-6 sm:px-10 py-4 bg-white border-2 border-slate-300 text-slate-700 text-base sm:text-lg font-bold rounded-xl hover:border-green-700 hover:bg-green-50 transition-all">
                Login करें
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-4">
              {TRUST_BADGES.map((badge) => (
                <span key={badge.text} className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold ${badge.color} shadow-sm`}>
                  <span className="text-base sm:text-lg">{badge.icon}</span>
                  <span className="hidden sm:inline">{badge.text}</span>
                  <span className="sm:hidden">{badge.text.split(' ')[0]}</span>
                </span>
              ))}
            </div>
          </div>

          {/* App Screenshot placeholder */}
          <div className="max-w-5xl mx-auto px-4">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 aspect-[16/10] sm:aspect-video flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="text-5xl sm:text-7xl mb-4">📱</div>
                  <p className="text-lg sm:text-2xl font-bold text-slate-700 mb-2">App Dashboard</p>
                  <p className="text-xs sm:text-sm text-slate-500">Bills • Stock • GST Reports</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-green-900/10 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="py-8 sm:py-12 bg-gradient-to-r from-green-700 to-emerald-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center text-white">
                <div className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">
                  {stat.icon} {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs md:text-sm font-semibold opacity-90">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-12 sm:py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-green-700 mb-2 sm:mb-3">सब कुछ मिलेगा</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-3 sm:mb-4 px-4">
              जो दुकान को चाहिए,<br className="sm:hidden" /> वो सब है यहाँ
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto px-4">
              बिल्कुल simple — किसी को भी समझ आएगा
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.titleHi} className={`group bg-white rounded-2xl border-2 border-slate-200 border-t-4 ${feature.accent} p-5 sm:p-7 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl ${feature.iconBg} flex items-center justify-center text-3xl sm:text-4xl mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 mb-1">{feature.titleHi}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 sm:mb-3">{feature.titleEn}</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-12 sm:py-20 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-green-700 mb-2 sm:mb-3">Real Reviews</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-3 sm:mb-4 px-4">
              दूसरे दुकानदार<br className="sm:hidden" /> क्या कहते हैं
            </h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">
              अपने जैसे लोगों की बात सुनो
            </p>
          </div>

          <div className="relative bg-white rounded-2xl p-6 sm:p-10 shadow-xl border-2 border-green-200">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 ${idx === currentTestimonial ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 p-6 sm:p-10 pointer-events-none'}`}
              >
                <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="text-4xl sm:text-5xl">{testimonial.photo}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1 sm:mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <span key={i} className="text-yellow-500 text-base sm:text-xl">★</span>
                      ))}
                    </div>
                    <h4 className="font-bold text-base sm:text-lg text-slate-900">{testimonial.name}</h4>
                    <p className="text-xs sm:text-sm text-green-700 font-medium">{testimonial.shop}</p>
                  </div>
                </div>
                <p className="text-base sm:text-lg leading-relaxed text-slate-700 italic">
                  "{testimonial.text}"
                </p>
              </div>
            ))}

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6 sm:mt-8">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-green-700 w-8' : 'bg-slate-300 w-2'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-12 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-green-700 mb-2 sm:mb-3">तीन आसान Steps</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-3 sm:mb-4 px-4">
              3 steps में<br className="sm:hidden" /> शुरू हो जाओ
            </h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">
              बस 5 मिनट — कोई झंझट नहीं
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
            {[
              { num: '1', title: 'Account बनाओ', desc: 'बस mobile number — 2 मिनट में ready', color: 'from-green-100 to-green-200' },
              { num: '2', title: 'Products डालो', desc: 'माल add करो — price, stock, GST', color: 'from-emerald-100 to-emerald-200' },
              { num: '3', title: 'Bill बनाओ', desc: 'WhatsApp पे भेजो — हो गया!', color: 'from-teal-100 to-teal-200' }
            ].map((step) => (
              <div key={step.num} className="text-center group">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                  <span className="text-3xl sm:text-4xl font-black text-green-800">{step.num}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm sm:text-base text-slate-600 px-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-12 sm:py-20 lg:py-24 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-green-700 mb-2 sm:mb-3">Affordable Pricing</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-3 sm:mb-4 px-4">
              हर जेब के<br className="sm:hidden" /> अनुसार Plan
            </h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">
              7 दिन free try करो — पसंद आए तो लो
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.duration} className={`relative bg-white rounded-2xl p-5 sm:p-7 border-2 ${plan.popular ? 'border-green-600 shadow-2xl scale-105 md:scale-110' : 'border-slate-200 shadow-lg'} transition-all hover:scale-105`}>
                {plan.popular && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-green-700 to-emerald-700 text-white text-[10px] sm:text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}
                
                <div className="text-center mb-5 sm:mb-6 pt-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-500 uppercase mb-2">{plan.duration}</div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-1">{plan.price}</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-500">{plan.priceHi}</div>
                </div>

                <ul className="space-y-2 sm:space-y-3 mb-5 sm:mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-green-600 font-bold text-base sm:text-lg">✓</span>
                      <span className="text-xs sm:text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`block text-center px-4 sm:px-6 py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${plan.popular ? 'bg-gradient-to-r from-green-700 to-emerald-700 text-white shadow-lg hover:shadow-xl' : 'bg-slate-100 text-slate-700 hover:bg-green-50 hover:text-green-700'}`}>
                  शुरू करें
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs sm:text-sm text-slate-500 mt-6 sm:mt-10 px-4">
            सभी plans में GST शामिल • कभी भी cancel करो • Data 100% safe
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-green-700 via-emerald-700 to-green-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 px-4">
            आज ही शुरू करो —<br className="sm:hidden" /> 7 दिन Free
          </h2>
          <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 opacity-95 px-4">
            हजारों दुकानदार इस्तेमाल कर रहे हैं। अब आपकी बारी।
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <Link href="/register" className="w-full sm:w-auto px-6 sm:px-10 py-4 bg-white text-green-800 text-base sm:text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all">
              Free Account बनाएं →
            </Link>
            <a href="https://wa.me/919876543210" className="w-full sm:w-auto px-6 sm:px-10 py-4 bg-emerald-600 text-white text-base sm:text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
              <span>📱</span> WhatsApp Support
            </a>
          </div>
          <p className="text-xs sm:text-sm mt-6 sm:mt-8 opacity-80 px-4">
            कोई credit card नहीं • Cancel कभी भी • Data पूरा safe
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 sm:gap-10 mb-8 sm:mb-10">
            <div>
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-lg sm:text-xl">₹</span>
                </div>
                <div>
                  <div className="text-base sm:text-lg font-black leading-none">रखरखाव</div>
                  <div className="text-[10px] font-semibold text-green-400 uppercase mt-0.5">Simple Business App</div>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xs">
                भारतीय दुकानों के लिए बनाया गया<br />
                Made with ❤️ in India 🇮🇳
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-10">
              <div>
                <h4 className="font-bold mb-3 text-xs sm:text-sm text-green-400">Product</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                  <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                  <li><a href="#features" className="hover:text-white transition">Features</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-xs sm:text-sm text-emerald-400">Support</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                  <li><a href="https://wa.me/919876543210" className="hover:text-white transition">WhatsApp</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Email</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-xs sm:text-sm text-teal-400">Legal</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Privacy</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-slate-800 text-center text-xs sm:text-sm text-slate-500">
            © 2026 Rakh-Rakhaav • GST Compliant • Secure • Trusted by 1000+ Shops
          </div>
        </div>
      </footer>

    </div>
  );
}