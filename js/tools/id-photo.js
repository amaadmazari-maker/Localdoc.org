/**
 * localdoc.org — ID Photo & Biometric Engine (js/tools/id-photo.js)
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
  // Neural OCR Web Worker
  async imageToText(imageFile, onProgress = null) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract OCR engine is not loaded.');
    }
    const worker = await Tesseract.createWorker({
      workerPath: '../js/workers/ocr.worker.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4.0.4/tesseract-core.wasm.js',
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100), `Neural OCR Scanning (${Math.round(m.progress * 100)}%)...`);
        }
      }
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const ret = await worker.recognize(imageFile);
    await worker.terminate();
    return ret.data.text;
  }
};

window.IDPhoto = IDPhoto;
window.OCRUtils = OCRUtils;
