'use client';
import { useState } from 'react';

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-[10px] font-mono text-gray-700 shadow-sm whitespace-nowrap">
      {children}
    </kbd>
  );
}

/**
 * Reusable keyboard shortcut discoverability tooltip.
 * Place a ? button wherever you want; clicking it shows a shortcut table.
 *
 * @param {Array<{key: string, action: string}>} shortcuts
 */
export default function KeyboardShortcutsTooltip({ shortcuts }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Keyboard shortcuts"
        className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[12px] font-black text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        title="Keyboard shortcuts"
      >
        ?
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-label="Close shortcuts"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10"
          />

          <div className="absolute bottom-full right-0 mb-2 z-20 w-[260px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Keyboard Shortcuts</p>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm leading-none">✕</button>
            </div>
            <div className="space-y-2">
              {shortcuts.map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-slate-600 flex-1">{action}</span>
                  <Kbd>{key}</Kbd>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 border-t border-slate-100 pt-2">
              Ctrl = ⌘ on Mac
            </p>
          </div>
        </>
      )}
    </div>
  );
}
