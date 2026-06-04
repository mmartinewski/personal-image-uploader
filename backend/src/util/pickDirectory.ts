import { spawnSync } from 'node:child_process';

/**
 * Opens the OS native folder picker (blocking). Returns absolute path or null if cancelled.
 */
export function pickDirectoryNative(defaultPath?: string | null): string | null {
  if (process.platform === 'win32') {
    return pickDirectoryWindows(defaultPath);
  }
  if (process.platform === 'darwin') {
    return pickDirectoryMac(defaultPath);
  }
  return pickDirectoryLinux(defaultPath);
}

function pickDirectoryWindows(defaultPath?: string | null): string | null {
  const selectedPath = defaultPath?.trim()
    ? `$dialog.SelectedPath = ${JSON.stringify(defaultPath.trim().replace(/\//g, '\\'))}`
    : '';

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select folder to monitor'
${selectedPath}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
  exit 0
}
exit 1
`.trim();

  const result = spawnSync('powershell', ['-NoProfile', '-STA', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600_000,
  });

  if (result.status !== 0) {
    return null;
  }

  const path = result.stdout?.trim();
  return path || null;
}

function pickDirectoryMac(defaultPath?: string | null): string | null {
  const defaultClause = defaultPath?.trim()
    ? ` default location alias POSIX file ${JSON.stringify(defaultPath.trim())}`
    : '';
  const script = `POSIX path of (choose folder with prompt "Select folder to monitor"${defaultClause})`;

  const result = spawnSync('osascript', ['-e', script], {
    encoding: 'utf8',
    timeout: 600_000,
  });

  if (result.status !== 0) {
    return null;
  }

  const path = result.stdout?.trim();
  return path || null;
}

function pickDirectoryLinux(defaultPath?: string | null): string | null {
  const args = ['--file-selection', '--directory', '--title=Select folder to monitor'];
  if (defaultPath?.trim()) {
    args.push(`--filename=${defaultPath.trim().replace(/\\/g, '/')}/`);
  }

  const result = spawnSync('zenity', args, {
    encoding: 'utf8',
    timeout: 600_000,
  });

  if (result.status !== 0) {
    return null;
  }

  const path = result.stdout?.trim();
  return path || null;
}

export function isPickDirectorySupported(): boolean {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return true;
  }
  try {
    const r = spawnSync('which', ['zenity'], { encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}
