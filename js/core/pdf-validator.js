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
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return { valid: false, reason: 'empty', error: 'File is 0 bytes' };
      }

      // Check header bytes for %PDF- signature
      const headerBytes = new Uint8Array(arrayBuffer.slice(0, 1024));
      let headerStr = '';
      for (let i = 0; i < Math.min(headerBytes.length, 1024); i++) {
        headerStr += String.fromCharCode(headerBytes[i]);
      }

      if (!headerStr.includes('%PDF-')) {
        return { valid: false, reason: 'corrupt', error: 'Missing %PDF- header magic bytes' };
      }

      // If PDFLib is available in window, perform quick non-destructive parse
      if (typeof window.PDFLib !== 'undefined' && window.PDFLib.PDFDocument) {
        try {
          await window.PDFLib.PDFDocument.load(arrayBuffer, {
            ignoreEncryption: false,
            parseSpeed: window.PDFLib.ParseSpeeds?.Fast || 0
          });
        } catch (err) {
          const msg = (err && err.message) ? err.message.toLowerCase() : '';
          if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected') || err.name === 'EncryptedPDFError') {
            return { valid: false, reason: 'locked', error: err.message };
          }
          return { valid: false, reason: 'corrupt', error: err.message };
        }
      }

      return { valid: true };
    },

    /**
     * Displays a friendly, accessible toast or notification message.
     * @param {'empty' | 'corrupt' | 'locked' | string} reason
     * @param {string} [filename]
     */
    showPdfError(reason, filename = 'Document') {
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

      if (window.LocalDocUI && typeof window.LocalDocUI.showToast === 'function') {
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
