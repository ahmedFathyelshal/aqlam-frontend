import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';

import { AuthService } from '@/app/core/auth/auth.service';
import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { ApiResponse } from '@/app/core/models/api-response.model';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatLongDay, hourIn, todayIn } from '@/app/core/organizations/org-date';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { statusBadge } from '@/app/shared/ui/status';
import { countOf, daysWaiting, OrganizationOverview, OverviewClass, sortClasses } from '../overview/overview-summary';

/** Row of the organization's course list. */
export type CourseSummary = {
  chapterCount: number;
  id: string;
  lessonCount: number;
  status: string;
  title: string;
  visibility: string;
};

type CourseFilter = 'all' | 'published' | 'drafts';

/**
 * Two homes in one page. Teachers see their day: their classes with today's attendance and one button to take it,
 * homework waiting for them, then their courses. People who run a school land on the overview instead, so for
 * them this page is simply the organization's course list.
 */
@Component({
  selector: 'teacher-dashboard',
  imports: [TranslocoDirective, MatIconModule, RouterLink],
  template: `
    <ng-container *transloco="let t">
      <div class="page flex flex-col gap-5">
        <header class="page-header !mb-0">
          <div>
            @if (runsOrg()) {
              <h1 class="page-title">{{ t('myDay.courses') }}</h1>
              <p class="page-subtitle">{{ t('myDay.coursesIntro', { org: orgContext.activeOrg()?.name }) }}</p>
            } @else {
              <p class="text-muted">{{ today() }}</p>
              <h1 class="page-title">{{ t(greetingKey(), { name: firstName() }) }}</h1>
            }
          </div>
          @if (orgContext.can('courses.edit')) {
            <a class="btn btn-secondary w-full sm:w-auto" [routerLink]="orgContext.path('courses', 'new')"><mat-icon svgIcon="plus" class="icon-size-5" />{{ t('dash.newCourse') }}</a>
          }
        </header>

        @if (!runsOrg() && day(); as d) {
          <div class="flex flex-wrap items-start gap-5">
            @if (isSchool()) {
              <section aria-labelledby="my-classes" class="card min-w-0 flex-[2_1_24rem] overflow-hidden">
                <div class="card-header"><h2 id="my-classes" class="section-title">{{ t(isCenter() ? 'myDay.groupsTitle' : 'myDay.classesTitle') }}</h2></div>
                @for (c of myClasses(); track c.id) {
                  <div class="list-row min-h-16">
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-ui bg-primary-50 font-display text-xl font-bold text-deep" aria-hidden="true">{{ c.name.charAt(0) }}</span>
                    <a class="min-w-0 flex-1 text-ink no-underline" [routerLink]="orgContext.path('classes', c.id)">
                      <span class="block truncate font-bold">{{ c.name }}</span>
                      <span class="block text-sm text-muted">{{ t('overview.classes.students') }} {{ c.students }}</span>
                    </a>
                    @if (c.today === 'Missing' || c.today === 'Pending') {
                      <a class="btn btn-sm" [class]="c.today === 'Missing' ? 'btn-primary' : 'btn-secondary'" [routerLink]="orgContext.path('classes', c.id, 'attendance')">
                        <mat-icon svgIcon="calendar-check" class="icon-size-4" />{{ t('myDay.take') }}
                      </a>
                    } @else {
                      <span [class]="todayBadge(c)">{{ todayLabel(c) }}</span>
                    }
                  </div>
                } @empty {
                  <p class="px-5 py-8 text-center text-muted">{{ t('myDay.noClasses') }}</p>
                }
                @if (myClasses().length) {
                  <p class="border-t border-line-soft px-4 py-3 text-sm font-semibold sm:px-5" [class]="allTaken() ? 'text-primary-700' : 'text-muted'">
                    {{ !d.today.expected && !d.today.taken ? t('myDay.noneToday') : allTaken() ? t('myDay.allTaken') : t('overview.detail.due', { time: d.school.rules.attendanceDueBy.slice(0, 5), minutes: d.school.rules.groupAttendanceGraceMinutes }) }}
                  </p>
                }
              </section>
            }

            <section aria-labelledby="my-grading" class="flex min-w-0 flex-[1_1_16rem] flex-col rounded-card border border-line bg-white p-5">
              <h2 id="my-grading" class="section-title mb-3">{{ t('myDay.gradingTitle') }}</h2>
              @if (waitingTotal()) {
                <p class="text-[2.5rem] leading-none font-bold tabular-nums">{{ waitingTotal() }}</p>
                <p class="mt-2"><span [class]="ageBadge()">{{ oldestLabel() }}</span></p>
                <ul class="mt-3">
                  @for (g of d.grading.slice(0, 4); track g.courseId) {
                    <li>
                      <a class="flex min-h-11 items-center gap-2 text-ink no-underline hover:underline" [routerLink]="orgContext.path('courses', g.courseId, 'submissions')">
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
        }

        <section aria-labelledby="courses-title" class="card overflow-hidden">
          <div class="card-header">
            <h2 id="courses-title" class="section-title">{{ t('myDay.courses') }}</h2>
            @if (courses()?.length) {
              <div class="segmented" role="group" [attr.aria-label]="t('myDay.courses')">
                @for (f of filters; track f) {
                  <button type="button" class="segment" [attr.aria-pressed]="filter() === f" (click)="filter.set(f)">{{ t('myDay.' + f) }} <span class="ms-1 tabular-nums opacity-75">{{ countFor(f) }}</span></button>
                }
              </div>
            }
          </div>
          @if (courses(); as list) {
            @for (course of filtered(); track course.id) {
              <a class="list-row min-h-16 text-ink no-underline hover:bg-neutral-50" [routerLink]="orgContext.path('courses', course.id, 'curriculum')">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-ui bg-secondary-100 text-secondary-600"><mat-icon svgIcon="book-open" class="icon-size-5" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-bold">{{ course.title || '—' }}</span>
                  <span class="text-sm text-muted">{{ t('myDay.lessons', { count: course.lessonCount }) }}</span>
                </span>
                <span [class]="badge(course.status)">{{ t('courseStatus.' + course.status) }}</span>
              </a>
            } @empty {
              <div class="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted">
                <span class="empty-icon"><mat-icon svgIcon="book-open" class="icon-size-6" /></span>
                <span>{{ list.length ? t('myDay.noMatch') : t('myDay.noCourses') }}</span>
              </div>
            }
          } @else {
            <div aria-hidden="true" class="flex flex-col gap-2 p-4">@for (i of [1, 2, 3]; track i) { <div class="skeleton h-12"></div> }</div>
          }
        </section>
      </div>
    </ng-container>
  `,
})
export default class TeacherDashboardComponent {
  protected auth = inject(AuthService);
  protected orgContext = inject(OrgContextService);
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private transloco = inject(TranslocoService);

