'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function getGstDeadlines() {
  const today = new Date();
  const month = today.getMonth();
  const year  = today.getFullYear();
  const deadlines = [];

  // GSTR-1 due 11th of next month
  const gstr1Due   = new Date(year, month + 1, 11);
  const daysToGstr1 = Math.ceil((gstr1Due - today) / 86400000);
  if (daysToGstr1 >= 0 && daysToGstr1 <= 7) {
    deadlines.push({ type: 'GSTR-1', dueDate: gstr1Due, daysLeft: daysToGstr1, urgent: daysToGstr1 <= 2 });
  }

  // GSTR-3B due 20th of next month
  const gstr3bDue   = new Date(year, month + 1, 20);
  const daysToGstr3b = Math.ceil((gstr3bDue - today) / 86400000);
  if (daysToGstr3b >= 0 && daysToGstr3b <= 7) {
    deadlines.push({ type: 'GSTR-3B', dueDate: gstr3bDue, daysLeft: daysToGstr3b, urgent: daysToGstr3b <= 2 });
  }

  return deadlines;
}

const SESSION_KEY = 'rr-gst-deadline-dismissed';

export default function GstDeadlineBanner({ shop }) {
  const [dismissed, setDismissed] = useState({});
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    if (shop?.gst_type !== 'regular') return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      setDismissed(stored);
    } catch { /* ignore */ }
    setDeadlines(getGstDeadlines());
  }, [shop?.gst_type]);

  if (!shop || shop.gst_type !== 'regular') return null;

  const visible = deadlines.filter((d) => !dismissed[d.type]);
  if (!visible.length) return null;

  const dismiss = (type) => {
    const next = { ...dismissed, [type]: true };
    setDismissed(next);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const formatDate = (date) =>
    date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'long' });

  return (
    <div className="space-y-2">
      {visible.map((d) => (
        <div
          key={d.type}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
            d.urgent
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <span className="text-base flex-shrink-0">{d.urgent ? '🚨' : '📅'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black leading-tight">
              {d.urgent
                ? `${d.type} ${d.daysLeft === 0 ? 'आज due है!' : 'कल due है!'}`
                : `${d.type} ${d.daysLeft} दिन में due है`}
              <span className="font-semibold opacity-60 ml-1.5 text-[12px]">
                ({formatDate(d.dueDate)} तक)
              </span>
            </p>
          </div>
          <Link
            href="/gst"
            className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-xl border transition-colors ${
              d.urgent
                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
            }`}
          >
            GST देखो →
          </Link>
          <button
            type="button"
            onClick={() => dismiss(d.type)}
            className={`flex-shrink-0 text-[14px] font-bold transition-colors ${
              d.urgent ? 'text-red-400 hover:text-red-600' : 'text-amber-400 hover:text-amber-600'
            }`}
            aria-label={`Dismiss ${d.type} reminder`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
