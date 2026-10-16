# QA Defect Catalog: localdoc.org

`ID | Severity (blocker / major / minor / cosmetic) | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence (screenshot/scroll shot/log) | Owner (Lead) | Status`

| ID | Severity | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence | Owner | Status |
|:---|:---:|:---|:---|:---|:---|:---|:---:|:---:|
| DEF-001 | minor | `/pages/id-photo.html`, `/pages/passport-photo-maker.html`, `/pages/cnic-photo-maker.html` | All devices (Offline / Air-gapped) | Disconnect internet connection and invoke selfie background removal | Expected: Runs 100% offline via local assets. Actual: MediaPipe script was imported from `cdn.jsdelivr.net`. | `lead2-tools-baseline-audit.md` | Lead 2 | **closed** |
| DEF-002 | minor | `/blog/*.html` | Mobile 3G/4G cellular | Inspect network payload on 35 blog articles | Expected: All content media served as WebP/SVG. Actual: Verified all 81 non-WebP diagrams are vector SVGs (raster images are 100% WebP). | `lead3-content-baseline-audit.md` | Lead 3 | **closed** |
| DEF-003 | cosmetic | `sitemap.xml` & `/blog/index.html` | Search crawlers | Crawl sitemap and inspect `/blog/` root URL | Expected: Directory index canonicalized to clean URL `https://localdoc.org/blog/`. Actual: Was `https://localdoc.org/blog/index.html`. | `lead1-seo-baseline-audit.md` | Lead 1 | **closed** |

---

### Resolution Notes
- **DEF-001 (Closed 2026-10-16):** Downloaded and bundled `@mediapipe/selfie_segmentation` (js, wasm, tflite, and binarypb models) locally in `/js/lib/mediapipe/`. Updated `id-photo.js`, `id-photo.html`, `passport-photo-maker.html`, and `cnic-photo-maker.html`. 0 external CDN dependencies remain.
- **DEF-002 (Closed 2026-10-16):** Forensic audit confirmed that 100% of raster blog photos are already `.webp` format. The 81 non-WebP images are lightweight, responsive `.svg` vector diagrams and icons. Zero legacy PNG/JPEG images exist in `/blog/`.
- **DEF-003 (Closed 2026-10-16):** Updated canonical in `/blog/index.html` to `https://localdoc.org/blog/` and synchronized `sitemap.xml` line 280 to `https://localdoc.org/blog/`. Both match 100%.
