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
    if (msg.type === 'DETECT_DOCUMENT_CORNERS') {
      const { id, buffer, width, height, options } = msg;
      const opts = options || {};
      const highThresh = opts.highThreshold || 75;
      const lowThresh = opts.lowThreshold || 30;

      // 1. Run Canny Edge Pipeline
      const edgeMap = runCannyPipeline(new Uint8ClampedArray(buffer), width, height, highThresh, lowThresh);

      // 2. Extract Document Boundary & Fit 4-Point Convex Quadrilateral
      const quadResult = extractDocumentQuad(edgeMap, width, height);
      const durationMs = Math.round((performance.now() - t0) * 10) / 10;

      self.postMessage({
        type: 'DETECT_DOCUMENT_CORNERS_RESULT',
        id: id,
        success: true,
        found: quadResult.found,
        corners: quadResult.corners,
        confidence: quadResult.confidence,
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

  // Document must occupy between 6% and 94% of the camera frame
  if (relArea < 0.06 || relArea > 0.94) {
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

  // Check Convexity
  function cross(p1, p2, p3) {
    return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
  }
  const c1 = cross(quad[0], quad[1], quad[2]);
  const c2 = cross(quad[1], quad[2], quad[3]);
  const c3 = cross(quad[2], quad[3], quad[0]);
  const c4 = cross(quad[3], quad[0], quad[1]);
  const isConvex = (c1 > 0 && c2 > 0 && c3 > 0 && c4 > 0) || (c1 < 0 && c2 < 0 && c3 < 0 && c4 < 0);
  if (!isConvex) {
    return null;
  }

  // Check Aspect Ratio Plausibility
  const topW = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const botW = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
  const leftH = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
  const rightH = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const ratio = avgW / Math.max(1, avgH);

  if (ratio < 0.18 || ratio > 5.5) {
    return null;
  }

  // Sort 4 vertices clockwise starting from Top-Left: TL, TR, BR, BL
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;

  const sorted = [...quad].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  let tlIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = sorted[i].x + sorted[i].y;
    if (s < minSum) {
      minSum = s;
      tlIdx = i;
    }
  }

  const tl = sorted[tlIdx];
  const tr = sorted[(tlIdx + 1) % 4];
  const br = sorted[(tlIdx + 2) % 4];
  const bl = sorted[(tlIdx + 3) % 4];

  // Convert to normalized coordinates with +5.5% outward safety breathing room padding
  function expandCorner(p) {
    const normX = p.x / width;
    const normY = p.y / height;
    const normCx = cx / width;
    const normCy = cy / height;

    const dx = normX - normCx;
    const dy = normY - normCy;
    const padX = Math.sign(dx || 1) * Math.max(0.016, Math.abs(dx) * 0.055);
    const padY = Math.sign(dy || 1) * Math.max(0.016, Math.abs(dy) * 0.055);

    return {
      x: Math.max(0.006, Math.min(0.994, normX + padX)),
      y: Math.max(0.006, Math.min(0.994, normY + padY))
    };
  }

  return {
    found: true,
    confidence: Math.round(relArea * 100),
    corners: {
      topLeft: expandCorner(tl),
      topRight: expandCorner(tr),
      bottomRight: expandCorner(br),
      bottomLeft: expandCorner(bl)
    }
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

  return { found: false };
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
