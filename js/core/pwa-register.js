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
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetPlatform = btn.getAttribute('data-pwa-target') || (btn.textContent.toLowerCase().includes('mobile') ? 'mobile' : 'pc');

        if (deferredPrompt && targetPlatform === 'pc') {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === 'accepted') {
            console.log('User installed LocalDoc as Desktop App');
          }
          deferredPrompt = null;
        } else {
          showInstallModal(targetPlatform);
        }
      });
    });
  });

  window.addEventListener('appinstalled', () => {
    console.log('LocalDoc was successfully installed.');
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
      btn.innerHTML = '✓ Installed';
      btn.disabled = true;
    });
  });

  function showInstallModal(targetPlatform = 'pc') {
    let modal = document.getElementById('pwa-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pwa-install-modal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;';
      document.body.appendChild(modal);
    }

    const isMobileTarget = targetPlatform === 'mobile' || (!targetPlatform && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    modal.innerHTML = `
      <div style="background:var(--bg-surface, #0F172A); border:1.5px solid var(--line, #334155); border-radius:22px; max-width:500px; width:100%; padding:24px; box-shadow:0 25px 60px rgba(0,0,0,0.7); color:var(--text-primary, #FFF); position:relative;">
        <button id="pwa-modal-x" style="position:absolute; top:16px; right:18px; background:none; border:none; color:#94A3B8; font-size:1.4rem; cursor:pointer; line-height:1;">✕</button>
        
        <!-- Platform Toggle Tabs -->
        <div style="display:flex; background:var(--bg-body, #020617); border:1px solid var(--line, #1E293B); border-radius:12px; padding:4px; gap:4px; margin-bottom:18px;">
          <button type="button" id="tab-pwa-mobile" style="flex:1; padding:9px 12px; font-weight:800; font-size:0.86rem; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s; ${isMobileTarget ? 'background:#0284C7; color:#FFF;' : 'background:transparent; color:#94A3B8;'}">
            <span>📱</span> <span>Mobile (Android / iOS)</span>
          </button>
          <button type="button" id="tab-pwa-pc" style="flex:1; padding:9px 12px; font-weight:800; font-size:0.86rem; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s; ${!isMobileTarget ? 'background:#0F766E; color:#FFF;' : 'background:transparent; color:#94A3B8;'}">
            <span>💻</span> <span>PC / Mac / Linux</span>
          </button>
        </div>

        <!-- Mobile Content Section -->
        <div id="pwa-content-mobile" style="display:${isMobileTarget ? 'block' : 'none'}; text-align:left;">
          <div style="text-align:center; margin-bottom:14px;">
            <h3 style="font-size:1.25rem; font-weight:800; margin:0 0 6px;">Install LocalDoc on Mobile</h3>
            <p style="font-size:0.86rem; color:var(--text-secondary, #94A3B8); margin:0; line-height:1.4;">
              100% offline standalone app with camera scanning and zero cloud uploads.
            </p>
          </div>
          
          <div style="background:var(--bg-body, #020617); border:1px solid var(--line, #1E293B); border-radius:12px; padding:14px; font-size:0.84rem; color:var(--text-secondary, #94A3B8); margin-bottom:16px;">
            <div style="font-weight:800; color:#38BDF8; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <span>🤖</span> Android (Chrome / Edge / Samsung Internet):
            </div>
            <ol style="margin:0 0 12px 18px; padding:0; line-height:1.5;">
              <li>Tap the <strong>Menu (⋮)</strong> icon in top-right corner.</li>
              <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              <li>LocalDoc will install directly with full offline access!</li>
            </ol>
            
            <div style="font-weight:800; color:#FB7185; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <span>🍎</span> iPhone & iPad (Safari):
            </div>
            <ol style="margin:0 0 0 18px; padding:0; line-height:1.5;">
              <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>"Add to Home Screen (⊞)"</strong>.</li>
              <li>Launch from your home screen like any native app.</li>
            </ol>
          </div>
        </div>

        <!-- PC / Desktop Content Section -->
        <div id="pwa-content-pc" style="display:${!isMobileTarget ? 'block' : 'none'}; text-align:left;">
          <div style="text-align:center; margin-bottom:14px;">
            <h3 style="font-size:1.25rem; font-weight:800; margin:0 0 6px;">Install LocalDoc on PC / Mac</h3>
            <p style="font-size:0.86rem; color:var(--text-secondary, #94A3B8); margin:0; line-height:1.4;">
              Standalone desktop application for Windows, macOS, and Linux.
            </p>
          </div>
          
          <div style="background:var(--bg-body, #020617); border:1px solid var(--line, #1E293B); border-radius:12px; padding:14px; font-size:0.84rem; color:var(--text-secondary, #94A3B8); margin-bottom:16px;">
            <div style="font-weight:800; color:#34D399; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <span>🖥️</span> Chrome, Edge & Brave (Desktop):
            </div>
            <ul style="margin:0 0 0 18px; padding:0; line-height:1.5;">
              <li>Look for the <strong>Install icon (⊕)</strong> on the right side of the address bar.</li>
              <li>Or click <strong>Menu (⋮) → "Save and share" → "Install LocalDoc..."</strong></li>
              <li>Runs in its own dedicated window without browser bars, 100% offline.</li>
            </ul>
          </div>
        </div>
        
        <button id="close-pwa-modal" class="btn btn-primary" style="width:100%; padding:12px; font-weight:800; border-radius:10px; background:#0284C7; border-color:#0284C7; cursor:pointer;">Got It</button>
      </div>
    `;

    // Interactive Tab Switching inside modal
    const tabMobile = modal.querySelector('#tab-pwa-mobile');
    const tabPc = modal.querySelector('#tab-pwa-pc');
    const contentMobile = modal.querySelector('#pwa-content-mobile');
    const contentPc = modal.querySelector('#pwa-content-pc');

    function switchModalTab(toMobile) {
      if (toMobile) {
        tabMobile.style.background = '#0284C7';
        tabMobile.style.color = '#FFF';
        tabPc.style.background = 'transparent';
        tabPc.style.color = '#94A3B8';
        contentMobile.style.display = 'block';
        contentPc.style.display = 'none';
      } else {
        tabPc.style.background = '#0F766E';
        tabPc.style.color = '#FFF';
        tabMobile.style.background = 'transparent';
        tabMobile.style.color = '#94A3B8';
        contentPc.style.display = 'block';
        contentMobile.style.display = 'none';
      }
    }

    tabMobile?.addEventListener('click', () => switchModalTab(true));
    tabPc?.addEventListener('click', () => switchModalTab(false));

    modal.style.display = 'flex';
    modal.querySelector('#close-pwa-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.querySelector('#pwa-modal-x')?.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  window.LocalDocPWA = {
    showInstallModal
  };
})();
