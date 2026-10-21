/**
 * localdoc.org — Dedicated Visual PDF Editor & Annotation Studio Engine (js/tools/edit-pdf.js)
 * 100% Client-Side In-Browser RAM execution via PDF.js & PDF-Lib.
 * Features:
 *  - Direct document canvas viewport (no organize grid detour)
 *  - In-place editable Text Boxes with floating typography inspector
 *  - Precision Whiteout & Redaction System (cover & replace text)
 *  - Fluorescent Multi-Color Highlighter (multiply blend mode)
 *  - Directional Arrows (single & double-headed trigonometry)
 *  - Geometric Shapes (Lines, Rectangles, Circles)
 *  - 12 Official Business Review Stickers
 *  - Picture & Logo placement with interactive transform handles
 *  - Lossless ISO 32000-1 Page /CropBox margin surgery
 *  - Multi-level Undo/Redo history stack
 */

(function () {
  'use strict';

  // =========================================================================
  // Studio State
  // =========================================================================
  const state = {
    file: null,
    pdfBytes: null,
    pdfJsDoc: null,
    pdfLibDoc: null,
    numPages: 0,
    currentPage: 1,
    zoomScale: 1.25,
    autoFit: true,
    pageRotations: {}, // pageNum -> degrees (0, 90, 180, 270)
    pageCrops: {}, // pageNum -> { left, top, right, bottom } in points

    // Active tool: 'select' | 'text' | 'whiteout' | 'highlight' | 'pen' | 'arrow' | 'double-arrow' | 'line' | 'rect' | 'circle' | 'sticker' | 'image'
    activeTool: 'select',
    currentColor: '#DC2626',
    currentStrokeWidth: 3,
    currentFontSize: 16,
    currentFontFamily: 'Helvetica',
    currentFontBold: false,
    currentFontItalic: false,
    currentOpacity: 1.0,

    // Annotations map: pageNum -> Array<Annotation>
    // Annotation schema:
    // { id, type, x, y, width, height, color, strokeWidth, opacity, points, text, fontSize, fontFamily, bold, italic, bg, stickerType, imageSrc, imageEl }
    pageAnnotations: {},
    selectedAnnotationId: null,

    // Drawing interaction state
    isDrawing: false,
    drawStartX: 0,
    drawStartY: 0,
    currentDrawPoints: [],
    dragHandle: null, // null | 'move' | 'nw' | 'ne' | 'se' | 'sw'
    dragStartAnno: null,

    // History stack per page for Undo / Redo
    undoStack: {}, // pageNum -> Array<Array<Annotation>>
    redoStack: {}, // pageNum -> Array<Array<Annotation>>
  };

  // Sticker SVG templates
  const STICKER_TEMPLATES = {
    'APPROVED': { text: '✔ APPROVED', color: '#059669', bg: '#ECFDF5', subtitle: 'Verified & Certified' },
    'CONFIDENTIAL': { text: '🔒 CONFIDENTIAL', color: '#DC2626', bg: '#FEF2F2', subtitle: 'Restricted Access' },
    'DRAFT': { text: '📝 DRAFT', color: '#D97706', bg: '#FFFBEB', subtitle: 'Under Revision' },
    'FINAL': { text: '⚖️ FINAL COPY', color: '#2563EB', bg: '#EFF6FF', subtitle: 'Execution Version' },
    'PAID': { text: '💰 PAID', color: '#16A34A', bg: '#F0FDF4', subtitle: 'Invoice Cleared' },
    'URGENT': { text: '⚡ URGENT', color: '#E11D48', bg: '#FFF1F2', subtitle: 'Immediate Action' },
    'REJECTED': { text: '✖ REJECTED', color: '#991B1B', bg: '#FEF2F2', subtitle: 'Declined Submission' },
    'VOID': { text: '⛔ VOID', color: '#64748B', bg: '#F8FAFC', subtitle: 'Cancelled Document' },
    'SIGN_HERE': { text: '✍️ SIGN HERE ▶', color: '#EA580C', bg: '#FFF7ED', subtitle: 'Signatory Flag' },
    'INITIAL_HERE': { text: '🖋️ INITIAL HERE', color: '#7C3AED', bg: '#F5F3FF', subtitle: 'Margin Initial Mark' },
    'VERIFIED': { text: '🛡️ VERIFIED', color: '#0D9488', bg: '#F0FDFA', subtitle: 'Compliance Passed' },
    'TOP_SECRET': { text: '🔐 TOP SECRET', color: '#831843', bg: '#FDF2F8', subtitle: 'Restricted Clearance' }
  };

  // DOM Elements cache
  let dom = {};

  // =========================================================================
  // Initialization
  // =========================================================================
  document.addEventListener('DOMContentLoaded', initStudio);

  function initStudio() {
    dom = {
      emptyState: document.getElementById('edit-empty-state'),
      workspace: document.getElementById('edit-workspace'),
      dropZone: document.getElementById('edit-drop-zone'),
      fileInput: document.getElementById('edit-file-input'),
      browseBtn: document.getElementById('edit-browse-btn'),
      sampleBtn: document.getElementById('edit-sample-btn'),

      // Top Header & Actions
      docTitle: document.getElementById('edit-doc-title'),
      docPagesBadge: document.getElementById('edit-doc-pages-badge'),
      undoBtn: document.getElementById('edit-undo-btn'),
      redoBtn: document.getElementById('edit-redo-btn'),
      clearPageBtn: document.getElementById('edit-clear-page-btn'),
      exportBtn: document.getElementById('edit-export-btn'),

      // Navigation & Zoom
      prevPageBtn: document.getElementById('edit-prev-page'),
      nextPageBtn: document.getElementById('edit-next-page'),
      curPageInput: document.getElementById('edit-page-num-input'),
      totalPagesSpan: document.getElementById('edit-total-pages-span'),
      zoomOutBtn: document.getElementById('edit-zoom-out'),
      zoomInBtn: document.getElementById('edit-zoom-in'),
      zoomValSpan: document.getElementById('edit-zoom-val'),
      zoomFitBtn: document.getElementById('edit-zoom-fit'),

      // Page-Level Actions
      rotatePageBtn: document.getElementById('edit-rotate-page-btn'),
      cropModalBtn: document.getElementById('edit-crop-modal-btn'),

      // Sidebar
      sidebarToggleBtn: document.getElementById('edit-sidebar-toggle'),
      sidebar: document.getElementById('edit-sidebar'),
      thumbnailList: document.getElementById('edit-thumbnail-list'),

      // Canvas Stage
      viewport: document.getElementById('edit-viewport'),
      stageWrap: document.getElementById('edit-stage-wrap'),
      bgCanvas: document.getElementById('edit-bg-canvas'),
      overlayCanvas: document.getElementById('edit-overlay-canvas'),
      textEditorInput: document.getElementById('edit-inline-text-input'),

      // Floating Tool Dock
      toolBtns: document.querySelectorAll('.edit-dock-btn[data-tool]'),
      colorDots: document.querySelectorAll('.edit-color-dot[data-color]'),
      customColorPicker: document.getElementById('edit-custom-color-picker'),
      strokeWidthSelect: document.getElementById('edit-stroke-width-select'),

      // Floating Property Inspector for Text / Selection
      inspector: document.getElementById('edit-floating-inspector'),
      fontFamilySelect: document.getElementById('insp-font-family'),
      fontSizeInput: document.getElementById('insp-font-size'),
      boldBtn: document.getElementById('insp-btn-bold'),
      italicBtn: document.getElementById('insp-btn-italic'),
      whiteoutBgToggle: document.getElementById('insp-whiteout-toggle'),
      deleteObjBtn: document.getElementById('insp-delete-btn'),

      // Modals
      stickerModal: document.getElementById('edit-sticker-modal'),
      closeStickerModalBtn: document.getElementById('edit-close-sticker-modal'),
      stickerChoices: document.querySelectorAll('.edit-sticker-choice[data-sticker]'),

      cropModal: document.getElementById('edit-crop-modal'),
      closeCropModalBtn: document.getElementById('edit-close-crop-modal'),
      cropCancelBtn: document.getElementById('edit-crop-cancel-btn'),
      cropApplyBtn: document.getElementById('edit-crop-apply-btn'),
      cropPresets: document.querySelectorAll('.edit-crop-preset[data-crop]'),
      customCropInputs: document.getElementById('edit-custom-crop-inputs'),
      cropLeft: document.getElementById('edit-crop-left'),
      cropRight: document.getElementById('edit-crop-right'),
      cropTop: document.getElementById('edit-crop-top'),
      cropBottom: document.getElementById('edit-crop-bottom'),

      // Image upload
      imageInput: document.getElementById('edit-image-upload-input')
    };

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
    }

    bindEvents();
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================
  function bindEvents() {
    // Drag & Drop / File Input
    if (dom.dropZone && dom.fileInput) {
      dom.dropZone.addEventListener('click', () => dom.fileInput.click());
      dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          loadPdfFile(e.target.files[0]);
        }
      });

      dom.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropZone.classList.add('drag-active');
      });
      dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('drag-active'));
      dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          loadPdfFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (dom.browseBtn && dom.fileInput) {
      dom.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.fileInput.click();
      });
    }

    if (dom.sampleBtn) {
      dom.sampleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadSampleDocument();
      });
    }

    // Navigation
    if (dom.prevPageBtn) dom.prevPageBtn.addEventListener('click', () => changePage(state.currentPage - 1));
    if (dom.nextPageBtn) dom.nextPageBtn.addEventListener('click', () => changePage(state.currentPage + 1));
    if (dom.curPageInput) {
      dom.curPageInput.addEventListener('change', () => {
        const p = parseInt(dom.curPageInput.value, 10);
        if (!isNaN(p)) changePage(p);
      });
    }

    // Zoom
    if (dom.zoomOutBtn) dom.zoomOutBtn.addEventListener('click', () => setZoom(state.zoomScale - 0.15));
    if (dom.zoomInBtn) dom.zoomInBtn.addEventListener('click', () => setZoom(state.zoomScale + 0.15));
    if (dom.zoomFitBtn) dom.zoomFitBtn.addEventListener('click', fitToWidth);

    // Page Actions
    if (dom.rotatePageBtn) {
      dom.rotatePageBtn.addEventListener('click', () => {
        const curRot = state.pageRotations[state.currentPage] || 0;
        state.pageRotations[state.currentPage] = (curRot + 90) % 360;
        renderActivePage();
        renderThumbnails();
        UIUtils.showToast(`Page ${state.currentPage} rotated 90°`, 'info');
      });
    }

    // History Actions
    if (dom.undoBtn) dom.undoBtn.addEventListener('click', undoAction);
    if (dom.redoBtn) dom.redoBtn.addEventListener('click', redoAction);
    if (dom.clearPageBtn) {
      dom.clearPageBtn.addEventListener('click', () => {
        if (confirm(`Clear all annotations from page ${state.currentPage}?`)) {
          saveHistoryState();
          state.pageAnnotations[state.currentPage] = [];
          state.selectedAnnotationId = null;
          hideInspector();
          renderAnnotationsOverlay();
          renderThumbnails();
          UIUtils.showToast(`Cleared page ${state.currentPage} annotations`, 'info');
        }
      });
    }

    // Export
    if (dom.exportBtn) dom.exportBtn.addEventListener('click', exportEditedPdf);

    // Tool Dock Selection
    if (dom.toolBtns) {
      dom.toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tool = btn.getAttribute('data-tool');
          setTool(tool);
        });
      });
    }

    // Color Dots
    if (dom.colorDots) {
      dom.colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
          dom.colorDots.forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          const color = dot.getAttribute('data-color');
          setColor(color);
        });
      });
    }

    if (dom.customColorPicker) {
      dom.customColorPicker.addEventListener('input', (e) => {
        setColor(e.target.value);
      });
    }

    if (dom.strokeWidthSelect) {
      dom.strokeWidthSelect.addEventListener('change', () => {
        state.currentStrokeWidth = parseFloat(dom.strokeWidthSelect.value) || 3;
      });
    }

    // Floating Inspector Controls
    if (dom.fontFamilySelect) {
      dom.fontFamilySelect.addEventListener('change', () => {
        const anno = getSelectedAnnotation();
        if (anno && anno.type === 'text') {
          anno.fontFamily = dom.fontFamilySelect.value;
          state.currentFontFamily = dom.fontFamilySelect.value;
          renderAnnotationsOverlay();
        }
      });
    }

    if (dom.fontSizeInput) {
      dom.fontSizeInput.addEventListener('change', () => {
        const anno = getSelectedAnnotation();
        if (anno && anno.type === 'text') {
          anno.fontSize = parseInt(dom.fontSizeInput.value, 10) || 16;
          state.currentFontSize = anno.fontSize;
          renderAnnotationsOverlay();
        }
      });
    }

    if (dom.boldBtn) {
      dom.boldBtn.addEventListener('click', () => {
        const anno = getSelectedAnnotation();
        if (anno && anno.type === 'text') {
          anno.bold = !anno.bold;
          dom.boldBtn.classList.toggle('active', anno.bold);
          renderAnnotationsOverlay();
        }
      });
    }

    if (dom.italicBtn) {
      dom.italicBtn.addEventListener('click', () => {
        const anno = getSelectedAnnotation();
        if (anno && anno.type === 'text') {
          anno.italic = !anno.italic;
          dom.italicBtn.classList.toggle('active', anno.italic);
          renderAnnotationsOverlay();
        }
      });
    }

    if (dom.whiteoutBgToggle) {
      dom.whiteoutBgToggle.addEventListener('click', () => {
        const anno = getSelectedAnnotation();
        if (anno && anno.type === 'text') {
          anno.bg = anno.bg === '#FFFFFF' ? 'transparent' : '#FFFFFF';
          dom.whiteoutBgToggle.classList.toggle('active', anno.bg === '#FFFFFF');
          renderAnnotationsOverlay();
        }
      });
    }

    if (dom.deleteObjBtn) {
      dom.deleteObjBtn.addEventListener('click', () => {
        deleteSelectedAnnotation();
      });
    }

    // Sticker Modal
    if (dom.closeStickerModalBtn && dom.stickerModal) {
      dom.closeStickerModalBtn.addEventListener('click', () => dom.stickerModal.classList.remove('open'));
      dom.stickerModal.addEventListener('click', (e) => {
        if (e.target === dom.stickerModal) dom.stickerModal.classList.remove('open');
      });
    }

    if (dom.stickerChoices) {
      dom.stickerChoices.forEach(choice => {
        choice.addEventListener('click', () => {
          const stickerKey = choice.getAttribute('data-sticker');
          placeStickerOnActivePage(stickerKey);
          if (dom.stickerModal) dom.stickerModal.classList.remove('open');
        });
      });
    }

    // Crop Modal
    if (dom.cropModalBtn && dom.cropModal) {
      dom.cropModalBtn.addEventListener('click', () => dom.cropModal.classList.add('open'));
    }
    if (dom.closeCropModalBtn && dom.cropModal) {
      dom.closeCropModalBtn.addEventListener('click', () => dom.cropModal.classList.remove('open'));
    }
    if (dom.cropCancelBtn && dom.cropModal) {
      dom.cropCancelBtn.addEventListener('click', () => dom.cropModal.classList.remove('open'));
    }

    if (dom.cropPresets) {
      dom.cropPresets.forEach(preset => {
        preset.addEventListener('click', () => {
          dom.cropPresets.forEach(p => p.classList.remove('active'));
          preset.classList.add('active');
          const type = preset.getAttribute('data-crop');
          if (dom.customCropInputs) {
            dom.customCropInputs.style.display = type === 'custom' ? 'block' : 'none';
          }
        });
      });
    }

    if (dom.cropApplyBtn) {
      dom.cropApplyBtn.addEventListener('click', applyPageCrop);
    }

    // Image Input
    if (dom.imageInput) {
      dom.imageInput.addEventListener('change', handleImageUpload);
    }

    // Canvas Interaction Events (Drawing, Moving, Resizing)
    if (dom.overlayCanvas) {
      dom.overlayCanvas.addEventListener('mousedown', onCanvasMouseDown);
      window.addEventListener('mousemove', onCanvasMouseMove);
      window.addEventListener('mouseup', onCanvasMouseUp);

      // Touch support
      dom.overlayCanvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
      window.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
      window.addEventListener('touchend', onCanvasTouchEnd);
    }

    // Keyboard shortcuts (Undo, Redo, Delete, Esc)
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undoAction();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redoAction();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedAnnotation();
      } else if (e.key === 'Escape') {
        state.selectedAnnotationId = null;
        hideInspector();
        renderAnnotationsOverlay();
      }
    });

    // Sidebar Toggle
    if (dom.sidebarToggleBtn && dom.sidebar) {
      dom.sidebarToggleBtn.addEventListener('click', () => {
        dom.sidebar.classList.toggle('collapsed');
      });
    }
  }

  // =========================================================================
  // Document Loading
  // =========================================================================
  async function loadPdfFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      UIUtils.showToast('Please select a valid PDF document.', 'error');
      return;
    }

    try {
      UIUtils.showToast('Loading document into private browser RAM...', 'info');
      state.file = file;
      state.pdfBytes = await UIUtils.readFileAsArrayBuffer(file);

      // Sanitize buffer if needed
      state.pdfBytes = sanitizePdfBuffer(state.pdfBytes);

      // Load with PDF.js for crisp visual stage
      const loadingTask = pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) });
      state.pdfJsDoc = await loadingTask.promise;
      state.numPages = state.pdfJsDoc.numPages;
      state.currentPage = 1;

      // Reset state for new document
      state.pageAnnotations = {};
      state.pageRotations = {};
      state.pageCrops = {};
      state.undoStack = {};
      state.redoStack = {};

      for (let i = 1; i <= state.numPages; i++) {
        state.pageAnnotations[i] = [];
        state.undoStack[i] = [];
        state.redoStack[i] = [];
      }

      // Update UI
      if (dom.emptyState) dom.emptyState.style.display = 'none';
      if (dom.workspace) dom.workspace.style.display = 'block';

      if (dom.docTitle) dom.docTitle.textContent = file.name;
      if (dom.docPagesBadge) dom.docPagesBadge.textContent = `${state.numPages} ${state.numPages === 1 ? 'Page' : 'Pages'}`;
      if (dom.totalPagesSpan) dom.totalPagesSpan.textContent = state.numPages;

      // Fit to width by default
      await fitToWidth();
      await renderThumbnails();

      UIUtils.showToast(`Document ready! ${state.numPages} pages rendered in memory.`, 'success');
    } catch (err) {
      console.error('Failed to load PDF:', err);
      UIUtils.showToast('Could not load PDF: ' + (err.message || 'Corrupt format'), 'error');
    }
  }

  async function loadSampleDocument() {
    try {
      UIUtils.showToast('Generating sample PDF in RAM...', 'info');
      const sampleDoc = await PDFLib.PDFDocument.create();
      const font = await sampleDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const fontBold = await sampleDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      // Page 1: Engineering & Architecture Review Document
      const page1 = sampleDoc.addPage([595, 842]); // A4
      page1.drawText("LOCALDOC ARCHITECTURAL REVIEW & SPECIFICATION", { x: 50, y: 780, size: 16, font: fontBold, color: PDFLib.rgb(0.08, 0.12, 0.2) });
      page1.drawText("Project Reference: LD-2026-ENG-REV-01 | Classification: Client Confidential", { x: 50, y: 758, size: 10, font: font, color: PDFLib.rgb(0.35, 0.42, 0.5) });
      page1.drawLine({ start: { x: 50, y: 746 }, end: { x: 545, y: 746 }, thickness: 1.5, color: PDFLib.rgb(0.8, 0.85, 0.9) });

      page1.drawText("1. EXECUTIVE SUMMARY & EDITING INSTRUCTIONS", { x: 50, y: 710, size: 12, font: fontBold });
      page1.drawText("This test document demonstrates all core features of the dedicated LocalDoc Edit Studio:", { x: 50, y: 690, size: 10, font });
      page1.drawText("- Click 'Text' to type in-place text notes and change typography (Helvetica, Times, Courier).", { x: 60, y: 670, size: 9.5, font });
      page1.drawText("- Click 'Whiteout' to draw an opaque box over outdated data and replace it.", { x: 60, y: 652, size: 9.5, font });
      page1.drawText("- Click 'Highlight' to mark passages in translucent fluorescent yellow, green, or pink.", { x: 60, y: 634, size: 9.5, font });
      page1.drawText("- Click 'Arrow' or 'Double Arrow' to point directly to items with mathematical precision.", { x: 60, y: 616, size: 9.5, font });
      page1.drawText("- Click 'Stickers' to place official review stamps (APPROVED, CONFIDENTIAL, DRAFT, etc.).", { x: 60, y: 598, size: 9.5, font });

      page1.drawRectangle({ x: 50, y: 460, width: 495, height: 110, borderColor: PDFLib.rgb(0.8, 0.85, 0.9), borderWidth: 1, color: PDFLib.rgb(0.98, 0.99, 1.0) });
      page1.drawText("SECTION 2: REVISION TEST BLOCK (TRY WHITEOUT & OVERLAY HERE):", { x: 65, y: 545, size: 10, font: fontBold, color: PDFLib.rgb(0.1, 0.4, 0.8) });
      page1.drawText("OLD PRICE: $4,580.00 USD | DELIVERY WINDOW: 3 WEEKS | STATUS: PENDING APPROVAL", { x: 65, y: 520, size: 9.5, font: fontBold, color: PDFLib.rgb(0.8, 0.1, 0.1) });
      page1.drawText("Use the Whiteout tool to cover the old price above, then add new text with your updated quote!", { x: 65, y: 495, size: 9, font });

      // Page 2: Blueprint & Geometry
      const page2 = sampleDoc.addPage([595, 842]);
      page2.drawText("PAGE 2: SCHEMATIC SPECIFICATION & MARGIN CROP TEST", { x: 50, y: 780, size: 14, font: fontBold });
      page2.drawText("Use the 'Crop Page' button to test lossless ISO 32000-1 /CropBox margin trimming without pixel blur.", { x: 50, y: 755, size: 10, font });
      page2.drawRectangle({ x: 50, y: 300, width: 495, height: 420, borderColor: PDFLib.rgb(0.2, 0.5, 0.35), borderWidth: 2 });
      page2.drawText("DIMENSION SPAN TEST ZONE -- USE DOUBLE-HEADED ARROW [<->] TO MEASURE", { x: 80, y: 690, size: 9.5, font: fontBold, color: PDFLib.rgb(0.2, 0.5, 0.35) });

      const bytes = await sampleDoc.save();
      const sampleBlob = new Blob([bytes], { type: 'application/pdf' });
      const sampleFile = new File([sampleBlob], 'LocalDoc-Edit-Studio-Sample-Review.pdf', { type: 'application/pdf' });
      await loadPdfFile(sampleFile);
    } catch (err) {
      console.error('Error generating sample:', err);
      UIUtils.showToast('Could not generate sample document: ' + err.message, 'error');
    }
  }

  function sanitizePdfBuffer(buf) {
    if (!(buf instanceof ArrayBuffer)) return buf;
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < Math.min(u8.length - 5, 100000); i++) {
      if (u8[i] === 0x25 && u8[i+1] === 0x50 && u8[i+2] === 0x44 && u8[i+3] === 0x46 && u8[i+4] === 0x2D) {
        if (i > 0) return buf.slice(i);
        return buf;
      }
    }
    return buf;
  }

  // =========================================================================
  // Canvas Rendering Pipeline (PDF.js + Vector Overlay)
  // =========================================================================
  async function renderActivePage() {
    if (!state.pdfJsDoc || !dom.bgCanvas || !dom.overlayCanvas) return;

    try {
      const page = await state.pdfJsDoc.getPage(state.currentPage);
      const rotation = ((state.pageRotations[state.currentPage] || 0) + page.rotate) % 360;

      // Base unscaled viewport
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      const viewport = page.getViewport({ scale: state.zoomScale, rotation });

      const w = Math.floor(viewport.width);
      const h = Math.floor(viewport.height);

      // Background Canvas
      dom.bgCanvas.width = w;
      dom.bgCanvas.height = h;
      dom.bgCanvas.style.width = w + 'px';
      dom.bgCanvas.style.height = h + 'px';

      // Overlay Canvas (Matches 1:1 with base canvas)
      dom.overlayCanvas.width = w;
      dom.overlayCanvas.height = h;
      dom.overlayCanvas.style.width = w + 'px';
      dom.overlayCanvas.style.height = h + 'px';

      if (dom.stageWrap) {
        dom.stageWrap.style.width = w + 'px';
        dom.stageWrap.style.height = h + 'px';
      }

      // Render PDF into background canvas
      const ctxBg = dom.bgCanvas.getContext('2d');
      ctxBg.clearRect(0, 0, w, h);
      await page.render({
        canvasContext: ctxBg,
        viewport: viewport
      }).promise;

      // Render annotations onto overlay
      renderAnnotationsOverlay();

      // Update Navigation input
      if (dom.curPageInput) dom.curPageInput.value = state.currentPage;
      if (dom.zoomValSpan) dom.zoomValSpan.textContent = Math.round(state.zoomScale * 100) + '%';
    } catch (err) {
      console.error('Error rendering active page:', err);
    }
  }

  function renderAnnotationsOverlay() {
    if (!dom.overlayCanvas) return;
    const ctx = dom.overlayCanvas.getContext('2d');
    const w = dom.overlayCanvas.width;
    const h = dom.overlayCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const annos = state.pageAnnotations[state.currentPage] || [];

    // Render each annotation
    annos.forEach(anno => {
      drawSingleAnnotation(ctx, anno, anno.id === state.selectedAnnotationId);
    });

    // Update floating inspector position if selected
    updateInspectorPosition();
  }

  function drawSingleAnnotation(ctx, anno, isSelected) {
    ctx.save();

    const scale = state.zoomScale;
    const x = anno.x * scale;
    const y = anno.y * scale;
    const width = (anno.width || 0) * scale;
    const height = (anno.height || 0) * scale;

    ctx.globalAlpha = anno.opacity !== undefined ? anno.opacity : 1.0;

    switch (anno.type) {
      case 'whiteout':
        ctx.fillStyle = anno.color || '#FFFFFF';
        ctx.fillRect(x, y, width, height);
        break;

      case 'highlight':
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = anno.color || '#FEF08A';
        ctx.globalAlpha = 0.45;
        if (anno.points && anno.points.length > 1) {
          ctx.strokeStyle = anno.color || '#FEF08A';
          ctx.lineWidth = (anno.strokeWidth || 18) * scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(anno.points[0].x * scale, anno.points[0].y * scale);
          for (let i = 1; i < anno.points.length; i++) {
            ctx.lineTo(anno.points[i].x * scale, anno.points[i].y * scale);
          }
          ctx.stroke();
        } else {
          ctx.fillRect(x, y, width, height);
        }
        ctx.restore();
        break;

      case 'pen':
        if (anno.points && anno.points.length > 1) {
          ctx.strokeStyle = anno.color || state.currentColor;
          ctx.lineWidth = (anno.strokeWidth || 3) * scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(anno.points[0].x * scale, anno.points[0].y * scale);
          for (let i = 1; i < anno.points.length; i++) {
            ctx.lineTo(anno.points[i].x * scale, anno.points[i].y * scale);
          }
          ctx.stroke();
        }
        break;

      case 'line':
        ctx.strokeStyle = anno.color || state.currentColor;
        ctx.lineWidth = (anno.strokeWidth || 3) * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
        break;

      case 'arrow':
      case 'double-arrow':
        drawArrowGeometry(ctx, x, y, x + width, y + height, anno.color || state.currentColor, (anno.strokeWidth || 3) * scale, anno.type === 'double-arrow');
        break;

      case 'rect':
        ctx.strokeStyle = anno.color || state.currentColor;
        ctx.lineWidth = (anno.strokeWidth || 3) * scale;
        if (anno.bg && anno.bg !== 'transparent') {
          ctx.fillStyle = anno.bg;
          ctx.fillRect(x, y, width, height);
        }
        ctx.strokeRect(x, y, width, height);
        break;

      case 'circle':
        ctx.strokeStyle = anno.color || state.currentColor;
        ctx.lineWidth = (anno.strokeWidth || 3) * scale;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, 2 * Math.PI);
        if (anno.bg && anno.bg !== 'transparent') {
          ctx.fillStyle = anno.bg;
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'text':
        drawTextBox(ctx, anno, x, y, width, height, scale);
        break;

      case 'sticker':
        drawStickerBadge(ctx, anno, x, y, width, height, scale);
        break;

      case 'image':
        if (anno.imageEl && anno.imageEl.complete) {
          ctx.drawImage(anno.imageEl, x, y, width, height);
        }
        break;
    }

    // Draw selection bounding box and handles
    if (isSelected) {
      drawSelectionHandles(ctx, x, y, width, height);
    }

    ctx.restore();
  }

  function drawTextBox(ctx, anno, x, y, width, height, scale) {
    const fontSize = (anno.fontSize || 16) * scale;
    const fontFam = anno.fontFamily || 'Helvetica, Arial, sans-serif';
    const weight = anno.bold ? 'bold ' : '';
    const style = anno.italic ? 'italic ' : '';
    ctx.font = `${style}${weight}${fontSize}px ${fontFam}`;
    ctx.textBaseline = 'top';

    // Optional solid white background box (whiteout combo)
    if (anno.bg && anno.bg !== 'transparent') {
      ctx.fillStyle = anno.bg;
      ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
    }

    ctx.fillStyle = anno.color || '#000000';

    // Multi-line rendering
    const lines = (anno.text || 'Click to edit text').split('\n');
    const lineHeight = fontSize * 1.25;
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
  }

  function drawArrowGeometry(ctx, x1, y1, x2, y2, color, strokeWidth, isDouble) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;

    // Draw main shaft
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const headLength = Math.max(14, strokeWidth * 3.5);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // End arrow head
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Start arrow head if double-headed
    if (isDouble) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + headLength * Math.cos(angle - Math.PI / 6), y1 + headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 + headLength * Math.cos(angle + Math.PI / 6), y1 + headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawStickerBadge(ctx, anno, x, y, width, height, scale) {
    const tmpl = STICKER_TEMPLATES[anno.stickerType] || STICKER_TEMPLATES['APPROVED'];

    // Background pill
    ctx.fillStyle = tmpl.bg;
    ctx.strokeStyle = tmpl.color;
    ctx.lineWidth = 2.5 * scale;

    const radius = 8 * scale;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();

    // Main text
    ctx.fillStyle = tmpl.color;
    ctx.font = `bold ${14 * scale}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tmpl.text, x + width / 2, y + height / 2 - (6 * scale));

    // Subtitle
    ctx.font = `${8.5 * scale}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#64748B';
    ctx.fillText(tmpl.subtitle, x + width / 2, y + height / 2 + (10 * scale));

    ctx.textAlign = 'left';
  }

  function drawSelectionHandles(ctx, x, y, width, height) {
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
    ctx.setLineDash([]);

    const handleSize = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;

    const corners = [
      { x: x - 3, y: y - 3 },
      { x: x + width + 3, y: y - 3 },
      { x: x + width + 3, y: y + height + 3 },
      { x: x - 3, y: y + height + 3 }
    ];

    corners.forEach(c => {
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    });
  }

  // =========================================================================
  // Canvas Mouse & Touch Interaction Engine
  // =========================================================================
  function getCanvasCoords(e) {
    if (!dom.overlayCanvas) return { x: 0, y: 0 };
    const rect = dom.overlayCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / state.zoomScale,
      y: (clientY - rect.top) / state.zoomScale
    };
  }

  function onCanvasMouseDown(e) {
    if (!state.pdfJsDoc) return;
    const { x, y } = getCanvasCoords(e);

    // If Select Tool
    if (state.activeTool === 'select') {
      const clickedAnno = findAnnotationAt(x, y);
      if (clickedAnno) {
        state.selectedAnnotationId = clickedAnno.id;
        state.isDrawing = true;
        state.dragHandle = 'move';
        state.drawStartX = x;
        state.drawStartY = y;
        state.dragStartAnno = { ...clickedAnno };
        saveHistoryState();
        renderAnnotationsOverlay();
      } else {
        state.selectedAnnotationId = null;
        hideInspector();
        renderAnnotationsOverlay();
      }
      return;
    }

    // Creating new annotation
    saveHistoryState();
    state.isDrawing = true;
    state.drawStartX = x;
    state.drawStartY = y;
    state.currentDrawPoints = [{ x, y }];

    if (state.activeTool === 'text') {
      state.isDrawing = false;
      spawnNewTextBox(x, y);
    }
  }

  function onCanvasMouseMove(e) {
    if (!state.isDrawing) return;
    const { x, y } = getCanvasCoords(e);

    // Moving existing selected annotation
    if (state.dragHandle === 'move' && state.selectedAnnotationId) {
      const anno = getSelectedAnnotation();
      if (anno && state.dragStartAnno) {
        const dx = x - state.drawStartX;
        const dy = y - state.drawStartY;
        anno.x = state.dragStartAnno.x + dx;
        anno.y = state.dragStartAnno.y + dy;
        renderAnnotationsOverlay();
      }
      return;
    }

    // Drawing new shape / pen stroke
    if (state.activeTool === 'pen' || state.activeTool === 'highlight') {
      state.currentDrawPoints.push({ x, y });
      drawLivePreviewStroke();
      return;
    }

    // Drawing live rectangle / line / arrow / whiteout preview
    drawLiveShapePreview(x, y);
  }

  function onCanvasMouseUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.dragHandle = null;
    state.dragStartAnno = null;

    const { x, y } = getCanvasCoords(e);
    const startX = state.drawStartX;
    const startY = state.drawStartY;

    const w = x - startX;
    const h = y - startY;

    // Minimum drag threshold to avoid accidental micro-clicks
    if (state.activeTool !== 'pen' && state.activeTool !== 'highlight' && Math.hypot(w, h) < 5) {
      renderAnnotationsOverlay();
      return;
    }

    const annoId = 'anno-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    let newAnno = null;

    switch (state.activeTool) {
      case 'whiteout':
        newAnno = {
          id: annoId,
          type: 'whiteout',
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(w),
          height: Math.abs(h),
          color: '#FFFFFF',
          opacity: 1.0
        };
        break;

      case 'highlight':
        if (state.currentDrawPoints.length > 2) {
          newAnno = {
            id: annoId,
            type: 'highlight',
            color: state.currentColor === '#DC2626' ? '#FEF08A' : state.currentColor,
            strokeWidth: 20,
            opacity: 0.45,
            points: [...state.currentDrawPoints]
          };
        } else {
          newAnno = {
            id: annoId,
            type: 'highlight',
            x: Math.min(startX, x),
            y: Math.min(startY, y),
            width: Math.abs(w),
            height: Math.abs(h),
            color: state.currentColor === '#DC2626' ? '#FEF08A' : state.currentColor,
            opacity: 0.45
          };
        }
        break;

      case 'pen':
        if (state.currentDrawPoints.length > 1) {
          newAnno = {
            id: annoId,
            type: 'pen',
            color: state.currentColor,
            strokeWidth: state.currentStrokeWidth,
            points: [...state.currentDrawPoints]
          };
        }
        break;

      case 'line':
      case 'arrow':
      case 'double-arrow':
        newAnno = {
          id: annoId,
          type: state.activeTool,
          x: startX,
          y: startY,
          width: w,
          height: h,
          color: state.currentColor,
          strokeWidth: state.currentStrokeWidth
        };
        break;

      case 'rect':
      case 'circle':
        newAnno = {
          id: annoId,
          type: state.activeTool,
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(w),
          height: Math.abs(h),
          color: state.currentColor,
          strokeWidth: state.currentStrokeWidth,
          bg: 'transparent'
        };
        break;
    }

    if (newAnno) {
      if (!state.pageAnnotations[state.currentPage]) state.pageAnnotations[state.currentPage] = [];
      state.pageAnnotations[state.currentPage].push(newAnno);
      state.selectedAnnotationId = newAnno.id;
    }

    state.currentDrawPoints = [];
    renderAnnotationsOverlay();
    renderThumbnails();
  }

  function onCanvasTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      onCanvasMouseDown(e);
    }
  }
  function onCanvasTouchMove(e) {
    if (state.isDrawing && e.touches.length === 1) {
      e.preventDefault();
      onCanvasMouseMove(e);
    }
  }
  function onCanvasTouchEnd(e) {
    onCanvasMouseUp(e);
  }

  function drawLivePreviewStroke() {
    renderAnnotationsOverlay();
    const ctx = dom.overlayCanvas.getContext('2d');
    const scale = state.zoomScale;

    ctx.save();
    if (state.activeTool === 'highlight') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = state.currentColor === '#DC2626' ? '#FEF08A' : state.currentColor;
      ctx.lineWidth = 20 * scale;
      ctx.globalAlpha = 0.45;
    } else {
      ctx.strokeStyle = state.currentColor;
      ctx.lineWidth = state.currentStrokeWidth * scale;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.currentDrawPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(state.currentDrawPoints[0].x * scale, state.currentDrawPoints[0].y * scale);
      for (let i = 1; i < state.currentDrawPoints.length; i++) {
        ctx.lineTo(state.currentDrawPoints[i].x * scale, state.currentDrawPoints[i].y * scale);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLiveShapePreview(curX, curY) {
    renderAnnotationsOverlay();
    const ctx = dom.overlayCanvas.getContext('2d');
    const scale = state.zoomScale;

    ctx.save();
    const sx = state.drawStartX * scale;
    const sy = state.drawStartY * scale;
    const ex = curX * scale;
    const ey = curY * scale;

    ctx.strokeStyle = state.currentColor;
    ctx.lineWidth = state.currentStrokeWidth * scale;

    if (state.activeTool === 'whiteout') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
      ctx.strokeStyle = '#94A3B8';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
    } else if (state.activeTool === 'rect') {
      ctx.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
    } else if (state.activeTool === 'circle') {
      const rx = Math.abs(ex - sx) / 2;
      const ry = Math.abs(ey - sy) / 2;
      ctx.beginPath();
      ctx.ellipse(Math.min(sx, ex) + rx, Math.min(sy, ey) + ry, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (state.activeTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else if (state.activeTool === 'arrow' || state.activeTool === 'double-arrow') {
      drawArrowGeometry(ctx, sx, sy, ex, ey, state.currentColor, state.currentStrokeWidth * scale, state.activeTool === 'double-arrow');
    }
    ctx.restore();
  }

  // =========================================================================
  // Text Boxes & Inline Typography Inspector
  // =========================================================================
  function spawnNewTextBox(x, y) {
    const text = prompt('Enter text for this note:', 'Double-click to edit text');
    if (!text) return;

    const annoId = 'anno-' + Date.now();
    const newAnno = {
      id: annoId,
      type: 'text',
      x: x,
      y: y,
      width: Math.max(120, text.length * 8),
      height: 28,
      text: text,
      color: state.currentColor,
      fontSize: state.currentFontSize,
      fontFamily: state.currentFontFamily,
      bold: state.currentFontBold,
      italic: state.currentFontItalic,
      bg: 'transparent'
    };

    if (!state.pageAnnotations[state.currentPage]) state.pageAnnotations[state.currentPage] = [];
    state.pageAnnotations[state.currentPage].push(newAnno);
    state.selectedAnnotationId = newAnno.id;

    renderAnnotationsOverlay();
    renderThumbnails();
  }

  function updateInspectorPosition() {
    if (!dom.inspector || !state.selectedAnnotationId) {
      hideInspector();
      return;
    }

    const anno = getSelectedAnnotation();
    if (!anno || anno.type !== 'text') {
      hideInspector();
      return;
    }

    const scale = state.zoomScale;
    const stageRect = dom.stageWrap.getBoundingClientRect();
    const viewportRect = dom.viewport.getBoundingClientRect();

    const top = (anno.y * scale) + (stageRect.top - viewportRect.top) - 46;
    const left = (anno.x * scale) + (stageRect.left - viewportRect.left);

    dom.inspector.style.top = Math.max(10, top) + 'px';
    dom.inspector.style.left = Math.max(10, left) + 'px';
    dom.inspector.style.display = 'flex';

    // Sync inspector controls with current annotation values
    if (dom.fontFamilySelect) dom.fontFamilySelect.value = anno.fontFamily || 'Helvetica';
    if (dom.fontSizeInput) dom.fontSizeInput.value = anno.fontSize || 16;
    if (dom.boldBtn) dom.boldBtn.classList.toggle('active', !!anno.bold);
    if (dom.italicBtn) dom.italicBtn.classList.toggle('active', !!anno.italic);
    if (dom.whiteoutBgToggle) dom.whiteoutBgToggle.classList.toggle('active', anno.bg === '#FFFFFF');
  }

  function hideInspector() {
    if (dom.inspector) dom.inspector.style.display = 'none';
  }

  // =========================================================================
  // Stickers & Badges
  // =========================================================================
  function placeStickerOnActivePage(stickerKey) {
    if (!state.pdfJsDoc) return;
    saveHistoryState();

    const annoId = 'sticker-' + Date.now();
    const newAnno = {
      id: annoId,
      type: 'sticker',
      stickerType: stickerKey,
      x: 60,
      y: 120,
      width: 170,
      height: 52,
      opacity: 1.0
    };

    if (!state.pageAnnotations[state.currentPage]) state.pageAnnotations[state.currentPage] = [];
    state.pageAnnotations[state.currentPage].push(newAnno);
    state.selectedAnnotationId = newAnno.id;

    renderAnnotationsOverlay();
    renderThumbnails();
    UIUtils.showToast(`Placed ${stickerKey} sticker on Page ${state.currentPage}`, 'success');
  }

  // =========================================================================
  // Picture & Logo Upload
  // =========================================================================
  function handleImageUpload(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    const imgFile = e.target.files[0];
    const reader = new FileReader();

    reader.onload = function (evt) {
      const img = new Image();
      img.onload = function () {
        saveHistoryState();
        const annoId = 'img-' + Date.now();
        const aspect = img.width / img.height;
        const targetWidth = Math.min(220, img.width);
        const targetHeight = targetWidth / aspect;

        const newAnno = {
          id: annoId,
          type: 'image',
          x: 80,
          y: 100,
          width: targetWidth,
          height: targetHeight,
          imageSrc: evt.target.result,
          imageEl: img,
          opacity: 1.0
        };

        if (!state.pageAnnotations[state.currentPage]) state.pageAnnotations[state.currentPage] = [];
        state.pageAnnotations[state.currentPage].push(newAnno);
        state.selectedAnnotationId = newAnno.id;

        renderAnnotationsOverlay();
        renderThumbnails();
        UIUtils.showToast('Picture inserted! Drag or resize anywhere.', 'success');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(imgFile);
  }

  // =========================================================================
  // Page Crop Surgery (ISO 32000-1 /CropBox Geometry)
  // =========================================================================
  function applyPageCrop() {
    const activePreset = document.querySelector('.edit-crop-preset.active');
    const presetType = activePreset ? activePreset.getAttribute('data-crop') : 'none';

    let margins = { left: 0, top: 0, right: 0, bottom: 0 }; // in points (1 mm ≈ 2.83465 pt)
    const mmToPt = 2.83465;

    switch (presetType) {
      case 'trim-5':
        margins = { left: 5 * mmToPt, top: 5 * mmToPt, right: 5 * mmToPt, bottom: 5 * mmToPt };
        break;
      case 'trim-10':
        margins = { left: 10 * mmToPt, top: 10 * mmToPt, right: 10 * mmToPt, bottom: 10 * mmToPt };
        break;
      case 'trim-20':
        margins = { left: 20 * mmToPt, top: 20 * mmToPt, right: 20 * mmToPt, bottom: 20 * mmToPt };
        break;
      case 'custom':
        margins = {
          left: (parseFloat(dom.cropLeft.value) || 0) * mmToPt,
          right: (parseFloat(dom.cropRight.value) || 0) * mmToPt,
          top: (parseFloat(dom.cropTop.value) || 0) * mmToPt,
          bottom: (parseFloat(dom.cropBottom.value) || 0) * mmToPt
        };
        break;
      case 'none':
      default:
        margins = { left: 0, top: 0, right: 0, bottom: 0 };
        break;
    }

    state.pageCrops[state.currentPage] = margins;
    if (dom.cropModal) dom.cropModal.classList.remove('open');
    UIUtils.showToast(`Crop margins applied to Page ${state.currentPage}`, 'success');
  }

  // =========================================================================
  // Selection & Hit-Testing Helpers
  // =========================================================================
  function findAnnotationAt(x, y) {
    const annos = state.pageAnnotations[state.currentPage] || [];
    // Search top-to-bottom (reverse array)
    for (let i = annos.length - 1; i >= 0; i--) {
      const a = annos[i];
      if (a.points && a.points.length > 1) {
        for (let pt of a.points) {
          if (Math.hypot(pt.x - x, pt.y - y) < 14) return a;
        }
      } else {
        const minX = Math.min(a.x, a.x + (a.width || 0));
        const maxX = Math.max(a.x, a.x + (a.width || 0));
        const minY = Math.min(a.y, a.y + (a.height || 0));
        const maxY = Math.max(a.y, a.y + (a.height || 0));
        if (x >= minX - 4 && x <= maxX + 4 && y >= minY - 4 && y <= maxY + 4) {
          return a;
        }
      }
    }
    return null;
  }

  function getSelectedAnnotation() {
    if (!state.selectedAnnotationId) return null;
    const annos = state.pageAnnotations[state.currentPage] || [];
    return annos.find(a => a.id === state.selectedAnnotationId) || null;
  }

  function deleteSelectedAnnotation() {
    if (!state.selectedAnnotationId) return;
    saveHistoryState();
    const annos = state.pageAnnotations[state.currentPage] || [];
    state.pageAnnotations[state.currentPage] = annos.filter(a => a.id !== state.selectedAnnotationId);
    state.selectedAnnotationId = null;
    hideInspector();
    renderAnnotationsOverlay();
    renderThumbnails();
  }

  // =========================================================================
  // History (Undo / Redo)
  // =========================================================================
  function saveHistoryState() {
    const p = state.currentPage;
    if (!state.undoStack[p]) state.undoStack[p] = [];
    const currentList = state.pageAnnotations[p] || [];
    // Deep clone
    state.undoStack[p].push(JSON.parse(JSON.stringify(currentList)));
    state.redoStack[p] = []; // Clear redo stack on new action
  }

  function undoAction() {
    const p = state.currentPage;
    if (!state.undoStack[p] || state.undoStack[p].length === 0) {
      UIUtils.showToast('Nothing to undo on this page', 'info');
      return;
    }
    const currentList = state.pageAnnotations[p] || [];
    if (!state.redoStack[p]) state.redoStack[p] = [];
    state.redoStack[p].push(JSON.parse(JSON.stringify(currentList)));

    state.pageAnnotations[p] = state.undoStack[p].pop();
    state.selectedAnnotationId = null;
    hideInspector();
    renderAnnotationsOverlay();
    renderThumbnails();
    UIUtils.showToast('Undo applied', 'info');
  }

  function redoAction() {
    const p = state.currentPage;
    if (!state.redoStack[p] || state.redoStack[p].length === 0) {
      UIUtils.showToast('Nothing to redo', 'info');
      return;
    }
    const currentList = state.pageAnnotations[p] || [];
    state.undoStack[p].push(JSON.parse(JSON.stringify(currentList)));

    state.pageAnnotations[p] = state.redoStack[p].pop();
    state.selectedAnnotationId = null;
    hideInspector();
    renderAnnotationsOverlay();
    renderThumbnails();
    UIUtils.showToast('Redo applied', 'info');
  }

  // =========================================================================
  // Thumbnails Sidebar & Page Switching
  // =========================================================================
  async function renderThumbnails() {
    if (!dom.thumbnailList || !state.pdfJsDoc) return;
    dom.thumbnailList.innerHTML = '';

    for (let i = 1; i <= state.numPages; i++) {
      const item = document.createElement('div');
      item.className = 'edit-thumb-item' + (i === state.currentPage ? ' active' : '');
      item.setAttribute('data-page', i);

      const header = document.createElement('div');
      header.className = 'edit-thumb-header';
      header.innerHTML = `<span>Page ${i}</span>`;

      // Annotation count badge
      const annos = state.pageAnnotations[i] || [];
      if (annos.length > 0) {
        header.innerHTML += `<span class="edit-thumb-badge">${annos.length}</span>`;
      }

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'edit-thumb-wrap';
      const tCanvas = document.createElement('canvas');
      canvasWrap.appendChild(tCanvas);

      item.appendChild(header);
      item.appendChild(canvasWrap);

      item.addEventListener('click', () => changePage(i));
      dom.thumbnailList.appendChild(item);

      // Async render thumbnail preview
      renderSingleThumbnail(i, tCanvas);
    }
  }

  async function renderSingleThumbnail(pageNum, canvas) {
    try {
      const page = await state.pdfJsDoc.getPage(pageNum);
      const rot = ((state.pageRotations[pageNum] || 0) + page.rotate) % 360;
      const viewport = page.getViewport({ scale: 0.22, rotation: rot });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.warn('Thumb error page', pageNum, e);
    }
  }

  function changePage(targetPage) {
    if (targetPage < 1 || targetPage > state.numPages || targetPage === state.currentPage) return;
    state.currentPage = targetPage;
    state.selectedAnnotationId = null;
    hideInspector();

    // Update thumbnail list active class
    if (dom.thumbnailList) {
      dom.thumbnailList.querySelectorAll('.edit-thumb-item').forEach(it => {
        const p = parseInt(it.getAttribute('data-page'), 10);
        it.classList.toggle('active', p === state.currentPage);
      });
    }

    renderActivePage();
  }

  // =========================================================================
  // Zoom Controls
  // =========================================================================
  function setZoom(scale) {
    state.zoomScale = Math.min(3.0, Math.max(0.4, scale));
    renderActivePage();
  }

  async function fitToWidth() {
    if (!state.pdfJsDoc || !dom.viewport) return;
    const page = await state.pdfJsDoc.getPage(state.currentPage);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const availableWidth = dom.viewport.clientWidth - 48; // padding margin
    state.zoomScale = Math.max(0.4, Math.min(2.5, availableWidth / unscaledViewport.width));
    renderActivePage();
  }

  // =========================================================================
  // Tool & Color Selection
  // =========================================================================
  function setTool(toolName) {
    state.activeTool = toolName;
    state.selectedAnnotationId = null;
    hideInspector();

    if (dom.toolBtns) {
      dom.toolBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === toolName);
      });
    }

    if (toolName === 'sticker') {
      if (dom.stickerModal) dom.stickerModal.classList.add('open');
    } else if (toolName === 'image') {
      if (dom.imageInput) dom.imageInput.click();
    } else if (toolName === 'crop') {
      if (dom.cropModal) dom.cropModal.classList.add('open');
    }

    renderAnnotationsOverlay();
  }

  function setColor(colorHex) {
    state.currentColor = colorHex;
    const anno = getSelectedAnnotation();
    if (anno) {
      anno.color = colorHex;
      renderAnnotationsOverlay();
    }
  }

  // =========================================================================
  // PDF Export Engine (PDF-Lib Vector Synthesis in RAM)
  // =========================================================================
  async function exportEditedPdf() {
    if (!state.pdfBytes) return;

    try {
      UIUtils.showToast('Synthesizing edited PDF document in local RAM...', 'info');

      const cleanBuffer = sanitizePdfBuffer(state.pdfBytes);
      const pdfDoc = await PDFLib.PDFDocument.load(cleanBuffer.slice(0), { ignoreEncryption: true });

      const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const timesRoman = await pdfDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
      const courier = await pdfDoc.embedFont(PDFLib.StandardFonts.Courier);

      const pages = pdfDoc.getPages();

      for (let pNum = 1; pNum <= pages.length; pNum++) {
        const page = pages[pNum - 1];
        const { width: pWidth, height: pHeight } = page.getSize();

        // 1. Apply page rotation
        const addRot = state.pageRotations[pNum] || 0;
        if (addRot !== 0) {
          const curRot = page.getRotation().angle;
          page.setRotation(PDFLib.degrees((curRot + addRot) % 360));
        }

        // 2. Apply page crop margins (/CropBox surgery)
        const crop = state.pageCrops[pNum];
        if (crop && (crop.left > 0 || crop.right > 0 || crop.top > 0 || crop.bottom > 0)) {
          const x = crop.left;
          const y = crop.bottom;
          const w = pWidth - (crop.left + crop.right);
          const h = pHeight - (crop.top + crop.bottom);
          if (w > 50 && h > 50) {
            page.setCropBox(x, y, w, h);
          }
        }

        // 3. Bake page annotations
        const annos = state.pageAnnotations[pNum] || [];
        for (let anno of annos) {
          await bakeAnnotationIntoPdfPage(pdfDoc, page, anno, pWidth, pHeight, {
            helvetica,
            helveticaBold,
            timesRoman,
            courier
          });
        }
      }

      const outBytes = await pdfDoc.save();
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      const origName = state.file ? state.file.name.replace(/\.pdf$/i, '') : 'document';
      const outName = `${origName}-edited-localdoc.pdf`;

      UIUtils.downloadBlob(outBlob, outName);
      UIUtils.showToast('Edited PDF downloaded successfully! 100% private in local RAM.', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      UIUtils.showToast('Could not export PDF: ' + err.message, 'error');
    }
  }

  async function bakeAnnotationIntoPdfPage(pdfDoc, page, anno, pWidth, pHeight, fonts) {
    // In PDF coordinates, origin (0,0) is bottom-left
    // In Canvas coordinates, origin (0,0) is top-left
    const pdfX = anno.x;
    const pdfY = pHeight - anno.y - (anno.height || 0);

    const color = hexToRgb(anno.color || '#000000');

    switch (anno.type) {
      case 'whiteout':
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: anno.width,
          height: anno.height,
          color: PDFLib.rgb(1, 1, 1),
          opacity: 1.0
        });
        break;

      case 'rect':
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: anno.width,
          height: anno.height,
          borderColor: color,
          borderWidth: anno.strokeWidth || 2,
          color: anno.bg && anno.bg !== 'transparent' ? hexToRgb(anno.bg) : undefined
        });
        break;

      case 'circle':
        const rx = (anno.width || 20) / 2;
        const ry = (anno.height || 20) / 2;
        page.drawEllipse({
          x: pdfX + rx,
          y: pdfY + ry,
          xScale: rx,
          yScale: ry,
          borderColor: color,
          borderWidth: anno.strokeWidth || 2
        });
        break;

      case 'line':
        page.drawLine({
          start: { x: anno.x, y: pHeight - anno.y },
          end: { x: anno.x + anno.width, y: pHeight - (anno.y + anno.height) },
          color: color,
          thickness: anno.strokeWidth || 2
        });
        break;

      case 'arrow':
      case 'double-arrow':
        bakeArrow(page, anno.x, pHeight - anno.y, anno.x + anno.width, pHeight - (anno.y + anno.height), color, anno.strokeWidth || 2, anno.type === 'double-arrow');
        break;

      case 'text':
        let selectedFont = fonts.helvetica;
        if (anno.fontFamily && anno.fontFamily.includes('Times')) selectedFont = fonts.timesRoman;
        else if (anno.fontFamily && anno.fontFamily.includes('Courier')) selectedFont = fonts.courier;
        else if (anno.bold) selectedFont = fonts.helveticaBold;

        // Background box if whiteout-text combo
        if (anno.bg && anno.bg !== 'transparent') {
          page.drawRectangle({
            x: pdfX - 4,
            y: pdfY - 4,
            width: anno.width + 8,
            height: anno.height + 8,
            color: PDFLib.rgb(1, 1, 1)
          });
        }

        const lines = (anno.text || '').split('\n');
        const fSize = anno.fontSize || 14;
        lines.forEach((line, idx) => {
          page.drawText(line, {
            x: pdfX,
            y: pHeight - anno.y - fSize - (idx * fSize * 1.25),
            size: fSize,
            font: selectedFont,
            color: color
          });
        });
        break;

      case 'sticker':
        // Rasterize sticker onto offscreen canvas and embed as PNG
        const stickerPngBytes = await rasterizeStickerToPng(anno.stickerType);
        if (stickerPngBytes) {
          const imgEmbed = await pdfDoc.embedPng(stickerPngBytes);
          page.drawImage(imgEmbed, {
            x: pdfX,
            y: pdfY,
            width: anno.width,
            height: anno.height
          });
        }
        break;

      case 'image':
        if (anno.imageSrc) {
          const imgBytes = await fetch(anno.imageSrc).then(res => res.arrayBuffer());
          let imgEmbed;
          if (anno.imageSrc.includes('image/png')) {
            imgEmbed = await pdfDoc.embedPng(imgBytes);
          } else {
            imgEmbed = await pdfDoc.embedJpg(imgBytes);
          }
          page.drawImage(imgEmbed, {
            x: pdfX,
            y: pdfY,
            width: anno.width,
            height: anno.height
          });
        }
        break;
    }
  }

  function bakeArrow(page, x1, y1, x2, y2, color, thickness, isDouble) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      color: color,
      thickness: thickness
    });

    const headLength = Math.max(14, thickness * 3.5);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // End Arrow Head
    const p1 = { x: x2, y: y2 };
    const p2 = { x: x2 - headLength * Math.cos(angle - Math.PI / 6), y: y2 - headLength * Math.sin(angle - Math.PI / 6) };
    const p3 = { x: x2 - headLength * Math.cos(angle + Math.PI / 6), y: y2 - headLength * Math.sin(angle + Math.PI / 6) };

    page.drawLine({ start: p1, end: p2, color: color, thickness });
    page.drawLine({ start: p1, end: p3, color: color, thickness });

    if (isDouble) {
      const q1 = { x: x1, y: y1 };
      const q2 = { x: x1 + headLength * Math.cos(angle - Math.PI / 6), y: y1 + headLength * Math.sin(angle - Math.PI / 6) };
      const q3 = { x: x1 + headLength * Math.cos(angle + Math.PI / 6), y: y1 + headLength * Math.sin(angle + Math.PI / 6) };
      page.drawLine({ start: q1, end: q2, color: color, thickness });
      page.drawLine({ start: q1, end: q3, color: color, thickness });
    }
  }

  async function rasterizeStickerToPng(stickerKey) {
    const tmpl = STICKER_TEMPLATES[stickerKey] || STICKER_TEMPLATES['APPROVED'];
    const canvas = document.createElement('canvas');
    canvas.width = 340;
    canvas.height = 104;
    const ctx = canvas.getContext('2d');

    // High-res sticker
    ctx.fillStyle = tmpl.bg;
    ctx.strokeStyle = tmpl.color;
    ctx.lineWidth = 5;
    ctx.roundRect(4, 4, 332, 96, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tmpl.color;
    ctx.font = 'bold 28px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tmpl.text, 170, 40);

    ctx.font = '17px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(tmpl.subtitle, 170, 74);

    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        const arr = await blob.arrayBuffer();
        resolve(new Uint8Array(arr));
      }, 'image/png');
    });
  }

  function hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) return PDFLib.rgb(0, 0, 0);
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return PDFLib.rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }

  // Export public namespace for testing
  window.PDFEditStudio = {
    state,
    loadPdfFile,
    loadSampleDocument,
    setTool,
    setColor,
    changePage,
    setZoom,
    fitToWidth,
    exportEditedPdf
  };

})();
