const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'js');

// 1. Fix ui-utils.js
const uiUtilsPath = path.join(jsDir, 'core', 'ui-utils.js');
let uiUtils = fs.readFileSync(uiUtilsPath, 'utf8');

if (!uiUtils.includes('window.UIUtils = UIUtils')) {
  uiUtils += '\n\nif (typeof window !== "undefined") {\n  window.UIUtils = UIUtils;\n}\n';
}

// Ensure bindFileInput stores __localdoc_handler
if (!uiUtils.includes('inputEl.__localdoc_handler = onFilesSelected;')) {
  uiUtils = uiUtils.replace(
    /bindFileInput\(inputEl,\s*onFilesSelected\)\s*\{\s*if\s*\(!inputEl\)\s*return;/g,
    'bindFileInput(inputEl, onFilesSelected) {\n    if (!inputEl) return;\n    inputEl.__localdoc_handler = onFilesSelected;'
  );
}

fs.writeFileSync(uiUtilsPath, uiUtils, 'utf8');
console.log('Fixed ui-utils.js global export & handler binding');

// 2. Fix convert.js
const convertPath = path.join(jsDir, 'tools', 'convert.js');
let convert = fs.readFileSync(convertPath, 'utf8');
if (!convert.includes('window.PDFConvert = PDFConvert')) {
  convert += '\n\nif (typeof window !== "undefined") {\n  window.PDFConvert = PDFConvert;\n}\n';
  fs.writeFileSync(convertPath, convert, 'utf8');
  console.log('Fixed convert.js global export');
}

// 3. Fix organize.js
const organizePath = path.join(jsDir, 'tools', 'organize.js');
let organize = fs.readFileSync(organizePath, 'utf8');
if (!organize.includes('window.PDFOrganize = PDFOrganize')) {
  organize += '\n\nif (typeof window !== "undefined") {\n  window.PDFOrganize = PDFOrganize;\n}\n';
  fs.writeFileSync(organizePath, organize, 'utf8');
  console.log('Fixed organize.js global export');
}

// 4. Fix id-photo.js
const idPhotoPath = path.join(jsDir, 'tools', 'id-photo.js');
let idPhoto = fs.readFileSync(idPhotoPath, 'utf8');
if (!idPhoto.includes('window.IDPhoto = IDPhoto')) {
  idPhoto += '\n\nif (typeof window !== "undefined") {\n  window.IDPhoto = IDPhoto;\n}\n';
  fs.writeFileSync(idPhotoPath, idPhoto, 'utf8');
  console.log('Fixed id-photo.js global export');
}

// 5. Fix i18n.js
const i18nPath = path.join(jsDir, 'core', 'i18n.js');
if (fs.existsSync(i18nPath)) {
  let i18n = fs.readFileSync(i18nPath, 'utf8');
  if (!i18n.includes('window.I18N = I18N') && i18n.includes('const I18N =')) {
    i18n += '\n\nif (typeof window !== "undefined") {\n  window.I18N = I18N;\n}\n';
    fs.writeFileSync(i18nPath, i18n, 'utf8');
    console.log('Fixed i18n.js global export');
  }
}
