/**
 * LocalDoc — Delete PDF Pages Tool Controller (js/delete-pages.js)
 * 100% In-Browser RAM Execution via PDF.js & PDF-Lib
 * Zero Cloud Uploads • Strictly PDF Document Manipulation
 */

(function () {
  'use strict';

  // Initialize PDF.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
  }

  let originalFile = null;
  let originalArrayBuffer = null;
  let pdfDocument = null;
  let totalPages = 0;
  let markedPages = new Set(); // 1-indexed page numbers
  let lastGeneratedBlob = null;
  let lastGeneratedFilename = '';
  let lastObjectURL = null;

  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileInfoBar = document.getElementById('file-info-bar');
  const fileNameDisplay = document.getElementById('file-name-display');
  const fileMetaDisplay = document.getElementById('file-meta-display');
  const btnChangeFile = document.getElementById('btn-change-file');
  const deleteControlsBar = document.getElementById('delete-controls-bar');
  const pageRangeInput = document.getElementById('page-range-input');
  const pagesContainer = document.getElementById('pages-container');
  const thumbGrid = document.getElementById('thumb-grid');
  const renderProgressText = document.getElementById('render-progress-text');
  const actionBar = document.getElementById('action-bar');
  const actionSummaryTitle = document.getElementById('action-summary-title');
  const actionSummaryDesc = document.getElementById('action-summary-desc');
  const btnExecuteDelete = document.getElementById('btn-execute-delete');
  const btnDeleteLabel = document.getElementById('btn-delete-label');
  const successCard = document.getElementById('success-card');
  const successDesc = document.getElementById('success-desc');
  const btnDownloadAgain = document.getElementById('btn-download-again');
  const btnStartNew = document.getElementById('btn-start-new');
  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');

  function showError(msg) {
    if (errorBanner && errorText) {
      errorText.textContent = msg;
      errorBanner.style.display = 'flex';
      errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(msg);
    }
  }

  function clearError() {
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  // Setup Drag & Drop
  if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  if (btnChangeFile) {
    btnChangeFile.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (btnStartNew) {
    btnStartNew.addEventListener('click', resetAll);
  }

  function resetAll() {
    if (lastObjectURL) {
      URL.revokeObjectURL(lastObjectURL);
      lastObjectURL = null;
    }
    originalFile = null;
    originalArrayBuffer = null;
    pdfDocument = null;
    totalPages = 0;
    markedPages.clear();
    lastGeneratedBlob = null;
    lastGeneratedFilename = '';
    if (fileInput) fileInput.value = '';

    clearError();
    if (dropZone) dropZone.style.display = 'block';
    if (fileInfoBar) fileInfoBar.style.display = 'none';
    if (deleteControlsBar) deleteControlsBar.style.display = 'none';
    if (pagesContainer) pagesContainer.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    if (successCard) successCard.style.display = 'none';
    if (thumbGrid) thumbGrid.innerHTML = '';
    if (pageRangeInput) pageRangeInput.value = '';
  }

  // File Selection and Validation
  async function handleFileSelect(file) {
    clearError();

    // Dual Extension and MIME validation
    const nameLower = (file.name || '').toLowerCase();
    const isPdfExt = nameLower.endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === '';

    if (!isPdfExt && !isPdfMime) {
      showError('Unsupported file format. Please upload a valid PDF document (.pdf).');
      return;
    }

    // Memory warning for files > 100 MB
    if (file.size > 100 * 1024 * 1024) {
      const proceed = confirm('This PDF exceeds 100 MB. Processing large files in browser memory may cause performance issues. Would you like to continue?');
      if (!proceed) return;
    }

    originalFile = file;
    markedPages.clear();
    if (pageRangeInput) pageRangeInput.value = '';
    if (successCard) successCard.style.display = 'none';

    if (dropZone) dropZone.style.display = 'none';
    if (fileInfoBar) fileInfoBar.style.display = 'flex';
    if (deleteControlsBar) deleteControlsBar.style.display = 'flex';
    if (pagesContainer) pagesContainer.style.display = 'block';
    if (actionBar) actionBar.style.display = 'flex';

    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    if (fileMetaDisplay) fileMetaDisplay.textContent = `${sizeMb} MB • Reading document...`;

    try {
      originalArrayBuffer = await file.arrayBuffer();

      // Magic Byte Verification: %PDF (0x25, 0x50, 0x44, 0x46)
      const bytes = new Uint8Array(originalArrayBuffer.slice(0, 4));
      if (bytes.length >= 4) {
        const isPdfMagic = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        if (!isPdfMagic) {
          showError('Corrupt or invalid PDF: Header does not match standard PDF specifications. Please check the file.');
          resetAll();
          return;
        }
      }

      const loadingTask = pdfjsLib.getDocument({ data: originalArrayBuffer });
      pdfDocument = await loadingTask.promise;
      totalPages = pdfDocument.numPages;

      if (totalPages === 0) {
        showError('This PDF document contains no renderable pages.');
        resetAll();
        return;
      }

      if (fileMetaDisplay) {
        fileMetaDisplay.textContent = `${sizeMb} MB • ${totalPages} Page${totalPages > 1 ? 's' : ''}`;
      }

      renderThumbnailsLazy();
      updateUIState();
    } catch (err) {
      console.error('PDF load error:', err);
      if (err.name === 'PasswordException') {
        showError('This document is password protected. Please remove the password before deleting pages.');
      } else {
        showError('Failed to load PDF file. The file may be corrupt or unreadable. Please check the file and try again.');
      }
      resetAll();
    }
  }

  // Lazy Render Thumbnails with IntersectionObserver
  function renderThumbnailsLazy() {
    if (!thumbGrid) return;
    thumbGrid.innerHTML = '';
    if (renderProgressText) renderProgressText.style.display = 'inline';

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(async entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          obs.unobserve(card);
          const pageNum = parseInt(card.getAttribute('data-page'), 10);
          await renderSinglePage(card, pageNum);
        }
      });
    }, { rootMargin: '100px 0px' });

    for (let i = 1; i <= totalPages; i++) {
      const card = createPageCard(i);
      thumbGrid.appendChild(card);
      observer.observe(card);
    }

    if (renderProgressText) renderProgressText.style.display = 'none';
  }

  async function renderSinglePage(card, pageNum) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = card.querySelector('canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    } catch (e) {
      console.warn('Page thumbnail render error for page', pageNum, e);
    }
  }

  function createPageCard(pageNum) {
    const card = document.createElement('div');
    card.className = 'page-thumb-card';
    card.setAttribute('data-page', pageNum);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'checkbox');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `Page ${pageNum}`);

    card.innerHTML = `
      <div class="thumb-canvas-wrap">
        <canvas></canvas>
        <div class="delete-overlay">
          <div class="delete-overlay-icon">🗑️</div>
          <div class="delete-overlay-text">WILL DELETE</div>
        </div>
      </div>
      <div class="page-card-footer">
        <span>Page ${pageNum}</span>
        <span class="delete-status-pill">Keep</span>
      </div>
    `;

    card.addEventListener('click', () => toggleMarkPage(pageNum));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMarkPage(pageNum);
      }
    });

    return card;
  }

  function toggleMarkPage(pageNum) {
    if (markedPages.has(pageNum)) {
      markedPages.delete(pageNum);
    } else {
      markedPages.add(pageNum);
    }
    syncRangeInputFromSet();
    updateUIState();
  }

  function updateUIState() {
    if (!thumbGrid) return;
    const cards = thumbGrid.querySelectorAll('.page-thumb-card');
    cards.forEach(card => {
      const p = parseInt(card.getAttribute('data-page'), 10);
      const pill = card.querySelector('.delete-status-pill');
      if (markedPages.has(p)) {
        card.classList.add('marked-delete');
        card.setAttribute('aria-checked', 'true');
        if (pill) pill.textContent = 'DELETE';
      } else {
        card.classList.remove('marked-delete');
        card.setAttribute('aria-checked', 'false');
        if (pill) pill.textContent = 'Keep';
      }
    });

    const count = markedPages.size;
    const remaining = totalPages - count;

    if (count === 0) {
      if (actionSummaryTitle) actionSummaryTitle.textContent = 'No pages marked for deletion';
      if (actionSummaryDesc) actionSummaryDesc.textContent = 'Click on any page above to mark it for removal';
      if (btnExecuteDelete) btnExecuteDelete.disabled = true;
      if (btnDeleteLabel) btnDeleteLabel.textContent = 'Delete Selected';
    } else if (remaining === 0) {
      if (actionSummaryTitle) actionSummaryTitle.textContent = `All ${totalPages} pages marked for deletion!`;
      if (actionSummaryDesc) actionSummaryDesc.textContent = 'Cannot delete all pages. At least 1 page must remain in the document.';
      if (btnExecuteDelete) btnExecuteDelete.disabled = true;
      if (btnDeleteLabel) btnDeleteLabel.textContent = 'Cannot Delete All Pages';
    } else {
      if (actionSummaryTitle) actionSummaryTitle.textContent = `${count} page${count > 1 ? 's' : ''} marked for deletion`;
      if (actionSummaryDesc) actionSummaryDesc.textContent = `${remaining} page${remaining > 1 ? 's' : ''} will remain in your cleaned PDF`;
      if (btnExecuteDelete) btnExecuteDelete.disabled = false;
      if (btnDeleteLabel) btnDeleteLabel.textContent = `Delete Selected (${count} Page${count > 1 ? 's' : ''})`;
    }
  }

  // Helper Selection Buttons
  const btnSelAll = document.getElementById('btn-sel-all');
  const btnSelNone = document.getElementById('btn-sel-none');
  const btnSelOdd = document.getElementById('btn-sel-odd');
  const btnSelEven = document.getElementById('btn-sel-even');

  if (btnSelAll) {
    btnSelAll.addEventListener('click', () => {
      for (let i = 1; i <= totalPages; i++) markedPages.add(i);
      syncRangeInputFromSet();
      updateUIState();
    });
  }

  if (btnSelNone) {
    btnSelNone.addEventListener('click', () => {
      markedPages.clear();
      syncRangeInputFromSet();
      updateUIState();
    });
  }

  if (btnSelOdd) {
    btnSelOdd.addEventListener('click', () => {
      markedPages.clear();
      for (let i = 1; i <= totalPages; i += 2) markedPages.add(i);
      syncRangeInputFromSet();
      updateUIState();
    });
  }

  if (btnSelEven) {
    btnSelEven.addEventListener('click', () => {
      markedPages.clear();
      for (let i = 2; i <= totalPages; i += 2) markedPages.add(i);
      syncRangeInputFromSet();
      updateUIState();
    });
  }

  // Parse text range input (e.g. "1, 3, 5-8")
  if (pageRangeInput) {
    pageRangeInput.addEventListener('input', () => {
      const text = pageRangeInput.value.trim();
      markedPages.clear();
      if (text) {
        const parts = text.split(',');
        parts.forEach(part => {
          const clean = part.trim();
          if (clean.includes('-')) {
            const [startStr, endStr] = clean.split('-');
            const s = parseInt(startStr, 10);
            const e = parseInt(endStr, 10);
            if (!isNaN(s) && !isNaN(e)) {
              const min = Math.max(1, Math.min(s, e));
              const max = Math.min(totalPages, Math.max(s, e));
              for (let i = min; i <= max; i++) markedPages.add(i);
            }
          } else {
            const num = parseInt(clean, 10);
            if (!isNaN(num) && num >= 1 && num <= totalPages) {
              markedPages.add(num);
            }
          }
        });
      }
      updateUIState();
    });
  }

  function syncRangeInputFromSet() {
    if (!pageRangeInput) return;
    if (markedPages.size === 0) {
      pageRangeInput.value = '';
      return;
    }
    const sorted = Array.from(markedPages).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    pageRangeInput.value = ranges.join(', ');
  }

  // Execute Page Deletion via PDF-Lib in RAM
  if (btnExecuteDelete) {
    btnExecuteDelete.addEventListener('click', executeDelete);
  }

  async function executeDelete() {
    if (markedPages.size === 0 || markedPages.size >= totalPages) return;

    clearError();
    btnExecuteDelete.disabled = true;
    if (btnDeleteLabel) btnDeleteLabel.textContent = 'Processing in RAM...';

    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.load(originalArrayBuffer);

      // Remove pages from highest index to lowest to prevent index shifting errors
      const pagesToRemove = Array.from(markedPages)
        .map(p => p - 1)
        .sort((a, b) => b - a);

      for (const pageIdx of pagesToRemove) {
        pdfDoc.removePage(pageIdx);
      }

      const pdfBytes = await pdfDoc.save();
      lastGeneratedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      const baseName = (originalFile.name || 'document.pdf').replace(/\.pdf$/i, '');
      lastGeneratedFilename = `${baseName}_deleted_pages.pdf`;

      triggerFileDownload(lastGeneratedBlob, lastGeneratedFilename);

      if (successDesc) {
        successDesc.textContent = `Successfully removed ${markedPages.size} page(s). Downloaded "${lastGeneratedFilename}" with ${totalPages - markedPages.size} page(s).`;
      }
      if (successCard) successCard.style.display = 'block';
      if (actionBar) actionBar.style.display = 'none';
      if (deleteControlsBar) deleteControlsBar.style.display = 'none';
      if (pagesContainer) pagesContainer.style.display = 'none';
      window.scrollTo({ top: successCard.offsetTop - 40, behavior: 'smooth' });

    } catch (err) {
      console.error('Delete execution error:', err);
      showError('Failed to process and delete pages: ' + (err.message || 'Unknown memory error.'));
      updateUIState();
    }
  }

  if (btnDownloadAgain) {
    btnDownloadAgain.addEventListener('click', () => {
      if (lastGeneratedBlob && lastGeneratedFilename) {
        triggerFileDownload(lastGeneratedBlob, lastGeneratedFilename);
      }
    });
  }

  function triggerFileDownload(blob, filename) {
    // Android Native Shell Bridge support
    if (window.AndroidBlobBridge && window.AndroidBlobBridge.processBlobData) {
      const reader = new FileReader();
      reader.onloadend = function () {
        window.AndroidBlobBridge.processBlobData(reader.result, 'application/pdf', filename);
      };
      reader.readAsDataURL(blob);
      return;
    }

    if (lastObjectURL) {
      URL.revokeObjectURL(lastObjectURL);
    }
    lastObjectURL = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lastObjectURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  }

  // Keyboard Shortcuts (Ctrl+O, Ctrl+S, Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (fileInput) fileInput.click();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (btnExecuteDelete && !btnExecuteDelete.disabled && actionBar && actionBar.style.display !== 'none') {
        executeDelete();
      } else if (lastGeneratedBlob && lastGeneratedFilename) {
        triggerFileDownload(lastGeneratedBlob, lastGeneratedFilename);
      }
    } else if (e.key === 'Escape') {
      if (originalFile) {
        const confirmReset = confirm('Reset this document workspace?');
        if (confirmReset) resetAll();
      }
    }
  });

})();
