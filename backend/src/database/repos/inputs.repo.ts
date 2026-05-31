import { db } from '../db.js';
import { DEFAULT_EXTENSIONS } from '../../config.js';
import type { Input, InputType, NewInput } from '../../types/domain.js';

interface InputRow {
  id: number;
  name: string;
  type: InputType;
  source_path: string;
  extensions: string;
  upload_after: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: InputRow): Input {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    source_path: row.source_path,
    extensions: JSON.parse(row.extensions) as string[],
    upload_after: row.upload_after ?? null,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const inputsRepo = {
  listAll(): Input[] {
    const rows = db.prepare('SELECT * FROM inputs ORDER BY id').all() as InputRow[];
    return rows.map(mapRow);
  },

  listActive(): Input[] {
    const rows = db
      .prepare("SELECT * FROM inputs WHERE type = 'directory' AND is_active = 1 ORDER BY id")
      .all() as InputRow[];
    return rows.map(mapRow);
  },

  getById(id: number): Input | null {
    const row = db.prepare('SELECT * FROM inputs WHERE id = ?').get(id) as InputRow | undefined;
    return row ? mapRow(row) : null;
  },

  findBySourcePath(sourcePath: string): Input | null {
    const row = db
      .prepare('SELECT * FROM inputs WHERE source_path = ?')
      .get(sourcePath) as InputRow | undefined;
    return row ? mapRow(row) : null;
  },

  create(data: NewInput): Input {
    const extensions = JSON.stringify(data.extensions ?? DEFAULT_EXTENSIONS);
    const type = data.type ?? 'directory';
    const isActive = data.is_active !== false ? 1 : 0;
    const uploadAfter =
      data.upload_after !== undefined ? data.upload_after : new Date().toISOString();

    const result = db
      .prepare(
        `INSERT INTO inputs (name, type, source_path, extensions, upload_after, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(data.name, type, data.source_path, extensions, uploadAfter, isActive);

    return inputsRepo.getById(Number(result.lastInsertRowid))!;
  },

  update(id: number, patch: Partial<NewInput>): Input {
    const existing = inputsRepo.getById(id);
    if (!existing) throw new Error(`Input ${id} not found`);

    const name = patch.name ?? existing.name;
    const source_path = patch.source_path ?? existing.source_path;
    const type = patch.type ?? existing.type;
    const extensions = JSON.stringify(patch.extensions ?? existing.extensions);
    const upload_after =
      patch.upload_after !== undefined ? patch.upload_after : existing.upload_after;
    const is_active = patch.is_active !== undefined ? (patch.is_active ? 1 : 0) : (existing.is_active ? 1 : 0);

    db.prepare(
      `UPDATE inputs SET name = ?, type = ?, source_path = ?, extensions = ?, upload_after = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(name, type, source_path, extensions, upload_after, is_active, id);

    return inputsRepo.getById(id)!;
  },

  delete(id: number): void {
    db.prepare('DELETE FROM inputs WHERE id = ?').run(id);
  },
};
