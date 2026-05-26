import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { Input } from '../../core/models';
import { PageToolbarComponent } from '../../shared/page-toolbar.component';
import { IconButtonComponent } from '../../shared/icon-button.component';
import { TagListComponent } from '../../shared/tag-list.component';

@Component({
  selector: 'app-inputs-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageToolbarComponent, IconButtonComponent, TagListComponent],
  template: `
    <app-page-toolbar title="Inputs" subtitle="Monitored directories">
      <a routerLink="/inputs/new" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500">
        Add input
      </a>
    </app-page-toolbar>

    @if (inputs.length === 0) {
      <p class="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
        No inputs configured yet.
        <a routerLink="/inputs/new" class="ml-1 text-indigo-400 hover:underline">Add the first directory</a>.
      </p>
    } @else {
      <div class="overflow-hidden rounded-lg border border-slate-800">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-800 bg-slate-900/60 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Path</th>
              <th class="px-4 py-3 font-medium">Extensions</th>
              <th class="px-4 py-3 font-medium">Active</th>
              <th class="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (row of inputs; track row.id) {
              <tr class="border-b border-slate-900 last:border-0 hover:bg-slate-900/40">
                <td class="px-4 py-3 font-medium">{{ row.name }}</td>
                <td class="px-4 py-3 font-mono text-xs text-slate-400">{{ row.source_path }}</td>
                <td class="px-4 py-3">
                  <app-tag-list [tags]="row.extensions" />
                </td>
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
                      label="Edit input"
                      [routerLink]="'/inputs/' + row.id + '/edit'"
                    />
                    <app-icon-button
                      icon="delete"
                      label="Delete input"
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
  `,
})
export class InputsListPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  inputs: Input[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getInputs().subscribe((list) => (this.inputs = list));
  }

  remove(row: Input): void {
    if (!confirm(`Delete input "${row.name}"?`)) return;
    this.api.deleteInput(row.id).subscribe(() => this.load());
  }
}
