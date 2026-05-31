import fs from 'node:fs';

/** File creation time (birthtime on Windows; falls back to mtime). */
export function fileCreatedAt(stat: fs.Stats): Date {
  if (Number.isFinite(stat.birthtimeMs) && stat.birthtimeMs > 0) {
    return stat.birthtime;
  }
  return stat.mtime;
}

export function isFileCreatedAfterCutoff(filePath: string, uploadAfter: string | null): boolean {
  if (!uploadAfter) return true;

  const cutoffMs = Date.parse(uploadAfter);
  if (Number.isNaN(cutoffMs)) return true;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }

  return fileCreatedAt(stat).getTime() >= cutoffMs;
}
