'use client';

import Link from 'next/link';

/* Human-readable labels + descriptions for every requireFeature() flag */
const FEATURE_META = {
  billing_quotation:     { label: 'Quotation Creation',              desc: 'Quotations create करें और invoice में convert करें।',                         tier: 'core' },
  invoice_gst:           { label: 'GST Invoice',                     desc: 'GST-compliant tax invoices generate करें।',                                    tier: 'core' },
  invoice_challan:       { label: 'Delivery Challan',                desc: 'Delivery challans issue करें जिन्हें बाद में invoice में convert कर सकते हैं।', tier: 'core' },
  erp_grn:               { label: 'Goods Receipt Notes (GRN)',        desc: 'PO ke against stock receive करें और GRN auto-create करें।',                   tier: 'core' },
  erp_credit_aging:      { label: 'Credit Aging Reports',             desc: 'Overdue customer credit का detailed aging view देखें।',                       tier: 'core' },
  erp_pl_statement:      { label: 'P&L Statement',                   desc: 'Profit & Loss statement देखें।',                                               tier: 'core' },
  erp_supplier_ledger:   { label: 'Supplier Ledger',                  desc: 'Supplier-wise ledger और payment history track करें।',                         tier: 'core' },
  module_bulk_import:    { label: 'Bulk Data Import',                 desc: 'Products, customers, या transactions bulk import करें।',                      tier: 'core' },
  erp_purchase_orders:   { label: 'Purchase Orders (PO to GRN)',      desc: 'POs draft करें, supplier को send करें, और stock receive करें।',               tier: 'pro'  },
  erp_multi_location:    { label: 'Multi-location Inventory',         desc: 'Multiple warehouses या branches का stock manage करें।',                        tier: 'pro'  },
  erp_eway_bill:         { label: 'Automatic E-Way Bill Generation',  desc: 'NIC portal के through ₹50,000+ invoices के लिए E-Way Bills auto-generate करें।', tier: 'pro' },
  erp_einvoice:          { label: 'E-Invoice (IRN) Generation',       desc: 'IRP portal के through GST e-invoices और IRN generate करें।',                  tier: 'pro'  },
  report_stock_valuation:{ label: 'Stock Valuation Report',           desc: 'Weighted average cost method से inventory valuation निकालें।',                tier: 'pro'  },
  report_stock_aging:    { label: 'Stock Aging Report',               desc: 'Slow-moving और dead stock identify करें।',                                    tier: 'pro'  },
  report_full_pl:        { label: 'Full P&L Report',                  desc: 'Detailed profit & loss with all line items।',                                  tier: 'pro'  },
  report_balance_sheet:  { label: 'Balance Sheet',                    desc: 'Full balance sheet view।',                                                     tier: 'pro'  },
};

const TIER_LABEL = { core: 'Core', pro: 'Pro' };
const TIER_COLOR = {
  core: { badge: 'bg-blue-100 text-blue-800 border-blue-200',   btn: 'bg-blue-600 hover:bg-blue-700' },
  pro:  { badge: 'bg-violet-100 text-violet-800 border-violet-200', btn: 'bg-violet-600 hover:bg-violet-700' },
};

/**
 * Modal displayed when a backend route returns code: 'FEATURE_NOT_IN_TIER'.
 *
 * Props:
 *   feature     {string}   - The feature flag name from the error response
 *   currentTier {string}   - The shop's current tier from the error response
 *   onClose     {function} - Called when the user dismisses
 */
export default function FeatureLockedModal({ feature, currentTier, onClose }) {
  if (!feature) return null;

  const meta      = FEATURE_META[feature] || { label: feature, desc: 'यह feature आपके plan में available नहीं है।', tier: 'pro' };
  const requiredTier = meta.tier;
  const colors    = TIER_COLOR[requiredTier] || TIER_COLOR.pro;
  const tierLabel = TIER_LABEL[requiredTier] || 'Pro';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-[28px] bg-white shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Feature Locked</p>
              <h2 className="text-base font-black text-slate-900 leading-tight">{meta.label}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 text-sm font-black transition-all"
            aria-label="Close"
          >✕</button>
        </div>

        {/* Plan badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-black ${colors.badge}`}>
            ⭐ {tierLabel} Plan में available है
          </span>
        </div>

        {/* Description */}
        <p className="text-[13px] text-slate-600 leading-relaxed mb-1">{meta.desc}</p>
        <p className="text-[12px] text-slate-400 mb-5">
          आपका current plan: <span className="font-black text-slate-600 capitalize">{currentTier || 'Nano'}</span>
          {' · '}
          Required: <span className={`font-black ${requiredTier === 'pro' ? 'text-violet-700' : 'text-blue-700'}`}>{tierLabel}</span>
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <Link
            href="/pricing"
            onClick={onClose}
            className={`flex items-center justify-center w-full min-h-[44px] rounded-2xl text-white text-sm font-black transition-all ${colors.btn}`}
          >
            🚀 Upgrade to {tierLabel} →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[40px] rounded-2xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all"
          >
            बाद में देखें / Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
