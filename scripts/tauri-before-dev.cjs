/**
 * Prepare backend for `tauri dev` (compile TS + Go, no pkg).
 * Backend is started by the Tauri tray app (Rust sidecar), not as a dev server URL.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

const env = {
  ...process.env,
  NG_CLI_ANALYTICS: 'false',
};

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true, env });
}

run('node scripts/build-go.cjs');
run('npm run build --workspace=backend');
run('npm run build --workspace=frontend');

console.log('Tauri dev prerequisites ready.');
