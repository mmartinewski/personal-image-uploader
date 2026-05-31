import {
  confirmedRoot,
  dataRoot,
  frontendDistDir,
  goBinaryPath,
  logDir,
  pidFilePath,
  storageRoot,
  txnRoot,
} from './paths.js';

export const REPO_ROOT = dataRoot();
export const BACKEND_ROOT = dataRoot();
export const STORAGE_ROOT = storageRoot();
export const TXN_ROOT = txnRoot();
export const CONFIRMED_ROOT = confirmedRoot();

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.PIU_PORT) || 3737;
export const APP_URL = `http://${HOST}:${PORT}`;

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

export { goBinaryPath, pidFilePath, logDir, frontendDistDir };
