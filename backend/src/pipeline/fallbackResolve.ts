import { outputsRepo } from '../database/repos/outputs.repo.js';
import type { InputType } from '../types/domain.js';

/**
 * When no routing rule matches, pick a fallback destination:
 * 1. If all active rules with fallback_output_id set agree on one id → use it.
 * 2. Else use the default fallback channel (is_default_fallback).
 */
export function resolveFallbackForNoMatch(input_type: InputType): number | null {
  const rules = outputsRepo.findActive({ input_type, is_fallback: false });
  const linked = [
    ...new Set(
      rules.map((r) => r.fallback_output_id).filter((id): id is number => id != null),
    ),
  ];

  if (linked.length === 1) {
    const fb = outputsRepo.getById(linked[0]!);
    if (fb?.is_fallback && fb.is_active) return fb.id;
  }

  const defaultFb = outputsRepo.findDefaultFallback(input_type);
  return defaultFb?.id ?? null;
}
