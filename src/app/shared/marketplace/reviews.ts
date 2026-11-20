import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { MarketplaceService, Reviews } from '@/app/core/marketplace/marketplace.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** "★ 4.6 (23)": a rating with its count. Shows nothing until the course or teacher has enough reviews. */
@Component({
  selector: 'aq-stars',
  template: `
    @if (average() !== null) {
      <span class="inline-flex items-center gap-1 text-sm" [attr.aria-label]="average() + ' / 5'">
        <span aria-hidden="true" class="text-warning-700">★</span>
        <b class="tabular-nums">{{ average() }}</b>
        @if (count()) { <span class="text-muted tabular-nums">({{ count() }})</span> }
      </span>
    }
  `,
})
export class AqStars {
  readonly average = input<number | null | undefined>(null);
  readonly count = input(0);
}

/** A course's reviews: summary, the list, and (for an enrolled student who started the course) a form. */
@Component({
  selector: 'aq-reviews',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <section aria-labelledby="reviews-title" class="flex flex-col gap-4">
        <h2 id="reviews-title" class="section-title">{{ t('market.reviews.title') }}</h2>

        @if (data(); as d) {
          @if (d.total === 0) {
            <p class="text-muted">{{ t('market.reviews.none') }}</p>
          } @else {
            <div class="card card-body flex flex-wrap items-center gap-6">
              @if (d.summary.average !== null) {
                <div class="text-center">
                  <p class="text-4xl font-bold tabular-nums">{{ d.summary.average }}</p>
                  <p class="text-warning-700" aria-hidden="true">{{ starsText(d.summary.average) }}</p>
                  <p class="text-sm text-muted">{{ t('market.reviews.count', { count: d.total }) }}</p>
                </div>
                <ul class="min-w-48 flex-1 space-y-1" [attr.aria-label]="t('market.reviews.distribution')">
                  @for (n of [5, 4, 3, 2, 1]; track n) {
                    <li class="flex items-center gap-2 text-sm">
                      <span class="w-4 tabular-nums">{{ n }}</span>
                      <span class="h-2 flex-1 overflow-hidden rounded-chip bg-neutral-100">
                        <span class="block h-full bg-warning-700" [style.width.%]="share(d.summary.distribution[n - 1], d.total)"></span>
                      </span>
                      <span class="w-8 text-end text-muted tabular-nums">{{ d.summary.distribution[n - 1] }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-muted">{{ t('market.reviews.notEnough', { count: d.total, min: 5 }) }}</p>
              }
            </div>
            <ul class="divide-y divide-line-soft rounded-ui border border-line bg-white">
              @for (r of d.items; track r.id) {
                <li class="flex flex-col gap-1 px-4 py-3">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span class="text-warning-700" aria-hidden="true">{{ starsText(r.stars) }}</span>
                    <span class="sr-only-text">{{ r.stars }} / 5</span>
                    <span class="font-semibold">{{ r.reviewer || t('market.reviews.student') }}@if (r.mine) { <span class="badge badge-neutral ms-2">{{ t('market.reviews.yours') }}</span> }</span>
                    <span class="text-sm text-muted tabular-nums" dir="ltr">{{ date(r.createdAtUtc) }}</span>
                  </div>
                  @if (r.comment) { <p class="whitespace-pre-line break-words">{{ r.comment }}</p> }
                </li>
              }
            </ul>
            @if (d.items.length < d.total) {
              <button type="button" class="btn btn-outline btn-sm w-fit" [disabled]="busy()" (click)="more()">{{ t('market.showMore') }}</button>
            }
          }

          <!-- Write or change a review -->
          @if (d.canReview) {
            <form class="card card-body flex flex-col gap-3" (submit)="$event.preventDefault(); save()">
              <h3 class="font-bold">{{ d.mine ? t('market.reviews.edit') : t('market.reviews.write') }}</h3>
              <div class="flex items-center gap-1" role="radiogroup" [attr.aria-label]="t('market.reviews.yourRating')">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" role="radio" [attr.aria-checked]="stars() === n" [attr.aria-label]="n + ' / 5'"
                          class="size-11 rounded-ui text-3xl leading-none focus-visible:outline-3 focus-visible:outline-secondary-200"
                          [class]="n <= stars() ? 'text-warning-700' : 'text-neutral-300'" (click)="stars.set(n)">★</button>
                }
              </div>
              <label class="flex flex-col gap-1">
                <span class="field-label">{{ t('market.reviews.comment') }}</span>
                <textarea class="input min-h-24" maxlength="1000" [value]="comment()" (input)="comment.set($any($event.target).value)"></textarea>
                <span class="field-hint">{{ t('market.reviews.commentHint') }}</span>
              </label>
              @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
              <div class="flex flex-wrap gap-2">
                <button type="submit" class="btn btn-primary" [disabled]="busy() || stars() === 0">{{ d.mine ? t('market.reviews.update') : t('market.reviews.submit') }}</button>
                @if (d.mine) { <button type="button" class="btn btn-ghost text-danger-700" [disabled]="busy()" (click)="remove()">{{ t('market.reviews.remove') }}</button> }
              </div>
            </form>
          } @else if (d.cannotReviewReason && d.cannotReviewReason !== 'Staff') {
            <p class="text-sm text-muted">{{ t('market.reviews.reason.' + d.cannotReviewReason, { percent: 10 }) }}</p>
          }
        }
      </section>
    </ng-container>
  `,
})
export class AqReviews {
  private api = inject(MarketplaceService);
  readonly slug = input.required<string>();

  protected data = signal<Reviews | null>(null);
  protected stars = signal(0);
  protected comment = signal('');
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  private page = 1;

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => this.load(slug));
    });
  }

  protected starsText(n: number): string {
    const full = Math.round(n);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  protected share(n: number, total: number): number {
    return total ? Math.round((n / total) * 100) : 0;
  }

  protected date(iso: string): string {
    return iso.slice(0, 10);
  }

  protected save(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.saveReview(this.slug(), this.stars(), this.comment().trim() || null).subscribe({
      next: d => this.apply(d),
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }

  protected remove(): void {
    this.busy.set(true);
    this.api.deleteReview(this.slug()).subscribe({
      next: d => (this.apply(d), this.stars.set(0), this.comment.set('')),
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }

  protected more(): void {
    this.busy.set(true);
    const next = this.page + 1;
    this.api.reviews(this.slug(), next).subscribe({
      next: d => {
        this.page = next;
        this.data.update(cur => (cur ? { ...d, items: [...cur.items, ...d.items] } : d));
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  private load(slug: string): void {
    this.page = 1;
    this.api.reviews(slug, 1).subscribe({ next: d => this.apply(d), error: () => this.data.set(null) });
  }

  private apply(d: Reviews): void {
    this.busy.set(false);
    this.data.set(d);
    if (d.mine) {
      this.stars.set(d.mine.stars);
      this.comment.set(d.mine.comment ?? '');
    }
  }
}
