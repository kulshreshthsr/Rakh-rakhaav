'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

function Glyph({ name, size = 20, stroke = 1.8 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  const icons = {
    products:   <><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></>,
    expenses:   <><path d="M6 4.5h12" /><path d="M6 9.5h12" /><path d="M6 14.5h7" /><path d="M17 14v6" /><path d="M14 17h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></>,
    income:     <><path d="M12 20V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    bank:       <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
    gst:        <><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></>,
    reports:    <><path d="M5 19.5V10.5" /><path d="M12 19.5V5.5" /><path d="M19 19.5V13.5" /><path d="M3.5 19.5h17" /></>,
    profile:    <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    team:       <><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a6 6 0 0 1 6-6" /><path d="M16 11c2.2 0 4 1.8 4 4v1.5" /><circle cx="19" cy="8" r="2.5" /></>,
    roles:      <><path d="M12 3 4 7v5c0 5 4 9.7 8 11 4-1.3 8-6 8-11V7z" /><path d="m9 12 2 2 4-4" /></>,
    bell:       <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    checklist:  <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m8 10 2 2 4-4" /><path d="M13 14h3" /><path d="M13 10h3" /></>,
    history:    <><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .5 4M3 15v-4h4" /></>,
    pricing:    <path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z" />,
    close:      <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
    logout:     <><path d="M10 7V5.5A2.5 2.5 0 0 1 12.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-5.5A2.5 2.5 0 0 1 10 18.5V17" /><path d="M14 12H3.5" /><path d="m7.5 8-4 4 4 4" /></>,
  };
  return <svg {...p}>{icons[name] || <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />}</svg>;
}

const iconColors = {
  products:      'bg-emerald-50 text-emerald-700',
  expenses:      'bg-rose-50 text-rose-700',
  income:        'bg-green-50 text-green-700',
  bank:          'bg-blue-50 text-blue-700',
  reports:       'bg-purple-50 text-purple-700',
  gst:           'bg-amber-50 text-amber-700',
  profile:       'bg-slate-100 text-slate-700',
  team:          'bg-green-50 text-green-700',
  roles:         'bg-purple-50 text-purple-700',
  notifications: 'bg-red-50 text-red-600',
  tasks:         'bg-indigo-50 text-indigo-700',
  audit:         'bg-sky-50 text-sky-700',
};

export default function MoreDrawer({ open, onClose, items = [], currentPath, onLogout, subscription }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        role="dialog"
        aria-label="More options"
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl shadow-slate-900/30 border-t-2 border-green-200 max-h-[85dvh] overflow-y-auto">
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-green-200" />
          </div>

          <div className="flex items-center justify-between px-5 pt-3 pb-5 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-700">Quick Access</p>
              <h2 className="text-[20px] font-black text-slate-900 mt-1">और विकल्प</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-100 hover:text-red-600 transition-all hover:scale-105"
            >
              <Glyph name="close" size={18} stroke={2.5} />
            </button>
          </div>

          <div className="px-4 pb-3 pt-3 grid grid-cols-1 gap-2.5">
            {items.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    isActive
                      ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-green-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform ${
                    isActive ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white shadow-green-500/30' : iconColors[item.key] || 'bg-slate-100 text-slate-600'
                  }`}>
                    <Glyph name={item.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[16px] font-black leading-tight ${isActive ? 'text-green-800' : 'text-slate-900'}`}>
                      {item.label}
                    </div>
                    <div className={`text-[12px] font-medium mt-1 ${isActive ? 'text-green-600' : 'text-slate-500'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600 flex-shrink-0 shadow-lg shadow-green-500/50" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="px-4 pb-3 pt-2">
            <Link href="/pricing" onClick={onClose}
              className="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 px-5 py-4 transition-all hover:-translate-y-1 hover:border-green-400 hover:shadow-xl hover:shadow-green-500/20"
            >
              <div className="pointer-events-none absolute inset-y-0 -left-1 w-28 bg-gradient-to-r from-white/80 via-white/30 to-transparent skew-x-[-18deg] animate-[premiumShine_3s_ease-in-out_infinite]" />
              <div className="relative z-10 w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/30">
                <Glyph name="pricing" size={20} />
              </div>
              <div className="relative z-10 flex-1">
                <div className="text-[16px] font-black text-green-900">
                  {subscription?.isPro ? 'Manage Plan' : 'Upgrade करें'}
                </div>
                <div className="text-[13px] text-green-700 font-semibold">
                  {subscription?.isPro ? 'Pro plan active ✓' : 'Pro features unlock करें'}
                </div>
              </div>
              <div className="relative z-10 text-green-600">
                <Glyph name="pricing" size={18} />
              </div>
            </Link>
          </div>

          <div className="px-4 pb-7 pt-2">
            <button
              type="button"
              onClick={() => { onClose(); onLogout(); }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-red-200 bg-red-50 text-[15px] font-black text-red-700 hover:bg-red-100 hover:border-red-300 transition-all shadow-md hover:shadow-lg"
            >
              <Glyph name="logout" size={18} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
