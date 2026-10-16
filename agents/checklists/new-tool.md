# Checklist: New Tool / Page Release (`new-tool.md`)

Required checklist for Lead 2, Lead 1, and Lead 3 before submitting any new tool or web utility to the Manager Agent.

## Tool Metadata
- **Tool Name:**
- **URL Path:**
- **Primary Function:**
- **Lead Responsible:** Lead 2

---

## 1. Product Engineering & Functionality (Lead 2 Tool Builder)
- [ ] 100% In-Browser Execution verified (zero server file upload calls).
- [ ] Drag-and-drop, file picker, and mobile camera access work reliably.
- [ ] Processing states clearly conveyed with accessible progress spinners/bars.
- [ ] File download generates correct binary with appropriate mime-type and filename.
- [ ] Binary validation: Downloaded file opened and tested in external native application.
- [ ] Edge cases handled:
  - [ ] Password-protected file warning.
  - [ ] Unsupported file format error message.
  - [ ] 0-byte or corrupt file warning.
  - [ ] Clear file / restart session button operates without full page reload.

## 2. Performance & Web Vitals (Lead 2 Performance Agent)
- [ ] Mobile Lighthouse performance score >= 90.
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- [ ] Heavy dependencies (e.g. PDFLib, Tesseract, JSZip) dynamically loaded or bundled efficiently.
- [ ] Total initial JavaScript payload optimized.

## 3. SEO & Discoverability (Lead 1 SEO Agent)
- [ ] Keyword research brief completed and reflected in headings and copy.
- [ ] Meta `<title>` (50-60 chars) and `<meta name="description">` (150-160 chars) optimized.
- [ ] Canonical URL verified and added to `sitemap.xml`.
- [ ] `WebApplication` or `SoftwareApplication` Schema.org JSON-LD implemented.
- [ ] FAQ Schema.org implemented for common technical questions.
- [ ] Internal links added from relevant guides, footer, and category pages.

## 4. Documentation & Companion Guide (Lead 3 Content Team)
- [ ] Accompanying step-by-step how-to guide published and linked.
- [ ] Real screenshots demonstrating tool controls embedded.
- [ ] Privacy guarantee explicitly stated (files never leave device).

## 5. Independent QA Sign-Off (QA Manager)
- [ ] Tested on 5-device class matrix (Small Android, iPhone, iPad Portrait/Landscape, Desktop).
- [ ] Zero Blocker and zero Major defects in `/agents/qa/defects.md`.
- [ ] Formal sign-off generated in `/agents/qa/signoff/`.
