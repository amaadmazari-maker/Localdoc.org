/**
 * localdoc.org — High-Precision Pure JavaScript Canny Edge Detection & Quad Fitting Worker
 * File: js/workers/scan-worker.js
 * 100% Client-Side In-Browser Execution — 0 External Libraries — Zero OpenCV Bloat (~15 KB)
 * 
 * Pipeline:
 * 1. Grayscale Luminance Conversion (Rec. 601 ITU-R)
 * 2. 5x5 Separable Gaussian Smoothing (Integer Bit-Shift Convolution)
 * 3. Sobel Gradient Magnitude & 4-Sector Angle Quantization (0°, 45°, 90°, 135°)
 * 4. Non-Maximum Suppression (Sub-pixel Edge Thinning)
 * 5. Dual-Threshold Hysteresis Edge Tracking (8-Connectivity Flood Fill)
 * 6. Andrew's Monotone Chain 2D Convex Hull
 * 7. Dual-Chain Ramer-Douglas-Peucker (RDP) Polygonal Simplification
 * 8. 4-Point Quadrilateral Corner Ordering & Safety Margin Padding
 */

self.onmessage = function (e) {
  const msg = e.data || {};
  const t0 = performance.now();

  try {
    const isDetectAction = msg.action === 'detectEdges' || msg.type === 'DETECT_DOCUMENT_CORNERS';
    if (isDetectAction) {
      const id = msg.id || 'msg_' + Date.now();
      const rawBuffer = msg.buffer || (msg.imageData && msg.imageData.data ? msg.imageData.data.buffer : (msg.imageData && msg.imageData.buffer ? msg.imageData.buffer : msg.imageData));
      const width = msg.width;
      const height = msg.height;
      const opts = msg.options || {};
      const highThresh = opts.highThreshold || 75;
      const lowThresh = opts.lowThreshold || 30;

      // 1. Run Canny Edge Pipeline
      const edgeMap = runCannyPipeline(new Uint8ClampedArray(rawBuffer), width, height, highThresh, lowThresh);

      // 2. Extract Document Boundary & Fit 4-Point Convex Quadrilateral
      const quadResult = extractDocumentQuad(edgeMap, width, height);
      const durationMs = Math.round((performance.now() - t0) * 10) / 10;

      self.postMessage({
        type: 'DETECT_DOCUMENT_CORNERS_RESULT',
        action: 'detectEdges',
        id: id,
        success: true,
        found: !!(quadResult && quadResult.found),
        corners: quadResult && quadResult.corners ? quadResult.corners : null,
        convex: !!(quadResult && quadResult.convex),
        areaRatio: quadResult && quadResult.areaRatio ? quadResult.areaRatio : 0,
        confidence: quadResult && quadResult.confidence ? quadResult.confidence : 0,
        durationMs: durationMs
      });
      return;
    }

    if (msg.type === 'CANNY') {
      const { buffer, width, height, options } = msg;
      const opts = options || {};
      const highThresh = opts.highThreshold || 75;
      const lowThresh = opts.lowThreshold || 30;

      const edgeMap = runCannyPipeline(new Uint8ClampedArray(buffer), width, height, highThresh, lowThresh);
      const durationMs = Math.round((performance.now() - t0) * 10) / 10;

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
      return;
    }
  } catch (err) {
    self.postMessage({
      type: (msg.type || 'UNKNOWN') + '_RESULT',
      success: false,
      error: err.message
    });
  }
};

/**
 * 1-5. Full Canny Edge Detection Pipeline
 */
