/**
 * localdoc.org — PWA Service Worker (sw.js)
 */

const CACHE_NAME = 'localdoc-v8-2026-ultimate';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/disclaimer.html',
  '/faq.html',
  '/contact.html',
  '/sitemap.html',
  '/404.html',
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
  '/js/tools/scan.js',
  '/js/tools/reader.js',
  '/js/tools/photo-resizer.js',
  '/js/tools/pdf-to-pptx.js',
  '/js/tools/organize-pdf.js',
  '/js/tools/calculator.js',
  '/pages/compress-pdf.html',
  '/pages/merge-pdf.html',
  '/pages/split-pdf.html',
  '/pages/pdf-to-word.html',
  '/pages/word-to-pdf.html',
  '/pages/pdf-to-excel.html',
  '/pages/excel-to-pdf.html',
  '/pages/pdf-to-jpg.html',
  '/pages/pdf-to-png.html',
  '/pages/jpg-to-pdf.html',
  '/pages/png-to-pdf.html',
  '/pages/photo-resizer.html',
  '/pages/scan.html',
  '/pages/id-photo.html',
  '/pages/passport-photo-maker.html',
  '/pages/visa-photo-maker.html',
  '/pages/cnic-photo-maker.html',
  '/pages/image-to-text.html',
  '/pages/rotate-pdf.html',
  '/pages/page-numbers.html',
  '/pages/watermark.html',
  '/pages/protect-pdf.html',
  '/pages/sign-pdf.html',
  '/pages/create-pdf.html',
  '/pages/edit-pdf.html',
  '/pages/document-reader.html',
  '/pages/scientific-calculator.html',
  '/pages/pdf-to-powerpoint.html',
  '/pages/organize-pdf.html',
  '/assets/icons/favicon.svg',
  '/assets/icons/brand-logo.svg',
  '/assets/icons/zero-upload-badge.svg'
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

