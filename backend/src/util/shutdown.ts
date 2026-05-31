import { db } from '../database/db.js';
import { stopGoProcess } from '../monitor/goProcess.js';
import { releaseInstanceLock } from '../util/lock.js';
import { logger } from './logger.js';
import { stopServer } from '../api/server.js';

let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('PIU backend shutting down');

  stopGoProcess();
  await stopServer();
  await releaseInstanceLock();

  try {
    db.close();
  } catch (err) {
    logger.warn({ err }, 'Failed to close database');
  }

  process.exit(exitCode);
}

export function registerShutdownHandlers(): void {
  const onSignal = (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    void shutdown(0);
  };

  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  if (process.platform === 'win32') {
    process.on('SIGHUP', () => onSignal('SIGHUP'));
  }
}
