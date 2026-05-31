/**
 * Full desktop release build: frontend, Go monitor, Node sidecar for Tauri.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const backendRoot = path.join(root, 'backend');
const bundleDir = path.join(backendRoot, 'dist-bundle');
const sidecarOutDir = path.join(root, 'src-tauri', 'binaries');
const targetTriple = execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim();
const ext = process.platform === 'win32' ? '.exe' : '';
const sidecarName = `piu-backend-${targetTriple}${ext}`;

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

console.log('Building Go monitor…');
run('node scripts/build-go.cjs');

console.log('Building backend TypeScript…');
run('npm run build --workspace=backend');

console.log('Building Angular frontend…');
run('npm run build --workspace=frontend');

console.log('Bundling backend with esbuild…');
const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: [path.join(backendRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(bundleDir, 'piu-backend.cjs'),
  external: ['better-sqlite3'],
  sourcemap: false,
});

console.log('Packaging Node sidecar with pkg…');
fs.mkdirSync(sidecarOutDir, { recursive: true });
const pkgBin = path.join(root, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');
const pkgTarget = process.platform === 'win32' ? 'node20-win-x64' : process.platform === 'darwin' ? 'node20-macos-x64' : 'node20-linux-x64';
execSync(
  `node "${pkgBin}" "${path.join(bundleDir, 'piu-backend.cjs')}" --targets ${pkgTarget} --output "${path.join(sidecarOutDir, 'piu-backend')}" --compress GZip`,
  { stdio: 'inherit', shell: true, cwd: root },
);

const builtSidecar = path.join(sidecarOutDir, `piu-backend${ext}`);
const finalSidecar = path.join(sidecarOutDir, sidecarName);
if (builtSidecar !== finalSidecar) {
  if (fs.existsSync(finalSidecar)) fs.unlinkSync(finalSidecar);
  fs.renameSync(builtSidecar, finalSidecar);
}

const sidecarAssets = path.join(sidecarOutDir, 'piu-backend-assets');
if (fs.existsSync(sidecarAssets)) fs.rmSync(sidecarAssets, { recursive: true, force: true });
fs.mkdirSync(sidecarAssets, { recursive: true });

/** Must match the Node major version embedded by @yao-pkg/pkg (node20-win-x64). */
const PKG_NODE_VERSION = '20.20.2';

function rebuildBetterSqlite3ForPkg() {
  const sqlitePkg = path.join(root, 'node_modules', 'better-sqlite3');
  const staging = path.join(bundleDir, 'better-sqlite3-pkg');
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  copyDir(sqlitePkg, staging);

  console.log(`Rebuilding better-sqlite3 for Node ${PKG_NODE_VERSION} (pkg sidecar)…`);
  execSync('npm rebuild --build-from-source', {
    cwd: staging,
    env: {
      ...process.env,
      npm_config_target: PKG_NODE_VERSION,
      npm_config_arch: 'x64',
      npm_config_target_arch: 'x64',
      npm_config_disturl: 'https://nodejs.org/dist',
      npm_config_runtime: 'node',
    },
    stdio: 'inherit',
    shell: true,
  });

  return staging;
}

const sqlitePkgForSidecar = rebuildBetterSqlite3ForPkg();
const sqliteNode = path.join(sqlitePkgForSidecar, 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(sqliteNode)) {
  throw new Error(`better_sqlite3.node not found after rebuild: ${sqliteNode}`);
}
copyFile(sqliteNode, path.join(sidecarAssets, 'better_sqlite3.node'));
copyFile(sqliteNode, path.join(sidecarOutDir, 'better_sqlite3.node'));
function copyRuntimeDep(name) {
  const src = path.join(root, 'node_modules', name);
  const dest = path.join(sidecarAssets, 'node_modules', name);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing runtime dependency for sidecar: ${name}`);
  }
  copyDir(src, dest);
}

copyDir(sqlitePkgForSidecar, path.join(sidecarAssets, 'node_modules', 'better-sqlite3'));
copyRuntimeDep('bindings');
copyRuntimeDep('file-uri-to-path');
copyDir(path.join(backendRoot, 'src', 'database', 'migrations'), path.join(sidecarAssets, 'migrations'));
copyFile(
  path.join(backendRoot, 'bin', `piu-monitor${ext}`),
  path.join(sidecarAssets, `piu-monitor${ext}`),
);

const frontendBrowser = path.join(root, 'frontend', 'dist', 'frontend', 'browser');
const frontendAssets = path.join(sidecarAssets, 'frontend');
if (fs.existsSync(frontendBrowser)) {
  copyDir(frontendBrowser, frontendAssets);
}

console.log(`Sidecar ready: ${finalSidecar}`);
console.log(`Assets: ${sidecarAssets}`);
