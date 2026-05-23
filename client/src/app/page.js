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
    accent: 'border-t-orange-500',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600'
  },
  {
    icon: '📦',
    titleHi: 'माल का हिसाब',
    titleEn: 'Stock Management',
    desc: 'कौन सा item कितना है — सब दिखता है। Stock कम हुआ तो तुरंत पता चल जाएगा।',
    accent: 'border-t-green-500',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600'
  },
  {
    icon: '💰',
    titleHi: 'उधार खाता',
    titleEn: 'Credit Ledger',
    desc: 'किसका कितना बाकी है — कभी भूलो मत। Customer को reminder भेजो, payment track करो।',
    accent: 'border-t-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600'
  },
  {
    icon: '📊',
    titleHi: 'GST तैयार',
    titleEn: 'GST Ready',
    desc: 'GSTR-1, GSTR-3B एक क्लिक में। CA साहब को सीधा भेज दो — झंझट खत्म।',
    accent: 'border-t-purple-500',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600'
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
  { icon: '✓', text: 'GST Ready', color: 'text-green-600' },
  { icon: '🇮🇳', text: 'Made in India', color: 'text-orange-600' },
  { icon: '🔒', text: 'Data Safe', color: 'text-blue-600' },
  { icon: '📱', text: 'Mobile पे चले', color: 'text-purple-600' },
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
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-green-50">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b-2 border-orange-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-md">
              र
            </div>
            <div>
              <div className="text-lg font-black text-slate-900 leading-none">
                रखरखाव
              </div>
              <div className="text-[10px] font-semibold text-orange-600 mt-0.5">
                अपनी दुकान का App
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:bg-orange-50 rounded-lg transition">
              Login करें
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-black rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Free शुरू करें →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-green-200/30 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-200 rounded-full mb-6 shadow-sm">
              <span className="text-2xl">🇮🇳</span>
              <span className="text-sm font-bold text-orange-700">
                भारतीय दुकानदारों के लिए • 1000+ दुकानें इस्तेमाल करती हैं
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-6 leading-tight">
              अपनी दुकान का<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-700">
                डिजिटल हिसाब-किताब
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              बिल बनाओ • उधार रखो • Stock संभालो • GST तैयार करो
            </p>
            <p className="text-base text-slate-500 mb-10">
              Mobile, Tab, Computer — कहीं भी चलाओ। Internet नहीं तो भी काम करता है।
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-black rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                7 दिन Free Try करें →
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-300 text-slate-700 text-lg font-bold rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all">
                कीमत देखें
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-3">
              {TRUST_BADGES.map((badge) => (
                <span key={badge.text} className={`inline-flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm font-semibold ${badge.color} shadow-sm`}>
                  <span>{badge.icon}</span>
                  {badge.text}
                </span>
              ))}
            </div>
          </div>

          {/* Screenshot/Demo placeholder - you can replace with actual image */}
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-gradient-to-br from-slate-100 to-slate-200 aspect-video">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <p className="text-xl font-bold text-slate-600">App का Screenshot यहाँ आएगा</p>
                  <p className="text-sm text-slate-500 mt-2">Dashboard, Billing screen, Stock view</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / STATS ── */}
      <section className="py-8 bg-white border-y-2 border-orange-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-orange-600 mb-1">1000+</div>
              <div className="text-sm font-semibold text-slate-600">दुकानें इस्तेमाल करती हैं</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-green-600 mb-1">50,000+</div>
              <div className="text-sm font-semibold text-slate-600">बिल बने हैं</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-blue-600 mb-1">100%</div>
              <div className="text-sm font-semibold text-slate-600">GST Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-purple-600 mb-1">4.8★</div>
              <div className="text-sm font-semibold text-slate-600">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
              दुकान चलाने में जो चाहिए, सब मिलेगा
            </h2>
            <p className="text-lg text-slate-600">
              बिल्कुल simple — किसी को भी समझ आएगा
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.titleHi} className={`bg-white rounded-2xl border-2 border-slate-200 border-t-4 ${feature.accent} p-6 hover:shadow-lg hover:-translate-y-1 transition-all`}>
                <div className={`w-14 h-14 rounded-xl ${feature.iconBg} flex items-center justify-center text-3xl mb-4 shadow-sm`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">{feature.titleHi}</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{feature.titleEn}</p>
                <p className="text-base leading-relaxed text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
              दूसरे दुकानदार क्या कहते हैं
            </h2>
            <p className="text-lg text-slate-600">
              अपने जैसे लोगों की राय सुनो
            </p>
          </div>

          <div className="relative bg-white rounded-2xl p-8 shadow-xl border-2 border-orange-200">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 ${idx === currentTestimonial ? 'opacity-100' : 'opacity-0 absolute inset-0 p-8'}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-5xl">{testimonial.photo}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <span key={i} className="text-yellow-500 text-lg">★</span>
                      ))}
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-slate-500">{testimonial.shop}</p>
                  </div>
                </div>
                <p className="text-lg leading-relaxed text-slate-700 italic">
                  "{testimonial.text}"
                </p>
              </div>
            ))}

            {/* Dots navigation */}
            <div className="flex justify-center gap-2 mt-6">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-orange-500 w-6' : 'bg-slate-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
              बस 3 steps में शुरू करो
            </h2>
            <p className="text-lg text-slate-600">
              बिल्कुल आसान — कोई झंझट नहीं
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                <span className="text-3xl font-black text-orange-600">1</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Account बनाओ</h3>
              <p className="text-base text-slate-600">
                बस mobile number या email — 2 मिनट में ready
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                <span className="text-3xl font-black text-green-600">2</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Products डालो</h3>
              <p className="text-base text-slate-600">
                अपना माल add करो — price, stock, GST rate
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <span className="text-3xl font-black text-blue-600">3</span>
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
      <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
              सबकी जेब के अनुसार Plan
            </h2>
            <p className="text-lg text-slate-600">
              7 दिन free try करो — पसंद आए तो लो
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.duration} className={`relative bg-white rounded-2xl p-6 border-2 ${plan.popular ? 'border-orange-500 shadow-xl' : 'border-slate-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                    {plan.badge}
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <div className="text-sm font-bold text-slate-500 uppercase mb-2">{plan.duration}</div>
                  <div className="text-4xl font-black text-slate-900 mb-1">{plan.price}</div>
                  <div className="text-sm font-semibold text-slate-500">{plan.priceHi}</div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`block text-center px-6 py-3 rounded-lg font-bold transition ${plan.popular ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  शुरू करें
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            सभी plans में GST शामिल है • कभी भी cancel कर सकते हो
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            आज ही शुरू करो — 7 दिन बिल्कुल Free
          </h2>
          <p className="text-lg mb-8 opacity-90">
            हजारों दुकानदार पहले ही शुरू कर चुके हैं। अब आपकी बारी है।
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-orange-600 text-lg font-black rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
              Free Account बनाएं →
            </Link>
            <a href="https://wa.me/919876543210" className="w-full sm:w-auto px-8 py-4 bg-green-500 text-white text-lg font-black rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
              <span>📱</span> WhatsApp पे बात करें
            </a>
          </div>
          <p className="text-sm mt-6 opacity-75">
            कोई credit card नहीं चाहिए • कभी भी cancel करो • Data 100% safe
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-md">
                  र
                </div>
                <div>
                  <div className="text-lg font-black leading-none">रखरखाव</div>
                  <div className="text-xs font-semibold text-orange-400">अपनी दुकान का App</div>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                भारतीय दुकानों के लिए बनाया गया<br />
                Made with ❤️ in India 🇮🇳
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-bold mb-3 text-sm">Product</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                  <li><Link href="/features" className="hover:text-white">Features</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-sm">Support</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><a href="https://wa.me/919876543210" className="hover:text-white">WhatsApp</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white">Email</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-sm">Legal</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
            © 2026 Rakh-Rakhaav. All rights reserved. GST Compliant • Secure • Trusted by 1000+ Shops
          </div>
        </div>
      </footer>

    </div>
  );
}