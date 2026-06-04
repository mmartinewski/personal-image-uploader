import path from 'node:path';
import { minimatch } from 'minimatch';

/** Path relative to the input root, always using forward slashes. */
export function relativePathForPattern(filePath: string, inputRoot: string): string {
  const file = path.normalize(filePath);
  const root = path.normalize(inputRoot);

  if (file === root) {
    return path.basename(file);
  }

  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!file.startsWith(prefix)) {
    return '';
  }

  return file.slice(prefix.length).split(path.sep).join('/');
}

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

const MINIMATCH_OPTS = { nocase: true, dot: true } as const;

/**
 * Paths tested against each file pattern: absolute (full path) and relative to the input root.
 */
export function pathsForPatternMatching(filePath: string, inputRoot: string): string[] {
  const abs = normalizeSlashes(path.normalize(filePath));
  const rel = relativePathForPattern(filePath, inputRoot);
  if (rel && rel !== abs) {
    return [abs, rel];
  }
  return [abs];
}

/** Match using full absolute path and path relative to the input (glob, forward slashes). */
export function matchesFilePattern(
  filePath: string,
  inputRoot: string,
  pattern: string,
): boolean {
  const p = normalizeSlashes(pattern);
  if (!p) return false;

  const candidates = pathsForPatternMatching(filePath, inputRoot);
  return candidates.some((candidate) => candidate && minimatch(candidate, p, MINIMATCH_OPTS));
}