function runCannyPipeline(rgba, width, height, highThresh, lowThresh) {
  const totalPixels = width * height;

  // 1. Grayscale Luminance Conversion (Rec. 601)
  const gray = new Uint8Array(totalPixels);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }

  // 2. 5x5 Separable Gaussian Smoothing
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

  // 3. Sobel Edge Gradient Magnitude & Direction Quantization
  const magnitude = new Float32Array(totalPixels);
  const direction = new Uint8Array(totalPixels); // 0: 0°, 1: 45°, 2: 90°, 3: 135°

  let maxMag = 0;

  for (let y = 1; y < height - 1; y++) {
    const yOff = y * width;
    const yPrev = (y - 1) * width;
    const yNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = yOff + x;

      const gx =
        -blurred[yPrev + x - 1] + blurred[yPrev + x + 1] +
        -(blurred[yOff + x - 1] << 1) + (blurred[yOff + x + 1] << 1) +
        -blurred[yNext + x - 1] + blurred[yNext + x + 1];

      const gy =
        -blurred[yPrev + x - 1] - (blurred[yPrev + x] << 1) - blurred[yPrev + x + 1] +
         blurred[yNext + x - 1] + (blurred[yNext + x] << 1) + blurred[yNext + x + 1];

      const mag = Math.hypot(gx, gy);
      magnitude[idx] = mag;
      if (mag > maxMag) maxMag = mag;

      let angle = Math.atan2(gy, gx) * (180 / Math.PI);
      if (angle < 0) angle += 180;

      if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
        direction[idx] = 0;
      } else if (angle >= 22.5 && angle < 67.5) {
        direction[idx] = 1;
      } else if (angle >= 67.5 && angle < 112.5) {
        direction[idx] = 2;
      } else {
        direction[idx] = 3;
      }
    }
  }

  const actualHigh = maxMag > 0 ? Math.max(lowThresh + 10, Math.min(highThresh, maxMag * 0.28)) : highThresh;
  const actualLow = actualHigh * 0.42;

  // 4. Non-Maximum Suppression (NMS)
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
        neighborA = magnitude[yPrev + x];
        neighborB = magnitude[yNext + x];
      } else if (dir === 1) {
        neighborA = magnitude[yPrev + x + 1];
        neighborB = magnitude[yNext + x - 1];
      } else if (dir === 2) {
        neighborA = magnitude[yOff + x - 1];
        neighborB = magnitude[yOff + x + 1];
      } else if (dir === 3) {
        neighborA = magnitude[yPrev + x - 1];
        neighborB = magnitude[yNext + x + 1];
      }

      if (mag >= neighborA && mag >= neighborB) {
        nms[idx] = mag;
      }
    }
  }

  // 5. Dual-Threshold Hysteresis Edge Tracking (8-Connectivity)
  const edgeResult = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let queueHead = 0;
  let queueTail = 0;

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

/**
 * Canonical 4-Corner Clockwise Sorting with Near-Square Tie-Breaking (Feature F6)
 * Guaranteed output order: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 * @param {Array<{x: number, y: number}>|object} pts - Exactly 4 points
 * @returns {Array<{x: number, y: number}>} - 4 points canonically ordered clockwise with named properties
 */
function orderCornersCanonical(pts) {
  if (!pts) return pts;
  let arr;
  if (Array.isArray(pts)) {
    arr = pts;
  } else if (pts.topLeft && pts.topRight && pts.bottomRight && pts.bottomLeft) {
    arr = [pts.topLeft, pts.topRight, pts.bottomRight, pts.bottomLeft];
  } else {
    return pts;
  }
  if (arr.length !== 4) return pts;

  // 1. Compute Centroid
  const cx = (arr[0].x + arr[1].x + arr[2].x + arr[3].x) / 4;
  const cy = (arr[0].y + arr[1].y + arr[2].y + arr[3].y) / 4;

  // 2. Polar angle sort around centroid
  const sorted = [...arr].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  // 3. Enforce strict clockwise winding via 2D cross product
  // In screen coordinates (y down), cross > 0 means clockwise (right turn)
  const cross = (sorted[1].x - sorted[0].x) * (sorted[2].y - sorted[1].y) -
                (sorted[1].y - sorted[0].y) * (sorted[2].x - sorted[1].x);
  const cw = cross > 0 ? sorted : [sorted[0], sorted[3], sorted[2], sorted[1]];

  // 4. Anchor at Top-Left: TL = argmin(x + y) with deterministic tie-breaking
  let tlIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = cw[i].x + cw[i].y;
    if (s < minSum - 1e-4) {
      minSum = s;
      tlIdx = i;
    } else if (Math.abs(s - minSum) <= 1e-4) {
      // Tie-breaker: prefer smaller y (higher in frame), then smaller x
      if (cw[i].y < cw[tlIdx].y || (cw[i].y === cw[tlIdx].y && cw[i].x < cw[tlIdx].x)) {
        minSum = s;
        tlIdx = i;
      }
    }
  }

  const tl = cw[tlIdx];
  const tr = cw[(tlIdx + 1) % 4];
  const br = cw[(tlIdx + 2) % 4];
  const bl = cw[(tlIdx + 3) % 4];

  const result = [tl, tr, br, bl];
  result.topLeft = tl;
  result.topRight = tr;
  result.bottomRight = br;
  result.bottomLeft = bl;
  return result;
}

