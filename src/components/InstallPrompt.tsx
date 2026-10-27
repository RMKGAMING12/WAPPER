import React, { useEffect, useState } from 'react';
import { Download, MonitorSmartphone, Share, X, CheckCircle2, WifiOff } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  clearCapturedInstallPrompt,
  subscribeToInstallPrompt,
} from '../serviceWorker';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [showModalGuide, setShowModalGuide] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const checkStandalone = () => {
      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(standaloneMatch);
    };

    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const unsubscribe = subscribeToInstallPrompt((promptEvent) => {
      setDeferredPrompt(promptEvent);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        clearCapturedInstallPrompt();
        setIsStandalone(true);
      }
    } else {
      setShowModalGuide(true);
    }
  };

  if (isStandalone && isOnline) {
    return null;
  }

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          className="bg-amber-500/95 text-slate-950 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 border-b border-amber-400 shrink-0"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Offline Mode — Service Worker cache active. Messages will sync when reconnected.</span>
        </div>
      )}

      {!isStandalone && !dismissed && (
        <div className="bg-[#111827] border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <MonitorSmartphone className="w-3.5 h-3.5" />
            </div>
            <p className="text-slate-300 truncate">
              <strong className="font-semibold text-white">Install Wapper Desktop &amp; Mobile App</strong>
              <span className="hidden sm:inline text-slate-400">
                {' '}
                · Launch in a dedicated standalone window with zero browser chrome and instant offline caching.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{deferredPrompt ? 'Install Wapper' : isIOS ? 'Install on iOS' : 'Install App'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss install banner"
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showModalGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  W
                </div>
                <div>
                  <h3 id="pwa-install-title" className="text-base font-semibold text-white">
                    Install Wapper as a Standalone App
                  </h3>
                  <p className="text-xs text-slate-400">100% Free PWA · 0 MB Server Overhead</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModalGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              {isIOS ? (
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <Share className="w-4 h-4 text-indigo-400" />
                    <span>iPhone &amp; iPad Safari Installation</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> to launch Wapper in standalone full-screen mode.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Desktop (Chrome / Edge / Brave) &amp; Android</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>
                      Click the <strong>Install Wapper</strong> icon in the right side of your browser address bar (or open Wapper in a top-level browser tab).
                    </li>
                    <li>
                      Confirm <strong>Install</strong> in the browser prompt to pin Wapper to your OS dock, taskbar, or home screen.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModalGuide(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPrompt;
