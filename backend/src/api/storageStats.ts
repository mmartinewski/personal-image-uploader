import fs from 'node:fs';
import path from 'node:path';
import { CONFIRMED_ROOT, STATS_CACHE_TTL_MS, TXN_ROOT } from '../config.js';

let cache: { synced: number; pending: number; error: number; dlq: number; at: number } | null = null;

function countTxnFolders(root: string): number {
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  for (const bucket of fs.readdirSync(root, { withFileTypes: true })) {
    if (!bucket.isDirectory()) continue;
    const bucketPath = path.join(root, bucket.name);
    for (const txn of fs.readdirSync(bucketPath, { withFileTypes: true })) {
      if (txn.isDirectory() && fs.existsSync(path.join(bucketPath, txn.name, 'transaction.json'))) {
        count += 1;
      }
    }
  }
  return count;
}

export function getStorageCounts(): { synced: number; pending: number; error: number; dlq: number } {
  const now = Date.now();
  if (cache && now - cache.at < STATS_CACHE_TTL_MS) {
    return { synced: cache.synced, pending: cache.pending, error: cache.error, dlq: cache.dlq };
  }

  const synced = countTxnFolders(CONFIRMED_ROOT);
  const pending = countTxnFolders(path.join(TXN_ROOT, 'pending'));
  const error = countTxnFolders(path.join(TXN_ROOT, 'error'));
  const dlq = countTxnFolders(path.join(TXN_ROOT, 'dlq'));

  cache = { synced, pending, error, dlq, at: now };
  return { synced, pending, error, dlq };
}

export function invalidateStatsCache(): void {
  cache = null;
}
