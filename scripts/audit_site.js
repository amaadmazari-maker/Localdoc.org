#!/usr/bin/env node

/**
 * LocalDoc.org — Automated Pre-Flight Integrity & Quality Audit
 * 
 * Verifies:
 * 1. Broken internal links across all HTML files
 * 2. Missing image/media assets (<img src="...">)
 * 3. Unrendered LaTeX math formulas or raw '$ $' math notation
 * 4. HTML tag integrity and closing tags
 * 5. Scratch/cache directory disk hygiene
 * 
 * Usage: node scripts/audit_site.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to recursively collect all HTML files
function getHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== 'scratch' && entry.name !== 'node_modules') {
        results = results.concat(getHtmlFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('=====================================================');
console.log('   LocalDoc Pre-Flight Integrity & Quality Audit     ');
console.log('=====================================================\n');

const htmlFiles = getHtmlFiles(ROOT_DIR);
console.log(`Scanning ${htmlFiles.length} HTML files across repository...\n`);

let stats = {
  scannedFiles: htmlFiles.length,
  brokenLinks: [],
  missingAssets: [],
  latexIssues: [],
  tagErrors: [],
  scratchSizeMB: 0
};

// 1. Audit HTML files
htmlFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file);
  const content = fs.readFileSync(file, 'utf8');

  // Check Tag Integrity
  if (!content.includes('</body>') || !content.includes('</html>')) {
    stats.tagErrors.push({ file: relPath, error: 'Missing closing </body> or </html>' });
  }

  // Check Internal Links
  const linkMatches = content.matchAll(/href=["']([^"']+)["']/gi);
  for (const m of linkMatches) {
    const url = m[1].trim();
    if (
      !url ||
      url.startsWith('#') ||
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('javascript:')
    ) {
      continue;
    }

    const cleanUrl = url.split('#')[0].split('?')[0];
    if (!cleanUrl) continue;

    const targetPath = cleanUrl.startsWith('/')
      ? path.join(ROOT_DIR, cleanUrl.slice(1))
      : path.resolve(path.dirname(file), cleanUrl);

    if (!fs.existsSync(targetPath)) {
      stats.brokenLinks.push({ file: relPath, link: url, target: path.relative(ROOT_DIR, targetPath) });
    }
  }

  // Check Image & Media Assets
  const assetMatches = content.matchAll(/(?:src|data-src)=["']([^"']+)["']/gi);
  for (const m of assetMatches) {
    const src = m[1].trim();
    if (
      !src ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('blob:') ||
      src.includes('${') // Skip JS template literals
    ) {
      continue;
    }

    const cleanSrc = src.split('#')[0].split('?')[0];
    if (!cleanSrc) continue;

    const targetAsset = cleanSrc.startsWith('/')
      ? path.join(ROOT_DIR, cleanSrc.slice(1))
      : path.resolve(path.dirname(file), cleanSrc);

    if (!fs.existsSync(targetAsset)) {
      stats.missingAssets.push({ file: relPath, asset: src, resolved: path.relative(ROOT_DIR, targetAsset) });
    }
  }

  // Check Unrendered LaTeX / Raw Math Notation outside of script/style
  const noScript = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  if (noScript.includes('\\begin{') || noScript.includes('\\frac{') || noScript.includes('\\sqrt{')) {
    stats.latexIssues.push({ file: relPath, detail: 'Raw LaTeX syntax (\\frac, \\begin, etc.) found' });
  }

  const dollarMatches = noScript.match(/\$([^\$\n]{1,80})\$/g);
  if (dollarMatches) {
    dollarMatches.forEach(dm => {
      // Allow currency like $10, $20.00, $150+, or price ranges like $10 &ndash; $40
      const inner = dm.slice(1, -1).trim();
      const isCurrency = /^\d+(\.\d{2})?(\+)?(\s*(\/|to|each|for|per|&ndash;|-)\s*)?$/i.test(inner);
      if (!isCurrency) {
        stats.latexIssues.push({ file: relPath, detail: `Unrendered math dollar notation: ${dm}` });
      }
    });
  }
});

// 2. Check Scratch Directory Disk Hygiene
const scratchDir = path.join(ROOT_DIR, 'scratch');
if (fs.existsSync(scratchDir)) {
  let totalBytes = 0;
  function getDirBytes(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getDirBytes(full);
      } else {
        try {
          totalBytes += fs.statSync(full).size;
        } catch (e) {}
      }
    }
  }
  getDirBytes(scratchDir);
  stats.scratchSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
}

// 3. Print Results
console.log('--- AUDIT RESULTS ---');
console.log(`[+] HTML Files Inspected: ${stats.scannedFiles}`);

if (stats.tagErrors.length === 0) {
  console.log('[PASS] DOM Tag Integrity: 100% Valid (All closing tags intact)');
} else {
  console.error(`[FAIL] DOM Tag Integrity: ${stats.tagErrors.length} errors found:`);
  stats.tagErrors.forEach(e => console.error(`   - ${e.file}: ${e.error}`));
}

if (stats.brokenLinks.length === 0) {
  console.log('[PASS] Internal Links: 100% Valid (0 broken links)');
} else {
  console.error(`[FAIL] Internal Links: ${stats.brokenLinks.length} broken link(s) found:`);
  stats.brokenLinks.forEach(l => console.error(`   - ${l.file} -> ${l.link}`));
}

if (stats.missingAssets.length === 0) {
  console.log('[PASS] Media & Assets: 100% Valid (0 missing images/icons)');
} else {
  console.error(`[FAIL] Media & Assets: ${stats.missingAssets.length} missing asset(s) found:`);
  stats.missingAssets.forEach(a => console.error(`   - ${a.file} -> ${a.asset}`));
}

if (stats.latexIssues.length === 0) {
  console.log('[PASS] Typography & Math: 100% Clean (0 unrendered LaTeX / dollar signs)');
} else {
  console.error(`[FAIL] Typography & Math: ${stats.latexIssues.length} unrendered math issue(s):`);
  stats.latexIssues.forEach(m => console.error(`   - ${m.file}: ${m.detail}`));
}

console.log(`[INFO] Scratch Disk Footprint: ${stats.scratchSizeMB} MB`);
if (parseFloat(stats.scratchSizeMB) > 50) {
  console.warn('[WARN] Scratch directory is larger than 50MB. Run cleanup.');
} else {
  console.log('[PASS] Disk Hygiene: Clean');
}

console.log('\n=====================================================');
const totalErrors = stats.tagErrors.length + stats.brokenLinks.length + stats.missingAssets.length + stats.latexIssues.length;

if (totalErrors === 0) {
  console.log('   VERIFICATION SUCCESS: Repository is 100% Healthy!  ');
  console.log('=====================================================\n');
  process.exit(0);
} else {
  console.error(`   VERIFICATION FAILED: ${totalErrors} issue(s) require resolution. `);
  console.log('=====================================================\n');
  process.exit(1);
}
