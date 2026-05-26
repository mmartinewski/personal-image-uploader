import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-toolbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
      <div class="flex min-w-0 items-center gap-3">
        @if (backLink) {
          <a
            [routerLink]="backLink"
            class="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Back
          </a>
        }
        <div class="min-w-0">
          <h2 class="truncate text-2xl font-semibold">{{ title }}</h2>
          @if (subtitle) {
            <p class="mt-0.5 text-sm text-slate-500">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageToolbarComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() backLink: string | null = null;
}
