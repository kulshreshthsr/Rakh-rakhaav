'use client';
import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast';

const VARIANT = {
  success: { bar: 'bg-green-500',  border: 'border-green-200',  icon: '✅', textCls: 'text-green-800',  prog: 'bg-green-400'  },
  error:   { bar: 'bg-red-500',    border: 'border-red-200',    icon: '❌', textCls: 'text-red-800',    prog: 'bg-red-400'    },
  warning: { bar: 'bg-amber-500',  border: 'border-amber-200',  icon: '⚠️', textCls: 'text-amber-800',  prog: 'bg-amber-400'  },
  info:    { bar: 'bg-blue-500',   border: 'border-blue-200',   icon: 'ℹ️', textCls: 'text-blue-800',   prog: 'bg-blue-400'   },
};

const DELAYS = { success: 3500, info: 3500, warning: 3500, error: 5000 };

function ToastItem({ toast, onDismiss }) {
  const v = VARIANT[toast.variant] || VARIANT.info;
  const delay = DELAYS[toast.variant] || 3500;
  const [visible, setVisible] = useState(false);
  const [progWidth, setProgWidth] = useState(100);

  /* Entrance animation — trigger after first paint */
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Progress bar: starts at 100%, transitions to 0 over `delay` ms */
  useEffect(() => {
    const tid = setTimeout(() => setProgWidth(0), 16);
    return () => clearTimeout(tid);
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative flex items-start w-full sm:w-[360px] backdrop-blur-md bg-white/90 border ${v.border} rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
    >
      {/* Left color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${v.bar} flex-shrink-0`} />

      <div className="flex flex-col px-4 py-3 pl-5 w-full min-w-0 gap-2">
        <div className="flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5 leading-none">{v.icon}</span>
          <p className={`flex-1 text-[13px] font-semibold leading-snug break-words ${v.textCls}`}>
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="flex-shrink-0 ml-1 text-slate-400 hover:text-slate-600 text-lg leading-none transition-colors"
          >×</button>
        </div>
        {toast.actions && toast.actions.length > 0 && (
          <div className="flex gap-2 flex-wrap ml-7">
            {toast.actions.map((action, i) => (
              <button key={i} type="button"
                onClick={() => { action.onClick(); onDismiss(toast.id); }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors ${
                  i === 0 ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >{action.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar — shrinks to zero over auto-dismiss delay */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${v.prog}`}
        style={{ width: `${progWidth}%`, transition: `width ${delay}ms linear` }}
      />
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-20 sm:bottom-6 left-0 sm:left-auto right-0 sm:right-4 z-[9999] flex flex-col-reverse gap-2 items-center sm:items-end px-3 sm:px-0 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full sm:w-auto">
          <ToastItem toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
