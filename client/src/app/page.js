'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const FEATURES = [
  {
    icon: '🧾',
    titleHi: 'पक्का बिल',
    titleEn: 'Professional Billing',
    desc: 'GST bill 10 second में। Customer को WhatsApp पे भेजो — printed copy भी निकालो।',
    accent: 'border-t-teal-600',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600'
  },
  {
    icon: '📦',
    titleHi: 'माल का हिसाब',
    titleEn: 'Stock Management',
    desc: 'कौन सा item कितना है — सब दिखता है। Stock कम हुआ तो तुरंत पता चल जाएगा।',
    accent: 'border-t-emerald-600',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600'
  },
  {
    icon: '💰',
    titleHi: 'उधार खाता',
    titleEn: 'Credit Ledger',
    desc: 'किसका कितना बाकी है — कभी भूलो मत। Customer को reminder भेजो, payment track करो।',
    accent: 'border-t-cyan-600',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600'
  },
  {
    icon: '📊',
    titleHi: 'GST तैयार',
    titleEn: 'GST Ready',
    desc: 'GSTR-1, GSTR-3B एक क्लिक में। CA साहब को सीधा भेज दो — झंझट खत्म।',
    accent: 'border-t-indigo-600',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600'
  },
];

const TESTIMONIALS = [
  {
    name: 'राजेश कुमार',
    shop: 'राजेश किराना स्टोर, दिल्ली',
    text: 'पहले रजिस्टर में लिखता था, अब mobile में। सब organized रहता है। बढ़िया app है।',
    rating: 5,
    photo: '👨‍💼'
  },
  {
    name: 'सुनील पाटिल',
    shop: 'पाटिल ट्रेडर्स, पुणे',
    text: 'GST filing आसान हो गई। CA को CSV file भेजो — काम हो गया। Time बचता है।',
    rating: 5,
    photo: '👨'
  },
  {
    name: 'अमित शर्मा',
    shop: 'शर्मा इलेक्ट्रॉनिक्स, कानपुर',
    text: 'उधार का पूरा हिसाब रहता है। Customer को WhatsApp reminder — पैसा time पे आता है।',
    rating: 5,
    photo: '👨‍💻'
  },
];

const TRUST_BADGES = [
  { icon: '✓', text: 'GST Ready', color: 'text-emerald-600' },
  { icon: '🇮🇳', text: 'Made in India', color: 'text-teal-600' },
  { icon: '🔒', text: 'Data Safe', color: 'text-cyan-600' },
  { icon: '📱', text: 'Mobile पे चले', color: 'text-indigo-600' },
];

