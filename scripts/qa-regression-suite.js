const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
console.log('--- STARTING LOCALDOC.ORG PHASE 5 REGRESSION & CWV AUDIT ---');
console.log('Root Directory:', ROOT_DIR);

const results = {
  htmlFiles: [],
  jsFiles: [],
  errors: [],
  warnings: [],
  metrics: {
    totalPages: 0,
    totalScripts: 0,
    totalLinksChecked: 0,
    totalSchemasParsed: 0,
    validSchemas: 0,
    h1ChecksPassed: 0,
    viewportCoverPassed: 0,
    canonicalsMatched: 0,
    sitemapUrlsCount: 0,
    imagesWebpOrSvg: 0,
    legacyImagesCount: 0,
    zeroUploadToolsVerified: 0
  }
};

// 1. Collect all HTML files
function walkDir(dir, ext) {
  let list = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === '.agents' || f === 'localdoc-android') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      list = list.concat(walkDir(full, ext));
    } else if (f.endsWith(ext)) {
      list.push(full);
    }
  }
  return list;
}

const htmlPaths = walkDir(ROOT_DIR, '.html');
const jsPaths = walkDir(path.join(ROOT_DIR, 'js'), '.js');
results.metrics.totalPages = htmlPaths.length;
results.metrics.totalScripts = jsPaths.length;

console.log(`Discovered ${htmlPaths.length} HTML pages and ${jsPaths.length} JS scripts.`);

// 2. Validate Sitemap.xml
const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
let sitemapUrls = new Set();
if (fs.existsSync(sitemapPath)) {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  const locRegex = /<loc>(https:\/\/localdoc\.org[^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(sitemapContent)) !== null) {
    sitemapUrls.add(match[1]);
  }
  results.metrics.sitemapUrlsCount = sitemapUrls.size;
  console.log(`Sitemap contains ${sitemapUrls.size} URLs.`);
} else {
  results.errors.push('sitemap.xml not found at root!');
}

// 3. Inspect HTML Pages
for (const filePath of htmlPaths) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  // A. Viewport with viewport-fit=cover
  if (content.includes('name="viewport"') && content.includes('width=device-width')) {
    if (content.includes('viewport-fit=cover')) {
      results.metrics.viewportCoverPassed++;
    }
  } else {
    results.warnings.push(`[Viewport] ${relPath} missing standard mobile viewport tag.`);
  }

  // B. Single H1 Tag Check
  const h1Matches = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  if (h1Matches && h1Matches.length === 1) {
    results.metrics.h1ChecksPassed++;
  } else if (!h1Matches) {
    results.warnings.push(`[H1] ${relPath} has no <h1> tag.`);
  } else {
    results.warnings.push(`[H1] ${relPath} has multiple (${h1Matches.length}) <h1> tags.`);
  }

  // C. Title & Meta Description
  if (!content.includes('<title>') || !content.includes('</title>')) {
    results.errors.push(`[Title] ${relPath} missing <title> tag.`);
  }
  if (!content.includes('name="description"')) {
    results.warnings.push(`[Meta Description] ${relPath} missing meta description.`);
  }

  // D. Canonical URL
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (canonicalMatch) {
    const canonicalHref = canonicalMatch[1];
    if (sitemapUrls.has(canonicalHref)) {
      results.metrics.canonicalsMatched++;
    } else if (!relPath.includes('404.html')) {
      results.warnings.push(`[Canonical] ${relPath} canonical ${canonicalHref} is not in sitemap.xml`);
    }
  } else {
    results.warnings.push(`[Canonical] ${relPath} has no canonical link tag.`);
  }

  // E. JSON-LD Schemas
  const schemaRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let sMatch;
  while ((sMatch = schemaRegex.exec(content)) !== null) {
    results.metrics.totalSchemasParsed++;
    try {
      const parsed = JSON.parse(sMatch[1]);
      if (parsed['@context'] || parsed['@graph']) {
        results.metrics.validSchemas++;
      }
    } catch (e) {
      results.errors.push(`[Schema] ${relPath} contains malformed JSON-LD: ${e.message}`);
    }
  }

  // F. Image Formats in HTML
  const imgRegex = /<img\b[^>]+src=["']([^"']+)["']/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(content)) !== null) {
    const src = imgMatch[1];
    if (src.endsWith('.webp') || src.endsWith('.svg') || src.startsWith('data:')) {
      results.metrics.imagesWebpOrSvg++;
    } else if (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
      results.metrics.legacyImagesCount++;
      results.warnings.push(`[Legacy Image] ${relPath} loads non-WebP image: ${src}`);
    }
  }

  // G. Check Links for 404s
  const linkRegex = /<a\b[^>]+href=["']([^"'#]+)(#[^"']*)?["']/gi;
  let linkMatch;
  const pageDir = path.dirname(filePath);
  while ((linkMatch = linkRegex.exec(content)) !== null) {
    let target = linkMatch[1].trim();
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('tel:') || target.startsWith('javascript:')) {
      continue;
    }
    // Strip query parameters
    target = target.split('?')[0];
    if (!target) continue;
    results.metrics.totalLinksChecked++;
    
    // Resolve relative path
    let resolved;
    if (target.startsWith('/')) {
      resolved = path.join(ROOT_DIR, target);
    } else {
      resolved = path.resolve(pageDir, target);
    }

    if (!fs.existsSync(resolved)) {
      // Check if it's a directory targeting index.html
      if (fs.existsSync(path.join(resolved, 'index.html'))) {
        // OK
      } else {
        results.errors.push(`[Broken Link] In ${relPath}: target "${target}" does not exist at "${path.relative(ROOT_DIR, resolved)}".`);
      }
    }
  }

  // H. Check Zero-Upload compliance for tool pages
  if (relPath.startsWith('pages/')) {
    results.metrics.zeroUploadToolsVerified++;
    // Verify no remote upload form action
    if (content.includes('action="http') || content.includes('action="https://api.')) {
      results.errors.push(`[Privacy/Zero-Upload Violation] ${relPath} contains external remote form action!`);
    }
  }
}

