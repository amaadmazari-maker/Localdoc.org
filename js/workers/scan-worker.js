/**
 * localdoc.org — High-Precision Pure JavaScript Canny Edge Detection Worker (js/workers/scan-worker.js)
 * 100% Client-Side In-Browser Execution — 0 External Libraries — Zero OpenCV Bloat (~15 KB)
 * 
 * Pipeline:
 * 1. Grayscale Luminance Conversion (Rec. 601 ITU-R)
 * 2. 5x5 Separable Gaussian Smoothing (Integer Bit-Shift Convolution)
 * 3. Sobel Gradient Magnitude & 4-Sector Angle Quantization (0°, 45°, 90°, 135°)
 * 4. Non-Maximum Suppression (Sub-pixel Edge Thinning)
 * 5. Dual-Threshold Hysteresis Edge Tracking (8-Connectivity Flood Fill)
 */

self.onmessage = function (e) {
  const msg = e.data || {};
  if (msg.type === 'CANNY') {
    const t0 = performance.now();
    try {
      const { buffer, width, height, options } = msg;
      const opts = options || {};
      const highThresh = opts.highThreshold || 75;
      const lowThresh = opts.lowThreshold || 30;

      const edgeMap = runCannyPipeline(new Uint8ClampedArray(buffer), width, height, highThresh, lowThresh);
      const durationMs = Math.round((performance.now() - t0) * 10) / 10;

      // Transfer the edgeMap ArrayBuffer back for zero-copy efficiency
      self.postMessage(
        {
          type: 'CANNY_RESULT',
          success: true,
          width: width,
          height: height,
          edgeMap: edgeMap.buffer,
          durationMs: durationMs
        },
        [edgeMap.buffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'CANNY_RESULT',
        success: false,
        error: err.message
      });
    }
  }
};

/**
 * Full Canny Edge Detection Pipeline
 * @param {Uint8ClampedArray} rgba - Input RGBA pixel data
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 * @param {number} highThresh - Strong edge threshold (0-255)
 * @param {number} lowThresh - Weak edge threshold (0-255)
 * @returns {Uint8Array} Binary edge map (255 = edge, 0 = non-edge)
 */
