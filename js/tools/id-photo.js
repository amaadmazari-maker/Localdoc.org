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
          modelSelection: 1, // 1 for high quality portrait
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
  async segmentPerson(imgElement, { edgeFeather = 2, threshold = 0.5 } = {}) {
    if (!imgElement) return null;

    const w = imgElement.naturalWidth || imgElement.width || 600;
    const h = imgElement.naturalHeight || imgElement.height || 600;

    // Try MediaPipe Selfie Segmentation first (WASM in RAM)
    if (typeof window.SelfieSegmentation !== 'undefined') {
      try {
        const segmenter = await this.initSegmenter();
        if (segmenter) {
          const maskPromise = new Promise((resolve) => {
            segmenter.onResults((results) => {
              if (results && results.segmentationMask) {
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = w;
                maskCanvas.height = h;
                const mCtx = maskCanvas.getContext('2d');
                mCtx.drawImage(results.segmentationMask, 0, 0, w, h);
                resolve(maskCanvas);
              } else {
                resolve(null);
              }
            });
          });

          await segmenter.send({ image: imgElement });
          const maskCanvas = await maskPromise;
          if (maskCanvas) {
            return this.applyMaskToImage(imgElement, maskCanvas, edgeFeather);
          }
        }
      } catch (err) {
        console.warn('MediaPipe execution fallback:', err);
      }
    }

    // High-precision adaptive Canvas Matting fallback (100% offline, zero network dependencies)
    return this.fallbackCanvasMatting(imgElement, { edgeFeather, threshold });
  },

  // Pure Client-Side Adaptive Canvas Background Matting Algorithm
  fallbackCanvasMatting(imgElement, { edgeFeather = 3, threshold = 0.45 } = {}) {
    const w = imgElement.naturalWidth || imgElement.width || 600;
    const h = imgElement.naturalHeight || imgElement.height || 600;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(imgElement, 0, 0, w, h);

    const imgData = srcCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Sample perimeter background colors (top, left, right borders)
    const samples = [];
    const sampleBorder = (x, y) => {
      const idx = (y * w + x) * 4;
      samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    };

    const stepX = Math.max(1, Math.floor(w / 40));
    const stepY = Math.max(1, Math.floor(h / 40));

    // Top border
    for (let x = 0; x < w; x += stepX) {
      for (let y = 0; y < Math.min(h * 0.15, 30); y += 4) sampleBorder(x, y);
    }
    // Left & right upper borders
    for (let y = 0; y < h * 0.6; y += stepY) {
      for (let x = 0; x < Math.min(w * 0.12, 25); x += 4) sampleBorder(x, y);
      for (let x = Math.max(0, w - Math.min(w * 0.12, 25)); x < w; x += 4) sampleBorder(x, y);
    }

    let meanR = 0, meanG = 0, meanB = 0;
    samples.forEach(s => { meanR += s.r; meanG += s.g; meanB += s.b; });
    const n = Math.max(1, samples.length);
    meanR /= n; meanG /= n; meanB /= n;

    // Create Cutout Output Canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    const outImgData = outCtx.createImageData(w, h);
    const outData = outImgData.data;

    const centerX = w / 2;
    const headCenterY = h * 0.42;
    const radiusX = w * 0.38;
    const radiusY = h * 0.48;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Normalized distance from center portrait zone
        const dx = (x - centerX) / radiusX;
        const dy = (y - headCenterY) / radiusY;
        const centerDist = dx * dx + dy * dy;

        // Color difference from sampled room background
        const colorDiff = Math.hypot(r - meanR, g - meanG, b - meanB);

        // Skin detection heuristic in RGB space
        const isSkin = (r > 60 && g > 35 && b > 20 && (r - g) > 8 && r > b);
        const isDarkHairOrClothes = (r < 65 && g < 65 && b < 65 && centerDist < 1.4);

        let alpha = 255;
        if (centerDist > 1.6) {
          alpha = Math.max(0, Math.min(255, (colorDiff - 30) * 3));
        } else if (centerDist > 0.8) {
          if (isSkin || isDarkHairOrClothes) {
            alpha = 255;
          } else {
            const bgLikelihood = Math.max(0, Math.min(1, (65 - colorDiff) / 45));
            alpha = Math.round(255 * (1 - bgLikelihood));
          }
        } else {
          alpha = 255;
        }

        outData[idx] = r;
        outData[idx + 1] = g;
        outData[idx + 2] = b;
        outData[idx + 3] = alpha;
      }
    }

    outCtx.putImageData(outImgData, 0, 0);
    return outCanvas;
  },

  // Apply a segmentation mask canvas to an image element to produce transparent cutout canvas
  applyMaskToImage(imgElement, maskCanvas, featherPx = 2) {
    const w = imgElement.naturalWidth || imgElement.width;
    const h = imgElement.naturalHeight || imgElement.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 1. Draw original photo
    ctx.drawImage(imgElement, 0, 0, w, h);

    // 2. Mask with segmentation alpha
    ctx.globalCompositeOperation = 'destination-in';
    if (featherPx > 0) {
      ctx.filter = `blur(${featherPx}px)`;
    }
    ctx.drawImage(maskCanvas, 0, 0, w, h);
    ctx.filter = 'none';
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
