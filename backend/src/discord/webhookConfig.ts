export class WebhookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookConfigError';
  }
}

export function normalizeWebhookUrls(config: unknown): string[] {
  const c = config as Record<string, unknown>;
  if (Array.isArray(c?.webhook_urls)) {
    const urls = (c.webhook_urls as unknown[])
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter(Boolean);
    if (urls.length === 0) {
      throw new WebhookConfigError('destination_config.webhook_urls must contain at least one URL');
    }
    return urls;
  }
  if (typeof c?.webhook_url === 'string' && c.webhook_url.trim()) {
    return [c.webhook_url.trim()];
  }
  throw new WebhookConfigError(
    'destination_config.webhook_urls must contain at least one URL (legacy webhook_url is accepted)',
  );
}
