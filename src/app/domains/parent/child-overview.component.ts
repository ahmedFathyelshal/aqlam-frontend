import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgDatePipe, todayIn } from '@/app/core/organizations/org-date';
import { AcademicsService, PublishedTerm } from '@/app/core/school/academics.service';
import { Child, ChildOverview, FamilyService } from '@/app/core/school/family.service';

/** Read-only view of one child in one school or center: today, attendance, subjects and results. */
@Component({
  selector: 'app-child-overview',
  imports: [MatIconModule, RouterLink, TranslocoDirective, OrgDatePipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <a class="back-link" routerLink="/parent"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('parent.back') }}</a>

        @if (siblings().length > 1) {
          <div class="segmented mb-4" role="tablist">
            @for (c of siblings(); track c.userId) {
              <a class="segment no-underline" role="tab" [attr.aria-selected]="c.userId === childId()" [routerLink]="['/parent', org, 'children', c.userId]">{{ firstName(c.fullName) }}</a>
            }
          </div>
        }

        @if (notFound()) {
          <div class="empty mt-4">{{ t('parent.notLinked') }}</div>
        }

        @if (overview(); as o) {
          <header class="mb-4">
            <h1 class="page-title">{{ o.fullName }}</h1>
            <p class="page-subtitle">{{ orgName() }}{{ o.classes.length ? ' · ' + o.classes.join('، ') : '' }}</p>
          </header>

          @if (today(); as entry) {
            <div class="alert mb-4" [class]="entry.status === 'Absent' ? 'alert-danger' : 'alert-warning'" role="status">
              <mat-icon svgIcon="circle-alert" class="icon-size-5 shrink-0" />
              <div>
                <p class="font-extrabold">{{ entry.status === 'Absent' ? t('parent.absentToday') : t('parent.lateToday') }}</p>
                <p class="text-sm">{{ entry.className }}{{ entry.note ? ' · ' + entry.note : '' }}</p>
              </div>
            </div>
          }

          <section class="card card-body mb-4">
            <h2 class="section-title mb-3">{{ t('parent.attendance30') }}</h2>
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="rounded-[4px] bg-primary-100 py-2"><div class="text-2xl font-extrabold text-primary-700">{{ o.attendance.present }}</div><div class="text-xs text-primary-700">{{ t('attendance.Present') }}</div></div>
              <div class="rounded-[4px] bg-danger-50 py-2"><div class="text-2xl font-extrabold text-danger-700">{{ o.attendance.absent }}</div><div class="text-xs text-danger-700">{{ t('attendance.Absent') }}</div></div>
              <div class="rounded-[4px] bg-warning-50 py-2"><div class="text-2xl font-extrabold text-warning-700">{{ o.attendance.late }}</div><div class="text-xs text-warning-700">{{ t('attendance.Late') }}</div></div>
              <div class="rounded-[4px] bg-secondary-100 py-2"><div class="text-2xl font-extrabold text-secondary-600">{{ o.attendance.excused }}</div><div class="text-xs text-secondary-600">{{ t('attendance.Excused') }}</div></div>
            </div>
            @if (exceptions().length) {
              <h3 class="mt-4 mb-1 text-sm font-bold text-muted">{{ t('parent.recent') }}</h3>
              <ul>
                @for (a of exceptions(); track $index) {
                  <li class="flex items-center justify-between gap-2 border-t border-line-soft py-2 text-[0.95rem]">
                    <span>{{ a.date | orgDate: 'date' : calendar() }}{{ a.startTime ? ' · ' + a.startTime.slice(0, 5) : '' }}</span>
                    <span class="badge" [class]="a.status === 'Absent' ? 'badge-danger' : a.status === 'Late' ? 'badge-warning' : 'badge-info'">{{ t('attendance.' + a.status) }}</span>
                  </li>
                }
              </ul>
            }
          </section>

          <section class="card card-body mb-4">
            <h2 class="section-title mb-3">{{ t('parent.subjects') }}</h2>
            <div class="flex flex-col gap-4">
              @for (c of o.courses; track c.courseId) {
                <div>
                  <div class="flex justify-between gap-2 text-[0.95rem]"><span class="font-bold">{{ c.title }}</span><span class="font-bold text-primary-600">{{ c.progressPercent }}%</span></div>
                  <div class="progress mt-1.5"><span [style.width.%]="c.progressPercent"></span></div>
                  <p class="mt-1 text-xs text-muted">{{ c.lastAccessedAtUtc ? t('parent.lastStudied', { date: (c.lastAccessedAtUtc | orgDate: 'date' : calendar()) }) : t('parent.notStarted') }}</p>
                </div>
              } @empty {
                <p class="text-muted">{{ t('parent.noCourses') }}</p>
              }
            </div>
          </section>

          @if (terms().length) {
            <section class="card mb-4">
              <div class="card-header"><h2 class="section-title">{{ t('report.list') }}</h2></div>
              @for (term of terms(); track term.termId) {
                <div class="list-row">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-bold">{{ term.termName }}</p>
                    <p class="text-sm text-muted">{{ term.yearName }}</p>
                  </div>
                  <a class="btn btn-secondary btn-sm" [routerLink]="['/parent', org, 'children', childId(), 'report-cards', term.termId]">{{ t('report.open') }}</a>
                </div>
              }
            </section>
          }

          <section class="card">
            <div class="card-header"><h2 class="section-title">{{ t('parent.results') }}</h2></div>
            @for (g of o.grades; track $index) {
              <div class="list-row">
                <div class="min-w-0 flex-1">
                  <p class="truncate font-bold">{{ g.lessonTitle }}</p>
                  <p class="text-sm text-muted">{{ g.kind === 'Quiz' ? t('parent.quiz') : t('parent.assignment') }} · {{ g.atUtc | orgDate: 'date' : calendar() }}</p>
                </div>
                @if (g.kind === 'Quiz') {
                  <span class="badge" [class]="g.status === 'Passed' ? 'badge-success' : 'badge-warning'">{{ g.status === 'Passed' ? t('parent.passed') : t('parent.notPassed') }} · {{ g.percent }}%</span>
                } @else if (g.score !== null) {
                  <span class="text-lg font-extrabold text-secondary-600" dir="ltr">{{ g.score }} / {{ g.maxScore }}</span>
                } @else {
                  <span class="badge badge-warning">{{ t('parent.returned') }}</span>
                }
              </div>
            } @empty {
              <p class="px-5 py-6 text-center text-muted">{{ t('parent.noResults') }}</p>
            }
          </section>
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

  protected org = this.route.snapshot.paramMap.get('org')!;
  protected childId = signal(this.route.snapshot.paramMap.get('childId')!);
  protected overview = signal<ChildOverview | null>(null);
  protected terms = signal<PublishedTerm[]>([]);
  protected notFound = signal(false);
  private children = signal<Child[]>([]);

  private membership = computed(() => this.orgContext.memberships().find(m => m.slug === this.org));
  protected orgName = computed(() => this.membership()?.name ?? '');
  protected calendar = computed(() => this.membership()?.calendar ?? 'Gregorian');
  protected siblings = computed(() => this.children().filter(c => c.organizations.some(o => o.slug === this.org)));
  protected exceptions = computed(() => (this.overview()?.attendance.recent ?? []).filter(a => a.status !== 'Present').slice(0, 5));
  protected today = computed(() => {
    const first = this.overview()?.attendance.recent[0];
    return first && first.date === todayIn(this.membership()?.timeZone) && (first.status === 'Absent' || first.status === 'Late') ? first : null;
  });

  constructor() {
    this.family.children().subscribe(c => this.children.set(c));
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.childId.set(params.get('childId')!);
          this.overview.set(null);
          this.notFound.set(false);
          this.terms.set([]);
          this.academics.publishedTerms(this.org, params.get('childId')!).subscribe({ next: t => this.terms.set(t), error: () => this.terms.set([]) });
          return this.family.overview(this.org, params.get('childId')!);
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe({ next: o => this.overview.set(o), error: () => this.notFound.set(true) });
  }

  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name; // usernames like s.omar stay whole
  }
}
