'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * SearchableProductSelect
 * Props:
 *   products     — array of product objects
 *   value        — selected product_id
 *   onChange     — fn(product_id) called on selection
 *   placeholder  — string
 *   disabled     — bool
 */
export default function SearchableProductSelect({
  products = [], value, onChange,
  placeholder = 'उत्पाद खोजें / Search product...',
  disabled = false,
}) {
  const [query,   setQuery]   = useState('');
  const [open,    setOpen]    = useState(false);
  const wrapperRef            = useRef(null);
  const inputRef              = useRef(null);

  const selected = products.find(p => p._id === value);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.hsn_code && p.hsn_code.toLowerCase().includes(q));
  });

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (prod) => { onChange(prod._id); setOpen(false); setQuery(''); };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true); setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const stockColor = (qty) => {
    if (qty === 0) return '#EF4444';
    if (qty <= 5)  return '#D97706';
    return '#059669';
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <div onClick={handleOpen} style={{
        padding: '10px 14px',
        border: `1.5px solid ${open ? '#4F46E5' : 'var(--border, #E2E8F0)'}`,
        borderRadius: 'var(--radius-sm, 10px)',
        fontSize: 13.5, color: selected ? 'var(--text, #0F172A)' : 'var(--text-5, #CBD5E1)',
        background: 'var(--surface, #fff)', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        boxShadow: open ? '0 0 0 3px rgba(79,70,229,0.1)' : 'none',
        transition: 'all 0.15s', userSelect: 'none', opacity: disabled ? 0.6 : 1,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: selected ? 600 : 400 }}>
          {selected ? `${selected.name}${selected.gst_rate > 0 ? ` · GST ${selected.gst_rate}%` : ''}` : placeholder}
        </span>
        {selected && (
          <span style={{ fontSize: 11, fontWeight: 700, color: stockColor(selected.quantity || selected.stock || 0), flexShrink: 0, background: 'var(--surface-2, #F8FAFB)', padding: '2px 8px', borderRadius: 100 }}>
            Stock: {selected.quantity ?? selected.stock ?? 0}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94A3B8' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface, #fff)',
          border: '1.5px solid #4F46E5',
          borderRadius: 'var(--radius-sm, 10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'dropFadeIn 0.14s ease',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #E2E8F0)', background: 'var(--surface-2, #F8FAFC)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#94A3B8', flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input ref={inputRef} type="text" placeholder="नाम या HSN से खोजें..." value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text, #0F172A)', fontFamily: 'var(--font-body, "Plus Jakarta Sans")' }} />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94A3B8', lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Options */}
          <div style={{ maxHeight: 224, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-4, #94A3B8)', fontSize: 13 }}>
                कोई product नहीं मिला
              </div>
            ) : (
              filtered.map(prod => {
                const stock     = prod.quantity ?? prod.stock ?? 0;
                const isSelected = prod._id === value;
                const isOut     = stock === 0;
                return (
                  <div key={prod._id} onClick={() => !isOut && handleSelect(prod)} style={{
                    padding: '10px 13px', cursor: isOut ? 'not-allowed' : 'pointer',
                    background: isSelected ? 'rgba(79,70,229,0.07)' : 'transparent',
                    borderBottom: '1px solid var(--border-2, #F1F5F9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    opacity: isOut ? 0.45 : 1, transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isOut && !isSelected) e.currentTarget.style.background = 'var(--surface-2, #F8FAFC)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(79,70,229,0.07)' : 'transparent'; }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: isSelected ? 700 : 600, color: isSelected ? '#4F46E5' : 'var(--text, #0F172A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isSelected && (
                          <svg width="11" height="11" viewBox="0 0 11 11" style={{ marginRight: 5, color: '#4F46E5', verticalAlign: 'middle' }}>
                            <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        )}
                        {prod.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4, #94A3B8)', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        {prod.hsn_code && <span>HSN: {prod.hsn_code}</span>}
                        {prod.gst_rate > 0 && <span>GST {prod.gst_rate}%</span>}
                        {prod.unit && <span>{prod.unit}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: stockColor(stock), background: stock === 0 ? '#FEF2F2' : stock <= 5 ? '#FFFBEB' : '#ECFDF5', padding: '2px 8px', borderRadius: 100 }}>
                        {isOut ? 'Out' : `${stock} left`}
                      </div>
                      {prod.price && <div style={{ fontSize: 11, color: 'var(--text-4, #94A3B8)', marginTop: 2 }}>₹{prod.price}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes dropFadeIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }`}</style>
    </div>
  );
}