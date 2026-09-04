/**
 * localdoc.org — PWA Service Worker (sw.js)
 */

const CACHE_NAME = 'localdoc-v5-2026-fresh';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/faq.html',
  '/contact.html',
  '/css/main.css',
  '/css/rtl.css',
  '/css/blog.css',
  '/js/core/i18n.js',
  '/js/core/ui-utils.js',
  '/js/core/seo.js',
  '/js/core/pwa-register.js',
  '/js/lib/pdf-lib.min.js',
  '/js/lib/pdf.min.js',
  '/js/lib/docx.min.js',
  '/js/lib/sheetjs.min.js',
  '/js/lib/tesseract.min.js',
  '/js/tools/convert.js',
  '/js/tools/organize.js',
  '/js/tools/edit.js',
  '/js/tools/id-photo.js',
  '/js/tools/scan.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First with Cache Fallback for instant live updates on Vercel + 100% Offline PWA support
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

