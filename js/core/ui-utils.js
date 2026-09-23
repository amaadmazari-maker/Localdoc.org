/**
 * localdoc.org — 2500HP UI Utilities & Global Interactive Engine (js/core/ui-utils.js)
 */

const UIUtils = {
  // Format file size
  formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  },

  // Read file as ArrayBuffer
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // Read file as Data URL
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Load Image Object
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  },

  // Haptic feedback helper
  triggerHaptic(duration = 20) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(duration); } catch(e) {}
    }
  },

  // Toast Notification System
  showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-pill toast-${type}`;
    const bg = type === 'success' ? '#059669' : (type === 'error' ? '#DC2626' : (type === 'warning' ? '#D97706' : '#0284C7'));
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : (type === 'warning' ? '⚠' : 'ℹ'));
    toast.style.cssText = `background:${bg}; color:#FFFFFF; padding:10px 18px; border-radius:24px; font-size:0.88rem; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,0.25); display:inline-flex; align-items:center; gap:8px; pointer-events:auto; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); transform:translateY(20px); opacity:0;`;
    toast.innerHTML = `<span style="font-size:1rem;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(10px)';
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  },

  // Instant Client-Side Download
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    if (window.LocalDocUnifiedFilesDB && blob) {
      try {
        UIUtils.readFileAsDataURL(blob).then(dataUrl => {
          window.LocalDocUnifiedFilesDB.recordDocument({
            title: filename,
            type: filename.toLowerCase().endsWith('.pdf') ? 'pdf' : (filename.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? 'image' : 'document'),
            mimeType: blob.type || (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
            size: UIUtils.formatBytes(blob.size),
            dataUrl: dataUrl
          });
        }).catch(err => console.warn('Record file error:', err));
      } catch(e) {}
    }
  },

  // 3-Step Interactive Workflow Indicator
  setWorkflowStep(stepIndex, percent = 0, statusText = '') {
    const container = document.getElementById('workflow-progress');
    if (!container) return;

    container.style.display = 'block';

    const nodes = container.querySelectorAll('.workflow-step-node');
    nodes.forEach((node, idx) => {
      node.classList.remove('active', 'completed');
      if (idx < stepIndex) {
        node.classList.add('completed');
      } else if (idx === stepIndex) {
        node.classList.add('active');
      }
    });

    const fill = container.querySelector('.workflow-progress-fill');
    const percentEl = container.querySelector('#progress-percent');
    const statusEl = container.querySelector('#progress-status');

    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
    if (statusEl && statusText) statusEl.textContent = statusText;
  },

  // Direct File Input Binding (Guaranteed Native Event Flow)
  bindFileInput(inputEl, onFilesSelected) {
    if (!inputEl) return;
    inputEl.__localdoc_handler = onFilesSelected;
    const handleChange = (e) => {
      const files = Array.from((e && e.target && e.target.files) || inputEl.files || []);
      if (files.length > 0) {
        UIUtils.triggerHaptic();
        onFilesSelected(files);
      }
      setTimeout(() => { try { inputEl.value = ''; } catch(err) {} }, 250);
    };
    inputEl.addEventListener('change', handleChange);
    inputEl.addEventListener('input', handleChange);
  },

  // Global fallback called by inline onchange on file inputs
  handleGlobalFileInput(inputEl) {
    if (!inputEl) return;
    const files = Array.from(inputEl.files || []);
    if (files.length > 0) {
      UIUtils.triggerHaptic();
      if (typeof inputEl.__localdoc_handler === 'function') {
        inputEl.__localdoc_handler(files);
      }
    }
    setTimeout(() => { try { inputEl.value = ''; } catch(err) {} }, 250);
  },

  // Drag & Drop Setup (With Fullscreen Window Drag Delight)
  setupDropZone(zoneEl, inputEl, onFilesSelected) {
    if (!zoneEl) return;

    if (inputEl) {
      this.bindFileInput(inputEl, onFilesSelected);
    }

    // 1. Local Dropzone Listeners
    ['dragenter', 'dragover'].forEach(name => {
      zoneEl.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zoneEl.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      zoneEl.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zoneEl.classList.remove('drag-active');
      });
    });

    zoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        UIUtils.triggerHaptic();
        onFilesSelected(files);
      }
    });

    zoneEl.addEventListener('click', (e) => {
      if (e.target === inputEl || e.target.closest('button, #browse-btn, .btn, input, a, label')) return;
      if (inputEl) {
        inputEl.click();
      }
    });

    const browseBtns = zoneEl.querySelectorAll('button, #browse-btn, .btn');
    browseBtns.forEach(btn => {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputEl) {
          inputEl.click();
        }
      });
    });

    // 2. Window-Wide Drag & Drop Delight
    this.initFullscreenDrop(onFilesSelected);
  },

  // Initialize Global Fullscreen Drag Overlay (Singleton with persistent listener)
  initFullscreenDrop(onFilesSelected) {
    window.__activeFileDropHandler = onFilesSelected;

    let overlay = document.getElementById('global-fullscreen-drop-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-fullscreen-drop-overlay';
      overlay.className = 'fullscreen-drop-overlay';
      overlay.style.pointerEvents = 'none';
      overlay.innerHTML = `
        <div class="fullscreen-drop-box" style="pointer-events: none;">
          <div class="fullscreen-drop-icon" style="pointer-events: none;">⚡</div>
          <h3 class="fullscreen-drop-title" style="pointer-events: none;">Drop Your Document Anywhere</h3>
          <p class="fullscreen-drop-sub" style="pointer-events: none;">100% Private in Browser RAM • Zero Server Uploads</p>
        </div>
      `;
      document.body.appendChild(overlay);

      let dragCounter = 0;

      const isFileDrag = (e) => {
        return e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
      };

      window.addEventListener('dragenter', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('active');
        overlay.style.pointerEvents = 'auto';
      });

      window.addEventListener('dragleave', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          overlay.classList.remove('active');
          overlay.style.pointerEvents = 'none';
        }
      });

      window.addEventListener('dragover', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
      });

      window.addEventListener('drop', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');
        overlay.style.pointerEvents = 'none';
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0 && typeof window.__activeFileDropHandler === 'function') {
          UIUtils.triggerHaptic();
          window.__activeFileDropHandler(files);
        }
      });
    }
  },

  // Subtle Haptic & Click Feedback
  triggerHaptic(duration = 20) {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (e) {}
  },

  // Render 1-Click Quick Actions (Download, Open in Reader, Share, Copy)
  renderQuickActions(container, fileBlob, fileName, options = {}) {
    if (!container || !fileBlob) return;

    let actionsWrap = container.querySelector('.result-quick-actions');
    if (!actionsWrap) {
      actionsWrap = document.createElement('div');
      actionsWrap.className = 'result-quick-actions';
      container.appendChild(actionsWrap);
    }
    actionsWrap.innerHTML = '';

    // 1. Open in Reader Button (Zero-upload instant preview)
    const isDoc = fileName.match(/\.(pdf|docx|xlsx|txt|png|jpe?g)$/i);
    if (isDoc) {
      const readerBtn = document.createElement('button');
      readerBtn.type = 'button';
      readerBtn.className = 'btn-quick-action';
      readerBtn.innerHTML = `<span>👁️ Open in Reader</span>`;
      readerBtn.addEventListener('click', async () => {
        UIUtils.triggerHaptic();
        const dataUrl = await UIUtils.readFileAsDataURL(fileBlob);
        sessionStorage.setItem('localdoc_view_document', JSON.stringify({
          dataUrl: dataUrl,
          filename: fileName,
          type: fileBlob.type || 'application/pdf'
        }));
        const readerUrl = window.location.pathname.includes('/pages/')  ?  'document-reader.html' : 'pages/document-reader.html';
        window.location.href = readerUrl;
      });
      actionsWrap.appendChild(readerBtn);
    }

    // 2. Copy Image to Clipboard (Instant Paste into Word, Docs, Photoshop)
    const isImg = fileName.match(/\.(png|jpe?g|webp)$/i) || (fileBlob.type && fileBlob.type.startsWith('image/'));
    if (isImg && navigator.clipboard && window.ClipboardItem) {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-quick-action';
      copyBtn.innerHTML = `<span>📋 Copy Image</span>`;
      copyBtn.addEventListener('click', async () => {
        UIUtils.triggerHaptic();
        try {
          let pngBlob = fileBlob;
          if (fileBlob.type !== 'image/png') {
            const img = await UIUtils.loadImage(URL.createObjectURL(fileBlob));
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0);
            pngBlob = await new Promise(res => c.toBlob(res, 'image/png'));
          }
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          UIUtils.showToast('✓ Photo copied to clipboard! Paste anywhere (Ctrl+V).', 'success');
        } catch (err) {
          console.warn('Clipboard write failed:', err);
          UIUtils.showToast('Unable to copy directly; please use Download button.', 'info');
        }
      });
      actionsWrap.appendChild(copyBtn);
    }

    // 3. Native Share API (Mobile WhatsApp, AirDrop, Messages with 1 tap)
    if (navigator.canShare && navigator.canShare({ files: [new File([fileBlob], fileName, { type: fileBlob.type })] })) {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'btn-quick-action';
      shareBtn.innerHTML = `<span>📱 Share Document</span>`;
      shareBtn.addEventListener('click', async () => {
        UIUtils.triggerHaptic();
        try {
          const file = new File([fileBlob], fileName, { type: fileBlob.type });
          await navigator.share({
            title: fileName,
            text: 'Processed securely with LocalDoc (localdoc.org)',
            files: [file]
          });
        } catch (err) {
          if (err.name !== 'AbortError') console.warn('Share error:', err);
        }
      });
      actionsWrap.appendChild(shareBtn);
    }
  },


  // Toast Notification
  showToast(message, type = 'info') {
    let toast = document.getElementById('localdoc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'localdoc-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 24px;
        border-radius: 10px;
        background: #1E293B;
        color: #FFF;
        font-weight: 600;
        font-size: 0.95rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        border: 1px solid #334155;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      document.body.appendChild(toast);
    }

    if (type === 'success') {
      toast.style.borderColor = '#10B981';
      toast.innerHTML = `<span style="color:#10B981;font-weight:bold;">✓</span> ${message}`;
    } else if (type === 'error') {
      toast.style.borderColor = '#EF4444';
      toast.innerHTML = `<span style="color:#EF4444;font-weight:bold;">✕</span> ${message}`;
    } else {
      toast.style.borderColor = '#F59E0B';
      toast.innerHTML = `<span style="color:#F59E0B;font-weight:bold;">ℹ</span> ${message}`;
    }

    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
    }, 3500);
  },

  // Global Quick Search (Cmd+K)
  initQuickSearch() {
    const isSub = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/');
    const prefix = isSub  ?  '../pages/' : 'pages/';

    const tools = [
      // Core Tools
      { name: "PDF Camera Studio (A4 Scanner)", slug: "scan.html", category: "Scanner & Cam", keywords: "camscanner scan papers ocr camera mobile perspective crop" },
      { name: "Document Reader (PDF/Word/Excel)", slug: "document-reader.html", category: "Viewer", keywords: "reader viewer docx xlsx preview sheets office" },
      { name: "Scientific Calculator (Casio FX)", slug: "scientific-calculator.html", category: "Calculator", keywords: "calculator math casio fx scientific deg rad fractions base-n" },
      { name: "Sign PDF Online (Digital Signature)", slug: "sign-pdf.html", category: "Sign & Edit", keywords: "sign signature draw sign stamp e-sign sign contracts fill and sign" },
      { name: "Protect PDF (Password & Restrictions)", slug: "protect-pdf.html", category: "Security", keywords: "protect encrypt password lock permissions restrict printing aes-256" },
      { name: "Organize PDF Pages", slug: "organize-pdf.html", category: "Organize", keywords: "organize sort reorder drag drop rotate delete pages" },
      { name: "Create PDF Studio", slug: "create-pdf.html", category: "Document Builder", keywords: "create pdf blank build document multi-page combine images" },
      { name: "PDF to PowerPoint (PPTX)", slug: "pdf-to-powerpoint.html", category: "Convert", keywords: "pdf to powerpoint pptx slides presentation google slides" },
      { name: "National ID & CNIC Studio (2-in-1 A4)", slug: "id-photo.html", category: "Biometric ID", keywords: "cnic nadra id card studio 2-in-1 a4 photocopy identity card front and back" },
      { name: "Passport Photo Maker", slug: "passport-photo-maker.html", category: "Biometric ID", keywords: "passport photo visa photo biometric 2x2 35x45 print sheet 4x6 a4 background color" },
      { name: "Photo Resizer & KB Reducer", slug: "photo-resizer.html", category: "Photo Utility", keywords: "photo resizer kb reducer reduce size compress image 20kb 50kb 100kb mm cm inches px" },
      { name: "Compress PDF", slug: "compress-pdf.html", category: "Organize", keywords: "compress pdf reduce file size reduce mb 200kb 100kb shrink pdf optimization" },
      { name: "Merge PDF", slug: "merge-pdf.html", category: "Organize", keywords: "merge combine join multiple pdfs unite concatenate" },
      { name: "Split PDF", slug: "split-pdf.html", category: "Organize", keywords: "split extract pages burst separate page ranges" },
      { name: "Rotate PDF", slug: "rotate-pdf.html", category: "Organize", keywords: "rotate 90 180 degrees fix sideways upside down pages" },
      { name: "Edit PDF & Annotate", slug: "edit-pdf.html", category: "Edit", keywords: "edit annotate text draw highlight add notes pdf" },
      { name: "PDF to Word (DOCX)", slug: "pdf-to-word.html", category: "Convert", keywords: "pdf to word docx editable microsoft word text tables" },
      { name: "Word to PDF", slug: "word-to-pdf.html", category: "Convert", keywords: "word to pdf docx to pdf convert document printable a4" },
      { name: "PDF to Excel (XLSX)", slug: "pdf-to-excel.html", category: "Convert", keywords: "pdf to excel xlsx spreadsheet financial table extraction bank statements" },
      { name: "Excel to PDF", slug: "excel-to-pdf.html", category: "Convert", keywords: "excel to pdf xlsx to pdf spreadsheets table sheet to pdf" },
      { name: "PDF to High-Res JPG", slug: "pdf-to-jpg.html", category: "Convert", keywords: "pdf to jpg jpeg high resolution 300 dpi convert images" },
      { name: "JPG to PDF", slug: "jpg-to-pdf.html", category: "Convert", keywords: "jpg to pdf photos to document images to pdf compile jpgs" },
      { name: "PDF to PNG (Lossless)", slug: "pdf-to-png.html", category: "Convert", keywords: "pdf to png transparent lossless high quality images" },
      { name: "PNG to PDF", slug: "png-to-pdf.html", category: "Convert", keywords: "png to pdf transparent images artwork graphics to pdf" },
      { name: "Image to Text (OCR)", slug: "image-to-text.html", category: "OCR", keywords: "ocr image to text optical character recognition extract text scan to text" },
      { name: "Add Watermark", slug: "watermark.html", category: "Security", keywords: "watermark stamp confidential draft text opacity custom angle" },
      { name: "Add Page Numbers", slug: "page-numbers.html", category: "Organize", keywords: "page numbers pagination header footer number pages" },

      // Deep-Link Presets for Popular Regional & Exam Searches
      { name: "PAN Card Photo Resizer (213\u00D7213 px, \u226430 KB)", slug: "photo-resizer.html?preset=pan", category: "India Portal Preset", keywords: "pan card photo 213x213 uti nsdl income tax 30kb signature 10kb" },
      { name: "CNIC Biometric Photo (354\u00D7472 px, Light Blue)", slug: "passport-photo-maker.html?country=pk", category: "NADRA Portal Preset", keywords: "cnic photo pak identity nadra online 354x472 light blue background pakistan" },
      { name: "UAE Emirates ID & Visa Photo (35\u00D745 mm)", slug: "passport-photo-maker.html?country=uae", category: "UAE & GCC Preset", keywords: "uae dubai emirates id icp gdrfa resident tourist visa 35x45" },
      { name: "US Visa & Passport Photo (2\u00D72\" / DS-160)", slug: "passport-photo-maker.html?country=us", category: "US & Canada Preset", keywords: "us visa ds160 ds-160 united states passport 2x2 inch 51x51 green card" },
      { name: "Canada Passport & PR Photo (50\u00D770 mm)", slug: "passport-photo-maker.html?country=ca", category: "US & Canada Preset", keywords: "canada pr permanent resident passport photo 50x70 large" },
      { name: "UK HMPO Passport Photo (35\u00D745 mm)", slug: "passport-photo-maker.html?country=uk", category: "UK & Europe Preset", keywords: "uk passport hmpo british driving licence 35x45" },
      { name: "Schengen Europe Visa Photo (35\u00D745 mm)", slug: "passport-photo-maker.html?country=schengen", category: "UK & Europe Preset", keywords: "schengen visa france germany italy spain 35x45 european union" },
      { name: "South Korea ARC & Passport Photo (35\u00D745 mm)", slug: "passport-photo-maker.html?country=kr", category: "Asia Preset", keywords: "south korea koria arc alien registration passport visa 35x45" },
      { name: "Russia Passport & Visa Photo (35\u00D745 mm, 80% Face)", slug: "passport-photo-maker.html?country=ru", category: "Europe Preset", keywords: "russia russian gosuslugi visa passport 35x45 80 percent" },
      { name: "Saudi Arabia Hajj, Umrah & Iqama Photo", slug: "passport-photo-maker.html?country=saudi", category: "UAE & GCC Preset", keywords: "saudi arabia umrah hajj iqama driving license 2x2 40x60" },
      { name: "China Visa Photo (33\u00D748 mm)", slug: "passport-photo-maker.html?country=cn", category: "Asia Preset", keywords: "china visa passport 33x48 standard" },
      { name: "Japan Visa & Residence Photo (35\u00D745 mm)", slug: "passport-photo-maker.html?country=jp", category: "Asia Preset", keywords: "japan visa residence card 35x45" },
      { name: "Compress PDF to \u2264 200 KB (UPSC / FPSC / Exams)", slug: "compress-pdf.html?target=200kb", category: "Exam Portal Preset", keywords: "compress pdf 200kb 200 kb upsc fpsc ssc government job upload portal" },
      { name: "Compress PDF to \u2264 100 KB (Strict Portals)", slug: "compress-pdf.html?target=100kb", category: "Exam Portal Preset", keywords: "compress pdf 100kb 100 kb strict portal limit" },
      { name: "Photo Resizer to \u2264 20 KB (Govt Job Applications)", slug: "photo-resizer.html?target=20kb", category: "Exam Portal Preset", keywords: "photo resizer 20kb 20 kb govt forms exams ssc upsc signature" },
      { name: "Signature Resizer to \u2264 10 KB", slug: "photo-resizer.html?preset=signature", category: "Exam Portal Preset", keywords: "signature resizer 10kb 10 kb sign exam portal" }
    ];

    let backdrop = document.getElementById('search-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'search-modal-backdrop';
      backdrop.className = 'search-modal-backdrop';
      backdrop.innerHTML = `
        <div class="search-modal">
          <div class="search-modal-input-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="search" id="global-search-input" class="search-modal-input" placeholder="Search 28 tools & 45 guides... (ESC to exit)" aria-label="Search all tools and guides">
            <span class="kbd-shortcut">ESC</span>
          </div>
          <ul id="global-search-results" class="search-results-list"></ul>
        </div>
      `;
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });

      const input = backdrop.querySelector('#global-search-input');
      const results = backdrop.querySelector('#global-search-results');

      const render = (query = '') => {
        const q = query.toLowerCase().trim();
        const filtered = q ? tools.filter(t => 
          t.name.toLowerCase().includes(q) || 
          t.category.toLowerCase().includes(q) || 
          (t.keywords && t.keywords.toLowerCase().includes(q))
        ) : tools.slice(0, 16);
        results.innerHTML = filtered.map(t => `
          <li class="search-result-item">
            <a href="${prefix}${t.slug}">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--primary);"></div>
              <strong style="flex:1;">${t.name}</strong>
              <span style="font-size:0.75rem;color:var(--text-muted);border:1px solid var(--line);padding:2px 8px;border-radius:4px;">${t.category}</span>
            </a>
          </li>
        `).join('');
      };

      input.addEventListener('input', () => render(input.value));
      render();
    }

    // Connect any search trigger buttons on the page
    document.querySelectorAll('.search-trigger-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.classList.add('open');
        setTimeout(() => backdrop.querySelector('#global-search-input').focus(), 60);
      });
    });

    // Keyboard trigger
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        backdrop.classList.add('open');
        setTimeout(() => backdrop.querySelector('#global-search-input').focus(), 50);
      } else if (e.key === 'Escape') {
        backdrop.classList.remove('open');
      }
    });
  },

  // Dark / Light Theme & Accent Color Switcher
  initTheme() {
    const saved = localStorage.getItem('localdoc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);

    const savedAccent = localStorage.getItem('localdoc_accent') || 'blue';
    document.documentElement.setAttribute('data-accent', savedAccent);

    // Dark/Light toggle buttons
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const curr = document.documentElement.getAttribute('data-theme') || 'light';
        const next = curr === 'dark'  ?  'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('localdoc_theme', next);
        UIUtils.showToast(`Switched to ${next} mode`, 'info');
      });
    });

    // Accent Color Palette Selector
    const paletteBtns = document.querySelectorAll('.color-palette-btn');
    const paletteDropdowns = document.querySelectorAll('.color-palette-dropdown');
    
    paletteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        if (dropdown) dropdown.classList.toggle('open');
      });
    });

    document.querySelectorAll('.color-dot-opt').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const accent = dot.getAttribute('data-accent');
        if (accent) {
          document.documentElement.setAttribute('data-accent', accent);
          localStorage.setItem('localdoc_accent', accent);
          paletteDropdowns.forEach(d => d.classList.remove('open'));
          UIUtils.showToast(`Applied ${accent.charAt(0).toUpperCase() + accent.slice(1)} theme`, 'success');
        }
      });
    });

    // Close palette on outside click
    document.addEventListener('click', () => {
      paletteDropdowns.forEach(d => d.classList.remove('open'));
    });
  },

  // Reading Progress Bar
  initReadingProgress() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / total) * 100;
      bar.style.width = `${progress}%`;
    });
  },

  // Mobile Navigation Drawer Toggle
  initMobileNav() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    if (!toggleBtn || !drawer) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
      toggleBtn.innerHTML = isOpen 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    });

    // Close drawer on link click
    drawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
        drawer.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      }
    });
  },

  // GDPR Cookie Consent Banner
  initCookieConsent() {
    if (window.LocalDocConsent) {
      window.LocalDocConsent.init();
      return;
    }
    const STORAGE_KEY = 'localdoc_cookie_consent';
    let consent = null;
    try { consent = localStorage.getItem(STORAGE_KEY); } catch (e) {}

    let banner = document.getElementById('cookie-consent-banner');

    // If user already gave consent, remove/hide static banner immediately
    if (consent) {
      if (banner) {
        banner.style.display = 'none';
        banner.remove();
      }
      return;
    }

    // If not present in static HTML, create dynamically
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'cookie-consent-banner';
      banner.className = 'cookie-consent-banner';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie and Privacy Consent');
      banner.setAttribute('data-nosnippet', '');

      const isSub = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/blog/');
      const privacyHref = isSub  ?  '../privacy.html' : 'privacy.html';

      banner.innerHTML = `
        <div class="cookie-consent-inner">
          <div class="cookie-consent-content">
            <div class="cookie-consent-header">
              <span class="cookie-icon" aria-hidden="true">🍪</span>
              <strong>Privacy &amp; Cookie Preferences</strong>
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
    }

    // Smooth entrance
    requestAnimationFrame(() => {
      banner.classList.add('cookie-banner-visible');
    });

    const dismiss = (val) => {
      try {
        localStorage.setItem(STORAGE_KEY, val);
        localStorage.setItem(STORAGE_KEY + '_date', new Date().toISOString());
      } catch (e) {}
      banner.classList.remove('cookie-banner-visible');
      banner.classList.add('cookie-banner-hiding');
      setTimeout(() => banner.remove(), 350);
    };

    document.getElementById('cookie-btn-accept').addEventListener('click', () => dismiss('accepted'));
    document.getElementById('cookie-btn-essential').addEventListener('click', () => dismiss('essential'));
  }
};

