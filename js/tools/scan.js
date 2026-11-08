/**
 * localdoc.org — Ultra HD CamScanner Engine & A4 Document Studio (js/tools/scan.js)
 * 100% Client-side in-browser RAM execution:
 * - Mathematical 3x3 Projective Homography & Affine Triangular Mesh (Zero distortion on tilted/folded pages)
 * - Ultra-HD 300 DPI A4 Rendering (Up to 4K native camera resolution, zero downsample blur)
 * - Signature "Magic Pro / Magic Color" Local Adaptive Shadow Removal & Paper Whitening
 * - Robust Sub-Pixel Paper Boundary Detection on complex/dark/wooden backgrounds
 * - IndexedDB Unlimited Storage Engine for High-Res Scanned Documents & Multi-Page PDFs
 * - Real-Time Interactive Magnifying Loupe for Precision Corner Placement
 * - High-Resolution Camera Capture with Tap-to-Focus, Torch, and Multi-Camera Switching
 * - Synthesized Audio/Haptic Shutter Feedback (Web Audio API)
 * - Single & Batch Scan Multi-Page PDF Compilation via PDF-Lib
 */

// =========================================================================
// 1. IndexedDB Storage Engine (Eliminates localStorage 5MB Quota Limits)
// =========================================================================
class LocalDocScanDB {
  static DB_NAME = 'LocalDocScanStore';
  static DB_VERSION = 2;
  static STORE_NAME = 'scanned_documents';
  static PAGES_STORE = 'scanned_pages';

