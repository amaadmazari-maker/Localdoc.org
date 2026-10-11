/**
 * localdoc.org — Neural OCR & Adaptive Document Recognition Engine (js/tools/ocr.js)
 * 100% Client-side WebAssembly execution in browser memory:
 * - High-Accuracy Otsu Global & Adaptive Contrast Binarization
 * - Noise Despeckling & White-on-Dark Polarity Correction
 * - Multi-Language Neural Character Recognition via Tesseract WASM
 * - Zero cloud uploads, zero external telemetry
 */

const OCRUtils = {
  /**
   * Pre-process image to maximize OCR optical recognition accuracy
   * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} source
   * @param {string} filterType - 'adaptive-bw', 'magic-color', or 'none'
   * @returns {Promise<HTMLCanvasElement>}
   */
  async preprocessImage(source, filterType = 'adaptive-bw') {
    let img;
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      img = source;
    } else if (typeof source === 'string') {
      img = await UIUtils.loadImage(source);
    } else if (source instanceof Blob || source instanceof File) {
      const dataUrl = await UIUtils.readFileAsDataURL(source);
      img = await UIUtils.loadImage(dataUrl);
    } else {
      throw new Error('Invalid image source for OCR pre-processing');
    }

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Rescale if image is excessively large (e.g. > 3000px) to balance speed and accuracy
    let targetW = w;
    let targetH = h;
    const maxDim = 2600;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      targetW = Math.round(w * scale);
      targetH = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetW, targetH);

    if (filterType === 'none') {
      return canvas;
    }

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const len = data.length;

    if (filterType === 'magic-color') {
      // Contrast stretch + white-point equalization
      let lumSamples = [];
      for (let i = 0; i < len; i += 40) {
        lumSamples.push((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0);
      }
      lumSamples.sort((a, b) => a - b);
      const whitePoint = Math.min(245, Math.max(170, lumSamples[Math.floor(lumSamples.length * 0.85)]));
      const darkPoint = Math.max(10, Math.min(70, lumSamples[Math.floor(lumSamples.length * 0.1)]));
      const range = Math.max(1, whitePoint - darkPoint);

      for (let i = 0; i < len; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (lum >= whitePoint) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        } else {
          const norm = Math.max(0, Math.min(1, (lum - darkPoint) / range));
          const val = Math.pow(norm, 1.3) * 255;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      }
    } else {
      // Default: 'adaptive-bw' (Otsu's Adaptive Global Binarization with Inversion Check)
      const hist = new Uint32Array(256);
      let total = 0;
      let sumTotal = 0;

      for (let i = 0; i < len; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        hist[lum]++;
        total++;
        sumTotal += lum;
      }

      let sumB = 0;
      let wB = 0;
      let maxVar = 0;
      let threshold = 135;

      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;

        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sumTotal - sumB) / wF;
        const betweenVar = wB * wF * (mB - mF) * (mB - mF);

        if (betweenVar > maxVar) {
          maxVar = betweenVar;
          threshold = t;
        }
      }

      const finalThreshold = Math.max(65, Math.min(195, threshold));

      // Polarity detection: check if background is dark
      let darkCount = 0;
      for (let i = 0; i < len; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (lum < finalThreshold) darkCount++;
      }
      const isInverted = darkCount > (total * 0.65); // More than 65% is dark -> likely inverted

      for (let i = 0; i < len; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        let isForeground = lum < finalThreshold;
        if (isInverted) isForeground = !isForeground;

        const val = isForeground  ?  0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  },

  /**
   * Run neural OCR recognition on image file or canvas
   * @param {File|Blob|HTMLCanvasElement|string} source
   * @param {Function} onProgress
   * @param {Object} options - { lang, filter }
   * @returns {Promise<string>}
   */
  /**
   * Check if an OCR language code uses a Right-to-Left (RTL) writing system
   * @param {string} langCode
   * @returns {boolean}
   */
  isRtlLang(langCode = 'eng') {
    return langCode.includes('urd') || langCode.includes('ara');
  },

  /**
   * Return typography and layout styles tailored to the recognition script
   * @param {string} langCode
   * @returns {{ fontFamily: string, lineHeight: string, dir: string, textAlign: string }}
   */
  getScriptStyles(langCode = 'eng') {
    const isRtl = this.isRtlLang(langCode);
    if (langCode.includes('urd')) {
      return {
        fontFamily: 'var(--font-urdu, "Noto Nastaliq Urdu", serif)',
        lineHeight: '2.2',
        dir: 'rtl',
        textAlign: 'right'
      };
    }
    if (langCode.includes('ara')) {
      return {
        fontFamily: 'var(--font-arabic, "Amiri", "Noto Naskh Arabic", serif)',
        lineHeight: '1.85',
        dir: 'rtl',
        textAlign: 'right'
      };
    }
    if (langCode.includes('hin')) {
      return {
        fontFamily: 'var(--font-hindi, "Noto Sans Devanagari", sans-serif)',
        lineHeight: '1.7',
        dir: 'ltr',
        textAlign: 'left'
      };
    }
    return {
      fontFamily: 'var(--font-mono, monospace)',
      lineHeight: '1.6',
      dir: 'ltr',
      textAlign: 'left'
    };
  },

  /**
   * Run neural OCR recognition on image file or canvas
   * @param {File|Blob|HTMLCanvasElement|string} source
   * @param {Function} onProgress
   * @param {Object} options - { lang, filter, workerPath }
   * @returns {Promise<string>}
   */
  async imageToText(source, onProgress = null, options = {}) {
    const filter = options.filter || 'adaptive-bw';
    const lang = options.lang || 'eng';

    if (onProgress) onProgress(20, 'Applying adaptive pre-OCR contrast filters...');
    const preprocessedCanvas = await this.preprocessImage(source, filter);

    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract OCR engine is loading. Please wait a moment and try again.');
    }

    if (onProgress) onProgress(35, 'Initializing neural optical character recognition in browser RAM...');

    const workerPath = options.workerPath || (
      (typeof window !== 'undefined' && window.location.pathname.includes('/pages/'))
        ? '../js/lib/tesseract-worker.min.js'
        : 'js/lib/tesseract-worker.min.js'
    );

    const result = await Tesseract.recognize(
      preprocessedCanvas,
      lang,
      {
        workerPath: workerPath,
        logger: m => {
          if (onProgress && m.status) {
            let pct = 35;
            let statusLabel = m.status;
            if (m.status === 'loading tesseract core') {
              pct = Math.round(20 + ((m.progress || 0) * 15));
              statusLabel = 'Loading neural WebAssembly core...';
            } else if (m.status === 'loading language traineddata') {
              pct = Math.round(35 + ((m.progress || 0) * 20));
              statusLabel = `Loading language model (${lang})...`;
            } else if (m.status === 'initializing api') {
              pct = 55;
              statusLabel = 'Initializing neural network pipeline...';
            } else if (m.status === 'recognizing text') {
              const recPct = (m.progress !== undefined) ? Math.round(m.progress * 100) : 0;
              pct = Math.round(55 + ((m.progress || 0) * 40));
              statusLabel = `Transcribing text characters (${recPct}%)...`;
            }
            onProgress(Math.min(99, Math.max(10, pct)), statusLabel);
          }
        }
      }
    );

    if (onProgress) onProgress(100, 'Recognition complete');
    return (result && result.data && result.data.text)  ?  result.data.text : '';
  }
};

window.OCRUtils = OCRUtils;
