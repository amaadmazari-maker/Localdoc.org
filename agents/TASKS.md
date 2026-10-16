# Task Board: localdoc.org

`ID | Title | Owner | Status (todo / doing / review / blocked / done) | Depends on | Due | Notes`

| ID | Title | Owner | Status | Depends on | Due | Notes |
|:---|:---|:---|:---:|:---|:---:|:---|
| TSK-001 | Initialize Multi-Agent System & `/agents` structure | Manager | done | None | 2026-10-16 | Directory layout, rules, checklists, test plan, role handoffs initialized |
| TSK-002 | Phase 1: Baseline Site Crawl & Technical SEO Audit | Lead 1 | done | TSK-001 | 2026-10-16 | 80 pages audited; 79 URLs indexed; 0 broken links; 3 SERP titles optimized |
| TSK-003 | Phase 1: Tool Performance & Core Web Vitals Audit | Lead 2 | done | TSK-001 | 2026-10-16 | 34 tools audited; 100% in-browser RAM confirmed; 44px tap targets verified |
| TSK-004 | Phase 1: Content Quality, Author Trust & Design System Audit | Lead 3 | done | TSK-001 | 2026-10-16 | 35 guides audited (avg 3,122 words); 231 diagrams; author Amaad Mazari verified |
| TSK-005 | Phase 1: Independent QA Baseline Audit & Defect Catalog | QA Manager | done | TSK-001 | 2026-10-16 | 5-device class verification pass; 0 blocker/major defects; 3 defects cataloged |
| TSK-006 | Phase 2: Remediate DEF-001 - Bundle MediaPipe offline assets | Lead 2 | todo | TSK-005 | 2026-10-18 | Bundle selfie segmentation in `/js/lib/` for 100% offline capability |
| TSK-007 | Phase 2: Remediate DEF-002 - Convert legacy guide diagrams to WebP | Lead 3 | todo | TSK-005 | 2026-10-19 | Convert 81 legacy blog diagrams to modern WebP/SVG format |
| TSK-008 | Phase 2: Remediate DEF-003 - Standardize `/blog/` clean URL canonical | Lead 1 | todo | TSK-005 | 2026-10-18 | Standardize directory index canonicals and sitemap to `/blog/` |
| TSK-009 | Phase 2: Global Design System & Component Synchronization | Lead 3 | todo | TSK-004 | 2026-10-20 | Harmonize shared header/footer components and design tokens |
| TSK-010 | Phase 2: QA Verification & Pre-Release Sign-Off Pass | QA Manager | todo | TSK-006, TSK-007, TSK-008 | 2026-10-20 | Execute full qa-full.md matrix retest and issue signoff report |
