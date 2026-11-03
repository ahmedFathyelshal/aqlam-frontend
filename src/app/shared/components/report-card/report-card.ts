import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

import { OrgDatePipe } from '@/app/core/organizations/org-date';
import { ReportCard } from '@/app/core/school/academics.service';

/** One student's report card for one term. Prints on a single clean page; language follows the app. */
@Component({
  selector: 'aq-report-card',
  imports: [MatIconModule, TranslocoDirective, OrgDatePipe],
  template: `
    <ng-container *transloco="let t">
      @let c = card();
      <div class="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        @if (!c.published) { <div class="alert alert-warning min-w-0 flex-1" role="status">{{ t('report.draft') }}</div> }
        <button type="button" class="btn btn-secondary ms-auto" (click)="print()"><mat-icon svgIcon="printer" class="icon-size-5" />{{ t('report.print') }}</button>
      </div>

      <article class="card card-body print:border-0 print:p-0 print:shadow-none">
        <header class="flex flex-wrap items-center gap-4 border-b-2 border-primary-600 pb-4">
          @if (c.logoUrl) { <img class="size-16 object-contain" [src]="c.logoUrl" alt="" /> }
          <div class="min-w-0 flex-1">
            <p class="text-lg font-extrabold">{{ c.organizationName }}</p>
            <h1 class="text-2xl font-extrabold text-primary-700">{{ t('report.title') }}</h1>
          </div>
          <div class="text-sm">
            <p class="font-bold">{{ c.termName }} · {{ c.yearName }}</p>
            <p class="text-muted">{{ t('report.period', { from: (c.termStart | orgDate: 'date' : calendar()), to: (c.termEnd | orgDate: 'date' : calendar()) }) }}</p>
          </div>
        </header>

        <dl class="mt-4 grid gap-3 sm:grid-cols-2">
          <div><dt class="text-sm text-muted">{{ t('report.student') }}</dt><dd class="text-lg font-extrabold">{{ c.studentName }}</dd></div>
          @if (c.classes.length) {
            <div><dt class="text-sm text-muted">{{ t('report.class') }}</dt><dd class="text-lg font-bold">{{ c.classes.join('، ') }}</dd></div>
          }
        </dl>

        @if (c.subjects.length) {
          <div class="mt-5 overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ t('report.subject') }}</th>
                  <th class="w-20 text-center">{{ t('report.percent') }}</th>
                  @if (c.scale !== 'Percent') { <th class="w-28 text-center">{{ t('report.grade') }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (s of c.subjects; track $index) {
                  <tr>
                    <td>
                      <p class="font-bold">{{ s.subjectName }}</p>
                      @if (s.teacherName) { <p class="text-sm text-muted">{{ t('report.teacher') }}: {{ s.teacherName }}</p> }
                      <p class="mt-0.5 text-xs text-muted">
                        @for (g of s.categories; track $index; let last = $last) {
                          {{ g.name }}: <span dir="ltr">{{ g.percent === null ? '–' : g.percent + '%' }}</span>@if (!last) { <span aria-hidden="true"> · </span> }
                        }
                      </p>
                    </td>
                    <td class="text-center font-extrabold text-primary-700" dir="ltr">{{ s.finalPercent ?? '–' }}</td>
                    @if (c.scale !== 'Percent') { <td class="whitespace-nowrap text-center font-bold">{{ s.label ? t('grade.' + s.label) : '–' }}</td> }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-primary-100 px-4 py-3 text-primary-700">
            <span class="font-extrabold">{{ t('report.overall') }}</span>
            <span class="text-xl font-extrabold">
              <span dir="ltr">{{ c.overallPercent === null ? '–' : c.overallPercent + '%' }}</span>
              @if (c.overallLabel) { · {{ t('grade.' + c.overallLabel) }} }
            </span>
          </div>
        } @else {
          <p class="empty mt-5">{{ t('report.empty') }}</p>
        }

        <h2 class="section-title mt-6 mb-2">{{ t('report.attendance') }}</h2>
        <div class="grid grid-cols-4 gap-2 text-center">
          <div class="rounded-[4px] bg-primary-100 py-2"><div class="text-2xl font-extrabold text-primary-700">{{ c.attendance.present }}</div><div class="text-xs text-primary-700">{{ t('attendance.Present') }}</div></div>
          <div class="rounded-[4px] bg-danger-50 py-2"><div class="text-2xl font-extrabold text-danger-700">{{ c.attendance.absent }}</div><div class="text-xs text-danger-700">{{ t('attendance.Absent') }}</div></div>
          <div class="rounded-[4px] bg-warning-50 py-2"><div class="text-2xl font-extrabold text-warning-700">{{ c.attendance.late }}</div><div class="text-xs text-warning-700">{{ t('attendance.Late') }}</div></div>
          <div class="rounded-[4px] bg-secondary-100 py-2"><div class="text-2xl font-extrabold text-secondary-600">{{ c.attendance.excused }}</div><div class="text-xs text-secondary-600">{{ t('attendance.Excused') }}</div></div>
        </div>
      </article>
    </ng-container>
  `,
})
export class AqReportCard {
  readonly card = input.required<ReportCard>();
  readonly calendar = input<'Gregorian' | 'Hijri' | 'Both'>('Gregorian');

  protected print(): void {
    window.print();
  }
}
