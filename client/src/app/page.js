'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthRoute, readStoredSubscription } from '../lib/subscription';

const FEATURES = [
  {
    icon: '⚡',
    titleHi: 'तेज़ Billing',
    titleEn: 'Lightning Billing',
    desc: 'Professional GST bills in 10 seconds। WhatsApp पे instant send करो। Print-ready invoices।',
    gradient: 'from-blue-600 to-cyan-600',
    bgGradient: 'from-blue-50 to-cyan-50',
  },
  {
    icon: '📦',
    titleHi: 'Smart Inventory',
    titleEn: 'Stock Management',
    desc: 'Real-time stock tracking। Low stock alerts। Never run out of products। Complete control।',
    gradient: 'from-violet-600 to-purple-600',
    bgGradient: 'from-violet-50 to-purple-50',
  },
  {
    icon: '💰',
    titleHi: 'उधार Manager',
    titleEn: 'Credit Management',
    desc: 'Complete customer ledger। Auto WhatsApp reminders। Track every rupee। Easy collection।',
    gradient: 'from-emerald-600 to-teal-600',
    bgGradient: 'from-emerald-50 to-teal-50',
  },
  {
    icon: '📊',
    titleHi: 'GST Reports',
    titleEn: 'Tax Automation',
    desc: 'One-click GSTR reports। CA-ready files download करो। Tax filing stress-free।',
    gradient: 'from-orange-600 to-amber-600',
    bgGradient: 'from-orange-50 to-amber-50',
  },
];

const TESTIMONIALS = [
  {
    name: 'राजेश कुमार',
    shop: 'राजेश किराना स्टोर, दिल्ली',
    text: 'Professional bills देखकर customers impress होते हैं। Business में confidence आ गया। Revenue 30% बढ़ा।',
    rating: 5,
    gradient: 'from-blue-600 to-cyan-600',
    initial: 'R'
  },
  {
    name: 'सुनील पाटिल',
    shop: 'पाटिल ट्रेडर्स, पुणे',
    text: 'GST filing पहले 2 दिन लगता था, अब 15 मिनट। CA भी खुश। Time और पैसा दोनों बचे।',
    rating: 5,
    gradient: 'from-violet-600 to-purple-600',
    initial: 'S'
  },
  {
    name: 'अमित शर्मा',
    shop: 'शर्मा इलेक्ट्रॉनिक्स, कानपुर',
    text: 'Udhaar collection में dramatic improvement। WhatsApp reminders work करते हैं। ROI मिल गया।',
    rating: 5,
    gradient: 'from-emerald-600 to-teal-600',
    initial: 'A'
  },
];

