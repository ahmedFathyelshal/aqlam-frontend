import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ApiEndpoints } from '@/app/core/constants/api-endpoints';

/** Recovery by emailed link when the account has an email; otherwise the school or the child's parent resets it. */
@Component({
  selector: 'auth-forgot-password',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary-100 text-secondary-600">
        <mat-icon svgIcon="key-round" class="icon-size-7" />
      </div>
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ t('auth.forgotTitle') }}</h1>
      <p class="mt-3 text-[1.05rem] leading-relaxed">{{ t('auth.forgotBody') }}</p>

      <form class="mt-5 flex flex-col gap-4" (submit)="submit($event)" novalidate>
        <label class="field">
          <span class="field-label">{{ t('auth.forgotIdentifier') }}</span>
          <input class="input" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false"
                 [value]="identifier()" (input)="identifier.set($any($event.target).value)" />
        </label>
        @if (sent()) { <div class="alert alert-success" role="status">{{ t('auth.forgotSent') }}</div> }
        <button type="submit" class="btn btn-primary btn-block min-h-12" [disabled]="busy() || !identifier().trim()">{{ t('auth.forgotSend') }}</button>
      </form>

      <div class="mt-6 rounded-ui bg-page p-4">
        <h2 class="font-bold">{{ t('auth.forgotOtherTitle') }}</h2>
        <ul class="mt-2 list-disc ps-5 leading-relaxed text-muted">
          <li>{{ t('auth.forgotOtherSchool') }}</li>
          <li>{{ t('auth.forgotOtherParent') }}</li>
        </ul>
      </div>
      <a routerLink="/auth/sign-in" class="btn btn-secondary btn-block mt-6">{{ t('auth.backToSignIn') }}</a>
    </ng-container>
  `,
})
export default class AuthForgotPassword {
  private http = inject(HttpClient);

  protected identifier = signal('');
  protected busy = signal(false);
  protected sent = signal(false);

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.identifier().trim()) return;
    this.busy.set(true);
    this.sent.set(false);
    // The answer is always the same, so the page never reveals whether an account exists.
    const done = () => (this.busy.set(false), this.sent.set(true));
    this.http.post(ApiEndpoints.Auth.ForgotPassword, { identifier: this.identifier().trim() }).subscribe({ next: done, error: done });
  }
}
