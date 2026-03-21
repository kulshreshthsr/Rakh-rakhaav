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
    plans: 'Plans',
    pricing: 'Pricing',
    reports: 'Reports',
    reportsShortcut: 'Open reports',
    profile: 'Profile',
    logout: 'Logout',
    trialEnds: 'Your free trial ends in {days} day{suffix}',
    trialCopy: 'Upgrade now to keep GST exports, reports, ledgers and billing workflows active without interruption.',
    upgrade: 'Upgrade',
    viewPricing: 'View pricing',
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
    brand: 'बिजनेस मैनेजर',
    workspace: 'काम',
    workspaceCopy: 'स्टॉक, बिल और GST',
    live: 'चालू',
    mainMenu: 'मेनू',
    plans: 'प्लान',
    pricing: 'प्लान',
    reports: 'रिपोर्ट',
    reportsShortcut: 'रिपोर्ट खोलें',
    profile: 'प्रोफाइल',
    logout: 'लॉगआउट',
    trialEnds: 'आपका फ्री ट्रायल {days} दिन{suffix} में खत्म होगा',
    trialCopy: 'काम बंद न हो, इसलिए समय पर प्लान लें।',
    upgrade: 'अपग्रेड',
    viewPricing: 'प्लान देखें',
    dashboard: 'डैशबोर्ड',
    products: 'प्रोडक्ट',
    sales: 'बिक्री',
    purchases: 'खरीद',
    udhaar: 'उधार',
    gst: 'GST',
    language: 'भाषा',
    english: 'English',
    hindi: 'हिंदी',
    welcome: 'फिर से स्वागत है',
    quickSwitch: 'जल्दी जाएं',
    quickSwitchCopy: 'जरूरी काम तक जल्दी पहुंचें।',
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
