/**
 * localdoc.org — Canonical SEO Engine (js/core/seo.js)
 */
document.addEventListener('DOMContentLoaded', () => {
  const link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = window.location.origin + window.location.pathname;
    document.head.appendChild(canonical);
  }
});
