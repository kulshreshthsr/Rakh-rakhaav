'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShopSetupPrompt() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('shop-not-configured', handler);
    return () => window.removeEventListener('shop-not-configured', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
        <div className="text-4xl mb-3">🏪</div>
        <h2 className="text-[18px] font-black text-slate-900 mb-2">Shop Setup Incomplete</h2>
        <p className="text-[14px] text-slate-600 mb-5">
          Your shop isn&apos;t set up yet. Complete setup first before using this feature.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => { setVisible(false); router.push('/onboarding'); }}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-black shadow-md hover:-translate-y-0.5 transition-all"
          >
            Complete Setup
          </button>
        </div>
      </div>
    </div>
  );
}