const STATS = [
  { value: '1,000+', label: 'Active Shops', icon: '🏪' },
  { value: '50,000+', label: 'Bills Generated', icon: '📄' },
  { value: '₹2.5Cr+', label: 'Revenue Managed', icon: '💰' },
  { value: '4.9★', label: 'Customer Rating', icon: '⭐' },
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
    <div className="min-h-screen bg-white">

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-black text-xl">र</span>
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">
                  रखरखाव
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Business Management
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:block px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-slate-900 transition">
                Login
              </Link>
              <Link href="/register" className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all">
                Free शुरू करें
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30 py-16 sm:py-24 lg:py-32">
        
        {/* Subtle background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-200 to-violet-200 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-200 to-teal-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Trust Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 rounded-full shadow-sm">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">✓</span>
              <span className="text-sm font-bold text-slate-700">
                🇮🇳 1,000+ Indian Shops Trust Us
              </span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center max-w-5xl mx-auto mb-12">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-slate-900 mb-6 leading-[1.05]">
              अपनी दुकान को
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                Digital बनाओ
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl md:text-3xl text-slate-600 mb-4 font-semibold">
              Bills • Stock • Udhaar • GST — सब एक जगह
            </p>
            <p className="text-base sm:text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
              Professional tools for modern shopkeepers। GST-ready। Works offline।
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/register" className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-lg font-black rounded-xl shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all">
                <span className="flex items-center justify-center gap-2">
                  7 दिन Free Try करें
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-300 text-slate-700 text-lg font-bold rounded-xl hover:border-blue-600 hover:bg-blue-50 hover:-translate-y-1 transition-all shadow-md">
                Pricing देखें
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: '✓', text: 'GST Ready', color: 'emerald' },
                { icon: '🔒', text: 'Bank-Level Security', color: 'blue' },
                { icon: '🇮🇳', text: 'Made in India', color: 'orange' },
                { icon: '📱', text: 'Works Offline', color: 'violet' },
              ].map((badge) => (
                <span key={badge.text} className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-${badge.color}-200 rounded-lg text-sm font-semibold text-${badge.color}-700 shadow-sm`}>
                  <span className="text-base">{badge.icon}</span>
                  {badge.text}
                </span>
              ))}
            </div>
          </div>

          {/* Dashboard Screenshot */}
          <div className="max-w-6xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition" />
              <div className="relative bg-white rounded-2xl border-2 border-slate-200 shadow-2xl overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-12">
                  <div className="text-center">
                    <div className="text-7xl mb-4">📊</div>
                    <p className="text-2xl font-black text-slate-700 mb-2">Dashboard Preview</p>
                    <p className="text-slate-500">Real-time Business Analytics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* STATS */}
      <section className="py-16 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center text-white">
                <div className="text-4xl sm:text-5xl font-black mb-2">
                  {stat.value}
                </div>
                <div className="text-sm sm:text-base font-semibold opacity-90">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
              Powerful Features
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
              Professional tools designed for Indian businesses
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.titleHi} className={`group relative bg-gradient-to-br ${feature.bgGradient} rounded-2xl p-8 border-2 border-slate-200 hover:border-transparent hover:shadow-2xl transition-all duration-300`}>
                
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-3xl mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all`}>
                  {feature.icon}
                </div>
                
                <h3 className={`text-2xl font-black mb-2 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.titleHi}
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  {feature.titleEn}
                </p>
                <p className="text-base leading-relaxed text-slate-700">
                  {feature.desc}
                </p>

                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-b-2xl`} />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 sm:py-32 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
              Success Stories
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4">
              Trusted by Shop Owners
            </h2>
            <p className="text-lg sm:text-xl text-slate-600">
              हजारों दुकानदार already इस्तेमाल कर रहे हैं
            </p>
          </div>

          <div className="relative">
            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl p-8 sm:p-12">
              
              {TESTIMONIALS.map((testimonial, idx) => (
                <div
                  key={idx}
                  className={`transition-all duration-500 ${idx === currentTestimonial ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 p-8 sm:p-12 pointer-events-none'}`}
                >
                  <div className="flex items-start gap-5 mb-6">
                    <div className={`flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
                      {testimonial.initial}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <span key={i} className="text-yellow-500 text-xl">★</span>
                        ))}
                      </div>
                      <h4 className="font-black text-xl text-slate-900">{testimonial.name}</h4>
                      <p className={`text-sm font-bold bg-gradient-to-r ${testimonial.gradient} bg-clip-text text-transparent`}>
                        {testimonial.shop}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl leading-relaxed text-slate-700 font-medium">
                    "{testimonial.text}"
                  </p>
                </div>
              ))}

              <div className="flex justify-center gap-2 mt-10">
                {TESTIMONIALS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentTestimonial(idx)}
                    className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-gradient-to-r from-blue-600 to-violet-600 w-12' : 'bg-slate-300 w-2'}`}
                  />
                ))}
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
              Simple Pricing
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4">
              Plans for Every Business
            </h2>
            <p className="text-lg sm:text-xl text-slate-600">
              Start free — upgrade when ready
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            
            {/* Free Trial */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 hover:border-blue-600 hover:shadow-xl transition-all">
              <div className="text-center mb-8">
                <div className="text-sm font-bold text-slate-500 uppercase mb-2">7 दिन Trial</div>
                <div className="text-5xl font-black text-slate-900 mb-2">FREE</div>
                <div className="text-sm text-slate-600">Full access</div>
              </div>
              <ul className="space-y-4 mb-8">
                {['सभी features unlock', 'Unlimited bills', 'No credit card', 'Cancel anytime'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold">✓</span>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block text-center px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
                Start Free
              </Link>
            </div>

            {/* Yearly - Popular */}
            <div className="relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-black rounded-full shadow-lg">
                ⭐ BEST VALUE
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-3xl p-8 text-white shadow-2xl scale-105">
                <div className="text-center mb-8 pt-2">
                  <div className="text-sm font-bold opacity-90 uppercase mb-2">साल</div>
                  <div className="text-5xl font-black mb-2">₹3,600</div>
                  <div className="text-sm font-bold opacity-90">सिर्फ ₹300/month</div>
                </div>
                <ul className="space-y-4 mb-8">
                  {['38% बचत', 'Priority support', 'Early feature access', 'Dedicated manager'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white text-sm font-bold">✓</span>
                      <span className="font-semibold">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center px-6 py-3 bg-white text-blue-600 font-black rounded-xl hover:bg-blue-50 transition shadow-lg">
                  Get Started →
                </Link>
              </div>
            </div>

            {/* Monthly */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 hover:border-blue-600 hover:shadow-xl transition-all">
              <div className="text-center mb-8">
                <div className="text-sm font-bold text-slate-500 uppercase mb-2">महीना</div>
                <div className="text-5xl font-black text-slate-900 mb-2">₹400</div>
                <div className="text-sm text-slate-600">बस ₹13/day</div>
              </div>
              <ul className="space-y-4 mb-8">
                {['Month-to-month', 'सभी features', 'WhatsApp support', 'Cancel anytime'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold">✓</span>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block text-center px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
                Start Now
              </Link>
            </div>

          </div>

          <p className="text-center text-sm text-slate-500 mt-10">
            सभी plans में GST included • Money-back guarantee • Secure payments
          </p>

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 sm:py-32 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight">
            Ready to Transform<br />Your Business?
          </h2>
          <p className="text-xl sm:text-2xl mb-12 opacity-95">
            Join 1,000+ shopkeepers already succeeding
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-10 py-5 bg-white text-blue-600 text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all">
              Start Free Trial →
            </Link>
            <a href="https://wa.me/919876543210" className="w-full sm:w-auto px-10 py-5 bg-emerald-500 text-white text-lg font-black rounded-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
              <span className="text-2xl">📱</span> WhatsApp Support
            </a>
          </div>
          
          <p className="text-sm mt-10 opacity-80">
            No credit card required • Cancel anytime • Data 100% secure
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
            
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-xl">र</span>
                </div>
                <div>
                  <div className="text-xl font-black">रखरखाव</div>
                  <div className="text-xs text-slate-400 font-bold">Business Management</div>
                </div>
              </div>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Professional business tools for<br />Indian shopkeepers। Made with ❤️ in India 🇮🇳
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div>
                <h4 className="font-bold mb-4 text-sm text-blue-400">Product</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                  <li><Link href="/demo" className="hover:text-white transition">Live Demo</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm text-violet-400">Support</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><a href="https://wa.me/919876543210" className="hover:text-white transition">WhatsApp</a></li>
                  <li><a href="mailto:help@rakhrakhaav.com" className="hover:text-white transition">Email</a></li>
                  <li><Link href="/help" className="hover:text-white transition">Help Center</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm text-purple-400">Company</h4>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
                </ul>
              </div>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            © 2026 Rakh-Rakhaav • GST Compliant • Bank-Level Security • Trusted by 1000+ Shops
          </div>
        </div>
      </footer>

    </div>
  );
}