import type { DeliveryState, Input, Output, TransactionMeta } from './domain.js';

export interface DashboardStats {
  synced: number;
  pending: number;
  error: number;
  dlq: number;
  goRunning: boolean;
  goBinaryPresent: boolean;
}

export interface DlqEntry {
  txn_id: string;
  bucket: string;
  transaction: TransactionMeta;
  deliveries: DeliveryState[];
}

export type EventName =
  | 'file_received'
  | 'delivery_success'
  | 'delivery_error'
  | 'delivery_dlq'
  | 'transaction_completed'
  | 'heartbeat';

export interface EventPayloadMap {
  file_received: { txn_id: string; original_name: string; input_id: number };
  delivery_success: { txn_id: string; output_id: number };
  delivery_error: { txn_id: string; output_id: number; last_error: string };
  delivery_dlq: { txn_id: string; output_id: number; last_error: string };
  transaction_completed: { txn_id: string; dlq: boolean };
  heartbeat: { at: string };
}

export type { Input, Output };
