'use client';
import { useEffect, useRef, useState } from 'react';

export default function SearchableProductSelect({
  products = [],
  value,
  onChange,
  placeholder = 'उत्पाद खोजें / Search product...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selected = products.find((p) => p._id === value);

  const filtered = products.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.hsn_code && p.hsn_code.toLowerCase().includes(q));
  });

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
    if (qty === 0) return '#dc2626';
    if (qty <= 5) return '#b45309';
    return '#059669';
  };

  const stockBackground = (qty) => {
    if (qty === 0) return '#fff1f2';
    if (qty <= 5) return '#fff8eb';
    return '#ecfdf5';
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px 14px',
          border: `1.5px solid ${open ? 'rgba(16,185,129,0.52)' : 'rgba(148,163,184,0.24)'}`,
          borderRadius: 16,
          fontSize: 13.5,
          color: selected ? 'var(--text, #0f172a)' : 'var(--text-4, #94a3b8)',
          background:
            open
              ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,253,250,0.84))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,251,255,0.8))',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: open ? '0 0 0 4px rgba(16,185,129,0.12)' : '0 10px 24px rgba(15,23,42,0.04)',
          transition: 'all 0.18s ease',
          userSelect: 'none',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: selected ? 700 : 500,
            }}
          >
            {selected ? `${selected.name}${selected.gst_rate > 0 ? ` · GST ${selected.gst_rate}%` : ''}` : placeholder}
          </div>
          {selected && (
            <div style={{ fontSize: 11, color: 'var(--text-3, #64748b)', marginTop: 3 }}>
              {selected.hsn_code ? `HSN ${selected.hsn_code}` : 'Ready to bill'}
              {selected.unit ? ` · ${selected.unit}` : ''}
            </div>
          )}
        </div>

        {selected && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: stockColor(selected.quantity || selected.stock || 0),
              flexShrink: 0,
              background: stockBackground(selected.quantity || selected.stock || 0),
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.12)',
            }}
          >
            Stock {selected.quantity ?? selected.stock ?? 0}
          </span>
        )}

        <svg
          width="12"
          height="12"
          viewBox="0 0 10 10"
          style={{
            flexShrink: 0,
            transition: 'transform 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: '#94a3b8',
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,250,255,0.96))',
            border: '1px solid rgba(16,185,129,0.22)',
            borderRadius: 20,
            boxShadow: '0 24px 48px rgba(15,23,42,0.16)',
            overflow: 'hidden',
            animation: 'dropFadeIn 0.16s ease',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(226,232,240,0.85)',
              background: 'linear-gradient(180deg, rgba(248,250,252,0.96), rgba(240,253,250,0.82))',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#94a3b8', flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="नाम या HSN से खोजें..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 13,
                background: 'transparent',
                color: 'var(--text, #0f172a)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  color: '#94a3b8',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          <div style={{ maxHeight: 248, overflowY: 'auto', padding: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--text-4, #94a3b8)', fontSize: 13 }}>
                कोई product नहीं मिला
              </div>
            ) : (
              filtered.map((prod) => {
                const stock = prod.quantity ?? prod.stock ?? 0;
                const isSelected = prod._id === value;
                const isOut = stock === 0;

                return (
                  <button
                    key={prod._id}
                    type="button"
                    onClick={() => !isOut && handleSelect(prod)}
                    disabled={isOut}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      cursor: isOut ? 'not-allowed' : 'pointer',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(37,99,235,0.08))'
                        : 'transparent',
                      border: '1px solid transparent',
                      borderBottom: '1px solid rgba(241,245,249,0.9)',
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      opacity: isOut ? 0.5 : 1,
                      transition: 'background 0.14s ease, border-color 0.14s ease',
                      textAlign: 'left',
                      marginBottom: 4,
                    }}
                    onMouseEnter={(e) => {
                      if (!isOut && !isSelected) {
                        e.currentTarget.style.background = 'rgba(248,250,252,0.92)';
                        e.currentTarget.style.borderColor = 'rgba(226,232,240,0.7)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOut && !isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: isSelected ? '#059669' : 'var(--text, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {prod.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-4, #94a3b8)',
                          display: 'flex',
                          gap: 8,
                          marginTop: 3,
                          flexWrap: 'wrap',
                        }}
                      >
                        {prod.hsn_code && <span>HSN: {prod.hsn_code}</span>}
                        {prod.gst_rate > 0 && <span>GST {prod.gst_rate}%</span>}
                        {prod.unit && <span>{prod.unit}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: stockColor(stock),
                          background: stockBackground(stock),
                          padding: '5px 9px',
                          borderRadius: 999,
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}
                      >
                        {isOut ? 'Out' : `${stock} left`}
                      </div>
                      {prod.price && <div style={{ fontSize: 11, color: 'var(--text-4, #94a3b8)', marginTop: 4 }}>₹{prod.price}</div>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
