/**
 * Keep PIU version in sync across package.json, tauri.conf.json, and Cargo.toml.
 *
 * Usage:
 *   node scripts/sync-version.cjs              # read version from root package.json
 *   node scripts/sync-version.cjs 1.2.0        # set explicit version
 *   node scripts/sync-version.cjs --from-tag v1.2.0
 *   node scripts/sync-version.cjs --check-tag v1.2.0   # exit 1 if mismatch
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const semverRe = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeVersion(input) {
  const raw = String(input).trim();
  const version = raw.startsWith('v') ? raw.slice(1) : raw;
  if (!semverRe.test(version)) {
    throw new Error(`Invalid semver: ${input}`);
  }
  return version;
}

function parseArgs(argv) {
  let version = null;
  let checkTag = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from-tag' || arg === '--check-tag') {
      const next = argv[i + 1];
      if (!next) throw new Error(`Missing value for ${arg}`);
      if (arg === '--from-tag') version = normalizeVersion(next);
      else checkTag = normalizeVersion(next);
      i += 1;
    } else if (arg.startsWith('--from-tag=')) {
      version = normalizeVersion(arg.slice('--from-tag='.length));
    } else if (arg.startsWith('--check-tag=')) {
      checkTag = normalizeVersion(arg.slice('--check-tag='.length));
    } else if (!arg.startsWith('-')) {
      version = normalizeVersion(arg);
    }
  }

  if (!version) {
    version = readJson(path.join(root, 'package.json')).version;
    if (!version) throw new Error('Root package.json has no version field');
    version = normalizeVersion(version);
  }

  return { version, checkTag };
}

function updateCargoToml(filePath, version) {
  const text = fs.readFileSync(filePath, 'utf8');
  const next = text.replace(/^version = ".*"$/m, `version = "${version}"`);
  if (next === text) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next, 'utf8');
}

function updateTauriConf(filePath, version) {
  const data = readJson(filePath);
  data.version = version;
  writeJson(filePath, data);
}

function updatePackageJson(filePath, version) {
  const data = readJson(filePath);
  data.version = version;
  writeJson(filePath, data);
}

function main() {
  const { version, checkTag } = parseArgs(process.argv.slice(2));
  const current = normalizeVersion(readJson(path.join(root, 'package.json')).version);

  if (checkTag && checkTag !== current) {
    console.error(`Version mismatch: package.json=${current}, tag=${checkTag}`);
    process.exit(1);
  }

  if (version !== current) {
    updatePackageJson(path.join(root, 'package.json'), version);
    updatePackageJson(path.join(root, 'backend', 'package.json'), version);
    updatePackageJson(path.join(root, 'frontend', 'package.json'), version);
    updateTauriConf(path.join(root, 'src-tauri', 'tauri.conf.json'), version);
    updateCargoToml(path.join(root, 'src-tauri', 'Cargo.toml'), version);
    console.log(`Version synced to ${version}`);
  } else {
    console.log(`Version already ${version}`);
  }
}

main();
