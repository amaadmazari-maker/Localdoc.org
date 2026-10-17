const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const p = path.join(pagesDir, file);
  let c = fs.readFileSync(p, 'utf8');
  let mod = false;

  // Clean remaining style blocks with .ba-slider-wrap
  const styleReg = /<style[^>]*>[\s\S]*?\.ba-slider-wrap[\s\S]*?<\/style>\s*/gi;
  if (styleReg.test(c)) {
    c = c.replace(styleReg, '');
    mod = true;
  }

  // Clean remaining script blocks with ba-slider-wrap
  const scriptReg = /<script[^>]*>[\s\S]*?ba-slider-wrap[\s\S]*?<\/script>\s*/gi;
  if (scriptReg.test(c)) {
    c = c.replace(scriptReg, '');
    mod = true;
  }

  // Clean any remaining ba-slider-section containers
  const secReg = /<div id="ba-slider-section">[\s\S]*?<\/div>\s*/gi;
  if (secReg.test(c)) {
    c = c.replace(secReg, '');
    mod = true;
  }

  if (mod) {
    fs.writeFileSync(p, c, 'utf8');
    console.log('Cleaned leftover slider style/script in', file);
  }
});
