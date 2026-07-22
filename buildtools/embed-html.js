// Regenerates buildtools/index_html.cjs from public/index.html.
// Run automatically by `npm run build:win`.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const out = '// AUTO-GENERATED at build time from public/index.html - do not edit\n'
  + 'module.exports = ' + JSON.stringify(html) + ';\n';
fs.writeFileSync(path.join(__dirname, 'index_html.cjs'), out);
console.log('buildtools/index_html.cjs regenerated (' + html.length + ' bytes of HTML)');
