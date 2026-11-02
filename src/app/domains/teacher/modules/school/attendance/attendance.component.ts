import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, OrgDatePipe, todayIn } from '@/app/core/organizations/org-date';
import { AttendanceOutbox, isOfflineError } from '@/app/core/school/attendance-outbox';
import { AttendanceLine, AttendanceStatus, AttendanceSummaryRow, ClassSummary, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { WEEK_DAYS } from '../classes/class-form';

type Row = AttendanceLine & { status: AttendanceStatus };

const STATUSES: { value: AttendanceStatus; label: string; short: string; tone: string }[] = [
  { value: 'Present', label: 'Present', short: 'P', tone: 'bg-green-600 text-white' },
  { value: 'Absent', label: 'Absent', short: 'A', tone: 'bg-red-600 text-white' },
  { value: 'Late', label: 'Late', short: 'L', tone: 'bg-amber-500 text-white' },
  { value: 'Excused', label: 'Excused', short: 'E', tone: 'bg-sky-600 text-white' },
];

/**
 * Phone-first attendance: everyone starts as present, the teacher taps the exceptions and saves.
 * Without a connection the sheet is kept on the device and sent later.
 */
@Component({
  selector: 'app-attendance',
  imports: [MatButtonModule, MatIconModule, RouterLink, OrgDatePipe],
  template: `
    <div class="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <header>
        <a class="text-sm text-neutral-500 hover:underline" [routerLink]="orgContext.path('classes', classId)">← {{ className() }}</a>
        <h1 class="text-2xl font-bold">Attendance</h1>
        <p class="text-sm text-neutral-500">{{ date() | orgDate }}</p>
      </header>

      @if (outbox.pending().length) {
        <div class="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <mat-icon svgIcon="wifi-off" />
          <span class="flex-1">{{ outbox.pending().length }} sheet(s) saved on this device, waiting for a connection.</span>
          <button matButton (click)="retry()">Send now</button>
        </div>
      }

      <div class="flex flex-wrap items-end gap-3">
        <label class="block">
          <span class="text-sm font-medium">Day</span>
          <input type="date" class="mt-1 rounded-lg border px-3 py-2 dark:bg-neutral-900" [max]="today" [value]="date()" (change)="setDate($any($event.target).value)" />
        </label>
        @if (isGroup()) {
          <label class="block">
            <span class="text-sm font-medium">Meeting</span>
            <select class="mt-1 rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="startTime() ?? ''" (change)="setTime($any($event.target).value || null)">
              <option value="">Whole day</option>
              @for (t of meetingTimes(); track t) { <option [value]="t">{{ t }}</option> }
            </select>
          </label>
        }
        <div class="flex-1"></div>
        <button matButton="outlined" (click)="markAll('Present')">All present</button>
      </div>

      @if (takenInfo()) {
        <p class="text-xs text-neutral-500">{{ takenInfo() }}</p>
      }

      <ul class="divide-y rounded-2xl border bg-white dark:bg-neutral-800">
        @for (row of rows(); track row.userId; let i = $index) {
          <li class="p-3">
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate font-medium">{{ row.fullName }}</span>
              <div class="flex gap-1" role="radiogroup" [attr.aria-label]="row.fullName">
                @for (s of statuses; track s.value) {
                  <button
                    type="button"
                    role="radio"
                    class="size-10 rounded-lg border text-sm font-semibold"
                    [class]="row.status === s.value ? s.tone : ''"
                    [attr.aria-checked]="row.status === s.value"
                    [attr.aria-label]="s.label"
                    [title]="s.label"
                    (click)="setStatus(i, s.value)"
                  >{{ s.short }}</button>
                }
              </div>
            </div>
            @if (row.status !== 'Present') {
              <input class="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm dark:bg-neutral-900" placeholder="Note (optional)" maxlength="500"
                     [value]="row.note ?? ''" (input)="setNote(i, $any($event.target).value)" />
            }
          </li>
        } @empty {
          <li class="p-6 text-center text-sm text-neutral-500">No students in this class yet.</li>
        }
      </ul>

      @if (errors().length) {
        <p class="text-sm text-red-600">{{ errors().join(' • ') }}</p>
      }
      @if (message()) {
        <p class="text-sm text-green-700 dark:text-green-400">{{ message() }}</p>
      }

      <div class="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-white/90 py-3 backdrop-blur dark:bg-neutral-900/90">
        <span class="text-sm text-neutral-500">{{ counts() }}</span>
        <button matButton="filled" [disabled]="saving() || !rows().length" (click)="save()">Save attendance</button>
      </div>

      <section class="space-y-2">
        <button matButton (click)="toggleSummary()">{{ summary() ? 'Hide' : 'Show' }} last 30 days</button>
        @if (summary(); as rows) {
          <div class="overflow-x-auto rounded-2xl border bg-white dark:bg-neutral-800">
            <table class="w-full text-sm">
              <thead><tr class="text-left text-neutral-500"><th class="p-2">Student</th><th class="p-2">P</th><th class="p-2">A</th><th class="p-2">L</th><th class="p-2">E</th></tr></thead>
              <tbody>
                @for (r of rows; track r.userId) {
                  <tr class="border-t"><td class="p-2">{{ r.fullName }}</td><td class="p-2">{{ r.present }}</td><td class="p-2 font-semibold text-red-600">{{ r.absent || '' }}</td><td class="p-2">{{ r.late || '' }}</td><td class="p-2">{{ r.excused || '' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export default class AttendanceComponent {
  protected orgContext = inject(OrgContextService);
  protected outbox = inject(AttendanceOutbox);
  private school = inject(SchoolService);
  private route = inject(ActivatedRoute);

  protected readonly statuses = STATUSES;
  protected readonly classId = this.route.snapshot.paramMap.get('classId')!;
  protected readonly today = todayIn(this.orgContext.activeOrg()?.timeZone);

  protected classInfo = signal<ClassSummary | null>(null);
  protected className = computed(() => this.classInfo()?.name ?? 'Class');
  protected isGroup = computed(() => this.classInfo()?.kind === 'Group');
  protected date = signal(this.today);
  protected startTime = signal<string | null>(null);
  protected rows = signal<Row[]>([]);
  protected takenInfo = signal<string | null>(null);
  protected saving = signal(false);
  protected errors = signal<string[]>([]);
  protected message = signal<string | null>(null);
  protected summary = signal<AttendanceSummaryRow[] | null>(null);

  /** Meeting times of the selected weekday from the group's schedule. */
  protected meetingTimes = computed(() => {
    const weekday = WEEK_DAYS[new Date(`${this.date()}T12:00:00Z`).getUTCDay()];
    return (this.classInfo()?.schedule ?? []).filter(s => s.day === weekday).map(s => s.startTime.slice(0, 5));
  });

  protected counts = computed(() => {
    const rows = this.rows();
    const absent = rows.filter(r => r.status === 'Absent').length;
    const late = rows.filter(r => r.status === 'Late').length;
    return `${rows.length - absent} of ${rows.length} present${late ? ` · ${late} late` : ''}`;
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
        this.message.set('Attendance saved. Families of absent or late students are notified.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isOfflineError(err)) {
          this.outbox.enqueue({
            org: this.org, classId: this.classId, className: this.className(), date: this.date(), startTime: this.startTime(), marks,
            queuedAt: new Date().toISOString(),
          });
          this.message.set('No connection: saved on this device and will be sent automatically.');
        } else {
          this.errors.set(errorMessages(err, 'Attendance could not be saved.'));
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
    this.takenInfo.set(takenAtUtc ? `Taken by ${takenByName ?? 'staff'} · ${formatOrgDate(takenAtUtc, 'Gregorian', { style: 'datetime' })}` : 'Not taken yet — everyone starts as present.');
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
