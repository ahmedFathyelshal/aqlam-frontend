import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { formatPrice } from '@/app/core/marketplace/marketplace.service';
import { Payout, TeacherBusinessService, Wallet } from '@/app/core/marketplace/teacher-business.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/**
 * The teacher's wallet (Epic 6): what can be withdrawn now, what is still in the hold period, bank details, a
 * withdrawal request, and its history. Money is sent by bank transfer by the platform, outside the app.
 */
@Component({
  selector: 'app-wallet',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header class="page-header"><h1 class="page-title">{{ t('wallet.title') }}</h1></header>
        <p class="alert alert-info mb-6 flex items-start gap-2"><mat-icon svgIcon="info" class="icon-size-5 shrink-0" />{{ t('wallet.banner') }}</p>

        @if (error()) { <p class="field-error mb-4" role="alert">{{ error() }}</p> }

        @if (wallet(); as w) {
          <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="stat col-span-2 flex flex-col items-start gap-1 lg:col-span-1">
              <span class="stat-label">{{ t('wallet.available') }}</span>
              <span class="stat-value text-primary-700 tabular-nums">{{ money(w.available) }}</span>
            </div>
            <div class="stat flex flex-col items-start gap-1">
              <span class="stat-label">{{ t('wallet.pending') }}</span>
              <span class="stat-value tabular-nums">{{ money(w.pending) }}</span>
              <span class="text-xs text-muted">{{ t('wallet.pendingHint', { days: w.holdDays }) }}</span>
            </div>
            <div class="stat flex flex-col items-start gap-1">
              <span class="stat-label">{{ t('wallet.inTransit') }}</span>
              <span class="stat-value tabular-nums">{{ money(w.inTransit) }}</span>
              <span class="text-xs text-muted">{{ t('wallet.inTransitHint') }}</span>
            </div>
            <div class="stat flex flex-col items-start gap-1"><span class="stat-label">{{ t('wallet.total') }}</span><span class="stat-value tabular-nums">{{ money(w.total) }}</span></div>
          </div>

          <div class="grid items-start gap-6 lg:grid-cols-2">
            <section class="card" aria-labelledby="request-title">
              <div class="card-header"><h2 id="request-title" class="font-bold">{{ t('wallet.requestTitle') }}</h2></div>
              <div class="card-body flex flex-col gap-3">
                @if (w.openRequest; as open) {
                  <div class="alert alert-info" role="status">
                    <p class="font-bold tabular-nums">{{ money(open.amount) }}</p>
                    <p class="text-sm">{{ t('wallet.openRequest', { date: day(open.requestedAtUtc) }) }}</p>
                  </div>
                  @if (canWithdraw) {
                    <button type="button" class="btn btn-ghost w-fit" [disabled]="busy()" (click)="cancel(open)">{{ t('wallet.cancel') }}</button>
                  }
                } @else if (!canWithdraw) {
                  <p class="text-muted">{{ t('wallet.ownerOnly') }}</p>
                } @else if (!w.account) {
                  <p class="text-muted">{{ t('wallet.needAccount') }}</p>
                } @else {
                  <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); request()">
                    <label class="field"><span class="field-label">{{ t('wallet.amount', { currency: w.currency }) }}</span>
                      <input class="input" type="number" inputmode="decimal" min="0" step="0.01" dir="ltr" [value]="amount()" (input)="amount.set($any($event.target).value)" />
                      @if (w.minimumPayout) { <span class="field-hint">{{ t('wallet.minimum', { amount: money(w.minimumPayout) }) }}</span> }
                    </label>
                    <div class="flex flex-wrap items-center gap-3">
                      <button type="submit" class="btn btn-primary" [disabled]="busy() || !validAmount()">{{ t('wallet.request') }}</button>
                      <button type="button" class="btn btn-ghost" [disabled]="w.available <= 0" (click)="amount.set(w.available.toFixed(2))">{{ t('wallet.all') }}</button>
                    </div>
                    @if (w.available <= 0) { <p class="text-sm text-muted">{{ t('wallet.nothingAvailable') }}</p> }
                  </form>
                }
              </div>
            </section>

            <section class="card" aria-labelledby="bank-title">
              <div class="card-header flex items-center gap-2">
                <h2 id="bank-title" class="grow font-bold">{{ t('wallet.bankTitle') }}</h2>
                @if (w.account && canWithdraw && !editing()) { <button type="button" class="btn btn-ghost btn-sm" (click)="edit(w)">{{ t('wallet.edit') }}</button> }
              </div>
              <div class="card-body">
                @if (editing() || (!w.account && canWithdraw)) {
                  <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); saveAccount()">
                    <label class="field"><span class="field-label">{{ t('wallet.holder') }}</span>
                      <input class="input" maxlength="120" [value]="holder()" (input)="holder.set($any($event.target).value)" /></label>
                    <label class="field"><span class="field-label">{{ t('wallet.bank') }}</span>
                      <input class="input" maxlength="120" [value]="bank()" (input)="bank.set($any($event.target).value)" /></label>
                    <label class="field"><span class="field-label">{{ t('wallet.iban') }}</span>
                      <input class="input" dir="ltr" maxlength="40" autocomplete="off" [value]="iban()" (input)="iban.set($any($event.target).value)" />
                      <span class="field-hint">{{ t('wallet.ibanHint') }}</span></label>
                    <div class="flex gap-3">
                      <button type="submit" class="btn btn-primary" [disabled]="busy() || !holder().trim() || !bank().trim() || !iban().trim()">{{ t('wallet.saveBank') }}</button>
                      @if (w.account) { <button type="button" class="btn btn-ghost" (click)="editing.set(false)">{{ t('wallet.discard') }}</button> }
                    </div>
                  </form>
                } @else if (w.account; as a) {
                  <dl class="flex flex-col gap-2">
                    <div class="flex justify-between gap-3"><dt class="text-muted">{{ t('wallet.holder') }}</dt><dd class="font-semibold">{{ a.accountHolder }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-muted">{{ t('wallet.bank') }}</dt><dd class="font-semibold">{{ a.bankName }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-muted">{{ t('wallet.iban') }}</dt><dd class="font-mono font-semibold" dir="ltr">{{ masked(a.iban) }}</dd></div>
                  </dl>
                } @else {
                  <p class="text-muted">{{ t('wallet.noAccount') }}</p>
                }
              </div>
            </section>
          </div>

          <section class="mt-6" aria-labelledby="history-title">
            <h2 id="history-title" class="section-title mb-3">{{ t('wallet.history') }}</h2>
            @if (w.history.length) {
              <ul class="card divide-y divide-line-soft">
                @for (p of w.history; track p.id) {
                  <li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span class="font-bold tabular-nums">{{ money(p.amount) }}</span>
                    <span class="badge" [class]="badgeClass(p)">{{ t('wallet.status.' + p.status) }}</span>
                    <span class="grow text-sm text-muted">
                      {{ day(p.requestedAtUtc) }}
                      @if (p.transferReference) { · {{ t('wallet.reference') }}: <span dir="ltr">{{ p.transferReference }}</span> }
                      @if (p.rejectionReason) { · {{ p.rejectionReason }} }
                    </span>
                  </li>
                }
              </ul>
            } @else {
              <div class="empty card"><mat-icon svgIcon="landmark" class="empty-icon" /><p>{{ t('wallet.noHistory') }}</p></div>
            }
          </section>
        } @else if (!error()) {
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-24"></div> }</div>
        }
      </div>
    </ng-container>
  `,
})
export default class WalletComponent {
  private api = inject(TeacherBusinessService);
  private transloco = inject(TranslocoService);
  private org = inject(OrgContextService).activeOrg()?.slug ?? '';

  protected canWithdraw = inject(OrgContextService).can('finance.withdraw');
  protected wallet = signal<Wallet | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected amount = signal('');
  protected editing = signal(false);
  protected holder = signal('');
  protected bank = signal('');
  protected iban = signal('');

  protected validAmount = computed(() => {
    const n = Number(this.amount());
    return Number.isFinite(n) && n > 0;
  });

  constructor() {
    this.load();
  }

  protected request(): void {
    this.run(this.api.requestPayout(this.org, Number(this.amount())), () => this.amount.set(''));
  }

  protected cancel(p: Payout): void {
    this.run(this.api.cancelPayout(this.org, p.id));
  }

  protected saveAccount(): void {
    this.run(this.api.saveAccount(this.org, { accountHolder: this.holder().trim(), bankName: this.bank().trim(), iban: this.iban().trim() }), () => this.editing.set(false));
  }

  protected edit(w: Wallet): void {
    this.holder.set(w.account?.accountHolder ?? '');
    this.bank.set(w.account?.bankName ?? '');
    this.iban.set(w.account?.iban ?? '');
    this.editing.set(true);
  }

  protected money(amount: number): string {
    return formatPrice(amount, this.wallet()?.currency ?? 'SAR', this.transloco.getActiveLang());
  }

  /** The number is only shown in part on screen: "SA03 •••• 7519". */
  protected masked(iban: string): string {
    return iban.length > 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban;
  }

  protected badgeClass(p: Payout): string {
    return p.status === 'Paid' ? 'badge-success' : p.status === 'Requested' ? 'badge-warning' : 'badge-neutral';
  }

  protected day(iso: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  private load(): void {
    this.api.wallet(this.org).subscribe({ next: w => this.wallet.set(w), error: (err: unknown) => this.error.set(errorMessages(err, 'Error').join(' ')) });
  }

  private run(call: import('rxjs').Observable<unknown>, done?: () => void): void {
    this.error.set(null);
    this.busy.set(true);
    call.subscribe({
      next: () => (done?.(), this.busy.set(false), this.load()),
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }
}
