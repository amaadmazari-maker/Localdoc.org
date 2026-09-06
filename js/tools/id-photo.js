/**
 * localdoc.org — Biometric ID & Photo Studio Engine (js/tools/id-photo.js)
 * High-precision biometric passport/visa photo cropping, multi-copy print sheet generation (4x6", A4),
 * and 2-in-1 Front & Back ID Card composite compilation on 1-Page A4 with zero uploads.
 */

const IDPhoto = {
  // Preset definitions
  PRESETS: {
    'passport-us': { name: 'US / Global Passport (2x2" / 51x51mm)', width: 600, height: 600, dpi: 300, mmW: 51, mmH: 51 },
    'visa-schengen': { name: 'Schengen / UK / European Visa (35x45mm)', width: 413, height: 531, dpi: 300, mmW: 35, mmH: 45 },
    'cnic-pk': { name: 'NADRA CNIC / Pakistan ID (350x450px)', width: 350, height: 450, dpi: 300, mmW: 30, mmH: 40 },
    'photo-1x1': { name: '1x1 Inch Photo (25x25mm)', width: 300, height: 300, dpi: 300, mmW: 25, mmH: 25 },
    'photo-2x2': { name: '2x2 Inch Standard (50x50mm)', width: 600, height: 600, dpi: 300, mmW: 50, mmH: 50 }
  },

  // Process and crop single portrait photo with scale, offset, rotation, background and filter adjustments
  async renderPortraitPhoto({
    imageFileOrUrl,
    targetWidth = 600,
    targetHeight = 600,
    scale = 1.0,
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
    bgColor = '#FFFFFF',
    brightness = 100,
    contrast = 100,
    quality = 0.95
  }) {
    let img;
    if (typeof imageFileOrUrl === 'string') {
      img = await UIUtils.loadImage(imageFileOrUrl);
    } else {
      const dataUrl = await UIUtils.readFileAsDataURL(imageFileOrUrl);
      img = await UIUtils.loadImage(dataUrl);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Draw solid background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Apply brightness & contrast filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    // Calculate centering with scale and offset
    ctx.save();
    ctx.translate(targetWidth / 2 + offsetX, targetHeight / 2 + offsetY);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // Cover scale factor
    const baseScale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
    const finalScale = baseScale * scale;
    const drawW = img.naturalWidth * finalScale;
    const drawH = img.naturalHeight * finalScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

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
  async generate4x6Sheet(photoCanvas, presetKey = 'passport-us') {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 1800; // 6 inches @ 300 DPI
    sheetCanvas.height = 1200; // 4 inches @ 300 DPI
    const ctx = sheetCanvas.getContext('2d');

    // Crisp white photographic paper background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pw = photoCanvas.width;
    const ph = photoCanvas.height;

    // Calculate best layout fit for 4x6" sheet
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

    const marginX = 60;
    const marginY = 50;
    const availW = sheetCanvas.width - marginX * 2;
    const availH = sheetCanvas.height - marginY * 2;

    const cellW = availW / cols;
    const cellH = availH / rows;

    const scale = Math.min((cellW - 30) / pw, (cellH - 30) / ph, 1.0);
    const renderW = pw * scale;
    const renderH = ph * scale;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = marginX + c * cellW + (cellW - renderW) / 2;
        const cy = marginY + r * cellH + (cellH - renderH) / 2;

        ctx.drawImage(photoCanvas, cx, cy, renderW, renderH);

        // Subtle cutting guide border
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, renderW, renderH);

        // Corner crop marks
        this._drawCornerCropMarks(ctx, cx, cy, renderW, renderH);
      }
    }

    // Sheet metadata watermark
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Biometric 4x6" Print Sheet (300 DPI) • Zero Uploads', sheetCanvas.width / 2, sheetCanvas.height - 15);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    return {
      canvas: sheetCanvas,
      dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.95),
      blob
    };
  },

  // Generate A4 Printable Grid Sheet (2480 x 3508 px @ 300 DPI)
  async generateA4Sheet(photoCanvas) {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 2480; // A4 @ 300 DPI
    sheetCanvas.height = 3508;
    const ctx = sheetCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pw = photoCanvas.width;
    const ph = photoCanvas.height;

    const cols = pw === ph ? 4 : 5;
    const rows = pw === ph ? 5 : 6;

    const marginX = 140;
    const marginY = 160;
    const availW = sheetCanvas.width - marginX * 2;
    const availH = sheetCanvas.height - marginY * 2;

    const cellW = availW / cols;
    const cellH = availH / rows;

    const scale = Math.min((cellW - 40) / pw, (cellH - 40) / ph, 1.0);
    const renderW = pw * scale;
    const renderH = ph * scale;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = marginX + c * cellW + (cellW - renderW) / 2;
        const cy = marginY + r * cellH + (cellH - renderH) / 2;

        ctx.drawImage(photoCanvas, cx, cy, renderW, renderH);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, renderW, renderH);
        this._drawCornerCropMarks(ctx, cx, cy, renderW, renderH);
      }
    }

    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Official Biometric A4 Multi-Copy Print Sheet (300 DPI)', sheetCanvas.width / 2, sheetCanvas.height - 40);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    return {
      canvas: sheetCanvas,
      dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.95),
      blob
    };
  },

  // Draw corner crop lines for easy scissor trimming
  _drawCornerCropMarks(ctx, x, y, w, h) {
    const markLen = 8;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;

    ctx.beginPath();
    // Top-Left
    ctx.moveTo(x - markLen, y); ctx.lineTo(x, y);
    ctx.moveTo(x, y - markLen); ctx.lineTo(x, y);
    // Top-Right
    ctx.moveTo(x + w, y); ctx.lineTo(x + w + markLen, y);
    ctx.moveTo(x + w, y - markLen); ctx.lineTo(x + w, y);
    // Bottom-Left
    ctx.moveTo(x - markLen, y + h); ctx.lineTo(x, y + h);
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + markLen);
    // Bottom-Right
    ctx.moveTo(x + w, y + h); ctx.lineTo(x + w + markLen, y + h);
    ctx.moveTo(x + w, y + h); ctx.lineTo(x + w, y + h + markLen);
    ctx.stroke();
  },

  // -------------------------------------------------------------
  // MODE B: 2-in-1 ID Card Front & Back Compiler (A4 Sheet & Card)
  // -------------------------------------------------------------

  /**
   * Compiles Front and Back ID photos onto a standard 1-Page A4 Sheet (300 DPI)
   * Standard ID Card Physical Size: 85.6mm x 53.98mm (CR80 standard / NADRA CNIC / DL)
   * 85.6mm @ 300 DPI ≈ 1011 px, 53.98mm ≈ 638 px
   */
  async compileIDCardA4({
    frontImgOrUrl,
    backImgOrUrl,
    documentTitle = 'IDENTITY CARD PHOTOCOPY / VERIFICATION SHEET',
    includeCutGuides = true,
    filterMode = 'magic-color'
  }) {
    let frontImg, backImg;

    if (typeof frontImgOrUrl === 'string') {
      frontImg = await UIUtils.loadImage(frontImgOrUrl);
    } else {
      const u = await UIUtils.readFileAsDataURL(frontImgOrUrl);
      frontImg = await UIUtils.loadImage(u);
    }

    if (backImgOrUrl) {
      if (typeof backImgOrUrl === 'string') {
        backImg = await UIUtils.loadImage(backImgOrUrl);
      } else {
        const u = await UIUtils.readFileAsDataURL(backImgOrUrl);
        backImg = await UIUtils.loadImage(u);
      }
    }

    // A4 Standard @ 300 DPI
    const a4Canvas = document.createElement('canvas');
    a4Canvas.width = 2480;
    a4Canvas.height = 3508;
    const ctx = a4Canvas.getContext('2d');

    // Clean white A4 page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

    // Header Title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(documentTitle, a4Canvas.width / 2, 220);

    ctx.fillStyle = '#64748B';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Scale: 100% (Actual Physical Size 85.6mm × 54mm) • Generated on ${new Date().toLocaleDateString()} via localdoc.org`, a4Canvas.width / 2, 270);

    // Decorative separator line
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(300, 310);
    ctx.lineTo(a4Canvas.width - 300, 310);
    ctx.stroke();

    // Standard card dimensions @ 300 DPI
    const cardW = 1011; // 85.6mm
    const cardH = 638;  // 53.98mm
    const cardX = (a4Canvas.width - cardW) / 2;

    // Slot 1: Front Side
    const frontY = 480;
    this._drawIDCardSlot(ctx, frontImg, cardX, frontY, cardW, cardH, 'FRONT SIDE / رخ اول', includeCutGuides);

    // Slot 2: Back Side
    const backY = 1380;
    if (backImg) {
      this._drawIDCardSlot(ctx, backImg, cardX, backY, cardW, cardH, 'BACK SIDE / رخ دوم', includeCutGuides);
    } else {
      // Placeholder for Back
      this._drawEmptyIDCardSlot(ctx, cardX, backY, cardW, cardH, 'BACK SIDE (NOT PROVIDED)');
    }

    // Footer info
    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100% Zero-Upload Privacy Guarantee • Processed entirely in Client RAM • localdoc.org', a4Canvas.width / 2, 3400);

    const blob = await new Promise(resolve => a4Canvas.toBlob(resolve, 'image/jpeg', 0.95));
    return {
      canvas: a4Canvas,
      dataUrl: a4Canvas.toDataURL('image/jpeg', 0.95),
      blob
    };
  },

  _drawIDCardSlot(ctx, img, x, y, w, h, label, includeCutGuides) {
    // Section label
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 20);

    // Card border / container
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.clip();

    // Fill white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);

    // Draw card image with cover fit
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = w / h;
    let dw, dh, dx, dy;

    if (imgAspect > targetAspect) {
      dh = h;
      dw = img.naturalWidth * (h / img.naturalHeight);
      dx = x + (w - dw) / 2;
      dy = y;
    } else {
      dw = w;
      dh = img.naturalHeight * (w / img.naturalWidth);
      dx = x;
      dy = y + (h - dh) / 2;
    }

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // Outer card border
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.stroke();

    if (includeCutGuides) {
      // Dashed cut guide lines
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x - 20, y - 20, w + 40, h + 40);
      ctx.setLineDash([]); // Reset
    }
  },

  _drawEmptyIDCardSlot(ctx, x, y, w, h, placeholderText) {
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(placeholderText, x + w / 2, y + h / 2);
  }
};

window.IDPhoto = IDPhoto;
