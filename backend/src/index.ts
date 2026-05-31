import { runMigrations } from './database/runMigrations.js';
import { isPiuBackendRunning, startServer } from './api/server.js';
import { startGoProcess } from './monitor/goProcess.js';
import { runRecovery } from './pipeline/recovery.js';
import { runInputBacklogScan } from './pipeline/inputBacklog.js';
import { acquireInstanceLock, releaseInstanceLock } from './util/lock.js';
import { registerShutdownHandlers } from './util/shutdown.js';
import { logger } from './util/logger.js';
import { CONFIRMED_ROOT, TXN_ROOT, PORT } from './config.js';
import { ensureDir } from './paths.js';
import path from 'node:path';

function ensureStorageDirs(): void {
  const dirs = [
    CONFIRMED_ROOT,
    path.join(TXN_ROOT, 'pending'),
    path.join(TXN_ROOT, 'error'),
    path.join(TXN_ROOT, 'dlq'),
  ];
  for (const dir of dirs) {
    ensureDir(dir);
  }
}

async function main(): Promise<void> {
  if (await isPiuBackendRunning()) {
    logger.info({ port: PORT }, 'PIU backend already running — exiting sidecar');
    process.exit(0);
  }

  ensureDir(path.dirname(CONFIRMED_ROOT));
  await acquireInstanceLock();
  ensureStorageDirs();
  runMigrations();
  await runRecovery();
  await runInputBacklogScan();
  await startServer();
  registerShutdownHandlers();
  startGoProcess();
  logger.info('PIU backend started');
}

main().catch(async (err) => {
  logger.error({ err }, 'Fatal startup error');
  await releaseInstanceLock();
  process.exit(1);
});
