# QA Test Plan: localdoc.org Baseline & Continuous Verification

## 1. Objective
Establish an independent, rigorous quality assurance system that inspects all interactive tools, static pages, navigation flows, and technical SEO implementations across all supported mobile and desktop device classes.

## 2. Separation of Duties Mandate
- The QA team operates completely independently from the building Leads (Lead 1, Lead 2, Lead 3).
- QA agents identify, document, prove, and reproduce defects.
- QA agents NEVER directly fix or edit production website code.
- All defects are recorded in `/agents/qa/defects.md` and handed off to the appropriate Lead.

## 3. Supported Device & Viewport Matrix
| Device Class | Viewport Width x Height | Primary Browser | Key Checks |
|:---|:---:|:---:|:---|
| Small Android Phone | 360 x 800 | Chrome Mobile | Viewport overflow, tap targets >= 44px, soft keyboard handling |
| Standard iPhone | 390 x 844 | Safari iOS | Dynamic island/notch insets, bottom toolbar overlap, native downloads |
| Large iPhone | 430 x 932 | Safari iOS | Full-screen modal layouts, camera scanner orientation |
| iPad Portrait | 768 x 1024 | Safari iPadOS | Grid reflow, touch drag-and-drop, PDF canvas scaling |
| iPad Landscape | 1024 x 768 | Safari iPadOS | Split view panels, multi-page layout preview |
| Laptop | 1280 x 800 & 1440 x 900 | Chrome / Firefox | Desktop drag & drop, file manager integration, hover states |
| Large Desktop | 1920 x 1080 | Chrome / Edge | Max-width content centering, high-res canvas rendering |

## 4. Test Suites Executed by QA Inspectors
1. **Link & Navigation Suite:**
   - Automated crawler verification of all internal links.
   - Sitemap vs live route parity check.
   - External link safety verification (`rel="noopener"`).
2. **Layout & Visual Regression Suite:**
   - Multi-device full-page scroll screen captures.
   - Diffing against baseline screenshots stored in `/agents/qa/evidence/`.
   - Element collision and overflow detection.
3. **Design System & Contrast Suite:**
   - Automated contrast check for WCAG AA compliance.
   - Typography consistency and font loading verification.
   - Dark/light mode theme toggle consistency.
4. **Console & Security Suite:**
   - Headless browser console log capture for errors, warnings, and CSP blocks.
   - Verification of client privacy (confirm zero network POST/PUT requests containing user files).
5. **Tool Functionality & Integrity Suite (Highest Priority):**
   - End-to-end user journey for every single tool on localdoc.org.
   - Upload file -> Process -> Download result.
   - **Binary validation:** Downloaded output is opened and verified to be uncorrupted and valid.
   - Boundary tests: empty files, corrupt files, huge files, incorrect formats.
6. **Performance & Vitals Suite:**
   - Lighthouse mobile audits.
   - Throttled network testing (Fast 4G, Slow 3G).
   - Interaction to Next Paint (INP) responsiveness.

## 5. Defect Severity Standards
- **BLOCKER:** Core tool failure, corrupted download, unhandled crash, data exposure, broken navigation making page unusable.
- **MAJOR:** Layout breakage on primary mobile viewport, broken link on top-level page, console error preventing a feature, non-functional secondary control.
- **MINOR:** Small cosmetic misalignment, minor copy typo, slow transition animation.
- **COSMETIC:** Polish, subtle spacing adjustment, minor style preference.
