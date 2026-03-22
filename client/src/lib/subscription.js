export const API = 'https://rakh-rakhaav.onrender.com';

export const FALLBACK_PLANS = [
  {
    id: 'test_10',
    label: 'Test Rs 10',
    amount: 10,
    badge: 'Test',
    description: 'Temporary low-value plan for real payment verification.',
    savingsLabel: null,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    amount: 449,
    badge: null,
    description: 'Flexible access for businesses getting started.',
    savingsLabel: null,
  },
  {
    id: 'six_month',
    label: '6 Months',
    amount: 2500,
    badge: 'Most Popular',
    description: 'Balanced pricing for businesses using the app every day.',
    savingsLabel: 'Save Rs 194 compared to monthly',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    amount: 4499,
    badge: 'Best Value',
    description: 'Maximum savings with long-term premium access.',
    savingsLabel: 'Maximum savings - Save Rs 889',
  },
];

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
