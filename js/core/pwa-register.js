/**
 * LocalDoc.org — PWA Service Worker & Desktop App Installer (js/core/pwa-register.js)
 * Enables 1-click desktop installation for PC (Windows/Mac/Linux) and offline caching.
 */

(function() {
  'use strict';

  let deferredPrompt = null;

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/') ? '../sw.js' : './sw.js';
      navigator.serviceWorker.register(swPath).then((reg) => {
        console.log('LocalDoc PWA ServiceWorker active:', reg.scope);
        if (reg.update) reg.update();
      }).catch((err) => {
        console.warn('PWA registration skipped:', err);
      });
    });
  }

  // Capture Desktop PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('LocalDoc PWA install prompt ready.');
    showInstallButtons();
  });

  function showInstallButtons() {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
      btn.style.display = 'inline-flex';
    });
  }

  // Setup click handlers on all install buttons
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === 'accepted') {
            console.log('User installed LocalDoc as Desktop App');
          }
          deferredPrompt = null;
        } else {
          // If already installed or browser does not support prompt, show instructions / offline modal
          showOfflineModal();
        }
      });
    });
  });

  window.addEventListener('appinstalled', () => {
    console.log('LocalDoc was successfully installed.');
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
      btn.innerHTML = '✓ App Installed';
      btn.disabled = true;
    });
  });

  function showOfflineModal() {
    let modal = document.getElementById('offline-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'offline-install-modal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';
      modal.innerHTML = `
        <div style="background:var(--bg-surface); border:1px solid var(--line); border-radius:16px; max-width:500px; width:100%; padding:28px; box-shadow:0 20px 40px rgba(0,0,0,0.3); text-align:center;">
          <div style="font-size:2.8rem; margin-bottom:12px;">💻</div>
          <h3 style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-bottom:8px;">Install LocalDoc on Your PC</h3>
          <p style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6; margin-bottom:20px;">
            LocalDoc runs 100% offline inside your browser RAM. You can install it as a standalone desktop application on Windows, Mac, or Linux without any app store.
          </p>
          <div style="background:var(--bg-body); border:1px solid var(--line); border-radius:8px; padding:14px; text-align:left; font-size:0.85rem; color:var(--text-secondary); margin-bottom:20px;">
            <strong>How to install manually:</strong>
            <ul style="margin-left:18px; margin-top:6px; line-height:1.5;">
              <li><strong>Chrome / Edge / Brave:</strong> Click the <strong>Install icon (⊕)</strong> in the right corner of your address bar.</li>
              <li>Or click <strong>Menu (⋮) → "Install LocalDoc..."</strong> or <strong>"Save and Share" → "Create Shortcut"</strong>.</li>
              <li>Once installed, it opens in its own window and works completely offline!</li>
            </ul>
          </div>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button id="close-offline-modal" class="btn btn-primary" style="padding:10px 24px; font-weight:700;">Got It</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#close-offline-modal').addEventListener('click', () => {
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    } else {
      modal.style.display = 'flex';
    }
  }

  window.LocalDocPWA = {
    showOfflineModal
  };
})();
