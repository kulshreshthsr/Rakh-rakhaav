'use client';

import { useEffect, useState } from 'react';

export default function PWAInstall() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showInstalled, setShowInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    };

    registerServiceWorker();

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    const handleInstalled = () => {
      setShowInstalled(true);
      setInstallEvent(null);
      window.setTimeout(() => setShowInstalled(false), 2500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      {installEvent && (
        <button type="button" className="pwa-install-btn" onClick={handleInstall}>
          Install App
        </button>
      )}
      {showInstalled && <div className="pwa-install-toast">App installed</div>}
    </>
  );
}
