import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { pluralKey } from '@/app/core/transloco/plural';

import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import {
  CourseCard,
  Facets,
  FeaturedTeacher,
  Gender,
  MarketplaceService,
  SearchFilters,
  TeacherCard,
  TEST_PREP,
  TestPrepKey,
} from '@/app/core/marketplace/marketplace.service';
import { AqCardSkeleton, AqCourseCard, AqTeacherCard, subjectColor } from '@/app/shared/marketplace/market-ui';

type Tab = 'courses' | 'teachers';
type Filters = { q: string; tab: Tab; country: string; subjectId: number | null; gradeId: number | null; gender: Gender | null; free: boolean };

const PAGE = 12;
const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

/**
 * The public search hub (story 3.5.1) and, with route data `prep`, the Qudrat/Tahsili pages (3.5.2). Open before
 * sign-in. Everything the visitor chose lives in the address, so a parent can share the exact results.
 */
@Component({
  selector: 'app-market-search',
  imports: [NgTemplateOutlet, RouterLink, MatIconModule, TranslocoDirective, AqCourseCard, AqTeacherCard, AqCardSkeleton],
  template: `
    <ng-container *transloco="let t">
      <!-- Band: title (or test intro), search field, country -->
      <section class="relative overflow-hidden bg-primary-600 text-white">
        <svg aria-hidden="true" class="absolute inset-0 size-full">
          <defs><pattern id="search-lattice" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M48 0 L60 36 L96 48 L60 60 L48 96 L36 60 L0 48 L36 36 Z" fill="none" stroke="#FFFFFF" opacity="0.055" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#search-lattice)" />
        </svg>
        <div class="relative mx-auto max-w-[1240px] px-4 pt-5 pb-14 lg:px-10 lg:pt-9 lg:pb-16">
          @if (prep(); as p) {
            <p class="text-sm font-bold text-primary-100">{{ t('market.prepPage.kicker') }}</p>
            <h1 class="mt-1 font-display text-[2.125rem] leading-[1.1] font-bold text-balance lg:text-[3rem]">{{ t('market.prepPage.' + p + 'Title') }}</h1>
            <p class="mt-2 max-w-[40em] text-[#E3ECE6]">{{ t('market.prepPage.' + p + 'Lead') }}</p>
            <p class="mt-1 text-sm text-white/70">{{ t('market.prepPage.disclaimer') }}</p>
            <a class="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-white underline underline-offset-4" [routerLink]="['/prep', p === 'qudrat' ? 'tahsili' : 'qudrat']">
              {{ t('market.prepPage.other.' + p) }}<mat-icon svgIcon="arrow-left" class="icon-size-4 ltr:-scale-x-100" />
            </a>
          } @else {
            <h1 class="font-display text-[2rem] leading-[1.1] font-bold lg:text-[2.75rem]" [class.max-lg:hidden]="filters().q">{{ t('market.title') }}</h1>
            <p class="mt-1 max-w-[40em] text-[#E3ECE6]" [class.max-lg:hidden]="filters().q">{{ t('market.lead') }}</p>
          }

          <div class="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <form role="search" class="relative w-full lg:max-w-[720px]" (submit)="$event.preventDefault(); applyQuery()">
              <label for="market-q" class="sr-only-text">{{ t('market.search') }}</label>
              <mat-icon svgIcon="search" class="pointer-events-none absolute start-4 top-1/2 icon-size-5 -translate-y-1/2 text-muted" />
              <input #qInput id="market-q" type="search" enterkeyhint="search" autocomplete="off"
                     class="min-h-14 w-full rounded-ui border-0 bg-white ps-12 pe-12 text-[1.0625rem] text-ink outline-none focus:outline-3 focus:outline-secondary-200 lg:min-h-16"
                     [placeholder]="t(filters().tab === 'teachers' ? 'market.placeholderTeachers' : 'market.placeholderCourses')"
                     [value]="query()" (input)="query.set(qInput.value)" />
              @if (query()) {
                <button type="button" class="btn btn-icon absolute end-1.5 top-1/2 -translate-y-1/2 border-0" [attr.aria-label]="t('market.clear')" (click)="query.set(''); applyQuery()">
                  <mat-icon svgIcon="x" class="icon-size-5" />
                </button>
              }
            </form>
            @if (!prep()) {
              <div class="segmented self-start border-white/25 bg-transparent" role="group" [attr.aria-label]="t('market.country')">
                @for (c of countries; track c) {
                  <button type="button" class="segment min-h-11 border-0 bg-transparent text-white aria-pressed:bg-white aria-pressed:text-deep" [attr.aria-pressed]="filters().country === c" (click)="set({ country: c, gradeId: null, subjectId: null })">
                    {{ t('market.countries.' + c) }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-[1240px] px-4 lg:px-10">
        <!-- Control card overlapping the band -->
        <div class="relative -mt-9 flex flex-col gap-3 rounded-hero border border-line bg-white p-3 shadow-[0_22px_54px_rgba(11,59,46,0.12)] lg:p-4">
          <div class="flex flex-wrap items-center gap-2">
            <div class="segmented" role="tablist" [attr.aria-label]="t('market.search')">
              <button type="button" role="tab" class="segment min-h-11" [attr.aria-selected]="filters().tab === 'courses'" (click)="set({ tab: 'courses' })">
                {{ t('market.tabCourses') }}&nbsp;@if (courseTotal() !== null) { <span class="tabular-nums opacity-75">({{ courseTotal() }})</span> }
              </button>
              <button type="button" role="tab" class="segment min-h-11" [attr.aria-selected]="filters().tab === 'teachers'" (click)="set({ tab: 'teachers' })">
                {{ t('market.tabTeachers') }}&nbsp;@if (teacherTotal() !== null) { <span class="tabular-nums opacity-75">({{ teacherTotal() }})</span> }
              </button>
            </div>
            @if (!prep() && filters().country === 'SA') {
              <span class="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden="true"></span>
              <span class="sr-only-text">{{ t('market.prepLabel') }}</span>
              @for (p of prepKeys; track p) {
                <a class="segment inline-flex min-h-11 items-center gap-1.5 no-underline" [routerLink]="['/prep', p]">
                  <mat-icon svgIcon="target" class="icon-size-4" />{{ t('market.prep.' + p) }}
                </a>
              }
            }
          </div>

          <!-- Filters: inline on desktop, a sheet on phones -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn btn-outline btn-sm min-h-11 lg:hidden" (click)="sheetOpen.set(true)">
              <mat-icon svgIcon="sliders-horizontal" class="icon-size-4" />{{ t('market.filters') }}
              @if (activeCount()) { <span class="rounded-chip bg-deep px-1.5 text-xs text-white tabular-nums">{{ activeCount() }}</span> }
            </button>
            <div class="hidden flex-wrap items-center gap-2 lg:flex">
              <ng-container *ngTemplateOutlet="filterFields; context: { compact: true }" />
            </div>
            @if (filters().tab === 'courses') {
              <label class="check min-h-11 cursor-pointer lg:ms-2">
                <input type="checkbox" [checked]="filters().free" (change)="set({ free: !filters().free })" />{{ t('market.freeOnly') }}
              </label>
            }
          </div>

          @if (chips().length) {
            <div class="flex flex-wrap items-center gap-2">
              @for (chip of chips(); track chip.key) {
                <span class="inline-flex min-h-9 items-center gap-1 rounded-chip border border-line-strong bg-page ps-3 pe-1 text-sm font-semibold">
                  {{ chip.label }}
                  <button type="button" class="btn btn-icon size-8 border-0 bg-transparent" [attr.aria-label]="t('market.remove', { label: chip.label })" (click)="set(chip.clear)">
                    <mat-icon svgIcon="x" class="icon-size-4" />
                  </button>
                </span>
              }
              <button type="button" class="btn btn-ghost btn-sm text-secondary-600" (click)="clearFilters()">{{ t('market.clearAll') }}</button>
            </div>
          }
        </div>

        <!-- Picks by أقلام: only on the plain hub -->
        @if (showPicks() && picks().length) {
          <section class="mt-8 rounded-hero border border-line bg-white p-4 lg:p-6" aria-labelledby="picks-title">
            <h2 id="picks-title" class="section-title">{{ t('market.picksTitle') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('market.picksLead') }}</p>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
              @for (p of picks(); track p.id) {
                <aq-teacher-card [teacher]="p.teacher" [picked]="true" />
              }
            </div>
            @if (subjectChoices().length) {
              <h3 class="mt-6 text-sm font-bold text-muted">{{ t('market.bySubject') }}</h3>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (s of subjectChoices(); track s.id) {
                  <button type="button" class="segment inline-flex min-h-11 items-center gap-2" (click)="set({ subjectId: s.id })">
                    <span class="size-5 rounded-[4px]" [style.background]="color(s.id)" aria-hidden="true"></span>{{ s.name }}
                  </button>
                }
              </div>
            }
          </section>
        }

        <!-- Results -->
        <section class="mt-8 mb-14" [attr.aria-busy]="loading()">
          <h2 class="sr-only-text">{{ showPicks() ? t('market.allCourses') : t('market.search') }}</h2>
          @if (error()) {
            <div class="alert alert-danger flex flex-wrap items-center gap-3" role="alert">
              {{ t('market.error') }}
              <button type="button" class="btn btn-outline btn-sm" (click)="reload()">{{ t('market.retry') }}</button>
            </div>
          }
          @if (total() !== null && !error()) {
            <p class="mb-3 text-sm text-muted" aria-live="polite">
              {{ filters().tab === 'teachers' ? t(plural('market.teachersCount', total() ?? 0), { count: total() }) : t(plural('market.coursesCount', total() ?? 0), { count: total() }) }}
            </p>
          }

          <div class="grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4" [class.opacity-60]="loading() && items().length">
            @if (filters().tab === 'courses') {
              @for (c of courses(); track c.slug) { <aq-course-card [course]="c" /> }
            } @else {
              @for (p of teachers(); track p.slug) { <aq-teacher-card [teacher]="p" [picked]="pickedSlugs().has(p.slug)" /> }
            }
            @if (loading() && !items().length) {
              @for (i of skeletons; track i) { <aq-card-skeleton /> }
            }
            @if (!loading() && !error() && total() === 0) {
              <div class="empty col-span-full">
                <mat-icon svgIcon="search-x" class="empty-icon" />
                @if (prep()) {
                  <p class="empty-title">{{ t('market.prepPage.empty') }}</p>
                  <a class="btn btn-ghost text-secondary-600" routerLink="/search">{{ t('market.prepPage.allSubjects') }}</a>
                } @else if (!filters().q && !activeCount()) {
                  <p class="empty-title">{{ t('market.emptyCountry', { country: t('market.countries.' + filters().country) }) }}</p>
                  <button type="button" class="btn btn-outline" (click)="set({ country: filters().country === 'SA' ? 'EG' : 'SA' })">
                    {{ t('market.seeCountry', { country: t('market.countries.' + (filters().country === 'SA' ? 'EG' : 'SA')) }) }}
                  </button>
                } @else {
                  <p class="empty-title">{{ filters().q ? t('market.noResults', { q: filters().q }) : t('market.noResultsPlain') }}</p>
                  <p class="text-muted">{{ t('market.noResultsHint') }}</p>
                  <div class="mt-3 flex flex-wrap justify-center gap-2">
                    @if (activeCount()) { <button type="button" class="btn btn-outline" (click)="clearFilters()">{{ t('market.clearFilters') }}</button> }
                    @if (otherTotal()) {
                      <button type="button" class="btn btn-ghost text-secondary-600" (click)="set({ tab: filters().tab === 'courses' ? 'teachers' : 'courses' })">
                        {{ t(plural('market.otherTabHits', otherTotal()), { count: otherTotal(), tab: t(filters().tab === 'courses' ? 'market.tabTeachers' : 'market.tabCourses') }) }}
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          @if (items().length && total() !== null) {
            <div class="mt-6 flex flex-col items-center gap-2">
              @if (items().length < total()!) {
                <button type="button" class="btn btn-outline min-w-60" [disabled]="loadingMore()" (click)="more()">
                  @if (loadingMore()) { <mat-icon svgIcon="loader-circle" class="icon-size-4 animate-spin motion-reduce:animate-none" /> }
                  {{ t('market.showMore') }}
                </button>
                <p class="text-sm text-muted">{{ t('market.shown', { shown: items().length, total: total() }) }}</p>
              } @else if (total()! > pageSize) {
                <p class="text-sm text-muted">{{ t('market.allShown') }}</p>
              }
            </div>
          }
        </section>
      </div>

      <!-- Phone filter sheet -->
      @if (sheetOpen()) {
        <div class="fixed inset-0 z-40 bg-ink/40 lg:hidden" (click)="sheetOpen.set(false)" aria-hidden="true"></div>
        <div #sheet class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-hero bg-white lg:hidden" role="dialog" aria-modal="true" aria-labelledby="sheet-title"
             tabindex="-1" (keydown.escape)="sheetOpen.set(false)">
          <div class="flex items-center gap-2 border-b border-line-soft px-4 pt-2 pb-3">
            <h2 id="sheet-title" class="grow text-lg font-bold">{{ t('market.filters') }}</h2>
            <button type="button" class="btn btn-icon" [attr.aria-label]="t('market.course.close')" (click)="sheetOpen.set(false)"><mat-icon svgIcon="x" class="icon-size-5" /></button>
          </div>
          <div class="flex flex-col gap-5 overflow-y-auto px-4 py-4">
            <ng-container *ngTemplateOutlet="filterFields; context: { compact: false }" />
          </div>
          <div class="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" class="btn btn-outline" (click)="clearFilters()">{{ t('market.clearAll') }}</button>
            <button type="button" class="btn btn-primary flex-1" (click)="sheetOpen.set(false)">{{ t('market.showResults', { count: total() ?? 0 }) }}</button>
          </div>
        </div>
      }

      <ng-template #filterFields let-compact="compact">
        @if (!prep() && subjectChoices().length) {
          <label class="field" [class.w-44]="compact">
            <span [class]="compact ? 'sr-only-text' : 'field-label'">{{ t('market.subject') }}</span>
            <select class="select min-h-11" (change)="set({ subjectId: num($any($event.target).value) })">
              <option value="" [selected]="!filters().subjectId">{{ t('market.subject') }}: {{ t('market.any') }}</option>
              @for (s of subjectChoices(); track s.id) { <option [value]="s.id" [selected]="filters().subjectId === s.id">{{ s.name }}</option> }
            </select>
          </label>
        }
        @if (!prep() && gradeChoices().length) {
          <label class="field" [class.w-52]="compact">
            <span [class]="compact ? 'sr-only-text' : 'field-label'">{{ t('market.grade') }}</span>
            <select class="select min-h-11" (change)="set({ gradeId: num($any($event.target).value) })">
              <option value="" [selected]="!filters().gradeId">{{ t('market.grade') }}: {{ t('market.any') }}</option>
              @for (g of gradeChoices(); track g.id) { <option [value]="g.id" [selected]="filters().gradeId === g.id">{{ g.name }}</option> }
            </select>
          </label>
        }
        <fieldset class="field">
          <legend [class]="compact ? 'sr-only-text' : 'field-label'">{{ t('market.teacher') }}</legend>
          <div class="segmented">
            @for (g of genders; track g) {
              <button type="button" class="segment min-h-11" [attr.aria-pressed]="filters().gender === g" (click)="set({ gender: g })">
                {{ g ? t('market.gender.' + g) : t('market.any') }}
              </button>
            }
          </div>
          @if (!compact) { <span class="field-hint">{{ t('market.genderHint') }}</span> }
        </fieldset>
      </ng-template>
    </ng-container>
  `,
})
export default class MarketSearchPage {
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  private api = inject(MarketplaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  protected names = inject(LookupNames);

  protected readonly countries = ['SA', 'EG'];
  protected readonly prepKeys: TestPrepKey[] = ['qudrat', 'tahsili'];
  protected readonly genders: (Gender | null)[] = [null, 'Female', 'Male'];
  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);
  protected readonly pageSize = PAGE;
  protected num = num;
  protected color = subjectColor;

