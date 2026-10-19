/**
 * LocalDoc.org — Universal Document Reader & Annotation Workspace
 * Supports PDF (Mozilla PDF.js), Word (.docx via Mammoth.js), Excel (.xlsx/.xls/.csv via SheetJS), Text, and Images.
 * 100% Client-Side In-Memory Execution. Zero Server Uploads.
 * 
 * Features:
 * 1. On-Device Annotation Overlay (Pen, Highlighter, Eraser) + IndexedDB Persistence
 * 2. Export Annotated PDF with embedded drawing layers
 * 3. Reading Comfort Modes: True Night/Dark Mode, Sepia Tone, Brightness & Contrast
 * 4. Text-to-Speech (Read Aloud) Engine via Web Speech API
 * 5. Multi-Document Tabs System (Cross-reference multiple files in RAM)
 * 6. Visual Page Thumbnail Filmstrip Scrubber
 * 7. In-Browser Password-Protected Document Decryption
 */

(function() {
  'use strict';

  // ==========================================
  // 1. INDEXEDDB PERSISTENCE LAYER FOR ANNOTATIONS
  // ==========================================
  const LocalDocReaderDB = {
    dbName: 'LocalDocReaderAnnotationsDB',
    dbVersion: 1,
    storeName: 'page_annotations',
    _db: null,

    async getDB() {
      if (this._db) return this._db;
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open(this.dbName, this.dbVersion);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: 'key' });
            }
          };
          req.onsuccess = (e) => {
            this._db = e.target.result;
            resolve(this._db);
          };
          req.onerror = () => {
            console.warn('IndexedDB unavailable, falling back to memory storage');
            resolve(null);
          };
        } catch (err) {
          console.warn('IndexedDB initialization failed:', err);
          resolve(null);
        }
      });
    },

    _memStore: new Map(),

    async savePageStrokes(docFingerprint, pageNum, strokes) {
      const key = `${docFingerprint}_p${pageNum}`;
      const record = { key, docFingerprint, pageNum, strokes, updatedAt: Date.now() };

      const db = await this.getDB();
      if (!db) {
        this._memStore.set(key, record);
        return;
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => {
            this._memStore.set(key, record);
            resolve(false);
          };
        } catch (e) {
          this._memStore.set(key, record);
          resolve(false);
        }
      });
    },

    async loadPageStrokes(docFingerprint, pageNum) {
      const key = `${docFingerprint}_p${pageNum}`;
      const db = await this.getDB();
      if (!db) {
        const item = this._memStore.get(key);
        return item ? item.strokes : [];
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(key);
          req.onsuccess = () => {
            const res = req.result;
            resolve((res && res.strokes) ? res.strokes : []);
          };
          req.onerror = () => {
            const item = this._memStore.get(key);
            resolve(item ? item.strokes : []);
          };
        } catch (e) {
          const item = this._memStore.get(key);
          resolve(item ? item.strokes : []);
        }
      });
    },

    async getAllDocStrokes(docFingerprint) {
      const db = await this.getDB();
      if (!db) {
        const results = [];
        this._memStore.forEach(v => {
          if (v.docFingerprint === docFingerprint) results.push(v);
        });
        return results;
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => {
            const all = req.result || [];
            resolve(all.filter(item => item.docFingerprint === docFingerprint));
          };
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    },

    async clearDocStrokes(docFingerprint) {
      const db = await this.getDB();
      this._memStore.forEach((v, k) => {
        if (v.docFingerprint === docFingerprint) this._memStore.delete(k);
      });
      if (!db) return;

      try {
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          all.filter(item => item.docFingerprint === docFingerprint).forEach(item => {
            store.delete(item.key);
          });
        };
      } catch (e) {}
    }
  };

  // Helper: Fast deterministic document fingerprint
  function getDocFingerprint(file) {
    if (!file) return 'doc_unknown';
    const str = `${file.name}_${file.size}_${file.lastModified || 0}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'doc_' + Math.abs(hash).toString(36);
  }

  // ==========================================
  // 2. TEXT-TO-SPEECH (READ ALOUD) ENGINE
  // ==========================================
  const ReaderSpeechEngine = {
    synth: window.speechSynthesis || null,
    utterance: null,
    isPlaying: false,
    isPaused: false,
    rate: 1.0,
    currentText: '',

    init() {
      if (!this.synth) {
        console.warn('SpeechSynthesis API not supported in this browser environment.');
      }
    },

    isSupported() {
      return !!this.synth;
    },

    cleanText(rawText) {
      if (!rawText) return '';
      return rawText
        .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2') // Rejoin hyphenated words across lines
        .replace(/\s+/g, ' ')
        .trim();
    },

    speak(text, onStart, onEnd, onError) {
      if (!this.synth) {
        if (typeof UIUtils !== 'undefined') UIUtils.showToast('Text-to-speech not supported on this browser.', 'warning');
        return;
      }

      this.stop();
      const cleaned = this.cleanText(text);
      if (!cleaned) {
        if (typeof UIUtils !== 'undefined') UIUtils.showToast('No readable text found on this page.', 'warning');
        return;
      }

      this.currentText = cleaned;
      this.utterance = new SpeechSynthesisUtterance(cleaned);
      this.utterance.rate = this.rate;

      // Select high quality voice if available
      const voices = this.synth.getVoices();
      const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (naturalVoice) this.utterance.voice = naturalVoice;

      this.utterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
        if (onStart) onStart();
      };

      this.utterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        if (onEnd) onEnd();
      };

      this.utterance.onerror = (err) => {
        this.isPlaying = false;
        this.isPaused = false;
        if (onError) onError(err);
      };

      this.synth.speak(this.utterance);
    },

    pause() {
      if (this.synth && this.isPlaying && !this.isPaused) {
        this.synth.pause();
        this.isPaused = true;
      }
    },

    resume() {
      if (this.synth && this.isPaused) {
        this.synth.resume();
        this.isPaused = false;
      }
    },

    stop() {
      if (this.synth) {
        this.synth.cancel();
        this.isPlaying = false;
        this.isPaused = false;
      }
    },

    setRate(newRate) {
      this.rate = parseFloat(newRate) || 1.0;
      if (this.isPlaying && !this.isPaused) {
        // Restart speech with new rate
        this.speak(this.currentText);
      }
    }
  };

  // ==========================================
  // 3. ANNOTATION OVERLAY CANVAS ENGINE
  // ==========================================
  const ReaderAnnotationOverlay = {
    canvas: null,
    ctx: null,
    wrapper: null,
    docFingerprint: null,
    currentPageNum: 1,
    activeTool: 'cursor', // 'cursor', 'pen', 'highlighter', 'eraser'
    penColor: '#EF4444',
    penWidth: 3,
    highlighterColor: '#FACC15',
    highlighterWidth: 20,
    strokes: [],
    currentStroke: null,
    isDrawing: false,

    mount(parentContainer, width, height, docFingerprint, pageNum) {
      this.docFingerprint = docFingerprint;
      this.currentPageNum = pageNum;

      // Remove existing annotation canvas if any
      const existing = parentContainer.querySelector('.reader-annotation-layer');
      if (existing) existing.remove();

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'reader-annotation-layer';
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      this.canvas.style.zIndex = '5';
      this.canvas.style.pointerEvents = (this.activeTool === 'cursor') ? 'none' : 'auto';
      this.canvas.style.touchAction = 'none';

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);

      this.ctx = this.canvas.getContext('2d');
      this.ctx.scale(dpr, dpr);

      parentContainer.style.position = 'relative';
      parentContainer.appendChild(this.canvas);

      this.setupPointerEvents();
      this.loadSavedStrokes();
    },

    setTool(tool) {
      this.activeTool = tool;
      if (this.canvas) {
        this.canvas.style.pointerEvents = (tool === 'cursor') ? 'none' : 'auto';
        if (tool === 'pen') {
          this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'highlighter') {
          this.canvas.style.cursor = 'text';
        } else if (tool === 'eraser') {
          this.canvas.style.cursor = 'cell';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }
    },

    setPenColor(color) {
      this.penColor = color;
    },

    setPenWidth(width) {
      this.penWidth = parseInt(width, 10) || 3;
    },

    setHighlighterColor(color) {
      this.highlighterColor = color;
    },

    setupPointerEvents() {
      if (!this.canvas) return;

      const getCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      };

      this.canvas.onpointerdown = (e) => {
        if (this.activeTool === 'cursor') return;
        e.preventDefault();
        this.isDrawing = true;
        this.canvas.setPointerCapture(e.pointerId);

        const pt = getCoords(e);
        if (this.activeTool === 'eraser') {
          this.eraseStrokeAt(pt.x, pt.y);
          return;
        }

        const isHighlighter = (this.activeTool === 'highlighter');
        this.currentStroke = {
          tool: this.activeTool,
          color: isHighlighter ? this.highlighterColor : this.penColor,
          width: isHighlighter ? this.highlighterWidth : this.penWidth,
          opacity: isHighlighter ? 0.4 : 1.0,
          points: [pt]
        };
        this.renderStrokeLive(this.currentStroke, pt, pt);
      };

      this.canvas.onpointermove = (e) => {
        if (!this.isDrawing) return;
        e.preventDefault();
        const pt = getCoords(e);

        if (this.activeTool === 'eraser') {
          this.eraseStrokeAt(pt.x, pt.y);
          return;
        }

        if (this.currentStroke) {
          const pts = this.currentStroke.points;
          const lastPt = pts[pts.length - 1];
          pts.push(pt);
          this.renderStrokeLive(this.currentStroke, lastPt, pt);
        }
      };

      const finishDrawing = (e) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        try { this.canvas.releasePointerCapture(e.pointerId); } catch(err){}

        if (this.currentStroke && this.currentStroke.points.length > 0) {
          this.strokes.push(this.currentStroke);
          this.currentStroke = null;
          this.redrawAllStrokes();
          this.persistStrokes();
        }
      };

      this.canvas.onpointerup = finishDrawing;
      this.canvas.onpointercancel = finishDrawing;
    },

    renderStrokeLive(stroke, p1, p2) {
      if (!this.ctx) return;
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = stroke.width;

      if (stroke.tool === 'highlighter') {
        this.ctx.globalCompositeOperation = 'multiply';
        this.ctx.strokeStyle = stroke.color;
        this.ctx.globalAlpha = stroke.opacity || 0.4;
      } else {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = stroke.color;
        this.ctx.globalAlpha = 1.0;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      this.ctx.restore();
    },

    redrawAllStrokes() {
      if (!this.ctx || !this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

      this.strokes.forEach(stroke => {
        if (!stroke.points || stroke.points.length === 0) return;
        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = stroke.width;

        if (stroke.tool === 'highlighter') {
          this.ctx.globalCompositeOperation = 'multiply';
          this.ctx.strokeStyle = stroke.color;
          this.ctx.globalAlpha = stroke.opacity || 0.4;
        } else {
          this.ctx.globalCompositeOperation = 'source-over';
          this.ctx.strokeStyle = stroke.color;
          this.ctx.globalAlpha = 1.0;
        }

        this.ctx.beginPath();
        const pts = stroke.points;
        this.ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 1) {
          this.ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5);
        } else {
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            this.ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          this.ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }
        this.ctx.stroke();
        this.ctx.restore();
      });
    },

    eraseStrokeAt(x, y) {
      const radius = 18;
      const initialCount = this.strokes.length;
      this.strokes = this.strokes.filter(stroke => {
        return !stroke.points.some(pt => {
          const dx = pt.x - x;
          const dy = pt.y - y;
          return (dx * dx + dy * dy) < (radius * radius);
        });
      });

      if (this.strokes.length !== initialCount) {
        this.redrawAllStrokes();
        this.persistStrokes();
      }
    },

    undo() {
      if (this.strokes.length > 0) {
        this.strokes.pop();
        this.redrawAllStrokes();
        this.persistStrokes();
      }
    },

    clearPage() {
      this.strokes = [];
      this.redrawAllStrokes();
      this.persistStrokes();
      if (typeof UIUtils !== 'undefined') UIUtils.showToast('Annotations cleared for this page.', 'info');
    },

    async persistStrokes() {
      if (!this.docFingerprint) return;
      await LocalDocReaderDB.savePageStrokes(this.docFingerprint, this.currentPageNum, this.strokes);
    },

    async loadSavedStrokes() {
      if (!this.docFingerprint) return;
      this.strokes = await LocalDocReaderDB.loadPageStrokes(this.docFingerprint, this.currentPageNum);
      this.redrawAllStrokes();
    }
  };

  // ==========================================
  // 4. READING COMFORT CONTROLLER (DARK/SEPIA/BRIGHTNESS)
  // ==========================================
  const ReaderComfortController = {
    theme: 'default', // 'default', 'dark', 'sepia'
    brightness: 100, // 50 to 150
    contrast: 100,   // 75 to 125

    setTheme(newTheme) {
      this.theme = newTheme;
      this.applyFilters();
    },

    setBrightness(val) {
      this.brightness = Math.max(50, Math.min(150, parseInt(val, 10) || 100));
      this.applyFilters();
    },

    setContrast(val) {
      this.contrast = Math.max(75, Math.min(125, parseInt(val, 10) || 100));
      this.applyFilters();
    },

    applyFilters() {
      const container = document.getElementById('reader-content-canvas');
      const workspace = document.getElementById('reader-workspace');
      if (!container || !workspace) return;

      workspace.classList.remove('reader-theme-dark', 'reader-theme-sepia');

      let filterString = `brightness(${this.brightness}%) contrast(${this.contrast}%)`;

      if (this.theme === 'dark') {
        workspace.classList.add('reader-theme-dark');
        filterString += ' invert(0.92) hue-rotate(180deg)';
      } else if (this.theme === 'sepia') {
        workspace.classList.add('reader-theme-sepia');
        filterString += ' sepia(0.35)';
      }

      container.style.filter = filterString;
    }
  };

  // ==========================================
  // 5. MULTI-DOCUMENT TABS MANAGER
  // ==========================================
  const ReaderTabsManager = {
    tabs: [],
    activeTabId: null,

    getTab(tabId) {
      return this.tabs.find(t => t.id === tabId);
    },

    getActiveTab() {
      return this.tabs.find(t => t.id === this.activeTabId);
    },

    addDocument(file) {
      // Check if file is already open
      const existing = this.tabs.find(t => t.name === file.name && t.size === file.size);
      if (existing) {
        this.switchTab(existing.id);
        return existing;
      }

      const newTab = {
        id: 'tab_' + Math.random().toString(36).substring(2, 9),
        file: file,
        name: file.name,
        size: file.size,
        type: getFileTypeFromName(file.name),
        pdfDoc: null,
        currentPage: 1,
        totalPages: 1,
        scale: 1.25,
        rotation: 0,
        excelWorkbook: null,
        currentSheetName: null,
        docFingerprint: getDocFingerprint(file)
      };

      this.tabs.push(newTab);
      this.renderTabsBar();
      this.switchTab(newTab.id);
      return newTab;
    },

    switchTab(tabId) {
      const tab = this.getTab(tabId);
      if (!tab) return;

      this.activeTabId = tabId;
      this.renderTabsBar();
      ReaderSpeechEngine.stop();
      loadActiveTabDocument(tab);
    },

    closeTab(tabId) {
      const idx = this.tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return;

      const isCurrent = (this.activeTabId === tabId);
      this.tabs.splice(idx, 1);

      if (this.tabs.length === 0) {
        this.activeTabId = null;
        this.renderTabsBar();
        closeAllViewer();
        return;
      }

      if (isCurrent) {
        const nextIdx = Math.max(0, idx - 1);
        this.switchTab(this.tabs[nextIdx].id);
      } else {
        this.renderTabsBar();
      }
    },

    renderTabsBar() {
      const bar = document.getElementById('reader-tabs-bar');
      if (!bar) return;

      if (this.tabs.length <= 1) {
        bar.style.display = (this.tabs.length === 1) ? 'flex' : 'none';
      } else {
        bar.style.display = 'flex';
      }

      let html = '';
      this.tabs.forEach(t => {
        const isActive = (t.id === this.activeTabId);
        const icon = t.type === 'pdf' ? '📄' : (t.type === 'docx' ? '📝' : (t.type === 'xlsx' ? '📊' : '📑'));
        html += `
          <div class="reader-tab-item ${isActive ? 'active' : ''}" data-tab-id="${t.id}" onclick="window.LocalDocReaderTabs.switch('${t.id}')">
            <span class="reader-tab-icon">${icon}</span>
            <span class="reader-tab-name" title="${t.name}">${t.name}</span>
            <button type="button" class="reader-tab-close" onclick="event.stopPropagation(); window.LocalDocReaderTabs.close('${t.id}');" title="Close document">&times;</button>
          </div>
        `;
      });

      html += `
        <button type="button" class="reader-tab-add-btn" onclick="document.getElementById('reader-file-input').click();" title="Open another document in a new tab">
          + Open
        </button>
      `;

      bar.innerHTML = html;
    }
  };

  function getFileTypeFromName(name) {
    const n = (name || '').toLowerCase();
    if (n.endsWith('.pdf')) return 'pdf';
    if (n.endsWith('.docx') || n.endsWith('.doc')) return 'docx';
    if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) return 'xlsx';
    if (n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.json')) return 'text';
    return 'image';
  }

  // ==========================================
  // 6. MAIN WORKSPACE STATE & LOADERS
  // ==========================================
  let pdfRenderTask = null;

  // DOM Elements
  const dropZone = document.getElementById('reader-drop-zone');
  const fileInput = document.getElementById('reader-file-input');
  const viewerWorkspace = document.getElementById('reader-workspace');
  const emptyState = document.getElementById('reader-empty-state');
  const docTitle = document.getElementById('reader-doc-title');
  const docMeta = document.getElementById('reader-doc-meta');
  const pageNavGroup = document.getElementById('reader-page-nav-group');
  const pageInput = document.getElementById('reader-page-input');
  const pageTotalSpan = document.getElementById('reader-page-total');
  const zoomLevelSpan = document.getElementById('reader-zoom-level');
  const sheetTabsBar = document.getElementById('reader-sheet-tabs');
  const contentContainer = document.getElementById('reader-content-canvas');
  const scrubberDrawer = document.getElementById('reader-thumbnails-drawer');
  const scrubberStrip = document.getElementById('reader-thumbnails-strip');

  // Initialize PDF.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
  }

  function init() {
    ReaderSpeechEngine.init();
    setupEventListeners();
    checkIncomingDocument();

    // Global hooks
    window.handleReaderFile = handleFile;
    window.LocalDocReaderTabs = {
      switch: (id) => ReaderTabsManager.switchTab(id),
      close: (id) => ReaderTabsManager.closeTab(id)
    };
    window.LocalDocReaderAnnotations = ReaderAnnotationOverlay;
    window.LocalDocReaderSpeech = ReaderSpeechEngine;
    window.LocalDocReaderComfort = ReaderComfortController;

    if (fileInput) {
      fileInput._localDocDropHandler = (files) => {
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) handleFile(files[i]);
        }
      };
    }
  }

  function setupEventListeners() {
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            handleFile(e.dataTransfer.files[i]);
          }
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          for (let i = 0; i < e.target.files.length; i++) {
            handleFile(e.target.files[i]);
          }
          fileInput.value = '';
        }
      });
    }

    // Top Toolbar Controls
    const prevPageBtn = document.getElementById('reader-prev-page');
    const nextPageBtn = document.getElementById('reader-next-page');
    const zoomInBtn = document.getElementById('reader-zoom-in');
    const zoomOutBtn = document.getElementById('reader-zoom-out');
    const zoomFitBtn = document.getElementById('reader-zoom-fit');
    const rotateBtn = document.getElementById('reader-rotate-btn');
    const fullscreenBtn = document.getElementById('reader-fullscreen-btn');
    const printBtn = document.getElementById('reader-print-btn');
    const downloadBtn = document.getElementById('reader-download-btn');
    const downloadAnnotatedBtn = document.getElementById('reader-download-annotated-btn');
    const closeBtn = document.getElementById('reader-close-btn');

    if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePdfPage(-1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePdfPage(1));
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const tab = ReaderTabsManager.getActiveTab();
        if (!tab || tab.type !== 'pdf' || !tab.pdfDoc) return;
        const pageNum = parseInt(e.target.value, 10);
        if (pageNum >= 1 && pageNum <= tab.totalPages) {
          tab.currentPage = pageNum;
          renderPdfPage(tab, tab.currentPage);
        }
      });
    }

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(0.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-0.2));
    if (zoomFitBtn) zoomFitBtn.addEventListener('click', resetZoom);
    if (rotateBtn) rotateBtn.addEventListener('click', rotateDocument);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    if (printBtn) printBtn.addEventListener('click', printDocument);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCurrentFile);
    if (downloadAnnotatedBtn) downloadAnnotatedBtn.addEventListener('click', downloadAnnotatedPdf);
    if (closeBtn) closeBtn.addEventListener('click', () => {
      const active = ReaderTabsManager.getActiveTab();
      if (active) ReaderTabsManager.closeTab(active.id);
      else closeAllViewer();
    });

    // Annotation Toolbar Palette
    const toolCursorBtn = document.getElementById('annot-tool-cursor');
    const toolPenBtn = document.getElementById('annot-tool-pen');
    const toolHighlighterBtn = document.getElementById('annot-tool-highlighter');
    const toolEraserBtn = document.getElementById('annot-tool-eraser');
    const toolUndoBtn = document.getElementById('annot-tool-undo');
    const toolClearBtn = document.getElementById('annot-tool-clear');

    const updateToolPaletteUI = (activeTool) => {
      document.querySelectorAll('.annot-tool-btn').forEach(b => b.classList.remove('active'));
      const activeEl = document.getElementById(`annot-tool-${activeTool}`);
      if (activeEl) activeEl.classList.add('active');
    };

    if (toolCursorBtn) toolCursorBtn.addEventListener('click', () => {
      ReaderAnnotationOverlay.setTool('cursor');
      updateToolPaletteUI('cursor');
    });
    if (toolPenBtn) toolPenBtn.addEventListener('click', () => {
      ReaderAnnotationOverlay.setTool('pen');
      updateToolPaletteUI('pen');
    });
    if (toolHighlighterBtn) toolHighlighterBtn.addEventListener('click', () => {
      ReaderAnnotationOverlay.setTool('highlighter');
      updateToolPaletteUI('highlighter');
    });
    if (toolEraserBtn) toolEraserBtn.addEventListener('click', () => {
      ReaderAnnotationOverlay.setTool('eraser');
      updateToolPaletteUI('eraser');
    });
    if (toolUndoBtn) toolUndoBtn.addEventListener('click', () => ReaderAnnotationOverlay.undo());
    if (toolClearBtn) toolClearBtn.addEventListener('click', () => ReaderAnnotationOverlay.clearPage());

    // Color Swatches
    document.querySelectorAll('.annot-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.annot-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.getAttribute('data-color');
        if (ReaderAnnotationOverlay.activeTool === 'highlighter') {
          ReaderAnnotationOverlay.setHighlighterColor(color);
        } else {
          ReaderAnnotationOverlay.setPenColor(color);
        }
      });
    });

    // Reading Comfort Controls
    const themeDefaultBtn = document.getElementById('theme-btn-default');
    const themeDarkBtn = document.getElementById('theme-btn-dark');
    const themeSepiaBtn = document.getElementById('theme-btn-sepia');
    const brightnessSlider = document.getElementById('comfort-brightness-slider');
    const contrastSlider = document.getElementById('comfort-contrast-slider');

    if (themeDefaultBtn) themeDefaultBtn.addEventListener('click', () => {
      setActiveThemeBtn(themeDefaultBtn);
      ReaderComfortController.setTheme('default');
    });
    if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => {
      setActiveThemeBtn(themeDarkBtn);
      ReaderComfortController.setTheme('dark');
    });
    if (themeSepiaBtn) themeSepiaBtn.addEventListener('click', () => {
      setActiveThemeBtn(themeSepiaBtn);
      ReaderComfortController.setTheme('sepia');
    });

    function setActiveThemeBtn(activeBtn) {
      document.querySelectorAll('.reader-theme-btn').forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
    }

    if (brightnessSlider) brightnessSlider.addEventListener('input', (e) => {
      ReaderComfortController.setBrightness(e.target.value);
    });
    if (contrastSlider) contrastSlider.addEventListener('input', (e) => {
      ReaderComfortController.setContrast(e.target.value);
    });

    // Text-to-Speech Audio Player Bar
    const speechPlayBtn = document.getElementById('speech-play-btn');
    const speechStopBtn = document.getElementById('speech-stop-btn');
    const speechSpeedBtn = document.getElementById('speech-speed-btn');

    if (speechPlayBtn) {
      speechPlayBtn.addEventListener('click', async () => {
        if (ReaderSpeechEngine.isPlaying) {
          if (ReaderSpeechEngine.isPaused) {
            ReaderSpeechEngine.resume();
            speechPlayBtn.innerHTML = '⏸ Pause';
          } else {
            ReaderSpeechEngine.pause();
            speechPlayBtn.innerHTML = '▶ Resume';
          }
          return;
        }

        const tab = ReaderTabsManager.getActiveTab();
        if (!tab) return;

        let textToRead = '';
        if (tab.type === 'pdf' && tab.pdfDoc) {
          try {
            const page = await tab.pdfDoc.getPage(tab.currentPage);
            const textContent = await page.getTextContent();
            textToRead = textContent.items.map(i => i.str).join(' ');
          } catch(e) {}
        } else {
          textToRead = contentContainer.innerText || '';
        }

        ReaderSpeechEngine.speak(
          textToRead,
          () => {
            speechPlayBtn.innerHTML = '⏸ Pause';
            if (typeof UIUtils !== 'undefined') UIUtils.showToast('Reading document aloud...', 'info');
          },
          () => {
            speechPlayBtn.innerHTML = '▶ Read Aloud';
            if (typeof UIUtils !== 'undefined') UIUtils.showToast('Finished reading page.', 'success');
          },
          (err) => {
            speechPlayBtn.innerHTML = '▶ Read Aloud';
            console.warn('Speech error:', err);
          }
        );
      });
    }

    if (speechStopBtn) {
      speechStopBtn.addEventListener('click', () => {
        ReaderSpeechEngine.stop();
        if (speechPlayBtn) speechPlayBtn.innerHTML = '▶ Read Aloud';
      });
    }

    if (speechSpeedBtn) {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
      let sIdx = 0;
      speechSpeedBtn.addEventListener('click', () => {
        sIdx = (sIdx + 1) % speeds.length;
        const spd = speeds[sIdx];
        speechSpeedBtn.textContent = `${spd}x`;
        ReaderSpeechEngine.setRate(spd);
      });
    }

    // Toggle Thumbnail Scrubber Drawer
    const scrubberToggleBtn = document.getElementById('reader-scrubber-toggle');
    if (scrubberToggleBtn && scrubberDrawer) {
      scrubberToggleBtn.addEventListener('click', () => {
        const isHidden = (scrubberDrawer.style.display === 'none' || !scrubberDrawer.style.display);
        scrubberDrawer.style.display = isHidden ? 'flex' : 'none';
        scrubberToggleBtn.classList.toggle('active', isHidden);
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore if user is inside an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const tab = ReaderTabsManager.getActiveTab();
      if (!tab) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        changePdfPage(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        changePdfPage(-1);
      } else if (e.key.toLowerCase() === 'h') {
        if (toolHighlighterBtn) toolHighlighterBtn.click();
      } else if (e.key.toLowerCase() === 'p') {
        if (toolPenBtn) toolPenBtn.click();
      } else if (e.key.toLowerCase() === 'e') {
        if (toolEraserBtn) toolEraserBtn.click();
      } else if (e.key.toLowerCase() === 'v') {
        if (toolCursorBtn) toolCursorBtn.click();
      }
    });
  }

  // ==========================================
  // 7. DOCUMENT HANDLING & RENDERING
  // ==========================================
  function handleFile(file) {
    if (!file) return;
    ReaderTabsManager.addDocument(file);
  }

  async function loadActiveTabDocument(tab) {
    const file = tab.file;
    docTitle.textContent = tab.name;
    docMeta.textContent = `${UIUtils ? UIUtils.formatBytes(tab.size) : (tab.size / 1024).toFixed(1) + ' KB'} • ${file.type || tab.type.toUpperCase()}`;

    emptyState.style.display = 'none';
    viewerWorkspace.style.display = 'flex';
    viewerWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

    contentContainer.innerHTML = '<div class="reader-loading-spinner"><div class="spinner"></div><p>Loading document in secure RAM...</p></div>';
    sheetTabsBar.style.display = 'none';
    pageNavGroup.style.display = 'none';
    if (scrubberDrawer) scrubberDrawer.style.display = 'none';

    // Show annotation palette for PDF and DOCX
    const annotPalette = document.getElementById('reader-annot-palette');
    if (annotPalette) annotPalette.style.display = (tab.type === 'pdf' || tab.type === 'docx') ? 'flex' : 'none';

    if (tab.type === 'pdf') {
      pageNavGroup.style.display = 'inline-flex';
      await loadPdf(tab);
    } else if (tab.type === 'docx') {
      await loadWordDocx(tab);
    } else if (tab.type === 'xlsx') {
      sheetTabsBar.style.display = 'flex';
      await loadExcel(tab);
    } else if (tab.type === 'text') {
      await loadText(tab);
    } else {
      loadImage(tab);
    }
  }

  // ==================== PDF ENGINE ====================
  async function loadPdf(tab) {
    try {
      const arrayBuffer = await tab.file.arrayBuffer();
      
      const loadingTask = window.pdfjsLib.getDocument({
        data: arrayBuffer,
        isEvalSupported: false
      });

      // Handle Password Protected PDF gracefully
      loadingTask.onPassword = (callback, reason) => {
        promptPdfPassword(callback, reason);
      };

      tab.pdfDoc = await loadingTask.promise;
      tab.totalPages = tab.pdfDoc.numPages;
      tab.currentPage = tab.currentPage || 1;

      pageTotalSpan.textContent = `/ ${tab.totalPages}`;
      pageInput.value = tab.currentPage;
      pageInput.max = tab.totalPages;

      renderPdfPage(tab, tab.currentPage);
      generateThumbnails(tab);
    } catch (err) {
      console.error(err);
      if (err.name === 'PasswordException') {
        promptPdfPassword(null, 'need_password');
      } else {
        contentContainer.innerHTML = `
          <div class="reader-error" style="text-align:center; padding:40px 20px;">
            <div style="font-size:2rem; margin-bottom:10px;">⚠️</div>
            <h3 style="color:#EF4444; margin-bottom:8px;">Failed to Open PDF</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">${err.message || 'File is corrupted or unreadable.'}</p>
          </div>
        `;
      }
    }
  }

  function promptPdfPassword(callback, reason) {
    const modal = document.getElementById('reader-password-modal');
    const input = document.getElementById('reader-password-input');
    const submitBtn = document.getElementById('reader-password-submit');
    const cancelBtn = document.getElementById('reader-password-cancel');
    const errorMsg = document.getElementById('reader-password-error');

    if (!modal) {
      const pass = prompt('This document is password protected. Enter password:');
      if (callback && pass) callback(pass);
      return;
    }

    modal.style.display = 'flex';
    if (input) {
      input.value = '';
      input.focus();
    }
    if (errorMsg) errorMsg.style.display = (reason === 'incorrect_password') ? 'block' : 'none';

    const cleanUp = () => {
      modal.style.display = 'none';
      submitBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    submitBtn.onclick = () => {
      const pass = input.value;
      cleanUp();
      if (callback) callback(pass);
    };

    cancelBtn.onclick = () => {
      cleanUp();
      const active = ReaderTabsManager.getActiveTab();
      if (active) ReaderTabsManager.closeTab(active.id);
    };
  }

  async function renderPdfPage(tab, pageNumber) {
    if (!tab || !tab.pdfDoc) return;
    if (pdfRenderTask) {
      try { pdfRenderTask.cancel(); } catch(e){}
    }

    contentContainer.innerHTML = '';

    const page = await tab.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: tab.scale, rotation: tab.rotation });

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'reader-page-viewport';
    pageWrapper.style.position = 'relative';
    pageWrapper.style.display = 'inline-block';
    pageWrapper.style.margin = '20px auto';
    pageWrapper.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
    pageWrapper.style.borderRadius = '4px';
    pageWrapper.style.overflow = 'hidden';

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.style.height = Math.floor(viewport.height) + 'px';
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.display = 'block';
    canvas.style.backgroundColor = '#FFFFFF';
    ctx.scale(dpr, dpr);

    pageWrapper.appendChild(canvas);
    contentContainer.appendChild(pageWrapper);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    pdfRenderTask = page.render(renderContext);
    await pdfRenderTask.promise;

    pageInput.value = pageNumber;
    updateZoomDisplay(tab.scale);

    // Mount Interactive Annotation Layer
    ReaderAnnotationOverlay.mount(
      pageWrapper,
      Math.floor(viewport.width),
      Math.floor(viewport.height),
      tab.docFingerprint,
      pageNumber
    );

    // Highlight current page in thumbnail scrubber
    updateActiveScrubberThumbnail(pageNumber);
  }

  function changePdfPage(delta) {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab || tab.type !== 'pdf' || !tab.pdfDoc) return;

    const newPage = tab.currentPage + delta;
    if (newPage >= 1 && newPage <= tab.totalPages) {
      tab.currentPage = newPage;
      renderPdfPage(tab, tab.currentPage);
    }
  }

  // ==================== WORD (.DOCX) ENGINE ====================
  async function loadWordDocx(tab) {
    try {
      const arrayBuffer = await tab.file.arrayBuffer();
      if (!window.mammoth) throw new Error('Mammoth Word parser not loaded');

      const result = await window.mammoth.convertToHtml({ arrayBuffer });
      const html = result.value || '<p><em>Empty Word Document</em></p>';

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'word-doc-page';
      pageWrapper.style.position = 'relative';
      pageWrapper.innerHTML = html;

      contentContainer.innerHTML = '';
      contentContainer.appendChild(pageWrapper);

      // Mount Annotation Layer over Word page
      setTimeout(() => {
        const rect = pageWrapper.getBoundingClientRect();
        ReaderAnnotationOverlay.mount(
          pageWrapper,
          rect.width,
          rect.height,
          tab.docFingerprint,
          1
        );
      }, 50);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error">Failed to parse Word document: ${err.message}</div>`;
    }
  }

  // ==================== EXCEL (.XLSX) ENGINE ====================
  async function loadExcel(tab) {
    try {
      const arrayBuffer = await tab.file.arrayBuffer();
      if (!window.XLSX) throw new Error('SheetJS Excel engine not loaded');

      tab.excelWorkbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheetNames = tab.excelWorkbook.SheetNames;
      if (!sheetNames || sheetNames.length === 0) throw new Error('Workbook contains no sheets');

      sheetTabsBar.innerHTML = '';
      sheetNames.forEach((sheetName, index) => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `sheet-tab-btn ${index === 0 ? 'active' : ''}`;
        tabBtn.textContent = sheetName;
        tabBtn.addEventListener('click', () => {
          document.querySelectorAll('.sheet-tab-btn').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          renderExcelSheet(tab, sheetName);
        });
        sheetTabsBar.appendChild(tabBtn);
      });

      renderExcelSheet(tab, sheetNames[0]);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error">Failed to parse Spreadsheet: ${err.message}</div>`;
    }
  }

  function renderExcelSheet(tab, sheetName) {
    if (!tab || !tab.excelWorkbook) return;
    tab.currentSheetName = sheetName;
    const worksheet = tab.excelWorkbook.Sheets[sheetName];

    const htmlTable = window.XLSX.utils.sheet_to_html(worksheet, {
      id: 'excel-data-table',
      editable: false
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'excel-table-scroll-container';
    wrapper.innerHTML = htmlTable;

    contentContainer.innerHTML = '';
    contentContainer.appendChild(wrapper);
  }

  // ==================== TEXT & IMAGE ====================
  async function loadText(tab) {
    try {
      const text = await tab.file.text();
      const pre = document.createElement('pre');
      pre.className = 'reader-text-container';
      pre.textContent = text;
      contentContainer.innerHTML = '';
      contentContainer.appendChild(pre);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error">Failed to read text file: ${err.message}</div>`;
    }
  }

  function loadImage(tab) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'reader-image-preview';
      contentContainer.innerHTML = '';
      contentContainer.appendChild(img);
    };
    reader.readAsDataURL(tab.file);
  }

  // ==========================================
  // 8. THUMBNAILS SCRUBBER FILMSTRIP
  // ==========================================
  async function generateThumbnails(tab) {
    if (!scrubberStrip || !tab.pdfDoc) return;
    scrubberStrip.innerHTML = '';

    for (let p = 1; p <= tab.totalPages; p++) {
      const card = document.createElement('div');
      card.className = `scrubber-thumb-card ${p === tab.currentPage ? 'active' : ''}`;
      card.id = `thumb-page-${p}`;
      card.innerHTML = `
        <div class="thumb-canvas-wrap">
          <canvas id="thumb-canvas-${p}"></canvas>
        </div>
        <span class="thumb-page-label">${p}</span>
      `;
      card.onclick = () => {
        tab.currentPage = p;
        renderPdfPage(tab, p);
      };
      scrubberStrip.appendChild(card);
    }

    // Render thumbnail canvases cooperatively in the background
    for (let p = 1; p <= tab.totalPages; p++) {
      try {
        const page = await tab.pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 0.16 });
        const canvas = document.getElementById(`thumb-canvas-${p}`);
        if (canvas) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (p % 4 === 0) await new Promise(r => setTimeout(r, 0));
      } catch(e) {}
    }
  }

  function updateActiveScrubberThumbnail(pageNum) {
    document.querySelectorAll('.scrubber-thumb-card').forEach(c => c.classList.remove('active'));
    const activeThumb = document.getElementById(`thumb-page-${pageNum}`);
    if (activeThumb) {
      activeThumb.classList.add('active');
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  // ==========================================
  // 9. ZOOM & VIEWPORT CONTROLS
  // ==========================================
  function changeZoom(delta) {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab) return;

    tab.scale = Math.max(0.5, Math.min(3.0, tab.scale + delta));
    if (tab.type === 'pdf' && tab.pdfDoc) {
      renderPdfPage(tab, tab.currentPage);
    } else {
      contentContainer.style.transform = `scale(${tab.scale})`;
      contentContainer.style.transformOrigin = 'top center';
      updateZoomDisplay(tab.scale);
    }
  }

  function resetZoom() {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab) return;

    tab.scale = 1.0;
    if (tab.type === 'pdf' && tab.pdfDoc) {
      renderPdfPage(tab, tab.currentPage);
    } else {
      contentContainer.style.transform = 'scale(1)';
      updateZoomDisplay(tab.scale);
    }
  }

  function updateZoomDisplay(scale) {
    if (zoomLevelSpan) {
      zoomLevelSpan.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function rotateDocument() {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab) return;

    tab.rotation = (tab.rotation + 90) % 360;
    if (tab.type === 'pdf' && tab.pdfDoc) {
      renderPdfPage(tab, tab.currentPage);
    } else {
      contentContainer.style.transform = `rotate(${tab.rotation}deg)`;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      viewerWorkspace.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen();
    }
  }

  function printDocument() {
    window.print();
  }

  function downloadCurrentFile() {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab || !tab.file) return;

    if (typeof UIUtils !== 'undefined') {
      UIUtils.downloadBlob(tab.file, tab.name);
    } else {
      const url = URL.createObjectURL(tab.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = tab.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ==========================================
  // 10. EXPORT ANNOTATED PDF WITH DRAWING LAYERS
  // ==========================================
  async function downloadAnnotatedPdf() {
    const tab = ReaderTabsManager.getActiveTab();
    if (!tab || tab.type !== 'pdf' || !tab.file) {
      downloadCurrentFile();
      return;
    }

    if (typeof window.PDFLib === 'undefined') {
      if (typeof UIUtils !== 'undefined') UIUtils.showToast('PDF-Lib engine loading for annotation embedding...', 'info');
      downloadCurrentFile();
      return;
    }

    try {
      if (typeof UIUtils !== 'undefined') UIUtils.showToast('Embedding annotations into PDF bytes...', 'info');
      const arrayBuffer = await tab.file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      const allStrokes = await LocalDocReaderDB.getAllDocStrokes(tab.docFingerprint);
      const strokesByPage = new Map();
      allStrokes.forEach(item => {
        if (item.strokes && item.strokes.length > 0) {
          strokesByPage.set(item.pageNum, item.strokes);
        }
      });

      if (strokesByPage.size === 0) {
        if (typeof UIUtils !== 'undefined') UIUtils.showToast('No annotations found to embed. Downloading original file.', 'info');
        downloadCurrentFile();
        return;
      }

      for (const [pageNum, strokes] of strokesByPage.entries()) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        const page = pdfDoc.getPage(pageNum - 1);
        const { width, height } = page.getSize();

        // Render strokes to offscreen high-res canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(width * 2);
        offCanvas.height = Math.round(height * 2);
        const offCtx = offCanvas.getContext('2d');
        offCtx.scale(2, 2);

        strokes.forEach(stroke => {
          if (!stroke.points || stroke.points.length === 0) return;
          offCtx.save();
          offCtx.lineCap = 'round';
          offCtx.lineJoin = 'round';
          offCtx.lineWidth = stroke.width;

          if (stroke.tool === 'highlighter') {
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.strokeStyle = stroke.color;
            offCtx.globalAlpha = 0.45;
          } else {
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.strokeStyle = stroke.color;
            offCtx.globalAlpha = 1.0;
          }

          offCtx.beginPath();
          offCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            offCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          offCtx.stroke();
          offCtx.restore();
        });

        const pngDataUrl = offCanvas.toDataURL('image/png');
        const pngImage = await pdfDoc.embedPng(pngDataUrl);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });
      }

      const modifiedBytes = await pdfDoc.save();
      const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
      const annotatedName = tab.name.replace(/\.pdf$/i, '') + '-annotated.pdf';

      if (typeof UIUtils !== 'undefined') {
        UIUtils.downloadBlob(blob, annotatedName);
        UIUtils.showToast('Annotated PDF downloaded successfully!', 'success');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = annotatedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Annotation export error:', err);
      downloadCurrentFile();
    }
  }

  function closeAllViewer() {
    contentContainer.innerHTML = '';
    viewerWorkspace.style.display = 'none';
    emptyState.style.display = 'block';
    if (fileInput) fileInput.value = '';
    ReaderSpeechEngine.stop();
  }

  // Check incoming document from CamScanner or Unified DB
  function checkIncomingDocument() {
    try {
      const csDataUrl = sessionStorage.getItem('localdoc_reader_file');
      const csName = sessionStorage.getItem('localdoc_reader_name') || 'Scanned_Document.jpg';
      if (csDataUrl) {
        sessionStorage.removeItem('localdoc_reader_file');
        sessionStorage.removeItem('localdoc_reader_name');
        fetch(csDataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], csName, { type: blob.type || 'image/jpeg' });
            handleFile(file);
          });
        return;
      }

      const stored = sessionStorage.getItem('localdoc_view_doc') || sessionStorage.getItem('localdoc_view_document');
      if (stored) {
        sessionStorage.removeItem('localdoc_view_doc');
        sessionStorage.removeItem('localdoc_view_document');
        const docData = JSON.parse(stored);
        if (docData && docData.dataUrl) {
          fetch(docData.dataUrl)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], docData.name || docData.filename || 'Document.pdf', { type: docData.type || blob.type || 'application/pdf' });
              handleFile(file);
            });
        }
      }
    } catch(e) {}
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
