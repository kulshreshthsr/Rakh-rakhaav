'use client';

/**
 * Renders a single form field driven by a schema descriptor.
 *
 * Props:
 *   field   — { key, label, type, placeholder?, options?, required?, step?,
 *               min?, max?, hint?, defaultValue?, visibleWhen? }
 *   value   — current value
 *   onChange — (newValue) => void
 *   error   — optional error string; shows red border + message below field
 *
 * Supported types: text, number, date, select, multiselect, checkbox, textarea, tags
 */
export default function DynamicFormField({ field, value, onChange, error }) {
  const borderCls = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/30'
    : 'border-slate-200 focus:border-green-600 focus:ring-green-500/30';
  const base =
    `h-11 w-full rounded-xl border-2 ${borderCls} bg-white px-4 text-[14px] ` +
    'text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all';

  const ph = field.placeholder || field.label;

  let content;

  /* ── Checkbox ── */
  if (field.type === 'checkbox') {
    content = (
      <label className="flex items-center gap-3 cursor-pointer select-none group">
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
          />
          <div className={`w-10 h-6 rounded-full transition-all ${value ? 'bg-green-500' : 'bg-slate-200'}`} />
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
        <span className="text-[13px] font-semibold text-slate-700 group-hover:text-slate-900">
          {value ? 'Yes' : 'No'}
        </span>
      </label>
    );
  }

  /* ── Multi-select (pill buttons) ── */
  else if (field.type === 'multiselect') {
    const selected = Array.isArray(value)
      ? value
      : (value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : []);
    content = (
      <div className={`flex flex-wrap gap-1.5 ${error ? 'p-2 rounded-xl border-2 border-rose-400 bg-rose-50/40' : ''}`}>
        {(field.options || []).map(opt => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = isActive ? selected.filter(s => s !== opt) : [...selected, opt];
                onChange(next);
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                isActive
                  ? 'bg-green-600 border-green-600 text-white shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700 bg-white'
              }`}
            >{opt}</button>
          );
        })}
      </div>
    );
  }

  /* ── Tags (comma-separated with visual preview) ── */
  else if (field.type === 'tags') {
    const raw = Array.isArray(value) ? value.join(', ') : (value || '');
    const tags = raw.split(',').map(t => t.trim()).filter(Boolean);
    content = (
      <div>
        <input
          className={base}
          type="text"
          value={raw}
          onChange={e => onChange(e.target.value)}
          placeholder={ph || 'Enter values separated by commas'}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Select ── */
  else if (field.type === 'select') {
    content = (
      <select
        className={base}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{ph}</option>
        {(field.options || []).map(opt =>
          typeof opt === 'object'
            ? <option key={opt.value} value={opt.value}>{opt.label}</option>
            : <option key={opt} value={opt}>{opt}</option>
        )}
      </select>
    );
  }

  /* ── Textarea ── */
  else if (field.type === 'textarea') {
    content = (
      <textarea
        className={`${base} h-20 py-3 resize-none`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
      />
    );
  }

  /* ── Text / Number / Date ── */
  else {
    content = (
      <input
        className={base}
        type={
          field.type === 'number' ? 'number'
          : field.type === 'date' ? 'date'
          : 'text'
        }
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
        step={field.type === 'number' ? (field.step ?? '1') : undefined}
        min={field.min}
        max={field.max}
      />
    );
  }

  return (
    <>
      {content}
      {error && (
        <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </>
  );
}
