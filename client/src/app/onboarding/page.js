'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import { listIndustries } from '../../lib/industries/index.js';
import { writeStoredBusinessType, writeStoredDashboardMode } from '../../contexts/IndustryContext';
import { writeStoredTier } from '../../contexts/TierContext';
import { hasWelcomePending } from '../../lib/subscription';
import { getToken, GST_STATE_CODE_MAP } from '../../lib/constants';

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


const GST_RATES = ['0', '5', '12', '18', '28'];

// ── Business-type step 4 mode ────────────────────────────────────────────────
// 'service'  → salon, repair shop, service center (no stock, no cost price)
// 'dish'     → restaurant (no stock)
// 'product'  → everything else (full form)
function getStep4Mode(businessType) {
  if (['salon', 'service_center', 'repair_shop'].includes(businessType)) return 'service';
  if (businessType === 'restaurant') return 'dish';
  return 'product';
}

const STEP4_CONFIG = {
  service: {
    heading: 'अपनी एक service add करें',
    subtext: 'सिर्फ देखने के लिए — optional है।',
    namePlaceholder: 'जैसे — Hair Cut, AC Service, Mobile Screen Repair',
    nameLabel: 'Service का नाम',
    pricePlaceholder: '150',
    priceLabel: 'Service charge (₹)',
    btnLabel: '+ Service जोड़ें',
    successVerb: 'service जोड़ी गई',
    defaultUnit: 'service',
    showStock: false,
    showCostPrice: false,
  },
  dish: {
    heading: 'अपना एक dish add करें',
    subtext: 'Menu का पहला item — optional है।',
    namePlaceholder: 'जैसे — Dal Makhani, Paneer Butter Masala',
    nameLabel: 'Dish का नाम',
    pricePlaceholder: '180',
    priceLabel: 'Price (₹)',
    btnLabel: '+ Dish जोड़ें',
    successVerb: 'dish जोड़ी गई',
    defaultUnit: 'plate',
    showStock: false,
    showCostPrice: false,
  },
  product: {
    heading: 'एक product add करके देखें',
    subtext: 'सिर्फ देखने के लिए — optional है।',
    namePlaceholder: null, // set dynamically
    nameLabel: 'Product का नाम',
    pricePlaceholder: '0.00',
    priceLabel: 'Selling Price (₹)',
    btnLabel: '+ Product जोड़ें',
    successVerb: 'product जोड़ा गया',
    defaultUnit: 'pcs',
    showStock: true,
    showCostPrice: true,
  },
};

const UNITS_BY_TYPE = {
  pharmacy:    ['strip', 'tablet', 'bottle', 'tube', 'pcs', 'box', 'ml'],
  kirana:      ['pcs', 'kg', 'g', 'litre', 'ml', 'packet', 'box'],
  grocery:     ['pcs', 'kg', 'g', 'litre', 'ml', 'packet', 'box'],
  hardware:    ['pcs', 'kg', 'metre', 'feet', 'litre', 'roll', 'bag'],
  jewellery:   ['pcs', 'gm'],
  sweet_shop:  ['kg', 'box', 'pcs', 'piece'],
  bakery:      ['pcs', 'kg', 'box', 'dozen'],
  restaurant:  ['plate', 'bowl', 'glass', 'half', 'full'],
  salon:       ['service'],
  service_center: ['service'],
  repair_shop: ['service', 'job'],
  clothing:    ['pcs'],
  footwear:    ['pair', 'pcs'],
  furniture:   ['pcs', 'set'],
  electronics: ['pcs'],
  mobile_shop: ['pcs'],
  automobile:  ['pcs', 'set', 'litre', 'kg'],
  pet_shop:    ['pcs', 'kg', 'packet', 'bottle'],
};

function getUnitsForType(businessType) {
  return UNITS_BY_TYPE[businessType] || ['pcs', 'kg', 'litre', 'box', 'metre'];
}

