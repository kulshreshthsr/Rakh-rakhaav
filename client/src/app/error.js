'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({ error, reset }) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-md rounded-3xl border-2 border-rose-200 bg-white shadow-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-3xl">
          ⚠️
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-1">
          कुछ गलत हो गया
        </h1>
        <p className="text-sm font-medium text-slate-500 mb-2">
          Something went wrong
        </p>
        {error?.message && (
          <p className="text-xs font-mono text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-6 break-all">
            {error.message}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full min-h-[44px] rounded-2xl bg-green-600 text-white text-sm font-black hover:bg-green-700 transition-all"
          >
            🔄 फिर से कोशिश करें / Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full min-h-[44px] rounded-2xl border-2 border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-50 transition-all flex items-center justify-center"
          >
            🏠 होम पर जाएं / Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
