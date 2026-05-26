import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const BACKEND_ROOT = path.resolve(__dirname, '..');
export const STORAGE_ROOT = path.join(REPO_ROOT, 'storage');
export const TXN_ROOT = path.join(STORAGE_ROOT, 'transactions', 'image_upload');
export const CONFIRMED_ROOT = path.join(STORAGE_ROOT, 'confirmed');

export const HOST = '127.0.0.1';
export const PORT = 3737;
export const CORS_ORIGIN = 'http://localhost:4200';

export const STABILITY_POLL_MS = 200;
export const STABILITY_WINDOW_MS = 600;
export const ERROR_RETRY_DELAY_MS = 60_000;
export const MAX_IMMEDIATE_ATTEMPTS = 3;
export const MAX_GLOBAL_REPROCESSES = 3;
export const STATS_CACHE_TTL_MS = 1_000;
export const SSE_HEARTBEAT_MS = 15_000;

export const GO_RESTART_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
export const GO_UPTIME_RESET_MS = 60_000;

export const DEFAULT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** Max files processed from input folders on each backend boot (backlog catch-up). */
export const STARTUP_BACKLOG_MAX_FILES = 100;

export function goBinaryPath(): string {
  const name = process.platform === 'win32' ? 'piu-monitor.exe' : 'piu-monitor';
  return path.join(BACKEND_ROOT, 'bin', name);
}

export function pidFilePath(): string {
  return path.join(BACKEND_ROOT, '.piu.pid');
}

export function logDir(): string {
  return path.join(BACKEND_ROOT, 'logs');
}
