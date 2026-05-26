import fs from 'node:fs';
import path from 'node:path';
import type { DiscordBotConfig } from '../types/domain.js';
import { DiscordAdapter, DiscordUploadError } from './adapter.js';

function validateConfig(config: unknown): DiscordBotConfig {
  const c = config as Record<string, unknown>;
  if (!c?.bot_token || typeof c.bot_token !== 'string') {
    throw new Error('discord_bot requires bot_token');
  }
  if (!c?.channel_id || typeof c.channel_id !== 'string') {
    throw new Error('discord_bot requires channel_id');
  }
  return { bot_token: c.bot_token, channel_id: c.channel_id };
}

export const botAdapter: DiscordAdapter = {
  async upload(filePath: string, config: unknown): Promise<void> {
    const { bot_token, channel_id } = validateConfig(config);
    const url = `https://discord.com/api/v10/channels/${channel_id}/messages`;

    const form = new FormData();
    const buffer = await fs.promises.readFile(filePath);
    const blob = new Blob([buffer]);
    form.append('files[0]', blob, path.basename(filePath));

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bot ${bot_token}` },
      body: form,
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 5000;
      throw new DiscordUploadError('Rate limited', 429, await res.text(), retryAfterMs);
    }

    if (!res.ok) {
      throw new DiscordUploadError('Discord bot upload failed', res.status, await res.text());
    }
  },
};
