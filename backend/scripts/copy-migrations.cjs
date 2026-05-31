const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'src', 'database', 'migrations');
const dest = path.join(__dirname, '..', 'dist', 'database', 'migrations');

fs.mkdirSync(dest, { recursive: true });

for (const file of fs.readdirSync(src)) {
  if (!file.endsWith('.sql')) continue;
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

console.log(`Copied migrations to ${dest}`);
