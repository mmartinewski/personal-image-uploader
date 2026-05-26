import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EventsService } from './core/events.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen">
      <aside class="w-56 shrink-0 border-r border-slate-800 bg-slate-900 p-4">
        <h1 class="mb-6 text-lg font-semibold text-indigo-300">PIU</h1>
        <nav class="flex flex-col gap-1 text-sm">
          <a routerLink="/" routerLinkActive="bg-slate-800 text-white" [routerLinkActiveOptions]="{ exact: true }"
            class="rounded px-3 py-2 text-slate-300 hover:bg-slate-800">Dashboard</a>
          <a routerLink="/inputs" routerLinkActive="bg-slate-800 text-white"
            class="rounded px-3 py-2 text-slate-300 hover:bg-slate-800">Inputs</a>
          <a routerLink="/outputs" routerLinkActive="bg-slate-800 text-white"
            class="rounded px-3 py-2 text-slate-300 hover:bg-slate-800">Outputs</a>
          <a routerLink="/troubleshooting" routerLinkActive="bg-slate-800 text-white"
            class="rounded px-3 py-2 text-slate-300 hover:bg-slate-800">Troubleshooting</a>
        </nav>
        <p class="mt-8 text-xs text-slate-500">Personal Image Uploader</p>
      </aside>
      <main class="flex-1 overflow-auto p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(private readonly events: EventsService) {}

  ngOnInit(): void {
    this.events.connect();
  }

  ngOnDestroy(): void {
    this.events.disconnect();
  }
}
