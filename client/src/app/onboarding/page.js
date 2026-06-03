'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import { listIndustries } from '../../lib/industries/index.js';
import { writeStoredBusinessType } from '../../contexts/IndustryContext';
import { hasWelcomePending } from '../../lib/subscription';

// ─── Exports required by the rest of the app ────────────────────────────────
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

// ─── Constants ───────────────────────────────────────────────────────────────
const ALL_INDUSTRIES = listIndustries();

const GSTIN_STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh',
};

const GST_RATES = ['0', '5', '12', '18', '28'];

function getProductPlaceholder(businessType) {
  const map = {
    pharmacy: 'दवाई का नाम',
    kirana: 'सामान का नाम',
    grocery: 'सामान का नाम',
    clothing: 'कपड़े का नाम',
    restaurant: 'खाने का नाम',
    salon: 'सर्विस का नाम',
    sweet_shop: 'मिठाई का नाम',
    bakery: 'बेकरी आइटम का नाम',
    jewellery: 'गहने का नाम',
    mobile_shop: 'मोबाइल का नाम',
    footwear: 'जूते का नाम',
    hardware: 'सामान का नाम',
    electronics: 'सामान का नाम',
    furniture: 'फर्नीचर का नाम',
    pet_shop: 'सामान का नाम',
    automobile: 'पार्ट का नाम',
  };
  return map[businessType] || 'Product का नाम';
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── Animated Checkmark (Step 5) ─────────────────────────────────────────────
function AnimatedCheck() {
  return (
    <svg
      viewBox="0 0 56 56"
      className="w-24 h-24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="28" cy="28" r="26" stroke="#16a34a" strokeWidth="3" opacity="0.15" />
      <circle
        cx="28" cy="28" r="26"
        stroke="#16a34a" strokeWidth="3"
        strokeDasharray="163"
        strokeDashoffset="0"
        strokeLinecap="round"
        style={{ animation: 'draw-circle 0.6s ease forwards' }}
      />
      <path
        d="M17 28.5L24.5 36L39 21"
        stroke="#16a34a" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="30"
        strokeDashoffset="0"
        style={{ animation: 'draw-check 0.4s 0.5s ease forwards' }}
      />
      <style>{`
        @keyframes draw-circle {
          from { stroke-dashoffset: 163; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [animating, setAnimating] = useState(false);

  // Step 1 — Shop identity
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const [step1Saving, setStep1Saving] = useState(false);

  // Step 2 — Business type
  const [selectedBusiness, setSelectedBusiness] = useState('general');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Step 3 — GST
  const [gstType, setGstType] = useState('unregistered'); // 'registered' | 'unregistered' | 'composition'
  const [gstin, setGstin] = useState('');
  const [gstinError, setGstinError] = useState('');
  const [gstinState, setGstinState] = useState('');
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState('');

  // Step 4 — Product
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [productGst, setProductGst] = useState('0');
  const [productSaving, setProductSaving] = useState(false);
  const [productError, setProductError] = useState('');
  const [productAdded, setProductAdded] = useState(null);

  // Guard
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.replace('/login');
  }, [router]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goTo(next, dir = 1) {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 300);
  }

  function goBack() {
    if (step > 1) goTo(step - 1, -1);
  }

  // ── Step 1 handler ──────────────────────────────────────────────────────────
  async function handleStep1() {
    if (shopName.trim().length < 2) {
      setStep1Error('दुकान का नाम कम से कम 2 अक्षर का होना चाहिए।');
      return;
    }
    setStep1Error('');
    setStep1Saving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: shopName.trim(), city: city.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setStep1Error(d.message || 'Save नहीं हो पाया, फिर से try करें।');
        return;
      }
      goTo(2);
    } catch {
      setStep1Error('Network error. Internet connection check करें।');
    } finally {
      setStep1Saving(false);
    }
  }

  // ── Step 2 handler ──────────────────────────────────────────────────────────
  async function handleStep2() {
    setStep2Saving(true);
    setStep2Error('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessType: selectedBusiness }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setStep2Error(d.message || 'Save नहीं हो पाया।');
        return;
      }
      writeStoredBusinessType(selectedBusiness);
      goTo(3);
    } catch {
      setStep2Error('Network error. Internet connection check करें।');
    } finally {
      setStep2Saving(false);
    }
  }

  // ── GSTIN validation ────────────────────────────────────────────────────────
  function handleGstinChange(val) {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setGstin(upper);
    if (upper.length >= 2) {
      const code = upper.slice(0, 2);
      setGstinState(GSTIN_STATE_CODES[code] || '');
    } else {
      setGstinState('');
    }
    if (upper.length === 15) {
      const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      setGstinError(pattern.test(upper) ? '' : 'GSTIN format गलत है।');
    } else if (upper.length > 0) {
      setGstinError('');
    }
  }

  // ── Step 3 handler ──────────────────────────────────────────────────────────
  async function handleStep3() {
    if (gstType === 'registered' && gstin.length === 15) {
      const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!pattern.test(gstin)) {
        setGstinError('GSTIN format गलत है।');
        return;
      }
    }
    setStep3Saving(true);
    setStep3Error('');
    try {
      const token = localStorage.getItem('token');
      const body = { gst_type: gstType };
      if (gstType === 'registered' && gstin) body.gstin = gstin;
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setStep3Error(d.message || 'Save नहीं हो पाया।');
        return;
      }
      goTo(4);
    } catch {
      setStep3Error('Network error. Internet connection check करें।');
    } finally {
      setStep3Saving(false);
    }
  }

  // ── Step 4 — Add product ────────────────────────────────────────────────────
  async function handleAddProduct() {
    if (!productName.trim() || !productPrice) {
      setProductError('Product का नाम और price ज़रूरी है।');
      return;
    }
    setProductError('');
    setProductSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: productName.trim(),
          sellingPrice: parseFloat(productPrice),
          stock: productQty,
          gstRate: parseFloat(productGst),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setProductError(d.message || 'Product add नहीं हो पाया।');
        return;
      }
      setProductAdded(productName.trim());
    } catch {
      setProductError('Network error. फिर से try करें।');
    } finally {
      setProductSaving(false);
    }
  }

  // ── Step 5 — Finish ─────────────────────────────────────────────────────────
  function handleFinish(path = '/dashboard') {
    clearOnboardingPending();
    router.push(hasWelcomePending() ? '/welcome' : path);
  }

  const selectedIndustry = ALL_INDUSTRIES.find((i) => i.id === selectedBusiness) || ALL_INDUSTRIES[0];

  // ── Slide animation classes ─────────────────────────────────────────────────
  const slideClass = animating
    ? direction === 1
      ? 'translate-x-8 opacity-0'
      : '-translate-x-8 opacity-0'
    : 'translate-x-0 opacity-100';

  const progressPct = ((step - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        {/* Back button */}
        <button
          type="button"
          onClick={goBack}
          className={`mr-1 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-slate-100 active:scale-95 ${step > 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center text-white font-black text-base shadow-md shadow-green-500/30 flex-shrink-0">
          ₹
        </div>
        <div className="flex-1">
          <div className="text-[16px] font-black tracking-tight text-slate-900 leading-none">रखरखाव</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-green-700">Setup</div>
        </div>
        <div className="text-[11px] font-bold text-slate-400">Step {step} of 5</div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-[3px] bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full overflow-hidden">
        <div
          className={`w-full transition-all duration-300 ease-in-out ${slideClass}`}
        >
          {step === 1 && (
            <Step1
              shopName={shopName}
              setShopName={setShopName}
              city={city}
              setCity={setCity}
              error={step1Error}
              saving={step1Saving}
              onContinue={handleStep1}
            />
          )}
          {step === 2 && (
            <Step2
              selected={selectedBusiness}
              setSelected={setSelectedBusiness}
              error={step2Error}
              saving={step2Saving}
              onContinue={handleStep2}
            />
          )}
          {step === 3 && (
            <Step3
              gstType={gstType}
              setGstType={setGstType}
              gstin={gstin}
              onGstinChange={handleGstinChange}
              gstinError={gstinError}
              gstinState={gstinState}
              error={step3Error}
              saving={step3Saving}
              onContinue={handleStep3}
            />
          )}
          {step === 4 && (
            <Step4
              businessType={selectedBusiness}
              productName={productName}
              setProductName={setProductName}
              productPrice={productPrice}
              setProductPrice={setProductPrice}
              productQty={productQty}
              setProductQty={setProductQty}
              productGst={productGst}
              setProductGst={setProductGst}
              saving={productSaving}
              error={productError}
              productAdded={productAdded}
              onAdd={handleAddProduct}
              onContinue={() => goTo(5)}
            />
          )}
          {step === 5 && (
            <Step5
              shopName={shopName}
              industry={selectedIndustry}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Shop Identity ────────────────────────────────────────────────────
function Step1({ shopName, setShopName, city, setCity, error, saving, onContinue }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Illustration */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-green-500/30">
            ₹
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-green-400/30 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h1 className="text-[clamp(20px,5vw,28px)] font-black tracking-tight text-slate-900 leading-tight">
          आपकी दुकान का नाम क्या है?
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
          यही नाम आपके bills और invoices पर दिखेगा।
        </p>
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">दुकान का नाम</label>
          <input
            ref={inputRef}
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onContinue()}
            placeholder="जैसे — राम जनरल स्टोर"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
          />
          {error && (
            <p className="mt-1.5 text-[12px] font-semibold text-red-600">⚠ {error}</p>
          )}
        </div>
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">शहर (optional)</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onContinue()}
            placeholder="शहर का नाम — जैसे कानपुर"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
          />
        </div>
      </div>

      <ContinueButton onClick={onContinue} loading={saving} label="आगे बढ़ें →" />

      <p className="text-center text-[11px] text-slate-400">यह बाद में Profile settings से बदल सकते हैं।</p>
    </div>
  );
}

// ─── Step 2: Business Type ────────────────────────────────────────────────────
function Step2({ selected, setSelected, error, saving, onContinue }) {
  const selectedConfig = ALL_INDUSTRIES.find((i) => i.id === selected);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-[clamp(20px,5vw,28px)] font-black tracking-tight text-slate-900 leading-tight">
          अपना व्यापार चुनें
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
          इससे app आपके लिए खुद को customize कर लेगी।
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] font-semibold text-red-700">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Industry grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[52vh] overflow-y-auto pr-1 pb-1">
        {ALL_INDUSTRIES.map((ind) => {
          const active = selected === ind.id;
          return (
            <button
              key={ind.id}
              type="button"
              onClick={() => setSelected(ind.id)}
              className={`relative flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-2xl text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500/40 active:scale-95
                ${active
                  ? 'border-2 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg shadow-green-500/15'
                  : 'border border-slate-200 bg-white hover:border-green-300'
                }`}
            >
              {active && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shadow-sm">
                  <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                    <path d="M1 3.5L3 6L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <span className="text-2xl leading-none">{ind.icon}</span>
              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-black leading-tight ${active ? 'text-green-900' : 'text-slate-800'}`}>
                  {ind.labelHindi}
                </span>
                <span className="text-[9px] text-slate-400 font-medium leading-tight">{ind.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected preview strip */}
      {selectedConfig && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50/60">
          <span className="text-2xl">{selectedConfig.icon}</span>
          <div>
            <div className="text-[13px] font-black text-green-900">{selectedConfig.labelHindi} चुना है</div>
            <div className="text-[11px] text-slate-500 font-medium">{selectedConfig.label}</div>
          </div>
        </div>
      )}

      <ContinueButton onClick={onContinue} loading={saving} label="यह business चुनें →" />
    </div>
  );
}

// ─── Step 3: GST Setup ────────────────────────────────────────────────────────
function Step3({ gstType, setGstType, gstin, onGstinChange, gstinError, gstinState, error, saving, onContinue }) {
  const gstOptions = [
    {
      id: 'registered',
      icon: '🏛️',
      title: 'हाँ, GST registered हूँ',
      sub: 'GSTIN number है मेरे पास',
    },
    {
      id: 'unregistered',
      icon: '🏪',
      title: 'नहीं, अभी registered नहीं',
      sub: 'बिना GST के bill बनाऊँगा',
    },
    {
      id: 'composition',
      icon: '📋',
      title: 'Composition scheme में हूँ',
      sub: '1% / 5% flat rate',
    },
  ];

  const gstinValid = gstin.length === 15 && !gstinError;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-[clamp(20px,5vw,28px)] font-black tracking-tight text-slate-900 leading-tight">
          GST registered हैं?
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
          यह बाद में भी change कर सकते हैं।
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] font-semibold text-red-700">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {gstOptions.map((opt) => {
          const active = gstType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setGstType(opt.id)}
              className={`flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none
                ${active
                  ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md shadow-green-500/10'
                  : 'border-slate-200 bg-white hover:border-green-200'
                }`}
            >
              <span className="text-2xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-[14px] font-black ${active ? 'text-green-900' : 'text-slate-800'}`}>
                  {opt.title}
                </div>
                <div className="text-[12px] text-slate-500 font-medium mt-0.5">{opt.sub}</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${active ? 'border-green-500 bg-green-500' : 'border-slate-300'}`}
              >
                {active && (
                  <svg width="9" height="8" viewBox="0 0 9 8" fill="none">
                    <path d="M1.5 4L3.5 6.5L7.5 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* GSTIN input — animated expand */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: gstType === 'registered' ? '160px' : '0px', opacity: gstType === 'registered' ? 1 : 0 }}
      >
        <div className="pt-1 pb-2">
          <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">GSTIN नंबर</label>
          <div className="relative">
            <input
              type="text"
              value={gstin}
              onChange={(e) => onGstinChange(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className={`w-full border-2 rounded-xl px-4 py-3.5 pr-10 text-[14px] font-mono text-slate-900 placeholder:text-slate-300 placeholder:font-sans outline-none transition-all
                ${gstinError ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : gstinValid ? 'border-green-500 focus:ring-2 focus:ring-green-500/20'
                  : 'border-slate-200 focus:border-green-600 focus:ring-2 focus:ring-green-500/30'
                }`}
            />
            {gstin.length === 15 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
                {gstinValid ? '✅' : '❌'}
              </span>
            )}
          </div>
          {gstinError && <p className="mt-1 text-[12px] font-semibold text-red-600">⚠ {gstinError}</p>}
          {gstinState && !gstinError && (
            <p className="mt-1 text-[12px] font-semibold text-green-700">📍 {gstinState}</p>
          )}
          {gstType === 'registered' && !gstin && (
            <p className="mt-1.5 text-[11px] text-slate-400">GSTIN बाद में भी add कर सकते हैं।</p>
          )}
        </div>
      </div>

      <ContinueButton onClick={onContinue} loading={saving} label="Save करें और आगे बढ़ें →" />
    </div>
  );
}

// ─── Step 4: First Product ────────────────────────────────────────────────────
function Step4({
  businessType, productName, setProductName, productPrice, setProductPrice,
  productQty, setProductQty, productGst, setProductGst,
  saving, error, productAdded, onAdd, onContinue,
}) {
  const placeholder = getProductPlaceholder(businessType);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-[clamp(20px,5vw,28px)] font-black tracking-tight text-slate-900 leading-tight">
          एक product add करके देखें
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
          सिर्फ देखने के लिए — यह optional है।{' '}
          <button
            type="button"
            onClick={onContinue}
            className="font-bold text-green-700 underline underline-offset-2 hover:text-green-900 transition-colors"
          >
            बाद में करूँगा →
          </button>
        </p>
      </div>

      {/* Success card */}
      {productAdded && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-green-50 border border-green-200"
          style={{ animation: 'bounce-in 0.4s ease' }}
        >
          <span className="text-xl">✅</span>
          <div>
            <div className="text-[14px] font-black text-green-800">{productAdded} जोड़ा गया!</div>
            <div className="text-[11px] text-green-600 font-medium">Product inventory में add हो गया।</div>
          </div>
        </div>
      )}

      {!productAdded && (
        <div className="flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Product name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Product का नाम</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={placeholder}
              className="w-full border-2 border-slate-200 rounded-xl px-3.5 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Selling Price</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-500">₹</span>
              <input
                type="number"
                min="0"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border-2 border-slate-200 rounded-xl pl-8 pr-3.5 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
              />
            </div>
          </div>

          {/* Stock stepper */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Stock</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProductQty(Math.max(0, productQty - 1))}
                className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all active:scale-90"
              >
                −
              </button>
              <span className="w-12 text-center text-[18px] font-black text-slate-900">{productQty}</span>
              <button
                type="button"
                onClick={() => setProductQty(productQty + 1)}
                className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all active:scale-90"
              >
                +
              </button>
            </div>
          </div>

          {/* GST chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">GST Rate</label>
            <div className="flex gap-2 flex-wrap">
              {GST_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setProductGst(r)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all active:scale-95
                    ${productGst === r
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-700'
                    }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[12px] font-semibold text-red-600">⚠ {error}</p>}

          <button
            type="button"
            onClick={onAdd}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-[14px] font-black hover:-translate-y-0.5 hover:bg-slate-800 active:scale-95 disabled:opacity-60 transition-all"
          >
            {saving ? <><Spinner /> जोड़ा जा रहा है...</> : '+ Product जोड़ें'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>

      <ContinueButton onClick={onContinue} label="आगे बढ़ें →" />
    </div>
  );
}

// ─── Step 5: Completion ───────────────────────────────────────────────────────
function Step5({ shopName, industry, onFinish }) {
  const features = [
    { emoji: '🧾', title: 'Bill बनाएं', sub: 'अभी पहला bill बनाओ', path: '/sales/new' },
    { emoji: '📦', title: 'Stock देखें', sub: 'Products और inventory', path: '/products' },
    { emoji: '💸', title: 'उधार track करें', sub: 'Customer का हिसाब', path: '/udhaar' },
  ];

  return (
    <div className="flex flex-col gap-6 items-center text-center">
      {/* Animated check */}
      <div className="mt-2">
        <AnimatedCheck />
      </div>

      <div>
        <h1 className="text-[clamp(22px,5vw,30px)] font-black tracking-tight text-slate-900 leading-tight">
          आपकी दुकान तैयार है! 🎉
        </h1>
        {shopName && (
          <p className="mt-2 text-[18px] font-bold text-green-700">
            स्वागत है, {shopName} में!
          </p>
        )}
        {industry && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 border border-green-200">
            <span>{industry.icon}</span>
            <span className="text-[12px] font-bold text-green-800">{industry.labelHindi}</span>
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="w-full grid grid-cols-3 gap-2.5">
        {features.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => onFinish(f.path)}
            className="flex flex-col items-center gap-1.5 px-2 py-4 rounded-2xl bg-white border border-slate-200 hover:border-green-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-150 text-center"
          >
            <span className="text-2xl leading-none">{f.emoji}</span>
            <div>
              <div className="text-[11px] font-black text-slate-800 leading-tight">{f.title}</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5 leading-tight">{f.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => onFinish('/dashboard')}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-[16px] font-black text-white bg-gradient-to-r from-green-700 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/40 active:scale-95 transition-all"
      >
        Dashboard खोलें →
      </button>

      <p className="text-[11px] text-slate-400">
        कोई सवाल? WhatsApp करें:{' '}
        <span className="font-bold text-slate-500">+91-XXXXX-XXXXX</span>
      </p>
    </div>
  );
}

// ─── Shared: Continue Button ──────────────────────────────────────────────────
function ContinueButton({ onClick, loading, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-green-700 to-emerald-700 shadow-lg shadow-green-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 active:scale-95 transition-all duration-200"
    >
      {loading ? <><Spinner /> Saving...</> : label}
    </button>
  );
}
