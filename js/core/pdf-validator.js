/**
 * localdoc.org — PDF Validation & Friendly Error Handling Helper (js/core/pdf-validator.js)
 * Pre-validates PDF byte signatures, catches password protection and corrupted files
 * to guarantee zero raw JS exceptions and clear, actionable user feedback.
 */

(function(window) {
  'use strict';

  const PDFValidator = {
    /**
     * Inspects raw ArrayBuffer for valid PDF header and encryption status.
     * @param {ArrayBuffer} arrayBuffer
     * @param {Object} [options]
     * @returns {Promise<{valid: boolean, reason?: 'empty' | 'corrupt' | 'locked' | 'unsupported', error?: string}>}
     */
    async validatePdfBytes(arrayBuffer, options = {}) {
      if (!arrayBuffer) {
        return { valid: false, reason: 'empty', error: 'File is 0 bytes' };
      }

      // Normalize arrayBuffer or TypedArray (handles Node Buffer, Uint8Array or slice offsets)
      let bufferToScan;
      if (typeof ArrayBuffer !== 'undefined' && arrayBuffer instanceof ArrayBuffer) {
        bufferToScan = new Uint8Array(arrayBuffer);
      } else if (ArrayBuffer.isView(arrayBuffer)) {
        bufferToScan = new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength);
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(arrayBuffer)) {
        bufferToScan = new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength);
      } else {
        return { valid: false, reason: 'corrupt', error: 'Invalid input buffer type' };
      }

      if (bufferToScan.length === 0) {
        return { valid: false, reason: 'empty', error: 'File is 0 bytes' };
      }

      // Check header bytes for %PDF- signature
      const headerLength = Math.min(bufferToScan.length, 1024);
      let headerStr = '';
      for (let i = 0; i < headerLength; i++) {
        headerStr += String.fromCharCode(bufferToScan[i]);
      }

      if (!headerStr.includes('%PDF-')) {
        return { valid: false, reason: 'corrupt', error: 'Missing %PDF- header magic bytes' };
      }

      // Check trailer/dictionary bytes for /Encrypt marker (catches encrypted PDFs before parser)
      const tailLength = Math.min(bufferToScan.length, 4096);
      const tailStart = bufferToScan.length - tailLength;
      let tailStr = '';
      for (let i = tailStart; i < bufferToScan.length; i++) {
        tailStr += String.fromCharCode(bufferToScan[i]);
      }
      if (tailStr.includes('/Encrypt') || headerStr.includes('/Encrypt')) {
        return { valid: false, reason: 'locked', error: 'Document contains /Encrypt dictionary' };
      }

      // If PDFLib is available in window, perform quick non-destructive parse
      if (typeof window.PDFLib !== 'undefined' && window.PDFLib.PDFDocument) {
        try {
          const doc = await window.PDFLib.PDFDocument.load(arrayBuffer, {
            ignoreEncryption: false,
            parseSpeed: window.PDFLib.ParseSpeeds?.Fast || 0
          });
          if (doc && doc.isEncrypted) {
            return { valid: false, reason: 'locked', error: 'Document is encrypted' };
          }
        } catch (err) {
          const msg = (err && err.message) ? err.message.toLowerCase() : '';
          if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected') || err.name === 'EncryptedPDFError') {
            return { valid: false, reason: 'locked', error: err.message };
          }
          return { valid: false, reason: 'corrupt', error: err.message };
        }
      } else if (typeof window.pdfjsLib !== 'undefined' && window.pdfjsLib.getDocument) {
        try {
          await window.pdfjsLib.getDocument({
            data: arrayBuffer.slice ? arrayBuffer.slice(0) : bufferToScan,
            isEvalSupported: false
          }).promise;
        } catch (err) {
          const msg = (err && err.message) ? err.message.toLowerCase() : '';
          if (msg.includes('password') || msg.includes('encrypt') || err.name === 'PasswordException') {
            return { valid: false, reason: 'locked', error: err.message };
          }
          return { valid: false, reason: 'corrupt', error: err.message };
        }
      }

      return { valid: true };
    },

    /**
     * Displays a friendly, accessible toast or notification message.
     * @param {'empty' | 'corrupt' | 'locked' | object | string} reasonOrResult
     * @param {string} [filename]
     */
    showPdfError(reasonOrResult, filename = 'Document') {
      const reason = (reasonOrResult && typeof reasonOrResult === 'object') ? reasonOrResult.reason : reasonOrResult;
      const cleanName = filename ? `"${filename.replace(/[<>]/g, '')}"` : 'The selected file';
      let message = '';

      switch (reason) {
        case 'locked':
          message = `${cleanName} is password-protected. Please unlock or decrypt it before processing.`;
          break;
        case 'empty':
          message = `${cleanName} is empty or unreadable (0 bytes).`;
          break;
        case 'corrupt':
        default:
          message = `${cleanName} appears corrupted or is not a valid PDF document. Please check the original file.`;
          break;
      }

      if (window.UIUtils && typeof window.UIUtils.showToast === 'function') {
        window.UIUtils.showToast(message, 'error', 6000);
      } else if (window.LocalDocUI && typeof window.LocalDocUI.showToast === 'function') {
        window.LocalDocUI.showToast(message, 'error', 6000);
      } else if (typeof window.showToast === 'function') {
        window.showToast(message, 'error');
      } else {
        alert(message);
      }
    }
  };

  window.LocalDocPDFValidator = PDFValidator;
  window.validatePdfBytes = PDFValidator.validatePdfBytes;
  window.showPdfError = PDFValidator.showPdfError;
})(typeof window !== 'undefined' ? window : this);
