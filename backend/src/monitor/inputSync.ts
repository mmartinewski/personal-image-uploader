import type { ChildProcess } from 'node:child_process';
import type { Input } from '../types/domain.js';
import { inputsRepo } from '../database/repos/inputs.repo.js';

let goProcess: ChildProcess | null = null;

export function bindGoProcess(proc: ChildProcess): void {
  goProcess = proc;
}

function writeCommand(cmd: string): void {
  if (!goProcess?.stdin?.writable) return;
  goProcess.stdin.write(cmd);
}

export function hydrate(): void {
  for (const input of inputsRepo.listActive()) {
    writeCommand(`WATCH:${input.source_path}\n`);
  }
}

export function notifyCreate(input: Input): void {
  if (input.is_active) {
    writeCommand(`WATCH:${input.source_path}\n`);
  }
}

export function notifyDelete(input: Input): void {
  writeCommand(`UNWATCH:${input.source_path}\n`);
}

export function notifyUpdate(oldInput: Input, newInput: Input): void {
  const pathChanged = oldInput.source_path !== newInput.source_path;
  const wasActive = oldInput.is_active;
  const isActive = newInput.is_active;

  if (pathChanged) {
    if (wasActive) writeCommand(`UNWATCH:${oldInput.source_path}\n`);
    if (isActive) writeCommand(`WATCH:${newInput.source_path}\n`);
    return;
  }

  if (wasActive && !isActive) {
    writeCommand(`UNWATCH:${newInput.source_path}\n`);
  } else if (!wasActive && isActive) {
    writeCommand(`WATCH:${newInput.source_path}\n`);
  }
}
