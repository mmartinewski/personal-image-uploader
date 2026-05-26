import { db } from '../db.js';
import type {
  DestinationConfig,
  InputType,
  NewOutput,
  Output,
  OutputType,
} from '../../types/domain.js';

interface OutputRow {
  id: number;
  name: string;
  input_type: InputType;
  type: OutputType;
  file_patterns: string;
  is_fallback: number;
  is_default_fallback: number;
  fallback_output_id: number | null;
  destination_config: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: OutputRow): Output {
  return {
    id: row.id,
    name: row.name,
    input_type: row.input_type,
    type: row.type,
    file_patterns: JSON.parse(row.file_patterns) as string[],
    is_fallback: row.is_fallback === 1,
    is_default_fallback: row.is_default_fallback === 1,
    fallback_output_id: row.fallback_output_id,
    destination_config: JSON.parse(row.destination_config) as DestinationConfig,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class OutputReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputReferenceError';
  }
}

function assertFallbackReference(
  input_type: InputType,
  fallback_output_id: number | null | undefined,
): number | null {
  if (fallback_output_id == null) return null;

  const fb = outputsRepo.getById(fallback_output_id);
  if (!fb || !fb.is_fallback) {
    throw new OutputReferenceError('fallback_output_id must reference an existing fallback channel');
  }
  if (fb.input_type !== input_type) {
    throw new OutputReferenceError('fallback_output_id must belong to the same input_type');
  }
  return fallback_output_id;
}

function clearOtherDefaults(input_type: InputType, exceptId: number | null): void {
  if (exceptId == null) {
    db.prepare(
      `UPDATE outputs SET is_default_fallback = 0, updated_at = datetime('now')
       WHERE input_type = ? AND is_default_fallback = 1`,
    ).run(input_type);
    return;
  }
  db.prepare(
    `UPDATE outputs SET is_default_fallback = 0, updated_at = datetime('now')
     WHERE input_type = ? AND is_default_fallback = 1 AND id != ?`,
  ).run(input_type, exceptId);
}