  private sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  protected sheetOpen = signal(false);

  protected prep = toSignal(this.route.data.pipe(map(d => (d['prep'] as TestPrepKey | undefined) ?? null)), { initialValue: null });
  private params = toSignal(this.route.queryParamMap, { requireSync: true });

  protected filters = computed<Filters>(() => {
    const p = this.params();
    const prep = this.prep();
    const gender = p.get('gender');
    return {
      q: p.get('q') ?? '',
      tab: p.get('tab') === 'teachers' ? 'teachers' : 'courses',
      country: prep ? 'SA' : p.get('country') === 'EG' ? 'EG' : 'SA',
      subjectId: num(p.get('subject')),
      gradeId: prep ? TEST_PREP[prep].gradeId : num(p.get('grade')),
      gender: gender === 'Male' || gender === 'Female' ? gender : null,
      free: p.get('free') === '1',
    };
  });

  /** The text in the field; written to the address after a short pause. */
  protected query = signal('');

  protected courses = signal<CourseCard[]>([]);
  protected teachers = signal<TeacherCard[]>([]);
  protected courseTotal = signal<number | null>(null);
  protected teacherTotal = signal<number | null>(null);
  protected loading = signal(true);
  protected loadingMore = signal(false);
  protected error = signal(false);
  private page = 1;
  private reloadTick = signal(0);

