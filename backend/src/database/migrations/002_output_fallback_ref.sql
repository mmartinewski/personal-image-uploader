-- Allow multiple fallback channels; link routing rules to a fallback output.

DROP INDEX IF EXISTS idx_outputs_one_fallback_per_input_type;

ALTER TABLE outputs ADD COLUMN fallback_output_id INTEGER NULL REFERENCES outputs(id);
ALTER TABLE outputs ADD COLUMN is_default_fallback INTEGER NOT NULL DEFAULT 0 CHECK (is_default_fallback IN (0,1));

-- Existing single global fallbacks become the default fallback channel.
UPDATE outputs SET is_default_fallback = 1 WHERE is_fallback = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outputs_one_default_fallback_per_input_type
  ON outputs(input_type) WHERE is_default_fallback = 1;
