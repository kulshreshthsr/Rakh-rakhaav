'use client';
import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

const RECURRING_KEY = 'rr-recurring-invoices';

function getRecurringInvoices() {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]'); } catch { return []; }
}

function saveRecurringInvoices(list) {
  try { localStorage.setItem(RECURRING_KEY, JSON.stringify(list)); } catch {}
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const FREQUENCY_OPTIONS = [
  { value: 'weekly',  label: 'Weekly',    labelHi: 'साप्ताहिक', days: 7 },
  { value: 'monthly', label: 'Monthly',   labelHi: 'मासिक',    days: 30 },
  { value: 'custom',  label: 'Custom',    labelHi: 'Custom',   days: null },
];

export default function RecurringInvoiceModal({ sale, onClose, onSaved }) {
  const { showToast } = useToast();

  const [frequency, setFrequency] = useState('monthly');
  const [customDays, setCustomDays] = useState(30);
  const [nextDueDate, setNextDueDate] = useState(() => {
    const freq = FREQUENCY_OPTIONS.find(f => f.value === 'monthly');
    return addDays(todayStr(), freq?.days || 30);
  });
  const [autoWhatsApp, setAutoWhatsApp] = useState(false);
  const [active, setActive] = useState(true);

  const handleFrequencyChange = (val) => {
    setFrequency(val);
    const freq = FREQUENCY_OPTIONS.find(f => f.value === val);
    if (freq?.days) setNextDueDate(addDays(todayStr(), freq.days));
  };

  const frequencyDays = frequency === 'custom'
    ? (Number(customDays) || 30)
    : (FREQUENCY_OPTIONS.find(f => f.value === frequency)?.days || 30);

  const handleSave = () => {
    if (!sale) return;
    const entry = {
      id: crypto.randomUUID(),
      templateSaleId: sale._id,
      items: sale.items || [],
      buyerName: sale.buyer_name || '',
      buyerPhone: sale.buyer_phone || '',
      totalAmount: sale.total_amount,
      frequency,
      frequencyDays,
      nextDueDate,
      autoWhatsApp,
      active,
      createdAt: new Date().toISOString(),
    };
    const existing = getRecurringInvoices();
    saveRecurringInvoices([...existing, entry]);
    showToast(`Recurring bill set! अगला bill ${nextDueDate} को due होगा।`, 'success');
    onSaved?.();
    onClose();
  };

  const total = Number(sale?.total_amount || 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col">

        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-[17px] font-black text-slate-900">🔁 Set as Recurring</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {sale?.buyer_name || 'Walk-in'} · ₹{total.toFixed(2)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Customer info — pre-filled, read-only */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Customer</p>
            <p className="text-[14px] font-black text-slate-900">{sale?.buyer_name || 'Walk-in Customer'}</p>
            {sale?.buyer_phone && <p className="text-[12px] text-slate-500">{sale.buyer_phone}</p>}
            <p className="text-[12px] text-slate-500">{(sale?.items || []).length} items · ₹{total.toFixed(2)}</p>
          </div>

          {/* Frequency */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Frequency</p>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFrequencyChange(opt.value)}
                  className={`py-2.5 rounded-xl border-2 text-[12px] font-black transition-all ${
                    frequency === opt.value
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-green-300'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${frequency === opt.value ? 'text-green-100' : 'text-slate-400'}`}>
                    {opt.labelHi}
                  </div>
                </button>
              ))}
            </div>
            {frequency === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-[12px] font-semibold text-slate-600 flex-shrink-0">हर</p>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => {
                    const d = Math.max(1, Number(e.target.value) || 1);
                    setCustomDays(d);
                    setNextDueDate(addDays(todayStr(), d));
                  }}
                  className="w-20 h-10 px-3 rounded-xl border-2 border-slate-200 text-center text-[14px] font-black focus:outline-none focus:border-green-500"
                />
                <p className="text-[12px] font-semibold text-slate-600 flex-shrink-0">दिन</p>
              </div>
            )}
          </div>

          {/* Next due date */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Next Due Date</p>
            <input
              type="date"
              value={nextDueDate}
              min={todayStr()}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
            />
          </div>

          {/* Auto WhatsApp reminder */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-slate-900">📱 Auto WhatsApp Reminder</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Due date पर customer को WA message भेजें</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoWhatsApp((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${autoWhatsApp ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${autoWhatsApp ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-slate-900">Active</p>
              <p className="text-[11px] text-slate-400 mt-0.5">बंद करने पर reminders नहीं आएंगे</p>
            </div>
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${active ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-lg shadow-green-500/20 hover:-translate-y-0.5 transition-all">
            🔁 Set Recurring
          </button>
        </div>
      </div>
    </div>
  );
}
