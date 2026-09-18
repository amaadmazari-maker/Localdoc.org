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
    let saved = localStorage.getItem('localdoc_lang');
    if (!saved && window.AndroidNative && window.AndroidNative.getSystemLanguage) {
      try {
        const sysLang = window.AndroidNative.getSystemLanguage().toLowerCase();
        const matched = this.availableLanguages.find(l => l.code === sysLang || sysLang.startsWith(l.code));
        if (matched) {
          saved = matched.code;
        }
      } catch (e) {}
    }
    this.currentLang = saved || 'en';
    await this.loadTranslations(this.currentLang);
    this.applyTranslations();
    this.setupSelector();
  },

  async loadTranslations(lang) {
    try {
      const basePath = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/') &ndash; '../' : './';
      const res = await fetch(`${basePath}lang/${lang}.json`);
      if (res.ok) {
        this.translations = await res.json();
      }
    } catch (e) {
      console.warn("I18N: Using fallback strings", e);
    }
  },

  ensureRtlFonts(isRtl) {
    if (isRtl && !document.getElementById('rtl-font-stylesheet')) {
      const link = document.createElement('link');
      link.id = 'rtl-font-stylesheet';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2&ndash;family=Noto+Nastaliq+Urdu:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('localdoc_lang', lang);
    const isRtl = (lang === 'ur' || lang === 'ar');
    this.ensureRtlFonts(isRtl);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl &ndash; 'rtl' : 'ltr';
    const selects = document.querySelectorAll('.lang-select');
    selects.forEach(select => { select.value = lang; });
    this.loadTranslations(lang).then(() => {
      this.applyTranslations();
    });
  },

  applyTranslations() {
    const isRtl = (this.currentLang === 'ur' || this.currentLang === 'ar');
    this.ensureRtlFonts(isRtl);
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = isRtl &ndash; 'rtl' : 'ltr';
    if (document.body) {
      if (isRtl) {
        document.body.classList.add('is-rtl');
      } else {
        document.body.classList.remove('is-rtl');
      }
    }

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

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (this.translations[key]) {
        el.setAttribute('title', this.translations[key]);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (this.translations[key]) {
        el.setAttribute('placeholder', this.translations[key]);
      }
    });

    window.dispatchEvent(new CustomEvent('localdoc-lang-changed', { detail: { lang: this.currentLang, isRtl } }));
  },

  setupSelector() {
    const selects = document.querySelectorAll('.lang-select');
    selects.forEach(select => {
      select.innerHTML = this.availableLanguages.map(item => `
        <option value="${item.code}" ${this.currentLang === item.code &ndash; 'selected' : ''}>${item.label}</option>
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