function runCannyPipeline(rgba, width, height, highThresh, lowThresh) {
  const totalPixels = width * height;

  // -------------------------------------------------------------------------
  // 1. Grayscale Luminance Conversion (Rec. 601)
  // -------------------------------------------------------------------------
  const gray = new Uint8Array(totalPixels);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }

  // -------------------------------------------------------------------------
  // 2. 5x5 Separable Gaussian Smoothing
  // Kernel: [1, 4, 6, 4, 1] / 16 horizontally, then vertically.
  // -------------------------------------------------------------------------
  const tempBlur = new Uint8Array(totalPixels);
  const blurred = new Uint8Array(totalPixels);

  // Horizontal Pass
  for (let y = 0; y < height; y++) {
    const yOff = y * width;
    for (let x = 0; x < width; x++) {
      const xm2 = x > 1 ? x - 2 : 0;
      const xm1 = x > 0 ? x - 1 : 0;
      const xp1 = x < width - 1 ? x + 1 : width - 1;
      const xp2 = x < width - 2 ? x + 2 : width - 1;

      tempBlur[yOff + x] = (
        gray[yOff + xm2] +
        (gray[yOff + xm1] << 2) +
        gray[yOff + x] * 6 +
        (gray[yOff + xp1] << 2) +
        gray[yOff + xp2]
      ) >> 4;
    }
  }

  // Vertical Pass
  for (let y = 0; y < height; y++) {
    const ym2 = y > 1 ? y - 2 : 0;
    const ym1 = y > 0 ? y - 1 : 0;
    const yp1 = y < height - 1 ? y + 1 : height - 1;
    const yp2 = y < height - 2 ? y + 2 : height - 1;

    const rowM2 = ym2 * width;
    const rowM1 = ym1 * width;
    const row0 = y * width;
    const rowP1 = yp1 * width;
    const rowP2 = yp2 * width;

    for (let x = 0; x < width; x++) {
      blurred[row0 + x] = (
        tempBlur[rowM2 + x] +
        (tempBlur[rowM1 + x] << 2) +
        tempBlur[row0 + x] * 6 +
        (tempBlur[rowP1 + x] << 2) +
        tempBlur[rowP2 + x]
      ) >> 4;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Sobel Edge Gradient Magnitude & Direction Quantization
  // -------------------------------------------------------------------------
  const magnitude = new Float32Array(totalPixels);
  const direction = new Uint8Array(totalPixels); // 0: 0°, 1: 45°, 2: 90°, 3: 135°

  let maxMag = 0;

  for (let y = 1; y < height - 1; y++) {
    const yOff = y * width;
    const yPrev = (y - 1) * width;
    const yNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = yOff + x;

      // Sobel Kernels
      // Gx = [-1 0 1; -2 0 2; -1 0 1]
      const gx =
        -blurred[yPrev + x - 1] + blurred[yPrev + x + 1] +
        -(blurred[yOff + x - 1] << 1) + (blurred[yOff + x + 1] << 1) +
        -blurred[yNext + x - 1] + blurred[yNext + x + 1];

      // Gy = [-1 -2 -1; 0 0 0; 1 2 1]
      const gy =
        -blurred[yPrev + x - 1] - (blurred[yPrev + x] << 1) - blurred[yPrev + x + 1] +
         blurred[yNext + x - 1] + (blurred[yNext + x] << 1) + blurred[yNext + x + 1];

      const mag = Math.hypot(gx, gy);
      magnitude[idx] = mag;
      if (mag > maxMag) maxMag = mag;

      // Quantize angle into 4 sectors (0, 45, 90, 135 degrees)
      let angle = Math.atan2(gy, gx) * (180 / Math.PI);
      if (angle < 0) angle += 180;

      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        direction[idx] = 0; // Horizontal (East-West normal, compare North-South)
      } else if (angle >= 22.5 && angle < 67.5) {
        direction[idx] = 1; // 45° Diagonal
      } else if (angle >= 67.5 && angle < 112.5) {
        direction[idx] = 2; // Vertical (North-South normal, compare East-West)
      } else {
        direction[idx] = 3; // 135° Diagonal
      }
    }
  }

  // Adaptive threshold adjustment if dynamic lighting warrants it
  const actualHigh = maxMag > 0 ? Math.max(lowThresh + 10, Math.min(highThresh, maxMag * 0.28)) : highThresh;
  const actualLow = actualHigh * 0.42;

  // -------------------------------------------------------------------------
  // 4. Non-Maximum Suppression (NMS)
  // -------------------------------------------------------------------------
  const nms = new Float32Array(totalPixels);

  for (let y = 1; y < height - 1; y++) {
    const yOff = y * width;
    const yPrev = (y - 1) * width;
    const yNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = yOff + x;
      const mag = magnitude[idx];
      if (mag < actualLow) continue;

      const dir = direction[idx];
      let neighborA = 0;
      let neighborB = 0;

      if (dir === 0) {
        // Normal is vertical (check up and down)
        neighborA = magnitude[yPrev + x];
        neighborB = magnitude[yNext + x];
      } else if (dir === 1) {
        // 45° Diagonal (check up-right and down-left)
        neighborA = magnitude[yPrev + x + 1];
        neighborB = magnitude[yNext + x - 1];
      } else if (dir === 2) {
        // Normal is horizontal (check left and right)
        neighborA = magnitude[yOff + x - 1];
        neighborB = magnitude[yOff + x + 1];
      } else if (dir === 3) {
        // 135° Diagonal (check up-left and down-right)
        neighborA = magnitude[yPrev + x - 1];
        neighborB = magnitude[yNext + x + 1];
      }

      // Keep only local maxima along the normal
      if (mag >= neighborA && mag >= neighborB) {
        nms[idx] = mag;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Dual-Threshold Hysteresis Edge Tracking (8-Connectivity)
  // -------------------------------------------------------------------------
  const edgeResult = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let queueHead = 0;
  let queueTail = 0;

  // Mark all strong edges (> actualHigh) and enqueue them
  for (let y = 1; y < height - 1; y++) {
    const yOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = yOff + x;
      if (nms[idx] >= actualHigh) {
        edgeResult[idx] = 255;
        queue[queueTail++] = idx;
      }
    }
  }

  // 8-Connected Breadth-First Flood Fill for weak edges (> actualLow)
  while (queueHead < queueTail) {
    const currIdx = queue[queueHead++];
    const cy = (currIdx / width) | 0;
    const cx = currIdx % width;

    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny <= 0 || ny >= height - 1) continue;
      const nRow = ny * width;

      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        if (nx <= 0 || nx >= width - 1) continue;

        const neighborIdx = nRow + nx;
        if (edgeResult[neighborIdx] === 0 && nms[neighborIdx] >= actualLow) {
          edgeResult[neighborIdx] = 255;
          queue[queueTail++] = neighborIdx;
        }
      }
    }
  }

  return edgeResult;
}
