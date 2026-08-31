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

  // Drag & Drop Setup
  setupDropZone(zoneEl, inputEl, onFilesSelected) {
    if (!zoneEl) return;

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
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    });

    zoneEl.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && inputEl) {
        inputEl.click();
      }
    });

    if (inputEl) {
      inputEl.addEventListener('change', () => {
        const files = Array.from(inputEl.files);
        if (files.length > 0) onFilesSelected(files);
      });
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
    const tools = [
      { name: "Compress PDF", url: "/pages/compress-pdf.html", category: "Organize" },
      { name: "Merge PDF", url: "/pages/merge-pdf.html", category: "Organize" },
      { name: "Split PDF", url: "/pages/split-pdf.html", category: "Organize" },
      { name: "Rotate PDF", url: "/pages/rotate-pdf.html", category: "Organize" },
      { name: "Edit PDF & Sign", url: "/pages/edit-pdf.html", category: "Edit" },
      { name: "PDF to Word (DOCX)", url: "/pages/pdf-to-word.html", category: "Convert" },
      { name: "Word to PDF", url: "/pages/word-to-pdf.html", category: "Convert" },
      { name: "PDF to Excel (XLSX)", url: "/pages/pdf-to-excel.html", category: "Convert" },
      { name: "Excel to PDF", url: "/pages/excel-to-pdf.html", category: "Convert" },
      { name: "PDF to High-Res JPG", url: "/pages/pdf-to-jpg.html", category: "Convert" },
      { name: "JPG to PDF", url: "/pages/jpg-to-pdf.html", category: "Convert" },
      { name: "PDF to PNG", url: "/pages/pdf-to-png.html", category: "Convert" },
      { name: "PNG to PDF", url: "/pages/png-to-pdf.html", category: "Convert" },
      { name: "Document Scanner", url: "/pages/scan.html", category: "Scanner" },
      { name: "CNIC Photo Maker", url: "/pages/cnic-photo-maker.html", category: "Biometric ID" },
      { name: "Passport Photo Maker", url: "/pages/passport-photo-maker.html", category: "Biometric ID" },
      { name: "Visa Photo Maker", url: "/pages/visa-photo-maker.html", category: "Biometric ID" },
      { name: "Image to Text (OCR)", url: "/pages/image-to-text.html", category: "OCR" },
      { name: "Add Watermark", url: "/pages/watermark.html", category: "Security" },
      { name: "Add Page Numbers", url: "/pages/page-numbers.html", category: "Organize" }
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
            <input type="text" id="global-search-input" class="search-modal-input" placeholder="Search 20 tools & 25 guides... (ESC to exit)" autofocus>
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
        const filtered = tools.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
        results.innerHTML = filtered.map(t => `
          <li class="search-result-item">
            <a href="${t.url}">
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

    // Keyboard trigger
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        backdrop.classList.add('open');
        setTimeout(() => backdrop.querySelector('#global-search-input')?.focus(), 50);
      } else if (e.key === 'Escape') {
        backdrop.classList.remove('open');
      }
    });
  },

  // Dark / Light Theme Switcher
  initTheme() {
    const saved = localStorage.getItem('localdoc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);

    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const curr = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = curr === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('localdoc_theme', next);
        UIUtils.showToast(`Switched to ${next} mode`, 'info');
      });
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
  }
};

// Auto Init
document.addEventListener('DOMContentLoaded', () => {
  UIUtils.initTheme();
  UIUtils.initQuickSearch();
  UIUtils.initReadingProgress();
});
