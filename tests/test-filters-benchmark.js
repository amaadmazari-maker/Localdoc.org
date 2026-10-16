/**
 * localdoc.org — Phase 3 Verification Suite & Benchmark (Section 3.5)
 * Automated verification of:
 * 1. CLAHE local contrast enhancement on faint pencil & handwriting with shadowed gradients
 * 2. De-Moiré cross-bilateral smoothing on LCD subpixel matrices & glossy surfaces
 * 3. Asymmetric Unsharp Mask sharpening with halo suppression
 * 4. End-to-end filter pipeline timing and latency budget (< 100ms on interactive preview)
 */

const { DocumentScanner } = require('../js/tools/scan.js');

function createRGBA(width, height, fill = [255, 255, 255, 255]) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = fill[0];
    buf[i + 1] = fill[1];
    buf[i + 2] = fill[2];
    buf[i + 3] = fill[3];
  }
  return buf;
}

// =========================================================================
// Test 1: CLAHE Contrast Verification on Faint Handwriting Under Heavy Shadow
// =========================================================================
function testCLAHE() {
  console.log('\n--- 1. Testing CLAHE Local Adaptive Histogram Equalization ---');
  const width = 400, height = 400;
  const data = createRGBA(width, height);

  // Apply heavy non-linear shadow across the document (x: 0 -> 400, val: 50 -> 220)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const shadow = 60 + Math.round((x / width) * 160);
      data[idx] = shadow;
      data[idx + 1] = shadow;
      data[idx + 2] = shadow;
    }
  }

  // Draw faint pencil strokes in the deep shadow region (x: 50..150, y: 190..210)
  // Contrast is only 15 levels lower than local background (faint pencil mark)
  const strokePixels = [];
  for (let y = 190; y <= 210; y++) {
    for (let x = 50; x <= 150; x++) {
      const idx = (y * width + x) * 4;
      const bg = data[idx];
      const pencil = Math.max(0, bg - 15); // faint pencil: delta = 15
      data[idx] = pencil;
      data[idx + 1] = pencil;
      data[idx + 2] = pencil;
      strokePixels.push({ x, y, bg, pencil });
    }
  }

  // Measure initial contrast
  const sample = strokePixels[Math.floor(strokePixels.length / 2)];
  const initialContrast = Math.abs(sample.bg - sample.pencil);

  // Apply CLAHE
  const t0 = process.hrtime.bigint();
  DocumentScanner.applyCLAHE(data, width, height, 2.5);
  const t1 = process.hrtime.bigint();
  const durMs = Number(t1 - t0) / 1e6;

  // Measure post-CLAHE contrast
  const sampleIdx = (sample.y * width + sample.x) * 4;
  const neighborIdx = ((sample.y - 15) * width + sample.x) * 4; // adjacent background pixel outside stroke
  const postStrokeVal = (data[sampleIdx] + data[sampleIdx + 1] + data[sampleIdx + 2]) / 3;
  const postBgVal = (data[neighborIdx] + data[neighborIdx + 1] + data[neighborIdx + 2]) / 3;
  const postContrast = Math.abs(postBgVal - postStrokeVal);

  console.log(`Initial Pencil Contrast : ${initialContrast.toFixed(1)} DN`);
  console.log(`Post-CLAHE Contrast     : ${postContrast.toFixed(1)} DN (${(postContrast / initialContrast).toFixed(2)}x boost)`);
  console.log(`CLAHE Execution Time    : ${durMs.toFixed(2)} ms (${width}x${height})`);

  const passed = postContrast >= initialContrast * 1.4 && durMs < 50;
  console.log(`Result: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  return { passed, initialContrast, postContrast, durMs };
}

// =========================================================================
// Test 2: De-Moiré Verification on Screen Matrix / Glossy Surface Rainbows
// =========================================================================
function testDeMoire() {
  console.log('\n--- 2. Testing De-Moiré Cross-Bilateral Smoothing ---');
  const width = 400, height = 400;
  const data = createRGBA(width, height);

  // Generate high-frequency LCD RGB subpixel stripe matrix (period = 3 pixels)
  // Subpixels: Red (240, 200, 200), Green (200, 240, 200), Blue (200, 200, 240)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const subpixel = x % 3;
      if (subpixel === 0) {
        data[idx] = 240; data[idx + 1] = 190; data[idx + 2] = 190;
      } else if (subpixel === 1) {
        data[idx] = 190; data[idx + 1] = 240; data[idx + 2] = 190;
      } else {
        data[idx] = 190; data[idx + 1] = 190; data[idx + 2] = 240;
      }
    }
  }

  // Draw high-contrast text line across the screen pattern
  for (let y = 195; y <= 205; y++) {
    for (let x = 50; x <= 350; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30;
    }
  }

  // Measure chromatic variance before filter on a patch outside the text
  function getChromaVariance(buf, xStart, yStart, size) {
    let sumR = 0, sumG = 0, sumB = 0, n = size * size;
    for (let y = yStart; y < yStart + size; y++) {
      for (let x = xStart; x < xStart + size; x++) {
        const i = (y * width + x) * 4;
        sumR += buf[i]; sumG += buf[i + 1]; sumB += buf[i + 2];
      }
    }
    const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
    let varSum = 0;
    for (let y = yStart; y < yStart + size; y++) {
      for (let x = xStart; x < xStart + size; x++) {
        const i = (y * width + x) * 4;
        const dr = buf[i] - avgR, dg = buf[i + 1] - avgG, db = buf[i + 2] - avgB;
        varSum += (dr * dr + dg * dg + db * db) / 3;
      }
    }
    return varSum / n;
  }

  const initialVar = getChromaVariance(data, 50, 50, 50);

  // Apply De-Moiré
  const t0 = process.hrtime.bigint();
  DocumentScanner.applyDeMoire(data, width, height, 1.0);
  const t1 = process.hrtime.bigint();
  const durMs = Number(t1 - t0) / 1e6;

  const postVar = getChromaVariance(data, 50, 50, 50);

  // Verify text sharpness: core of text must still be dark (< 60)
  const textCenterIdx = (200 * width + 200) * 4;
  const textLum = (data[textCenterIdx] + data[textCenterIdx + 1] + data[textCenterIdx + 2]) / 3;

  console.log(`Pre-Filter Moiré Variance : ${initialVar.toFixed(1)}`);
  console.log(`Post-Filter Moiré Variance: ${postVar.toFixed(1)} (-${((1 - postVar / initialVar) * 100).toFixed(1)}% reduction)`);
  console.log(`Preserved Text Darkness   : ${textLum.toFixed(1)} DN (remains crisp dark stroke)`);
  console.log(`De-Moiré Execution Time   : ${durMs.toFixed(2)} ms (${width}x${height})`);

  const passed = postVar < initialVar * 0.4 && textLum < 65 && durMs < 50;
  console.log(`Result: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  return { passed, initialVar, postVar, textLum, durMs };
}

