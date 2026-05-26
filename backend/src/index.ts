import { runMigrations } from './database/runMigrations.js';
import { startServer } from './api/server.js';
import { startGoProcess } from './monitor/goProcess.js';
import { runRecovery } from './pipeline/recovery.js';
import { runInputBacklogScan } from './pipeline/inputBacklog.js';
import { acquireInstanceLock, releaseInstanceLock } from './util/lock.js';
import { logger } from './util/logger.js';
import { CONFIRMED_ROOT, TXN_ROOT } from './config.js';
import fs from 'node:fs';
import path from 'node:path';

function ensureStorageDirs(): void {
  const dirs = [
    CONFIRMED_ROOT,
    path.join(TXN_ROOT, 'pending'),
    path.join(TXN_ROOT, 'error'),
    path.join(TXN_ROOT, 'dlq'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main(): Promise<void> {
  await acquireInstanceLock();
  ensureStorageDirs();
  runMigrations();
  await runRecovery();
  await runInputBacklogScan();
  startServer();
  startGoProcess();
  logger.info('PIU backend started');
}

main().catch(async (err) => {
  logger.error({ err }, 'Fatal startup error');
  await releaseInstanceLock();
  process.exit(1);
});
