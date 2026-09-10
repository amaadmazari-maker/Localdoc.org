/**
 * localdoc.org — PWA Service Worker (sw.js)
 */

const CACHE_NAME = 'localdoc-v12-offline';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/faq.html',
  '/contact.html',
  '/blog/index.html',
  '/blog/pro-scientific-calculator-guide.html',
  '/blog/how-to-program-scientific-calculator-custom-formulas.html',
  '/blog/top-10-programmable-calculator-programs-engineering-surveying.html',
  '/blog/scientific-calculator-functions-symbols-meaning-guide.html',
  '/blog/how-to-solve-complex-numbers-matrices-vectors-scientific-calculator.html',
  '/blog/compress-pdf-guide.html',
  '/blog/merge-pdf-guide.html',
  '/css/main.css',
  '/css/rtl.css',
  '/css/blog.css',
  '/js/core/i18n.js',
  '/js/core/ui-utils.js',
  '/js/core/seo.js',
  '/js/core/pwa-register.js',
  '/js/lib/pdf-lib.min.js',
  '/js/lib/pdf.min.js',
  '/js/lib/pdf.worker.min.js',
  '/js/lib/docx.min.js',
  '/js/lib/mammoth.browser.min.js',
  '/js/lib/sheetjs.min.js',
  '/js/lib/tesseract.min.js',
  '/js/ocr.js',
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
  '/js/delete-pages.js',
  '/js/compress-image.js',
  '/js/convert-to-image.js',
  '/js/rotate-pages.js',
  '/js/unlock-pdf.js',
  '/js/protect-pdf.js',
  '/js/metadata-editor.js',
  '/js/dxf-viewer.js',
  '/js/word-to-image.js',
  '/js/compare-pdf.js',
  '/pages/delete-pdf.html',
  '/pages/image-to-text.html',
  '/pages/extract-text.html',
  '/pages/sign-pdf.html',
  '/pages/merge-pdf.html',
  '/pages/split-pdf.html',
  '/pages/scan.html',
  '/pages/document-reader.html',
  '/pages/photo-resizer.html',
  '/pages/pdf-to-powerpoint.html',
  '/pages/organize-pdf.html',
  '/pages/scientific-calculator.html',
  '/pages/id-photo.html',
  '/pages/compress-pdf.html',
  '/pages/rotate-pdf.html',
  '/pages/watermark.html',
  '/pages/edit-pdf.html',
  '/pages/pdf-to-word.html',
  '/pages/unlock-pdf.html',
  '/pages/protect-pdf.html',
  '/pages/metadata-editor.html',
  '/pages/dxf-viewer.html',
  '/pages/word-to-image.html',
  '/pages/compare-pdf.html',
  '/assets/icons/brand-logo.svg',
  '/assets/icons/favicon.svg',
  '/assets/icons/document-reader.svg',
  '/assets/icons/calculator.svg',
  '/assets/icons/photo-resizer.svg',
  '/assets/icons/pdf-to-powerpoint.svg',
  '/assets/icons/organize-pdf.svg',
  '/assets/icons/delete-pdf-pages.svg',
  '/assets/icons/merge-pdf.svg',
  '/assets/icons/split-pdf.svg',
  '/assets/icons/compress-pdf.svg',
  '/assets/icons/pdf-to-jpg.svg',
  '/assets/icons/pdf-to-word.svg',
  '/assets/icons/rotate-pdf.svg',
  '/assets/icons/scan.svg',
  '/assets/icons/cnic-photo-maker.svg',
  '/assets/icons/jpg-to-pdf.svg',
  '/assets/icons/watermark.svg',
  '/assets/icons/unlock-pdf.svg',
  '/assets/icons/protect-pdf.svg',
  '/assets/icons/redact-pdf.svg',
  '/assets/icons/extract-text.svg',
  '/assets/icons/metadata-editor.svg',
  '/assets/icons/dxf-viewer.svg',
  '/assets/icons/word-to-image.svg',
  '/assets/icons/compare-pdf.svg'
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

