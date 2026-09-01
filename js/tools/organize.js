/**
 * localdoc.org — PDF Organization Engine (js/tools/organize.js)
 * 100% Client-Side RAM Processing for Merge, Split, Compress, Rotate, Page Numbers, and Watermark.
 */

const PDFOrganize = {
  // 1. Merge PDF Documents with Reordered Queue
  async mergePDF(files, onProgress = null) {
    if (!files || files.length === 0) {
      throw new Error('Please select at least two PDF documents to merge.');
    }
    if (files.length === 1) {
      throw new Error('Please select at least 2 PDF files to merge into a single document.');
    }

    if (onProgress) onProgress(10, 'Creating in-memory merged document container...');
    const mergedDoc = await PDFLib.PDFDocument.create();
    let totalPageCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pct = 15 + Math.round(((i + 1) / files.length) * 70);
      if (onProgress) onProgress(pct, `Merging Document ${i + 1} of ${files.length} (${file.name})...`);

      const buffer = await UIUtils.readFileAsArrayBuffer(file);
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
      const indices = srcDoc.getPageIndices();
      totalPageCount += indices.length;

      const copiedPages = await mergedDoc.copyPages(srcDoc, indices);
      copiedPages.forEach(page => mergedDoc.addPage(page));
    }

    if (onProgress) onProgress(90, 'Serializing merged PDF document in RAM...');
    const pdfBytes = await mergedDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages: totalPageCount,
      fileCount: files.length,
      mergedSize: pdfBytes.byteLength
    };
  },

  // 2. Split PDF Document by Page Ranges or Selection
  async splitPDF(file, pageRangeString, onProgress = null) {
    if (onProgress) onProgress(20, 'Loading PDF document structure into RAM...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // Parse ranges e.g. "1-3, 5, 8-10" or array of numbers
    const targetIndices = new Set();

    if (Array.isArray(pageRangeString)) {
      pageRangeString.forEach(p => {
        const num = parseInt(p, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          targetIndices.add(num - 1);
        }
      });
    } else {
      const parts = String(pageRangeString || '').split(',');
      for (const part of parts) {
        const clean = part.trim();
        if (clean.includes('-')) {
          const [start, end] = clean.split('-').map(n => parseInt(n.trim(), 10));
          if (!isNaN(start) && !isNaN(end)) {
            const minP = Math.max(1, Math.min(start, end));
            const maxP = Math.min(totalPages, Math.max(start, end));
            for (let p = minP; p <= maxP; p++) {
              targetIndices.add(p - 1);
            }
          }
        } else {
          const p = parseInt(clean, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            targetIndices.add(p - 1);
          }
        }
      }
    }

    if (targetIndices.size === 0) {
      throw new Error(`Invalid page range. Please select valid pages between 1 and ${totalPages}.`);
    }

    const sortedIndices = Array.from(targetIndices).sort((a, b) => a - b);
    if (onProgress) onProgress(60, `Extracting ${sortedIndices.length} selected pages...`);

    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, sortedIndices);
    copiedPages.forEach(page => newDoc.addPage(page));

    if (onProgress) onProgress(90, 'Writing extracted PDF document...');
    const pdfBytes = await newDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      extractedPagesCount: sortedIndices.length,
      totalPages: totalPages,
      selectedPagesList: sortedIndices.map(i => i + 1)
    };
  },

  // 3. Burst / Split Every Single Page to ZIP archive
  async splitAllPagesToZip(file, onProgress = null) {
    if (onProgress) onProgress(15, 'Reading PDF document pages...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const pagesData = [];

    for (let i = 0; i < totalPages; i++) {
      const pct = 20 + Math.round(((i + 1) / totalPages) * 65);
      if (onProgress) onProgress(pct, `Extracting Page ${i + 1} of ${totalPages}...`);

      const singleDoc = await PDFLib.PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);

      const singleBytes = await singleDoc.save();
      pagesData.push({
        filename: `${baseName}-page-${i + 1}.pdf`,
        bytes: singleBytes
      });
    }

    if (onProgress) onProgress(90, 'Bundling all page PDFs into ZIP archive...');
    const zipBlob = MiniZip.createZip(pagesData);

    return {
      zipBlob,
      totalPages,
      filename: `${baseName}-split-pages.zip`
    };
  },

  // 4. Multi-Tier PDF Compression (Extreme, Recommended, High Quality)
  async compressPDF(file, level = 'recommended', onProgress = null) {
    const originalSize = file.size;
    if (onProgress) onProgress(15, 'Loading PDF document into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);

    // Helper: Local fallback rasterizer if PDFConvert is absent
    const renderPDFPages = async (f, scale, progressFn) => {
      if (typeof PDFConvert !== 'undefined' && PDFConvert.pdfToImages) {
        return PDFConvert.pdfToImages(f, 'image/jpeg', scale, progressFn);
      }
      const arrBuf = await UIUtils.readFileAsArrayBuffer(f);
      const pdf = await pdfjsLib.getDocument({ data: arrBuf }).promise;
      const numPages = pdf.numPages;
      const imgs = [];
      for (let i = 1; i <= numPages; i++) {
        if (progressFn) progressFn((i / numPages) * 100, `Rasterizing Page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        imgs.push({ pageNumber: i, dataUrl, width: viewport.width, height: viewport.height });
      }
      return imgs;
    };

    if (level === 'extreme') {
      // Extreme Compression: Re-render pages at 72 DPI with 55% JPEG compression
      if (onProgress) onProgress(30, 'Performing Extreme Raster & Stream Compression (72 DPI)...');
      const renderedImages = await renderPDFPages(file, 1.0, (pct, status) => {
        if (onProgress) onProgress(30 + Math.round(pct * 0.45), status);
      });

      const compressedDoc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < renderedImages.length; i++) {
        const img = renderedImages[i];
        const jpgImage = await compressedDoc.embedJpg(img.dataUrl);
        const page = compressedDoc.addPage([img.width * 0.75, img.height * 0.75]);
        page.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: img.width * 0.75,
          height: img.height * 0.75
        });
      }

      if (onProgress) onProgress(90, 'Packing compressed object streams...');
      const pdfBytes = await compressedDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const compressedSize = pdfBytes.byteLength;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const percentSaved = Math.round((savedBytes / originalSize) * 100);

      return {
        pdfBlob,
        originalSize,
        compressedSize,
        savedBytes,
        percentSaved,
        savedPercentage: percentSaved,
        level: 'Extreme'
      };
    } else if (level === 'recommended') {
      // Recommended Compression: Re-render at 150 DPI with 75% JPEG compression
      if (onProgress) onProgress(30, 'Performing Balanced Optimization & Image Resampling (150 DPI)...');
      const renderedImages = await renderPDFPages(file, 1.5, (pct, status) => {
        if (onProgress) onProgress(30 + Math.round(pct * 0.45), status);
      });

      const compressedDoc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < renderedImages.length; i++) {
        const img = renderedImages[i];
        const jpgImage = await compressedDoc.embedJpg(img.dataUrl);
        const page = compressedDoc.addPage([img.width / 1.5, img.height / 1.5]);
        page.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: img.width / 1.5,
          height: img.height / 1.5
        });
      }

      if (onProgress) onProgress(90, 'Writing optimized stream dictionary...');
      const pdfBytes = await compressedDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const compressedSize = pdfBytes.byteLength;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const percentSaved = Math.round((savedBytes / originalSize) * 100);

      return {
        pdfBlob,
        originalSize,
        compressedSize,
        savedBytes,
        percentSaved,
        savedPercentage: percentSaved,
        level: 'Recommended'
      };
    } else {
      // Low Compression / Lossless Stream Defragmentation:
      if (onProgress) onProgress(40, 'Rebuilding Object Cross-Reference Streams...');
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
      const newDoc = await PDFLib.PDFDocument.create();
      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => newDoc.addPage(p));

      if (onProgress) onProgress(90, 'Flushing defragmented stream dictionary...');
      const pdfBytes = await newDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const compressedSize = pdfBytes.byteLength;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const percentSaved = Math.round((savedBytes / originalSize) * 100);

      return {
        pdfBlob,
        originalSize,
        compressedSize,
        savedBytes,
        percentSaved,
        savedPercentage: percentSaved,
        level: 'Low'
      };
    }
      if (onProgress) onProgress(40, 'Defragmenting cross-reference streams and removing duplicate objects...');
      const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });

      if (onProgress) onProgress(80, 'Applying Flate object stream compression...');
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50
      });

      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const compressedSize = pdfBytes.byteLength;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const percentSaved = Math.round((savedBytes / originalSize) * 100);

      return {
        pdfBlob,
        originalSize,
        compressedSize: Math.min(originalSize, compressedSize),
        savedBytes,
        percentSaved: Math.max(0, percentSaved),
        level: 'Low (Lossless)'
      };
    }
  },

  // 5. Rotate PDF Pages (Per-Page or Global Rotation)
  async rotatePDF(file, rotationParam = 90, onProgress = null) {
    if (onProgress) onProgress(20, 'Loading PDF document into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    if (onProgress) onProgress(50, 'Applying rotation angles to page dictionaries...');

    if (typeof rotationParam === 'object' && !Array.isArray(rotationParam)) {
      // Rotation map e.g. { 0: 90, 1: 180, 2: 270 }
      pages.forEach((page, idx) => {
        if (rotationParam[idx] !== undefined) {
          const currentRotation = page.getRotation().angle;
          const targetAngle = (currentRotation + rotationParam[idx]) % 360;
          page.setRotation(PDFLib.degrees(targetAngle));
        }
      });
    } else {
      // Global angle (e.g. 90, 180, 270)
      const angle = parseInt(rotationParam, 10) || 90;
      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((currentRotation + angle) % 360));
      });
    }

    if (onProgress) onProgress(85, 'Saving rotated PDF document...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages
    };
  },

  // 6. Add Custom Page Numbers to PDF
  async addPageNumbers(file, options = {}, onProgress = null) {
    const {
      position = 'bottom-center',
      format = 'Page {n} of {total}',
      startFrom = 1,
      skipFirstPage = false,
      fontSize = 10,
      fontColor = 'gray',
      marginOffset = 25
    } = options;

    if (onProgress) onProgress(20, 'Loading PDF pages for numbering...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    let rgbColor = PDFLib.rgb(0.35, 0.35, 0.35);
    if (fontColor === 'black') rgbColor = PDFLib.rgb(0.05, 0.05, 0.05);
    if (fontColor === 'blue') rgbColor = PDFLib.rgb(0.02, 0.45, 0.85);
    if (fontColor === 'red') rgbColor = PDFLib.rgb(0.85, 0.1, 0.1);

    if (onProgress) onProgress(50, 'Stamping page numbers onto pages...');

    pages.forEach((page, idx) => {
      if (skipFirstPage && idx === 0) return;

      const pageNumber = (idx + startFrom);
      let text = format
        .replace(/{n}/g, String(pageNumber))
        .replace(/{total}/g, String(total));

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { width, height } = page.getSize();

      let x = (width - textWidth) / 2;
      let y = marginOffset;

      if (position === 'bottom-left') {
        x = marginOffset;
        y = marginOffset;
      } else if (position === 'bottom-right') {
        x = width - textWidth - marginOffset;
        y = marginOffset;
      } else if (position === 'top-center') {
        x = (width - textWidth) / 2;
        y = height - marginOffset - fontSize;
      } else if (position === 'top-left') {
        x = marginOffset;
        y = height - marginOffset - fontSize;
      } else if (position === 'top-right') {
        x = width - textWidth - marginOffset;
        y = height - marginOffset - fontSize;
      }

      page.drawText(text, {
        x: Math.max(5, x),
        y: Math.max(5, y),
        size: fontSize,
        font: font,
        color: rgbColor
      });
    });

    if (onProgress) onProgress(85, 'Writing numbered PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages: total
    };
  },

  // 7. Add Custom Watermark (Text or Image) to PDF
  async addWatermark(file, options = {}, onProgress = null) {
    const {
      type = 'text',
      text = 'CONFIDENTIAL',
      imageFile = null,
      opacity = 0.35,
      rotationAngle = 45,
      fontSize = 50,
      color = 'red'
    } = options;

    if (onProgress) onProgress(20, 'Loading PDF for watermarking...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    if (type === 'image' && imageFile) {
      if (onProgress) onProgress(40, 'Embedding watermark image...');
      const imgBuffer = await UIUtils.readFileAsArrayBuffer(imageFile);
      const isPng = imageFile.type.includes('png') || imageFile.name.toLowerCase().endsWith('.png');
      const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
      const imgDims = embeddedImg.scale(1.0);

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const scaleFactor = Math.min((width * 0.6) / imgDims.width, (height * 0.6) / imgDims.height, 1.0);
        const drawWidth = imgDims.width * scaleFactor;
        const drawHeight = imgDims.height * scaleFactor;

        page.drawImage(embeddedImg, {
          x: (width - drawWidth) / 2,
          y: (height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
          opacity: opacity,
          rotate: PDFLib.degrees(rotationAngle)
        });
      });
    } else {
      // Text Watermark
      if (onProgress) onProgress(40, 'Formatting text watermark typography...');
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      let rgbColor = PDFLib.rgb(0.85, 0.1, 0.1);
      if (color === 'gray') rgbColor = PDFLib.rgb(0.4, 0.4, 0.4);
      if (color === 'blue') rgbColor = PDFLib.rgb(0.05, 0.35, 0.85);
      if (color === 'black') rgbColor = PDFLib.rgb(0.05, 0.05, 0.05);

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const autoFontSize = fontSize || Math.round(Math.min(width, height) / 10);
        const textWidth = font.widthOfTextAtSize(text, autoFontSize);

        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: (height / 2),
          size: autoFontSize,
          font: font,
          color: rgbColor,
          opacity: opacity,
          rotate: PDFLib.degrees(rotationAngle)
        });
      });
    }

    if (onProgress) onProgress(85, 'Saving watermarked PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages: pages.length
    };
  }
};

window.PDFOrganize = PDFOrganize;
