/**
 * Tier Inference Engine
 *
 * Takes raw profiling signals from onboarding answers and returns
 * a businessTier: 'nano' | 'core' | 'pro'
 *
 * Scoring is additive. Each signal adds points. Threshold determines tier.
 * Intentionally biased toward SIMPLER tiers — better to start simple and upgrade
 * than to overwhelm a user day one.
 */

const TIER_THRESHOLDS = {
  pro:  7,  // 7+ points → pro
  core: 3,  // 3-6 points → core
  // below 3 → nano
};

function inferTier(signals = {}, gstType = 'unregistered', businessType = 'general') {
  let score = 0;
  const reasons = [];

  // ── Signal: Who they sell to ──────────────────────────────────────────────
  if (signals.sellsTo === 'businesses') {
    score += 3;
    reasons.push('Sells to businesses (B2B)');
  } else if (signals.sellsTo === 'both') {
    score += 2;
    reasons.push('Sells to both retail and business customers');
  }

  // ── Signal: Transaction volume ────────────────────────────────────────────
  if (signals.monthlyBillCount === 'above_500') {
    score += 3;
    reasons.push('High bill volume (500+/month)');
  } else if (signals.monthlyBillCount === '100_to_500') {
    score += 1;
    reasons.push('Medium bill volume (100-500/month)');
  }

  // ── Signal: Staff complexity ──────────────────────────────────────────────
  if (signals.staffCount === 'medium') {
    score += 2;
    reasons.push('Medium-sized team (10+ staff)');
  } else if (signals.staffCount === 'small') {
    score += 1;
    reasons.push('Small team (3-10 staff)');
  }

  // ── Signal: Credit sales (udhaar) ─────────────────────────────────────────
  if (signals.usesCredit === true) {
    score += 1;
    reasons.push('Uses credit sales');
  }

  // ── Signal: Multiple suppliers ────────────────────────────────────────────
  if (signals.hasMultipleSuppliers === true) {
    score += 1;
    reasons.push('Works with multiple suppliers');
  }

  // ── Signal: Needs delivery challans ──────────────────────────────────────
  if (signals.needsDeliveryChallan === true) {
    score += 2;
    reasons.push('Needs delivery challans');
  }

  // ── Signal: Manufacturing ─────────────────────────────────────────────────
  if (signals.manufactures === true) {
    score += 4;
    reasons.push('Manufactures products');
  }

  // ── Signal: GST filing ────────────────────────────────────────────────────
  if (gstType === 'regular') {
    score += 2;
    reasons.push('Regular GST filer');
  } else if (gstType === 'composition') {
    score += 1;
    reasons.push('Composition GST scheme');
  }

  // ── Business type overrides ───────────────────────────────────────────────
  const proBusinessTypes  = ['hardware', 'electronics', 'furniture', 'mobile_shop'];
  const nanoBusinessTypes = ['salon', 'sweet_shop', 'bakery', 'restaurant', 'repair_shop', 'service_center', 'gift_shop', 'toy_store', 'pet_shop', 'bookstall'];

  if (proBusinessTypes.includes(businessType) && score >= 2) {
    score += 1;
  }
  if (nanoBusinessTypes.includes(businessType) && score < 3) {
    score = Math.max(0, score - 1);
  }

  // ── Derive tier ───────────────────────────────────────────────────────────
  let tier;
  if (score >= TIER_THRESHOLDS.pro) {
    tier = 'pro';
  } else if (score >= TIER_THRESHOLDS.core) {
    tier = 'core';
  } else {
    tier = 'nano';
  }

  return { tier, score, reasons };
}

/**
 * Usage-based tier upgrade check.
 * Call after certain user actions to silently upgrade tier if warranted.
 * Returns { newTier, reason } if an upgrade happened, null if no change.
 */
function checkUsageUpgrade(shop, usageStats = {}) {
  const current = shop.businessTier || 'nano';

  // nano → core triggers
  if (current === 'nano') {
    const triggers = [
      usageStats.totalPurchases > 20,
      usageStats.totalSuppliers > 3,
      usageStats.creditSalesPct > 0.3,
      usageStats.totalProducts  > 100,
      shop.gstin && shop.gst_type === 'regular',
    ];
    if (triggers.filter(Boolean).length >= 2) {
      return { newTier: 'core', reason: 'usage_pattern' };
    }
  }

  // core → pro triggers
  if (current === 'core') {
    const triggers = [
      usageStats.totalSales     > 500,
      usageStats.totalPurchases > 100,
      usageStats.monthlyRevenue > 500000,
      usageStats.subUserCount   > 3,
      shop.profileSignals?.manufactures,
    ];
    if (triggers.filter(Boolean).length >= 2) {
      return { newTier: 'pro', reason: 'usage_pattern' };
    }
  }

  return null;
}

module.exports = { inferTier, checkUsageUpgrade };
