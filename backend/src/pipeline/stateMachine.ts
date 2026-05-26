import fs from 'node:fs';
import path from 'node:path';
import { CONFIRMED_ROOT, ERROR_RETRY_DELAY_MS, MAX_GLOBAL_REPROCESSES, MAX_IMMEDIATE_ATTEMPTS, TXN_ROOT } from '../config.js';
import { outputsRepo } from '../database/repos/outputs.repo.js';
import { adapters } from '../discord/index.js';
import { DiscordUploadError } from '../discord/adapter.js';
import { eventBus } from '../api/eventBus.js';
import { nowIso } from '../util/dates.js';
import {
  findImageFile,
  listDeliveryFiles,
  moveTransactionTo,
  parseTxnDir,
  readDelivery,
  purgeImageFromTransaction,
  readTransactionMeta,
  writeDelivery,
} from './transaction.js';

const errorTimers = new Map<string, NodeJS.Timeout>();

function serializeError(err: unknown): string {
  if (err instanceof DiscordUploadError) {
    return `${err.message} (${err.status}): ${err.body.slice(0, 500)}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function findTxnDirById(txnId: string): string | null {
  const stages = ['pending', 'error', 'dlq'] as const;
  for (const stage of stages) {
    const root = path.join(TXN_ROOT, stage);
    if (!fs.existsSync(root)) continue;
    for (const bucket of fs.readdirSync(root)) {
      const candidate = path.join(root, bucket, txnId);
      if (fs.existsSync(path.join(candidate, 'transaction.json'))) return candidate;
    }
  }
  if (fs.existsSync(CONFIRMED_ROOT)) {
    for (const bucket of fs.readdirSync(CONFIRMED_ROOT)) {
      const candidate = path.join(CONFIRMED_ROOT, bucket, txnId);
      if (fs.existsSync(path.join(candidate, 'transaction.json'))) return candidate;
    }
  }
  return null;
}

export async function attemptDelivery(txnDir: string, deliveryFile: string): Promise<void> {
  const delivery = readDelivery(deliveryFile);
  if (delivery.status !== 'pending') return;

  const meta = readTransactionMeta(txnDir);
  const output = outputsRepo.getById(delivery.output_id);
  if (!output) {
    delivery.status = 'dlq';
    delivery.last_error = `Output ${delivery.output_id} not found`;
    writeDelivery(deliveryFile, delivery);
    await finalizeIfTerminal(txnDir);
    return;
  }

  const imagePath = findImageFile(txnDir);

  try {
    await adapters[output.type].upload(imagePath, output.destination_config);
    delivery.status = 'success';
    delivery.last_error = null;
    delivery.last_attempt_at = nowIso();
    writeDelivery(deliveryFile, delivery);
    eventBus.emit('delivery_success', { txn_id: meta.txn_id, output_id: delivery.output_id });
  } catch (err) {
    if (err instanceof DiscordUploadError && err.status === 429 && err.retryAfterMs) {
      setTimeout(() => {
        void attemptDelivery(txnDir, deliveryFile);
      }, err.retryAfterMs);
      return;
    }

    delivery.immediate_attempts += 1;
    delivery.last_error = serializeError(err);
    delivery.last_attempt_at = nowIso();

    if (delivery.immediate_attempts < MAX_IMMEDIATE_ATTEMPTS) {
      writeDelivery(deliveryFile, delivery);
      return attemptDelivery(txnDir, deliveryFile);
    }

    delivery.immediate_attempts = 0;
    delivery.global_reprocesses += 1;

    if (delivery.global_reprocesses > MAX_GLOBAL_REPROCESSES) {
      delivery.status = 'dlq';
      writeDelivery(deliveryFile, delivery);
      eventBus.emit('delivery_dlq', {
        txn_id: meta.txn_id,
        output_id: delivery.output_id,
        last_error: delivery.last_error,
      });
    } else {
      delivery.status = 'error';
      writeDelivery(deliveryFile, delivery);
      eventBus.emit('delivery_error', {
        txn_id: meta.txn_id,
        output_id: delivery.output_id,
        last_error: delivery.last_error,
      });
      const moved = await moveTransactionTo('error', txnDir);
      scheduleErrorRetry(moved, deliveryFile);
    }
  } finally {
    const currentDir = fs.existsSync(txnDir) ? txnDir : findTxnDirById(meta.txn_id) ?? txnDir;
    await finalizeIfTerminal(currentDir);
  }
}

export function scheduleErrorRetry(txnDir: string, deliveryFile: string): void {
  const key = deliveryFile;
  if (errorTimers.has(key)) return;

  const timer = setTimeout(() => {
    errorTimers.delete(key);
    void requeueErrorDelivery(txnDir, deliveryFile);
  }, ERROR_RETRY_DELAY_MS);
  errorTimers.set(key, timer);
}

export async function requeueErrorDelivery(txnDir: string, deliveryFile: string): Promise<void> {
  if (!fs.existsSync(deliveryFile)) return;
  const delivery = readDelivery(deliveryFile);
  if (delivery.status !== 'error') return;

  delivery.status = 'pending';
  writeDelivery(deliveryFile, delivery);

  let dir = txnDir;
  if (parseTxnDir(txnDir).stage === 'error') {
    dir = await moveTransactionTo('pending', txnDir);
  }

  await attemptDelivery(dir, deliveryFile);
}

export async function finalizeIfTerminal(txnDir: string): Promise<void> {
  if (!fs.existsSync(txnDir)) return;

  const deliveries = listDeliveryFiles(txnDir).map(readDelivery);
  if (deliveries.length === 0) return;

  const allTerminal = deliveries.every((d) => d.status === 'success' || d.status === 'dlq');
  if (!allTerminal) return;

  const meta = readTransactionMeta(txnDir);
  const hasDlq = deliveries.some((d) => d.status === 'dlq');

  if (deliveries.every((d) => d.status === 'success')) {
    const confirmedDir = await moveTransactionTo('confirmed', txnDir);
    await purgeImageFromTransaction(confirmedDir);
    eventBus.emit('transaction_completed', { txn_id: meta.txn_id, dlq: false });
  } else if (hasDlq) {
    await moveTransactionTo('dlq', txnDir);
    eventBus.emit('transaction_completed', { txn_id: meta.txn_id, dlq: true });
  }
}
