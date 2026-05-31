import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';

/** `datetime-local` value: `YYYY-MM-DDTHH:mm` or empty. */
export function dateToDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-datetime-input',
  standalone: true,
  template: `
    <div class="relative">
      <input
        #inputEl
        type="text"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        [placeholder]="placeholder"
        [disabled]="disabled"
        readonly
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200 disabled:opacity-50"
        [disabled]="disabled"
        aria-label="Open calendar"
        (click)="openPicker()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
          <path
            fill-rule="evenodd"
            d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatetimeInputComponent),
      multi: true,
    },
  ],
})
export class DatetimeInputComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @Input() placeholder = 'dd/mm/aaaa hh:mm';

  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;

  disabled = false;
  private picker: FlatpickrInstance | null = null;
  private pendingValue: string | null = null;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    this.picker = flatpickr(this.inputRef.nativeElement, {
      enableTime: true,
      time_24hr: true,
      allowInput: false,
      clickOpens: true,
      locale: {
        firstDayOfWeek: 0,
      },
      dateFormat: 'd/m/Y H:i',
      onChange: (selectedDates) => {
        const next = selectedDates[0] ? dateToDatetimeLocal(selectedDates[0]) : '';
        this.onChange(next);
      },
      onClose: () => this.onTouched(),
    });

    if (this.pendingValue !== null) {
      this.applyValue(this.pendingValue);
      this.pendingValue = null;
    }
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
    this.picker = null;
  }

  writeValue(value: string | null): void {
    const next = value ?? '';
    if (!this.picker) {
      this.pendingValue = next;
      return;
    }
    this.applyValue(next);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.picker?.close();
  }

  openPicker(): void {
    if (!this.disabled) this.picker?.open();
  }

  private applyValue(value: string): void {
    if (!this.picker) return;
    if (!value.trim()) {
      this.picker.clear(false);
      return;
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      this.picker.clear(false);
      return;
    }
    this.picker.setDate(new Date(parsed), false);
  }
}
