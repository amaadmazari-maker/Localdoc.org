/**
 * LocalDoc.org — Organize PDF Engine
 * Visual page reordering, rotation (90/180/270 deg), page deletion, and multi-file merging.
 * 100% In-Browser RAM Execution via PDF.js & PDF-Lib. Zero Server Uploads.
 */

(function() {
  'use strict';

  // State
  let sourceFiles = []; // [{ id, name, arrayBuffer, pdfDoc, pages: [...] }]
  let pagesList = [];   // [{ id, fileId, pageIndex, rotation: 0, thumbnailDataUrl }]
  let dragSrcEl = null;

  // DOM Elements
  const dropZone = document.getElementById('org-drop-zone');
  const fileInput = document.getElementById('org-file-input');
  const addMoreInput = document.getElementById('org-add-more-input');
  const emptyState = document.getElementById('org-empty-state');
  const workspace = document.getElementById('org-workspace');
  const pagesGrid = document.getElementById('org-pages-grid');
  const totalPagesBadge = document.getElementById('org-total-pages');
  const saveBtn = document.getElementById('org-save-btn');
  const rotateAllBtn = document.getElementById('org-rotate-all-btn');
  const resetBtn = document.getElementById('org-reset-btn');

  function init() {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
    }
    setupEvents();
  }

  function setupEvents() {
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
        loadPdfFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        loadPdfFiles(Array.from(e.target.files));
      }
    });

    if (addMoreInput) {
      addMoreInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          loadPdfFiles(Array.from(e.target.files));
        }
      });
    }

    if (rotateAllBtn) {
      rotateAllBtn.addEventListener('click', () => {
        pagesList.forEach(p => {
          p.rotation = (p.rotation + 90) % 360;
        });
        renderPagesGrid();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all pages and clear work?')) {
          sourceFiles = [];
          pagesList = [];
          workspace.style.display = 'none';
          emptyState.style.display = 'block';
          fileInput.value = '';
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', exportOrganizedPdf);
    }
  }

  async function loadPdfFiles(files) {
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      alert('Please select valid PDF file(s).');
      return;
    }

    emptyState.style.display = 'none';
    workspace.style.display = 'block';

    for (const file of pdfFiles) {
      const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      let arrayBuffer;
      if (window.UIUtils && window.UIUtils.readFileAsArrayBuffer) {
        arrayBuffer = await window.UIUtils.readFileAsArrayBuffer(file);
      } else if (file.arrayBuffer) {
        try {
          arrayBuffer = await file.arrayBuffer();
        } catch (e) {
          console.warn("file.arrayBuffer fallback", e);
        }
      }
      if (!arrayBuffer) {
        arrayBuffer = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error("Failed to read file"));
          r.readAsArrayBuffer(file);
        });
      }

      try {
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        sourceFiles.push({
          id: fileId,
          name: file.name,
          arrayBuffer: arrayBuffer,
          numPages: pdfDoc.numPages
        });

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          pagesList.push({
            id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            fileId: fileId,
            pageIndex: i - 1, // 0-indexed for PDF-Lib
            originalPageNum: i,
            rotation: 0,
            thumbnailDataUrl: canvas.toDataURL('image/jpeg', 0.8)
          });
        }
      } catch (err) {
        console.error('Error reading PDF:', err);
        alert(`Could not load ${file.name}: Password protected or invalid format.`);
      }
    }

    renderPagesGrid();
  }

  function renderPagesGrid() {
    pagesGrid.innerHTML = '';
    totalPagesBadge.textContent = `${pagesList.length} Page${pagesList.length === 1 ? '' : 's'}`;

    pagesList.forEach((pageItem, index) => {
      const card = document.createElement('div');
      card.className = 'org-page-card';
      card.setAttribute('draggable', 'true');
      card.dataset.index = index;

      card.innerHTML = `
        <div class="org-card-header">
          <span class="org-page-badge">#${index + 1}</span>
          <div class="org-card-actions">
            <button type="button" class="org-btn-mini" title="Rotate Left" data-action="rot-left">↺</button>
            <button type="button" class="org-btn-mini" title="Rotate Right" data-action="rot-right">↻</button>
            <button type="button" class="org-btn-mini org-btn-delete" title="Delete Page" data-action="delete">✕</button>
          </div>
        </div>
        <div class="org-thumb-wrap">
          <img src="${pageItem.thumbnailDataUrl}" alt="Page ${index + 1}" style="transform: rotate(${pageItem.rotation}deg);" />
        </div>
        <div class="org-card-footer">
          <button type="button" class="org-shift-btn" data-action="move-left" ${index === 0 ? 'disabled' : ''} title="Move Left">◀</button>
          <span style="font-size:0.75rem; color:var(--text-tertiary);">Drag to reorder</span>
          <button type="button" class="org-shift-btn" data-action="move-right" ${index === pagesList.length - 1 ? 'disabled' : ''} title="Move Right">▶</button>
        </div>
      `;

      // Event Listeners on Card Buttons
      card.querySelector('[data-action="rot-left"]').addEventListener('click', (e) => {
        e.stopPropagation();
        pageItem.rotation = (pageItem.rotation + 270) % 360;
        renderPagesGrid();
      });

      card.querySelector('[data-action="rot-right"]').addEventListener('click', (e) => {
        e.stopPropagation();
        pageItem.rotation = (pageItem.rotation + 90) % 360;
        renderPagesGrid();
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        pagesList.splice(index, 1);
        renderPagesGrid();
      });

      const moveLeft = card.querySelector('[data-action="move-left"]');
      if (moveLeft && index > 0) {
        moveLeft.addEventListener('click', (e) => {
          e.stopPropagation();
          const temp = pagesList[index];
          pagesList[index] = pagesList[index - 1];
          pagesList[index - 1] = temp;
          renderPagesGrid();
        });
      }

      const moveRight = card.querySelector('[data-action="move-right"]');
      if (moveRight && index < pagesList.length - 1) {
        moveRight.addEventListener('click', (e) => {
          e.stopPropagation();
          const temp = pagesList[index];
          pagesList[index] = pagesList[index + 1];
          pagesList[index + 1] = temp;
          renderPagesGrid();
        });
      }

      // Drag & Drop Reordering
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragenter', handleDragEnter);
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('dragleave', handleDragLeave);
      card.addEventListener('drop', handleDrop);
      card.addEventListener('dragend', handleDragEnd);

      pagesGrid.appendChild(card);
    });
  }

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    this.classList.add('dragging');
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    this.classList.remove('drag-over');

    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = parseInt(this.dataset.index, 10);

    if (fromIndex !== toIndex) {
      const movedItem = pagesList.splice(fromIndex, 1)[0];
      pagesList.splice(toIndex, 0, movedItem);
      renderPagesGrid();
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.org-page-card').forEach(c => c.classList.remove('drag-over'));
  }

  async function exportOrganizedPdf() {
    if (pagesList.length === 0) {
      alert('No pages left to export! Please add some pages.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving PDF in RAM...';

    try {
      const { PDFDocument, degrees } = PDFLib;
      const mergedPdf = await PDFDocument.create();

      // Cache parsed PDF-Lib documents for all source files
      const pdfDocsCache = {};
      for (const file of sourceFiles) {
        pdfDocsCache[file.id] = await PDFDocument.load(file.arrayBuffer);
      }

      // Group pages by source document for efficient batch copying
      for (const item of pagesList) {
        const srcDoc = pdfDocsCache[item.fileId];
        const [copiedPage] = await mergedPdf.copyPages(srcDoc, [item.pageIndex]);

        // Apply page rotation
        const currentRot = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRot + item.rotation) % 360));

        mergedPdf.addPage(copiedPage);
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = sourceFiles.length > 0 ? sourceFiles[0].name.replace(/\.[^/.]+$/, '') : 'organized';
      const filename = `${baseName}_organized.pdf`;

      if (window.UIUtils && window.UIUtils.downloadBlob) {
        window.UIUtils.downloadBlob(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to generate organized PDF. Please check console.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save & Download Organized PDF';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
