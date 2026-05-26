import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tag-list',
  standalone: true,
  template: `
    @if (tags.length === 0) {
      <span class="text-xs text-slate-500">{{ emptyText }}</span>
    } @else {
      <div class="flex flex-wrap gap-1.5">
        @for (tag of tags; track tag) {
          <span class="inline-flex max-w-full rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
            <span class="truncate">{{ tag }}</span>
          </span>
        }
      </div>
    }
  `,
})
export class TagListComponent {
  @Input() tags: string[] = [];
  @Input() emptyText = '—';
}
