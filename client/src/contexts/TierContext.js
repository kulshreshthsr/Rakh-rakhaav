'use client';

/**
 * TierContext
 *
 * Provides feature flags derived from businessTier + industryType.
 * Components call isFeatureEnabled('erp_grn') — they never check tier directly.
 *
 * Tier is stored in localStorage ('rr-business-tier') and refreshed from
 * the shop API on load.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getTierFeatures } from '../lib/tierConfig.frontend';

const TIER_KEY = 'rr-business-tier';

function readStoredTier() {
  if (typeof window === 'undefined') return 'nano';
  try { return localStorage.getItem(TIER_KEY) || 'nano'; } catch { return 'nano'; }
}

export function writeStoredTier(tier) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(TIER_KEY, tier || 'nano'); } catch {}
}

const TierContext = createContext(null);

export function TierProvider({ children }) {
  const [tier, setTier] = useState(readStoredTier);
  const [industryType, setIndustryType] = useState('hardware');

  const features = useMemo(() => getTierFeatures(tier, industryType), [tier, industryType]);

  const updateTier = useCallback((newTier, newIndustry) => {
    if (newTier) { setTier(newTier); writeStoredTier(newTier); }
    if (newIndustry) setIndustryType(newIndustry);
  }, []);

  const isFeatureEnabled = useCallback((feature) => {
    return features[feature] === true;
  }, [features]);

  const isNavVisible = useCallback((navKey) => {
    return features[`nav_${navKey}`] === true;
  }, [features]);

  // Keep in sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === TIER_KEY && e.newValue) setTier(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <TierContext.Provider value={{ tier, features, isFeatureEnabled, isNavVisible, updateTier, industryType }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error('useTier must be used within TierProvider');
  return ctx;
}
