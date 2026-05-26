import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { EventsService, type PiUEvent } from '../../core/events.service';
import type { DashboardStats } from '../../core/models';
import { Subscription, interval, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 class="mb-4 text-2xl font-semibold">Dashboard</h2>

    <div class="mb-6 space-y-2">
      <div class="flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full"
          [class.bg-emerald-400]="sseConnected"
          [class.bg-red-400]="!sseConnected"
        ></span>
        <span class="text-sm text-slate-400">
          {{ sseConnected ? 'Live events connected' : 'Events disconnected' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full"
          [class.bg-emerald-400]="stats?.goRunning"
          [class.bg-amber-400]="stats && !stats.goBinaryPresent"
          [class.bg-red-400]="stats?.goBinaryPresent && !stats?.goRunning"
        ></span>
        <span class="text-sm text-slate-400">{{ goStatusLabel }}</span>
      </div>
      @if (!sseConnected) {
        <p class="text-xs text-slate-500">
          Cannot reach the backend at http://127.0.0.1:3737 — run <code class="text-slate-400">npm run dev</code> and keep the backend terminal open.
        </p>
      }
      @if (stats && !stats.goBinaryPresent) {
        <p class="text-xs text-amber-200/80">
          Go binary missing. Install <a class="underline" href="https://go.dev/dl/" target="_blank" rel="noopener">Go 1.22+</a>, then run <code class="text-slate-400">npm run build:go</code> and restart <code class="text-slate-400">npm run dev</code>.
        </p>
      }
    </div>

    <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p class="text-xs uppercase text-slate-500">Synced</p>
        <p class="text-2xl font-bold text-emerald-400">{{ stats?.synced ?? '—' }}</p>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p class="text-xs uppercase text-slate-500">Pending</p>
        <p class="text-2xl font-bold text-amber-400">{{ stats?.pending ?? '—' }}</p>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p class="text-xs uppercase text-slate-500">Retrying</p>
        <p class="text-2xl font-bold text-orange-400">{{ stats?.error ?? '—' }}</p>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p class="text-xs uppercase text-slate-500">DLQ</p>
        <p class="text-2xl font-bold text-red-400">{{ stats?.dlq ?? '—' }}</p>
      </div>
    </div>

    <h3 class="mb-2 text-sm font-medium text-slate-400">Live activity</h3>
    <ul class="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
      @if (feed.length === 0) {
        <li class="text-slate-500">Waiting for events…</li>
      }
      @for (item of feed; track item.id) {
        <li class="border-b border-slate-800 pb-2 last:border-0">
          <span class="text-indigo-300">{{ item.type }}</span>
          <span class="text-slate-400"> — {{ item.summary }}</span>
          <span class="ml-2 text-xs text-slate-600">{{ item.at }}</span>
        </li>
      }
    </ul>
  `,
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  stats: DashboardStats | null = null;
  sseConnected = false;
  feed: { id: number; type: string; summary: string; at: string }[] = [];
  private subs = new Subscription();
  private feedId = 0;

  get goStatusLabel(): string {
    if (!this.stats) return 'Go monitor — checking…';
    if (!this.stats.goBinaryPresent) return 'Go monitor — binary not built';
    if (this.stats.goRunning) return 'Go monitor — running';
    return 'Go monitor — stopped (restarting…)';
  }

  constructor(
    private readonly api: ApiService,
    private readonly events: EventsService,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      interval(5000)
        .pipe(
          startWith(0),
          switchMap(() => this.api.getDashboardStats()),
        )
        .subscribe((s) => (this.stats = s)),
    );

    this.subs.add(this.events.connected$.subscribe((c) => (this.sseConnected = c)));

    this.subs.add(
      this.events.events$.subscribe((ev) => {
        if (ev.type === 'heartbeat') return;
        this.pushFeed(ev);
        this.api.getDashboardStats().subscribe((s) => (this.stats = s));
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private pushFeed(ev: PiUEvent): void {
    const at = new Date().toLocaleTimeString();
    let summary = JSON.stringify(ev.payload);
    if (ev.type === 'file_received') {
      summary = ev.payload.original_name;
    }
    this.feed.unshift({ id: ++this.feedId, type: ev.type, summary, at });
    this.feed = this.feed.slice(0, 50);
  }
}
