import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { map, switchMap } from 'rxjs';
import { pluralKey } from '@/app/core/transloco/plural';

import { parseVideoSource } from '@/app/core/learning/video-source';
import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { CoursePage, formatPrice, MarketplaceService, OutlineLesson, PreviewLesson, Redeemed, ViewerChild } from '@/app/core/marketplace/marketplace.service';
import { FamilyService } from '@/app/core/school/family.service';
import { AqCodeRedeem } from '@/app/shared/marketplace/code-redeem';
import { AqCourseThumb, AqMonogram, durationText } from '@/app/shared/marketplace/market-ui';
import { NotFoundBlock } from './not-found-block';

/** Which call to action the box shows. First match wins: staff, enrolled, soon, pending, code only, free, paid on, paid off. */
export type CtaState = 'staff' | 'enrolled' | 'soon' | 'pending' | 'code' | 'free' | 'askParent' | 'paid' | 'paidOff';

/**
 * The call to action, for the viewer or (a parent) for the chosen child. Students under 18 ask a parent instead of
 * paying (age rules of 2026-11-12); codes and free courses stay open to them.
 */
export function ctaState(page: CoursePage, child: ViewerChild | null = null): CtaState {
  const { course } = page;
  const viewer = child ? { ...page.viewer, enrolled: child.enrolled, hasPendingPayment: child.hasPendingPayment, mustAskParent: false } : page.viewer;
  if (viewer.isStaff && !child) return 'staff';
  if (viewer.enrolled) return 'enrolled';
  if (course.isComingSoon) return 'soon';
  if (viewer.hasPendingPayment && page.onlinePaymentAvailable) return 'pending';
  if (course.codeActivationOnly) return 'code';
  if (course.isFree) return 'free';
  if (viewer.mustAskParent) return 'askParent';
  return page.onlinePaymentAvailable ? 'paid' : 'paidOff';
}

type Intent = 'enrol' | 'buy' | 'code';

const TYPE_ICON: Record<string, string> = { Video: 'circle-play', Article: 'file-text', Quiz: 'list-checks', Assignment: 'clipboard-pen' };

