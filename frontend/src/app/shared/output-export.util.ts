import type { Output, OutputExportBundle } from '../core/models';

export function buildOutputExportBundle(outputs: Output[]): OutputExportBundle {
  const byId = new Map(outputs.map((o) => [o.id, o]));

  return {
    format: 'piu-outputs',
    version: 1,
    exported_at: new Date().toISOString(),
    outputs: outputs.map((o) => ({
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
      destination_config: { ...o.destination_config },
      is_active: o.is_active,
    })),
  };
}

/** Must run synchronously from a click handler (before any await) when using blob fallback. */
export function downloadJsonFile(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
