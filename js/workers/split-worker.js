/**
 * localdoc.org — Split PDF Web Worker (js/workers/split-worker.js)
 * 100% Client-Side In-Worker Execution — Zero UI Freezing — Pure RAM
 */

/* global importScripts, PDFLib */

try {
  importScripts('../lib/pdf-lib.min.js');
} catch (e) {
  try {
    importScripts('/js/lib/pdf-lib.min.js');
  } catch (e2) {
    console.warn('split-worker: failed to load pdf-lib via importScripts', e2);
  }
}

// In-Worker Fast PKZIP Generator
class WorkerZip {
  constructor() {
    this.files = [];
  }

  static createZip(fileArray) {
    const zip = new WorkerZip();
    for (const item of fileArray) {
      zip.addFile(item.filename || item.name, item.bytes || item.data);
    }
    return zip.generateUint8Array();
  }

  addFile(filename, content) {
    let bytes;
    if (typeof content === 'string') {
      bytes = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      bytes = content;
    } else if (content instanceof ArrayBuffer) {
      bytes = new Uint8Array(content);
    } else if (content && content.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      bytes = new Uint8Array(0);
    }
    this.files.push({ name: filename, data: bytes });
  }

  generateUint8Array() {
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

    let totalLength = 0;
    for (const p of parts) totalLength += p.length;
    const finalBuffer = new Uint8Array(totalLength);
    let cur = 0;
    for (const p of parts) {
      finalBuffer.set(p, cur);
      cur += p.length;
    }
    return finalBuffer;
  }

  crc32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ WorkerZip.crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }
}

WorkerZip.crcTable = (() => {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
})();

