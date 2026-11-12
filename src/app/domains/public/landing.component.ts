import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { I18nService } from '@/app/core/transloco/i18n.service';
import { environment } from '@/environments/environment';
import { AqInkBar } from '@/app/shared/ui/ink-bar';
import { AqLogo } from '@/app/shared/ui/logo';

/** A sample month for the illustrations: 15 present, 2 late, 3 absent. */
const RIBBON = 'PPPPPPLPPPPPAPPLAPAP'.split('').map(mark => ({
  P: { color: 'var(--color-primary-500)', height: '55%' },
  L: { color: 'var(--color-warning-500)', height: '75%' },
  A: { color: 'var(--color-danger-600)', height: '100%' },
}[mark]!));

const TILES = [
  { key: 'math', mark: '%', color: 'var(--color-subject-blue)', percent: 60 },
  { key: 'science', mark: 'ع', color: 'var(--color-subject-green)', percent: 45 },
  { key: 'language', mark: 'ض', color: 'var(--color-subject-earth)', percent: 20 },
];

type Audience = { key: string; color: string; link: string; fragment?: string };

const AUDIENCES: Audience[] = [
  { key: 'student', color: 'var(--color-secondary-600)', link: '/auth/sign-in' },
  { key: 'parent', color: 'var(--color-subject-earth)', link: '/auth/sign-up' },
  { key: 'teacher', color: 'var(--color-primary-600)', link: '/auth/sign-up' },
  { key: 'school', color: 'var(--color-primary-700)', link: '/', fragment: 'demo' },
];

