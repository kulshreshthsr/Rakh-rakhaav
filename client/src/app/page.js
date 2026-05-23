'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const FEATURES = [
  {
    icon: '⚡',
    titleHi: 'तेज़ Billing',
    titleEn: 'Lightning Fast Billing',
    desc: 'GST bill 10 second में। Customer को WhatsApp पे instant भेजो — professional print भी निकालो।',
    gradient: 'from-indigo-500 to-violet-500',
    iconBg: 'bg-gradient-to-br from-indigo-100 to-violet-100',
  },
  {
    icon: '📦',
    titleHi: 'स्मार्ट Stock',
    titleEn: 'Smart Inventory',
    desc: 'Real-time stock tracking। कम होने पर instant alert। कभी shortage का झंझट नहीं।',
    gradient: 'from-violet-500 to-purple-500',
    iconBg: 'bg-gradient-to-br from-violet-100 to-purple-100',
  },
  {
    icon: '💰',
    titleHi: 'उधार Manager',
    titleEn: 'Credit Management',
    desc: 'किसका कितना बाकी — सब clear। Auto WhatsApp reminders। Payment collection आसान।',
    gradient: 'from-purple-500 to-fuchsia-500',
    iconBg: 'bg-gradient-to-br from-purple-100 to-fuchsia-100',
  },
  {
    icon: '📊',
    titleHi: 'GST Autopilot',
    titleEn: 'GST on Autopilot',
    desc: 'GSTR-1, 3B एक click में। CA को direct भेजो। Tax filing का headache खत्म।',
    gradient: 'from-fuchsia-500 to-pink-500',
    iconBg: 'bg-gradient-to-br from-fuchsia-100 to-pink-100',
  },
];

const TESTIMONIALS = [
  {
    name: 'राजेश कुमार',
    shop: 'राजेश किराना स्टोर, दिल्ली',
    text: 'App का interface बहुत smooth है। Customers भी impress होते हैं जब instant WhatsApp पे bill आता है।',
    rating: 5,
    avatar: '👨‍💼',
    color: 'from-indigo-500 to-violet-500'
  },
  {
    name: 'सुनील पाटिल',
    shop: 'पाटिल ट्रेडर्स, पुणे',
    text: 'GST filing पहले 2 दिन लगता था, अब 10 मिनट। CA भी खुश है। Best investment किया है।',
    rating: 5,
    avatar: '👨',
    color: 'from-violet-500 to-purple-500'
  },
  {
    name: 'अमित शर्मा',
    shop: 'शर्मा इलेक्ट्रॉनिक्स, कानपुर',
    text: 'Udhaar collection 40% बढ़ गया। WhatsApp reminders काम करते हैं। ROI मिल गया पहले महीने में।',
    rating: 5,
    avatar: '👨‍💻',
    color: 'from-purple-500 to-fuchsia-500'
  },
];

const TRUST_BADGES = [
  { icon: '✓', text: 'GST Ready', gradient: 'from-emerald-500 to-teal-500' },
  { icon: '🇮🇳', text: 'Made in India', gradient: 'from-orange-500 to-red-500' },
  { icon: '🔒', text: 'Bank-Level Security', gradient: 'from-indigo-500 to-violet-500' },
  { icon: '📱', text: 'Works Offline', gradient: 'from-violet-500 to-purple-500' },
];

const PRICING = [
  { 
    duration: '7 दिन',
    price: 'FREE',
    priceHi: 'पूरा access',
    features: ['सभी Premium features', 'Unlimited bills', 'कोई limit नहीं', 'Credit card नहीं चाहिए'],
    popular: false,
    gradient: 'from-slate-50 to-slate-100'
  },
  { 
    duration: 'साल',
    price: '₹3,600',
    priceHi: 'सिर्फ ₹300/महीना',
    features: ['38% की बचत', 'Priority WhatsApp support', 'Early access to new features', 'Dedicated account manager'],
    popular: true,
    gradient: 'from-indigo-500 to-violet-600',
    badge: '🔥 सबसे ज्यादा value'
  },
  { 
    duration: 'महीना',
    price: '₹400',
    priceHi: 'बस ₹13/दिन',
    features: ['Month-to-month', 'Cancel कभी भी', 'सभी features', 'WhatsApp support'],
    popular: false,
    gradient: 'from-slate-50 to-slate-100'
  },
];

