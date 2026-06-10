'use client';

/**
 * AppLocaleProvider / useAppLocale
 *
 * Thin provider that wraps the i18n system and exposes { locale, setLocale, t }
 * to all components. Reads ui_language from the logged-in user in localStorage
 * and falls back to 'hi_en'. Syncs document.lang attribute.
 *
 * Usage:
 *   const { locale, setLocale, t } = useAppLocale();
 *   t('sale_new')  →  locale-correct string
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocaleMap, VALID_LANGS } from '../lib/i18n/index.js';

const STORAGE_KEY = 'rakhaav-locale';

function readInitialLang() {
  if (typeof window === 'undefined') return 'hi_en';
  try {
    // Prefer ui_language from the authenticated user object
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (VALID_LANGS.includes(user?.ui_language)) return user.ui_language;
    // Fall back to the standalone locale key (set by legacy code or manual override)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID_LANGS.includes(stored)) return stored;
  } catch {
    // ignore
  }
  return 'hi_en';
}

function interpolate(template, vars = {}) {
  if (!vars || typeof template !== 'string') return template;
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
    template
  );
}

const AppLocaleContext = createContext(null);

export function AppLocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLang);

  const setLocale = useCallback((lang) => {
    const safe = VALID_LANGS.includes(lang) ? lang : 'hi_en';
    setLocaleState(safe);
    try {
      localStorage.setItem(STORAGE_KEY, safe);
      // Mirror into user object so useTranslation() stays in sync
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.ui_language = safe;
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'hi' || locale === 'hi_en' ? 'hi' : 'en';
    }
  }, [locale]);

  // Rehydrate locale from user object when the component mounts (handles post-login)
  useEffect(() => {
    const lang = readInitialLang();
    if (lang !== locale) setLocaleState(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => {
    const map = getLocaleMap(locale);
    return {
      locale,
      setLocale,
      isHindi: locale === 'hi' || locale === 'hi_en',
      isEnglish: locale === 'en',
      t(key, vars) {
        const template = map[key] ?? key;
        return interpolate(template, vars);
      },
    };
  }, [locale, setLocale]);

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale() {
  const context = useContext(AppLocaleContext);
  if (!context) {
    throw new Error('useAppLocale must be used inside AppLocaleProvider');
  }
  return context;
}
