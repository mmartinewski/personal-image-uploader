import { minimatch } from 'minimatch';

const GLOB_CHARS = /[*?[{]|^\*\*$/;

/**
 * Returns true when the pattern uses glob syntax (VS Code–style), not plain substring.
 */
export function isGlobPattern(pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  return GLOB_CHARS.test(p);
}

/**
 * Match a file basename against a pattern.
 *
 * - Glob patterns (`*`, `*.jpg`, `*.{png,jpg}`, `2026*.jpg`): minimatch, case-insensitive.
 * - Plain text without glob chars (`Satisfactory`): legacy substring match (case-insensitive).
 */
export function matchesFilePattern(basename: string, pattern: string): boolean {
  const name = basename.trim();
  const p = pattern.trim();
  if (!p || !name) return false;

  if (isGlobPattern(p)) {
    return minimatch(name, p, {
      nocase: true,
      dot: true,
      matchBase: true,
    });
  }

  return name.toLowerCase().includes(p.toLowerCase());
}
