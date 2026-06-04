import path from 'node:path';
import { outputsRepo } from '../database/repos/outputs.repo.js';
import type { Input } from '../types/domain.js';
import { matchesFilePattern, relativePathForPattern } from './patternMatch.js';
import { resolveFallbackForNoMatch } from './fallbackResolve.js';

export type RouteResult =
  | { kind: 'ignored'; reason: 'extension' }
  | { kind: 'routed'; outputIds: number[] }
  | { kind: 'no_route' };

export function route(filePath: string, input: Input): RouteResult {
  const ext = path.extname(filePath).slice(1).toLowerCase();

  if (!input.extensions.includes(ext)) {
    return { kind: 'ignored', reason: 'extension' };
  }

  const relativePath = relativePathForPattern(filePath, input.source_path);
  if (!relativePath) {
    return { kind: 'no_route' };
  }

  const activeRules = outputsRepo.findActive({
    input_type: input.type,
    is_fallback: false,
  });

  const matched: number[] = [];
  for (const rule of activeRules) {
    for (const pattern of rule.file_patterns) {
      if (matchesFilePattern(filePath, input.source_path, pattern)) {
        matched.push(rule.id);
        break;
      }
    }
  }

  if (matched.length > 0) {
    return { kind: 'routed', outputIds: matched };
  }

  const fallbackId = resolveFallbackForNoMatch(input.type);
  if (fallbackId != null) {
    return { kind: 'routed', outputIds: [fallbackId] };
  }

  return { kind: 'no_route' };
}
