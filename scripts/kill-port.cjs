'use strict';

const { execSync, spawnSync } = require('child_process');

function killPort(port) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        console.log(`[kill-port] Stopping PID ${pid} on port ${port}`);
        spawnSync('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'inherit' });
      }
    } catch {
      // Nothing listening on this port.
    }
    return;
  }

  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
    for (const pid of out.trim().split('\n').filter(Boolean)) {
      console.log(`[kill-port] Stopping PID ${pid} on port ${port}`);
      process.kill(Number(pid), 'SIGTERM');
    }
  } catch {
    // Nothing listening on this port.
  }
}

const port = Number(process.argv[2]);
if (Number.isFinite(port) && port > 0) {
  killPort(port);
}
