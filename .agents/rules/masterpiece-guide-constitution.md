# Masterpiece Guide Constitution & Strict Engineering Rules
**Applicable Scope:** All articles, guides, infographics, and metadata in `localdoc.org/blog/` and related tools in `pages/`.  
**Authority:** Mandatory & Non-Negotiable. Self-Enforcing across all coding and writing sessions.

---

## 1. The Zero Empty Rectangles Law (Visual Graphic Mandate)
- **Absolute Prohibition:** NEVER place a raw screenshot with an empty CSS border, dashed line, or pulsing box. This looks like low-effort automated content and triggers AdSense rejection.
- **Mandatory Viewport Wrapper:** Every visual walkthrough step MUST be wrapped in `<div class="annotated-viewport" ...>`.
- **Inline SVG Directional Arrows:** Every walkthrough card MUST contain genuine inline SVG curved pointer arrows with high-contrast drop shadows:
  ```html
  <svg class="svg-pointer-arrow" ...>
    <defs>
      <marker id="arrowhead-..." markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#0284C7"/>
      </marker>
    </defs>
    <path d="M... Q... ..." marker-end="url(#arrowhead-...)" fill="none" stroke="#0284C7" stroke-width="2.5"/>
  </svg>
  ```
- **Picture-in-Picture (PiP) Detail Zoom Insets:** Every walkthrough card MUST feature a `.pip-sec-inset` or magnifying callout lens showing high-resolution 300% zoom of typography, byte-counter telemetry chips, or before/after comparison states.
- **Numbered Step Pins & Two-Line Tooltips:** Every visual MUST feature drop-shadowed step badges (`①`, `②`, `③`) anchored to exact interface coordinates, coupled with high-contrast two-line tooltips (`.annotation-tooltip`).
- **Interactive UI Motion Simulation:** Every guide must include a simulated video tutorial element or visual motion frame illustrating user interaction dynamics.

---

## 2. Anti-Cannibalization & Master Consolidation Law
- **No Doorway Pages or Duplicates:** Never maintain separate thin articles on mirror topics (e.g. separate "Word to PDF" and "PDF to Word", or "Organize PDF" and "Rotate PDF").
- **Unified Master Pillars:** Overlapping topics MUST be consolidated into a newly titled, comprehensive flagship pillar.
- **Zero 404 Errors Guarantee:** Every legacy file must remain accessible on disk with:
  1. Permanent 301 redirect configuration in `vercel.json`.
  2. `<meta http-equiv="refresh" content="0; url=https://localdoc.org/blog/[new-master-guide].html">`.
  3. `<link rel="canonical" href="https://localdoc.org/blog/[new-master-guide].html">`.
  This preserves 100% of historical backlinks and PageRank without losing organic traffic.

---

## 3. Deep Humanized Voice & Zero AI Fluff Law
- **Authentic Engineering Perspective:** All guides are authored strictly from the perspective of **Amaad Mazari (Lead Document & Cryptographic Systems Specialist)**.
- **Banned AI Tropes:** Forbidden words and phrases:
  - *"In today's fast-paced digital world"*
  - *"Delve into"*
  - *"A testament to"*
  - *"Revolutionize / Game-changer"*
  - *"Seamlessly / Effortlessly"*
- **Mathematical & Legal Grounding:** Every guide must provide concrete mathematical formulas ($\text{Pixels} = \frac{\text{Millimeters}}{25.4} \times \text{DPI}$, Shannon Entropy $H(X)$, PostScript coordinate systems), exact statutory citations (US ESIGN Act 15 U.S.C. § 7001, EU eIDAS 910/2014, FRE 1003), and ISO standards (ISO 32000-1, ISO 19005-2 PDF/A).
- **Word Count Benchmark:** Minimum 2,500 to 5,000+ words of dense, actionable, high-utility technical content.

---

## 4. Complete Layout Parity & SEO Graph Law
Every single Master Guide MUST feature the following structural components:
1. **Dual CTA Banners:** Top hero banner and bottom conversion card linking to the tool.
2. **Sticky Table of Contents (`.toc-box`):** 9-section jump navigation menu with smooth scroll anchors.
3. **Google Featured Snippet Box (`.quick-answer-card`):** High-impact 45-word direct answer targeting Position 0.
4. **Vector Architecture Diagram (Figure 1):** Detailed visual flow showing in-memory client execution.
5. **Technical Comparison Table (`.comp-table-wrap`):** Cross-comparison matrix evaluating tools, specifications, or algorithms.
6. **Verified Author E-E-A-T Box (`.editorial-author-box`):** Full credentials, photo, review date, and editorial standards statement.
7. **4-Part Schema.org JSON-LD Graph:**
   - `BreadcrumbList`
   - `TechArticle`
   - `HowTo` (with exact steps and image URLs)
   - `FAQPage` (with 5–8 high-intent Q&As)

---

## 5. Verification, Safety & Reversibility Protocol
1. **Local Pre-Flight Inspection:** Every modified or created page must return HTTP 200 and render cleanly on `http://127.0.0.1:8080/`.
2. **Automated Audit Passing:** Every file must register `[PASS]` in `scratch/summarize-audit.js`.
3. **Atomic Git Commits:** Every milestone is committed with a conventional commit message and pushed to GitHub main, maintaining full reversibility.
