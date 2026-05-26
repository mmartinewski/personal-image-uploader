import { Component, Input, forwardRef } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  Validator,
  AbstractControl,
  ValidationErrors,
  NG_VALIDATORS,
} from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  standalone: true,
  template: `
    <div
      class="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded border border-slate-700 bg-slate-950 px-2 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
      [class.opacity-60]="disabled"
    >
      @for (tag of tags; track tag) {
        <span
          class="inline-flex max-w-full items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-sm text-slate-200"
        >
          <span class="truncate">{{ tag }}</span>
          @if (!disabled) {
            <button
              type="button"
              class="shrink-0 text-slate-400 hover:text-slate-200"
              [attr.aria-label]="'Remove ' + tag"
              (click)="removeTag(tag)"
            >
              ×
            </button>
          }
        </span>
      }
      <input
        #inputEl
        type="text"
        class="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-600"
        [placeholder]="tags.length === 0 ? placeholder : ''"
        [disabled]="disabled"
        [value]="draft"
        (input)="draft = inputEl.value"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
      />
    </div>
    @if (hint) {
      <p class="mt-1 text-xs text-slate-500">{{ hint }}</p>
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TagInputComponent),
      multi: true,
    },
  ],
})
export class TagInputComponent implements ControlValueAccessor, Validator {
  @Input() placeholder = 'Type and press Enter';
  @Input() hint = '';
  @Input() required = false;
  @Input() allowDuplicates = false;
  @Input() transform: ((value: string) => string) | null = null;

  tags: string[] = [];
  draft = '';
  disabled = false;

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this.tags = Array.isArray(value) ? [...value] : [];
    this.draft = '';
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this.required) return null;
    const value = control.value as string[] | null;
    return Array.isArray(value) && value.length > 0 ? null : { required: true };
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitDraft();
      return;
    }
    if (event.key === 'Backspace' && !this.draft && this.tags.length > 0) {
      this.tags = this.tags.slice(0, -1);
      this.emit();
    }
  }

  onBlur(): void {
    this.commitDraft();
    this.onTouched();
  }

  commitDraft(): void {
    const raw = this.draft.trim();
    if (!raw || this.disabled) return;

    const tag = this.transform ? this.transform(raw) : raw.trim();
    if (!tag) {
      this.draft = '';
      return;
    }

    if (!this.allowDuplicates && this.tags.includes(tag)) {
      this.draft = '';
      return;
    }

    this.tags = [...this.tags, tag];
    this.draft = '';
    this.emit();
  }

  removeTag(tag: string): void {
    if (this.disabled) return;
    this.tags = this.tags.filter((t) => t !== tag);
    this.emit();
  }

  private emit(): void {
    this.onChange([...this.tags]);
  }
}

export function normalizeExtensionTag(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, '');
}
