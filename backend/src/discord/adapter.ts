export class DiscordUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'DiscordUploadError';
  }
}

export interface DiscordAdapter {
  upload(filePath: string, config: unknown): Promise<void>;
}
