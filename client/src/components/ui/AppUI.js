'use client';

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
          <div className="ui-stat-value">{value}</div>
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
