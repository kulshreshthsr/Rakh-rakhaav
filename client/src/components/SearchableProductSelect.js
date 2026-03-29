'use client';
import { useEffect, useRef, useState } from 'react';

export default function SearchableProductSelect({
  products = [],
  value,
  onChange,
  onSelectProduct,
  placeholder = 'Search product...',
  searchPlaceholder = 'Type product, barcode or HSN...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selected = products.find((product) => product._id === value);

  const filtered = products.filter((product) => {
    if (!query) return true;
    const nextQuery = query.toLowerCase();
    return (
      product.name.toLowerCase().includes(nextQuery) ||
      (product.barcode && product.barcode.toLowerCase().includes(nextQuery)) ||
      (product.hsn_code && product.hsn_code.toLowerCase().includes(nextQuery))
    );
  });

  const enabledOptions = filtered.filter((product) => (product.quantity ?? product.stock ?? 0) > 0);

  useEffect(() => {
    const handler = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (product) => {
    onChange(product._id);
    onSelectProduct?.(product);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSearchKeyDown = (event) => {
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (enabledOptions.length ? Math.min(current + 1, enabledOptions.length - 1) : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && enabledOptions[activeIndex]) {
      event.preventDefault();
      handleSelect(enabledOptions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      setActiveIndex(0);
    }
  };

  const stockColor = (quantity) => {
    if (quantity === 0) return '#dc2626';
    if (quantity <= 5) return '#b45309';
    return '#059669';
  };

  const stockBackground = (quantity) => {
    if (quantity === 0) return '#fff1f2';
    if (quantity <= 5) return '#fff8eb';
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
          background: open
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
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
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
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                }}
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
                No products found
              </div>
            ) : (
              filtered.map((product) => {
                const stock = product.quantity ?? product.stock ?? 0;
                const isSelected = product._id === value;
                const isOut = stock === 0;
                const optionIndex = enabledOptions.findIndex((option) => option._id === product._id);
                const isActive = !isOut && optionIndex === activeIndex;

                return (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => !isOut && handleSelect(product)}
                    disabled={isOut}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      cursor: isOut ? 'not-allowed' : 'pointer',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(37,99,235,0.08))'
                        : isActive
                          ? 'rgba(240,253,250,0.96)'
                          : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(16,185,129,0.24)' : 'transparent'}`,
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
                        {product.name}
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
                        {product.barcode && <span>Barcode: {product.barcode}</span>}
                        {product.hsn_code && <span>HSN: {product.hsn_code}</span>}
                        {product.gst_rate > 0 && <span>GST {product.gst_rate}%</span>}
                        {product.unit && <span>{product.unit}</span>}
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
                      {product.price && <div style={{ fontSize: 11, color: 'var(--text-4, #94a3b8)', marginTop: 4 }}>₹{product.price}</div>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(226,232,240,0.85)',
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--text-3, #64748b)',
              background: 'rgba(248,250,252,0.8)',
            }}
          >
            Enter to select, arrow keys for laptop, tap-friendly list for mobile.
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