self.onmessage = async function(e) {
  const msg = e.data || {};
  const { action, id, payload } = msg;

  function postProgress(pct, status) {
    self.postMessage({ type: 'PROGRESS', id, pct, status });
  }

  try {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDFLib is not loaded in worker environment.');
    }

    // ACTION: EXTRACT SELECTED PAGES (Single PDF)
    if (action === 'EXTRACT') {
      const { buffer, targetPages, baseName } = payload;
      postProgress(15, 'Loading PDF document into memory worker...');
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
      const totalPages = srcDoc.getPageCount();

      const sortedPages = Array.from(new Set(targetPages))
        .map(p => parseInt(p, 10))
        .filter(p => !isNaN(p) && p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);

      if (sortedPages.length === 0) {
        throw new Error('Please select at least 1 valid page to extract.');
      }

      postProgress(45, `Copying ${sortedPages.length} selected pages...`);
      const newDoc = await PDFLib.PDFDocument.create();
      const pageIndices = sortedPages.map(p => p - 1);
      
      // Copy in safe chunks of 25 to preserve memory
      for (let i = 0; i < pageIndices.length; i += 25) {
        const slice = pageIndices.slice(i, i + 25);
        const copied = await newDoc.copyPages(srcDoc, slice);
        copied.forEach(p => newDoc.addPage(p));
        const subPct = 45 + Math.round(((i + slice.length) / pageIndices.length) * 40);
        postProgress(subPct, `Extracted ${i + slice.length} of ${pageIndices.length} pages...`);
      }

      postProgress(90, 'Serializing extracted PDF in RAM...');
      const pdfBytes = await newDoc.save({ useObjectStreams: true });
      const filename = `${baseName || 'document'}-extracted-${sortedPages.length}pages.pdf`;

      self.postMessage({
        type: 'SUCCESS',
        id,
        result: {
          pdfBytes: pdfBytes.buffer,
          filename,
          totalPages,
          extractedCount: sortedPages.length,
          selectedPages: sortedPages
        }
      }, [pdfBytes.buffer]);
      return;
    }

    // ACTION: BURST INDIVIDUAL PAGES TO ZIP
    if (action === 'BURST_ZIP') {
      const { buffer, targetPages, baseName } = payload;
      postProgress(10, 'Reading pages for ZIP bursting...');
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
      const totalPages = srcDoc.getPageCount();

      let pagesToExtract = [];
      if (Array.isArray(targetPages) && targetPages.length > 0) {
        pagesToExtract = targetPages
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p) && p >= 1 && p <= totalPages)
          .sort((a, b) => a - b);
      } else {
        for (let i = 1; i <= totalPages; i++) pagesToExtract.push(i);
      }

      if (pagesToExtract.length === 0) {
        throw new Error('Please select at least 1 valid page to split.');
      }

      const files = [];
      const zipItems = [];

      for (let idx = 0; idx < pagesToExtract.length; idx++) {
        const pageNum = pagesToExtract[idx];
        const pct = 15 + Math.round(((idx + 1) / pagesToExtract.length) * 70);
        postProgress(pct, `Generating single-page PDF ${idx + 1} of ${pagesToExtract.length} (Page ${pageNum})...`);

        const singleDoc = await PDFLib.PDFDocument.create();
        const [copied] = await singleDoc.copyPages(srcDoc, [pageNum - 1]);
        singleDoc.addPage(copied);

        const singleBytes = await singleDoc.save({ useObjectStreams: true });
        const fname = `${baseName || 'document'}-page-${pageNum}.pdf`;

        zipItems.push({ filename: fname, bytes: singleBytes });
        files.push({
          pageNumber: pageNum,
          filename: fname,
          bytes: singleBytes.buffer,
          size: singleBytes.byteLength
        });
      }

      postProgress(90, 'Bundling all individual PDFs into 1-click ZIP archive...');
      const zipBytes = WorkerZip.createZip(zipItems);
      const zipFilename = `${baseName || 'document'}-individual-pages.zip`;

      const transferBuffers = [zipBytes.buffer];
      files.forEach(f => transferBuffers.push(f.bytes));

      self.postMessage({
        type: 'SUCCESS',
        id,
        result: {
          zipBytes: zipBytes.buffer,
          filename: zipFilename,
          files,
          totalPages,
          totalExtracted: files.length
        }
      }, transferBuffers);
      return;
    }

    // ACTION: SPLIT BY TARGET SIZE (Email Chunks < X MB)
    if (action === 'SPLIT_BY_SIZE') {
      const { buffer, maxBytes, baseName } = payload;
      postProgress(10, 'Analyzing page structure and byte distribution...');
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
      const totalPages = srcDoc.getPageCount();

      const maxLimit = Math.max(1024, parseInt(maxBytes, 10) || (10 * 1024 * 1024));

      // Measure/estimate pages and partition into sequential chunks
      const chunks = [];
      let currentChunkPages = [];

      for (let p = 1; p <= totalPages; p++) {
        const pct = 15 + Math.round((p / totalPages) * 70);
        postProgress(pct, `Estimating and grouping Page ${p} of ${totalPages}...`);

        // Test appending page to current chunk doc
        const testDoc = await PDFLib.PDFDocument.create();
        const testIndices = [...currentChunkPages, p].map(n => n - 1);
        const copied = await testDoc.copyPages(srcDoc, testIndices);
        copied.forEach(pg => testDoc.addPage(pg));
        const testBytes = await testDoc.save({ useObjectStreams: true });

        if (testBytes.byteLength > maxLimit && currentChunkPages.length > 0) {
          // Finalize current chunk
          chunks.push({
            pages: [...currentChunkPages]
          });
          // Start next chunk with current page
          currentChunkPages = [p];
        } else {
          currentChunkPages.push(p);
        }
      }

      if (currentChunkPages.length > 0) {
        chunks.push({
          pages: [...currentChunkPages]
        });
      }

      postProgress(85, `Compiling ${chunks.length} size-optimized parts...`);
      const chunkResults = [];
      const zipItems = [];

      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];
        const chunkDoc = await PDFLib.PDFDocument.create();
        const copied = await chunkDoc.copyPages(srcDoc, chunk.pages.map(n => n - 1));
        copied.forEach(pg => chunkDoc.addPage(pg));
        const bytes = await chunkDoc.save({ useObjectStreams: true });

        const rangeLabel = chunk.pages.length === 1
          ? `Page ${chunk.pages[0]}`
          : `Pages ${chunk.pages[0]}-${chunk.pages[chunk.pages.length - 1]}`;

        const fname = chunk.pages.length === 1
          ? `${baseName || 'document'}-part-${cIdx + 1}-page-${chunk.pages[0]}.pdf`
          : `${baseName || 'document'}-part-${cIdx + 1}-pages-${chunk.pages[0]}-${chunk.pages[chunk.pages.length - 1]}.pdf`;

        zipItems.push({ filename: fname, bytes });
        chunkResults.push({
          partIndex: cIdx + 1,
          rangeLabel,
          filename: fname,
          bytes: bytes.buffer,
          size: bytes.byteLength,
          pages: chunk.pages
        });
      }

      postProgress(94, 'Packaging parts into 1-click ZIP archive...');
      const zipBytes = WorkerZip.createZip(zipItems);
      const zipFilename = `${baseName || 'document'}-parts-under-${Math.round(maxLimit / (1024 * 1024))}MB.zip`;

      const transferBuffers = [zipBytes.buffer];
      chunkResults.forEach(c => transferBuffers.push(c.bytes));

      self.postMessage({
        type: 'SUCCESS',
        id,
        result: {
          zipBytes: zipBytes.buffer,
          filename: zipFilename,
          chunks: chunkResults,
          totalChunks: chunkResults.length,
          totalPages
        }
      }, transferBuffers);
      return;
    }

    // ACTION: SPLIT IN PAIRS / FIXED CHUNKS
    if (action === 'SPLIT_CHUNKS') {
      const { buffer, targetPages, chunkSize, baseName } = payload;
      postProgress(10, 'Dividing document into fixed page chunks...');
      const srcDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
      const totalPages = srcDoc.getPageCount();

      const cleanSize = Math.max(1, Math.min(25, parseInt(chunkSize, 10) || 2));
      let pages = [];
      if (Array.isArray(targetPages) && targetPages.length > 0) {
        pages = targetPages
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p) && p >= 1 && p <= totalPages)
          .sort((a, b) => a - b);
      } else {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      }

      const chunks = [];
      for (let i = 0; i < pages.length; i += cleanSize) {
        chunks.push(pages.slice(i, i + cleanSize));
      }

      const chunkResults = [];
      const zipItems = [];

      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];
        const pct = 15 + Math.round(((cIdx + 1) / chunks.length) * 70);
        postProgress(pct, `Compiling Part ${cIdx + 1} of ${chunks.length}...`);

        const chunkDoc = await PDFLib.PDFDocument.create();
        const copied = await chunkDoc.copyPages(srcDoc, chunk.map(n => n - 1));
        copied.forEach(p => chunkDoc.addPage(p));
        const bytes = await chunkDoc.save({ useObjectStreams: true });

        const rangeLabel = chunk.length === 1
          ? `Page ${chunk[0]}`
          : `Pages ${chunk[0]}-${chunk[chunk.length - 1]}`;

        const fname = chunk.length === 1
          ? `${baseName || 'document'}-part-${cIdx + 1}-page-${chunk[0]}.pdf`
          : `${baseName || 'document'}-part-${cIdx + 1}-pages-${chunk[0]}-${chunk[chunk.length - 1]}.pdf`;

        zipItems.push({ filename: fname, bytes });
        chunkResults.push({
          partIndex: cIdx + 1,
          rangeLabel,
          filename: fname,
          bytes: bytes.buffer,
          size: bytes.byteLength,
          pages: chunk
        });
      }

      postProgress(92, 'Packaging parts into ZIP...');
      const zipBytes = WorkerZip.createZip(zipItems);
      const zipFilename = `${baseName || 'document'}-chunks-${cleanSize}pages.zip`;

      const transferBuffers = [zipBytes.buffer];
      chunkResults.forEach(c => transferBuffers.push(c.bytes));

      self.postMessage({
        type: 'SUCCESS',
        id,
        result: {
          zipBytes: zipBytes.buffer,
          filename: zipFilename,
          chunks: chunkResults,
          totalChunks: chunkResults.length,
          totalPages
        }
      }, transferBuffers);
      return;
    }

    throw new Error(`Unknown worker action: "${action}"`);
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: (err && err.message) || String(err)
    });
  }
};
