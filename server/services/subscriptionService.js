const { calculateDaysRemaining } = require('../utils/subscriptionUtils');

const TRIAL_DAYS = 7;
const TRIAL_WARNING_DAYS = 3;

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
    label: 'Starter Monthly',
    amount: 449,
    months: 1,
    badge: null,
    description: 'Flexible premium access for shops that want full billing, GST and reports every month.',
  },
  six_month: {
    id: 'six_month',
    label: 'Growth 6 Months',
    amount: 2500,
    months: 6,
    badge: 'Most Chosen',
    description: 'Best balance for daily users who want lower effective monthly cost without long lock-in.',
  },
  yearly: {
    id: 'yearly',
    label: 'Business Yearly',
    amount: 4499,
    months: 12,
    badge: 'Best Savings',
    description: 'Lowest monthly cost for serious businesses that run inventory, GST and billing all year.',
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
  const expectedTrialEndDate = addDays(user.trialStartDate, TRIAL_DAYS);
  if (!user.trialEndDate || new Date(user.trialEndDate) < expectedTrialEndDate) {
    user.trialEndDate = expectedTrialEndDate;
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

function isLegacyTestPlan(user) {
  return user.subscriptionPlan === 'test_10' || user.subscriptionType === 'test_10';
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
  if (isLegacyTestPlan(user)) {
    user.isPro = false;
    user.subscriptionPlan = null;
    user.subscriptionType = 'trial';
    user.subscriptionStartDate = null;
    user.subscriptionEndDate = null;
    user.paymentStatus = new Date(user.trialEndDate) > now ? 'trial' : 'expired';
    dirty = true;
  }

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
    shouldWarnTrial: isTrialActive && trialDaysLeft <= TRIAL_WARNING_DAYS,
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

  const now = new Date();
  const currentEnd = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const start = currentEnd && currentEnd > now ? currentEnd : now;
  user.isPro = true;
  user.subscriptionPlan = plan.id;
  user.subscriptionType = mapPlanToSubscriptionType(plan.id);
  if (!user.subscriptionStartDate || !currentEnd || currentEnd <= now) {
    user.subscriptionStartDate = now;
  }
  user.subscriptionEndDate = addMonths(start, plan.months);
  user.paymentStatus = 'paid';

  return user;
}

function serializePlans() {
  const monthly = PLANS.monthly.amount;
  return Object.values(PLANS).filter((plan) => plan.id !== 'test_10').map((plan) => ({
    ...plan,
    savingsLabel:
      plan.id === 'six_month'
        ? `Save Rs ${(monthly * 6) - plan.amount} compared to monthly`
        : plan.id === 'yearly'
          ? `Maximum savings - Save Rs ${(monthly * 12) - plan.amount}`
          : null,
  }));
}

module.exports = {
  TRIAL_DAYS,
  TRIAL_WARNING_DAYS,
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
