import { EventEmitter } from 'node:events';
import type { EventName, EventPayloadMap } from '../types/api.js';

class TypedEventBus extends EventEmitter {
  emit<K extends EventName>(event: K, payload: EventPayloadMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends EventName>(event: K, listener: (payload: EventPayloadMap[K]) => void): this {
    return super.on(event, listener);
  }

  off<K extends EventName>(event: K, listener: (payload: EventPayloadMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();
