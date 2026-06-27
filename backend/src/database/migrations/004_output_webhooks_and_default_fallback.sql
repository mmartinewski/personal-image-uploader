-- Multiple webhooks per output (stored in destination_config JSON as webhook_urls).
-- Rules may also deliver to the default fallback channel when a rule matches.

ALTER TABLE outputs ADD COLUMN also_send_default_fallback INTEGER NOT NULL DEFAULT 0 CHECK (also_send_default_fallback IN (0,1));
