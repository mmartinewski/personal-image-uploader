PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  type         TEXT    NOT NULL CHECK (type IN ('directory')),
  source_path  TEXT    NOT NULL,
  extensions   TEXT    NOT NULL DEFAULT '["png","jpg","jpeg","gif","webp"]',
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inputs_source_path ON inputs(source_path);

CREATE TABLE IF NOT EXISTS outputs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  input_type          TEXT    NOT NULL CHECK (input_type IN ('directory')),
  type                TEXT    NOT NULL CHECK (type IN ('discord_bot','discord_webhook')),
  file_patterns       TEXT    NOT NULL DEFAULT '[]',
  is_fallback         INTEGER NOT NULL DEFAULT 0 CHECK (is_fallback IN (0,1)),
  destination_config  TEXT    NOT NULL,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outputs_one_fallback_per_input_type
  ON outputs(input_type) WHERE is_fallback = 1;
