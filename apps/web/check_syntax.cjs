const fs = require('fs');
const code = fs.readFileSync('src/stats/testExecutor2.ts', 'utf8');
const start = code.indexOf('`');
const end = code.indexOf('`', start + 1);
fs.writeFileSync('test_verify.py', code.substring(start + 1, end));
