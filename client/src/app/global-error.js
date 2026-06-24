'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="hi">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ borderRadius: 24, border: '2px solid #fecaca', background: '#fff', boxShadow: '0 20px 60px rgba(15,23,42,0.12)', padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚨</div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              App में गंभीर error आई
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
              A critical error occurred. Please reload.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ width: '100%', minHeight: 44, borderRadius: 16, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 900, border: 'none', cursor: 'pointer' }}
            >
              🔄 Reload App
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
