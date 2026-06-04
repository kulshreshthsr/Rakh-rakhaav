'use client';

import { useState } from 'react';
import { useTier } from '../contexts/TierContext';
import { apiUrl } from '../lib/api';

const getToken = () => localStorage.getItem('token');

/**
 * Shown when a user taps a feature above their tier.
 * Not a hard gate — a soft explanation with a one-tap upgrade.
 * Tier upgrade is usage-triggered (not paywalled), so it's free.
 */
export default function TierUpgradeNudge({ feature, onClose }) {
  const { tier, updateTier } = useTier();
  const [upgrading, setUpgrading] = useState(false);
  const [done, setDone] = useState(false);

  const nudgeContent = {
    nav_purchases: {
      title: 'Purchase tracking unlock करें',
      desc: 'Suppliers से खरीद record करें, stock automatically update होगा।',
      targetTier: 'core',
    },
    nav_gst: {
      title: 'GST filing unlock करें',
      desc: 'GSTR-1, GSTR-3B, और ITC summary — सब एक जगह।',
      targetTier: 'core',
    },
    nav_reports: {
      title: 'Reports unlock करें',
      desc: 'P&L, profit margin, category-wise sales — पूरा picture।',
      targetTier: 'core',
    },
    erp_purchase_orders: {
      title: 'Purchase Orders unlock करें',
      desc: 'Supplier को PO भेजें, delivery track करें, 3-way match करें।',
      targetTier: 'pro',
    },
    erp_multi_location: {
      title: 'Multi-location unlock करें',
      desc: 'एक से ज़्यादा warehouse या branch manage करें।',
      targetTier: 'pro',
    },
  };

  const content = nudgeContent[feature] || {
    title: 'Feature unlock करें',
    desc: 'यह feature आपके current setup में available नहीं है।',
    targetTier: tier === 'nano' ? 'core' : 'pro',
  };

  const tierNames = { nano: 'Starter', core: 'Business', pro: 'Pro' };

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ businessTier: content.targetTier }),
      });
      if (res.ok) {
        updateTier(content.targetTier);
        setDone(true);
        setTimeout(() => { onClose?.(); window.location.reload(); }, 1200);
      }
    } catch { /* silent */ }
    finally { setUpgrading(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-600" />
        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="text-4xl">🎉</div>
              <p className="text-[16px] font-black text-slate-900">Unlock हो गया!</p>
              <p className="text-[13px] text-slate-500">Page reload हो रहा है…</p>
            </div>
          ) : (
            <>
              <h3 className="text-[18px] font-black text-slate-900">{content.title}</h3>
              <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{content.desc}</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  बाद में
                </button>
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-[13px] font-black shadow-lg shadow-green-500/30 disabled:opacity-60"
                >
                  {upgrading ? '…' : `${tierNames[content.targetTier]} Setup में जाएं`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
