import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { Output } from '../../core/models';
import { PageToolbarComponent } from '../../shared/page-toolbar.component';
import { IconButtonComponent } from '../../shared/icon-button.component';
import { TagListComponent } from '../../shared/tag-list.component';

@Component({
  selector: 'app-outputs-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageToolbarComponent, IconButtonComponent, TagListComponent],
  template: `
    <app-page-toolbar title="Outputs" subtitle="Routing rules and fallback channels">
      <a routerLink="/outputs/fallback/new" class="rounded-lg border border-amber-700 bg-amber-900/40 px-4 py-2 text-sm hover:bg-amber-900/60">
        Add fallback
      </a>
      <a routerLink="/outputs/rule/new" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500">
        Add rule
      </a>
    </app-page-toolbar>

    <section class="mb-8">
      <h3 class="mb-3 text-sm font-medium text-amber-200">Fallback channels</h3>
      @if (fallbackChannels.length === 0) {
        <p class="rounded-lg border border-dashed border-amber-900/40 p-6 text-sm text-slate-500">
          No fallback channels yet.
          <a routerLink="/outputs/fallback/new" class="ml-1 text-amber-300 hover:underline">Create one</a>.
        </p>
      } @else {
        <div class="overflow-hidden rounded-lg border border-amber-900/40">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-amber-900/40 bg-amber-950/20 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">Name</th>
                <th class="px-4 py-3 font-medium">Type</th>
                <th class="px-4 py-3 font-medium">Default</th>
                <th class="px-4 py-3 font-medium">Active</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of fallbackChannels; track row.id) {
                <tr class="border-b border-amber-950/30 last:border-0 hover:bg-amber-950/10">
                  <td class="px-4 py-3 font-medium">{{ row.name }}</td>
                  <td class="px-4 py-3">{{ row.type }}</td>
                  <td class="px-4 py-3">{{ row.is_default_fallback ? 'Yes' : '—' }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs"
                      [class]="row.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'"
                    >
                      {{ row.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-1">
                      <app-icon-button
                        icon="edit"
                        label="Edit fallback"
                        [routerLink]="'/outputs/fallback/' + row.id + '/edit'"
                      />
                      <app-icon-button
                        icon="delete"
                        label="Delete fallback"
                        tone="danger"
                        (pressed)="remove(row)"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <section>
      <h3 class="mb-3 text-sm font-medium text-slate-300">Routing rules</h3>
      @if (rules.length === 0) {
        <p class="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-500">
          No routing rules yet.
          <a routerLink="/outputs/rule/new" class="ml-1 text-indigo-400 hover:underline">Create one</a>.
        </p>
      } @else {
        <div class="overflow-hidden rounded-lg border border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-800 bg-slate-900/60 text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">Name</th>
                <th class="px-4 py-3 font-medium">Type</th>
                <th class="px-4 py-3 font-medium">Patterns</th>
                <th class="px-4 py-3 font-medium">Fallback</th>
                <th class="px-4 py-3 font-medium">Active</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rules; track row.id) {
                <tr class="border-b border-slate-900 last:border-0 hover:bg-slate-900/40">
                  <td class="px-4 py-3 font-medium">{{ row.name }}</td>
                  <td class="px-4 py-3">{{ row.type }}</td>
                  <td class="px-4 py-3">
                    <app-tag-list [tags]="row.file_patterns" />
                  </td>
                  <td class="px-4 py-3 text-xs text-slate-400">{{ fallbackLabel(row.fallback_output_id) }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs"
                      [class]="row.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'"
                    >
                      {{ row.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-1">
                      <app-icon-button
                        icon="edit"
                        label="Edit rule"
                        [routerLink]="'/outputs/rule/' + row.id + '/edit'"
                      />
                      <app-icon-button
                        icon="delete"
                        label="Delete rule"
                        tone="danger"
                        (pressed)="remove(row)"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class OutputsListPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  fallbackChannels: Output[] = [];
  rules: Output[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getOutputs().subscribe((list) => {
      this.fallbackChannels = list.filter((o) => o.is_fallback);
      this.rules = list.filter((o) => !o.is_fallback);
    });
  }

  fallbackLabel(id: number | null): string {
    if (id == null) return 'Default';
    return this.fallbackChannels.find((f) => f.id === id)?.name ?? `#${id}`;
  }

  remove(row: Output): void {
    if (!confirm(`Delete "${row.name}"?`)) return;
    this.api.deleteOutput(row.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(err.error?.error ?? 'Failed to delete'),
    });
  }
}
