'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import CameraBarcodeScanner from './CameraBarcodeScanner';

/* ─── Electronics category catalogue ───────────────────────────────────────── */
const ELEC_CATEGORIES = [
  'Mobile', 'Smartphone', 'Feature Phone', 'Tablet', 'Smartwatch',
  'Laptop', 'Desktop', 'Monitor', 'All-in-One PC',
  'Television', 'Projector',
  'Speaker', 'Soundbar', 'Headphones', 'Earbuds', 'TWS',
  'Refrigerator', 'Washing Machine', 'Microwave', 'Air Conditioner',
  'Fan', 'Cooler', 'Water Purifier', 'Mixer Grinder', 'Geyser',
  'Camera', 'CCTV', 'Router', 'Printer', 'Scanner',
  'Battery', 'Inverter', 'LED Bulb', 'Switch', 'Wire',
  'Charger', 'Cable', 'Power Bank', 'Accessories', 'Other',
];

/* ─── Category → broad category (for product.category field) ───────────────── */
const BROAD_CAT = {
  'Mobile': 'Mobiles & Gadgets', 'Smartphone': 'Mobiles & Gadgets',
  'Feature Phone': 'Mobiles & Gadgets', 'Tablet': 'Mobiles & Gadgets', 'Smartwatch': 'Mobiles & Gadgets',
  'Laptop': 'Computing', 'Desktop': 'Computing', 'Monitor': 'Computing',
  'All-in-One PC': 'Computing', 'Printer': 'Computing', 'Scanner': 'Computing', 'Router': 'Computing',
  'Television': 'Audio / Visual', 'Projector': 'Audio / Visual', 'Speaker': 'Audio / Visual',
  'Soundbar': 'Audio / Visual', 'Headphones': 'Audio / Visual', 'Earbuds': 'Audio / Visual',
  'TWS': 'Audio / Visual', 'Camera': 'Audio / Visual', 'CCTV': 'Audio / Visual',
  'Refrigerator': 'Home Appliances', 'Washing Machine': 'Home Appliances', 'Microwave': 'Home Appliances',
  'Air Conditioner': 'Home Appliances', 'Fan': 'Home Appliances', 'Cooler': 'Home Appliances',
  'Water Purifier': 'Home Appliances', 'Mixer Grinder': 'Home Appliances', 'Geyser': 'Home Appliances',
  'Inverter': 'Home Appliances',
};

/* ─── Brand suggestions per category ───────────────────────────────────────── */
const BRANDS = {
  'Mobile':          ['Samsung', 'Apple', 'Xiaomi', 'Realme', 'OnePlus', 'Vivo', 'OPPO', 'Motorola', 'iQOO', 'Nothing'],
  'Smartphone':      ['Samsung', 'Apple', 'Xiaomi', 'Realme', 'OnePlus', 'Vivo', 'OPPO', 'Motorola', 'iQOO', 'Nothing'],
  'Feature Phone':   ['Jio', 'Nokia', 'Itel', 'Lava', 'Samsung'],
  'Tablet':          ['Samsung', 'Apple', 'Lenovo', 'Xiaomi', 'Realme'],
  'Smartwatch':      ['boAt', 'Noise', 'Samsung', 'Apple', 'Fastrack', 'Titan'],
  'Laptop':          ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'MSI', 'LG'],
  'Desktop':         ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer'],
  'Monitor':         ['Dell', 'LG', 'Samsung', 'BenQ', 'Asus', 'ViewSonic', 'HP'],
  'Television':      ['Samsung', 'LG', 'Sony', 'TCL', 'Mi', 'OnePlus', 'Hisense', 'Vu', 'Panasonic'],
  'Speaker':         ['JBL', 'Sony', 'boAt', 'Bose', 'Samsung', 'Philips', 'Zebronics'],
  'Soundbar':        ['Samsung', 'LG', 'Sony', 'JBL', 'Bose', 'Philips'],
  'Headphones':      ['Sony', 'boAt', 'JBL', 'Skullcandy', 'Bose', 'Sennheiser', 'Noise'],
  'Earbuds':         ['boAt', 'Sony', 'JBL', 'Samsung', 'Apple', 'Realme', 'OnePlus'],
  'TWS':             ['boAt', 'Sony', 'JBL', 'Samsung', 'Apple', 'Realme', 'OnePlus'],
  'Refrigerator':    ['LG', 'Samsung', 'Whirlpool', 'Godrej', 'Haier', 'Bosch', 'IFB', 'Panasonic'],
  'Washing Machine': ['LG', 'Samsung', 'Whirlpool', 'Bosch', 'IFB', 'Panasonic', 'Godrej', 'Haier'],
  'Microwave':       ['LG', 'Samsung', 'IFB', 'Panasonic', 'Godrej', 'Morphy Richards'],
  'Air Conditioner': ['LG', 'Samsung', 'Daikin', 'Voltas', 'Blue Star', 'Carrier', 'Hitachi', 'Panasonic'],
  'Fan':             ['Orient', 'Crompton', 'Havells', 'Usha', 'Bajaj', 'Luminous', 'Anchor'],
  'Cooler':          ['Symphony', 'Bajaj', 'Crompton', 'Kenstar', 'Orient', 'Havells'],
  'Water Purifier':  ['Kent', 'Aquaguard', 'Pureit', 'Livpure', 'Blue Star'],
  'Geyser':          ['Racold', 'AO Smith', 'Crompton', 'Havells', 'V-Guard', 'Bajaj'],
  'Camera':          ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'GoPro'],
  'CCTV':            ['CP Plus', 'Hikvision', 'Dahua', 'Godrej', 'D-Link'],
  'Router':          ['TP-Link', 'D-Link', 'Netgear', 'Asus', 'Tenda', 'Netis'],
  'Printer':         ['HP', 'Canon', 'Epson', 'Brother'],
  'Battery':         ['Exide', 'Amara Raja', 'SF Sonic', 'Amaron', 'Luminous'],
  'Inverter':        ['Luminous', 'Microtek', 'Su-Kam', 'V-Guard', 'Exide'],
  'LED Bulb':        ['Philips', 'Havells', 'Bajaj', 'Surya', 'Crompton', 'Syska', 'Wipro'],
  'Power Bank':      ['Realme', 'Mi', 'Ambrane', 'Portronics', 'Boat', 'Romoss'],
  default:           ['Samsung', 'LG', 'Sony', 'Philips', 'Panasonic', 'Havells', 'Bajaj', 'Crompton', 'Bosch'],
};

