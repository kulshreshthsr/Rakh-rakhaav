'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'rakhaav-locale';

const dictionary = {
  en: {
    brand: 'Business Manager',
    workspace: 'Workspace',
    workspaceCopy: 'Inventory, billing and GST operations',
    live: 'Live',
    mainMenu: 'Main Menu',
    plans: 'Membership',
    pricing: 'Go Pro',
    reports: 'Reports',
    reportsShortcut: 'Open reports',
    profile: 'Profile',
    logout: 'Logout',
    trialEnds: 'Your free trial ends in {days} day{suffix}',
    trialCopy: 'Keep billing, GST, reports, WhatsApp sharing and ledgers running without interruption.',
    upgrade: 'Unlock Premium',
    viewPricing: 'See membership',
    dashboard: 'Dashboard',
    products: 'Products',
    sales: 'Sales',
    purchases: 'Purchases',
    udhaar: 'Ledgers',
    gst: 'GST',
    language: 'Language',
    english: 'English',
    hindi: 'Hindi',
    welcome: 'Welcome back',
    quickSwitch: 'Quick switch',
    quickSwitchCopy: 'Move across core workflows faster.',
  },
  hi: {
    brand: '\u092c\u093f\u095b\u0928\u0947\u0938 \u092e\u0948\u0928\u0947\u091c\u0930',
    workspace: '\u0915\u093e\u092e',
    workspaceCopy: '\u0938\u094d\u091f\u0949\u0915, \u092c\u093f\u0932 \u0914\u0930 GST',
    live: '\u091a\u093e\u0932\u0942',
    mainMenu: '\u092e\u0947\u0928\u0942',
    plans: '\u092e\u0947\u092e\u094d\u092c\u0930\u0936\u093f\u092a',
    pricing: '\u0917\u094b \u092a\u094d\u0930\u094b',
    reports: '\u0930\u093f\u092a\u094b\u0930\u094d\u091f',
    reportsShortcut: '\u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0916\u094b\u0932\u0947\u0902',
    profile: '\u092a\u094d\u0930\u094b\u092b\u093e\u0907\u0932',
    logout: '\u0932\u0949\u0917\u0906\u0909\u091f',
    trialEnds: '\u0906\u092a\u0915\u093e \u092b\u094d\u0930\u0940 \u091f\u094d\u0930\u093e\u092f\u0932 {days} \u0926\u093f\u0928{suffix} \u092e\u0947\u0902 \u0916\u0924\u094d\u092e \u0939\u094b\u0917\u093e',
    trialCopy: '\u092c\u093f\u0932\u093f\u0902\u0917, GST, \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0914\u0930 \u0909\u0927\u093e\u0930 \u0935\u0930\u094d\u0915\u092b\u094d\u0932\u094b\u091c \u092c\u093f\u0928\u093e \u0930\u0941\u0915\u093e\u0935\u091f \u091a\u093e\u0932\u0942 \u0930\u0939\u0947\u0902.',
    upgrade: '\u092a\u094d\u0930\u0940\u092e\u093f\u092f\u092e \u0932\u0947\u0902',
    viewPricing: '\u092e\u0947\u092e\u094d\u092c\u0930\u0936\u093f\u092a \u0926\u0947\u0916\u0947\u0902',
    dashboard: '\u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921',
    products: '\u092a\u094d\u0930\u094b\u0921\u0915\u094d\u091f',
    sales: '\u092c\u093f\u0915\u094d\u0930\u0940',
    purchases: '\u0916\u0930\u0940\u0926',
    udhaar: '\u0909\u0927\u093e\u0930',
    gst: 'GST',
    language: '\u092d\u093e\u0937\u093e',
    english: 'English',
    hindi: '\u0939\u093f\u0902\u0926\u0940',
    welcome: '\u092b\u093f\u0930 \u0938\u0947 \u0938\u094d\u0935\u093e\u0917\u0924 \u0939\u0948',
    quickSwitch: '\u091c\u0932\u094d\u0926\u0940 \u091c\u093e\u090f\u0902',
    quickSwitchCopy: '\u091c\u0930\u0942\u0930\u0940 \u0915\u093e\u092e \u0924\u0915 \u091c\u0932\u094d\u0926\u0940 \u092a\u0939\u0941\u0901\u091a\u0947\u0902.',
  },
};

const AppLocaleContext = createContext(null);

function interpolate(template, vars = {}) {
  return Object.entries(vars).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function AppLocaleProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    if (typeof window === 'undefined') return 'hi';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'hi' ? stored : 'hi';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const value = useMemo(() => {
    const messages = dictionary[locale] || dictionary.en;

    return {
      locale,
      setLocale,
      isHindi: locale === 'hi',
      t(key, vars) {
        const template = messages[key] || dictionary.en[key] || key;
        return interpolate(template, vars);
      },
    };
  }, [locale]);

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale() {
  const context = useContext(AppLocaleContext);
  if (!context) {
    throw new Error('useAppLocale must be used inside AppLocaleProvider');
  }
  return context;
}
