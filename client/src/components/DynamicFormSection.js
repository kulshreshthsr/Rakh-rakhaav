'use client';
import DynamicFormField from './DynamicFormField';

/**
 * Renders a named form section containing schema-driven fields.
 *
 * Props:
 *   section  — { title, fields[] }
 *   values   — current metadata object
 *   onChange — (key, value) => void
 *   errors   — optional { [fieldKey]: errorString } from validateSections()
 *
 * Each field: { key, label, type, required?, placeholder?, options?,
 *   hint?, defaultValue?, visibleWhen?: { key, value } }
 *
 * visibleWhen — field is hidden unless values[visibleWhen.key] matches value.
 *   Supports boolean (checkbox), string (select/text), and array (one-of).
 */
function isVisible(field, values) {
  if (!field.visibleWhen) return true;
  const { key, value } = field.visibleWhen;
  const current = values[key];
  if (typeof value === 'boolean') return Boolean(current) === value;
  if (Array.isArray(value)) return value.includes(current);
  return String(current ?? '') === String(value);
}

export default function DynamicFormSection({ section, values, onChange, errors = {} }) {
  const visibleFields = (section.fields || []).filter(f => isVisible(f, values));
  if (!visibleFields.length) return null;

  const hasError = visibleFields.some(f => errors[f.key]);

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${hasError ? 'border-rose-200 bg-rose-50/40' : 'border-green-100 bg-green-50/60'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${hasError ? 'text-rose-700' : 'text-green-700'}`}>
        {section.title}
      </p>

      {visibleFields.map(field => {
        const val = values[field.key] ?? (field.defaultValue ?? (field.type === 'multiselect' ? [] : ''));
        const fieldError = errors[field.key];
        return (
          <div key={field.key}>
            {field.type !== 'checkbox' && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {field.label}
                {field.required && <span className="text-rose-500 ml-0.5">*</span>}
              </p>
            )}

            <DynamicFormField
              field={field}
              value={val}
              onChange={v => onChange(field.key, v)}
              error={fieldError}
            />

            {field.hint && !fieldError && (
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{field.hint}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Flattens all fields from all sections into a single array.
 * Useful for building product-card metadata pills.
 */
export function flattenSectionFields(sections = []) {
  return sections.flatMap(s => s.fields || []);
}

/**
 * Formats a metadata value for display.
 * Handles arrays (multiselect), booleans (checkbox), and plain strings.
 */
export function formatMetaValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value);
}

/**
 * Validates required fields across all sections.
 * Returns { [fieldKey]: errorMessage } for every required field that is empty.
 * Returns {} if all required fields are filled.
 */
export function validateSections(sections, values) {
  const errs = {};
  for (const section of (sections || [])) {
    for (const field of (section.fields || [])) {
      if (!field.required) continue;
      const val = values[field.key];
      const isEmpty =
        val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) errs[field.key] = `${field.label} is required`;
    }
  }
  return errs;
}