const PRICING = [
  { 
    duration: '7 दिन',
    price: 'FREE',
    priceHi: 'बिल्कुल मुफ्त',
    features: ['सभी features', 'कोई limit नहीं', 'Credit card नहीं चाहिए'],
    popular: false
  },
  { 
    duration: 'हफ्ता',
    price: '₹120',
    priceHi: 'सिर्फ ₹17/दिन',
    features: ['Unlimited bills', 'WhatsApp support', 'सभी features'],
    popular: false
  },
  { 
    duration: 'साल',
    price: '₹3,600',
    priceHi: 'सिर्फ ₹300/महीना',
    features: ['सबसे सस्ता', '38% की बचत', 'Priority support'],
    popular: true,
    badge: 'सबसे ज्यादा लोग यही लेते हैं'
  },
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
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-emerald-50">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b-2 border-teal-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
              र
            </div>
            <div>
              <div className="text-lg font-black text-slate-900 leading-none">
                रखरखाव
              </div>
              <div className="text-[10px] font-semibold text-teal-700 mt-0.5">
                अपनी दुकान का App
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:bg-teal-50 rounded-lg transition">
              Login करें
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-black rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Free शुरू करें →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-200/40 to-emerald-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-cyan-200/40 to-teal-200/40 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-teal-200 rounded-full mb-8 shadow-md">
              <span className="text-2xl">🇮🇳</span>
              <span className="text-sm font-bold text-teal-800">
                भारतीय दुकानदारों के लिए • 1000+ दुकानें इस्तेमाल करती हैं
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 mb-6 leading-[1.1]">
              अपनी दुकान का<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700">
                डिजिटल हिसाब-किताब
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              बिल बनाओ • उधार रखो • Stock संभालो • GST तैयार करो
            </p>
            <p className="text-base text-slate-500 mb-10 max-w-xl mx-auto">
              Mobile, Tab, Computer — कहीं भी चलाओ। Internet नहीं तो भी काम करता है।
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-lg font-black rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                7 दिन Free Try करें →
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-300 text-slate-700 text-lg font-bold rounded-xl hover:border-teal-600 hover:bg-teal-50 transition-all">
                कीमत देखें
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-3">
              {TRUST_BADGES.map((badge) => (
                <span key={badge.text} className={`inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold ${badge.color} shadow-sm hover:shadow-md transition-shadow`}>
                  <span>{badge.icon}</span>
                  {badge.text}
                </span>
              ))}
            </div>
          </div>

          {/* Screenshot/Demo placeholder */}
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-gradient-to-br from-slate-100 to-slate-200 aspect-video">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <p className="text-xl font-bold text-slate-600">Dashboard का Screenshot यहाँ आएगा</p>
                  <p className="text-sm text-slate-500 mt-2">Billing screen, Stock view, GST Reports</p>
                </div>
              </div>
              {/* Gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-teal-600/10 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / STATS ── */}
      <section className="py-12 bg-white border-y-2 border-teal-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent mb-1">1000+</div>
              <div className="text-sm font-semibold text-slate-600">दुकानें इस्तेमाल करती हैं</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-1">50,000+</div>
              <div className="text-sm font-semibold text-slate-600">बिल बने हैं</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent mb-1">100%</div>
              <div className="text-sm font-semibold text-slate-600">GST Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-teal-600 to-indigo-600 bg-clip-text text-transparent mb-1">4.8★</div>
              <div className="text-sm font-semibold text-slate-600">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-600 mb-3">सभी ज़रूरी Features</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4">
              दुकान चलाने में जो चाहिए,<br className="hidden sm:block" /> सब मिलेगा
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              बिल्कुल simple — किसी को भी समझ आएगा
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.titleHi} className={`group bg-white rounded-2xl border-2 border-slate-200 border-t-4 ${feature.accent} p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}>
                <div className={`w-14 h-14 rounded-xl ${feature.iconBg} flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">{feature.titleHi}</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{feature.titleEn}</p>
                <p className="text-base leading-relaxed text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-600 mb-3">असली दुकानदारों की राय</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4">
              दूसरे दुकानदार क्या कहते हैं
            </h2>
            <p className="text-lg text-slate-600">
              अपने जैसे लोगों की राय सुनो
            </p>
          </div>

          <div className="relative bg-white rounded-2xl p-8 sm:p-10 shadow-2xl border-2 border-teal-200">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 ${idx === currentTestimonial ? 'opacity-100' : 'opacity-0 absolute inset-0 p-8 sm:p-10'}`}
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="text-5xl">{testimonial.photo}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <span key={i} className="text-yellow-500 text-xl">★</span>
                      ))}
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-teal-600 font-medium">{testimonial.shop}</p>
                  </div>
                </div>
                <p className="text-lg leading-relaxed text-slate-700 italic">
                  "{testimonial.text}"
                </p>
              </div>
            ))}

            {/* Dots navigation */}
            <div className="flex justify-center gap-2 mt-8">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-teal-600 w-8' : 'bg-slate-300 w-2'}`}
                  aria-label={`View testimonial ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-600 mb-3">शुरू करना बहुत आसान है</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4">
              बस 3 steps में शुरू करो
            </h2>
            <p className="text-lg text-slate-600">
              बिल्कुल आसान — कोई झंझट नहीं
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <span className="text-4xl font-black text-teal-700">1</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Account बनाओ</h3>
              <p className="text-base text-slate-600">
                बस mobile number या email — 2 मिनट में ready
              </p>
            </div>

            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <span className="text-4xl font-black text-emerald-700">2</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Products डालो</h3>
              <p className="text-base text-slate-600">
                अपना माल add करो — price, stock, GST rate
              </p>
            </div>

            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-100 to-cyan-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <span className="text-4xl font-black text-cyan-700">3</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Bill बनाओ</h3>
              <p className="text-base text-slate-600">
                Customer को WhatsApp पे भेजो — हो गया!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-600 mb-3">सभी के लिए सही Plan</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4">
              सबकी जेब के अनुसार Plan
            </h2>
            <p className="text-lg text-slate-600">
              7 दिन free try करो — पसंद आए तो लो
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.duration} className={`relative bg-white rounded-2xl p-6 border-2 ${plan.popular ? 'border-teal-500 shadow-2xl scale-105' : 'border-slate-200 shadow-lg'} transition-all hover:scale-105`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold rounded-full shadow-lg">
                    {plan.badge}
                  </div>
                )}
                
                <div className="text-center mb-6 pt-2">
                  <div className="text-sm font-bold text-slate-500 uppercase mb-2">{plan.duration}</div>
                  <div className="text-4xl font-black text-slate-900 mb-1">{plan.price}</div>
                  <div className="text-sm font-semibold text-slate-500">{plan.priceHi}</div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold text-lg">✓</span>
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`block text-center px-6 py-3 rounded-lg font-bold transition-all ${plan.popular ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg hover:shadow-xl' : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'}`}>
                  शुरू करें
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            सभी plans में GST शामिल है • कभी भी cancel कर सकते हो • पैसा वापसी की guarantee
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
            आज ही शुरू करो — 7 दिन बिल्कुल Free
          </h2>
          <p className="text-lg sm:text-xl mb-10 opacity-95">
            हजारों दुकानदार पहले ही शुरू कर चुके हैं। अब आपकी बारी है।
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-teal-700 text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all">
              Free Account बनाएं →
            </Link>
            <a href="https://wa.me/919876543210" className="w-full sm:w-auto px-8 py-4 bg-emerald-500 text-white text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
              <span>📱</span> WhatsApp पे बात करें
            </a>
          </div>
          <p className="text-sm mt-8 opacity-80">
            कोई credit card नहीं चाहिए • कभी भी cancel करो • Data 100% safe रहेगा
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                  र
                </div>
                <div>
                  <div className="text-lg font-black leading-none">रखरखाव</div>
                  <div className="text-xs font-semibold text-teal-400 mt-0.5">अपनी दुकान का App</div>
                </div>
              </div>
              <p className="text-sm text-slate-400 max-w-xs">
                भारतीय दुकानों के लिए बनाया गया<br />
                Made with ❤️ in India 🇮🇳
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
              <div>
                <h4 className="font-bold mb-3 text-sm text-teal-400">Product</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                  <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-sm text-emerald-400">Support</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><a href="https://wa.me/919876543210" className="hover:text-white transition">WhatsApp</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Email</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-sm text-cyan-400">Legal</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            © 2026 Rakh-Rakhaav. All rights reserved. GST Compliant • Secure • Trusted by 1000+ Shops
          </div>
        </div>
      </footer>

    </div>
  );
}