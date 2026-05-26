import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

export type PiUEvent =
  | { type: 'file_received'; payload: { txn_id: string; original_name: string; input_id: number } }
  | { type: 'delivery_success'; payload: { txn_id: string; output_id: number } }
  | { type: 'delivery_error'; payload: { txn_id: string; output_id: number; last_error: string } }
  | { type: 'delivery_dlq'; payload: { txn_id: string; output_id: number; last_error: string } }
  | { type: 'transaction_completed'; payload: { txn_id: string; dlq: boolean } }
  | { type: 'heartbeat'; payload: { at: string } };

const SSE_URL = 'http://127.0.0.1:3737/api/events';
const RECONNECT_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class EventsService implements OnDestroy {
  private source: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  readonly events$ = new Subject<PiUEvent>();
  readonly connected$ = new Subject<boolean>();

  constructor(private readonly zone: NgZone) {}

  connect(): void {
    this.destroyed = false;
    this.openStream();
  }

  private openStream(): void {
    if (this.destroyed) return;

    this.source?.close();
    this.source = new EventSource(SSE_URL);

    this.source.onopen = () => {
      this.zone.run(() => this.connected$.next(true));
    };

    this.source.onerror = () => {
      this.zone.run(() => this.connected$.next(false));
      this.scheduleReconnect();
    };

    const types = [
      'file_received',
      'delivery_success',
      'delivery_error',
      'delivery_dlq',
      'transaction_completed',
      'heartbeat',
    ] as const;

    for (const type of types) {
      this.source.addEventListener(type, (ev) => {
        const payload = JSON.parse((ev as MessageEvent).data);
        this.zone.run(() => this.events$.next({ type, payload } as PiUEvent));
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openStream();
    }, RECONNECT_MS);
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.source?.close();
    this.source = null;
    this.connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