  protected facets = signal<Facets | null>(null);
  protected picks = signal<FeaturedTeacher[]>([]);
  protected pickedSlugs = computed(() => new Set(this.picks().map(p => p.teacher.slug)));

  protected items = computed<unknown[]>(() => (this.filters().tab === 'teachers' ? this.teachers() : this.courses()));
  protected total = computed(() => (this.filters().tab === 'teachers' ? this.teacherTotal() : this.courseTotal()));
  protected otherTotal = computed(() => (this.filters().tab === 'teachers' ? this.courseTotal() : this.teacherTotal()) ?? 0);

  protected activeCount = computed(() => {
    const f = this.filters();
    return (this.prep() ? 0 : (f.subjectId ? 1 : 0) + (f.gradeId ? 1 : 0)) + (f.gender ? 1 : 0) + (f.free ? 1 : 0);
  });
  protected showPicks = computed(() => !this.prep() && !this.filters().q && !this.activeCount());

  protected subjectChoices = computed(() =>
    (this.facets()?.subjects ?? []).map(s => ({ id: s.id, name: this.names.subject(s.id) })).filter(s => s.name)
  );
  protected gradeChoices = computed(() =>
    (this.facets()?.grades ?? []).map(g => ({ id: g.id, name: this.names.grade(g.id) })).filter(g => g.name)
  );