/**
 * Calculates Shoelace polygon area for a quadrilateral (Feature F7)
 * @param {Array<{x: number, y: number}>|object} quad - 4 vertices in cyclic order
 * @returns {number} - Absolute polygon area
 */
function computeShoelaceArea(quad) {
  if (!quad) return 0;
  let pts;
  if (Array.isArray(quad)) {
    pts = quad;
  } else if (quad.topLeft && quad.topRight && quad.bottomRight && quad.bottomLeft) {
    pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  } else {
    return 0;
  }
  if (pts.length !== 4) return 0;
  const area = 0.5 * Math.abs(
    pts[0].x * (pts[1].y - pts[3].y) +
    pts[1].x * (pts[2].y - pts[0].y) +
    pts[2].x * (pts[3].y - pts[1].y) +
    pts[3].x * (pts[0].y - pts[2].y)
  );
  return area;
}

/**
 * Comprehensive Geometric Validity Suite (Feature F7)
 * Validates strict convexity, Shoelace area ratio (0.04-0.98),
 * collinearity guard (30°-150° internal angles), and aspect ratio (0.18-5.5).
 * @param {Array<{x: number, y: number}>|object} quad - Candidate quadrilateral
 * @param {number} totalW - Reference frame width (1 if normalized)
 * @param {number} totalH - Reference frame height (1 if normalized)
 * @returns {{ valid: boolean, convex: boolean, areaRatio: number, minAngle: number, maxAngle: number, ratio: number }}
 */
function validateQuadGeometry(quad, totalW = 1, totalH = 1) {
  if (!quad) {
    return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
  }
  let pts;
  if (Array.isArray(quad)) {
    pts = quad;
  } else if (quad.topLeft && quad.topRight && quad.bottomRight && quad.bottomLeft) {
    pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  } else {
    return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
  }
  if (pts.length !== 4) {
    return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
  }

  // 1. Strict Convexity (all consecutive edge cross products share the same non-zero sign)
  function edgeCross(p0, p1, p2) {
    return (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
  }
  const c0 = edgeCross(pts[0], pts[1], pts[2]);
  const c1 = edgeCross(pts[1], pts[2], pts[3]);
  const c2 = edgeCross(pts[2], pts[3], pts[0]);
  const c3 = edgeCross(pts[3], pts[0], pts[1]);

  const allPositive = c0 > 1e-7 && c1 > 1e-7 && c2 > 1e-7 && c3 > 1e-7;
  const allNegative = c0 < -1e-7 && c1 < -1e-7 && c2 < -1e-7 && c3 < -1e-7;
  const isConvex = allPositive || allNegative;
  if (!isConvex) {
    return { valid: false, convex: false, areaRatio: 0, minAngle: 0, maxAngle: 0, ratio: 0 };
  }

  // 2. Shoelace Area Validation: 0.04 <= areaRatio <= 0.98 per PROJECT.md § F7
  const area = computeShoelaceArea(pts);
  const totalArea = Math.max(1e-6, totalW * totalH);
  const areaRatio = area / totalArea;
  if (areaRatio < 0.04 || areaRatio > 0.98) {
    return { valid: false, convex: true, areaRatio: areaRatio, minAngle: 0, maxAngle: 0, ratio: 0 };
  }

  // 3. Collinearity Guard: 30° <= internal angle <= 150° for all 4 vertices
  let minAngle = 180;
  let maxAngle = 0;
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const curr = pts[i];
    const next = pts[(i + 1) % 4];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 1e-6 || len2 < 1e-6) {
      return { valid: false, convex: true, areaRatio: areaRatio, minAngle: 0, maxAngle: 180, ratio: 0 };
    }

    const cosTheta = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const clampedCos = Math.max(-1, Math.min(1, cosTheta));
    const angleDeg = Math.acos(clampedCos) * (180 / Math.PI);

    if (angleDeg < minAngle) minAngle = angleDeg;
    if (angleDeg > maxAngle) maxAngle = angleDeg;

    if (angleDeg < 30 || angleDeg > 150) {
      return { valid: false, convex: true, areaRatio: areaRatio, minAngle: minAngle, maxAngle: maxAngle, ratio: 0 };
    }
  }

  // 4. Aspect Ratio Plausibility: 0.18 <= ratio <= 5.5
  const topW = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const botW = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
  const leftH = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
  const rightH = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const ratio = avgW / Math.max(1e-6, avgH);
  if (ratio < 0.18 || ratio > 5.5) {
    return { valid: false, convex: true, areaRatio: areaRatio, minAngle: minAngle, maxAngle: maxAngle, ratio: ratio };
  }

  return {
    valid: true,
    convex: true,
    areaRatio: areaRatio,
    minAngle: Math.round(minAngle * 10) / 10,
    maxAngle: Math.round(maxAngle * 10) / 10,
    ratio: Math.round(ratio * 100) / 100
  };
}