/** Public course page /courses/{slug} (story 3.5.1): what you get, try a free lesson, then join, buy or use a code. */
@Component({
  selector: 'app-market-course',
  imports: [NgTemplateOutlet, RouterLink, MatIconModule, TranslocoDirective, AqCourseThumb, AqMonogram, AqCodeRedeem, NotFoundBlock],
  template: `
    <ng-container *transloco="let t">
      @if (missing()) {
        <aq-not-found-block />
      } @else {
        @let page = data();
        <!-- Hero -->
        <section class="relative overflow-hidden bg-primary-600 text-white">
          <svg aria-hidden="true" class="absolute inset-0 size-full">
            <defs><pattern id="course-lattice" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M48 0 L60 36 L96 48 L60 60 L48 96 L36 60 L0 48 L36 36 Z" fill="none" stroke="#FFFFFF" opacity="0.055" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#course-lattice)" />
          </svg>
          <div class="relative mx-auto max-w-[1240px] px-4 pt-5 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:px-10 lg:pt-10 lg:pb-12">
            @if (page) {
              @let c = page.course;
              <div class="max-w-[720px]">
                <nav class="text-sm text-white/75" [attr.aria-label]="t('market.course.breadcrumb')">
                  <a routerLink="/search" class="text-white/85 hover:underline">{{ t('market.course.breadcrumb') }}</a>
                  @if (c.subjectId) { <span aria-hidden="true"> › </span><a routerLink="/search" [queryParams]="{ subject: c.subjectId }" class="text-white/85 hover:underline">{{ names.subject(c.subjectId) }}</a> }
                </nav>
                <div class="mt-3 flex flex-wrap gap-2">
                  @if (c.isComingSoon) { <span class="badge border-white/20 bg-white/10 text-white">{{ t('market.card.soon') }}</span> }
                  @if (c.codeActivationOnly) { <span class="badge border-white/20 bg-white/10 text-white"><mat-icon svgIcon="key-round" class="icon-size-3.5" />{{ t('market.card.code') }}</span> }
                </div>
                <h1 class="mt-2 font-display text-[2.125rem] leading-[1.1] font-bold text-balance lg:text-[3rem]">{{ c.title }}</h1>
                @if (c.subtitle) { <p class="mt-2 max-w-[40em] text-[1.0625rem] text-[#E3ECE6] lg:text-lg">{{ c.subtitle }}</p> }
                <div class="mt-4 flex items-center gap-3">
                  <aq-monogram [name]="page.teacher?.name || c.teacherName || c.organizationName" [photoUrl]="page.teacher?.photoUrl ?? null" [size]="40" [onDark]="true" />
                  <p class="text-[0.95rem]">
                    @if (c.teacherSlug) {
                      <a [routerLink]="['/t', c.teacherSlug]" class="font-bold text-white underline-offset-4 hover:underline">{{ c.teacherName }}</a>
                    } @else {
                      <span class="font-bold">{{ c.organizationType === 'Center' ? c.organizationName : (c.teacherName || t('market.card.independent')) }}</span>
                    }
                    <span class="text-white/75"> · {{ c.organizationType === 'Center' ? t('market.card.center') : t('market.card.independent') }}</span>
                  </p>
                </div>
                <ul class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
                  @if (c.lessonCount) { <li class="inline-flex items-center gap-1.5"><mat-icon svgIcon="book-open" class="icon-size-4" />{{ t(plural('market.card.lessons', c.lessonCount), { count: c.lessonCount }) }}</li> }
                  @if (c.totalMinutes) { <li class="inline-flex items-center gap-1.5"><mat-icon svgIcon="clock" class="icon-size-4" />{{ duration(c.totalMinutes, t) }}</li> }
                  @if (c.gradeId) { <li class="inline-flex items-center gap-1.5"><mat-icon svgIcon="graduation-cap" class="icon-size-4" />{{ names.grade(c.gradeId) }}</li> }
                  @if (c.freePreviewCount) { <li class="inline-flex items-center gap-1.5"><mat-icon svgIcon="play" class="icon-size-4" />{{ t(plural('market.card.previews', c.freePreviewCount), { count: c.freePreviewCount }) }}</li> }
                </ul>
                <aq-course-thumb class="mt-5 block overflow-hidden rounded-card lg:hidden" [url]="c.thumbnailUrl" [title]="c.title" [subjectId]="c.subjectId" [subjectName]="names.subject(c.subjectId)" />
              </div>
            } @else {
              <div class="flex max-w-[720px] flex-col gap-3" aria-hidden="true">
                <div class="skeleton h-4 w-32 bg-white/15"></div>
                <div class="skeleton h-12 w-11/12 bg-white/15"></div>
                <div class="skeleton h-5 w-2/3 bg-white/15"></div>
                <div class="skeleton h-10 w-56 bg-white/15"></div>
              </div>
            }
          </div>
        </section>

        <div class="mx-auto grid max-w-[1240px] gap-8 px-4 py-6 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:px-10 lg:py-10">
          <!-- CTA (first on phones, sticky aside on laptops) -->
          <aside class="lg:col-start-2 lg:row-start-1 lg:-mt-48">
            <div #ctaCard class="card overflow-hidden shadow-[0_18px_44px_rgba(11,59,46,0.10)] lg:sticky lg:top-6">
              @if (page) {
                <aq-course-thumb class="max-lg:hidden" [url]="page.course.thumbnailUrl" [title]="page.course.title" [subjectId]="page.course.subjectId" [subjectName]="names.subject(page.course.subjectId)" />
                <div class="flex flex-col gap-3 p-5" aria-live="polite">
                  <ng-container *ngTemplateOutlet="cta" />
                </div>
              } @else {
                <div class="flex flex-col gap-3 p-5" aria-hidden="true"><div class="skeleton h-9 w-1/3"></div><div class="skeleton h-12 w-full"></div><div class="skeleton h-4 w-2/3"></div></div>
              }
            </div>
          </aside>

          <div class="flex min-w-0 flex-col gap-8 lg:row-start-1">
            @if (page) {
              <!-- Outline -->
              <section aria-labelledby="outline-title">
                <div class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 id="outline-title" class="section-title">{{ t('market.course.outline') }}</h2>
                  <span class="text-sm text-muted">{{ t(plural('market.course.chapters', page.chapters.length), { count: page.chapters.length }) }} · {{ t(plural('market.card.lessons', page.course.lessonCount), { count: page.course.lessonCount }) }}</span>
                </div>
                @if (page.course.freePreviewCount) { <p class="mb-3 text-sm text-muted">{{ t(plural('market.course.previewCount', page.course.freePreviewCount), { count: page.course.freePreviewCount }) }}</p> }
                @if (page.chapters.length) {
                  <div class="card divide-y divide-line-soft overflow-hidden">
                    @for (ch of page.chapters; track $index; let i = $index) {
                      <div>
                        <button type="button" class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-start hover:bg-page" [attr.aria-expanded]="isOpen(i)" (click)="toggle(i)">
                          <mat-icon svgIcon="chevron-down" class="icon-size-5 text-muted transition-transform motion-reduce:transition-none" [class.rotate-180]="isOpen(i)" />
                          <span class="grow font-bold">{{ ch.title }}</span>
                          <span class="text-sm text-muted">{{ t(plural('market.card.lessons', ch.lessons.length), { count: ch.lessons.length }) }}</span>
                        </button>
                        @if (isOpen(i)) {
                          <ul class="pb-2">
                            @for (l of ch.lessons; track l.id) {
                              <li>
                                @if (l.isFreePreview) {
                                  <button type="button" class="flex min-h-12 w-full cursor-pointer items-center gap-3 ps-11 pe-4 text-start hover:bg-secondary-50" (click)="openPreview(l)">
                                    <mat-icon [svgIcon]="icon(l)" class="icon-size-5 text-secondary-600" />
                                    <span class="grow truncate text-[0.95rem]">{{ l.title }}</span>
                                    <span class="badge badge-info">{{ t('market.course.freePreview') }}</span>
                                    @if (l.durationInMinutes) { <span class="text-sm text-muted tabular-nums">{{ duration(l.durationInMinutes, t) }}</span> }
                                  </button>
                                } @else {
                                  <div class="flex min-h-12 items-center gap-3 ps-11 pe-4">
                                    <mat-icon [svgIcon]="icon(l)" class="icon-size-5 text-muted" />
                                    <span class="sr-only-text">{{ t('market.course.type.' + l.type) }}</span>
                                    <span class="grow truncate text-[0.95rem]">{{ l.title }}</span>
                                    @if (l.durationInMinutes) { <span class="text-sm text-muted tabular-nums">{{ duration(l.durationInMinutes, t) }}</span> }
                                    @if (!page.viewer.enrolled && !page.viewer.isStaff) {
                                      <mat-icon svgIcon="lock" class="icon-size-4 text-field" [attr.aria-label]="t('market.course.locked')" />
                                    }
                                  </div>
                                }
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="empty">{{ t('market.course.noLessons') }}</p>
                }
              </section>

              @if (page.syllabusRequirements) {
                <section>
                  <h2 class="section-title">{{ t('market.course.before') }}</h2>
                  <p class="mt-2 whitespace-pre-line">{{ page.syllabusRequirements }}</p>
                </section>
              }

              <!-- About the teacher -->
              @if (page.teacher; as teacher) {
                <section aria-labelledby="about-teacher" class="card flex gap-4 p-5">
                  <aq-monogram [name]="teacher.name" [photoUrl]="teacher.photoUrl" [size]="72" />
                  <div class="min-w-0">
                    <h2 id="about-teacher" class="text-sm font-bold text-muted">{{ t('market.course.aboutTeacher') }}</h2>
                    <p class="text-lg font-bold">{{ teacher.name }}</p>
                    @if (teacher.headline) { <p class="text-muted">{{ teacher.headline }}</p> }
                    <a [routerLink]="['/t', teacher.slug]" class="mt-2 inline-flex min-h-11 items-center gap-1 font-bold text-secondary-600">
                      {{ t('market.course.teacherLink') }}<mat-icon svgIcon="arrow-left" class="icon-size-4 ltr:-scale-x-100" />
                    </a>
                  </div>
                </section>
              }

              <!-- Access terms -->
              <section class="card card-body">
                <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
                  <dt class="text-muted">{{ t('market.course.access') }}</dt>
                  <dd class="font-semibold">{{ page.accessExpiryPolicy === 'Limited' && page.accessDurationDays ? t('market.course.accessLimited', { days: page.accessDurationDays }) : t('market.course.accessUnlimited') }}</dd>
                  <dt class="text-muted">{{ t('market.course.joinBy') }}</dt>
                  <dd class="font-semibold">{{ page.course.isFree ? t('market.course.joinFree') : page.course.codeActivationOnly ? t('market.course.joinCode') : t('market.course.joinPaid') }}</dd>
                  <dt class="text-muted">{{ t('market.course.account') }}</dt>
                  <dd class="font-semibold">{{ t('market.course.yes') }}</dd>
                </dl>
              </section>
            } @else {
              @for (i of [1, 2, 3]; track i) { <div class="skeleton h-14 w-full" aria-hidden="true"></div> }
            }
          </div>
        </div>

        <!-- Phone bar: price and the main action stay in reach -->
        @if (page && showBar() && !ctaInView()) {
          <div class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
            <div class="grow">
              @if (state() === 'free') { <span class="badge badge-success">{{ t('market.card.free') }}</span> }
              @else if (state() === 'code') { <span class="badge badge-neutral">{{ t('market.card.code') }}</span> }
              @else { <span class="text-lg font-bold tabular-nums">{{ price() }}</span> }
            </div>
            <button type="button" class="btn btn-primary min-h-12 min-w-40" [disabled]="busy()" (click)="primary()">{{ primaryLabel(t) }}</button>
          </div>
        }

        <!-- Free preview -->
        <dialog #previewDialog class="m-auto w-[calc(100vw-2rem)] max-w-[960px] overflow-hidden rounded-hero bg-deep p-0 text-white backdrop:bg-ink/70 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none"
                (close)="preview.set(null)" [attr.aria-labelledby]="'preview-title'">
          @if (preview(); as p) {
            <div class="flex items-center gap-3 px-4 py-3">
              <div class="grow">
                <p class="text-sm text-white/70">{{ t('market.course.previewTitle') }}</p>
                <h2 id="preview-title" class="font-bold">{{ p.title }}</h2>
              </div>
              <button type="button" class="btn btn-icon border-white/20 bg-transparent text-white" [attr.aria-label]="t('market.course.close')" (click)="closePreview()"><mat-icon svgIcon="x" class="icon-size-5" /></button>
            </div>
            @if (embed(); as src) {
              <div class="aspect-video bg-black"><iframe [src]="src" class="size-full" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen [title]="p.title"></iframe></div>
            } @else if (fileUrl(); as file) {
              <video class="aspect-video w-full bg-black" [src]="file" controls preload="metadata"></video>
            } @else if (p.videoUrl) {
              <p class="px-4 pb-4"><a class="text-white underline" [href]="p.videoUrl" target="_blank" rel="noopener">{{ t('market.course.videoLink') }}</a></p>
            }
            @if (p.content || p.summary) {
              <div class="prose-aqlam max-h-[50dvh] overflow-y-auto bg-white p-5 text-ink" [innerHTML]="p.content || p.summary"></div>
            }
            <div class="flex flex-wrap items-center gap-3 bg-white px-4 py-3 text-ink">
              <span class="grow font-semibold">{{ t('market.course.previewLiked') }}</span>
              @if (showBar()) { <button type="button" class="btn btn-primary" (click)="closePreview(); primary()">{{ primaryLabel(t) }}</button> }
            </div>
          } @else if (previewLoading()) {
            <div class="skeleton aspect-video bg-white/10" aria-hidden="true"></div>
          }
        </dialog>
      }

      <ng-template #cta>
        @let page = data()!;
        @if (children().length) {
          <label class="field">
            <span class="field-label">{{ t('age.whoFor') }}</span>
            <select class="select min-h-11" (change)="chooseChild($any($event.target).value)">
              @for (c of children(); track c.userId) { <option [value]="c.userId" [selected]="child()?.userId === c.userId">{{ c.name }}</option> }
            </select>
          </label>
        }
        @if (done()) { <p class="alert alert-success" role="status">{{ done() }}</p> }
        @switch (state()) {
          @case ('staff') {
            <span class="badge badge-info w-fit">{{ t('market.cta.staff') }}</span>
            <a class="btn btn-primary btn-block min-h-12" [routerLink]="['/learn', page.organizationSlug, page.courseId]">{{ t('market.cta.staff') }}</a>
            <p class="text-sm text-muted">{{ t('market.cta.staffHint') }}</p>
          }
          @case ('enrolled') {
            @if (child(); as c) {
              <span class="badge badge-success w-fit"><mat-icon svgIcon="check" class="icon-size-3.5" />{{ t('age.childEnrolled', { name: c.name }) }}</span>
            } @else {
              <span class="badge badge-success w-fit"><mat-icon svgIcon="check" class="icon-size-3.5" />{{ t('market.cta.enrolledHint') }}</span>
              <a class="btn btn-primary btn-block min-h-12" [routerLink]="['/learn', page.organizationSlug, page.courseId]">{{ t('market.cta.continue') }}</a>
            }
          }
          @case ('askParent') {
            <p class="text-[1.75rem] font-bold tabular-nums">{{ price() }}</p>
            <div class="alert alert-info flex-col items-start gap-1">
              <p class="font-bold">{{ t('age.askParentTitle') }}</p>
              <p class="text-sm">{{ t('age.askParentBody') }}</p>
            </div>
            @if (familyCode(); as code) {
              <div class="rounded-ui border border-line bg-page p-3 text-center">
                <p class="text-sm text-muted">{{ t('age.familyCodeLabel') }}</p>
                <p dir="ltr" class="font-mono text-2xl font-bold tracking-[0.2em]">{{ code }}</p>
                <p class="text-sm text-muted">{{ t('age.familyCodeHint') }}</p>
              </div>
            } @else {
              <button type="button" class="btn btn-primary btn-block min-h-12" [disabled]="busy()" (click)="makeFamilyCode()">{{ t('age.askParentButton') }}</button>
            }
            <ng-container *ngTemplateOutlet="codeArea" />
          }
          @case ('soon') {
            <span class="badge badge-warning w-fit">{{ t('market.cta.soon') }}</span>
            @if (!page.course.isFree && page.course.price !== null) { <p class="text-[1.75rem] font-bold text-muted tabular-nums">{{ price() }}</p> }
            <button type="button" class="btn btn-block min-h-12" disabled>{{ t('market.cta.soon') }}</button>
            <p class="text-sm text-muted">{{ t('market.cta.soonHint') }}</p>
          }
          @case ('pending') {
            <p class="text-[1.75rem] font-bold tabular-nums">{{ price() }}</p>
            <button type="button" class="btn btn-primary btn-block min-h-12" [disabled]="busy()" (click)="primary()">{{ t('market.cta.continuePayment') }}</button>
            <p class="text-sm text-muted">{{ t('market.cta.pendingHint') }}</p>
          }
          @case ('code') {
            <span class="badge badge-neutral w-fit"><mat-icon svgIcon="key-round" class="icon-size-3.5" />{{ t('market.card.code') }}</span>
            <ng-container *ngTemplateOutlet="codeArea" />
            <p class="text-sm text-muted">{{ t('market.cta.codeHint') }}</p>
          }
          @case ('free') {
            <span class="badge badge-success w-fit">{{ t('market.card.free') }}</span>
            <button type="button" class="btn btn-primary btn-block min-h-12" [disabled]="busy()" (click)="primary()">{{ primaryLabel(t) }}</button>
            @if (!page.viewer.signedIn) {
              <a class="text-center text-sm font-semibold text-secondary-600" routerLink="/auth/sign-in" [queryParams]="{ redirectURL: returnUrl('enrol') }">{{ t('market.cta.haveAccount') }}</a>
              <p class="text-sm text-muted">{{ t('market.cta.freeHint') }}</p>
            }
          }
          @case ('paid') {
            <p class="text-[1.75rem] font-bold tabular-nums">{{ price() }}</p>
            <button type="button" class="btn btn-primary btn-block min-h-12" [disabled]="busy()" (click)="primary()">{{ primaryLabel(t) }}</button>
            <p class="text-sm text-muted">{{ t('market.cta.oneTime') }}</p>
            <p class="text-sm font-semibold text-warning-700">{{ t('market.cta.testMode') }}</p>
            @if (!page.viewer.signedIn) { <p class="text-sm text-muted">{{ t('market.cta.minor') }}</p> }
            <ng-container *ngTemplateOutlet="codeArea" />
          }
          @case ('paidOff') {
            <p class="text-[1.75rem] font-bold tabular-nums">{{ price() }}</p>
            <div class="alert alert-info flex-col items-start gap-1">
              <p class="font-bold">{{ t('market.cta.offTitle') }}</p>
              <p class="text-sm">{{ t('market.cta.offBody') }}</p>
            </div>
            <ng-container *ngTemplateOutlet="codeArea" />
          }
        }
        @if (actionError()) { <p class="field-error" role="alert">{{ t(actionError()!) }}</p> }
      </ng-template>

      <ng-template #codeArea>
        @let page = data()!;
        @if (!page.viewer.signedIn) {
          <a class="btn btn-outline btn-block min-h-12" routerLink="/auth/sign-in" [queryParams]="{ redirectURL: returnUrl('code') }">{{ state() === 'code' ? t('market.cta.enterCode') : t('market.cta.haveCode') }}</a>
        } @else if (codeOpen() || state() === 'code') {
          <div #codeBox>
            <aq-code-redeem [courseId]="page.courseId" [forUserId]="child()?.userId ?? null" (redeemed)="onRedeemed($event)" />
          </div>
        } @else {
          <button type="button" class="btn btn-ghost text-secondary-600" (click)="codeOpen.set(true)">{{ t('market.cta.haveCode') }}</button>
        }
      </ng-template>
    </ng-container>
  `,
})
export default class MarketCoursePage {
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  private api = inject(MarketplaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private transloco = inject(TranslocoService);
  private sanitizer = inject(DomSanitizer);
  private title = inject(Title);
  private meta = inject(Meta);
  protected names = inject(LookupNames);
  private injector = inject(Injector);
  protected duration = durationText;

  private previewDialog = viewChild<ElementRef<HTMLDialogElement>>('previewDialog');
  private ctaCard = viewChild<ElementRef<HTMLElement>>('ctaCard');
  /** The phone bar repeats the main action only while the box itself is off screen. */
  protected ctaInView = signal(true);

  protected data = signal<CoursePage | null>(null);
  protected missing = signal(false);
  protected busy = signal(false);
  protected actionError = signal<string | null>(null);
  protected codeOpen = signal(false);
  private open = signal<Set<number>>(new Set([0]));

  protected preview = signal<PreviewLesson | null>(null);
  protected previewLoading = signal(false);

  /** A parent's linked children; the chosen one gets the course. */
  protected children = computed<ViewerChild[]>(() => this.data()?.viewer.children ?? []);
  private chosenChild = signal<string | null>(null);
  protected child = computed<ViewerChild | null>(() => {
    const list = this.children();
    return list.find(c => c.userId === this.chosenChild()) ?? list[0] ?? null;
  });
  protected familyCode = signal<string | null>(null);
  protected done = signal<string | null>(null);
  private family = inject(FamilyService);

  protected state = computed<CtaState | null>(() => (this.data() ? ctaState(this.data()!, this.child()) : null));
  protected showBar = computed(() => ['free', 'paid', 'pending', 'code'].includes(this.state() ?? ''));
  protected price = computed(() => {
    const c = this.data()?.course;
    return c && c.price !== null ? formatPrice(c.price, c.currency, this.transloco.getActiveLang()) : '';
  });

  protected embed = computed<SafeResourceUrl | null>(() => {
    const source = parseVideoSource(this.preview()?.videoUrl, typeof location === 'undefined' ? '' : location.origin);
    return source && 'embedUrl' in source ? this.sanitizer.bypassSecurityTrustResourceUrl(source.embedUrl) : null;
  });
  protected fileUrl = computed(() => {
    const source = parseVideoSource(this.preview()?.videoUrl);
    return source?.kind === 'file' ? source.url : null;
  });

  constructor() {
    this.names.load();
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let observer: IntersectionObserver | null = null;
      effect(() => {
        observer?.disconnect();
        const el = this.ctaCard()?.nativeElement;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        observer = new IntersectionObserver(([entry]) => this.ctaInView.set(entry.isIntersecting));
        observer.observe(el);
      }, { injector: this.injector });
      destroyRef.onDestroy(() => observer?.disconnect());
    });
    this.route.paramMap
      .pipe(
        map(p => p.get('slug') ?? ''),
        switchMap(slug => {
          this.data.set(null);
          this.missing.set(false);
          return this.api.course(slug);
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: page => {
          this.data.set(page);
          // Keep the current address after a rename (old links find the course by its short code).
          if (page.course.slug !== this.route.snapshot.paramMap.get('slug'))
            this.router.navigate(['/courses', page.course.slug], { replaceUrl: true, queryParamsHandling: 'preserve' });
          this.title.setTitle(`${page.course.title} | أقلام`);
          this.meta.updateTag({ name: 'description', content: page.course.subtitle ?? page.course.title });
          this.meta.updateTag({ property: 'og:title', content: page.course.title });
          this.resumeIntent(page);
        },
        error: () => this.missing.set(true),
      });
  }

