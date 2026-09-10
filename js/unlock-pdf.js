/**
 * LocalDoc - Unlock PDF Controller: unlock-pdf.js
 * 100% In-Browser RAM Client-Side Execution
 */
(function() {
  'use strict';

  let currentFile = null;
  let currentBuffer = null;
  let pdfDocInstance = null;
  let unlockedPdfBytes = null;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const unlockWorkspace = document.getElementById('unlock-workspace');
  const docFilename = document.getElementById('doc-filename');
  const docFilesize = document.getElementById('doc-filesize');
  const lockStatusBadge = document.getElementById('lock-status-badge');
  const passwordBox = document.getElementById('password-box');
  const pdfPasswordInput = document.getElementById('pdf-password');
  const togglePwBtn = document.getElementById('toggle-pw-btn');
  const pwErrorMsg = document.getElementById('pw-error-msg');
  const decryptBtn = document.getElementById('decrypt-btn');
  const changeFileBtn = document.getElementById('change-file-btn');
  const unlockedSection = document.getElementById('unlocked-section');
  const unlockedThumbs = document.getElementById('unlocked-thumbs');
  const unlockedPageCount = document.getElementById('unlocked-page-count');
  const downloadUnlockedBtn = document.getElementById('download-unlocked-btn');
  const resetBtn = document.getElementById('reset-btn');

  // Wire file pickers
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    }, false);
  });
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Password visibility toggle
  togglePwBtn.addEventListener('click', () => {
    if (pdfPasswordInput.type === 'password') {
      pdfPasswordInput.type = 'text';
    } else {
      pdfPasswordInput.type = 'password';
    }
  });

  changeFileBtn.addEventListener('click', () => {
    resetState();
    fileInput.click();
  });

  resetBtn.addEventListener('click', () => {
    resetState();
  });

  function resetState() {
    currentFile = null;
    currentBuffer = null;
    pdfDocInstance = null;
    unlockedPdfBytes = null;
    fileInput.value = '';
    pdfPasswordInput.value = '';
    pwErrorMsg.style.display = 'none';
    pwErrorMsg.textContent = '';
    dropZone.style.display = 'block';
    unlockWorkspace.style.display = 'none';
    passwordBox.style.display = 'block';
    unlockedSection.style.display = 'none';
    unlockedThumbs.innerHTML = '';
  }

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    currentFile = file;
    docFilename.textContent = file.name;
    docFilesize.textContent = UIUtils.formatBytes ? UIUtils.formatBytes(file.size) : `${(file.size / 1024).toFixed(1)} KB`;

    dropZone.style.display = 'none';
    unlockWorkspace.style.display = 'block';

    try {
      currentBuffer = await file.arrayBuffer();
      checkEncryption(currentBuffer);
    } catch (err) {
      console.error('Error reading PDF:', err);
      alert('Failed to read file into memory. ' + err.message);
      resetState();
    }
  }

  async function checkEncryption(buffer) {
    pwErrorMsg.style.display = 'none';
    let isEncrypted = false;

    try {
      // Test with PDF.js
      const loadingTask = pdfjsLib.getDocument({
        data: buffer.slice(0),
        onPassword: function(callback, reason) {
          isEncrypted = true;
          // Reason 1: NEED_PASSWORD, 2: INCORRECT_PASSWORD
        }
      });

      const pdf = await loadingTask.promise;
      // If we got here without needing password
      pdfDocInstance = pdf;
      lockStatusBadge.className = 'status-badge unlocked';
      lockStatusBadge.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>No Password Protection Detected</span>
      `;
      passwordBox.style.display = 'none';
      await generateUnlockedPdf(pdf);
    } catch (err) {
      if (err.name === 'PasswordException' || isEncrypted || (err.message && err.message.toLowerCase().includes('password'))) {
        // Password required
        lockStatusBadge.className = 'status-badge locked';
        lockStatusBadge.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Password Protected</span>
        `;
        passwordBox.style.display = 'block';
        pdfPasswordInput.focus();
      } else {
        console.warn('PDF check error:', err);
        lockStatusBadge.className = 'status-badge locked';
        lockStatusBadge.textContent = 'Encrypted PDF';
        passwordBox.style.display = 'block';
      }
    }
  }

  decryptBtn.addEventListener('click', async () => {
    const enteredPassword = pdfPasswordInput.value;
    if (!enteredPassword) {
      pwErrorMsg.textContent = 'Please enter the document password to unlock.';
      pwErrorMsg.style.display = 'block';
      return;
    }

    pwErrorMsg.style.display = 'none';
    decryptBtn.disabled = true;
    decryptBtn.textContent = 'Decrypting...';

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: currentBuffer.slice(0),
        password: enteredPassword
      });

      const pdf = await loadingTask.promise;
      pdfDocInstance = pdf;

      lockStatusBadge.className = 'status-badge unlocked';
      lockStatusBadge.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Decrypted & Unlocked</span>
      `;

      passwordBox.style.display = 'none';
      await generateUnlockedPdf(pdf);
    } catch (err) {
      console.error('Decryption failed:', err);
      pwErrorMsg.textContent = 'Incorrect password. Please verify and try again.';
      pwErrorMsg.style.display = 'block';
    } finally {
      decryptBtn.disabled = false;
      decryptBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
        <span>Decrypt & Unlock PDF</span>
      `;
    }
  });

  async function generateUnlockedPdf(pdf) {
    unlockedSection.style.display = 'block';
    unlockedThumbs.innerHTML = '';
    const numPages = pdf.numPages;
    unlockedPageCount.textContent = numPages;

    // Build unencrypted PDF document via pdf-lib
    const newPdfDoc = await PDFLib.PDFDocument.create();

    const maxPreviews = Math.min(numPages, 12);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Convert canvas to image bytes and embed into new PDF
      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer();
      const embeddedImg = await newPdfDoc.embedJpg(imgBytes);

      const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });

      // Show thumbnail
      if (pageNum <= maxPreviews) {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'page-thumb-preview';
        
        const thumbCanvas = document.createElement('canvas');
        const thumbCtx = thumbCanvas.getContext('2d');
        const thumbScale = 120 / viewport.width;
        const thumbViewport = page.getViewport({ scale: thumbScale });
        thumbCanvas.width = thumbViewport.width;
        thumbCanvas.height = thumbViewport.height;

        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

        const label = document.createElement('div');
        label.style.fontSize = '0.75rem';
        label.style.fontWeight = '700';
        label.style.marginTop = '4px';
        label.style.color = 'var(--text-muted)';
        label.textContent = `Page ${pageNum}`;

        thumbDiv.appendChild(thumbCanvas);
        thumbDiv.appendChild(label);
        unlockedThumbs.appendChild(thumbDiv);
      }
    }

    unlockedPdfBytes = await newPdfDoc.save();
  }

  downloadUnlockedBtn.addEventListener('click', () => {
    if (!unlockedPdfBytes) {
      alert('Unlocked document is not ready yet.');
      return;
    }

    const blob = new Blob([unlockedPdfBytes], { type: 'application/pdf' });
    const baseName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
    const unlockedName = `${baseName}_unlocked.pdf`;

    if (window.UIUtils && typeof window.UIUtils.downloadBlob === 'function') {
      window.UIUtils.downloadBlob(blob, unlockedName, 'application/pdf');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = unlockedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });

})();
