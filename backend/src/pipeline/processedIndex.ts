import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIRMED_ROOT, TXN_ROOT } from '../config.js';
import { walkTransactionJson } from '../util/fs.js';
import type { TransactionMeta } from '../types/domain.js';

function normPath(p: string): string {
  return path.normalize(p).toLowerCase();
}

export type ProcessedIndex = {
  paths: Set<string>;
  hashes: Set<string>;
};

export async function buildProcessedIndex(): Promise<ProcessedIndex> {
  const paths = new Set<string>();
  const hashes = new Set<string>();

  const roots = [
    path.join(TXN_ROOT, 'pending'),
    path.join(TXN_ROOT, 'error'),
    path.join(TXN_ROOT, 'dlq'),
    CONFIRMED_ROOT,
  ];

  for (const root of roots) {
    await walkTransactionJson(root, async (_txnDir, metaPath) => {
      const raw = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(raw) as TransactionMeta;
      if (meta.original_path) paths.add(normPath(meta.original_path));
      if (meta.file_hash_sha256) hashes.add(meta.file_hash_sha256);
    });
  }

  return { paths, hashes };
}

export function isPathAlreadyProcessed(index: ProcessedIndex, filePath: string): boolean {
  return index.paths.has(normPath(filePath));
}
