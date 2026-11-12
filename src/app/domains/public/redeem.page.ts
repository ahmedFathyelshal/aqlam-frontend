import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { Redeemed } from '@/app/core/marketplace/marketplace.service';
import { AqCodeRedeem } from '@/app/shared/marketplace/code-redeem';

/** "Have an activation code?" from the student home: the code itself says which course it opens. */
@Component({
  selector: 'app-redeem',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqCodeRedeem],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto max-w-[560px] px-4 py-10">
        @if (done(); as d) {
          <section class="card card-body flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
            <span class="flex size-16 items-center justify-center rounded-full bg-primary-100 text-primary-700"><mat-icon svgIcon="check" class="icon-size-8" /></span>
            <h1 class="font-display text-[2rem] font-bold">{{ t('codes.successTitle') }}</h1>
            <p>{{ t('codes.successBody', { course: d.courseTitle }) }}</p>
            <a class="btn btn-primary mt-2 min-h-12" [routerLink]="['/learn', d.organizationSlug, d.courseId]">{{ t('codes.start') }}</a>
          </section>
        } @else {
          <section class="card card-body flex flex-col gap-4">
            <h1 class="page-title flex items-center gap-2"><mat-icon svgIcon="key-round" class="icon-size-6 text-primary-600" />{{ t('codes.title') }}</h1>
            <p class="text-muted">{{ t('codes.homeBody') }}</p>
            <aq-code-redeem (redeemed)="done.set($event)" />
          </section>
        }
      </div>
    </ng-container>
  `,
})
export default class RedeemPage {
  protected done = signal<Redeemed | null>(null);
}
