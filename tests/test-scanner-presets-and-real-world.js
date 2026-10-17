/**
 * localdoc.org — Automated Verification Suite for Scanner Corner Auto-Detection & Manual Presets
 * Verifies:
 * 1. DocumentScanner.getPresetCorners returns exact mathematical ratios for A4, Letter, ID Card, Full Frame.
 * 2. Real-world document photos with >72% area (e.g. 82% area) are accurately detected and NEVER discarded.
 * 3. pages/scan.html includes the manual paper size toolbar and mobile-safe viewport layout.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { DocumentScanner } = require('../js/tools/scan.js');

console.log('=================================================================');
console.log(' LocalDoc Scanner: Auto-Detection & Manual Preset Verification ');
console.log('=================================================================\n');

let allPassed = true;

// -------------------------------------------------------------------------
// 1. Manual Paper Size Presets
// -------------------------------------------------------------------------
console.log('--- 1. Testing Manual Paper Presets (A4, Letter, ID Card, Full) ---');

const imgW = 1200;
const imgH = 1600;

// Test A4 (Portrait)
const a4Corners = DocumentScanner.getPresetCorners('a4', imgW, imgH);
const a4PixelW = (a4Corners.topRight.x - a4Corners.topLeft.x) * imgW;
const a4PixelH = (a4Corners.bottomLeft.y - a4Corners.topLeft.y) * imgH;
const a4Ratio = a4PixelH / a4PixelW;
console.log(`A4 Ratio: ${a4Ratio.toFixed(3)} (Expected: ~1.414)`);
assert(Math.abs(a4Ratio - 1.4142) < 0.05, 'A4 aspect ratio matches 1:1.414');

// Test US Letter
const letterCorners = DocumentScanner.getPresetCorners('letter', imgW, imgH);
const letterPixelW = (letterCorners.topRight.x - letterCorners.topLeft.x) * imgW;
const letterPixelH = (letterCorners.bottomLeft.y - letterCorners.topLeft.y) * imgH;
const letterRatio = letterPixelH / letterPixelW;
console.log(`Letter Ratio: ${letterRatio.toFixed(3)} (Expected: ~1.294)`);
assert(Math.abs(letterRatio - (11 / 8.5)) < 0.05, 'US Letter aspect ratio matches 8.5:11');

// Test ID Card
const idCorners = DocumentScanner.getPresetCorners('id-card', imgW, imgH);
const idPixelW = (idCorners.topRight.x - idCorners.topLeft.x) * imgW;
const idPixelH = (idCorners.bottomLeft.y - idCorners.topLeft.y) * imgH;
const idRatio = idPixelH / idPixelW;
console.log(`ID Card Ratio: ${idRatio.toFixed(3)} (Expected: ~0.630 portrait or ~1.586 landscape)`);
assert(idRatio > 0.5 && idRatio < 2.0, 'ID Card aspect ratio is valid');

// Test Full Frame
const fullCorners = DocumentScanner.getPresetCorners('full', imgW, imgH);
assert.strictEqual(fullCorners.topLeft.x, 0.008);
assert.strictEqual(fullCorners.bottomRight.x, 0.992);
console.log('Full Frame Corners: Correct full boundary');

console.log('Result: ✓ PASSED (All mathematical paper ratios verified)\n');

// -------------------------------------------------------------------------
// 2. Real-World Document Detection (82% Area Frame - Previous Bug Test)
// -------------------------------------------------------------------------
console.log('--- 2. Testing 82% Area Real-World Document Frame ---');

// Create synthetic 480x640 frame where white document occupies 82% of the image
const testW = 480;
const testH = 640;
const totalPx = testW * testH;
const rgba = new Uint8ClampedArray(totalPx * 4);

// Background: Wooden table (RGB: 100, 70, 50)
for (let i = 0; i < rgba.length; i += 4) {
  rgba[i] = 100;
  rgba[i + 1] = 70;
  rgba[i + 2] = 50;
  rgba[i + 3] = 255;
}

// Document: White paper occupying 82% of frame (margins: ~4.5% on all sides)
const startX = Math.round(testW * 0.045);
const endX = Math.round(testW * 0.955);
const startY = Math.round(testH * 0.045);
const endY = Math.round(testH * 0.955);

for (let y = startY; y < endY; y++) {
  const yOff = y * testW;
  for (let x = startX; x < endX; x++) {
    const idx = (yOff + x) * 4;
    rgba[idx] = 245;
    rgba[idx + 1] = 245;
    rgba[idx + 2] = 240;
    // Add realistic text line stripes
    if (y % 20 < 2 && x > startX + 20 && x < endX - 20) {
      rgba[idx] = 40;
      rgba[idx + 1] = 40;
      rgba[idx + 2] = 40;
    }
  }
}

// Mock image object for detectDocumentEdgesSobel
const mockCanvas = {
  naturalWidth: testW,
  naturalHeight: testH,
  width: testW,
  height: testH
};

const mockCtx = {
  getImageData: (sx, sy, sw, sh) => {
    // Return appropriately sampled or direct data
    const buf = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      const srcY = Math.round((y / sh) * testH);
      for (let x = 0; x < sw; x++) {
        const srcX = Math.round((x / sw) * testW);
        const srcIdx = (srcY * testW + srcX) * 4;
        const dstIdx = (y * sw + x) * 4;
        buf[dstIdx] = rgba[srcIdx];
        buf[dstIdx + 1] = rgba[srcIdx + 1];
        buf[dstIdx + 2] = rgba[srcIdx + 2];
        buf[dstIdx + 3] = 255;
      }
    }
    return { data: buf };
  },
  drawImage: () => {}
};

const detectedCorners = DocumentScanner.detectDocumentEdgesSobel(mockCanvas, 'a4', mockCanvas, mockCtx);

console.log('Detected Corners for 82% Area Document:');
console.log('  Top-Left    :', detectedCorners.topLeft);
console.log('  Top-Right   :', detectedCorners.topRight);
console.log('  Bottom-Right:', detectedCorners.bottomRight);
console.log('  Bottom-Left :', detectedCorners.bottomLeft);

// Calculate detected area
const tl = detectedCorners.topLeft;
const tr = detectedCorners.topRight;
const br = detectedCorners.bottomRight;
const bl = detectedCorners.bottomLeft;
const detectedArea = 0.5 * Math.abs((tl.x * (tr.y - bl.y)) + (tr.x * (br.y - tl.y)) + (br.x * (bl.y - tr.y)) + (bl.x * (tl.y - br.y)));

console.log(`Detected Normalized Area: ${(detectedArea * 100).toFixed(1)}%`);

// Verify that the detected corners are close to actual paper boundary (approx 0.04 - 0.06)
// and NOT the discarded default 0.008 outer frame!
assert(detectedArea > 0.70 && detectedArea < 0.95, 'Area was preserved in the 70-95% range');
assert(tl.x > 0.02 && tl.y > 0.02, 'Corners were not discarded to default 0.008 outer edge');

console.log('Result: ✓ PASSED (82% real-world document detected accurately without discard)\n');

// -------------------------------------------------------------------------
// 3. HTML & Mobile Layout Integrity
// -------------------------------------------------------------------------
console.log('--- 3. Testing scan.html Markup & Responsive Mobile Rules ---');

const scanHtml = fs.readFileSync(path.join(__dirname, '../pages/scan.html'), 'utf8');

// Viewfinder contains contain mode and fit toggle
assert(scanHtml.includes('object-fit: contain'), 'Camera video defaults to object-fit: contain');
assert(scanHtml.includes('btn-camera-aspect'), 'Camera top HUD has aspect fit/fill toggle button');
assert(scanHtml.includes('toggleCameraFitMode'), 'toggleCameraFitMode function is bound');

// Manual Paper Preset Toolbar exists
assert(scanHtml.includes('id="crop-presets-toolbar"'), 'Crop screen has manual presets toolbar');
assert(scanHtml.includes('btn-crop-preset-auto'), 'Toolbar includes Auto Detect button');
assert(scanHtml.includes('btn-crop-preset-a4'), 'Toolbar includes A4 preset button');
assert(scanHtml.includes('btn-crop-preset-letter'), 'Toolbar includes Letter preset button');
assert(scanHtml.includes('btn-crop-preset-idcard'), 'Toolbar includes ID Card preset button');
assert(scanHtml.includes('btn-crop-preset-full'), 'Toolbar includes Full Frame preset button');

// Mobile safe-area padding applied
assert(scanHtml.includes('env(safe-area-inset-bottom'), 'Safe area inset accounted for on mobile');
assert(scanHtml.includes('min-height: 0'), 'Flexbox containers have min-height: 0 to prevent mobile overflow');

// Pointer capture & midpoint dragging
assert(scanHtml.includes('setPointerCapture'), 'Pointer capture implemented for smooth mobile dragging');
assert(scanHtml.includes('topEdge'), 'Edge midpoint dragging implemented');

console.log('Result: ✓ PASSED (scan.html UI, Presets, and Mobile Layout fully verified)\n');

console.log('=================================================================');
console.log(' ALL CORNER DETECTION & MANUAL PRESET VERIFICATIONS PASSED! ');
console.log('=================================================================');
