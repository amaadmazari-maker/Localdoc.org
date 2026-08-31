/**
 * localdoc.org — PDF Organization Engine (js/tools/organize.js)
 * Real client-side Merge, Split, Rotate, Compress, Watermark, and Page Numbering.
 */

const PDFOrganize = {
  // 1. Merge PDF Documents
  async mergePDF(files, onProgress = null) {
    const mergedDoc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(((i + 1) / files.length) * 100, `Merging Document ${i + 1} of ${files.length}...`);
      const buffer = await UIUtils.readFileAsArrayBuffer(files[i]);
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach(page => mergedDoc.addPage(page));
    }
    const pdfBytes = await mergedDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 2. Split PDF Document
  async splitPDF(file, pageRangeString, onProgress = null) {
    if (onProgress) onProgress(20, 'Loading PDF Structure...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    
    // Parse ranges e.g. "1-3, 5, 8-10"
    const targetIndices = new Set();
    const parts = pageRangeString.split(',');
    for (const part of parts) {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
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

    if (targetIndices.size === 0) {
      throw new Error(`Invalid page range. Please select pages between 1 and ${totalPages}.`);
    }

    if (onProgress) onProgress(60, `Extracting ${targetIndices.size} selected pages...`);
    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, Array.from(targetIndices).sort((a, b) => a - b));
    copiedPages.forEach(page => newDoc.addPage(page));

    const pdfBytes = await newDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 3. Rotate PDF Document
  async rotatePDF(file, rotationAngle = 90, onProgress = null) {
    if (onProgress) onProgress(40, `Applying ${rotationAngle}° Rotation to Pages...`);
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    pages.forEach(page => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((currentRotation + rotationAngle) % 360));
    });

    if (onProgress) onProgress(90, 'Saving Rotated PDF...');
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 4. Compress PDF Document
  async compressPDF(file, onProgress = null) {
    if (onProgress) onProgress(30, 'Defragmenting PDF Streams & Objects...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    
    if (onProgress) onProgress(70, 'Re-encoding Vector Objects with Flate Compression...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 5. Add Watermark to PDF
  async addWatermark(file, watermarkText = 'CONFIDENTIAL', opacity = 0.35, onProgress = null) {
    if (onProgress) onProgress(30, 'Stamping Watermark onto Pages...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    pages.forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 10;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      page.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0.8, 0.1, 0.1),
        opacity: opacity,
        rotate: PDFLib.degrees(45)
      });
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 6. Add Page Numbers to PDF
  async addPageNumbers(file, position = 'bottom-center', onProgress = null) {
    if (onProgress) onProgress(30, 'Calculating Page Numbers...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();
      const text = `Page ${idx + 1} of ${total}`;
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      let x = (width - textWidth) / 2;
      let y = 25;

      if (position === 'bottom-right') x = width - textWidth - 30;
      if (position === 'bottom-left') x = 30;
      if (position === 'top-center') y = height - 30;

      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0.3, 0.3, 0.3)
      });
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
};

window.PDFOrganize = PDFOrganize;
