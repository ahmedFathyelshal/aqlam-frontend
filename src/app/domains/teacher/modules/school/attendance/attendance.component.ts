import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, OrgDatePipe, todayIn } from '@/app/core/organizations/org-date';
import { AttendanceOutbox, isOfflineError } from '@/app/core/school/attendance-outbox';
import { AttendanceLine, AttendanceStatus, AttendanceSummaryRow, ClassSummary, SchoolService } from '@/app/core/school/school.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { WEEK_DAYS } from '../classes/class-form';

type Row = AttendanceLine & { status: AttendanceStatus };

const STATUSES: { value: AttendanceStatus; on: string; count: string }[] = [
  { value: 'Present', on: 'border-primary-600 bg-primary-600 text-white', count: 'text-primary-700' },
  { value: 'Absent', on: 'border-danger-700 bg-danger-700 text-white', count: 'text-danger-700' },
  { value: 'Late', on: 'border-warning-700 bg-warning-700 text-white', count: 'text-warning-700' },
  { value: 'Excused', on: 'border-secondary-600 bg-secondary-600 text-white', count: 'text-secondary-600' },
];

/**
 * Phone-first attendance: everyone starts as present, the teacher taps the exceptions and saves.
 * Without a connection the sheet is kept on the device and sent later.
 */
@Component({
  selector: 'app-attendance',
  imports: [MatIconModule, RouterLink, TranslocoDirective, OrgDatePipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow pb-36">
        <a class="back-link" [routerLink]="orgContext.path('classes', classId)"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ className() }}</a>
        <header class="mb-4">
          <h1 class="page-title">{{ t('att.title') }} · {{ className() }}</h1>
          <p class="page-subtitle">{{ date() | orgDate }}</p>
        </header>

        @if (outbox.pending().length) {
          <div class="alert alert-warning mb-4" role="status">
            <mat-icon svgIcon="wifi-off" class="icon-size-5 shrink-0" />
            <span class="flex-1">{{ t('att.pending', { count: outbox.pending().length }) }}</span>
            <button type="button" class="btn btn-secondary btn-sm" (click)="retry()">{{ t('att.sendNow') }}</button>
          </div>
        }

        <div class="mb-4 flex flex-wrap items-end gap-3">
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

        <div class="card mb-3 grid grid-cols-4 divide-x divide-line-soft text-center rtl:divide-x-reverse">
          @for (s of statuses; track s.value) {
            <div class="py-3">
              <div class="text-2xl font-extrabold" [class]="s.count">{{ counts()[s.value] }}</div>
              <div class="text-sm text-muted">{{ t('attendance.' + s.value) }}</div>
            </div>
          }
        </div>
        <p class="mb-3 text-sm text-muted">{{ takenInfo() }}</p>

        <ul class="card">
          @for (row of rows(); track row.userId; let i = $index) {
            <li class="border-b border-line-soft px-3 py-2.5 last:border-b-0 sm:px-4">
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-[1.02rem] font-bold">{{ row.fullName }}</span>
                <div class="flex gap-1" role="radiogroup" [attr.aria-label]="row.fullName">
                  @for (s of statuses; track s.value) {
                    <button type="button" role="radio" class="size-11 rounded-[6px] border text-base font-extrabold"
                            [class]="row.status === s.value ? s.on : 'border-line bg-white text-muted'"
                            [attr.aria-checked]="row.status === s.value" [attr.aria-label]="t('attendance.' + s.value)" [title]="t('attendance.' + s.value)"
                            (click)="setStatus(i, s.value)">{{ t('attendanceShort.' + s.value) }}</button>
                  }
                </div>
              </div>
              @if (row.status !== 'Present') {
                <input class="input mt-2 min-h-10 text-sm" maxlength="500" [placeholder]="t('att.note')" [attr.aria-label]="t('att.note')"
                       [value]="row.note ?? ''" (input)="setNote(i, $any($event.target).value)" />
              }
            </li>
          } @empty {
            <li class="px-4 py-10 text-center text-muted">{{ t('att.noStudents') }}</li>
          }
        </ul>

        @if (summary(); as list) {
          <section class="mt-6">
            <h2 class="section-title mb-2">{{ t('att.summary') }}</h2>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>{{ t('att.student') }}</th>@for (s of statuses; track s.value) { <th class="text-center">{{ t('attendanceShort.' + s.value) }}</th> }</tr></thead>
                <tbody>
                  @for (r of list; track r.userId) {
                    <tr>
                      <td class="font-bold">{{ r.fullName }}</td>
                      <td class="text-center">{{ r.present }}</td>
                      <td class="text-center font-extrabold text-danger-700">{{ r.absent || '' }}</td>
                      <td class="text-center text-warning-700">{{ r.late || '' }}</td>
                      <td class="text-center text-secondary-600">{{ r.excused || '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
        <button type="button" class="btn btn-ghost mt-4" (click)="toggleSummary()">{{ summary() ? t('att.hideSummary') : t('att.summary') }}</button>
      </div>

      <!-- Save bar: above the phone tab bar, at the bottom on larger screens -->
      <div class="fixed inset-x-0 bottom-14 z-20 border-t border-line bg-white/95 backdrop-blur sm:bottom-0 lg:start-64">
        <div class="mx-auto flex max-w-3xl flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <p class="flex-1 text-sm" [class]="errors().length ? 'text-danger-700' : message() ? 'font-bold text-primary-700' : 'text-muted'" role="status">
            {{ errors().length ? errors().join(' ') : message() ?? t('att.parentsNotified') }}
          </p>
          <button type="button" class="btn btn-primary min-h-12 text-base sm:min-w-48" [disabled]="saving() || !rows().length" (click)="save()">{{ t('att.save') }}</button>
        </div>
      </div>
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

  protected setStatus(index: number, status: AttendanceStatus): void {
    this.message.set(null);
    this.rows.update(rows => rows.map((r, i) => (i === index ? { ...r, status, note: status === 'Present' ? null : r.note } : r)));
  }

  protected setNote(index: number, note: string): void {
    this.rows.update(rows => rows.map((r, i) => (i === index ? { ...r, note: note || null } : r)));
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

  protected toggleSummary(): void {
    if (this.summary()) {
      this.summary.set(null);
      return;
    }
    const from = new Date(`${this.today}T12:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 30);
    this.school.attendanceSummary(this.org, this.classId, from.toISOString().slice(0, 10), this.today).subscribe(rows => this.summary.set(rows));
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
