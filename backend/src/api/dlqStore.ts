import fs from 'node:fs';
import path from 'node:path';
import { TXN_ROOT } from '../config.js';
import type { DlqEntry } from '../types/api.js';
import { listDeliveryFiles, readDelivery, readTransactionMeta } from '../pipeline/transaction.js';
import type { DeliveryState } from '../types/domain.js';

const DLQ_ROOT = path.join(TXN_ROOT, 'dlq');

export function findDlqTxnDir(txnId: string): { txnDir: string; bucket: string } | null {
  if (!fs.existsSync(DLQ_ROOT)) return null;
  for (const bucket of fs.readdirSync(DLQ_ROOT)) {
    const txnDir = path.join(DLQ_ROOT, bucket, txnId);
    if (fs.existsSync(path.join(txnDir, 'transaction.json'))) {
      return { txnDir, bucket };
    }
  }
  return null;
}

export function listDlqEntries(): DlqEntry[] {
  const entries: DlqEntry[] = [];
  if (!fs.existsSync(DLQ_ROOT)) return entries;

  for (const bucket of fs.readdirSync(DLQ_ROOT)) {
    const bucketPath = path.join(DLQ_ROOT, bucket);
    for (const txnId of fs.readdirSync(bucketPath)) {
      const txnDir = path.join(bucketPath, txnId);
      if (!fs.existsSync(path.join(txnDir, 'transaction.json'))) continue;
      const transaction = readTransactionMeta(txnDir);
      const deliveries = listDeliveryFiles(txnDir).map(readDelivery);
      entries.push({ txn_id: transaction.txn_id, bucket, transaction, deliveries });
    }
  }
  return entries;
}

export async function retryDlqTxn(txnId: string): Promise<void> {
  const found = findDlqTxnDir(txnId);
  if (!found) throw new Error('DLQ transaction not found');

  const { txnDir, bucket } = found;
  for (const file of listDeliveryFiles(txnDir)) {
    const d = readDelivery(file);
    if (d.status === 'dlq') {
      const updated: DeliveryState = {
        ...d,
        status: 'pending',
        immediate_attempts: 0,
        global_reprocesses: 0,
        last_error: null,
      };
      const { writeDelivery } = await import('../pipeline/transaction.js');
      writeDelivery(file, updated);
    }
  }

  const { moveTransactionTo } = await import('../pipeline/transaction.js');
  const pendingDir = await moveTransactionTo('pending', txnDir);
  const { dispatchTransaction } = await import('../pipeline/dispatcher.js');
  await dispatchTransaction(pendingDir);
}

export async function deleteDlqTxn(txnId: string): Promise<void> {
  const found = findDlqTxnDir(txnId);
  if (!found) throw new Error('DLQ transaction not found');
  const { removeDirRecursive } = await import('../util/fs.js');
  await removeDirRecursive(found.txnDir);
}

export function dlqImagePath(txnId: string): { filePath: string; ext: string } | null {
  const found = findDlqTxnDir(txnId);
  if (!found) return null;
  const meta = readTransactionMeta(found.txnDir);
  const imagePath = path.join(found.txnDir, `image.${meta.extension}`);
  if (!fs.existsSync(imagePath)) return null;
  return { filePath: imagePath, ext: meta.extension };
}
