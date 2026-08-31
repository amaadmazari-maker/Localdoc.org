/**
 * localdoc.org — PDF Editor Engine (js/tools/edit.js)
 * Digital signatures, text annotations, and canvas drawing overlays.
 */

const PDFEdit = {
  async processBatchEdit(file, signatureDataUrl = null, textAnnotation = null, onProgress = null) {
    if (onProgress) onProgress(30, 'Loading PDF for Annotation...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    if (signatureDataUrl) {
      if (onProgress) onProgress(60, 'Stamping Signature Overlay...');
      const sigImg = await pdfDoc.embedPng(signatureDataUrl);
      firstPage.drawImage(sigImg, {
        x: width - 180,
        y: 60,
        width: 140,
        height: 60
      });
    }

    if (textAnnotation) {
      if (onProgress) onProgress(80, 'Embedding Text Annotation...');
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      firstPage.drawText(textAnnotation, {
        x: 50,
        y: height - 50,
        size: 14,
        font: font,
        color: PDFLib.rgb(0.9, 0.1, 0.1)
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
};

window.PDFEdit = PDFEdit;