  static async openDB() {
    return new Promise((resolve) => {
      const idb = (typeof indexedDB !== 'undefined' ? indexedDB : (typeof window !== 'undefined' && window.indexedDB ? window.indexedDB : null));
      if (!idb) {
        return resolve(null); // Fallback to localStorage
      }
      const request = idb.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.PAGES_STORE)) {
          const pageStore = db.createObjectStore(this.PAGES_STORE, { keyPath: 'id' });
          pageStore.createIndex('docId', 'docId', { unique: false });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  static async getAll() {
    try {
      const db = await this.openDB();
      if (!db) return this.getLocalStorageFallback();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const docs = request.result || [];
          docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(docs);
        };
        request.onerror = () => resolve(this.getLocalStorageFallback());
      });
    } catch (e) {
      console.warn('DB getAll failed, falling back:', e);
      return this.getLocalStorageFallback();
    }
  }

  static async get(id) {
    try {
      const db = await this.openDB();
      if (!db) {
        const list = this.getLocalStorageFallback();
        return list.find(d => d.id === id) || null;
      }
      return new Promise((resolve) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  static async save(doc) {
    if (!doc.id) doc.id = 'scan_' + Date.now();
    doc.updatedAt = Date.now();
    if (!doc.createdAt) doc.createdAt = doc.updatedAt;

    try {
      const db = await this.openDB();
      if (!db) {
        this.saveLocalStorageFallback(doc);
        return doc;
      }

      return new Promise((resolve) => {
        let settled = false;
        const finalize = (useFallback = false) => {
          if (settled) return;
          settled = true;
          if (useFallback) this.saveLocalStorageFallback(doc);
          resolve(doc);
        };

        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        transaction.onabort = (e) => {
          console.warn('LocalDocScanDB save transaction aborted:', e);
          finalize(true);
        };
        transaction.onerror = (e) => {
          console.warn('LocalDocScanDB save transaction error:', e);
          finalize(true);
        };

        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(doc);
        request.onsuccess = () => finalize(false);
        request.onerror = (e) => {
          console.warn('LocalDocScanDB save request error:', e);
          finalize(true);
        };
      });
    } catch (e) {
      this.saveLocalStorageFallback(doc);
      return doc;
    }
  }

  static async delete(id) {
    try {
      const db = await this.openDB();
      if (!db) {
        this.deleteLocalStorageFallback(id);
        return true;
      }
      return new Promise((resolve) => {
        const storeNames = [this.STORE_NAME];
        if (db.objectStoreNames.contains(this.PAGES_STORE)) {
          storeNames.push(this.PAGES_STORE);
        }
        const transaction = db.transaction(storeNames, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.delete(id);

        if (db.objectStoreNames.contains(this.PAGES_STORE)) {
          const pageStore = transaction.objectStore(this.PAGES_STORE);
          const index = pageStore.index('docId');
          const req = index.getAllKeys(id);
          req.onsuccess = () => {
            const keys = req.result || [];
            keys.forEach(k => pageStore.delete(k));
          };
        }

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => {
          this.deleteLocalStorageFallback(id);
          resolve(true);
        };
      });
    } catch (e) {
      this.deleteLocalStorageFallback(id);
      return true;
    }
  }

  static async savePageBlob(pageId, docId, fullBlob, extra = {}) {
    try {
      const db = await this.openDB();
      if (!db || !db.objectStoreNames.contains(this.PAGES_STORE)) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([this.PAGES_STORE], 'readwrite');
        const store = tx.objectStore(this.PAGES_STORE);
        const record = {
          id: pageId,
          docId: docId,
          fullBlob: fullBlob,
          updatedAt: Date.now(),
          ...extra
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('savePageBlob failed:', e);
      return null;
    }
  }

  static async getPageBlob(pageId) {
    try {
      const db = await this.openDB();
      if (!db || !db.objectStoreNames.contains(this.PAGES_STORE)) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([this.PAGES_STORE], 'readonly');
        const store = tx.objectStore(this.PAGES_STORE);
        const req = store.get(pageId);
        req.onsuccess = () => {
          const rec = req.result;
          resolve(rec ? (rec.fullBlob || rec) : null);
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  static async deletePageBlobs(pageIds) {
    if (!Array.isArray(pageIds) || pageIds.length === 0) return true;
    try {
      const db = await this.openDB();
      if (!db || !db.objectStoreNames.contains(this.PAGES_STORE)) return true;

      return new Promise((resolve) => {
        const tx = db.transaction([this.PAGES_STORE], 'readwrite');
        const store = tx.objectStore(this.PAGES_STORE);
        pageIds.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  static async getPagesForDoc(docId) {
    try {
      const db = await this.openDB();
      if (!db || !db.objectStoreNames.contains(this.PAGES_STORE)) return [];

      return new Promise((resolve) => {
        const tx = db.transaction([this.PAGES_STORE], 'readonly');
        const store = tx.objectStore(this.PAGES_STORE);
        const index = store.index('docId');
        const req = index.getAll(docId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  static getLocalStorageFallback() {
    try {
      return JSON.parse(localStorage.getItem('localdoc_recent_scans') || '[]');
    } catch (e) {
      return [];
    }
  }

  static saveLocalStorageFallback(doc) {
    try {
      let list = this.getLocalStorageFallback();
      const lite = {
        id: doc.id,
        name: doc.name || doc.title,
        title: doc.title || doc.name,
        pageCount: doc.pageCount || (doc.pages  ?  doc.pages.length : 1),
        date: doc.date || new Date().toLocaleString(),
        updatedAt: doc.updatedAt,
        thumbnail: doc.thumbnail || (doc.pages && doc.pages[0]  ?  doc.pages[0].processedDataUrl : ''),
        dataUrl: doc.dataUrl || ''
      };
      list = [lite, ...list.filter(d => d.id !== doc.id)].slice(0, 15);
      localStorage.setItem('localdoc_recent_scans', JSON.stringify(list));
    } catch (e) {}
  }

  static deleteLocalStorageFallback(id) {
    try {
      let list = this.getLocalStorageFallback().filter(d => d.id !== id);
      localStorage.setItem('localdoc_recent_scans', JSON.stringify(list));
    } catch (e) {}
  }
}

// =========================================================================
// 2. Synthesized Audio & Haptic Feedback Engine
// =========================================================================
class ScanFeedback {
  static audioCtx = null;

  static initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  static playShutter() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Mechanical shutter click 1 (mirror lift)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.exponentialRampToValueAtTime(40, now + 0.04);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.045);

      // Mechanical shutter click 2 (curtain snap)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(800, now + 0.035);
      osc2.frequency.exponentialRampToValueAtTime(120, now + 0.09);
      gain2.gain.setValueAtTime(0.25, now + 0.035);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.035);
      osc2.stop(now + 0.095);
    } catch (e) {}

    // Haptic feedback
    try {
      if (window.AndroidNative && window.AndroidNative.hapticClick) {
        window.AndroidNative.hapticClick();
      } else if (navigator.vibrate) {
        navigator.vibrate([30, 40, 30]); // Dual-pulse mechanical shutter haptics
      }
    } catch (e) {}
  }

  static triggerHaptic(type = 'light') {
    try {
      if (typeof window !== 'undefined' && window.AndroidNative && window.AndroidNative.hapticClick) {
        window.AndroidNative.hapticClick();
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === 'light' ? 12 : 25);
      }
    } catch (_) {}
  }
}

// =========================================================================
// 3. Document Scanner Core Class
// =========================================================================
class DocumentScanner {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.imageCapture = null;
    this.currentFacingMode = 'environment';
  }

  // Canonical initialization alias for startCamera
  async initCamera(facingMode = 'environment') {
    return this.startCamera(facingMode);
  }

  // Start Camera Stream with progressive 4K / 1080p / 720p negotiation
  async startCamera(facingMode = 'environment') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access is not supported by your browser or requires HTTPS.');
    }
    if (this.stream) this.stopCamera();
    this.currentFacingMode = facingMode;

    const tierConstraints = [
      // Tier 1: 4K / UHD ideal
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 3840 },
          height: { ideal: 2160 }
        },
        audio: false
      },
      // Tier 2: 1080p Full HD ideal
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      },
      // Tier 3: 720p HD ideal
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      // Tier 4: Native sensor resolution with facing mode
      {
        video: {
          facingMode: { ideal: facingMode }
        },
        audio: false
      },
      // Tier 5: Fallback to any available video stream
      {
        video: true,
        audio: false
      }
    ];

    let stream = null;
    let lastError = null;

    for (const constraints of tierConstraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      throw lastError || new Error('Failed to acquire camera stream.');
    }

    this.stream = stream;

    if (this.video) {
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.srcObject = this.stream;
      try {
        await this.video.play();
      } catch (playErr) {
        console.warn('Video playback warning:', playErr);
      }

      // Ensure stream video dimensions are populated
      if (this.video.videoWidth === 0) {
        await new Promise((resolve) => {
          const onMeta = () => {
            this.video.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          this.video.addEventListener('loadedmetadata', onMeta, { once: true });
          setTimeout(resolve, 500); // 500ms timeout fallback
        });
      }
    }

    // Initialize ImageCapture API if supported for true hardware full-res shots
    try {
      const track = this.stream.getVideoTracks()[0];
      if (track && window.ImageCapture) {
        this.imageCapture = new ImageCapture(track);
      } else {
        this.imageCapture = null;
      }
    } catch (e) {
      this.imageCapture = null;
    }

    return true;
  }

  // Switch between back (environment) and front (user) cameras cleanly
  async switchFacingMode(targetFacing = null) {
    if (targetFacing) {
      this.currentFacingMode = targetFacing;
    } else {
      this.currentFacingMode = (this.currentFacingMode === 'environment') ? 'user' : 'environment';
    }
    return this.startCamera(this.currentFacingMode);
  }

  // Stop camera tracks and release hardware video decoders
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
      this.stream = null;
    }
    if (this.video) {
      try { this.video.srcObject = null; } catch (_) {}
    }
    this.imageCapture = null;
  }

  async toggleTorch(enabled) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return false;
    try {
      const caps = track.getCapabilities();
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !!enabled }] });
        return true;
      }
    } catch (e) {}
    return false;
  }

  async applyZoom(zoomVal) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return false;
    try {
      const caps = track.getCapabilities();
      if (caps.zoom) {
        await track.applyConstraints({ advanced: [{ zoom: parseFloat(zoomVal) }] });
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Ultra High-Resolution Snapshot Capture
  async captureHighResFrame() {
    ScanFeedback.playShutter();

    // 1. Hardware ImageCapture API for maximum sensor resolution (12MP - 48MP)
    if (this.imageCapture) {
      try {
        const photoBlob = await this.imageCapture.takePhoto();
        return await UIUtils.readFileAsDataURL(photoBlob);
      } catch (e) {
        console.warn('ImageCapture fallback to canvas draw:', e);
      }
    }

    // 2. Direct High-Resolution Video Frame Draw (Universal Fallback for Safari/Firefox/Chrome)
    if (this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      const width = this.video.videoWidth;
      const height = this.video.videoHeight;
      const targetCanvas = this.canvas || (typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null);
      if (targetCanvas) {
        targetCanvas.width = width;
        targetCanvas.height = height;

        const ctx = targetCanvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(this.video, 0, 0, width, height);
          return targetCanvas.toDataURL('image/jpeg', 0.96);
        }
      }
    }

    throw new Error('Camera video stream is not ready.');
  }

  // =========================================================================
  // 4. Robust 4-Corner Paper Detection for Tilted, Angled & Camera Pages
  // =========================================================================
  static getDefaultCorners() {
    const tl = { x: 0.008, y: 0.008 };
    const tr = { x: 0.992, y: 0.008 };
    const br = { x: 0.992, y: 0.992 };
    const bl = { x: 0.008, y: 0.992 };
    const corners = [tl, tr, br, bl];
    corners.topLeft = tl;
    corners.topRight = tr;
    corners.bottomRight = br;
    corners.bottomLeft = bl;
    return corners;
  }

  /**
   * Generates centered, normalized 4-corner bounding quad for standard paper & card presets
   * @param {'auto'|'a4'|'letter'|'id-card'|'full'} presetName
   * @param {number} imgW Natural width of the image
   * @param {number} imgH Natural height of the image
   */
  static getPresetCorners(presetName, imgW, imgH) {
    if (presetName === 'full') {
      return this.getDefaultCorners();
    }

    const w = imgW || 1000;
    const h = imgH || 1400;
    const imgRatio = w / h;

    // Target ratios (width / height in standard document orientation)
    let targetRatio = 1 / 1.4142; // standard portrait A4 (~0.707)
    if (presetName === 'letter') {
      targetRatio = 8.5 / 11; // US Letter (~0.7727)
    } else if (presetName === 'id-card') {
      // ISO/IEC 7810 ID-1 standard: 85.60 mm × 53.98 mm (ratio = 1.5858)
      targetRatio = imgRatio >= 1 ? 1.5858 : (1 / 1.5858);
    } else if (presetName === 'a4') {
      targetRatio = imgRatio >= 1 ? 1.4142 : (1 / 1.4142);
    }

    // Centered inside [0, 1] frame with 8% breathing room
    const margin = 0.08;
    const maxNormW = 1 - 2 * margin;
    const maxNormH = 1 - 2 * margin;

    // (normW * w) / (normH * h) = targetRatio  =>  normW / normH = targetRatio / imgRatio
    const relRatio = targetRatio / imgRatio;

    let normW, normH;
    if (relRatio <= maxNormW / maxNormH) {
      normH = maxNormH;
      normW = normH * relRatio;
    } else {
      normW = maxNormW;
      normH = normW / relRatio;
    }

    const startX = (1 - normW) / 2;
    const startY = (1 - normH) / 2;

    const tl = { x: Math.max(0.01, Math.round(startX * 1000) / 1000), y: Math.max(0.01, Math.round(startY * 1000) / 1000) };
    const tr = { x: Math.min(0.99, Math.round((startX + normW) * 1000) / 1000), y: Math.max(0.01, Math.round(startY * 1000) / 1000) };
    const br = { x: Math.min(0.99, Math.round((startX + normW) * 1000) / 1000), y: Math.min(0.99, Math.round((startY + normH) * 1000) / 1000) };
    const bl = { x: Math.max(0.01, Math.round(startX * 1000) / 1000), y: Math.min(0.99, Math.round((startY + normH) * 1000) / 1000) };

    const corners = [tl, tr, br, bl];
    corners.topLeft = tl;
    corners.topRight = tr;
    corners.bottomRight = br;
    corners.bottomLeft = bl;
    return corners;
  }

  /**
   * Universal Polymorphic Corner Normalizer (Features F6 & F7)
   * Safely accepts:
   * 1. Pure Array: [{x, y}, {x, y}, {x, y}, {x, y}]
   * 2. Pure Object: { topLeft: {x, y}, topRight: ..., bottomRight: ..., bottomLeft: ... }
   * 3. Hybrid Array with attached named properties
   * Always returns a dual-compatible Array [tl, tr, br, bl] with .topLeft, .topRight, .bottomRight, .bottomLeft
   * and guaranteed non-null, numeric { x, y } coordinates.
   */
  static normalizeCorners(corners, fallback = null) {
    const def = fallback || this.getDefaultCorners();
    if (!corners) return def;

    let rawTL, rawTR, rawBR, rawBL;

    if (Array.isArray(corners)) {
      if (corners.length >= 4) {
        rawTL = corners[0];
        rawTR = corners[1];
        rawBR = corners[2];
        rawBL = corners[3];
      } else {
        rawTL = corners.topLeft || (corners[0] || def[0]);
        rawTR = corners.topRight || (corners[1] || def[1]);
        rawBR = corners.bottomRight || (corners[2] || def[2]);
        rawBL = corners.bottomLeft || (corners[3] || def[3]);
      }
    } else if (typeof corners === 'object') {
      rawTL = corners.topLeft || corners.tl || def[0];
      rawTR = corners.topRight || corners.tr || def[1];
      rawBR = corners.bottomRight || corners.br || def[2];
      rawBL = corners.bottomLeft || corners.bl || def[3];
    } else {
      return def;
    }

    const clean = (pt, defaultPt) => ({
      x: (pt && typeof pt.x === 'number' && !isNaN(pt.x)) ? pt.x : defaultPt.x,
      y: (pt && typeof pt.y === 'number' && !isNaN(pt.y)) ? pt.y : defaultPt.y
    });

    const tl = clean(rawTL, def[0] || { x: 0.008, y: 0.008 });
    const tr = clean(rawTR, def[1] || { x: 0.992, y: 0.008 });
    const br = clean(rawBR, def[2] || { x: 0.992, y: 0.992 });
    const bl = clean(rawBL, def[3] || { x: 0.008, y: 0.992 });

    const result = [tl, tr, br, bl];
    result.topLeft = tl;
    result.topRight = tr;
    result.bottomRight = br;
    result.bottomLeft = bl;
    return result;
  }

  /**
   * Deep-clone corners preserving dual Array/Object property structure
   */
  static cloneCorners(corners) {
    return this.normalizeCorners(corners);
  }

  /**
   * Canonical 4-Corner Clockwise Sorting with Near-Square Tie-Breaking (Feature F6)
   * Guaranteed output order: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
   * @param {Array<{x: number, y: number}>|object} pts - Exactly 4 points
   * @returns {Array<{x: number, y: number}>} - 4 points canonically ordered clockwise with named properties
   */
  static orderCornersCanonical(pts) {
    if (!pts) return pts;
    let arr;
    if (Array.isArray(pts)) {
      arr = pts;
    } else if (pts.topLeft && pts.topRight && pts.bottomRight && pts.bottomLeft) {
      arr = [pts.topLeft, pts.topRight, pts.bottomRight, pts.bottomLeft];
    } else {
      return pts;
    }
    if (arr.length !== 4) return pts;

    // 1. Compute Centroid
    const cx = (arr[0].x + arr[1].x + arr[2].x + arr[3].x) / 4;
    const cy = (arr[0].y + arr[1].y + arr[2].y + arr[3].y) / 4;

    // 2. Polar angle sort around centroid
    const sorted = [...arr].sort((a, b) => {
      return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
    });

    // 3. Enforce strict clockwise winding via 2D cross product
    // In screen coordinates (y down), cross > 0 means clockwise (right turn)
    const cross = (sorted[1].x - sorted[0].x) * (sorted[2].y - sorted[1].y) -
                  (sorted[1].y - sorted[0].y) * (sorted[2].x - sorted[1].x);
    const cw = cross > 0 ? sorted : [sorted[0], sorted[3], sorted[2], sorted[1]];

    // 4. Anchor at Top-Left: TL = argmin(x + y) with deterministic tie-breaking
    let tlIdx = 0;
    let minSum = Infinity;
    for (let i = 0; i < 4; i++) {
      const s = cw[i].x + cw[i].y;
      if (s < minSum - 1e-4) {
        minSum = s;
        tlIdx = i;
      } else if (Math.abs(s - minSum) <= 1e-4) {
        // Tie-breaker: prefer smaller y (higher in frame), then smaller x
        if (cw[i].y < cw[tlIdx].y || (cw[i].y === cw[tlIdx].y && cw[i].x < cw[tlIdx].x)) {
          minSum = s;
          tlIdx = i;
        }
      }
    }

    const tl = cw[tlIdx];
    const tr = cw[(tlIdx + 1) % 4];
    const br = cw[(tlIdx + 2) % 4];
    const bl = cw[(tlIdx + 3) % 4];

    const result = [tl, tr, br, bl];
    result.topLeft = tl;
    result.topRight = tr;
    result.bottomRight = br;
    result.bottomLeft = bl;
    return result;
  }

  /**
   * Calculates Shoelace polygon area for a quadrilateral (Feature F7)
   * @param {Array<{x: number, y: number}>|object} quad - 4 vertices in cyclic order
   * @returns {number} - Absolute polygon area
   */
  static computeShoelaceArea(quad) {
    if (!quad) return 0;
    let pts;
    if (Array.isArray(quad)) {
      pts = quad;
    } else if (quad.topLeft && quad.topRight && quad.bottomRight && quad.bottomLeft) {
      pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
    } else {
      return 0;
    }
    if (pts.length !== 4) return 0;
    const area = 0.5 * Math.abs(
      pts[0].x * (pts[1].y - pts[3].y) +
      pts[1].x * (pts[2].y - pts[0].y) +
      pts[2].x * (pts[3].y - pts[1].y) +
      pts[3].x * (pts[0].y - pts[2].y)
    );
    return area;
  }

  /**
   * Comprehensive Geometric Validity Suite (Feature F7)
   * Validates strict convexity, Shoelace area ratio (0.04-0.98),
   * collinearity guard (30°-150° internal angles), and aspect ratio (0.18-5.5).
   * @param {Array<{x: number, y: number}>|object} quad - Candidate quadrilateral
   * @param {number} totalW - Reference frame width (1 if normalized)
   * @param {number} totalH - Reference frame height (1 if normalized)
   * @returns {{ valid: boolean, convex: boolean, areaRatio: number, minAngle: number, maxAngle: number, ratio: number }}
   */
  static validateQuadGeometry(quad, totalW = 1, totalH = 1) {
    if (!quad) {
      return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
    }
    let pts;
    if (Array.isArray(quad)) {
      pts = quad;
    } else if (quad.topLeft && quad.topRight && quad.bottomRight && quad.bottomLeft) {
      pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
    } else {
      return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
    }
    if (pts.length !== 4) {
      return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
    }

    // 1. Strict Convexity (all consecutive edge cross products share the same non-zero sign)
    function edgeCross(p0, p1, p2) {
      return (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    }
    const c0 = edgeCross(pts[0], pts[1], pts[2]);
    const c1 = edgeCross(pts[1], pts[2], pts[3]);
    const c2 = edgeCross(pts[2], pts[3], pts[0]);
    const c3 = edgeCross(pts[3], pts[0], pts[1]);

    const allPositive = c0 > 1e-7 && c1 > 1e-7 && c2 > 1e-7 && c3 > 1e-7;
    const allNegative = c0 < -1e-7 && c1 < -1e-7 && c2 < -1e-7 && c3 < -1e-7;
    const isConvex = allPositive || allNegative;
    if (!isConvex) {
      return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
    }

    // 2. Shoelace Area Validation: 0.04 <= areaRatio <= 0.98 per PROJECT.md § F7
    const area = DocumentScanner.computeShoelaceArea(pts);
    const totalArea = Math.max(1e-6, totalW * totalH);
    const areaRatio = area / totalArea;
    if (areaRatio < 0.04 || areaRatio > 0.98) {
      return { valid: false, convex: true, areaRatio: areaRatio, minAngle: 0, maxAngle: 0, ratio: 0 };
    }

    // 3. Collinearity Guard: 30° <= internal angle <= 150° for all 4 vertices
    let minAngle = 180;
    let maxAngle = 0;
    for (let i = 0; i < 4; i++) {
      const prev = pts[(i + 3) % 4];
      const curr = pts[i];
      const next = pts[(i + 1) % 4];

      const v1x = prev.x - curr.x;
      const v1y = prev.y - curr.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);
      if (len1 < 1e-6 || len2 < 1e-6) {
        return { valid: false, convex: true, areaRatio: areaRatio, minAngle: 0, maxAngle: 180, ratio: 0 };
      }

      const cosTheta = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const clampedCos = Math.max(-1, Math.min(1, cosTheta));
      const angleDeg = Math.acos(clampedCos) * (180 / Math.PI);

      if (angleDeg < minAngle) minAngle = angleDeg;
      if (angleDeg > maxAngle) maxAngle = angleDeg;

      if (angleDeg < 30 || angleDeg > 150) {
        return { valid: false, convex: true, areaRatio: areaRatio, minAngle: minAngle, maxAngle: maxAngle, ratio: 0 };
      }
    }

    // 4. Aspect Ratio Plausibility: 0.18 <= ratio <= 5.5
    const topW = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const botW = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
    const leftH = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    const rightH = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
    const avgW = (topW + botW) / 2;
    const avgH = (leftH + rightH) / 2;
    const ratio = avgW / Math.max(1e-6, avgH);
    if (ratio < 0.18 || ratio > 5.5) {
      return { valid: false, convex: true, areaRatio: areaRatio, minAngle: minAngle, maxAngle: maxAngle, ratio: ratio };
    }

    return {
      valid: true,
      convex: true,
      areaRatio: areaRatio,
      minAngle: Math.round(minAngle * 10) / 10,
      maxAngle: Math.round(maxAngle * 10) / 10,
      ratio: Math.round(ratio * 100) / 100
    };
  }

  static _scanWorker = null;
  static _scanWorkerFailed = false;

  static getScanWorker() {
    if (this._scanWorkerFailed) return null;
    if (typeof Worker === 'undefined') return null;
    if (!this._scanWorker) {
      try {
        let workerUrl = '../js/workers/scan-worker.js';
        if (typeof window !== 'undefined' && window.location) {
          const pathname = window.location.pathname || '';
          if (pathname.includes('/pages/')) {
            workerUrl = '../js/workers/scan-worker.js';
          } else {
            workerUrl = 'js/workers/scan-worker.js';
          }
        }
        this._scanWorker = new Worker(workerUrl);
        this._scanWorker.onerror = (err) => {
          console.warn('Scan worker runtime error, falling back to Sobel:', err);
          this._scanWorkerFailed = true;
          try { this._scanWorker.terminate(); } catch (_) {}
          this._scanWorker = null;
        };
      } catch (err) {
        console.warn('Worker constructor failed, falling back to Sobel:', err);
        this._scanWorkerFailed = true;
        this._scanWorker = null;
      }
    }
    return this._scanWorker;
  }

  static async detectDocumentEdges(sourceImgOrCanvas, targetAspect = 'a4') {
    const width = sourceImgOrCanvas.videoWidth || sourceImgOrCanvas.naturalWidth || sourceImgOrCanvas.width;
    const height = sourceImgOrCanvas.videoHeight || sourceImgOrCanvas.naturalHeight || sourceImgOrCanvas.height;
    if (!width || !height) {
      return this.getDefaultCorners();
    }

    const sampleW = 360;
    const sampleH = Math.max(200, Math.round((height / width) * sampleW));

    const helperCanvas = document.createElement('canvas');
    helperCanvas.width = sampleW;
    helperCanvas.height = sampleH;
    const ctx = helperCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceImgOrCanvas, 0, 0, sampleW, sampleH);

    const worker = this.getScanWorker();
    if (worker) {
      try {
        const workerPromise = new Promise((resolve) => {
          const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

          const onMessage = (e) => {
            const res = e.data || {};
            if (res.type === 'DETECT_DOCUMENT_CORNERS_RESULT' && res.id === reqId) {
              cleanup();
              if (res.success && res.found && res.corners) {
                resolve(this.orderCornersCanonical(res.corners));
              } else {
                resolve(null);
              }
            }
          };

          const onError = () => {
            cleanup();
            resolve(null);
          };

          const cleanup = () => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
          };

          worker.addEventListener('message', onMessage);
          worker.addEventListener('error', onError);

          const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
          const buffer = imgData.data.buffer.slice(0);
          worker.postMessage({
            type: 'DETECT_DOCUMENT_CORNERS',
            id: reqId,
            buffer: buffer,
            width: sampleW,
            height: sampleH,
            options: { highThreshold: 75, lowThreshold: 30 }
          }, [buffer]);
        });

        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 600));
        const workerCorners = await Promise.race([workerPromise, timeoutPromise]);

        if (workerCorners) {
          return this.orderCornersCanonical(workerCorners);
        }
      } catch (workerErr) {
        console.warn('Worker dispatch failed, using Sobel fallback:', workerErr);
      }
    }

    // Fallback: Pure JS Sobel Ray-Caster
    return this.detectDocumentEdgesSobel(sourceImgOrCanvas, targetAspect, helperCanvas, ctx);
  }

  static detectDocumentEdgesSobel(sourceImgOrCanvas, targetAspect = 'a4', helperCanvas = null, ctx = null) {
    const width = sourceImgOrCanvas.videoWidth || sourceImgOrCanvas.naturalWidth || sourceImgOrCanvas.width;
    const height = sourceImgOrCanvas.videoHeight || sourceImgOrCanvas.naturalHeight || sourceImgOrCanvas.height;
    if (!width || !height) {
      return this.getDefaultCorners();
    }

    // High quality sampling resolution (360px wide) for sharp edge & boundary extraction
    const sampleW = 360;
    const sampleH = Math.max(200, Math.round((height / width) * sampleW));

    if (!helperCanvas || !ctx) {
      helperCanvas = document.createElement('canvas');
      helperCanvas.width = sampleW;
      helperCanvas.height = sampleH;
      ctx = helperCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(sourceImgOrCanvas, 0, 0, sampleW, sampleH);
    }

    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;
    const totalPixels = sampleW * sampleH;

    // 1. Grayscale luminance
    const gray = new Uint8Array(totalPixels);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }

    // 2. 3x3 Gaussian smoothing to suppress fine text lines and paper grain
    const blurred = new Uint8Array(totalPixels);
    for (let y = 1; y < sampleH - 1; y++) {
      const yOff = y * sampleW;
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = yOff + x;
        blurred[idx] = (
          gray[idx - sampleW - 1] + 2 * gray[idx - sampleW] + gray[idx - sampleW + 1] +
          2 * gray[idx - 1]       + 4 * gray[idx]          + 2 * gray[idx + 1] +
          gray[idx + sampleW - 1] + 2 * gray[idx + sampleW] + gray[idx + sampleW + 1]
        ) >> 4;
      }
    }

    // 3. Sobel Edge Gradient Magnitude
    const grad = new Float32Array(totalPixels);
    let maxGrad = 0;
    for (let y = 1; y < sampleH - 1; y++) {
      const yOff = y * sampleW;
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = yOff + x;
        const gx = -blurred[idx - sampleW - 1] + blurred[idx - sampleW + 1]
                   - 2 * blurred[idx - 1]       + 2 * blurred[idx + 1]
                   - blurred[idx + sampleW - 1] + blurred[idx + sampleW + 1];
        const gy = -blurred[idx - sampleW - 1] - 2 * blurred[idx - sampleW] - blurred[idx - sampleW + 1]
                   + blurred[idx + sampleW - 1] + 2 * blurred[idx + sampleW] + blurred[idx + sampleW + 1];
        const mag = Math.hypot(gx, gy);
        grad[idx] = mag;
        if (mag > maxGrad) maxGrad = mag;
      }
    }

    // If gradient is too flat across entire frame, use clean 2% inset framing
    if (maxGrad < 28) {
      return this.getDefaultCorners();
    }

    // 4. Perimeter Ray Search inward from all 4 boundaries (sensitive threshold to catch outer paper boundary)
    const threshold = Math.max(10, Math.min(20, maxGrad * 0.10));
    const borderPoints = [];

    // Horizontal scans
    const stepY = Math.max(3, Math.round(sampleH / 50));
    for (let y = 6; y < sampleH - 6; y += stepY) {
      const yOff = y * sampleW;
      // Left to right
      for (let x = 3; x < sampleW * 0.75; x++) {
        if (grad[yOff + x] >= threshold) {
          borderPoints.push({ x: x / sampleW, y: y / sampleH });
          break;
        }
      }
      // Right to left
      for (let x = sampleW - 4; x > sampleW * 0.25; x--) {
        if (grad[yOff + x] >= threshold) {
          borderPoints.push({ x: x / sampleW, y: y / sampleH });
          break;
        }
      }
    }

    // Vertical scans
    const stepX = Math.max(3, Math.round(sampleW / 50));
    for (let x = 6; x < sampleW - 6; x += stepX) {
      // Top to bottom
      for (let y = 3; y < sampleH * 0.75; y++) {
        if (grad[y * sampleW + x] >= threshold) {
          borderPoints.push({ x: x / sampleW, y: y / sampleH });
          break;
        }
      }
      // Bottom to top
      for (let y = sampleH - 4; y > sampleH * 0.25; y--) {
        if (grad[y * sampleW + x] >= threshold) {
          borderPoints.push({ x: x / sampleW, y: y / sampleH });
          break;
        }
      }
    }

    if (borderPoints.length < 20) {
      return this.getDefaultCorners();
    }

    // 5. Cluster & Locate 4 Outermost Corner Points (never pull inward into text)
    borderPoints.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const rawTL = borderPoints[0];

    borderPoints.sort((a, b) => (b.x + b.y) - (a.x + a.y));
    const rawBR = borderPoints[0];

    borderPoints.sort((a, b) => (b.x - b.y) - (a.x - a.y));
    const rawTR = borderPoints[0];

    borderPoints.sort((a, b) => (a.x - a.y) - (b.x - b.y));
    const rawBL = borderPoints[0];

    // 6. Canonical Clockwise Ordering & Strict Geometric Validation Suite (Features F6 & F7)
    const canonicalQuad = DocumentScanner.orderCornersCanonical([rawTL, rawTR, rawBR, rawBL]);
    const geom = DocumentScanner.validateQuadGeometry(canonicalQuad, 1, 1);

    if (geom.valid) {
      const tl = canonicalQuad[0];
      const tr = canonicalQuad[1];
      const br = canonicalQuad[2];
      const bl = canonicalQuad[3];

      // Only fallback to full frame if the detected shape is completely touching the extreme outer 0.8% border on all sides
      const minEdgeDist = Math.min(tl.x, tl.y, 1 - tr.x, tr.y, 1 - br.x, 1 - br.y, bl.x, 1 - bl.y);
      if (geom.areaRatio >= 0.98 && minEdgeDist < 0.008) {
        return this.getDefaultCorners();
      }

      // Smooth Quad Corner Refinement:
      // Preserves true page corners with subtle 1.2% breathing room so ink at edge is protected
      const cx = (tl.x + tr.x + br.x + bl.x) / 4;
      const cy = (tl.y + tr.y + br.y + bl.y) / 4;

      function smoothCorner(p) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const padX = Math.sign(dx || 1) * Math.max(0.004, Math.abs(dx) * 0.012);
        const padY = Math.sign(dy || 1) * Math.max(0.004, Math.abs(dy) * 0.012);
        return {
          x: Math.max(0.008, Math.min(0.992, Math.round((p.x + padX) * 1000) / 1000)),
          y: Math.max(0.008, Math.min(0.992, Math.round((p.y + padY) * 1000) / 1000))
        };
      }

      const smoothTL = smoothCorner(tl);
      const smoothTR = smoothCorner(tr);
      const smoothBR = smoothCorner(br);
      const smoothBL = smoothCorner(bl);

      const result = [smoothTL, smoothTR, smoothBR, smoothBL];
      result.topLeft = smoothTL;
      result.topRight = smoothTR;
      result.bottomRight = smoothBR;
      result.bottomLeft = smoothBL;
      return result;
    }

    return this.getDefaultCorners();
  }


  // =========================================================================
  // Dual-Logic Document Classifier:
  // Strictly separates Standard A4 Documents from Small Slips / Fuel Bills / Tickets / Receipts
  // =========================================================================
  static classifyDocumentType(corners, imgW, imgH) {
    if (!corners || !imgW || !imgH) return 'a4';

    const c = this.normalizeCorners(corners);
    const tl = c[0];
    const tr = c[1];
    const br = c[2];
    const bl = c[3];

    const sTL = { x: tl.x * imgW, y: tl.y * imgH };
    const sTR = { x: tr.x * imgW, y: tr.y * imgH };
    const sBR = { x: br.x * imgW, y: br.y * imgH };
    const sBL = { x: bl.x * imgW, y: bl.y * imgH };

    const topW = Math.hypot(sTR.x - sTL.x, sTR.y - sTL.y);
    const bottomW = Math.hypot(sBR.x - sBL.x, sBR.y - sBL.y);
    const avgW = (topW + bottomW) / 2;

    const leftH = Math.hypot(sBL.x - sTL.x, sBL.y - sTL.y);
    const rightH = Math.hypot(sBR.x - sTR.x, sBR.y - sTR.y);
    const avgH = (leftH + rightH) / 2;

    if (avgH <= 0 || avgW <= 0) return 'a4';

    const naturalRatio = avgW / avgH; // width / height

    // Calculate relative quad area within total camera frame using normalized points
    const quadArea = 0.5 * Math.abs(
      (tl.x * (tr.y - bl.y)) +
      (tr.x * (br.y - tl.y)) +
      (br.x * (bl.y - tr.y)) +
      (bl.x * (tl.y - br.y))
    );

    // LOGIC 1: Standard A4 Document (close to A4 aspect ratio 0.62-0.82 portrait or 1.22-1.62 landscape AND area >= 0.30)
    const isCloseToA4Ratio = (naturalRatio >= 0.62 && naturalRatio <= 0.82) || (naturalRatio >= 1.22 && naturalRatio <= 1.62);

    if (isCloseToA4Ratio && quadArea >= 0.30) {
      return 'a4';
    }

    // LOGIC 2: Small Slip / Fuel Bill / Ticket / Card / Receipt
    return 'slip';
  }

  // =========================================================================
  // 5. True 4-Point Projective Homography (Zero Distortion on Tilted/Folded Pages)
  // Dual-Logic: Normalizes A4 documents to exact A4 aspect ratio, while preserving
  // natural proportions for small slips, receipts, and fuel tickets.
  // =========================================================================
  static warpDocument(sourceImg, corners, targetW = 0, targetH = 0, docType = null) {
    const origW = sourceImg.naturalWidth || sourceImg.videoWidth || sourceImg.width;
    const origH = sourceImg.naturalHeight || sourceImg.videoHeight || sourceImg.height;

    if (!origW || !origH) {
      const fallback = document.createElement('canvas');
      fallback.width = 100;
      fallback.height = 100;
      return fallback;
    }

    const c = this.normalizeCorners(corners);
    const tl = c[0];
    const tr = c[1];
    const br = c[2];
    const bl = c[3];

    // Calculate natural target width and height using Euclidean distances
    const sTL = { x: tl.x * origW, y: tl.y * origH };
    const sTR = { x: tr.x * origW, y: tr.y * origH };
    const sBR = { x: br.x * origW, y: br.y * origH };
    const sBL = { x: bl.x * origW, y: bl.y * origH };

    const topW = Math.hypot(sTR.x - sTL.x, sTR.y - sTL.y);
    const bottomW = Math.hypot(sBR.x - sBL.x, sBR.y - sBL.y);
    const maxW = Math.max(topW, bottomW);

    const leftH = Math.hypot(sBL.x - sTL.x, sBL.y - sTL.y);
    const rightH = Math.hypot(sBR.x - sTR.x, sBR.y - sTR.y);
    const maxH = Math.max(leftH, rightH);

    let destW = targetW || Math.round(maxW);
    let destH = targetH || Math.round(maxH);

    const effectiveType = docType || this.classifyDocumentType(c, origW, origH);

    // STRICT DUAL LOGIC (DO NOT MIX):
    // LOGIC 1: Standard A4 Document -> Square & scale to exact mathematical A4 aspect ratio (1 : 1.4142)
    // LOGIC 2: Small Slip / Fuel Bill / Ticket / Card / Receipt -> PRESERVE EXACT NATURAL PROPORTIONS! NEVER stretch to A4.
    if (!targetW && !targetH && maxH > 0 && maxW > 0) {
      if (effectiveType === 'a4') {
        const naturalRatio = maxW / maxH;
        if (naturalRatio >= 1.0) {
          // Standard Landscape A4
          destH = Math.max(600, Math.min(2480, Math.round(maxH)));
          destW = Math.round(destH * 1.41421356);
        } else {
          // Standard Portrait A4
          destW = Math.max(600, Math.min(2480, Math.round(maxW)));
          destH = Math.round(destW * 1.41421356);
        }
      } else {
        // Small slip / fuel receipt / ticket: keep natural un-stretched dimensions
        destW = Math.max(300, Math.min(2480, Math.round(maxW)));
        destH = Math.max(300, Math.min(3508, Math.round(maxH)));
      }
    }

    // Bounded resolution for optimal memory & 300 DPI clarity
    destW = Math.max(300, Math.min(2480, destW));
    destH = Math.max(300, Math.min(3508, destH));

    const canvas = document.createElement('canvas');
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // True 4-Point Projective Homography with WebGL
    const webglCanvas = this.renderProjectiveWebGL(sourceImg, tl, tr, br, bl, destW, destH);
    if (webglCanvas) {
      ctx.drawImage(webglCanvas, 0, 0);
      return canvas;
    }

    // Canvas 2D Homography Fallback (Exact mathematical perspective)
    this.renderProjectiveCanvas2D(sourceImg, tl, tr, br, bl, canvas, ctx);
    return canvas;
  }

  /**
   * Computes 8-DOF 3x3 Projective Homography Matrix mapping source quadrilateral
   * [TL, TR, BR, BL] to destination rectangle [(0,0), (W,0), (W,H), (0,H)].
   * Solves 8-variable linear system via Gaussian elimination with partial pivoting.
   *
   * @param {Array<{x: number, y: number}>|object} srcCorners - 4 source points [TL, TR, BR, BL] or {topLeft, ...}
   * @param {number} dstWidth - Destination rectified width (default 1)
   * @param {number} dstHeight - Destination rectified height (default 1)
   * @returns {Array<number>} - 9-element Array representing 3x3 homography matrix with .inv and named properties
   */
  static computeHomography(srcCorners, dstWidth = 1, dstHeight = 1) {
    let pts;
    let W = 1;
    let H = 1;

    if (arguments.length >= 4 && typeof arguments[0] === 'object' && typeof arguments[1] === 'object') {
      pts = [arguments[0], arguments[1], arguments[2], arguments[3]];
      if (typeof arguments[4] === 'number' && arguments[4] > 0) W = arguments[4];
      if (typeof arguments[5] === 'number' && arguments[5] > 0) H = arguments[5];
    } else if (Array.isArray(srcCorners)) {
      pts = srcCorners;
      if (typeof dstWidth === 'number' && dstWidth > 0) W = dstWidth;
      if (typeof dstHeight === 'number' && dstHeight > 0) H = dstHeight;
    } else if (srcCorners && (srcCorners.topLeft || srcCorners[0])) {
      const norm = this.normalizeCorners(srcCorners);
      pts = [norm[0], norm[1], norm[2], norm[3]];
      if (typeof dstWidth === 'number' && dstWidth > 0) W = dstWidth;
      if (typeof dstHeight === 'number' && dstHeight > 0) H = dstHeight;
    } else {
      pts = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}];
      if (typeof dstWidth === 'number' && dstWidth > 0) W = dstWidth;
      if (typeof dstHeight === 'number' && dstHeight > 0) H = dstHeight;
    }

    const dstPts = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H }
    ];

    const x0 = pts[0].x, y0 = pts[0].y;
    const x1 = pts[1].x, y1 = pts[1].y;
    const x2 = pts[2].x, y2 = pts[2].y;
    const x3 = pts[3].x, y3 = pts[3].y;

    const sx = x0 - x1 + x2 - x3;
    const sy = y0 - y1 + y2 - y3;

    let h;

    // Fast-path for affine parallelograms (guarantees exact g=0, h=0 per Test F9.2)
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
      h = [
        (x1 - x0) / W, (x3 - x0) / H, x0,
        (y1 - y0) / W, (y3 - y0) / H, y0,
        0, 0
      ];
    } else {
      // Build 8x8 system: A * h = b mapping destination rectangle [0, W]x[0, H] to source quad
      const A = [];
      const b = [];
      for (let k = 0; k < 4; k++) {
        const u = dstPts[k].x, v = dstPts[k].y;
        const xs = pts[k].x, ys = pts[k].y;
        A.push([u, v, 1, 0, 0, 0, -u * xs, -v * xs]);
        b.push(xs);
        A.push([0, 0, 0, u, v, 1, -u * ys, -v * ys]);
        b.push(ys);
      }

      // Gaussian Elimination with Partial Pivoting
      const n = 8;
      let singular = false;
      for (let p = 0; p < n; p++) {
        let maxVal = Math.abs(A[p][p]);
        let pivotRow = p;
        for (let r = p + 1; r < n; r++) {
          const val = Math.abs(A[r][p]);
          if (val > maxVal) {
            maxVal = val;
            pivotRow = r;
          }
        }

        if (maxVal < 1e-12) {
          singular = true;
          break;
        }

        if (pivotRow !== p) {
          const tmpA = A[p]; A[p] = A[pivotRow]; A[pivotRow] = tmpA;
          const tmpB = b[p]; b[p] = b[pivotRow]; b[pivotRow] = tmpB;
        }

        const pivot = A[p][p];
        for (let r = p + 1; r < n; r++) {
          const factor = A[r][p] / pivot;
          for (let c = p; c < n; c++) {
            A[r][c] -= factor * A[p][c];
          }
          b[r] -= factor * b[p];
        }
      }

      if (singular) {
        const ident = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        ident.a = 1; ident.b = 0; ident.c = 0;
        ident.d = 0; ident.e = 1; ident.f = 0;
        ident.g = 0; ident.h = 0; ident.i = 1;
        ident.inv = ident;
        ident.inverse = () => ident;
        ident.dstWidth = W;
        ident.dstHeight = H;
        ident.direction = 'dst_to_src';
        ident.srcNormalized = pts.every(p => p.x <= 1.05 && p.y <= 1.05);
        return ident;
      }

      // Back-substitution
      h = new Array(n);
      for (let r = n - 1; r >= 0; r--) {
        let sum = b[r];
        for (let c = r + 1; c < n; c++) {
          sum -= A[r][c] * h[c];
        }
        h[r] = sum / A[r][r];
      }

      // Explicit zero-thresholding for near-affine transformations
      if (Math.abs(h[6]) < 1e-11) h[6] = 0;
      if (Math.abs(h[7]) < 1e-11) h[7] = 0;
    }

    // 3x3 Projective Matrix H (dst -> src)
    const H_mat = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
    H_mat.a = h[0]; H_mat.b = h[1]; H_mat.c = h[2];
    H_mat.d = h[3]; H_mat.e = h[4]; H_mat.f = h[5];
    H_mat.g = h[6]; H_mat.h = h[7]; H_mat.i = 1.0;
    H_mat.dstWidth = W;
    H_mat.dstHeight = H;
    H_mat.srcNormalized = pts.every(p => p.x <= 1.05 && p.y <= 1.05);
    H_mat.direction = 'dst_to_src';

    // Analytic Inverse (src -> dst) via 3x3 Adjugate Matrix
    const det = h[0] * (h[4] * 1.0 - h[5] * h[7]) -
                h[1] * (h[3] * 1.0 - h[5] * h[6]) +
                h[2] * (h[3] * h[7] - h[4] * h[6]);

    if (Math.abs(det) > 1e-12) {
      const i0 = (h[4] * 1.0 - h[5] * h[7]) / det;
      const i1 = (h[2] * h[7] - h[1] * 1.0) / det;
      const i2 = (h[1] * h[5] - h[2] * h[4]) / det;
      const i3 = (h[5] * h[6] - h[3] * 1.0) / det;
      const i4 = (h[0] * 1.0 - h[2] * h[6]) / det;
      const i5 = (h[2] * h[3] - h[0] * h[5]) / det;
      const i6 = (h[3] * h[7] - h[4] * h[6]) / det;
      const i7 = (h[1] * h[6] - h[0] * h[7]) / det;
      const i8 = (h[0] * h[4] - h[1] * h[3]) / det;

      const norm = Math.abs(i8) > 1e-12 ? i8 : 1.0;
      let g_inv = i6 / norm;
      let h_inv = i7 / norm;
      if (Math.abs(g_inv) < 1e-11) g_inv = 0;
      if (Math.abs(h_inv) < 1e-11) h_inv = 0;

      const invMat = [i0/norm, i1/norm, i2/norm, i3/norm, i4/norm, i5/norm, g_inv, h_inv, 1.0];
      invMat.a = invMat[0]; invMat.b = invMat[1]; invMat.c = invMat[2];
      invMat.d = invMat[3]; invMat.e = invMat[4]; invMat.f = invMat[5];
      invMat.g = invMat[6]; invMat.h = invMat[7]; invMat.i = invMat[8];
      invMat.dstWidth = W;
      invMat.dstHeight = H;
      invMat.srcNormalized = H_mat.srcNormalized;
      invMat.direction = 'src_to_dst';
      invMat.inv = H_mat;
      invMat.inverse = () => H_mat;

      H_mat.inv = invMat;
      H_mat.inverse = () => invMat;
    } else {
      H_mat.inv = H_mat;
      H_mat.inverse = () => H_mat;
    }

    return H_mat;
  }

  // Hardware-Accelerated WebGL Projective Homography Renderer
  static renderProjectiveWebGL(sourceImg, tl, tr, br, bl, destW, destH) {
    try {
      const glCanvas = document.createElement('canvas');
      glCanvas.width = destW;
      glCanvas.height = destH;
      const gl = glCanvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
      if (!gl) return null;

      const vsSource = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision highp float;
        uniform sampler2D u_image;
        uniform mat3 u_H;
        uniform vec2 u_destSize;

        void main() {
          vec2 destUV = vec2(gl_FragCoord.x / u_destSize.x, 1.0 - (gl_FragCoord.y / u_destSize.y));
          vec3 p = u_H * vec3(destUV, 1.0);
          if (p.z == 0.0) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            return;
          }
          vec2 srcUV = p.xy / p.z;
          if (srcUV.x < 0.0 || srcUV.x > 1.0 || srcUV.y < 0.0 || srcUV.y > 1.0) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
          } else {
            gl_FragColor = texture2D(u_image, srcUV);
          }
        }
      `;

      function compileShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          gl.deleteShader(s);
          return null;
        }
        return s;
      }

      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return null;
      }

      gl.useProgram(program);

      // Unit quad covering entire viewport [-1, 1]
      const quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]), gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      // Texture
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImg);

      // Homography Matrix (Column-Major for WebGL mat3)
      // Mapping destUV [0, 1]^2 to srcUV [0, 1]^2
      const H = this.computeHomography([tl, tr, br, bl], 1, 1);
      const pullH = (H && H.direction === 'src_to_dst' && H.inv) ? H.inv : H;
      const uHLoc = gl.getUniformLocation(program, 'u_H');
      gl.uniformMatrix3fv(uHLoc, false, new Float32Array([
        pullH.a, pullH.d, pullH.g,
        pullH.b, pullH.e, pullH.h,
        pullH.c, pullH.f, pullH.i
      ]));

      const uDestLoc = gl.getUniformLocation(program, 'u_destSize');
      gl.uniform2f(uDestLoc, destW, destH);

      gl.viewport(0, 0, destW, destH);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Clean up GPU allocations immediately to prevent context leaks
      gl.deleteTexture(texture);
      gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      return glCanvas;
    } catch (e) {
      console.warn('WebGL homography exception:', e);
      return null;
    }
  }

  // High-Precision Canvas 2D Homography Fallback with True Bilinear Anti-Aliasing (Feature F9)
  static renderProjectiveCanvas2D(sourceCanvas, H_matrix, outWidth, outHeight, destCanvas = null, destCtx = null) {
    let sourceImg = sourceCanvas;
    let H = H_matrix;
    let destW = outWidth;
    let destH = outHeight;
    let canvas = destCanvas;
    let ctx = destCtx;

    // Polymorphic handling for legacy 7-arg call: (sourceImg, tl, tr, br, bl, canvas, ctx)
    if (arguments.length >= 6 && typeof arguments[5] === 'object' && (!arguments[1] || typeof arguments[1].length !== 'number')) {
      sourceImg = arguments[0];
      const tl = arguments[1], tr = arguments[2], br = arguments[3], bl = arguments[4];
      canvas = arguments[5];
      ctx = arguments[6] || (canvas ? canvas.getContext('2d') : null);
      destW = canvas ? canvas.width : 600;
      destH = canvas ? canvas.height : 800;
      H = this.computeHomography([tl, tr, br, bl], 1, 1);
    }

    if (!canvas) {
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = destW;
        canvas.height = destH;
        ctx = canvas.getContext('2d', { alpha: false });
      } else {
        return null;
      }
    }

    const origW = sourceImg.naturalWidth || sourceImg.videoWidth || sourceImg.width;
    const origH = sourceImg.naturalHeight || sourceImg.videoHeight || sourceImg.height;

    let srcBytes;
    if (sourceImg.getContext) {
      const sCtx = sourceImg.getContext('2d', { willReadFrequently: true });
      srcBytes = sCtx.getImageData(0, 0, origW, origH).data;
    } else {
      const offscreen = document.createElement('canvas');
      offscreen.width = origW;
      offscreen.height = origH;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(sourceImg, 0, 0);
      srcBytes = offCtx.getImageData(0, 0, origW, origH).data;
    }

    const dstData = ctx.createImageData(destW, destH);
    const dstBuf = new Uint32Array(dstData.data.buffer);

    // Use pull mapping (dest -> src)
    const pullH = (H && H.direction === 'src_to_dst' && H.inv) ? H.inv : H;
    const a = pullH.a, b = pullH.b, c = pullH.c;
    const d = pullH.d, e = pullH.e, f = pullH.f;
    const g = pullH.g, h = pullH.h;

    const maxSrcX = origW - 1;
    const maxSrcY = origH - 1;

    // Check if matrix maps normalized [0, 1] dest to normalized [0, 1] src
    const isNormalizedDst = !pullH.dstWidth || pullH.dstWidth <= 1;
    const isNormalizedSrc = pullH.srcNormalized !== false;
    const invDestW = isNormalizedDst ? (1.0 / destW) : 1.0;
    const invDestH = isNormalizedDst ? (1.0 / destH) : 1.0;

    for (let y = 0; y < destH; y++) {
      const v = isNormalizedDst ? ((y + 0.5) * invDestH) : (y + 0.5);
      const yOff = y * destW;

      const X0 = b * v + c;
      const Y0 = e * v + f;
      const W0 = h * v + 1.0;

      const dX = a * invDestW;
      const dY = d * invDestW;
      const dW = g * invDestW;

      let curX = X0;
      let curY = Y0;
      let curW = W0;

      for (let x = 0; x < destW; x++) {
        if (Math.abs(curW) < 1e-7) {
          dstBuf[yOff + x] = 0xFFFFFFFF;
          curX += dX; curY += dY; curW += dW;
          continue;
        }

        const invW = 1.0 / curW;
        const srcCoordX = curX * invW;
        const srcCoordY = curY * invW;

        if (isNormalizedSrc) {
          if (srcCoordX < 0 || srcCoordX > 1 || srcCoordY < 0 || srcCoordY > 1) {
            dstBuf[yOff + x] = 0xFFFFFFFF; // Pure white paper outside boundary
            curX += dX; curY += dY; curW += dW;
            continue;
          }
        } else {
          if (srcCoordX < 0 || srcCoordX > origW || srcCoordY < 0 || srcCoordY > origH) {
            dstBuf[yOff + x] = 0xFFFFFFFF;
            curX += dX; curY += dY; curW += dW;
            continue;
          }
        }

        // Continuous source pixel coordinates
        const xs = isNormalizedSrc
          ? Math.max(0, Math.min(maxSrcX - 0.0001, srcCoordX * maxSrcX))
          : Math.max(0, Math.min(maxSrcX - 0.0001, srcCoordX - 0.5));
        const ys = isNormalizedSrc
          ? Math.max(0, Math.min(maxSrcY - 0.0001, srcCoordY * maxSrcY))
          : Math.max(0, Math.min(maxSrcY - 0.0001, srcCoordY - 0.5));

        const x0 = xs | 0;
        const y0 = ys | 0;
        const x1 = Math.min(x0 + 1, maxSrcX);
        const y1 = Math.min(y0 + 1, maxSrcY);

        const dx = xs - x0;
        const dy = ys - y0;

        const w00 = (1.0 - dx) * (1.0 - dy);
        const w10 = dx * (1.0 - dy);
        const w01 = (1.0 - dx) * dy;
        const w11 = dx * dy;

        const i00 = (y0 * origW + x0) << 2;
        const i10 = (y0 * origW + x1) << 2;
        const i01 = (y1 * origW + x0) << 2;
        const i11 = (y1 * origW + x1) << 2;

        const r = (w00 * srcBytes[i00]     + w10 * srcBytes[i10]     + w01 * srcBytes[i01]     + w11 * srcBytes[i11]     + 0.5) | 0;
        const g_col = (w00 * srcBytes[i00 + 1] + w10 * srcBytes[i10 + 1] + w01 * srcBytes[i01 + 1] + w11 * srcBytes[i11 + 1] + 0.5) | 0;
        const b_col = (w00 * srcBytes[i00 + 2] + w10 * srcBytes[i10 + 2] + w01 * srcBytes[i01 + 2] + w11 * srcBytes[i11 + 2] + 0.5) | 0;

        dstBuf[yOff + x] = (0xFF << 24) | (b_col << 16) | (g_col << 8) | r;

        curX += dX; curY += dY; curW += dW;
      }
    }

    ctx.putImageData(dstData, 0, 0);
    return canvas;
  }

  // =========================================================================
  // 6. World-Class CamScanner Filters: Adaptive Shadow Removal & Laser-Sharp Ink
  // =========================================================================
  static processImage(imgElement, filter = 'natural', rotation = 0, corners = null, options = {}) {
    let sourceCanvas;
    const docType = options.docType || null;
    if (corners) {
      sourceCanvas = DocumentScanner.warpDocument(imgElement, corners, 0, 0, docType);
    } else {
      sourceCanvas = document.createElement('canvas');
      const w = imgElement.naturalWidth || imgElement.videoWidth || imgElement.width;
      const h = imgElement.naturalHeight || imgElement.videoHeight || imgElement.height;
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      const sCtx = sourceCanvas.getContext('2d');
      sCtx.drawImage(imgElement, 0, 0, w, h);
    }

    // Apply rotation if needed
    const isRotated90 = (rotation % 180 !== 0);
    const canvas = document.createElement('canvas');
    canvas.width = isRotated90 ? sourceCanvas.height : sourceCanvas.width;
    canvas.height = isRotated90 ? sourceCanvas.width : sourceCanvas.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    ctx.restore();

    if (filter === 'original') {
      return canvas.toDataURL('image/jpeg', 0.96);
    }

    const imgW = canvas.width;
    const imgH = canvas.height;
    const imgData = ctx.getImageData(0, 0, imgW, imgH);

    DocumentScanner.applyFilterDirect(imgData.data, imgW, imgH, filter, options);

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.96);
  }

  /**
   * Feature F10: Sauvola Dual-Integral Adaptive Thresholding for High-Contrast B&W Mode
   * Dual integral images (II_1 = sum Y, II_2 = sum Y^2) using Float64Array to prevent 32-bit overflow.
   * O(1) local mean m and standard deviation s calculation.
   * Dynamic threshold T = m * [1 + k * (s / 128 - 1)].
   * Eliminates shadow blotches on uneven lighting while keeping fine text strokes intact.
   *
   * @param {Uint8ClampedArray} data - RGBA pixel array to be modified in-place
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @param {Object} [options={}] - Tuning parameters: { sauvolaK, k, radius }
   */
  static applySauvolaAdaptiveBinarization(data, width, height, options = {}) {
    const totalPixels = width * height;
    const len = totalPixels * 4;

    // 1. Compute Rec. 601 Grayscale Luminance
    const lum = new Float32Array(totalPixels);
    for (let i = 0, j = 0; i < len; i += 4, j++) {
      lum[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    // 2. Build Dual Integral Images (Float64Array to prevent 32-bit overflow on large scans)
    const intW = width + 1;
    const intH = height + 1;
    const integral1 = new Float64Array(intW * intH);
    const integral2 = new Float64Array(intW * intH);

    for (let y = 0; y < height; y++) {
      let rowSum1 = 0;
      let rowSum2 = 0;
      const yOff = y * width;
      const intOff = (y + 1) * intW;
      const prevOff = y * intW;

      for (let x = 0; x < width; x++) {
        const p = lum[yOff + x];
        rowSum1 += p;
        rowSum2 += p * p;
        integral1[intOff + x + 1] = integral1[prevOff + x + 1] + rowSum1;
        integral2[intOff + x + 1] = integral2[prevOff + x + 1] + rowSum2;
      }
    }

    // 3. Parameters: Adaptive Window Radius R and Sensitivity k
    const radius = options.radius || Math.max(15, Math.min(35, Math.round(Math.min(width, height) / 30)));
    const k = typeof options.sauvolaK === 'number' ? options.sauvolaK : (options.k !== undefined ? options.k : 0.25);
    const R_s = 128.0;

    // 4. O(1) Per-Pixel Thresholding Loop
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      const rowTop = y0 * intW;
      const rowBot = (y1 + 1) * intW;
      const hSpan = y1 - y0 + 1;
      const yOff = y * width;

      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        const area = (x1 - x0 + 1) * hSpan;

        const colLeft = x0;
        const colRight = x1 + 1;

        // O(1) Box sum lookups
        const sum1 = integral1[rowBot + colRight] - integral1[rowTop + colRight] - integral1[rowBot + colLeft] + integral1[rowTop + colLeft];
        const sum2 = integral2[rowBot + colRight] - integral2[rowTop + colRight] - integral2[rowBot + colLeft] + integral2[rowTop + colLeft];

        const mean = sum1 / area;
        const variance = Math.max(0, (sum2 / area) - (mean * mean));
        const stdDev = Math.sqrt(variance);

        // Sauvola formula: T(x, y) = m(x, y) * [1 + k * (s(x, y) / 128 - 1)]
        const threshold = mean * (1.0 + k * (stdDev / R_s - 1.0));

        const pIdx = yOff + x;
        const pLum = lum[pIdx];

        // Guard against stroke hollowing on deep black solid blocks
        let val;
        if (mean < 40 && pLum < 40) {
          val = 0;
        } else {
          val = (pLum >= threshold && mean > 0) ? 255 : 0;
        }

        const idx = pIdx * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
    }
  }

  /**
   * Feature F11: Flat-Field Illumination Division & Magic Color Engine
   * Coarse-grid (32px) 95th-percentile surface estimation B(x,y) with smooth bilinear upsampling.
   * Flat-field division (Y/B) with Hermite paper-white ceiling (tau_white = 0.92 -> 255) and gamma 1.35 text deepening curve.
   * Asymmetric stroke sharpening with noise coring (theta_core = 3.0), halo dampening, and paper-white protection mask.
   * +18% chroma boost with cubic Hermite activation for stamps, seals, and signatures.
   * Pure paper-white guarantee.
   *
   * @param {Uint8ClampedArray} data - RGBA pixel buffer (modified in-place)
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {Object} [options={}] - Tuning options: { satBoost, sharpen, sharpenAmount, cellSize }
   */
  static applyMagicColor(data, width, height, options = {}) {
    const totalPixels = width * height;
    const len = totalPixels * 4;
    const cellSize = options.cellSize || Math.max(16, Math.min(64, Math.floor(Math.min(width, height) / 32)));
    const gridW = Math.ceil(width / cellSize);
    const gridH = Math.ceil(height / cellSize);
    const totalCells = gridW * gridH;

    // 1. Coarse-Grid 95th-Percentile Background Estimation (RGB Channels)
    const bgGridR = new Float32Array(totalCells);
    const bgGridG = new Float32Array(totalCells);
    const bgGridB = new Float32Array(totalCells);

    const sampleStride = Math.max(1, Math.floor(cellSize / 8));

    for (let gy = 0; gy < gridH; gy++) {
      const yStart = gy * cellSize;
      const yEnd = Math.min(height, (gy + 1) * cellSize);
      for (let gx = 0; gx < gridW; gx++) {
        const xStart = gx * cellSize;
        const xEnd = Math.min(width, (gx + 1) * cellSize);

        const samples = [];
        for (let y = yStart; y < yEnd; y += sampleStride) {
          const yOff = y * width;
          for (let x = xStart; x < xEnd; x += sampleStride) {
            const idx = (yOff + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            const lum = (r * 77 + g * 150 + b * 29) >> 8;
            samples.push({ lum, r, g, b });
          }
        }

        const cellIdx = gy * gridW + gx;
        if (samples.length === 0) {
          bgGridR[cellIdx] = 220;
          bgGridG[cellIdx] = 220;
          bgGridB[cellIdx] = 220;
          continue;
        }

        // 95th Percentile extraction
        samples.sort((a, b) => a.lum - b.lum);
        const p95Idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.95));
        const target = samples[p95Idx];
        bgGridR[cellIdx] = Math.max(35, target.r);
        bgGridG[cellIdx] = Math.max(35, target.g);
        bgGridB[cellIdx] = Math.max(35, target.b);
      }
    }

    // 2. 3x3 Smoothing Pass on Coarse Grid
    const smoothGridR = new Float32Array(totalCells);
    const smoothGridG = new Float32Array(totalCells);
    const smoothGridB = new Float32Array(totalCells);

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= gridH) continue;
          const rowOff = ny * gridW;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= gridW) continue;
            const w = (dx === 0 && dy === 0) ? 4 : ((dx === 0 || dy === 0) ? 2 : 1);
            const idx = rowOff + nx;
            sumR += bgGridR[idx] * w;
            sumG += bgGridG[idx] * w;
            sumB += bgGridB[idx] * w;
            sumW += w;
          }
        }
        const outIdx = gy * gridW + gx;
        smoothGridR[outIdx] = sumR / sumW;
        smoothGridG[outIdx] = sumG / sumW;
        smoothGridB[outIdx] = sumB / sumW;
      }
    }

    // 3. Flat-Field Illumination Division, Tone Curve & Chroma Boost
    const normLum = new Uint8Array(totalPixels);
    const satBoostFactor = options.satBoost !== undefined ? options.satBoost : 0.18; // +18% boost

    for (let y = 0; y < height; y++) {
      const gy = (y / cellSize) - 0.5;
      const gy0 = Math.max(0, Math.min(gridH - 1, Math.floor(gy)));
      const gy1 = Math.max(0, Math.min(gridH - 1, gy0 + 1));
      const fy = Math.max(0, Math.min(1, gy - gy0));

      const yOff = y * width;
      const gRow0 = gy0 * gridW;
      const gRow1 = gy1 * gridW;

      for (let x = 0; x < width; x++) {
        const gx = (x / cellSize) - 0.5;
        const gx0 = Math.max(0, Math.min(gridW - 1, Math.floor(gx)));
        const gx1 = Math.max(0, Math.min(gridW - 1, gx0 + 1));
        const fx = Math.max(0, Math.min(1, gx - gx0));

        // Bilinear interpolation of local background
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const bgR = smoothGridR[gRow0 + gx0] * w00 + smoothGridR[gRow0 + gx1] * w10 +
                    smoothGridR[gRow1 + gx0] * w01 + smoothGridR[gRow1 + gx1] * w11;
        const bgG = smoothGridG[gRow0 + gx0] * w00 + smoothGridG[gRow0 + gx1] * w10 +
                    smoothGridG[gRow1 + gx0] * w01 + smoothGridG[gRow1 + gx1] * w11;
        const bgB = smoothGridB[gRow0 + gx0] * w00 + smoothGridB[gRow0 + gx1] * w10 +
                    smoothGridB[gRow1 + gx0] * w01 + smoothGridB[gRow1 + gx1] * w11;

        const pIdx = yOff + x;
        const idx = pIdx * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        // Flat-field normalized channels
        const rNorm = Math.min(255, (r / Math.max(1, bgR)) * 255);
        const gNorm = Math.min(255, (g / Math.max(1, bgG)) * 255);
        const bNorm = Math.min(255, (b / Math.max(1, bgB)) * 255);

        const pLum = (rNorm * 77 + gNorm * 150 + bNorm * 29) >> 8;
        const ratio = pLum / 255;

        // CamScanner Tone Curve: smooth paper whitening to 255, ink deepening
        let targetLum;
        if (ratio >= 0.92) {
          const t = Math.min(1, (ratio - 0.92) / 0.08);
          targetLum = 246 + 9 * (3 * t * t - 2 * t * t * t);
        } else {
          const norm = ratio / 0.92;
          targetLum = Math.pow(norm, 1.35) * 246;
        }
        normLum[pIdx] = Math.min(255, Math.round(targetLum));

        // Continuous Chromaticity Activation
        const maxC = Math.max(rNorm, gNorm, bNorm);
        const minC = Math.min(rNorm, gNorm, bNorm);
        const chroma = maxC - minC;

        let wChroma = 0;
        if (chroma > 20) {
          wChroma = 1.0;
        } else if (chroma > 6) {
          const tc = (chroma - 6) / 14;
          wChroma = tc * tc * (3 - 2 * tc);
        }

        if (wChroma <= 0.01) {
          // Monochromatic ink or clean paper
          const v = normLum[pIdx];
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        } else {
          // Vibrant color element (stamps, signatures, seals)
          const boost = 1.0 + satBoostFactor * wChroma;
          const curLum = normLum[pIdx];
          const nr = curLum + (rNorm - curLum) * boost;
          const ng = curLum + (gNorm - curLum) * boost;
          const nb = curLum + (bNorm - curLum) * boost;
          data[idx] = Math.min(255, Math.max(0, Math.round(nr)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round(ng)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round(nb)));
        }
      }
    }

    // 4. Integrated Asymmetric Stroke Sharpening (Deadband Noise Coring)
    const sharpenAmount = options.sharpen !== undefined ? (typeof options.sharpen === 'number' ? options.sharpen : (options.sharpenAmount || 0.70)) : 0.70;
    if (sharpenAmount > 0.05) {
      const tempBlur = new Uint8Array(totalPixels);
      // Horizontal Gaussian pass
      for (let y = 0; y < height; y++) {
        const yOff = y * width;
        for (let x = 2; x < width - 2; x++) {
          const p = yOff + x;
          tempBlur[p] = (normLum[p - 2] + 4 * normLum[p - 1] + 6 * normLum[p] + 4 * normLum[p + 1] + normLum[p + 2]) >> 4;
        }
      }
      // Vertical Gaussian pass & Asymmetric Coring
      const alphaDark = sharpenAmount;
      const alphaLight = sharpenAmount * 0.15;
      const thetaCore = 3.0;

      for (let y = 2; y < height - 2; y++) {
        const yOff = y * width;
        const yU2 = (y - 2) * width, yU1 = (y - 1) * width, yD1 = (y + 1) * width, yD2 = (y + 2) * width;
        for (let x = 2; x < width - 2; x++) {
          const p = yOff + x;
          const blurLum = (tempBlur[yU2 + x] + 4 * tempBlur[yU1 + x] + 6 * tempBlur[p] + 4 * tempBlur[yD1 + x] + tempBlur[yD2 + x]) >> 4;
          const curLum = normLum[p];
          const diff = curLum - blurLum;

          if (Math.abs(diff) <= thetaCore) continue; // Noise deadband: skip flat paper

          const diffCored = diff > 0 ? (diff - thetaCore) : (diff + thetaCore);
          let alphaEff;
          if (diffCored < 0) {
            alphaEff = alphaDark; // Dark text stroke deepening
          } else {
            alphaEff = alphaLight * Math.max(0, (255 - curLum) / 10); // Dampen halos near white
          }

          const sharpLum = Math.min(255, Math.max(0, curLum + alphaEff * diffCored));
          const gain = sharpLum / Math.max(1, curLum);
          const idx = p * 4;

          data[idx] = Math.min(255, Math.max(0, Math.round(data[idx] * gain)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round(data[idx + 1] * gain)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round(data[idx + 2] * gain)));
        }
      }
    }

    // 5. Paper-White Guarantee: Spotless pure white for clean background
    for (let i = 0; i < len; i += 4) {
      const l = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      if (l >= 253) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
  }

  /**
   * Feature F12: High-Performance Rec. 601 Grayscale with Dynamic Range Percentile Contrast Stretch
   * Fixed-point integer luminance (77R + 150G + 29B) >> 8.
   * 256-bin histogram and CDF calculation.
   * Outlier-rejection percentile clipping (1% - 99%) with low-contrast guardrails.
   * Precomputed 256-entry Uint8Array LUT with Hermite paper shoulder and ink toe.
   *
   * @param {Uint8ClampedArray} data - RGBA pixel array to be modified in-place
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   */
  static applyGrayscaleContrastStretch(data, width, height) {
    const totalPixels = width * height;
    const len = totalPixels * 4;

    // 1. Compute 256-bin histogram via integer Rec. 601
    const hist = new Int32Array(256);
    for (let i = 0; i < len; i += 4) {
      const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      hist[y]++;
    }

    // 2. Compute Cumulative Distribution Function (CDF)
    const cdf = new Int32Array(256);
    let cum = 0;
    for (let k = 0; k < 256; k++) {
      cum += hist[k];
      cdf[k] = cum;
    }

    // 3. Percentile clipping (1% lower bound, 99% upper bound)
    const tLow = Math.floor(totalPixels * 0.01);
    const tHigh = Math.floor(totalPixels * 0.99);

    let pMin = 0;
    while (pMin < 255 && cdf[pMin] < tLow) pMin++;

    let pMax = 255;
    while (pMax > 0 && cdf[pMax] > tHigh) pMax--;

    // Guardrails for low dynamic range scenes
    if (pMax - pMin < 15) {
      pMin = Math.max(0, pMin - 20);
      pMax = Math.min(255, pMax + 20);
    }
    if (pMax <= pMin) pMax = pMin + 1;

    // 4. Precompute 256-entry Look-Up Table (LUT) with Hermite paper shoulder & ink toe
    const lut = new Uint8Array(256);
    const invRange = 1.0 / (pMax - pMin);

    for (let y = 0; y < 256; y++) {
      if (y <= pMin) {
        lut[y] = 0;
      } else if (y >= pMax) {
        lut[y] = 255;
      } else {
        const u = (y - pMin) * invRange;
        let v;
        if (u > 0.82) {
          // Smooth Hermite shoulder to pure paper white 255
          const t = (u - 0.82) / 0.18;
          v = 0.82 + 0.18 * (t * t * (3 - 2 * t));
        } else if (u < 0.16) {
          // Ink toe anchoring to deep black
          const t = u / 0.16;
          v = 0.16 * Math.pow(t, 1.3);
        } else {
          // Linear midtones for diagrams and pencil marks
          v = u;
        }
        lut[y] = Math.min(255, Math.max(0, Math.round(v * 255)));
      }
    }

    // 5. In-place pixel mapping
    for (let i = 0; i < len; i += 4) {
      const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      const val = lut[y];
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  /**
   * Faithful Natural Document Enhancement
   * Equalizes illumination shadows uniformly across R, G, B channels while strictly preserving
   * authentic color saturation, hues, and paper tint.
   */
  static applyNaturalDocumentFilter(data, width, height) {
    const totalPixels = width * height;
    const len = totalPixels * 4;
    const imgW = width;
    const imgH = height;

    const lum = new Float32Array(totalPixels);
    let paperChromaSum = 0;
    let paperPixelCount = 0;
    const sampleStep = Math.max(1, Math.floor(totalPixels / 20000));

    for (let i = 0, j = 0; i < len; i += 4, j++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      lum[j] = l;
      if (j % sampleStep === 0 && l > 120) {
        const c = Math.max(r, g, b) - Math.min(r, g, b);
        paperChromaSum += c;
        paperPixelCount++;
      }
    }

    const avgPaperChroma = paperPixelCount > 0 ? (paperChromaSum / paperPixelCount) : 0;
    const docIsColored = (avgPaperChroma >= 7.5);

    const intW = imgW + 1;
    const integral = new Float64Array(intW * (imgH + 1));
    for (let y = 0; y < imgH; y++) {
      let rowSum = 0;
      const yOff = y * imgW;
      const intOff = (y + 1) * intW;
      const prevOff = y * intW;
      for (let x = 0; x < imgW; x++) {
        rowSum += lum[yOff + x];
        integral[intOff + x + 1] = integral[prevOff + x + 1] + rowSum;
      }
    }

    const radiusLarge = Math.max(28, Math.round(Math.min(imgW, imgH) / 10));
    const radiusSmall = Math.max(12, Math.round(Math.min(imgW, imgH) / 24));

    const bgSamples = [];
    const sampleGridX = Math.max(8, Math.round(imgW / 20));
    const sampleGridY = Math.max(8, Math.round(imgH / 20));
    for (let sy = Math.floor(sampleGridY / 2); sy < imgH; sy += sampleGridY) {
      const y0L = Math.max(0, sy - radiusLarge);
      const y1L = Math.min(imgH - 1, sy + radiusLarge);
      const intRow1L = (y1L + 1) * intW;
      const intRow0L = y0L * intW;
      const hSpanL = y1L - y0L + 1;
      for (let sx = Math.floor(sampleGridX / 2); sx < imgW; sx += sampleGridX) {
        const x0L = Math.max(0, sx - radiusLarge);
        const x1L = Math.min(imgW - 1, sx + radiusLarge);
        const areaL = (x1L - x0L + 1) * hSpanL;
        const sumL = integral[intRow1L + (x1L + 1)] - integral[intRow0L + (x1L + 1)] - integral[intRow1L + x0L] + integral[intRow0L + x0L];
        bgSamples.push(sumL / areaL);
      }
    }
    bgSamples.sort((a, b) => a - b);
    const p90Idx = Math.min(bgSamples.length - 1, Math.floor(bgSamples.length * 0.90));
    const maxBg = Math.max(160, bgSamples[p90Idx] || 220);

    for (let y = 0; y < imgH; y++) {
      const y0L = Math.max(0, y - radiusLarge);
      const y1L = Math.min(imgH - 1, y + radiusLarge);
      const intRow1L = (y1L + 1) * intW;
      const intRow0L = y0L * intW;
      const hSpanL = y1L - y0L + 1;

      const y0S = Math.max(0, y - radiusSmall);
      const y1S = Math.min(imgH - 1, y + radiusSmall);
      const intRow1S = (y1S + 1) * intW;
      const intRow0S = y0S * intW;
      const hSpanS = y1S - y0S + 1;

      for (let x = 0; x < imgW; x++) {
        const x0L = Math.max(0, x - radiusLarge);
        const x1L = Math.min(imgW - 1, x + radiusLarge);
        const areaL = (x1L - x0L + 1) * hSpanL;
        const sumL = integral[intRow1L + (x1L + 1)] - integral[intRow0L + (x1L + 1)] - integral[intRow1L + x0L] + integral[intRow0L + x0L];
        const bgLarge = sumL / areaL;

        const x0S = Math.max(0, x - radiusSmall);
        const x1S = Math.min(imgW - 1, x + radiusSmall);
        const areaS = (x1S - x0S + 1) * hSpanS;
        const sumS = integral[intRow1S + (x1S + 1)] - integral[intRow0S + (x1S + 1)] - integral[intRow1S + x0S] + integral[intRow0S + x0S];
        const bgSmall = sumS / areaS;

        const localBg = Math.max(35, 0.65 * bgLarge + 0.35 * bgSmall);

        const pIdx = y * imgW + x;
        const pLum = lum[pIdx];
        const idx = pIdx * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;

        const shadowDeficit = maxBg / localBg;
        const lift = Math.pow(Math.max(1.0, Math.min(1.26, shadowDeficit)), 0.65);

        let nr = r * lift;
        let ng = g * lift;
        let nb = b * lift;

        if (!docIsColored && chroma <= 8 && pLum >= 0.88 * localBg) {
          const ratio = pLum / localBg;
          const t = Math.min(1.0, Math.max(0.0, (ratio - 0.88) / 0.12));
          const smoothT = t * t * (3 - 2 * t);
          const targetW = 246 + 9 * smoothT;
          const curVal = (nr + ng + nb) / 3;
          const finalVal = curVal + (targetW - curVal) * smoothT;
          data[idx] = Math.min(255, Math.round(finalVal));
          data[idx + 1] = Math.min(255, Math.round(finalVal));
          data[idx + 2] = Math.min(255, Math.round(finalVal));
          continue;
        }

        if (pLum < 125) {
          const darkRatio = pLum / 125;
          const inkFactor = Math.pow(Math.max(0.05, darkRatio), 0.12);
          nr *= inkFactor;
          ng *= inkFactor;
          nb *= inkFactor;
        }

        data[idx] = Math.min(255, Math.max(0, Math.round(nr)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(ng)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(nb)));
      }
    }
  }

  /**
   * Dispatches the Base Tone Filter mode directly onto an RGBA buffer in-place
   */
  static applyBaseToneFilter(data, width, height, filterName = 'natural', options = {}) {
    const len = width * height * 4;

    switch (filterName) {
      case 'magic-color': {
        DocumentScanner.applyMagicColor(data, width, height, options);
        break;
      }

      case 'clean-bw':
      case 'bw': {
        DocumentScanner.applySauvolaAdaptiveBinarization(data, width, height, options);
        break;
      }

      case 'grayscale': {
        DocumentScanner.applyGrayscaleContrastStretch(data, width, height);
        break;
      }

      case 'natural': {
        DocumentScanner.applyNaturalDocumentFilter(data, width, height);
        break;
      }

      case 'no-shadow': {
        for (let i = 0; i < len; i += 4) {
          data[i] = Math.min(255, Math.pow(data[i] / 255, 0.75) * 255 + 8);
          data[i + 1] = Math.min(255, Math.pow(data[i + 1] / 255, 0.75) * 255 + 8);
          data[i + 2] = Math.min(255, Math.pow(data[i + 2] / 255, 0.75) * 255 + 8);
        }
        break;
      }

      case 'lighten': {
        for (let i = 0; i < len; i += 4) {
          data[i] = Math.min(255, data[i] * 1.25 + 15);
          data[i + 1] = Math.min(255, data[i + 1] * 1.25 + 15);
          data[i + 2] = Math.min(255, data[i + 2] * 1.25 + 15);
        }
        break;
      }

      case 'original':
      default:
        break;
    }
  }

  /**
   * Executes the full document enhancement pipeline (Base Tone + Stackable CLAHE, De-Moiré, Sharpen, Contrast)
   */
  static applyFilterDirect(data, width, height, filterName = 'natural', options = {}) {
    // 1. Base Tone Preset
    DocumentScanner.applyBaseToneFilter(data, width, height, filterName, options);

    // 2. Strict Pipeline Step: CLAHE Equalization
    if (options.clahe) {
      const clip = typeof options.clahe === 'number' ? options.clahe : (options.claheClipLimit || 2.0);
      DocumentScanner.applyCLAHE(data, width, height, clip);
    }

    // 3. Strict Pipeline Step: De-Moiré Filter
    if (options.demoir) {
      const strength = typeof options.demoir === 'number' ? options.demoir : (options.demoirStrength !== undefined ? options.demoirStrength : (options.demoireStrength !== undefined ? options.demoireStrength : 1.0));
      DocumentScanner.applyDeMoire(data, width, height, strength);
    }

    // 4. Strict Pipeline Step: Unsharp Mask Text Sharpening
    if (options.sharpen) {
      const amount = typeof options.sharpen === 'number' ? options.sharpen : (options.sharpenAmount || 0.65);
      DocumentScanner.applyUnsharpMask(data, width, height, amount);
    }

    // 5. Brightness and Contrast adjustments
    const brightnessAdjust = options.brightness || 0;
    const contrastAdjust = options.contrast || 0;
    if (brightnessAdjust !== 0 || contrastAdjust !== 0) {
      const len = width * height * 4;
      const factor = (259 * (contrastAdjust + 255)) / (255 * (259 - contrastAdjust));
      for (let i = 0; i < len; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128 + brightnessAdjust));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightnessAdjust));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightnessAdjust));
      }
    }
  }

  /**
   * Fast In-Memory Filter Runner on Canvas (Direct Preview, Sub-40ms)
   * Feature F13
   */
  static renderFilteredCanvas(baseCanvas, filterKey = 'natural', options = {}, targetCanvas = null) {
    const canvas = targetCanvas || document.createElement('canvas');
    if (canvas.width !== baseCanvas.width || canvas.height !== baseCanvas.height) {
      canvas.width = baseCanvas.width;
      canvas.height = baseCanvas.height;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(baseCanvas, 0, 0);

    if (filterKey === 'original') {
      return canvas;
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    DocumentScanner.applyFilterDirect(imgData.data, canvas.width, canvas.height, filterKey, options);
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Apply enhancement filter to a canvas and return a Promise resolving to a new Canvas
   * Satisfies PROJECT.md line 73: DocumentScanner.applyFilter(sourceCanvas, filterName, options)
   */
  static async applyFilter(sourceCanvas, filterName = 'natural', options = {}) {
    return DocumentScanner.renderFilteredCanvas(sourceCanvas, filterName, options);
  }

  /**
   * Helper to process image with crop, rotation, and filter in one step
   */
  static processImage(sourceImg, filterName = 'natural', rotation = 0, corners = null, options = {}) {
    if (!sourceImg) return '';
    let canvas;
    if (corners) {
      canvas = this.warpDocument(sourceImg, corners, 0, 0, options.docType);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = sourceImg.naturalWidth || sourceImg.videoWidth || sourceImg.width || 100;
      canvas.height = sourceImg.naturalHeight || sourceImg.videoHeight || sourceImg.height || 100;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(sourceImg, 0, 0);
    }

    if (rotation) {
      const rotCanvas = document.createElement('canvas');
      const isRotated90 = (rotation % 180 !== 0);
      rotCanvas.width = isRotated90 ? canvas.height : canvas.width;
      rotCanvas.height = isRotated90 ? canvas.width : canvas.height;
      const rCtx = rotCanvas.getContext('2d');
      rCtx.save();
      rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rCtx.rotate((rotation * Math.PI) / 180);
      rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      rCtx.restore();
      canvas = rotCanvas;
    }

    const filtered = this.renderFilteredCanvas(canvas, filterName, options);
    return filtered.toDataURL('image/jpeg', 0.95);
  }

  // =========================================================================
  // Contrast Limited Adaptive Histogram Equalization (CLAHE)
  // Partitions image into an 8x8 grid of contextual tiles, calculates clipped
  // histograms and maps each pixel via bilinear interpolation across tile CDFs.
  // =========================================================================
  static applyCLAHE(data, width, height, clipLimit = 2.0) {
    const numTilesX = 8;
    const numTilesY = 8;
    const tileW = width / numTilesX;
    const tileH = height / numTilesY;

    // 1. Compute Histograms and Clipped CDFs per tile
    const cdfs = new Array(numTilesX * numTilesY);

    for (let ty = 0; ty < numTilesY; ty++) {
      const yStart = Math.floor(ty * tileH);
      const yEnd = Math.floor((ty + 1) * tileH);
      for (let tx = 0; tx < numTilesX; tx++) {
        const xStart = Math.floor(tx * tileW);
        const xEnd = Math.floor((tx + 1) * tileW);
        const numPixels = (xEnd - xStart) * (yEnd - yStart);
        if (numPixels === 0) continue;

        const hist = new Int32Array(256);
        for (let y = yStart; y < yEnd; y++) {
          const yOff = y * width;
          for (let x = xStart; x < xEnd; x++) {
            const idx = (yOff + x) * 4;
            const lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
            hist[lum]++;
          }
        }

        // Clip histogram peaks above threshold and redistribute excess
        const clipThreshold = Math.max(1, Math.round(clipLimit * (numPixels / 256)));
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > clipThreshold) {
            excess += (hist[i] - clipThreshold);
            hist[i] = clipThreshold;
          }
        }

        const bonus = (excess / 256) | 0;
        const rem = excess % 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += bonus + (i < rem ? 1 : 0);
        }

        // Cumulative Distribution Function (CDF)
        const cdf = new Uint8Array(256);
        let sum = 0;
        const scale = 255 / numPixels;
        for (let i = 0; i < 256; i++) {
          sum += hist[i];
          cdf[i] = Math.min(255, Math.round(sum * scale));
        }

        cdfs[ty * numTilesX + tx] = cdf;
      }
    }

    // 2. Bilinear Interpolation across tiles
    for (let y = 0; y < height; y++) {
      const gy = (y / tileH) - 0.5;
      const ty1 = Math.max(0, Math.min(numTilesY - 1, Math.floor(gy)));
      const ty2 = Math.max(0, Math.min(numTilesY - 1, ty1 + 1));
      const fy = Math.max(0, Math.min(1, gy - ty1));

      const yOff = y * width;
      const cdfRow1 = ty1 * numTilesX;
      const cdfRow2 = ty2 * numTilesX;

      for (let x = 0; x < width; x++) {
        const gx = (x / tileW) - 0.5;
        const tx1 = Math.max(0, Math.min(numTilesX - 1, Math.floor(gx)));
        const tx2 = Math.max(0, Math.min(numTilesX - 1, tx1 + 1));
        const fx = Math.max(0, Math.min(1, gx - tx1));

        const idx = (yOff + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const lum = (r * 77 + g * 150 + b * 29) >> 8;

        const c00 = cdfs[cdfRow1 + tx1][lum];
        const c10 = cdfs[cdfRow1 + tx2][lum];
        const c01 = cdfs[cdfRow2 + tx1][lum];
        const c11 = cdfs[cdfRow2 + tx2][lum];

        const top = c00 + fx * (c10 - c00);
        const bot = c01 + fx * (c11 - c01);
        const targetLum = top + fy * (bot - top);

        if (lum === 0) {
          const v = Math.round(targetLum);
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        } else {
          const gain = targetLum / lum;
          data[idx] = Math.min(255, Math.max(0, Math.round(r * gain)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * gain)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * gain)));
        }
      }
    }
  }

  // =========================================================================
  // =========================================================================
  // De-Moiré Frequency Filtering (Cross-Bilateral Smoothing)
  // Suppresses high-frequency Bayer and screen pixel-matrix moiré fringes
  // while preserving sharp document text stroke boundaries.
  // =========================================================================
  static applyDeMoire(data, width, height, strength = 1.0) {
    const totalPixels = width * height;
    const lum = new Uint8Array(totalPixels);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      lum[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    // Precomputed exp LUT for integer photometric differences [0..255]
    const sigmaR2_inv = 1 / (2 * 28 * 28);
    const lut = new Float32Array(256);
    for (let d = 0; d < 256; d++) {
      lut[d] = Math.exp(-(d * d) * sigmaR2_inv);
    }

    const s = Math.min(1.0, Math.max(0.0, strength));
    const invS = 1.0 - s;
    const out = new Uint8ClampedArray(data.length);

    // Fast unrolled bilateral pass (avoids nested loop overhead)
    for (let y = 1; y < height - 1; y++) {
      const yOff = y * width;
      const yU = (y - 1) * width;
      const yD = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const pIdx = yOff + x;
        const idx = pIdx * 4;
        const centerL = lum[pIdx];

        let sumW = 1.0;
        let sumR = data[idx];
        let sumG = data[idx + 1];
        let sumB = data[idx + 2];

        // 4 Orthogonal neighbors (weight 0.65)
        const idxU = (yU + x) * 4;
        const wU = 0.65 * lut[Math.abs(lum[yU + x] - centerL)];
        sumW += wU; sumR += data[idxU] * wU; sumG += data[idxU + 1] * wU; sumB += data[idxU + 2] * wU;

        const idxD = (yD + x) * 4;
        const wD = 0.65 * lut[Math.abs(lum[yD + x] - centerL)];
        sumW += wD; sumR += data[idxD] * wD; sumG += data[idxD + 1] * wD; sumB += data[idxD + 2] * wD;

        const idxL = (yOff + x - 1) * 4;
        const wL = 0.65 * lut[Math.abs(lum[yOff + x - 1] - centerL)];
        sumW += wL; sumR += data[idxL] * wL; sumG += data[idxL + 1] * wL; sumB += data[idxL + 2] * wL;

        const idxR = (yOff + x + 1) * 4;
        const wR = 0.65 * lut[Math.abs(lum[yOff + x + 1] - centerL)];
        sumW += wR; sumR += data[idxR] * wR; sumG += data[idxR + 1] * wR; sumB += data[idxR + 2] * wR;

        // 4 Diagonal neighbors (weight 0.38)
        const idxTL = (yU + x - 1) * 4;
        const wTL = 0.38 * lut[Math.abs(lum[yU + x - 1] - centerL)];
        sumW += wTL; sumR += data[idxTL] * wTL; sumG += data[idxTL + 1] * wTL; sumB += data[idxTL + 2] * wTL;

        const idxTR = (yU + x + 1) * 4;
        const wTR = 0.38 * lut[Math.abs(lum[yU + x + 1] - centerL)];
        sumW += wTR; sumR += data[idxTR] * wTR; sumG += data[idxTR + 1] * wTR; sumB += data[idxTR + 2] * wTR;

        const idxBL = (yD + x - 1) * 4;
        const wBL = 0.38 * lut[Math.abs(lum[yD + x - 1] - centerL)];
        sumW += wBL; sumR += data[idxBL] * wBL; sumG += data[idxBL + 1] * wBL; sumB += data[idxBL + 2] * wBL;

        const idxBR = (yD + x + 1) * 4;
        const wBR = 0.38 * lut[Math.abs(lum[yD + x + 1] - centerL)];
        sumW += wBR; sumR += data[idxBR] * wBR; sumG += data[idxBR + 1] * wBR; sumB += data[idxBR + 2] * wBR;

        const invW = 1.0 / sumW;
        const filteredR = sumR * invW;
        const filteredG = sumG * invW;
        const filteredB = sumB * invW;

        if (s >= 0.99) {
          out[idx] = filteredR + 0.5;
          out[idx + 1] = filteredG + 0.5;
          out[idx + 2] = filteredB + 0.5;
        } else {
          out[idx] = data[idx] * invS + filteredR * s + 0.5;
          out[idx + 1] = data[idx + 1] * invS + filteredG * s + 0.5;
          out[idx + 2] = data[idx + 2] * invS + filteredB * s + 0.5;
        }
      }
    }

    // Blit smoothed region into data
    for (let y = 1; y < height - 1; y++) {
      const start = (y * width + 1) * 4;
      const end = (y * width + width - 1) * 4;
      data.set(out.subarray(start, end), start);
    }
  }

  // =========================================================================
  // Unsharp Mask Text Edge Sharpening
  // Deepens stroke boundaries for laser-sharp text without white halos.
  // =========================================================================
  static applyUnsharpMask(data, width, height, amount = 0.65) {
    const totalPixels = width * height;

    const tempR = new Uint8Array(totalPixels);
    const tempG = new Uint8Array(totalPixels);
    const tempB = new Uint8Array(totalPixels);

    // 1. Horizontal Gaussian Pass [1, 4, 6, 4, 1] / 16
    for (let y = 0; y < height; y++) {
      const yOff = y * width;
      for (let x = 2; x < width - 2; x++) {
        const idx = (yOff + x) * 4;
        const iL2 = idx - 8, iL1 = idx - 4, iR1 = idx + 4, iR2 = idx + 8;
        tempR[yOff + x] = (data[iL2] + 4 * data[iL1] + 6 * data[idx] + 4 * data[iR1] + data[iR2]) >> 4;
        tempG[yOff + x] = (data[iL2 + 1] + 4 * data[iL1 + 1] + 6 * data[idx + 1] + 4 * data[iR1 + 1] + data[iR2 + 1]) >> 4;
        tempB[yOff + x] = (data[iL2 + 2] + 4 * data[iL1 + 2] + 6 * data[idx + 2] + 4 * data[iR1 + 2] + data[iR2 + 2]) >> 4;
      }
    }

    // 2. Fused Vertical Gaussian & Asymmetric Difference Pass
    const alpha = Math.max(0.1, Math.min(2.0, amount));
    for (let y = 2; y < height - 2; y++) {
      const yOff = y * width;
      const yU2 = (y - 2) * width, yU1 = (y - 1) * width, yD1 = (y + 1) * width, yD2 = (y + 2) * width;
      for (let x = 2; x < width - 2; x++) {
        const idx = yOff + x;
        const blurR = (tempR[yU2 + x] + 4 * tempR[yU1 + x] + 6 * tempR[idx] + 4 * tempR[yD1 + x] + tempR[yD2 + x]) >> 4;
        const blurG = (tempG[yU2 + x] + 4 * tempG[yU1 + x] + 6 * tempG[idx] + 4 * tempG[yD1 + x] + tempG[yD2 + x]) >> 4;
        const blurB = (tempB[yU2 + x] + 4 * tempB[yU1 + x] + 6 * tempB[idx] + 4 * tempB[yD1 + x] + tempB[yD2 + x]) >> 4;

        const pIdx = idx * 4;
        const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
        const diffR = r - blurR;
        const diffG = g - blurG;
        const diffB = b - blurB;

        // Asymmetric halo suppression: deepen dark ink (diff < 0) fully, dampen white halo (diff > 0)
        const boostR = diffR < 0 ? alpha : alpha * 0.45;
        const boostG = diffG < 0 ? alpha : alpha * 0.45;
        const boostB = diffB < 0 ? alpha : alpha * 0.45;

        data[pIdx] = Math.min(255, Math.max(0, (r + boostR * diffR + 0.5) | 0));
        data[pIdx + 1] = Math.min(255, Math.max(0, (g + boostG * diffG + 0.5) | 0));
        data[pIdx + 2] = Math.min(255, Math.max(0, (b + boostB * diffB + 0.5) | 0));
      }
    }
  }

  // =========================================================================
  // 7. Multi-Page PDF Export with PureJSPDFWriter (High-DPI Pure JS PDF 1.4)
  // =========================================================================
  static async exportToPDF(pagesArray, options = {}) {
    if (!Array.isArray(pagesArray) || pagesArray.length === 0) {
      throw new Error('No pages provided for PDF export');
    }

    const processedPages = [];
    const pageSizeOption = (options.pageSize || 'a4').toLowerCase();
    const marginOption = Number(options.margin) || 0;

    for (let i = 0; i < pagesArray.length; i++) {
      const pageData = pagesArray[i];
      let jpegBytes = null;
      let rawDataUrl = null;

      if (pageData instanceof Uint8Array) {
        jpegBytes = pageData;
      } else if (typeof Blob !== 'undefined' && pageData instanceof Blob) {
        const ab = await pageData.arrayBuffer();
        jpegBytes = new Uint8Array(ab);
      } else if (pageData && pageData.fullBlob) {
        const ab = await pageData.fullBlob.arrayBuffer();
        jpegBytes = new Uint8Array(ab);
      } else if (pageData && pageData.jpegBytes) {
        jpegBytes = pageData.jpegBytes;
      } else if (pageData && pageData.id && typeof LocalDocScanDB !== 'undefined' && LocalDocScanDB.getPageBlob) {
        try {
          const blob = await LocalDocScanDB.getPageBlob(pageData.id);
          if (blob) {
            const ab = await blob.arrayBuffer();
            jpegBytes = new Uint8Array(ab);
          }
        } catch (e) {}
      }

      if (!jpegBytes) {
        rawDataUrl = typeof pageData === 'string' ? pageData : (pageData.processedDataUrl || pageData.dataUrl || pageData.thumbDataUrl);
        if (!rawDataUrl) continue;

        if (rawDataUrl.startsWith('data:image/png') || rawDataUrl.startsWith('data:image/webp')) {
          if (typeof document !== 'undefined') {
            try {
              const helperCanvas = document.createElement('canvas');
              const helperImg = await (typeof UIUtils !== 'undefined' && UIUtils.loadImage ? UIUtils.loadImage(rawDataUrl) : new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = rawDataUrl;
              }));
              helperCanvas.width = helperImg.width;
              helperCanvas.height = helperImg.height;
              const hCtx = helperCanvas.getContext('2d');
              hCtx.drawImage(helperImg, 0, 0);
              const jpegUrl = helperCanvas.toDataURL('image/jpeg', 0.95);
              jpegBytes = PureJSPDFWriter.dataUrlToBytes(jpegUrl);
            } catch (convErr) {
              jpegBytes = PureJSPDFWriter.dataUrlToBytes(rawDataUrl);
            }
          } else {
            jpegBytes = PureJSPDFWriter.dataUrlToBytes(rawDataUrl);
          }
        } else {
          jpegBytes = PureJSPDFWriter.dataUrlToBytes(rawDataUrl);
        }
      }

      if (!jpegBytes || jpegBytes.length === 0) continue;

      let dims;
      try {
        dims = PureJSPDFWriter.getJPEGDimensions(jpegBytes);
      } catch (err) {
        dims = {
          width: (pageData && pageData.width) || 800,
          height: (pageData && pageData.height) || 1100,
          colorSpace: 'DeviceRGB'
        };
      }

      const imgWidth = dims.width;
      const imgHeight = dims.height;
      const imgAspect = imgWidth / imgHeight;

      // Base standard dimensions in points (72 pt/inch)
      // A4: 595.28 x 841.89 pt
      // Letter: 612.00 x 792.00 pt
      let baseW = 595.28;
      let baseH = 841.89;
      if (pageSizeOption === 'letter') {
        baseW = 612.00;
        baseH = 792.00;
      }

      let pageWidth, pageHeight, drawW, drawH, drawX, drawY;

      if (pageSizeOption === 'fit') {
        // Auto / Fit to Image: scale so max dimension is 841.89 pt
        if (imgAspect <= 1) { // Portrait
          pageHeight = 841.89;
          pageWidth = Number((841.89 * imgAspect).toFixed(2));
        } else { // Landscape
          pageWidth = 841.89;
          pageHeight = Number((841.89 / imgAspect).toFixed(2));
        }
        if (marginOption === 0) {
          drawW = pageWidth;
          drawH = pageHeight;
          drawX = 0;
          drawY = 0;
        } else {
          const M = marginOption;
          const wAvail = Math.max(10, pageWidth - 2 * M);
          const hAvail = Math.max(10, pageHeight - 2 * M);
          const rAvail = wAvail / hAvail;
          if (imgAspect > rAvail) {
            drawW = wAvail;
            drawH = wAvail / imgAspect;
          } else {
            drawH = hAvail;
            drawW = hAvail * imgAspect;
          }
          drawX = M + (wAvail - drawW) / 2;
          drawY = M + (hAvail - drawH) / 2;
        }
      } else {
        // Standard paper: A4 or Letter
        // Orientation check: explicit page orientation or aspect ratio
        const explicitOrientation = pageData ? pageData.orientation : null;
        const isLandscape = explicitOrientation === 'landscape' || (!explicitOrientation && imgAspect > 1.15);
        pageWidth = isLandscape ? baseH : baseW;
        pageHeight = isLandscape ? baseW : baseH;

        const docType = (pageData && pageData.docType) || (
          ((imgAspect >= 0.62 && imgAspect <= 0.82) || (imgAspect >= 1.22 && imgAspect <= 1.62)) ? 'a4' : 'slip'
        );

        if (marginOption === 0 && docType === 'a4') {
          // Full bleed standard document
          drawW = pageWidth;
          drawH = pageHeight;
          drawX = 0;
          drawY = 0;
        } else if (marginOption === 0 && docType === 'slip') {
          // Natural receipt centering on standard page (CamScanner style)
          if (imgAspect <= 0.65) {
            const targetW = pageWidth * 0.54;
            const maxAvailH = pageHeight * 0.88;
            let w = targetW;
            let h = w / imgAspect;
            if (h > maxAvailH) {
              h = maxAvailH;
              w = h * imgAspect;
            }
            drawW = w;
            drawH = h;
          } else if (imgAspect >= 1.45) {
            const targetW = pageWidth * 0.80;
            const maxAvailH = pageHeight * 0.65;
            let w = targetW;
            let h = w / imgAspect;
            if (h > maxAvailH) {
              h = maxAvailH;
              w = h * imgAspect;
            }
            drawW = w;
            drawH = h;
          } else {
            const targetW = pageWidth * 0.62;
            const maxAvailH = pageHeight * 0.80;
            let w = targetW;
            let h = w / imgAspect;
            if (h > maxAvailH) {
              h = maxAvailH;
              w = h * imgAspect;
            }
            drawW = w;
            drawH = h;
          }
          drawX = (pageWidth - drawW) / 2;
          drawY = (pageHeight - drawH) / 2;
        } else {
          // Centered within margins
          const M = marginOption;
          const wAvail = Math.max(10, pageWidth - 2 * M);
          const hAvail = Math.max(10, pageHeight - 2 * M);
          const rAvail = wAvail / hAvail;
          if (imgAspect > rAvail) {
            drawW = wAvail;
            drawH = wAvail / imgAspect;
          } else {
            drawH = hAvail;
            drawW = hAvail * imgAspect;
          }
          drawX = M + (wAvail - drawW) / 2;
          drawY = M + (hAvail - drawH) / 2;
        }
      }

      processedPages.push({
        jpegBytes,
        width: imgWidth,
        height: imgHeight,
        colorSpace: dims.colorSpace,
        pageW: pageWidth,
        pageH: pageHeight,
        drawW,
        drawH,
        drawX,
        drawY
      });
    }

    if (processedPages.length === 0) {
      throw new Error('No valid pages could be processed for PDF export');
    }

    const pdfBytes = PureJSPDFWriter.createDocument(processedPages, {
      title: options.title || 'LocalDoc Scan',
      producer: 'LocalDoc PureJSPDFWriter 1.4',
      date: new Date()
    });

    if (typeof Blob !== 'undefined') {
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }
    return pdfBytes;
  }

  static movePage(pages, fromIdx, toIdx) {
    if (!Array.isArray(pages) || fromIdx < 0 || fromIdx >= pages.length || toIdx < 0 || toIdx >= pages.length || fromIdx === toIdx) {
      return pages;
    }
    const item = pages.splice(fromIdx, 1)[0];
    pages.splice(toIdx, 0, item);
    return pages;
  }

  static insertPage(pages, atIdx, newPage) {
    if (!Array.isArray(pages)) return [newPage];
    if (atIdx < 0 || atIdx >= pages.length) {
      pages.push(newPage);
    } else {
      pages.splice(atIdx, 0, newPage);
    }
    return pages;
  }

  static removePage(pages, idx) {
    if (Array.isArray(pages) && idx >= 0 && idx < pages.length) {
      pages.splice(idx, 1);
    }
    return pages;
  }

  static async getRecentScans() {
    return await LocalDocScanDB.getAll();
  }

  static async saveRecentScan(item) {
    return await LocalDocScanDB.save(item);
  }

  static async deleteRecentScan(id) {
    return await LocalDocScanDB.delete(id);
  }
}

// =========================================================================
// 8. Pure JavaScript PDF 1.4 Binary Generator (Zero External Dependencies)
// =========================================================================
class PureJSPDFWriter {
  /**
   * Parse JPEG dimensions and color space directly from SOF marker bytes.
   * Supports baseline, progressive, extended sequential DCT (SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15).
   * @param {Uint8Array} bytes 
   * @returns {{ width: number, height: number, precision: number, components: number, colorSpace: string }}
   */
  static getJPEGDimensions(bytes) {
    if (!bytes || bytes.length < 4) throw new Error('Invalid JPEG data');
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('Missing JPEG SOI marker');

    let offset = 2;
    const len = bytes.length;

    while (offset < len) {
      if (bytes[offset] !== 0xFF) { offset++; continue; }
      while (offset < len && bytes[offset] === 0xFF) { offset++; }
      if (offset >= len) break;

      const marker = bytes[offset++];
      // Standalone markers without payload
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
      if (marker === 0xDA) break; // SOS (Start of Scan) marker reached

      if (offset + 1 >= len) break;
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];

      // SOF markers
      const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
                    (marker >= 0xC5 && marker <= 0xC7) ||
                    (marker >= 0xC9 && marker <= 0xCB) ||
                    (marker >= 0xCD && marker <= 0xCF);

      if (isSOF) {
        if (segmentLength < 8 || offset + 7 >= len) throw new Error('Malformed SOF segment');
        const precision = bytes[offset + 2];
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        if (width <= 0 || height <= 0) {
          throw new Error('Invalid JPEG dimensions in SOF segment');
        }
        const components = bytes[offset + 7];
        const colorSpace = components === 1 ? 'DeviceGray' : (components === 4 ? 'DeviceCMYK' : 'DeviceRGB');
        return { width, height, precision, components, colorSpace };
      }

      offset += segmentLength;
    }
    throw new Error('SOF marker not found in JPEG stream');
  }

  /**
   * Convert base64 / dataUrl string to Uint8Array bytes
   * @param {string} dataUrl 
   * @returns {Uint8Array}
   */
  static dataUrlToBytes(dataUrl) {
    if (!dataUrl) return new Uint8Array(0);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } else if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    } else {
      throw new Error('No base64 decoder available');
    }
  }

  /**
   * Escape special PDF string characters
   * @param {string} str 
   * @returns {string}
   */
  static escapePDFString(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  /**
   * Format Date to standard PDF date string (D:YYYYMMDDHHmmSSZ)
   * @param {Date} date 
   * @returns {string}
   */
  static formatPDFDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `D:${yyyy}${mm}${dd}${hh}${min}${ss}Z`;
  }

  /**
   * Pure JavaScript PDF 1.4 Binary Generator
   * ISO 32000-1 Compliant:
   * - Binary Header with non-ASCII bytes
   * - Deterministic Object Graph (Catalog -> Pages -> Page, Content Stream, Image XObject)
   * - Direct JPEG bitstream embedding via /Filter /DCTDecode
   * - Exact 20-byte cross-reference table entries
   * - Single-pass trailer and EOF
   * 
   * @param {Array<Object>} pages
   * @param {Object} metadata
   * @returns {Uint8Array} Binary PDF buffer
   */
  static createDocument(pages, metadata = {}) {
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error('Cannot create empty PDF document');
    }

    const chunks = [];
    let currentOffset = 0;

    const writeBytes = (u8) => {
      chunks.push(u8);
      currentOffset += u8.length;
    };

    const writeAscii = (str) => {
      const len = str.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8[i] = str.charCodeAt(i) & 0xFF;
      }
      writeBytes(u8);
    };

    // 1. PDF 1.4 Header with standard binary high-order comment
    const headerBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0D, 0x0A, // %PDF-1.4\r\n
      0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0D, 0x0A                   // %\xE2\xE3\xCF\xD3\r\n
    ]);
    writeBytes(headerBytes);

    const N = pages.length;
    const totalObjects = 2 + 3 * N;
    const offsets = new Array(totalObjects + 1).fill(0);

    // Object 1: Catalog Dictionary
    offsets[1] = currentOffset;
    writeAscii(`1 0 obj\r\n<<\r\n  /Type /Catalog\r\n  /Pages 2 0 R\r\n>>\r\nendobj\r\n`);

    // Object 2: Pages Tree
    offsets[2] = currentOffset;
    const kids = [];
    for (let k = 0; k < N; k++) {
      kids.push(`${3 + 3 * k} 0 R`);
    }
    writeAscii(`2 0 obj\r\n<<\r\n  /Type /Pages\r\n  /Kids [${kids.join(' ')}]\r\n  /Count ${N}\r\n>>\r\nendobj\r\n`);

    // Per-page objects
    for (let k = 0; k < N; k++) {
      const page = pages[k];
      const Pk = 3 + 3 * k;
      const Ck = 3 + 3 * k + 1;
      const Ik = 3 + 3 * k + 2;

      let jpegBytes = page.jpegBytes;
      if (!jpegBytes && page.dataUrl) {
        jpegBytes = this.dataUrlToBytes(page.dataUrl);
      }
      if (!jpegBytes) {
        throw new Error(`Page ${k + 1} has no valid JPEG bytes`);
      }

      let imgW = page.width;
      let imgH = page.height;
      let colorSpace = page.colorSpace || 'DeviceRGB';

      if (!imgW || !imgH) {
        try {
          const dims = this.getJPEGDimensions(jpegBytes);
          imgW = dims.width;
          imgH = dims.height;
          colorSpace = dims.colorSpace;
        } catch (e) {
          imgW = 800;
          imgH = 1100;
        }
      }

      // Determine Page Dimensions (MediaBox) and Image Placement
      const pageW = page.pageW || 595.28;
      const pageH = page.pageH || 841.89;
      const drawW = page.drawW !== undefined ? page.drawW : pageW;
      const drawH = page.drawH !== undefined ? page.drawH : pageH;
      const drawX = page.drawX !== undefined ? page.drawX : 0;
      const drawY = page.drawY !== undefined ? page.drawY : 0;

      // Object Pk: Page Object
      offsets[Pk] = currentOffset;
      writeAscii(`${Pk} 0 obj\r\n<<\r\n  /Type /Page\r\n  /Parent 2 0 R\r\n  /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}]\r\n  /Resources <<\r\n    /ProcSet [/PDF /ImageC]\r\n    /XObject <<\r\n      /Im1 ${Ik} 0 R\r\n    >>\r\n  >>\r\n  /Contents ${Ck} 0 R\r\n>>\r\nendobj\r\n`);

      // Object Ck: Content Stream
      offsets[Ck] = currentOffset;
      const streamText = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /Im1 Do Q\r\n`;
      const streamLen = streamText.length;
      writeAscii(`${Ck} 0 obj\r\n<<\r\n  /Length ${streamLen}\r\n>>\r\nstream\r\n${streamText}endstream\r\nendobj\r\n`);

      // Object Ik: Image XObject with direct /Filter /DCTDecode
      offsets[Ik] = currentOffset;
      const xobjHeader = `${Ik} 0 obj\r\n<<\r\n  /Type /XObject\r\n  /Subtype /Image\r\n  /Width ${imgW}\r\n  /Height ${imgH}\r\n  /ColorSpace /${colorSpace}\r\n  /BitsPerComponent 8\r\n  /Filter /DCTDecode\r\n  /Length ${jpegBytes.length}\r\n>>\r\nstream\r\n`;
      writeAscii(xobjHeader);
      writeBytes(jpegBytes);
      writeAscii(`\r\nendstream\r\nendobj\r\n`);
    }

    // Cross-Reference Table (exact 20 bytes per entry)
    const startXref = currentOffset;
    writeAscii(`xref\r\n0 ${totalObjects + 1}\r\n`);
    writeAscii(`0000000000 65535 f\r\n`); // Entry 0: exactly 20 bytes

    for (let i = 1; i <= totalObjects; i++) {
      const offsetStr = String(offsets[i]).padStart(10, '0');
      writeAscii(`${offsetStr} 00000 n\r\n`); // Entry i: exactly 20 bytes
    }

    // Trailer Dictionary & EOF
    const title = this.escapePDFString(metadata.title || 'LocalDoc Scan');
    const producer = this.escapePDFString(metadata.producer || 'LocalDoc PureJSPDFWriter 1.4');
    const creationDate = this.formatPDFDate(metadata.date || new Date());

    writeAscii(`trailer\r\n<<\r\n  /Size ${totalObjects + 1}\r\n  /Root 1 0 R\r\n  /Info <<\r\n    /Title (${title})\r\n    /Producer (${producer})\r\n    /CreationDate (${creationDate})\r\n  >>\r\n>>\r\nstartxref\r\n${startXref}\r\n%%EOF\r\n`);

    // Concatenate all chunks into single Uint8Array
    let totalLen = 0;
    for (let c of chunks) totalLen += c.length;
    const finalBuffer = new Uint8Array(totalLen);
    let pos = 0;
    for (let c of chunks) {
      finalBuffer.set(c, pos);
      pos += c.length;
    }

    return finalBuffer;
  }
}

if (typeof window !== 'undefined') {
  window.LocalDocScanDB = LocalDocScanDB;
  window.ScanFeedback = ScanFeedback;
  window.DocumentScanner = DocumentScanner;
  window.PureJSPDFWriter = PureJSPDFWriter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocalDocScanDB, ScanFeedback, DocumentScanner, PureJSPDFWriter };
}