/* ─── Category intelligence — specs, tracking, warranty, SKU prefix ─────────── */
const CAT_INTEL = {
  'Mobile':          { tracking: 'imei',     warranty: 12, sku: 'MOB', specs: ['storage','ram','color','os'] },
  'Smartphone':      { tracking: 'imei',     warranty: 12, sku: 'MOB', specs: ['storage','ram','color','os'] },
  'Feature Phone':   { tracking: 'imei',     warranty: 12, sku: 'FPH', specs: ['color'] },
  'Tablet':          { tracking: 'serial',   warranty: 12, sku: 'TAB', specs: ['storage','ram','color','os'] },
  'Smartwatch':      { tracking: 'optional', warranty: 12, sku: 'SWH', specs: ['color','connectivity'] },
  'Laptop':          { tracking: 'serial',   warranty: 12, sku: 'LAP', specs: ['ram','ssd','cpu','screen_size','color'] },
  'Desktop':         { tracking: 'serial',   warranty: 12, sku: 'DSK', specs: ['ram','ssd','cpu'] },
  'Monitor':         { tracking: 'serial',   warranty: 12, sku: 'MON', specs: ['screen_size','resolution'] },
  'All-in-One PC':   { tracking: 'serial',   warranty: 12, sku: 'AIO', specs: ['ram','ssd','cpu','screen_size'] },
  'Television':      { tracking: 'serial',   warranty: 12, sku: 'TV',  specs: ['screen_size','resolution','smart_tv'] },
  'Projector':       { tracking: 'serial',   warranty: 12, sku: 'PRJ', specs: ['resolution','brightness'] },
  'Speaker':         { tracking: 'optional', warranty:  6, sku: 'SPK', specs: ['color','connectivity','power'] },
  'Soundbar':        { tracking: 'optional', warranty: 12, sku: 'SBR', specs: ['color','connectivity','power'] },
  'Headphones':      { tracking: 'optional', warranty:  6, sku: 'HPH', specs: ['color','connectivity'] },
  'Earbuds':         { tracking: 'optional', warranty:  6, sku: 'EAR', specs: ['color','connectivity'] },
  'TWS':             { tracking: 'optional', warranty:  6, sku: 'TWS', specs: ['color','connectivity'] },
  'Refrigerator':    { tracking: 'serial',   warranty: 12, sku: 'REF', specs: ['capacity','color','energy_rating'] },
  'Washing Machine': { tracking: 'serial',   warranty: 12, sku: 'WM',  specs: ['capacity','color','type','energy_rating'] },
  'Microwave':       { tracking: 'serial',   warranty: 12, sku: 'MWO', specs: ['capacity','color','type'] },
  'Air Conditioner': { tracking: 'serial',   warranty: 12, sku: 'AC',  specs: ['capacity','color','energy_rating'] },
  'Fan':             { tracking: 'optional', warranty: 24, sku: 'FAN', specs: ['blade_size','voltage','power','color'] },
  'Cooler':          { tracking: 'optional', warranty: 12, sku: 'CLR', specs: ['capacity','color','power'] },
  'Water Purifier':  { tracking: 'serial',   warranty: 12, sku: 'WPR', specs: ['capacity','type'] },
  'Mixer Grinder':   { tracking: 'optional', warranty: 24, sku: 'MXG', specs: ['power','color'] },
  'Geyser':          { tracking: 'optional', warranty: 24, sku: 'GYZ', specs: ['capacity','voltage','power'] },
  'Camera':          { tracking: 'serial',   warranty: 12, sku: 'CAM', specs: ['resolution','color','type'] },
  'CCTV':            { tracking: 'serial',   warranty: 12, sku: 'CTV', specs: ['resolution','type'] },
  'Router':          { tracking: 'serial',   warranty: 12, sku: 'RTR', specs: ['wifi_standard','ports'] },
  'Printer':         { tracking: 'serial',   warranty: 12, sku: 'PRT', specs: ['type','connectivity'] },
  'Scanner':         { tracking: 'serial',   warranty: 12, sku: 'SCN', specs: ['type','connectivity'] },
  'Battery':         { tracking: 'none',     warranty: 12, sku: 'BAT', specs: ['capacity','voltage'] },
  'Inverter':        { tracking: 'serial',   warranty: 12, sku: 'INV', specs: ['capacity','voltage'] },
  'LED Bulb':        { tracking: 'none',     warranty: 12, sku: 'BLB', specs: ['wattage','color_temp','voltage'] },
  'Switch':          { tracking: 'none',     warranty: 12, sku: 'SWT', specs: ['voltage','power'] },
  'Wire':            { tracking: 'none',     warranty:  0, sku: 'WIR', specs: ['voltage'] },
  'Charger':         { tracking: 'optional', warranty:  6, sku: 'CHR', specs: ['voltage','power','connectivity'] },
  'Cable':           { tracking: 'none',     warranty:  6, sku: 'CBL', specs: ['connectivity'] },
  'Power Bank':      { tracking: 'optional', warranty:  6, sku: 'PWB', specs: ['capacity','color'] },
  'Accessories':     { tracking: 'none',     warranty:  0, sku: 'ACC', specs: ['color'] },
};

