import type { ErrorRequestHandler } from 'express';
import { ConflictError, OutputReferenceError } from '../../database/repos/outputs.repo.js';
import { ValidationError } from '../validation.js';
import { logger } from '../../util/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof OutputReferenceError) {
    res.status(400).json({ error: err.message });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
