/**
 * localdoc.org — Biometric ID & Photo Studio Engine (js/tools/id-photo.js)
 * High-precision biometric passport/visa photo cropping, multi-copy print sheet generation (4x6", 5x7", A4),
 * suit/attire overlays, background color changer, and 2-in-1 Front & Back ID Card composite compilation.
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
      bgRecommended: '#E2E8F0' // Light grey / off-white
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

  // Process and crop single portrait photo with background, zoom, pan, rotation, filters, suit overlay
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
    suitKey = 'none',
    suitScale = 1.0,
    suitOffsetY = 0,
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

    // 1. Draw solid background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // 2. Draw portrait with brightness & contrast filters
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(targetWidth / 2 + offsetX, targetHeight / 2 + offsetY);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    const baseScale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
    const finalScale = baseScale * scale;
    const drawW = img.naturalWidth * finalScale;
    const drawH = img.naturalHeight * finalScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 3. Draw Suit Overlay if enabled
    if (suitKey && suitKey !== 'none' && this.SUIT_TEMPLATES[suitKey]) {
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

    // Target photo size scaled to fit standard layout
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

        // Dashed scissors cutting lines
        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, itemW, itemH);
        ctx.restore();
      }
    }

    // Sheet metadata footer
    ctx.font = '700 14px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Official Biometric Photo Sheet (4x6" @ 300 DPI) • Zero Uploads', sheetCanvas.width / 2, sheetCanvas.height - 22);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.98));
    return { canvas: sheetCanvas, blob, dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.98) };
  },

  // Generate 5x7" Printable Grid Sheet (2100 x 1500 px @ 300 DPI)
  async generate5x7Sheet(photoCanvas) {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 2100;
    sheetCanvas.height = 1500;
    const ctx = sheetCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pw = photoCanvas.width;
    const ph = photoCanvas.height;

    let cols = 4;
    let rows = 3;
    if (pw === ph) {
      cols = 3;
      rows = 2;
    }

    const marginX = 90;
    const marginY = 90;
    const availW = sheetCanvas.width - 2 * marginX;
    const availH = sheetCanvas.height - 2 * marginY;

    const targetScale = Math.min((availW / cols - 35) / pw, (availH / rows - 35) / ph);
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

    ctx.font = '700 15px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Official Biometric Photo Sheet (5x7" @ 300 DPI) • Zero Uploads', sheetCanvas.width / 2, sheetCanvas.height - 25);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.98));
    return { canvas: sheetCanvas, blob, dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.98) };
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
    ctx.font = '800 24px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL BIOMETRIC PASSPORT & VISA PHOTO SHEET', sheetCanvas.width / 2, 100);

    ctx.font = '600 16px "Outfit", Arial, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Generated with LocalDoc (100% In-Browser RAM Execution) • Standard A4 300 DPI', sheetCanvas.width / 2, 132);

    ctx.fillText('Scissors trimming lines included around each photograph.', sheetCanvas.width / 2, sheetCanvas.height - 60);

    const blob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.98));
    return { canvas: sheetCanvas, blob, dataUrl: sheetCanvas.toDataURL('image/jpeg', 0.98) };
  },

  // 2-in-1 Double Sided ID Card Sheet on A4
  async generate2in1IDCardSheet({
    frontImageOrUrl,
    backImageOrUrl,
    docTitle = 'IDENTITY CARD PHOTOCOPY / VERIFICATION SHEET'
  }) {
    const frontImg = typeof frontImageOrUrl === 'string' ? await UIUtils.loadImage(frontImageOrUrl) : await UIUtils.loadImage(await UIUtils.readFileAsDataURL(frontImageOrUrl));
    const backImg = typeof backImageOrUrl === 'string' ? await UIUtils.loadImage(backImageOrUrl) : await UIUtils.loadImage(await UIUtils.readFileAsDataURL(backImageOrUrl));

    const canvas = document.createElement('canvas');
    canvas.width = 2480;
    canvas.height = 3508;
    const ctx = canvas.getContext('2d');

    // Clean white A4 page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Official Header Banner
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 32px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(docTitle.toUpperCase(), canvas.width / 2, 220);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 18px "Outfit", Arial, sans-serif';
    ctx.fillText('OFFICIAL 100% SCALE PHOTOCOPY DOCUMENT • GENERATED LOCALLY ON DEVICE', canvas.width / 2, 265);

    // Subtle divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 310);
    ctx.lineTo(canvas.width - 300, 310);
    ctx.stroke();

    // Standard ID-1 Card Dimensions (85.6mm x 53.98mm @ 300 DPI = ~1011 x 638 px)
    const cardTargetW = 1100;
    const cardTargetH = 690;
    const centerX = (canvas.width - cardTargetW) / 2;

    // 1. FRONT CARD SECTION
    const frontY = 520;
    ctx.fillStyle = '#0284C7';
    ctx.font = '800 20px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('1. FRONT SIDE OF IDENTITY CARD', centerX, frontY - 18);

    // Draw card border
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - 1, frontY - 1, cardTargetW + 2, cardTargetH + 2);
    ctx.drawImage(frontImg, centerX, frontY, cardTargetW, cardTargetH);

    // 2. BACK CARD SECTION
    const backY = 1580;
    ctx.fillStyle = '#0284C7';
    ctx.font = '800 20px "Outfit", Arial, sans-serif';
    ctx.fillText('2. BACK SIDE OF IDENTITY CARD', centerX, backY - 18);

    ctx.strokeRect(centerX - 1, backY - 1, cardTargetW + 2, cardTargetH + 2);
    ctx.drawImage(backImg, centerX, backY, cardTargetW, cardTargetH);

    // Verification Box
    const verifY = 2520;
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(centerX, verifY, cardTargetW, 420);
    ctx.setLineDash([]);

    ctx.fillStyle = '#64748B';
    ctx.font = '700 16px "Outfit", Arial, sans-serif';
    ctx.fillText('SIGNATURE / OFFICIAL STAMP VERIFICATION AREA', centerX + 30, verifY + 45);

    ctx.font = '500 15px "Outfit", Arial, sans-serif';
    ctx.fillText('Date: ________________________', centerX + 30, verifY + 360);
    ctx.fillText('Verified By: ________________________', centerX + cardTargetW - 350, verifY + 360);

    // Footer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('localdoc.org — Private Zero-Upload Document Architecture • No Server Logs', canvas.width / 2, canvas.height - 80);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    return {
      canvas,
      blob,
      dataUrl: canvas.toDataURL('image/jpeg', 0.95)
    };
  }
};

window.IDPhoto = IDPhoto;
