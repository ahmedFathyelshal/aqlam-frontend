import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

import { FeaturedTeacher } from '@/app/core/marketplace/marketplace.service';
import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { AdminTeacher, Fees, TeacherBusinessService } from '@/app/core/marketplace/teacher-business.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** Platform admin: the teachers picked by أقلام (story 3.5.4) and the fee rates (3.6.1), which have no defaults. */
@Component({
  selector: 'app-admin-marketplace',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <h1 class="page-title">{{ t('picksAdmin.title') }}</h1>

        <section class="card card-body flex flex-col gap-4" aria-labelledby="picks-h">
          <div>
            <h2 id="picks-h" class="section-title">{{ t('picksAdmin.picks') }}</h2>
            <p class="field-hint">{{ t('picksAdmin.picksLead') }}</p>
          </div>
          <form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_6rem_auto] sm:items-end" (submit)="$event.preventDefault(); add()">
            <label class="field">
              <span class="field-label">{{ t('picksAdmin.teacher') }}</span>
              <input class="input" list="listed-teachers" [placeholder]="t('picksAdmin.searchTeacher')" [value]="slug()" (input)="onSearch($any($event.target).value)" />
              <datalist id="listed-teachers">
                @for (x of found(); track x.slug) { <option [value]="x.slug">{{ x.name }} ({{ x.countryCode }})</option> }
              </datalist>
            </label>
            <label class="field">
              <span class="field-label">{{ t('picksAdmin.subject') }}</span>
              <select class="select" (change)="subjectId.set($any($event.target).value ? +$any($event.target).value : null)">
                <option value="">{{ t('picksAdmin.general') }}</option>
                @for (s of names.subjects(); track s.id) { <option [value]="s.id">{{ names.subject(s.id) }}</option> }
              </select>
            </label>
            <label class="field">
              <span class="field-label">{{ t('picksAdmin.order') }}</span>
              <input class="input" type="number" min="0" max="1000" dir="ltr" [value]="order()" (input)="order.set(+$any($event.target).value)" />
            </label>
            <button type="submit" class="btn btn-primary" [disabled]="!slug().trim()">{{ t('picksAdmin.add') }}</button>
          </form>
          @if (pickError()) { <p class="field-error" role="alert">{{ pickError() }}</p> }
          @if (picks().length) {
            <ul class="divide-y divide-line-soft rounded-ui border border-line">
              @for (p of picks(); track p.id) {
                <li class="flex min-h-12 items-center gap-3 px-4">
                  <span class="grow font-semibold">{{ p.teacher.name }} <span class="text-sm font-normal text-muted" dir="ltr">/t/{{ p.teacher.slug }}</span></span>
                  <span class="badge badge-neutral">{{ p.subjectId ? names.subject(p.subjectId) : t('picksAdmin.general') }}</span>
                  <span class="text-sm text-muted tabular-nums">{{ p.order }}</span>
                  <button type="button" class="btn btn-ghost btn-sm text-danger-700" (click)="remove(p)">{{ t('picksAdmin.remove') }}</button>
                </li>
              }
            </ul>
          } @else {
            <p class="text-muted">{{ t('picksAdmin.none') }}</p>
          }
        </section>

        <section class="card card-body flex flex-col gap-4" aria-labelledby="fees-h">
          <div>
            <h2 id="fees-h" class="section-title">{{ t('picksAdmin.fees') }}</h2>
            <p class="field-hint">{{ t('picksAdmin.feesLead') }}</p>
          </div>
          <form class="grid gap-3 sm:grid-cols-3" (submit)="$event.preventDefault(); saveFees()">
            <label class="field"><span class="field-label">{{ t('picksAdmin.commission') }}</span>
              <input class="input" type="number" min="0" max="100" step="0.01" dir="ltr" [value]="fees().commissionPercent ?? ''" (input)="setFee('commissionPercent', $any($event.target).value)" /></label>
            <label class="field"><span class="field-label">{{ t('picksAdmin.feeSar') }}</span>
              <input class="input" type="number" min="0" step="0.01" dir="ltr" [value]="fees().monthlyStudentFeeSar ?? ''" (input)="setFee('monthlyStudentFeeSar', $any($event.target).value)" /></label>
            <label class="field"><span class="field-label">{{ t('picksAdmin.feeEgp') }}</span>
              <input class="input" type="number" min="0" step="0.01" dir="ltr" [value]="fees().monthlyStudentFeeEgp ?? ''" (input)="setFee('monthlyStudentFeeEgp', $any($event.target).value)" /></label>
            <div class="flex items-center gap-3 sm:col-span-3">
              <button type="submit" class="btn btn-primary">{{ t('picksAdmin.save') }}</button>
              @if (feesSaved()) { <span class="text-sm font-bold text-primary-700">{{ t('picksAdmin.saved') }}</span> }
            </div>
          </form>
        </section>
      </div>
    </ng-container>
  `,
})
export default class AdminMarketplacePage {
  private api = inject(TeacherBusinessService);
  protected names = inject(LookupNames);

  protected picks = signal<FeaturedTeacher[]>([]);
  protected found = signal<AdminTeacher[]>([]);
  protected slug = signal('');
  protected subjectId = signal<number | null>(null);
  protected order = signal(1);
  protected pickError = signal<string | null>(null);
  protected fees = signal<Fees>({ commissionPercent: null, monthlyStudentFeeSar: null, monthlyStudentFeeEgp: null });
  protected feesSaved = signal(false);

  constructor() {
    this.names.load();
    this.loadPicks();
    this.api.fees().subscribe(f => this.fees.set(f));
    this.api.listedTeachers('').subscribe(list => this.found.set(list));
  }

  protected onSearch(value: string): void {
    this.slug.set(value);
    this.api.listedTeachers(value).subscribe(list => this.found.set(list));
  }

  protected add(): void {
    this.pickError.set(null);
    this.api.feature(this.slug().trim(), this.subjectId(), this.order()).subscribe({
      next: () => (this.slug.set(''), this.loadPicks()),
      error: err => this.pickError.set(errorMessages(err, 'Error').join(' ')),
    });
  }

  protected remove(p: FeaturedTeacher): void {
    this.api.unfeature(p.id).subscribe(() => this.loadPicks());
  }

  protected setFee(key: keyof Fees, value: string): void {
    this.feesSaved.set(false);
    this.fees.update(f => ({ ...f, [key]: value === '' ? null : Number(value) }));
  }

  protected saveFees(): void {
    this.api.saveFees(this.fees()).subscribe(f => (this.fees.set(f), this.feesSaved.set(true)));
  }

  private loadPicks(): void {
    this.api.featuredPicks().subscribe(list => this.picks.set(list));
  }
}
