import { listDeliveryFiles, readDelivery } from './transaction.js';
import { attemptDelivery } from './stateMachine.js';

export async function dispatchTransaction(txnDir: string): Promise<void> {
  const files = listDeliveryFiles(txnDir);
  const pending = files.filter((f) => readDelivery(f).status === 'pending');

  await Promise.allSettled(
    pending.map((deliveryFile) => attemptDelivery(txnDir, deliveryFile)),
  );
}
