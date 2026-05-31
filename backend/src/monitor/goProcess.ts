import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import {
  GO_RESTART_BACKOFF_MS,
  GO_UPTIME_RESET_MS,
  goBinaryPath,
} from '../config.js';
import { logger, goLogger } from '../util/logger.js';
import * as inputSync from './inputSync.js';
import { handleFileDetected } from '../pipeline/transaction.js';

let child: ChildProcess | null = null;
let backoffIndex = 0;
let startedAt = Date.now();
let goRunning = false;
let restartTimer: NodeJS.Timeout | null = null;
let allowRestart = true;

export function isGoBinaryPresent(): boolean {
  return fs.existsSync(goBinaryPath());
}

export function isGoRunning(): boolean {
  return goRunning;
}

export function stopGoProcess(): void {
  allowRestart = false;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (!child) {
    goRunning = false;
    return;
  }

  const proc = child;
  child = null;
  goRunning = false;
  proc.removeAllListeners('exit');
  proc.removeAllListeners('error');

  if (!proc.pid) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      proc.kill('SIGTERM');
    }
    logger.info({ pid: proc.pid }, 'Go monitor stop requested');
  } catch (err) {
    logger.warn({ err, pid: proc.pid }, 'Failed to stop Go monitor');
  }
}

export function startGoProcess(): void {
  const bin = goBinaryPath();
  if (!fs.existsSync(bin)) {
    logger.warn({ bin }, 'Go monitor binary not found; file watching disabled until built');
    goRunning = false;
    return;
  }

  spawnOnce();
}

function spawnOnce(): void {
  const bin = goBinaryPath();
  child = spawn(bin, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  inputSync.bindGoProcess(child);
  goRunning = true;
  startedAt = Date.now();

  logger.info({ pid: child.pid }, 'Go monitor started');

  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'PONG') return;
      void handleFileDetected(trimmed).catch((err) => {
        logger.error({ err, path: trimmed }, 'Failed to handle file');
      });
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      goLogger.info(chunk.toString().trim());
    });
  }

  child.on('exit', (code, signal) => {
    goRunning = false;
    logger.warn({ code, signal }, 'Go monitor exited');
    scheduleRestart();
  });

  child.on('error', (err) => {
    goRunning = false;
    logger.error({ err }, 'Go monitor error');
    scheduleRestart();
  });

  inputSync.hydrate();
}

function scheduleRestart(): void {
  if (!allowRestart) return;

  const uptime = Date.now() - startedAt;
  if (uptime >= GO_UPTIME_RESET_MS) {
    backoffIndex = 0;
  }

  const delay = GO_RESTART_BACKOFF_MS[Math.min(backoffIndex, GO_RESTART_BACKOFF_MS.length - 1)]!;
  backoffIndex += 1;

  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!allowRestart) return;
    logger.info({ delay }, 'Restarting Go monitor');
    spawnOnce();
  }, delay);
}
