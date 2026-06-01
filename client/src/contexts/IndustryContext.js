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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getIndustryConfig } from '../lib/industries';

const STORAGE_KEY = 'rr-business-type';
const DASHBOARD_MODE_KEY = 'rr-dashboard-mode';

function readStoredBusinessType() {
  if (typeof window === 'undefined') return 'general';
  try { return localStorage.getItem(STORAGE_KEY) || 'general'; } catch { return 'general'; }
}

export function writeStoredBusinessType(type) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, type || 'general'); } catch {}
}

function readStoredDashboardMode() {
  if (typeof window === 'undefined') return 'b2c';
  try { return localStorage.getItem(DASHBOARD_MODE_KEY) || 'b2c'; } catch { return 'b2c'; }
}

export function writeStoredDashboardMode(mode) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DASHBOARD_MODE_KEY, mode || 'b2c'); } catch {}
}

const IndustryContext = createContext(null);

export function IndustryProvider({ children }) {
  const [businessType, setBusinessType] = useState(readStoredBusinessType);
  const [dashboardMode, setDashboardMode] = useState(readStoredDashboardMode);
  const config = getIndustryConfig(businessType);

  // Called from Layout.js after subscription-status refresh returns businessType
  const updateBusinessType = useCallback((type) => {
    if (!type) return;
    setBusinessType(type);
    writeStoredBusinessType(type);
  }, []);

  const updateDashboardMode = useCallback((mode) => {
    if (!mode) return;
    setDashboardMode(mode);
    writeStoredDashboardMode(mode);
  }, []);

  // Keep in sync if localStorage changes in another tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        setBusinessType(e.newValue);
      }
      if (e.key === DASHBOARD_MODE_KEY && e.newValue) {
        setDashboardMode(e.newValue);
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

  const value = useMemo(
    () => ({ businessType, config, term, isEnabled, updateBusinessType, dashboardMode, updateDashboardMode }),
    [businessType, config, term, isEnabled, updateBusinessType, dashboardMode, updateDashboardMode]
  );

  return (
    <IndustryContext.Provider value={value}>
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry() {
  const ctx = useContext(IndustryContext);
  if (!ctx) throw new Error('useIndustry must be used inside IndustryProvider');
  return ctx;
}
