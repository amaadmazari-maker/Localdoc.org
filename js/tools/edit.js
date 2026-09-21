/**
 * localdoc.org — PDF Visual Editor & Digital Sign Studio Engine (js/tools/edit.js)
 * Interactive visual placement, signature stamping, text boxes, and date certified sealing in browser RAM.
 */

const PDFEdit = {
  /**
   * Process and stamp visual annotations onto PDF
   * @param {File|ArrayBuffer} fileInput
   * @param {Object} options
   * @param {Function} onProgress
   */
  async processBatchEdit(fileInput, options = {}, onProgress = null) {
    const {
      annotations = [], // Array of { type: 'signature'|'text'|'date', pageIndex, x, y, width, height, dataUrl, text, color, fontSize }
      // Legacy fallback options:
      signatureDataUrl = null,
      position = 'bottom-right',
      targetPages = 'last',
      includeDate = false,
      dateString = '',
      annotationText = ''
    } = options;

    if (onProgress) onProgress(15, 'Loading PDF document into memory...');
    let buffer;
    if (fileInput instanceof ArrayBuffer) {
      buffer = fileInput.slice(0);
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      buffer = await UIUtils.readFileAsArrayBuffer(fileInput);
    } else {
      throw new Error('Invalid file input for PDF editor');
    }

    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    let helveticaFont = null;
    let helveticaBold = null;
    const getFont = async (bold = false) => {
      if (bold) {
        if (!helveticaBold) helveticaBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        return helveticaBold;
      }
      if (!helveticaFont) helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      return helveticaFont;
    };

    let stampedCount = 0;

    // 1. Process Modern Interactive Visual Annotations
    if (annotations && annotations.length > 0) {
      if (onProgress) onProgress(45, 'Rendering visual signatures and annotations...');
      
      for (let i = 0; i < annotations.length; i++) {
        const anno = annotations[i];
        const pIdx = Math.max(0, Math.min(totalPages - 1, anno.pageIndex || 0));
        const page = pages[pIdx];
        const { width: pWidth, height: pHeight } = page.getSize();

        if (anno.type === 'signature' && anno.dataUrl) {
          const sigImage = await pdfDoc.embedPng(anno.dataUrl);
          // Coordinates in PDF points: anno.x and anno.y are given in PDF coordinate points
          const w = anno.width || 140;
          const h = anno.height || 60;
          const x = Math.max(0, Math.min(pWidth - w, anno.x));
          const y = Math.max(0, Math.min(pHeight - h, anno.y));

          page.drawImage(sigImage, {
            x,
            y,
            width: w,
            height: h
          });
          stampedCount++;
        } else if (anno.type === 'text' && anno.text) {
          const font = await getFont(anno.bold || false);
          const size = anno.fontSize || 12;
          const colorHex = anno.color || '#000000';
          const rgb = this.hexToRgb(colorHex);

          page.drawText(anno.text, {
            x: Math.max(0, Math.min(pWidth - 50, anno.x)),
            y: Math.max(0, Math.min(pHeight - size, anno.y)),
            size,
            font,
            color: PDFLib.rgb(rgb.r, rgb.g, rgb.b)
          });
          stampedCount++;
        } else if (anno.type === 'date' && anno.text) {
          const font = await getFont(false);
          const size = anno.fontSize || 10;
          page.drawText(anno.text, {
            x: Math.max(0, Math.min(pWidth - 60, anno.x)),
            y: Math.max(0, Math.min(pHeight - size, anno.y)),
            size,
            font,
            color: PDFLib.rgb(0.3, 0.35, 0.45)
          });
          stampedCount++;
        }
      }
    } else {
      // 2. Legacy Fallback Mode: Anchor Placement
      let targetIndices = [];
      if (targetPages === 'all') {
        targetIndices = pages.map((_, idx) => idx);
      } else if (targetPages === 'first') {
        targetIndices = [0];
      } else {
        targetIndices = [totalPages - 1];
      }

      let sigImage = null;
      if (signatureDataUrl) {
        sigImage = await pdfDoc.embedPng(signatureDataUrl);
      }

      for (const idx of targetIndices) {
        const page = pages[idx];
        const { width: pWidth, height: pHeight } = page.getSize();
        const sigW = 150;
        const sigH = 65;

        let sigX = pWidth - sigW - 40;
        let sigY = 45;

        if (position === 'bottom-left') {
          sigX = 40;
          sigY = 45;
        } else if (position === 'bottom-center') {
          sigX = (pWidth - sigW) / 2;
          sigY = 45;
        } else if (position === 'top-right') {
          sigX = pWidth - sigW - 40;
          sigY = pHeight - sigH - 45;
        }

        if (sigImage) {
          page.drawImage(sigImage, {
            x: sigX,
            y: sigY,
            width: sigW,
            height: sigH
          });
          stampedCount++;
        }

        if (includeDate && dateString) {
          const font = await getFont(false);
          page.drawText(`Signed: ${dateString}`, {
            x: sigX,
            y: Math.max(15, sigY - 14),
            size: 9,
            font,
            color: PDFLib.rgb(0.35, 0.35, 0.35)
          });
        }

        if (annotationText) {
          const font = await getFont(true);
          page.drawText(annotationText, {
            x: 40,
            y: pHeight - 40,
            size: 11,
            font,
            color: PDFLib.rgb(0.1, 0.4, 0.8)
          });
        }
      }
    }

    if (onProgress) onProgress(85, 'Finalizing signed PDF document structure...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    if (onProgress) onProgress(100, 'Ready');
    return {
      pdfBlob,
      pageCount: totalPages,
      stampedPagesCount: Math.max(1, stampedCount)
    };
  },

  hexToRgb(hex) {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255
    };
  }
};

window.PDFEdit = PDFEdit;

