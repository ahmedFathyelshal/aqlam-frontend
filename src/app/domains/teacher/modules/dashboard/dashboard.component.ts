import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { map } from 'rxjs';

import { AuthService } from '@/app/core/auth/auth.service';
import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { ApiResponse } from '@/app/core/models/api-response.model';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ClassSummary, SchoolService } from '@/app/core/school/school.service';

/** Row of the organization's course list. */
export type CourseSummary = {
  chapterCount: number;
  id: string;
  lessonCount: number;
  status: string;
  title: string;
  visibility: string;
};

const STATUS_BADGE: Record<string, string> = {
  Published: 'badge-success',
  Scheduled: 'badge-info',
  Draft: 'badge-warning',
  Archived: 'badge-neutral',
  Suspended: 'badge-danger',
};

/** Staff home: quick actions, the classes the user teaches and the organization's courses. */
@Component({
  selector: 'teacher-dashboard',
  imports: [TranslocoDirective, MatIconModule, RouterLink],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('dash.hello', { name: auth.user()?.name || auth.user()?.userName }) }}</h1>
            <p class="page-subtitle">{{ t('dash.intro', { org: orgContext.activeOrg()?.name }) }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            @if (isSchool() && orgContext.can('attendance.take')) {
              <a class="btn btn-primary" [routerLink]="orgContext.path('classes')"><mat-icon svgIcon="calendar-check" class="icon-size-5" />{{ t('dash.takeAttendance') }}</a>
            }
            @if (orgContext.can('courses.edit')) {
              <a class="btn btn-secondary" [routerLink]="orgContext.path('courses', 'new')"><mat-icon svgIcon="plus" class="icon-size-5" />{{ t('dash.newCourse') }}</a>
            }
          </div>
        </header>

        <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          @if (isSchool()) {
            <div class="stat"><div class="stat-label">{{ t('dash.classesCount') }}</div><div class="stat-value text-ink">{{ classes().length }}</div></div>
          }
          <div class="stat"><div class="stat-label">{{ t('dash.published') }}</div><div class="stat-value text-primary-600">{{ publishedCount() }}</div></div>
          <div class="stat"><div class="stat-label">{{ t('dash.drafts') }}</div><div class="stat-value text-warning-700">{{ draftCount() }}</div></div>
        </section>

        <div class="grid gap-6 lg:grid-cols-5">
          @if (isSchool()) {
            <section class="card lg:col-span-2">
              <div class="card-header">
                <h2 class="section-title">{{ t('dash.myClasses') }}</h2>
                <a class="text-sm font-bold" [routerLink]="orgContext.path('classes')">{{ t('action.viewAll') }}</a>
              </div>
              @for (c of classes(); track c.id) {
                <div class="list-row">
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-primary-100 text-primary-700"><mat-icon svgIcon="school" class="icon-size-5" /></span>
                  <a class="min-w-0 flex-1 text-ink no-underline" [routerLink]="orgContext.path('classes', c.id)">
                    <span class="block truncate font-bold">{{ c.name }}</span>
                    <span class="text-sm text-muted">{{ t('dash.students', { count: c.studentCount }) }}{{ c.branchName ? ' · ' + c.branchName : '' }}</span>
                  </a>
                  @if (orgContext.can('attendance.take')) {
                    <a class="btn btn-secondary btn-sm" [routerLink]="orgContext.path('classes', c.id, 'attendance')">{{ t('classes.detail.attendance') }}</a>
                  }
                </div>
              } @empty {
                <p class="px-5 py-8 text-center text-muted">{{ t('dash.noClasses') }}</p>
              }
            </section>
          }

          <section class="card" [class.lg:col-span-3]="isSchool()" [class.lg:col-span-5]="!isSchool()">
            <div class="card-header"><h2 class="section-title">{{ t('dash.courses') }}</h2></div>
            @for (course of courses(); track course.id) {
              <a class="list-row text-ink no-underline hover:bg-neutral-50" [routerLink]="orgContext.path('courses', course.id, 'curriculum')">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-secondary-100 text-secondary-600"><mat-icon svgIcon="book-open" class="icon-size-5" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-bold">{{ course.title || '—' }}</span>
                  <span class="text-sm text-muted">{{ t('dash.lessons', { count: course.lessonCount }) }}</span>
                </span>
                <span class="badge" [class]="badge(course.status)">{{ t('courseStatus.' + course.status) }}</span>
              </a>
            } @empty {
              <p class="px-5 py-8 text-center text-muted">{{ t('dash.noCourses') }}</p>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
})
export default class TeacherDashboardComponent {
  protected auth = inject(AuthService);
  protected orgContext = inject(OrgContextService);
  private http = inject(HttpClient);
  private school = inject(SchoolService);

  protected courses = signal<CourseSummary[]>([]);
  protected classes = signal<ClassSummary[]>([]);
  protected isSchool = computed(() => this.orgContext.activeOrg()?.type !== 'Personal');
  protected publishedCount = computed(() => this.courses().filter(c => c.status === 'Published').length);
  protected draftCount = computed(() => this.courses().filter(c => c.status === 'Draft').length);

  constructor() {
    const org = this.orgContext.requireActiveSlug();
    this.http
      .get<ApiResponse<CourseSummary[]>>(ApiEndpoints.TeacherCourses.List(org))
      .pipe(map(r => r.data ?? []))
      .subscribe({ next: c => this.courses.set(c), error: () => this.courses.set([]) });
    if (this.isSchool() && this.orgContext.can('members.view')) {
      this.school.classes(org, true).subscribe({ next: c => this.classes.set(c), error: () => this.classes.set([]) });
    }
  }

  protected badge(status: string): string {
    return 'badge ' + (STATUS_BADGE[status] ?? 'badge-neutral');
  }
}
