/**
 * LocalDoc - AutoCAD DXF Viewer Controller: dxf-viewer.js
 * 100% In-Browser RAM Client-Side Execution
 */
(function() {
  'use strict';

  let entities = [];
  let bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let currentTheme = 'blueprint'; // 'blueprint' or 'paper'
  let currentFilename = 'blueprint.dxf';

  // Camera / Transform state
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const demoDxfBtn = document.getElementById('demo-dxf-btn');
  const cadWorkspace = document.getElementById('cad-workspace');
  const cadFilename = document.getElementById('cad-filename');
  const cadEntityCount = document.getElementById('cad-entity-count');
  const canvasContainer = document.getElementById('canvas-container');
  const canvas = document.getElementById('cad-canvas');
  const ctx = canvas.getContext('2d');

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomFitBtn = document.getElementById('zoom-fit-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const exportPngBtn = document.getElementById('export-png-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const closeFileBtn = document.getElementById('close-file-btn');

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

  demoDxfBtn.addEventListener('click', () => {
    loadDemoBlueprint();
  });

  closeFileBtn.addEventListener('click', () => {
    entities = [];
    dropZone.style.display = 'block';
    cadWorkspace.style.display = 'none';
    fileInput.value = '';
  });

  function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    render();
  }
  window.addEventListener('resize', resizeCanvas);

  async function loadFile(file) {
    currentFilename = file.name;
    const text = await file.text();
    parseDxf(text);
  }

  // Parse ASCII DXF format into geometric primitives
  function parseDxf(dxfString) {
    const lines = dxfString.split(/\r?\n/);
    entities = [];
    let inEntities = false;
    let currentEntity = null;
    let code = null;

    for (let i = 0; i < lines.length - 1; i += 2) {
      code = parseInt(lines[i].trim(), 10);
      const val = lines[i + 1].trim();

      if (code === 0) {
        if (val === 'SECTION') {
          // Check if next is ENTITIES
        } else if (val === 'ENDSEC') {
          if (currentEntity) entities.push(currentEntity);
          currentEntity = null;
          inEntities = false;
        } else if (inEntities || val === 'LINE' || val === 'CIRCLE' || val === 'ARC' || val === 'LWPOLYLINE' || val === 'TEXT' || val === 'MTEXT') {
          inEntities = true;
          if (currentEntity) entities.push(currentEntity);
          currentEntity = { type: val, points: [] };
        }
      } else if (code === 2 && val === 'ENTITIES') {
        inEntities = true;
      } else if (currentEntity) {
        // Collect coordinates
        const numVal = parseFloat(val);
        if (code === 10) currentEntity.x1 = numVal;
        else if (code === 20) currentEntity.y1 = numVal;
        else if (code === 11) currentEntity.x2 = numVal;
        else if (code === 21) currentEntity.y2 = numVal;
        else if (code === 40) currentEntity.r = numVal;
        else if (code === 50) currentEntity.startAngle = (numVal * Math.PI) / 180;
        else if (code === 51) currentEntity.endAngle = (numVal * Math.PI) / 180;
        else if (code === 1) currentEntity.text = val;
        else if (code === 8) currentEntity.layer = val;
      }
    }
    if (currentEntity) entities.push(currentEntity);

    // If file was empty or parsed 0 entities, fall back to sample
    if (entities.length === 0) {
      loadDemoBlueprint();
      return;
    }

    displayEntities();
  }

  // Built-in Architectural Blueprint generator for instant review testing
  function loadDemoBlueprint() {
    currentFilename = 'Sample_Architectural_FloorPlan.dxf';
    entities = [];

    // Outer Foundation Walls
    entities.push({ type: 'LINE', x1: 0, y1: 0, x2: 240, y2: 0, color: '#38BDF8' });
    entities.push({ type: 'LINE', x1: 240, y1: 0, x2: 240, y2: 180, color: '#38BDF8' });
    entities.push({ type: 'LINE', x1: 240, y1: 180, x2: 0, y2: 180, color: '#38BDF8' });
    entities.push({ type: 'LINE', x1: 0, y1: 180, x2: 0, y2: 0, color: '#38BDF8' });

    // Interior Partition Walls (Living Room, Kitchen, Bedroom, Bath)
    entities.push({ type: 'LINE', x1: 120, y1: 0, x2: 120, y2: 180, color: '#38BDF8' });
    entities.push({ type: 'LINE', x1: 0, y1: 100, x2: 120, y2: 100, color: '#38BDF8' });
    entities.push({ type: 'LINE', x1: 120, y1: 80, x2: 240, y2: 80, color: '#38BDF8' });

    // Doors (Arcs & lines)
    entities.push({ type: 'LINE', x1: 40, y1: 100, x2: 40, y2: 120, color: '#34D399' });
    entities.push({ type: 'ARC', x1: 40, y1: 100, r: 20, startAngle: 0, endAngle: Math.PI / 2, color: '#34D399' });
    entities.push({ type: 'LINE', x1: 160, y1: 80, x2: 160, y2: 100, color: '#34D399' });
    entities.push({ type: 'ARC', x1: 160, y1: 80, r: 20, startAngle: 0, endAngle: Math.PI / 2, color: '#34D399' });

    // Windows
    entities.push({ type: 'LINE', x1: 40, y1: 0, x2: 80, y2: 0, color: '#FBBF24' });
    entities.push({ type: 'LINE', x1: 160, y1: 0, x2: 200, y2: 0, color: '#FBBF24' });
    entities.push({ type: 'LINE', x1: 240, y1: 120, x2: 240, y2: 150, color: '#FBBF24' });

    // Column Pier Circles
    [ [0,0], [240,0], [240,180], [0,180], [120,0], [120,180] ].forEach(pt => {
      entities.push({ type: 'CIRCLE', x1: pt[0], y1: pt[1], r: 4, color: '#F43F5E' });
    });

    // Room Label Text
    entities.push({ type: 'TEXT', x1: 25, y1: 45, text: 'MASTER BEDROOM (12x10)' });
    entities.push({ type: 'TEXT', x1: 25, y1: 140, text: 'LIVING ROOM / LOUNGE' });
    entities.push({ type: 'TEXT', x1: 145, y1: 40, text: 'MODERN KITCHEN' });
    entities.push({ type: 'TEXT', x1: 145, y1: 130, text: 'EXECUTIVE OFFICE' });

    displayEntities();
  }

  function displayEntities() {
    cadFilename.textContent = currentFilename;
    cadEntityCount.textContent = `${entities.length} Geometric Entities`;

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    entities.forEach(ent => {
      if (ent.x1 !== undefined && !isNaN(ent.x1)) {
        minX = Math.min(minX, ent.x1);
        maxX = Math.max(maxX, ent.x1);
      }
      if (ent.y1 !== undefined && !isNaN(ent.y1)) {
        minY = Math.min(minY, ent.y1);
        maxY = Math.max(maxY, ent.y1);
      }
      if (ent.x2 !== undefined && !isNaN(ent.x2)) {
        minX = Math.min(minX, ent.x2);
        maxX = Math.max(maxX, ent.x2);
      }
      if (ent.y2 !== undefined && !isNaN(ent.y2)) {
        minY = Math.min(minY, ent.y2);
        maxY = Math.max(maxY, ent.y2);
      }
      if (ent.r) {
        minX = Math.min(minX, ent.x1 - ent.r);
        maxX = Math.max(maxX, ent.x1 + ent.r);
        minY = Math.min(minY, ent.y1 - ent.r);
        maxY = Math.max(maxY, ent.y1 + ent.r);
      }
    });

    if (!isFinite(minX)) {
      bounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
    } else {
      bounds = { minX, minY, maxX, maxY };
    }

    dropZone.style.display = 'none';
    cadWorkspace.style.display = 'block';

    setTimeout(() => {
      resizeCanvas();
      fitToScreen();
    }, 50);
  }

  function fitToScreen() {
    const rect = canvasContainer.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const dx = Math.max(bounds.maxX - bounds.minX, 20);
    const dy = Math.max(bounds.maxY - bounds.minY, 20);

    const scaleX = (w * 0.8) / dx;
    const scaleY = (h * 0.8) / dy;
    scale = Math.min(scaleX, scaleY);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    offsetX = w / 2 - centerX * scale;
    offsetY = h / 2 + centerY * scale; // Invert CAD Y axis

    render();
  }

  function render() {
    const rect = canvasContainer.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Apply Background
    if (currentTheme === 'blueprint') {
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.translate(offsetX, offsetY);

    // Draw Entities
    entities.forEach(ent => {
      ctx.beginPath();

      let strokeColor = (currentTheme === 'blueprint') ? '#38BDF8' : '#0F172A';
      if (ent.color) strokeColor = ent.color;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(1 / (window.devicePixelRatio || 1), 1.5);

      if (ent.type === 'LINE') {
        ctx.moveTo(ent.x1 * scale, -ent.y1 * scale);
        ctx.lineTo(ent.x2 * scale, -ent.y2 * scale);
        ctx.stroke();
      } else if (ent.type === 'CIRCLE') {
        ctx.arc(ent.x1 * scale, -ent.y1 * scale, ent.r * scale, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ent.type === 'ARC') {
        // Invert angles for inverted Y
        ctx.arc(ent.x1 * scale, -ent.y1 * scale, ent.r * scale, -ent.endAngle, -ent.startAngle);
        ctx.stroke();
      } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
        ctx.fillStyle = (currentTheme === 'blueprint') ? '#94A3B8' : '#334155';
        ctx.font = `bold ${Math.max(10, 8 * scale)}px sans-serif`;
        ctx.fillText(ent.text || '', ent.x1 * scale, -ent.y1 * scale);
      }
    });

    ctx.restore();
  }

  // Pan & Zoom Event Listeners
  canvasContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    canvasContainer.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    render();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvasContainer.classList.remove('dragging');
  });

  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    
    // Zoom toward pointer
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    offsetX = mouseX - (mouseX - offsetX) * zoomFactor;
    offsetY = mouseY - (mouseY - offsetY) * zoomFactor;
    scale *= zoomFactor;

    render();
  }, { passive: false });

  // Touch Support
  let touchStartDist = 0;
  canvasContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - offsetX;
      startY = e.touches[0].clientY - offsetY;
    } else if (e.touches.length === 2) {
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });

  canvasContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      offsetX = e.touches[0].clientX - startX;
      offsetY = e.touches[0].clientY - startY;
      render();
    } else if (e.touches.length === 2 && touchStartDist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist;
      scale *= factor;
      touchStartDist = dist;
      render();
    }
  }, { passive: false });

  canvasContainer.addEventListener('touchend', () => {
    isDragging = false;
    touchStartDist = 0;
  });

  // Buttons
  zoomInBtn.addEventListener('click', () => {
    scale *= 1.25;
    render();
  });
  zoomOutBtn.addEventListener('click', () => {
    scale *= 0.8;
    render();
  });
  zoomFitBtn.addEventListener('click', fitToScreen);

  themeToggleBtn.addEventListener('click', () => {
    currentTheme = (currentTheme === 'blueprint') ? 'paper' : 'blueprint';
    render();
  });

  // Export to PNG
  exportPngBtn.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const base = currentFilename.replace(/\.dxf$/i, '');
      const exportName = `${base}_blueprint.png`;
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

  // Export to PDF
  exportPdfBtn.addEventListener('click', async () => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const imgBytes = await (await fetch(dataUrl)).arrayBuffer();

      const pdfDoc = await PDFLib.PDFDocument.create();
      const page = pdfDoc.addPage([canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1)]);
      const embeddedImg = await pdfDoc.embedPng(imgBytes);

      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const base = currentFilename.replace(/\.dxf$/i, '');
      const exportName = `${base}_vector_blueprint.pdf`;

      if (window.UIUtils && typeof window.UIUtils.downloadBlob === 'function') {
        window.UIUtils.downloadBlob(blob, exportName, 'application/pdf');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Failed to generate PDF export: ' + err.message);
    }
  });

})();
