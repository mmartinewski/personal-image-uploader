const { execSync } = require('node:child_process');
const path = require('node:path');

const goDir = path.join(__dirname, '..', 'go_monitor');
const binDir = path.join(__dirname, '..', 'backend', 'bin');
const binName = process.platform === 'win32' ? 'piu-monitor.exe' : 'piu-monitor';
const outPath = path.join(binDir, binName);

try {
  execSync('go mod tidy', { cwd: goDir, stdio: 'inherit' });
  execSync(`go build -o "${outPath}" .`, { cwd: goDir, stdio: 'inherit' });
  console.log(`Built ${outPath}`);
} catch (err) {
  console.warn(
    'Go build failed (check that Go is installed and modules can be downloaded):',
    err.message,
  );
  process.exit(0);
}
