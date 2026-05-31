import { outputsRepo } from '../database/repos/outputs.repo.js';
import type { NewOutput } from '../types/domain.js';
import type {
  OutputExportBundle,
  OutputExportEntry,
  OutputImportMode,
  OutputImportResult,
} from '../types/outputExport.js';
import {
  OUTPUT_EXPORT_FORMAT,
  OUTPUT_EXPORT_VERSION,
} from '../types/outputExport.js';
import { ValidationError, validateImportRequest } from './validation.js';

function entryKey(is_fallback: boolean, name: string): string {
  return `${is_fallback ? '1' : '0'}:${name}`;
}

function toNewOutput(entry: OutputExportEntry, fallback_output_id: number | null): NewOutput {
  return {
    name: entry.name,
    input_type: entry.input_type,
    type: entry.type,
    file_patterns: entry.is_fallback ? [] : entry.file_patterns,
    is_fallback: entry.is_fallback,
    is_default_fallback: entry.is_fallback ? entry.is_default_fallback : false,
    fallback_output_id: entry.is_fallback ? null : fallback_output_id,
    destination_config: entry.destination_config,
    is_active: entry.is_active,
  };
}

export function exportOutputBundle(): OutputExportBundle {
  const all = outputsRepo.listAll();
  const byId = new Map(all.map((o) => [o.id, o]));

  return {
    format: OUTPUT_EXPORT_FORMAT,
    version: OUTPUT_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    outputs: all.map((o) => ({
      name: o.name,
      input_type: o.input_type,
      type: o.type,
      is_fallback: o.is_fallback,
      is_default_fallback: o.is_default_fallback,
      file_patterns: o.file_patterns,
      fallback_ref:
        o.fallback_output_id != null
          ? (byId.get(o.fallback_output_id)?.name ?? null)
          : null,
      destination_config: o.destination_config,
      is_active: o.is_active,
    })),
  };
}

function resolveFallbackIds(
  rules: OutputExportEntry[],
  fallbackNames: Map<string, number>,
): Map<string, number | null> {
  const resolved = new Map<string, number | null>();

  for (const rule of rules) {
    if (rule.fallback_ref == null) {
      resolved.set(rule.name, null);
      continue;
    }

    const id = fallbackNames.get(rule.fallback_ref);
    if (id == null) {
      throw new ValidationError(
        `fallback_ref "${rule.fallback_ref}" not found for rule "${rule.name}"`,
      );
    }
    resolved.set(rule.name, id);
  }

  return resolved;
}

export function importOutputBundle(body: unknown): OutputImportResult {
  const { mode, bundle } = validateImportRequest(body);
  return importValidatedBundle(bundle, mode);
}

export function importValidatedBundle(
  bundle: OutputExportBundle,
  mode: OutputImportMode,
): OutputImportResult {
  const fallbacks = bundle.outputs.filter((o) => o.is_fallback);
  const rules = bundle.outputs.filter((o) => !o.is_fallback);

  let imported = 0;
  let skipped = 0;

  outputsRepo.runInTransaction(() => {
    const existingKeys = new Set<string>();
    const fallbackNames = new Map<string, number>();

    if (mode === 'replace') {
      outputsRepo.deleteAll();
    } else {
      for (const o of outputsRepo.listAll()) {
        existingKeys.add(entryKey(o.is_fallback, o.name));
        if (o.is_fallback) {
          fallbackNames.set(o.name, o.id);
        }
      }
    }

    for (const entry of fallbacks) {
      const key = entryKey(true, entry.name);
      if (mode === 'merge' && existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const created = outputsRepo.create(toNewOutput(entry, null));
      fallbackNames.set(entry.name, created.id);
      existingKeys.add(key);
      imported++;
    }

    const ruleFallbackIds = resolveFallbackIds(rules, fallbackNames);

    for (const entry of rules) {
      const key = entryKey(false, entry.name);
      if (mode === 'merge' && existingKeys.has(key)) {
        skipped++;
        continue;
      }

      outputsRepo.create(toNewOutput(entry, ruleFallbackIds.get(entry.name) ?? null));
      existingKeys.add(key);
      imported++;
    }
  });

  return { mode, imported, skipped };
}
