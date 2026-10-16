# QA Defect Catalog: localdoc.org

`ID | Severity (blocker / major / minor / cosmetic) | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence (screenshot/scroll shot/log) | Owner (Lead) | Status`

| ID | Severity | Page/URL | Device + browser | Steps to reproduce | Expected vs actual | Evidence | Owner | Status |
|:---|:---:|:---|:---|:---|:---|:---|:---:|:---:|
| DEF-001 | minor | `/pages/id-photo.html`, `/pages/passport-photo-maker.html`, `/pages/cnic-photo-maker.html` | All devices (Offline / Air-gapped) | Disconnect internet connection and invoke selfie background removal | Expected: Runs 100% offline via local service worker. Actual: MediaPipe script imported from `cdn.jsdelivr.net` fails offline. | `lead2-tools-baseline-audit.md` | Lead 2 | open |
| DEF-002 | minor | `/blog/*.html` | Mobile 3G/4G cellular | Inspect network payload on 35 blog articles | Expected: All content media served as WebP/SVG. Actual: 81 legacy images still encoded as PNG/JPEG. | `lead3-content-baseline-audit.md` | Lead 3 | open |
| DEF-003 | cosmetic | `sitemap.xml` & `/blog/index.html` | Search crawlers | Crawl sitemap and inspect `/blog/` root URL | Expected: Directory index canonicalized to clean URL `https://localdoc.org/blog/`. Actual: Uses `https://localdoc.org/blog/index.html`. | `lead1-seo-baseline-audit.md` | Lead 1 | open |