const STATS = [
  { value: '1,000+', label: 'Active Shops', icon: '🏪', gradient: 'from-indigo-500 to-violet-500' },
  { value: '50K+', label: 'Bills Generated', icon: '🧾', gradient: 'from-violet-500 to-purple-500' },
  { value: '₹2.5Cr+', label: 'Revenue Tracked', icon: '💰', gradient: 'from-purple-500 to-fuchsia-500' },
  { value: '4.9★', label: 'User Rating', icon: '⭐', gradient: 'from-fuchsia-500 to-pink-500' },
];

export default function HomePage() {
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    router.replace(getPostAuthRoute(readStoredSubscription()));
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/30">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-indigo-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-xl">र</span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent leading-none tracking-tight">
                रखरखाव
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Smart Business App
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:bg-indigo-50 rounded-lg transition">
              Login
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all">
              Free शुरू करें
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-32">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -right-1/4 w-[800px] h-[800px] bg-gradient-to-br from-indigo-200/40 via-violet-200/40 to-purple-200/40 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-fuchsia-200/30 to-pink-200/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 sm:mb-20">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 sm:gap-3 px-4 py-2.5 bg-white/90 backdrop-blur-sm border border-indigo-200 rounded-full mb-8 shadow-lg shadow-indigo-500/10">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500">
                <span className="text-white text-xs">✓</span>
              </span>
              <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                1000+ दुकानदार trust करते हैं • Made in India 🇮🇳
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-slate-900 mb-6 leading-[1.05] px-4">
              अपनी दुकान को
              <br />
              <span className="relative inline-block mt-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 animate-gradient">
                  Digital बनाओ
                </span>
                <div className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-full blur-sm" />
              </span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-slate-600 mb-4 max-w-3xl mx-auto leading-relaxed px-4 font-medium">
              Bills, Stock, उधार, GST — सब एक जगह
            </p>
            <p className="text-base sm:text-lg text-slate-500 mb-12 max-w-2xl mx-auto px-4">
              Mobile, Tablet, Computer — कहीं भी चलाओ। Internet नहीं तो भी काम करता है।
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 px-4">
              <Link href="/register" className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-lg font-black rounded-xl shadow-2xl shadow-indigo-500/30 hover:shadow-3xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all relative overflow-hidden">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  7 दिन Free Try करें
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 text-lg font-bold rounded-xl hover:border-indigo-600 hover:bg-indigo-50 hover:-translate-y-1 transition-all shadow-lg">
                Pricing देखें
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-3 px-4">
              {TRUST_BADGES.map((badge) => (
                <span key={badge.text} className="group inline-flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold shadow-md hover:shadow-lg transition-all">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-r ${badge.gradient} text-white text-xs shadow-sm`}>
                    {badge.icon}
                  </span>
                  <span className="text-slate-700">{badge.text}</span>
                </span>
              ))}
            </div>
          </div>

          {/* App Screenshot with 3D effect */}
          <div className="max-w-6xl mx-auto px-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-gradient-to-br from-slate-100 to-slate-200 aspect-video transform group-hover:scale-[1.02] transition-transform">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-7xl mb-6 animate-bounce">🚀</div>
                    <p className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-3">
                      Dashboard Preview
                    </p>
                    <p className="text-sm text-slate-500">Real-time Bills • Stock • GST Reports</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/10 via-transparent to-violet-600/10 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10">
            {STATS.map((stat, idx) => (
              <div key={stat.label} className="text-center text-white transform hover:scale-110 transition-transform">
                <div className="text-5xl sm:text-6xl font-black mb-2 drop-shadow-lg">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-bold opacity-90 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-3">
              Powerful Features
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4 px-4">
              सब कुछ जो आपको चाहिए
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto px-4">
              Professional tools, simple interface
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature, idx) => (
              <div key={feature.titleHi} className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-transparent hover:shadow-2xl transition-all duration-300 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                
                <div className={`relative w-16 h-16 rounded-2xl ${feature.iconBg} flex items-center justify-center text-4xl mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all`}>
                  {feature.icon}
                </div>
                
                <h3 className={`text-2xl font-black mb-1 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.titleHi}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
                  {feature.titleEn}
                </p>
                <p className="text-base leading-relaxed text-slate-600">
                  {feature.desc}
                </p>
                
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-3">
              Success Stories
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4 px-4">
              Real Results, Real People
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 px-4">
              हजारों दुकानदार already इस्तेमाल कर रहे हैं
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-3xl blur-lg opacity-20" />
            
            <div className="relative bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-200">
              {TESTIMONIALS.map((testimonial, idx) => (
                <div
                  key={idx}
                  className={`transition-all duration-500 ${idx === currentTestimonial ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 p-8 sm:p-12 pointer-events-none'}`}
                >
                  <div className="flex items-start gap-5 mb-6">
                    <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${testimonial.color} text-4xl shadow-lg`}>
                      {testimonial.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <span key={i} className="text-yellow-500 text-xl">★</span>
                        ))}
                      </div>
                      <h4 className="font-black text-xl text-slate-900">{testimonial.name}</h4>
                      <p className={`text-sm font-bold bg-gradient-to-r ${testimonial.color} bg-clip-text text-transparent`}>
                        {testimonial.shop}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl leading-relaxed text-slate-700 font-medium italic">
                    "{testimonial.text}"
                  </p>
                </div>
              ))}

              <div className="flex justify-center gap-2 mt-10">
                {TESTIMONIALS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentTestimonial(idx)}
                    className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-gradient-to-r from-indigo-600 to-violet-600 w-12' : 'bg-slate-300 w-2'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-3">
              Simple Pricing
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4 px-4">
              हर बजट के लिए Perfect Plan
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 px-4">
              7 दिन free — फिर choose करो
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.duration} className={`relative rounded-3xl p-8 border-2 ${plan.popular ? 'border-transparent shadow-2xl scale-105' : 'border-slate-200 bg-white shadow-lg'} transition-all hover:scale-105`}>
                {plan.popular && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} rounded-3xl`} />
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-black rounded-full shadow-lg whitespace-nowrap">
                      {plan.badge}
                    </div>
                  </>
                )}
                
                <div className={`relative text-center mb-8 ${plan.popular ? 'text-white' : ''}`}>
                  <div className="text-sm font-bold uppercase mb-2 opacity-90">{plan.duration}</div>
                  <div className="text-5xl font-black mb-1">{plan.price}</div>
                  <div className="text-sm font-semibold opacity-80">{plan.priceHi}</div>
                </div>

                <ul className={`relative space-y-4 mb-8 ${plan.popular ? 'text-white' : ''}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${plan.popular ? 'bg-white/20' : 'bg-gradient-to-r from-emerald-500 to-teal-500'} flex-shrink-0`}>
                        <span className={`text-sm font-bold ${plan.popular ? 'text-white' : 'text-white'}`}>✓</span>
                      </span>
                      <span className="text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`relative block text-center px-6 py-3.5 rounded-xl font-black transition-all ${plan.popular ? 'bg-white text-violet-600 hover:bg-slate-50 shadow-xl' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-xl'}`}>
                  शुरू करें →
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-10 px-4">
            सभी plans में GST included • कभी भी cancel करो • 100% money-back guarantee
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center text-white">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 px-4 leading-tight">
            Ready to Transform<br />Your Dukaan?
          </h2>
          <p className="text-xl sm:text-2xl mb-12 opacity-95 px-4 font-medium">
            Join 1000+ shopkeepers already using Rakh-Rakhaav
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <Link href="/register" className="group w-full sm:w-auto px-10 py-5 bg-white text-indigo-600 text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all">
              <span className="flex items-center justify-center gap-2">
                Free Account बनाएं
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </Link>
            <a href="https://wa.me/919876543210" className="w-full sm:w-auto px-10 py-5 bg-emerald-500 text-white text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
              <span className="text-2xl">📱</span>
              WhatsApp Support
            </a>
          </div>
          
          <p className="text-sm mt-10 opacity-80 px-4">
            No credit card • Cancel anytime • Your data is 100% secure
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <span className="text-white font-black text-xl">र</span>
                </div>
                <div>
                  <div className="text-xl font-black bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    रखरखाव
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Smart Business App
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                भारतीय दुकानों के लिए बनाया गया।<br />
                Made with ❤️ in India 🇮🇳
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div>
                <h4 className="font-bold mb-4 text-sm bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Product</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                  <li><Link href="/demo" className="hover:text-white transition">Live Demo</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Support</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><a href="https://wa.me/919876543210" className="hover:text-white transition">WhatsApp</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Email</a></li>
                  <li><Link href="/help" className="hover:text-white transition">Help Center</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Company</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            <p>© 2026 Rakh-Rakhaav • GST Compliant • Bank-Level Security • Trusted by 1000+ Indian Shops</p>
          </div>
        </div>
      </footer>

    </div>
  );
}