  protected readonly filters: CourseFilter[] = ['all', 'published', 'drafts'];
  protected courses = signal<CourseSummary[] | null>(null);
  protected day = signal<OrganizationOverview | null>(null);
  protected filter = signal<CourseFilter>('all');

  protected isSchool = computed(() => this.orgContext.activeOrg()?.type !== 'Personal');
  protected isCenter = computed(() => this.orgContext.activeOrg()?.type === 'Center');
  protected runsOrg = computed(() => {
    const org = this.orgContext.activeOrg();
    return !!org && this.orgContext.homePath(org).at(-1) === 'overview';
  });

  protected filtered = computed(() => {
    const list = this.courses() ?? [];
    const f = this.filter();
    return f === 'all' ? list : list.filter(c => (f === 'published' ? c.status === 'Published' : c.status === 'Draft'));
  });

  protected myClasses = computed(() => sortClasses(this.day()?.classes ?? []));
  protected allTaken = computed(() => {
    const today = this.day()?.today;
    return !!today?.expected && today.taken >= today.expected;
  });
  protected waitingTotal = computed(() => (this.day()?.grading ?? []).reduce((sum, g) => sum + g.waiting, 0));
  private oldestDays = computed(() => {
    const oldest = this.day()?.grading[0];
    return oldest ? daysWaiting(oldest.oldestSubmittedAtUtc) : 0;
  });
  protected oldestLabel = computed(() =>
    this.i18n.lang() && this.oldestDays()
      ? this.transloco.translate('overview.grading.oldest', { days: countOf('day', this.oldestDays(), this.i18n.lang()) })
      : this.transloco.translate('overview.grading.oldestToday'));
  protected ageBadge = computed(() => 'badge ' + (this.oldestDays() > 7 ? 'badge-danger' : this.oldestDays() > 3 ? 'badge-warning' : 'badge-neutral'));

  protected firstName = computed(() => {
    const user = this.auth.user();
    const name = (user?.name || user?.userName || '').trim();
    return name.split(/\s+/)[0] ?? name;
  });
  protected greetingKey = computed(() => (hourIn(this.orgContext.activeOrg()?.timeZone) < 12 ? 'myDay.morning' : 'myDay.evening'));
  protected today = computed(() => {
    const org = this.orgContext.activeOrg();
    return formatLongDay(todayIn(org?.timeZone), org?.calendar ?? 'Gregorian', this.i18n.lang());
  });

  constructor() {
    const org = this.orgContext.requireActiveSlug();
    this.http
      .get<ApiResponse<CourseSummary[]>>(ApiEndpoints.TeacherCourses.List(org))
      .pipe(map(r => r.data ?? []))
      .subscribe({ next: c => this.courses.set(c), error: () => this.courses.set([]) });
    if (!this.runsOrg() && this.orgContext.can('attendance.take')) {
      this.http.get<ApiResponse<OrganizationOverview>>(ApiEndpoints.School.MyDay(org)).subscribe({
        next: r => this.day.set(r.data ?? null),
        error: () => this.day.set(null),
      });
    }
  }

  protected countFor(f: CourseFilter): number {
    const list = this.courses() ?? [];
    return f === 'all' ? list.length : list.filter(c => (f === 'published' ? c.status === 'Published' : c.status === 'Draft')).length;
  }

  protected badge(status: string): string {
    return statusBadge(status);
  }

  protected todayBadge(c: OverviewClass): string {
    return c.today === 'Taken' ? 'badge badge-success' : 'badge badge-neutral';
  }

  protected todayLabel(c: OverviewClass): string {
    return this.transloco.translate(`overview.classes.status.${c.today}`);
  }
}
