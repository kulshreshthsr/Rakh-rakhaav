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
export default function SearchableProductSelect({ products = [], value, onChange, placeholder = 'उत्पाद खोजें / Search product...', disabled = false }) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const wrapperRef              = useRef(null);
  const inputRef                = useRef(null);

  // Find selected product label
  const selected = products.find(p => p._id === value);

  // Filter products by name or HSN
  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.hsn_code && p.hsn_code.toLowerCase().includes(q))
    );
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (prod) => {
    onChange(prod._id);
    setOpen(false);
    setQuery('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const stockColor = (qty) => {
    if (qty === 0) return '#ef4444';
    if (qty <= 5)  return '#f59e0b';
    return '#059669';
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger button */}
      <div
        onClick={handleOpen}
        style={{
          padding: '10px 13px',
          border: `1.5px solid ${open ? 'var(--emerald, #059669)' : 'var(--border, #E2E8F0)'}`,
          borderRadius: 'var(--radius-sm, 8px)',
          fontSize: 13.5,
          color: selected ? 'var(--text, #0F172A)' : 'var(--text-4, #94A3B8)',
          background: 'var(--surface, #fff)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
          boxShadow: open ? '0 0 0 3px rgba(5,150,105,0.12)' : 'none',
          transition: 'all 0.15s',
          userSelect: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected
            ? `${selected.name}${selected.gst_rate > 0 ? ` • GST ${selected.gst_rate}%` : ''}`
            : placeholder}
        </span>
        {selected && (
          <span style={{ fontSize: 11, fontWeight: 600, color: stockColor(selected.quantity || selected.stock || 0), flexShrink: 0 }}>
            Stock: {selected.quantity ?? selected.stock ?? 0}
          </span>
        )}
        <span style={{ color: 'var(--text-4, #94A3B8)', fontSize: 12, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface, #fff)',
          border: '1.5px solid var(--emerald, #059669)',
          borderRadius: 'var(--radius-sm, 8px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          marginTop: 4,
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #E2E8F0)', background: 'var(--surface-2, #F8FAFB)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 नाम या HSN से खोजें..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', border: 'none', outline: 'none',
                fontSize: 13, background: 'transparent',
                color: 'var(--text, #0F172A)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-4, #94A3B8)', fontSize: 13 }}>
                कोई product नहीं मिला
              </div>
            ) : (
              filtered.map(prod => {
                const stock = prod.quantity ?? prod.stock ?? 0;
                const isSelected = prod._id === value;
                const isOut = stock === 0;
                return (
                  <div
                    key={prod._id}
                    onClick={() => !isOut && handleSelect(prod)}
                    style={{
                      padding: '10px 12px',
                      cursor: isOut ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'rgba(5,150,105,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--border, #E2E8F0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      opacity: isOut ? 0.5 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isOut && !isSelected) e.currentTarget.style.background = 'var(--surface-2, #F8FAFB)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(5,150,105,0.08)' : 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isSelected && '✓ '}{prod.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3, #64748B)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        {prod.hsn_code && <span>HSN: {prod.hsn_code}</span>}
                        {prod.gst_rate > 0 && <span>GST: {prod.gst_rate}%</span>}
                        {prod.unit && <span>{prod.unit}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: stockColor(stock) }}>
                        {isOut ? 'OUT' : `${stock} left`}
                      </div>
                      {prod.price && (
                        <div style={{ fontSize: 11, color: 'var(--text-3, #64748B)' }}>₹{prod.price}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}