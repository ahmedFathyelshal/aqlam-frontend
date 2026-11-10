import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatShortDay, todayIn } from '@/app/core/organizations/org-date';
import { AcademicsService, PublishedTerm } from '@/app/core/school/academics.service';
import { Child, ChildOverview, FamilyService } from '@/app/core/school/family.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { PortalBrand } from '@/app/shared/layout/portal-brand';
import { AqInkBar } from '@/app/shared/ui/ink-bar';
import { courseAverages, dayCount, summarizeChild } from './child-summary';

const RIBBON: Record<string, { color: string; height: string }> = {
  Present: { color: 'var(--color-primary-500)', height: '50%' },
  Excused: { color: 'var(--color-secondary-400)', height: '50%' },
  Late: { color: 'var(--color-warning-500)', height: '72%' },
  Absent: { color: 'var(--color-danger-600)', height: '100%' },
};

const TAG_TONES: Record<string, string> = {
  Absent: 'bg-danger-50 text-danger-700',
  Late: 'bg-warning-50 text-warning-700',
  Excused: 'bg-secondary-100 text-secondary-700',
  grade: 'bg-secondary-100 text-secondary-700',
  returned: 'bg-warning-50 text-warning-700',
};

type FeedItem = { key: string; tag: string; tone: string; text: string; when: string; at: number };

