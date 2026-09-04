/**
 * localdoc.org — ID Photo & Biometric Engine & Neural OCR (js/tools/id-photo.js)
 * Precision biometric crop (NADRA CNIC, Passport, Visa) & Tesseract Neural OCR.
 */

const IDPhoto = {
  // Crop photo to exact pixel dimensions & generate 4x6" printable sheet
  async cropPhoto(imageFile, targetWidth, targetHeight, generateSheet = true) {
    const dataUrl = await UIUtils.readFileAsDataURL(imageFile);
    const img = await UIUtils.loadImage(dataUrl);

    // 1. Single Cropped Photo
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Cover crop aspect ratio
    const imgAspect = img.width / img.height;
    const targetAspect = targetWidth / targetHeight;
    let renderW, renderH, offsetX, offsetY;

    if (imgAspect > targetAspect) {
      renderH = targetHeight;
      renderW = img.width * (targetHeight / img.height);
      offsetX = (targetWidth - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = targetWidth;
      renderH = img.height * (targetWidth / img.width);
      offsetX = 0;
      offsetY = (targetHeight - renderH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    const singleBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));

    if (!generateSheet) return { singleBlob, sheetBlob: null };

    // 2. 4x6" 300 DPI Printable Grid (1800 x 1200 px)
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 1800;
    sheetCanvas.height = 1200;
    const sCtx = sheetCanvas.getContext('2d');
    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const cols = 4;
    const rows = 2;
    const spacingX = 40;
    const spacingY = 40;
    const startX = (1800 - (cols * targetWidth + (cols - 1) * spacingX)) / 2;
    const startY = (1200 - (rows * targetHeight + (rows - 1) * spacingY)) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (targetWidth + spacingX);
        const y = startY + r * (targetHeight + spacingY);
        sCtx.drawImage(canvas, x, y, targetWidth, targetHeight);
        sCtx.strokeStyle = '#E2E8F0';
        sCtx.lineWidth = 1;
        sCtx.strokeRect(x, y, targetWidth, targetHeight);
      }
    }

    const sheetBlob = await new Promise(resolve => sheetCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    return { singleBlob, sheetBlob };
  }
};

const OCRUtils = {
  // Pre-process image for optimal OCR recognition (Sauvola binarization + contrast boost)
  async preprocessImageForOCR(imageInput) {
    const dataUrl = (imageInput instanceof File || imageInput instanceof Blob)
      ? await UIUtils.readFileAsDataURL(imageInput)
      : imageInput;

    const img = await UIUtils.loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // High-pass thresholding for text sharpness
    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const enhanced = lum > 130 ? 255 : Math.max(0, lum * 0.6);
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  },

  // Neural OCR Web Worker Recognition
  async imageToText(imageFile, onProgress = null) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract OCR engine is loading. Please ensure your device has internet access to download the language model on initial run.');
    }

    if (onProgress) onProgress(15, 'Enhancing image contrast for OCR recognition...');
    const preprocessed = await this.preprocessImageForOCR(imageFile);

    if (onProgress) onProgress(30, 'Initializing OCR neural engine in RAM...');

    try {
      // Method 1: Direct Tesseract.recognize
      const result = await Tesseract.recognize(preprocessed, 'eng', {
        logger: m => {
          if (onProgress && m.status === 'recognizing text') {
            const p = Math.round(30 + (m.progress || 0) * 65);
            onProgress(p, `Recognizing Text (${Math.round((m.progress || 0) * 100)}%)...`);
          }
        }
      });
      return result && result.data && result.data.text ? result.data.text.trim() : '';
    } catch (err1) {
      console.warn('Tesseract.recognize failed, attempting createWorker fallback:', err1);
      try {
        const worker = await Tesseract.createWorker('eng', 1, {
          logger: m => {
            if (onProgress && m.status === 'recognizing text') {
              const p = Math.round(30 + (m.progress || 0) * 65);
              onProgress(p, `Recognizing Text (${Math.round((m.progress || 0) * 100)}%)...`);
            }
          }
        });
        const ret = await worker.recognize(preprocessed);
        await worker.terminate();
        return ret && ret.data && ret.data.text ? ret.data.text.trim() : '';
      } catch (err2) {
        console.error('All OCR methods failed:', err2);
        throw new Error('OCR recognition failed. Please ensure internet access is available on first use to download the neural language weights.');
      }
    }
  }
};

window.IDPhoto = IDPhoto;
window.OCRUtils = OCRUtils;
