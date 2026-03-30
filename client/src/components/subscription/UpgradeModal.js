'use client';

import { useEffect, useMemo, useState } from 'react';
import PlanCard from './PlanCard';
import { API, FALLBACK_PLANS, getToken, loadRazorpayScript } from '../../lib/subscription';

export default function UpgradeModal({
  open,
  onClose,
  plans = FALLBACK_PLANS,
  subscription,
  razorpayKeyId,
  onSuccess,
  initialPlan = 'six_month',
  title = 'Unlock premium access',
  subtitle = 'Choose a plan and complete secure payment.',
}) {
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activePlans = useMemo(() => (plans?.length ? plans : FALLBACK_PLANS), [plans]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError('');
      return;
    }
    setSelectedPlan(initialPlan);
  }, [initialPlan, open]);

  useEffect(() => {
    if (!activePlans.some((plan) => plan.id === selectedPlan)) {
      setSelectedPlan(activePlans[0]?.id || 'six_month');
    }
  }, [activePlans, selectedPlan]);

  if (!open) return null;

  const selected = activePlans.find((plan) => plan.id === selectedPlan) || activePlans[0];

  const startCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const token = getToken();
      if (!token) {
        setError('Please sign in again to continue.');
        setLoading(false);
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        setError('Unable to load Razorpay checkout. Please try again.');
        setLoading(false);
        return;
      }

      const orderRes = await fetch(`${API}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selected.id }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.message || 'Unable to start payment');
      }

      const paymentObject = new window.Razorpay({
        key: orderData.keyId || razorpayKeyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Rakh-Rakhaav',
        description: `${selected.label} premium subscription`,
        order_id: orderData.order.id,
        theme: { color: '#163654' },
        notes: orderData.order.notes,
        handler: async (response) => {
          const verifyRes = await fetch(`${API}/api/payments/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              plan: selected.id,
              ...response,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) {
            throw new Error(verifyData.message || 'Payment verification failed');
          }

          onSuccess?.(verifyData.subscription);
          onClose?.();
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        prefill: {
          name: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.name : '',
        },
      });

      paymentObject.on('payment.failed', () => {
        setError('Payment failed. You can retry securely.');
        setLoading(false);
      });

      paymentObject.open();
    } catch (checkoutError) {
      setError(checkoutError.message || 'Unable to start checkout');
      setLoading(false);
    }
  };

  return (
    <div className="subscription-modal-backdrop">
      <div className="subscription-modal">
        <button
          type="button"
          onClick={onClose}
          className="subscription-modal-close"
          aria-label="Close upgrade modal"
        >x</button>

        <div className="subscription-modal-scroll">
          <div className="subscription-modal-hero">
            <div className="subscription-pill">Premium membership</div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <div className="subscription-plan-grid">
            {activePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan === plan.id}
                onSelect={setSelectedPlan}
                compact
              />
            ))}
          </div>

          <div className="subscription-checkout-summary">
            <div className="subscription-checkout-copy">
              <div className="subscription-checkout-label">Selected plan</div>
              <div className="subscription-checkout-name">{selected?.label || 'Premium membership'}</div>
              <div className="subscription-checkout-note">Secure payment. Premium stays active right away.</div>
            </div>
            <div className="subscription-checkout-price">{selected?.amount ? `Rs ${selected.amount}` : 'Rs 0'}</div>
          </div>

          <div className="subscription-trust-row">
            <span>Secure payment via Razorpay</span>
            <span>No hidden charges</span>
            <span>Cancel anytime</span>
          </div>

          {subscription?.shouldWarnTrial && (
            <div className="subscription-inline-note">
              Trial ends in {subscription.trialDaysLeft} day{subscription.trialDaysLeft === 1 ? '' : 's'}.
            </div>
          )}

          {error && <div className="alert-error" style={{ marginBottom: 0 }}>{error}</div>}
        </div>

        <div className="subscription-modal-footer">
          <div className="subscription-modal-footer-top">
            <div>
              <div className="subscription-checkout-label">Ready to pay</div>
              <div className="subscription-modal-footer-name">{selected?.label || 'Premium membership'}</div>
            </div>
            <div className="subscription-modal-footer-price">{selected?.amount ? `Rs ${selected.amount}` : 'Rs 0'}</div>
          </div>

          <div className="subscription-modal-actions">
            <button type="button" className="btn-primary" onClick={startCheckout} disabled={loading}>
              {loading ? 'Starting secure checkout...' : `Unlock ${selected?.label || 'Premium'}`}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
