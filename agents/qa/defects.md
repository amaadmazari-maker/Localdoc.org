# QA Defect Catalog: localdoc.org

`ID | Severity (blocker / major / minor / cosmetic) | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence (screenshot/scroll shot/log) | Owner (Lead) | Status`

| ID | Severity | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence | Owner | Status |
|:---|:---:|:---|:---|:---|:---|:---|:---:|:---:|
| DEF-001 | minor | `/pages/id-photo.html`, `/pages/passport-photo-maker.html`, `/pages/cnic-photo-maker.html` | All devices (Offline / Air-gapped) | Disconnect internet connection and invoke selfie background removal | Expected: Runs 100% offline via local assets. Actual: MediaPipe script was imported from `cdn.jsdelivr.net`. | `lead2-tools-baseline-audit.md` | Lead 2 | **closed** |
| DEF-002 | minor | `/blog/*.html` | Mobile 3G/4G cellular | Inspect network payload on 35 blog articles | Expected: All content media served as WebP/SVG. Actual: Verified all 81 non-WebP diagrams are vector SVGs (raster images are 100% WebP). | `lead3-content-baseline-audit.md` | Lead 3 | **closed** |
| DEF-003 | cosmetic | `sitemap.xml` & `/blog/index.html` | Search crawlers | Crawl sitemap and inspect `/blog/` root URL | Expected: Directory index canonicalized to clean URL `https://localdoc.org/blog/`. Actual: Was `https://localdoc.org/blog/index.html`. | `lead1-seo-baseline-audit.md` | Lead 1 | **closed** |
| DEF-004 | blocker | `/pages/scan.html`, `js/tools/scan.js` | Mobile Camera Scanning (All phones) | Snap photo of document filling 70-90% of screen | Expected: Auto-detects paper corners and crops perspective cleanly. Actual: Hardcoded heuristic `area >= 0.72` discarded valid detected contours and reverted to uncropped full outer frame. | `test-scanner-presets-and-real-world.js` | Lead 2 / QA Manager | **closed** |
| DEF-005 | major | `/pages/scan.html` | Mobile devices (Safari & Chrome on Android/iOS) | Open camera scanner and crop screen on mobile phone | Expected: 100% of camera viewfinder and toolbars visible. Actual: `.cs-cam-video` used `object-fit: cover` which zoomed in and cropped out 40-50% of the document; `100vh` without `100dvh` and safe-area inset caused toolbars to be hidden under browser chrome. | `test-scanner-presets-and-real-world.js` | Lead 2 / QA Manager | **closed** |
| DEF-006 | major | `/pages/scan.html` | All devices | Open crop stage to adjust paper size | Expected: Manual paper preset options (Auto, A4, Letter, ID Card, Full Frame). Actual: Zero preset selectors existed; users could only rotate or reset to full. | `test-scanner-presets-and-real-world.js` | Lead 2 | **closed** |

---

### Resolution Notes
- **DEF-001 (Closed 2026-10-16):** Downloaded and bundled `@mediapipe/selfie_segmentation` locally in `/js/lib/mediapipe/`. 0 external CDN dependencies remain.
- **DEF-002 (Closed 2026-10-16):** Forensic audit confirmed that 100% of raster blog photos are `.webp`.
- **DEF-003 (Closed 2026-10-16):** Updated canonical in `/blog/index.html` to `https://localdoc.org/blog/` and synchronized `sitemap.xml`.
- **DEF-004 (Closed 2026-10-17):** Removed the broken `area >= 0.72 || minEdgeDist < 0.035` discard heuristic in `js/tools/scan.js` and expanded `relArea` upper bound to 0.97 in `js/workers/scan-worker.js`. Real-world documents occupying 70-96% of the camera frame now accurately detect and preserve clean convex quad corners.
- **DEF-005 (Closed 2026-10-17):** Resolved mobile screen clipping in `pages/scan.html`: changed `.cs-cam-video` to default to `object-fit: contain` (showing 100% of camera sensor with zero clipping), added a top HUD Viewfinder Fit/Fill toggle, applied `min-height: 0; flex: 1 1 0;` to all canvas stages to prevent flex blowout, and added `max(16px, env(safe-area-inset-bottom))` to all bottom action bars so mobile browser chrome never hides the controls.
- **DEF-006 (Closed 2026-10-17):** Implemented a dedicated Manual Paper Size Selection Toolbar (`Auto Detect`, `A4 (1:1.414)`, `US Letter (1:1.294)`, `ID Card (1:1.586)`, `Full Frame`) in the crop stage. Added `DocumentScanner.getPresetCorners()` math helper and enabled both 4-corner dragging and 4-edge midpoint dragging with pointer capture for touchscreens.
