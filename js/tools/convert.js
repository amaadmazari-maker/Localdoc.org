/**
 * localdoc.org — PDF & Document Conversion Engine (js/tools/convert.js)
 * Real client-side conversions: PDF <-> Word, PDF <-> Excel, PDF <-> Images.
 * Zero cloud uploads. 100% in-browser RAM execution.
 */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/workers/pdf.worker.js';
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
      .replace(/[^\x00-\x7F]/g, () => '?');
  },

  // 1. PDF to Images (JPG / PNG) with selectable DPI
  async pdfToImages(file, format = 'image/jpeg', dpiScale = 2.0, onProgress = null) {
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

      const quality = format === 'image/png' ? 1.0 : 0.92;
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
    const zip = typeof MiniZip !== 'undefined' ? new MiniZip() : null;
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
    const margin = options.margin !== undefined ? options.margin : 20;
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

  // 3. PDF to Word (.docx) — Enhanced Style & Layout Extractor
  async pdfToWord(file, onProgress = null) {
    if (onProgress) onProgress(15, 'Loading PDF Structure in Memory...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(20 + ((i / numPages) * 60), `Analyzing fonts, headings & layout (Page ${i} of ${numPages})...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;

      if (!textContent.items || textContent.items.length === 0) continue;

      // Group text items by vertical lines (Y position within ~3.5px tolerance)
      const linesMap = [];

      textContent.items.forEach(item => {
        const text = (item.str || '').trim();
        if (!text && !item.hasEOL) return;

        const transform = item.transform;
        const fontSize = Math.round(Math.hypot(transform[0], transform[1]) || item.height || 11);
        const x = transform[4];
        const y = transform[5];

        const fontStyle = textContent.styles && textContent.styles[item.fontName];
        const fontName = ((fontStyle && fontStyle.fontFamily) || item.fontName || '').toLowerCase();
        const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy') || fontName.includes('700') || fontName.includes('800') || fontName.includes('900') || fontName.includes('semibold');
        const isItalic = fontName.includes('italic') || fontName.includes('oblique');

        let line = linesMap.find(l => Math.abs(l.y - y) <= 3.5);
        if (!line) {
          line = { y: y, items: [] };
          linesMap.push(line);
        }

        line.items.push({
          text: item.str,
          x: x,
          width: item.width,
          fontSize: fontSize,
          bold: isBold,
          italic: isItalic,
          hasEOL: item.hasEOL
        });
      });

      // Sort lines descending by Y (top of page to bottom)
      linesMap.sort((a, b) => b.y - a.y);

      const allFontSizes = [];
      linesMap.forEach(l => l.items.forEach(it => { if (it.text.trim()) allFontSizes.push(it.fontSize); }));
      allFontSizes.sort((a, b) => a - b);
      const medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)] || 11;

      linesMap.forEach((line) => {
        line.items.sort((a, b) => a.x - b.x);

        const fullLineText = line.items.map(it => it.text).join('').trim();
        if (!fullLineText) return;

        const cleanLower = fullLineText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const maxFontSizeInLine = Math.max(...line.items.map(it => it.fontSize));
        const isLineBold = line.items.filter(it => it.text.trim()).every(it => it.bold);

        const isKeywordHeading = sectionKeywords.some(kw => cleanLower === kw || cleanLower.startsWith(kw + ' '));
        const isAllCapsShort = fullLineText === fullLineText.toUpperCase() && fullLineText.length >= 3 && fullLineText.length <= 40 && (isLineBold || maxFontSizeInLine >= medianFontSize);
        const isLargeHeading = maxFontSizeInLine >= medianFontSize * 1.35;
        const isSectionHeader = isKeywordHeading || (isAllCapsShort && (isLineBold || isLargeHeading));
        const isBullet = bulletRegex.test(fullLineText) || numberedListRegex.test(fullLineText);

        const hasWideGap = line.items.length >= 2 && (line.items[line.items.length - 1].x - (line.items[0].x + line.items[0].width)) > (pageWidth * 0.35);

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
            fontSize: isSectionHeader ? Math.max(26, halfPoints) : halfPoints,
            color: isSectionHeader ? '0F172A' : (item.bold ? '1E293B' : '334155')
          });

          // Build preview run using safe escaper
          let runHtml = PDFConvert.escapeXml(itemText);
          if (item.bold || isSectionHeader) runHtml = `<strong>${runHtml}</strong>`;
          if (item.italic) runHtml = `<em>${runHtml}</em>`;
          htmlLineContent += runHtml;

          if (hasWideGap && j === line.items.length - 1) {
            htmlLineContent += '</span><div style="clear:both;"></div>';
          }
        }

        if (runs.length === 0) return;

        let pType = 'paragraph';
        let headingLevel = 0;
        let hasBottomBorder = false;

        if (isSectionHeader) {
          pType = 'heading';
          headingLevel = maxFontSizeInLine >= medianFontSize * 1.5 ? 1 : 2;
          hasBottomBorder = true;
          htmlPreviewBlocks.push(`<h${headingLevel} style="border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; margin:16px 0 6px; color:#0f172a;">${htmlLineContent}</h${headingLevel}>`);
        } else if (isBullet) {
          pType = 'bullet';
          htmlPreviewBlocks.push(`<li style="margin-left:20px; color:#334155; margin-bottom:4px;">${htmlLineContent}</li>`);
        } else {
          htmlPreviewBlocks.push(`<p style="margin:4px 0; color:#334155;">${htmlLineContent}</p>`);
        }

        docxParagraphs.push({
          type: pType,
          headingLevel: headingLevel,
          hasBottomBorder: hasBottomBorder,
          isBullet: isBullet,
          bulletChar: '•',
          hasRightTab: hasWideGap,
          spacingBefore: isSectionHeader ? 220 : (isBullet ? 40 : 60),
          spacingAfter: isSectionHeader ? 80 : (isBullet ? 40 : 60),
          runs: runs
        });
      });

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

    if (onProgress) onProgress(95, 'Compiling OpenXML Word Document (.docx)...');
    
    // Use DocxBuilder with fallback
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
      paragraphCount: docxParagraphs.length
    };
  },

  // 4. Word (.docx) to PDF — Native Canvas 2D Typesetting Engine (100% Origin-Clean, Zero Canvas Tainting)
  async wordToPDF(file, onProgress = null) {
    if (onProgress) onProgress(20, 'Parsing Word Document XML Structure...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    
    // Parse complete HTML structure from DOCX with Mammoth
    let mammothResult;
    try {
      mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    } catch (e) {
      console.warn('Mammoth convertToHtml failed, falling back to raw text:', e);
      const rawRes = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      mammothResult = { value: `<p>${PDFConvert.escapeXml(rawRes.value || '')}</p>`, messages: [] };
    }

    const docHtml = mammothResult.value || '<p>Empty Document</p>';
    if (onProgress) onProgress(40, 'Typesetting A4 Document Pages in High-Resolution...');

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
            curPage.ctx.fillStyle = isHeader ? '#F1F5F9' : (rIdx % 2 === 0 ? '#FAFAFA' : '#FFFFFF');
            curPage.ctx.fillRect(marginL, curPage.currentY, contentW, rowH);

            // Draw cells
            cells.forEach((cell, cIdx) => {
              const cellX = marginL + cIdx * colW;
              const cellText = cell.textContent.trim();

              curPage.ctx.strokeStyle = '#CBD5E1';
              curPage.ctx.lineWidth = 1;
              curPage.ctx.strokeRect(cellX, curPage.currentY, colW, rowH);

              curPage.ctx.font = isHeader ? 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif' : '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
              curPage.ctx.fillStyle = isHeader ? '#0F172A' : '#334155';

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
          curPage.ctx.font = hasBold ? 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif' : '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial", sans-serif';
          const lines = wrapTextLines(curPage.ctx, text, contentW);
          const blockHeight = lines.length * 24 + 10;
          checkPageBreak(blockHeight);

          curPage.ctx.fillStyle = hasBold ? '#0F172A' : '#334155';
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
  async pdfToExcel(file, onProgress = null) {
    if (onProgress) onProgress(20, 'Reading PDF Tables & Tabular Streams in RAM...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const wb = XLSX.utils.book_new();
    const allSheetsData = [];

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(25 + ((i / numPages) * 65), `Extracting Tabular Grid from Page ${i} of ${numPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      if (!textContent.items || textContent.items.length === 0) {
        allSheetsData.push({ sheetName: `Page ${i}`, data: [['[Empty Page]']] });
        const ws = XLSX.utils.aoa_to_sheet([['[Empty Page]']]);
        XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
        continue;
      }

      // Group text items by line Y (within 5px tolerance)
      const rowsMap = [];
      const allXCoords = [];

      textContent.items.forEach(item => {
        const text = (item.str || '').trim();
        if (!text) return;
        const x = item.transform[4];
        const y = item.transform[5];
        allXCoords.push(x);

        let row = rowsMap.find(r => Math.abs(r.y - y) <= 4.5);
        if (!row) {
          row = { y: y, items: [] };
          rowsMap.push(row);
        }
        row.items.push({ x: x, width: item.width || 0, text: item.str.trim() });
      });

      // Sort rows top-to-bottom
      rowsMap.sort((a, b) => b.y - a.y);

      // Compute distinct column anchor clusters along X axis
      allXCoords.sort((a, b) => a - b);
      const colAnchors = [];
      allXCoords.forEach(x => {
        if (!colAnchors.some(a => Math.abs(a - x) <= 18)) {
          colAnchors.push(x);
        }
      });
      colAnchors.sort((a, b) => a - b);

      const sheetData = [];

      rowsMap.forEach(row => {
        row.items.sort((a, b) => a.x - b.x);

        // Map row items into discrete column slots
        const rowCells = new Array(Math.max(1, colAnchors.length)).fill('');

        row.items.forEach(item => {
          let bestColIdx = 0;
          let minDiff = Infinity;
          colAnchors.forEach((anchor, cIdx) => {
            const diff = Math.abs(anchor - item.x);
            if (diff < minDiff) {
              minDiff = diff;
              bestColIdx = cIdx;
            }
          });

          let cellVal = item.text;
          // Check if numeric currency or percentage
          const cleanNum = cellVal.replace(/[$,€£¥\s]/g, '').replace(/^\((.+)\)$/, '-$1');
          if (/^-?\d+(\.\d+)?$/.test(cleanNum)) {
            cellVal = parseFloat(cleanNum);
          }

          if (rowCells[bestColIdx] && typeof cellVal === 'string') {
            rowCells[bestColIdx] += ' ' + cellVal;
          } else {
            rowCells[bestColIdx] = cellVal;
          }
        });

        // Trim empty trailing columns
        while (rowCells.length > 1 && rowCells[rowCells.length - 1] === '') {
          rowCells.pop();
        }

        if (rowCells.some(c => c !== '')) {
          sheetData.push(rowCells);
        }
      });

      if (sheetData.length === 0) {
        sheetData.push(['[Empty Page / No Tabular Text Detected]']);
      }

      allSheetsData.push({
        sheetName: `Page ${i}`,
        data: sheetData
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
    }

    if (onProgress) onProgress(95, 'Compiling OpenXML Workbook (.xlsx)...');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const firstWs = wb.Sheets[wb.SheetNames[0]];
    const csvContent = XLSX.utils.sheet_to_csv(firstWs);
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    return {
      xlsxBlob: xlsxBlob,
      csvBlob: csvBlob,
      sheetsData: allSheetsData,
      totalSheets: numPages
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
    const a4Width = isLandscape ? 841.89 : 595.28;
    const a4Height = isLandscape ? 595.28 : 841.89;
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
          const rawCell = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
          const safeCell = PDFConvert.sanitizeWinAnsiText(rawCell).substring(0, 26);

          page.drawText(safeCell, {
            x: margin + c * colWidth + 5,
            y: currentY + 4,
            size: isHeader ? 8.5 : 8,
            font: isHeader ? boldFont : font,
            color: isHeader ? PDFLib.rgb(1, 1, 1) : PDFLib.rgb(0.12, 0.16, 0.22)
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