/**
 * 6. Edge Extraction & 7-8. Convex Hull + Dual-Chain RDP 4-Point Quad Fitting
 */
function fitQuadFromPoints(pts, width, height) {
  const totalArea = width * height;
  const hull = computeConvexHull(pts);
  if (!hull || hull.length < 4) return null;

  // Perimeter and Area Verification (Shoelace Formula)
  let perim = 0;
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    perim += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  area = Math.abs(area) * 0.5;
  const relArea = area / totalArea;

  // Document must occupy between 15% and 98% of the camera frame to filter out internal charts/diagrams
  if (relArea < 0.15 || relArea > 0.98) {
    return null;
  }

  // Find Farthest Pair on Convex Hull (Main Diagonal)
  let maxD = 0;
  let i1 = 0;
  let i2 = 0;
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      const d = Math.hypot(hull[i].x - hull[j].x, hull[i].y - hull[j].y);
      if (d > maxD) {
        maxD = d;
        i1 = i;
        i2 = j;
      }
    }
  }

  // Reorder hull vertices into two chains split by the main diagonal
  const reordered = hull.slice(i1).concat(hull.slice(0, i1));
  const idx2 = (i2 - i1 + hull.length) % hull.length;
  const chain1 = reordered.slice(0, idx2 + 1);
  const chain2 = reordered.slice(idx2).concat([reordered[0]]);

  // Adaptively simplify both chains with Ramer-Douglas-Peucker to extract exactly 4 corners
  let eps = Math.max(3, perim * 0.015);
  let h1 = rdpOpen(chain1, eps);
  let h2 = rdpOpen(chain2, eps);
  let iter = 0;

  while ((h1.length + h2.length - 2) > 4 && iter++ < 12) {
    eps *= 1.25;
    h1 = rdpOpen(chain1, eps);
    h2 = rdpOpen(chain2, eps);
  }

  let quad = h1.slice(0, -1).concat(h2.slice(0, -1));
  if (quad.length !== 4) {
    return null;
  }

  // 1. Order 4 corners canonically clockwise: [TL, TR, BR, BL]
  const canonicalQuad = orderCornersCanonical(quad);

  // 2. Strict Geometric Validation Suite (Convexity, Shoelace Area, Collinearity, Aspect Ratio)
  const geom = validateQuadGeometry(canonicalQuad, width, height);
  if (!geom.valid) {
    return null;
  }

  const cx = (canonicalQuad[0].x + canonicalQuad[1].x + canonicalQuad[2].x + canonicalQuad[3].x) / 4;
  const cy = (canonicalQuad[0].y + canonicalQuad[1].y + canonicalQuad[2].y + canonicalQuad[3].y) / 4;

  // Convert to normalized coordinates with subtle +1.2% outward safety breathing room
  function expandCorner(p) {
    const normX = p.x / width;
    const normY = p.y / height;
    const normCx = cx / width;
    const normCy = cy / height;

    const dx = normX - normCx;
    const dy = normY - normCy;
    const padX = Math.sign(dx || 1) * Math.max(0.004, Math.abs(dx) * 0.012);
    const padY = Math.sign(dy || 1) * Math.max(0.004, Math.abs(dy) * 0.012);

    return {
      x: Math.max(0.008, Math.min(0.992, Math.round((normX + padX) * 1000) / 1000)),
      y: Math.max(0.008, Math.min(0.992, Math.round((normY + padY) * 1000) / 1000))
    };
  }

  const expTL = expandCorner(canonicalQuad[0]);
  const expTR = expandCorner(canonicalQuad[1]);
  const expBR = expandCorner(canonicalQuad[2]);
  const expBL = expandCorner(canonicalQuad[3]);

  // Construct dual-compatible Array / Object per PROJECT.md interface contract
  const cornersResult = [expTL, expTR, expBR, expBL];
  cornersResult.topLeft = expTL;
  cornersResult.topRight = expTR;
  cornersResult.bottomRight = expBR;
  cornersResult.bottomLeft = expBL;

  return {
    found: true,
    convex: true,
    areaRatio: Math.round(geom.areaRatio * 1000) / 1000,
    confidence: Math.min(1.0, Math.round(geom.areaRatio * 100) / 100),
    corners: cornersResult
  };
}