function getProductNamePlaceholder(businessType) {
  const map = {
    pharmacy: 'दवाई का नाम — जैसे Crocin 500mg',
    kirana: 'सामान का नाम — जैसे Tata Salt 1kg',
    grocery: 'सामान का नाम — जैसे Amul Butter',
    clothing: 'कपड़े का नाम — जैसे Cotton Kurta',
    sweet_shop: 'मिठाई का नाम — जैसे Gulab Jamun',
    bakery: 'आइटम का नाम — जैसे Chocolate Cake',
    jewellery: 'गहने का नाम — जैसे Gold Ring 22K',
    mobile_shop: 'मोबाइल का नाम — जैसे Realme C35',
    footwear: 'जूते का नाम — जैसे Bata Sneaker',
    hardware: 'सामान का नाम — जैसे Anchor Switch 6A',
    electronics: 'सामान का नाम — जैसे Philips LED Bulb',
    furniture: 'फर्नीचर का नाम — जैसे Wooden Chair',
    pet_shop: 'सामान का नाम — जैसे Pedigree Adult 3kg',
    automobile: 'पार्ट का नाम — जैसे Bosch Spark Plug',
  };
  return map[businessType] || 'Product का नाम — जैसे Premium Widget';
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
  const [shopPhone, setShopPhone] = useState('');
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

  // Step 4 — Business profiling
  const [profileStep,    setProfileStep]    = useState(0);
  const [profileAnswers, setProfileAnswers] = useState({});
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [inferredTier,   setInferredTier]   = useState(null);

  // Step 5 — Product / Service
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCostPrice, setProductCostPrice] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [productUnit, setProductUnit] = useState('pcs');
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
      const token = getToken();
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: shopName.trim(), city: city.trim(), ...(shopPhone.trim() && { phone: shopPhone.trim() }) }),
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
      const token = getToken();
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
      setGstinState(GST_STATE_CODE_MAP[code] || '');
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
    if (gstType === 'registered' && !gstin) {
      setGstinError('GST registered होने पर GSTIN number ज़रूरी है। (Add करें या "नहीं" choose करें)');
      return;
    }
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
      const token = getToken();
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
      goTo(4); // → profiling step
    } catch {
      setStep3Error('Network error. Internet connection check करें।');
    } finally {
      setStep3Saving(false);
    }
  }

  // ── Step 4 — Business profiling helpers ────────────────────────────────────
  function getProfileQuestions(businessType, gstType) {
    const isServiceBusiness = ['salon', 'service_center', 'repair_shop', 'restaurant'].includes(businessType);
    const canManufacture = ['hardware', 'electronics', 'clothing', 'kirana', 'grocery',
      'furniture', 'mobile_shop', 'footwear', 'stationery', 'cosmetics'].includes(businessType);

    return [
      {
        id: 'sellsTo',
        text: 'आपका business किस type का है? (यह dashboard set करेगा)',
        options: [
          { label: 'Direct customers / retail (B2C)', value: 'walk_in',    emoji: '🛍️' },
          { label: 'Shops / companies को wholesale (B2B)', value: 'businesses', emoji: '🏭' },
          { label: 'दोनों — retail + wholesale (B2B+B2C)', value: 'both',  emoji: '🔄' },
        ],
      },
      {
        id: 'monthlyBillCount',
        text: 'Roughly महीने में कितने bills बनाते हैं? 🧾',
        options: [
          { label: '100 से कम',    value: 'under_100',  emoji: '📄' },
          { label: '100 से 500',   value: '100_to_500', emoji: '📋' },
          { label: '500 से ज़्यादा', value: 'above_500', emoji: '📦' },
        ],
      },
      {
        id: 'staffCount',
        text: 'Team में कितने लोग हैं? 👥',
        show: (answers) => answers.sellsTo !== 'walk_in' || answers.monthlyBillCount !== 'under_100',
        options: [
          { label: 'सिर्फ मैं / 1-2 लोग', value: 'solo',   emoji: '🧑' },
          { label: '3 से 10 लोग',          value: 'small',  emoji: '👨‍👩‍👦' },
          { label: '10 से ज़्यादा',         value: 'medium', emoji: '🏢' },
        ],
      },
      {
        id: 'usesCredit',
        text: 'Credit / उधार पर बेचते हैं? 💳',
        show: () => !isServiceBusiness,
        options: [
          { label: 'हाँ, काफ़ी customers को', value: true,  emoji: '✅' },
          { label: 'कभी-कभी',                 value: true,  emoji: '🤔' },
          { label: 'नहीं',                    value: false, emoji: '❌' },
        ],
      },
      {
        id: 'hasMultipleSuppliers',
        text: 'Suppliers / distributors कितने हैं? 🚚',
        show: (answers) => !isServiceBusiness && answers.monthlyBillCount !== 'under_100',
        options: [
          { label: '1-2 ही हैं',         value: false, emoji: '1️⃣' },
          { label: '3 से ज़्यादा हैं',  value: true,  emoji: '🔢' },
        ],
      },
      {
        id: 'needsDeliveryChallan',
        text: 'Delivery challan / transport document बनाना पड़ता है? 📋',
        show: (answers) => answers.sellsTo === 'businesses' || answers.sellsTo === 'both',
        options: [
          { label: 'हाँ, regularly', value: true,  emoji: '✅' },
          { label: 'कभी-कभी',       value: true,  emoji: '🤔' },
          { label: 'नहीं',          value: false, emoji: '❌' },
        ],
      },
      {
        id: 'manufactures',
        text: 'क्या आप खुद कुछ बनाते / manufacture करते हैं? 🏭',
        show: () => canManufacture,
        options: [
          { label: 'हाँ, हम बनाते हैं',       value: true,  emoji: '🏭' },
          { label: 'नहीं, खरीद कर बेचते हैं', value: false, emoji: '🛒' },
        ],
      },
    ];
  }

  async function submitProfile(finalAnswers) {
    setProfileSaving(true);
    try {
      const res = await fetch(apiUrl('/api/auth/shop/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ signals: finalAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profile save failed');

      setInferredTier(data.tier);
      writeStoredTier(data.tier);

      // Persist dashboardMode so dashboard routing picks it up immediately
      if (data.dashboardMode) {
        writeStoredDashboardMode(data.dashboardMode);
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, dashboardMode: data.dashboardMode }));
      }

      setTimeout(() => goTo(5), 1200);
    } catch {
      goTo(5);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleProfileAnswer(questionId, value) {
    const newAnswers = { ...profileAnswers, [questionId]: value };
    setProfileAnswers(newAnswers);

    const questions = getProfileQuestions(selectedBusiness, gstType);
    const applicable = questions.filter(q => !q.show || q.show(newAnswers));
    const nextStep = profileStep + 1;

    if (nextStep >= applicable.length) {
      await submitProfile(newAnswers);
    } else {
      setProfileStep(nextStep);
    }
  }

  // ── Step 5 — Add product / service ─────────────────────────────────────────
  async function handleAddProduct() {
    if (!productName.trim() || !productPrice) {
      setProductError('नाम और selling price ज़रूरी है।');
      return;
    }
    setProductError('');
    setProductSaving(true);
    const mode = getStep4Mode(selectedBusiness);
    try {
      const token = getToken();
      const body = {
        name: productName.trim(),
        price: parseFloat(productPrice) || 0,
        cost_price: parseFloat(productCostPrice) || 0,
        quantity: mode === 'product' ? productQty : 0,
        unit: productUnit,
        gst_rate: parseFloat(productGst) || 0,
      };
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setProductError(d.message || 'Add नहीं हो पाया। फिर से try करें।');
        return;
      }
      setProductAdded(productName.trim());
    } catch {
      setProductError('Network error. Internet connection check करें।');
    } finally {
      setProductSaving(false);
    }
  }

  // ── Step 5 — Finish ─────────────────────────────────────────────────────────
  async function handleFinish(path = '/dashboard') {
    clearOnboardingPending();
    try {
      await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ onboarding_completed: true }),
      });
    } catch { /* non-blocking */ }
    router.push(hasWelcomePending() ? '/welcome' : path);
  }

  const selectedIndustry = ALL_INDUSTRIES.find((i) => i.id === selectedBusiness) || ALL_INDUSTRIES[0];

  // ── Slide animation classes ─────────────────────────────────────────────────
  const slideClass = animating
    ? direction === 1
      ? 'translate-x-8 opacity-0'
      : '-translate-x-8 opacity-0'
    : 'translate-x-0 opacity-100';

  const progressPct = (step / 6) * 100;

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
        <div className="text-[11px] font-bold text-slate-400">Step {step} of 6</div>
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
              shopPhone={shopPhone}
              setShopPhone={setShopPhone}
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
            <Step4Profile
              businessType={selectedBusiness}
              gstType={gstType}
              profileStep={profileStep}
              profileAnswers={profileAnswers}
              onAnswer={handleProfileAnswer}
              inferredTier={inferredTier}
              saving={profileSaving}
              getProfileQuestions={getProfileQuestions}
            />
          )}
          {step === 5 && (
            <Step4
              businessType={selectedBusiness}
              productName={productName}
              setProductName={setProductName}
              productPrice={productPrice}
              setProductPrice={setProductPrice}
              productCostPrice={productCostPrice}
              setProductCostPrice={setProductCostPrice}
              productQty={productQty}
              setProductQty={setProductQty}
              productUnit={productUnit}
              setProductUnit={setProductUnit}
              productGst={productGst}
              setProductGst={setProductGst}
              saving={productSaving}
              error={productError}
              productAdded={productAdded}
              onAdd={handleAddProduct}
              onContinue={() => goTo(6)}
            />
          )}
          {step === 6 && (
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

// ─── Step 4: Business Profiling (conversational) ─────────────────────────────
function Step4Profile({ businessType, gstType, profileStep, profileAnswers, onAnswer, inferredTier, saving, getProfileQuestions }) {
  const questions = getProfileQuestions(businessType, gstType);
  const applicable = questions.filter(q => !q.show || q.show(profileAnswers));
  const currentQ = applicable[profileStep];

  const tierMeta = {
    nano: { label: 'Starter Setup',   emoji: '🌱', color: 'from-green-500 to-emerald-600',  desc: 'Clean, simple billing tailored for you.' },
    core: { label: 'Business Setup',  emoji: '📊', color: 'from-blue-500 to-indigo-600',    desc: 'Full GST, purchases, reports — everything you need.' },
    pro:  { label: 'Pro / ERP Setup', emoji: '🏢', color: 'from-violet-500 to-purple-600',  desc: 'Purchase orders, P&L, multi-user — built for growth.' },
  };
  const tm = tierMeta[inferredTier || 'nano'];

  if (inferredTier && !saving) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${tm.color} flex items-center justify-center text-4xl shadow-xl`}>
          {tm.emoji}
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-2">आपका setup</p>
          <h2 className="text-[26px] font-black text-slate-900 tracking-tight">{tm.label}</h2>
          <p className="text-[14px] text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">{tm.desc}</p>
        </div>
        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        <p className="text-[14px] font-bold text-slate-600">आपका profile तैयार हो रहा है…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversation bubble */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-md">
          ₹
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-green-700 mb-1">Rakhaav</p>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 inline-block">
            <p className="text-[15px] font-bold text-slate-900 leading-snug">{currentQ.text}</p>
          </div>
        </div>
      </div>

      {/* Answer options */}
      <div className="space-y-2.5 pl-12">
        {currentQ.options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onAnswer(currentQ.id, opt.value)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-left hover:border-green-400 hover:bg-green-50 active:scale-[0.98] transition-all duration-150 group"
          >
            <span className="text-[22px] flex-shrink-0">{opt.emoji}</span>
            <span className="text-[14px] font-bold text-slate-800 group-hover:text-green-800">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-2">
        {applicable.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i <= profileStep ? 'w-5 h-1.5 bg-green-500' : 'w-1.5 h-1.5 bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Shop Identity ────────────────────────────────────────────────────
function Step1({ shopName, setShopName, city, setCity, shopPhone, setShopPhone, error, saving, onContinue }) {
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
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            दुकान का फोन नंबर (optional)
          </label>
          <input
            type="tel"
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
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
      <div className="relative">
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
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
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

// ─── Step 4: First Product / Service / Dish ──────────────────────────────────
function Step4({
  businessType,
  productName, setProductName,
  productPrice, setProductPrice,
  productCostPrice, setProductCostPrice,
  productQty, setProductQty,
  productUnit, setProductUnit,
  productGst, setProductGst,
  saving, error, productAdded, onAdd, onContinue,
}) {
  const mode = getStep4Mode(businessType);
  const cfg = STEP4_CONFIG[mode];
  const units = getUnitsForType(businessType);
  const namePlaceholder = mode === 'product'
    ? getProductNamePlaceholder(businessType)
    : cfg.namePlaceholder;

  // Sync default unit when business type changes or mode changes
  useEffect(() => {
    if (units.length > 0) setProductUnit(units[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessType]);

  const successLabel = cfg.successVerb;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-[clamp(20px,5vw,28px)] font-black tracking-tight text-slate-900 leading-tight">
          {cfg.heading}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
          {cfg.subtext}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-2 w-full py-2.5 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all"
        >
          बाद में करूँगा — अभी Skip करें →
        </button>
      </div>

      {/* Success card */}
      {productAdded && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-green-50 border border-green-200"
          style={{ animation: 'bounce-in 0.4s ease' }}
        >
          <span className="text-2xl">✅</span>
          <div>
            <div className="text-[14px] font-black text-green-800">"{productAdded}" {successLabel}!</div>
            <div className="text-[11px] text-green-600 font-medium">
              {mode === 'service' ? 'Service list में add हो गई।' : mode === 'dish' ? 'Menu में add हो गई।' : 'Inventory में add हो गया।'}
            </div>
          </div>
        </div>
      )}

      {!productAdded && (
        <div className="flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">

          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">{cfg.nameLabel}</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={namePlaceholder}
              className="w-full border-2 border-slate-200 rounded-xl px-3.5 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
            />
          </div>

          {/* Selling price + unit (in a row) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">{cfg.priceLabel}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder={cfg.pricePlaceholder}
                  className="w-full border-2 border-slate-200 rounded-xl pl-7 pr-3 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                />
              </div>
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Unit</label>
              <select
                value={productUnit}
                onChange={(e) => setProductUnit(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-[13px] font-medium text-slate-900 bg-white focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
              >
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost price — product mode only */}
          {cfg.showCostPrice && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
                Cost Price (₹) <span className="font-medium text-slate-400 normal-case tracking-normal">— optional, for margin tracking</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={productCostPrice}
                  onChange={(e) => setProductCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-2 border-slate-200 rounded-xl pl-7 pr-3 py-3 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Stock stepper — product mode only */}
          {cfg.showStock && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">Opening Stock</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProductQty(Math.max(0, productQty - 1))}
                  className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all active:scale-90"
                >
                  −
                </button>
                <span className="w-14 text-center text-[18px] font-black text-slate-900">
                  {productQty} <span className="text-[11px] font-medium text-slate-400">{productUnit}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setProductQty(productQty + 1)}
                  className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          )}

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
            {saving ? <><Spinner /> जोड़ा जा रहा है...</> : cfg.btnLabel}
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
