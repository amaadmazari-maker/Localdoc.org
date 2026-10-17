const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. Create Minimal Valid PDF 1
const pdf1 = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj <</Length 62>> stream
BT /F1 24 Tf 72 700 Td (LocalDoc Test Document 1 - Page One) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000230 00000 n 
0000000343 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
414
%%EOF
`;

// 2. Create Minimal Valid PDF 2
const pdf2 = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj <</Length 62>> stream
BT /F1 24 Tf 72 700 Td (LocalDoc Test Document 2 - Page Two) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000230 00000 n 
0000000343 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
414
%%EOF
`;

fs.writeFileSync(path.join(fixturesDir, 'test-doc1.pdf'), pdf1, 'binary');
fs.writeFileSync(path.join(fixturesDir, 'test-doc2.pdf'), pdf2, 'binary');

// 3. Create simple 1x1 or 100x60 Base64 JPEG for ID Card front & back
// Minimal valid 1x1 JPEG:
const miniJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
fs.writeFileSync(path.join(fixturesDir, 'test-front.jpg'), miniJpg);
fs.writeFileSync(path.join(fixturesDir, 'test-back.jpg'), miniJpg);

console.log('Fixtures generated successfully in', fixturesDir);
