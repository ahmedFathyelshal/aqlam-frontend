import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, OrgDatePipe, todayIn } from '@/app/core/organizations/org-date';
import { saveBlob } from '@/app/core/school/academics.service';
import { AttendanceOutbox, isOfflineError } from '@/app/core/school/attendance-outbox';
import { AttendanceLine, AttendanceStatus, AttendanceSummaryRow, ClassSummary, SchoolService } from '@/app/core/school/school.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { WEEK_DAYS } from '../classes/class-form';

type Row = AttendanceLine & { status: AttendanceStatus };

/** Present is the default and stays quiet; the exceptions are tinted so they can be scanned. */
const STATUSES: { value: AttendanceStatus; on: string; tile: string; row: string }[] = [
  { value: 'Present', on: 'border-primary-600 bg-primary-600 text-white', tile: 'bg-primary-100 text-primary-700', row: '' },
  { value: 'Absent', on: 'border-danger-600 bg-danger-50 text-danger-700 ring-1 ring-danger-600', tile: 'bg-danger-50 text-danger-700', row: 'bg-danger-50/50 before:bg-danger-600' },
  { value: 'Late', on: 'border-warning-500 bg-warning-50 text-warning-700 ring-1 ring-warning-500', tile: 'bg-warning-50 text-warning-700', row: 'bg-warning-50/60 before:bg-warning-500' },
  { value: 'Excused', on: 'border-secondary-600 bg-secondary-100 text-secondary-700 ring-1 ring-secondary-600', tile: 'bg-secondary-100 text-secondary-700', row: 'bg-secondary-50 before:bg-secondary-600' },
];
/** A 3px stroke on the start edge of an exception row. */
const ROW_STROKE = 'before:absolute before:inset-y-0 before:start-0 before:w-[3px]';

/**
 * Phone-first attendance: everyone starts as present, the teacher taps the exceptions and saves.
 * Without a connection the sheet is kept on the device and sent later.
 */
