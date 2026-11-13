import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';

import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { CourseCard, FeaturedTeacher, MarketplaceService } from '@/app/core/marketplace/marketplace.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { AqCourseCard, AqTeacherCard } from '@/app/shared/marketplace/market-ui';
import { AqLogo } from '@/app/shared/ui/logo';
import { environment } from '@/environments/environment';

/**
 * The public home page, "two doors" (chosen 2026-11-13): families find a teacher or course, schools and centers
 * learn about the platform. Below: picks by أقلام and new courses from the marketplace, then the school story.
 * It stays behind environment.publicHome until launch (backlog story 3.5.3). Sample figures are hidden from screen
 * readers.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqLogo, AqTeacherCard, AqCourseCard],
  template: `
    <ng-container *transloco="let t">
      <div class="bg-page text-[1.0625rem] leading-[1.7] text-ink">
        <header class="bg-primary-600 text-white">
          <div class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-4 lg:px-10">
            <a routerLink="/" class="no-underline"><aq-logo [size]="42" [inverse]="true" /></a>
            <nav class="hidden grow gap-6.5 lg:flex" [attr.aria-label]="t('nav.menu')">
              <a class="inline-flex min-h-11 items-center font-medium text-[#E3ECE6] no-underline hover:text-white" routerLink="/search" [queryParams]="{ tab: 'teachers' }">{{ t('market.home.searchLink') }}</a>
              <a class="inline-flex min-h-11 items-center font-medium text-[#E3ECE6] no-underline hover:text-white" routerLink="/prep/qudrat">{{ t('home.nav.prep') }}</a>
              <a class="inline-flex min-h-11 items-center font-medium text-[#E3ECE6] no-underline hover:text-white" routerLink="/" fragment="school">{{ t('home.nav.schools') }}</a>
            </nav>
            <div class="ms-auto flex items-center gap-2">
              <a class="inline-flex min-h-11 items-center px-2 text-[#E3ECE6] no-underline hover:text-white lg:hidden" routerLink="/search" [attr.aria-label]="t('market.home.searchLink')">
                <mat-icon svgIcon="search" class="icon-size-5" />
              </a>
              <button type="button" class="inline-flex min-h-11 cursor-pointer items-center px-2 text-[0.9375rem] text-[#E3ECE6]" [attr.lang]="i18n.lang() === 'ar' ? 'en' : 'ar'" (click)="i18n.toggle()">{{ t('landing.otherLanguage') }}</button>
              <a class="inline-flex min-h-11 items-center rounded-ui border border-[#BFE3CE] px-3.5 font-semibold whitespace-nowrap text-white no-underline hover:bg-white/10 sm:px-4.5" routerLink="/auth/sign-in">{{ t('landing.signIn') }}</a>
            </div>
          </div>

          <!-- Two doors: families (search) and schools (the platform) -->
          <section id="top" class="relative overflow-hidden">
            <svg aria-hidden="true" class="absolute inset-0 size-full">
              <defs><pattern id="lattice" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M48 0 L60 36 L96 48 L60 60 L48 96 L36 60 L0 48 L36 36 Z" fill="none" stroke="#FFFFFF" opacity="0.055" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#lattice)" />
            </svg>
            <div class="relative mx-auto grid max-w-[1240px] gap-8 px-4 pt-7 pb-20 lg:grid-cols-12 lg:items-end lg:gap-8 lg:px-10 lg:pt-12 lg:pb-28">
              <div class="flex min-w-0 flex-col gap-4 lg:col-span-7">
                <p class="font-semibold text-primary-100">{{ t('home.family.kicker') }}</p>
                <h1 class="font-display text-[2.875rem] leading-[1.05] font-bold text-balance lg:text-[4.75rem]">{{ t('home.family.title') }}</h1>
                <p class="max-w-[34em] text-[#E3ECE6] lg:text-xl">{{ t('home.family.lead') }}</p>
                <form role="search" class="flex gap-2" (submit)="$event.preventDefault(); search(homeQuery.value)">
                  <label for="home-q" class="sr-only">{{ t('market.home.searchLabel') }}</label>
                  <div class="relative min-w-0 grow">
                    <mat-icon svgIcon="search" class="pointer-events-none absolute start-4 top-1/2 icon-size-5 -translate-y-1/2 text-muted" />
                    <input #homeQuery id="home-q" type="search" enterkeyhint="search" autocomplete="off"
                           class="min-h-14 w-full rounded-ui border-0 bg-white ps-12 pe-4 text-lg text-ink outline-none focus:outline-3 focus:outline-secondary-200"
                           [placeholder]="t('market.home.searchPlaceholder')" />
                  </div>
                  <button type="submit" class="inline-flex min-h-14 items-center rounded-ui bg-deep px-5 font-bold text-white lg:px-7">{{ t('market.search') }}</button>
                </form>
                <p class="flex flex-wrap gap-2">
                  <a class="inline-flex min-h-11 items-center gap-1.5 rounded-chip border border-white/35 px-3.5 text-[0.95rem] text-white no-underline hover:bg-white/10" routerLink="/search" [queryParams]="{ tab: 'teachers' }">
                    <mat-icon svgIcon="users-round" class="icon-size-4" />{{ t('market.home.browseTeachers') }}
                  </a>
                  <a class="inline-flex min-h-11 items-center gap-1.5 rounded-chip border border-white/35 px-3.5 text-[0.95rem] text-white no-underline hover:bg-white/10" routerLink="/prep/qudrat">{{ t('market.prep.qudrat') }}</a>
                  <a class="inline-flex min-h-11 items-center gap-1.5 rounded-chip border border-white/35 px-3.5 text-[0.95rem] text-white no-underline hover:bg-white/10" routerLink="/prep/tahsili">{{ t('market.prep.tahsili') }}</a>
                  <a class="inline-flex min-h-11 items-center gap-1.5 rounded-chip border border-white/35 px-3.5 text-[0.95rem] text-white no-underline hover:bg-white/10" routerLink="/redeem">
                    <mat-icon svgIcon="key-round" class="icon-size-4" />{{ t('market.cta.haveCode') }}
                  </a>
                </p>
              </div>

              <aside class="flex min-w-0 flex-col gap-3 rounded-hero bg-deep p-6 lg:col-span-5 lg:p-8" aria-labelledby="schools-door">
                <p class="font-semibold text-primary-100">{{ t('home.nav.schools') }}</p>
                <h2 id="schools-door" class="font-display text-[2.125rem] leading-[1.1] font-bold lg:text-[2.5rem]">{{ t('home.school.title') }}</h2>
                <p class="text-[#E3ECE6]">{{ t('home.school.lead') }}</p>
                <div class="mt-1 flex flex-wrap gap-2.5">
                  <a class="inline-flex min-h-12 items-center rounded-ui bg-page px-5 font-bold text-deep no-underline" routerLink="/" fragment="demo">{{ t('landing.requestDemo') }}</a>
                  <a class="inline-flex min-h-12 items-center rounded-ui border border-[#BFE3CE] px-5 font-semibold text-white no-underline hover:bg-white/10" routerLink="/" fragment="school">{{ t('landing.seeHow') }}</a>
                </div>
              </aside>
            </div>
          </section>
        </header>

        <main class="relative z-[2] mx-auto -mt-12 flex max-w-[1240px] flex-col gap-12 px-4 pb-14 lg:gap-14 lg:px-10">
          <!-- Picks by أقلام (a pick, never a ranking) -->
          @if (picks().length) {
            <section class="flex flex-col gap-4 rounded-hero border border-line bg-white p-4 shadow-[0_22px_54px_rgba(11,59,46,0.12)] lg:p-7" aria-labelledby="home-picks">
              <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 id="home-picks" class="section-title">{{ t('market.picksTitle') }}</h2>
                <p class="text-sm text-muted">{{ t('market.picksLead') }}</p>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                @for (p of picks(); track p.id) { <aq-teacher-card [teacher]="p.teacher" [picked]="true" /> }
              </div>
            </section>
          }

          <!-- New courses -->
          @if (courses().length) {
            <section class="flex flex-col gap-4" aria-labelledby="home-courses">
              <div class="flex items-baseline gap-4">
                <h2 id="home-courses" class="section-title grow">{{ t('home.newCourses') }}</h2>
                <a class="inline-flex min-h-11 items-center font-bold no-underline" routerLink="/search">{{ t('market.home.browseCourses') }}</a>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                @for (c of courses(); track c.slug) { <aq-course-card [course]="c" /> }
              </div>
            </section>
          }

          <!-- Who it is for, briefly -->
          <section class="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-4" [attr.aria-label]="t('landing.who')">
            @for (k of audiences; track k) {
              <div class="card card-body">
                <p class="font-bold text-secondary-600">{{ t('home.cards.' + k + '.kicker') }}</p>
                <p class="mt-1 font-semibold">{{ t('home.cards.' + k + '.title') }}</p>
                <p class="mt-1 text-[0.95rem] text-muted">{{ t('home.cards.' + k + '.text') }}</p>
              </div>
            }
          </section>
        </main>

        <section [attr.aria-label]="t('landing.proofLabel')" class="border-y border-line bg-white">
          <div class="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-7 gap-y-3.5 px-4 py-5.5 lg:px-10">
            @for (n of [1, 2, 3, 4]; track n) { <p class="font-semibold text-deep">{{ t('landing.proof' + n) }}</p> }
          </div>
        </section>

        <section id="school" class="mx-auto flex max-w-[1240px] scroll-mt-4 flex-wrap items-center gap-14 px-4 py-14 lg:px-10 lg:py-24">
          <div class="min-w-0 flex-[1_1_23.75rem]">
            <p class="mb-2 font-bold text-secondary-600">{{ t('landing.school.kicker') }}</p>
            <h2 class="mb-3.5 font-display text-[2.375rem] leading-[1.12] font-bold lg:text-[3.25rem]">{{ t('landing.school.title') }}</h2>
            <ul class="flex flex-col gap-2.5 text-muted">
              @for (n of [1, 2, 3, 4]; track n) { <li class="border-b border-line py-2.5">{{ t('landing.school.point' + n) }}</li> }
            </ul>
          </div>
          <div aria-hidden="true" class="min-w-0 flex-[1_1_25rem] rounded-card border border-line bg-white p-7 shadow-[0_18px_44px_rgba(11,59,46,0.10)]">
            <div class="flex items-end justify-between gap-3 border-b-2 border-primary-600 pb-3">
              <div>
                <p class="text-sm text-muted">{{ t('landing.school.sampleName') }}</p>
                <p class="font-display text-[2rem] leading-[1.1] font-bold text-deep">{{ t('landing.school.card') }}</p>
              </div>
              <p class="text-sm text-muted">{{ t('landing.school.term') }}</p>
            </div>
            @for (row of cardRows; track row.subject) {
              <div class="flex justify-between border-b border-line-soft py-3"><span class="font-semibold">{{ t('landing.sample.' + row.subject) }}</span><span class="font-bold text-secondary-600">{{ t('landing.school.' + row.grade) }}</span></div>
            }
            <div class="mt-3.5 flex justify-between rounded-ui bg-primary-100 px-4 py-3.5 font-bold text-primary-700"><span>{{ t('landing.school.overall') }}</span><span>85.6% · {{ t('landing.school.veryGood') }}</span></div>
          </div>
        </section>

        <section id="demo" class="scroll-mt-4 bg-primary-600 text-white">
          <div class="mx-auto max-w-[860px] px-4 py-14 text-center lg:px-10 lg:py-24">
            <h2 class="mb-3 font-display text-[2.375rem] leading-[1.12] font-bold lg:text-[3.25rem]">{{ t('landing.demo.title') }}</h2>
            <p class="mb-6.5 text-[#E3ECE6]">{{ t('landing.demo.text') }}</p>
            @if (contactEmail) {
              <a class="inline-flex min-h-13.5 items-center rounded-ui bg-page px-8.5 text-lg font-bold text-deep no-underline" [href]="'mailto:' + contactEmail">{{ t('landing.requestDemo') }}</a>
            } @else {
              <p class="inline-flex min-h-13.5 items-center rounded-ui border border-dashed border-[#BFE3CE] px-6 font-semibold">{{ t('landing.demo.noContact') }}</p>
            }
          </div>
        </section>

        <footer class="bg-primary-700 text-[0.9375rem] text-primary-100">
          <div class="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2.5 px-4 py-5.5 lg:px-10">
            <span>{{ t('landing.brand') }}@if (contactEmail) { · <a class="text-primary-100" [href]="'mailto:' + contactEmail" dir="ltr">{{ contactEmail }}</a> }</span>
          </div>
        </footer>
      </div>
    </ng-container>
  `,
})
export default class LandingComponent {
  protected i18n = inject(I18nService);
  private router = inject(Router);
  private market = inject(MarketplaceService);

  protected readonly contactEmail = environment.contactEmail;
  protected readonly audiences = ['school', 'parent', 'teacher'];
  protected readonly cardRows = [
    { subject: 'math', grade: 'veryGood' },
    { subject: 'science', grade: 'veryGood' },
    { subject: 'language', grade: 'excellent' },
  ];

  /** Live from the marketplace; a section with nothing to show is left out. */
  protected picks = signal<FeaturedTeacher[]>([]);
  protected courses = signal<CourseCard[]>([]);

  constructor() {
    inject(LookupNames).load();
    this.market.featured('SA').pipe(catchError(() => of([] as FeaturedTeacher[]))).subscribe(list => {
      const seen = new Set<string>();
      this.picks.set(list.filter(p => !seen.has(p.teacher.slug) && seen.add(p.teacher.slug)).slice(0, 4));
    });
    this.market.courses({ country: 'SA', pageSize: 4 }).pipe(catchError(() => of(null))).subscribe(r => this.courses.set(r?.items ?? []));
  }

  /** Teacher names and course words both work: search shows the tab with results. */
  protected search(query: string): void {
    this.router.navigate(['/search'], { queryParams: { q: query.trim() || null } });
  }
}
