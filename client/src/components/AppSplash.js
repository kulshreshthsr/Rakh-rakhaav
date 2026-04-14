'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const SPLASH_SEEN_KEY = 'rr-app-splash-seen';

export default function AppSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const alreadySeen = sessionStorage.getItem(SPLASH_SEEN_KEY) === '1';
    if (alreadySeen) return false;
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    return true;
  });
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!visible) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showFor = reducedMotion ? 120 : 260;
    const closeTimer = window.setTimeout(() => setClosing(true), showFor);
    const hideTimer = window.setTimeout(() => setVisible(false), showFor + 180);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`app-splash${closing ? ' is-hiding' : ''}`} aria-hidden="true">
      <div className="app-splash-orb app-splash-orb-one" />
      <div className="app-splash-orb app-splash-orb-two" />
      <div className="app-splash-core">
        <div className="app-splash-logo-wrap">
          <div className="app-splash-logo-glow" />
          <Image
            src="/icon-v2.png"
            alt="Rakhrakhaav"
            width={240}
            height={240}
            priority
            className="app-splash-logo"
          />
        </div>
        <div className="app-splash-title">{'\u0930\u0916\u0930\u0916\u093e\u0935'}</div>
        <div className="app-splash-subtitle">Maintenance Solutions</div>
        <div className="app-splash-loader">
          <span />
        </div>
      </div>
    </div>
  );
}
