/**
 * localdoc.org — PDF Editor & Sign Engine (js/tools/edit.js)
 * Digital signatures, text stamping, date stamps, and visual placement on PDF pages in RAM.
 */

const PDFEdit = {
  async processBatchEdit(file, options = {}, onProgress = null) {
    const {
      signatureDataUrl = null,
      textAnnotation = null,
      dateStamp = null,
      pageIndex = 0,
      sigCoords = { x: null, y: null, width: 140, height: 60 }
    } = options;

    if (onProgress) onProgress(20, 'Loading PDF document into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const targetIdx = Math.max(0, Math.min(pages.length - 1, pageIndex));
    const targetPage = pages[targetIdx];
    const { width, height } = targetPage.getSize();

    // 1. Embed Digital Signature
    if (signatureDataUrl) {
      if (onProgress) onProgress(50, 'Stamping signature overlay onto PDF page...');
      const sigImg = await pdfDoc.embedPng(signatureDataUrl);
      const sigW = sigCoords.width || 140;
      const sigH = sigCoords.height || 60;
      const sigX = sigCoords.x !== null ? sigCoords.x : (width - sigW - 40);
      const sigY = sigCoords.y !== null ? sigCoords.y : 40;

      targetPage.drawImage(sigImg, {
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH
      });
    }

    // 2. Embed Text Annotation
    if (textAnnotation) {
      if (onProgress) onProgress(70, 'Stamping text annotation...');
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      targetPage.drawText(textAnnotation, {
        x: 40,
        y: height - 40,
        size: 12,
        font: font,
        color: PDFLib.rgb(0.85, 0.1, 0.1)
      });
    }

    // 3. Embed Date Stamp
    if (dateStamp) {
      if (onProgress) onProgress(80, 'Embedding certified date stamp...');
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const dateText = `Signed on: ${dateStamp}`;
      targetPage.drawText(dateText, {
        x: 40,
        y: 45,
        size: 9,
        font: font,
        color: PDFLib.rgb(0.4, 0.4, 0.4)
      });
    }

    if (onProgress) onProgress(90, 'Writing signed PDF document...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      pageCount: pages.length
    };
  }
};

window.PDFEdit = PDFEdit;
