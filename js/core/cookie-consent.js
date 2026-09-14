/**
 * localdoc.org — GDPR & Privacy Cookie Consent Banner (js/core/cookie-consent.js)
 * Compliant with Google AdSense, GDPR, ePrivacy Directive, and CPRA standards.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'localdoc_cookie_consent';

  const CookieConsent = {
    getConsent() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        return null;
      }
    },

    setConsent(value) {
      try {
        localStorage.setItem(STORAGE_KEY, value);
        localStorage.setItem(STORAGE_KEY + '_date', new Date().toISOString());
      } catch (e) {
        // Fallback or private browsing
      }
      this.hideBanner();
    },

    init() {
      const consent = this.getConsent();
      if (!consent) {
        // Show after a brief non-blocking delay so user isn't startled
        setTimeout(() => this.renderBanner(), 600);
      }
    },

    renderBanner() {
      if (document.getElementById('cookie-consent-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'cookie-consent-banner';
      banner.className = 'cookie-consent-banner';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie and Privacy Consent');

      // Determine relative path to privacy.html
      const isPagesOrBlog = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/');
      const privacyHref = isPagesOrBlog ? '../privacy.html' : 'privacy.html';

      banner.innerHTML = `
        <div class="cookie-consent-inner">
          <div class="cookie-consent-content">
            <div class="cookie-consent-header">
              <span class="cookie-icon" aria-hidden="true">🍪</span>
              <strong>Privacy & Cookie Preferences</strong>
            </div>
            <p class="cookie-consent-text">
              LocalDoc operates on a <strong>100% Zero-Upload, client-side architecture</strong>. Your documents, photos, and files are processed solely in your browser RAM and are never sent to any server. We use essential local storage for app settings and anonymous analytics to improve performance. Learn more in our <a href="${privacyHref}" class="cookie-link">Privacy Policy</a>.
            </p>
          </div>
          <div class="cookie-consent-actions">
            <button type="button" id="cookie-btn-essential" class="btn btn-outline cookie-btn">
              Essential Only
            </button>
            <button type="button" id="cookie-btn-accept" class="btn btn-primary cookie-btn">
              Accept All
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(banner);

      // Trigger animation
      requestAnimationFrame(() => {
        banner.classList.add('cookie-banner-visible');
      });

      // Bind listeners
      document.getElementById('cookie-btn-accept')?.addEventListener('click', () => {
        this.setConsent('accepted');
      });

      document.getElementById('cookie-btn-essential')?.addEventListener('click', () => {
        this.setConsent('essential');
      });
    },

    hideBanner() {
      const banner = document.getElementById('cookie-consent-banner');
      if (banner) {
        banner.classList.remove('cookie-banner-visible');
        banner.classList.add('cookie-banner-hiding');
        setTimeout(() => {
          banner.remove();
        }, 350);
      }
    },

    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY + '_date');
      } catch (e) {}
      this.renderBanner();
    }
  };

  window.LocalDocConsent = CookieConsent;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CookieConsent.init());
  } else {
    CookieConsent.init();
  }
})();