/* ─── Spec field catalogue ─────────────────────────────────────────────────── */
const SPEC_CONFIG = {
  storage:       { label: 'Storage',          type: 'select', opts: ['16GB','32GB','64GB','128GB','256GB','512GB','1TB','2TB','N/A'] },
  ram:           { label: 'RAM',              type: 'select', opts: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB','32GB','N/A'] },
  cpu:           { label: 'Processor',        type: 'text',   placeholder: 'e.g. Snapdragon 8 Gen 3, i7-13th Gen' },
  ssd:           { label: 'SSD / HDD',        type: 'text',   placeholder: 'e.g. 512GB SSD, 1TB HDD' },
  color:         { label: 'Color',            type: 'text',   placeholder: 'e.g. Midnight Black, Silver' },
  os:            { label: 'Operating System', type: 'select', opts: ['Android','iOS','Windows 11','macOS','Linux','KaiOS','Other'] },
  screen_size:   { label: 'Screen Size',      type: 'select', opts: ['11"','13.3"','14"','15.6"','17"','22"','24"','27"','32"','40"','43"','50"','55"','65"','75"','85"','Other'] },
  resolution:    { label: 'Resolution',       type: 'select', opts: ['HD 720p','Full HD 1080p','2K','4K UHD','8K'] },
  smart_tv:      { label: 'Smart TV',         type: 'select', opts: ['Yes','No'] },
  capacity:      { label: 'Capacity',         type: 'text',   placeholder: 'e.g. 265L, 7Kg, 2000mAh' },
  energy_rating: { label: 'Energy Rating',    type: 'select', opts: ['1 Star','2 Star','3 Star','4 Star','5 Star','Not Rated'] },
  type:          { label: 'Type',             type: 'text',   placeholder: 'e.g. Front Load, OTG, Split, Tower' },
  blade_size:    { label: 'Blade Size',       type: 'text',   placeholder: 'e.g. 1200mm, 48"' },
  voltage:       { label: 'Voltage',          type: 'select', opts: ['5V','12V','24V','110V','220V','240V'] },
  power:         { label: 'Power (W)',        type: 'text',   placeholder: 'e.g. 75W, 1200W' },
  wattage:       { label: 'Wattage',          type: 'select', opts: ['3W','5W','7W','9W','12W','15W','18W','24W','36W'] },
  color_temp:    { label: 'Color Temperature',type: 'select', opts: ['Warm White (3000K)','Neutral White (4000K)','Cool White (6500K)'] },
  connectivity:  { label: 'Connectivity',     type: 'select', opts: ['Wired','Bluetooth','WiFi','2.4GHz + 5GHz','USB-C','USB-A','Type-C to Type-C'] },
  brightness:    { label: 'Brightness',       type: 'text',   placeholder: 'e.g. 3500 lumens' },
  wifi_standard: { label: 'WiFi Standard',    type: 'select', opts: ['WiFi 4 (802.11n)','WiFi 5 (802.11ac)','WiFi 6 (802.11ax)','WiFi 6E'] },
  ports:         { label: 'Ports',            type: 'text',   placeholder: 'e.g. 4 LAN + 1 WAN' },
};

const WARRANTY_OPTS = ['No Warranty','3 Months','6 Months','12 Months','18 Months','24 Months','36 Months','5 Years','Custom'];
const UNIT_OPTS     = ['Piece', 'Set', 'Pair', 'Box', 'Carton', 'Unit'];
const GST_OPTS      = [0, 5, 12, 18, 28];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const normalizeBarcode = (v = '') => String(v).replace(/\s+/g, '').trim();

function generateSKU(prefix, count) {
  return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
}
function generateBarcode() {
  const digits = [8, ...Array.from({ length: 11 }, () => Math.floor(Math.random() * 10))];
  let sum = 0;
  digits.forEach((d, i) => { sum += i % 2 === 0 ? d : d * 3; });
  digits.push((10 - (sum % 10)) % 10);
  return digits.join('');
}

function buildEmpty(edit) {
  const meta = edit?.metadata || {};
  const getMeta = (k) => (meta instanceof Map ? meta.get(k) : meta[k]) || '';
  return {
    name:          edit?.name            || '',
    brand:         getMeta('brand'),
    category:      edit?.sub_category   || edit?.category || '',
    model_no:      getMeta('model_no'),
    barcode:       edit?.barcode         || '',
    cost_price:    edit?.cost_price      || '',
    selling_price: edit?.price           || '',
    mrp:           edit?.mrp             || '',
    dealer_price:  edit?.dealer_price    || '',
    opening_stock: edit ? String(edit.quantity ?? 0) : '0',
    unit:          edit?.unit            || 'Piece',
    warranty:      getMeta('warranty')   || '12 Months',
    enable_serial: edit?.has_serials     || false,
    serial_no:     getMeta('serial_no'),
    notes:         edit?.description     || '',
    gst_rate:      edit?.gst_rate        ?? 18,
    hsn_code:      edit?.hsn_code        || '',
    sku:           edit?.sku             || '',
  };
}

function buildSpecsFromMeta(meta) {
  if (!meta) return {};
  const getMeta = (k) => (meta instanceof Map ? meta.get(k) : meta[k]);
  const result = {};
  Object.keys(SPEC_CONFIG).forEach(k => {
    const v = getMeta(k);
    if (v) result[k] = v;
  });
  return result;
}

/* ─── Shared CSS (indigo theme — distinct from Hardware's green) ────────────── */
const INP  = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all';
const SEL  = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all appearance-none';
const LBL  = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';
const INP_SM = 'h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all';

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function BrandAutocomplete({ value, onChange, category }) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef  = useRef(null);
  const inputRef = useRef(null);

  const suggestions = BRANDS[category] || BRANDS.default;
  const filtered = query
    ? suggestions.filter(b => b.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  // Add "Use '{query}' as new brand" if typed value doesn't match any suggestion
  const showCustom = query && !suggestions.some(b => b.toLowerCase() === query.toLowerCase());
  const allOpts = showCustom ? [...filtered, `Add "${query}"`] : filtered;

  useEffect(() => {
    function handle(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(opt) {
    const v = opt.startsWith('Add "') ? query : opt;
    onChange(v);
    setQuery('');
    setOpen(false);
    setHighlighted(0);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setHighlighted(0); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, allOpts.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Escape')    { setOpen(false); }
    if (e.key === 'Enter' && allOpts[highlighted]) { e.preventDefault(); select(allOpts[highlighted]); }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        className={INP}
        value={open ? query : value}
        placeholder="e.g. Samsung, LG, Apple…"
        autoComplete="off"
        onFocus={() => { setOpen(true); setQuery(''); setHighlighted(0); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
        onKeyDown={handleKeyDown}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl max-h-52 overflow-y-auto">
          {allOpts.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-400">Type to add custom brand</p>
          ) : allOpts.map((opt, i) => (
            <button key={opt} type="button"
              onMouseDown={e => { e.preventDefault(); select(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                i === highlighted ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              } ${opt.startsWith('Add "') ? 'italic text-indigo-500' : ''}`}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySearch({ value, onChange }) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);

  const filtered = query
    ? ELEC_CATEGORIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : ELEC_CATEGORIES;

  useEffect(() => {
    function handle(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(opt) { onChange(opt); setQuery(''); setOpen(false); }

  function handleKeyDown(e) {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setHighlighted(0); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Escape')    { setOpen(false); }
    if (e.key === 'Enter' && filtered[highlighted]) { e.preventDefault(); select(filtered[highlighted]); }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        className={INP}
        value={open ? query : value}
        placeholder="Mobile, TV, AC, Fan, Laptop…"
        autoComplete="off"
        onFocus={() => { setOpen(true); setQuery(''); setHighlighted(0); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
        onKeyDown={handleKeyDown}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl max-h-56 overflow-y-auto">
          {filtered.map((opt, i) => (
            <button key={opt} type="button"
              onMouseDown={e => { e.preventDefault(); select(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                i === highlighted ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              } ${value === opt ? 'font-bold text-indigo-700' : ''}`}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function MarginCard({ cost, selling }) {
  const c = parseFloat(cost) || 0;
  const s = parseFloat(selling) || 0;
  if (!c || !s) return null;
  const profit = s - c;
  const margin = ((profit / s) * 100).toFixed(1);
  const markup = ((profit / c) * 100).toFixed(1);
  const good   = profit >= 0;
  return (
    <div className={`rounded-2xl border-2 p-4 ${good ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
        {good ? '📈 Profit Preview' : '⚠️ Selling Below Cost'}
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Profit / Unit', val: `₹${Math.abs(profit).toFixed(2)}` },
          { label: 'Margin',        val: `${Math.abs(margin)}%` },
          { label: 'Markup',        val: `${Math.abs(markup)}%` },
        ].map(({ label, val }) => (
          <div key={label} className={`rounded-xl py-2.5 ${good ? 'bg-emerald-100/60' : 'bg-rose-100/60'}`}>
            <p className={`text-[18px] font-black leading-none ${good ? 'text-emerald-700' : 'text-rose-700'}`}>{val}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-600">
          <span>{icon}</span><span>{title}</span>
        </span>
        <span className={`text-slate-400 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 bg-white animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

function PriceField({ label, required, value, onChange, hint, id }) {
  return (
    <div>
      {label && <label htmlFor={id} className={LBL}>{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[14px]">₹</span>
        <input id={id} className={`${INP} pl-8`} type="number" step="0.01" min="0"
          placeholder="0.00" value={value} onChange={e => onChange(e.target.value)} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/* ─── Tracking badge ─────────────────────────────────────────────────────────── */
function TrackingBadge({ mode }) {
  if (mode === 'imei')     return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-[10px] font-bold text-purple-700">📱 IMEI Tracking</span>;
  if (mode === 'serial')   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-[10px] font-bold text-indigo-700">🔢 Serial Tracking</span>;
  if (mode === 'optional') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">○ Optional Serial</span>;
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════════════════════════════════════════ */
export default function AddElectronicsModal({ config, term, onSave, onClose, editProduct, products = [], isOnline }) {
  const [form,     setForm]     = useState(() => buildEmpty(editProduct));
  const [specs,    setSpecs]    = useState(() => buildSpecsFromMeta(editProduct?.metadata));
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [showAdv,  setShowAdv]  = useState(false);
  const [saveFlash,setSaveFlash]= useState(false);
  const [showScan, setShowScan] = useState(false);
  const nameRef = useRef(null);

  /* Auto focus on open */
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);

  /* ESC close, Ctrl+Enter save, Alt+S save-another */
  useEffect(() => {
    function handle(e) {
      if (e.key === 'Escape')                              { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')  { e.preventDefault(); handleSave('save'); }
      if (e.altKey && e.key === 's')                       { e.preventDefault(); handleSave('another'); }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, specs]);

  const upForm = useCallback((patch) => setForm(prev => ({ ...prev, ...patch })), []);
  const upSpec = useCallback((key, val) => setSpecs(prev => ({ ...prev, [key]: val })), []);

  /* Category intelligence — non-destructive auto-fill */
  useEffect(() => {
    const intel = CAT_INTEL[form.category];
    if (!intel) return;
    // Warranty: only if still at placeholder defaults
    if (form.warranty === '12 Months' || form.warranty === 'No Warranty' || !form.warranty) {
      const wLabel = intel.warranty === 0 ? 'No Warranty' : `${intel.warranty} Months`;
      upForm({ warranty: wLabel });
    }
    // Unit: always Piece for electronics
    upForm({ unit: 'Piece' });
    // Auto-enable serial when category requires it
    if (intel.tracking === 'imei' || intel.tracking === 'serial') {
      upForm({ enable_serial: true });
    }
    // Auto-generate SKU if not yet set
    if (!form.sku) {
      upForm({ sku: generateSKU(intel.sku, products.length) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category]);

  const intel       = CAT_INTEL[form.category] || {};
  const trackMode   = intel.tracking || 'optional';
  const quickSpecs  = (intel.specs || []).slice(0, 3); // top 3 shown in Quick Add

  /* ── Save handler ── */
  async function handleSave(mode = 'save') {
    setError('');
    if (!form.name.trim())       { setError('Item Name is required'); return; }
    if (!form.brand.trim())      { setError('Brand is required'); return; }
    if (!form.category)          { setError('Category is required'); return; }
    if (!form.selling_price || Number(form.selling_price) <= 0) { setError('Selling Price must be greater than 0'); return; }
    if (Number(form.opening_stock) < 0) { setError('Opening Stock cannot be negative'); return; }

    // Duplicate barcode warning
    if (form.barcode) {
      const dup = products.find(p => p.barcode === normalizeBarcode(form.barcode) && p._id !== editProduct?._id);
      if (dup && !window.confirm(`Barcode already used by "${dup.name}". Continue?`)) return;
    }

    const metadata = {
      brand:    form.brand,
      model_no: form.model_no,
      warranty: form.warranty,
      ...specs,
      ...(form.serial_no ? { serial_no: form.serial_no } : {}),
    };

    const broadCat = BROAD_CAT[form.category] || form.category;

    const formData = {
      name:         form.name.trim(),
      price:        Number(form.selling_price),
      cost_price:   Number(form.cost_price) || 0,
      mrp:          Number(form.mrp)         || 0,
      dealer_price: Number(form.dealer_price)|| 0,
      quantity:     Number(form.opening_stock) || 0,
      unit:         form.unit,
      barcode:      normalizeBarcode(form.barcode),
      sku:          form.sku,
      gst_rate:     Number(form.gst_rate) || 0,
      hsn_code:     form.hsn_code,
      description:  form.notes,
      has_serials:  form.enable_serial || trackMode === 'imei' || trackMode === 'serial',
      category:     broadCat,
      sub_category: form.category,
    };

    setSaving(true);
    try {
      await onSave(formData, metadata);
      if (mode === 'save') {
        onClose();
      } else {
        // Save & Add Another — reset but keep brand, category
        const prevBrand    = form.brand;
        const prevCategory = form.category;
        setForm({ ...buildEmpty(null), brand: prevBrand, category: prevCategory });
        setSpecs({});
        setSaveFlash(true);
        setTimeout(() => { setSaveFlash(false); nameRef.current?.focus(); }, 1800);
      }
    } catch (err) {
      setError(err.message || 'Could not save item');
    }
    setSaving(false);
  }

  function handleBarcodeDetected(code) {
    upForm({ barcode: normalizeBarcode(code) });
    setShowScan(false);
  }

  /* ── Render ── */
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-[950px] max-h-[100dvh] sm:max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-700 to-indigo-600">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
              {editProduct ? 'Editing Item' : 'Add Electronic Item'}
            </p>
            <h2 className="text-[18px] font-black text-white mt-0.5">
              {editProduct ? editProduct.name : 'Add to Electronics Inventory'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {saveFlash && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-400/20 border border-emerald-300/40 text-[12px] font-bold text-emerald-200 animate-pulse">
                ✓ Saved!
              </span>
            )}
            <button type="button" onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors text-[18px]">
              ✕
            </button>
          </div>
        </div>

        {/* ── Keyboard shortcuts hint ── */}
        <div className="hidden sm:flex items-center gap-4 px-6 py-2 bg-indigo-50/60 border-b border-indigo-100/60 text-[10px] text-indigo-400 font-semibold shrink-0">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-500 font-mono text-[9px]">Ctrl+Enter</kbd> Save</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-500 font-mono text-[9px]">Alt+S</kbd> Save & Add Another</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-500 font-mono text-[9px]">ESC</kbd> Close</span>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5 space-y-5">

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border-2 border-rose-200 text-[13px] font-semibold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          {/* ─── QUICK ADD SECTION ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Item Name */}
            <div className="sm:col-span-2">
              <label htmlFor="elec-name" className={LBL}>Item Name <span className="text-rose-500">*</span></label>
              <input
                ref={nameRef}
                id="elec-name"
                className={INP}
                value={form.name}
                placeholder='Samsung 32" Smart TV, Apple iPhone 16, boAt Rockerz 550...'
                onChange={e => upForm({ name: e.target.value })}
              />
            </div>

            {/* Brand */}
            <div>
              <label className={LBL}>Brand <span className="text-rose-500">*</span></label>
              <BrandAutocomplete value={form.brand} onChange={v => upForm({ brand: v })} category={form.category} />
            </div>

            {/* Category */}
            <div>
              <label className={LBL}>Category <span className="text-rose-500">*</span></label>
              <CategorySearch value={form.category} onChange={v => upForm({ category: v })} />
            </div>

            {/* Category + tracking badge */}
            {form.category && (
              <div className="sm:col-span-2 flex items-center gap-2 -mt-1">
                <TrackingBadge mode={trackMode} />
                {trackMode === 'imei' && (
                  <span className="text-[10px] text-purple-500">IMEI will be collected per unit at sale &amp; purchase</span>
                )}
                {trackMode === 'serial' && (
                  <span className="text-[10px] text-indigo-500">Serial number tracked per unit</span>
                )}
              </div>
            )}

            {/* Model Number */}
            <div>
              <label className={LBL}>Model Number</label>
              <input className={INP} value={form.model_no}
                placeholder={form.category === 'Mobile' ? 'e.g. iPhone 16 Pro, SM-G991B' : 'Model / Part number'}
                onChange={e => upForm({ model_no: e.target.value })} />
            </div>

            {/* Warranty (in Quick Add — not advanced) */}
            <div>
              <label className={LBL}>Warranty</label>
              <div className="relative">
                <select className={SEL} value={form.warranty} onChange={e => upForm({ warranty: e.target.value })}>
                  {WARRANTY_OPTS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
              </div>
            </div>

            {/* Barcode */}
            <div className="sm:col-span-2">
              <label className={LBL}>Barcode</label>
              <div className="flex gap-2">
                <input className={`${INP} flex-1`} value={form.barcode}
                  placeholder="Scan, generate or enter barcode…"
                  onChange={e => upForm({ barcode: e.target.value })} />
                <button type="button" onClick={() => setShowScan(true)}
                  className="h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all text-[18px]"
                  title="Scan barcode">📷</button>
                <button type="button" onClick={() => upForm({ barcode: generateBarcode() })}
                  className="h-11 px-3 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                  Generate
                </button>
              </div>
            </div>

            {/* Cost & Selling */}
            <PriceField id="elec-cost" label="Cost Price" value={form.cost_price}
              onChange={v => upForm({ cost_price: v })} />
            <PriceField id="elec-sell" label="Selling Price" required value={form.selling_price}
              onChange={v => upForm({ selling_price: v })}
              hint={Number(form.selling_price) < Number(form.cost_price) ? '⚠️ Selling below cost' : ''} />

            {/* Live Margin Card */}
            {(form.cost_price || form.selling_price) && (
              <div className="sm:col-span-2">
                <MarginCard cost={form.cost_price} selling={form.selling_price} />
              </div>
            )}

            {/* Stock & Unit */}
            <div>
              <label className={LBL}>Opening Stock <span className="text-rose-500">*</span></label>
              <input className={INP} type="number" min="0" value={form.opening_stock}
                placeholder="0"
                onChange={e => upForm({ opening_stock: e.target.value })} />
            </div>
            <div>
              <label className={LBL}>Unit</label>
              <div className="flex gap-2">
                {UNIT_OPTS.map(u => (
                  <button key={u} type="button"
                    onClick={() => upForm({ unit: u })}
                    className={`flex-1 h-11 rounded-xl border-2 text-[12px] font-bold transition-all ${
                      form.unit === u
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >{u}</button>
                ))}
              </div>
            </div>

            {/* Quick specs (top 3 for selected category) */}
            {quickSpecs.length > 0 && (
              <div className={`sm:col-span-2 grid gap-3 ${quickSpecs.length === 1 ? 'grid-cols-1' : quickSpecs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {quickSpecs.map(key => {
                  const cfg = SPEC_CONFIG[key];
                  if (!cfg) return null;
                  return (
                    <div key={key}>
                      <label className={LBL}>{cfg.label}</label>
                      {cfg.type === 'select' ? (
                        <div className="relative">
                          <select className={SEL} value={specs[key] || ''} onChange={e => upSpec(key, e.target.value)}>
                            <option value="">Select…</option>
                            {cfg.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
                        </div>
                      ) : (
                        <input className={INP} value={specs[key] || ''} placeholder={cfg.placeholder}
                          onChange={e => upSpec(key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── ADVANCED DETAILS ──────────────────────────────────────────── */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdv(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all"
            >
              <span className="text-[12px] font-black text-slate-600 uppercase tracking-wider">
                {showAdv ? '▲' : '▼'} Advanced Details
              </span>
              <span className="text-[11px] text-slate-400">GST · SKU · Full Specs · More Pricing</span>
            </button>

            {showAdv && (
              <div className="mt-3 space-y-3">

                {/* GST & TAX */}
                <AdvSection title="GST & Tax" icon="🧾" defaultOpen>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>GST Rate</label>
                      <div className="flex gap-2">
                        {GST_OPTS.map(r => (
                          <button key={r} type="button"
                            onClick={() => upForm({ gst_rate: r })}
                            className={`flex-1 h-10 rounded-xl border-2 text-[12px] font-bold transition-all ${
                              form.gst_rate === r
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                            }`}
                          >{r}%</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={LBL}>HSN Code</label>
                      <input className={INP} value={form.hsn_code} placeholder="e.g. 8517, 8528"
                        onChange={e => upForm({ hsn_code: e.target.value })} />
                    </div>
                  </div>
                </AdvSection>

                {/* Tracking & SKU */}
                <AdvSection title="Tracking & Inventory" icon="🔢" defaultOpen={trackMode !== 'none'}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>SKU</label>
                      <div className="flex gap-2">
                        <input className={`${INP_SM} flex-1`} value={form.sku}
                          placeholder="Auto-generated"
                          onChange={e => upForm({ sku: e.target.value })} />
                        <button type="button"
                          onClick={() => upForm({ sku: generateSKU(intel.sku || 'ELC', products.length) })}
                          className="h-11 px-3 rounded-xl border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                          ↺ New
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                          checked={form.enable_serial}
                          onChange={e => upForm({ enable_serial: e.target.checked })} />
                        <span className="text-[13px] font-semibold text-slate-700">
                          {trackMode === 'imei' ? 'Enable IMEI Tracking' : 'Enable Serial Tracking'}
                        </span>
                      </label>
                    </div>
                    {form.enable_serial && trackMode !== 'imei' && (
                      <div className="col-span-2">
                        <label className={LBL}>Serial Number (default)</label>
                        <input className={INP} value={form.serial_no} placeholder="Serial captured per sale/purchase"
                          onChange={e => upForm({ serial_no: e.target.value })} />
                        <p className="mt-1 text-[11px] text-slate-400">Per-unit serials captured during purchase entry and invoicing</p>
                      </div>
                    )}
                    {trackMode === 'imei' && (
                      <div className="col-span-2 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                        <p className="text-[12px] font-bold text-purple-700">📱 IMEI tracking active for this category</p>
                        <p className="text-[11px] text-purple-500 mt-1">15-digit IMEI validation · Duplicate detection · Collected at purchase &amp; sale</p>
                      </div>
                    )}
                  </div>
                </AdvSection>

                {/* Full Product Specs */}
                {intel.specs && intel.specs.length > 0 && (
                  <AdvSection title="Product Specifications" icon="⚙️">
                    <div className={`grid gap-3 ${intel.specs.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {intel.specs.map(key => {
                        const cfg = SPEC_CONFIG[key];
                        if (!cfg) return null;
                        return (
                          <div key={key}>
                            <label className={LBL}>{cfg.label}</label>
                            {cfg.type === 'select' ? (
                              <div className="relative">
                                <select className={SEL} value={specs[key] || ''} onChange={e => upSpec(key, e.target.value)}>
                                  <option value="">Select…</option>
                                  {cfg.opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
                              </div>
                            ) : (
                              <input className={INP} value={specs[key] || ''} placeholder={cfg.placeholder}
                                onChange={e => upSpec(key, e.target.value)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AdvSection>
                )}

                {/* Additional Pricing */}
                <AdvSection title="Dealer & Wholesale Pricing" icon="💰">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <PriceField id="elec-mrp"      label="MRP"             value={form.mrp}          onChange={v => upForm({ mrp: v })} />
                    <PriceField id="elec-dealer"   label="Dealer Price"    value={form.dealer_price} onChange={v => upForm({ dealer_price: v })} />
                  </div>
                </AdvSection>

                {/* Notes / Description */}
                <AdvSection title="Notes" icon="📝">
                  <div>
                    <label className={LBL}>Notes / Specifications (optional)</label>
                    <textarea
                      className="w-full h-24 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 resize-none transition-all"
                      value={form.notes}
                      placeholder="Key features, technical notes, warranty terms…"
                      onChange={e => upForm({ notes: e.target.value })}
                    />
                  </div>
                </AdvSection>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky Footer ── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-5 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600">{form.name || 'Unnamed item'}</span>
              {form.brand && <> · <span>{form.brand}</span></>}
              {form.category && <> · <span className="text-indigo-500">{form.category}</span></>}
            </div>
            <button type="button" onClick={onClose}
              className="order-3 sm:order-1 h-11 px-5 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button type="button" onClick={() => handleSave('another')} disabled={saving}
              className="order-2 h-11 px-5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-[13px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-all">
              {saving ? '…' : 'Save & Add Another'}
              <span className="hidden sm:inline ml-1.5 opacity-60 font-mono text-[10px]">Alt+S</span>
            </button>
            <button type="button" onClick={() => handleSave('save')} disabled={saving}
              className="order-1 sm:order-3 h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-[14px] font-black text-white shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 transition-all">
              {saving ? 'Saving…' : editProduct ? '✓ Update Item' : '✓ Save Item'}
              <span className="hidden sm:inline ml-1.5 opacity-60 font-mono text-[11px]">Ctrl+↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barcode scanner */}
      {showScan && (
        <CameraBarcodeScanner
          open={showScan}
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
}
