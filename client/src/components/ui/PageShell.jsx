'use client';
export default function PageShell({ children, className = '' }) {
  return (
    <div className={`desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4 ${className}`.trim()}>
      {children}
    </div>
  );
}
