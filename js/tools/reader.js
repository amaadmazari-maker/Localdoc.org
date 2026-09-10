/**
 * LocalDoc.org — Universal Document Reader & In-Browser Viewer Engine
 * Supports PDF, Word (.docx), Excel (.xlsx, .xls, .csv), Text, and Images.
 * 100% Client-Side In-Memory Execution. Zero Server Uploads.
 */

(function() {
  'use strict';

  // State
  let currentFile = null;
  let fileType = null; // 'pdf', 'docx', 'xlsx', 'text', 'image'
  let pdfDoc = null;
  let pdfCurrentPage = 1;
  let pdfTotalPages = 0;
  let pdfScale = 1.25;
  let pdfRotation = 0;
  let excelWorkbook = null;
  let currentSheetName = null;

  // DOM Elements
  const dropZone = document.getElementById('reader-drop-zone');
  const fileInput = document.getElementById('reader-file-input');
  const viewerWorkspace = document.getElementById('reader-workspace');
  const emptyState = document.getElementById('reader-empty-state');
  const docTitle = document.getElementById('reader-doc-title');
  const docMeta = document.getElementById('reader-doc-meta');
  const pageNavGroup = document.getElementById('reader-page-nav-group');
  const pageInput = document.getElementById('reader-page-input');
  const pageTotalSpan = document.getElementById('reader-page-total');
  const zoomLevelSpan = document.getElementById('reader-zoom-level');
  const sheetTabsBar = document.getElementById('reader-sheet-tabs');
  const contentContainer = document.getElementById('reader-content-canvas');
  const searchInput = document.getElementById('reader-search-input');

  // Initialize PDF.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
  }

  function init() {
    setupEventListeners();
    checkIncomingDocument();
  }

  function setupEventListeners() {
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    // Toolbar actions
    const prevPageBtn = document.getElementById('reader-prev-page');
    const nextPageBtn = document.getElementById('reader-next-page');
    const zoomInBtn = document.getElementById('reader-zoom-in');
    const zoomOutBtn = document.getElementById('reader-zoom-out');
    const zoomFitBtn = document.getElementById('reader-zoom-fit');
    const rotateBtn = document.getElementById('reader-rotate-btn');
    const fullscreenBtn = document.getElementById('reader-fullscreen-btn');
    const printBtn = document.getElementById('reader-print-btn');
    const downloadBtn = document.getElementById('reader-download-btn');
    const closeBtn = document.getElementById('reader-close-btn');

    if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePdfPage(-1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePdfPage(1));
    if (pageInput) pageInput.addEventListener('change', (e) => {
      const pageNum = parseInt(e.target.value, 10);
      if (pageNum >= 1 && pageNum <= pdfTotalPages) {
        pdfCurrentPage = pageNum;
        renderPdfPage(pdfCurrentPage);
      }
    });

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(0.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-0.2));
    if (zoomFitBtn) zoomFitBtn.addEventListener('click', resetZoom);
    if (rotateBtn) rotateBtn.addEventListener('click', rotateDocument);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    if (printBtn) printBtn.addEventListener('click', printDocument);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCurrentFile);
    if (closeBtn) closeBtn.addEventListener('click', closeViewer);

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value.trim());
      });
    }
  }

  function dataURLtoBlob(dataurl) {
    try {
      const arr = dataurl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.warn("dataURLtoBlob failed", e);
      return null;
    }
  }

  // Check if a document was passed via sessionStorage (from CamScanner, Vault, etc.)
  function checkIncomingDocument() {
    try {
      // 1. Check localdoc_view_document or localdoc_view_doc
      const rawStored = sessionStorage.getItem('localdoc_view_document') || sessionStorage.getItem('localdoc_view_doc');
      if (rawStored) {
        sessionStorage.removeItem('localdoc_view_document');
        sessionStorage.removeItem('localdoc_view_doc');
        const docData = JSON.parse(rawStored);
        if (docData && docData.dataUrl) {
          const fileName = docData.filename || docData.name || docData.title || 'Document.pdf';
          const fileType = docData.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
          const blob = dataURLtoBlob(docData.dataUrl);
          if (blob) {
            const file = new File([blob], fileName, { type: fileType });
            handleFile(file);
            return;
          }
        }
      }

      // 2. Check direct file from CamScanner
      const csDataUrl = sessionStorage.getItem('localdoc_reader_file');
      const csName = sessionStorage.getItem('localdoc_reader_name') || 'Scanned_Document.jpg';
      if (csDataUrl) {
        sessionStorage.removeItem('localdoc_reader_file');
        sessionStorage.removeItem('localdoc_reader_name');
        const blob = dataURLtoBlob(csDataUrl);
        if (blob) {
          const file = new File([blob], csName, { type: blob.type || 'image/jpeg' });
          handleFile(file);
          return;
        }
      }
    } catch (err) {
      console.warn('No incoming session document found', err);
    }
  }

  function handleFile(file) {
    currentFile = file;
    const name = file.name.toLowerCase();
    
    docTitle.textContent = file.name;
    docMeta.textContent = `${(file.size / 1024).toFixed(1)} KB • ${file.type || 'Document'}`;

    emptyState.style.display = 'none';
    viewerWorkspace.style.display = 'flex';
    contentContainer.innerHTML = '<div class="reader-loading-spinner"><div class="spinner"></div><p>Loading document in secure RAM...</p></div>';
    sheetTabsBar.style.display = 'none';
    pageNavGroup.style.display = 'none';

    if (name.endsWith('.pdf')) {
      fileType = 'pdf';
      pageNavGroup.style.display = 'inline-flex';
      loadPdf(file);
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      fileType = 'docx';
      loadWordDocx(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      fileType = 'xlsx';
      sheetTabsBar.style.display = 'flex';
      loadExcel(file);
    } else if (name.endsWith('.txt') || name.endsWith('.json') || name.endsWith('.md')) {
      fileType = 'text';
      loadText(file);
    } else if (file.type.startsWith('image/')) {
      fileType = 'image';
      loadImage(file);
    } else {
      // Try PDF or fallback to text
      fileType = 'text';
      loadText(file);
    }
  }

  // Safe ArrayBuffer loader supporting Android WebViews and FileReader fallback
  async function safeReadArrayBuffer(file) {
    if (window.UIUtils && window.UIUtils.readFileAsArrayBuffer) {
      return await window.UIUtils.readFileAsArrayBuffer(file);
    }
    if (file.arrayBuffer) {
      try {
        return await file.arrayBuffer();
      } catch (e) {
        console.warn('file.arrayBuffer failed, falling back to FileReader', e);
      }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read document file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ==================== PDF ENGINE ====================
  async function loadPdf(file) {
    try {
      const arrayBuffer = await safeReadArrayBuffer(file);
      if (!window.pdfjsLib) {
        throw new Error('PDF.js viewer engine is not loaded');
      }
      pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfTotalPages = pdfDoc.numPages;
      pdfCurrentPage = 1;
      pageTotalSpan.textContent = `/ ${pdfTotalPages}`;
      pageInput.value = 1;
      pageInput.max = pdfTotalPages;
      renderPdfPage(pdfCurrentPage);
    } catch (err) {
      console.error('PDF load error:', err);
      contentContainer.innerHTML = `<div class="reader-error" style="text-align:center; padding:40px 20px; color:#EF4444;">
        <div style="font-size:2.5rem; margin-bottom:12px;">⚠️</div>
        <h3 style="font-weight:700; margin-bottom:8px; color:var(--text-primary);">Unable to render PDF document</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; max-width:400px; margin:0 auto 16px;">${err.message || 'The PDF file may be corrupted, password-protected, or in an unsupported format.'}</p>
        <button class="reader-tool-btn" onclick="document.getElementById('reader-file-input').click()" style="margin:0 auto;">Choose Another Document</button>
      </div>`;
    }
  }

  async function renderPdfPage(pageNumber) {
    if (!pdfDoc) return;
    contentContainer.innerHTML = '';

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: pdfScale, rotation: pdfRotation });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.className = 'reader-canvas-shadow';

    contentContainer.appendChild(canvas);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    pageInput.value = pageNumber;
    updateZoomDisplay();
  }

  function changePdfPage(delta) {
    if (!pdfDoc) return;
    const newPage = pdfCurrentPage + delta;
    if (newPage >= 1 && newPage <= pdfTotalPages) {
      pdfCurrentPage = newPage;
      renderPdfPage(pdfCurrentPage);
    }
  }

  // ==================== WORD (.DOCX) ENGINE ====================
  async function loadWordDocx(file) {
    try {
      const arrayBuffer = await safeReadArrayBuffer(file);
      if (!window.mammoth) {
        throw new Error('Mammoth Word parser not loaded');
      }

      const result = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      const html = result.value || '<p><em>Empty Word Document</em></p>';

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'word-doc-page';
      pageWrapper.innerHTML = html;

      contentContainer.innerHTML = '';
      contentContainer.appendChild(pageWrapper);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error" style="text-align:center; padding:40px 20px; color:#EF4444;">
        <div style="font-size:2.5rem; margin-bottom:12px;">⚠️</div>
        <h3 style="font-weight:700; margin-bottom:8px; color:var(--text-primary);">Failed to parse Word document</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; max-width:400px; margin:0 auto 16px;">${err.message || 'The Word file could not be parsed.'}</p>
        <button class="reader-tool-btn" onclick="document.getElementById('reader-file-input').click()" style="margin:0 auto;">Choose Another Document</button>
      </div>`;
    }
  }

  // ==================== EXCEL (.XLSX) ENGINE ====================
  async function loadExcel(file) {
    try {
      const arrayBuffer = await safeReadArrayBuffer(file);
      if (!window.XLSX) {
        throw new Error('SheetJS Excel engine not loaded');
      }

      excelWorkbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheetNames = excelWorkbook.SheetNames;

      if (!sheetNames || sheetNames.length === 0) {
        throw new Error('Workbook contains no sheets');
      }

      // Render Sheet Tabs
      sheetTabsBar.innerHTML = '';
      sheetNames.forEach((sheetName, index) => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `sheet-tab-btn ${index === 0 ? 'active' : ''}`;
        tabBtn.textContent = sheetName;
        tabBtn.addEventListener('click', () => {
          document.querySelectorAll('.sheet-tab-btn').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          renderExcelSheet(sheetName);
        });
        sheetTabsBar.appendChild(tabBtn);
      });

      renderExcelSheet(sheetNames[0]);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error">Failed to parse Spreadsheet: ${err.message}</div>`;
    }
  }

  function renderExcelSheet(sheetName) {
    if (!excelWorkbook) return;
    currentSheetName = sheetName;
    const worksheet = excelWorkbook.Sheets[sheetName];
    
    // Generate styled HTML Table with SheetJS
    const htmlTable = window.XLSX.utils.sheet_to_html(worksheet, {
      id: 'excel-data-table',
      editable: false
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'excel-table-scroll-container';
    wrapper.innerHTML = htmlTable;

    contentContainer.innerHTML = '';
    contentContainer.appendChild(wrapper);
  }

  // ==================== TEXT & IMAGE ====================
  async function loadText(file) {
    try {
      const text = await file.text();
      const pre = document.createElement('pre');
      pre.className = 'reader-text-container';
      pre.textContent = text;
      contentContainer.innerHTML = '';
      contentContainer.appendChild(pre);
    } catch (err) {
      contentContainer.innerHTML = `<div class="reader-error">Failed to read text file: ${err.message}</div>`;
    }
  }

  function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'reader-image-preview';
      contentContainer.innerHTML = '';
      contentContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  }

  // ==================== CONTROLS ====================
  function changeZoom(delta) {
    pdfScale = Math.max(0.5, Math.min(3.0, pdfScale + delta));
    if (fileType === 'pdf' && pdfDoc) {
      renderPdfPage(pdfCurrentPage);
    } else {
      contentContainer.style.transform = `scale(${pdfScale})`;
      contentContainer.style.transformOrigin = 'top center';
      updateZoomDisplay();
    }
  }

  function resetZoom() {
    pdfScale = 1.0;
    if (fileType === 'pdf' && pdfDoc) {
      renderPdfPage(pdfCurrentPage);
    } else {
      contentContainer.style.transform = 'scale(1)';
      updateZoomDisplay();
    }
  }

  function updateZoomDisplay() {
    if (zoomLevelSpan) {
      zoomLevelSpan.textContent = `${Math.round(pdfScale * 100)}%`;
    }
  }

  function rotateDocument() {
    pdfRotation = (pdfRotation + 90) % 360;
    if (fileType === 'pdf' && pdfDoc) {
      renderPdfPage(pdfCurrentPage);
    } else {
      contentContainer.style.transform = `rotate(${pdfRotation}deg)`;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      viewerWorkspace.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen();
    }
  }

  function printDocument() {
    window.print();
  }

  function downloadCurrentFile() {
    if (!currentFile) return;
    if (window.UIUtils && window.UIUtils.downloadBlob) {
      window.UIUtils.downloadBlob(currentFile, currentFile.name);
      return;
    }
    const url = URL.createObjectURL(currentFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function closeViewer() {
    currentFile = null;
    pdfDoc = null;
    excelWorkbook = null;
    contentContainer.innerHTML = '';
    viewerWorkspace.style.display = 'none';
    emptyState.style.display = 'block';
    if (fileInput) fileInput.value = '';
  }

  function handleSearch(query) {
    if (!query) return;
    if (window.find) {
      window.find(query, false, false, true, false, false, true);
    }
  }

  // Export API for global use
  window.openLocalDocReader = function(file) {
    handleFile(file);
  };

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
