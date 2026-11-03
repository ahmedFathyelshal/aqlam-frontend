import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgDatePipe } from '@/app/core/organizations/org-date';
import { AcademicsService, AcademicTerm, AcademicTermInput, AcademicYear, AcademicYearInput } from '@/app/core/school/academics.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** Academic years and their terms; publishing a term's report cards shows them to students and parents. */
@Component({
  selector: 'app-academic-years',
  imports: [MatIconModule, RouterLink, TranslocoDirective, OrgDatePipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('years.title') }}</h1>
            <p class="page-subtitle">{{ t('years.subtitle') }}</p>
          </div>
          @if (canManage() && !form()) {
            <button type="button" class="btn btn-primary w-full sm:w-auto" (click)="startNew()"><mat-icon svgIcon="plus" class="icon-size-5" />{{ t('years.add') }}</button>
          }
        </header>

        @if (error()) { <div class="alert alert-danger mb-4" role="alert">{{ error() }}</div> }

        @if (form(); as f) {
          <section class="card card-body mb-5 flex flex-col gap-4">
            <div class="grid gap-4 sm:grid-cols-3">
              <label class="field">
                <span class="field-label">{{ t('years.name') }}</span>
                <input class="input" maxlength="100" [placeholder]="t('years.namePlaceholder')" [value]="f.name" (input)="patch({ name: $any($event.target).value })" />
              </label>
              <label class="field">
                <span class="field-label">{{ t('years.start') }}</span>
                <input class="input" type="date" [value]="f.startDate" (input)="patch({ startDate: $any($event.target).value })" />
              </label>
              <label class="field">
                <span class="field-label">{{ t('years.end') }}</span>
                <input class="input" type="date" [value]="f.endDate" (input)="patch({ endDate: $any($event.target).value })" />
              </label>
            </div>

            <fieldset class="flex flex-col gap-3">
              <legend class="field-label mb-2">{{ t('years.terms') }}</legend>
              @for (term of f.terms; track $index; let i = $index) {
                <div class="grid items-end gap-3 rounded-[6px] border border-line-soft p-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
                  <label class="field">
                    <span class="field-label">{{ t('years.termName') }}</span>
                    <input class="input" maxlength="100" [value]="term.name" (input)="patchTerm(i, { name: $any($event.target).value })" />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('years.start') }}</span>
                    <input class="input" type="date" [value]="term.startDate" (input)="patchTerm(i, { startDate: $any($event.target).value })" />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('years.end') }}</span>
                    <input class="input" type="date" [value]="term.endDate" (input)="patchTerm(i, { endDate: $any($event.target).value })" />
                  </label>
                  <button type="button" class="btn-icon justify-self-end" [attr.aria-label]="t('years.removeTerm')" [disabled]="f.terms.length === 1" (click)="removeTerm(i)"><mat-icon svgIcon="trash-2" class="icon-size-5" /></button>
                </div>
              }
              <button type="button" class="btn btn-ghost btn-sm self-start" (click)="addTerm()"><mat-icon svgIcon="plus" class="icon-size-4" />{{ t('years.addTerm') }}</button>
            </fieldset>

            @if (formErrors().length) {
              <div class="alert alert-danger" role="alert"><ul class="list-inside list-disc">@for (e of formErrors(); track $index) { <li>{{ e }}</li> }</ul></div>
            }
            <div class="flex flex-wrap justify-end gap-2">
              <button type="button" class="btn btn-ghost" (click)="cancel()">{{ t('action.cancel') }}</button>
              <button type="button" class="btn btn-primary" [disabled]="!canSave() || saving()" (click)="save()">{{ t('action.save') }}</button>
            </div>
          </section>
        }

        @if (years(); as list) {
          <div class="flex flex-col gap-4">
            @for (y of list; track y.id) {
              <section class="card">
                <div class="card-header flex-wrap gap-2">
                  <div class="min-w-0 flex-1">
                    <h2 class="section-title">
                      {{ y.name }}
                      @if (y.isCurrent) { <span class="badge badge-success ms-1 align-middle">{{ t('years.current') }}</span> }
                    </h2>
                    <p class="text-sm text-muted">{{ t('report.period', { from: (y.startDate | orgDate: 'date' : calendar()), to: (y.endDate | orgDate: 'date' : calendar()) }) }}</p>
                  </div>
                  @if (canManage()) {
                    <div class="flex flex-wrap gap-1">
                      @if (!y.isCurrent) {
                        <button type="button" class="btn btn-ghost btn-sm" (click)="setCurrent(y)">{{ t('years.setCurrent') }}</button>
                      }
                      <button type="button" class="btn-icon" [attr.aria-label]="t('action.edit')" (click)="startEdit(y)"><mat-icon svgIcon="pencil" class="icon-size-5" /></button>
                      <button type="button" class="btn-icon" [attr.aria-label]="t('action.delete')" (click)="remove(y)"><mat-icon svgIcon="trash-2" class="icon-size-5" /></button>
                    </div>
                  }
                </div>
                @for (term of y.terms; track term.id) {
                  <div class="list-row flex-wrap">
                    <div class="min-w-0 flex-1">
                      <p class="font-bold">{{ term.name }}</p>
                      <p class="text-sm text-muted">{{ t('report.period', { from: (term.startDate | orgDate: 'date' : calendar()), to: (term.endDate | orgDate: 'date' : calendar()) }) }}</p>
                    </div>
                    <span class="badge" [class]="term.reportCardsPublished ? 'badge-success' : 'badge-neutral'">{{ term.reportCardsPublished ? t('years.published') : t('years.notPublished') }}</span>
                    @if (canManage()) {
                      <button type="button" class="btn btn-sm w-full sm:w-auto" [class]="term.reportCardsPublished ? 'btn-ghost' : 'btn-secondary'" (click)="togglePublish(term)">
                        {{ term.reportCardsPublished ? t('years.unpublish') : t('years.publish') }}
                      </button>
                    }
                  </div>
                }
              </section>
            } @empty {
              @if (!form()) { <div class="empty">{{ t('years.empty') }}</div> }
            }
          </div>
          @if (list.length && canManage()) {
            <p class="field-hint mt-4">{{ t('years.gradingHint') }} <a [routerLink]="orgContext.path('settings')">{{ t('nav.settings') }}</a></p>
          }
        } @else {
          <p class="py-8 text-center text-muted">{{ t('loading') }}</p>
        }
      </div>
    </ng-container>
  `,
})
export default class AcademicYearsComponent {
  protected orgContext = inject(OrgContextService);
  private academics = inject(AcademicsService);
  private transloco = inject(TranslocoService);

  protected years = signal<AcademicYear[] | null>(null);
  protected form = signal<AcademicYearInput | null>(null);
  private editingId = signal<string | null>(null);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected formErrors = signal<string[]>([]);

  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected calendar = computed(() => this.orgContext.activeOrg()?.calendar ?? 'Gregorian');
  protected canSave = computed(() => {
    const f = this.form();
    return !!f && !!f.name.trim() && !!f.startDate && !!f.endDate && f.terms.every(t => !!t.name.trim() && !!t.startDate && !!t.endDate);
  });

  constructor() {
    this.load();
  }

  protected startNew(): void {
    this.formErrors.set([]);
    this.editingId.set(null);
    // Saudi schools run two semesters; a third is one click away.
    this.form.set({
      name: '', startDate: '', endDate: '',
      terms: [this.blankTerm(this.transloco.translate('years.termOne')), this.blankTerm(this.transloco.translate('years.termTwo'))],
    });
  }

  protected startEdit(year: AcademicYear): void {
    this.formErrors.set([]);
    this.editingId.set(year.id);
    this.form.set({
      name: year.name, startDate: year.startDate, endDate: year.endDate,
      terms: year.terms.map(t => ({ id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate })),
    });
  }

  protected cancel(): void {
    this.form.set(null);
  }

  protected patch(changes: Partial<AcademicYearInput>): void {
    this.form.update(f => (f ? { ...f, ...changes } : f));
  }

  protected patchTerm(index: number, changes: Partial<AcademicTermInput>): void {
    this.form.update(f => (f ? { ...f, terms: f.terms.map((t, i) => (i === index ? { ...t, ...changes } : t)) } : f));
  }

  protected addTerm(): void {
    this.form.update(f => (f ? { ...f, terms: [...f.terms, this.blankTerm('')] } : f));
  }

  protected removeTerm(index: number): void {
    this.form.update(f => (f ? { ...f, terms: f.terms.filter((_, i) => i !== index) } : f));
  }

  protected save(): void {
    const f = this.form();
    if (!f) return;
    this.saving.set(true);
    this.formErrors.set([]);
    this.academics.saveYear(this.org, this.editingId(), { ...f, name: f.name.trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.set(null);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(errorMessages(err, this.transloco.translate('error.generic')));
      },
    });
  }

  protected setCurrent(year: AcademicYear): void {
    this.academics.setCurrent(this.org, year.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  protected togglePublish(term: AcademicTerm): void {
    const publish = !term.reportCardsPublished;
    if (publish && !confirm(this.transloco.translate('years.confirmPublish', { term: term.name }))) return;
    this.academics.setPublished(this.org, term.id, publish).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  protected remove(year: AcademicYear): void {
    if (!confirm(this.transloco.translate('years.confirmDelete', { name: year.name }))) return;
    this.academics.deleteYear(this.org, year.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  private blankTerm(name: string): AcademicTermInput {
    return { id: null, name, startDate: '', endDate: '' };
  }

  private load(): void {
    this.error.set(null);
    this.academics.years(this.org).subscribe({ next: y => this.years.set(y), error: err => this.fail(err) });
  }

  private fail(err: unknown): void {
    this.error.set(errorMessages(err, this.transloco.translate('error.generic')).join(' '));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
