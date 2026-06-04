import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = '/api/utils/pick-directory';

@Injectable({ providedIn: 'root' })
export class DirectoryPickerService {
  private readonly http = inject(HttpClient);

  get canPickDirectory(): boolean {
    return true;
  }

  /** Opens the OS folder picker via the PIU backend. Returns absolute path or null if cancelled. */
  pickDirectory(defaultPath?: string | null): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.http
        .post<{ path: string }>(
          API,
          { defaultPath: defaultPath?.trim() || null },
          { observe: 'response' },
        )
        .subscribe({
          next: (res) => {
            if (res.status === 204) {
              resolve(null);
              return;
            }
            const path = res.body?.path?.trim();
            resolve(path || null);
          },
          error: (err) => {
            if (err.status === 501) {
              resolve(null);
              return;
            }
            reject(err);
          },
        });
    });
  }
}
