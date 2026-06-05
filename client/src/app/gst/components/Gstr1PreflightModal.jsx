'use client';
import Link from 'next/link';
import { validateGSTINChecksum } from '../../../lib/gstValidation';

export default function Gstr1PreflightModal({ sales = [], shopGstin, onClose, onProceed }) {
  const b2bWithoutGstin = sales.filter(
    s => (s.is_b2b || s.invoice_type === 'B2B') && !s.buyer_gstin
  ).length;

  const hsnMissingCount = sales.reduce(
    (acc, s) => acc + (s.items || []).filter(i => !i.hsn_code).length,
    0
  );

  const invalidGstinCount = sales.filter(
    s => s.buyer_gstin && !validateGSTINChecksum(s.buyer_gstin)
  ).length;

  const invoiceNums = sales.map(s => s.invoice_number).filter(Boolean);
  const duplicateInvoiceCount = invoiceNums.length - new Set(invoiceNums).size;

  const checks = [
    {
      id: 'gstin_configured',
      label: 'Shop GSTIN configured',
      desc: 'Portal upload के लिए GSTIN जरूरी है।',
      pass: Boolean(shopGstin),
      fix: { label: 'Profile में जाएं', href: '/profile' },
      blocking: true,
    },
    {
      id: 'invoice_numbers',
      label: 'Invoice numbers unique',
      desc: 'Duplicate invoice numbers GSTN portal reject करता है।',
      pass: duplicateInvoiceCount === 0,
      detail: duplicateInvoiceCount > 0 ? `${duplicateInvoiceCount} duplicate invoice numbers हैं` : null,
      blocking: true,
    },
    {
      id: 'b2b_buyer_gstins',
      label: 'B2B invoices में buyer GSTIN complete',
      desc: 'B2B invoices में buyer GSTIN required है।',
      pass: b2bWithoutGstin === 0,
      detail: b2bWithoutGstin > 0 ? `${b2bWithoutGstin} B2B invoices में GSTIN missing` : null,
      fix: { label: 'Sales में देखें', href: '/sales' },
      blocking: false,
    },
    {
      id: 'hsn_codes',
      label: 'Products में HSN codes',
      desc: 'HSN summary (Table 12) accurate नहीं होगी।',
      pass: hsnMissingCount === 0,
      detail: hsnMissingCount > 0 ? `${hsnMissingCount} items में HSN code नहीं है` : null,
      fix: { label: 'Products में जाएं', href: '/products' },
      blocking: false,
    },
    {
      id: 'gstin_checksums',
      label: 'Buyer GSTINs valid (checksum)',
      desc: 'Invalid GSTINs portal पर error दे सकते हैं।',
      pass: invalidGstinCount === 0,
      detail: invalidGstinCount > 0 ? `${invalidGstinCount} buyer GSTINs का checksum invalid है` : null,
      blocking: false,
    },
  ];

  const blockingFailed = checks.filter(c => c.blocking && !c.pass);
  const canProceed = blockingFailed.length === 0;
  const warningCount = checks.filter(c => !c.blocking && !c.pass).length;

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:rounded-3xl md:max-h-[90vh]">
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-6 pt-5 pb-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">GSTR-1 Upload</p>
              <h3 className="text-[20px] font-black text-slate-900 mt-0.5">Pre-flight Check</h3>
              <p className="text-[12px] text-slate-400 mt-1">
                Download से पहले data quality verify करें।
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
            >✕</button>
          </div>

          {/* Checks list */}
          <div className="space-y-2">
            {checks.map((check) => {
              const Icon = check.pass ? '✅' : check.blocking ? '❌' : '⚠️';
              const rowCls = check.pass
                ? 'border-slate-100 bg-slate-50/50'
                : check.blocking
                  ? 'border-red-200 bg-red-50/60'
                  : 'border-amber-200 bg-amber-50/50';
              return (
                <div key={check.id} className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${rowCls}`}>
                  <span className="text-base flex-shrink-0 mt-0.5">{Icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-black ${check.pass ? 'text-slate-700' : check.blocking ? 'text-red-800' : 'text-amber-800'}`}>
                      {check.label}
                    </p>
                    {check.detail && (
                      <p className={`text-[11px] font-semibold mt-0.5 ${check.blocking ? 'text-red-600' : 'text-amber-600'}`}>
                        {check.detail}
                      </p>
                    )}
                    {!check.pass && !check.detail && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{check.desc}</p>
                    )}
                  </div>
                  {!check.pass && check.fix && (
                    <Link href={check.fix.href}
                      className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-xl border transition-colors ${
                        check.blocking
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                      }`}
                    >{check.fix.label} →</Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status summary */}
          {!canProceed ? (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
              <span className="text-base flex-shrink-0">🚫</span>
              <p className="text-[12px] font-semibold text-red-700">
                {blockingFailed.length} critical issue{blockingFailed.length > 1 ? 's' : ''} ठीक करें — फिर GSTR-1 generate होगा।
              </p>
            </div>
          ) : warningCount > 0 ? (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-base flex-shrink-0">⚠️</span>
              <p className="text-[12px] font-semibold text-amber-700">
                {warningCount} warning{warningCount > 1 ? 's' : ''} हैं — आगे बढ़ सकते हैं, लेकिन accuracy कम हो सकती है।
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-base flex-shrink-0">✅</span>
              <p className="text-[12px] font-semibold text-emerald-700">
                सब ठीक है! GSTR-1 generate करें।
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onProceed}
              disabled={!canProceed}
              className="flex-1 py-3.5 rounded-2xl text-[14px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {canProceed ? (warningCount > 0 ? 'Warnings के साथ Generate करें' : '⬇️ GSTR-1 Generate करें') : 'Issues ठीक करें पहले'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
