/**
 * LocalDoc.org — PDF to PowerPoint (.pptx) In-Memory Generator
 * Converts PDF pages into genuine Microsoft PowerPoint (.pptx) presentations in client RAM.
 * 100% In-Browser Execution. Zero Server Uploads.
 */

(function() {
  'use strict';

  // Ensure MiniZip is available
  class LocalZip {
    constructor() {
      this.files = [];
    }
    addFile(filename, content) {
      let bytes;
      if (typeof content === 'string') {
        bytes = new TextEncoder().encode(content);
      } else if (content instanceof Uint8Array) {
        bytes = content;
      } else if (content instanceof ArrayBuffer) {
        bytes = new Uint8Array(content);
      } else {
        bytes = new Uint8Array(0);
      }
      this.files.push({ name: filename, data: bytes });
    }
    generateBlob(mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const parts = [];
      const cdEntries = [];
      let offset = 0;

      for (const file of this.files) {
        const nameBytes = new TextEncoder().encode(file.name);
        const dataBytes = file.data;
        const crc = this.crc32(dataBytes);
        const size = dataBytes.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);
        const v = new DataView(localHeader.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 0, true);
        v.setUint16(8, 0, true);
        v.setUint16(10, 0, true);
        v.setUint16(12, 0, true);
        v.setUint32(14, crc, true);
        v.setUint32(18, size, true);
        v.setUint32(22, size, true);
        v.setUint16(26, nameBytes.length, true);
        v.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        parts.push(localHeader);
        parts.push(dataBytes);

        const cdHeader = new Uint8Array(46 + nameBytes.length);
        const cdv = new DataView(cdHeader.buffer);
        cdv.setUint32(0, 0x02014b50, true);
        cdv.setUint16(4, 20, true);
        cdv.setUint16(6, 20, true);
        cdv.setUint16(8, 0, true);
        cdv.setUint16(10, 0, true);
        cdv.setUint16(12, 0, true);
        cdv.setUint16(14, 0, true);
        cdv.setUint32(16, crc, true);
        cdv.setUint32(20, size, true);
        cdv.setUint32(24, size, true);
        cdv.setUint16(28, nameBytes.length, true);
        cdv.setUint16(30, 0, true);
        cdv.setUint16(32, 0, true);
        cdv.setUint16(34, 0, true);
        cdv.setUint16(36, 0, true);
        cdv.setUint32(38, 0, true);
        cdv.setUint32(42, offset, true);
        cdHeader.set(nameBytes, 46);

        cdEntries.push(cdHeader);
        offset += localHeader.length + dataBytes.length;
      }

      const cdOffset = offset;
      let cdSize = 0;
      for (const cd of cdEntries) {
        parts.push(cd);
        cdSize += cd.length;
      }

      const eocd = new Uint8Array(22);
      const eocdv = new DataView(eocd.buffer);
      eocdv.setUint32(0, 0x06054b50, true);
      eocdv.setUint16(4, 0, true);
      eocdv.setUint16(6, 0, true);
      eocdv.setUint16(8, this.files.length, true);
      eocdv.setUint16(10, this.files.length, true);
      eocdv.setUint32(12, cdSize, true);
      eocdv.setUint32(16, cdOffset, true);
      eocdv.setUint16(20, 0, true);

      parts.push(eocd);
      return new Blob(parts, { type: mimeType });
    }
    crc32(bytes) {
      if (!LocalZip.CRC_TABLE) {
        LocalZip.CRC_TABLE = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
          }
          LocalZip.CRC_TABLE[i] = c >>> 0;
        }
      }
      let crc = -1;
      for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ LocalZip.CRC_TABLE[(crc ^ bytes[i]) & 0xff];
      }
      return (crc ^ (-1)) >>> 0;
    }
  }

  // State
  let currentFile = null;
  let pdfDoc = null;
  let totalPages = 0;
  let convertedBlob = null;
  let slideAspect = '16:9'; // '16:9', '4:3'

  // DOM Elements
  const dropZone = document.getElementById('pptx-drop-zone');
  const fileInput = document.getElementById('pptx-file-input');
  const emptyState = document.getElementById('pptx-empty-state');
  const activeState = document.getElementById('pptx-active-state');
  const progressState = document.getElementById('pptx-progress-state');
  const resultState = document.getElementById('pptx-result-state');

  const fileTitle = document.getElementById('pptx-file-title');
  const fileMeta = document.getElementById('pptx-file-meta');
  const slidesGrid = document.getElementById('pptx-slides-grid');
  const convertBtn = document.getElementById('pptx-convert-btn');
  const downloadBtn = document.getElementById('pptx-download-btn');
  const progressBar = document.getElementById('pptx-progress-bar');
  const progressText = document.getElementById('pptx-progress-text');
  const resultMeta = document.getElementById('pptx-result-meta');

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
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    // Aspect Ratio options
    document.querySelectorAll('[data-slide-aspect]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-slide-aspect]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        slideAspect = btn.getAttribute('data-slide-aspect');
      });
    });

    if (convertBtn) {
      convertBtn.addEventListener('click', startConversion);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadPresentation);
    }
  }

  async function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
      return;
    }

    currentFile = file;
    const arrayBuffer = await file.arrayBuffer();

    try {
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      totalPages = pdfDoc.numPages;

      fileTitle.textContent = file.name;
      fileMeta.textContent = `${totalPages} Pages • ${(file.size / 1024 / 1024).toFixed(2)} MB • Ready for Conversion`;

      emptyState.style.display = 'none';
      progressState.style.display = 'none';
      resultState.style.display = 'none';
      activeState.style.display = 'block';

      renderSlidePreviews();
    } catch (err) {
      console.error('PDF Load Error:', err);
      alert('Could not open PDF file. It might be password protected or corrupted.');
    }
  }

  async function renderSlidePreviews() {
    slidesGrid.innerHTML = '';
    const maxPreviews = Math.min(totalPages, 8);

    for (let i = 1; i <= maxPreviews; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.35 });

      const card = document.createElement('div');
      card.style.cssText = 'background:var(--bg-surface); border:1px solid var(--line); border-radius:6px; padding:8px; text-align:center; box-shadow:var(--shadow-sm);';

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.cssText = 'max-width:100%; height:auto; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.1);';

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-top:6px;';
      label.textContent = `Slide ${i}`;

      card.appendChild(canvas);
      card.appendChild(label);
      slidesGrid.appendChild(card);
    }

    if (totalPages > maxPreviews) {
      const moreCard = document.createElement('div');
      moreCard.style.cssText = 'display:flex; align-items:center; justify-content:center; background:var(--bg-body); border:1px dashed var(--line); border-radius:6px; padding:16px; font-size:0.85rem; font-weight:700; color:var(--text-secondary);';
      moreCard.textContent = `+ ${totalPages - maxPreviews} more slides`;
      slidesGrid.appendChild(moreCard);
    }
  }

  async function startConversion() {
    activeState.style.display = 'none';
    progressState.style.display = 'block';
    resultState.style.display = 'none';

    const zip = new LocalZip();

    // 1. Content Types XML
    let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`;

    for (let i = 1; i <= totalPages; i++) {
      contentTypesXml += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
    contentTypesXml += `\n</Types>`;
    zip.addFile('[Content_Types].xml', contentTypesXml);

    // 2. Top-level Relationships (_rels/.rels)
    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
    zip.addFile('_rels/.rels', rootRelsXml);

    // 3. Presentation XML & its rels
    // Dimensions in EMUs: 16:9 = 12192000 x 6858000, 4:3 = 9144000 x 6858000
    const slideW = slideAspect === '4:3' ? 9144000 : 12192000;
    const slideH = 6858000;

    let sldIdLst = '';
    let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;

    for (let i = 1; i <= totalPages; i++) {
      sldIdLst += `\n    <p:sldId id="${255 + i}" r:id="rId${i}"/>`;
      presRelsXml += `\n  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
    }
    presRelsXml += `\n</Relationships>`;
    zip.addFile('ppt/_rels/presentation.xml.rels', presRelsXml);

    const presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="${slideW}" cy="${slideH}" type="${slideAspect === '4:3' ? 'screen4x3' : 'screen16x9'}"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
    zip.addFile('ppt/presentation.xml', presXml);

    // 4. Render each PDF page to PNG and embed in slide{i}.xml
    for (let i = 1; i <= totalPages; i++) {
      const pct = Math.round(((i - 0.5) / totalPages) * 100);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `Rendering slide ${i} of ${totalPages} (${pct}%)...`;

      const page = await pdfDoc.getPage(i);
      // High-res render (scale 2.0 = ~150-200 DPI crisp presentation quality)
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert canvas to PNG Uint8Array
      const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const pngBuffer = await pngBlob.arrayBuffer();
      const pngBytes = new Uint8Array(pngBuffer);

      // Add image to ppt/media/image{i}.png
      zip.addFile(`ppt/media/image${i}.png`, pngBytes);

      // Slide rels
      const slideRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i}.png"/>
