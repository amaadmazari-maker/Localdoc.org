const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

console.log(`Auditing ${files.length} HTML pages in ${pagesDir}...\n`);

let totalTelemetryRemoved = 0;
let totalSlidersRemoved = 0;
let totalDiagramsRemoved = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let fileModified = false;

  // 1. Remove ba-slider-section (Archetype B fake comparison slider)
  // Pattern 1: <div id="ba-slider-section"> ... </div> (with possible style before it and script after it)
  // Let's do careful regex matching
  const baSectionRegex = /(?:[ \t]*<!--[^\n]*Archetype B[^\n]*-->\s*)?(?:[ \t]*<style>[\s\S]*?\.ba-slider-wrap[\s\S]*?<\/style>\s*)?<div id="ba-slider-section">[\s\S]*?<\/div>(?:\s*<script>[\s\S]*?\.ba-slider-wrap[\s\S]*?<\/script>)?(?:\s*<\/div>)?/gi;
  if (baSectionRegex.test(content)) {
    content = content.replace(baSectionRegex, '');
    totalSlidersRemoved++;
    fileModified = true;
    console.log(`[${file}] Removed ba-slider-section`);
  }

  // Backup pattern for standalone ba-slider-wrap if not caught by ba-slider-section
  const baWrapRegex = /[ \t]*<div class="ba-slider-wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>(?:\s*<script>[\s\S]*?\.ba-slider-wrap[\s\S]*?<\/script>)?/gi;
  if (baWrapRegex.test(content)) {
    content = content.replace(baWrapRegex, '');
    totalSlidersRemoved++;
    fileModified = true;
    console.log(`[${file}] Removed standalone ba-slider-wrap`);
  }

  // 2. Remove tool-telemetry-banner (Real-Device Performance Benchmark)
  // Pattern:
  // <!-- 1. Real-Device Performance Telemetry Banner -->
  // <div class="tool-telemetry-banner">...</div>
  const telemetryRegex = /[ \t]*(?:<!--[^\n]*Telemetry Banner[^\n]*-->\s*)?<div class="tool-telemetry-banner"[\s\S]*?<\/div>\s*<\/div>/gi;
  if (telemetryRegex.test(content)) {
    content = content.replace(telemetryRegex, '');
    totalTelemetryRemoved++;
    fileModified = true;
    console.log(`[${file}] Removed tool-telemetry-banner`);
  }

  // 3. Remove engineering-diagram-wrapper
  const diagramRegex = /[ \t]*(?:<!--[^\n]*Engineering Vector Diagram[^\n]*-->\s*)?<figure class="engineering-diagram-wrapper"[\s\S]*?<\/figure>/gi;
  if (diagramRegex.test(content)) {
    content = content.replace(diagramRegex, '');
    totalDiagramsRemoved++;
    fileModified = true;
    console.log(`[${file}] Removed engineering-diagram-wrapper`);
  }

  if (fileModified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

console.log(`\nPurge Complete!`);
console.log(`- Sliders removed: ${totalSlidersRemoved}`);
console.log(`- Telemetry banners removed: ${totalTelemetryRemoved}`);
console.log(`- Engineering diagrams removed: ${totalDiagramsRemoved}`);
