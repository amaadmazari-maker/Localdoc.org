/**
 * LocalDoc.org — Unified Organize & Edit PDF Engine (js/tools/organize-pdf.js)
 * 
 * Capabilities:
 * Mode 1: Organize Grid (Drag & drop reordering, 90/180/270 rotate, duplicate, delete, insert blank page, merge extra PDFs).
 * Mode 2: Visual Page Editor & Annotation (Text boxes, image/logo upload, lines/arrows, shapes, stamps/stickers, freehand draw).
 * 
 * 100% Client-Side In-Memory Execution via PDF.js & PDF-Lib. Zero Server Uploads.
 */

(function() {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  let sourceFiles = []; // [{ id, name, arrayBuffer, numPages }]
  let pagesList = [];   // [{ id, fileId, pageIndex, rotation: 0, isBlank: false, width, height, thumbnailDataUrl, annotations: [] }]
  let activeMode = 'organize'; // 'organize' | 'edit'
  let activePageIndex = 0;     // Current page being edited in 'edit' mode
  let activeTool = 'select';   // 'select' | 'text' | 'image' | 'line' | 'arrow' | 'rect' | 'circle' | 'pen' | 'highlighter' | 'eraser'
  let selectedObject = null;   // Active selected annotation object
  let isInteracting = false;
  let interactionMode = null;  // 'drag' | 'resize' | 'draw' | 'create-shape' | 'create-line'
  let resizeHandle = null;     // 'tl' | 'tr' | 'bl' | 'br'
  let startPointer = { x: 0, y: 0 };
  let initialObjectState = null;
  let currentDrawStroke = null;
  let zoomLevel = 1.0;
  let dragSrcEl = null;

  // Active Tool Styling Defaults
  let strokeColor = '#DC2626';     // Red default
  let fillColor = 'transparent';
  let strokeWidth = 3;
  let fontSize = 18;
  let fontColor = '#0F172A';

  // DOM Elements
  const dropZone = document.getElementById('org-drop-zone');
  const fileInput = document.getElementById('org-file-input');
  const addMoreInput = document.getElementById('org-add-more-input');
  const emptyState = document.getElementById('org-empty-state');
  const workspace = document.getElementById('org-workspace');
  
  // Organize Grid View Elements
  const gridSection = document.getElementById('org-grid-section');
  const pagesGrid = document.getElementById('org-pages-grid');
  const totalPagesBadge = document.getElementById('org-total-pages');
  const rotateAllBtn = document.getElementById('org-rotate-all-btn');
  const insertBlankBtn = document.getElementById('org-insert-blank-btn');
  const resetBtn = document.getElementById('org-reset-btn');
  const saveBtn = document.getElementById('org-save-btn');

  // Mode Switcher Buttons
  const modeBtnOrganize = document.getElementById('org-mode-organize-btn');
  const modeBtnEdit = document.getElementById('org-mode-edit-btn');

  // Edit / Annotate Stage Elements
  const editSection = document.getElementById('org-edit-section');
  const editStageWrap = document.getElementById('org-edit-stage-wrap');
  const bgCanvas = document.getElementById('org-edit-bg-canvas');
  const overlayCanvas = document.getElementById('org-edit-overlay-canvas');
  const editPrevPageBtn = document.getElementById('org-edit-prev-btn');
  const editNextPageBtn = document.getElementById('org-edit-next-btn');
  const editPageNumInput = document.getElementById('org-edit-page-num');
  const editPageTotalSpan = document.getElementById('org-edit-page-total');
  const editBackGridBtn = document.getElementById('org-edit-back-grid-btn');
  const editDeletePageBtn = document.getElementById('org-edit-delete-page-btn');
  const editRotatePageBtn = document.getElementById('org-edit-rotate-page-btn');
  const imageUploadInput = document.getElementById('org-image-upload-input');
  const stickerModal = document.getElementById('org-sticker-modal');

  // ==========================================
  // INITIALIZATION & EVENT SETUP
  // ==========================================
  function init() {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
    }

    setupGlobalEvents();
    setupToolPaletteEvents();
    setupCanvasInteractions();

    window.handleOrganizePdfFiles = loadPdfFiles;
    if (fileInput) fileInput._localDocDropHandler = loadPdfFiles;

    // Check if initial page URL requests 'edit' mode by default (e.g. edit-pdf.html)
    if (window.location.pathname.includes('edit-pdf') || window.location.search.includes('mode=edit')) {
      activeMode = 'edit';
    }
  }

  function setupGlobalEvents() {
    if (!dropZone || !fileInput) return;

    fileInput.addEventListener('click', (e) => e.stopPropagation());
    dropZone.addEventListener('click', (e) => {
      if (e.target === fileInput || e.target.closest('input, a, label')) return;
      fileInput.click();
    });

    const browseBtn = document.getElementById('org-browse-btn');
    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

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
      setTimeout(() => { try { fileInput.value = ''; } catch(err) {} }, 150);
    });

    if (addMoreInput) {
      addMoreInput.addEventListener('click', (e) => e.stopPropagation());
      addMoreInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          loadPdfFiles(Array.from(e.target.files));
        }
        setTimeout(() => { try { addMoreInput.value = ''; } catch(err) {} }, 150);
      });
    }

    // Mode Switcher
    if (modeBtnOrganize) modeBtnOrganize.addEventListener('click', () => switchMode('organize'));
    if (modeBtnEdit) modeBtnEdit.addEventListener('click', () => switchMode('edit'));
    if (editBackGridBtn) editBackGridBtn.addEventListener('click', () => switchMode('organize'));

    // Grid Actions
    if (rotateAllBtn) {
      rotateAllBtn.addEventListener('click', () => {
        pagesList.forEach(p => { p.rotation = (p.rotation + 90) % 360; });
        renderPagesGrid();
        if (typeof UIUtils !== 'undefined') UIUtils.showToast('All pages rotated 90° clockwise', 'info');
      });
    }

    if (insertBlankBtn) {
      insertBlankBtn.addEventListener('click', () => insertBlankPage(pagesList.length));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset workspace and remove all pages?')) {
          sourceFiles = [];
          pagesList = [];
          selectedObject = null;
          workspace.style.display = 'none';
          emptyState.style.display = 'block';
          fileInput.value = '';
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', exportOrganizedPdf);
    }

    // Edit Stage Page Navigation
    if (editPrevPageBtn) editPrevPageBtn.addEventListener('click', () => changeEditPage(activePageIndex - 1));
    if (editNextPageBtn) editNextPageBtn.addEventListener('click', () => changeEditPage(activePageIndex + 1));
    if (editPageNumInput) {
      editPageNumInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1 && val <= pagesList.length) {
          changeEditPage(val - 1);
        } else {
          editPageNumInput.value = activePageIndex + 1;
        }
      });
    }

    if (editRotatePageBtn) {
      editRotatePageBtn.addEventListener('click', () => {
        if (!pagesList[activePageIndex]) return;
        pagesList[activePageIndex].rotation = (pagesList[activePageIndex].rotation + 90) % 360;
        renderActiveEditPage();
        if (typeof UIUtils !== 'undefined') UIUtils.showToast(`Page ${activePageIndex + 1} rotated 90°`, 'info');
      });
    }

    if (editDeletePageBtn) {
      editDeletePageBtn.addEventListener('click', () => {
        if (pagesList.length <= 1) {
          alert('Cannot delete the only remaining page.');
          return;
        }
        if (confirm(`Delete Page ${activePageIndex + 1}?`)) {
          pagesList.splice(activePageIndex, 1);
          if (activePageIndex >= pagesList.length) activePageIndex = pagesList.length - 1;
          renderActiveEditPage();
        }
      });
    }

    // Zoom Controls
    const zoomInBtn = document.getElementById('org-zoom-in');
    const zoomOutBtn = document.getElementById('org-zoom-out');
    const zoomResetBtn = document.getElementById('org-zoom-reset');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(zoomLevel + 0.15));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - 0.15));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1.0));

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (activeMode !== 'edit') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) {
        e.preventDefault();
        deleteSelectedObject();
      } else if (e.key === 'Escape') {
        selectedObject = null;
        redrawOverlay();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastAnnotation();
      }
    });
  }

  function setZoom(val) {
    zoomLevel = Math.max(0.4, Math.min(2.5, val));
    const levelSpan = document.getElementById('org-zoom-val');
    if (levelSpan) levelSpan.textContent = `${Math.round(zoomLevel * 100)}%`;
    renderActiveEditPage();
  }

  // ==========================================
  // FILE LOADING & INITIAL RENDERING
  // ==========================================
  let isLoading = false;
  async function loadPdfFiles(files) {
    if (isLoading) return;
    isLoading = true;
    try {
      const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
      if (pdfFiles.length === 0) {
        alert('Please select valid PDF file(s).');
        return;
      }

      emptyState.style.display = 'none';
      workspace.style.display = 'block';
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (typeof UIUtils !== 'undefined' && UIUtils.showToast) {
        UIUtils.showToast(`Loading ${pdfFiles.length} PDF(s) into workspace...`, 'info');
      }

      for (const file of pdfFiles) {
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const arrayBuffer = await file.arrayBuffer();

        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0), isEvalSupported: false }).promise;
          sourceFiles.push({
            id: fileId,
            name: file.name,
            arrayBuffer: arrayBuffer,
            numPages: pdfDoc.numPages
          });

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const baseViewport = page.getViewport({ scale: 1.0 });

            // Render fast thumbnail
            const thumbViewport = page.getViewport({ scale: 0.35 });
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbViewport.width;
            thumbCanvas.height = thumbViewport.height;
            const tCtx = thumbCanvas.getContext('2d');
            await page.render({ canvasContext: tCtx, viewport: thumbViewport }).promise;

            pagesList.push({
              id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              fileId: fileId,
              pageIndex: i - 1, // 0-indexed for PDF-Lib
              originalPageNum: i,
              rotation: 0,
              isBlank: false,
              width: baseViewport.width,
              height: baseViewport.height,
              thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.8),
              annotations: []
            });
          }
        } catch (err) {
          console.error('Error reading PDF:', err);
          if (typeof window !== 'undefined' && window.LocalDocPDFValidator) {
            const check = await window.LocalDocPDFValidator.validatePdfBytes(arrayBuffer);
            window.LocalDocPDFValidator.showPdfError(check.valid ? 'corrupt' : check.reason, file.name);
          } else if (typeof UIUtils !== 'undefined' && UIUtils.showToast) {
            UIUtils.showToast(`Could not load "${file.name}": Password protected or corrupted format.`, 'error', 6000);
          } else {
            alert(`Could not load "${file.name}": Password protected or invalid format.`);
          }
        }
      }

      if (activeMode === 'edit' && pagesList.length > 0) {
        switchMode('edit');
      } else {
        switchMode('organize');
      }
    } finally {
      isLoading = false;
    }
  }

  function insertBlankPage(atIndex) {
    const blankId = 'blank_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    // Create clean blank thumbnail
    const tCanvas = document.createElement('canvas');
    tCanvas.width = 150;
    tCanvas.height = 212;
    const tCtx = tCanvas.getContext('2d');
    tCtx.fillStyle = '#FFFFFF';
    tCtx.fillRect(0, 0, 150, 212);
    tCtx.strokeStyle = '#E2E8F0';
    tCtx.strokeRect(1, 1, 148, 210);
    tCtx.fillStyle = '#94A3B8';
    tCtx.font = '12px sans-serif';
    tCtx.textAlign = 'center';
    tCtx.fillText('Blank Page', 75, 110);

    const newPage = {
      id: blankId,
      fileId: null,
      pageIndex: null,
      originalPageNum: null,
      rotation: 0,
      isBlank: true,
      width: 595.28,
      height: 841.89,
      thumbnailDataUrl: tCanvas.toDataURL('image/jpeg', 0.8),
      annotations: []
    };

    pagesList.splice(atIndex, 0, newPage);
    renderPagesGrid();
    if (typeof UIUtils !== 'undefined') UIUtils.showToast('Blank page inserted successfully', 'success');
  }

  function duplicatePage(index) {
    const original = pagesList[index];
    const clone = {
      ...original,
      id: 'dup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      annotations: JSON.parse(JSON.stringify(original.annotations || []))
    };
    pagesList.splice(index + 1, 0, clone);
    renderPagesGrid();
    if (typeof UIUtils !== 'undefined') UIUtils.showToast(`Page ${index + 1} duplicated`, 'success');
  }

  // ==========================================
  // MODE SWITCHING & GRID RENDERING
  // ==========================================
  function switchMode(newMode) {
    activeMode = newMode;
    selectedObject = null;

    if (activeMode === 'organize') {
      if (modeBtnOrganize) modeBtnOrganize.classList.add('active');
      if (modeBtnEdit) modeBtnEdit.classList.remove('active');
      if (gridSection) gridSection.style.display = 'block';
      if (editSection) editSection.style.display = 'none';
      renderPagesGrid();
    } else {
      if (modeBtnOrganize) modeBtnOrganize.classList.remove('active');
      if (modeBtnEdit) modeBtnEdit.classList.add('active');
      if (gridSection) gridSection.style.display = 'none';
      if (editSection) editSection.style.display = 'block';
      renderActiveEditPage();
    }
  }

  function renderPagesGrid() {
    if (!pagesGrid) return;
    pagesGrid.innerHTML = '';
    totalPagesBadge.textContent = `${pagesList.length} Page${pagesList.length === 1 ? '' : 's'}`;

    pagesList.forEach((pageItem, index) => {
      const card = document.createElement('div');
      card.className = 'org-page-card';
      card.setAttribute('draggable', 'true');
      card.dataset.index = index;

      const hasAnnot = pageItem.annotations && pageItem.annotations.length > 0;

      card.innerHTML = `
        <div class="org-card-header">
          <span class="org-page-badge">#${index + 1} ${pageItem.isBlank ? '(Blank)' : ''}</span>
          <div class="org-card-actions">
            <button type="button" class="org-btn-mini" title="Edit / Annotate Page" data-action="edit">✏️</button>
            <button type="button" class="org-btn-mini" title="Rotate Clockwise" data-action="rot-right">↻</button>
            <button type="button" class="org-btn-mini" title="Duplicate Page" data-action="duplicate">📑</button>
            <button type="button" class="org-btn-mini org-btn-delete" title="Delete Page" data-action="delete">✕</button>
          </div>
        </div>
        <div class="org-thumb-wrap" data-action="edit">
          <img src="${pageItem.thumbnailDataUrl}" alt="Page ${index + 1}" style="transform: rotate(${pageItem.rotation}deg);" />
          ${hasAnnot ? '<span class="annot-count-badge" title="Has annotations">✏️ ' + pageItem.annotations.length + '</span>' : ''}
        </div>
        <div class="org-card-footer">
          <button type="button" class="org-shift-btn" data-action="move-left" ${index === 0 ? 'disabled' : ''} title="Move Left">◀</button>
          <button type="button" class="btn btn-outline org-card-edit-btn" data-action="edit" style="padding:2px 8px; font-size:0.75rem;">
            ✏️ Annotate
          </button>
          <button type="button" class="org-shift-btn" data-action="move-right" ${index === pagesList.length - 1 ? 'disabled' : ''} title="Move Right">▶</button>
        </div>
      `;

      // Card Events
      card.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          activePageIndex = index;
          switchMode('edit');
        });
      });

      card.querySelector('[data-action="rot-right"]').addEventListener('click', (e) => {
        e.stopPropagation();
        pageItem.rotation = (pageItem.rotation + 90) % 360;
        renderPagesGrid();
      });

      card.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
        e.stopPropagation();
        duplicatePage(index);
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        if (pagesList.length <= 1) {
          alert('Cannot delete the only remaining page.');
          return;
        }
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

      // Drag & Drop
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

    if (fromIndex !== toIndex && !isNaN(fromIndex) && !isNaN(toIndex)) {
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

  // ==========================================
  // EDIT & ANNOTATE STAGE (MODE 2)
  // ==========================================
  async function renderActiveEditPage() {
    if (pagesList.length === 0) return;
    if (activePageIndex < 0) activePageIndex = 0;
    if (activePageIndex >= pagesList.length) activePageIndex = pagesList.length - 1;

    const pageItem = pagesList[activePageIndex];
    if (editPageNumInput) editPageNumInput.value = activePageIndex + 1;
    if (editPageTotalSpan) editPageTotalSpan.textContent = pagesList.length;

    // Render background PDF or blank page
    const dpr = Math.min(2.0, window.devicePixelRatio || 1);
    const baseW = (pageItem.width || 595.28) * zoomLevel;
    const baseH = (pageItem.height || 841.89) * zoomLevel;

    // Handle 90/270 rotation swapping width & height
    const isSideways = (pageItem.rotation === 90 || pageItem.rotation === 270);
    const displayW = isSideways ? baseH : baseW;
    const displayH = isSideways ? baseW : baseH;

    bgCanvas.width = displayW * dpr;
    bgCanvas.height = displayH * dpr;
    bgCanvas.style.width = `${displayW}px`;
    bgCanvas.style.height = `${displayH}px`;

    overlayCanvas.width = displayW * dpr;
    overlayCanvas.height = displayH * dpr;
    overlayCanvas.style.width = `${displayW}px`;
    overlayCanvas.style.height = `${displayH}px`;

    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.scale(dpr, dpr);

    if (pageItem.isBlank) {
      bgCtx.fillStyle = '#FFFFFF';
      bgCtx.fillRect(0, 0, displayW, displayH);
      bgCtx.strokeStyle = '#E2E8F0';
      bgCtx.strokeRect(1, 1, displayW - 2, displayH - 2);
    } else {
      // Find source file and render page via PDF.js
      const srcFile = sourceFiles.find(f => f.id === pageItem.fileId);
      if (srcFile) {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: srcFile.arrayBuffer.slice(0), isEvalSupported: false }).promise;
          const pdfPage = await pdfDoc.getPage(pageItem.pageIndex + 1);
          const viewport = pdfPage.getViewport({ scale: zoomLevel * dpr, rotation: pageItem.rotation });
          await pdfPage.render({ canvasContext: bgCtx, viewport }).promise;
        } catch(e) {
          console.warn('PDF.js render fallback:', e);
        }
      }
    }

    redrawOverlay();
  }

  function changeEditPage(newIndex) {
    if (newIndex >= 0 && newIndex < pagesList.length) {
      activePageIndex = newIndex;
      selectedObject = null;
      renderActiveEditPage();
    }
  }

  function redrawOverlay() {
    if (!overlayCanvas) return;
    const dpr = Math.min(2.0, window.devicePixelRatio || 1);
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const pageItem = pagesList[activePageIndex];
    if (!pageItem || !pageItem.annotations) {
      ctx.restore();
      return;
    }

    // Render all saved annotations
    pageItem.annotations.forEach(obj => {
      renderAnnotationObject(ctx, obj);
    });

    // Render active drawing stroke
    if (currentDrawStroke && currentDrawStroke.points.length > 1) {
      renderDrawStroke(ctx, currentDrawStroke);
    }

    // Render selection bounding box & resize handles
    if (selectedObject && activeTool === 'select') {
      renderSelectionHandles(ctx, selectedObject);
    }

    ctx.restore();
  }

  function renderAnnotationObject(ctx, obj) {
    ctx.save();
    switch (obj.type) {
      case 'text':
        ctx.font = `${obj.isBold ? 'bold ' : ''}${obj.fontSize}px Plus Jakarta Sans, sans-serif`;
        if (obj.bgColor && obj.bgColor !== 'transparent') {
          ctx.fillStyle = obj.bgColor;
          ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
        ctx.fillStyle = obj.color || '#0F172A';
        ctx.textBaseline = 'top';
        ctx.fillText(obj.text, obj.x + 4, obj.y + 4);
        break;

      case 'image':
        if (obj.imgElement && obj.imgElement.complete) {
          ctx.globalAlpha = obj.opacity || 1.0;
          ctx.drawImage(obj.imgElement, obj.x, obj.y, obj.width, obj.height);
        }
        break;

      case 'line':
        ctx.strokeStyle = obj.color || '#DC2626';
        ctx.lineWidth = obj.lineWidth || 3;
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();

        if (obj.isArrow) {
          drawArrowhead(ctx, obj.x1, obj.y1, obj.x2, obj.y2, obj.lineWidth || 3, obj.color || '#DC2626');
        }
        break;

      case 'shape':
        ctx.strokeStyle = obj.strokeColor || '#2563EB';
        ctx.lineWidth = obj.lineWidth || 2;
        ctx.fillStyle = obj.fillColor || 'transparent';

        if (obj.shapeType === 'circle') {
          ctx.beginPath();
          const rx = obj.width / 2;
          const ry = obj.height / 2;
          ctx.ellipse(obj.x + rx, obj.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
          if (obj.fillColor && obj.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
        } else {
          if (obj.fillColor && obj.fillColor !== 'transparent') {
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
          }
          ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        }
        break;

      case 'sticker':
        renderSticker(ctx, obj);
        break;

      case 'draw':
        renderDrawStroke(ctx, obj);
        break;
    }
    ctx.restore();
  }

  function drawArrowhead(ctx, fromX, fromY, toX, toY, width, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLen = Math.max(12, width * 3.5);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderSticker(ctx, obj) {
    ctx.save();
    const x = obj.x;
    const y = obj.y;
    const w = obj.width;
    const h = obj.height;

    const stampConfigs = {
      'APPROVED': { color: '#059669', bg: 'rgba(5, 150, 105, 0.08)', text: 'APPROVED' },
      'CONFIDENTIAL': { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.08)', text: 'CONFIDENTIAL' },
      'DRAFT': { color: '#D97706', bg: 'rgba(217, 119, 6, 0.08)', text: 'DRAFT' },
      'FINAL': { color: '#2563EB', bg: 'rgba(37, 99, 235, 0.08)', text: 'FINAL' },
      'PAID': { color: '#16A34A', bg: 'rgba(22, 163, 74, 0.08)', text: 'PAID' },
      'VOID': { color: '#64748B', bg: 'rgba(100, 116, 139, 0.08)', text: 'VOID' },
      'SIGN_HERE': { color: '#EA580C', bg: '#FFEDD5', text: 'SIGN HERE ▶' }
    };

    const cfg = stampConfigs[obj.stickerType] || { color: obj.color || '#2563EB', bg: 'rgba(37, 99, 235, 0.08)', text: obj.text || 'STAMP' };

    // Draw Stamp Border & Background
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Inner rule
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    ctx.fillStyle = cfg.color;
    ctx.font = `bold ${Math.max(12, Math.round(h * 0.42))}px Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.text, x + w / 2, y + h / 2);

    ctx.restore();
  }

  function renderDrawStroke(ctx, stroke) {
    if (!stroke || stroke.points.length < 2) return;
    ctx.save();
    if (stroke.isHighlighter) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = stroke.color || '#FACC15';
      ctx.lineWidth = stroke.lineWidth || 18;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'bevel';
    } else {
      ctx.strokeStyle = stroke.color || '#0F172A';
      ctx.lineWidth = stroke.lineWidth || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderSelectionHandles(ctx, obj) {
    ctx.save();
    const bounds = getObjectBounds(obj);
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
    ctx.setLineDash([]);

    // 4 Corner Handles
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    const hSize = 8;

    const handles = [
      { x: bounds.x - hSize / 2, y: bounds.y - hSize / 2 },
      { x: bounds.x + bounds.width - hSize / 2, y: bounds.y - hSize / 2 },
      { x: bounds.x - hSize / 2, y: bounds.y + bounds.height - hSize / 2 },
      { x: bounds.x + bounds.width - hSize / 2, y: bounds.y + bounds.height - hSize / 2 }
    ];

    handles.forEach(h => {
      ctx.fillRect(h.x, h.y, hSize, hSize);
      ctx.strokeRect(h.x, h.y, hSize, hSize);
    });

    ctx.restore();
  }

  function getObjectBounds(obj) {
    if (obj.type === 'line') {
      const minX = Math.min(obj.x1, obj.x2);
      const minY = Math.min(obj.y1, obj.y2);
      const w = Math.max(10, Math.abs(obj.x2 - obj.x1));
      const h = Math.max(10, Math.abs(obj.y2 - obj.y1));
      return { x: minX, y: minY, width: w, height: h };
    }
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  }

  // ==========================================
  // TOOL PALETTE & ANNOTATION CREATION
  // ==========================================
  function setupToolPaletteEvents() {
    const toolButtons = document.querySelectorAll('.org-tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (!tool) return;

        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTool = tool;

        if (tool === 'image') {
          if (imageUploadInput) imageUploadInput.click();
        } else if (tool === 'sticker') {
          openStickerModal();
        }
      });
    });

    // Image Upload Handler
    if (imageUploadInput) {
      imageUploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              // Scale proportionally to max 220px width initial
              const maxInit = 220;
              const scale = Math.min(1.0, maxInit / Math.max(img.width, img.height));
              const w = Math.round(img.width * scale);
              const h = Math.round(img.height * scale);

              const newImgObj = {
                id: 'img_' + Date.now(),
                type: 'image',
                imgElement: img,
                dataUrl: event.target.result,
                x: 60,
                y: 80,
                width: w,
                height: h,
                opacity: 1.0
              };

              const pageItem = pagesList[activePageIndex];
              if (pageItem) {
                pageItem.annotations.push(newImgObj);
                selectedObject = newImgObj;
                activeTool = 'select';
                highlightActiveTool('select');
                redrawOverlay();
              }
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
        setTimeout(() => { try { imageUploadInput.value = ''; } catch(err) {} }, 150);
      });
    }

    // Color Swatches
    document.querySelectorAll('.org-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.org-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.color;
        strokeColor = color;
        fontColor = color;

        if (selectedObject) {
          if (selectedObject.type === 'text') selectedObject.color = color;
          else if (selectedObject.type === 'line') selectedObject.color = color;
          else if (selectedObject.type === 'shape') selectedObject.strokeColor = color;
          redrawOverlay();
        }
      });
    });

    // Undo & Delete Buttons
    const undoBtn = document.getElementById('org-undo-btn');
    const deleteObjBtn = document.getElementById('org-delete-obj-btn');
    if (undoBtn) undoBtn.addEventListener('click', undoLastAnnotation);
    if (deleteObjBtn) deleteObjBtn.addEventListener('click', deleteSelectedObject);

    // Sticker Palette Selectors
    document.querySelectorAll('.org-sticker-choice').forEach(item => {
      item.addEventListener('click', () => {
        const stickerType = item.dataset.sticker;
        addStickerToActivePage(stickerType);
        closeStickerModal();
      });
    });

    const closeStickerModalBtn = document.getElementById('org-close-sticker-modal');
    if (closeStickerModalBtn) closeStickerModalBtn.addEventListener('click', closeStickerModal);
  }

  function highlightActiveTool(toolName) {
    document.querySelectorAll('.org-tool-btn').forEach(b => {
      if (b.dataset.tool === toolName) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function openStickerModal() {
    if (stickerModal) stickerModal.classList.add('open');
  }

  function closeStickerModal() {
    if (stickerModal) stickerModal.classList.remove('open');
  }

  function addStickerToActivePage(stickerType) {
    const pageItem = pagesList[activePageIndex];
    if (!pageItem) return;

    const newSticker = {
      id: 'sticker_' + Date.now(),
      type: 'sticker',
      stickerType: stickerType,
      x: 80,
      y: 100,
      width: 160,
      height: 52
    };

    pageItem.annotations.push(newSticker);
    selectedObject = newSticker;
    activeTool = 'select';
    highlightActiveTool('select');
    redrawOverlay();
  }

  function undoLastAnnotation() {
    const pageItem = pagesList[activePageIndex];
    if (pageItem && pageItem.annotations && pageItem.annotations.length > 0) {
      pageItem.annotations.pop();
      selectedObject = null;
      redrawOverlay();
      if (typeof UIUtils !== 'undefined') UIUtils.showToast('Last annotation undone', 'info');
    }
  }

  function deleteSelectedObject() {
    const pageItem = pagesList[activePageIndex];
    if (pageItem && selectedObject) {
      const idx = pageItem.annotations.findIndex(o => o.id === selectedObject.id);
      if (idx !== -1) {
        pageItem.annotations.splice(idx, 1);
        selectedObject = null;
        redrawOverlay();
        if (typeof UIUtils !== 'undefined') UIUtils.showToast('Item deleted', 'info');
      }
    }
  }

  // ==========================================
  // CANVAS INTERACTIVE POINTER EVENTS
  // ==========================================
  function setupCanvasInteractions() {
    if (!overlayCanvas) return;

    overlayCanvas.addEventListener('pointerdown', handlePointerDown);
    overlayCanvas.addEventListener('pointermove', handlePointerMove);
    overlayCanvas.addEventListener('pointerup', handlePointerUp);
    overlayCanvas.addEventListener('pointercancel', handlePointerUp);
    overlayCanvas.addEventListener('dblclick', handleDoubleClick);
  }

  function getCanvasCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handlePointerDown(e) {
    const coords = getCanvasCoords(e);
    startPointer = coords;
    isInteracting = true;
    overlayCanvas.setPointerCapture(e.pointerId);

    const pageItem = pagesList[activePageIndex];
    if (!pageItem) return;

    if (activeTool === 'select') {
      // 1. Check if clicking on resize handle of current selection
      if (selectedObject) {
        const handle = hitTestResizeHandle(selectedObject, coords);
        if (handle) {
          interactionMode = 'resize';
          resizeHandle = handle;
          initialObjectState = { ...selectedObject };
          return;
        }
      }

      // 2. Check if clicking on an existing object
      const hitObj = hitTestObjects(pageItem.annotations, coords);
      if (hitObj) {
        selectedObject = hitObj;
        interactionMode = 'drag';
        initialObjectState = { ...hitObj };
      } else {
        selectedObject = null;
        interactionMode = null;
      }
      redrawOverlay();
    } else if (activeTool === 'pen' || activeTool === 'highlighter') {
      interactionMode = 'draw';
      currentDrawStroke = {
        type: 'draw',
        isHighlighter: (activeTool === 'highlighter'),
        color: (activeTool === 'highlighter') ? '#FACC15' : strokeColor,
        lineWidth: (activeTool === 'highlighter') ? 20 : strokeWidth,
        points: [coords]
      };
      redrawOverlay();
    } else if (activeTool === 'text') {
      // Prompt text input
      const initialText = prompt('Enter text for document:', 'Legal Clause Approved');
      if (initialText && initialText.trim()) {
        const newTextObj = {
          id: 'text_' + Date.now(),
          type: 'text',
          text: initialText.trim(),
          x: coords.x,
          y: coords.y,
          width: Math.max(120, initialText.length * 10),
          height: 32,
          fontSize: fontSize,
          color: fontColor,
          bgColor: 'transparent',
          isBold: false
        };
        pageItem.annotations.push(newTextObj);
        selectedObject = newTextObj;
        activeTool = 'select';
        highlightActiveTool('select');
        redrawOverlay();
      }
      isInteracting = false;
    } else if (activeTool === 'line' || activeTool === 'arrow') {
      interactionMode = 'create-line';
      const newLineObj = {
        id: 'line_' + Date.now(),
        type: 'line',
        x1: coords.x,
        y1: coords.y,
        x2: coords.x + 5,
        y2: coords.y + 5,
        color: strokeColor,
        lineWidth: strokeWidth,
        isArrow: (activeTool === 'arrow')
      };
      pageItem.annotations.push(newLineObj);
      selectedObject = newLineObj;
    } else if (activeTool === 'rect' || activeTool === 'circle') {
      interactionMode = 'create-shape';
      const newShapeObj = {
        id: 'shape_' + Date.now(),
        type: 'shape',
        shapeType: activeTool,
        x: coords.x,
        y: coords.y,
        width: 10,
        height: 10,
        strokeColor: strokeColor,
        fillColor: fillColor,
        lineWidth: strokeWidth
      };
      pageItem.annotations.push(newShapeObj);
      selectedObject = newShapeObj;
    } else if (activeTool === 'eraser') {
      const hitObj = hitTestObjects(pageItem.annotations, coords);
      if (hitObj) {
        const idx = pageItem.annotations.indexOf(hitObj);
        if (idx !== -1) {
          pageItem.annotations.splice(idx, 1);
          selectedObject = null;
          redrawOverlay();
        }
      }
    }
  }

  function handlePointerMove(e) {
    if (!isInteracting) return;
    const coords = getCanvasCoords(e);
    const dx = coords.x - startPointer.x;
    const dy = coords.y - startPointer.y;

    if (interactionMode === 'drag' && selectedObject && initialObjectState) {
      if (selectedObject.type === 'line') {
        selectedObject.x1 = initialObjectState.x1 + dx;
        selectedObject.y1 = initialObjectState.y1 + dy;
        selectedObject.x2 = initialObjectState.x2 + dx;
        selectedObject.y2 = initialObjectState.y2 + dy;
      } else {
        selectedObject.x = initialObjectState.x + dx;
        selectedObject.y = initialObjectState.y + dy;
      }
      redrawOverlay();
    } else if (interactionMode === 'resize' && selectedObject && initialObjectState) {
      handleObjectResize(selectedObject, initialObjectState, resizeHandle, dx, dy);
      redrawOverlay();
    } else if (interactionMode === 'draw' && currentDrawStroke) {
      currentDrawStroke.points.push(coords);
      redrawOverlay();
    } else if (interactionMode === 'create-line' && selectedObject) {
      selectedObject.x2 = coords.x;
      selectedObject.y2 = coords.y;
      redrawOverlay();
    } else if (interactionMode === 'create-shape' && selectedObject) {
      selectedObject.width = Math.max(10, coords.x - selectedObject.x);
      selectedObject.height = Math.max(10, coords.y - selectedObject.y);
      redrawOverlay();
    }
  }

  function handlePointerUp(e) {
    if (!isInteracting) return;
    isInteracting = false;

    if (interactionMode === 'draw' && currentDrawStroke && currentDrawStroke.points.length > 1) {
      const pageItem = pagesList[activePageIndex];
      if (pageItem) {
        pageItem.annotations.push(currentDrawStroke);
      }
      currentDrawStroke = null;
      redrawOverlay();
    } else if (interactionMode === 'create-line' || interactionMode === 'create-shape') {
      activeTool = 'select';
      highlightActiveTool('select');
      redrawOverlay();
    }

    interactionMode = null;
    resizeHandle = null;
    initialObjectState = null;
  }

  function handleDoubleClick(e) {
    const coords = getCanvasCoords(e);
    const pageItem = pagesList[activePageIndex];
    if (!pageItem) return;

    const hitObj = hitTestObjects(pageItem.annotations, coords);
    if (hitObj && hitObj.type === 'text') {
      const updated = prompt('Edit text content:', hitObj.text);
      if (updated !== null && updated.trim()) {
        hitObj.text = updated.trim();
        hitObj.width = Math.max(80, hitObj.text.length * 10);
        redrawOverlay();
      }
    }
  }

  function handleObjectResize(obj, initial, handle, dx, dy) {
    if (obj.type === 'line') return;
    switch (handle) {
      case 'br':
        obj.width = Math.max(20, initial.width + dx);
        obj.height = Math.max(20, initial.height + dy);
        break;
      case 'bl':
        obj.x = initial.x + dx;
        obj.width = Math.max(20, initial.width - dx);
        obj.height = Math.max(20, initial.height + dy);
        break;
      case 'tr':
        obj.y = initial.y + dy;
        obj.width = Math.max(20, initial.width + dx);
        obj.height = Math.max(20, initial.height - dy);
        break;
      case 'tl':
        obj.x = initial.x + dx;
        obj.y = initial.y + dy;
        obj.width = Math.max(20, initial.width - dx);
        obj.height = Math.max(20, initial.height - dy);
        break;
    }
  }

  function hitTestObjects(annotations, pt) {
    // Traverse in reverse to test topmost objects first
    for (let i = annotations.length - 1; i >= 0; i--) {
      const obj = annotations[i];
      if (obj.type === 'line') {
        const d = distToSegment(pt, { x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 });
        if (d <= Math.max(8, obj.lineWidth + 4)) return obj;
      } else if (obj.type === 'draw') {
        for (const p of obj.points) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < Math.max(10, obj.lineWidth)) return obj;
        }
      } else {
        if (pt.x >= obj.x && pt.x <= obj.x + obj.width && pt.y >= obj.y && pt.y <= obj.y + obj.height) {
          return obj;
        }
      }
    }
    return null;
  }

  function hitTestResizeHandle(obj, pt) {
    const bounds = getObjectBounds(obj);
    const hSize = 14;
    const handles = {
      tl: { x: bounds.x, y: bounds.y },
      tr: { x: bounds.x + bounds.width, y: bounds.y },
      bl: { x: bounds.x, y: bounds.y + bounds.height },
      br: { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    };

    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(pt.x - pos.x) <= hSize && Math.abs(pt.y - pos.y) <= hSize) {
        return key;
      }
    }
    return null;
  }

  function distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // ==========================================
  // EXPORT ENGINE (PDF-LIB VECTOR PIPELINE)
  // ==========================================
  async function exportOrganizedPdf() {
    if (pagesList.length === 0) {
      alert('No pages left to export! Please add some pages.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Assembling PDF in RAM...';

    try {
      const { PDFDocument, degrees } = PDFLib;
      const mergedPdf = await PDFDocument.create();

      // Cache parsed PDF-Lib documents for all source files
      const pdfDocsCache = {};
      for (const file of sourceFiles) {
        pdfDocsCache[file.id] = await PDFDocument.load(file.arrayBuffer);
      }

      for (let i = 0; i < pagesList.length; i++) {
        const item = pagesList[i];
        let targetPage;

        if (item.isBlank) {
          targetPage = mergedPdf.addPage([item.width || 595.28, item.height || 841.89]);
        } else {
          const srcDoc = pdfDocsCache[item.fileId];
          const [copiedPage] = await mergedPdf.copyPages(srcDoc, [item.pageIndex]);

          const currentRot = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRot + item.rotation) % 360));
          targetPage = mergedPdf.addPage(copiedPage);
        }

        // Bake annotations if present
        if (item.annotations && item.annotations.length > 0) {
          const pageWidth = targetPage.getWidth();
          const pageHeight = targetPage.getHeight();

          // Render annotations onto an offscreen canvas at 2x resolution for razor sharpness
          const offscreen = document.createElement('canvas');
          const offDpr = 2.0;
          offscreen.width = pageWidth * offDpr;
          offscreen.height = pageHeight * offDpr;
          const offCtx = offscreen.getContext('2d');
          offCtx.scale(offDpr, offDpr);

          // Render each annotation object
          item.annotations.forEach(obj => {
            renderAnnotationObject(offCtx, obj);
          });

          // Convert offscreen canvas to PNG Data URL and embed in PDF-Lib
          const pngDataUrl = offscreen.toDataURL('image/png');
          const pngImageBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());
          const embeddedPng = await mergedPdf.embedPng(pngImageBytes);

          // Draw transparent annotation overlay on top of original vector page
          targetPage.drawImage(embeddedPng, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });
        }
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const baseName = sourceFiles.length > 0 ? sourceFiles[0].name.replace(/\.[^/.]+$/, '') : 'document';
      a.download = `${baseName}_edited_organized.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (typeof UIUtils !== 'undefined') {
        UIUtils.showToast('PDF compiled & downloaded successfully!', 'success');
      }
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to generate PDF. Please check console for details.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save & Download PDF';
    }
  }

  // Self-start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