  protected chips = computed(() => {
    const f = this.filters();
    const t = (k: string) => this.transloco.translate(k);
    const list: { key: string; label: string; clear: Partial<Filters> }[] = [];
    if (!this.prep() && f.subjectId) list.push({ key: 'subject', label: this.names.subject(f.subjectId), clear: { subjectId: null } });
    if (!this.prep() && f.gradeId) list.push({ key: 'grade', label: this.names.grade(f.gradeId), clear: { gradeId: null } });
    if (f.gender) list.push({ key: 'gender', label: t('market.gender.' + f.gender), clear: { gender: null } });
    if (f.free && f.tab === 'courses') list.push({ key: 'free', label: t('market.freeOnly'), clear: { free: false } });
    return list;
  });

  constructor() {
    this.names.load();
    // The field follows the address (back/forward), and the address follows the field after a pause.
    effect(() => this.query.set(this.filters().q));
    toObservable(this.query)
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(q => q !== this.filters().q && this.set({ q: q.trim() }, true));

    effect(() => {
      if (this.sheetOpen()) queueMicrotask(() => this.sheet()?.nativeElement.focus());
    });

    // Facets and picks depend on the country only.
    toObservable(computed(() => this.filters().country))
      .pipe(
        switchMap(country =>
          forkJoin({
            facets: this.api.facets(country).pipe(catchError(() => of(null))),
            picks: this.api.featured(country).pipe(catchError(() => of([] as FeaturedTeacher[]))),
          })
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ facets, picks }) => {
        this.facets.set(facets);
        // One card per teacher in the general block, whatever subjects they were picked for.
        const seen = new Set<string>();
        this.picks.set(picks.filter(p => !seen.has(p.teacher.slug) && seen.add(p.teacher.slug)));
      });

