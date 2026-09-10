/**
 * LocalDoc - Metadata Editor Controller: metadata-editor.js
 * 100% In-Browser RAM Client-Side Execution
 */
(function() {
  'use strict';

  let currentFile = null;
  let currentBuffer = null;
  let pdfDoc = null;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const metaWorkspace = document.getElementById('meta-workspace');
  const docFilename = document.getElementById('doc-filename');
  const docFilesize = document.getElementById('doc-filesize');
  const docPageCount = document.getElementById('doc-page-count');
  const changeFileBtn = document.getElementById('change-file-btn');

  const metaTitle = document.getElementById('meta-title');
  const metaAuthor = document.getElementById('meta-author');
  const metaSubject = document.getElementById('meta-subject');
  const metaKeywords = document.getElementById('meta-keywords');
  const metaCreator = document.getElementById('meta-creator');
  const metaProducer = document.getElementById('meta-producer');

  const scrubBtn = document.getElementById('scrub-btn');
  const saveBtn = document.getElementById('save-btn');

  // Wire file pickers
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  changeFileBtn.addEventListener('click', () => {
    resetState();
    fileInput.click();
  });

  function resetState() {
    currentFile = null;
    currentBuffer = null;
    pdfDoc = null;
    fileInput.value = '';
    metaTitle.value = '';
    metaAuthor.value = '';
    metaSubject.value = '';
    metaKeywords.value = '';
    metaCreator.value = '';
    metaProducer.value = '';
    dropZone.style.display = 'block';
    metaWorkspace.style.display = 'none';
  }

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF document.');
      return;
    }

    currentFile = file;
    docFilename.textContent = file.name;
    docFilesize.textContent = UIUtils.formatBytes ? UIUtils.formatBytes(file.size) : `${(file.size / 1024).toFixed(1)} KB`;

    try {
      currentBuffer = await file.arrayBuffer();
      pdfDoc = await PDFLib.PDFDocument.load(currentBuffer.slice(0), { ignoreEncryption: true });

      docPageCount.textContent = pdfDoc.getPageCount();

      // Extract existing metadata
      metaTitle.value = pdfDoc.getTitle() || '';
      metaAuthor.value = pdfDoc.getAuthor() || '';
      metaSubject.value = pdfDoc.getSubject() || '';
      
      const keywords = pdfDoc.getKeywords();
      metaKeywords.value = Array.isArray(keywords) ? keywords.join(', ') : (keywords || '');
      
      metaCreator.value = pdfDoc.getCreator() || '';
      metaProducer.value = pdfDoc.getProducer() || '';

      dropZone.style.display = 'none';
      metaWorkspace.style.display = 'block';
    } catch (err) {
      console.error('Failed to load PDF metadata:', err);
      alert('Could not inspect PDF metadata: ' + err.message);
      resetState();
    }
  }

  // Privacy Scrub / Anonymize button
  scrubBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to wipe all metadata fields? This removes all author, application, and tracking tags.')) {
      metaTitle.value = '';
      metaAuthor.value = '';
      metaSubject.value = '';
      metaKeywords.value = '';
      metaCreator.value = '';
      metaProducer.value = 'LocalDoc Privacy Scrubber (Zero-Upload)';
    }
  });

  // Save updated metadata
  saveBtn.addEventListener('click', async () => {
    if (!pdfDoc) {
      alert('No document loaded.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving changes...';

    try {
      // Apply form values to pdfDoc
      pdfDoc.setTitle(metaTitle.value.trim());
      pdfDoc.setAuthor(metaAuthor.value.trim());
      pdfDoc.setSubject(metaSubject.value.trim());

      const rawKeywords = metaKeywords.value.trim();
      if (rawKeywords) {
        const kwArray = rawKeywords.split(',').map(s => s.trim()).filter(Boolean);
        pdfDoc.setKeywords(kwArray);
      } else {
        pdfDoc.setKeywords([]);
      }

      pdfDoc.setCreator(metaCreator.value.trim());
      pdfDoc.setProducer(metaProducer.value.trim() || 'LocalDoc (100% Client-Side RAM)');
      pdfDoc.setModificationDate(new Date());

      const updatedBytes = await pdfDoc.save();
      const updatedBlob = new Blob([updatedBytes], { type: 'application/pdf' });
      const baseName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
      const outputFilename = `${baseName}_metadata_updated.pdf`;

      if (window.UIUtils && typeof window.UIUtils.downloadBlob === 'function') {
        window.UIUtils.downloadBlob(updatedBlob, outputFilename, 'application/pdf');
      } else {
        const url = URL.createObjectURL(updatedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outputFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to save metadata:', err);
      alert('Error updating metadata: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        <span>Apply & Download Updated PDF</span>
      `;
    }
  });

})();
