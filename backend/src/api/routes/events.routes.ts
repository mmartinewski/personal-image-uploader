import { Router } from 'express';
import { SSE_HEARTBEAT_MS } from '../../config.js';
import { eventBus } from '../eventBus.js';
import type { EventName, EventPayloadMap } from '../../types/api.js';
import { nowIso } from '../../util/dates.js';

export const eventsRouter = Router();

eventsRouter.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = <K extends EventName>(event: K, data: EventPayloadMap[K]) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const listeners: Array<{ event: EventName; fn: (payload: EventPayloadMap[EventName]) => void }> = [];

  const attach = <K extends EventName>(event: K) => {
    const fn = (payload: EventPayloadMap[K]) => send(event, payload);
    eventBus.on(event, fn);
    listeners.push({ event, fn: fn as (payload: EventPayloadMap[EventName]) => void });
  };

  (['file_received', 'delivery_success', 'delivery_error', 'delivery_dlq', 'transaction_completed'] as const).forEach(
    attach,
  );

  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
    send('heartbeat', { at: nowIso() });
  }, SSE_HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    for (const { event, fn } of listeners) {
      eventBus.off(event, fn);
    }
  });
});
