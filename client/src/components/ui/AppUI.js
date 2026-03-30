'use client';

import { useEffect, useMemo, useState } from 'react';

function useAnimatedMetric(value) {
  const parts = useMemo(() => {
    const raw = String(value ?? '');
    const match = raw.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!match) return null;
    const numeric = Number(match[0].replace(/,/g, ''));
    if (Number.isNaN(numeric)) return null;
    const decimals = match[0].includes('.') ? match[0].split('.')[1].length : 0;
    return {
      raw,
      prefix: raw.slice(0, match.index),
      suffix: raw.slice((match.index || 0) + match[0].length),
      numeric,
      decimals,
    };
  }, [value]);

  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!parts) return undefined;

    let frame = 0;
    const start = performance.now();
    const duration = 600;

    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - ((1 - progress) * (1 - progress) * (1 - progress));
      const current = parts.numeric * eased;
      const formatted = current.toLocaleString('en-IN', {
        minimumFractionDigits: parts.decimals,
        maximumFractionDigits: parts.decimals,
      });
      setDisplay(`${parts.prefix}${formatted}${parts.suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [parts, value]);

  return parts ? display : value;
}

function AnimatedMetric({ value }) {
  const animated = useAnimatedMetric(value);
  return <>{animated}</>;
}

export function Card({ children, className = '', title, subtitle, actions, tone = 'default' }) {
  return (
    <section className={`ui-card ui-card-${tone} ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="ui-card-head">
          <div>
            {title ? <div className="ui-card-title">{title}</div> : null}
            {subtitle ? <div className="ui-card-subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="ui-card-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, note, tone = 'default', onClick, icon, className = '' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ui-stat-card ui-tone-${tone} ${onClick ? 'is-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <div className="ui-stat-top">
        <div>
          <div className="ui-stat-label">{label}</div>
          <div className="ui-stat-value"><AnimatedMetric value={value} /></div>
        </div>
        {icon ? <div className="ui-stat-icon">{icon}</div> : null}
      </div>
      {note ? <div className="ui-stat-note">{note}</div> : null}
    </Tag>
  );
}

export function ActionButton({
  children,
  variant = 'secondary',
  className = '',
  ...props
}) {
  return (
    <button
      {...props}
      className={`ui-action-btn ui-action-${variant} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ children, tone = 'neutral', className = '' }) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()}>{children}</span>;
}

export const Button = ActionButton;
export const Badge = StatusBadge;

export function DataRow({ label, value, note, tone = 'default', valueTone = '', prefix = '' }) {
  return (
    <div className={`ui-data-row ui-tone-${tone}`.trim()}>
      <div className="ui-data-row-copy">
        <div className="ui-data-row-label">
          {prefix ? <span className="ui-data-row-prefix">{prefix}</span> : null}
          {label}
        </div>
        {note ? <div className="ui-data-row-note">{note}</div> : null}
      </div>
      <div className={`ui-data-row-value ${valueTone}`.trim()}>{value}</div>
    </div>
  );
}
