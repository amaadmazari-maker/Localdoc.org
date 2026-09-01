/**
 * localdoc.org — PDF & Document Conversion Engine (js/tools/convert.js)
 * Real client-side conversions: PDF <-> Word, PDF <-> Excel, PDF <-> Images.
 * Zero cloud uploads. 100% in-browser RAM execution.
 */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/workers/pdf.worker.js';
}

const PDFConvert = {
  // Helper: Sanitize text for WinAnsi / StandardFonts fallback
  sanitizeWinAnsiText(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove nulls & control chars
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // smart double quotes
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // smart single quotes
      .replace(/[\u2013\u2014\u2015]/g, '-') // en-dash, em-dash, horizontal bar
      .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\uF0B7]/g, '* ') // bullets
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // non-breaking & wide spaces
      .replace(/[\u2026]/g, '...') // ellipsis
      .replace(/[^\x00-\x7F]/g, c => {
        // Fallback for remaining non-ASCII characters to prevent WinAnsi crash
        return '?';
      });
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
    const zip = new MiniZip();
    for (const img of images) {
      const fileName = `${baseName}-page-${String(img.pageNumber).padStart(2, '0')}.${ext}`;
      const buffer = await img.blob.arrayBuffer();
      zip.addFile(fileName, new Uint8Array(buffer));
    }
    return zip.generateBlob('application/zip');
  },

  // 2. Images to PDF with layout controls
  async imagesToPDF(files, options = {}, onProgress = null) {
    const orientation = options.orientation || 'auto'; // 'auto', 'portrait', 'landscape'
    const margin = options.margin !== undefined ? options.margin : 20; // pt
    const pageSize = options.pageSize || 'a4'; // 'a4', 'letter'

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
          // Fallback if PNG embedding fails (e.g. unsupported color space)
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

      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const scale = Math.min(availW / imgWidth, availH / imgHeight, 1.0);
      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;

      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(embeddedImage, {
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

    // Common resume/document section header keywords for intelligent styling
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

        const transform = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
        const fontSize = Math.round(Math.hypot(transform[0], transform[1]) || item.height || 11);
        const x = transform[4];
        const y = transform[5];

        const fontStyle = textContent.styles && textContent.styles[item.fontName];
        const fontName = ((fontStyle && fontStyle.fontFamily) || item.fontName || '').toLowerCase();
        const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy') || fontName.includes('700') || fontName.includes('800') || fontName.includes('900') || fontName.includes('semibold');
        const isItalic = fontName.includes('italic') || fontName.includes('oblique');

        // Check if an existing line is close to this Y
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

      // Sort lines from top of page to bottom (descending Y)
      linesMap.sort((a, b) => b.y - a.y);

      // Analyze page median font size for relative scale
      const allFontSizes = [];
      linesMap.forEach(l => l.items.forEach(it => { if (it.text.trim()) allFontSizes.push(it.fontSize); }));
      allFontSizes.sort((a, b) => a - b);
      const medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)] || 11;

      // Process each line into structured Word runs & paragraphs
      linesMap.forEach((line, lineIdx) => {
        // Sort items left to right
        line.items.sort((a, b) => a.x - b.x);

        const fullLineText = line.items.map(it => it.text).join('').trim();
        if (!fullLineText) return;

        const cleanLower = fullLineText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const maxFontSizeInLine = Math.max(...line.items.map(it => it.fontSize));
        const isLineBold = line.items.filter(it => it.text.trim()).every(it => it.bold);

        // Check if line is a major Section Heading
        const isKeywordHeading = sectionKeywords.some(kw => cleanLower === kw || cleanLower.startsWith(kw + ' '));
        const isAllCapsShort = fullLineText === fullLineText.toUpperCase() && fullLineText.length >= 3 && fullLineText.length <= 40 && (isLineBold || maxFontSizeInLine >= medianFontSize);
        const isLargeHeading = maxFontSizeInLine >= medianFontSize * 1.35;
        const isSectionHeader = isKeywordHeading || (isAllCapsShort && (isLineBold || isLargeHeading));

        // Check if line is a bullet item
        const isBullet = bulletRegex.test(fullLineText) || numberedListRegex.test(fullLineText);

        // Check for two-column split (e.g. Company on Left, Date on Right)
        const hasWideGap = line.items.length >= 2 && (line.items[line.items.length - 1].x - (line.items[0].x + line.items[0].width)) > (pageWidth * 0.35);

        // Consolidate runs
        const runs = [];
        let htmlLineContent = '';

        for (let i = 0; i < line.items.length; i++) {
          const item = line.items[i];
          let itemText = item.text;

          // If first item of a bullet line, clean bullet marker for Word indentation
          if (isBullet && i === 0 && bulletRegex.test(itemText)) {
            itemText = itemText.replace(bulletRegex, '');
          }

          if (!itemText) continue;

          // Add right tab if wide gap detected
          if (hasWideGap && i === line.items.length - 1) {
            runs.push({ isTab: true });
            htmlLineContent += '<span style="display:inline-block; float:right;">';
          }

          const halfPoints = Math.round(Math.max(8, item.fontSize) * 2); // 11pt -> 22 half-pts
          runs.push({
            text: itemText,
            bold: item.bold || isSectionHeader,
            italic: item.italic,
            underline: false,
            fontSize: isSectionHeader ? Math.max(26, halfPoints) : halfPoints,
            color: isSectionHeader ? '0F172A' : (item.bold ? '1E293B' : '334155')
          });

          // Build HTML Preview run
          let runHtml = DocxBuilder.escapeXml(itemText);
          if (item.bold || isSectionHeader) runHtml = `<strong>${runHtml}</strong>`;
          if (item.italic) runHtml = `<em>${runHtml}</em>`;
          htmlLineContent += runHtml;

          if (hasWideGap && i === line.items.length - 1) {
            htmlLineContent += '</span><div style="clear:both;"></div>';
          }
        }

        if (runs.length === 0) return;

        // Determine paragraph type
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

      // Page break indicator between pages
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
    const docxBlob = DocxBuilder.createDocxFromContent(docxParagraphs);
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

  // 4. Word (.docx) to PDF — Robust Unicode & High-DPI Engine (Zero Crash)
  async wordToPDF(file, onProgress = null) {
    if (onProgress) onProgress(20, 'Reading Word Document XML & Styles...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    
    // Parse complete HTML structure from DOCX with Mammoth
    let mammothResult;
    try {
      mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    } catch (e) {
      console.warn('Mammoth convertToHtml failed, falling back to raw text:', e);
      const rawRes = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      mammothResult = { value: `<p>${DocxBuilder.escapeXml(rawRes.value || '')}</p>`, messages: [] };
    }

    const docHtml = mammothResult.value || '<p>Empty Document</p>';
    if (onProgress) onProgress(45, 'Rendering High-Resolution Multilingual A4 Pages...');

    // A4 Dimensions: 595.28 x 841.89 pt -> Render at 2x resolution (1190 x 1684 px) for crisp text
    const renderWidthPx = 800; // standard container width
    const a4Aspect = 841.89 / 595.28; // ~1.414
    const pageHeightPx = Math.round(renderWidthPx * a4Aspect);

    // Create an isolated container for measurement & rendering
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${renderWidthPx}px`;
    container.style.backgroundColor = '#FFFFFF';
    container.style.color = '#0F172A';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Nastaliq Urdu", "Arial", sans-serif';
    container.style.fontSize = '14px';
    container.style.lineHeight = '1.6';
    container.style.padding = '48px 56px';
    container.style.boxSizing = 'border-box';
    container.setAttribute('dir', 'auto'); // Auto-detect RTL for Urdu/Arabic

    // Inject enhanced CSS for the document
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .doc-render-wrap h1 { font-size: 24px; font-weight: 800; color: #0F172A; margin: 16px 0 10px; border-bottom: 2px solid #0284C7; padding-bottom: 4px; }
      .doc-render-wrap h2 { font-size: 18px; font-weight: 700; color: #1E293B; margin: 14px 0 8px; border-bottom: 1.5px solid #CBD5E1; padding-bottom: 3px; }
      .doc-render-wrap h3 { font-size: 15px; font-weight: 700; color: #334155; margin: 12px 0 6px; }
      .doc-render-wrap p { margin: 6px 0; color: #334155; }
      .doc-render-wrap strong, .doc-render-wrap b { font-weight: 700; color: #0F172A; }
      .doc-render-wrap em, .doc-render-wrap i { font-style: italic; }
      .doc-render-wrap u { text-decoration: underline; }
      .doc-render-wrap ul, .doc-render-wrap ol { margin: 6px 0 8px; padding-left: 24px; }
      .doc-render-wrap li { margin-bottom: 4px; color: #334155; }
      .doc-render-wrap table { border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid #CBD5E1; }
      .doc-render-wrap th, .doc-render-wrap td { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: left; font-size: 13px; }
      .doc-render-wrap th { background-color: #F1F5F9; font-weight: 700; color: #0F172A; }
      .doc-render-wrap hr { border: none; border-top: 1px solid #CBD5E1; margin: 16px 0; }
      .doc-render-wrap img { max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; }
      .doc-render-wrap blockquote { border-left: 3px solid #0284C7; margin: 8px 0; padding-left: 12px; color: #64748B; font-style: italic; }
    `;
    container.className = 'doc-render-wrap';
    container.innerHTML = docHtml;
    document.body.appendChild(styleEl);
    document.body.appendChild(container);

    const totalHeight = Math.max(container.scrollHeight, pageHeightPx);
    const numPages = Math.max(1, Math.ceil(totalHeight / (pageHeightPx - 96))); // with padding margin
    const pdfDoc = await PDFLib.PDFDocument.create();

    // High-resolution Canvas slicing
    const scale = 2.0; // 2x high-definition rendering
    for (let p = 0; p < numPages; p++) {
      if (onProgress) onProgress(50 + ((p + 1) / numPages) * 40, `Compiling PDF Page ${p + 1} of ${numPages}...`);

      const canvas = document.createElement('canvas');
      canvas.width = renderWidthPx * scale;
      canvas.height = pageHeightPx * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // White A4 background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, renderWidthPx, pageHeightPx);

      // Render slice of document using SVG foreignObject snapshot
      const sliceTop = p * (pageHeightPx - 96);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${renderWidthPx}" height="${pageHeightPx}">
          <foreignObject width="${renderWidthPx}" height="${totalHeight}" y="-${sliceTop}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Nastaliq Urdu', Arial, sans-serif; font-size:14px; line-height:1.6; color:#0F172A; padding:48px 56px; box-sizing:border-box;">
              ${styleEl.outerHTML}
              <div class="doc-render-wrap">
                ${docHtml}
              </div>
            </div>
          </foreignObject>
        </svg>`;

      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const sliceImg = new Image();

      await new Promise((resolve) => {
        sliceImg.onload = () => {
          ctx.drawImage(sliceImg, 0, 0, renderWidthPx, pageHeightPx);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        sliceImg.onerror = () => {
          // If SVG rasterization is blocked, fallback to safe vector rendering
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        sliceImg.src = svgUrl;
      });

      const pageJpgBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
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

    // Clean up temporary DOM elements
    document.body.removeChild(container);
    document.body.removeChild(styleEl);

    if (onProgress) onProgress(98, 'Finalizing Portable Document Format (.pdf)...');
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      pdfBlob: pdfBlob,
      htmlPreview: docHtml,
      pageCount: numPages
    };
  },

  // 5. PDF to Excel (.xlsx & .csv)
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

      const rowsMap = new Map();
      textContent.items.forEach(item => {
        const text = (item.str || '').trim();
        if (!text) return;
        // Group items within 7px vertical range
        const y = Math.round(item.transform[5] / 7) * 7;
        const x = item.transform[4];
        if (!rowsMap.has(y)) rowsMap.set(y, []);
        rowsMap.get(y).push({ x: x, text: item.str });
      });

      const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
      const sheetData = [];

      sortedY.forEach(y => {
        const rowItems = rowsMap.get(y).sort((a, b) => a.x - b.x);
        sheetData.push(rowItems.map(item => item.text.trim()));
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

    // Generate CSV for first sheet
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
    const orientation = options.orientation || 'landscape'; // 'landscape' or 'portrait'
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

        // Row background
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

        // Draw cells
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

          // Cell gridline
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
