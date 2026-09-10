/**
 * LocalDoc - Compare PDFs Controller: compare-pdf.js
 * 100% In-Browser RAM Client-Side Execution
 */
(function() {
  'use strict';

  let pdfDocA = null;
  let pdfDocB = null;
  let fileA = null;
  let fileB = null;
  let currentPage = 1;
  let totalPages = 1;
  let currentMode = 'diff'; // 'diff' or 'side'

  const setupSection = document.getElementById('setup-section');
  const boxA = document.getElementById('box-a');
  const boxB = document.getElementById('box-b');
  const labelA = document.getElementById('label-a');
  const labelB = document.getElementById('label-b');
  const btnFileA = document.getElementById('btn-file-a');
  const btnFileB = document.getElementById('btn-file-b');
  const inputFileA = document.getElementById('input-file-a');
  const inputFileB = document.getElementById('input-file-b');

  const compareStudio = document.getElementById('compare-studio');
  const viewTabs = document.querySelectorAll('.view-tab-btn');
  const diffLegend = document.getElementById('diff-legend');
  const diffViewWrap = document.getElementById('diff-view-wrap');
  const sideViewWrap = document.getElementById('side-view-wrap');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const downloadDiffBtn = document.getElementById('download-diff-btn');
  const resetCompareBtn = document.getElementById('reset-compare-btn');

  const diffCanvas = document.getElementById('diff-canvas');
  const canvasA = document.getElementById('canvas-a');
  const canvasB = document.getElementById('canvas-b');

  btnFileA.addEventListener('click', () => inputFileA.click());
  btnFileB.addEventListener('click', () => inputFileB.click());

  inputFileA.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await loadDocA(e.target.files[0]);
    }
  });

  inputFileB.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await loadDocB(e.target.files[0]);
    }
  });

  async function loadDocA(file) {
    fileA = file;
    labelA.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    boxA.classList.add('has-file');
    btnFileA.textContent = 'Change Document A';

    const buffer = await file.arrayBuffer();
    pdfDocA = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    checkBothReady();
  }

  async function loadDocB(file) {
    fileB = file;
    labelB.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    boxB.classList.add('has-file');
    btnFileB.textContent = 'Change Document B';

    const buffer = await file.arrayBuffer();
    pdfDocB = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    checkBothReady();
  }

  function checkBothReady() {
    if (pdfDocA && pdfDocB) {
      totalPages = Math.max(pdfDocA.numPages, pdfDocB.numPages);
      currentPage = 1;
      setupSection.style.display = 'none';
      compareStudio.style.display = 'block';
      renderCurrentPage();
    }
  }

  // View Mode Tabs
  viewTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      viewTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.getAttribute('data-mode');

      if (currentMode === 'diff') {
        diffViewWrap.style.display = 'block';
        diffLegend.style.display = 'flex';
        sideViewWrap.style.display = 'none';
      } else {
        diffViewWrap.style.display = 'none';
        diffLegend.style.display = 'none';
        sideViewWrap.style.display = 'grid';
      }
    });
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
    }
  });

  resetCompareBtn.addEventListener('click', () => {
    pdfDocA = null;
    pdfDocB = null;
    fileA = null;
    fileB = null;
    boxA.classList.remove('has-file');
    boxB.classList.remove('has-file');
    labelA.textContent = 'Select original version';
    labelB.textContent = 'Select modified revision';
    btnFileA.textContent = 'Select Document A';
    btnFileB.textContent = 'Select Document B';
    inputFileA.value = '';
    inputFileB.value = '';
    compareStudio.style.display = 'none';
    setupSection.style.display = 'grid';
  });

  async function renderCurrentPage() {
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = (currentPage === 1);
    nextPageBtn.disabled = (currentPage === totalPages);

    const scale = 1.4;

    // Render Page A
    let viewportA = null;
    if (currentPage <= pdfDocA.numPages) {
      const pageA = await pdfDocA.getPage(currentPage);
      viewportA = pageA.getViewport({ scale });
      canvasA.width = viewportA.width;
      canvasA.height = viewportA.height;
      const ctxA = canvasA.getContext('2d');
      await pageA.render({ canvasContext: ctxA, viewport: viewportA }).promise;
    } else {
      canvasA.width = 600;
      canvasA.height = 800;
      const ctxA = canvasA.getContext('2d');
      ctxA.fillStyle = '#F8FAFC';
      ctxA.fillRect(0, 0, 600, 800);
      ctxA.fillStyle = '#94A3B8';
      ctxA.font = 'bold 16px sans-serif';
      ctxA.fillText('(No Page in Doc A)', 220, 400);
    }

    // Render Page B
    let viewportB = null;
    if (currentPage <= pdfDocB.numPages) {
      const pageB = await pdfDocB.getPage(currentPage);
      viewportB = pageB.getViewport({ scale });
      canvasB.width = viewportB.width;
      canvasB.height = viewportB.height;
      const ctxB = canvasB.getContext('2d');
      await pageB.render({ canvasContext: ctxB, viewport: viewportB }).promise;
    } else {
      canvasB.width = 600;
      canvasB.height = 800;
      const ctxB = canvasB.getContext('2d');
      ctxB.fillStyle = '#F8FAFC';
      ctxB.fillRect(0, 0, 600, 800);
      ctxB.fillStyle = '#94A3B8';
      ctxB.font = 'bold 16px sans-serif';
      ctxB.fillText('(No Page in Doc B)', 220, 400);
    }

    // Generate Visual Diff
    computeVisualDiff();
  }

  function computeVisualDiff() {
    const w = Math.max(canvasA.width, canvasB.width);
    const h = Math.max(canvasA.height, canvasB.height);

    diffCanvas.width = w;
    diffCanvas.height = h;
    const diffCtx = diffCanvas.getContext('2d');

    const ctxA = canvasA.getContext('2d');
    const ctxB = canvasB.getContext('2d');

    const imgDataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height);
    const imgDataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height);
    const diffImgData = diffCtx.createImageData(w, h);

    const dataA = imgDataA.data;
    const dataB = imgDataB.data;
    const dataDiff = diffImgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const diffIdx = (y * w + x) * 4;

        let rA = 255, gA = 255, bA = 255;
        if (x < canvasA.width && y < canvasA.height) {
          const idxA = (y * canvasA.width + x) * 4;
          rA = dataA[idxA];
          gA = dataA[idxA + 1];
          bA = dataA[idxA + 2];
        }

        let rB = 255, gB = 255, bB = 255;
        if (x < canvasB.width && y < canvasB.height) {
          const idxB = (y * canvasB.width + x) * 4;
          rB = dataB[idxB];
          gB = dataB[idxB + 1];
          bB = dataB[idxB + 2];
        }

        const lumA = (rA * 0.299 + gA * 0.587 + bA * 0.114);
        const lumB = (rB * 0.299 + gB * 0.587 + bB * 0.114);
        const diff = lumA - lumB;

        if (diff > 25) {
          // Darker in B -> Added content in B (Green #059669)
          dataDiff[diffIdx] = 5;
          dataDiff[diffIdx + 1] = 150;
          dataDiff[diffIdx + 2] = 105;
          dataDiff[diffIdx + 3] = 255;
        } else if (diff < -25) {
          // Darker in A -> Removed content from B (Red #E11D48)
          dataDiff[diffIdx] = 225;
          dataDiff[diffIdx + 1] = 29;
          dataDiff[diffIdx + 2] = 72;
          dataDiff[diffIdx + 3] = 255;
        } else {
          // Matching background/text
          dataDiff[diffIdx] = Math.min(245, lumA);
          dataDiff[diffIdx + 1] = Math.min(245, lumA);
          dataDiff[diffIdx + 2] = Math.min(245, lumA);
          dataDiff[diffIdx + 3] = 255;
        }
      }
    }

    diffCtx.putImageData(diffImgData, 0, 0);
  }

  // Download Diff Snapshot
  downloadDiffBtn.addEventListener('click', () => {
    diffCanvas.toBlob((blob) => {
      if (!blob) return;
      const exportName = `PDF_Diff_Page_${currentPage}.png`;
      if (window.UIUtils && typeof window.UIUtils.downloadBlob === 'function') {
        window.UIUtils.downloadBlob(blob, exportName, 'image/png');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportName;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  });

})();
