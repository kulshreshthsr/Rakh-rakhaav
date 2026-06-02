'use client';
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className={action ? 'flex items-start justify-between' : ''}>
      <div>
        <h1 className="text-[22px] font-black text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
