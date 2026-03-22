export const API = 'https://rakh-rakhaav.onrender.com';

export const FALLBACK_PLANS = [
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
