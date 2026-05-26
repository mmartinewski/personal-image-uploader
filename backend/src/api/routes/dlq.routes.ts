import { Router } from 'express';
import path from 'node:path';
import { deleteDlqTxn, dlqImagePath, listDlqEntries, retryDlqTxn } from '../dlqStore.js';
import { invalidateStatsCache } from '../storageStats.js';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export const dlqRouter = Router();

dlqRouter.get('/', (_req, res) => {
  res.json(listDlqEntries());
});

dlqRouter.get('/:txn_id/image', (req, res) => {
  const image = dlqImagePath(req.params.txn_id);
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.type(MIME[image.ext] ?? 'application/octet-stream');
  res.sendFile(path.resolve(image.filePath));
});

dlqRouter.post('/:txn_id/retry', async (req, res, next) => {
  try {
    await retryDlqTxn(req.params.txn_id);
    invalidateStatsCache();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

dlqRouter.delete('/:txn_id', async (req, res, next) => {
  try {
    await deleteDlqTxn(req.params.txn_id);
    invalidateStatsCache();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
