import type { DestinationConfig, InputType, OutputType } from './domain.js';

export const OUTPUT_EXPORT_FORMAT = 'piu-outputs' as const;
export const OUTPUT_EXPORT_VERSION = 1 as const;

export type OutputImportMode = 'merge' | 'replace';

export interface OutputExportEntry {
  name: string;
  input_type: InputType;
  type: OutputType;
  is_fallback: boolean;
  is_default_fallback: boolean;
  file_patterns: string[];
  /** Fallback channel name, or null to use the default fallback. */
  fallback_ref: string | null;
  destination_config: DestinationConfig;
  is_active: boolean;
}

export interface OutputExportBundle {
  format: typeof OUTPUT_EXPORT_FORMAT;
  version: typeof OUTPUT_EXPORT_VERSION;
  exported_at: string;
  outputs: OutputExportEntry[];
}

export interface OutputImportResult {
  mode: OutputImportMode;
  imported: number;
  skipped: number;
}
