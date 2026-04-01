import { getApiBaseUrl } from './api';

export const API = getApiBaseUrl();
const WELCOME_PENDING_KEY = 'rr-welcome-pending';
const TRIAL_GATE_SEEN_KEY = 'rr-trial-gate-seen';

export const FALLBACK_PLANS = [
  {
    id: 'weekly',
    label: 'Weekly Plan',
    amount: 120,
    badge: 'Trial Pack',
    description: 'Short premium access for quick billing, GST and inventory use through the week.',
    savingsLabel: null,
  },
  {
    id: 'monthly',
    label: 'Starter Monthly',
    amount: 449,
    badge: null,
    description: 'Flexible premium access for shops that want full billing, GST and reports every month.',
    savingsLabel: null,
  },
  {
    id: 'six_month',
    label: 'Growth 6 Months',
    amount: 2500,
    badge: 'Most Chosen',
    description: 'Best balance for daily users who want lower effective monthly cost without long lock-in.',
    savingsLabel: 'Save Rs 194 compared to monthly',
  },
  {
    id: 'yearly',
    label: 'Business Yearly',
    amount: 4499,
    badge: 'Best Savings',
    description: 'Lowest monthly cost for serious businesses that run inventory, GST and billing all year.',
    savingsLabel: 'Maximum savings - Save Rs 889',
  },
];

export function mergePlansWithFallback(plans) {
  const incomingPlans = Array.isArray(plans) ? plans : [];
  const incomingById = new Map(incomingPlans.map((plan) => [plan.id, plan]));

  return FALLBACK_PLANS.map((fallbackPlan) => ({
    ...fallbackPlan,
    ...(incomingById.get(fallbackPlan.id) || {}),
  }));
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function readStoredSubscription() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('subscription-status');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStoredSubscription(subscription) {
  if (typeof window === 'undefined') return;

  if (!subscription) {
    localStorage.removeItem('subscription-status');
    return;
  }

  localStorage.setItem('subscription-status', JSON.stringify(subscription));
}

export function setWelcomePending(value) {
  if (typeof window === 'undefined') return;
  if (value) {
    localStorage.setItem(WELCOME_PENDING_KEY, '1');
    return;
  }
  localStorage.removeItem(WELCOME_PENDING_KEY);
}

export function hasWelcomePending() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(WELCOME_PENDING_KEY) === '1';
}

export function markTrialGateSeen() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TRIAL_GATE_SEEN_KEY, '1');
}

export function clearTrialGateSeen() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TRIAL_GATE_SEEN_KEY);
}

export function hasTrialGateSeen() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(TRIAL_GATE_SEEN_KEY) === '1';
}

export function getTrialWarningKey() {
  return `trial-warning-${new Date().toISOString().slice(0, 10)}`;
}

export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
