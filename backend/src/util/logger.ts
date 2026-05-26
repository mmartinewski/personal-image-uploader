import fs from 'node:fs';
import pino from 'pino';
import { logDir } from '../config.js';

fs.mkdirSync(logDir(), { recursive: true });

const logFile = `${logDir()}/piu.log`;

export const logger = pino(
  { level: 'info' },
  pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination({ dest: logFile, mkdir: true, sync: false }) },
  ]),
);

export const goLogger = logger.child({ source: 'go_monitor' });
