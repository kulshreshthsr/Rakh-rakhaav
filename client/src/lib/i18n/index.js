'use client';

/**
 * i18n system for Rakhaav.
 *
 * Three locales: 'en' | 'hi' | 'hi_en' (default).
 * ui_language is read from the logged-in user object in localStorage.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   t('sale_new')        → 'नया Invoice' (hi_en), 'New Invoice' (en), 'नया बिल' (hi)
 *   t('trial_ends_in', { days: 3, suffix: '' })  → interpolated string
 */

import { useCallback, useMemo } from 'react';
import en    from './en.js';
import hi    from './hi.js';
import hi_en from './hi_en.js';

const MAPS = { en, hi, hi_en };
const VALID_LANGS = ['en', 'hi', 'hi_en'];

function interpolate(template, vars = {}) {
  if (!vars || typeof template !== 'string') return template;
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
    template
  );
}

function readLang() {
  if (typeof window === 'undefined') return 'hi_en';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const lang = user?.ui_language;
    return VALID_LANGS.includes(lang) ? lang : 'hi_en';
  } catch {
    return 'hi_en';
  }
}

/**
 * React hook — call inside any client component.
 * Re-renders are triggered by the caller when lang changes (e.g. after profile save).
 * For cross-component reactivity, use inside AppLocaleProvider which syncs lang state.
 */
export function useTranslation() {
  const lang = readLang();
  const map  = MAPS[lang] ?? MAPS.hi_en;

  const t = useCallback(
    (key, vars) => {
      const template = map[key] ?? MAPS.hi_en[key] ?? key;
      return interpolate(template, vars);
    },
    [map]
  );

  return useMemo(() => ({ t, lang }), [t, lang]);
}

/**
 * Non-hook version — safe to use in utilities, server components, or outside React.
 * Pass lang explicitly; defaults to reading from localStorage.
 */
export function translate(key, vars, lang) {
  const l   = VALID_LANGS.includes(lang) ? lang : readLang();
  const map = MAPS[l] ?? MAPS.hi_en;
  const template = map[key] ?? MAPS.hi_en[key] ?? key;
  return interpolate(template, vars);
}

/** Returns the full string map for the given locale (useful for server-side). */
export function getLocaleMap(lang = 'hi_en') {
  return MAPS[VALID_LANGS.includes(lang) ? lang : 'hi_en'];
}

export { VALID_LANGS };
