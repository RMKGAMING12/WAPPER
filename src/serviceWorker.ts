/**
 * Wapper Production Service Worker & Client Registration Manager
 * Provides precaching of critical app shell assets, stale-while-revalidate runtime caching,
 * offline fallback handling, and global capture of the browser `beforeinstallprompt` event.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const CACHE_NAME = 'wapper-pwa-cache-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

// Global install prompt store so components mounting at any lifecycle stage can access the token
let capturedInstallPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

export function getCapturedInstallPrompt(): BeforeInstallPromptEvent | null {
  return capturedInstallPrompt;
}

export function subscribeToInstallPrompt(
  listener: (event: BeforeInstallPromptEvent | null) => void
): () => void {
  promptListeners.add(listener);
  listener(capturedInstallPrompt);
  return () => {
    promptListeners.delete(listener);
  };
}

export function clearCapturedInstallPrompt(): void {
  capturedInstallPrompt = null;
  promptListeners.forEach((listener) => listener(null));
}

/**
 * Registers the Wapper Service Worker and binds browser installation lifecycle listeners
 * (`beforeinstallprompt` and `appinstalled`).
 */
export function registerWapperServiceWorker(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    capturedInstallPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener(capturedInstallPrompt));
  });

  window.addEventListener('appinstalled', () => {
    capturedInstallPrompt = null;
    promptListeners.forEach((listener) => listener(null));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[Wapper PWA] Updated content is available and cached for next launch.');
              }
            });
          });
        })
        .catch((error) => {
          console.warn('[Wapper PWA] Service worker registration skipped or handled by VitePWA:', error);
        });
    });
  }
}

/**
 * Worker-scope execution block when loaded inside a dedicated ServiceWorkerGlobalScope.
 */
export function initServiceWorkerScope(swSelf: ServiceWorkerGlobalScope): void {
  swSelf.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(APP_SHELL_ASSETS))
        .then(() => swSelf.skipWaiting())
    );
  });

  swSelf.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.map((key) => {
              if (key !== CACHE_NAME) {
                return caches.delete(key);
              }
              return Promise.resolve(false);
            })
          )
        )
        .then(() => swSelf.clients.claim())
    );
  });

  swSelf.addEventListener('fetch', (event: FetchEvent) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Bypass Socket.io polling/websocket and API mutations
    if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/')) {
      return;
    }

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (networkResponse.type === 'basic' || networkResponse.type === 'cors')
            ) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            if (cachedResponse) return cachedResponse;
            if (request.mode === 'navigate') {
              return caches.match('/index.html') as Promise<Response>;
            }
            throw new Error('Network resource unavailable offline');
          });

        return cachedResponse || networkFetch;
      })
    );
  });
}

// Auto-bind if executed directly as a Service Worker script
if (typeof self !== 'undefined' && 'skipWaiting' in self && typeof window === 'undefined') {
  initServiceWorkerScope(self as unknown as ServiceWorkerGlobalScope);
}
