import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '@/app/core/auth/auth.service';
import { DueItem, LatestResult, LearnerHome, LearningService, MyCourse, NextLesson } from '@/app/core/learning/learning.service';
import { subjectColors, subjectMark } from '@/app/core/learning/subject-look';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatLongDay, formatShortDay, hourIn, todayIn } from '@/app/core/organizations/org-date';
import { AcademicsService } from '@/app/core/school/academics.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { AqInkBar } from '@/app/shared/ui/ink-bar';

type OrgItem<T> = T & { slug: string };

/** Student home: what to study now, what is due, every subject, and the latest result. */
@Component({
  selector: 'student-dashboard',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqInkBar],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="mb-5">
          <p class="text-muted">{{ today() }}</p>
          <h1 class="font-display text-[2.5rem] leading-[1.1] font-bold lg:text-[3.5rem]">{{ t(greetingKey(), { name: firstName() }) }}</h1>
        </header>

        <div class="flex flex-wrap items-start gap-5.5">
          <div class="flex min-w-0 flex-[999_1_35rem] flex-col gap-5.5">
            @if (nextCard(); as next) {
              <section aria-labelledby="next-title" class="relative overflow-hidden rounded-hero p-5.5 text-white lg:p-8" [style.background]="next.color">
                <svg aria-hidden="true" class="absolute inset-0 size-full">
                  <defs><pattern id="next-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0 L0 44 M0 0 L44 44" stroke="#FFFFFF" opacity="0.06" /></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#next-grid)" />
                </svg>
                <div class="relative">
                  <p class="mb-1.5 font-semibold text-white/85">{{ t('student.nextFor', { subject: next.course.courseTitle }) }}</p>
                  <h2 id="next-title" class="mb-1.5 font-display text-[2.5rem] leading-[1.1] font-bold lg:text-[3.375rem]">{{ next.title }}</h2>
                  @if (next.detail) { <p class="mb-4.5 text-white/90">{{ next.detail }}</p> }
                  <aq-ink-bar class="mt-3 mb-1.5 max-w-[460px]" [percent]="next.course.progressPercent" color="#FFFFFF" track="#FFFFFF" [trackOpacity]="0.22" [height]="14" />
                  <p class="mb-5 text-sm text-white/90">{{ t('student.completed', { percent: next.course.progressPercent }) }}</p>
                  <a class="inline-flex min-h-13 w-full items-center justify-center rounded-ui bg-white px-8.5 text-[1.0625rem] font-bold no-underline sm:w-auto" [style.color]="next.color" [routerLink]="next.link">{{ t('student.continueBtn') }}</a>
                </div>
              </section>
            } @else if (courses(); as list) {
              @if (list.length) {
                <section class="rounded-hero bg-primary-600 p-5.5 text-white lg:p-8">
                  <h2 class="font-display text-[2.5rem] leading-[1.1] font-bold">{{ t('student.allDone') }}</h2>
                  <p class="mt-1 text-white/90">{{ t('student.allDoneHint') }}</p>
                </section>
              }
            }

            @if (due().length) {
              <section aria-labelledby="due-title">
                <h2 id="due-title" class="section-title mb-2.5">{{ t('student.dueTitle') }}</h2>
                <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                  @for (item of due(); track item.lessonId) {
                    <a class="flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3.5 text-ink no-underline hover:border-line-strong" [routerLink]="['/learn', item.slug, item.courseId, item.lessonId]">
                      <span class="min-w-14.5 flex-none rounded-chip px-2 py-1.5 text-center text-sm font-bold" [class]="dueTone(item)">{{ dueLabel(item) }}</span>
                      <span class="min-w-0">
                        <span class="block truncate font-semibold">{{ item.title }}</span>
                        <span class="block truncate text-sm text-muted">{{ item.courseTitle }}</span>
                      </span>
                    </a>
                  }
                </div>
              </section>
            }

            <section id="subjects" aria-labelledby="subjects-title">
              <h2 id="subjects-title" class="section-title mb-2.5">{{ t('student.myCourses') }}</h2>
              @if (courses(); as list) {
                <div class="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
                  @for (course of list; track course.courseId) {
                    <a class="block overflow-hidden rounded-card border border-line bg-white text-ink no-underline hover:border-line-strong"
                       [class.pointer-events-none]="course.isExpired" [class.opacity-60]="course.isExpired"
                       [attr.aria-disabled]="course.isExpired || null" [attr.tabindex]="course.isExpired ? -1 : null"
                       [routerLink]="courseLink(course)">
                      <span aria-hidden="true" class="flex h-26 items-center justify-center font-display text-[3.875rem] leading-none font-bold text-white" [style.background]="color(course)">{{ mark(course) }}</span>
                      <span class="block px-4 pt-3.5 pb-4">
                        <span class="block truncate text-[1.0625rem] font-bold">{{ course.courseTitle }}</span>
                        <span class="mb-2.5 block truncate text-sm text-muted">{{ subjectLine(course) }}</span>
                        <aq-ink-bar [percent]="course.progressPercent" [color]="color(course)" />
                        <span class="mt-1.5 block text-sm font-semibold text-muted">{{ course.progressPercent }}%</span>
                      </span>
                    </a>
                  } @empty {
                    <p class="empty col-span-full">{{ t('student.none') }}</p>
                  }
                </div>
              } @else {
                <p class="py-8 text-center text-muted">{{ t('loading') }}</p>
              }
            </section>
          </div>

          <aside class="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-5.5">
            <section id="results" aria-labelledby="result-title" class="rounded-card border border-line bg-white p-5">
              <h2 id="result-title" class="section-title mb-3.5">{{ t('student.latestResult') }}</h2>
              @if (latest(); as result) {
                <div class="flex items-center gap-4">
                  <svg role="img" [attr.aria-label]="roundedPercent(result) + '%'" viewBox="0 0 84 84" width="84" height="84" class="flex-none">
                    <circle cx="42" cy="42" r="35" fill="none" stroke-width="8" [style.stroke]="isAchievement(result) ? 'var(--color-gold-100)' : 'var(--color-secondary-100)'" />
                    <circle cx="42" cy="42" r="35" fill="none" stroke-width="8" stroke-linecap="round" pathLength="100" transform="rotate(-90 42 42)"
                            [attr.stroke-dasharray]="roundedPercent(result) + ' 100'" [style.stroke]="isAchievement(result) ? 'var(--color-gold-500)' : 'var(--color-secondary-600)'" />
                    <text x="42" y="49" text-anchor="middle" font-weight="700" [attr.font-size]="roundedPercent(result) >= 100 ? 18 : 21" [style.fill]="isAchievement(result) ? 'var(--color-gold-800)' : 'var(--color-secondary-700)'">{{ roundedPercent(result) }}%</text>
                  </svg>
                  <div class="min-w-0">
                    @if (isAchievement(result)) {
                      <p class="flex items-center gap-1.5 text-[1.0625rem] font-bold">
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" class="flex-none"><path d="M12 2.5 L14.9 8.6 L21.5 9.4 L16.6 14 L17.9 20.6 L12 17.3 L6.1 20.6 L7.4 14 L2.5 9.4 L9.1 8.6 Z" fill="var(--color-gold-500)" /></svg>
                        {{ t('student.wellDone', { name: firstName() }) }}
                      </p>
                    }
                    <p class="text-[0.9375rem] text-muted"><bdi>{{ result.title }}</bdi> · <bdi>{{ result.courseTitle }}</bdi></p>
                    <a class="mt-1 inline-flex min-h-11 items-center text-[0.9375rem] font-semibold" [routerLink]="['/learn', result.slug, result.courseId, result.lessonId]">{{ t('student.viewResult') }}</a>
                  </div>
                </div>
              } @else {
                <p class="text-muted">{{ t('student.noResult') }}</p>
              }
            </section>

            @if (reportCards().length) {
              <section aria-labelledby="cards-title" class="rounded-card border border-line bg-white p-5">
                <h2 id="cards-title" class="section-title mb-2">{{ t('report.list') }}</h2>
                @for (r of reportCards(); track r.termId) {
                  <a class="flex min-h-11 items-center justify-between gap-3 py-1 text-ink no-underline" [routerLink]="['/student', r.slug, 'report-cards', r.termId]">
                    <span class="min-w-0">
                      <span class="block truncate font-semibold">{{ r.termName }}</span>
                      <span class="block truncate text-sm text-muted">{{ r.yearName }} · {{ r.orgName }}</span>
                    </span>
                    <span class="flex-none font-semibold text-secondary-600">{{ t('report.open') }}</span>
                  </a>
                }
              </section>
            }

            <section>
              @if (showJoin()) {
                <div class="rounded-card border border-line bg-white p-5">
                  <h2 class="section-title">{{ t('student.haveCode') }}</h2>
                  <p class="field-hint mt-1">{{ t('student.codeHint') }}</p>
                  <form class="mt-3 flex flex-col gap-2" (submit)="$event.preventDefault(); join()">
                    <input class="input font-mono tracking-[0.25em] uppercase" dir="ltr" maxlength="16" placeholder="ABCD2345" autocomplete="off" [attr.aria-label]="t('student.haveCode')" [value]="joinCode()" (input)="joinCode.set($any($event.target).value)" />
                    <button type="submit" class="btn btn-primary" [disabled]="joining() || !joinCode().trim()">{{ t('student.join') }}</button>
                  </form>
                  @if (joinMessage(); as m) {
                    <div class="alert mt-3" [class]="m.kind === 'error' ? 'alert-danger' : 'alert-success'" role="status">{{ m.text }}</div>
                  }
                </div>
              } @else {
                <button type="button" class="flex min-h-11 cursor-pointer items-center font-semibold text-secondary-600 underline" (click)="joinOpen.set(true)">{{ t('student.joinLink') }}</button>
              }
            </section>

            <!-- Activation cards (12 characters) open one course; the join code above joins a school or center. -->
            <section class="rounded-card border border-line bg-white p-5">
              <h2 class="section-title flex items-center gap-2"><mat-icon svgIcon="key-round" class="icon-size-5 text-primary-600" />{{ t('codes.homeTitle') }}</h2>
              <p class="field-hint mt-1">{{ t('codes.homeBody') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <a class="btn btn-outline min-h-11" routerLink="/redeem">{{ t('codes.activate') }}</a>
                <a class="btn btn-ghost min-h-11 text-secondary-600" routerLink="/search"><mat-icon svgIcon="search" class="icon-size-4" />{{ t('market.notFoundAction') }}</a>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </ng-container>
  `,
})
export default class StudentDashboardComponent {
  protected auth = inject(AuthService);
  private learning = inject(LearningService);
  private academics = inject(AcademicsService);
  private orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);

  protected courses = signal<MyCourse[] | null>(null);
  private homes = signal<{ slug: string; home: LearnerHome }[]>([]);
  protected reportCards = signal<{ termId: string; termName: string; yearName: string; slug: string; orgName: string }[]>([]);
  protected joinOpen = signal(false);
  protected joinCode = signal('');
  protected joining = signal(false);
  protected joinMessage = signal<{ kind: 'error' | 'success'; text: string } | null>(null);

  private org = computed(() => this.orgContext.memberships()[0]);
  private nextLessons = computed(() => {
    const byCourse = new Map<string, NextLesson>();
    for (const { home } of this.homes()) for (const lesson of home.nextLessons) byCourse.set(lesson.courseId, lesson);
    return byCourse;
  });
  private colors = computed(() => subjectColors((this.courses() ?? []).map(c => c.courseId)));
  private hasManyOrgs = computed(() => new Set((this.courses() ?? []).map(c => c.organizationSlug)).size > 1);

  protected firstName = computed(() => {
    const user = this.auth.user();
    const name = (user?.name || user?.userName || '').trim();
    return name.split(/\s+/)[0] ?? name; // usernames like s.omar stay whole
  });
  protected greetingKey = computed(() => (hourIn(this.org()?.timeZone) < 12 ? 'student.morning' : 'student.evening'));
  protected today = computed(() =>
    formatLongDay(todayIn(this.org()?.timeZone), this.org()?.calendar ?? 'Gregorian', this.i18n.lang())
  );

  /** The most recently used course that still has a lesson to open (the list comes most recent first). */
  protected nextCard = computed(() => {
    const open = (this.courses() ?? []).filter(c => !c.isExpired);
    const course = open.find(c => this.nextLessons().has(c.courseId));
    if (course) {
      const lesson = this.nextLessons().get(course.courseId)!;
      return {
        course,
        title: lesson.title,
        detail: this.lessonDetail(lesson),
        link: ['/learn', course.organizationSlug, course.courseId, lesson.lessonId],
        color: this.color(course),
      };
    }
    // The summary did not load: still offer the course, without inventing a lesson.
    const fallback = this.homes().length ? null : open.find(c => c.progressPercent < 100);
    return fallback
      ? { course: fallback, title: fallback.courseTitle, detail: fallback.organizationName, link: this.courseLink(fallback), color: this.color(fallback) }
      : null;
  });

  protected due = computed<OrgItem<DueItem>[]>(() =>
    this.homes()
      .flatMap(({ slug, home }) => home.due.map(item => ({ ...item, slug })))
      .sort((a, b) => a.dueAtUtc.localeCompare(b.dueAtUtc))
  );

  /** Each school decides from which score a result counts as an achievement (the gold treatment). */
  protected latest = computed<OrgItem<LatestResult & { achievementPercent: number }> | null>(() => {
    const results = this.homes().flatMap(({ slug, home }) =>
      home.latestResult ? [{ ...home.latestResult, slug, achievementPercent: home.achievementPercent }] : []
    );
    return results.sort((a, b) => b.atUtc.localeCompare(a.atUtc))[0] ?? null;
  });

  protected showJoin = computed(() => this.joinOpen() || this.courses()?.length === 0);

  constructor() {
    this.loadCourses();
    effect(() => {
      const me = this.auth.user()?.id;
      const schools = this.orgContext.memberships().filter(m => m.roles.includes('Student'));
      this.reportCards.set([]);
      if (!me) return;
      for (const org of schools) {
        this.academics.publishedTerms(org.slug, me).subscribe({
          next: terms => this.reportCards.update(list => [...list, ...terms.map(t => ({ ...t, slug: org.slug, orgName: org.name }))]),
          error: () => undefined, // report cards are optional here; the rest of the page still works
        });
      }
    });
  }

  protected color(course: MyCourse): string {
    return this.colors().get(course.courseId) ?? 'var(--color-subject-blue)';
  }

  protected mark(course: MyCourse): string {
    return subjectMark(course.courseTitle);
  }

  protected courseLink(course: MyCourse): string[] {
    const next = this.nextLessons().get(course.courseId)?.lessonId ?? course.lastLessonId;
    return next ? ['/learn', course.organizationSlug, course.courseId, next] : ['/learn', course.organizationSlug, course.courseId];
  }

  protected subjectLine(course: MyCourse): string {
    if (course.isExpired) return this.transloco.translate('student.expired');
    const next = this.nextLessons().get(course.courseId);
    const line = next ? this.transloco.translate('student.nextLesson', { title: next.title })
      : course.progressPercent >= 100 ? this.transloco.translate('student.finished')
      : course.organizationName;
    return this.hasManyOrgs() && next ? `${course.organizationName} · ${line}` : line;
  }

  protected dueLabel(item: DueItem): string {
    if (item.isOverdue) return this.transloco.translate('student.overdue');
    const org = this.org();
    return formatShortDay(item.dueAtUtc, org?.calendar ?? 'Gregorian', this.i18n.lang(), org?.timeZone, {
      today: this.transloco.translate('day.today'),
      tomorrow: this.transloco.translate('day.tomorrow'),
    });
  }

  protected dueTone(item: DueItem): string {
    if (item.isOverdue) return 'bg-danger-50 text-danger-700';
    const hoursLeft = (new Date(item.dueAtUtc).getTime() - Date.now()) / 3_600_000;
    return hoursLeft <= 48 ? 'bg-warning-50 text-warning-700' : 'bg-secondary-100 text-secondary-700';
  }

  protected roundedPercent(result: LatestResult): number {
    return Math.round(result.percent);
  }

  protected isAchievement(result: LatestResult & { achievementPercent: number }): boolean {
    return result.percent >= result.achievementPercent;
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
        this.loadCourses();
      },
      error: (err: unknown) => {
        this.joining.set(false);
        const key = err instanceof HttpErrorResponse && err.status === 409 ? 'student.already'
          : err instanceof HttpErrorResponse && err.status === 429 ? 'student.tooMany' : 'student.invalid';
        this.joinMessage.set({ kind: 'error', text: this.transloco.translate(key) });
      },
    });
  }

  private lessonDetail(lesson: NextLesson): string {
    const minutes = lesson.durationInMinutes ? this.transloco.translate('student.minutes', { count: lesson.durationInMinutes }) : null;
    // Isolated: a teacher's Arabic title must not reorder the rest of an English line, and vice versa.
    return [`\u2068${lesson.chapterTitle}\u2069`, minutes].filter(Boolean).join(' · ');
  }

  private loadCourses(): void {
    this.learning.myCourses().subscribe({
      next: list => {
        this.courses.set(list);
        const slugs = [...new Set(list.filter(c => !c.isExpired).map(c => c.organizationSlug))];
        if (!slugs.length) return;
        // One organization failing must not empty the page for the others.
        forkJoin(slugs.map(slug => this.learning.home(slug).pipe(catchError(() => of(null))))).subscribe(homes => {
          this.homes.set(homes.flatMap((home, i) => (home ? [{ slug: slugs[i], home }] : [])));
        });
      },
      error: () => this.courses.set([]),
    });
  }
}