/**
 * The public home page. It stays behind environment.publicHome until the student features it promises are
 * live (backlog story 3.5.3). Figures in the illustrations are samples and are hidden from screen readers.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqLogo, AqInkBar],
  template: `
    <ng-container *transloco="let t">
      <div class="bg-page text-[1.0625rem] leading-[1.7] text-ink">
        <header class="bg-primary-600 text-white">
          <div class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-7 px-5 py-4.5 lg:px-10">
            <a routerLink="/" class="no-underline"><aq-logo [size]="42" [inverse]="true" /></a>
            <nav class="hidden grow gap-6.5 lg:flex" [attr.aria-label]="t('nav.menu')">
              @for (a of sectionLinks; track a) {
                <a class="inline-flex min-h-11 items-center font-medium text-[#E3ECE6] no-underline hover:text-white" routerLink="/" [fragment]="a">{{ t('landing.nav.' + a) }}</a>
              }
            </nav>
            <div class="ms-auto flex items-center gap-2.5">
              <a class="inline-flex min-h-11 items-center gap-1.5 px-2 font-medium text-[#E3ECE6] no-underline hover:text-white" routerLink="/search" [attr.aria-label]="t('market.home.searchLink')">
                <mat-icon svgIcon="search" class="icon-size-5" /><span class="max-sm:sr-only">{{ t('market.home.searchLink') }}</span>
              </a>
              <button type="button" class="inline-flex min-h-11 cursor-pointer items-center px-2 text-[0.9375rem] text-[#E3ECE6]" [attr.lang]="i18n.lang() === 'ar' ? 'en' : 'ar'" (click)="i18n.toggle()">{{ t('landing.otherLanguage') }}</button>
              <a class="inline-flex min-h-11 items-center rounded-ui border border-[#BFE3CE] px-4.5 font-semibold text-white no-underline hover:bg-white/10" routerLink="/auth/sign-in">{{ t('landing.signIn') }}</a>
            </div>
          </div>

          <section id="top" class="relative overflow-hidden">
            <svg aria-hidden="true" class="absolute inset-0 size-full">
              <defs><pattern id="lattice" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M48 0 L60 36 L96 48 L60 60 L48 96 L36 60 L0 48 L36 36 Z" fill="none" stroke="#FFFFFF" opacity="0.055" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#lattice)" />
            </svg>
            <div class="relative mx-auto flex max-w-[1240px] flex-wrap items-end gap-12 px-5 pt-9 lg:px-10 lg:pt-18">
              <div class="min-w-0 flex-[1_1_30rem] pb-20 lg:pb-30">
                <p class="mb-3.5 font-semibold text-primary-100">{{ t('landing.eyebrow') }}</p>
                <h1 class="font-display text-[3.375rem] leading-[1.08] font-bold text-balance lg:text-[5.75rem]">{{ t('landing.title') }}</h1>
                <svg aria-hidden="true" viewBox="0 0 606 44" class="mt-2.5 mb-5.5 block h-auto w-[min(420px,78%)] ltr:-scale-x-100">
                  <path d="M600 14 C470 2 330 30 180 16 C120 10 60 12 6 24 C70 20 130 21 190 27 C340 40 480 15 600 14 Z" fill="#BFE3CE" />
                </svg>
                <p class="mb-7.5 max-w-[34em] text-[#E3ECE6] lg:text-xl">{{ t('landing.lead') }}</p>
                <div class="flex flex-wrap gap-3">
                  <a class="inline-flex min-h-13.5 items-center rounded-ui bg-page px-7.5 text-lg font-bold text-deep no-underline" routerLink="/" fragment="demo">{{ t('landing.requestDemo') }}</a>
                  <a class="inline-flex min-h-13.5 items-center rounded-ui border border-[#BFE3CE] px-6.5 text-lg font-semibold text-white no-underline hover:bg-white/10" routerLink="/" fragment="school">{{ t('landing.seeHow') }}</a>
                </div>

                <!-- The marketplace is open before sign-in: search teachers and courses from the first screen. -->
                <form role="search" class="mt-7 flex max-w-[34rem] gap-2" (submit)="$event.preventDefault(); search(homeQuery.value)">
                  <label for="home-q" class="sr-only">{{ t('market.home.searchLabel') }}</label>
                  <div class="relative grow">
                    <mat-icon svgIcon="search" class="pointer-events-none absolute start-4 top-1/2 icon-size-5 -translate-y-1/2 text-muted" />
                    <input #homeQuery id="home-q" type="search" enterkeyhint="search" autocomplete="off"
                           class="min-h-13.5 w-full rounded-ui border-0 bg-white ps-12 pe-4 text-ink outline-none focus:outline-3 focus:outline-secondary-200"
                           [placeholder]="t('market.home.searchPlaceholder')" />
                  </div>
                  <button type="submit" class="inline-flex min-h-13.5 items-center rounded-ui bg-deep px-5 font-bold text-white">{{ t('market.search') }}</button>
                </form>
                <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
                  <a class="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4" routerLink="/search" [queryParams]="{ tab: 'teachers' }">
                    <mat-icon svgIcon="users-round" class="icon-size-4.5" />{{ t('market.home.browseTeachers') }}
                  </a>
                  <a class="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4" routerLink="/search">
                    <mat-icon svgIcon="book-open" class="icon-size-4.5" />{{ t('market.home.browseCourses') }}
                  </a>
                  <a class="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4" routerLink="/prep/qudrat">
                    <mat-icon svgIcon="target" class="icon-size-4.5" />{{ t('market.prep.qudrat') }}
                  </a>
                </p>
              </div>

              <!-- Slot for a real photograph later (no children without consent). -->
              <div aria-hidden="true" class="relative flex min-w-0 flex-[1_1_23.75rem] justify-center">
                <div class="w-[300px] rounded-t-[34px] bg-ink px-3 pt-3">
                  <div class="flex flex-col gap-3 rounded-t-3xl bg-page px-4 pt-5.5 pb-[70px] text-ink">
                    <p class="font-display text-[1.875rem] leading-[1.1] font-bold">{{ t('landing.sample.greeting') }}</p>
                    <div class="rounded-[14px] bg-secondary-600 p-4 text-white">
                      <p class="text-[0.8125rem] text-secondary-200">{{ t('landing.sample.next') }}</p>
                      <p class="mt-0.5 mb-2.5 font-display text-[1.875rem] leading-[1.1] font-bold">{{ t('landing.sample.lesson') }}</p>
                      <span class="flex min-h-9.5 items-center justify-center rounded-chip bg-white text-sm font-bold text-secondary-600">{{ t('student.continueBtn') }}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                      @for (s of tiles; track s.key) {
                        <span class="block overflow-hidden rounded-ui border border-line bg-white text-center">
                          <span class="flex h-[50px] items-center justify-center font-display text-[2rem] leading-none font-bold text-white" [style.background]="s.color">{{ s.mark }}</span>
                          <span class="block px-0.5 py-1.5 text-xs font-semibold">{{ t('landing.sample.' + s.key) }}</span>
                        </span>
                      }
                    </div>
                    <div class="rounded-xl bg-warning-50 p-3 text-[0.8125rem] font-semibold text-warning-700">{{ t('landing.sample.due') }}</div>
                  </div>
                </div>
                <div class="absolute start-0 bottom-15 w-[216px] rounded-[14px] bg-white p-3.5 text-ink shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                  <p class="mb-0.5 text-xs text-muted">{{ t('landing.sample.notice') }}</p>
                  <p class="mb-2.5 text-[0.9375rem] leading-[1.4] font-bold">{{ t('landing.sample.noticeText') }}</p>
                  <div class="flex h-6 items-end gap-0.5">
                    @for (d of ribbon; track $index) { <span class="flex-[1_1_0] rounded-[2px]" [style.height]="d.height" [style.background]="d.color"></span> }
                  </div>
                </div>
              </div>
            </div>
          </section>
        </header>

        <section aria-labelledby="who" class="relative z-[2] mx-auto -mt-11 max-w-[1160px] px-3 lg:px-10">
          <div class="rounded-hero border border-line bg-white p-4 shadow-[0_22px_54px_rgba(11,59,46,0.16)] lg:p-6">
            <h2 id="who" class="mb-3 text-base font-semibold text-muted">{{ t('landing.who') }}</h2>
            <div role="group" [attr.aria-label]="t('landing.pickRole')" class="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              @for (a of audiences; track a.key; let i = $index) {
                <button type="button" class="min-h-13 cursor-pointer rounded-xl border px-3.5 text-[1.0625rem] font-bold"
                        [attr.aria-pressed]="i === tab()"
                        [style.background]="i === tab() ? a.color : '#FFFFFF'" [style.color]="i === tab() ? '#FFFFFF' : 'var(--color-ink)'"
                        [style.border-color]="i === tab() ? a.color : 'var(--color-line-strong)'" (click)="tab.set(i)">{{ t('landing.audience.' + a.key + '.name') }}</button>
              }
            </div>
            <div class="mt-4.5 flex flex-wrap items-stretch gap-5">
              <div class="min-w-0 flex-[1_1_15.625rem]">
                <p class="mb-1 font-display text-[2rem] leading-[1.15] font-bold" [style.color]="active().color">{{ t('landing.audience.' + active().key + '.title') }}</p>
                <p class="mb-3 text-[0.9375rem] text-muted">{{ t('landing.audience.' + active().key + '.text') }}</p>
                <a class="inline-flex min-h-11 items-center rounded-ui px-5 font-bold text-white no-underline" [style.background]="active().color" [routerLink]="active().link" [fragment]="active().fragment">{{ t('landing.audience.' + active().key + '.cta') }}</a>
              </div>
              <div class="grid min-w-0 flex-[2_1_26.25rem] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
                @for (n of [1, 2, 3]; track n) {
                  <a class="flex min-h-19 items-center rounded-xl border border-line bg-page p-3.5 text-[0.9375rem] leading-[1.45] font-semibold text-ink no-underline" [routerLink]="active().link" [fragment]="active().fragment">{{ t('landing.audience.' + active().key + '.s' + n) }}</a>
                }
              </div>
            </div>
          </div>
        </section>

        <section [attr.aria-label]="t('landing.proofLabel')" class="mt-7 border-y border-line bg-white">
          <div class="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-7 gap-y-3.5 px-5 py-5.5 lg:px-10">
            @for (n of [1, 2, 3, 4]; track n) { <p class="font-semibold text-deep">{{ t('landing.proof' + n) }}</p> }
          </div>
        </section>

        <section id="student" class="bg-secondary-600 text-white">
          <div class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-5 py-14 lg:px-10 lg:py-24">
            <div class="min-w-0 flex-[1_1_23.75rem]">
              <p class="mb-2 font-bold text-secondary-200">{{ t('landing.student.kicker') }}</p>
              <h2 class="mb-3.5 font-display text-[2.375rem] leading-[1.12] font-bold lg:text-[3.25rem]">{{ t('landing.student.title') }}</h2>
              <p class="max-w-[32em] text-secondary-100">{{ t('landing.student.text') }}</p>
            </div>
            <div aria-hidden="true" class="grid min-w-0 flex-[1_1_27.5rem] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              @for (s of tiles; track s.key) {
                <span class="block overflow-hidden rounded-[14px] border-2 border-white bg-white text-ink">
                  <span class="flex h-24 items-center justify-center border-b border-white font-display text-[3.5rem] leading-none font-bold text-white" [style.background]="s.color">{{ s.mark }}</span>
                  <span class="block px-3.5 pt-3 pb-3.5">
                    <span class="block font-bold">{{ t('landing.sample.' + s.key) }}</span>
                    <aq-ink-bar class="mt-2" [percent]="s.percent" [color]="s.color" />
                  </span>
                </span>
              }
            </div>
          </div>
        </section>

        <section id="teacher" class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-5 py-14 lg:px-10 lg:py-24">
          <div class="min-w-0 flex-[1_1_23.75rem]">
            <p class="mb-2 font-bold text-secondary-600">{{ t('landing.teacher.kicker') }}</p>
            <h2 class="mb-3.5 font-display text-[2.375rem] leading-[1.12] font-bold lg:text-[3.25rem]">{{ t('landing.teacher.title') }}</h2>
            <p class="max-w-[32em] text-muted">{{ t('landing.teacher.text') }}</p>
          </div>
          <div aria-hidden="true" class="min-w-0 flex-[1_1_27.5rem] rounded-card border border-line bg-white p-5.5 shadow-[0_18px_44px_rgba(11,59,46,0.10)]">
            <p class="mb-3.5 font-bold">{{ t('landing.teacher.className') }}</p>
            <div class="flex flex-col gap-2">
              @for (n of [1, 2, 3]; track n) {
                <div class="flex flex-wrap items-center justify-between gap-2 rounded-ui px-3.5 py-3" [class]="n === 2 ? 'bg-danger-50' : 'bg-page'">
                  <span class="font-semibold">{{ t('landing.teacher.student' + n) }}</span>
                  <span class="rounded-full px-3.5 py-1 text-sm font-semibold text-white" [class]="n === 2 ? 'bg-danger-700' : 'bg-primary-600'">{{ t(n === 2 ? 'attendance.Absent' : 'attendance.Present') }}</span>
                </div>
              }
            </div>
            <p class="mt-3.5 text-[0.9375rem] font-semibold text-primary-700">{{ t('landing.teacher.notified') }}</p>
          </div>
        </section>

        <section id="parent" class="border-y border-line bg-white">
          <div class="mx-auto flex max-w-[1240px] flex-wrap-reverse items-center gap-14 px-5 py-14 lg:px-10 lg:py-24">
            <div aria-hidden="true" class="min-w-0 flex-[1_1_27.5rem] rounded-card border border-line bg-page p-6.5">
              <p class="mb-1 font-display text-[1.875rem] leading-[1.2] font-bold">{{ t('landing.parent.sample') }}</p>
              <p class="mb-4.5 text-muted">{{ t('landing.parent.sampleDetail') }}</p>
              <div class="flex h-11.5 items-end gap-[5px]">
                @for (d of ribbon; track $index) { <span class="flex-[1_1_0] rounded-[3px]" [style.height]="d.height" [style.background]="d.color"></span> }
              </div>
            </div>
            <div class="min-w-0 flex-[1_1_23.75rem]">
              <p class="mb-2 font-bold text-secondary-600">{{ t('landing.parent.kicker') }}</p>
              <h2 class="mb-3.5 font-display text-[2.375rem] leading-[1.12] font-bold lg:text-[3.25rem]">{{ t('landing.parent.title') }}</h2>
              <p class="max-w-[32em] text-muted">{{ t('landing.parent.text') }}</p>
            </div>
          </div>
        </section>

        <section id="school" class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-5 py-14 lg:px-10 lg:py-24">
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

        <section id="demo" class="bg-primary-600 text-white">
          <div class="mx-auto max-w-[860px] px-5 py-14 text-center lg:px-10 lg:py-24">
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
          <div class="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2.5 px-5 py-5.5 lg:px-10">
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

  /** Teacher names and course words both work: search shows the tab with results. */
  protected search(query: string): void {
    this.router.navigate(['/search'], { queryParams: { q: query.trim() || null } });
  }

  protected readonly contactEmail = environment.contactEmail;
  protected readonly sectionLinks = ['school', 'student', 'teacher', 'parent'];
  protected readonly audiences = AUDIENCES;
  protected readonly ribbon = RIBBON;
  protected readonly tiles = TILES;
  protected readonly cardRows = [
    { subject: 'math', grade: 'veryGood' },
    { subject: 'science', grade: 'veryGood' },
    { subject: 'language', grade: 'excellent' },
  ];

  protected tab = signal(0);
  protected active = computed(() => AUDIENCES[this.tab()]);
}