// 4. Validate JS syntax on all JS files
console.log('Validating JavaScript syntax across codebase...');
const { execSync } = require('child_process');
for (const jsFile of jsPaths) {
  const relJs = path.relative(ROOT_DIR, jsFile).replace(/\\/g, '/');
  try {
    execSync(`node -c "${jsFile}"`, { stdio: 'pipe' });
  } catch (err) {
    results.errors.push(`[JS Syntax Error] in ${relJs}: ${err.message}`);
  }
}

// Summary Output
console.log('\n--- AUDIT RESULTS SUMMARY ---');
console.log(`Total Pages Audited: ${results.metrics.totalPages}`);
console.log(`Total JS Files Checked: ${results.metrics.totalScripts}`);
console.log(`Viewport Cover Compliant: ${results.metrics.viewportCoverPassed} / ${results.metrics.totalPages}`);
console.log(`H1 Tag Integrity: ${results.metrics.h1ChecksPassed} / ${results.metrics.totalPages}`);
console.log(`JSON-LD Schemas Validated: ${results.metrics.validSchemas} / ${results.metrics.totalSchemasParsed}`);
console.log(`Internal Links Validated: ${results.metrics.totalLinksChecked} (Broken: ${results.errors.filter(e => e.includes('Broken Link')).length})`);
console.log(`Sitemap / Canonical Matches: ${results.metrics.canonicalsMatched}`);
console.log(`Tools with Zero-Upload Compliance Verified: ${results.metrics.zeroUploadToolsVerified}`);
console.log(`Total Errors: ${results.errors.length}`);
console.log(`Total Warnings: ${results.warnings.length}`);

if (results.errors.length > 0) {
  console.log('\nERRORS FOUND:');
  results.errors.forEach(e => console.log('  ❌', e));
}
if (results.warnings.length > 0) {
  console.log('\nWARNINGS FOUND (showing top 15):');
  results.warnings.slice(0, 15).forEach(w => console.log('  ⚠️', w));
}

// Write findings to a JSON file for recording
fs.writeFileSync(path.join(ROOT_DIR, 'agents', 'qa', 'daily', 'qa-audit-phase5-metrics.json'), JSON.stringify(results, null, 2));
console.log('\nAudit complete. Metrics saved to agents/qa/daily/qa-audit-phase5-metrics.json');
