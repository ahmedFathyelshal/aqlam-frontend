import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { pluralKey } from '@/app/core/transloco/plural';

import { formatPrice } from '@/app/core/marketplace/marketplace.service';
import { Earnings, TeacherBusinessService } from '@/app/core/marketplace/teacher-business.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

/** "سارة محمد" → "سارة م." (buyers may be minors); a single word stays as it is. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return name;
  const last = words[words.length - 1];
  const family = last.startsWith('ال') && last.length > 3 ? last.slice(2) : last; // "القحطاني" → "ق."
  return `${words[0]} ${Array.from(family)[0]}.`;
}

/**
 * Sales, commission and net earnings, and (independent teachers) the monthly fee statement. Nothing is charged yet,
 * and every figure says so.
 */
@Component({
  selector: 'app-earnings',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header class="page-header">
          <h1 class="page-title">{{ t('earnings.title') }}</h1>
        </header>
        <p class="alert alert-info mb-6 flex items-start gap-2"><mat-icon svgIcon="info" class="icon-size-5 shrink-0" />{{ t('earnings.banner') }} {{ t('earnings.testSales') }}</p>

        @if (data(); as d) {
          @for (m of totals(); track m.currency) {
            <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div class="stat col-span-2 flex flex-col items-start gap-1 lg:col-span-1">
                <span class="stat-label">{{ t('earnings.net') }}</span>
                <span class="stat-value text-primary-700 tabular-nums">{{ money(m.net, m.currency) }}</span>
              </div>
              <div class="stat flex flex-col items-start gap-1"><span class="stat-label">{{ t('earnings.gross') }}</span><span class="stat-value tabular-nums">{{ money(m.gross, m.currency) }}</span></div>
              <div class="stat flex flex-col items-start gap-1">
                <span class="stat-label">{{ d.commissionPercent !== null ? t('earnings.commissionRate', { rate: d.commissionPercent }) : t('earnings.commission') }}</span>
                <span class="stat-value tabular-nums">{{ money(m.commission, m.currency) }}</span>
                @if (d.commissionPercent === null) { <span class="text-xs text-muted">{{ t('earnings.commissionNotSet') }}</span> }
              </div>
              <div class="stat flex flex-col items-start gap-1"><span class="stat-label">{{ t('earnings.fees') }}</span><span class="stat-value tabular-nums">{{ money(m.providerFees, m.currency) }}</span></div>
            </div>
          }

          <div class="grid items-start gap-6" [class.lg:grid-cols-[minmax(0,1fr)_360px]]="d.monthlyFee">
            <section aria-labelledby="sales-title">
              <h2 id="sales-title" class="section-title mb-3">{{ t('earnings.recent') }}</h2>
              @if (d.recentSales.length) {
                <div class="table-wrap max-sm:hidden">
                  <table class="table">
                    <thead><tr><th>{{ t('earnings.date') }}</th><th>{{ t('earnings.course') }}</th><th>{{ t('earnings.student') }}</th><th class="text-end">{{ t('earnings.amount') }}</th><th class="text-end">{{ t('earnings.commission') }}</th><th class="text-end">{{ t('earnings.netShort') }}</th></tr></thead>
                    <tbody>
                      @for (s of d.recentSales; track s.paymentId) {
                        <tr>
                          <td class="whitespace-nowrap">{{ day(s.paidAtUtc) }}</td>
                          <td>{{ s.courseTitle }}</td>
                          <td>{{ short(s.studentName) }}</td>
                          <td class="text-end tabular-nums">{{ money(s.amount, s.currency) }}</td>
                          <td class="text-end tabular-nums">{{ money(s.commission, s.currency) }}</td>
                          <td class="text-end font-bold tabular-nums">{{ money(s.net, s.currency) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <ul class="card divide-y divide-line-soft sm:hidden">
                  @for (s of d.recentSales; track s.paymentId) {
                    <li class="flex flex-col gap-1 px-4 py-3">
                      <div class="flex items-center gap-2"><span class="grow truncate font-semibold">{{ s.courseTitle }}</span><span class="font-bold tabular-nums">{{ money(s.net, s.currency) }}</span></div>
                      <p class="text-sm text-muted">{{ short(s.studentName) }} · {{ day(s.paidAtUtc) }} · {{ money(s.amount, s.currency) }}</p>
                    </li>
                  }
                </ul>
              } @else {
                <div class="empty card"><mat-icon svgIcon="wallet" class="empty-icon" /><p>{{ t('earnings.noSales') }}</p></div>
              }
            </section>

            @if (d.monthlyFee; as f) {
              <section class="card" aria-labelledby="fee-title">
                <div class="card-header flex flex-wrap items-center gap-2">
                  <h2 id="fee-title" class="grow font-bold">{{ t('earnings.feeTitle', { month: month(f.month) }) }}</h2>
                  <span class="badge badge-neutral">{{ t('earnings.statementOnly') }}</span>
                </div>
                <div class="card-body flex flex-col gap-3">
                  <dl class="flex flex-col gap-2">
                    <div class="flex justify-between"><dt class="text-muted">{{ t('earnings.counted') }}</dt><dd class="font-bold tabular-nums">{{ f.countedStudents }}</dd></div>
                    <div class="flex justify-between"><dt class="text-muted">{{ t('earnings.rate') }}</dt><dd class="font-semibold tabular-nums">{{ f.ratePerStudent !== null ? money(f.ratePerStudent, f.currency) : '—' }}</dd></div>
                    @if (f.amount !== null) {
                      <div class="flex justify-between border-t border-line-soft pt-2"><dt class="font-semibold">{{ t('earnings.ifBilled') }}</dt><dd class="text-lg font-bold tabular-nums">{{ money(f.amount, f.currency) }}</dd></div>
                    }
                  </dl>
                  @if (f.ratePerStudent === null) { <p class="text-sm text-muted">{{ t('earnings.rateNotSet') }}</p> }
                  @if (!f.countedStudents) { <p class="text-sm text-muted">{{ t('earnings.zero') }}</p> }
                  @if (f.excludedBuyers) { <p class="text-sm">{{ t(plural('earnings.excluded', f.excludedBuyers), { count: f.excludedBuyers }) }}</p> }
                  <div class="border-t border-line-soft pt-3">
                    <h3 class="text-sm font-bold">{{ t('earnings.whoCounts') }}</h3>
                    <ul class="mt-2 flex flex-col gap-1.5 text-sm">
                      <li class="flex gap-2"><mat-icon svgIcon="check" class="icon-size-4 shrink-0 text-primary-600" />{{ t('earnings.counts1') }}</li>
                      <li class="flex gap-2"><mat-icon svgIcon="minus" class="icon-size-4 shrink-0 text-muted" />{{ t('earnings.counts2') }}</li>
                      <li class="flex gap-2"><mat-icon svgIcon="minus" class="icon-size-4 shrink-0 text-muted" />{{ t('earnings.counts3') }}</li>
                    </ul>
                  </div>
                </div>
              </section>
            }
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-24"></div> }</div>
        }
      </div>
    </ng-container>
  `,
})
export default class EarningsComponent {
  /** The plural form of a counted text for the reader's language (Arabic: one, two, 3–10, 11+). */
  protected plural = (key: string, count: number) => pluralKey(key, count, this.transloco.getActiveLang());
  private api = inject(TeacherBusinessService);
  private transloco = inject(TranslocoService);
  protected data = signal<Earnings | null>(null);
  protected short = shortName;

  /** With no sales yet, the totals still show zero in the organization's currency. */
  protected totals = computed(() => {
    const d = this.data();
    if (!d) return [];
    return d.totals.length ? d.totals : [{ currency: d.currency, gross: 0, commission: 0, providerFees: 0, net: 0 }];
  });

  constructor() {
    const org = inject(OrgContextService).activeOrg()?.slug ?? '';
    this.api.earnings(org).subscribe(d => this.data.set(d));
  }

  protected money(amount: number, currency: string): string {
    return formatPrice(amount, currency, this.transloco.getActiveLang());
  }

  protected day(iso: string): string {
    return new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  protected month(yyyyMm: string): string {
    const [y, m] = yyyyMm.split('-').map(Number);
    return new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
  }

  private locale(): string {
    return this.transloco.getActiveLang() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB';
  }
}
