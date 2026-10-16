# Checklist: Full QA & Experience Verification (`qa-full.md`)

Use this comprehensive verification matrix before any release to staging or production.

## 1. Device & Browser Matrix Verification
- [ ] **Small Android Phone (360 x 800, Chrome):**
  - [ ] No horizontal scroll / overflow.
  - [ ] Tap targets >= 44x44px.
  - [ ] Readable font sizes (no unprompted iOS/Android zoom on input focus).
- [ ] **iPhone (390 x 844 & 430 x 932, Safari):**
  - [ ] Safe area insets respected (notch and home indicator).
  - [ ] Input keyboards do not obscure active form fields.
  - [ ] Native file picker and download trigger function cleanly.
- [ ] **iPad (768 x 1024 portrait & 1024 x 768 landscape, Safari):**
  - [ ] Grid layouts adapt without squishing or awkward wrapping.
  - [ ] Orientation changes preserve document preview states.
- [ ] **Laptop & Desktop (1280 x 800, 1440 x 900, 1920 x 1080; Chrome, Firefox, Edge):**
  - [ ] Drag-and-drop file zones work smoothly.
  - [ ] Wide viewport layout centers properly with max-width boundaries.

## 2. Link, Navigation & SEO Verification (Link Inspector)
- [ ] All internal links return HTTP 200 (no 404s, no redirect loops).
- [ ] All external outbound links open in a new tab (`rel="noopener"`).
- [ ] Header navigation, dropdown menus, and footer links verified.
- [ ] Page URL matches canonical tag in `<head>`.
- [ ] Schema JSON-LD is valid and renders without parsing errors.

## 3. Visual & Layout Regression (Visual Regression Agent)
- [ ] Full-page scroll screenshots captured and saved to `/agents/qa/evidence/`.
- [ ] Header sticky behavior is stable (no jitter, no z-index overlap with modals).
- [ ] Footer stays anchored at bottom even on short content pages.
- [ ] Zero layout shift during asset loading.

## 4. UI/UX & Design System Integrity (Design System Auditor)
- [ ] Color contrast meets WCAG AA standards (>= 4.5:1 for normal text).
- [ ] System typography loads cleanly with zero flash of unstyled text (FOUT).
- [ ] All icons and SVGs render sharply across retina/high-DPI screens.
- [ ] Zero placeholder text ("lorem ipsum", "TODO", "test", dummy values).
- [ ] Zero debug outlines, red boxes, or temporary visual flags.

## 5. Console & Network Hygiene (Console Sweeper)
- [ ] Browser console is 100% clean of unhandled JavaScript exceptions.
- [ ] Network tab shows zero 4xx or 5xx failed asset requests.
- [ ] Zero exposed API keys, secret tokens, or internal file paths.
- [ ] Custom 404 error page renders properly for non-existent routes.

## 6. End-to-End File Upload / Process / Download (Tool Tester)
- [ ] Single file upload via file dialog: successful.
- [ ] Single file upload via drag-and-drop: successful.
- [ ] Processing indicator / progress bar displays accurately.
- [ ] Processing completes 100% in local browser memory (zero network upload).
- [ ] Download button generates valid file with appropriate filename.
- [ ] **Critical Integrity Check:** Downloaded file opens in external viewer and is confirmed intact (not 0 bytes, not corrupted, correct page count/resolution).
- [ ] Boundary cases tested:
  - [ ] Corrupt file input displays clear, helpful error message.
  - [ ] Oversized file triggers clean size limitation warning.
  - [ ] Empty (0-byte) file triggers validation notice.
  - [ ] Cancel and re-upload flow functions without page refresh.

## 7. Performance & Web Vitals (Performance Verifier)
- [ ] Mobile Lighthouse performance score >= 90.
- [ ] LCP < 2.5 seconds on Fast 4G throttling.
- [ ] CLS < 0.1 throughout interactive sessions.
- [ ] INP < 200ms on interactive controls.
