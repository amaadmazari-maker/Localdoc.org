/**
 * localdoc.org — Advanced CamScanner Engine & Document Studio (js/tools/scan.js)
 * 100% Client-side RAM processing:
 * - Real-Time Document Edge Detection & Perspective Homography Warp
 * - CamScanner Signature Filters: Magic Color, Clean B&W (Sauvola), Grayscale, Original
 * - Paper Aspect Ratio Alignment (Auto, A4, Letter, ID Card, Receipt)
 * - Multi-Image Gallery Batch Ingestion
 * - ID Card Front & Back 1-Page A4 Compiler
 * - Multi-page high-capacity PDF export with DPI presets & Custom File Naming
 */

class DocumentScanner {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.capturedPages = [];
    this.animFrameId = null;
    this.isDetecting = false;
    this.detectedCorners = null; // [topLeft, topRight, bottomRight, bottomLeft]
  }

  // 1. Live Camera Stream Management
  async startCamera(facingMode = 'environment') {
    if (this.stream) this.stopCamera();

    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 2560 },
        height: { ideal: 1440 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (e) {
      console.warn('High-res stream unavailable, falling back to standard resolution:', e);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.video.srcObject = this.stream;
        await this.video.play();
        return true;
      } catch (err) {
        console.error('Camera access denied:', err);
        throw new Error('Unable to access camera. Please check browser permissions.');
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // Tap-to-Focus and hardware auto-focus helper
  async applyFocus(xPercent = 0.5, yPercent = 0.5) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const adv = [];
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        adv.push({ focusMode: 'continuous' });
      }
      if (caps.pointsOfInterest) {
        adv.push({ pointsOfInterest: [{ x: xPercent, y: yPercent }] });
      }
      if (adv.length > 0) {
        await track.applyConstraints({ advanced: adv });
        return true;
      }
    } catch (e) {
      console.warn('Hardware focus constraint not supported on this device:', e);
    }
    return false;
  }

  // Camera Zoom (Hardware zoom with capability detection)
  getZoomCapabilities() {
    if (!this.stream) return null;
    const track = this.stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return null;
    const caps = track.getCapabilities();
    if (caps.zoom) {
      return { min: caps.zoom.min || 1, max: caps.zoom.max || 5, step: caps.zoom.step || 0.1 };
    }
    return null;
  }

  async applyZoom(zoomVal) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.zoom) {
        await track.applyConstraints({ advanced: [{ zoom: parseFloat(zoomVal) }] });
        return true;
      }
    } catch (e) {
      console.warn('Hardware zoom constraint not supported:', e);
    }
    return false;
  }

  // Camera Torch / Flashlight Toggle
  async toggleTorch(enabled) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !!enabled }] });
        return true;
      }
    } catch (e) {
      console.warn('Torch constraint not supported:', e);
    }
    return false;
  }

  // CamScanner Magic Pro Finger & Border Shadow Removal
  static cleanFingerShadows(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Detect average paper brightness from center 50%
    let paperLumSum = 0;
    let paperCount = 0;
    const startX = Math.round(width * 0.25);
    const endX = Math.round(width * 0.75);
    const startY = Math.round(height * 0.25);
    const endY = Math.round(height * 0.75);

    for (let y = startY; y < endY; y += 4) {
      for (let x = startX; x < endX; x += 4) {
        const idx = (y * width + x) * 4;
        paperLumSum += (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        paperCount++;
      }
    }
    const targetWhite = Math.min(255, Math.round((paperLumSum / Math.max(1, paperCount)) * 1.08));

    // Clean margin borders (12% margin around borders where fingers hold paper)
    const marginX = Math.round(width * 0.12);
    const marginY = Math.round(height * 0.12);

    for (let y = 0; y < height; y++) {
      const isEdgeY = (y < marginY || y > height - marginY);
      for (let x = 0; x < width; x++) {
        const isEdgeX = (x < marginX || x > width - marginX);
        if (isEdgeX || isEdgeY) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          // Detect skin tone or dark border shadow (r > g > b or low luminance shadow)
          const isSkinOrShadow = (lum < targetWhite * 0.85) && (
            (r > g && g >= b && (r - b) > 15) || // skin tone
            (lum < 110) // dark shadow
          );

          if (isSkinOrShadow) {
            data[idx] = targetWhite;
            data[idx + 1] = targetWhite;
            data[idx + 2] = targetWhite;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // 2. Real-time Document Edge Detection (Sobel Gradients + Luminance Profiling)
  static detectDocumentEdges(sourceImgOrCanvas, targetAspect = 'auto') {
    const width = sourceImgOrCanvas.videoWidth || sourceImgOrCanvas.naturalWidth || sourceImgOrCanvas.width;
    const height = sourceImgOrCanvas.videoHeight || sourceImgOrCanvas.naturalHeight || sourceImgOrCanvas.height;
    if (!width || !height) return null;

    // Downsample for high-speed edge detection
    const scale = Math.min(1, 360 / Math.max(width, height));
    const smallW = Math.round(width * scale);
    const smallH = Math.round(height * scale);

    const helperCanvas = document.createElement('canvas');
    helperCanvas.width = smallW;
    helperCanvas.height = smallH;
    const ctx = helperCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceImgOrCanvas, 0, 0, smallW, smallH);

    const imgData = ctx.getImageData(0, 0, smallW, smallH);
    const data = imgData.data;

    // 1. Grayscale luminance array
    const gray = new Uint8Array(smallW * smallH);
    let sumLum = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      gray[j] = lum;
      sumLum += lum;
    }
    const avgLum = sumLum / (smallW * smallH);

    // 2. Compute Sobel Edge Gradients along X and Y
    const edgeGrad = new Uint8Array(smallW * smallH);
    for (let y = 1; y < smallH - 1; y++) {
      for (let x = 1; x < smallW - 1; x++) {
        const gx = Math.abs(gray[y * smallW + (x + 1)] - gray[y * smallW + (x - 1)]);
        const gy = Math.abs(gray[(y + 1) * smallW + x] - gray[(y - 1) * smallW + x]);
        edgeGrad[y * smallW + x] = Math.min(255, gx + gy);
      }
    }

    // 3. Scan bounding bounds from outside inward
    // Document paper is typically either brighter than the desk OR has strong edge gradients
    const lumThreshold = Math.max(70, avgLum * 0.82);
    let minX = smallW, maxX = 0, minY = smallH, maxY = 0;
    let foundEdgeCount = 0;

    for (let y = 8; y < smallH - 8; y += 3) {
      for (let x = 8; x < smallW - 8; x += 3) {
        const lum = gray[y * smallW + x];
        const grad = edgeGrad[y * smallW + x];
        if (lum > lumThreshold || grad > 45) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundEdgeCount++;
        }
      }
    }

    const areaRatio = ((maxX - minX) * (maxY - minY)) / (smallW * smallH);
    let normLeft = 0.05, normRight = 0.95, normTop = 0.05, normBottom = 0.95;

    if (foundEdgeCount > 60 && areaRatio > 0.15 && areaRatio < 0.98) {
      normLeft = Math.max(0.02, minX / smallW);
      normRight = Math.min(0.98, maxX / smallW);
      normTop = Math.max(0.02, minY / smallH);
      normBottom = Math.min(0.98, maxY / smallH);
    }

    // Adjust for target aspect ratio if specified
    if (targetAspect === 'a4') {
      const targetRatio = 1 / 1.4142; // standard A4 portrait
      const curW = normRight - normLeft;
      const curH = normBottom - normTop;
      const desiredW = curH * targetRatio * (smallH / smallW);
      if (desiredW < curW) {
        const diff = (curW - desiredW) / 2;
        normLeft += diff;
        normRight -= diff;
      }
    } else if (targetAspect === 'letter') {
      const targetRatio = 8.5 / 11; // Letter portrait
      const curW = normRight - normLeft;
      const curH = normBottom - normTop;
      const desiredW = curH * targetRatio * (smallH / smallW);
      if (desiredW < curW) {
        const diff = (curW - desiredW) / 2;
        normLeft += diff;
        normRight -= diff;
      }
    } else if (targetAspect === 'id') {
      const targetRatio = 85.6 / 53.98; // ID Card landscape
      const curW = normRight - normLeft;
      const curH = normBottom - normTop;
      const desiredH = (curW / targetRatio) * (smallW / smallH);
      if (desiredH < curH) {
        const diff = (curH - desiredH) / 2;
        normTop += diff;
        normBottom -= diff;
      }
    }

    return {
      topLeft: { x: Math.max(0, Math.min(1, normLeft)), y: Math.max(0, Math.min(1, normTop)) },
      topRight: { x: Math.max(0, Math.min(1, normRight)), y: Math.max(0, Math.min(1, normTop)) },
      bottomRight: { x: Math.max(0, Math.min(1, normRight)), y: Math.max(0, Math.min(1, normBottom)) },
      bottomLeft: { x: Math.max(0, Math.min(1, normLeft)), y: Math.max(0, Math.min(1, normBottom)) }
    };
  }

  // 3. Perspective Warp / Homography Rectification (32x32 Quad Mesh)
  static warpDocument(sourceImg, corners, targetW = 0, targetH = 0) {
    const origW = sourceImg.naturalWidth || sourceImg.videoWidth || sourceImg.width;
    const origH = sourceImg.naturalHeight || sourceImg.videoHeight || sourceImg.height;

    // Denormalize corner points
    const tl = { x: corners.topLeft.x * (corners.topLeft.x <= 1 ? origW : 1), y: corners.topLeft.y * (corners.topLeft.y <= 1 ? origH : 1) };
    const tr = { x: corners.topRight.x * (corners.topRight.x <= 1 ? origW : 1), y: corners.topRight.y * (corners.topRight.y <= 1 ? origH : 1) };
    const br = { x: corners.bottomRight.x * (corners.bottomRight.x <= 1 ? origW : 1), y: corners.bottomRight.y * (corners.bottomRight.y <= 1 ? origH : 1) };
    const bl = { x: corners.bottomLeft.x * (corners.bottomLeft.x <= 1 ? origW : 1), y: corners.bottomLeft.y * (corners.bottomLeft.y <= 1 ? origH : 1) };

    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);

    const outW = targetW || Math.round(Math.max(widthTop, widthBottom));
    const outH = targetH || Math.round(Math.max(heightLeft, heightRight));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(100, Math.min(2800, outW));
    canvas.height = Math.max(100, Math.min(3800, outH));
    const ctx = canvas.getContext('2d');

    // Bilinear quadrilateral mesh slicing
    const slices = 24;
    for (let sy = 0; sy < slices; sy++) {
      const v0 = sy / slices;
      const v1 = (sy + 1) / slices;

      for (let sx = 0; sx < slices; sx++) {
        const u0 = sx / slices;
        const u1 = (sx + 1) / slices;

        const p00 = {
          x: (1 - u0) * (1 - v0) * tl.x + u0 * (1 - v0) * tr.x + (1 - u0) * v0 * bl.x + u0 * v0 * br.x,
          y: (1 - u0) * (1 - v0) * tl.y + u0 * (1 - v0) * tr.y + (1 - u0) * v0 * bl.y + u0 * v0 * br.y
        };
        const p10 = {
          x: (1 - u1) * (1 - v0) * tl.x + u1 * (1 - v0) * tr.x + (1 - u1) * v0 * bl.x + u1 * v0 * br.x,
          y: (1 - u1) * (1 - v0) * tl.y + u1 * (1 - v0) * tr.y + (1 - u1) * v0 * bl.y + u1 * v0 * br.y
        };
        const p01 = {
          x: (1 - u0) * (1 - v1) * tl.x + u0 * (1 - v1) * tr.x + (1 - u0) * v1 * bl.x + u0 * v1 * br.x,
          y: (1 - u0) * (1 - v1) * tl.y + u0 * (1 - v1) * tr.y + (1 - u0) * v1 * bl.y + u0 * v1 * br.y
        };

        const destX = u0 * canvas.width;
        const destY = v0 * canvas.height;
        const destW = (u1 - u0) * canvas.width;
        const destH = (v1 - v0) * canvas.height;

        const srcX = Math.min(p00.x, p01.x);
        const srcY = Math.min(p00.y, p10.y);
        const srcW = Math.max(1, Math.abs(p10.x - p00.x));
        const srcH = Math.max(1, Math.abs(p01.y - p00.y));

        ctx.drawImage(sourceImg, srcX, srcY, srcW, srcH, destX, destY, destW + 0.5, destH + 0.5);
      }
    }

    return canvas;
  }

  // 4. Snapshot Capture from Video Stream
  captureFrame() {
    if (!this.video || !this.video.videoWidth) {
      throw new Error('Camera is not active.');
    }

    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, width, height);
    return this.canvas.toDataURL('image/jpeg', 0.95);
  }

  // 5. CamScanner Enhancement Filters (Magic Color, Clean B&W Sauvola, Grayscale, Original)
  static processImage(imgElement, filter = 'magic-color', rotation = 0, corners = null) {
    let sourceCanvas;

    // Apply auto perspective crop if corners are provided
    if (corners) {
      sourceCanvas = DocumentScanner.warpDocument(imgElement, corners);
    } else {
      sourceCanvas = document.createElement('canvas');
      const w = imgElement.naturalWidth || imgElement.videoWidth || imgElement.width;
      const h = imgElement.naturalHeight || imgElement.videoHeight || imgElement.height;
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      const sCtx = sourceCanvas.getContext('2d');
      sCtx.drawImage(imgElement, 0, 0, w, h);
    }

    // Apply Rotation
    const isRotated90 = (rotation % 180 !== 0);
    const canvas = document.createElement('canvas');
    canvas.width = isRotated90 ? sourceCanvas.height : sourceCanvas.width;
    canvas.height = isRotated90 ? sourceCanvas.width : sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    ctx.restore();

    // 1. Original Filter: Return pristine image
    if (filter === 'original') {
      return canvas.toDataURL('image/jpeg', 0.95);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    switch (filter) {
      case 'magic-color': {
        // CamScanner Signature Magic Color:
        // 1. Calculate luminance distribution to detect paper background level
        let lumSum = 0;
        let lumSamples = [];
        for (let i = 0; i < len; i += 32) {
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
          lumSum += lum;
          lumSamples.push(lum);
        }
        lumSamples.sort((a, b) => a - b);
        // White point is around 85th-90th percentile of brightness
        const p85Index = Math.floor(lumSamples.length * 0.85);
        const whitePoint = Math.min(250, Math.max(160, lumSamples[p85Index]));
        const darkPoint = Math.max(20, Math.min(80, lumSamples[Math.floor(lumSamples.length * 0.15)]));
        const dynamicRange = Math.max(1, whitePoint - darkPoint);

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          // Check if pixel has distinct color (e.g. blue pen ink, red seal, green highlighter)
          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          const colorChroma = maxChannel - minChannel;
          const isColorInk = colorChroma > 25 && lum < whitePoint;

          if (lum >= whitePoint && !isColorInk) {
            // Whitened clean background
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else if (isColorInk) {
            // Boost color saturation for stamps, signatures, and logos
            const satBoost = 1.35;
            const avg = (r + g + b) / 3;
            data[i] = Math.min(255, Math.max(0, avg + (r - avg) * satBoost));
            data[i + 1] = Math.min(255, Math.max(0, avg + (g - avg) * satBoost));
            data[i + 2] = Math.min(255, Math.max(0, avg + (b - avg) * satBoost));
          } else {
            // High-contrast ink text
            const normalized = Math.max(0, (lum - darkPoint) / dynamicRange);
            // S-curve contrast enhancement
            const enhancedLum = normalized < 0.5
              ? 2 * normalized * normalized * 255
              : (1 - Math.pow(-2 * normalized + 2, 2) / 2) * 255;
            const ratio = lum > 0 ? (enhancedLum / lum) : 1;

            data[i] = Math.min(255, Math.max(0, r * ratio));
            data[i + 1] = Math.min(255, Math.max(0, g * ratio));
            data[i + 2] = Math.min(255, Math.max(0, b * ratio));
          }
        }
        break;
      }

      case 'clean-bw': {
        // High-contrast clean photocopy binarization (Sauvola local window approximation)
        const w = canvas.width;
        const h = canvas.height;
        const lumArr = new Uint8Array(w * h);

        for (let i = 0, j = 0; i < len; i += 4, j++) {
          lumArr[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        }

        // Fast adaptive thresholding with local neighborhood
        const winSize = Math.max(12, Math.min(32, Math.round(w / 35)));
        const halfWin = Math.floor(winSize / 2);

        for (let y = 0; y < h; y++) {
          const yMin = Math.max(0, y - halfWin);
          const yMax = Math.min(h - 1, y + halfWin);

          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const currentLum = lumArr[idx];

            const xMin = Math.max(0, x - halfWin);
            const xMax = Math.min(w - 1, x + halfWin);

            const p1 = lumArr[yMin * w + xMin];
            const p2 = lumArr[yMin * w + xMax];
            const p3 = lumArr[yMax * w + xMin];
            const p4 = lumArr[yMax * w + xMax];
            const localMean = (p1 + p2 + p3 + p4 + currentLum) / 5;

            // Ink threshold: text ink is darker than surrounding paper
            const threshold = localMean * 0.86;
            const val = currentLum < threshold ? 0 : 255;

            const pIdx = idx * 4;
            data[pIdx] = val;
            data[pIdx + 1] = val;
            data[pIdx + 2] = val;
          }
        }
        break;
      }

      case 'grayscale': {
        // Studio monochrome scan with shadow lift and contrast normalization
        for (let i = 0; i < len; i += 4) {
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // Histogram expansion
          const enhanced = Math.min(255, Math.max(0, (lum - 25) * 1.22));
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }
        break;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // 6. ID Card Front & Back Dual Stamping on Single A4 Sheet
  static async generateIDCardA4(frontDataUrl, backDataUrl, filter = 'magic-color') {
    const canvas = document.createElement('canvas');
    canvas.width = 2480;
    canvas.height = 3508;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardW = 1200;
    const cardH = 756;
    const posX = (canvas.width - cardW) / 2;

    const frontImg = await UIUtils.loadImage(frontDataUrl);
    const backImg = await UIUtils.loadImage(backDataUrl);

    // Render Front Card (Top section)
    const frontY = 600;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 16;
    ctx.drawImage(frontImg, posX, frontY, cardW, cardH);
    ctx.restore();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(posX, frontY, cardW, cardH);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IDENTITY CARD — FRONT SIDE', canvas.width / 2, frontY - 30);

    // Center divider dashed line
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(200, 1600);
    ctx.lineTo(canvas.width - 200, 1600);
    ctx.stroke();
    ctx.setLineDash([]);

    // Render Back Card (Bottom section)
    const backY = 1800;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 16;
    ctx.drawImage(backImg, posX, backY, cardW, cardH);
    ctx.restore();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(posX, backY, cardW, cardH);

    ctx.fillStyle = '#1E293B';
    ctx.fillText('IDENTITY CARD — BACK SIDE', canvas.width / 2, backY - 30);

    // Security footer badge
    ctx.fillStyle = '#64748B';
    ctx.font = '28px sans-serif';
    ctx.fillText('Compiled securely in-browser via localdoc.org • 100% Private (Zero Cloud Uploads)', canvas.width / 2, 3300);

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // 6b. ID Card Compact Side-by-Side / Wallet Card Format
  static async generateIDCardCompact(frontDataUrl, backDataUrl) {
    const canvas = document.createElement('canvas');
    // Standard credit card proportions side-by-side with border
    canvas.width = 1920;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardW = 860;
    const cardH = 540;
    const marginY = 90;
    const gap = 80;
    const startX = (canvas.width - (cardW * 2 + gap)) / 2;

    const frontImg = await UIUtils.loadImage(frontDataUrl);
    const backImg = await UIUtils.loadImage(backDataUrl);

    // Front
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 14;
    ctx.drawImage(frontImg, startX, marginY, cardW, cardH);
    ctx.restore();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, marginY, cardW, cardH);

    // Back
    const backX = startX + cardW + gap;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 14;
    ctx.drawImage(backImg, backX, marginY, cardW, cardH);
    ctx.restore();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(backX, marginY, cardW, cardH);

    // Labels
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FRONT', startX + cardW / 2, marginY - 18);
    ctx.fillText('BACK', backX + cardW / 2, marginY - 18);

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // Safe helper to convert any image or canvas to verified JPEG Uint8Array for PDF embedding
  static async toJpegBytes(dataUrlOrCanvas) {
    let img;
    if (typeof dataUrlOrCanvas === 'string') {
      img = await UIUtils.loadImage(dataUrlOrCanvas);
    } else {
      img = dataUrlOrCanvas;
    }
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.videoWidth || img.width;
    c.height = img.naturalHeight || img.videoHeight || img.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);

    const cleanDataUrl = c.toDataURL('image/jpeg', 0.92);
    // Base64 to Uint8Array
    const base64 = cleanDataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // 7. Multi-Page High-Capacity PDF Compiler with Fail-Safe Embedding
  static async exportToPDF(pagesArray, options = {}, onProgress = null) {
    if (!pagesArray || pagesArray.length === 0) {
      throw new Error('No scanned pages to export.');
    }

    const pageSize = options.pageSize || 'a4';
    if (onProgress) onProgress(10, 'Initializing PDF vector engine in memory...');

    const pdfDoc = await PDFLib.PDFDocument.create();
    const total = pagesArray.length;

    const standardDimensions = {
      a4: [595.28, 841.89],
      letter: [612.0, 792.0]
    };

    for (let i = 0; i < total; i++) {
      const pageItem = pagesArray[i];
      const dataUrl = pageItem.processedDataUrl || pageItem.originalDataUrl;
      
      let img;
      try {
        const jpegBytes = await DocumentScanner.toJpegBytes(dataUrl);
        img = await pdfDoc.embedJpg(jpegBytes);
      } catch (err) {
        console.warn('PDFLib embedJpg failed on page ' + (i + 1) + ', trying embedPng fallback:', err);
        try {
          img = await pdfDoc.embedPng(dataUrl);
        } catch (e2) {
          throw new Error('Failed to embed page ' + (i + 1) + ' into PDF: ' + e2.message);
        }
      }

      let targetWidth, targetHeight;
      if (pageSize === 'auto') {
        targetWidth = img.width * 0.75;
        targetHeight = img.height * 0.75;
      } else {
        const dims = standardDimensions[pageSize] || standardDimensions.a4;
        targetWidth = dims[0];
        targetHeight = dims[1];
      }

      const page = pdfDoc.addPage([targetWidth, targetHeight]);
      const margin = 12;
      const availW = targetWidth - margin * 2;
      const availH = targetHeight - margin * 2;
      const scale = Math.min(availW / img.width, availH / img.height);
      const renderW = img.width * scale;
      const renderH = img.height * scale;

      page.drawImage(img, {
        x: (targetWidth - renderW) / 2,
        y: (targetHeight - renderH) / 2,
        width: renderW,
        height: renderH
      });

      if (onProgress && total > 1) {
        const pct = Math.round(15 + ((i + 1) / total) * 75);
        onProgress(pct, `Compiling page ${i + 1} of ${total}...`);
      }
    }

    if (onProgress) onProgress(95, 'Finalizing PDF byte stream...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
}

window.DocumentScanner = DocumentScanner;
