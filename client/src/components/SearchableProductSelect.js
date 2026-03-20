'use client';
import { useState, useRef, useEffect, useMemo } from 'react';

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
  products = [],
  value,
  onChange,
  placeholder = 'उत्पाद खोजें / Search product...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => products.find((p) => p._id === value),
    [products, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const scored = products
      .map((product) => {
        const name = (product.name || '').toLowerCase();
        const hsn = (product.hsn_code || '').toLowerCase();
        const unit = (product.unit || '').toLowerCase();
        const stock = product.quantity ?? product.stock ?? 0;

        let score = 0;

        if (!q) {
          score = 1;
        } else {
          if (name === q) score += 100;
          if (name.startsWith(q)) score += 60;
          if (name.includes(q)) score += 35;
          if (hsn.startsWith(q)) score += 28;
          if (hsn.includes(q)) score += 18;
          if (unit.includes(q)) score += 8;
        }

        if (selected && product._id === selected._id) score += 12;
        if (stock > 0) score += 4;
        if (stock === 0) score -= 8;

        return { product, score };
      })
      .filter((entry) => (!q ? true : entry.score > 0))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const aStock = a.product.quantity ?? a.product.stock ?? 0;
        const bStock = b.product.quantity ?? b.product.stock ?? 0;
        if (bStock !== aStock) return bStock - aStock;

        return (a.product.name || '').localeCompare(b.product.name || '');
      })
      .map((entry) => entry.product);

    return scored;
  }, [products, query, selected]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setHighlightedIndex(0);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeRow = listRef.current.querySelector(
      `[data-option-index="${highlightedIndex}"]`
    );
    if (activeRow) {
      activeRow.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  const stockColor = (qty) => {
    if (qty === 0) return '#EF4444';
    if (qty <= 5) return '#F59E0B';
    return '#22C55E';
  };

  const stockBackground = (qty) => {
    if (qty === 0) return '#FEF2F2';
    if (qty <= 5) return '#FFFBEB';
    return '#F0FDF4';
  };

  const stockLabel = (qty) => {
    if (qty === 0) return 'Out of stock';
    if (qty <= 5) return `Low stock: ${qty}`;
    return `Stock: ${qty}`;
  };

  const handleSelect = (prod) => {
    onChange(prod._id);
    setOpen(false);
    setQuery('');
    setHighlightedIndex(0);
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setHighlightedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ')) {
      e.preventDefault();
      handleOpen();
      return;
    }

    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filtered.length - 1, 0))
      );
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const candidate = filtered[highlightedIndex];
      if (candidate && (candidate.quantity ?? candidate.stock ?? 0) > 0) {
        handleSelect(candidate);
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      setHighlightedIndex(0);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-expanded={open}
        style={{
          minHeight: 48,
          padding: '11px 14px',
          border: `1.5px solid ${
            open ? 'rgba(79,70,229,0.45)' : 'var(--border-soft, #E2E8F0)'
          }`,
          borderRadius: 16,
          fontSize: 13.5,
          color: selected ? 'var(--text, #0F172A)' : 'var(--text-4, #94A3B8)',
          background: disabled
            ? 'var(--surface-3, #F1F5F9)'
            : 'rgba(255,255,255,0.94)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: open
            ? '0 0 0 4px rgba(79,70,229,0.10), 0 16px 30px rgba(79,70,229,0.10)'
            : '0 3px 10px rgba(15,23,42,0.03)',
          transition: 'all 0.16s ease',
          userSelect: 'none',
          opacity: disabled ? 0.68 : 1,
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: open
                ? 'linear-gradient(135deg, rgba(79,70,229,0.16), rgba(99,102,241,0.12))'
                : 'var(--surface-2, #F8FAFC)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid rgba(226,232,240,0.8)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: open ? '#4F46E5' : '#94A3B8' }}>
              <path
                d="M2.2 4.1C2.2 3.05 3.05 2.2 4.1 2.2H9.9C10.95 2.2 11.8 3.05 11.8 4.1V5.35C11.8 6.4 10.95 7.25 9.9 7.25H4.1C3.05 7.25 2.2 6.4 2.2 5.35V4.1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M3.2 9.2C3.2 8.54 3.74 8 4.4 8H9.6C10.26 8 10.8 8.54 10.8 9.2V9.7C10.8 10.91 9.81 11.9 8.6 11.9H5.4C4.19 11.9 3.2 10.91 3.2 9.7V9.2Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: selected ? 700 : 500,
                color: selected ? 'var(--text, #0F172A)' : 'var(--text-4, #94A3B8)',
              }}
            >
              {selected
                ? `${selected.name}${selected.gst_rate > 0 ? ` · GST ${selected.gst_rate}%` : ''}`
                : placeholder}
            </div>
            {selected && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-3, #64748B)',
                  marginTop: 2,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {selected.hsn_code && <span>HSN {selected.hsn_code}</span>}
                {selected.unit && <span>{selected.unit}</span>}
                <span>{stockLabel(selected.quantity ?? selected.stock ?? 0)}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {selected && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: stockColor(selected.quantity ?? selected.stock ?? 0),
                background: stockBackground(selected.quantity ?? selected.stock ?? 0),
                padding: '4px 9px',
                borderRadius: 999,
                border: `1px solid ${stockColor(selected.quantity ?? selected.stock ?? 0)}22`,
              }}
            >
              {selected.quantity ?? selected.stock ?? 0}
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
              color: open ? '#4F46E5' : '#94A3B8',
            }}
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'rgba(255,255,255,0.98)',
            border: '1.5px solid rgba(79,70,229,0.26)',
            borderRadius: 20,
            boxShadow: '0 26px 50px rgba(15,23,42,0.14)',
            overflow: 'hidden',
            animation: 'dropFadeIn 0.14s ease',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-soft, #E2E8F0)',
              background:
                'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.88))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 14,
                background: '#fff',
                border: '1px solid rgba(226,232,240,0.95)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#94A3B8', flexShrink: 0 }}>
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                placeholder="नाम, HSN, unit से खोजें..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 13.5,
                  background: 'transparent',
                  color: 'var(--text, #0F172A)',
                  fontFamily: 'var(--font-body, "Plus Jakarta Sans")',
                }}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    background: 'var(--surface-2, #F8FAFC)',
                    border: '1px solid rgba(226,232,240,0.9)',
                    cursor: 'pointer',
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#94A3B8',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3, #64748B)', fontWeight: 700 }}>
                {filtered.length} product{filtered.length === 1 ? '' : 's'} found
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#15803D',
                    background: '#F0FDF4',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  Green = healthy stock
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#B45309',
                    background: '#FFFBEB',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  Amber = low stock
                </span>
              </div>
            </div>
          </div>

          <div
            ref={listRef}
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--text-4, #94A3B8)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>🔎</div>
                <div style={{ fontWeight: 700, color: 'var(--text-3, #64748B)' }}>
                  कोई product नहीं मिला
                </div>
                <div style={{ marginTop: 4 }}>नाम या HSN बदलकर फिर से खोजें</div>
              </div>
            ) : (
              filtered.map((prod, index) => {
                const stock = prod.quantity ?? prod.stock ?? 0;
                const isSelected = prod._id === value;
                const isOut = stock === 0;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={prod._id}
                    data-option-index={index}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => !isOut && handleSelect(prod)}
                    style={{
                      padding: '12px 13px',
                      cursor: isOut ? 'not-allowed' : 'pointer',
                      borderRadius: 16,
                      border: `1px solid ${
                        isSelected
                          ? 'rgba(79,70,229,0.22)'
                          : isHighlighted
                          ? 'rgba(226,232,240,0.96)'
                          : 'transparent'
                      }`,
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(99,102,241,0.06))'
                        : isHighlighted
                        ? 'rgba(248,250,252,0.92)'
                        : 'transparent',
                      opacity: isOut ? 0.5 : 1,
                      transition: 'all 0.12s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          background: isSelected
                            ? 'linear-gradient(135deg, #4F46E5, #6366F1)'
                            : 'var(--surface-2, #F8FAFC)',
                          color: isSelected ? '#fff' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: isSelected ? 'none' : '1px solid rgba(226,232,240,0.9)',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {isSelected ? '✓' : index + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#4338CA' : 'var(--text, #0F172A)',
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
                            color: 'var(--text-3, #64748B)',
                            display: 'flex',
                            gap: 8,
                            marginTop: 4,
                            flexWrap: 'wrap',
                          }}
                        >
                          {prod.hsn_code && (
                            <span
                              style={{
                                background: 'var(--surface-2, #F8FAFC)',
                                padding: '2px 7px',
                                borderRadius: 999,
                              }}
                            >
                              HSN {prod.hsn_code}
                            </span>
                          )}

                          {prod.gst_rate > 0 && (
                            <span
                              style={{
                                background: 'rgba(79,70,229,0.10)',
                                color: '#4338CA',
                                padding: '2px 7px',
                                borderRadius: 999,
                                fontWeight: 700,
                              }}
                            >
                              GST {prod.gst_rate}%
                            </span>
                          )}

                          {prod.unit && (
                            <span
                              style={{
                                background: 'var(--surface-2, #F8FAFC)',
                                padding: '2px 7px',
                                borderRadius: 999,
                              }}
                            >
                              {prod.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: stockColor(stock),
                          background: stockBackground(stock),
                          padding: '4px 9px',
                          borderRadius: 999,
                          border: `1px solid ${stockColor(stock)}22`,
                        }}
                      >
                        {isOut ? 'Out' : `${stock} left`}
                      </div>

                      {prod.price && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-4, #94A3B8)',
                            marginTop: 4,
                            fontWeight: 600,
                          }}
                        >
                          ₹{prod.price}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
