import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { InputsListPageComponent } from './pages/inputs/inputs-list-page.component';
import { InputFormPageComponent } from './pages/inputs/input-form-page.component';
import { OutputsListPageComponent } from './pages/outputs/outputs-list-page.component';
import { OutputFormPageComponent } from './pages/outputs/output-form-page.component';
import { TroubleshootingPageComponent } from './pages/troubleshooting/troubleshooting-page.component';

export const routes: Routes = [
  { path: '', component: DashboardPageComponent },
  { path: 'inputs', component: InputsListPageComponent },
  { path: 'inputs/new', component: InputFormPageComponent },
  { path: 'inputs/:id/edit', component: InputFormPageComponent },
  { path: 'outputs', component: OutputsListPageComponent },
  { path: 'outputs/fallback/new', component: OutputFormPageComponent, data: { kind: 'fallback' } },
  { path: 'outputs/fallback/:id/edit', component: OutputFormPageComponent, data: { kind: 'fallback' } },
  { path: 'outputs/rule/new', component: OutputFormPageComponent, data: { kind: 'rule' } },
  { path: 'outputs/rule/:id/edit', component: OutputFormPageComponent, data: { kind: 'rule' } },
  { path: 'troubleshooting', component: TroubleshootingPageComponent },
  { path: '**', redirectTo: '' },
];
