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

  const stockToneClass = (quantity) => {
    if (quantity === 0) return 'border-rose-200 bg-rose-50 text-rose-600';
    if (quantity <= 5) return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-600';
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`flex w-full select-none items-center justify-between gap-2.5 rounded-2xl border-[1.5px] px-[14px] py-3 text-left text-[13.5px] transition-all duration-150 ease-out ${
          open
            ? 'border-emerald-500/50 bg-gradient-to-b from-white to-emerald-50/80 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
            : 'border-slate-400/25 bg-gradient-to-b from-white/95 to-slate-50/80 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <div className="min-w-0 flex-1">
          <div className={`truncate ${selected ? 'font-bold' : 'font-medium'}`}>
            {selected ? `${selected.name}${selected.gst_rate > 0 ? ` · GST ${selected.gst_rate}%` : ''}` : placeholder}
          </div>
          {selected && (
            <div className="mt-[3px] text-[11px] text-slate-500">
              {selected.hsn_code ? `HSN ${selected.hsn_code}` : 'Ready to bill'}
              {selected.unit ? ` · ${selected.unit}` : ''}
            </div>
          )}
        </div>

        {selected && (
          <span className={`shrink-0 rounded-full border px-2.5 py-[5px] text-[11px] font-extrabold ${stockToneClass(selected.quantity || selected.stock || 0)}`}>
            Stock {selected.quantity ?? selected.stock ?? 0}
          </span>
        )}

        <svg
          width="12"
          height="12"
          viewBox="0 0 10 10"
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : 'rotate-0'}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[999] overflow-hidden rounded-[20px] border border-emerald-500/20 bg-gradient-to-b from-white/95 to-slate-50/95 shadow-[0_24px_48px_rgba(15,23,42,0.16)] animate-[dropFadeIn_0.16s_ease]">
          <div className="flex items-center gap-2 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/95 to-emerald-50/80 px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-slate-400">
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
              className="flex-1 border-none bg-transparent text-[13px] text-slate-900 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                }}
                className="cursor-pointer border-none bg-transparent text-[15px] leading-none text-slate-400"
              >
                ×
              </button>
            )}
          </div>

          <div className="max-h-[248px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-[14px] py-[18px] text-center text-[13px] text-slate-400">
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
                    className={`mb-1 flex w-full items-center justify-between gap-2.5 rounded-2xl border border-b-slate-100 px-3 py-3 text-left transition-colors duration-150 ${
                      isSelected
                        ? 'border-transparent bg-gradient-to-br from-emerald-500/10 to-blue-600/10'
                        : isActive
                          ? 'border-emerald-500/25 bg-emerald-50/95'
                          : 'border-transparent bg-transparent'
                    } ${isOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13.5px] font-bold ${isSelected ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {product.name}
                      </div>
                      <div className="mt-[3px] flex flex-wrap gap-2 text-[11px] text-slate-400">
                        {product.barcode && <span>Barcode: {product.barcode}</span>}
                        {product.hsn_code && <span>HSN: {product.hsn_code}</span>}
                        {product.gst_rate > 0 && <span>GST {product.gst_rate}%</span>}
                        {product.unit && <span>{product.unit}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className={`rounded-full border px-[9px] py-[5px] text-[11.5px] font-extrabold ${stockToneClass(stock)}`}>
                        {isOut ? 'Out' : `${stock} left`}
                      </div>
                      {product.price && <div className="mt-1 text-[11px] text-slate-400">₹{product.price}</div>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
            Enter to select, arrow keys for laptop, tap-friendly list for mobile.
          </div>
        </div>
      )}
    </div>
  );
}
