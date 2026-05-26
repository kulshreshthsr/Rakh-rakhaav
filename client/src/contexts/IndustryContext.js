'use client';

/**
 * IndustryContext
 *
 * Provides the current business type config to the whole app.
 * businessType is read from localStorage ('rr-business-type') and
 * is refreshed every time Layout.js calls subscription-status
 * (which now returns businessType from the shop).
 *
 * Usage:
 *   const { config, term, isEnabled } = useIndustry();
 *   config.terminology.product  → 'Medicine' for pharmacy, 'Product' for general
 *   term('product')             → same, shorthand
 *   isEnabled('batchTracking')  → true for pharmacy
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getIndustryConfig } from '../lib/industries';

const STORAGE_KEY = 'rr-business-type';

function readStoredBusinessType() {
  if (typeof window === 'undefined') return 'general';
  try { return localStorage.getItem(STORAGE_KEY) || 'general'; } catch { return 'general'; }
}

export function writeStoredBusinessType(type) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, type || 'general'); } catch {}
}

const IndustryContext = createContext(null);

export function IndustryProvider({ children }) {
  const [businessType, setBusinessType] = useState(readStoredBusinessType);
  const config = getIndustryConfig(businessType);

  // Called from Layout.js after subscription-status refresh returns businessType
  const updateBusinessType = useCallback((type) => {
    if (!type) return;
    setBusinessType(type);
    writeStoredBusinessType(type);
  }, []);

  // Keep in sync if localStorage changes in another tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        setBusinessType(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const term = useCallback((key, fallback) => {
    return config?.terminology?.[key] || fallback || key;
  }, [config]);

  const isEnabled = useCallback((moduleKey) => {
    return config?.modules?.[moduleKey] !== false;
  }, [config]);

  return (
    <IndustryContext.Provider value={{ businessType, config, term, isEnabled, updateBusinessType }}>
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry() {
  const ctx = useContext(IndustryContext);
  if (!ctx) throw new Error('useIndustry must be used inside IndustryProvider');
  return ctx;
}