// =========================================================================
// Test 3: Unsharp Mask Sharpening with Asymmetric Halo Suppression
// =========================================================================
function testSharpen() {
  console.log('\n--- 3. Testing Unsharp Mask Asymmetric Sharpening ---');
  const width = 400, height = 400;
  const data = createRGBA(width, height, [235, 235, 235, 255]); // paper background

  // Draw blurred text edge across vertical boundary at x = 200
  // Background = 235, Core text = 45, Transition across 4 pixels
  for (let y = 50; y < 350; y++) {
    for (let x = 180; x <= 220; x++) {
      const idx = (y * width + x) * 4;
      let val;
      if (x <= 197) val = 45; // text core
      else if (x === 198) val = 90;
      else if (x === 199) val = 145;
      else if (x === 200) val = 195;
      else val = 235; // paper background
      data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
    }
  }

  // Maximum local edge gradient step across boundary (x: 196..202)
  const yTest = 200;
  let preMaxGrad = 0;
  for (let x = 196; x <= 201; x++) {
    const grad = data[(yTest * width + x + 1) * 4] - data[(yTest * width + x) * 4];
    if (grad > preMaxGrad) preMaxGrad = grad;
  }
  const preTextCore = data[(yTest * width + 197) * 4];

  // Apply Unsharp Mask
  const t0 = process.hrtime.bigint();
  DocumentScanner.applyUnsharpMask(data, width, height, 0.75);
  const t1 = process.hrtime.bigint();
  const durMs = Number(t1 - t0) / 1e6;

  let postMaxGrad = 0;
  for (let x = 196; x <= 201; x++) {
    const grad = data[(yTest * width + x + 1) * 4] - data[(yTest * width + x) * 4];
    if (grad > postMaxGrad) postMaxGrad = grad;
  }
  const postTextCore = data[(yTest * width + 197) * 4];
  const maxHalo = Math.max(data[(yTest * width + 201) * 4], data[(yTest * width + 202) * 4]);

  console.log(`Pre-Sharpen Max Gradient : ${preMaxGrad.toFixed(1)} DN/px`);
  console.log(`Post-Sharpen Max Gradient: ${postMaxGrad.toFixed(1)} DN/px (+${(((postMaxGrad - preMaxGrad) / preMaxGrad) * 100).toFixed(1)}% crisper)`);
  console.log(`Text Core Darkness       : ${preTextCore} DN -> ${postTextCore} DN (deepened stroke)`);
  console.log(`Max Paper Border Halo    : ${maxHalo} DN (halo suppressed below 248)`);
  console.log(`Sharpen Execution Time   : ${durMs.toFixed(2)} ms (${width}x${height})`);

  const passed = postMaxGrad > preMaxGrad && postTextCore < preTextCore * 0.85 && maxHalo <= 248 && durMs < 50;
  console.log(`Result: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  return { passed, preMaxGrad, postMaxGrad, maxHalo, durMs };
}

// =========================================================================
// Test 4: End-to-End Pipeline Performance (< 100ms Preview Latency Budget)
// =========================================================================
function testFullPipeline() {
  console.log('\n--- 4. Testing End-to-End Strict Pipeline Budget (< 100ms) ---');
  // Typical mobile/desktop interactive preview resolution: ~800 x 1130 (0.9 MP)
  const pWidth = 800, pHeight = 1130;
  const previewData = createRGBA(pWidth, pHeight, [225, 225, 220, 255]);

  // Seed realistic document texture
  for (let i = 0; i < previewData.length; i += 4) {
    const noise = ((i * 37) % 19) - 9;
    previewData[i] = Math.max(0, Math.min(255, previewData[i] + noise));
    previewData[i + 1] = Math.max(0, Math.min(255, previewData[i + 1] + noise));
    previewData[i + 2] = Math.max(0, Math.min(255, previewData[i + 2] + noise));
  }

  // Warmup run
  DocumentScanner.applyCLAHE(new Uint8ClampedArray(previewData), pWidth, pHeight, 2.0);

  // Full sequential pipeline benchmark:
  // Step 1: Base Mode
  // Step 2: CLAHE
  // Step 3: De-Moiré
  // Step 4: Sharpen
  const t0 = process.hrtime.bigint();

  const tCLAHE0 = process.hrtime.bigint();
  DocumentScanner.applyCLAHE(previewData, pWidth, pHeight, 2.0);
  const tCLAHE1 = process.hrtime.bigint();

  const tDemoire0 = process.hrtime.bigint();
  DocumentScanner.applyDeMoire(previewData, pWidth, pHeight, 1.0);
  const tDemoire1 = process.hrtime.bigint();

  const tSharpen0 = process.hrtime.bigint();
  DocumentScanner.applyUnsharpMask(previewData, pWidth, pHeight, 0.65);
  const tSharpen1 = process.hrtime.bigint();

  const tTotal1 = process.hrtime.bigint();

  const msCLAHE = Number(tCLAHE1 - tCLAHE0) / 1e6;
  const msDemoire = Number(tDemoire1 - tDemoire0) / 1e6;
  const msSharpen = Number(tSharpen1 - tSharpen0) / 1e6;
  const msTotal = Number(tTotal1 - t0) / 1e6;

  console.log(`Preview Resolution        : ${pWidth} x ${pHeight} (~${((pWidth * pHeight) / 1e6).toFixed(2)} MP)`);
  console.log(`- CLAHE Duration          : ${msCLAHE.toFixed(2)} ms`);
  console.log(`- De-Moiré Duration       : ${msDemoire.toFixed(2)} ms`);
  console.log(`- Sharpen Duration        : ${msSharpen.toFixed(2)} ms`);
  console.log(`Total Stackable Pipeline  : ${msTotal.toFixed(2)} ms (Budget: < 100 ms)`);

  const passed = msTotal < 100.0;
  console.log(`Result: ${passed ? '✓ PASSED (Well within interactive 100ms budget)' : '✗ FAILED'}`);
  return { passed, msTotal, msCLAHE, msDemoire, msSharpen };
}

// Run All
console.log('=================================================================');
console.log(' LocalDoc Camera Studio — Phase 3 Filters & Latency Verification');
console.log('=================================================================');

const r1 = testCLAHE();
const r2 = testDeMoire();
const r3 = testSharpen();
const r4 = testFullPipeline();

console.log('\n=================================================================');
const allPassed = r1.passed && r2.passed && r3.passed && r4.passed;
if (allPassed) {
  console.log('ALL PHASE 3 VERIFICATION GATES PASSED! Ready for Phase 4.');
} else {
  console.error('VERIFICATION GATE FAILED. Please review output above.');
  process.exit(1);
}
console.log('=================================================================\n');
