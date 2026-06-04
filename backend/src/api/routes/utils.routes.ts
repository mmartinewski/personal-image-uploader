import { Router, type Request, type Response, type NextFunction } from 'express';
import { isPickDirectorySupported, pickDirectoryNative } from '../../util/pickDirectory.js';

export const utilsRouter = Router();

function localOnly(req: Request, res: Response, next: NextFunction): void {
  const remote = req.socket.remoteAddress ?? '';
  const local =
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1' ||
    remote.endsWith('127.0.0.1');
  if (!local) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

utilsRouter.post('/pick-directory', localOnly, (req, res) => {
  if (!isPickDirectorySupported()) {
    res.status(501).json({ error: 'Folder picker is not supported on this platform' });
    return;
  }

  const body = req.body as { defaultPath?: unknown };
  const defaultPath =
    typeof body?.defaultPath === 'string' && body.defaultPath.trim()
      ? body.defaultPath.trim()
      : null;

  const path = pickDirectoryNative(defaultPath);
  if (!path) {
    res.status(204).send();
    return;
  }

  res.json({ path });
});
