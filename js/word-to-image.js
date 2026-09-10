/**
 * LocalDoc - Word to Image Controller: word-to-image.js
 * 100% In-Browser RAM Client-Side Execution
 */
(function() {
  'use strict';

  let currentFile = null;
  let currentBuffer = null;
  let htmlContent = '';
  let generatedBlob = null;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const wordWorkspace = document.getElementById('word-workspace');
  const docFilename = document.getElementById('doc-filename');
  const docFilesize = document.getElementById('doc-filesize');
  const changeFileBtn = document.getElementById('change-file-btn');
  const imgFormat = document.getElementById('img-format');
  const imgQuality = document.getElementById('img-quality');
  const pagesContainer = document.getElementById('pages-container');
  const downloadAllBtn = document.getElementById('download-all-btn');

  // Wire file pickers
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFile(e.target.files[0]);
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
      loadFile(e.dataTransfer.files[0]);
    }
  });

  changeFileBtn.addEventListener('click', () => {
    resetState();
    fileInput.click();
  });

  function resetState() {
    currentFile = null;
    currentBuffer = null;
    htmlContent = '';
    generatedBlob = null;
    fileInput.value = '';
    dropZone.style.display = 'block';
    wordWorkspace.style.display = 'none';
    pagesContainer.innerHTML = '';
  }

  async function loadFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.docx')) {
      alert('Please select a valid Word (.docx) document.');
      return;
    }

    currentFile = file;
    docFilename.textContent = file.name;
    docFilesize.textContent = UIUtils.formatBytes ? UIUtils.formatBytes(file.size) : `${(file.size / 1024).toFixed(1)} KB`;

    dropZone.style.display = 'none';
    wordWorkspace.style.display = 'block';

    try {
      currentBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: currentBuffer });
      htmlContent = result.value || '<p>Empty Word document</p>';

      renderWordPage();
    } catch (err) {
      console.error('Failed to parse docx:', err);
      alert('Failed to parse Word document: ' + err.message);
      resetState();
    }
  }

  function renderWordPage() {
    pagesContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'doc-page-card';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'doc-page-preview-wrap';
    previewWrap.innerHTML = htmlContent;

    const footer = document.createElement('div');
    footer.className = 'doc-page-footer';
    footer.innerHTML = `
      <span style="font-weight:700; font-size:0.85rem; color:var(--text-secondary);">Page 1</span>
      <button class="btn btn-primary" style="padding:4px 12px; font-size:0.8rem;" id="snap-page-btn">Export Image</button>
    `;

    card.appendChild(previewWrap);
    card.appendChild(footer);
    pagesContainer.appendChild(card);

    footer.querySelector('#snap-page-btn').addEventListener('click', () => {
      exportCanvasImage();
    });
  }

  async function exportCanvasImage() {
    const format = imgFormat.value; // 'png' or 'jpeg'
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? '.jpg' : '.png';

    // Build offscreen canvas rendering
    const canvas = document.createElement('canvas');
    const scale = parseFloat(imgQuality.value) || 2;
    const width = 800 * scale;
    const height = 1100 * scale;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Text formatting
    ctx.fillStyle = '#0F172A';
    ctx.font = `${14 * scale}px sans-serif`;

    // Strip HTML to clean text paragraphs
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const textLines = tempDiv.innerText.split('\n').map(l => l.trim()).filter(Boolean);

    let currentY = 50 * scale;
    const margin = 50 * scale;
    const maxTextWidth = width - margin * 2;

    textLines.forEach(line => {
      if (currentY > height - 40 * scale) return;

      // Check if heading
      if (line.length < 50 && (line === line.toUpperCase() || line.endsWith(':'))) {
        ctx.font = `bold ${18 * scale}px sans-serif`;
        ctx.fillStyle = '#0284C7';
        currentY += 10 * scale;
      } else {
        ctx.font = `${14 * scale}px sans-serif`;
        ctx.fillStyle = '#0F172A';
      }

      // Word wrapping
      const words = line.split(' ');
      let currentLine = '';
      for (let w of words) {
        const testLine = currentLine + w + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && currentLine !== '') {
          ctx.fillText(currentLine, margin, currentY);
          currentLine = w + ' ';
          currentY += 22 * scale;
        } else {
          currentLine = testLine;
        }
      }
      ctx.fillText(currentLine, margin, currentY);
      currentY += 26 * scale;
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = currentFile ? currentFile.name.replace(/\.docx$/i, '') : 'document';
      const outputName = `${baseName}_converted${ext}`;

      if (window.UIUtils && typeof window.UIUtils.downloadBlob === 'function') {
        window.UIUtils.downloadBlob(blob, outputName, mimeType);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outputName;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, mimeType, 0.95);
  }

  downloadAllBtn.addEventListener('click', () => {
    exportCanvasImage();
  });

})();
