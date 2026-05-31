/**
 * Run Tauri CLI with ~/.cargo/bin on PATH (Rust is often missing from Windows PATH).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mode = process.argv[2] || 'dev';

if (!['dev', 'build'].includes(mode)) {
  console.error(`Usage: node scripts/run-tauri.cjs <dev|build>`);
  process.exit(1);
}

const pathParts = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
const cargoBin = path.join(os.homedir(), '.cargo', 'bin');

if (fs.existsSync(cargoBin) && !pathParts.includes(cargoBin)) {
  pathParts.unshift(cargoBin);
}

const env = {
  ...process.env,
  PATH: pathParts.join(path.delimiter),
  CARGO_TARGET_DIR: path.join(root, 'src-tauri', 'target'),
};

const tauriBin =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'tauri.cmd')
    : path.join(root, 'node_modules', '.bin', 'tauri');

const result = spawnSync(tauriBin, [mode], {
  stdio: 'inherit',
  env,
  cwd: root,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
