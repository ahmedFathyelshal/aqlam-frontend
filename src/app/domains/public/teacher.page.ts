import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { map, switchMap } from 'rxjs';
import { pluralKey } from '@/app/core/transloco/plural';

import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { MarketplaceService, TeacherPage } from '@/app/core/marketplace/marketplace.service';
import { AqCardSkeleton, AqCourseCard, AqMonogram, subjectColor } from '@/app/shared/marketplace/market-ui';
import { NotFoundBlock } from './not-found-block';
import { SeoService } from '@/app/core/services/seo.service';

/** An independent teacher's public page /t/{slug}: who they are, then their courses. No contact details (minors read it). */
@Component({
  selector: 'app-market-teacher',
  imports: [MatIconModule, TranslocoDirective, AqCourseCard, AqMonogram, AqCardSkeleton, NotFoundBlock],
  template: `
    <ng-container *transloco="let t">
      @if (missing()) {
        <aq-not-found-block />
      } @else {
        @let page = data();
        <section class="relative overflow-hidden bg-primary-600 text-white">
          <svg aria-hidden="true" class="absolute inset-0 size-full">
            <defs><pattern id="teacher-lattice" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M48 0 L60 36 L96 48 L60 60 L48 96 L36 60 L0 48 L36 36 Z" fill="none" stroke="#FFFFFF" opacity="0.055" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#teacher-lattice)" />
          </svg>
          <div class="relative mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pt-6 pb-8 lg:flex-row lg:items-end lg:gap-6 lg:px-10 lg:pt-12 lg:pb-14">
            @if (page) {
              <aq-monogram class="lg:hidden" [name]="page.teacher.name" [photoUrl]="page.teacher.photoUrl" [size]="96" [onDark]="true" />
              <aq-monogram class="max-lg:hidden" [name]="page.teacher.name" [photoUrl]="page.teacher.photoUrl" [size]="128" [onDark]="true" />
              <div class="min-w-0 grow">
                <h1 class="font-display text-[2.25rem] leading-[1.1] font-bold lg:text-[3.25rem]">{{ page.teacher.name }}</h1>
                @if (page.teacher.headline) { <p class="mt-1 text-lg text-[#E3ECE6]">{{ page.teacher.headline }}</p> }
                <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
                  <span>{{ t('market.gender.' + page.teacher.gender) }} · {{ t('market.card.independent') }}</span>
                  @if (page.teacher.city) { <span class="inline-flex items-center gap-1"><mat-icon svgIcon="map-pin" class="icon-size-4" />{{ page.teacher.city }}</span> }
                  <span class="inline-flex items-center gap-1"><mat-icon svgIcon="book-open" class="icon-size-4" />{{ t(plural('market.card.courses', page.courses.length), { count: page.courses.length }) }}</span>
                </p>
              </div>
              <button type="button" class="btn min-h-11 border-white/30 bg-transparent text-white hover:bg-white/10" (click)="share()">
                <mat-icon svgIcon="link" class="icon-size-4" />{{ copied() ? t('market.teacherPage.copied') : t('market.teacherPage.share') }}
              </button>
            } @else {
              <div class="skeleton size-24 bg-white/15 lg:size-32" aria-hidden="true"></div>
              <div class="flex grow flex-col gap-2" aria-hidden="true">
                <div class="skeleton h-10 w-2/3 bg-white/15"></div>
                <div class="skeleton h-5 w-1/2 bg-white/15"></div>
              </div>
            }
          </div>
        </section>

        <div class="mx-auto grid max-w-[1240px] gap-10 px-4 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-10 lg:py-12">
          <aside class="flex flex-col gap-6">
            @if (page?.teacher?.subjectIds?.length) {
              <section>
                <h2 class="section-title">{{ t('market.teacherPage.subjects') }}</h2>
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (id of page!.teacher.subjectIds; track id) {
                    <span class="badge badge-neutral"><span class="size-3 rounded-[3px]" [style.background]="color(id)"></span>{{ names.subject(id) }}</span>
                  }
                </div>
              </section>
            }
            @if (page?.bio) {
              <section>
                <h2 class="section-title">{{ t('market.teacherPage.about') }}</h2>
                <p class="mt-2 leading-[1.8] whitespace-pre-line" [class.line-clamp-6]="!bioOpen()">{{ page!.bio }}</p>
                @if (!bioOpen() && page!.bio!.length > 280) {
                  <button type="button" class="btn btn-ghost btn-sm mt-1 text-secondary-600" (click)="bioOpen.set(true)">{{ t('market.teacherPage.readMore') }}</button>
                }
              </section>
            }
            <p class="text-sm text-muted">{{ t('market.teacherPage.footer') }}</p>
          </aside>

          <section>
            <h2 class="section-title">{{ t('market.teacherPage.courses') }}</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
              @if (page) {
                @for (c of page.courses; track c.slug) { <aq-course-card [course]="c" [showTeacher]="false" /> }
                @empty { <p class="empty col-span-full">{{ t('market.teacherPage.noCourses') }}</p> }
              } @else {
                @for (i of [1, 2, 3]; track i) { <aq-card-skeleton /> }
              }
            </div>
          </section>
        </div>
      }
    </ng-container>
  `,
})
export default class MarketTeacherPage {
  private transloco = inject(TranslocoService);
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  private api = inject(MarketplaceService);
  private seo = inject(SeoService);
  protected names = inject(LookupNames);
  protected color = subjectColor;

  protected data = signal<TeacherPage | null>(null);
  protected missing = signal(false);
  protected bioOpen = signal(false);
  protected copied = signal(false);
  protected subjectCount = computed(() => this.data()?.teacher.subjectIds.length ?? 0);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map(p => p.get('slug') ?? ''),
        switchMap(slug => {
          this.data.set(null);
          this.missing.set(false);
          return this.api.teacher(slug);
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: page => {
          this.data.set(page);
          this.seo.set({
            title: page.teacher.name,
            description: [page.teacher.headline, page.teacher.city].filter(Boolean).join(' · ') || page.teacher.name,
            path: `/t/${page.teacher.slug}`,
            image: page.teacher.photoUrl,
            type: 'profile',
          });
        },
        error: () => this.missing.set(true),
      });
  }

  protected share(): void {
    navigator.clipboard?.writeText(location.href).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
