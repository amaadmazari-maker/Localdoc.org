/**
 * localdoc.org — PDF Conversion Engine (js/tools/convert.js)
 * Real client-side conversions: PDF -> Word, Excel, JPG, PNG, and reverse.
 */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/workers/pdf.worker.js';
}

const PDFConvert = {
  // 1. PDF to Images (JPG/PNG)
  async pdfToImages(file, format = 'image/jpeg', dpiScale = 2.0, onProgress = null) {
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const images = [];

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress((i / numPages) * 100, `Rendering Page ${i} of ${numPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: dpiScale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, format, 0.92));
      images.push({ pageNumber: i, blob: blob, dataUrl: canvas.toDataURL(format, 0.92) });
    }
    return images;
  },

  // 2. Images to PDF
  async imagesToPDF(files, onProgress = null) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(((i + 1) / files.length) * 100, `Embedding image ${i + 1} of ${files.length}...`);
      const file = files[i];
      const buffer = await UIUtils.readFileAsArrayBuffer(file);
      let embeddedImage;

      if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        embeddedImage = await pdfDoc.embedPng(buffer);
      } else {
        embeddedImage = await pdfDoc.embedJpg(buffer);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const a4Width = 595.28;
      const a4Height = 841.89;

      const scale = Math.min(a4Width / imgWidth, a4Height / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      const page = pdfDoc.addPage([a4Width, a4Height]);
      page.drawImage(embeddedImage, {
        x: (a4Width - drawWidth) / 2,
        y: (a4Height - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 3. PDF to Word (.docx)
  async pdfToWord(file, onProgress = null) {
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const paragraphs = [];

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress((i / numPages) * 100, `Extracting text coordinates from Page ${i}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let currentLine = '';

      textContent.items.forEach(item => {
        if (lastY === null || Math.abs(item.transform[5] - lastY) > 5) {
          if (currentLine.trim()) paragraphs.push(currentLine.trim());
          currentLine = item.str;
          lastY = item.transform[5];
        } else {
          currentLine += (item.hasEOL ? '\n' : ' ') + item.str;
        }
      });
      if (currentLine.trim()) paragraphs.push(currentLine.trim());
      paragraphs.push(''); // Page break separator
    }

    if (onProgress) onProgress(100, 'Compiling OpenXML Word Document (.docx)...');
    return DocxBuilder.createDocxFromContent(paragraphs);
  },

  // 4. Word (.docx) to PDF
  async wordToPDF(file, onProgress = null) {
    if (onProgress) onProgress(30, 'Parsing Word XML Document Structure...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    const rawText = result.value || 'Empty Document';

    if (onProgress) onProgress(60, 'Generating Vector A4 PDF Pages...');
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontSize = 11;
    const lineHeight = 16;
    const margin = 50;
    const a4Width = 595.28;
    const a4Height = 841.89;
    const maxLineWidth = a4Width - margin * 2;

    const lines = rawText.split('\n');
    let page = pdfDoc.addPage([a4Width, a4Height]);
    let currentY = a4Height - margin;

    for (const rawLine of lines) {
      const words = rawLine.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxLineWidth) {
          if (currentY < margin + lineHeight) {
            page = pdfDoc.addPage([a4Width, a4Height]);
            currentY = a4Height - margin;
          }
          page.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        if (currentY < margin + lineHeight) {
          page = pdfDoc.addPage([a4Width, a4Height]);
          currentY = a4Height - margin;
        }
        page.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
        currentY -= lineHeight;
      }
      currentY -= 4; // Paragraph spacing
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 5. PDF to Excel (.xlsx)
  async pdfToExcel(file, onProgress = null) {
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const wb = XLSX.utils.book_new();

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress((i / numPages) * 100, `Extracting table cells from Page ${i}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const rowsMap = new Map();
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5] / 8) * 8;
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

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 6. Excel to PDF (.pdf)
  async excelToPDF(file, onProgress = null) {
    if (onProgress) onProgress(30, 'Parsing Spreadsheet Grid...');
    const arrayBuffer = await UIUtils.readFileAsArrayBuffer(file);
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (onProgress) onProgress(60, 'Rendering A4 Table Grid in Memory...');
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    
    const a4Width = 841.89; // Landscape
    const a4Height = 595.28;
    const margin = 40;
    const rowHeight = 22;
    const maxCols = Math.min(10, Math.max(...data.map(r => r.length)));
    const colWidth = (a4Width - margin * 2) / Math.max(1, maxCols);

    let page = pdfDoc.addPage([a4Width, a4Height]);
    let currentY = a4Height - margin;

    data.forEach((row, rowIdx) => {
      if (currentY < margin + rowHeight) {
        page = pdfDoc.addPage([a4Width, a4Height]);
        currentY = a4Height - margin;
      }

      // Draw row background
      if (rowIdx === 0) {
        page.drawRectangle({
          x: margin,
          y: currentY - 4,
          width: a4Width - margin * 2,
          height: rowHeight,
          color: PDFLib.rgb(0.1, 0.6, 0.4)
        });
      } else if (rowIdx % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: currentY - 4,
          width: a4Width - margin * 2,
          height: rowHeight,
          color: PDFLib.rgb(0.95, 0.95, 0.95)
        });
      }

      for (let c = 0; c < maxCols; c++) {
        const cellText = String(row[c] !== undefined ? row[c] : '').substring(0, 20);
        page.drawText(cellText, {
          x: margin + c * colWidth + 4,
          y: currentY + 4,
          size: 9,
          font: rowIdx === 0 ? boldFont : font,
          color: rowIdx === 0 ? PDFLib.rgb(1, 1, 1) : PDFLib.rgb(0.1, 0.1, 0.1)
        });
      }
      currentY -= rowHeight;
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
};

window.PDFConvert = PDFConvert;
