import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { LearningService, MyCourse } from '@/app/core/learning/learning.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { I18nService } from '@/app/core/transloco/i18n.service';

/** Student home: continue learning, all courses (school, centers, teachers) and joining with a code. */
@Component({
  selector: 'student-dashboard',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="mb-5">
          <h1 class="page-title">{{ t('student.hello', { name: auth.user()?.name || auth.user()?.userName }) }}</h1>
          <p class="page-subtitle">{{ today() }}</p>
        </header>

        <div class="grid gap-5 lg:grid-cols-3">
          <div class="flex flex-col gap-5 lg:col-span-2">
            @if (current(); as c) {
              <section class="rounded-[6px] bg-primary-600 p-5 text-white">
                <p class="text-sm text-primary-100">{{ t('student.continue') }}</p>
                <h2 class="mt-1 text-xl font-extrabold">{{ c.courseTitle }}</h2>
                <p class="text-sm text-primary-100">{{ c.organizationName }}</p>
                <div class="mt-3 flex items-center gap-3">
                  <div class="h-2 flex-1 overflow-hidden rounded-[2px] bg-white/25"><div class="h-full bg-white" [style.width.%]="c.progressPercent"></div></div>
                  <span class="text-sm font-bold">{{ c.progressPercent }}%</span>
                </div>
                <a class="btn mt-4 w-full bg-white text-primary-700 hover:bg-primary-50 sm:w-auto" [routerLink]="courseLink(c)">{{ t('student.continueBtn') }}</a>
              </section>
            }

            <section class="card">
              <div class="card-header"><h2 class="section-title">{{ t('student.myCourses') }}</h2></div>
              @if (courses(); as list) {
                @for (course of list; track course.courseId) {
                  <div class="list-row flex-wrap" [class.opacity-60]="course.isExpired">
                    <span class="flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-secondary-100 text-secondary-600"><mat-icon svgIcon="book-open" class="icon-size-5" /></span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-bold">{{ course.courseTitle }}</p>
                      <p class="text-sm text-muted">
                        {{ course.organizationName }}
                        @if (course.isExpired) { · {{ t('student.expired') }} } @else if (course.expiresAtUtc) { · {{ t('student.until', { date: date(course.expiresAtUtc) }) }} }
                      </p>
                      <div class="mt-2 flex items-center gap-2"><div class="progress flex-1"><span [style.width.%]="course.progressPercent"></span></div><span class="w-10 text-end text-sm text-muted">{{ course.progressPercent }}%</span></div>
                    </div>
                    @if (!course.isExpired) {
                      <a class="btn btn-secondary btn-sm" [routerLink]="courseLink(course)">{{ course.progressPercent > 0 ? t('action.continue') : t('student.start') }}</a>
                    }
                  </div>
                } @empty {
                  <p class="px-5 py-8 text-center text-muted">{{ t('student.none') }}</p>
                }
              } @else {
                <p class="px-5 py-8 text-center text-muted">{{ t('loading') }}</p>
              }
            </section>
          </div>

          <section class="card card-body h-fit">
            <h2 class="section-title">{{ t('student.haveCode') }}</h2>
            <p class="field-hint mt-1">{{ t('student.codeHint') }}</p>
            <form class="mt-3 flex flex-col gap-2" (submit)="$event.preventDefault(); join()">
              <input class="input font-mono tracking-[0.25em] uppercase" dir="ltr" maxlength="16" placeholder="ABCD2345" autocomplete="off" [attr.aria-label]="t('student.haveCode')" [value]="joinCode()" (input)="joinCode.set($any($event.target).value)" />
              <button type="submit" class="btn btn-primary" [disabled]="joining() || !joinCode().trim()">{{ t('student.join') }}</button>
            </form>
            @if (joinMessage(); as m) {
              <div class="alert mt-3" [class]="m.kind === 'error' ? 'alert-danger' : 'alert-success'" role="status">{{ m.text }}</div>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
})
export default class StudentDashboardComponent {
  protected auth = inject(AuthService);
  private learning = inject(LearningService);
  private orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);

  protected courses = signal<MyCourse[] | null>(null);
  protected joinCode = signal('');
  protected joining = signal(false);
  protected joinMessage = signal<{ kind: 'error' | 'success'; text: string } | null>(null);

  /** The most recently studied course that is still open (the list comes most recent first). */
  protected current = computed(() => (this.courses() ?? []).find(c => !c.isExpired && c.lastAccessedAtUtc && c.progressPercent < 100) ?? null);
  protected today = computed(() => {
    const org = this.orgContext.memberships()[0];
    return formatOrgDate(todayIn(org?.timeZone), org?.calendar ?? 'Gregorian', { locale: this.i18n.lang() });
  });

  constructor() {
    this.learning.myCourses().subscribe({ next: c => this.courses.set(c), error: () => this.courses.set([]) });
  }

  protected date(value: string): string {
    return formatOrgDate(value, 'Gregorian', { locale: this.i18n.lang() });
  }

  protected courseLink(course: MyCourse): string[] {
    return course.lastLessonId
      ? ['/learn', course.organizationSlug, course.courseId, course.lastLessonId]
      : ['/learn', course.organizationSlug, course.courseId];
  }

  protected join(): void {
    const code = this.joinCode().trim();
    if (!code) return;

    this.joining.set(true);
    this.joinMessage.set(null);
    this.learning.joinWithCode(code).subscribe({
      next: result => {
        this.joining.set(false);
        this.joinCode.set('');
        this.joinMessage.set({
          kind: 'success',
          text: this.transloco.translate(result.membershipStatus === 'Pending' ? 'student.pending' : 'student.joined', { name: result.name }),
        });
        this.orgContext.load().subscribe();
      },
      error: (err: unknown) => {
        this.joining.set(false);
        const key = err instanceof HttpErrorResponse && err.status === 409 ? 'student.already'
          : err instanceof HttpErrorResponse && err.status === 429 ? 'student.tooMany' : 'student.invalid';
        this.joinMessage.set({ kind: 'error', text: this.transloco.translate(key) });
      },
    });
  }
}
