import path from 'node:path';
import { TXN_ROOT } from '../config.js';
import { walkTransactionJson } from '../util/fs.js';
import { logger } from '../util/logger.js';
import { dispatchTransaction } from './dispatcher.js';
import { listDeliveryFiles, readDelivery } from './transaction.js';
import { scheduleErrorRetry } from './stateMachine.js';

export async function runRecovery(): Promise<void> {
  const pendingRoot = path.join(TXN_ROOT, 'pending');
  const errorRoot = path.join(TXN_ROOT, 'error');

  await walkTransactionJson(pendingRoot, async (txnDir) => {
    logger.info({ txnDir }, 'Recovery: resuming pending transaction');
    await dispatchTransaction(txnDir);
  });

  await walkTransactionJson(errorRoot, async (txnDir) => {
    for (const deliveryFile of listDeliveryFiles(txnDir)) {
      const d = readDelivery(deliveryFile);
      if (d.status === 'error') {
        scheduleErrorRetry(txnDir, deliveryFile);
      } else if (d.status === 'pending') {
        await dispatchTransaction(txnDir);
      }
    }
  });
}
