/**
 * localdoc.org — PDF Organization Engine (js/tools/organize.js)
 * 100% Client-Side RAM Processing for Merge, Split, Compress, Rotate, Page Numbers, and Watermark.
 */

const PDFOrganize = {
  // Safe in-memory PDF loader with encryption and corruption error boundaries
  async safeLoadPDF(buffer, fileName = 'document.pdf') {
    if (typeof window !== 'undefined' && window.LocalDocPDFValidator) {
      const check = await window.LocalDocPDFValidator.validatePdfBytes(buffer);
      if (!check.valid) {
        if (check.reason === 'locked') {
          throw new Error(`"${fileName}" is password-protected. Please unlock or decrypt it before processing.`);
        } else if (check.reason === 'empty') {
          throw new Error(`"${fileName}" is empty (0 bytes).`);
        } else {
          throw new Error(`"${fileName}" appears corrupted or is not a valid PDF file.`);
        }
      }
    }

    let doc;
    try {
      doc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
    } catch (err) {
      const msg = (err && err.message) ? err.message.toLowerCase() : '';
      if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected') || (err && err.name === 'EncryptedPDFError')) {
        throw new Error(`"${fileName}" is password-protected. Please unlock or decrypt it before processing.`);
      }
      throw new Error(`"${fileName}" appears corrupted or is not a valid PDF file.`);
    }

    if (doc && doc.isEncrypted) {
      throw new Error(`"${fileName}" is password-protected. Please unlock or decrypt it before processing.`);
    }

    return doc;
  },
  // 1. Merge PDF Documents with Reordered Queue & Intelligent Features
  async mergePDF(files, onProgress = null) {
    if (!files || files.length === 0) {
      throw new Error('Please select at least two PDF documents to merge.');
    }
    if (files.length === 1) {
      throw new Error('Please select at least 2 PDF files to merge into a single document.');
    }

    try {
      if (onProgress) onProgress(10, 'Creating in-memory merged document container...');
      const mergedDoc = await PDFLib.PDFDocument.create();
      let totalPageCount = 0;
      let totalInputBytes = 0;
      const bookmarks = [];

      for (let i = 0; i < files.length; i++) {
        // Cooperative yield so browser tab never freezes
        await new Promise(r => setTimeout(r, 0));

        const file = files[i];
        totalInputBytes += (file.size || 0);

        const pct = 15 + Math.round(((i + 1) / files.length) * 65);
        if (onProgress) onProgress(pct, `Merging Document ${i + 1} of ${files.length} (${file.name})...`);

        const buffer = await UIUtils.readFileAsArrayBuffer(file);
        const srcDoc = await this.safeLoadPDF(buffer, file.name);
        const indices = srcDoc.getPageIndices();

        // Record bookmark / outline entry for this document's start page
        bookmarks.push({
          title: file.name.replace(/\.pdf$/i, ''),
          pageIndex: totalPageCount
        });
        totalPageCount += indices.length;

        // Copy pages in chunks to keep memory smooth
        for (let chunkStart = 0; chunkStart < indices.length; chunkStart += 25) {
          const chunkIndices = indices.slice(chunkStart, chunkStart + 25);
          const copiedPages = await mergedDoc.copyPages(srcDoc, chunkIndices);
          copiedPages.forEach(page => mergedDoc.addPage(page));
          if (indices.length > 50) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      // 6. Killer Feature: Rebuild ISO 32000-1 Outlines / Bookmarks table of contents
      if (bookmarks.length > 0 && mergedDoc.getPageCount() > 0) {
        try {
          const { PDFName, PDFHexString } = PDFLib;
          const context = mergedDoc.context;
          const outlinesDictRef = context.nextRef();
          const outlineItemRefs = bookmarks.map(() => context.nextRef());

          for (let bIdx = 0; bIdx < bookmarks.length; bIdx++) {
            const bm = bookmarks[bIdx];
            const pageRef = mergedDoc.getPage(bm.pageIndex).ref;
            const itemDict = {
              Title: PDFHexString.fromText(bm.title),
              Parent: outlinesDictRef,
              Dest: [pageRef, PDFName.of('Fit')]
            };
            if (bIdx > 0) {
              itemDict.Prev = outlineItemRefs[bIdx - 1];
            }
            if (bIdx < bookmarks.length - 1) {
              itemDict.Next = outlineItemRefs[bIdx + 1];
            }
            context.assign(outlineItemRefs[bIdx], context.obj(itemDict));
          }

          const outlinesDict = context.obj({
            Type: 'Outlines',
            First: outlineItemRefs[0],
            Last: outlineItemRefs[outlineItemRefs.length - 1],
            Count: outlineItemRefs.length
          });
          context.assign(outlinesDictRef, outlinesDict);
          mergedDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
        } catch (bmErr) {
          console.warn('Outline preservation non-fatal notice:', bmErr);
        }
      }

      if (onProgress) onProgress(85, 'Optimizing object streams in RAM...');
      await new Promise(r => setTimeout(r, 0));

      const pdfBytes = await mergedDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const mergedSize = pdfBytes.byteLength;

      // 1. File Bloat Detection: if merged size exceeds total input size + 5% overhead
      const isBloated = (mergedSize > totalInputBytes * 1.05) && (totalInputBytes > 100000);
      const bloatDifference = Math.max(0, mergedSize - totalInputBytes);
      const bloatPercentage = totalInputBytes > 0 ? Math.round(((mergedSize - totalInputBytes) / totalInputBytes) * 100) : 0;

      if (onProgress) onProgress(100, 'Merge complete!');

      return {
        pdfBlob,
        totalPages: totalPageCount,
        fileCount: files.length,
        mergedSize,
        totalInputBytes,
        isBloated,
        bloatDifference,
        bloatPercentage
      };
    } catch (err) {
      const msg = (err && err.message) ? err.message.toLowerCase() : '';
      if (err.name === 'RangeError' || msg.includes('allocation') || msg.includes('out of memory') || msg.includes('memory')) {
        throw new Error('This file collection is too large to merge in your browser RAM at once. Try merging fewer documents at a time or compress them first.');
      }
      throw err;
    }
  },

  // --- SPLIT PDF RANGE PARSER & HELPERS ---
  parseRangeString(rangeInput, totalPages) {
    if (!totalPages || totalPages < 1) totalPages = 1;
    const targetPages = new Set();

    if (Array.isArray(rangeInput)) {
      rangeInput.forEach(p => {
        const num = parseInt(p, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          targetPages.add(num);
        }
      });
      return Array.from(targetPages).sort((a, b) => a - b);
    }

    const raw = String(rangeInput || '').trim();
    if (!raw) return [];

    const parts = raw.split(/[,;\s]+/).filter(Boolean);
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;

      if (clean.includes('-')) {
        const segs = clean.split('-');
        if (segs.length === 2) {
          let startStr = segs[0].trim();
          let endStr = segs[1].trim();

          let start = startStr === '' ? 1 : parseInt(startStr, 10);
          let end = endStr === '' ? totalPages : parseInt(endStr, 10);

          if (!isNaN(start) && !isNaN(end)) {
            const minP = Math.max(1, Math.min(start, end));
            const maxP = Math.min(totalPages, Math.max(start, end));
            for (let p = minP; p <= maxP; p++) {
              targetPages.add(p);
            }
          }
        }
      } else {
        const p = parseInt(clean, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          targetPages.add(p);
        }
      }
    }

    return Array.from(targetPages).sort((a, b) => a - b);
  },

  formatRangeString(pagesArray) {
    if (!pagesArray || pagesArray.length === 0) return '';
    const sorted = Array.from(new Set(pagesArray.map(p => parseInt(p, 10)).filter(p => !isNaN(p) && p >= 1))).sort((a, b) => a - b);
    if (sorted.length === 0) return '';

    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur === prev + 1) {
        prev = cur;
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = cur;
        prev = cur;
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(', ');
  },

  // Web Worker Management
  _splitWorker: null,
  getSplitWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
    if (!this._splitWorker) {
      try {
        this._splitWorker = new Worker('../js/workers/split-worker.js');
      } catch (e1) {
        try {
          this._splitWorker = new Worker('/js/workers/split-worker.js');
        } catch (e2) {
          this._splitWorker = null;
        }
      }
    }
    return this._splitWorker;
  },

  async runWorkerAction(action, payload, onProgress = null) {
    const worker = this.getSplitWorker();
    if (!worker) return null;

    return new Promise((resolve, reject) => {
      const id = 'split_' + Math.random().toString(36).substring(2, 9);
      const listener = (e) => {
        const msg = e.data || {};
        if (msg.id !== id) return;

        if (msg.type === 'PROGRESS') {
          if (onProgress) onProgress(msg.pct, msg.status);
        } else if (msg.type === 'SUCCESS') {
          worker.removeEventListener('message', listener);
          worker.removeEventListener('error', errListener);
          resolve(msg.result);
        } else if (msg.type === 'ERROR') {
          worker.removeEventListener('message', listener);
          worker.removeEventListener('error', errListener);
          reject(new Error(msg.error || 'Worker execution failed'));
        }
      };

      const errListener = (err) => {
        worker.removeEventListener('message', listener);
        worker.removeEventListener('error', errListener);
        reject(err);
      };

      worker.addEventListener('message', listener);
      worker.addEventListener('error', errListener);

      try {
        const transfer = [];
        if (payload.buffer && payload.buffer instanceof ArrayBuffer) {
          const cloned = payload.buffer.slice(0);
          payload.buffer = cloned;
          transfer.push(cloned);
        }
        worker.postMessage({ action, id, payload }, transfer);
      } catch (postErr) {
        worker.removeEventListener('message', listener);
        worker.removeEventListener('error', errListener);
        reject(postErr);
      }
    });
  },

  // 2. Mode A: Split PDF Document by Page Ranges or Selection (Extract to Single PDF)
  async splitPDF(file, pageRangeString, onProgress = null) {
    if (onProgress) onProgress(15, 'Loading PDF document structure into RAM...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await this.safeLoadPDF(buffer, file.name);
    const totalPages = srcDoc.getPageCount();

    const targetPages = this.parseRangeString(pageRangeString, totalPages);
    if (targetPages.length === 0) {
      throw new Error(`Invalid page range. Please select valid pages between 1 and ${totalPages}.`);
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Attempt Web Worker offloading
    try {
      const workerRes = await this.runWorkerAction('EXTRACT', {
        buffer,
        targetPages,
        baseName
      }, onProgress);

      if (workerRes && workerRes.pdfBytes) {
        const pdfBlob = new Blob([workerRes.pdfBytes], { type: 'application/pdf' });
        return {
          pdfBlob,
          filename: workerRes.filename,
          extractedPagesCount: workerRes.extractedCount,
          totalPages: workerRes.totalPages,
          selectedPagesList: workerRes.selectedPages
        };
      }
    } catch (workerErr) {
      console.warn('SplitWorker error, executing cooperative in-memory fallback:', workerErr);
    }

    // In-memory fallback
    const sortedIndices = targetPages.map(p => p - 1);
    if (onProgress) onProgress(50, `Extracting ${sortedIndices.length} selected pages...`);

    const newDoc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < sortedIndices.length; i += 25) {
      const slice = sortedIndices.slice(i, i + 25);
      const copiedPages = await newDoc.copyPages(srcDoc, slice);
      copiedPages.forEach(page => newDoc.addPage(page));
      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) onProgress(90, 'Writing extracted PDF document...');
    const pdfBytes = await newDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `${baseName}-extracted-${targetPages.length}pages.pdf`;

    return {
      pdfBlob,
      filename,
      extractedPagesCount: targetPages.length,
      totalPages: totalPages,
      selectedPagesList: targetPages
    };
  },

  // 2b. Mode B: Remove Selected Pages (Invert & Save Remaining Pages)
  async removePagesPDF(file, pagesToRemove, onProgress = null) {
    if (onProgress) onProgress(15, 'Inspecting pages to exclude...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await this.safeLoadPDF(buffer, file.name);
    const totalPages = srcDoc.getPageCount();

    const excludedSet = new Set(this.parseRangeString(pagesToRemove, totalPages));
    const activePages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!excludedSet.has(p)) {
        activePages.push(p);
      }
    }

    if (activePages.length === 0) {
      throw new Error('You cannot remove all pages. Please leave at least one page.');
    }

    const res = await this.splitPDF(file, activePages, onProgress);
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    res.filename = `${baseName}-cleaned-${activePages.length}pages.pdf`;
    res.removedPagesCount = excludedSet.size;
    res.remainingPagesCount = activePages.length;
    return res;
  },

  // 3. Mode C: Burst / Split Individual Pages into individual PDFs and ZIP archive
  async splitSelectedPagesToZip(file, pageNumbers = null, onProgress = null) {
    if (onProgress) onProgress(15, 'Reading PDF document structure into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await this.safeLoadPDF(buffer, file.name);
    const totalPages = srcDoc.getPageCount();

    let targetPages = this.parseRangeString(pageNumbers, totalPages);
    if (!targetPages || targetPages.length === 0) {
      for (let i = 1; i <= totalPages; i++) targetPages.push(i);
    }

    if (targetPages.length === 0) {
      throw new Error('Please select at least one valid page to split.');
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Attempt Web Worker offloading
    try {
      const workerRes = await this.runWorkerAction('BURST_ZIP', {
        buffer,
        targetPages,
        baseName
      }, onProgress);

      if (workerRes && workerRes.zipBytes) {
        const zipBlob = new Blob([workerRes.zipBytes], { type: 'application/zip' });
        const fileList = (workerRes.files || []).map(f => ({
          pageNumber: f.pageNumber,
          filename: f.filename,
          blob: new Blob([f.bytes], { type: 'application/pdf' }),
          size: f.size
        }));

        return {
          zipBlob,
          filename: workerRes.filename,
          files: fileList,
          totalPages: workerRes.totalPages,
          totalExtracted: fileList.length
        };
      }
    } catch (workerErr) {
      console.warn('SplitWorker burst error, using cooperative in-memory fallback:', workerErr);
    }

    // In-memory fallback
    const pagesData = [];
    const fileList = [];

    for (let idx = 0; idx < targetPages.length; idx++) {
      const pageNum = targetPages[idx];
      const pct = 20 + Math.round(((idx + 1) / targetPages.length) * 65);
      if (onProgress) onProgress(pct, `Extracting Page ${pageNum} (${idx + 1} of ${targetPages.length})...`);

      const singleDoc = await PDFLib.PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [pageNum - 1]);
      singleDoc.addPage(copiedPage);

      const singleBytes = await singleDoc.save({ useObjectStreams: true });
      const filename = `${baseName}-page-${pageNum}.pdf`;
      const blob = new Blob([singleBytes], { type: 'application/pdf' });

      pagesData.push({
        filename: filename,
        bytes: singleBytes
      });

      fileList.push({
        pageNumber: pageNum,
        filename: filename,
        blob: blob,
        size: singleBytes.byteLength
      });

      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) onProgress(90, 'Bundling all individual PDFs into 1-click ZIP archive...');
    const ZipClass = window.MiniZip || (window.UIUtils && window.UIUtils.Zip) || LocalZip;
    const zipBlob = ZipClass.createZip(pagesData);

    return {
      zipBlob,
      filename: `${baseName}-individual-pages.zip`,
      files: fileList,
      totalPages: totalPages,
      totalExtracted: fileList.length
    };
  },

  // Legacy alias for full document burst
  async splitAllPagesToZip(file, onProgress = null) {
    return this.splitSelectedPagesToZip(file, null, onProgress);
  },

  // 3b. Mode D: Split by Target File Size / Email-Friendly Chunks (< 10MB / 25MB)
  async splitPDFBySize(file, maxBytesPerChunk = (10 * 1024 * 1024), onProgress = null) {
    if (onProgress) onProgress(15, 'Analyzing document page sizes for email splitting...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await this.safeLoadPDF(buffer, file.name);
    const totalPages = srcDoc.getPageCount();

    const maxLimit = Math.max(1024, parseInt(maxBytesPerChunk, 10) || (10 * 1024 * 1024));
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Attempt Web Worker offloading
    try {
      const workerRes = await this.runWorkerAction('SPLIT_BY_SIZE', {
        buffer,
        maxBytes: maxLimit,
        baseName
      }, onProgress);

      if (workerRes && workerRes.zipBytes) {
        const zipBlob = new Blob([workerRes.zipBytes], { type: 'application/zip' });
        const chunkList = (workerRes.chunks || []).map(c => ({
          partIndex: c.partIndex,
          rangeLabel: c.rangeLabel,
          filename: c.filename,
          blob: new Blob([c.bytes], { type: 'application/pdf' }),
          size: c.size,
          pages: c.pages
        }));

        return {
          zipBlob,
          filename: workerRes.filename,
          chunks: chunkList,
          totalChunks: chunkList.length,
          totalPages: workerRes.totalPages
        };
      }
    } catch (workerErr) {
      console.warn('SplitWorker size error, executing in-memory fallback:', workerErr);
    }

    // In-memory fallback
    const chunks = [];
    let currentChunkPages = [];

    for (let p = 1; p <= totalPages; p++) {
      const pct = 15 + Math.round((p / totalPages) * 65);
      if (onProgress) onProgress(pct, `Calculating size profile for Page ${p} of ${totalPages}...`);

      const testDoc = await PDFLib.PDFDocument.create();
      const testIndices = [...currentChunkPages, p].map(n => n - 1);
      const copied = await testDoc.copyPages(srcDoc, testIndices);
      copied.forEach(pg => testDoc.addPage(pg));
      const testBytes = await testDoc.save({ useObjectStreams: true });

      if (testBytes.byteLength > maxLimit && currentChunkPages.length > 0) {
        chunks.push([...currentChunkPages]);
        currentChunkPages = [p];
      } else {
        currentChunkPages.push(p);
      }
      await new Promise(r => setTimeout(r, 0));
    }

    if (currentChunkPages.length > 0) {
      chunks.push([...currentChunkPages]);
    }

    if (onProgress) onProgress(85, `Writing ${chunks.length} size-optimized parts...`);
    const chunkList = [];
    const pagesData = [];

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const chunkDoc = await PDFLib.PDFDocument.create();
      const copied = await chunkDoc.copyPages(srcDoc, chunk.map(n => n - 1));
      copied.forEach(pg => chunkDoc.addPage(pg));
      const bytes = await chunkDoc.save({ useObjectStreams: true });

      const rangeLabel = chunk.length === 1
        ? `Page ${chunk[0]}`
        : `Pages ${chunk[0]}-${chunk[chunk.length - 1]}`;

      const fname = chunk.length === 1
        ? `${baseName}-part-${cIdx + 1}-page-${chunk[0]}.pdf`
        : `${baseName}-part-${cIdx + 1}-pages-${chunk[0]}-${chunk[chunk.length - 1]}.pdf`;

      const blob = new Blob([bytes], { type: 'application/pdf' });
      pagesData.push({ filename: fname, bytes });
      chunkList.push({
        partIndex: cIdx + 1,
        rangeLabel,
        filename: fname,
        blob,
        size: bytes.byteLength,
        pages: chunk
      });
      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) onProgress(95, 'Bundling email-ready parts into ZIP...');
    const ZipClass = window.MiniZip || (window.UIUtils && window.UIUtils.Zip) || LocalZip;
    const rawZip = ZipClass.createZip(pagesData);
    const zipBlob = (typeof Blob !== 'undefined' && rawZip instanceof Blob) ? rawZip : new Blob([rawZip], { type: 'application/zip' });
    const limitMB = Math.round(maxLimit / (1024 * 1024));

    return {
      zipBlob,
      filename: `${baseName}-parts-under-${limitMB}MB.zip`,
      chunks: chunkList,
      totalChunks: chunkList.length,
      totalPages: totalPages
    };
  },

  // 3c. Split Document into Equal Page Chunks or Pairs (e.g. 2, 3, 5, up to 10 pages per PDF)
  async splitPagesToChunks(file, pageNumbers = null, chunkSize = 2, onProgress = null) {
    if (onProgress) onProgress(15, 'Reading PDF document pages...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const srcDoc = await this.safeLoadPDF(buffer, file.name);
    const totalPages = srcDoc.getPageCount();

    const cleanChunkSize = Math.max(1, Math.min(25, parseInt(chunkSize, 10) || 2));
    let targetPages = this.parseRangeString(pageNumbers, totalPages);
    if (!targetPages || targetPages.length === 0) {
      for (let i = 1; i <= totalPages; i++) targetPages.push(i);
    }

    if (targetPages.length === 0) {
      throw new Error('Please select at least one valid page to split.');
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Attempt Web Worker offloading
    try {
      const workerRes = await this.runWorkerAction('SPLIT_CHUNKS', {
        buffer,
        targetPages,
        chunkSize: cleanChunkSize,
        baseName
      }, onProgress);

      if (workerRes && workerRes.zipBytes) {
        const zipBlob = new Blob([workerRes.zipBytes], { type: 'application/zip' });
        const chunkList = (workerRes.chunks || []).map(c => ({
          partIndex: c.partIndex,
          rangeLabel: c.rangeLabel,
          filename: c.filename,
          blob: new Blob([c.bytes], { type: 'application/pdf' }),
          size: c.size,
          pages: c.pages
        }));

        return {
          zipBlob,
          filename: workerRes.filename,
          chunks: chunkList,
          totalChunks: chunkList.length,
          chunkSize: cleanChunkSize,
          totalPages: workerRes.totalPages
        };
      }
    } catch (workerErr) {
      console.warn('SplitWorker chunks error, executing in-memory fallback:', workerErr);
    }

    // In-memory fallback
    const chunks = [];
    for (let i = 0; i < targetPages.length; i += cleanChunkSize) {
      chunks.push(targetPages.slice(i, i + cleanChunkSize));
    }

    const pagesData = [];
    const chunkList = [];

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const pct = 20 + Math.round(((cIdx + 1) / chunks.length) * 65);
      const rangeLabel = chunk.length === 1 ? `Page ${chunk[0]}` : `Pages ${chunk[0]}-${chunk[chunk.length - 1]}`;
      if (onProgress) onProgress(pct, `Compiling Part ${cIdx + 1} (${rangeLabel})...`);

      const chunkDoc = await PDFLib.PDFDocument.create();
      const pageIndices = chunk.map(p => p - 1);
      const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => chunkDoc.addPage(p));

      const chunkBytes = await chunkDoc.save({ useObjectStreams: true });
      const filename = chunk.length === 1
        ? `${baseName}-part-${cIdx + 1}-page-${chunk[0]}.pdf`
        : `${baseName}-part-${cIdx + 1}-pages-${chunk[0]}-${chunk[chunk.length - 1]}.pdf`;
      const blob = new Blob([chunkBytes], { type: 'application/pdf' });

      pagesData.push({
        filename: filename,
        bytes: chunkBytes
      });

      chunkList.push({
        partIndex: cIdx + 1,
        rangeLabel: rangeLabel,
        filename: filename,
        blob: blob,
        size: chunkBytes.byteLength,
        pageCount: chunk.length
      });
      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) onProgress(90, 'Packaging all parts into 1-click ZIP archive...');
    const ZipClass = window.MiniZip || (window.UIUtils && window.UIUtils.Zip) || LocalZip;
    const zipBlob = ZipClass.createZip(pagesData);

    return {
      zipBlob,
      filename: `${baseName}-split-in-${cleanChunkSize}page-chunks.zip`,
      chunks: chunkList,
      totalChunks: chunkList.length,
      chunkSize: cleanChunkSize,
      totalPages: totalPages
    };
  },

  // 4. Multi-Tier Intelligent PDF Compression (Sequential Single-Page Streaming)
  async compressPDF(file, level = 'recommended', onProgress = null, options = {}) {
    const originalSize = file.size;
    if (onProgress) onProgress(5, 'Loading PDF document into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);

    // Step 1: Pre-flight check for encryption & corruption
    const srcDoc = await this.safeLoadPDF(buffer.slice(0), file.name || 'document.pdf');
    const totalPages = srcDoc.getPageCount();

    // Step 2: Lossless Stream Optimization pass (pdf-lib object stream defragmentation)
    if (onProgress) onProgress(15, 'Running lossless stream defragmentation...');
    let losslessBlob = null;
    let losslessSize = originalSize;
    try {
      const losslessDoc = await PDFLib.PDFDocument.create();
      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await losslessDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => losslessDoc.addPage(p));
      const losslessBytes = await losslessDoc.save({ useObjectStreams: true, addDefaultPage: false });
      losslessBlob = new Blob([losslessBytes], { type: 'application/pdf' });
      losslessSize = losslessBytes.byteLength;
    } catch (losslessErr) {
      console.warn('Lossless defragmentation pass notice:', losslessErr);
    }

    // If user specifically requested Lossless (Low) mode:
    if (level === 'low') {
      const bestBlob = (losslessBlob && losslessSize < originalSize) ? losslessBlob : new Blob([buffer], { type: 'application/pdf' });
      const bestSize = (losslessBlob && losslessSize < originalSize) ? losslessSize : originalSize;
      const savedBytes = Math.max(0, originalSize - bestSize);
      const percentSaved = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
      const isAlreadyOptimized = (savedBytes <= 0);

      if (onProgress) onProgress(100, isAlreadyOptimized ? 'Document is already stream-optimized.' : 'Lossless compression complete!');
      return {
        pdfBlob: bestBlob,
        originalSize,
        compressedSize: bestSize,
        savedBytes,
        percentSaved,
        savedPercentage: percentSaved,
        level: 'Lossless (Vector Preserved)',
        isTextOptimized: true,
        notice: isAlreadyOptimized 
          ? 'This document consists of pre-optimized streams. No further lossless reduction is possible.' 
          : `Cleaned orphan objects and re-indexed object streams (${percentSaved}% saved).`
      };
    }

    // Step 3: Configure Target KB Limit or Tier Parameters
    const targetKb = options.targetKb || (level === 'target-200kb' ? 200 : (level === 'target-500kb' ? 500 : null));
    let targetNotice = '';

    let targetScale = 0.95;
    let targetQuality = 0.65;

    if (targetKb) {
      const maxPracticalPages = (targetKb <= 250) ? 10 : 25;
      if (totalPages > maxPracticalPages) {
        targetNotice = `Notice: Document contains ${totalPages} pages. Compressing below ${targetKb}KB would allocate only ~${Math.round(targetKb / totalPages)}KB/page, rendering text unreadable. High compression applied safely instead.`;
        targetScale = 0.70;
        targetQuality = 0.40;
      } else {
        // Budget per page in KB
        const budgetKbPerPage = (targetKb * 0.82) / totalPages;
        if (budgetKbPerPage < 25) {
          targetScale = 0.60;
          targetQuality = 0.35;
        } else if (budgetKbPerPage < 50) {
          targetScale = 0.72;
          targetQuality = 0.48;
        } else {
          targetScale = 0.85;
          targetQuality = 0.60;
        }
      }
    } else if (level === 'extreme') {
      targetScale = 0.75;
      targetQuality = 0.42;
    } else {
      // Recommended balanced mode
      targetScale = 0.92;
      targetQuality = 0.62;
    }

    // Step 4: Sequential Single-Page Streaming Pipeline (Constant RAM Heap)
    if (onProgress) onProgress(25, `Starting sequential streaming across ${totalPages} pages...`);
    const clonedData = new Uint8Array(buffer.slice(0));
    const pdf = await pdfjsLib.getDocument({ data: clonedData, isEvalSupported: false }).promise;
    const numPages = pdf.numPages;

    const compDoc = await PDFLib.PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      const pct = 25 + Math.round(((i) / numPages) * 60);
      if (onProgress) onProgress(pct, `Compressing Page ${i} of ${numPages} in RAM...`);

      const page = await pdf.getPage(i);
      const originalVp = page.getViewport({ scale: 1.0 });
      const vp = page.getViewport({ scale: targetScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d', { alpha: false });

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      // Extract JPEG data URL
      const dataUrl = canvas.toDataURL('image/jpeg', targetQuality);

      // Embed immediately into compDoc
      const embeddedJpg = await compDoc.embedJpg(dataUrl);
      const newPage = compDoc.addPage([originalVp.width, originalVp.height]);
      newPage.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: originalVp.width,
        height: originalVp.height
      });

      // Immediate garbage collection disposal of page canvas
      canvas.width = 0;
      canvas.height = 0;

      // Yield event loop every page so browser stays completely fluid
      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) onProgress(88, 'Serializing compressed stream container in RAM...');
    const outBytes = await compDoc.save({ useObjectStreams: true });
    let finalBlob = new Blob([outBytes], { type: 'application/pdf' });
    let finalSize = outBytes.byteLength;

    // Step 5: Vector / Text Inspection Fallback (Honesty Check)
    // If lossless optimization is smaller than or equal to rasterization, or if rasterization bloated the file,
    // we preserve the vector typography and object streams!
    let isVectorDocument = false;
    if (losslessBlob && (losslessSize <= finalSize || finalSize >= originalSize)) {
      if (losslessSize < originalSize) {
        finalBlob = losslessBlob;
        finalSize = losslessSize;
        isVectorDocument = true;
        const vecMsg = 'Document consists primarily of vector text. Lossless stream optimization applied to preserve crisp typography and prevent raster bloat.';
        targetNotice = targetNotice ? `${targetNotice} ${vecMsg}` : vecMsg;
      } else {
        // File is already maximally compressed
        finalBlob = new Blob([buffer], { type: 'application/pdf' });
        finalSize = originalSize;
        isVectorDocument = true;
        const optMsg = 'Document is already stream-optimized and maximally compressed. Re-encoding text as images would increase size or blur fonts, so original document was preserved.';
        targetNotice = targetNotice ? `${targetNotice} ${optMsg}` : optMsg;
      }
    } else if (finalSize >= originalSize) {
      finalBlob = new Blob([buffer], { type: 'application/pdf' });
      finalSize = originalSize;
      isVectorDocument = true;
      const keepMsg = 'Document is already maximally compressed. Re-encoding would increase file size, so original clean file was preserved.';
      targetNotice = targetNotice ? `${targetNotice} ${keepMsg}` : keepMsg;
    }

    const savedBytes = Math.max(0, originalSize - finalSize);
    const percentSaved = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

    if (onProgress) onProgress(100, `Compression complete! ${percentSaved > 0 ? 'Saved ' + percentSaved + '%' : 'Document optimized.'}`);

    return {
      pdfBlob: finalBlob,
      originalSize,
      compressedSize: finalSize,
      savedBytes,
      percentSaved,
      savedPercentage: percentSaved,
      level: targetKb ? `Target ≤${targetKb}KB` : (level === 'extreme' ? 'Extreme' : 'Recommended'),
      isVectorDocument,
      totalPages: numPages,
      notice: targetNotice
    };
  },

  // 5. Rotate PDF Pages (Per-Page or Global Rotation)
  async rotatePDF(file, rotationParam = 90, onProgress = null) {
    if (onProgress) onProgress(20, 'Loading PDF document into memory...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await this.safeLoadPDF(buffer, file.name);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    if (onProgress) onProgress(50, 'Applying rotation angles to page dictionaries...');

    let rotatedPagesCount = 0;
    if (typeof rotationParam === 'object' && !Array.isArray(rotationParam)) {
      // Rotation map e.g. { 0: 90, 1: 180, 2: 270 }
      pages.forEach((page, idx) => {
        if (rotationParam[idx] !== undefined) {
          const currentRotation = page.getRotation().angle;
          const targetAngle = (currentRotation + rotationParam[idx]) % 360;
          page.setRotation(PDFLib.degrees(targetAngle));
          if (rotationParam[idx] % 360 !== 0) rotatedPagesCount++;
        }
      });
      if (rotatedPagesCount === 0) rotatedPagesCount = totalPages;
    } else {
      // Global angle (e.g. 90, 180, 270)
      const angle = parseInt(rotationParam, 10) || 90;
      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((currentRotation + angle) % 360));
      });
      rotatedPagesCount = totalPages;
    }

    if (onProgress) onProgress(85, 'Saving rotated PDF document...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages,
      rotatedPagesCount
    };
  },

  // 6. Add Custom Page Numbers to PDF
  async addPageNumbers(file, options = {}, onProgress = null) {
    const {
      position = 'bottom-center',
      format = 'Page {n} of {total}',
      startFrom = 1,
      skipFirstPage = false,
      fontSize = 10,
      fontColor = 'gray',
      marginOffset = 25
    } = options;

    if (onProgress) onProgress(20, 'Loading PDF pages for numbering...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await this.safeLoadPDF(buffer, file.name);
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    let rgbColor = PDFLib.rgb(0.35, 0.35, 0.35);
    if (fontColor === 'black') rgbColor = PDFLib.rgb(0.05, 0.05, 0.05);
    if (fontColor === 'blue') rgbColor = PDFLib.rgb(0.02, 0.45, 0.85);
    if (fontColor === 'red') rgbColor = PDFLib.rgb(0.85, 0.1, 0.1);

    if (onProgress) onProgress(50, 'Stamping page numbers onto pages...');

    pages.forEach((page, idx) => {
      if (skipFirstPage && idx === 0) return;

      const pageNumber = (idx + startFrom);
      let text = format
        .replace(/{n}/g, String(pageNumber))
        .replace(/{total}/g, String(total));

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { width, height } = page.getSize();

      let x = (width - textWidth) / 2;
      let y = marginOffset;

      if (position === 'bottom-left') {
        x = marginOffset;
        y = marginOffset;
      } else if (position === 'bottom-right') {
        x = width - textWidth - marginOffset;
        y = marginOffset;
      } else if (position === 'top-center') {
        x = (width - textWidth) / 2;
        y = height - marginOffset - fontSize;
      } else if (position === 'top-left') {
        x = marginOffset;
        y = height - marginOffset - fontSize;
      } else if (position === 'top-right') {
        x = width - textWidth - marginOffset;
        y = height - marginOffset - fontSize;
      }

      page.drawText(text, {
        x: Math.max(5, x),
        y: Math.max(5, y),
        size: fontSize,
        font: font,
        color: rgbColor
      });
    });

    if (onProgress) onProgress(85, 'Writing numbered PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages: total
    };
  },

  // 7. Add Custom Watermark (Text or Image) to PDF
  async addWatermark(file, options = {}, onProgress = null) {
    const {
      type = 'text',
      text = 'CONFIDENTIAL',
      imageFile = null,
      opacity = 0.35,
      rotationAngle = 45,
      fontSize = 50,
      color = 'red'
    } = options;

    if (onProgress) onProgress(20, 'Loading PDF for watermarking...');
    const buffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdfDoc = await this.safeLoadPDF(buffer, file.name);
    const pages = pdfDoc.getPages();

    if (type === 'image' && imageFile) {
      if (onProgress) onProgress(40, 'Embedding watermark image...');
      const imgBuffer = await UIUtils.readFileAsArrayBuffer(imageFile);
      const isPng = imageFile.type.includes('png') || imageFile.name.toLowerCase().endsWith('.png');
      const embeddedImg = isPng  ?  await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
      const imgDims = embeddedImg.scale(1.0);

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const scaleFactor = Math.min((width * 0.6) / imgDims.width, (height * 0.6) / imgDims.height, 1.0);
        const drawWidth = imgDims.width * scaleFactor;
        const drawHeight = imgDims.height * scaleFactor;

        page.drawImage(embeddedImg, {
          x: (width - drawWidth) / 2,
          y: (height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
          opacity: opacity,
          rotate: PDFLib.degrees(rotationAngle)
        });
      });
    } else {
      // Text Watermark
      if (onProgress) onProgress(40, 'Formatting text watermark typography...');
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      let rgbColor = PDFLib.rgb(0.85, 0.1, 0.1);
      if (color === 'gray') rgbColor = PDFLib.rgb(0.4, 0.4, 0.4);
      if (color === 'blue') rgbColor = PDFLib.rgb(0.05, 0.35, 0.85);
      if (color === 'black') rgbColor = PDFLib.rgb(0.05, 0.05, 0.05);

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const autoFontSize = fontSize || Math.round(Math.min(width, height) / 10);
        const textWidth = font.widthOfTextAtSize(text, autoFontSize);

        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: (height / 2),
          size: autoFontSize,
          font: font,
          color: rgbColor,
          opacity: opacity,
          rotate: PDFLib.degrees(rotationAngle)
        });
      });
    }

    if (onProgress) onProgress(85, 'Saving watermarked PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob,
      totalPages: pages.length
    };
  }
};

window.PDFOrganize = PDFOrganize;