// In-Memory Client-Side ZIP Archive Generator (Zero Network / 100% RAM)
class LocalZip {
  constructor() {
    this.files = [];
  }
  static createZip(fileArray, mimeType = 'application/zip') {
    const zip = new LocalZip();
    for (const item of fileArray) {
      zip.addFile(item.filename || item.name, item.bytes || item.data || item.content);
    }
    return zip.generateBlob(mimeType);
  }
  addFile(filename, content) {
    let bytes;
    if (typeof content === 'string') {
      bytes = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      bytes = content;
    } else if (content instanceof ArrayBuffer) {
      bytes = new Uint8Array(content);
    } else if (content && content.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      bytes = new Uint8Array(0);
    }
    this.files.push({ name: filename, data: bytes });
  }
  async addBlob(filename, blob) {
    const buffer = await blob.arrayBuffer();
    this.addFile(filename, buffer);
  }
  generateBlob(mimeType = 'application/zip') {
    const parts = [];
    const cdEntries = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const dataBytes = file.data;
      const crc = this.crc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const v = new DataView(localHeader.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0, true);
      v.setUint16(8, 0, true);
      v.setUint16(10, 0, true);
      v.setUint16(12, 0, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, size, true);
      v.setUint32(22, size, true);
      v.setUint16(26, nameBytes.length, true);
      v.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      parts.push(localHeader);
      parts.push(dataBytes);

      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cdHeader.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      cdHeader.set(nameBytes, 46);

      cdEntries.push(cdHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const cd of cdEntries) {
      parts.push(cd);
      cdSize += cd.length;
    }

    const eocd = new Uint8Array(22);
    const eocdv = new DataView(eocd.buffer);
    eocdv.setUint32(0, 0x06054b50, true);
    eocdv.setUint16(4, 0, true);
    eocdv.setUint16(6, 0, true);
    eocdv.setUint16(8, this.files.length, true);
    eocdv.setUint16(10, this.files.length, true);
    eocdv.setUint32(12, cdSize, true);
    eocdv.setUint32(16, cdOffset, true);
    eocdv.setUint16(20, 0, true);

    parts.push(eocd);
    return new Blob(parts, { type: mimeType });
  }
  crc32(bytes) {
    if (!LocalZip.CRC_TABLE) {
      LocalZip.CRC_TABLE = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1)  ?  (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        LocalZip.CRC_TABLE[i] = c >>> 0;
      }
    }
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ LocalZip.CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }
}
UIUtils.Zip = LocalZip;
window.MiniZip = LocalZip;
window.handleLocalDocFileInput = function(el) {
  if (window.UIUtils && typeof window.UIUtils.handleGlobalFileInput === 'function') {
    window.UIUtils.handleGlobalFileInput(el);
  }
};

// Auto Init
document.addEventListener('DOMContentLoaded', () => {
  UIUtils.initTheme();
  UIUtils.initQuickSearch();
  UIUtils.initReadingProgress();
  UIUtils.initMobileNav();
  UIUtils.initCookieConsent();
});


