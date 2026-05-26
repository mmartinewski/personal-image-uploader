import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { CONFIRMED_ROOT, TXN_ROOT } from '../config.js';
import { outputsRepo } from '../database/repos/outputs.repo.js';
import type {
  DeliveryState,
  Input,
  TransactionMeta,
  TransactionStage,
} from '../types/domain.js';
import { localBucket, nowIso } from '../util/dates.js';
import { atomicWriteJson, atomicWriteJsonSync, copyFileTo, moveDir, moveFile, sha256OfFile } from '../util/fs.js';
import { logger } from '../util/logger.js';
import { eventBus } from '../api/eventBus.js';
import { route } from './router.js';

const TXN_FILE = 'transaction.json';
const DELIVERIES_DIR = 'deliveries';

export function txnDirFor(stage: TransactionStage, bucket: string, txnId: string): string {
  if (stage === 'confirmed') {
    return path.join(CONFIRMED_ROOT, bucket, txnId);
  }
  return path.join(TXN_ROOT, stage, bucket, txnId);
}

export function parseTxnDir(txnDir: string): { stage: TransactionStage; bucket: string; txnId: string } {
  const parts = txnDir.split(path.sep);
  const txnId = parts[parts.length - 1]!;
  const bucket = parts[parts.length - 2]!;
  const stageName = parts[parts.length - 3] as TransactionStage;
  return { stage: stageName, bucket, txnId };
}

export function readTransactionMeta(txnDir: string): TransactionMeta {
  const raw = fs.readFileSync(path.join(txnDir, TXN_FILE), 'utf8');
  return JSON.parse(raw) as TransactionMeta;
}

export function findImageFile(txnDir: string): string {
  const image = findImageBasename(txnDir);
  if (!image) throw new Error(`No image file in ${txnDir}`);
  return path.join(txnDir, image);
}

function findImageBasename(txnDir: string): string | null {
  const entries = fs.readdirSync(txnDir);
  return entries.find((e) => e.startsWith('image.')) ?? null;
}

/** Removes the binary after a successful sync; confirmed/ keeps JSON metadata only. */
export async function purgeImageFromTransaction(txnDir: string): Promise<void> {
  const image = findImageBasename(txnDir);
  if (!image) return;
  await fsp.unlink(path.join(txnDir, image));
}

export function listDeliveryFiles(txnDir: string): string[] {
  const dir = path.join(txnDir, DELIVERIES_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f));
}

export function readDelivery(filePath: string): DeliveryState {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as DeliveryState;
}

export function writeDelivery(filePath: string, state: DeliveryState): void {
  atomicWriteJsonSync(filePath, state);
}

export async function moveTransactionTo(stage: TransactionStage, txnDir: string): Promise<string> {
  const { bucket, txnId } = parseTxnDir(txnDir);
  const dest = txnDirFor(stage, bucket, txnId);
  if (path.normalize(txnDir) === path.normalize(dest)) return txnDir;
  await moveDir(txnDir, dest);
  return dest;
}

export async function createPendingTransaction(
  filePath: string,
  input: Input,
  outputIds: number[],
): Promise<string> {
  const txnId = uuidv4();
  const bucket = localBucket();
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const txnDir = txnDirFor('pending', bucket, txnId);

  await fsp.mkdir(path.join(txnDir, DELIVERIES_DIR), { recursive: true });

  const hash = await sha256OfFile(filePath);
  const meta: TransactionMeta = {
    txn_id: txnId,
    original_name: path.basename(filePath),
    original_path: filePath,
    input_id: input.id,
    input_type: input.type,
    discovered_at: nowIso(),
    file_hash_sha256: hash,
    extension: ext,
  };

  await atomicWriteJson(path.join(txnDir, TXN_FILE), meta);

  for (const outputId of outputIds) {
    const output = outputsRepo.getById(outputId);
    if (!output) continue;
    const delivery: DeliveryState = {
      output_id: outputId,
      output_type: output.type,
      status: 'pending',
      immediate_attempts: 0,
      global_reprocesses: 0,
      last_error: null,
      last_attempt_at: null,
    };
    await atomicWriteJson(path.join(txnDir, DELIVERIES_DIR, `${outputId}.json`), delivery);
  }

  const destImage = path.join(txnDir, `image.${ext}`);
  await copyFileTo(filePath, destImage);

  eventBus.emit('file_received', {
    txn_id: txnId,
    original_name: meta.original_name,
    input_id: input.id,
  });

  return txnDir;
}

export async function createNoRouteDlqTransaction(filePath: string, input: Input): Promise<string> {
  const txnId = uuidv4();
  const bucket = localBucket();
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const txnDir = txnDirFor('dlq', bucket, txnId);

  await fsp.mkdir(path.join(txnDir, DELIVERIES_DIR), { recursive: true });

  const hash = await sha256OfFile(filePath);
  const meta: TransactionMeta = {
    txn_id: txnId,
    original_name: path.basename(filePath),
    original_path: filePath,
    input_id: input.id,
    input_type: input.type,
    discovered_at: nowIso(),
    file_hash_sha256: hash,
    extension: ext,
  };

  await atomicWriteJson(path.join(txnDir, TXN_FILE), meta);

  const delivery: DeliveryState = {
    output_id: 0,
    output_type: 'discord_webhook',
    status: 'dlq',
    immediate_attempts: 0,
    global_reprocesses: 4,
    last_error: 'No matching rule and no default fallback configured',
    last_attempt_at: nowIso(),
  };
  await atomicWriteJson(path.join(txnDir, DELIVERIES_DIR, 'no_route.json'), delivery);

  const destImage = path.join(txnDir, `image.${ext}`);
  await copyFileTo(filePath, destImage);

  eventBus.emit('delivery_dlq', {
    txn_id: txnId,
    output_id: 0,
    last_error: delivery.last_error!,
  });
  eventBus.emit('transaction_completed', { txn_id: txnId, dlq: true });

  return txnDir;
}

export function findInputForPath(filePath: string, inputs: Input[]): Input | null {
  const normalized = path.normalize(filePath);
  let best: Input | null = null;
  let bestLen = 0;

  for (const input of inputs) {
    const root = path.normalize(input.source_path);
    if (normalized === root || normalized.startsWith(root + path.sep)) {
      if (root.length > bestLen) {
        best = input;
        bestLen = root.length;
      }
    }
  }
  return best;
}

export async function handleFileDetected(absPath: string): Promise<void> {
  const { inputsRepo } = await import('../database/repos/inputs.repo.js');
  const inputs = inputsRepo.listActive();
  const input = findInputForPath(absPath, inputs);
  if (!input) {
    logger.debug({ path: absPath }, 'File ignored: path is not under any active input');
    return;
  }

  const routeResult = route(absPath, input);
  if (routeResult.kind === 'ignored') {
    logger.debug({ path: absPath, input_id: input.id }, 'File ignored: extension not allowed');
    return;
  }

  if (routeResult.kind === 'no_route') {
    logger.warn(
      { path: absPath, input_id: input.id, name: path.basename(absPath) },
      'No output rule matched and no default fallback configured — sending to DLQ. Add a fallback channel in Outputs.',
    );
    await createNoRouteDlqTransaction(absPath, input);
    return;
  }

  logger.info(
    { path: absPath, input_id: input.id, outputs: routeResult.outputIds },
    'File routed for upload',
  );

  const txnDir = await createPendingTransaction(absPath, input, routeResult.outputIds);
  const { dispatchTransaction } = await import('./dispatcher.js');
  await dispatchTransaction(txnDir);
}
