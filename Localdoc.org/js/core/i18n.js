/**
 * localdoc.org — Multi-Language Translation Engine (js/core/i18n.js)
 * Supports 7 Global Languages: EN, UR (RTL), AR (RTL), ES, FR, DE, ZH
 */

const I18N = {
  currentLang: 'en',
  translations: {},

  availableLanguages: [
    { code: 'en', label: '🇺🇸 English', dir: 'ltr' },
    { code: 'ur', label: '🇵🇰 اردو (Urdu)', dir: 'rtl' },
    { code: 'ar', label: '🇸🇦 العربية (Arabic)', dir: 'rtl' },
    { code: 'es', label: '🇪🇸 Español', dir: 'ltr' },
    { code: 'fr', label: '🇫🇷 Français', dir: 'ltr' },
    { code: 'de', label: '🇩🇪 Deutsch', dir: 'ltr' },
    { code: 'zh', label: '🇨🇳 简体中文', dir: 'ltr' }
  ],

  async init() {
    this.currentLang = localStorage.getItem('localdoc_lang') || 'en';
    await this.loadTranslations(this.currentLang);
    this.applyTranslations();
    this.setupSelector();
  },

  async loadTranslations(lang) {
    try {
      const basePath = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/') ? '../' : './';
      const res = await fetch(`${basePath}lang/${lang}.json`);
      if (res.ok) {
        this.translations = await res.json();
      }
    } catch (e) {
      console.warn("I18N: Using fallback strings", e);
    }
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('localdoc_lang', lang);
    const isRtl = (lang === 'ur' || lang === 'ar');
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    this.loadTranslations(lang).then(() => {
      this.applyTranslations();
    });
  },

  applyTranslations() {
    const isRtl = (this.currentLang === 'ur' || this.currentLang === 'ar');
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (this.translations[key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = this.translations[key];
        } else {
          el.textContent = this.translations[key];
        }
      }
    });
  },

  setupSelector() {
    const selects = document.querySelectorAll('.lang-select');
    selects.forEach(select => {
      select.innerHTML = this.availableLanguages.map(item => `
        <option value="${item.code}" ${this.currentLang === item.code ? 'selected' : ''}>${item.label}</option>
      `).join('');
      select.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  I18N.init();
});
