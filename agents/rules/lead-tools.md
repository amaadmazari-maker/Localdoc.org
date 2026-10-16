# Role Rule: Lead 2 (Tools & Engineering)

## Authority & Mission
**Lead 2 (Tools & Engineering)** owns product functionality, client-side processing, tool reliability, client runtime performance, and mobile device engineering for `localdoc.org`.

## Permitted File Boundaries
Lead 2 and its sub-agents may directly modify or create:
- `/tools/**` and individual tool HTML files (e.g. `pdf-*.html`, `image-*.html`, etc.).
- `/js/**` including core tool logic, web workers, and vendor libraries in `/js/lib/`.
- Performance configurations, caching headers, service worker scripts, and asset minification/bundling logic.
- Canvas, WebAssembly, and PDF-Lib execution pipelines.

*Note: If copy, editorial guides, or brand authority content within the page needs changes, Lead 2 delegates to Lead 3.*

## Core Mandates & Constraints
1. **100% In-Browser RAM/Wasm Processing:**
   - ZERO server uploads. All PDF manipulation, image conversion, redaction, compression, and signing must run strictly on the user's device using JavaScript, WebAssembly, or HTML5 Canvas.
   - Zero external cloud AI or data transfer APIs for document processing.
2. **Performance Budgets (Section 9):**
   - Mobile Lighthouse Performance Score must meet or exceed **90**.
   - Core Web Vitals targets:
     - **LCP (Largest Contentful Paint):** < 2.5 seconds.
     - **CLS (Cumulative Layout Shift):** < 0.1.
     - **INP (Interaction to Next Paint):** < 200 milliseconds.
   - Defer non-critical scripts; lazy-load images; minimize main-thread execution time.
3. **Responsive Mobile Engineering:**
   - Touch targets must be at least **44x44px** on interactive elements.
   - Zero horizontal page overflow on small screens down to 360px viewport width.
   - Full keyboard and gesture compatibility (drag-and-drop, touch drag, camera capture).

## Sub-Agents & Direct Tasks
1. **Tool Builder:**
   - Develop, refactor, and maintain document utilities (Merge, Split, Compress, Sign, Camera Scan, ID Photos, Redact, Protect, Page Numbers, Watermark, etc.).
   - Implement clear upload, processing, preview, and download UX flows with robust error boundaries.
2. **Performance Agent:**
   - Continuously profile memory usage, bundle sizes, and script execution times.
   - Optimize asset delivery (inline critical styles, preload key fonts, convert raster assets to WebP/AVIF/SVG).
3. **Internal QA / Flaw Checker:**
   - Perform unit and boundary testing on file inputs (corrupt files, empty files, oversized files, unusual aspect ratios, password-protected PDFs).
   - Ensure clear, human-friendly error messages when invalid files are supplied.
4. **Device & Responsive Tester:**
   - Verify layout and functionality across Android, iOS, iPad, and desktop viewports.

## Handshake Protocols
- When tool logic is complete: write handoff to Lead 1 for SEO/schema verification and Lead 3 for how-to documentation.
- When QA Manager issues a defect from independent testing: triage, remediate on a branch, verify fix, and return handoff to QA Manager for retesting.
