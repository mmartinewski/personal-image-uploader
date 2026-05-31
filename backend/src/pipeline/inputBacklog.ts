import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { inputsRepo } from '../database/repos/inputs.repo.js';
import type { Input } from '../types/domain.js';
import { logger } from '../util/logger.js';
import { buildProcessedIndex, isPathAlreadyProcessed } from './processedIndex.js';
import { handleFileDetected } from './transaction.js';
import { isFileCreatedAfterCutoff } from './uploadCutoff.js';

import { STARTUP_BACKLOG_MAX_FILES } from '../config.js';

/** Cap files enqueued per startup so a huge input tree cannot block boot for minutes. */
const MAX_BACKLOG_PER_STARTUP = STARTUP_BACKLOG_MAX_FILES;

async function* walkFilesRecursive(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFilesRecursive(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function isAllowedExtension(filePath: string, input: Input): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return input.extensions.includes(ext);
}

export async function runInputBacklogScan(): Promise<void> {
  const started = Date.now();
  const index = await buildProcessedIndex();
  const inputs = inputsRepo.listActive();

  let scanned = 0;
  let skippedKnown = 0;
  let skippedMissing = 0;
  let skippedBeforeCutoff = 0;
  let enqueued = 0;

  for (const input of inputs) {
    if (!fs.existsSync(input.source_path)) {
      logger.warn({ path: input.source_path, input_id: input.id }, 'Input path missing; skipping backlog scan');
      continue;
    }

    for await (const filePath of walkFilesRecursive(input.source_path)) {
      scanned += 1;
      if (!isAllowedExtension(filePath, input)) continue;

      if (isPathAlreadyProcessed(index, filePath)) {
        skippedKnown += 1;
        continue;
      }

      if (!fs.existsSync(filePath)) {
        skippedMissing += 1;
        continue;
      }

      if (!isFileCreatedAfterCutoff(filePath, input.upload_after)) {
        skippedBeforeCutoff += 1;
        continue;
      }

      if (enqueued >= MAX_BACKLOG_PER_STARTUP) {
        logger.warn(
          { limit: MAX_BACKLOG_PER_STARTUP },
          'Startup backlog scan hit file limit; remaining files will be picked up on next run or by the live watcher',
        );
        break;
      }

      logger.info({ path: filePath, input_id: input.id }, 'Startup backlog: processing file without prior metadata');
      try {
        await handleFileDetected(filePath);
        index.paths.add(path.normalize(filePath).toLowerCase());
        enqueued += 1;
      } catch (err) {
        logger.error({ err, path: filePath }, 'Startup backlog: failed to process file');
      }
    }

    if (enqueued >= MAX_BACKLOG_PER_STARTUP) break;
  }

  const ms = Date.now() - started;
  logger.info(
    { scanned, skippedKnown, skippedMissing, skippedBeforeCutoff, enqueued, ms },
    'Startup backlog scan complete',
  );
}
