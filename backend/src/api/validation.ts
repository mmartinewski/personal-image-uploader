import type {
  DestinationConfig,
  InputType,
  NewInput,
  NewOutput,
  OutputType,
} from '../types/domain.js';
import type {
  OutputExportBundle,
  OutputExportEntry,
  OutputImportMode,
} from '../types/outputExport.js';
import {
  OUTPUT_EXPORT_FORMAT,
  OUTPUT_EXPORT_VERSION,
} from '../types/outputExport.js';
import { normalizeWebhookUrls, WebhookConfigError } from '../discord/webhookConfig.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseUploadAfter(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ValidationError('upload_after must be an ISO datetime string or null');
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new ValidationError('upload_after must be a valid ISO datetime');
  }
  return new Date(ms).toISOString();
}

export function validateNewInput(body: unknown): NewInput {
  const b = body as Record<string, unknown>;
  if (!b?.name || typeof b.name !== 'string') throw new ValidationError('name is required');
  if (!b?.source_path || typeof b.source_path !== 'string') {
    throw new ValidationError('source_path is required');
  }
  const uploadAfter = parseUploadAfter(b.upload_after);
  return {
    name: b.name.trim(),
    source_path: b.source_path.trim(),
    type: (b.type as InputType) ?? 'directory',
    extensions: Array.isArray(b.extensions)
      ? (b.extensions as string[]).map((e) => String(e).toLowerCase().replace(/^\./, ''))
      : undefined,
    upload_after: uploadAfter === undefined ? new Date().toISOString() : uploadAfter,
    is_active: b.is_active !== false,
  };
}

export function validateDestinationConfig(
  type: OutputType,
  config: unknown,
): DestinationConfig {
  const c = config as Record<string, unknown>;
  if (type === 'discord_bot') {
    if (!c?.bot_token || typeof c.bot_token !== 'string') {
      throw new ValidationError('destination_config.bot_token is required for discord_bot');
    }
    if (!c?.channel_id || typeof c.channel_id !== 'string') {
      throw new ValidationError('destination_config.channel_id is required for discord_bot');
    }
    return { bot_token: c.bot_token, channel_id: c.channel_id };
  }
  try {
    return { webhook_urls: normalizeWebhookUrls(config) };
  } catch (err) {
    if (err instanceof WebhookConfigError) {
      throw new ValidationError(err.message);
    }
    throw err;
  }
}

function parseFallbackOutputId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('fallback_output_id must be a positive integer or null');
  }
  return id;
}

export function validateNewOutput(body: unknown): NewOutput {
  const b = body as Record<string, unknown>;
  if (!b?.name || typeof b.name !== 'string') throw new ValidationError('name is required');
  const type = b.type as OutputType;
  if (type !== 'discord_bot' && type !== 'discord_webhook') {
    throw new ValidationError('type must be discord_bot or discord_webhook');
  }
  const input_type = (b.input_type as InputType) ?? 'directory';
  const is_fallback = Boolean(b.is_fallback);
  const is_default_fallback = Boolean(b.is_default_fallback);
  const fallback_output_id = parseFallbackOutputId(b.fallback_output_id);
  const file_patterns = Array.isArray(b.file_patterns)
    ? (b.file_patterns as string[]).map(String)
    : is_fallback
      ? []
      : [];
  if (!is_fallback && file_patterns.length === 0) {
    throw new ValidationError('file_patterns must not be empty for routing rules');
  }
  if (is_fallback && is_default_fallback === false && b.is_default_fallback === undefined) {
    // default false is fine
  }
  if (!is_fallback && is_default_fallback) {
    throw new ValidationError('is_default_fallback is only valid for fallback channels');
  }
  if (is_fallback && fallback_output_id != null) {
    throw new ValidationError('fallback channels cannot reference another fallback');
  }
  const also_send_default_fallback = !is_fallback && Boolean(b.also_send_default_fallback);

  return {
    name: b.name.trim(),
    input_type,
    type,
    file_patterns,
    is_fallback,
    is_default_fallback: is_fallback ? is_default_fallback : false,
    fallback_output_id: is_fallback ? null : (fallback_output_id ?? null),
    also_send_default_fallback,
    destination_config: validateDestinationConfig(type, b.destination_config),
    is_active: b.is_active !== false,
  };
}

