import fs from 'node:fs';
import { pidFilePath } from '../config.js';
import { logger } from './logger.js';

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    return code === 'EPERM';
  }
}

function readStoredPid(): number | null {
  const path = pidFilePath();
  if (!fs.existsSync(path)) return null;
  const raw = fs.readFileSync(path, 'utf8').trim();
  const pid = Number(raw);
  return Number.isInteger(pid) ? pid : null;
}

function writePidFile(): void {
  fs.writeFileSync(pidFilePath(), String(process.pid), 'utf8');
}

function removePidFile(): void {
  try {
    const path = pidFilePath();
    if (!fs.existsSync(path)) return;
    const stored = readStoredPid();
    if (stored === null || stored === process.pid) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore cleanup errors
  }
}

let shutdownHooksRegistered = false;

function registerShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = () => {
    removePidFile();
  };

  process.on('exit', shutdown);
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
}

export async function acquireInstanceLock(): Promise<void> {
  const stored = readStoredPid();

  if (stored !== null && stored !== process.pid && isProcessAlive(stored)) {
    logger.error({ pid: stored }, 'Another PIU instance is already running. Exiting.');
    process.exit(1);
  }

  if (stored !== null && !isProcessAlive(stored)) {
    logger.warn({ pid: stored }, 'Removing stale PIU pid file from a previous run');
    removePidFile();
  }

  writePidFile();
  registerShutdownHooks();
  logger.info({ pid: process.pid }, 'Single-instance lock acquired');
}

export async function releaseInstanceLock(): Promise<void> {
  removePidFile();
}
