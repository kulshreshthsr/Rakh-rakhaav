'use client';

export default function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* Floating emoji */}
      {emoji && (
        <div
          className="text-[72px] leading-none mb-6 select-none"
          style={{ animation: 'es-float 3s ease-in-out infinite' }}
        >
          {emoji}
        </div>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-[20px] font-black text-slate-900 mb-2 tracking-tight">
          {title}
        </h3>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[14px] text-slate-500 max-w-xs leading-relaxed mb-8">
          {subtitle}
        </p>
      )}

      {/* Primary action */}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-green-700 to-emerald-800 text-white font-black text-[14px] shadow-lg shadow-green-700/25 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
        >
          {actionLabel}
        </button>
      )}

      {/* Secondary action */}
      {secondaryLabel && (
        <button
          type="button"
          onClick={onSecondary}
          className="mt-3 text-[13px] text-green-700 font-bold hover:text-green-800 hover:underline underline-offset-2 cursor-pointer transition-colors"
        >
          {secondaryLabel}
        </button>
      )}

      <style>{`
        @keyframes es-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