export const outputsRepo = {
  listAll(): Output[] {
    const rows = db.prepare('SELECT * FROM outputs ORDER BY id').all() as OutputRow[];
    return rows.map(mapRow);
  },

  findActive(filter: { input_type: string; is_fallback: boolean }): Output[] {
    const rows = db
      .prepare(
        `SELECT * FROM outputs
         WHERE input_type = ? AND is_active = 1 AND is_fallback = ?
         ORDER BY id`,
      )
      .all(filter.input_type, filter.is_fallback ? 1 : 0) as OutputRow[];
    return rows.map(mapRow);
  },

  findDefaultFallback(input_type: string): Output | null {
    const row = db
      .prepare(
        `SELECT * FROM outputs
         WHERE input_type = ? AND is_fallback = 1 AND is_default_fallback = 1 AND is_active = 1
         LIMIT 1`,
      )
      .get(input_type) as OutputRow | undefined;
    return row ? mapRow(row) : null;
  },

  listFallbacks(input_type: string): Output[] {
    const rows = db
      .prepare(
        `SELECT * FROM outputs WHERE input_type = ? AND is_fallback = 1 ORDER BY id`,
      )
      .all(input_type) as OutputRow[];
    return rows.map(mapRow);
  },

  countRuleReferences(fallbackId: number): number {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM outputs WHERE fallback_output_id = ?`)
      .get(fallbackId) as { c: number };
    return row.c;
  },

  getById(id: number): Output | null {
    const row = db.prepare('SELECT * FROM outputs WHERE id = ?').get(id) as OutputRow | undefined;
    return row ? mapRow(row) : null;
  },

  create(data: NewOutput): Output {
    const is_fallback = data.is_fallback ? 1 : 0;
    const is_default_fallback =
      is_fallback && data.is_default_fallback ? 1 : 0;
    const file_patterns = is_fallback ? '[]' : JSON.stringify(data.file_patterns);
    const fallback_output_id = is_fallback
      ? null
      : assertFallbackReference(data.input_type, data.fallback_output_id ?? null);
    const destination_config = JSON.stringify(data.destination_config);
    const is_active = data.is_active !== false ? 1 : 0;

    if (is_fallback && data.fallback_output_id != null) {
      throw new OutputReferenceError('Fallback channels cannot reference another fallback');
    }
    if (!is_fallback && data.is_default_fallback) {
      throw new OutputReferenceError('is_default_fallback is only valid for fallback channels');
    }

    const insert = db.transaction(() => {
      if (is_default_fallback) {
        clearOtherDefaults(data.input_type, null);
      }

      try {
        const result = db
          .prepare(
            `INSERT INTO outputs (
               name, input_type, type, file_patterns, is_fallback, is_default_fallback,
               fallback_output_id, destination_config, is_active, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          )
          .run(
            data.name,
            data.input_type,
            data.type,
            file_patterns,
            is_fallback,
            is_default_fallback,
            fallback_output_id,
            destination_config,
            is_active,
          );

        return Number(result.lastInsertRowid);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          throw new ConflictError('Only one default fallback is allowed per input_type');
        }
        throw err;
      }
    });

    return outputsRepo.getById(insert())!;
  },

  update(id: number, patch: Partial<NewOutput>): Output {
    const existing = outputsRepo.getById(id);
    if (!existing) throw new Error(`Output ${id} not found`);

    const name = patch.name ?? existing.name;
    const input_type = patch.input_type ?? existing.input_type;
    const type = patch.type ?? existing.type;
    const is_fallback = (patch.is_fallback ?? existing.is_fallback) ? 1 : 0;
    const is_default_fallback =
      is_fallback && (patch.is_default_fallback ?? existing.is_default_fallback) ? 1 : 0;
    const file_patterns = is_fallback
      ? '[]'
      : JSON.stringify(patch.file_patterns ?? existing.file_patterns);
    const fallback_output_id = is_fallback
      ? null
      : assertFallbackReference(
          input_type,
          patch.fallback_output_id !== undefined
            ? patch.fallback_output_id
            : existing.fallback_output_id,
        );
    const destination_config = JSON.stringify(
      patch.destination_config ?? existing.destination_config,
    );
    const is_active =
      patch.is_active !== undefined ? (patch.is_active ? 1 : 0) : (existing.is_active ? 1 : 0);

    if (is_fallback && patch.fallback_output_id != null) {
      throw new OutputReferenceError('Fallback channels cannot reference another fallback');
    }
    if (!is_fallback && patch.is_default_fallback) {
      throw new OutputReferenceError('is_default_fallback is only valid for fallback channels');
    }

    const run = db.transaction(() => {
      if (is_default_fallback) {
        clearOtherDefaults(input_type, id);
      }

      try {
        db.prepare(
          `UPDATE outputs SET name = ?, input_type = ?, type = ?, file_patterns = ?, is_fallback = ?,
           is_default_fallback = ?, fallback_output_id = ?, destination_config = ?, is_active = ?,
           updated_at = datetime('now') WHERE id = ?`,
        ).run(
          name,
          input_type,
          type,
          file_patterns,
          is_fallback,
          is_default_fallback,
          fallback_output_id,
          destination_config,
          is_active,
          id,
        );
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          throw new ConflictError('Only one default fallback is allowed per input_type');
        }
        throw err;
      }
    });

    run();
    return outputsRepo.getById(id)!;
  },

  delete(id: number): void {
    const existing = outputsRepo.getById(id);
    if (!existing) return;

    if (existing.is_fallback && outputsRepo.countRuleReferences(id) > 0) {
      throw new OutputReferenceError(
        'Cannot delete fallback channel while routing rules still reference it',
      );
    }

    db.prepare('DELETE FROM outputs WHERE id = ?').run(id);
  },
};
