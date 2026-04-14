'use client';

import { useEffect, useState } from 'react';

async function unregisterServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {}

  try {
    if (!('caches' in window)) {
      return;
    }

    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  } catch {}
}

export default function PWAInstall() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showInstalled, setShowInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    const shouldRegister = process.env.NODE_ENV === 'production' && !isLocalhost;

    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;

      if (!shouldRegister) {
        await unregisterServiceWorkers();
        return;
      }

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
