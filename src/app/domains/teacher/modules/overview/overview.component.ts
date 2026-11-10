import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { LocalStorage } from '@/app/core/local-storage/local-storage';
import { ApiResponse } from '@/app/core/models/api-response.model';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatLongDay, formatShortDay } from '@/app/core/organizations/org-date';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { AqBulletBar } from '@/app/shared/ui/bullet-bar';
import { AqInkBar } from '@/app/shared/ui/ink-bar';
import { AqOrgMark } from '@/app/shared/ui/org-mark';
import {
  BELOW_USUAL_POINTS, countOf, daysWaiting, OrganizationOverview, OverviewClass, sortClasses, summarizeOverview, Tone, TodayStatus,
} from './overview-summary';

const NAMES_KEY = 'aq.overview.names';
const MIN_TREND_DAYS = 5;

/** Literal classes so Tailwind generates them; the edge colour states the headline's tone. */
const TONE_EDGE: Record<Tone, string> = {
  neutral: 'border-t-line-strong',
  info: 'border-t-secondary-600',
  good: 'border-t-primary-600',
  watch: 'border-t-warning-500',
  act: 'border-t-danger-600',
};

/** Not yet due is information, never a warning; only "not taken when due" asks for action. */
const TODAY_BADGE: Record<TodayStatus, string> = {
  Taken: 'badge badge-success',
  Missing: 'badge badge-warning',
  Pending: 'badge badge-info',
  NotToday: 'badge badge-neutral',
};

/**
 * The owner's morning view. One sentence says how the day is going (first matching rule in overview-summary),
 * then the evidence: today's attendance, the recent trend, homework waiting, classes worst-first, and the
 * students over the school's own limits. Student names stay hidden until the person chooses to show them.
 */
