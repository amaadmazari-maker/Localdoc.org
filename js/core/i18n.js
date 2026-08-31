/**
 * localdoc.org — Multi-Language Translation Engine (js/core/i18n.js)
 */

const I18N = {
  currentLang: 'en',
  translations: {},

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
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    this.loadTranslations(lang).then(() => {
      this.applyTranslations();
    });
  },

  applyTranslations() {
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = this.currentLang === 'ur' ? 'rtl' : 'ltr';

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
      select.innerHTML = `
        <option value="en" ${this.currentLang === 'en' ? 'selected' : ''}>🇺🇸 English</option>
        <option value="ur" ${this.currentLang === 'ur' ? 'selected' : ''}>🇵🇰 اردو (Urdu)</option>
      `;
      select.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  I18N.init();
});
