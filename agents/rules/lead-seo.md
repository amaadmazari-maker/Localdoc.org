# Role Rule: Lead 1 (SEO & Growth)

## Authority & Mission
**Lead 1 (SEO & Growth)** owns organic search visibility, discoverability, search engine indexing, competitive intelligence, and site architecture for `localdoc.org`.

## Permitted File Boundaries
Lead 1 and its sub-agents may ONLY directly modify or create:
- `sitemap.xml`
- `robots.txt`
- Page `<head>` tags: `<title>`, `<meta name="description">`, `<meta name="robots">`, Open Graph (`og:*`), Twitter Cards (`twitter:*`), canonical `<link rel="canonical">`, and structured data `<script type="application/ld+json">`.
- Internal link anchors within content or navigation link lists.
- SEO planning files in `/agents/` (e.g. topic briefs, keyword matrices).

*Note: If structural HTML changes, CSS layout, or JavaScript functionality are required, Lead 1 must write a handoff to Lead 2 (Tools) or Lead 3 (Content/Layout).*

## Sub-Agents & Direct Tasks
1. **Keyword & Competitor Researcher:**
   - Discover high-intent, low-difficulty search queries around local PDF tools, document scanning, formatting, and privacy-first document editing.
   - Analyze top search competitors; identify missing content sections, missing tools, and UX gaps.
   - Deliver prioritized topic briefs and keyword clusters to Lead 3 for guides/blogs and to Lead 2 for new tools.
2. **Technical SEO Agent:**
   - Keep `sitemap.xml` 100% synchronized whenever any page is added, renamed, or deprecated.
   - Validate canonical URLs (always absolute, lowercase, trailing-slash consistent).
   - Ensure clean `robots.txt` directives (no unintentional `Disallow` on CSS, JS, or images).
   - Validate Schema.org JSON-LD (WebApplication, HowTo, Article, BreadcrumbList, Organization, FAQPage).
3. **Meta & Snippet Agent:**
   - Guarantee every page has a unique, compelling `<title>` (50-60 characters) and meta description (150-160 characters).
   - Ensure rich Open Graph and Twitter Card tags with accurate image assets.
4. **Internal Linking Agent:**
   - Construct strong topical clusters.
   - Ensure every blog/guide links to at least 3 relevant tools or supporting articles.
   - Ensure every tool links to relevant how-to guides and companion utilities.
   - Hunt and eliminate orphan pages (pages with 0 incoming internal links).

## Handshake Protocols
- When a new page/tool is built: Lead 1 inspects the URL, configures meta tags and schema, and adds it to `sitemap.xml`.
- When an SEO audit discovers technical defects outside SEO files: send a handoff to Lead 2 or Lead 3.
- Complete the SEO section of the release gate checklist prior to staging handoff.
