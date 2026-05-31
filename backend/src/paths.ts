import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __dirname: string | undefined;

function moduleDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

const sourceDir = moduleDir();
/** True when running as a packaged binary (pkg / SEA). */
export function isPackaged(): boolean {
  return Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);
}

/** Directory containing backend runtime assets (migrations, monitor binary). */
export function appRoot(): string {
  if (process.env.PIU_APP_ROOT) {
    return path.resolve(process.env.PIU_APP_ROOT);
  }
  if (isPackaged()) {
    return path.dirname(process.execPath);
  }
  return path.resolve(sourceDir, '..');
}

/** Writable data directory (database, storage, logs, pid). */
export function dataRoot(): string {
  if (process.env.PIU_DATA_DIR) {
    return path.resolve(process.env.PIU_DATA_DIR);
  }
  if (isPackaged()) {
    const base =
      process.platform === 'win32'
        ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
        : process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Application Support')
          : path.join(os.homedir(), '.local', 'share');
    return path.join(base, 'PIU');
  }
  // Dev: keep storage/ at repository root (existing layout).
  return path.resolve(sourceDir, '../..');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function databasePath(): string {
  if (isPackaged() || process.env.PIU_DATA_DIR) {
    return path.join(dataRoot(), 'database.db');
  }
  return path.join(appRoot(), 'database.db');
}

export function storageRoot(): string {
  return path.join(dataRoot(), 'storage');
}

export function txnRoot(): string {
  return path.join(storageRoot(), 'transactions', 'image_upload');
}

export function confirmedRoot(): string {
  return path.join(storageRoot(), 'confirmed');
}

export function logDir(): string {
  return path.join(dataRoot(), 'logs');
}

export function pidFilePath(): string {
  return path.join(dataRoot(), '.piu.pid');
}

export function goBinaryPath(): string {
  const name = process.platform === 'win32' ? 'piu-monitor.exe' : 'piu-monitor';
  const packaged = path.join(appRoot(), name);
  if (fs.existsSync(packaged)) return packaged;
  return path.join(appRoot(), 'bin', name);
}

export function migrationsDir(): string {
  const candidates = [
    path.join(appRoot(), 'migrations'),
    path.join(appRoot(), 'src', 'database', 'migrations'),
    path.join(sourceDir, 'database', 'migrations'),
    path.resolve(sourceDir, '../../src/database/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(`Migrations directory not found. Checked: ${candidates.join(', ')}`);
}

export function frontendDistDir(): string {
  if (process.env.PIU_FRONTEND_DIST) {
    return path.resolve(process.env.PIU_FRONTEND_DIST);
  }
  const fromApp = path.join(appRoot(), 'frontend');
  if (fs.existsSync(path.join(fromApp, 'index.html'))) return fromApp;
  const browser = path.join(appRoot(), 'frontend', 'browser');
  if (fs.existsSync(path.join(browser, 'index.html'))) return browser;
  return path.resolve(sourceDir, '../../frontend/dist/frontend/browser');
}
