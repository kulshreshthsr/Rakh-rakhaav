const { calculateDaysRemaining } = require('../utils/subscriptionUtils');

const TRIAL_DAYS = 5;

const PLANS = {
  test_10: {
    id: 'test_10',
    label: 'Test Rs 10',
    amount: 10,
    months: 1,
    badge: 'Test',
    description: 'Temporary low-value plan for real payment verification.',
  },
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
  if (!user.subscriptionType) {
    user.subscriptionType = user.subscriptionPlan ? mapPlanToSubscriptionType(user.subscriptionPlan) : 'trial';
  }
}

function mapPlanToSubscriptionType(plan) {
  if (plan === 'six_month') return '6months';
  if (plan === 'test_10' || plan === 'monthly' || plan === 'yearly') return plan;
  return 'trial';
}

function getAdminSubscriptionStatus(user) {
  ensureTrialDates(user);
  const now = new Date();
  const trialEnd = new Date(user.trialEndDate);
  const subscriptionEnd = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;

  if (subscriptionEnd && subscriptionEnd > now && Boolean(user.isPro)) {
    return 'active';
  }

  if (trialEnd > now) {
    return 'trial';
  }

  return 'expired';
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
    if (!user.subscriptionType) {
      user.subscriptionType = user.subscriptionPlan ? mapPlanToSubscriptionType(user.subscriptionPlan) : 'trial';
    }
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
  const trialDaysLeft = isTrialActive ? calculateDaysRemaining(trialEnd) : 0;
  const isSubscriptionActive =
    Boolean(subscriptionEnd) &&
    subscriptionEnd > now &&
    Boolean(user.isPro) &&
    ['paid', 'verified', 'captured'].includes(user.paymentStatus);
  const hasFullAccess = isTrialActive || isSubscriptionActive;

  return {
    isPro: Boolean(user.isPro && isSubscriptionActive),
    subscriptionType: user.subscriptionType || (isTrialActive ? 'trial' : mapPlanToSubscriptionType(user.subscriptionPlan)),
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
  user.subscriptionType = mapPlanToSubscriptionType(plan.id);
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
      plan.id === 'test_10'
        ? null
        : plan.id === 'six_month'
          ? `Save Rs ${(monthly * 6) - plan.amount} compared to monthly`
          : plan.id === 'yearly'
            ? `Maximum savings - Save Rs ${(monthly * 12) - plan.amount}`
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
  getAdminSubscriptionStatus,
  mapPlanToSubscriptionType,
  activatePlan,
  serializePlans,
};
