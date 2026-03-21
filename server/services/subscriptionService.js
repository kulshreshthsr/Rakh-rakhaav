const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 5;

const PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    amount: 449,
    months: 1,
    badge: null,
    description: 'Good for testing premium workflows month to month.',
  },
  six_month: {
    id: 'six_month',
    label: '6 Months',
    amount: 2500,
    months: 6,
    badge: 'Most Popular',
    description: 'Balanced savings for growing businesses.',
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly',
    amount: 4499,
    months: 12,
    badge: 'Best Value',
    description: 'Maximum savings for long-term usage.',
  },
};

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getPlanConfig(plan) {
  return PLANS[plan] || null;
}

function ensureTrialDates(user) {
  const now = new Date();
  if (!user.trialStartDate) {
    user.trialStartDate = now;
  }
  if (!user.trialEndDate) {
    user.trialEndDate = addDays(user.trialStartDate, TRIAL_DAYS);
  }
  if (!user.paymentStatus) {
    user.paymentStatus = 'trial';
  }
}

function syncSubscriptionState(user) {
  let dirty = false;
  ensureTrialDates(user);

  const now = new Date();
  const hasActiveSubscription =
    Boolean(user.subscriptionEndDate) &&
    new Date(user.subscriptionEndDate) > now &&
    ['paid', 'verified', 'captured'].includes(user.paymentStatus);

  if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) <= now && user.isPro) {
    user.isPro = false;
    user.subscriptionPlan = null;
    user.subscriptionStartDate = null;
    user.subscriptionEndDate = null;
    user.paymentStatus = 'expired';
    dirty = true;
  } else if (hasActiveSubscription && !user.isPro) {
    user.isPro = true;
    dirty = true;
  }

  return dirty;
}

function getSubscriptionSnapshot(user) {
  ensureTrialDates(user);

  const now = new Date();
  const trialEnd = new Date(user.trialEndDate);
  const subscriptionEnd = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const isTrialActive = now < trialEnd;
  const trialDaysLeft = isTrialActive ? Math.max(0, Math.ceil((trialEnd - now) / DAY_MS)) : 0;
  const isSubscriptionActive =
    Boolean(subscriptionEnd) &&
    subscriptionEnd > now &&
    Boolean(user.isPro) &&
    ['paid', 'verified', 'captured'].includes(user.paymentStatus);
  const hasFullAccess = isTrialActive || isSubscriptionActive;

  return {
    isPro: Boolean(user.isPro && isSubscriptionActive),
    trialStartDate: user.trialStartDate,
    trialEndDate: user.trialEndDate,
    subscriptionPlan: user.subscriptionPlan || null,
    subscriptionStartDate: user.subscriptionStartDate,
    subscriptionEndDate: user.subscriptionEndDate,
    paymentStatus: user.paymentStatus || 'trial',
    isTrialActive,
    isTrialExpired: !isTrialActive,
    trialDaysLeft,
    shouldWarnTrial: isTrialActive && trialDaysLeft <= 3,
    isSubscriptionActive,
    hasFullAccess,
    isReadOnly: !hasFullAccess,
  };
}

function activatePlan(user, planId) {
  const plan = getPlanConfig(planId);
  if (!plan) {
    throw new Error('Invalid subscription plan');
  }

  const start = new Date();
  user.isPro = true;
  user.subscriptionPlan = plan.id;
  user.subscriptionStartDate = start;
  user.subscriptionEndDate = addMonths(start, plan.months);
  user.paymentStatus = 'paid';

  return user;
}

function serializePlans() {
  const monthly = PLANS.monthly.amount;
  return Object.values(PLANS).map((plan) => ({
    ...plan,
    savingsLabel:
      plan.id === 'six_month'
        ? `Save ₹${(monthly * 6) - plan.amount} compared to monthly`
        : plan.id === 'yearly'
          ? `Maximum savings • Save ₹${(monthly * 12) - plan.amount}`
          : null,
  }));
}

module.exports = {
  TRIAL_DAYS,
  PLANS,
  getPlanConfig,
  ensureTrialDates,
  syncSubscriptionState,
  getSubscriptionSnapshot,
  activatePlan,
  serializePlans,
};
