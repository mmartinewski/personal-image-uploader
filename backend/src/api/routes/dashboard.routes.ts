import { Router } from 'express';
import { isGoBinaryPresent, isGoRunning } from '../../monitor/goProcess.js';
import { getStorageCounts } from '../storageStats.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', (_req, res) => {
  const counts = getStorageCounts();
  res.json({
    ...counts,
    goRunning: isGoRunning(),
    goBinaryPresent: isGoBinaryPresent(),
  });
});
