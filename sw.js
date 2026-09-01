/**
 * localdoc.org — PWA Service Worker (sw.js)
 */

const CACHE_NAME = 'localdoc-v3-2026';
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
  '/js/lib/pdf-lib.min.js',
  '/js/lib/pdf.min.js',
  '/js/lib/docx.min.js',
  '/js/lib/sheetjs.min.js',
  '/js/lib/tesseract.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});
