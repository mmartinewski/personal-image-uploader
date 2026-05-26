import cors from 'cors';
import express from 'express';
import { CORS_ORIGIN, HOST, PORT } from '../config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { inputsRouter } from './routes/inputs.routes.js';
import { outputsRouter } from './routes/outputs.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { dlqRouter } from './routes/dlq.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { logger } from '../util/logger.js';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  app.use('/api/inputs', inputsRouter);
  app.use('/api/outputs', outputsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/dlq', dlqRouter);
  app.use('/api/events', eventsRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);

  return app;
}

export function startServer(): void {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, 'API server listening');
  });
}
