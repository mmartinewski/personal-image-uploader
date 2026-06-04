import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { Output, OutputType } from '../../core/models';
import { TagInputComponent, normalizeFilePatternTag } from '../../shared/tag-input.component';
import { PageToolbarComponent } from '../../shared/page-toolbar.component';

type OutputKind = 'fallback' | 'rule';

@Component({
  selector: 'app-output-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TagInputComponent, PageToolbarComponent],
  template: `
    <app-page-toolbar
      [title]="pageTitle"
      [subtitle]="pageSubtitle"
      backLink="/outputs"
    >
      <a routerLink="/outputs" class="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Cancel</a>
      <button
        type="button"
        [disabled]="form.invalid || saving"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        (click)="save()"
      >
        {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create' }}
      </button>
    </app-page-toolbar>

    @if (loading) {
      <p class="text-sm text-slate-500">Loading…</p>
    } @else {
      <form [formGroup]="form" class="max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6" (ngSubmit)="save()">
        <div>
          <label class="mb-1 block text-xs text-slate-500">Name</label>
          <input formControlName="name" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-500">Destination type</label>
          <select formControlName="type" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="discord_webhook">Discord Webhook</option>
            <option value="discord_bot">Discord Bot</option>
          </select>
        </div>
        @if (form.value.type === 'discord_bot') {
          <div>
            <label class="mb-1 block text-xs text-slate-500">Bot token</label>
            <input type="password" formControlName="bot_token" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">Channel ID</label>
            <input formControlName="channel_id" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
        }
        @if (form.value.type === 'discord_webhook') {
          <div>
            <label class="mb-1 block text-xs text-slate-500">Webhook URL</label>
            <input formControlName="webhook_url" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
        }
        @if (kind === 'rule') {
          <div>
            <label class="mb-1 block text-xs text-slate-500">File patterns</label>
            <app-tag-input
              formControlName="file_patterns"
              [required]="true"
              [transform]="normalizeFilePattern"
              placeholder="**/FactoryGame/Saved/Screenshots/Windows/**"
              hint="Press Enter to add each pattern. Backslashes are converted to /. Matched against the full file path and the path relative to the input."
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">Fallback when no rule matches</label>
            <select formControlName="fallback_output_id" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option [ngValue]="null">Use default fallback channel</option>
              @for (fb of fallbackChannels; track fb.id) {
                <option [ngValue]="fb.id">{{ fb.name }}{{ fb.is_default_fallback ? ' (default)' : '' }}</option>
              }
            </select>
            <p class="mt-1 text-xs text-slate-500">
              If all active rules agree on the same fallback, that channel is used. Otherwise the default fallback applies.
            </p>
          </div>
        }
        @if (kind === 'fallback') {
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="is_default_fallback" />
            Default fallback (used when no rule matches or rules disagree)
          </label>
        }
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" formControlName="is_active" />
          Active
        </label>
      </form>
    }
  `,
})
export class OutputFormPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly normalizeFilePattern = normalizeFilePatternTag;

  kind: OutputKind = 'rule';
  isEdit = false;
  loading = false;
  saving = false;
  outputId: number | null = null;
  fallbackChannels: Output[] = [];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    type: ['discord_webhook' as OutputType, Validators.required],
    bot_token: [''],
    channel_id: [''],
    webhook_url: [''],
    file_patterns: [[] as string[]],
    fallback_output_id: [null as number | null],
    is_default_fallback: [false],
    is_active: [true],
  });

  get pageTitle(): string {
    const noun = this.kind === 'fallback' ? 'fallback channel' : 'routing rule';
    return this.isEdit ? `Edit ${noun}` : `New ${noun}`;
  }

  get pageSubtitle(): string {
    return this.kind === 'fallback'
      ? 'Discord destination used when no routing rule matches'
      : 'Match file paths (relative to the input folder) and send to Discord';
  }

  ngOnInit(): void {
    this.kind = this.route.snapshot.data['kind'] as OutputKind;

    this.form.get('type')?.valueChanges.subscribe(() => this.updateValidators());

    const idParam = this.route.snapshot.paramMap.get('id');
    this.loading = true;

    this.api.getOutputs().subscribe({
      next: (list) => {
        this.fallbackChannels = list.filter((o) => o.is_fallback);

        if (idParam) {
          this.isEdit = true;
          this.outputId = Number(idParam);
          const row = list.find((o) => o.id === this.outputId);
          if (!row || row.is_fallback !== (this.kind === 'fallback')) {
            this.loading = false;
            void this.router.navigate(['/outputs']);
            return;
          }
          this.patchForm(row);
        } else if (this.kind === 'fallback') {
          this.form.patchValue({
            is_default_fallback: this.fallbackChannels.every((f) => !f.is_default_fallback),
          });
        }

        this.updateValidators();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/outputs']);
      },
    });
  }

  private patchForm(row: Output): void {
    const cfg = row.destination_config;
    this.form.patchValue({
      name: row.name,
      type: row.type,
      bot_token: cfg['bot_token'] ?? '',
      channel_id: cfg['channel_id'] ?? '',
      webhook_url: cfg['webhook_url'] ?? '',
      file_patterns: row.file_patterns.map((p) => normalizeFilePatternTag(p)),
      fallback_output_id: row.fallback_output_id,
      is_default_fallback: row.is_default_fallback,
      is_active: row.is_active,
    });
  }

  updateValidators(): void {
    const type = this.form.value.type;
    if (type === 'discord_bot') {
      this.form.get('bot_token')?.setValidators(Validators.required);
      this.form.get('channel_id')?.setValidators(Validators.required);
      this.form.get('webhook_url')?.clearValidators();
    } else {
      this.form.get('webhook_url')?.setValidators(Validators.required);
      this.form.get('bot_token')?.clearValidators();
      this.form.get('channel_id')?.clearValidators();
    }

    const patterns = this.form.get('file_patterns');
    if (this.kind === 'rule') {
      patterns?.enable({ emitEvent: false });
    } else {
      patterns?.setValue([], { emitEvent: false });
      patterns?.disable({ emitEvent: false });
    }
    patterns?.updateValueAndValidity();

    ['bot_token', 'channel_id', 'webhook_url'].forEach((k) =>
      this.form.get(k)?.updateValueAndValidity(),
    );
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.getRawValue();
    const destination_config =
      v.type === 'discord_bot'
        ? { bot_token: v.bot_token!, channel_id: v.channel_id! }
        : { webhook_url: v.webhook_url! };

    const is_fallback = this.kind === 'fallback';
    const body = {
      name: v.name!,
      input_type: 'directory' as const,
      type: v.type!,
      file_patterns: is_fallback
        ? []
        : (v.file_patterns ?? []).map((p) => normalizeFilePatternTag(p)),
      is_fallback,
      is_default_fallback: is_fallback ? (v.is_default_fallback ?? false) : false,
      fallback_output_id: is_fallback ? null : v.fallback_output_id,
      destination_config,
      is_active: v.is_active ?? true,
    };

    const req =
      this.isEdit && this.outputId != null
        ? this.api.updateOutput(this.outputId, body)
        : this.api.createOutput(body);

    req.subscribe({
      next: () => void this.router.navigate(['/outputs']),
      error: (err) => {
        this.saving = false;
        alert(err.error?.error ?? 'Failed to save');
      },
    });
  }
}
