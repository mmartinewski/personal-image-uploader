import type {
  DestinationConfig,
  InputType,
  NewInput,
  NewOutput,
  OutputType,
} from '../types/domain.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateNewInput(body: unknown): NewInput {
  const b = body as Record<string, unknown>;
  if (!b?.name || typeof b.name !== 'string') throw new ValidationError('name is required');
  if (!b?.source_path || typeof b.source_path !== 'string') {
    throw new ValidationError('source_path is required');
  }
  return {
    name: b.name.trim(),
    source_path: b.source_path.trim(),
    type: (b.type as InputType) ?? 'directory',
    extensions: Array.isArray(b.extensions)
      ? (b.extensions as string[]).map((e) => String(e).toLowerCase().replace(/^\./, ''))
      : undefined,
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
  if (!c?.webhook_url || typeof c.webhook_url !== 'string') {
    throw new ValidationError('destination_config.webhook_url is required for discord_webhook');
  }
  return { webhook_url: c.webhook_url };
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

  return {
    name: b.name.trim(),
    input_type,
    type,
    file_patterns,
    is_fallback,
    is_default_fallback: is_fallback ? is_default_fallback : false,
    fallback_output_id: is_fallback ? null : (fallback_output_id ?? null),
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
