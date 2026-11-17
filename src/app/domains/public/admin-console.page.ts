import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { catchError, EMPTY, map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DataRequest, LegalService } from '@/app/core/legal/legal.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

type PlatformUser = { id: string; userName: string; fullName: string; email: string | null; phone: string | null; locked: boolean; mustChangePassword: boolean; organizations: string[] };
type PlatformOrg = { id: string; name: string; slug: string; type: string; status: 'Active' | 'Suspended' | 'Archived'; countryCode: string };
type AuditRow = { id: string; atUtc: string; action: string; actor: string | null; target: string | null; organization: string | null; details: string | null };
type Tab = 'users' | 'orgs' | 'requests' | 'audit';

const PAGE = 50;

/** Platform admin support console: find users, lock/unlock, temporary passwords, suspend schools, read the audit trail. */
@Component({
  selector: 'app-admin-console',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="page-title">{{ t('console.title') }}</h1>
          <a routerLink="/admin/marketplace" class="btn btn-ghost btn-sm">{{ t('console.toMarketplace') }}</a>
        </header>

        <div class="flex gap-2 overflow-x-auto" role="tablist">
          @for (x of tabs; track x.id) {
            <button type="button" role="tab" class="btn btn-sm" [class.btn-primary]="tab() === x.id" [class.btn-ghost]="tab() !== x.id"
                    [attr.aria-selected]="tab() === x.id" (click)="open(x.id)">{{ t(x.label) }}</button>
          }
        </div>

        @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
        @if (temp(); as r) {
          <div class="alert alert-warning" role="status">
            <p>{{ t('console.tempShown') }}</p>
            <p class="mt-1 font-mono text-lg font-bold" dir="ltr">{{ r.userName }} / {{ r.password }}</p>
            <button type="button" class="btn btn-ghost btn-sm mt-2" (click)="temp.set(null)">{{ t('action.close') }}</button>
          </div>
        }

        @switch (tab()) {
          @case ('users') {
            <form class="flex flex-wrap gap-2" (submit)="$event.preventDefault(); searchUsers()">
              <input class="input min-w-48 flex-1" type="search" [attr.aria-label]="t('console.searchUsers')" [placeholder]="t('console.searchUsers')"
                     [value]="query()" (input)="query.set($any($event.target).value)" />
              <button type="submit" class="btn btn-primary">{{ t('console.search') }}</button>
            </form>
            <section class="card">
              @for (u of users(); track u.id) {
                <div class="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <p class="font-bold break-words">{{ u.fullName || u.userName }} <span class="font-normal text-muted" dir="ltr">{{ u.userName }}</span></p>
                    <p class="text-sm text-muted break-all" dir="ltr">{{ [u.email, u.phone, u.organizations.join(', ')].filter(x => x).join(' · ') }}</p>
                  </div>
                  @if (u.locked) { <span class="badge badge-warning">{{ t('console.locked') }}</span> }
                  <div class="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button type="button" class="btn btn-ghost btn-sm" (click)="resetPassword(u)"><mat-icon svgIcon="key-round" class="icon-size-4" />{{ t('console.resetPassword') }}</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="toggleLock(u)">{{ u.locked ? t('console.unlock') : t('console.lock') }}</button>
                  </div>
                </div>
              } @empty {
                <p class="px-5 py-8 text-center text-muted">{{ t('console.noUsers') }}</p>
              }
            </section>
          }
          @case ('orgs') {
            <section class="card">
              @for (o of orgs(); track o.id) {
                <div class="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-bold">{{ o.name }}</p>
                    <p class="text-sm text-muted"><span dir="ltr">{{ o.slug }}</span> · {{ o.type }} · {{ o.countryCode }}</p>
                  </div>
                  <span class="badge" [class]="o.status === 'Active' ? 'badge-success' : 'badge-warning'">{{ t('console.status.' + o.status) }}</span>
                  @if (o.status !== 'Archived') {
                    <button type="button" class="btn btn-ghost btn-sm" (click)="toggleOrg(o)">{{ o.status === 'Active' ? t('console.suspend') : t('console.reactivate') }}</button>
                  }
                </div>
              }
            </section>
          }
          @case ('requests') {
            <section class="card">
              @for (r of requests(); track r.id) {
                <div class="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <p class="font-bold"><span dir="ltr">{{ r.userName }}</span> · {{ r.type === 'Export' ? t('legal.requestExportLabel') : t('legal.requestDeleteLabel') }}</p>
                    <p class="text-sm text-muted"><span dir="ltr">{{ formatTime(r.createdAtUtc) }}</span>@if (r.note) { · {{ r.note }} }</p>
                  </div>
                  @if (r.status === 'Open') {
                    <input class="input min-h-10 w-48 text-sm" [attr.aria-label]="t('legal.note')" [placeholder]="t('legal.note')" (input)="requestNote.set($any($event.target).value)" />
                    <button type="button" class="btn btn-primary btn-sm" (click)="handleRequest(r, true)">{{ t('legal.markDone') }}</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="handleRequest(r, false)">{{ t('legal.reject') }}</button>
                  } @else {
                    <span class="badge badge-neutral">{{ t('legal.request' + r.status) }}</span>
                  }
                </div>
              } @empty {
                <p class="px-5 py-8 text-center text-muted">{{ t('legal.noRequests') }}</p>
              }
            </section>
          }
          @case ('audit') {
            <form class="flex flex-wrap gap-2" (submit)="$event.preventDefault(); loadAudit(true)">
              <input class="input min-w-40 flex-1" dir="ltr" [attr.aria-label]="t('console.auditFilter')" [placeholder]="t('console.auditFilter')" [value]="auditAction()" (input)="auditAction.set($any($event.target).value)" />
              <input class="input min-w-40 flex-1" dir="ltr" [attr.aria-label]="t('console.auditUser')" [placeholder]="t('console.auditUser')" [value]="auditUser()" (input)="auditUser.set($any($event.target).value)" />
              <button type="submit" class="btn btn-primary">{{ t('console.search') }}</button>
            </form>
            <section class="card overflow-x-auto">
              <table class="table">
                <thead><tr><th>{{ t('console.colWhen') }}</th><th>{{ t('console.colAction') }}</th><th>{{ t('console.colActor') }}</th><th>{{ t('console.colTarget') }}</th><th>{{ t('console.colDetails') }}</th></tr></thead>
                <tbody>
                  @for (a of audit(); track a.id) {
                    <tr>
                      <td class="whitespace-nowrap tabular-nums" dir="ltr">{{ formatTime(a.atUtc) }}</td>
                      <td class="font-mono text-sm" dir="ltr">{{ a.action }}</td>
                      <td dir="ltr">{{ a.actor ?? '—' }}</td>
                      <td dir="ltr">{{ a.target ?? a.organization ?? '—' }}</td>
                      <td>{{ a.details }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="py-8 text-center text-muted">{{ t('console.auditEmpty') }}</td></tr>
                  }
                </tbody>
              </table>
            </section>
            @if (moreAudit()) { <button type="button" class="btn btn-secondary self-center" (click)="loadAudit(false)">{{ t('console.more') }}</button> }
          }
        }
      </div>
    </ng-container>
  `,
})
export default class AdminConsolePage {
  private http = inject(HttpClient);
  private legal = inject(LegalService);
  private transloco = inject(TranslocoService);
  private api = environment.apiUrl;

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'console.tabUsers' },
    { id: 'orgs', label: 'console.tabOrgs' },
    { id: 'requests', label: 'legal.requestsTab' },
    { id: 'audit', label: 'console.tabAudit' },
  ];
  protected tab = signal<Tab>('users');
  protected error = signal<string | null>(null);
  protected temp = signal<{ userName: string; password: string } | null>(null);

  protected query = signal('');
  protected users = signal<PlatformUser[]>([]);
  protected orgs = signal<PlatformOrg[]>([]);
  protected audit = signal<AuditRow[]>([]);
  protected requests = signal<DataRequest[]>([]);
  protected requestNote = signal('');
  protected auditAction = signal('');
  protected auditUser = signal('');
  protected moreAudit = signal(false);

  constructor() {
    this.searchUsers();
  }

  protected open(tab: Tab): void {
    this.tab.set(tab);
    this.error.set(null);
    if (tab === 'orgs') this.loadOrgs();
    if (tab === 'audit') this.loadAudit(true);
    if (tab === 'requests') this.loadRequests();
  }

  protected searchUsers(): void {
    this.get<PlatformUser[]>(`/platform/users?q=${encodeURIComponent(this.query().trim())}`).subscribe(r => this.users.set(r));
  }

  protected loadOrgs(): void {
    this.get<PlatformOrg[]>('/platform/organizations').subscribe(r => this.orgs.set(r));
  }

  protected loadAudit(reset: boolean): void {
    const skip = reset ? 0 : this.audit().length;
    const qs = `skip=${skip}&take=${PAGE}&action=${encodeURIComponent(this.auditAction().trim())}&user=${encodeURIComponent(this.auditUser().trim())}`;
    this.get<AuditRow[]>(`/platform/audit?${qs}`).subscribe(rows => {
      this.audit.set(reset ? rows : [...this.audit(), ...rows]);
      this.moreAudit.set(rows.length === PAGE);
    });
  }

  protected loadRequests(): void {
    this.legal.allRequests('').subscribe({ next: r => this.requests.set(r), error: (err: unknown) => this.error.set(errorMessages(err, 'Error').join(' ')) });
  }

  protected handleRequest(request: DataRequest, completed: boolean): void {
    const note = this.requestNote().trim() || null;
    this.requestNote.set('');
    this.legal.handle(request.id, completed, note).subscribe({ next: () => this.loadRequests(), error: (err: unknown) => this.error.set(errorMessages(err, 'Error').join(' ')) });
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected toggleLock(user: PlatformUser): void {
    const name = user.fullName || user.userName;
    if (!user.locked && !confirm(this.transloco.translate('console.confirmLock', { name }))) return;
    this.post(`/platform/users/${user.id}/${user.locked ? 'unlock' : 'lock'}`).subscribe(() => this.searchUsers());
  }

  protected resetPassword(user: PlatformUser): void {
    if (!confirm(this.transloco.translate('console.confirmReset', { name: user.fullName || user.userName }))) return;
    this.post<{ userName: string; temporaryPassword: string }>(`/platform/users/${user.id}/reset-password`)
      .subscribe(r => this.temp.set({ userName: r.userName, password: r.temporaryPassword }));
  }

  protected toggleOrg(org: PlatformOrg): void {
    const suspending = org.status === 'Active';
    if (suspending && !confirm(this.transloco.translate('console.confirmSuspend', { name: org.name }))) return;
    this.post(`/platform/organizations/${org.slug}/${suspending ? 'suspend' : 'reactivate'}`).subscribe(() => this.loadOrgs());
  }

  private get<T>(path: string) {
    this.error.set(null);
    return this.http.get<{ data: T }>(`${this.api}${path}`).pipe(map(r => r.data), this.fail<T>());
  }

  private post<T = unknown>(path: string) {
    this.error.set(null);
    return this.http.post<{ data: T }>(`${this.api}${path}`, {}).pipe(map(r => r.data), this.fail<T>());
  }

  private fail<T>() {
    return catchError<T, Observable<never>>((err: unknown) => {
      this.error.set(errorMessages(err, 'Error').join(' '));
      return EMPTY;
    });
  }
}
