/**
 * LocalDoc.org — Photo Resizer & Exact KB Reducer Engine (js/tools/photo-resizer.js)
 * 100% Client-Side In-Memory Execution. Zero Server Uploads.
 * Resize by mm, cm, inches, or pixels + compress to exact target file size in KB.
 */

(function() {
  'use strict';

  // State
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
        loadImageFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        loadImageFile(e.target.files[0]);
      }
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
        outputFormat = btn.getAttribute('data-format') === 'png' ? 'image/png' : 'image/jpeg';
        processResize();
      });
    });

    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadResizedPhoto);
    }
  }

  async function loadImageFile(file) {
    originalFile = file;
    originalSizeKB = (file.size / 1024).toFixed(1);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImg = img;
        originalWidth = img.naturalWidth || img.width;
        originalHeight = img.naturalHeight || img.height;

        // Display original info
        origPreview.src = e.target.result;
        origInfo.textContent = `${originalWidth} × ${originalHeight} px • ${originalSizeKB} KB`;

        emptyState.style.display = 'none';
        workspace.style.display = 'block';

        // Default to standard 35x45 mm passport
        applyDimensionPreset('35x45mm');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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

  async function processResize() {
    if (!originalImg) return;

    const { w: pxW, h: pxH } = calculatePixelDimensions();

    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Background color replacement (e.g. pure white or visa light blue)
    if (backgroundColor === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pxW, pxH);
    } else if (backgroundColor === 'light-blue') {
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(0, 0, pxW, pxH);
    }

    // High quality bicubic scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Center Crop to match target aspect ratio without distortion
    const srcW = originalWidth;
    const srcH = originalHeight;
    const targetAspect = pxW / pxH;
    const srcAspect = srcW / srcH;

    let sx = 0, sy = 0, sWidth = srcW, sHeight = srcH;
    if (srcAspect > targetAspect) {
      // Source is wider, crop horizontal margins
      sWidth = srcH * targetAspect;
      sx = (srcW - sWidth) / 2;
    } else {
      // Source is taller, crop vertical margins
      sHeight = srcW / targetAspect;
      sy = (srcH - sHeight) / 2;
    }

    ctx.drawImage(originalImg, sx, sy, sWidth, sHeight, 0, 0, pxW, pxH);

    // Iterative Precision Compression to hit target KB limit
    const targetBytes = targetMaxKB * 1024;
    let quality = 0.92;
    let minQ = 0.05;
    let maxQ = 0.98;
    let bestBlob = null;

    if (outputFormat === 'image/png') {
      bestBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } else {
      // Binary search quality for optimal sharpness strictly under targetBytes
      for (let iter = 0; iter < 7; iter++) {
        quality = (minQ + maxQ) / 2;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        bestBlob = blob;

        if (blob.size > targetBytes) {
          maxQ = quality; // too big, lower quality
        } else {
          minQ = quality; // fits, try pushing quality higher
        }
      }
    }

    outputBlob = bestBlob;
    outputDataUrl = URL.createObjectURL(bestBlob);
    outputPreview.src = outputDataUrl;

    const finalSizeKB = (bestBlob.size / 1024).toFixed(1);
    const badgeColor = parseFloat(finalSizeKB) <= targetMaxKB ? 'var(--success)' : 'var(--danger)';

    outputInfo.innerHTML = `
      <strong>${targetWidth} × ${targetHeight} ${currentUnit}</strong> (${pxW} × ${pxH} px @ ${targetDPI} DPI)<br>
      <span style="color:${badgeColor}; font-weight:700;">File Size: ${finalSizeKB} KB</span> (Target: ≤ ${targetMaxKB} KB)
    `;
  }

  function downloadResizedPhoto() {
    if (!outputBlob) return;
    const a = document.createElement('a');
    a.href = outputDataUrl;
    const baseName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, '') : 'photo';
    const ext = outputFormat === 'image/png' ? 'png' : 'jpg';
    a.download = `${baseName}_${targetWidth}x${targetHeight}${currentUnit}_${targetMaxKB}KB.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