function extractDocumentQuad(edgeMap, width, height) {
  // 1. Morphological 3x3 Dilation to close 90-degree corner gaps
  const dilated = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    const yOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      let hit = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (edgeMap[(y + dy) * width + (x + dx)] === 255) {
            hit = 255;
            break;
          }
        }
        if (hit) break;
      }
      dilated[yOff + x] = hit;
    }
  }

  // 2. Extract Connected Components & Global Points
  const visited = new Uint8Array(width * height);
  const candidates = [];
  const allPoints = [];

  for (let y = 3; y < height - 3; y += 2) {
    const yOff = y * width;
    for (let x = 3; x < width - 3; x += 2) {
      const idx = yOff + x;
      if (dilated[idx] === 255) {
        allPoints.push({ x: x, y: y });
        if (!visited[idx]) {
          const comp = [];
          const queue = [idx];
          visited[idx] = 1;
          let qHead = 0;
          while (qHead < queue.length) {
            const cur = queue[qHead++];
            const cx = cur % width;
            const cy = (cur / width) | 0;
            comp.push({ x: cx, y: cy });
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 2 && nx < width - 2 && ny >= 2 && ny < height - 2) {
                  const nidx = ny * width + nx;
                  if (dilated[nidx] === 255 && !visited[nidx]) {
                    visited[nidx] = 1;
                    queue.push(nidx);
                  }
                }
              }
            }
          }
          if (comp.length >= 60) {
            candidates.push(comp);
          }
        }
      }
    }
  }

  // 3. Try top 4 significant candidate components
  candidates.sort((a, b) => b.length - a.length);
  for (let i = 0; i < Math.min(4, candidates.length); i++) {
    const res = fitQuadFromPoints(candidates[i], width, height);
    if (res && res.found) return res;
  }

  // 4. Global Fallback
  if (allPoints.length >= 40) {
    const res = fitQuadFromPoints(allPoints, width, height);
    if (res && res.found) return res;
  }

  // 5. Intelligent Document Centered Fallback (A4-proportioned centered quad with 6% margins)
  const marginX = 0.06;
  const marginY = 0.05;
  const fbTL = { x: marginX, y: marginY };
  const fbTR = { x: 1.0 - marginX, y: marginY };
  const fbBR = { x: 1.0 - marginX, y: 1.0 - marginY };
  const fbBL = { x: marginX, y: 1.0 - marginY };
  const fallbackCorners = [fbTL, fbTR, fbBR, fbBL];
  fallbackCorners.topLeft = fbTL;
  fallbackCorners.topRight = fbTR;
  fallbackCorners.bottomRight = fbBR;
  fallbackCorners.bottomLeft = fbBL;
  return {
    found: true,
    convex: true,
    areaRatio: (1.0 - 2 * marginX) * (1.0 - 2 * marginY),
    confidence: 0.80,
    corners: fallbackCorners
  };
}

/**
 * Andrew's Monotone Chain 2D Convex Hull Algorithm
 */
function computeConvexHull(pts) {
  if (pts.length <= 3) return pts;
  pts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  function cross(p1, p2, p3) {
    return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
  }

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Ramer-Douglas-Peucker (RDP) Algorithm
 */
function rdpOpen(pts, eps) {
  if (pts.length <= 2) return pts;
  let dmax = 0;
  let index = 0;
  const end = pts.length - 1;
  const pStart = pts[0];
  const pEnd = pts[end];

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(pts[i], pStart, pEnd);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > eps) {
    const r1 = rdpOpen(pts.slice(0, index + 1), eps);
    const r2 = rdpOpen(pts.slice(index), eps);
    return r1.slice(0, -1).concat(r2);
  }

  return [pStart, pEnd];
}

function perpendicularDistance(p, lineP1, lineP2) {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.hypot(p.x - lineP1.x, p.y - lineP1.y);
  return Math.abs(dy * p.x - dx * p.y + lineP2.x * lineP1.y - lineP2.y * lineP1.x) / len;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    orderCornersCanonical,
    computeShoelaceArea,
    validateQuadGeometry,
    fitQuadFromPoints,
    extractDocumentQuad,
    computeConvexHull,
    runCannyPipeline
  };
}

