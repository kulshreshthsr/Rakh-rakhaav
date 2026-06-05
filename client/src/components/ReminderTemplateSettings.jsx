'use client';
import { useState } from 'react';

export const DEFAULT_REMINDER_TEMPLATES = {
  friendly: `नमस्ते {name} जी 🙏\n{shopName} की तरफ से प्यार भरा याद दिलाना — बाकी राशि ₹{due} है। जब भी सुविधा हो, दे दीजिए। धन्यवाद! 😊`,
  reminder: `नमस्ते {name} जी,\nआपके {shopName} से बाकी ₹{due} का भुगतान कृपया जल्द करें।\nTotal: ₹{total} | Paid: ₹{paid}\nधन्यवाद 🙏`,
  urgent: `⚠️ {name} जी,\n{shopName} का ₹{due} बाकी है। कृपया आज ही payment करें।\nसंपर्क करें — {date}`,
};

const LS_KEY = 'rr-reminder-templates';
const TEMPLATE_META = {
  friendly: { label: 'Friendly', emoji: '😊' },
  reminder: { label: 'Reminder', emoji: '🔔' },
  urgent:   { label: 'Urgent',   emoji: '⚠️' },
};
const VARIABLES = ['{name}', '{due}', '{paid}', '{total}', '{shopName}', '{date}'];

export function loadReminderTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return { ...DEFAULT_REMINDER_TEMPLATES, ...saved };
  } catch {
    return { ...DEFAULT_REMINDER_TEMPLATES };
  }
}

export default function ReminderTemplateSettings({ onClose }) {
  const [active, setActive] = useState('reminder');
  const [templates, setTemplates] = useState(() => loadReminderTemplates());
  const [saved, setSaved] = useState(false);

  const save = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(templates));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* localStorage unavailable */ }
  };

  const reset = () => {
    setTemplates((prev) => ({ ...prev, [active]: DEFAULT_REMINDER_TEMPLATES[active] }));
  };

  const insertVariable = (v) => {
    setTemplates((prev) => ({ ...prev, [active]: prev[active] + v }));
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:rounded-3xl md:max-h-[90vh]">
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">WhatsApp</p>
              <h3 className="text-[20px] font-black text-slate-900 mt-0.5">Reminder Templates</h3>
              <p className="text-[12px] text-slate-400 mt-1">Customer को जाने वाले messages customize करें।</p>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            >✕</button>
          </div>

          {/* Template tabs */}
          <div className="flex gap-2 mb-4">
            {Object.entries(TEMPLATE_META).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all border ${
                  active === key
                    ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300'
                }`}
              >
                {meta.emoji} {meta.label}
              </button>
            ))}
          </div>

          {/* Template editor */}
          <textarea
            className="w-full min-h-[160px] p-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-[13px] text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all resize-none"
            value={templates[active] || ''}
            onChange={(e) => setTemplates((prev) => ({ ...prev, [active]: e.target.value }))}
            placeholder="Template message..."
          />

          {/* Variable quick-insert chips */}
          <div className="mt-2.5 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Variables — tap to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Preview (example values)</p>
            <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
              {(templates[active] || '')
                .replace(/{name}/g, 'Ramesh जी')
                .replace(/{due}/g, '₹2,500.00')
                .replace(/{paid}/g, '₹1,000.00')
                .replace(/{total}/g, '₹3,500.00')
                .replace(/{shopName}/g, 'ABC Store')
                .replace(/{date}/g, new Date().toLocaleDateString('en-IN'))}
            </p>
          </div>

          <div className="flex gap-3 mt-5">
            <button type="button" onClick={save}
              className={`flex-1 py-3 rounded-2xl text-[14px] font-black text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all ${
                saved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-green-600 to-emerald-700'
              }`}
            >
              {saved ? '✓ Saved!' : 'Save Templates'}
            </button>
            <button type="button" onClick={reset}
              className="px-5 py-3 rounded-2xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
