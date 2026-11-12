import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { pluralKey } from '@/app/core/transloco/plural';

import { CourseCard, formatPrice, TeacherCard } from '@/app/core/marketplace/marketplace.service';
import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { subjectMark } from '@/app/core/learning/subject-look';

const BLUE = 'var(--color-subject-blue)';
const GREEN = 'var(--color-subject-green)';
const EARTH = 'var(--color-subject-earth)';

/** Same three subject colours as the student home: maths and physics blue, sciences green, languages and social earth. */
export function subjectColor(subjectId: number | null | undefined): string {
  switch (subjectId) {
    case 3:
    case 6:
      return BLUE;
    case 4:
    case 7:
    case 8:
      return GREEN;
    case 1:
    case 2:
    case 5:
      return EARTH;
    default:
      return [BLUE, GREEN, EARTH][Math.abs(subjectId ?? 0) % 3];
  }
}

/** Up to two initials, skipping titles (أ. / د.) and the article "ال": "أ. هدى العتيبي" gives "ه ع". */
export function initials(name: string): string {
  const words = name
    .replace(/^(أ|د|م|Mr|Ms|Mrs|Dr)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const letter = (w: string) => Array.from(w.startsWith('ال') && w.length > 3 ? w.slice(2) : w)[0]?.toLocaleUpperCase() ?? '';
  if (words.length === 0) return '';
  return words.length === 1 ? letter(words[0]) : `${letter(words[0])} ${letter(words[words.length - 1])}`;
}

/** "12 س 30 د" / "45 د"; empty when unknown. */
export function durationText(minutes: number, t: (key: string, params?: Record<string, unknown>) => string): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? t('market.card.hours', { h }) : '', m ? t('market.card.minutes', { m }) : ''].filter(Boolean).join(' ');
}

/** A teacher's photo, or a square ink seal with their initials (a dignified default, not an "incomplete" look). */
@Component({
  selector: 'aq-monogram',
  template: `
    @if (photoUrl()) {
      <img [src]="photoUrl()" alt="" class="block rounded-ui border border-line bg-neutral-100 object-cover" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-ui font-display leading-none font-bold ring-1 ring-inset"
            [class]="onDark() ? 'bg-white/10 text-white ring-white/15' : 'bg-deep text-primary-100 ring-white/10'"
            [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.5">{{ letters() }}</span>
    }
  `,
  host: { class: 'shrink-0', '[attr.aria-hidden]': 'true' },
})
export class AqMonogram {
  readonly name = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly size = input(56);
  readonly onDark = input(false);
  protected letters = computed(() => initials(this.name()) || 'أ');
}

/** Course image, or the subject tile used on student screens (subject colour, letter, subject name). */
@Component({
  selector: 'aq-course-thumb',
  template: `
    <div class="relative aspect-video overflow-hidden" [class.grayscale-[35%]]="dim()">
      @if (url()) {
        <img [src]="url()" alt="" loading="lazy" class="size-full bg-neutral-100 object-cover" />
      } @else {
        <div class="relative flex size-full items-center justify-center" [style.background]="color()">
          <svg aria-hidden="true" class="absolute inset-0 size-full">
            <defs><pattern [attr.id]="patternId" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 28 L28 0" stroke="#fff" opacity="0.07" /></pattern></defs>
            <rect width="100%" height="100%" [attr.fill]="'url(#' + patternId + ')'" />
          </svg>
          <span aria-hidden="true" class="relative font-display leading-none font-bold text-white" [class]="large() ? 'text-[6rem]' : 'text-[4rem]'">{{ mark() }}</span>
          @if (subjectName()) {
            <span class="absolute start-4 bottom-3 text-sm font-semibold text-white/85">{{ subjectName() }}</span>
          }
        </div>
      }
      <ng-content />
    </div>
  `,
})
export class AqCourseThumb {
  private static next = 0;
  protected patternId = `thumb-grid-${AqCourseThumb.next++}`;
  readonly url = input<string | null>(null);
  readonly title = input('');
  readonly subjectId = input<number | null>(null);
  readonly subjectName = input('');
  readonly large = input(false);
  readonly dim = input(false);
  protected color = computed(() => subjectColor(this.subjectId()));
  protected mark = computed(() => subjectMark(this.subjectName() || this.title()));
}

