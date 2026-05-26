import type { OutputType } from '../types/domain.js';
import { botAdapter } from './botAdapter.js';
import { webhookAdapter } from './webhookAdapter.js';
import type { DiscordAdapter } from './adapter.js';

export const adapters: Record<OutputType, DiscordAdapter> = {
  discord_bot: botAdapter,
  discord_webhook: webhookAdapter,
};
