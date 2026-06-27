export type InputType = 'directory';
export type OutputType = 'discord_bot' | 'discord_webhook';
export type DeliveryStatus = 'pending' | 'success' | 'error' | 'dlq';

export interface Input {
  id: number;
  name: string;
  type: InputType;
  source_path: string;
  extensions: string[];
  /** ISO datetime — only files created at or after this moment are uploaded. */
  upload_after: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewInput {
  name: string;
  source_path: string;
  type?: InputType;
  extensions?: string[];
  upload_after?: string | null;
  is_active?: boolean;
}

export interface DiscordBotConfig {
  bot_token: string;
  channel_id: string;
}

export interface DiscordWebhookConfig {
  webhook_urls: string[];
}

export type DestinationConfig = DiscordBotConfig | DiscordWebhookConfig;

export interface Output {
  id: number;
  name: string;
  input_type: InputType;
  type: OutputType;
  file_patterns: string[];
  is_fallback: boolean;
  is_default_fallback: boolean;
  fallback_output_id: number | null;
  /** When true (routing rules only), also deliver to the default fallback channel on match. */
  also_send_default_fallback: boolean;
  destination_config: DestinationConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewOutput {
  name: string;
  input_type: InputType;
  type: OutputType;
  file_patterns: string[];
  is_fallback: boolean;
  is_default_fallback?: boolean;
  fallback_output_id?: number | null;
  also_send_default_fallback?: boolean;
  destination_config: DestinationConfig;
  is_active?: boolean;
}

export interface TransactionMeta {
  txn_id: string;
  original_name: string;
  original_path: string;
  input_id: number;
  input_type: InputType;
  discovered_at: string;
  file_hash_sha256: string;
  extension: string;
}

export interface DeliveryState {
  output_id: number;
  output_type: OutputType;
  status: DeliveryStatus;
  immediate_attempts: number;
  global_reprocesses: number;
  last_error: string | null;
  last_attempt_at: string | null;
}

export type TransactionStage = 'pending' | 'error' | 'dlq' | 'confirmed';