</Relationships>`;
      zip.addFile(`ppt/slides/_rels/slide${i}.xml.rels`, slideRelXml);

      // Calculate picture size to fit slide preserving aspect ratio
      const imgAspect = canvas.width / canvas.height;
      const targetAspect = slideW / slideH;
      let picW = slideW;
      let picH = slideH;
      let picX = 0;
      let picY = 0;

      if (imgAspect > targetAspect) {
        picW = slideW;
        picH = Math.round(slideW / imgAspect);
        picY = Math.round((slideH - picH) / 2);
      } else {
        picH = slideH;
        picW = Math.round(slideH * imgAspect);
        picX = Math.round((slideW - picW) / 2);
      }

      // Slide XML
      const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Slide Image ${i}"/>
          <p:cNvPicPr>
            <a:picLocks noChangeAspect="1"/>
          </p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${picX}" y="${picY}"/>
            <a:ext cx="${picW}" cy="${picH}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
      zip.addFile(`ppt/slides/slide${i}.xml`, slideXml);
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Generating OpenXML .pptx presentation...';

    convertedBlob = zip.generateBlob('application/vnd.openxmlformats-officedocument.presentationml.presentation');

    progressState.style.display = 'none';
    resultState.style.display = 'block';

    const pptxSizeMB = (convertedBlob.size / 1024 / 1024).toFixed(2);
    resultMeta.textContent = `${totalPages} Slides • ${pptxSizeMB} MB PowerPoint Presentation (.pptx) • Native OpenXML`;
  }

  function downloadPresentation() {
    if (!convertedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(convertedBlob);
    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'presentation';
    a.download = `${baseName}.pptx`;
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