export function validateOutputPatch(
  existing: { is_fallback: boolean; input_type: InputType; type: OutputType },
  body: unknown,
): Partial<NewOutput> {
  const b = body as Record<string, unknown>;
  const patch: Partial<NewOutput> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      throw new ValidationError('name must be a non-empty string');
    }
    patch.name = b.name.trim();
  }

  if (b.input_type !== undefined) patch.input_type = b.input_type as InputType;

  const type = (b.type as OutputType | undefined) ?? existing.type;
  if (b.type !== undefined && type !== 'discord_bot' && type !== 'discord_webhook') {
    throw new ValidationError('type must be discord_bot or discord_webhook');
  }
  if (b.type !== undefined) patch.type = type;

  if (b.destination_config !== undefined) {
    patch.destination_config = validateDestinationConfig(type, b.destination_config);
  }

  const is_fallback =
    b.is_fallback !== undefined ? Boolean(b.is_fallback) : existing.is_fallback;

  if (b.is_fallback !== undefined) patch.is_fallback = is_fallback;

  if (b.is_default_fallback !== undefined) {
    patch.is_default_fallback = Boolean(b.is_default_fallback);
  }

  if (b.fallback_output_id !== undefined) {
    patch.fallback_output_id = parseFallbackOutputId(b.fallback_output_id) ?? null;
  }

  if (b.file_patterns !== undefined) {
    if (!Array.isArray(b.file_patterns)) {
      throw new ValidationError('file_patterns must be an array');
    }
    patch.file_patterns = (b.file_patterns as string[]).map(String);
  }

  if (b.is_active !== undefined) patch.is_active = Boolean(b.is_active);

  if (b.also_send_default_fallback !== undefined) {
    patch.also_send_default_fallback = Boolean(b.also_send_default_fallback);
  }

  if (is_fallback && patch.also_send_default_fallback) {
    throw new ValidationError('also_send_default_fallback is only valid for routing rules');
  }

  if (!is_fallback && patch.file_patterns !== undefined && patch.file_patterns.length === 0) {
    throw new ValidationError('file_patterns must not be empty for routing rules');
  }

  if (!is_fallback && patch.is_default_fallback) {
    throw new ValidationError('is_default_fallback is only valid for fallback channels');
  }

  if (is_fallback && patch.fallback_output_id != null) {
    throw new ValidationError('fallback channels cannot reference another fallback');
  }

  return patch;
}

function validateImportEntry(body: unknown): OutputExportEntry {
  const b = body as Record<string, unknown>;
  if (!b?.name || typeof b.name !== 'string') throw new ValidationError('name is required');
  const type = b.type as OutputType;
  if (type !== 'discord_bot' && type !== 'discord_webhook') {
    throw new ValidationError('type must be discord_bot or discord_webhook');
  }
  const input_type = (b.input_type as InputType) ?? 'directory';
  if (input_type !== 'directory') {
    throw new ValidationError('input_type must be directory');
  }
  const is_fallback = Boolean(b.is_fallback);
  const is_default_fallback = Boolean(b.is_default_fallback);
  const file_patterns = Array.isArray(b.file_patterns)
    ? (b.file_patterns as string[]).map(String)
    : is_fallback
      ? []
      : [];
  if (!is_fallback && file_patterns.length === 0) {
    throw new ValidationError('file_patterns must not be empty for routing rules');
  }
  if (!is_fallback && is_default_fallback) {
    throw new ValidationError('is_default_fallback is only valid for fallback channels');
  }

  let fallback_ref: string | null = null;
  if (b.fallback_ref !== undefined && b.fallback_ref !== null && b.fallback_ref !== '') {
    if (typeof b.fallback_ref !== 'string') {
      throw new ValidationError('fallback_ref must be a string or null');
    }
    fallback_ref = b.fallback_ref.trim();
    if (!fallback_ref) fallback_ref = null;
  }
  if (is_fallback && fallback_ref != null) {
    throw new ValidationError('fallback channels cannot reference another fallback');
  }

  return {
    name: b.name.trim(),
    input_type,
    type,
    is_fallback,
    is_default_fallback: is_fallback ? is_default_fallback : false,
    file_patterns,
    fallback_ref: is_fallback ? null : fallback_ref,
    also_send_default_fallback: is_fallback ? false : Boolean(b.also_send_default_fallback),
    destination_config: validateDestinationConfig(type, b.destination_config),
    is_active: b.is_active !== false,
  };
}

export function validateImportBundle(body: unknown): OutputExportBundle {
  const b = body as Record<string, unknown>;
  if (b?.format !== OUTPUT_EXPORT_FORMAT) {
    throw new ValidationError('Invalid or missing format (expected piu-outputs)');
  }
  if (b.version !== OUTPUT_EXPORT_VERSION) {
    throw new ValidationError(`Unsupported export version (expected ${OUTPUT_EXPORT_VERSION})`);
  }
  if (!Array.isArray(b.outputs)) {
    throw new ValidationError('outputs must be an array');
  }

  return {
    format: OUTPUT_EXPORT_FORMAT,
    version: OUTPUT_EXPORT_VERSION,
    exported_at:
      typeof b.exported_at === 'string' ? b.exported_at : new Date().toISOString(),
    outputs: b.outputs.map(validateImportEntry),
  };
}

export function validateImportRequest(
  body: unknown,
): { mode: OutputImportMode; bundle: OutputExportBundle } {
  const b = body as Record<string, unknown>;
  const mode = b?.mode;
  if (mode !== 'merge' && mode !== 'replace') {
    throw new ValidationError('mode must be merge or replace');
  }
  return { mode, bundle: validateImportBundle(body) };
}
