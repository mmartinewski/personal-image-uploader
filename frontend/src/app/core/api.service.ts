import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { DashboardStats, DlqEntry, Input, Output } from './models';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getInputs() {
    return this.http.get<Input[]>(`${API}/inputs`);
  }

  createInput(body: Partial<Input>) {
    return this.http.post<Input>(`${API}/inputs`, body);
  }

  updateInput(id: number, body: Partial<Input>) {
    return this.http.patch<Input>(`${API}/inputs/${id}`, body);
  }

  deleteInput(id: number) {
    return this.http.delete<void>(`${API}/inputs/${id}`);
  }

  getOutputs() {
    return this.http.get<Output[]>(`${API}/outputs`);
  }

  createOutput(body: unknown) {
    return this.http.post<Output>(`${API}/outputs`, body);
  }

  updateOutput(id: number, body: unknown) {
    return this.http.patch<Output>(`${API}/outputs/${id}`, body);
  }

  deleteOutput(id: number) {
    return this.http.delete<void>(`${API}/outputs/${id}`);
  }

  getDashboardStats() {
    return this.http.get<DashboardStats>(`${API}/dashboard/stats`);
  }

  getDlq() {
    return this.http.get<DlqEntry[]>(`${API}/dlq`);
  }

  retryDlq(txnId: string) {
    return this.http.post<void>(`${API}/dlq/${txnId}/retry`, {});
  }

  deleteDlq(txnId: string) {
    return this.http.delete<void>(`${API}/dlq/${txnId}`);
  }

  dlqImageUrl(txnId: string) {
    return `${API}/dlq/${txnId}/image`;
  }
}
