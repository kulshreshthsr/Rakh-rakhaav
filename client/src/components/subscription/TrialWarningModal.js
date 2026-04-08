'use client';

export default function TrialWarningModal({ open, daysLeft, onClose, onUpgrade }) {
  if (!open) return null;

  return (
    <div className="subscription-modal-backdrop">
      <div className="subscription-modal trial-warning-modal">
        <div className="subscription-pill">Trial reminder</div>
        <h2>Your trial is ending soon</h2>
        <p>
          Subscribe to keep using billing, GST, reports and credit features without interruption.
          {typeof daysLeft === 'number' ? ` ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.` : ''}
        </p>

        <div className="subscription-trust-row mt-4">
          <span>Secure payment via Razorpay</span>
          <span>No hidden charges</span>
          <span>Cancel anytime</span>
        </div>

        <div className="subscription-modal-actions">
          <button type="button" className="btn-primary" onClick={onUpgrade}>
            See plans
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Continue trial
          </button>
        </div>
      </div>
    </div>
  );
}
