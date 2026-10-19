/**
 * localdoc.org — PDF & Document Conversion Engine (js/tools/convert.js)
 * Real client-side conversions: PDF <-> Word, PDF <-> Excel, PDF <-> Images.
 * Zero cloud uploads. 100% in-browser RAM execution.
 */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
}

const PDFConvert = {
  // Safe XML Escaper (Self-contained, guaranteed never undefined)
  escapeXml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  // Helper: Sanitize text for WinAnsi / StandardFonts fallback
  sanitizeWinAnsiText(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u2013\u2014\u2015]/g, '-')
      .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\uF0B7]/g, '* ')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u2026]/g, '...')
      .replace(/[^\x00-\x7F]/g, () => '-');
  },

  // 1. PDF to Images (JPG / PNG) with selectable DPI
  async pdfToImages(file, format = 'image/jpeg', dpiScale = 2.0, onProgress = null) {
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const numPages = pdf.numPages;
    const images = [];

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(((i - 0.2) / numPages) * 100, `Rendering Page ${i} of ${numPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: dpiScale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white background for JPEGs
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const quality = format === 'image/png'  ?  1.0 : 0.92;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
      const dataUrl = canvas.toDataURL(format, quality);

      images.push({
        pageNumber: i,
        blob: blob,
        dataUrl: dataUrl,
        width: viewport.width,
        height: viewport.height
      });
      if (onProgress) onProgress((i / numPages) * 100, `Completed Page ${i} of ${numPages}`);
    }
    return images;
  },

  // 1b. Create ZIP of all images
  async createImagesZip(images, baseName = 'page', ext = 'jpg') {
    const zip = typeof MiniZip !== 'undefined'  ?  new MiniZip() : null;
    if (!zip) throw new Error("MiniZip encoder library not found.");
    for (const img of images) {
      const fileName = `${baseName}-page-${String(img.pageNumber).padStart(2, '0')}.${ext}`;
      const buffer = await img.blob.arrayBuffer();
      zip.addFile(fileName, new Uint8Array(buffer));
    }
    return zip.generateBlob('application/zip');
  },

  // 2. Images to PDF with layout controls
  async imagesToPDF(files, options = {}, onProgress = null) {
    const orientation = options.orientation || 'auto';
    const margin = options.margin !== undefined  ?  options.margin : 20;
    const pageSize = options.pageSize || 'a4';

    const baseSizes = {
      a4: { w: 595.28, h: 841.89 },
      letter: { w: 612.0, h: 792.0 }
    };
    const defaultDims = baseSizes[pageSize] || baseSizes.a4;

    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(((i + 1) / files.length) * 100, `Embedding image ${i + 1} of ${files.length}...`);
      const file = files[i];
      const buffer = await UIUtils.readFileAsArrayBuffer(file);
      let embeddedImage;

      const isPng = file.type === 'image/png' || (file.name && file.name.toLowerCase().endsWith('.png'));
      if (isPng) {
        try {
          embeddedImage = await pdfDoc.embedPng(buffer);
        } catch (e) {
          const dataUrl = await UIUtils.readFileAsDataURL(file);
          const img = await UIUtils.loadImage(dataUrl);
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const jpgBlob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.95));
          const jpgBuf = await jpgBlob.arrayBuffer();
          embeddedImage = await pdfDoc.embedJpg(jpgBuf);
        }
      } else {
        embeddedImage = await pdfDoc.embedJpg(buffer);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      let pageW = defaultDims.w;
      let pageH = defaultDims.h;

      if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight)) {
        pageW = defaultDims.h;
        pageH = defaultDims.w;
      }

      const pdfPage = pdfDoc.addPage([pageW, pageH]);
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      const scale = Math.min(availW / imgWidth, availH / imgHeight, 1.0);
      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;

      pdfPage.drawImage(embeddedImage, {
        x: margin + (availW - drawW) / 2,
        y: margin + (availH - drawH) / 2,
        width: drawW,
        height: drawH
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 3. PDF to Word (.docx) — Enhanced Style, Multi-Column, Table & RTL Extractor
  async pdfToWord(file, onProgress = null) {
    if (onProgress) onProgress(10, 'Loading PDF Structure in Memory...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const numPages = pdf.numPages;
    const docxParagraphs = [];
    const htmlPreviewBlocks = [];

    const sectionKeywords = [
      'experience', 'work experience', 'employment history', 'work history',
      'education', 'academic background', 'qualifications',
      'summary', 'professional summary', 'executive summary', 'profile', 'about me',
      'skills', 'technical skills', 'core competencies', 'key skills', 'areas of expertise',
      'projects', 'key projects', 'notable projects',
      'certifications', 'licenses', 'certificates',
      'awards', 'honors', 'achievements',
      'languages', 'publications', 'interests', 'hobbies', 'contact', 'references'
    ];

    const bulletRegex = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\uF0B7\u00B7*•\-\–\—]\s*/;
    const numberedListRegex = /^(\d+|[a-zA-Z]|[ivxIVX]+)[\.\)]\s+/;
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;

    let totalExtractedChars = 0;
    let detectedTwoColumnsTotal = false;
    let detectedTablesTotal = false;

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(15 + Math.round((i / numPages) * 70), `Analyzing fonts, layout & tables (Page ${i} of ${numPages})...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;

      if (!textContent.items || textContent.items.length === 0) continue;

      // Extract all valid items with font, size, coordinates
      const rawItems = [];
      textContent.items.forEach(item => {
        const text = (item.str || '').trim();
        if (!text && !item.hasEOL) return;

        totalExtractedChars += text.length;

        const transform = item.transform;
        const fontSize = Math.round(Math.hypot(transform[0], transform[1]) || item.height || 11);
        const x = transform[4];
        const y = transform[5];

        const fontStyle = textContent.styles && textContent.styles[item.fontName];
        const rawFontName = ((fontStyle && fontStyle.fontFamily) || item.fontName || '').toLowerCase();
        const isBold = rawFontName.includes('bold') || rawFontName.includes('black') || rawFontName.includes('heavy') || rawFontName.includes('700') || rawFontName.includes('800') || rawFontName.includes('900') || rawFontName.includes('semibold');
        const isItalic = rawFontName.includes('italic') || rawFontName.includes('oblique');

        // Font family mapping
        let targetFont = 'Calibri';
        if (rawFontName.includes('times') || rawFontName.includes('serif') || rawFontName.includes('georgia') || rawFontName.includes('minion')) {
          targetFont = 'Times New Roman';
        } else if (rawFontName.includes('courier') || rawFontName.includes('mono') || rawFontName.includes('consolas')) {
          targetFont = 'Consolas';
        } else if (rawFontName.includes('arial') || rawFontName.includes('helvetica')) {
          targetFont = 'Arial';
        }

        const isItemRtl = rtlRegex.test(item.str);

        rawItems.push({
          text: item.str,
          x: x,
          y: y,
          width: item.width,
          fontSize: fontSize,
          bold: isBold,
          italic: isItalic,
          fontFamily: targetFont,
          isRtl: isItemRtl,
          hasEOL: item.hasEOL
        });
      });

      if (rawItems.length === 0) continue;

      // Check for multi-column layout on this page:
      // If items cluster in two distinct vertical zones with a clear center gutter
      const gutterLeft = pageWidth * 0.44;
      const gutterRight = pageWidth * 0.56;
      let leftCount = 0;
      let rightCount = 0;
      let spanningCount = 0;

      rawItems.forEach(it => {
        const itemRight = it.x + (it.width || 0);
        if (itemRight <= gutterLeft) leftCount++;
        else if (it.x >= gutterRight) rightCount++;
        else spanningCount++;
      });

      const isTwoColumnPage = leftCount >= 8 && rightCount >= 8 && (spanningCount < (leftCount + rightCount) * 0.18);
      if (isTwoColumnPage) detectedTwoColumnsTotal = true;

      // Partition items into column groups
      const columnGroups = [];
      if (isTwoColumnPage) {
        // Group full-width top header/title items
        const topThreshold = Math.max(...rawItems.map(it => it.y)) - 60;
        const headerItems = rawItems.filter(it => it.y >= topThreshold);
        const leftItems = rawItems.filter(it => it.y < topThreshold && (it.x + (it.width || 0)) <= gutterLeft);
        const rightItems = rawItems.filter(it => it.y < topThreshold && it.x >= gutterRight);
        const otherItems = rawItems.filter(it => it.y < topThreshold && !leftItems.includes(it) && !rightItems.includes(it));

        if (headerItems.length > 0) columnGroups.push(headerItems);
        if (leftItems.length > 0) columnGroups.push(leftItems);
        if (rightItems.length > 0) columnGroups.push(rightItems);
        if (otherItems.length > 0) columnGroups.push(otherItems);
      } else {
        columnGroups.push(rawItems);
      }

      // Process each column group into lines
      for (const group of columnGroups) {
        const linesMap = [];

        group.forEach(it => {
          let line = linesMap.find(l => Math.abs(l.y - it.y) <= 3.5);
          if (!line) {
            line = { y: it.y, items: [] };
            linesMap.push(line);
          }
          line.items.push(it);
        });

        // Sort lines descending by Y (top of page to bottom)
        linesMap.sort((a, b) => b.y - a.y);

        // Sort items within each line: LTR ascending X, RTL descending X if line is predominantly RTL
        linesMap.forEach(l => {
          const isLineRtl = l.items.filter(it => it.isRtl).length > l.items.length / 2;
          if (isLineRtl) {
            l.items.sort((a, b) => b.x - a.x);
          } else {
            l.items.sort((a, b) => a.x - b.x);
          }
        });

        const allFontSizes = [];
        linesMap.forEach(l => l.items.forEach(it => { if (it.text.trim()) allFontSizes.push(it.fontSize); }));
        allFontSizes.sort((a, b) => a - b);
        const medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)] || 11;

        // Detect consecutive table rows
        let lineIdx = 0;
        while (lineIdx < linesMap.length) {
          const line = linesMap[lineIdx];
          const fullLineText = line.items.map(it => it.text).join('').trim();
          if (!fullLineText) {
            lineIdx++;
            continue;
          }

          // Check if this line and next lines form a tabular structure (2-5 columns with matching X anchors)
          let tableRows = [];
          if (line.items.length >= 2 && line.items.length <= 5) {
            const baseCols = line.items.map(it => it.x);
            let checkIdx = lineIdx;
            while (checkIdx < linesMap.length) {
              const candLine = linesMap[checkIdx];
              if (candLine.items.length === baseCols.length) {
                const isMatch = candLine.items.every((it, ci) => Math.abs(it.x - baseCols[ci]) <= 25);
                if (isMatch) {
                  tableRows.push(candLine.items.map(it => it.text.trim()));
                  checkIdx++;
                  continue;
                }
              }
              break;
            }
          }

          if (tableRows.length >= 3) {
            // Found a table!
            detectedTablesTotal = true;
            docxParagraphs.push({
              type: 'table',
              hasHeader: true,
              rows: tableRows
            });

            // HTML preview for table
            let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:0.85rem; border:1px solid #cbd5e1;">';
            tableRows.forEach((r, rI) => {
              const isH = rI === 0;
              tableHtml += `<tr style="${isH ? 'background:#f1f5f9; font-weight:bold;' : 'border-top:1px solid #e2e8f0;'}">`;
              r.forEach(cell => {
                tableHtml += `<td style="padding:6px 10px; border:1px solid #cbd5e1;">${PDFConvert.escapeXml(cell)}</td>`;
              });
              tableHtml += '</tr>';
            });
            tableHtml += '</table>';
            htmlPreviewBlocks.push(tableHtml);

            lineIdx += tableRows.length;
            continue;
          }

          // Standard paragraph / heading / bullet line
          const cleanLower = fullLineText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          const maxFontSizeInLine = Math.max(...line.items.map(it => it.fontSize));
          const isLineBold = line.items.filter(it => it.text.trim()).every(it => it.bold);

          const isKeywordHeading = sectionKeywords.some(kw => cleanLower === kw || cleanLower.startsWith(kw + ' '));
          const isAllCapsShort = fullLineText === fullLineText.toUpperCase() && fullLineText.length >= 3 && fullLineText.length <= 40 && (isLineBold || maxFontSizeInLine >= medianFontSize);
          const isLargeHeading = maxFontSizeInLine >= medianFontSize * 1.35;
          const isSectionHeader = isKeywordHeading || (isAllCapsShort && (isLineBold || isLargeHeading));
          const isBullet = bulletRegex.test(fullLineText) || numberedListRegex.test(fullLineText);

          const hasWideGap = line.items.length >= 2 && (line.items[line.items.length - 1].x - (line.items[0].x + line.items[0].width)) > (pageWidth * 0.35);
          const isLineRtl = line.items.some(it => it.isRtl);

          const runs = [];
          let htmlLineContent = '';

          for (let j = 0; j < line.items.length; j++) {
            const item = line.items[j];
            let itemText = item.text;

            if (isBullet && j === 0 && bulletRegex.test(itemText)) {
              itemText = itemText.replace(bulletRegex, '');
            }

            if (!itemText) continue;

            if (hasWideGap && j === line.items.length - 1) {
              runs.push({ isTab: true });
              htmlLineContent += '<span style="display:inline-block; float:right;">';
            }

            const halfPoints = Math.round(Math.max(8, item.fontSize) * 2);
            runs.push({
              text: itemText,
              bold: item.bold || isSectionHeader,
              italic: item.italic,
              underline: false,
              fontFamily: item.fontFamily,
              isRtl: item.isRtl,
              fontSize: isSectionHeader ? Math.max(26, halfPoints) : halfPoints,
              color: isSectionHeader ? '0F172A' : (item.bold ? '1E293B' : '334155')
            });

            // Build preview run
            let runHtml = PDFConvert.escapeXml(itemText);
            if (item.bold || isSectionHeader) runHtml = `<strong>${runHtml}</strong>`;
            if (item.italic) runHtml = `<em>${runHtml}</em>`;
            htmlLineContent += runHtml;

            if (hasWideGap && j === line.items.length - 1) {
              htmlLineContent += '</span><div style="clear:both;"></div>';
            }
          }

          if (runs.length > 0) {
            let pType = 'paragraph';
            let headingLevel = 0;
            let hasBottomBorder = false;

            if (isSectionHeader) {
              pType = 'heading';
              headingLevel = maxFontSizeInLine >= medianFontSize * 1.5 ? 1 : 2;
              hasBottomBorder = true;
              htmlPreviewBlocks.push(`<h${headingLevel} style="border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; margin:16px 0 6px; color:#0f172a;${isLineRtl ? ' text-align:right; direction:rtl;' : ''}">${htmlLineContent}</h${headingLevel}>`);
            } else if (isBullet) {
              pType = 'bullet';
              htmlPreviewBlocks.push(`<li style="margin-left:20px; color:#334155; margin-bottom:4px;${isLineRtl ? ' text-align:right; direction:rtl;' : ''}">${htmlLineContent}</li>`);
            } else {
              htmlPreviewBlocks.push(`<p style="margin:4px 0; color:#334155;${isLineRtl ? ' text-align:right; direction:rtl;' : ''}">${htmlLineContent}</p>`);
            }

            docxParagraphs.push({
              type: pType,
              headingLevel: headingLevel,
              hasBottomBorder: hasBottomBorder,
              isBullet: isBullet,
              bulletChar: '•',
              isRtl: isLineRtl,
              align: isLineRtl ? 'right' : 'left',
              hasRightTab: hasWideGap,
              spacingBefore: isSectionHeader ? 220 : (isBullet ? 40 : 60),
              spacingAfter: isSectionHeader ? 80 : (isBullet ? 40 : 60),
              runs: runs
            });
          }

          lineIdx++;
        }
      }

      if (i < numPages) {
        docxParagraphs.push({
          type: 'paragraph',
          spacingBefore: 180,
          spacingAfter: 180,
          runs: [{ text: `--- Page Break (Page ${i} of ${numPages}) ---`, italic: true, fontSize: 18, color: '94A3B8' }]
        });
        htmlPreviewBlocks.push('<hr style="border:none; border-top:1px dashed #cbd5e1; margin:20px 0;">');
      }
    }

    // Scanned document notice if text layer is empty
    const isScannedDoc = totalExtractedChars < 15;
    if (isScannedDoc) {
      docxParagraphs.unshift({
        type: 'paragraph',
        spacingBefore: 120,
        spacingAfter: 120,
        runs: [{
          text: '[Notice: This PDF appears to be a scanned image or photograph without an embedded text layer. To extract editable text from scanned documents, use LocalDoc Image to Text (OCR) Studio.]',
          bold: true,
          color: 'DC2626',
          fontSize: 22
        }]
      });
      htmlPreviewBlocks.unshift('<div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:6px; padding:12px 16px; margin-bottom:16px; color:#9f1239; font-size:0.9rem;"><strong>⚠️ Scanned Document Notice:</strong> This PDF contains scanned images without an embedded text layer. To extract text, use our <a href="image-to-text.html" style="color:#0284c7; font-weight:bold; text-decoration:underline;">Image to Text (OCR) Tool</a>.</div>');
    }

    if (onProgress) onProgress(95, 'Compiling OpenXML Word Document (.docx)...');

    let docxBlob;
    if (typeof DocxBuilder !== 'undefined' && DocxBuilder.createDocxFromContent) {
      docxBlob = DocxBuilder.createDocxFromContent(docxParagraphs);
    } else {
      throw new Error("Word generation engine (DocxBuilder) failed to initialize.");
    }

    const htmlPreview = htmlPreviewBlocks.join('\n');
    const textPreview = docxParagraphs.map(p => (p.runs || []).map(r => r.text || '').join('')).join('\n');

    return {
      docxBlob: docxBlob,
      htmlPreview: htmlPreview,
      textPreview: textPreview,
      pageCount: numPages,
      paragraphCount: docxParagraphs.length,
      isScanned: isScannedDoc,
      hasTwoColumns: detectedTwoColumnsTotal,
      hasTables: detectedTablesTotal
    };
  },

  // Create a realistic sample Word (.docx) document in browser memory for 1-click testing
  createSampleWordDocument() {
    if (typeof DocxBuilder === 'undefined' || !DocxBuilder.createDocxFromContent) return null;
    const sampleParagraphs = [
      { text: "INDEPENDENT CONSULTING AGREEMENT", bold: true, fontSize: 30, color: "0284C7", type: "heading", headingLevel: 1 },
      { text: "Confidential Execution Copy — Processed Locally in RAM", italic: true, fontSize: 18, color: "64748B" },
      { type: "divider" },
      { text: "1. PARTIES & ENGAGEMENT", bold: true, fontSize: 22, color: "0F172A", type: "heading", headingLevel: 2 },
      { text: "This Independent Consulting Agreement (\"Agreement\") is entered into between Apex Digital Technologies Corp (\"Client\") and Vertex Solutions LLC (\"Consultant\"). Both parties agree that all project data, codebases, and financial calculations remain strictly confidential under local client-side processing policies." },
      { text: "2. SCOPE OF WORK & KEY MILESTONES", bold: true, fontSize: 22, color: "0F172A", type: "heading", headingLevel: 2 },
      { text: "Consultant shall execute the following engineering milestones according to industry best practices:", spacingAfter: 80 },
      { text: "Audit client-side document processing memory management.", isBullet: true },
      { text: "Configure zero-upload in-memory OpenXML document compilation.", isBullet: true },
      { text: "Deliver ISO 32000-1 conformant PDF output with auto-table wrapping.", isBullet: true },
      { text: "3. COMPENSATION & DELIVERABLE SCHEDULE", bold: true, fontSize: 22, color: "0F172A", type: "heading", headingLevel: 2 },
      {
        type: "table",
        hasHeader: true,
        rows: [
          ["Deliverable Phase", "Timeline", "Fee (USD)", "Verification Status"],
          ["Phase 1: Architecture Review", "Week 1 - 2", "$3,500.00", "Approved"],
          ["Phase 2: In-RAM Processing", "Week 3 - 4", "$5,200.00", "In Progress"],
          ["Phase 3: Final ISO Delivery", "Week 5", "$2,800.00", "Pending Sign-off"]
        ]
      },
      { type: "divider" },
      { text: "4. PRIVACY & COMPLIANCE CERTIFICATION", bold: true, fontSize: 22, color: "0F172A", type: "heading", headingLevel: 2 },
      { text: "The parties certify that no confidential company data, client intellectual property, or financial records were transmitted over external networks or stored in third-party cloud repositories." }
    ];

    const blob = DocxBuilder.createDocxFromContent(sampleParagraphs, { title: "Sample-Consulting-Agreement" });
    return new File([blob], "Sample-Consulting-Agreement.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  },

    // 4. Word (.docx) to PDF — Professional-Grade In-RAM Pipeline (Mammoth + Metric Fonts + Smart Tables + Landscape + html2pdf + Vector Stamping)
  async wordToPDF(file, onProgress = null, options = {}) {
    if (onProgress) onProgress(15, 'Reading Word Document XML Structure in RAM...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    
    // Landscape Auto-Detection via DOCX OpenXML
    let isLandscape = false;
    if (typeof JSZip !== 'undefined') {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const docXmlFile = zip.file("word/document.xml");
        if (docXmlFile) {
          const docXml = await docXmlFile.async("string");
          if (/w:orient="landscape"/i.test(docXml)) {
            isLandscape = true;
          } else {
            const pgSzMatch = docXml.match(/<w:pgSz\s+[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/i) || docXml.match(/<w:pgSz\s+[^>]*w:h="(\d+)"[^>]*w:w="(\d+)"/i);
            if (pgSzMatch) {
              const w = parseInt(pgSzMatch[1], 10);
              const h = parseInt(pgSzMatch[2], 10);
              if (w > h) isLandscape = true;
            }
          }
        }
      } catch (orientErr) {
        console.warn("Landscape auto-detection fallback to portrait:", orientErr);
      }
    }

    // Parse complete HTML structure from DOCX with Mammoth (with inline image data URL conversion)
    let mammothResult;
    try {
      const mammothOptions = {};
      if (typeof mammoth !== 'undefined' && mammoth.images && mammoth.images.imgElement) {
        mammothOptions.convertImage = mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        });
      }
      mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, mammothOptions);
    } catch (e) {
      console.warn('Mammoth convertToHtml failed, falling back to raw text:', e);
      const rawRes = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      mammothResult = { value: `<p>${PDFConvert.escapeXml(rawRes.value || '')}</p>`, messages: [] };
    }

    const docHtml = mammothResult.value || '<p>Empty Document</p>';

    // Primary High-Fidelity Pipeline: Render in styled A4 off-screen DOM with html2pdf
    if (typeof html2pdf !== 'undefined') {
      try {
        if (onProgress) onProgress(45, isLandscape ? 'Applying Landscape A4 Layout & Metric Typography...' : 'Applying Portrait A4 Layout & Metric Typography...');

        const stage = document.createElement('div');
        stage.id = 'word-offscreen-render-stage';
        
        // Exact A4 dimensions @ 96 DPI: Portrait 794x1123px, Landscape 1123x794px
        const stageW = isLandscape ? 1123 : 794;
        const stageH = isLandscape ? 794 : 1123;
        
        stage.style.cssText = `
          position: fixed;
          top: -99999px;
          left: -99999px;
          width: ${stageW}px;
          min-height: ${stageH}px;
          padding: 44px 52px;
          background: #ffffff;
          color: #1e293b;
          font-family: 'Carlito', Calibri, 'Arimo', Arial, 'Tinos', 'Times New Roman', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          box-sizing: border-box;
          z-index: -9999;
        `;

        // Smart Table Pagination & Metric Font rules
        stage.innerHTML = `
          <style>
            #word-offscreen-render-stage * {
              box-sizing: border-box;
            }
            #word-offscreen-render-stage h1,
            #word-offscreen-render-stage h2,
            #word-offscreen-render-stage h3,
            #word-offscreen-render-stage h4 {
              color: #0f172a;
              page-break-after: avoid !important;
              break-after: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-top: 1.2em;
              margin-bottom: 0.5em;
              font-weight: 700;
            }
            #word-offscreen-render-stage h1 { font-size: 20pt; border-bottom: 2px solid #0284c7; padding-bottom: 4px; }
            #word-offscreen-render-stage h2 { font-size: 16pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
            #word-offscreen-render-stage h3 { font-size: 13pt; }
            #word-offscreen-render-stage p {
              margin: 0 0 0.85em;
              line-height: 1.6;
              word-break: break-word;
            }
            /* Smart Table Pagination: allow long tables to flow, break only at row boundary */
            #word-offscreen-render-stage table {
              width: 100% !important;
              max-width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              margin: 16px 0 !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            #word-offscreen-render-stage thead {
              display: table-header-group !important;
            }
            #word-offscreen-render-stage tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #word-offscreen-render-stage th,
            #word-offscreen-render-stage td {
              border: 1px solid #cbd5e1 !important;
              padding: 8px 10px !important;
              text-align: left !important;
              vertical-align: top !important;
              word-break: break-word !important;
              font-size: 9.5pt !important;
              line-height: 1.4 !important;
            }
            #word-offscreen-render-stage th {
              background-color: #f8fafc !important;
              color: #0f172a !important;
              font-weight: 600 !important;
            }
            #word-offscreen-render-stage img {
              max-width: 100% !important;
              height: auto !important;
              display: block !important;
              margin: 14px 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #word-offscreen-render-stage ul,
            #word-offscreen-render-stage ol {
              margin: 0 0 1em 1.5em;
              padding: 0;
            }
            #word-offscreen-render-stage li {
              margin-bottom: 0.35em;
              line-height: 1.5;
            }
            #word-offscreen-render-stage blockquote {
              border-left: 4px solid #0284c7;
              padding-left: 14px;
              margin: 1em 0;
              color: #475569;
              font-style: italic;
            }
          </style>
          <div class="word-content-inner">${docHtml}</div>
        `;

        document.body.appendChild(stage);

        if (onProgress) onProgress(75, 'Compiling Vector-Quality A4 PDF Pages...');

        const opt = {
          margin: [10, 10, 10, 10],
          filename: (file.name || 'document').replace(/\.[^/.]+$/, '') + '.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: isLandscape ? 'landscape' : 'portrait'
          },
          pagebreak: {
            mode: ['avoid-all', 'css', 'legacy']
          }
        };

        const worker = html2pdf().from(stage).set(opt);
        const pdf = await worker.toPdf().get('pdf');
        const pageCount = pdf.internal.getNumberOfPages() || 1;
        let pdfBlob = pdf.output('blob');

        document.body.removeChild(stage);

        // Vector Stamping for Formatting Toggles (Page Numbers & Watermark)
        if ((options.addPageNumbers || options.addWatermark) && typeof PDFLib !== 'undefined') {
          try {
            if (onProgress) onProgress(90, 'Injecting Vector Page Numbers & Confidential Watermark...');
            const pdfBytes = await pdfBlob.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            const pages = pdfDoc.getPages();
            const total = pages.length;

            for (let i = 0; i < total; i++) {
              const p = pages[i];
              const { width, height } = p.getSize();

              // Watermark Overlay
              if (options.addWatermark) {
                const watermarkText = (options.watermarkText || 'CONFIDENTIAL').toUpperCase();
                const textWidth = boldFont.widthOfTextAtSize(watermarkText, 52);
                p.drawText(watermarkText, {
                  x: width / 2 - (textWidth / 2) * 0.7,
                  y: height / 2 - 20,
                  size: 52,
                  font: boldFont,
                  color: PDFLib.rgb(0.7, 0.75, 0.8),
                  opacity: 0.16,
                  rotate: PDFLib.degrees(38)
                });
              }

              // Centered Running Page Number Footer
              if (options.addPageNumbers) {
                const pageText = `Page ${i + 1} of ${total}`;
                const textWidth = font.widthOfTextAtSize(pageText, 9);
                p.drawText(pageText, {
                  x: width / 2 - textWidth / 2,
                  y: 18,
                  size: 9,
                  font: font,
                  color: PDFLib.rgb(0.45, 0.5, 0.55)
                });
              }
            }
            const stampedBytes = await pdfDoc.save();
            pdfBlob = new Blob([stampedBytes], { type: 'application/pdf' });
          } catch (stampErr) {
            console.warn('Vector stamping issue, continuing with base PDF:', stampErr);
          }
        }

        if (onProgress) onProgress(100, 'Conversion Complete!');

        return {
          pdfBlob: pdfBlob,
          htmlPreview: docHtml,
          pageCount: pageCount,
          isLandscape: isLandscape
        };
      } catch (pipelineErr) {
        console.warn('html2pdf pipeline encountered an issue, running canvas fallback:', pipelineErr);
        const existingStage = document.getElementById('word-offscreen-render-stage');
        if (existingStage && existingStage.parentNode) {
          existingStage.parentNode.removeChild(existingStage);
        }
        // Fall back to Canvas 2D engine below
      }
    }

    if (onProgress) onProgress(40, 'Typesetting A4 Document Pages in High-Resolution Canvas Fallback...');

    // Parse HTML DOM into structured layout blocks
    const parser = new DOMParser();
    const doc = parser.parseFromString(docHtml, 'text/html');
    const body = doc.body;

    // High-Resolution A4 Page Setup (1240 x 1754 px @ 150 DPI)
    const pageW = 1240;
    const pageH = 1754;
    const marginL = 90;
    const marginR = 90;
    const marginT = 90;
    const marginB = 90;
    const contentW = pageW - marginL - marginR;
    const maxContentY = pageH - marginB;

    const pages = [];

    function startNewPage() {
      const canvas = document.createElement('canvas');
      canvas.width = pageW;
      canvas.height = pageH;
      const ctx = canvas.getContext('2d');
      // Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pageW, pageH);
      return {
        canvas: canvas,
        ctx: ctx,
        currentY: marginT,
        pageNumber: pages.length + 1
      };
    }

    let curPage = startNewPage();
    pages.push(curPage);

    // Text wrapping helper
    function wrapTextLines(ctx, text, maxWidth) {
      const words = String(text || '').split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) return [];
      const lines = [];
      let curLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const testLine = curLine + ' ' + words[i];
        if (ctx.measureText(testLine).width <= maxWidth) {
          curLine = testLine;
        } else {
          lines.push(curLine);
          curLine = words[i];
        }
      }
      lines.push(curLine);
      return lines;
    }

    function checkPageBreak(requiredHeight) {
      if (curPage.currentY + requiredHeight > maxContentY) {
        curPage = startNewPage();
        pages.push(curPage);
      }
    }

    // Iterate through top-level block elements
    const childNodes = Array.from(body.children);
    if (childNodes.length === 0 && body.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = body.textContent;
      childNodes.push(p);
    }

    for (let nodeIdx = 0; nodeIdx < childNodes.length; nodeIdx++) {
      const node = childNodes[nodeIdx];
      const tag = node.tagName.toUpperCase();

      if (tag === 'H1') {
        const text = node.textContent.trim();
        curPage.ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        const lines = wrapTextLines(curPage.ctx, text, contentW);
        const blockHeight = lines.length * 38 + 24;
        checkPageBreak(blockHeight);

        curPage.ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        curPage.ctx.fillStyle = '#0F172A';
        lines.forEach(line => {
          curPage.ctx.fillText(line, marginL, curPage.currentY + 28);
          curPage.currentY += 38;
        });

        // Accent bottom bar
        curPage.ctx.strokeStyle = '#0284C7';
        curPage.ctx.lineWidth = 2.5;
        curPage.ctx.beginPath();
        curPage.ctx.moveTo(marginL, curPage.currentY + 2);
        curPage.ctx.lineTo(marginL + contentW, curPage.currentY + 2);
        curPage.ctx.stroke();
        curPage.currentY += 16;

      } else if (tag === 'H2') {
        const text = node.textContent.trim();
        curPage.ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        const lines = wrapTextLines(curPage.ctx, text, contentW);
        const blockHeight = lines.length * 32 + 18;
        checkPageBreak(blockHeight);

        curPage.ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        curPage.ctx.fillStyle = '#1E293B';
        lines.forEach(line => {
          curPage.ctx.fillText(line, marginL, curPage.currentY + 22);
          curPage.currentY += 32;
        });

        curPage.ctx.strokeStyle = '#CBD5E1';
        curPage.ctx.lineWidth = 1.5;
        curPage.ctx.beginPath();
        curPage.ctx.moveTo(marginL, curPage.currentY + 2);
        curPage.ctx.lineTo(marginL + contentW, curPage.currentY + 2);
        curPage.ctx.stroke();
        curPage.currentY += 14;

      } else if (tag === 'H3' || tag === 'H4') {
        const text = node.textContent.trim();
        curPage.ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        const lines = wrapTextLines(curPage.ctx, text, contentW);
        const blockHeight = lines.length * 26 + 12;
        checkPageBreak(blockHeight);

        curPage.ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        curPage.ctx.fillStyle = '#334155';
        lines.forEach(line => {
          curPage.ctx.fillText(line, marginL, curPage.currentY + 18);
          curPage.currentY += 26;
        });
        curPage.currentY += 8;

      } else if (tag === 'UL' || tag === 'OL') {
        const listItems = Array.from(node.querySelectorAll('li'));
        const isNumbered = tag === 'OL';

        for (let liIdx = 0; liIdx < listItems.length; liIdx++) {
          const li = listItems[liIdx];
          const text = li.textContent.trim();
          curPage.ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
          const lines = wrapTextLines(curPage.ctx, text, contentW - 36);
          const blockHeight = lines.length * 24 + 6;
          checkPageBreak(blockHeight);

          // Draw bullet dot / number
          curPage.ctx.fillStyle = '#0284C7';
          if (isNumbered) {
            curPage.ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
            curPage.ctx.fillText(`${liIdx + 1}.`, marginL + 6, curPage.currentY + 16);
          } else {
            curPage.ctx.beginPath();
            curPage.ctx.arc(marginL + 12, curPage.currentY + 11, 3.5, 0, Math.PI * 2);
            curPage.ctx.fill();
          }

          // Draw item text
          curPage.ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
          curPage.ctx.fillStyle = '#334155';
          lines.forEach((line, lIdx) => {
            curPage.ctx.fillText(line, marginL + 34, curPage.currentY + 16);
            curPage.currentY += 24;
          });
          curPage.currentY += 4;
        }
        curPage.currentY += 8;

      } else if (tag === 'TABLE') {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length > 0) {
          const colCount = Math.max(...rows.map(r => r.querySelectorAll('th, td').length), 1);
          const colW = contentW / colCount;
          const rowH = 34;

          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            checkPageBreak(rowH + 4);
            const row = rows[rIdx];
            const cells = Array.from(row.querySelectorAll('th, td'));
            const isHeader = rIdx === 0 && row.querySelector('th') !== null;

            // Row background
            curPage.ctx.fillStyle = isHeader  ?  '#F1F5F9' : (rIdx % 2 === 0  ?  '#FAFAFA' : '#FFFFFF');
            curPage.ctx.fillRect(marginL, curPage.currentY, contentW, rowH);

            // Draw cells
            cells.forEach((cell, cIdx) => {
              const cellX = marginL + cIdx * colW;
              const cellText = cell.textContent.trim();

              curPage.ctx.strokeStyle = '#CBD5E1';
              curPage.ctx.lineWidth = 1;
              curPage.ctx.strokeRect(cellX, curPage.currentY, colW, rowH);

              curPage.ctx.font = isHeader  ?  'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif' : '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
              curPage.ctx.fillStyle = isHeader  ?  '#0F172A' : '#334155';

              // Truncate cell text if overflowing
              let displayCell = cellText;
              while (displayCell.length > 0 && curPage.ctx.measureText(displayCell).width > colW - 16) {
                displayCell = displayCell.substring(0, displayCell.length - 1);
              }
              curPage.ctx.fillText(displayCell, cellX + 8, curPage.currentY + 22);
            });

            curPage.currentY += rowH;
          }
          curPage.currentY += 12;
        }

      } else if (tag === 'HR') {
        checkPageBreak(24);
        curPage.ctx.strokeStyle = '#CBD5E1';
        curPage.ctx.lineWidth = 1;
        curPage.ctx.beginPath();
        curPage.ctx.moveTo(marginL, curPage.currentY + 12);
        curPage.ctx.lineTo(marginL + contentW, curPage.currentY + 12);
        curPage.ctx.stroke();
        curPage.currentY += 24;

      } else if (tag === 'BLOCKQUOTE') {
        const text = node.textContent.trim();
        curPage.ctx.font = 'italic 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
        const lines = wrapTextLines(curPage.ctx, text, contentW - 30);
        const blockHeight = lines.length * 24 + 16;
        checkPageBreak(blockHeight);

        // Left accent bar
        curPage.ctx.fillStyle = '#0284C7';
        curPage.ctx.fillRect(marginL + 6, curPage.currentY + 4, 4, blockHeight - 8);

        curPage.ctx.fillStyle = '#64748B';
        lines.forEach(line => {
          curPage.ctx.fillText(line, marginL + 24, curPage.currentY + 18);
          curPage.currentY += 24;
        });
        curPage.currentY += 10;

      } else {
        // Standard Paragraph <P> or other containers
        const text = node.textContent.trim();
        if (text) {
          const hasBold = node.querySelector('strong, b') !== null;
          curPage.ctx.font = hasBold  ?  'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif' : '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
          const lines = wrapTextLines(curPage.ctx, text, contentW);
          const blockHeight = lines.length * 24 + 10;
          checkPageBreak(blockHeight);

          curPage.ctx.fillStyle = hasBold  ?  '#0F172A' : '#334155';
          lines.forEach(line => {
            curPage.ctx.fillText(line, marginL, curPage.currentY + 17);
            curPage.currentY += 24;
          });
          curPage.currentY += 8;
        }
      }
    }

    if (onProgress) onProgress(75, 'Embedding Canvas Pages into Standardized A4 Vector PDF...');

    // Create PDF document and draw footer page numbers
    const pdfDoc = await PDFLib.PDFDocument.create();
    const totalPages = pages.length;

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const p = pages[pIdx];
      
      // Footer page numbering
      p.ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
      p.ctx.fillStyle = '#94A3B8';
      p.ctx.textAlign = 'center';
      p.ctx.fillText(`Page ${pIdx + 1} of ${totalPages}`, pageW / 2, pageH - 40);
      p.ctx.textAlign = 'left';

      // Export canvas directly via toBlob (100% origin-clean, guaranteed zero security exception)
      const pageJpgBlob = await new Promise(res => p.canvas.toBlob(res, 'image/jpeg', 0.95));
      const pageJpgBuf = await pageJpgBlob.arrayBuffer();
      const embeddedPageImg = await pdfDoc.embedJpg(pageJpgBuf);

      const pdfPage = pdfDoc.addPage([595.28, 841.89]);
      pdfPage.drawImage(embeddedPageImg, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89
      });
    }

    if (onProgress) onProgress(98, 'Finalizing PDF output...');
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob: pdfBlob,
      htmlPreview: docHtml,
      pageCount: totalPages
    };
  },

  // 5. PDF to Excel (.xlsx & .csv) — High-Precision Column Clustering & Number Formatting
  async pdfToExcel(file, onProgress = null, options = {}) {
    const mode = options.mode || 'auto'; // 'auto' | 'bank_statement'
    const consolidateSheets = options.consolidate !== false; // default true
    if (onProgress) onProgress(15, 'Reading PDF document structure in RAM...');
    
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const numPages = pdf.numPages;

    // Helper: Parse currency and formatted numbers to true native floats
    function parseNumericCell(rawStr) {
      if (typeof rawStr !== 'string') return rawStr;
      const trimmed = rawStr.trim();
      if (!trimmed) return '';

      // Check accounting negative format: (1,250.00) or (500)
      let isNegative = false;
      let clean = trimmed;
      if (/^\((.+)\)$/.test(clean)) {
        isNegative = true;
        clean = clean.replace(/^\((.+)\)$/, '$1').trim();
      }

      // Strip currency prefixes & suffixes (PKR, Rs, USD, $, EUR, €, GBP, £, INR, ₹)
      clean = clean.replace(/^(PKR|Rs\.?|USD|\$|EUR|€|GBP|£|INR|₹)\s*/i, '');
      clean = clean.replace(/\s*(PKR|Rs\.?|USD|\$|EUR|€|GBP|£|INR|₹)$/i, '');

      // Check if percentage e.g. 15.5%
      let isPct = false;
      if (clean.endsWith('%')) {
        isPct = true;
        clean = clean.slice(0, -1).trim();
      }

      // Standard comma thousands e.g. 1,250,500.00
      if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
        clean = clean.replace(/,/g, '');
      } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
        // European format e.g. 1.250.500,00
        clean = clean.replace(/\./g, '').replace(',', '.');
      }

      // Pure integer or float
      if (/^-?\d+(\.\d+)?$/.test(clean)) {
        let num = parseFloat(clean);
        if (isNaN(num)) return trimmed;
        if (isNegative && num > 0) num = -num;
        if (isPct) num = num / 100;
        return num;
      }

      return trimmed;
    }

    // Step 1: Pre-flight scan across all pages to check for digital text vs scanned image
    let totalTextItemsCount = 0;
    const pagesTextData = [];

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(15 + Math.round((i / numPages) * 20), `Scanning Page ${i} of ${numPages} in RAM...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = (textContent.items || []).filter(it => (it.str || '').trim().length > 0);
      totalTextItemsCount += items.length;
      pagesTextData.push({ pageNum: i, items, viewport: page.getViewport({ scale: 1.0 }) });
    }

    if (totalTextItemsCount === 0) {
      throw new Error("This PDF appears to be a scanned image with no selectable text layer. Please use our Image to Text (OCR) tool to extract text before converting to Excel.");
    }

    // Step 2: Extract structured 2D table grid for each page
    const wb = XLSX.utils.book_new();
    const allSheetsData = [];
    const consolidatedRows = [];
    let detectedHeaderSignature = null;

    for (let pIdx = 0; pIdx < pagesTextData.length; pIdx++) {
      const pageNum = pIdx + 1;
      const { items } = pagesTextData[pIdx];

      if (onProgress) onProgress(35 + Math.round((pageNum / numPages) * 50), `Extracting Tabular Grid from Page ${pageNum} of ${numPages}...`);

      if (!items || items.length === 0) {
        allSheetsData.push({ sheetName: `Page ${pageNum}`, data: [['[Empty Page]']] });
        continue;
      }

      // 1. Group items into lines (Y-clustering with 4.0px tolerance)
      const rawLines = [];
      items.forEach(item => {
        const text = (item.str || '').trim();
        if (!text) return;
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width || 0;
        const h = item.height || 10;

        let line = rawLines.find(l => Math.abs(l.y - y) <= 4.0);
        if (!line) {
          line = { y: y, items: [] };
          rawLines.push(line);
        }
        line.items.push({ x, y, width: w, height: h, text });
      });

      // Sort lines top-to-bottom (higher Y = higher in PDF coordinates)
      rawLines.sort((a, b) => b.y - a.y);

      // 2. Tokenize each line into coherent cell phrases by joining nearby words
      const linePhrases = [];
      const allPhraseStarts = [];

      rawLines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        const phrases = [];

        for (let j = 0; j < line.items.length; j++) {
          const it = line.items[j];
          if (phrases.length === 0) {
            phrases.push({ x: it.x, right: it.x + it.width, text: it.text });
          } else {
            const prev = phrases[phrases.length - 1];
            const gap = it.x - prev.right;
            // If words are adjacent (gap between -1.5px and 9.0px), combine into the same phrase
            if (gap >= -1.5 && gap <= 9.0) {
              prev.text += (gap > 1.2 ? ' ' : '') + it.text;
              prev.right = Math.max(prev.right, it.x + it.width);
            } else {
              phrases.push({ x: it.x, right: it.x + it.width, text: it.text });
            }
          }
        }

        if (phrases.length > 0) {
          linePhrases.push({ y: line.y, phrases });
          phrases.forEach(p => allPhraseStarts.push(p.x));
        }
      });

      // 3. Compute distinct column anchors along the horizontal X-axis
      allPhraseStarts.sort((a, b) => a - b);
      const colAnchors = [];
      allPhraseStarts.forEach(x => {
        if (!colAnchors.some(a => Math.abs(a - x) <= 16)) {
          colAnchors.push(x);
        }
      });
      colAnchors.sort((a, b) => a - b);

      // 4. Map line phrases into discrete column slots
      const rawGridRows = [];

      linePhrases.forEach(line => {
        const rowCells = new Array(Math.max(1, colAnchors.length)).fill('');

        line.phrases.forEach(p => {
          // Find closest column anchor
          let bestIdx = 0;
          let minDiff = Infinity;
          colAnchors.forEach((anchor, cIdx) => {
            const diff = Math.abs(anchor - p.x);
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = cIdx;
            }
          });

          if (rowCells[bestIdx]) {
            rowCells[bestIdx] += ' ' + p.text;
          } else {
            rowCells[bestIdx] = p.text;
          }
        });

        // Trim empty trailing columns
        while (rowCells.length > 1 && rowCells[rowCells.length - 1] === '') {
          rowCells.pop();
        }

        if (rowCells.some(c => c !== '')) {
          rawGridRows.push({ y: line.y, cells: rowCells });
        }
      });

      // 5. Intelligent Multi-Line Cell Merging (Wrap repair)
      const pageRows = [];
      for (let r = 0; r < rawGridRows.length; r++) {
        const curr = rawGridRows[r];
        if (pageRows.length > 0) {
          const prev = pageRows[pageRows.length - 1];
          const yGap = Math.abs(prev.y - curr.y);

          // If current row only has 1 non-empty cell and vertical gap is small (wrapped line),
          // merge into previous row's corresponding column
          const filledCols = curr.cells.map((c, i) => (c ? i : -1)).filter(i => i !== -1);
          if (filledCols.length === 1 && yGap <= 15.0) {
            const targetCol = filledCols[0];
            if (prev.cells[targetCol]) {
              prev.cells[targetCol] += ' ' + curr.cells[targetCol];
              continue;
            }
          }
        }
        pageRows.push(curr);
      }

      // Convert row cells using parseNumericCell
      let finalPageData = pageRows.map(r => r.cells.map(c => parseNumericCell(c)));

      // 6. Bank Statement & Ledger Filter
      if (mode === 'bank_statement') {
        const isHeaderRow = (row) => {
          const text = row.map(c => String(c).toLowerCase()).join(' ');
          return (text.includes('date') || text.includes('particular')) &&
                 (text.includes('debit') || text.includes('credit') || text.includes('balance') || text.includes('amount') || text.includes('withdrawal'));
        };

        const isNoiseRow = (row) => {
          const text = row.map(c => String(c).toLowerCase()).join(' ');
          return text.includes('page ') || text.includes('generated on') || text.includes('computer generated') || text.includes('statement period');
        };

        // Filter out footer noise
        finalPageData = finalPageData.filter(row => !isNoiseRow(row));

        if (pageNum > 1) {
          // Skip repeated table headers on subsequent pages
          finalPageData = finalPageData.filter(row => !isHeaderRow(row));
        } else {
          // On page 1, record the header signature
          const headerIdx = finalPageData.findIndex(isHeaderRow);
          if (headerIdx !== -1) {
            detectedHeaderSignature = finalPageData[headerIdx].map(c => String(c).trim());
          }
        }
      }

      if (finalPageData.length === 0) {
        finalPageData.push(['[Empty Page / No Tabular Text Detected]']);
      }

      allSheetsData.push({
        sheetName: `Page ${pageNum}`,
        data: finalPageData
      });

      // Multi-page consolidation
      if (pageNum === 1) {
        consolidatedRows.push(...finalPageData);
      } else {
        // If not bank statement mode, check if page has identical header row to page 1
        let rowsToAdd = finalPageData;
        if (consolidatedRows.length > 0 && finalPageData.length > 0) {
          const firstRowStr = finalPageData[0].map(c => String(c).trim()).join('|');
          const headerStr = consolidatedRows[0].map(c => String(c).trim()).join('|');
          if (firstRowStr === headerStr) {
            rowsToAdd = finalPageData.slice(1);
          }
        }
        consolidatedRows.push(...rowsToAdd);
      }
    }

    // Step 3: Build OpenXML Workbook (.xlsx)
    if (consolidateSheets && numPages > 1) {
      // Sheet 1: Master Consolidated Table
      const masterSheetName = (mode === 'bank_statement') ? 'Transactions' : 'Consolidated Table';
      const masterWs = XLSX.utils.aoa_to_sheet(consolidatedRows);
      
      // Auto-fit column widths
      const colWidths = [];
      consolidatedRows.forEach(row => {
        row.forEach((cell, cIdx) => {
          const len = String(cell ?? '').length;
          colWidths[cIdx] = Math.max(colWidths[cIdx] || 10, Math.min(len + 3, 50));
        });
      });
      masterWs['!cols'] = colWidths.map(w => ({ wch: w }));

      XLSX.utils.book_append_sheet(wb, masterWs, masterSheetName);

      // Prepend consolidated sheet to allSheetsData for the live UI preview
      allSheetsData.unshift({
        sheetName: masterSheetName,
        data: consolidatedRows
      });
    }

    // Add individual page sheets
    allSheetsData.forEach(s => {
      if (s.sheetName === 'Consolidated Table' || s.sheetName === 'Transactions') return;
      const ws = XLSX.utils.aoa_to_sheet(s.data);
      const colWidths = [];
      s.data.forEach(row => {
        row.forEach((cell, cIdx) => {
          const len = String(cell ?? '').length;
          colWidths[cIdx] = Math.max(colWidths[cIdx] || 10, Math.min(len + 3, 50));
        });
      });
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, s.sheetName);
    });

    if (onProgress) onProgress(95, 'Compiling OpenXML Workbook (.xlsx)...');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Generate CSV from primary sheet
    const primaryWsName = wb.SheetNames[0];
    const primaryWs = wb.Sheets[primaryWsName];
    const csvContent = XLSX.utils.sheet_to_csv(primaryWs);
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    return {
      xlsxBlob: xlsxBlob,
      csvBlob: csvBlob,
      sheetsData: allSheetsData,
      totalSheets: wb.SheetNames.length,
      mode: mode,
      totalRows: consolidatedRows.length > 0 ? consolidatedRows.length : allSheetsData[0]?.data?.length || 0
    };
  },

  // 6. Excel to PDF (.pdf) with multi-sheet & orientation controls
  async excelToPDF(file, options = {}, onProgress = null) {
    if (onProgress) onProgress(25, 'Parsing Excel Workbook Sheets in RAM...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetNames = wb.SheetNames;
    const orientation = options.orientation || 'landscape';
    const showGridlines = options.showGridlines !== false;

    if (onProgress) onProgress(50, 'Building Vector A4 PDF Table Pages...');
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    const isLandscape = orientation === 'landscape';
    const a4Width = isLandscape  ?  841.89 : 595.28;
    const a4Height = isLandscape  ?  595.28 : 841.89;
    const margin = 36;
    const rowHeight = 22;

    const sheetsInfo = [];

    for (const sheetName of sheetNames) {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!data || data.length === 0) continue;

      sheetsInfo.push({ name: sheetName, rows: data.length, cols: Math.max(...data.map(r => r.length), 0) });

      const maxCols = Math.min(12, Math.max(...data.map(r => r.length), 1));
      const colWidth = (a4Width - margin * 2) / Math.max(1, maxCols);

      let page = pdfDoc.addPage([a4Width, a4Height]);
      let currentY = a4Height - margin;

      // Sheet Title Header
      page.drawText(sheetName.substring(0, 40), {
        x: margin,
        y: currentY - 4,
        size: 12,
        font: boldFont,
        color: PDFLib.rgb(0.01, 0.52, 0.78)
      });
      currentY -= 28;

      data.forEach((row, rowIdx) => {
        if (currentY < margin + rowHeight) {
          page = pdfDoc.addPage([a4Width, a4Height]);
          currentY = a4Height - margin;
        }

        const isHeader = rowIdx === 0;

        if (isHeader) {
          page.drawRectangle({
            x: margin,
            y: currentY - 4,
            width: a4Width - margin * 2,
            height: rowHeight,
            color: PDFLib.rgb(0.01, 0.52, 0.78)
          });
        } else if (rowIdx % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: currentY - 4,
            width: a4Width - margin * 2,
            height: rowHeight,
            color: PDFLib.rgb(0.96, 0.97, 0.98)
          });
        }

        for (let c = 0; c < maxCols; c++) {
          const rawCell = row[c] !== undefined && row[c] !== null  ?  String(row[c]) : '';
          const safeCell = PDFConvert.sanitizeWinAnsiText(rawCell).substring(0, 26);

          page.drawText(safeCell, {
            x: margin + c * colWidth + 5,
            y: currentY + 4,
            size: isHeader  ?  8.5 : 8,
            font: isHeader  ?  boldFont : font,
            color: isHeader  ?  PDFLib.rgb(1, 1, 1) : PDFLib.rgb(0.12, 0.16, 0.22)
          });

          if (showGridlines && !isHeader) {
            page.drawRectangle({
              x: margin + c * colWidth,
              y: currentY - 4,
              width: colWidth,
              height: rowHeight,
              borderColor: PDFLib.rgb(0.88, 0.91, 0.94),
              borderWidth: 0.5
            });
          }
        }
        currentY -= rowHeight;
      });
    }

    if (pdfDoc.getPageCount() === 0) {
      pdfDoc.addPage([a4Width, a4Height]);
    }

    if (onProgress) onProgress(95, 'Finalizing Spreadsheet PDF Document...');
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob: pdfBlob,
      sheetsInfo: sheetsInfo,
      sheetNames: sheetNames
    };
  }
};

window.PDFConvert = PDFConvert;
