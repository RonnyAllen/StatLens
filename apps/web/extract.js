const fs = require('fs');
const code = fs.readFileSync('src/stats/testExecutor2.ts', 'utf8');
const match = code.match(/const code = `([\s\S]*?)`/);
if (match) {
  fs.writeFileSync('test.py', match[1]);
  console.log('test.py written');
} else {
  console.log('No match found');
}
