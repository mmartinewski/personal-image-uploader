import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { Output, OutputExportBundle, OutputImportMode } from '../../core/models';
import { PageToolbarComponent } from '../../shared/page-toolbar.component';
import { IconButtonComponent } from '../../shared/icon-button.component';
import { TagListComponent } from '../../shared/tag-list.component';
import {
  buildOutputExportBundle,
  downloadJsonFile,
} from '../../shared/output-export.util';

type SortDir = 'asc' | 'desc';
type FallbackSortKey = 'name' | 'type' | 'is_default_fallback' | 'is_active';
type RuleSortKey = 'name' | 'type' | 'patterns' | 'fallback' | 'is_active';

@Component({
  selector: 'app-outputs-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageToolbarComponent, IconButtonComponent, TagListComponent],
  template: `
    <app-page-toolbar title="Outputs" subtitle="Routing rules and fallback channels">
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        (click)="exportConfig()"
      >
        Export
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
        [disabled]="importing"
        (click)="importDialogOpen = true"
      >
        {{ importing ? 'Importing…' : 'Import' }}
      </button>
      <a routerLink="/outputs/fallback/new" class="rounded-lg border border-amber-700 bg-amber-900/40 px-4 py-2 text-sm hover:bg-amber-900/60">
        Add fallback
      </a>
      <a routerLink="/outputs/rule/new" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500">
        Add rule
      </a>
    </app-page-toolbar>

    @if (importDialogOpen) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        (click)="importDialogOpen = false"
      >
        <div
          class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold">Import outputs</h3>
          <p class="mt-2 text-sm text-slate-400">
            JSON file contains webhooks and bot tokens — keep it private.
          </p>
          <div class="mt-4 space-y-2">
            <label
              class="block cursor-pointer rounded-lg border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
            >
              <span class="font-medium">Add</span>
              <span class="mt-1 block text-slate-400">Keep existing; skip duplicate names.</span>
              <input
                type="file"
                accept="application/json,.json"
                class="hidden"
                (change)="onImportFile($event, 'merge')"
              />
            </label>
            <label
              class="block cursor-pointer rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm hover:bg-amber-950/50"
            >
              <span class="font-medium text-amber-200">Replace all</span>
              <span class="mt-1 block text-amber-200/70">Delete every output here, then import the file.</span>
              <input
                type="file"
                accept="application/json,.json"
                class="hidden"
                (change)="onImportFile($event, 'replace')"
              />
            </label>
          </div>
          <button
            type="button"
            class="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            (click)="importDialogOpen = false"
          >
            Cancel
          </button>
        </div>
      </div>
    }

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
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setFallbackSort('name')">
                    Name {{ sortIndicator(fallbackSortKey, 'name', fallbackSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setFallbackSort('type')">
                    Type {{ sortIndicator(fallbackSortKey, 'type', fallbackSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setFallbackSort('is_default_fallback')">
                    Default {{ sortIndicator(fallbackSortKey, 'is_default_fallback', fallbackSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setFallbackSort('is_active')">
                    Active {{ sortIndicator(fallbackSortKey, 'is_active', fallbackSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of sortedFallbackChannels; track row.id) {
                <tr class="border-b border-amber-950/30 last:border-0 hover:bg-amber-950/10">
                  <td class="px-4 py-3 font-medium">{{ row.name }}</td>
                  <td class="px-4 py-3">{{ row.type }}</td>
                  <td class="px-4 py-3">{{ row.is_default_fallback ? 'Yes' : '—' }}</td>
                  <td class="px-4 py-3">
                    <label class="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        class="rounded border-slate-600 bg-slate-800 text-indigo-500"
                        [checked]="row.is_active"
                        [disabled]="togglingIds.has(row.id)"
                        (change)="toggleActive(row, $event)"
                      />
                      <span
                        class="text-xs"
                        [class]="row.is_active ? 'text-emerald-300' : 'text-slate-400'"
                      >
                        {{ row.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </label>
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
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setRuleSort('name')">
                    Name {{ sortIndicator(ruleSortKey, 'name', ruleSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setRuleSort('type')">
                    Type {{ sortIndicator(ruleSortKey, 'type', ruleSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setRuleSort('patterns')">
                    Patterns {{ sortIndicator(ruleSortKey, 'patterns', ruleSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setRuleSort('fallback')">
                    Fallback {{ sortIndicator(ruleSortKey, 'fallback', ruleSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="sort-header" (click)="setRuleSort('is_active')">
                    Active {{ sortIndicator(ruleSortKey, 'is_active', ruleSortDir) }}
                  </button>
                </th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of sortedRules; track row.id) {
                <tr class="border-b border-slate-900 last:border-0 hover:bg-slate-900/40">
                  <td class="px-4 py-3 font-medium">{{ row.name }}</td>
                  <td class="px-4 py-3">{{ row.type }}</td>
                  <td class="px-4 py-3">
                    <app-tag-list [tags]="row.file_patterns" />
                  </td>
                  <td class="px-4 py-3 text-xs text-slate-400">
                    {{ fallbackLabel(row.fallback_output_id) }}
                    @if (row.also_send_default_fallback) {
                      <span class="mt-0.5 block text-indigo-300">+ default fallback</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <label class="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        class="rounded border-slate-600 bg-slate-800 text-indigo-500"
                        [checked]="row.is_active"
                        [disabled]="togglingIds.has(row.id)"
                        (change)="toggleActive(row, $event)"
                      />
                      <span
                        class="text-xs"
                        [class]="row.is_active ? 'text-emerald-300' : 'text-slate-400'"
                      >
                        {{ row.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </label>
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
  styles: `
    .sort-header {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 0;
      font: inherit;
      color: inherit;
    }
    .sort-header:hover {
      color: rgb(203 213 225);
    }
  `,
})
export class OutputsListPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  importing = false;
  importDialogOpen = false;
  fallbackChannels: Output[] = [];
  rules: Output[] = [];
  togglingIds = new Set<number>();

  fallbackSortKey: FallbackSortKey = 'name';
  fallbackSortDir: SortDir = 'asc';
  ruleSortKey: RuleSortKey = 'name';
  ruleSortDir: SortDir = 'asc';

  get sortedFallbackChannels(): Output[] {
    return this.sortOutputs(this.fallbackChannels, this.fallbackSortKey, this.fallbackSortDir);
  }

  get sortedRules(): Output[] {
    return this.sortOutputs(this.rules, this.ruleSortKey, this.ruleSortDir, (row) =>
      this.fallbackLabel(row.fallback_output_id),
    );
  }

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

  sortIndicator(currentKey: string, key: string, dir: SortDir): string {
    return currentKey === key ? (dir === 'asc' ? '↑' : '↓') : '';
  }

  setFallbackSort(key: FallbackSortKey): void {
    if (this.fallbackSortKey === key) {
      this.fallbackSortDir = this.fallbackSortDir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.fallbackSortKey = key;
    this.fallbackSortDir = 'asc';
  }

  setRuleSort(key: RuleSortKey): void {
    if (this.ruleSortKey === key) {
      this.ruleSortDir = this.ruleSortDir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.ruleSortKey = key;
    this.ruleSortDir = 'asc';
  }

  toggleActive(row: Output, event: Event): void {
    const input = event.target as HTMLInputElement;
    const next = input.checked;
    if (this.togglingIds.has(row.id)) return;

    const previous = row.is_active;
    row.is_active = next;
    this.togglingIds.add(row.id);

    this.api.updateOutput(row.id, { is_active: next }).subscribe({
      next: (updated) => {
        row.is_active = updated.is_active;
        this.togglingIds.delete(row.id);
      },
      error: (err) => {
        row.is_active = previous;
        input.checked = previous;
        this.togglingIds.delete(row.id);
        alert(err.error?.error ?? 'Failed to update');
      },
    });
  }

  private sortOutputs(
    list: Output[],
    key: FallbackSortKey | RuleSortKey,
    dir: SortDir,
    fallbackLabelFn?: (row: Output) => string,
  ): Output[] {
    const factor = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => factor * this.compareOutputs(a, b, key, fallbackLabelFn));
  }

  private compareOutputs(
    a: Output,
    b: Output,
    key: FallbackSortKey | RuleSortKey,
    fallbackLabelFn?: (row: Output) => string,
  ): number {
    switch (key) {
      case 'name':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'type':
        return a.type.localeCompare(b.type);
      case 'is_default_fallback':
        return Number(a.is_default_fallback) - Number(b.is_default_fallback);
      case 'is_active':
        return Number(a.is_active) - Number(b.is_active);
      case 'patterns':
        return a.file_patterns.join(',').localeCompare(b.file_patterns.join(','));
      case 'fallback':
        return (fallbackLabelFn?.(a) ?? '').localeCompare(fallbackLabelFn?.(b) ?? '');
      default:
        return 0;
    }
  }

  remove(row: Output): void {
    if (!confirm(`Delete "${row.name}"?`)) return;
    this.api.deleteOutput(row.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(err.error?.error ?? 'Failed to delete'),
    });
  }

  exportConfig(): void {
    const all = [...this.fallbackChannels, ...this.rules];
    if (all.length === 0) {
      alert('No outputs to export');
      return;
    }

    const bundle = buildOutputExportBundle(all);
    const filename = `piu-outputs-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(filename, bundle);
  }

  onImportFile(event: Event, mode: OutputImportMode): void {
    this.importDialogOpen = false;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file
      .text()
      .then((text) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          alert('Invalid JSON file');
          return;
        }

        const bundle = parsed as OutputExportBundle;
        if (bundle.format !== 'piu-outputs' || !Array.isArray(bundle.outputs)) {
          alert('Not a valid PIU outputs export file');
          return;
        }

        if (bundle.outputs.length === 0) {
          alert('The export file contains no outputs');
          return;
        }

        this.importing = true;
        this.api.importOutputs(mode, bundle).subscribe({
          next: (result) => {
            this.importing = false;
            this.load();
            alert(this.importResultMessage(result));
          },
          error: (err: HttpErrorResponse) => {
            this.importing = false;
            alert(this.importErrorMessage(err));
          },
        });
      })
      .catch(() => alert('Could not read file'));
  }

  private importErrorMessage(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') return err.error.error;
    if (err.status === 404) {
      return 'Import API not available. Stop the PIU desktop app (or anything on port 3737), then run npm run dev again.';
    }
    if (err.status === 0) {
      return 'Could not reach the backend. Is npm run dev running?';
    }
    return `Failed to import (HTTP ${err.status})`;
  }

  private importResultMessage(result: {
    imported: number;
    skipped: number;
    mode: OutputImportMode;
  }): string {
    if (result.imported === 0 && result.skipped > 0) {
      return `No new outputs added: ${result.skipped} already exist (Add mode skips duplicates). Use Replace mode to overwrite all outputs.`;
    }
    if (result.imported === 0) {
      return 'No outputs were imported.';
    }
    const skipped =
      result.skipped > 0 ? ` ${result.skipped} skipped (duplicate names).` : '';
    return `Import complete: ${result.imported} output(s) added.${skipped}`;
  }
}