    // Results: both tabs are counted, so the other tab can be suggested when this one is empty.
    combineLatest([toObservable(this.filters), toObservable(this.reloadTick)])
      .pipe(
        switchMap(([f]) => {
          this.loading.set(true);
          this.error.set(false);
          this.page = 1;
          const base = this.toApi(f, 1);
          return forkJoin({ courses: this.api.courses(base), teachers: this.api.teachers(base) }).pipe(
            map(r => ({ ok: true as const, ...r })),
            catchError(() => of({ ok: false as const }))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(r => {
        this.loading.set(false);
        if (!r.ok) {
          this.error.set(true);
          return;
        }
        this.courses.set(r.courses.items);
        this.courseTotal.set(r.courses.total);
        this.teachers.set(r.teachers.items);
        this.teacherTotal.set(r.teachers.total);
      });
  }

  protected set(change: Partial<Filters>, replaceUrl = false): void {
    const f = { ...this.filters(), ...change };
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl,
      queryParams: {
        q: f.q || null,
        tab: f.tab === 'teachers' ? 'teachers' : null,
        country: this.prep() || f.country === 'SA' ? null : f.country,
        subject: f.subjectId,
        grade: this.prep() ? null : f.gradeId,
        gender: f.gender,
        free: f.free ? '1' : null,
      },
    });
  }

  protected applyQuery(): void {
    this.set({ q: this.query().trim() });
  }

  protected clearFilters(): void {
    this.set({ subjectId: null, gradeId: null, gender: null, free: false });
  }

  protected reload(): void {
    this.reloadTick.update(n => n + 1);
  }

  protected more(): void {
    const f = this.filters();
    this.loadingMore.set(true);
    const next = this.page + 1;
    const request = this.toApi(f, next);
    const done = () => this.loadingMore.set(false);
    if (f.tab === 'teachers') {
      this.api.teachers(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: r => (this.teachers.update(list => [...list, ...r.items]), (this.page = next), done()),
        error: done,
      });
    } else {
      this.api.courses(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: r => (this.courses.update(list => [...list, ...r.items]), (this.page = next), done()),
        error: done,
      });
    }
  }

  private toApi(f: Filters, page: number): SearchFilters {
    const prep = this.prep();
    return {
      q: f.q || null,
      country: f.country,
      curriculumId: prep ? TEST_PREP[prep].curriculumId : null,
      gradeId: f.gradeId,
      subjectId: f.subjectId,
      teacherGender: f.gender,
      free: f.free ? true : null,
      page,
      pageSize: PAGE,
    };
  }
}
