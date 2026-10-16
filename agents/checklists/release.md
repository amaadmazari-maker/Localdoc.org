# Checklist: Production Release Gate (`release.md`)

This checklist is completed solely by the **Manager Agent** before merging any branch into `main` and deploying to production.

## Release Information
- **Release ID:**
- **Date:**
- **Target Branch / Commit:**
- **Rollback Target Commit:**
- **Change Summary:**

---

## Manager Release Gates Verification

### Gate 1: Performance Gate
- [ ] Mobile Lighthouse performance score >= 90.
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms.
- [ ] All critical assets cached and compressed.
- [ ] **Status:** PASSED / FAILED

### Gate 2: Technical SEO Gate
- [ ] Valid `sitemap.xml` with all modified/added URLs included.
- [ ] `robots.txt` clean and operational.
- [ ] Canonical tags, meta descriptions, and unique titles confirmed.
- [ ] Schema.org structured data syntax validated.
- [ ] **Status:** PASSED / FAILED

### Gate 3: Content & Authority Gate
- [ ] Content is original, verified, and free of boilerplate filler.
- [ ] Real screenshots and tested instructions present.
- [ ] Real author credentials attached; human owner review completed.
- [ ] **Status:** PASSED / FAILED

### Gate 4: Device & Responsive Gate
- [ ] Verified on Small Android (360px), iPhone (390px/430px), iPad (768px/1024px), Laptop/Desktop.
- [ ] Zero horizontal overflow.
- [ ] Touch targets >= 44x44px.
- [ ] **Status:** PASSED / FAILED

### Gate 5: Safety & Regression Gate
- [ ] Zero browser console errors.
- [ ] Zero network 4xx/5xx errors.
- [ ] Local build / staging validation passed.
- [ ] Concrete rollback plan documented.
- [ ] **Status:** PASSED / FAILED

### Gate 6: Independent QA Verification Sign-Off (MANDATORY)
- [ ] QA Manager sign-off report attached (`/agents/qa/signoff/signoff-YYYY-MM-DD.md`).
- [ ] Exactly 0 open Blocker defects.
- [ ] Exactly 0 open Major defects.
- [ ] Minor defects cataloged with scheduled fix dates.
- [ ] **Status:** PASSED / FAILED

---

## Manager Final Determination
- [ ] **APPROVED FOR PRODUCTION DEPLOYMENT**
- [ ] **REJECTED (Returned to Lead with Written Defect List)**

*Signature: Manager Agent*