@Component({
  selector: 'app-attendance',
  imports: [MatIconModule, RouterLink, TranslocoDirective, OrgDatePipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow pb-40">
        <a class="back-link" [routerLink]="orgContext.path('classes', classId)"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ className() }}</a>
        <header class="mb-4">
          <h1 class="page-title-tool">{{ t('att.title') }} · {{ className() }}</h1>
          <p class="page-subtitle">{{ date() | orgDate }}</p>
        </header>

        @if (outbox.pending().length) {
          <div class="alert alert-warning mb-4" role="status">
            <mat-icon svgIcon="wifi-off" class="icon-size-5 shrink-0" />
            <span class="flex-1">{{ t('att.pending', { count: outbox.pending().length }) }}</span>
            <button type="button" class="btn btn-secondary btn-sm" (click)="retry()">{{ t('att.sendNow') }}</button>
          </div>
        }

        <div class="segmented mb-4" role="tablist">
          <button type="button" role="tab" class="segment" [attr.aria-selected]="tab() === 'mark'" (click)="tab.set('mark')">{{ t('att.tabMark') }}</button>
          <button type="button" role="tab" class="segment" [attr.aria-selected]="tab() === 'history'" (click)="openHistory()">{{ t('att.tabHistory') }}</button>
        </div>

        @if (tab() === 'mark') {
          <div class="mb-3 flex flex-wrap items-end gap-3">
            <label class="field">
              <span class="field-label">{{ t('att.day') }}</span>
              <input type="date" class="input w-auto" [max]="today" [value]="date()" (change)="setDate($any($event.target).value)" />
            </label>
            @if (isGroup()) {
              <label class="field">
                <span class="field-label">{{ t('att.meeting') }}</span>
                <select class="select w-auto" [value]="startTime() ?? ''" (change)="setTime($any($event.target).value || null)">
                  <option value="">{{ t('att.wholeDay') }}</option>
                  @for (time of meetingTimes(); track time) { <option [value]="time">{{ time }}</option> }
                </select>
              </label>
            }
            <button type="button" class="btn btn-ghost ms-auto" (click)="markAll('Present')">{{ t('att.allPresent') }}</button>
          </div>
          <p class="mb-3 text-sm text-muted">{{ takenInfo() }}</p>

          <!-- Counts stay in view while scrolling; tapping one shows only those students. -->
          <div class="sticky top-16 z-10 -mx-4 mb-3 bg-page/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div class="grid grid-cols-4 gap-2 text-center">
              @for (s of statuses; track s.value) {
                <button type="button" class="cursor-pointer rounded-ui border-2 px-1 py-2" [class]="s.tile + (filter() === s.value ? ' border-current' : ' border-transparent')"
                        [attr.aria-pressed]="filter() === s.value" (click)="toggleFilter(s.value)">
                  <span class="block text-xl leading-tight font-bold tabular-nums">{{ counts()[s.value] }}</span>
                  <span class="block text-sm">{{ t('attendance.' + s.value) }}</span>
                </button>
              }
            </div>
            @if (filter()) {
              <button type="button" class="mt-1.5 inline-flex min-h-9 cursor-pointer items-center gap-1 text-sm font-bold text-secondary-600" (click)="filter.set(null)">
                <mat-icon svgIcon="x" class="icon-size-4" />{{ t('att.showAll') }}
              </button>
            }
          </div>

          <ul class="card overflow-hidden">
            @for (row of visibleRows(); track row.userId) {
              <li class="relative border-b border-line-soft px-3 py-2.5 last:border-b-0 sm:px-4" [class]="rowTone(row.status)">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span class="min-w-[7rem] flex-1 text-[1.05rem] leading-snug font-bold">{{ row.fullName }}</span>
                  <div class="flex gap-1.5" role="radiogroup" [attr.aria-label]="row.fullName">
                    @for (s of statuses; track s.value) {
                      <button type="button" role="radio" class="size-11 cursor-pointer rounded-ui border text-base font-bold sm:size-12"
                              [class]="row.status === s.value ? s.on : 'border-line bg-white text-muted hover:border-line-strong'"
                              [attr.aria-checked]="row.status === s.value" [attr.aria-label]="t('attendance.' + s.value)" [title]="t('attendance.' + s.value)"
                              (click)="setStatus(row.userId, s.value)">{{ t('attendanceShort.' + s.value) }}</button>
                    }
                  </div>
                </div>
                @if (row.status !== 'Present') {
                  <input class="input mt-2 min-h-11 bg-white text-sm" maxlength="500" [placeholder]="t('att.note')" [attr.aria-label]="t('att.note') + ' · ' + row.fullName"
                         [value]="row.note ?? ''" (input)="setNote(row.userId, $any($event.target).value)" />
                }
              </li>
            } @empty {
              <li class="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted">
                <span class="empty-icon"><mat-icon svgIcon="users" class="icon-size-6" /></span>
                <span>{{ filter() ? t('att.allPresentNow') : t('att.noStudents') }}</span>
              </li>
            }
          </ul>
        } @else {
          <section aria-labelledby="att-history">
            <h2 id="att-history" class="section-title mb-2">{{ t('att.summary') }}</h2>
            @if (summary(); as list) {
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th scope="col">{{ t('att.student') }}</th>@for (s of statuses; track s.value) { <th scope="col" class="text-center">{{ t('attendance.' + s.value) }}</th> }</tr></thead>
                  <tbody>
                    @for (r of list; track r.userId) {
                      <tr>
                        <td class="font-bold">{{ r.fullName }}</td>
                        <td class="text-center tabular-nums">{{ r.present }}</td>
                        <td class="text-center font-bold tabular-nums text-danger-700">{{ r.absent || '' }}</td>
                        <td class="text-center tabular-nums text-warning-700">{{ r.late || '' }}</td>
                        <td class="text-center tabular-nums text-secondary-600">{{ r.excused || '' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div aria-hidden="true" class="flex flex-col gap-2">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-12"></div> }</div>
            }
          </section>
          <section class="card card-body mt-5">
            <h2 class="section-title mb-3">{{ t('attExport.title') }}</h2>
            <div class="flex flex-wrap items-end gap-3">
              <label class="field min-w-36 flex-1">
                <span class="field-label">{{ t('attExport.from') }}</span>
                <input class="input" type="date" [value]="exportFrom()" (input)="exportFrom.set($any($event.target).value)" />
              </label>
              <label class="field min-w-36 flex-1">
                <span class="field-label">{{ t('attExport.to') }}</span>
                <input class="input" type="date" [value]="exportTo()" (input)="exportTo.set($any($event.target).value)" />
              </label>
              <button type="button" class="btn btn-secondary" [disabled]="!exportFrom() || !exportTo()" (click)="exportExcel()"><mat-icon svgIcon="file-spreadsheet" class="icon-size-5" />{{ t('attExport.action') }}</button>
            </div>
            @if (exportError()) { <p class="field-error mt-2">{{ exportError() }}</p> }
          </section>
        }
      </div>

      <!-- Save bar: above the phone tab bar, at the bottom on larger screens -->
      @if (tab() === 'mark') {
        <div class="fixed inset-x-0 bottom-14 z-20 border-t border-line bg-white/95 shadow-[0_-8px_24px_rgba(11,59,46,0.06)] backdrop-blur sm:bottom-0 lg:start-64">
          <div class="mx-auto flex max-w-3xl flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div class="flex-1" role="status">
              @if (errors().length) {
                <p class="text-sm text-danger-700">{{ errors().join(' ') }}</p>
              } @else if (message()) {
                <p class="text-sm font-bold text-primary-700">{{ message() }}</p>
              } @else {
                <p class="font-bold tabular-nums">{{ exceptionsLine() }}</p>
                <p class="text-sm text-muted">{{ t('att.parentsNotified') }}</p>
              }
            </div>
            <button type="button" class="btn min-h-12 text-base sm:min-w-48" [class]="message() ? 'btn-outline' : 'btn-primary'" [disabled]="saving() || !rows().length" (click)="save()">{{ t('att.save') }}</button>
          </div>
        </div>
      }
    </ng-container>
  `,
})
export default class AttendanceComponent {
  protected orgContext = inject(OrgContextService);
  protected outbox = inject(AttendanceOutbox);
  private school = inject(SchoolService);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);

  protected readonly statuses = STATUSES;
  protected readonly classId = this.route.snapshot.paramMap.get('classId')!;
  protected readonly today = todayIn(this.orgContext.activeOrg()?.timeZone);

  protected classInfo = signal<ClassSummary | null>(null);
  protected className = computed(() => this.classInfo()?.name ?? '');
  protected isGroup = computed(() => this.classInfo()?.kind === 'Group');
  protected date = signal(this.today);
  protected startTime = signal<string | null>(null);
  protected rows = signal<Row[]>([]);
  protected takenInfo = signal('');
  protected saving = signal(false);
  protected errors = signal<string[]>([]);
  protected message = signal<string | null>(null);
  protected summary = signal<AttendanceSummaryRow[] | null>(null);
  protected exportFrom = signal('');
  protected exportTo = signal('');
  protected exportError = signal<string | null>(null);
  protected tab = signal<'mark' | 'history'>('mark');
  protected filter = signal<AttendanceStatus | null>(null);

  protected visibleRows = computed(() => {
    const only = this.filter();
    return only ? this.rows().filter(r => r.status === only) : this.rows();
  });
  protected exceptionsLine = computed(() => {
    const c = this.counts();
    this.i18n.lang();
    return c.Absent + c.Late + c.Excused
      ? this.transloco.translate('att.exceptions', { absent: c.Absent, late: c.Late, excused: c.Excused })
      : this.transloco.translate('att.allPresentNow');
  });

  protected counts = computed(() => {
    const result: Record<AttendanceStatus, number> = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    for (const r of this.rows()) result[r.status]++;
    return result;
  });

  /** Meeting times of the selected weekday from the group's schedule. */
  protected meetingTimes = computed(() => {
    const weekday = WEEK_DAYS[new Date(`${this.date()}T12:00:00Z`).getUTCDay()];
    return (this.classInfo()?.schedule ?? []).filter(s => s.day === weekday).map(s => s.startTime.slice(0, 5));
  });

  constructor() {
    this.outbox.flush().subscribe();
    this.school.classDetail(this.org, this.classId).subscribe(d => {
      this.classInfo.set(d.class);
      if (d.class.kind === 'Group') this.startTime.set(this.meetingTimes()[0] ?? null);
      this.load();
    });
  }

  protected setDate(value: string): void {
    if (!value) return;
    this.date.set(value);
    if (this.isGroup()) this.startTime.set(this.meetingTimes()[0] ?? null);
    this.load();
  }

  protected setTime(value: string | null): void {
    this.startTime.set(value);
    this.load();
  }

  protected setStatus(userId: string, status: AttendanceStatus): void {
    this.message.set(null);
    this.rows.update(rows => rows.map(r => (r.userId === userId ? { ...r, status, note: status === 'Present' ? null : r.note } : r)));
  }

  protected setNote(userId: string, note: string): void {
    this.rows.update(rows => rows.map(r => (r.userId === userId ? { ...r, note: note || null } : r)));
  }

  protected toggleFilter(status: AttendanceStatus): void {
    this.filter.update(current => (current === status ? null : status));
  }

  protected rowTone(status: AttendanceStatus): string {
    const row = STATUSES.find(s => s.value === status)?.row;
    return row ? ROW_STROKE + ' ' + row : '';
  }

  protected openHistory(): void {
    this.tab.set('history');
    if (!this.summary()) this.loadSummary();
  }

  protected markAll(status: AttendanceStatus): void {
    this.rows.update(rows => rows.map(r => ({ ...r, status, note: null })));
  }

  protected save(): void {
    this.saving.set(true);
    this.errors.set([]);
    this.message.set(null);
    const marks = this.rows().map(r => ({ userId: r.userId, status: r.status, note: r.note }));

    this.school.saveAttendance(this.org, this.classId, this.date(), this.startTime(), marks).subscribe({
      next: sheet => {
        this.saving.set(false);
        this.apply(sheet.lines, sheet.takenAtUtc, sheet.takenByName);
        this.message.set(this.transloco.translate('att.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isOfflineError(err)) {
          this.outbox.enqueue({
            org: this.org, classId: this.classId, className: this.className(), date: this.date(), startTime: this.startTime(), marks,
            queuedAt: new Date().toISOString(),
          });
          this.message.set(this.transloco.translate('att.offline'));
        } else {
          this.errors.set(errorMessages(err, this.transloco.translate('error.generic')));
        }
      },
    });
  }

  protected retry(): void {
    this.outbox.flush().subscribe(() => this.load());
  }

  private loadSummary(): void {
    const from = new Date(`${this.today}T12:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 30);
    this.exportFrom.set(from.toISOString().slice(0, 10));
    this.exportTo.set(this.today);
    this.school.attendanceSummary(this.org, this.classId, from.toISOString().slice(0, 10), this.today).subscribe(rows => this.summary.set(rows));
  }

  protected exportExcel(): void {
    this.exportError.set(null);
    this.school.exportAttendance(this.org, this.classId, this.exportFrom(), this.exportTo()).subscribe({
      next: blob => saveBlob(blob, `attendance-${this.classInfo()?.name ?? this.classId}-${this.exportFrom()}-${this.exportTo()}.xlsx`),
      error: () => this.exportError.set(this.transloco.translate('error.generic')),
    });
  }

  private load(): void {
    this.message.set(null);
    this.errors.set([]);
    this.school.attendance(this.org, this.classId, this.date(), this.startTime()).subscribe(sheet => {
      this.apply(sheet.lines, sheet.takenAtUtc, sheet.takenByName);
      // A queued (unsent) version of this sheet wins over what the server has.
      const queued = this.outbox.pending().find(p => p.classId === this.classId && p.date === this.date() && p.startTime === this.startTime());
      if (queued) {
        this.rows.update(rows => rows.map(r => {
          const mark = queued.marks.find(m => m.userId === r.userId);
          return mark ? { ...r, status: mark.status, note: mark.note } : r;
        }));
      }
    });
  }

  private apply(lines: AttendanceLine[], takenAtUtc: string | null, takenByName: string | null): void {
    this.rows.set(lines.map(l => ({ ...l, status: l.status ?? 'Present' })));
    this.takenInfo.set(
      takenAtUtc
        ? this.transloco.translate('att.takenBy', { name: takenByName ?? '', time: formatOrgDate(takenAtUtc, 'Gregorian', { style: 'datetime', locale: this.i18n.lang() }) })
        : this.transloco.translate('att.notTaken')
    );
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