/** One course in search results, picks and teacher pages. The whole card is one link. */
@Component({
  selector: 'aq-course-card',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqCourseThumb],
  template: `
    <ng-container *transloco="let t">
      @let c = course();
      <a [routerLink]="['/courses', c.slug]" class="card group flex h-full flex-col overflow-hidden text-ink no-underline hover:border-line-strong focus-visible:outline-3 focus-visible:outline-secondary-200">
        <aq-course-thumb [url]="c.thumbnailUrl" [title]="c.title" [subjectId]="c.subjectId" [subjectName]="names.subject(c.subjectId)" [dim]="c.isComingSoon">
          @if (c.isComingSoon) {
            <span class="badge badge-warning absolute end-3 top-3 bg-white/95">{{ t('market.card.soon') }}</span>
          }
        </aq-course-thumb>
        <div class="flex flex-1 flex-col gap-2 p-4">
          <h3 class="line-clamp-2 text-[1.0625rem] leading-snug font-semibold">{{ c.title }}</h3>
          @if (showTeacher()) {
            <p class="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
              @if (c.organizationType === 'Center') {
                <mat-icon svgIcon="building-2" class="icon-size-4" />
                <span>{{ c.teacherName && c.teacherName !== c.organizationName ? c.teacherName + ' · ' : '' }}{{ c.organizationName }}</span>
              } @else {
                <span>{{ c.teacherName || t('market.card.independent') }}</span>
                @if (c.teacherName) { <span>· {{ t('market.card.independent') }}</span> }
              }
            </p>
          }
          @if (c.lessonCount || c.totalMinutes) {
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              @if (c.lessonCount) { <span class="inline-flex items-center gap-1"><mat-icon svgIcon="book-open" class="icon-size-4" />{{ t(plural('market.card.lessons', c.lessonCount), { count: c.lessonCount }) }}</span> }
              @if (c.totalMinutes) { <span class="inline-flex items-center gap-1"><mat-icon svgIcon="clock" class="icon-size-4" />{{ duration(c.totalMinutes, t) }}</span> }
            </p>
          }
          @if (c.freePreviewCount && !c.isFree) {
            <span class="badge badge-info w-fit"><mat-icon svgIcon="play" class="icon-size-3.5" />{{ t(plural('market.card.previews', c.freePreviewCount), { count: c.freePreviewCount }) }}</span>
          }
        </div>
        <div class="mt-auto flex min-h-12 items-center gap-2 border-t border-line-soft px-4 py-3">
          @if (c.isComingSoon) {
            <span class="text-sm text-muted">{{ t('market.card.soonFooter') }}</span>
          } @else if (c.codeActivationOnly) {
            <span class="badge badge-neutral"><mat-icon svgIcon="key-round" class="icon-size-3.5" />{{ t('market.card.code') }}</span>
          } @else if (c.isFree) {
            <span class="badge badge-success">{{ t('market.card.free') }}</span>
          } @else if (c.price !== null) {
            <span class="text-lg font-bold text-ink tabular-nums">{{ price(c) }}</span>
          }
        </div>
      </a>
    </ng-container>
  `,
  host: { class: 'block h-full' },
})
export class AqCourseCard {
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  protected names = inject(LookupNames);
  private transloco = inject(TranslocoService);
  readonly course = input.required<CourseCard>();
  readonly showTeacher = input(true);
  protected duration = durationText;
  protected price(c: CourseCard): string {
    return formatPrice(c.price ?? 0, c.currency, this.transloco.getActiveLang());
  }
}

/** One teacher in search and picks; links to the teacher's page. Gender feeds the filter and the "معلم/معلمة" word only. */
@Component({
  selector: 'aq-teacher-card',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqMonogram],
  template: `
    <ng-container *transloco="let t">
      @let p = teacher();
      <a [routerLink]="['/t', p.slug]" class="card flex h-full flex-col gap-3 p-4 text-ink no-underline hover:border-line-strong focus-visible:outline-3 focus-visible:outline-secondary-200">
        <div class="flex items-start gap-3">
          <aq-monogram [name]="p.name" [photoUrl]="p.photoUrl" [size]="56" />
          <div class="min-w-0">
            <h3 class="truncate text-[1.0625rem] font-bold">{{ p.name }}</h3>
            <p class="text-sm text-muted">{{ t('market.gender.' + p.gender) }}@if (p.city) { · {{ p.city }} }</p>
          </div>
        </div>
        @if (p.headline) { <p class="line-clamp-2 text-sm text-muted">{{ p.headline }}</p> }
        @if (p.subjectIds.length) {
          <div class="flex flex-wrap gap-1.5">
            @for (id of p.subjectIds.slice(0, 3); track id) {
              <span class="badge badge-neutral"><span class="size-2.5 rounded-[3px]" [style.background]="color(id)"></span>{{ names.subject(id) }}</span>
            }
            @if (p.subjectIds.length > 3) { <span class="badge badge-neutral">+{{ p.subjectIds.length - 3 }}</span> }
          </div>
        }
        <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-sm text-muted">
          <span class="grow">{{ p.courseCount ? t(plural('market.card.courses', p.courseCount), { count: p.courseCount }) : t('market.card.noCourses') }}</span>
          @if (picked()) { <span class="badge badge-neutral"><mat-icon svgIcon="bookmark" class="icon-size-3.5" />{{ t('market.pick') }}</span> }
        </div>
      </a>
    </ng-container>
  `,
  host: { class: 'block h-full' },
})
export class AqTeacherCard {
  private transloco = inject(TranslocoService);
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  protected names = inject(LookupNames);
  readonly teacher = input.required<TeacherCard>();
  readonly picked = input(false);
  protected color = subjectColor;
}

/** Placeholder with the same box sizes as a course card, so the grid does not jump. */
@Component({
  selector: 'aq-card-skeleton',
  template: `
    <div class="card flex h-full flex-col overflow-hidden" aria-hidden="true">
      <div class="skeleton aspect-video rounded-none"></div>
      <div class="flex flex-col gap-2 p-4">
        <div class="skeleton h-5 w-11/12"></div>
        <div class="skeleton h-5 w-2/3"></div>
        <div class="skeleton h-4 w-1/2"></div>
      </div>
      <div class="mt-auto border-t border-line-soft px-4 py-3"><div class="skeleton h-6 w-1/3"></div></div>
    </div>
  `,
  host: { class: 'block h-full' },
})
export class AqCardSkeleton {}
