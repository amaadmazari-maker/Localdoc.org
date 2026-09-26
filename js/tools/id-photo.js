/**
 * localdoc.org — Biometric ID & Photo Studio Engine (js/tools/id-photo.js)
 * High-precision biometric passport/visa photo cropping, multi-copy print sheet generation (4x6", 5x7", A4),
 * suit/attire overlays, background color changer (White, Grey, Blue, Red, Green, Custom),
 * and 2-in-1 Front & Back ID Card composite compilation with PDF export.
 * 100% Client-Side RAM Execution. Zero Cloud Uploads.
 */

const IDPhoto = {
  // Global Country & Dimension Presets
  PRESETS: {
    'passport-us': {
      name: 'US Passport, Visa & Green Card (2x2" / 51x51mm)',
      country: 'United States',
      width: 600, height: 600, dpi: 300, mmW: 51, mmH: 51,
      headRatio: 0.70, // 70-80% head height
      bgRecommended: '#FFFFFF'
    },
    'passport-uk': {
      name: 'UK / British Passport & Driving Licence (35x45mm)',
      country: 'United Kingdom',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#F1F5F9' // Light grey / off-white
    },
    'visa-schengen': {
      name: 'Schengen Visa & European Union (35x45mm)',
      country: 'European Union',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#F8FAFC'
    },
    'passport-ca': {
      name: 'Canada Passport (50x70mm)',
      country: 'Canada',
      width: 591, height: 827, dpi: 300, mmW: 50, mmH: 70,
      headRatio: 0.72,
      bgRecommended: '#FFFFFF'
    },
    'passport-in': {
      name: 'India Passport, OCI & Visa (35x45mm & 2x2")',
      country: 'India',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'passport-pk': {
      name: 'Pakistan Passport (35x45mm)',
      country: 'Pakistan',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'passport-tr': {
      name: 'Turkey (Türkiye) Passport & Visa (50x60mm)',
      country: 'Turkey',
      width: 591, height: 709, dpi: 300, mmW: 50, mmH: 60,
      headRatio: 0.72,
      bgRecommended: '#FFFFFF'
    },
    'passport-my': {
      name: 'Malaysia Passport (35x50mm)',
      country: 'Malaysia',
      width: 413, height: 591, dpi: 300, mmW: 35, mmH: 50,
      headRatio: 0.72,
      bgRecommended: '#FFFFFF'
    },
    'passport-sg': {
      name: 'Singapore Passport & Visa (35x45mm)',
      country: 'Singapore',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'passport-az': {
      name: 'Azerbaijan Passport & Visa (30x40mm)',
      country: 'Azerbaijan',
      width: 354, height: 472, dpi: 300, mmW: 30, mmH: 40,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'cnic-pk': {
      name: 'Pakistan NADRA CNIC, NICOP & Passport (35x45mm)',
      country: 'Pakistan',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#E0F2FE' // Light blue / White
    },
    'passport-au': {
      name: 'Australia & New Zealand Passport (35x45mm)',
      country: 'Australia',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'passport-cn': {
      name: 'China Passport & Visa (33x48mm)',
      country: 'China',
      width: 390, height: 567, dpi: 300, mmW: 33, mmH: 48,
      headRatio: 0.72,
      bgRecommended: '#FFFFFF'
    },
    'passport-jp': {
      name: 'Japan Passport & Residence Card (35x45mm)',
      country: 'Japan',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'visa-uae': {
      name: 'UAE / Dubai Tourist & Resident Visa (35x45mm)',
      country: 'United Arab Emirates',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'visa-saudi': {
      name: 'Saudi Arabia Umrah & Hajj Visa (2x2" / 51x51mm)',
      country: 'Saudi Arabia',
      width: 600, height: 600, dpi: 300, mmW: 51, mmH: 51,
      headRatio: 0.70,
      bgRecommended: '#FFFFFF'
    },
    'iqama-saudi': {
      name: 'Saudi Arabia Iqama & Driving Licence (40x60mm)',
      country: 'Saudi Arabia',
      width: 472, height: 709, dpi: 300, mmW: 40, mmH: 60,
      headRatio: 0.72,
      bgRecommended: '#FFFFFF'
    },
    'passport-ru': {
      name: 'Russia Passport & Visa (35x45mm, 80% face)',
      country: 'Russia',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.80,
      bgRecommended: '#F8FAFC'
    },
    'passport-kr': {
      name: 'South Korea Passport & ARC (35x45mm)',
      country: 'South Korea',
      width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    },
    'pan-in': {
      name: 'India PAN Card (213x213 px / 2.5x3.5 cm)',
      country: 'India',
      width: 213, height: 213, dpi: 300, mmW: 25, mmH: 25,
      headRatio: 0.70,
      bgRecommended: '#FFFFFF'
    },
    'pak-identity': {
      name: 'Pak-Identity Online Portal (354x472 px, Light Blue)',
      country: 'Pakistan',
      width: 354, height: 472, dpi: 350, mmW: 35, mmH: 45,
      headRatio: 0.75,
      bgRecommended: '#E0F2FE'
    },
    'photo-1x1': {
      name: '1x1 Inch Square Photo (25x25mm)',
      country: 'Standard',
      width: 300, height: 300, dpi: 300, mmW: 25, mmH: 25,
      headRatio: 0.70,
      bgRecommended: '#FFFFFF'
    },
    'photo-2x2': {
      name: '2x2 Inch Standard Photo (51x51mm)',
      country: 'Standard',
      width: 600, height: 600, dpi: 300, mmW: 51, mmH: 51,
      headRatio: 0.70,
      bgRecommended: '#FFFFFF'
    },
    'photo-3x4': {
      name: '30x40mm Standard ID Photo',
      country: 'Standard',
      width: 354, height: 472, dpi: 300, mmW: 30, mmH: 40,
      headRatio: 0.75,
      bgRecommended: '#FFFFFF'
    }
  },

  // Color Palette Constants
  BACKGROUND_COLORS: [
    { name: 'Pure White', hex: '#FFFFFF', desc: 'Standard US, Schengen, Global' },
    { name: 'Off-White / Light Grey', hex: '#F1F5F9', desc: 'UK HMPO, European Union' },
    { name: 'Embassy Light Blue', hex: '#E0F2FE', desc: 'Pakistan CNIC, Malaysia, Kuwait' },
    { name: 'Royal Blue', hex: '#0284C7', desc: 'Philippines, Sri Lanka, Official IDs' },
    { name: 'Passport Red', hex: '#DC2626', desc: 'Indonesia, Vietnam, Special Visas' },
    { name: 'Official Green', hex: '#16A34A', desc: 'Middle East & Special Passports' }
  ],

  // Suit Overlays (Vector SVG Data URLs)
  SUIT_TEMPLATES: {
    'none': null,
    'men-dark-suit': {
      name: "Men's Dark Navy Business Suit & Tie",
      svg: `<svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 240C50 180 85 140 140 120L170 145L125 240H50Z" fill="#1E293B"/>
        <path d="M350 240C350 180 315 140 260 120L230 145L275 240H350Z" fill="#1E293B"/>
        <path d="M140 120L185 190L170 240H230L215 190L260 120C240 110 225 105 200 105C175 105 160 110 140 120Z" fill="#F8FAFC"/>
        <path d="M190 125L200 135L210 125L205 240H195L190 125Z" fill="#B91C1C"/>
        <path d="M185 115L200 128L215 115L205 110H195L185 115Z" fill="#991B1B"/>
        <path d="M125 125L175 195L160 240H120L95 180L125 125Z" fill="#0F172A"/>
        <path d="M275 125L225 195L240 240H280L305 180L275 125Z" fill="#0F172A"/>
      </svg>`
    },
    'women-blazer': {
      name: "Women's Elegant Dark Blazer & Collar",
      svg: `<svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 240C50 170 90 135 145 115L175 155L135 240H50Z" fill="#1E1B4B"/>
        <path d="M350 240C350 170 310 135 255 115L225 155L265 240H350Z" fill="#1E1B4B"/>
        <path d="M145 115L190 190L175 240H225L210 190L255 115C235 105 220 100 200 100C180 100 165 105 145 115Z" fill="#F8FAFC"/>
        <path d="M135 120L185 195L165 240H115L90 175L135 120Z" fill="#0F172A"/>
        <path d="M265 120L215 195L235 240H285L310 175L265 120Z" fill="#0F172A"/>
      </svg>`
    }
  },

  // 1. High-Performance Client-Side Selfie & Person Segmentation Engine
  _segmenterInstance: null,

  async initSegmenter() {
    if (this._segmenterInstance) return this._segmenterInstance;
    if (typeof window.SelfieSegmentation !== 'undefined') {
      try {
        const segmenter = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        segmenter.setOptions({
          modelSelection: 0, // 0 is fast general model (256x256, 3MB), crash-proof on mobile WebGL
          selfieMode: false
        });
        await segmenter.initialize();
        this._segmenterInstance = segmenter;
        return segmenter;
      } catch (e) {
        console.warn('MediaPipe initialization warning (using fallback canvas matting):', e);
      }
    }
    return null;
  },

  // Segment a person from any room or background image
  async segmentPerson(imgElement, { edgeFeather = 2, threshold = 0.5, tolerance = 42 } = {}) {
    if (!imgElement) return null;

    const w = imgElement.naturalWidth || imgElement.width || 600;
    const h = imgElement.naturalHeight || imgElement.height || 600;

    // 1. RAM Pre-scaler: downsample camera photos (12MP - 50MP) to max 512px buffer
    // This prevents WebGL GL_OUT_OF_MEMORY crashes & texture allocation failures on mobile
    const maxDim = 512;
    let sendSource = imgElement;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      const bufW = Math.round(w * scale);
      const bufH = Math.round(h * scale);
      const bufCanvas = document.createElement('canvas');
      bufCanvas.width = bufW;
      bufCanvas.height = bufH;
      const bCtx = bufCanvas.getContext('2d');
      bCtx.drawImage(imgElement, 0, 0, bufW, bufH);
      sendSource = bufCanvas;
    }

    // 2. Try MediaPipe Selfie Segmentation first (WASM/WebGL in RAM)
    if (typeof window.SelfieSegmentation !== 'undefined') {
      try {
        const segmenter = await this.initSegmenter();
        if (segmenter) {
          const maskPromise = new Promise((resolve) => {
            // Generous timeout: 12s max for mobile network asset download
            const timeoutId = setTimeout(() => {
              console.warn('MediaPipe segmentation timeout (12s); switching to fast contour matting.');
              resolve(null);
            }, 12000);

            segmenter.onResults((results) => {
              clearTimeout(timeoutId);
              if (results && results.segmentationMask) {
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = w;
                maskCanvas.height = h;
                const mCtx = maskCanvas.getContext('2d');
                mCtx.imageSmoothingEnabled = true;
                mCtx.imageSmoothingQuality = 'high';
                mCtx.drawImage(results.segmentationMask, 0, 0, w, h);
                resolve(maskCanvas);
              } else {
                resolve(null);
              }
            });
          });

          await segmenter.send({ image: sendSource });
          const maskCanvas = await maskPromise;
          if (maskCanvas) {
            return this.applyMaskToImage(imgElement, maskCanvas, edgeFeather);
          }
        }
      } catch (err) {
        console.warn('MediaPipe execution fallback:', err);
      }
    }

    // 3. High-precision adaptive Contour Canvas Matting fallback (100% offline, zero network dependencies)
    return this.fallbackCanvasMatting(imgElement, { edgeFeather, threshold, tolerance });
  },

  // Pure Client-Side Adaptive Contour Background Matting Algorithm (No hardcoded circles/ellipses)
  fallbackCanvasMatting(imgElement, { edgeFeather = 2, threshold = 0.45, tolerance = 42 } = {}) {
    const origW = imgElement.naturalWidth || imgElement.width || 600;
    const origH = imgElement.naturalHeight || imgElement.height || 600;

    // Work on a fast analysis grid (max 360px) for instantaneous mobile processing (<30ms)
    const maxGrid = 360;
    const scale = Math.min(1.0, maxGrid / Math.max(origW, origH));
    const gw = Math.max(120, Math.round(origW * scale));
    const gh = Math.max(120, Math.round(origH * scale));

    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = gw;
    gridCanvas.height = gh;
    const gCtx = gridCanvas.getContext('2d');
    gCtx.drawImage(imgElement, 0, 0, gw, gh);

    const imgData = gCtx.getImageData(0, 0, gw, gh);
    const data = imgData.data;

    // 1. Multi-cluster perimeter sampling: sample top border, top-left, top-right
    // Where room backgrounds, walls, curtains, and switchboards reside
    const topSamples = [];
    const leftSamples = [];
    const rightSamples = [];

    const getPixel = (x, y) => {
      const idx = (y * gw + x) * 4;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    };

    // Top border (across entire width, top 12% height)
    const topMaxY = Math.max(2, Math.floor(gh * 0.12));
    for (let y = 0; y < topMaxY; y += 2) {
      for (let x = 0; x < gw; x += 3) {
        topSamples.push(getPixel(x, y));
      }
    }

    // Upper left border (0 to 18% width, up to 65% height)
    const leftMaxX = Math.max(2, Math.floor(gw * 0.18));
    const sideMaxY = Math.max(2, Math.floor(gh * 0.65));
    for (let y = topMaxY; y < sideMaxY; y += 3) {
      for (let x = 0; x < leftMaxX; x += 3) {
        leftSamples.push(getPixel(x, y));
      }
    }

    // Upper right border (82% to 100% width, up to 65% height)
    const rightMinX = Math.min(gw - 2, Math.floor(gw * 0.82));
    for (let y = topMaxY; y < sideMaxY; y += 3) {
      for (let x = rightMinX; x < gw; x += 3) {
        rightSamples.push(getPixel(x, y));
      }
    }

    const calcMean = (samples) => {
      if (!samples.length) return { r: 240, g: 240, b: 240 };
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < samples.length; i++) {
        r += samples[i].r; g += samples[i].g; b += samples[i].b;
      }
      return { r: r / samples.length, g: g / samples.length, b: b / samples.length };
    };

    const meanTop = calcMean(topSamples);
    const meanLeft = calcMean(leftSamples.length ? leftSamples : topSamples);
    const meanRight = calcMean(rightSamples.length ? rightSamples : topSamples);

    // Color distance function (perceptual human eye metric)
    const colorDist = (r, g, b, bg) => {
      const rmean = (r + bg.r) * 0.5;
      const dr = r - bg.r;
      const dg = g - bg.g;
      const db = b - bg.b;
      return Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db);
    };

    const bgDist = (r, g, b) => {
      return Math.min(
        colorDist(r, g, b, meanTop),
        colorDist(r, g, b, meanLeft),
        colorDist(r, g, b, meanRight)
      );
    };

    // 2. Perimeter-Connected Flood Map
    // Background pixels connect to outer boundaries (ceiling/wall)
    const bgMap = new Uint8Array(gw * gh); // 1 = background, 0 = foreground/person
    const visited = new Uint8Array(gw * gh);
    const queue = new Int32Array(gw * gh);
    let qHead = 0;
    let qTail = 0;

    const tol = Math.max(18, tolerance || 38);

    // Seed outer boundary pixels into flood queue ONLY from top corners and top ceiling
    // NEVER seed bottom or lower side borders where shoulders and clothing touch the edge
    for (let x = 0; x < gw; x++) {
      const idx = x;
      const pIdx = idx * 4;
      if (bgDist(data[pIdx], data[pIdx + 1], data[pIdx + 2]) < tol * 1.4) {
        visited[idx] = 1;
        bgMap[idx] = 1;
        queue[qTail++] = idx;
      }
    }
    // Left & Right columns down to only 45% height (head/ear level, above shoulders)
    const sideLimitY = Math.floor(gh * 0.45);
    for (let y = 1; y < sideLimitY; y++) {
      const idxL = y * gw;
      const pL = idxL * 4;
      if (!visited[idxL] && bgDist(data[pL], data[pL + 1], data[pL + 2]) < tol * 1.3) {
        visited[idxL] = 1;
        bgMap[idxL] = 1;
        queue[qTail++] = idxL;
      }
      const idxR = y * gw + (gw - 1);
      const pR = idxR * 4;
      if (!visited[idxR] && bgDist(data[pR], data[pR + 1], data[pR + 2]) < tol * 1.3) {
        visited[idxR] = 1;
        bgMap[idxR] = 1;
        queue[qTail++] = idxR;
      }
    }

    // Breadth-First Flood-Fill to expand background around silhouette
    while (qHead < qTail) {
      const cur = queue[qHead++];
      const cx = cur % gw;
      const cy = Math.floor(cur / gw);

      const neighbors = [
        cx > 0 ? cur - 1 : -1,
        cx < gw - 1 ? cur + 1 : -1,
        cy > 0 ? cur - gw : -1,
        cy < gh - 1 ? cur + gw : -1
      ];

      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i];
        if (nIdx < 0 || visited[nIdx]) continue;
        visited[nIdx] = 1;

        const nx = nIdx % gw;
        const ny = Math.floor(nIdx / gw);

        // Core person protection (anatomical structure of portraits & selfies):
        // 1. Torso & clothing: never flood below neck/shoulders in the central body column
        const inTorso = (ny > gh * 0.50 && nx > gw * 0.18 && nx < gw * 0.82) ||
                        (ny > gh * 0.70 && nx > gw * 0.08 && nx < gw * 0.92);
        if (inTorso) continue;

        // 2. Central Face, Head & Hair corridor
        const inHead = (ny > gh * 0.15 && ny < gh * 0.55 && nx > gw * 0.28 && nx < gw * 0.72);

        const np = nIdx * 4;
        const nr = data[np];
        const ng = data[np + 1];
        const nb = data[np + 2];

        // Biometric skin tone detection
        const isSkin = (nr > 55 && ng > 35 && nb > 20 && (nr - ng) > 7 && nr > nb);
        // Dark hair detection
        const isHair = (nr < 75 && ng < 75 && nb < 75);

        if ((isSkin || isHair) && inHead) {
          continue; // Protected head/hair feature
        }

        const d = bgDist(nr, ng, nb);
        if (d < tol) {
          bgMap[nIdx] = 1;
          queue[qTail++] = nIdx;
        }
      }
    }

    // 3. Generate smooth Alpha Mask Canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = gw;
    maskCanvas.height = gh;
    const mCtx = maskCanvas.getContext('2d');
    const maskImgData = mCtx.createImageData(gw, gh);
    const mData = maskImgData.data;

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const idx = y * gw + x;
        const pIdx = idx * 4;

        let alpha = 255;
        // Absolute Anatomical Safeguard: torso, collar, and shirt can NEVER be erased
        if (y > gh * 0.48 && x > gw * 0.16 && x < gw * 0.84) {
          alpha = 255;
        } else if (bgMap[idx] === 1) {
          alpha = 0; // True flooded background
        } else {
          // Un-flooded pixel: ALWAYS keep person clothing, hair, and body!
          // Only apply a subtle feathering to pixels directly bordering the flooded background
          let nearBg = false;
          if (x > 0 && bgMap[idx - 1] === 1) nearBg = true;
          else if (x < gw - 1 && bgMap[idx + 1] === 1) nearBg = true;
          else if (y > 0 && bgMap[idx - gw] === 1) nearBg = true;
          else if (y < gh - 1 && bgMap[idx + gw] === 1) nearBg = true;

          if (nearBg && y < gh * 0.70) {
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];
            const d = bgDist(r, g, b);
            const ramp = Math.min(1.0, Math.max(0.35, d / (tol * 1.2)));
            alpha = Math.round(ramp * 255);
          } else {
            alpha = 255; // Completely solid body and clothing
          }
        }

        // Mask alpha channel: 0 = transparent background, 255 = person
        mData[pIdx] = 255;
        mData[pIdx + 1] = 255;
        mData[pIdx + 2] = 255;
        mData[pIdx + 3] = alpha;
      }
    }

    mCtx.putImageData(maskImgData, 0, 0);

    // 4. Scale up the mask to original image dimensions with edge smoothing
    const fullMaskCanvas = document.createElement('canvas');
    fullMaskCanvas.width = origW;
    fullMaskCanvas.height = origH;
    const fCtx = fullMaskCanvas.getContext('2d');
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(maskCanvas, 0, 0, origW, origH);

    // Apply Mask to original image
    return this.applyMaskToImage(imgElement, fullMaskCanvas, edgeFeather);
  },

  // Apply a segmentation mask canvas to an image element to produce transparent cutout canvas
  applyMaskToImage(imgElement, maskCanvas, featherPx = 0) {
    const w = imgElement.naturalWidth || imgElement.width;
    const h = imgElement.naturalHeight || imgElement.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw original photo
    ctx.drawImage(imgElement, 0, 0, w, h);

    // 2. Mask with segmentation alpha
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    return canvas;
  },

  // Process and crop single portrait photo with background, zoom, pan, rotation, filters, suit overlay
  async renderPortraitPhoto({
    imageFileOrUrl,
    cutoutCanvas = null,
    removeBackground = true,
    targetWidth = 600,
    targetHeight = 600,
    scale = 1.0,
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
    bgColor = '#FFFFFF',
    brightness = 100,
    contrast = 100,
    suitKey = 'none',
    suitScale = 1.0,
    suitOffsetY = 0,
    quality = 0.96
  }) {
    let img;
    if (typeof imageFileOrUrl === 'string') {
      img = await UIUtils.loadImage(imageFileOrUrl);
    } else if (imageFileOrUrl instanceof HTMLImageElement || imageFileOrUrl instanceof HTMLCanvasElement) {
      img = imageFileOrUrl;
    } else {
      const dataUrl = await UIUtils.readFileAsDataURL(imageFileOrUrl);
      img = await UIUtils.loadImage(dataUrl);
    }

    // Determine drawable source: cutout isolated person or original
    const drawSource = (removeBackground && cutoutCanvas) ? cutoutCanvas : img;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // 1. Draw solid chosen studio background color
    ctx.fillStyle = bgColor || '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // 2. Draw portrait with scale, pan, rotation, brightness & contrast
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(targetWidth / 2 + offsetX, targetHeight / 2 + offsetY);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    const imgW = drawSource.naturalWidth || drawSource.width;
    const imgH = drawSource.naturalHeight || drawSource.height;
    const baseScale = Math.max(targetWidth / imgW, targetHeight / imgH);
    const finalScale = baseScale * scale;
    const drawW = imgW * finalScale;
    const drawH = imgH * finalScale;

    ctx.drawImage(drawSource, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 3. Draw Suit Overlay if enabled
    if (suitKey && suitKey !== 'none' && this.SUIT_TEMPLATES[suitKey]) {
      try {
        const suitInfo = this.SUIT_TEMPLATES[suitKey];
        const suitSvgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(suitInfo.svg);
        const suitImg = await UIUtils.loadImage(suitSvgData);

        ctx.save();
        const sW = targetWidth * 1.05 * suitScale;
        const sH = (sW * 240) / 400;
        const sX = (targetWidth - sW) / 2;
        const sY = targetHeight - sH + suitOffsetY;
        ctx.drawImage(suitImg, sX, sY, sW, sH);
        ctx.restore();
      } catch (err) {
        console.warn('Suit render fallback:', err);
      }
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    return {
      canvas,
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      blob,
      width: targetWidth,
      height: targetHeight
    };
  },

  // Generate 4x6" Printable Grid Sheet (1800 x 1200 px @ 300 DPI)
  async generate4x6Sheet(photoCanvas) {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 1800; // 6 inches @ 300 DPI
    sheetCanvas.height = 1200; // 4 inches @ 300 DPI
    const ctx = sheetCanvas.getContext('2d');

    // Clean white photo paper
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pw = photoCanvas.width;
    const ph = photoCanvas.height;

    // Layout configuration
    let cols = 4;
    let rows = 2;
    if (pw === ph) {
      // 2x2 inch -> 6 photos (3 cols x 2 rows)
      cols = 3;
      rows = 2;
    } else {
      // 35x45mm -> 8 photos (4 cols x 2 rows)
      cols = 4;
      rows = 2;
    }

    const marginX = 80;
    const marginY = 80;
    const availW = sheetCanvas.width - 2 * marginX;
    const availH = sheetCanvas.height - 2 * marginY;

    const targetScale = Math.min(
      (availW / cols - 30) / pw,
      (availH / rows - 30) / ph
    );
    const itemW = pw * targetScale;
    const itemH = ph * targetScale;

    const gapX = (availW - cols * itemW) / (cols + 1);
    const gapY = (availH - rows * itemH) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + gapX + c * (itemW + gapX);
        const y = marginY + gapY + r * (itemH + gapY);

        ctx.drawImage(photoCanvas, x, y, itemW, itemH);

        // Cutting outline marks
        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, itemW, itemH);

        // Corner crop marks
        const markLen = 8;
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        // Top-left
        ctx.beginPath();
        ctx.moveTo(x - markLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y - markLen);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + itemW + markLen, y); ctx.lineTo(x + itemW, y); ctx.lineTo(x + itemW, y - markLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x - markLen, y + itemH); ctx.lineTo(x, y + itemH); ctx.lineTo(x, y + itemH + markLen);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + itemW + markLen, y + itemH); ctx.lineTo(x + itemW, y + itemH); ctx.lineTo(x + itemW, y + itemH + markLen);
        ctx.stroke();

        ctx.restore();
      }
    }

    // Micro footer branding
    ctx.font = '500 14px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Official Biometric Photo Sheet (4x6" @ 300 DPI) • 100% Private RAM', sheetCanvas.width / 2, sheetCanvas.height - 20);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.98));
    return {
      canvas: sheetCanvas,
      blob,
      dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.98)
    };
  },

  // Generate A4 Printable Grid Sheet (2480 x 3508 px @ 300 DPI)
  async generateA4Sheet(photoCanvas) {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 2480;
    sheetCanvas.height = 3508;
    const ctx = sheetCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pw = photoCanvas.width;
    const ph = photoCanvas.height;

    let cols = 4;
    let rows = 6;
    if (pw === ph) {
      cols = 4;
      rows = 5;
    }

    const marginX = 140;
    const marginY = 180;
    const availW = sheetCanvas.width - 2 * marginX;
    const availH = sheetCanvas.height - 2 * marginY;

    const targetScale = Math.min((availW / cols - 40) / pw, (availH / rows - 40) / ph);
    const itemW = pw * targetScale;
    const itemH = ph * targetScale;

    const gapX = (availW - cols * itemW) / (cols + 1);
    const gapY = (availH - rows * itemH) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + gapX + c * (itemW + gapX);
        const y = marginY + gapY + r * (itemH + gapY);
        ctx.drawImage(photoCanvas, x, y, itemW, itemH);

        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, itemW, itemH);
        ctx.restore();
      }
    }

    // A4 Header & Footer
    ctx.font = '800 26px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL BIOMETRIC PASSPORT & VISA PHOTO SHEET', sheetCanvas.width / 2, 100);

    ctx.font = '600 16px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Generated with LocalDoc (100% In-Browser RAM Execution) • Standard A4 300 DPI', sheetCanvas.width / 2, 134);

    ctx.fillText('Scissors trimming lines included around each photograph.', sheetCanvas.width / 2, sheetCanvas.height - 60);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.98));
    return { canvas: sheetCanvas, blob, dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.98) };
  },

  // 2-in-1 Double Sided ID Card Sheet on A4 (Standard CNIC / ID-1 Format)
  async generate2in1IDCardSheet({
    frontImageOrUrl,
    backImageOrUrl,
    docTitle = 'IDENTITY CARD PHOTOCOPY / VERIFICATION SHEET',
    frontRotation = 0,
    backRotation = 0,
    includeVerificationBox = true
  }) {
    const frontImg = typeof frontImageOrUrl === 'string' ? await UIUtils.loadImage(frontImageOrUrl) : await UIUtils.loadImage(await UIUtils.readFileAsDataURL(frontImageOrUrl));
    const backImg = typeof backImageOrUrl === 'string' ? await UIUtils.loadImage(backImageOrUrl) : await UIUtils.loadImage(await UIUtils.readFileAsDataURL(backImageOrUrl));

    const canvas = document.createElement('canvas');
    canvas.width = 2480; // A4 at 300 DPI (210mm)
    canvas.height = 3508; // A4 at 300 DPI (297mm)
    const ctx = canvas.getContext('2d');

    // Clean white A4 page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Official Header Banner
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 34px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(docTitle.toUpperCase(), canvas.width / 2, 210);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 18px "Outfit", Arial, sans-serif';
    ctx.fillText('OFFICIAL 100% SCALE ID CARD PHOTOCOPY • PROCESSED IN CLIENT-SIDE RAM', canvas.width / 2, 255);

    // Subtle divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 295);
    ctx.lineTo(canvas.width - 250, 295);
    ctx.stroke();

    // Official ISO/IEC 7810 ID-1 Standard Dimensions (85.60mm x 53.98mm @ 300 DPI = exact 1011 x 638 px)
    const cardTargetW = 1011;
    const cardTargetH = 638;
    const centerX = (canvas.width - cardTargetW) / 2;

    // Helper to draw oriented image inside card box
    const drawOrientedCard = (img, x, y, w, h, rotationDeg) => {
      ctx.save();
      // Draw crisp background card container
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, y, w, h);

      // Card border
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Clip inside box
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      ctx.translate(x + w / 2, y + h / 2);
      if (rotationDeg !== 0) {
        ctx.rotate((rotationDeg * Math.PI) / 180);
      }

      let drawImgW = img.naturalWidth;
      let drawImgH = img.naturalHeight;
      const isRotated90 = (Math.abs(rotationDeg) % 180 === 90);
      if (isRotated90) {
        const temp = drawImgW; drawImgW = drawImgH; drawImgH = temp;
      }

      const scale = Math.min(w / drawImgW, h / drawImgH);
      const finalW = img.naturalWidth * scale;
      const finalH = img.naturalHeight * scale;

      ctx.drawImage(img, -finalW / 2, -finalH / 2, finalW, finalH);
      ctx.restore();
    };

    // 1. FRONT CARD SECTION
    const frontY = 480;
    ctx.fillStyle = '#0284C7';
    ctx.font = '800 22px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('1. FRONT SIDE OF CARD', centerX, frontY - 18);

    drawOrientedCard(frontImg, centerX, frontY, cardTargetW, cardTargetH, frontRotation);

    // 2. BACK CARD SECTION
    const backY = 1450;
    ctx.fillStyle = '#0284C7';
    ctx.font = '800 22px "Outfit", Arial, sans-serif';
    ctx.fillText('2. BACK SIDE OF CARD', centerX, backY - 18);

    drawOrientedCard(backImg, centerX, backY, cardTargetW, cardTargetH, backRotation);

    // 3. Verification & Attestation Box
    if (includeVerificationBox) {
      const verifY = 2420;
      ctx.save();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(centerX, verifY, cardTargetW, 440);
      ctx.restore();

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 18px "Outfit", Arial, sans-serif';
      ctx.fillText('SIGNATURE / OFFICIAL ATTESTATION & VERIFICATION', centerX + 30, verifY + 45);

      ctx.fillStyle = '#64748B';
      ctx.font = '500 16px "Outfit", Arial, sans-serif';
      ctx.fillText('I hereby certify that this is a true and accurate copy of the original identity card.', centerX + 30, verifY + 80);

      ctx.font = '600 16px "Outfit", Arial, sans-serif';
      ctx.fillText('Signature: ___________________________', centerX + 30, verifY + 380);
      ctx.fillText('Date: ____________', centerX + 560, verifY + 380);
      ctx.fillText('Official Stamp / Seal:', centerX + cardTargetW - 320, verifY + 380);
    }

    // Footer Branding
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 16px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Private Zero-Upload Document Architecture • 100% In-Browser RAM', canvas.width / 2, canvas.height - 80);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.98));
    return {
      canvas,
      blob,
      dataUrl: canvas.toDataURL('image/jpeg', 0.98)
    };
  },

  // Convert any canvas to client-side high-resolution PDF Blob
  async canvasToPdfBlob(canvas) {
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      const pdfDoc = await window.PDFLib.PDFDocument.create();
      // Standard A4 in PDF points: 595.28 x 841.89
      const page = pdfDoc.addPage([595.28, 841.89]);
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const jpgImageBytes = await fetch(jpgDataUrl).then(res => res.arrayBuffer());
      const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);
      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89
      });
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }
    return null;
  }
};

window.IDPhoto = IDPhoto;
