'use client';
export default function Toast({ success = '', error = '', className = '' }) {
  if (!error && !success) return null;
  const isErr = Boolean(error);
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-semibold ${isErr ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} ${className}`.trim()}>
      <span>{isErr ? '⚠️' : '✅'}</span>
      <span>{error || success}</span>
    </div>
  );
}
