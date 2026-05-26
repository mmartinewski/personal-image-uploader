import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, filePath);
}

export function atomicWriteJsonSync(filePath: string, data: unknown): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export async function copyFileTo(src: string, dst: string): Promise<void> {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await fsp.copyFile(src, dst);
}

export async function moveFile(src: string, dst: string): Promise<void> {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  try {
    await fsp.rename(src, dst);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      await fsp.copyFile(src, dst);
      await fsp.unlink(src);
      return;
    }
    throw err;
  }
}

export async function moveDir(src: string, dst: string): Promise<void> {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  try {
    await fsp.rename(src, dst);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyDir(src, dst);
      await fsp.rm(src, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}

async function copyDir(src: string, dst: string): Promise<void> {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath);
    } else {
      await fsp.copyFile(srcPath, dstPath);
    }
  }
}

export async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export async function walkTransactionJson(
  rootDir: string,
  onTxn: (txnDir: string, metaPath: string) => void | Promise<void>,
): Promise<void> {
  if (!fs.existsSync(rootDir)) return;

  const buckets = await fsp.readdir(rootDir, { withFileTypes: true });
  for (const bucket of buckets) {
    if (!bucket.isDirectory()) continue;
    const bucketPath = path.join(rootDir, bucket.name);
    const txns = await fsp.readdir(bucketPath, { withFileTypes: true });
    for (const txn of txns) {
      if (!txn.isDirectory()) continue;
      const txnDir = path.join(bucketPath, txn.name);
      const metaPath = path.join(txnDir, 'transaction.json');
      if (fs.existsSync(metaPath)) {
        await onTxn(txnDir, metaPath);
      }
    }
  }
}

export async function removeDirRecursive(dir: string): Promise<void> {
  await fsp.rm(dir, { recursive: true, force: true });
}
