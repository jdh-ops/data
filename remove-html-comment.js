var fs = require('fs');
var path = require('path');
var filePath = path.join(__dirname, 'page3.html');
var s = fs.readFileSync(filePath, 'utf8');
var pattern = /    <!-- 인라인 스크립트는 page3\.js로 이동됨[\s\S]*?    -->\r?\n/m;
var newContent = s.replace(pattern, '');
if (newContent.length === s.length) {
  console.log('No match - pattern might need adjustment');
  process.exit(1);
}
fs.writeFileSync(filePath, newContent);
console.log('Removed comment block. New length:', newContent.split(/\r?\n/).length, 'lines');
