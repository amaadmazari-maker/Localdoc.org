/**
 * localdoc.org — PWA Service Worker Registration (js/core/pwa-register.js)
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/') ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath).then((reg) => {
      console.log('LocalDoc PWA ServiceWorker active:', reg.scope);
      if (reg.update) reg.update();
    }).catch((err) => {
      console.warn('PWA registration skipped:', err);
    });
  });
}

