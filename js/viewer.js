/**
 * LocalDoc — Document Viewer (js/viewer.js)
 * Standardized controller per Part 6 mapping
 */
(function() {
  'use strict';
  // If reader is in js/tools/reader.js, ensure availability
  if (typeof window.DocReader === 'undefined' && typeof require === 'undefined') {
    const s = document.createElement('script');
    s.src = '../js/tools/reader.js';
    document.head.appendChild(s);
  }
})();