@Component({
  selector: 'teacher-overview',
  imports: [NgTemplateOutlet, MatIconModule, RouterLink, TranslocoDirective, AqBulletBar, AqInkBar, AqOrgMark],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        @if (error()) {
          <div class="alert alert-danger" role="alert">
            <mat-icon svgIcon="circle-alert" class="icon-size-5 shrink-0" />
            <p class="flex-1">{{ t('overview.error') }}</p>
            <button type="button" class="btn btn-outline btn-sm" (click)="load()">{{ t('action.retry') }}</button>
          </div>
        } @else if (!data()) {
          <div aria-hidden="true" class="flex flex-col gap-5">
            <div class="skeleton h-56 !rounded-hero"></div>
            <div class="grid gap-5 lg:grid-cols-3"><div class="skeleton h-44 !rounded-card lg:col-span-2"></div><div class="skeleton h-44 !rounded-card"></div></div>
            <div class="skeleton h-72 !rounded-card"></div>
          </div>
          <p class="sr-only" role="status">{{ t('loading') }}</p>
        }

        @if (data(); as o) {
          @if (headline(); as h) {
            <!-- Judgement first ------------------------------------------------------------------- -->
            <section aria-labelledby="ov-headline" class="rounded-hero border border-t-4 border-line bg-white p-5 shadow-[0_14px_36px_rgba(11,59,46,0.08)] lg:p-7.5" [class]="edge()">
              <p class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <aq-org-mark [name]="o.school.name" [logoUrl]="o.school.logoUrl" [size]="32" class="me-1" />
                <span class="font-bold text-deep">{{ o.school.name }}</span>
                <span aria-hidden="true">·</span><span>{{ longDate() }}</span>
                @if (o.school.students) { <span aria-hidden="true">·</span><span>{{ t('overview.students', { n: o.school.students }) }}</span> }
                @if (o.school.teachers) { <span aria-hidden="true">·</span><span>{{ t('overview.teachers', { n: o.school.teachers }) }}</span> }
              </p>

              <div class="lg:grid lg:grid-cols-[1fr_17rem] lg:gap-8">
                <div class="min-w-0">
                  <h1 id="ov-headline" class="mb-2 font-display text-[2.25rem] leading-[1.12] font-bold text-balance text-ink lg:text-[3.125rem]">{{ headlineText() }}</h1>
                  <p class="mb-4.5 max-w-[38em] text-muted">{{ detailText() }}</p>

                  @if (h.state === 'setup') {
                    <ol class="mb-1 flex flex-col gap-2">
                      @for (step of setupSteps(); track step.key; let i = $index) {
                        <li>
                          <a class="flex min-h-12 items-center gap-3 rounded-ui border border-line bg-page px-4 font-semibold text-ink no-underline hover:border-line-strong" [routerLink]="orgContext.path(step.path)">
                            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-deep text-sm font-bold text-white">{{ i + 1 }}</span>
                            {{ t('overview.setup.' + step.key) }}
                            <mat-icon svgIcon="chevron-left" class="ms-auto icon-size-4 text-muted ltr:rotate-180" />
                          </a>
                        </li>
                      }
                    </ol>
                  } @else {
                    <div class="flex flex-wrap gap-2.5">
                      @if (firstMissing(); as c) {
                        <a class="btn btn-primary min-h-12 flex-1 px-6 sm:flex-none" [routerLink]="orgContext.path('classes', c.id, 'attendance')">{{ t('overview.action.openMissing', { name: c.name }) }}</a>
                      } @else if (h.state === 'grading' && o.grading[0]; as g) {
                        <a class="btn btn-primary min-h-12 flex-1 px-6 sm:flex-none" [routerLink]="orgContext.path('courses', g.courseId, 'submissions')">{{ t('overview.action.grading') }}</a>
                      }
                      @if (o.followUpTotal) {
                        <a class="btn btn-outline min-h-12 flex-1 px-5.5 sm:flex-none" routerLink="." fragment="follow-up">{{ t('overview.action.followUp', { n: o.followUpTotal }) }}</a>
                      }
                      <a class="btn btn-outline min-h-12 flex-1 px-5.5 sm:flex-none" [routerLink]="orgContext.path('classes')">{{ t(isCenter() ? 'overview.action.allGroups' : 'overview.action.allClasses') }}</a>
                    </div>
                  }
                </div>

                @if (h.state !== 'setup') {
                  <div class="mt-5 rounded-card border border-line-soft bg-page p-4 lg:mt-0" aria-labelledby="ov-today">
                    <h2 id="ov-today" class="mb-1 text-sm font-bold text-muted">{{ t('overview.today.title') }}</h2>
                    @if (o.today.expected || o.today.taken) {
                      <p class="text-2xl leading-tight font-bold tabular-nums">{{ t('overview.today.taken', { taken: o.today.taken, expected: o.today.expected || o.today.taken }) }}</p>
                      <p class="mb-2 text-sm text-muted">{{ t('overview.today.takenHint') }}</p>
                      <aq-ink-bar [percent]="takenPercent()" color="var(--color-primary-600)" [height]="12" />
                      <div class="mt-3.5 grid grid-cols-3 gap-2 text-center">
                        <div class="rounded-ui bg-primary-100 px-1 py-2 text-primary-700"><div class="text-xl leading-tight font-bold tabular-nums">{{ o.today.present }}</div><div class="text-sm">{{ t('attendance.Present') }}</div></div>
                        <div class="rounded-ui bg-danger-50 px-1 py-2 text-danger-700"><div class="text-xl leading-tight font-bold tabular-nums">{{ o.today.absent }}</div><div class="text-sm">{{ t('attendance.Absent') }}</div></div>
                        <div class="rounded-ui bg-warning-50 px-1 py-2 text-warning-700"><div class="text-xl leading-tight font-bold tabular-nums">{{ o.today.late }}</div><div class="text-sm">{{ t('attendance.Late') }}</div></div>
                      </div>
                    } @else {
                      <p class="py-2 font-semibold text-ink">{{ t('overview.today.none') }}</p>
                    }
                  </div>
                }
              </div>
            </section>

            @if (h.state !== 'setup') {
              <!-- Trend and homework --------------------------------------------------------------- -->
              <div class="flex flex-wrap items-stretch gap-5">
                <section aria-labelledby="ov-trend" class="min-w-0 flex-[2_1_26rem] rounded-card border border-line bg-white p-5.5">
                  <h2 id="ov-trend" class="section-title">{{ t('overview.trend.title') }}</h2>
                  @if (o.days.length >= minTrendDays) {
                    <p class="mb-3.5 text-sm text-muted">{{ t('overview.trend.hint') }}</p>
                    <div role="img" [attr.aria-label]="trendSummary()" class="relative mb-3 flex h-16 items-end gap-1 lg:h-24">
                      @for (d of trend(); track d.date) {
                        <span class="min-h-[3px] flex-[1_1_0] rounded-[3px]" [title]="d.label" [style.height.%]="d.height" [style.background]="d.worse ? 'var(--color-danger-600)' : 'var(--color-primary-500)'"></span>
                      }
                      @if (usualAbsence() !== null) {
                        <span aria-hidden="true" class="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/40" [style.bottom.%]="usualLine()"></span>
                      }
                    </div>
                    <p class="text-sm text-muted">
                      @if (usualAbsence() !== null) { {{ t('overview.trend.usual', { rate: usualAbsence() }) }} · }
                      {{ worseDays() ? t('overview.trend.worse', { count: worseDays() }) : t('overview.trend.noneWorse') }}
                    </p>
                  } @else {
                    <p class="mt-2 text-muted">{{ t('overview.trend.tooShort') }}</p>
                  }
                </section>

                <section aria-labelledby="ov-grading" class="flex min-w-0 flex-[1_1_16rem] flex-col rounded-card border border-line bg-white p-5.5">
                  <h2 id="ov-grading" class="section-title mb-3">{{ t('overview.grading.title') }}</h2>
                  @if (waitingTotal()) {
                    <p class="text-[2.5rem] leading-none font-bold tabular-nums text-ink">{{ waitingTotal() }}</p>
                    <p class="mt-2"><span [class]="ageBadge()">{{ oldestLabel() }}</span></p>
                    <ul class="mt-3 flex flex-col">
                      @for (g of o.grading.slice(0, 3); track g.courseId) {
                        <li>
                          <a class="flex min-h-11 items-center gap-2 text-[0.95rem] text-ink no-underline hover:underline" [routerLink]="orgContext.path('courses', g.courseId, 'submissions')">
                            <span class="min-w-0 flex-1 truncate">{{ g.courseTitle }}</span>
                            <span class="font-bold tabular-nums text-secondary-600">{{ g.waiting }}</span>
                          </a>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="flex items-center gap-2 font-semibold text-primary-700"><mat-icon svgIcon="check" class="icon-size-5" />{{ t('overview.grading.none') }}</p>
                  }
                </section>
              </div>

              <!-- Classes, worst first ------------------------------------------------------------- -->
              <section aria-labelledby="ov-classes" class="card overflow-hidden">
                <div class="card-header">
                  <div>
                    <h2 id="ov-classes" class="section-title">{{ t(isCenter() ? 'overview.classes.titleGroups' : 'overview.classes.title') }}</h2>
                    <p class="text-sm text-muted">{{ t('overview.classes.hint') }}</p>
                  </div>
                  <a class="inline-flex min-h-11 items-center text-sm font-bold" [routerLink]="orgContext.path('classes')">{{ t('action.viewAll') }}</a>
                </div>

                <!-- Laptop: table -->
                <div class="hidden overflow-x-auto md:block">
                  <table class="table">
                    <thead>
                      <tr>
                        <th scope="col">{{ t(isCenter() ? 'overview.classes.nameGroup' : 'overview.classes.name') }}</th>
                        <th scope="col">{{ t('overview.classes.students') }}</th>
                        <th scope="col">{{ t('overview.classes.homeroom') }}</th>
                        <th scope="col">{{ t('overview.classes.today') }}</th>
                        <th scope="col" class="min-w-40">{{ t('overview.classes.attendance') }}</th>
                        <th scope="col" class="min-w-40">{{ t('overview.classes.average') }}</th>
                        <th scope="col">{{ t('overview.classes.followUp') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of classes(); track c.id) {
                        <tr>
                          <td><a class="font-bold text-ink no-underline hover:underline" [routerLink]="orgContext.path('classes', c.id)">{{ c.name }}</a></td>
                          <td class="tabular-nums">{{ c.students }}</td>
                          <td class="text-muted">{{ c.homeroomTeacherName || '—' }}</td>
                          <td>
                            @if (c.today === 'Missing') {
                              <a [class]="todayBadge(c.today)" class="no-underline hover:underline" [routerLink]="orgContext.path('classes', c.id, 'attendance')">{{ todayLabel(c) }}</a>
                            } @else {
                              <span [class]="todayBadge(c.today)">{{ todayLabel(c) }}</span>
                            }
                          </td>
                          <td><ng-container *ngTemplateOutlet="metric; context: { value: c.attendancePercent, ref: o.today.usualRatePercent }" /></td>
                          <td><ng-container *ngTemplateOutlet="metric; context: { value: c.averagePercent, ref: o.school.rules.lowGradePercent }" /></td>
                          <td>@if (c.followUp) { <span class="badge badge-danger tabular-nums">{{ c.followUp }}</span> }</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Phone: rows -->
                <ul class="md:hidden">
                  @for (c of classes(); track c.id) {
                    <li class="border-b border-line-soft px-4 py-3.5 last:border-b-0">
                      <div class="flex items-center gap-2">
                        <a class="min-w-0 flex-1 truncate font-bold text-ink no-underline" [routerLink]="orgContext.path('classes', c.id)">{{ c.name }}</a>
                        @if (c.followUp) { <span class="badge badge-danger tabular-nums">{{ t('overview.classes.followUp') }} {{ c.followUp }}</span> }
                        @if (c.today === 'Missing') {
                          <a [class]="todayBadge(c.today)" class="min-h-9 no-underline" [routerLink]="orgContext.path('classes', c.id, 'attendance')">{{ todayLabel(c) }}</a>
                        } @else {
                          <span [class]="todayBadge(c.today)">{{ todayLabel(c) }}</span>
                        }
                      </div>
                      <p class="mb-2 text-sm text-muted">{{ c.homeroomTeacherName ? c.homeroomTeacherName + ' · ' : '' }}{{ t('overview.classes.students') }} {{ c.students }}</p>
                      <div class="grid grid-cols-2 gap-3">
                        <div><p class="text-xs text-muted">{{ t('overview.classes.attendance') }}</p><ng-container *ngTemplateOutlet="metric; context: { value: c.attendancePercent, ref: o.today.usualRatePercent }" /></div>
                        <div><p class="text-xs text-muted">{{ t('overview.classes.average') }}</p><ng-container *ngTemplateOutlet="metric; context: { value: c.averagePercent, ref: o.school.rules.lowGradePercent }" /></div>
                      </div>
                    </li>
                  }
                </ul>
                <p class="border-t border-line-soft px-4 py-3 text-sm text-muted sm:px-5">{{ t('overview.classes.legend', { low: o.school.rules.lowGradePercent }) }}</p>
              </section>

              <!-- Follow-up ------------------------------------------------------------------------ -->
              <section id="follow-up" aria-labelledby="ov-follow" class="card">
                <div class="card-header">
                  <div class="min-w-0">
                    <h2 id="ov-follow" class="section-title">{{ t('overview.followUp.title') }}@if (o.followUpTotal) { <span class="tabular-nums"> ({{ o.followUpTotal }})</span> }</h2>
                    <p class="text-sm text-muted">
                      {{ t('overview.followUp.rules', { absent: o.school.rules.followUpAbsentDays, late: o.school.rules.followUpLateDays, low: o.school.rules.lowGradePercent }) }}
                      @if (orgContext.can('org.settings')) { <a class="font-bold" [routerLink]="orgContext.path('settings')">{{ t('overview.followUp.changeRules') }}</a> }
                    </p>
                  </div>
                  @if (o.followUpTotal) {
                    <button type="button" class="btn btn-outline btn-sm" [attr.aria-expanded]="namesShown()" aria-controls="follow-list" (click)="toggleNames()">
                      <mat-icon [svgIcon]="namesShown() ? 'eye-off' : 'eye'" class="icon-size-4" />{{ t(namesShown() ? 'overview.followUp.hide' : 'overview.followUp.show') }}
                    </button>
                  }
                </div>
                @if (!o.followUpTotal) {
                  <p class="flex items-center gap-2 px-4 py-5 font-semibold text-primary-700 sm:px-5"><mat-icon svgIcon="check" class="icon-size-5" />{{ t('overview.followUp.none') }}</p>
                } @else if (!namesShown()) {
                  <p class="px-4 py-5 text-muted sm:px-5">{{ t('overview.followUp.hidden') }}</p>
                } @else {
                  <ul id="follow-list">
                    @for (f of o.followUp; track f.userId) {
                      <li>
                        <a class="list-row min-h-14 text-ink no-underline hover:bg-neutral-50" [routerLink]="f.classId ? orgContext.path('classes', f.classId) : orgContext.path('members')">
                          <span class="min-w-0 flex-1">
                            <span class="block font-bold">{{ f.fullName }}</span>
                            @if (f.className) { <span class="block text-sm text-muted">{{ f.className }}</span> }
                          </span>
                          <span class="flex flex-wrap justify-end gap-1.5">
                            @if (f.absent) { <span class="badge tabular-nums" [class]="f.absent >= o.school.rules.followUpAbsentDays ? 'badge-danger' : 'badge-neutral'">{{ t('overview.followUp.absent', { n: f.absent }) }}</span> }
                            @if (f.late) { <span class="badge tabular-nums" [class]="f.late >= o.school.rules.followUpLateDays ? 'badge-warning' : 'badge-neutral'">{{ t('overview.followUp.late', { n: f.late }) }}</span> }
                            @if (f.averagePercent !== null) { <span class="badge tabular-nums" [class]="f.averagePercent < o.school.rules.lowGradePercent ? 'badge-danger' : 'badge-neutral'">{{ t('overview.followUp.average', { n: f.averagePercent }) }}</span> }
                          </span>
                          <mat-icon svgIcon="chevron-left" class="icon-size-4 shrink-0 text-muted ltr:rotate-180" />
                        </a>
                      </li>
                    }
                  </ul>
                  @if (o.followUpTotal > o.followUp.length) {
                    <p class="border-t border-line-soft px-4 py-3 text-sm text-muted sm:px-5">{{ t('overview.followUp.more', { count: o.followUpTotal - o.followUp.length }) }}</p>
                  }
                }
              </section>
            }
          }
        }
      </div>

      <ng-template #metric let-value="value" let-ref="ref">
        @if (value !== null) {
          <span class="flex items-center gap-2.5">
            <aq-bullet-bar class="min-w-16 flex-1" [percent]="value" [reference]="ref" />
            <span class="w-10 text-end font-bold tabular-nums">{{ value }}%</span>
          </span>
        } @else {
          <span class="text-muted">—</span>
        }
      </ng-template>
    </ng-container>
  `,
})
export default class TeacherOverviewComponent {
  protected orgContext = inject(OrgContextService);
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private transloco = inject(TranslocoService);
  private storage = inject(LocalStorage);

  protected readonly minTrendDays = MIN_TREND_DAYS;
  protected data = signal<OrganizationOverview | null>(null);
  protected error = signal(false);
  protected namesShown = signal(this.storage.getItem(NAMES_KEY) === 'shown');

  protected isCenter = computed(() => this.data()?.school.type === 'Center');
  protected headline = computed(() => {
    const o = this.data();
    return o ? summarizeOverview(o) : null;
  });
  protected edge = computed(() => TONE_EDGE[this.headline()?.tone ?? 'neutral']);
  protected classes = computed(() => sortClasses(this.data()?.classes ?? []));
  protected firstMissing = computed<OverviewClass | null>(() => this.classes().find(c => c.today === 'Missing') ?? null);
  protected takenPercent = computed(() => {
    const today = this.data()?.today;
    return today?.expected ? Math.round((today.taken * 100) / today.expected) : today?.taken ? 100 : 0;
  });

  protected setupSteps = computed(() => [
    { key: 'years', path: 'academic-years' },
    { key: 'classes', path: 'classes' },
    { key: 'members', path: 'members' },
  ].filter(s => s.key !== 'years' || !this.isCenter()));

  protected longDate = computed(() => {
    const o = this.data();
    const org = this.orgContext.activeOrg();
    return o ? formatLongDay(o.today.date, org?.calendar ?? 'Gregorian', this.i18n.lang()) : '';
  });

  protected headlineText = computed(() => {
    const o = this.data();
    const h = this.headline();
    if (!o || !h) return '';
    const lang = this.i18n.lang();
    const noun = this.isCenter() ? 'group' : 'class';
    const key = `overview.headline.${h.state}`;
    switch (h.state) {
      case 'setup':
        return this.tr(key, { unit: this.tr(this.isCenter() ? 'overview.unit.groups' : 'overview.unit.classes') });
      case 'inProgress':
        return this.tr(key, { taken: o.today.taken, expected: countOf(noun, o.today.expected, lang) });
      case 'missing':
        return this.tr(key, { count: countOf(noun, h.missing, lang) });
      case 'belowUsual':
        return this.tr(key, { rate: o.today.ratePercent, usual: o.today.usualRatePercent });
      case 'grading':
        return this.tr(key, { count: countOf('homework', h.waitingOverWeek, lang) });
      case 'onTrack':
        return o.today.ratePercent === null ? this.tr('overview.headline.onTrackNoRate') : this.tr(key, { rate: o.today.ratePercent });
      default:
        return this.tr(key);
    }
  });

  protected detailText = computed(() => {
    const o = this.data();
    const h = this.headline();
    this.i18n.lang(); // re-translate on language change
    if (!o || !h || h.state === 'setup') return '';
    if (h.state === 'noSchool' || (!o.today.taken && o.today.lastSchoolDay)) {
      const last = o.today.lastSchoolDay;
      return last ? this.tr('overview.detail.lastDay', { date: this.shortDate(last.date), rate: last.ratePercent }) : this.tr('overview.detail.noHistory');
    }
    const counts = this.tr('overview.detail.counts', o.today) + (o.today.excused ? this.tr('overview.detail.excused', { n: o.today.excused }) : '');
    return h.state === 'inProgress' || h.state === 'missing' ? `${counts}. ${this.dueText(o)}` : counts;
  });

  // Trend: absence per day, taller = worse, red when clearly worse than usual.
  protected usualAbsence = computed(() => {
    const usual = this.data()?.today.usualRatePercent;
    return usual === null || usual === undefined ? null : 100 - usual;
  });
  private trendScale = computed(() => {
    const days = this.data()?.days ?? [];
    const highest = Math.max(0, ...days.map(d => 100 - d.ratePercent));
    return Math.max(10, highest, 2 * (this.usualAbsence() ?? 0));
  });
  protected usualLine = computed(() => ((this.usualAbsence() ?? 0) * 100) / this.trendScale());
  protected trend = computed(() => {
    const usual = this.usualAbsence();
    this.i18n.lang();
    return (this.data()?.days ?? []).map(d => {
      const absence = 100 - d.ratePercent;
      return {
        date: d.date,
        height: (absence * 100) / this.trendScale(),
        worse: usual !== null && absence >= usual + BELOW_USUAL_POINTS,
        label: this.tr('overview.trend.bar', { date: this.shortDate(d.date), rate: absence }),
      };
    });
  });
  protected worseDays = computed(() => this.trend().filter(d => d.worse).length);
  protected trendSummary = computed(() => {
    this.i18n.lang();
    const usual = this.usualAbsence();
    const parts = usual === null ? [] : [this.tr('overview.trend.usual', { rate: usual })];
    parts.push(this.worseDays() ? this.tr('overview.trend.worse', { count: this.worseDays() }) : this.tr('overview.trend.noneWorse'));
    return parts.join('، ');
  });

  // Homework waiting.
  protected waitingTotal = computed(() => (this.data()?.grading ?? []).reduce((sum, g) => sum + g.waiting, 0));
  private oldestDays = computed(() => {
    const oldest = this.data()?.grading[0];
    return oldest ? daysWaiting(oldest.oldestSubmittedAtUtc) : 0;
  });
  protected oldestLabel = computed(() =>
    this.i18n.lang() && this.oldestDays() ? this.tr('overview.grading.oldest', { days: countOf('day', this.oldestDays(), this.i18n.lang()) }) : this.tr('overview.grading.oldestToday'));
  protected ageBadge = computed(() => {
    const days = this.oldestDays();
    return 'badge ' + (days > 7 ? 'badge-danger' : days > 3 ? 'badge-warning' : 'badge-neutral');
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.error.set(false);
    this.http.get<ApiResponse<OrganizationOverview>>(ApiEndpoints.School.Overview(this.orgContext.requireActiveSlug())).subscribe({
      next: r => this.data.set(r.data ?? null),
      error: () => this.error.set(true),
    });
  }

  protected toggleNames(): void {
    const shown = !this.namesShown();
    this.namesShown.set(shown);
    if (shown) this.storage.setItem(NAMES_KEY, 'shown');
    else this.storage.removeItem(NAMES_KEY);
  }

  protected todayBadge(status: TodayStatus): string {
    return TODAY_BADGE[status];
  }

  protected todayLabel(c: OverviewClass): string {
    if (c.today === 'Pending' && c.startsAt) return this.tr('overview.classes.startsAt', { time: c.startsAt.slice(0, 5) });
    return this.tr(`overview.classes.status.${c.today}`);
  }

  /** The school's own limits, e.g. "late after 07:30, a group 15 minutes after it starts". */
  private dueText(o: OrganizationOverview): string {
    return this.tr('overview.detail.due', { time: o.school.rules.attendanceDueBy.slice(0, 5), minutes: o.school.rules.groupAttendanceGraceMinutes });
  }

  private shortDate(day: string): string {
    const org = this.orgContext.activeOrg();
    return formatShortDay(day, org?.calendar ?? 'Gregorian', this.i18n.lang(), org?.timeZone, {
      today: this.tr('day.today'), tomorrow: this.tr('day.tomorrow'),
    });
  }

  private tr(key: string, params?: object): string {
    return this.transloco.translate(key, params as Record<string, unknown>);
  }
}
