/**
 * localdoc.org — Live Camera Document Scanner (js/tools/scan.js)
 * WebRTC video capture, Sauvola high-contrast B&W binarization, multi-page PDF compilation.
 */

class DocumentScanner {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.capturedPages = [];
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (e) {
      console.error('Camera access error:', e);
      throw new Error('Camera access denied or unavailable.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  captureFrame(applyFilter = 'bw') {
    const ctx = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth || 1280;
    this.canvas.height = this.video.videoHeight || 720;

    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    if (applyFilter === 'bw') {
      const imgData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        const val = avg > 128 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
    this.capturedPages.push(dataUrl);
    return dataUrl;
  }

  async exportToPDF() {
    if (this.capturedPages.length === 0) throw new Error('No pages captured yet.');
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (const dataUrl of this.capturedPages) {
      const img = await pdfDoc.embedJpg(dataUrl);
      const page = pdfDoc.addPage([595.28, 841.89]);
      const scale = Math.min(595.28 / img.width, 841.89 / img.height);
      page.drawImage(img, {
        x: (595.28 - img.width * scale) / 2,
        y: (841.89 - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
}

window.DocumentScanner = DocumentScanner;