/** One child in one school: the judgement first, then attendance, grades and the latest events. Read-only. */
@Component({
  selector: 'app-child-overview',
  imports: [MatIconModule, RouterLink, TranslocoDirective, AqInkBar],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a class="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-secondary-600 no-underline hover:underline" routerLink="/parent"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('parent.back') }}</a>
          @if (siblings().length > 1) {
            <nav class="flex flex-wrap gap-2" [attr.aria-label]="t('parent.title')">
              @for (c of siblings(); track c.userId) {
                <a class="inline-flex min-h-11 items-center rounded-full border px-5.5 no-underline"
                   [class]="c.userId === childId() ? 'border-deep bg-deep font-bold text-white' : 'border-line-strong bg-white font-semibold text-ink'"
                   [attr.aria-current]="c.userId === childId() ? 'page' : null" [routerLink]="['/parent', org, 'children', c.userId]">{{ firstName(c.fullName) }}</a>
              }
            </nav>
          }
        </div>

        @if (notFound()) {
          <div class="empty">{{ t('parent.notLinked') }}</div>
        }

        @if (overview(); as o) {
          @if (today(); as status) {
            <div class="alert" [class]="status === 'Absent' ? 'alert-danger' : 'alert-warning'" role="status">
              <mat-icon svgIcon="circle-alert" class="icon-size-5 shrink-0" />
              <p class="font-bold">{{ status === 'Absent' ? t('parent.absentToday') : t('parent.lateToday') }}</p>
            </div>
          }

          @if (summary(); as s) {
            <section aria-labelledby="summary" class="rounded-hero border border-line bg-white p-5 shadow-[0_14px_36px_rgba(11,59,46,0.08)] lg:p-7.5">
              <p class="mb-1.5 text-muted">{{ o.fullName }}{{ o.classes.length ? ' · ' + o.classes.join('، ') : '' }}</p>
              <h1 id="summary" class="mb-2 font-display text-[2.25rem] leading-[1.12] font-bold text-balance lg:text-[3.125rem]">{{ t('parent.summary.' + s.grades + '_' + s.attendance, { name: firstName(o.fullName) }) }}</h1>
              <p class="mb-4.5 max-w-[38em] text-muted">{{ detail() }}</p>
              <div class="flex flex-wrap gap-2.5">
                <button type="button" class="btn min-h-12 flex-1 px-6 sm:flex-none" [class]="s.needsFollowUp ? 'btn-primary' : 'btn-outline'" [attr.aria-expanded]="contactOpen()" aria-controls="school-contact" (click)="contactOpen.set(!contactOpen())">{{ t('parent.contact') }}</button>
                @if (s.absent || s.late) {
                  <a class="btn btn-outline min-h-12 flex-1 px-5.5 sm:flex-none" routerLink="." fragment="latest">{{ t('parent.absenceDays') }}</a>
                }
              </div>
              @if (contactOpen()) {
                <div id="school-contact" class="mt-4 rounded-ui border border-line bg-page p-4">
                  <p class="mb-1 font-bold">{{ o.school.name }}</p>
                  @if (o.school.contactPhone || o.school.contactEmail) {
                    <div class="flex flex-wrap gap-x-5">
                      @if (o.school.contactPhone) {
                        <a class="inline-flex min-h-11 items-center gap-2 font-semibold" [href]="'tel:' + phoneHref(o.school.contactPhone)"><mat-icon svgIcon="phone" class="icon-size-4" /><span dir="ltr">{{ o.school.contactPhone }}</span></a>
                      }
                      @if (o.school.contactEmail) {
                        <a class="inline-flex min-h-11 items-center gap-2 font-semibold" [href]="'mailto:' + o.school.contactEmail"><mat-icon svgIcon="mail" class="icon-size-4" /><span dir="ltr">{{ o.school.contactEmail }}</span></a>
                      }
                    </div>
                  } @else {
                    <p class="text-muted">{{ t('parent.noContact') }}</p>
                  }
                </div>
              }
            </section>

            <div class="flex flex-wrap items-stretch gap-5">
              <section aria-labelledby="att" class="min-w-0 flex-[1_1_22.5rem] rounded-card border border-line bg-white p-5.5">
                <div class="mb-3.5 flex items-baseline justify-between gap-2">
                  <h2 id="att" class="section-title">{{ t('parent.attendance') }}</h2>
                  @if (s.days) { <span class="text-sm text-muted">{{ t('parent.lastSchoolDays', { days: daysLabel(s.days) }) }}</span> }
                </div>
                @if (s.days) {
                  <div role="img" [attr.aria-label]="detail()" class="mb-3.5 flex h-13 items-end gap-1">
                    @for (d of o.attendance.days; track d.date) {
                      <span class="flex-[1_1_0] rounded-[3px]" [title]="d.date + ' · ' + t('attendance.' + d.status)" [style.height]="ribbon(d.status).height" [style.background]="ribbon(d.status).color"></span>
                    }
                  </div>
                  <div class="grid gap-2 text-center" [class]="s.excused ? 'grid-cols-4' : 'grid-cols-3'">
                    <div class="rounded-ui bg-primary-100 px-1 py-2.5 text-primary-700"><div class="text-2xl leading-tight font-bold">{{ s.present }}</div><div class="text-sm">{{ t('attendance.Present') }}</div></div>
                    <div class="rounded-ui bg-danger-50 px-1 py-2.5 text-danger-700"><div class="text-2xl leading-tight font-bold">{{ s.absent }}</div><div class="text-sm">{{ t('attendance.Absent') }}</div></div>
                    <div class="rounded-ui bg-warning-50 px-1 py-2.5 text-warning-700"><div class="text-2xl leading-tight font-bold">{{ s.late }}</div><div class="text-sm">{{ t('attendance.Late') }}</div></div>
                    @if (s.excused) {
                      <div class="rounded-ui bg-secondary-100 px-1 py-2.5 text-secondary-700"><div class="text-2xl leading-tight font-bold">{{ s.excused }}</div><div class="text-sm">{{ t('attendance.Excused') }}</div></div>
                    }
                  </div>
                } @else {
                  <p class="text-muted">{{ t('parent.noAttendance') }}</p>
                }
              </section>

              <section aria-labelledby="grades" class="min-w-0 flex-[1_1_22.5rem] rounded-card border border-line bg-white p-5.5">
                <h2 id="grades" class="section-title">{{ t('parent.gradesTitle') }}</h2>
                <p class="mb-1.5 text-sm text-muted">{{ t('parent.gradesHint') }}</p>
                @for (c of o.courses; track c.courseId) {
                  <div class="border-b border-line-soft py-3">
                    <div class="mb-1.5 flex justify-between gap-2">
                      <span class="min-w-0 truncate font-semibold">{{ c.title }}</span>
                      @if (averages().get(c.courseId); as avg) {
                        <span class="flex-none font-bold text-secondary-600">{{ avg }}%</span>
                      } @else {
                        <span class="flex-none text-sm text-muted">{{ t('parent.noGradeYet') }}</span>
                      }
                    </div>
                    <aq-ink-bar [percent]="averages().get(c.courseId) ?? 0" [height]="8" />
                    <p class="mt-1 text-sm text-muted">{{ t('parent.lessonsDone', { percent: c.progressPercent }) }}</p>
                  </div>
                } @empty {
                  <p class="py-3 text-muted">{{ t('parent.noCourses') }}</p>
                }
                @for (term of terms(); track term.termId) {
                  <a class="flex min-h-12 items-center justify-between gap-2 text-ink no-underline" [routerLink]="['/parent', org, 'children', childId(), 'report-cards', term.termId]">
                    <span class="min-w-0 truncate font-semibold">{{ term.termName }} · {{ term.yearName }}</span>
                    <span class="flex-none font-semibold text-secondary-600">{{ t('report.open') }}</span>
                  </a>
                }
              </section>
            </div>

            <section id="latest" aria-labelledby="latest-title" class="rounded-card border border-line bg-white p-5.5">
              <h2 id="latest-title" class="section-title mb-1.5">{{ t('parent.latest') }}</h2>
              @for (item of feed(); track item.key) {
                <div class="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
                  <span class="min-w-14.5 flex-none rounded-full px-2 py-1 text-center text-sm font-semibold" [class]="item.tone">{{ item.tag }}</span>
                  <span class="min-w-0 flex-auto font-medium">{{ item.text }}</span>
                  <span class="flex-none text-sm text-muted">{{ item.when }}</span>
                </div>
              } @empty {
                <p class="py-3 text-muted">{{ t('parent.noResults') }}</p>
              }
            </section>
          }
        }
      </div>
    </ng-container>
  `,
})
export default class ChildOverviewComponent {
  private family = inject(FamilyService);
  private academics = inject(AcademicsService);
  private orgContext = inject(OrgContextService);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);
  private brand = inject(PortalBrand);

  protected org = this.route.snapshot.paramMap.get('org')!;
  protected childId = signal(this.route.snapshot.paramMap.get('childId')!);
  protected overview = signal<ChildOverview | null>(null);
  protected terms = signal<PublishedTerm[]>([]);
  protected notFound = signal(false);
  protected contactOpen = signal(false);
  private children = signal<Child[]>([]);

  private membership = computed(() => this.orgContext.memberships().find(m => m.slug === this.org));
  private calendar = computed(() => this.membership()?.calendar ?? 'Gregorian');
  protected siblings = computed(() => this.children().filter(c => c.organizations.some(o => o.slug === this.org)));
  protected summary = computed(() => {
    const o = this.overview();
    return o ? summarizeChild(o, o.school.summaryRules) : null;
  });
  protected averages = computed(() => courseAverages(this.overview()?.grades ?? []));

  /** Only the two statuses a parent must see at once, and only if recorded today. */
  protected today = computed(() => {
    const days = this.overview()?.attendance.days ?? [];
    const last = days[days.length - 1];
    return last && last.date === todayIn(this.membership()?.timeZone) && (last.status === 'Absent' || last.status === 'Late') ? last.status : null;
  });

  protected detail = computed(() => {
    const s = this.summary();
    if (!s) return '';
    if (!s.days) return s.grades === 'none' ? this.transloco.translate('parent.detail.noData') : this.transloco.translate('parent.noAttendance');
    const lang = this.i18n.lang();
    const params = { absent: dayCount(s.absent, lang), late: dayCount(s.late, lang), days: dayCount(s.days, lang) };
    const key = s.absent && s.late ? 'both' : s.absent ? 'absent' : s.late ? 'late' : 'clean';
    const text = this.transloco.translate(`parent.detail.${key}`, params);
    return s.mostAbsencesRecent ? `${text} ${this.transloco.translate('parent.detail.recent')}` : text;
  });

  protected feed = computed<FeedItem[]>(() => {
    const o = this.overview();
    if (!o) return [];
    const courseTitle = new Map(o.courses.map(c => [c.courseId, c.title]));

    const attendance: FeedItem[] = o.attendance.days.filter(d => d.status !== 'Present').map(d => ({
      key: `day-${d.date}`,
      tag: this.transloco.translate(`attendance.${d.status}`),
      tone: TAG_TONES[d.status],
      text: this.transloco.translate(`parent.feed.${d.status}`),
      when: this.shortDay(d.date),
      at: new Date(`${d.date}T12:00:00Z`).getTime(),
    }));

    const grades: FeedItem[] = o.grades.map((g, i) => {
      const subject = courseTitle.get(g.courseId);
      const name = [g.lessonTitle, subject].filter(Boolean).join(' · ');
      const returned = g.kind === 'Assignment' && g.score === null;
      return {
        key: `grade-${i}`,
        tag: this.transloco.translate(returned ? 'parent.returned' : 'parent.feed.grade'),
        tone: returned ? TAG_TONES['returned'] : TAG_TONES['grade'],
        text: returned ? name : g.kind === 'Quiz' ? `${name}: \u2066${Math.round(g.percent ?? 0)}%\u2069` : this.transloco.translate('parent.feed.score', { name, score: g.score, max: g.maxScore }),
        when: this.shortDay(g.atUtc),
        at: new Date(g.atUtc).getTime(),
      };
    });

    return [...attendance, ...grades].sort((a, b) => b.at - a.at).slice(0, 10);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.brand.current.set(null));
    this.family.children().subscribe(c => this.children.set(c));
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.childId.set(params.get('childId')!);
          this.overview.set(null);
          this.notFound.set(false);
          this.contactOpen.set(false);
          this.terms.set([]);
          this.academics.publishedTerms(this.org, params.get('childId')!).subscribe({ next: t => this.terms.set(t), error: () => this.terms.set([]) });
          return this.family.overview(this.org, params.get('childId')!);
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe({
        next: o => {
          this.overview.set(o);
          this.brand.current.set({ name: o.school.name, logoUrl: o.school.logoUrl });
        },
        error: () => this.notFound.set(true),
      });
  }

  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name; // usernames like s.omar stay whole
  }

  protected ribbon(status: string) {
    return RIBBON[status] ?? RIBBON['Present'];
  }

  protected daysLabel(days: number): string {
    return dayCount(days, this.i18n.lang());
  }

  protected phoneHref(phone: string): string {
    return phone.replace(/[^+\d]/g, '');
  }

  private shortDay(value: string): string {
    return formatShortDay(value, this.calendar(), this.i18n.lang(), this.membership()?.timeZone, {
      today: this.transloco.translate('day.today'),
      tomorrow: this.transloco.translate('day.tomorrow'),
    });
  }
}
