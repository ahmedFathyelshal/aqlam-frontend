import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { LegalService } from '@/app/core/legal/legal.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { LEGAL_DOCS } from '@/app/core/transloco/i18n/legal';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { AqLogo } from '@/app/shared/ui/logo';

/** Shown after sign-in when the terms or privacy texts changed (or were never accepted, e.g. imported accounts). */
@Component({
  selector: 'auth-legal-accept',
  imports: [TranslocoDirective, AqLogo],
  template: `
    <ng-container *transloco="let t">
      <div class="flex min-h-dvh items-start justify-center bg-page px-4 py-10 sm:items-center">
        <div class="card card-body w-full max-w-2xl">
          <aq-logo [size]="44" />
          <h1 class="mt-6 text-2xl font-extrabold">{{ t('legal.acceptTitle') }}</h1>
          <p class="mt-1 text-muted">{{ t('legal.acceptIntro') }}</p>
          <div class="alert alert-warning mt-4" role="note">{{ t('legal.draftBanner') }}</div>

          <div class="mt-4 max-h-80 overflow-y-auto rounded-ui border border-line p-4" tabindex="0" [attr.aria-label]="t('legal.acceptTitle')">
            @for (d of docs(); track d.title) {
              <h2 class="font-extrabold">{{ d.title }}</h2>
              @for (s of d.sections; track s.heading) {
                <p class="mt-2"><span class="font-bold">{{ s.heading }}</span> {{ s.text }}</p>
              }
              <hr class="my-4 border-line" />
            }
          </div>

          @if (error()) { <div class="alert alert-danger mt-4" role="alert">{{ error() }}</div> }
          <button type="button" class="btn btn-primary btn-block mt-5 min-h-12" [disabled]="busy()" (click)="accept()">{{ t('legal.acceptButton') }}</button>
        </div>
      </div>
    </ng-container>
  `,
})
export default class LegalAccept {
  private auth = inject(AuthService);
  private legal = inject(LegalService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected docs = computed(() => {
    const d = LEGAL_DOCS[this.i18n.lang() === 'ar' ? 'ar' : 'en'];
    return [d.terms, d.privacy];
  });
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected accept(): void {
    this.busy.set(true);
    this.error.set(null);
    this.legal.accept().subscribe({
      next: () => {
        this.auth.markLegalAccepted();
        void this.router.navigateByUrl(this.auth.homeRoute());
      },
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }
}
