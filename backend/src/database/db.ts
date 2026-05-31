import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import type DatabaseType from 'better-sqlite3';
import { appRoot, databasePath, dataRoot, ensureDir, isPackaged } from '../paths.js';

declare const __dirname: string | undefined;

ensureDir(dataRoot());
const dbPath = databasePath();

function getRequire(): NodeRequire {
  if (typeof __dirname !== 'undefined') {
    return createRequire(path.join(__dirname, 'piu-backend.cjs'));
  }
  return createRequire(import.meta.url);
}

const require = getRequire();

function loadDatabaseConstructor(): typeof import('better-sqlite3') {
  if (isPackaged()) {
    const nativePath = path.join(path.dirname(process.execPath), 'better_sqlite3.node');
    const pkgRoot = path.join(appRoot(), 'node_modules', 'better-sqlite3');
    if (fs.existsSync(nativePath)) {
      process.env.BETTER_SQLITE3_NATIVE = nativePath;
    }
    if (fs.existsSync(pkgRoot)) {
      return require(pkgRoot);
    }
  }
  return require('better-sqlite3');
}

const Database = loadDatabaseConstructor();

export const db: DatabaseType.Database = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