  protected isOpen(i: number): boolean {
    return this.open().has(i);
  }

  protected toggle(i: number): void {
    this.open.update(set => {
      const next = new Set(set);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  protected icon(l: OutlineLesson): string {
    return TYPE_ICON[l.type] ?? 'file';
  }

  protected returnUrl(intent: Intent): string {
    return `/courses/${this.data()?.course.slug}?intent=${intent}`;
  }

  protected primaryLabel(t: (k: string) => string): string {
    const signedIn = this.data()?.viewer.signedIn;
    switch (this.state()) {
      case 'free':
        return t(signedIn ? 'market.cta.start' : 'market.cta.signUpStart');
      case 'paid':
        return t(signedIn ? 'market.cta.buy' : 'market.cta.signUpBuy');
      case 'pending':
        return t('market.cta.continuePayment');
      case 'code':
        return t('market.cta.enterCode');
      default:
        return '';
    }
  }

  /** The main action of the current state; visitors first create an account and come back to the same step. */
  protected primary(): void {
    const page = this.data();
    if (!page) return;
    const state = this.state();
    const intent: Intent = state === 'free' ? 'enrol' : state === 'code' ? 'code' : 'buy';
    if (!page.viewer.signedIn) {
      this.router.navigate(['/auth/sign-up'], { queryParams: { redirectURL: this.returnUrl(intent) } });
      return;
    }
    if (state === 'free') this.enrol(page);
    else if (state === 'paid' || state === 'pending') this.buy(page);
    else if (state === 'code') document.getElementById(this.codeInputId())?.focus();
  }

  protected async openPreview(lesson: OutlineLesson): Promise<void> {
    const page = this.data();
    if (!page) return;
    this.preview.set(null);
    this.previewLoading.set(true);
    this.previewDialog()?.nativeElement.showModal();
    this.api.preview(page.course.slug, lesson.id).subscribe({
      next: p => (this.preview.set(p), this.previewLoading.set(false)),
      error: () => (this.previewLoading.set(false), this.closePreview()),
    });
  }

  protected closePreview(): void {
    this.previewDialog()?.nativeElement.close();
    this.preview.set(null);
  }

  protected chooseChild(userId: string): void {
    this.chosenChild.set(userId);
    this.done.set(null);
    this.actionError.set(null);
  }

  /** A teenager's family code for a parent, who enters it in "My children" and can then buy the course. */
  protected makeFamilyCode(): void {
    this.busy.set(true);
    this.family.familyInvite().subscribe({
      next: invite => (this.busy.set(false), this.familyCode.set(invite.code)),
      error: () => (this.busy.set(false), this.actionError.set('market.cta.enrollFailed')),
    });
  }

  protected onRedeemed(result: Redeemed): void {
    if (this.child()) this.doneForChild();
    else this.router.navigate(['/learn', result.organizationSlug, result.courseId]);
  }

  /** A parent stays on the page: the course is now the child's (the parent cannot open the child's lessons). */
  private doneForChild(): void {
    const name = this.child()?.name ?? '';
    this.busy.set(false);
    this.codeOpen.set(false);
    this.done.set(this.transloco.translate('age.childEnrolled', { name }));
    const slug = this.data()?.course.slug;
    if (slug) this.api.course(slug).subscribe(page => this.data.set(page));
  }

  private codeInputId(): string {
    return document.querySelector<HTMLInputElement>('aq-code-redeem input')?.id ?? '';
  }

  private enrol(page: CoursePage): void {
    this.busy.set(true);
    this.actionError.set(null);
    const forChild = this.child();
    this.api.enroll(page.organizationSlug, page.courseId, forChild?.userId).subscribe({
      next: () => (forChild ? this.doneForChild() : this.router.navigate(['/learn', page.organizationSlug, page.courseId])),
      error: err => {
        this.busy.set(false);
        // Already enrolled (e.g. in another tab): just open the course.
        if (err?.status === 409) this.router.navigate(['/learn', page.organizationSlug, page.courseId]);
        else this.actionError.set('market.cta.enrollFailed');
      },
    });
  }

  private buy(page: CoursePage): void {
    this.busy.set(true);
    this.actionError.set(null);
    this.api.checkout(page.organizationSlug, page.courseId, this.child()?.userId).subscribe({
      next: checkout => this.router.navigateByUrl(checkout.redirectUrl),
      error: err => {
        this.busy.set(false);
        if (err?.status === 409 && JSON.stringify(err.error ?? '').includes('already enrolled'))
          this.router.navigate(['/learn', page.organizationSlug, page.courseId]);
        else this.actionError.set('market.cta.checkoutFailed');
      },
    });
  }

  /** Back from sign-up/sign-in with ?intent=: continue the step the visitor started (never pays by itself). */
  private resumeIntent(page: CoursePage): void {
    const intent = this.route.snapshot.queryParamMap.get('intent') as Intent | null;
    if (!intent || !page.viewer.signedIn) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { intent: null }, queryParamsHandling: 'merge', replaceUrl: true });
    const state = ctaState(page, page.viewer.children?.[0] ?? null);
    if (intent === 'enrol' && state === 'free') this.enrol(page);
    else if (intent === 'code' || (intent === 'buy' && state === 'paidOff')) this.codeOpen.set(true);
    // "buy" stops on the page: the student presses Buy themselves.
  }
}
