import { HttpClient } from '@angular/common/http';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { pluralKey } from '@/app/core/transloco/plural';

import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { formatCode } from '@/app/core/marketplace/marketplace.service';
import { CodeBatch, CodeLookup, TeacherBusinessService } from '@/app/core/marketplace/teacher-business.service';
import { ApiResponse } from '@/app/core/models/api-response.model';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ConfirmService } from '@/app/shared/ui/confirm.service';

/**
 * Activation codes of one course (stories 3.1.2, 3.1.3): make a batch for a center desk or bookshop, see the codes
 * once (they are stored hashed), follow how many were used, stop a batch, and check a single card.
 */
@Component({
  selector: 'app-course-codes',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8 print:hidden">
        <a class="back-link" [routerLink]="orgContext.path('courses', courseId, 'edit')"><mat-icon svgIcon="arrow-right" class="icon-size-4 ltr:-scale-x-100" />{{ title() }}</a>
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('codesAdmin.title') }}</h1>
            <p class="page-subtitle">{{ t('codesAdmin.lead') }}</p>
          </div>
          <button type="button" class="btn btn-primary" (click)="openCreate()"><mat-icon svgIcon="plus" class="icon-size-4" />{{ t('codesAdmin.create') }}</button>
        </header>

        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="batches-title">
            <h2 id="batches-title" class="section-title mb-3">{{ t('codesAdmin.batches') }}</h2>
            @if (batches(); as list) {
              @if (list.length) {
                <ul class="flex flex-col gap-3">
                  @for (b of list; track b.id) {
                    <li class="card card-body flex flex-col gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="grow font-bold">{{ b.name }}</span>
                        <span class="badge" [class]="statusClass(b)">{{ t('codesAdmin.status.' + status(b)) }}</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <div class="progress grow" role="progressbar" [attr.aria-valuenow]="b.redeemed" aria-valuemin="0" [attr.aria-valuemax]="b.quantity"><span [style.width.%]="(100 * b.redeemed) / b.quantity"></span></div>
                        <span class="text-sm tabular-nums">{{ t('codesAdmin.used', { used: b.redeemed, total: b.quantity }) }}</span>
                      </div>
                      <p class="text-sm text-muted">{{ t('codesAdmin.created', { date: day(b.createdAtUtc) }) }}@if (b.expiresAtUtc) { · {{ t('codesAdmin.expiresOn', { date: day(b.expiresAtUtc) }) }} }</p>
                      @if (status(b) === 'active') {
                        <button type="button" class="btn btn-ghost btn-sm self-start text-danger-700" (click)="cancel(b)">{{ t('codesAdmin.cancelBatch') }}</button>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <div class="empty card"><mat-icon svgIcon="key-round" class="empty-icon" /><p>{{ t('codesAdmin.none') }}</p></div>
              }
            } @else {
              <div class="skeleton h-28 w-full" aria-hidden="true"></div>
            }
          </section>

          <section class="card card-body flex flex-col gap-3" aria-labelledby="lookup-title">
            <h2 id="lookup-title" class="section-title">{{ t('codesAdmin.lookup') }}</h2>
            <p class="field-hint">{{ t('codesAdmin.lookupHint') }}</p>
            <form class="flex gap-2" (submit)="$event.preventDefault(); lookup()">
              <input dir="ltr" class="input grow font-mono tracking-[0.1em] uppercase" maxlength="16" autocomplete="off" placeholder="XXXX-XXXX-XXXX" [attr.aria-label]="t('codesAdmin.lookup')"
                     [value]="lookupCode()" (input)="lookupCode.set(format($any($event.target)))" />
              <button type="submit" class="btn btn-outline" [disabled]="lookupCode().length < 14">{{ t('codesAdmin.lookupButton') }}</button>
            </form>
            @if (lookupResult(); as r) {
              <div class="rounded-ui border border-line bg-page p-3 text-sm" aria-live="polite">
                <p class="font-bold">{{ t('codesAdmin.lookupStatus.' + r.status) }} · {{ r.batchName }}</p>
                @if (r.redeemedByUserName) { <p class="mt-1">{{ t('codesAdmin.usedBy', { user: r.redeemedByUserName, date: day(r.redeemedAtUtc!) }) }}</p> }
              </div>
            } @else if (lookupMissing()) {
              <p class="field-error" role="alert">{{ t('codesAdmin.notFound') }}</p>
            }
          </section>
        </div>
      </div>

      <!-- Create, then show the codes once -->
      <dialog #codesDialog class="m-auto w-[calc(100vw-2rem)] max-w-xl rounded-hero bg-white p-0 backdrop:bg-ink/50 print:hidden" (cancel)="onCancelKey($event)" aria-labelledby="codes-dialog-title">
        @if (!created()) {
          <form class="flex flex-col gap-4 p-5" (submit)="$event.preventDefault(); create()">
            <h2 id="codes-dialog-title" class="text-lg font-bold">{{ t('codesAdmin.create') }}</h2>
            <label class="field">
              <span class="field-label">{{ t('codesAdmin.name') }}</span>
              <input class="input" maxlength="120" required [placeholder]="t('codesAdmin.namePlaceholder')" [value]="name()" (input)="name.set($any($event.target).value)" />
            </label>
            <label class="field">
              <span class="field-label">{{ t('codesAdmin.quantity') }}</span>
              <input class="input w-40" type="number" dir="ltr" min="1" max="1000" [value]="quantity()" (input)="quantity.set(+$any($event.target).value)" />
              <span class="field-hint">{{ t('codesAdmin.quantityHint') }}</span>
            </label>
            <label class="field">
              <span class="field-label">{{ t('codesAdmin.expires') }}</span>
              <input class="input w-52" type="date" dir="ltr" [value]="expires()" (input)="expires.set($any($event.target).value)" />
              <span class="field-hint">{{ t('codesAdmin.noExpiry') }}</span>
            </label>
            <p class="alert alert-info text-sm">{{ t('codesAdmin.onceInfo') }}</p>
            @if (errors().length) { <p class="field-error" role="alert">{{ errors().join(' ') }}</p> }
            <div class="flex justify-end gap-2">
              <button type="button" class="btn btn-ghost" (click)="closeDialog()">{{ t('codesAdmin.cancel') }}</button>
              <button type="submit" class="btn btn-primary" [disabled]="busy() || !name().trim() || quantity() < 1 || quantity() > 1000">{{ t(plural('codesAdmin.createN', quantity()), { count: quantity() }) }}</button>
            </div>
          </form>
        } @else {
          <div class="flex flex-col gap-4 p-5">
            <h2 id="codes-dialog-title" class="text-lg font-bold">{{ created()!.name }}</h2>
            <p class="alert alert-warning flex items-center gap-2"><mat-icon svgIcon="triangle-alert" class="icon-size-5" />{{ t('codesAdmin.lastTime') }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary" (click)="copyAll()"><mat-icon svgIcon="copy" class="icon-size-4" />{{ copiedAll() ? t('codesAdmin.copiedAll') : t('codesAdmin.copyAll') }}</button>
              <button type="button" class="btn btn-outline" (click)="download()"><mat-icon svgIcon="download" class="icon-size-4" />{{ t('codesAdmin.download') }}</button>
              <button type="button" class="btn btn-outline" (click)="print()"><mat-icon svgIcon="printer" class="icon-size-4" />{{ t('codesAdmin.print') }}</button>
            </div>
            <ul class="grid max-h-[45dvh] grid-cols-1 gap-2 overflow-y-auto rounded-ui border border-line bg-page p-3 sm:grid-cols-2">
              @for (c of codes(); track c) {
                <li dir="ltr" class="flex min-h-11 items-center rounded-chip border border-line bg-white px-3 font-mono text-[0.95rem] tracking-[0.12em]">{{ c }}</li>
              }
            </ul>
            <div class="flex flex-wrap justify-end gap-2">
              <button type="button" class="btn btn-ghost text-danger-700" (click)="closeUnsaved()">{{ t('codesAdmin.closeUnsaved') }}</button>
              <button type="button" class="btn btn-primary" [disabled]="!kept()" (click)="closeCreated()">{{ t('codesAdmin.done') }}</button>
            </div>
          </div>
        }
      </dialog>

      <!-- Print: cut sheets of the codes just made -->
      @if (created()) {
        <div class="hidden print:block">
          <div class="grid grid-cols-3 gap-0">
            @for (c of codes(); track c) {
              <div class="flex h-[34mm] flex-col justify-center border border-dashed border-black p-3 text-black">
                <p class="text-[10pt]">{{ title() }}</p>
                <p dir="ltr" class="font-mono text-[14pt] font-bold tracking-[0.12em]">{{ c }}</p>
                <p class="text-[8pt]">{{ t('codesAdmin.printFooter') }}</p>
              </div>
            }
          </div>
        </div>
      }
    </ng-container>
  `,
})
export default class CourseCodesComponent {
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  private api = inject(TeacherBusinessService);
  private http = inject(HttpClient);
  private confirmService = inject(ConfirmService);
  private transloco = inject(TranslocoService);
  protected orgContext = inject(OrgContextService);
  protected dialog = viewChild.required<ElementRef<HTMLDialogElement>>('codesDialog');

  protected courseId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected title = signal('');
  protected batches = signal<CodeBatch[] | null>(null);

  protected name = signal('');
  protected quantity = signal(50);
  protected expires = signal('');
  protected busy = signal(false);
  protected errors = signal<string[]>([]);
  protected created = signal<CodeBatch | null>(null);
  protected codes = signal<string[]>([]);
  /** The close button waits until the codes were copied, downloaded or printed. */
  protected kept = signal(false);
  protected copiedAll = signal(false);

  protected lookupCode = signal('');
  protected lookupResult = signal<CodeLookup | null>(null);
  protected lookupMissing = signal(false);

  private org = computed(() => this.orgContext.activeOrg()?.slug ?? '');

  constructor() {
    this.http
      .get<ApiResponse<{ title: string }>>(ApiEndpoints.TeacherCourses.GetDraft(this.org(), this.courseId))
      .pipe(map(r => r.data.title))
      .subscribe(title => this.title.set(title));
    this.load();
  }

  protected format(input: HTMLInputElement): string {
    const value = formatCode(input.value);
    input.value = value;
    return value;
  }

  protected status(b: CodeBatch): 'active' | 'cancelled' | 'expired' | 'full' {
    if (b.cancelledAtUtc) return 'cancelled';
    if (b.expiresAtUtc && new Date(b.expiresAtUtc) <= new Date()) return 'expired';
    if (b.redeemed >= b.quantity) return 'full';
    return 'active';
  }

  protected statusClass(b: CodeBatch): string {
    return { active: 'badge-success', cancelled: 'badge-neutral', expired: 'badge-danger', full: 'badge-neutral' }[this.status(b)];
  }

  protected day(iso: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  protected closeDialog(): void {
    this.dialog().nativeElement.close();
  }

  protected openCreate(): void {
    this.created.set(null);
    this.errors.set([]);
    this.name.set('');
    this.dialog().nativeElement.showModal();
  }

  protected create(): void {
    this.busy.set(true);
    this.errors.set([]);
    // The end of the chosen day, organization-agnostic: the code works through that whole date.
    const expiresAtUtc = this.expires() ? new Date(`${this.expires()}T23:59:59`).toISOString() : null;
    this.api.createBatch(this.org(), this.courseId, { name: this.name().trim(), quantity: this.quantity(), expiresAtUtc }).subscribe({
      next: r => {
        this.busy.set(false);
        this.created.set(r.batch);
        this.codes.set(r.codes);
        this.kept.set(false);
        this.load();
      },
      error: err => (this.busy.set(false), this.errors.set(errorMessages(err, 'Error'))),
    });
  }

  protected copyAll(): void {
    navigator.clipboard?.writeText(this.codes().join('\n')).then(() => {
      this.kept.set(true);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    });
  }

  /** CSV with a byte-order mark so Excel opens the Arabic batch name correctly. */
  protected download(): void {
    const rows = [this.transloco.translate('codesAdmin.csvHeader'), ...this.codes()];
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(this.created()?.name ?? 'codes').replace(/[\\/:*?"<>|]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.kept.set(true);
  }

  protected print(): void {
    this.dialog().nativeElement.close();
    setTimeout(() => {
      window.print();
      this.kept.set(true);
      this.dialog().nativeElement.showModal();
    });
  }

  protected onCancelKey(event: Event): void {
    // Esc must not throw the codes away silently.
    if (this.created() && !this.kept()) event.preventDefault();
  }

  protected async closeUnsaved(): Promise<void> {
    const t = (k: string) => this.transloco.translate(k);
    // The confirm box is an overlay: it would sit under the modal dialog, so the dialog steps aside first.
    this.dialog().nativeElement.close();
    const ok = await this.confirmService.confirm({ title: t('codesAdmin.closeUnsaved'), body: t('codesAdmin.closeUnsavedConfirm'), confirmText: t('codesAdmin.closeUnsaved'), cancelText: t('codesAdmin.cancel'), tone: 'danger' });
    if (ok) this.closeCreated();
    else this.dialog().nativeElement.showModal();
  }

  protected closeCreated(): void {
    this.dialog().nativeElement.close();
    this.created.set(null);
    this.codes.set([]);
  }

  protected async cancel(b: CodeBatch): Promise<void> {
    const t = (k: string) => this.transloco.translate(k);
    const ok = await this.confirmService.confirm({ title: t('codesAdmin.cancelBatch'), body: t('codesAdmin.cancelConfirm'), confirmText: t('codesAdmin.cancelBatch'), cancelText: t('codesAdmin.cancel'), tone: 'danger' });
    if (!ok) return;
    this.api.cancelBatch(this.org(), this.courseId, b.id).subscribe(() => this.load());
  }

  protected lookup(): void {
    this.lookupResult.set(null);
    this.lookupMissing.set(false);
    this.api.lookup(this.org(), this.courseId, this.lookupCode()).subscribe({
      next: r => this.lookupResult.set(r),
      error: () => this.lookupMissing.set(true),
    });
  }

  private load(): void {
    this.api.batches(this.org(), this.courseId).subscribe(list => this.batches.set(list));
  }
}
