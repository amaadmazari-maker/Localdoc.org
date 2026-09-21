/**
 * LocalDoc.org — Photo Resizer & Exact KB Reducer Engine (js/tools/photo-resizer.js)
 * 100% Client-Side In-Memory Execution. Zero Server Uploads.
 * Resize by mm, cm, inches, or pixels + compress to exact target file size in KB.
 * Full Multi-Photo Batch Queue & In-Memory ZIP Archive support.
 */

(function() {
  'use strict';

  // State
  let loadedItems = []; // Array of { file, img, width, height, sizeKB, dataUrl }
  let activeIndex = 0;

  let originalFile = null;
  let originalImg = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let originalSizeKB = 0;

  let currentUnit = 'mm'; // 'mm', 'cm', 'inch', 'px'
  let targetWidth = 35;
  let targetHeight = 45;
  let lockAspectRatio = true;
  let targetDPI = 300;
  let targetMaxKB = 50;
  let backgroundColor = 'original'; // 'original', 'white', 'light-blue'
  let outputFormat = 'image/jpeg'; // 'image/jpeg', 'image/png'

  let outputBlob = null;
  let outputDataUrl = null;

  // DOM Elements
  const dropZone = document.getElementById('resizer-drop-zone');
  const fileInput = document.getElementById('resizer-file-input');
  const emptyState = document.getElementById('resizer-empty-state');
  const workspace = document.getElementById('resizer-workspace');

  const batchPanel = document.getElementById('resizer-batch-panel');
  const batchTitle = document.getElementById('resizer-batch-title');
  const batchThumbnails = document.getElementById('resizer-batch-thumbnails');
  const batchDownloadBtn = document.getElementById('resizer-batch-download-btn');

  const origPreview = document.getElementById('resizer-orig-preview');
  const origInfo = document.getElementById('resizer-orig-info');
  const outputPreview = document.getElementById('resizer-output-preview');
  const outputInfo = document.getElementById('resizer-output-info');

  const inputWidth = document.getElementById('resizer-input-width');
  const inputHeight = document.getElementById('resizer-input-height');
  const unitLabelW = document.getElementById('resizer-unit-w');
  const unitLabelH = document.getElementById('resizer-unit-h');
  const lockAspectCheckbox = document.getElementById('resizer-lock-aspect');
  const targetKbInput = document.getElementById('resizer-target-kb');
  const targetKbSlider = document.getElementById('resizer-slider-kb');
  const dpiSelect = document.getElementById('resizer-dpi-select');
  const downloadBtn = document.getElementById('resizer-download-btn');

  function init() {
    setupEventListeners();
    parseQueryParams();
  }

  function parseQueryParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get('preset') || params.get('size') || params.get('dim');
      const kb = params.get('kb') || params.get('target') || params.get('max');
      const bg = params.get('bg') || params.get('background');
      const unit = params.get('unit');

      if (preset) {
        const btn = document.querySelector(`[data-preset-dim="${preset}"]`);
        if (btn) {
          btn.click();
        } else {
          applyDimensionPreset(preset);
        }
      }
      if (kb) {
        const kbNum = parseInt(kb, 10);
        if (kbNum > 0) {
          targetMaxKB = kbNum;
          if (targetKbInput) targetKbInput.value = kbNum;
          if (targetKbSlider) targetKbSlider.value = kbNum;
          const kbBtn = document.querySelector(`[data-preset-kb="${kbNum}"]`);
          if (kbBtn) {
            document.querySelectorAll('[data-preset-kb]').forEach(b => b.classList.remove('active'));
            kbBtn.classList.add('active');
          }
        }
      }
      if (bg) {
        const bgBtn = document.querySelector(`[data-bg-color="${bg}"]`);
        if (bgBtn) bgBtn.click();
      }
      if (unit) {
        const uBtn = document.querySelector(`[data-unit="${unit}"]`);
        if (uBtn) uBtn.click();
      }
    } catch(e) {}
  }

  function setupEventListeners() {
    if (!dropZone || !fileInput) return;
    fileInput.addEventListener('click', (e) => { e.stopPropagation(); });

    const browseBtns = dropZone.querySelectorAll('button, #resizer-browse-btn, .btn');
    browseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    });

    dropZone.addEventListener('click', (e) => {
      if (e.target === fileInput) return;
      fileInput.click();
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        loadFiles(e.dataTransfer.files);
      }
    });

    window.handlePhotoResizerFiles = function(files) {
      if (files && files.length > 0) {
        loadFiles(files);
      }
    };

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        loadFiles(e.target.files);
      }
      setTimeout(() => { try { fileInput.value = ''; } catch(err) {} }, 250);
    });

    // Preset Dimension Buttons
    document.querySelectorAll('[data-preset-dim]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-preset-dim]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const dimStr = btn.getAttribute('data-preset-dim'); // e.g. "35x45mm", "2x2in", "50x50mm", "100x100mm", "600x600px"
        applyDimensionPreset(dimStr);
      });
    });

    // Unit Pills
    document.querySelectorAll('[data-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentUnit = btn.getAttribute('data-unit');
        if (unitLabelW) unitLabelW.textContent = currentUnit;
        if (unitLabelH) unitLabelH.textContent = currentUnit;
        processResize();
      });
    });

    // Preset KB Buttons
    document.querySelectorAll('[data-preset-kb]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-preset-kb]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const kb = parseInt(btn.getAttribute('data-preset-kb'), 10);
        targetMaxKB = kb;
        if (targetKbInput) targetKbInput.value = kb;
        if (targetKbSlider) targetKbSlider.value = kb;
        processResize();
      });
    });

    if (targetKbInput) {
      targetKbInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val > 0) {
          targetMaxKB = val;
          if (targetKbSlider) targetKbSlider.value = val;
          processResize();
        }
      });
    }

    if (targetKbSlider) {
      targetKbSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        targetMaxKB = val;
        if (targetKbInput) targetKbInput.value = val;
        processResize();
      });
    }

    if (inputWidth) {
      inputWidth.addEventListener('input', (e) => {
        targetWidth = parseFloat(e.target.value) || 1;
        if (lockAspectRatio && originalWidth && originalHeight) {
          targetHeight = parseFloat((targetWidth * (originalHeight / originalWidth)).toFixed(2));
          if (inputHeight) inputHeight.value = targetHeight;
        }
        processResize();
      });
    }

    if (inputHeight) {
      inputHeight.addEventListener('input', (e) => {
        targetHeight = parseFloat(e.target.value) || 1;
        if (lockAspectRatio && originalWidth && originalHeight) {
          targetWidth = parseFloat((targetHeight * (originalWidth / originalHeight)).toFixed(2));
          if (inputWidth) inputWidth.value = targetWidth;
        }
        processResize();
      });
    }

    if (lockAspectCheckbox) {
      lockAspectCheckbox.addEventListener('change', (e) => {
        lockAspectRatio = e.target.checked;
      });
    }

    if (dpiSelect) {
      dpiSelect.addEventListener('change', (e) => {
        targetDPI = parseInt(e.target.value, 10) || 300;
        processResize();
      });
    }

    // Background color pills
    document.querySelectorAll('[data-bg-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-bg-color]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        backgroundColor = btn.getAttribute('data-bg-color');
        processResize();
      });
    });

    // Format pills
    document.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-format]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        outputFormat = btn.getAttribute('data-format') === 'png'  ?  'image/png' : 'image/jpeg';
        processResize();
      });
    });

    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadResizedPhoto);
    }

    if (batchDownloadBtn) {
      batchDownloadBtn.addEventListener('click', downloadActivePhoto);
    }
  }

  async function loadFiles(fileList) {
    const rawFiles = Array.from(fileList).filter(f => f.type.startsWith('image/') || /\.(jpe-g|png|webp)$/i.test(f.name));
    if (rawFiles.length === 0) {
      if (window.UIUtils && UIUtils.showToast) {
        UIUtils.showToast('Please select valid JPG, PNG, or WebP photos.', 'warning');
      }
      return;
    }

    const promises = rawFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            resolve({
              file,
              dataUrl: e.target.result,
              img,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              sizeKB: (file.size / 1024).toFixed(1)
            });
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    loadedItems = await Promise.all(promises);
    if (loadedItems.length === 0) return;

    emptyState.style.display = 'none';
    workspace.style.display = 'block';

    setActiveIndex(0);
    renderBatchUI();

    // Default to standard 35x45 mm passport
    applyDimensionPreset('35x45mm');
  }

  function setActiveIndex(idx) {
    if (idx < 0 || idx >= loadedItems.length) return;
    activeIndex = idx;
    const item = loadedItems[activeIndex];
    originalFile = item.file;
    originalImg = item.img;
    originalWidth = item.width;
    originalHeight = item.height;
    originalSizeKB = item.sizeKB;

    origPreview.src = item.dataUrl;
    origInfo.textContent = `${originalWidth} × ${originalHeight} px • ${originalSizeKB} KB (${item.file.name})`;

    updateThumbnailActiveState();
    processResize();
  }

  function renderBatchUI() {
    if (loadedItems.length > 1) {
      batchPanel.style.display = 'block';
      batchTitle.textContent = `Batch Queue (${loadedItems.length} Photos)`;
      batchThumbnails.innerHTML = loadedItems.map((item, idx) => `
        <div class="batch-thumb-item ${idx === activeIndex  ?  'active' : ''}" data-idx="${idx}" style="cursor:pointer; flex-shrink:0; position:relative; border-radius:4px; overflow:hidden; border:2px solid ${idx === activeIndex  ?  'var(--primary)' : 'var(--line)'}; width:52px; height:52px;" title="${item.file.name}">
          <img src="${item.dataUrl}" style="width:100%; height:100%; object-fit:cover;">
          <span style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:1px 3px; font-weight:700;">${idx+1}</span>
        </div>
      `).join('');

      batchThumbnails.querySelectorAll('.batch-thumb-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-idx'), 10);
          setActiveIndex(idx);
        });
      });

      downloadBtn.innerHTML = `<span>⬇ Process & Download Batch (${loadedItems.length} Photos as ZIP)</span>`;
      if (batchDownloadBtn) {
        batchDownloadBtn.style.display = 'block';
        batchDownloadBtn.textContent = `⬇ Download Active Photo (#${activeIndex + 1}) Only`;
      }
    } else {
      batchPanel.style.display = 'none';
      downloadBtn.innerHTML = `<span>⬇ Download Resized Photo</span>`;
      if (batchDownloadBtn) batchDownloadBtn.style.display = 'none';
    }
  }

  function updateThumbnailActiveState() {
    if (batchThumbnails) {
      batchThumbnails.querySelectorAll('.batch-thumb-item').forEach(el => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        const isActive = idx === activeIndex;
        el.style.borderColor = isActive  ?  'var(--primary)' : 'var(--line)';
        el.classList.toggle('active', isActive);
      });
      if (batchDownloadBtn && loadedItems.length > 1) {
        batchDownloadBtn.textContent = `⬇ Download Active Photo (#${activeIndex + 1}) Only`;
      }
    }
  }

  function applyDimensionPreset(dimStr) {
    if (dimStr.endsWith('mm')) {
      currentUnit = 'mm';
      const parts = dimStr.replace('mm', '').split('x');
      targetWidth = parseFloat(parts[0]);
      targetHeight = parseFloat(parts[1]);
    } else if (dimStr.endsWith('in')) {
      currentUnit = 'inch';
      const parts = dimStr.replace('in', '').split('x');
      targetWidth = parseFloat(parts[0]);
      targetHeight = parseFloat(parts[1]);
    } else if (dimStr.endsWith('px')) {
      currentUnit = 'px';
      const parts = dimStr.replace('px', '').split('x');
      targetWidth = parseFloat(parts[0]);
      targetHeight = parseFloat(parts[1]);
    }

    if (inputWidth) inputWidth.value = targetWidth;
    if (inputHeight) inputHeight.value = targetHeight;
    if (unitLabelW) unitLabelW.textContent = currentUnit;
    if (unitLabelH) unitLabelH.textContent = currentUnit;

    processResize();
  }

  // Convert real-world units (mm, inch) to canvas pixel dimensions based on DPI
  function calculatePixelDimensions() {
    let pxW, pxH;
    if (currentUnit === 'mm') {
      pxW = Math.round((targetWidth / 25.4) * targetDPI);
      pxH = Math.round((targetHeight / 25.4) * targetDPI);
    } else if (currentUnit === 'cm') {
      pxW = Math.round((targetWidth / 2.54) * targetDPI);
      pxH = Math.round((targetHeight / 2.54) * targetDPI);
    } else if (currentUnit === 'inch') {
      pxW = Math.round(targetWidth * targetDPI);
      pxH = Math.round(targetHeight * targetDPI);
    } else {
      pxW = Math.round(targetWidth);
      pxH = Math.round(targetHeight);
    }
    return {
      w: Math.max(20, Math.min(6000, pxW)),
      h: Math.max(20, Math.min(6000, pxH))
    };
  }

  async function resizeSingleImage(item) {
    const { w: pxW, h: pxH } = calculatePixelDimensions();
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Background color replacement
    if (backgroundColor === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pxW, pxH);
    } else if (backgroundColor === 'light-blue') {
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(0, 0, pxW, pxH);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const srcW = item.width;
    const srcH = item.height;
    const targetAspect = pxW / pxH;
    const srcAspect = srcW / srcH;

    let sx = 0, sy = 0, sWidth = srcW, sHeight = srcH;
    if (srcAspect > targetAspect) {
      sWidth = srcH * targetAspect;
      sx = (srcW - sWidth) / 2;
    } else {
      sHeight = srcW / targetAspect;
      sy = (srcH - sHeight) / 2;
    }

    ctx.drawImage(item.img, sx, sy, sWidth, sHeight, 0, 0, pxW, pxH);

    const targetBytes = targetMaxKB * 1024;
    let quality = 0.92;
    let minQ = 0.05;
    let maxQ = 0.98;
    let bestBlob = null;

    if (outputFormat === 'image/png') {
      bestBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } else {
      for (let iter = 0; iter < 7; iter++) {
        quality = (minQ + maxQ) / 2;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        bestBlob = blob;

        if (blob.size > targetBytes) {
          maxQ = quality;
        } else {
          minQ = quality;
        }
      }
    }

    const ext = outputFormat === 'image/png'  ?  'png' : 'jpg';
    const baseName = item.file  ?  item.file.name.replace(/\.[^/.]+$/, '') : 'photo';
    const filename = `${baseName}_${targetWidth}x${targetHeight}${currentUnit}_${targetMaxKB}KB.${ext}`;

    return { blob: bestBlob, filename, pxW, pxH };
  }

  async function processResize() {
    if (!originalImg) return;

    const res = await resizeSingleImage({
      file: originalFile,
      img: originalImg,
      width: originalWidth,
      height: originalHeight
    });

    outputBlob = res.blob;
    outputDataUrl = URL.createObjectURL(res.blob);
    outputPreview.src = outputDataUrl;

    const finalSizeKB = (res.blob.size / 1024).toFixed(1);
    const badgeColor = parseFloat(finalSizeKB) <= targetMaxKB  ?  'var(--success)' : 'var(--danger)';

    outputInfo.innerHTML = `
      <strong>${targetWidth} × ${targetHeight} ${currentUnit}</strong> (${res.pxW} × ${res.pxH} px @ ${targetDPI} DPI)<br>
      <span style="color:${badgeColor}; font-weight:700;">File Size: ${finalSizeKB} KB</span> (Target: ≤ ${targetMaxKB} KB)
    `;

    if (window.UIUtils && UIUtils.renderQuickActions && outputInfo.parentElement) {
      UIUtils.renderQuickActions(outputInfo.parentElement, outputBlob, res.filename);
    }
  }

  function downloadActivePhoto() {
    if (!outputBlob) return;
    const ext = outputFormat === 'image/png'  ?  'png' : 'jpg';
    const baseName = originalFile  ?  originalFile.name.replace(/\.[^/.]+$/, '') : 'photo';
    const filename = `${baseName}_${targetWidth}x${targetHeight}${currentUnit}_${targetMaxKB}KB.${ext}`;

    if (window.UIUtils && UIUtils.downloadBlob) {
      UIUtils.downloadBlob(outputBlob, filename);
    } else {
      const a = document.createElement('a');
      a.href = outputDataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function downloadResizedPhoto() {
    if (loadedItems.length <= 1) {
      downloadActivePhoto();
      return;
    }

    try {
      downloadBtn.disabled = true;
      const originalText = downloadBtn.innerHTML;

      const ZipClass = (window.UIUtils && UIUtils.Zip) || window.MiniZip;
      if (!ZipClass) {
        throw new Error("In-memory ZIP generator not available.");
      }

      const zip = new ZipClass();

      for (let i = 0; i < loadedItems.length; i++) {
        downloadBtn.innerHTML = `<span>Processing photo ${i + 1}/${loadedItems.length} in RAM...</span>`;
        const res = await resizeSingleImage(loadedItems[i]);
        await zip.addBlob(res.filename, res.blob);
      }

      downloadBtn.innerHTML = `<span>Creating ZIP bundle...</span>`;
      const zipBlob = zip.generateBlob();
      const zipFilename = `localdoc-batch-resized-${targetWidth}x${targetHeight}${currentUnit}.zip`;

      if (window.UIUtils && UIUtils.downloadBlob) {
        UIUtils.downloadBlob(zipBlob, zipFilename);
        UIUtils.showToast(`Batch resizing complete! Saved ${loadedItems.length} photos in ZIP.`, 'success');
      } else {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      downloadBtn.innerHTML = originalText;
    } catch (err) {
      console.error('Batch resize error:', err);
      if (window.UIUtils && UIUtils.showToast) {
        UIUtils.showToast(err.message || 'Batch resize failed.', 'error');
      }
    } finally {
      downloadBtn.disabled = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
