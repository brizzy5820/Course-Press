// Service Worker Registration for CoursePress PWA

export function registerSW() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for service worker updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[SW] New version available! Ready to refresh.');
                  } else {
                    console.log('[SW] CoursePress app ready for offline use.');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error);
        });
    });
  } else if ('serviceWorker' in navigator && !import.meta.env.PROD) {
    // In dev mode, register sw if present for PWA testing
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

