import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { map, switchMap, takeWhile, timer } from 'rxjs';

import { formatPrice, MarketplaceService, PaymentStatus } from '@/app/core/marketplace/marketplace.service';

/** Always first on test pages: this cannot be mistaken for a real card payment. */
@Component({
  selector: 'aq-test-banner',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <div *transloco="let t" role="note" class="border-b-2 border-warning-500 bg-warning-50 px-4 py-3 text-warning-700">
      <p class="mx-auto flex max-w-[760px] items-center gap-2 font-bold"><mat-icon svgIcon="flask-conical" class="icon-size-5" />{{ t('checkout.testBanner') }}</p>
    </div>
  `,
})
export class TestBanner {}

/**
 * The test provider's checkout (no real gateway is connected yet). There is no card form: the student chooses the
 * outcome, which runs the same confirmation a provider notification would.
 */
@Component({
  selector: 'app-test-checkout',
  imports: [RouterLink, MatIconModule, TranslocoDirective, TestBanner],
  template: `
    <ng-container *transloco="let t">
      <aq-test-banner />
      <div class="mx-auto max-w-[760px] px-4 py-8">
        <h1 class="page-title flex items-center gap-2">{{ t('checkout.title') }} <span class="badge badge-warning">{{ t('checkout.testBadge') }}</span></h1>
        @if (missing()) {
          <p class="alert alert-danger mt-4">{{ t('checkout.unavailable') }}</p>
        } @else if (payment(); as p) {
          <div class="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
            <section class="card card-body flex flex-col gap-4 md:order-2">
              <h2 class="section-title">{{ t('checkout.summary') }}</h2>
              <p class="font-semibold">{{ p.courseTitle }}</p>
              @if (p.forStudentName) { <p class="text-sm text-muted">{{ t('age.forStudent', { name: p.forStudentName }) }}</p> }
              <dl class="flex items-baseline justify-between border-t border-line-soft pt-3">
                <dt class="text-muted">{{ t('checkout.total') }}</dt>
                <dd class="text-xl font-bold tabular-nums">{{ amount() }}</dd>
              </dl>
            </section>
            <section class="card card-body flex flex-col gap-4">
              <h2 class="section-title">{{ t('checkout.outcome') }}</h2>
              <p class="text-sm text-muted">{{ t('checkout.outcomeHint') }}</p>
              <fieldset class="flex flex-col gap-2">
                <legend class="sr-only-text">{{ t('checkout.outcome') }}</legend>
                @for (o of outcomes; track o.value) {
                  <label class="card flex min-h-14 cursor-pointer items-center gap-3 p-4 has-[:checked]:border-deep has-[:checked]:bg-page">
                    <input type="radio" name="outcome" class="size-5 accent-primary-600" [checked]="succeed() === o.value" (change)="succeed.set(o.value)" />
                    {{ t(o.label) }}
                  </label>
                }
              </fieldset>
              <button type="button" class="btn btn-primary btn-block min-h-13" [disabled]="busy() || p.status !== 'Pending'" (click)="pay(p)">
                {{ busy() ? t('checkout.paying') : t('checkout.pay', { amount: amount() }) }}
              </button>
              <p class="text-sm text-muted">{{ t('checkout.reassure') }} {{ t('checkout.access') }}</p>
              @if (p.coursePublicSlug) {
                <a class="btn btn-ghost btn-block" [routerLink]="['/courses', p.coursePublicSlug]">{{ t('checkout.cancel') }}</a>
              }
            </section>
          </div>
        } @else {
          <div class="skeleton mt-5 h-64 w-full" aria-hidden="true"></div>
        }
      </div>
    </ng-container>
  `,
})
export class TestCheckoutPage {
  private api = inject(MarketplaceService);
  private router = inject(Router);
  private transloco = inject(TranslocoService);

  protected readonly outcomes = [
    { value: true, label: 'checkout.succeed' },
    { value: false, label: 'checkout.decline' },
  ];
  protected payment = signal<PaymentStatus | null>(null);
  protected missing = signal(false);
  protected busy = signal(false);
  protected succeed = signal(true);
  protected amount = computed(() => {
    const p = this.payment();
    return p ? formatPrice(p.amount, p.currency, this.transloco.getActiveLang()) : '';
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        switchMap(params => this.api.payment(params.get('paymentId') ?? '')),
        takeUntilDestroyed()
      )
      .subscribe({
        next: p => (p.status === 'Pending' ? this.payment.set(p) : this.router.navigate(['/checkout', p.paymentId], { replaceUrl: true })),
        error: () => this.missing.set(true),
      });
  }

  protected pay(p: PaymentStatus): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.completeTestPayment(p.paymentId, this.succeed()).subscribe({
      next: () => this.router.navigate(['/checkout', p.paymentId], { replaceUrl: true }),
      error: () => (this.busy.set(false), this.missing.set(true)),
    });
  }
}

/** Payment result: waits for the confirmation (polling up to a minute), then success, failure or "still waiting". */
@Component({
  selector: 'app-payment-result',
  imports: [RouterLink, MatIconModule, TranslocoDirective, TestBanner],
  template: `
    <ng-container *transloco="let t">
      <aq-test-banner />
      <div class="mx-auto max-w-[640px] px-4 py-10">
        @if (missing()) {
          <p class="alert alert-danger">{{ t('checkout.unavailable') }}</p>
        } @else if (payment(); as p) {
          <section class="card card-body flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
            @switch (p.status) {
              @case ('Succeeded') {
                <span class="flex size-16 items-center justify-center rounded-full bg-primary-100 text-primary-700"><mat-icon svgIcon="check" class="icon-size-8" /></span>
                <h1 class="font-display text-[2rem] font-bold">{{ t('checkout.successTitle') }}</h1>
                <p>{{ p.forStudentName ? t('age.boughtFor', { course: p.courseTitle, name: p.forStudentName }) : t('checkout.successBody', { course: p.courseTitle }) }}</p>
                <p class="text-sm text-muted">{{ t('checkout.amount', { amount: amount() }) }}</p>
                @if (!p.forStudentName) {
                  <a class="btn btn-primary mt-2 min-h-12" [routerLink]="['/learn', p.organizationSlug, p.courseId]">{{ t('checkout.startLearning') }}</a>
                }
              }
              @case ('Failed') {
                <span class="flex size-16 items-center justify-center rounded-full bg-danger-50 text-danger-700"><mat-icon svgIcon="x" class="icon-size-8" /></span>
                <h1 class="font-display text-[2rem] font-bold">{{ t('checkout.failedTitle') }}</h1>
                <p>{{ t('checkout.failedBody') }}</p>
                @if (p.coursePublicSlug) {
                  <div class="mt-2 flex flex-wrap justify-center gap-2">
                    <a class="btn btn-primary min-h-12" [routerLink]="['/courses', p.coursePublicSlug]">{{ t('checkout.tryAgain') }}</a>
                  </div>
                }
              }
              @default {
                <span class="flex size-16 items-center justify-center rounded-full bg-warning-50 text-warning-700"><mat-icon svgIcon="clock" class="icon-size-8" /></span>
                <h1 class="font-display text-[2rem] font-bold">{{ late() ? t('checkout.lateTitle') : t('checkout.pendingTitle') }}</h1>
                <p>{{ late() ? t('checkout.lateBody') : t('checkout.pendingBody') }}</p>
                @if (late()) {
                  <button type="button" class="btn btn-outline mt-2" (click)="poll()">{{ t('checkout.checkAgain') }}</button>
                }
              }
            }
            @if (p.status !== 'Succeeded' && p.coursePublicSlug) {
              <a class="btn btn-ghost" [routerLink]="['/courses', p.coursePublicSlug]">{{ t('checkout.backToCourse') }}</a>
            }
          </section>
        } @else {
          <div class="skeleton h-72 w-full" aria-hidden="true"></div>
        }
      </div>
    </ng-container>
  `,
})
export class PaymentResultPage {
  private api = inject(MarketplaceService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  private id = '';

  protected payment = signal<PaymentStatus | null>(null);
  protected missing = signal(false);
  protected late = signal(false);
  protected amount = computed(() => {
    const p = this.payment();
    return p ? formatPrice(p.amount, p.currency, this.transloco.getActiveLang()) : '';
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(map(p => p.get('paymentId') ?? ''), takeUntilDestroyed())
      .subscribe(id => ((this.id = id), this.poll()));
  }

  /** Every 2 seconds for a minute while the payment is pending. */
  protected poll(): void {
    this.late.set(false);
    timer(0, 2000)
      .pipe(
        switchMap(() => this.api.payment(this.id)),
        takeWhile((p, i) => p.status === 'Pending' && i < 30, true),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: p => this.payment.set(p),
        error: () => this.missing.set(true),
        complete: () => this.late.set(this.payment()?.status === 'Pending'),
      });
  }
}
