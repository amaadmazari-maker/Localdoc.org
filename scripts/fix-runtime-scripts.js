const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

console.log(`Auditing and fixing script execution order across ${files.length} pages...`);

let fixedCount = 0;

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Remove defer from all scripts loaded at bottom of page (<script defer src="../js/)
  // Because they are at the bottom of <body>, they should execute synchronously in declaration order!
  content = content.replace(/<script\s+defer\s+src=(["']\.\.\/js\/)/gi, '<script src=$1');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
    console.log(`[Fixed] Removed defer from bottom scripts in: ${file}`);
  }
});

console.log(`\nCompleted! Fixed script execution order in ${fixedCount} pages.`);
