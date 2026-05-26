import fs from 'node:fs';
import path from 'node:path';
import type { DiscordWebhookConfig } from '../types/domain.js';
import { DiscordAdapter, DiscordUploadError } from './adapter.js';

function validateConfig(config: unknown): DiscordWebhookConfig {
  const c = config as Record<string, unknown>;
  if (!c?.webhook_url || typeof c.webhook_url !== 'string') {
    throw new Error('discord_webhook requires webhook_url');
  }
  return { webhook_url: c.webhook_url };
}

export const webhookAdapter: DiscordAdapter = {
  async upload(filePath: string, config: unknown): Promise<void> {
    const { webhook_url } = validateConfig(config);

    const form = new FormData();
    const buffer = await fs.promises.readFile(filePath);
    const blob = new Blob([buffer]);
    form.append('files[0]', blob, path.basename(filePath));

    const res = await fetch(webhook_url, {
      method: 'POST',
      body: form,
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 5000;
      throw new DiscordUploadError('Rate limited', 429, await res.text(), retryAfterMs);
    }

    if (!res.ok) {
      throw new DiscordUploadError('Discord webhook upload failed', res.status, await res.text());
    }
  },
};
