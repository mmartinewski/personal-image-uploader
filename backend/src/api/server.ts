import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { HOST, PORT, frontendDistDir } from '../config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { inputsRouter } from './routes/inputs.routes.js';
import { outputsRouter } from './routes/outputs.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { dlqRouter } from './routes/dlq.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { utilsRouter } from './routes/utils.routes.js';
import { logger } from '../util/logger.js';

let httpServer: http.Server | null = null;

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.use('/api/inputs', inputsRouter);
  app.use('/api/outputs', outputsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/dlq', dlqRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/utils', utilsRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/shutdown', (req, res) => {
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
    res.json({ ok: true });
    void import('../util/shutdown.js').then(({ shutdown }) => shutdown(0));
  });

  const dist = frontendDistDir();
  const indexHtml = path.join(dist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(indexHtml);
    });
    logger.info({ dist }, 'Serving frontend static files');
  } else {
    logger.warn({ dist }, 'Frontend dist not found — API only mode');
  }

  app.use(errorHandler);

  return app;
}

export function stopServer(): Promise<void> {
  if (!httpServer) return Promise.resolve();
  return new Promise((resolve) => {
    httpServer!.close(() => {
      httpServer = null;
      resolve();
    });
  });
}

export function isPiuBackendRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/health',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(res.statusCode === 200 && JSON.parse(body).ok === true);
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export function startServer(): Promise<void> {
  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST);
    httpServer = server;

    server.on('listening', () => {
      logger.info({ host: HOST, port: PORT }, 'API server listening');
      resolve();
    });

    server.on('error', async (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        if (await isPiuBackendRunning()) {
          logger.info({ port: PORT }, 'PIU backend already listening — reusing existing instance');
          process.exit(0);
          return;
        }
        logger.error(
          { port: PORT, err },
          'Port already in use. Stop `npm run dev`, another PIU instance, or whatever is using this port.',
        );
        process.exit(1);
        return;
      }
      reject(err);
    });
  });
}
