export interface Input {
  id: number;
  name: string;
  type: 'directory';
  source_path: string;
  extensions: string[];
  upload_after: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OutputType = 'discord_bot' | 'discord_webhook';

export interface Output {
  id: number;
  name: string;
  input_type: 'directory';
  type: OutputType;
  file_patterns: string[];
  is_fallback: boolean;
  is_default_fallback: boolean;
  fallback_output_id: number | null;
  also_send_default_fallback: boolean;
  destination_config: Record<string, string | string[]>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OutputImportMode = 'merge' | 'replace';

export interface OutputExportBundle {
  format: 'piu-outputs';
  version: 1;
  exported_at: string;
  outputs: (Omit<Output, 'id' | 'created_at' | 'updated_at' | 'fallback_output_id'> & {
    fallback_ref: string | null;
  })[];
}

export interface OutputImportResult {
  mode: OutputImportMode;
  imported: number;
  skipped: number;
}

export interface DashboardStats {
  synced: number;
  pending: number;
  error: number;
  dlq: number;
  goRunning: boolean;
  goBinaryPresent: boolean;
}

export interface DeliveryState {
  output_id: number;
  output_type: OutputType;
  status: string;
  immediate_attempts: number;
  global_reprocesses: number;
  last_error: string | null;
  last_attempt_at: string | null;
}

export interface TransactionMeta {
  txn_id: string;
  original_name: string;
  original_path: string;
  input_id: number;
  input_type: string;
  discovered_at: string;
  file_hash_sha256: string;
  extension: string;
}

export interface DlqEntry {
  txn_id: string;
  bucket: string;
  transaction: TransactionMeta;
  deliveries: DeliveryState[];
}
