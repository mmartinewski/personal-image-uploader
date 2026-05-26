import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import type { DlqEntry } from '../../core/models';

@Component({
  selector: 'app-troubleshooting-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 class="mb-4 text-2xl font-semibold">Troubleshooting / DLQ</h2>

    @if (entries.length === 0) {
      <p class="text-slate-500">No items in the Dead Letter Queue.</p>
    }

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      @for (entry of entries; track entry.txn_id) {
        <article class="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <img
            [src]="api.dlqImageUrl(entry.txn_id)"
            [alt]="entry.transaction.original_name"
            class="mb-3 h-32 w-full rounded object-cover bg-slate-800"
          />
          <h3 class="font-medium">{{ entry.transaction.original_name }}</h3>
          <p class="text-xs text-slate-500">{{ entry.txn_id }}</p>
          <ul class="mt-2 space-y-1 text-xs text-red-300">
            @for (d of entry.deliveries; track d.output_id) {
              @if (d.status === 'dlq' || d.last_error) {
                <li>Output #{{ d.output_id }}: {{ d.last_error ?? d.status }}</li>
              }
            }
          </ul>
          <div class="mt-4 flex gap-2">
            <button
              (click)="retry(entry.txn_id)"
              class="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500"
            >
              Retry Now
            </button>
            <button
              (click)="remove(entry.txn_id)"
              class="rounded border border-red-800 px-3 py-1 text-sm text-red-400 hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        </article>
      }
    </div>
  `,
})
export class TroubleshootingPageComponent implements OnInit {
  entries: DlqEntry[] = [];

  constructor(readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getDlq().subscribe((list) => (this.entries = list));
  }

  retry(txnId: string): void {
    this.api.retryDlq(txnId).subscribe(() => this.load());
  }

  remove(txnId: string): void {
    if (!confirm('Delete this transaction permanently?')) return;
    this.api.deleteDlq(txnId).subscribe(() => this.load());
  }
}
