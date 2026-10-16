# Checklist: Post-Deploy Live Smoke Test (`qa-postdeploy.md`)

Execute immediately after production deployment by the QA Manager and Manager Agent.

## Live Smoke Test Matrix
- [ ] **Homepage Health:**
  - [ ] Returns HTTP 200 within < 1.0s TTFB.
  - [ ] Hero section, tool grid, and navigation render correctly.
  - [ ] Console shows zero runtime errors.
- [ ] **Core Tool Functionality (Sample 3 Key Tools):**
  - [ ] Tool 1 (e.g. PDF Merge / Camera Studio): Full run from file selection -> process -> download -> binary verification.
  - [ ] Tool 2 (e.g. PDF Sign / Compress): File input -> signature placement / slider adjust -> download -> verify.
  - [ ] Tool 3 (e.g. ID Photo / Scan): Camera or image load -> crop/filter -> download -> verify.
- [ ] **Editorial & Trust Pages:**
  - [ ] One latest blog/guide loads completely with all images displaying.
  - [ ] About / Contact / Privacy pages load with valid author information.
- [ ] **SEO & Indexing Sanity:**
  - [ ] `localdoc.org/sitemap.xml` loads valid XML with HTTP 200.
  - [ ] `localdoc.org/robots.txt` loads correct directives.

## Rollback Trigger Protocol
> [!CAUTION]
> If any of the following occur during the post-deploy smoke test, the Manager Agent must immediately abort the release, roll back to the previously designated commit, and notify the team:
> 1. Any core tool fails to download or outputs corrupted files.
> 2. Critical JavaScript console errors break primary user interactions.
> 3. Production server returns 5xx errors or broken asset 404s for styles/scripts.
