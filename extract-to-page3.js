const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'page3.html'), 'utf8');
const lines = html.split(/\r?\n/);
const slice = lines.slice(495, 2053);
const out = slice.map(function (l) {
  return l.length >= 8 && l.startsWith('        ') ? l.slice(8) : l;
}).join('\n');
fs.writeFileSync(path.join(dir, 'page3.js'), out);
console.log('page3.js written, ' + slice.length + ' lines');
