import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { TagInputComponent, normalizeExtensionTag } from '../../shared/tag-input.component';
import { PageToolbarComponent } from '../../shared/page-toolbar.component';

@Component({
  selector: 'app-input-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TagInputComponent, PageToolbarComponent],
  template: `
    <app-page-toolbar
      [title]="isEdit ? 'Edit input' : 'New input'"
      subtitle="Directory to monitor for new images"
      backLink="/inputs"
    >
      <a routerLink="/inputs" class="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Cancel</a>
      <button
        type="button"
        [disabled]="form.invalid || saving"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        (click)="save()"
      >
        {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create input' }}
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
          <label class="mb-1 block text-xs text-slate-500">Local path</label>
          <input formControlName="source_path" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-500">Extensions</label>
          <app-tag-input
            formControlName="extensions"
            [required]="true"
            placeholder="png"
            hint="Press Enter to add each extension (without dot)."
            [transform]="normalizeExtension"
          />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" formControlName="is_active" />
          Active
        </label>
      </form>
    }
  `,
})
export class InputFormPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly normalizeExtension = normalizeExtensionTag;

  isEdit = false;
  loading = false;
  saving = false;
  inputId: number | null = null;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    source_path: ['', Validators.required],
    extensions: [[] as string[]],
    is_active: [true],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.inputId = Number(idParam);
      this.loading = true;
      this.api.getInputs().subscribe({
        next: (list) => {
          const row = list.find((i) => i.id === this.inputId);
          if (!row) {
            void this.router.navigate(['/inputs']);
            return;
          }
          this.form.patchValue({
            name: row.name,
            source_path: row.source_path,
            extensions: [...row.extensions],
            is_active: row.is_active,
          });
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          void this.router.navigate(['/inputs']);
        },
      });
    } else {
      this.form.patchValue({
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      });
    }
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.getRawValue();
    const body = {
      name: v.name!,
      source_path: v.source_path!,
      extensions: v.extensions ?? [],
      is_active: v.is_active ?? true,
    };

    const req = this.isEdit && this.inputId != null
      ? this.api.updateInput(this.inputId, body)
      : this.api.createInput(body);

    req.subscribe({
      next: () => void this.router.navigate(['/inputs']),
      error: (err) => {
        this.saving = false;
        alert(err.error?.error ?? 'Failed to save');
      },
    });
  }
}
