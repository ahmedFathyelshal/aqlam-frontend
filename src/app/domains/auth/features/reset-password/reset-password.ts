import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** Opened from the emailed link: /auth/reset-password?user=...&token=... */
@Component({
  selector: 'auth-reset-password',
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ t('auth.resetTitle') }}</h1>
      @if (!userId || !token) {
        <div class="alert alert-danger mt-5" role="alert">{{ t('auth.resetInvalid') }}</div>
        <a routerLink="/auth/forgot-password" class="btn btn-secondary btn-block mt-6">{{ t('auth.forgot') }}</a>
      } @else if (done()) {
        <div class="alert alert-success mt-5" role="status">{{ t('auth.resetDone') }}</div>
        <a routerLink="/auth/sign-in" class="btn btn-primary btn-block mt-6">{{ t('auth.signIn') }}</a>
      } @else {
        <form class="mt-6 flex flex-col gap-4" (submit)="submit($event)" novalidate>
          <label class="field">
            <span class="field-label">{{ t('auth.newPassword') }}</span>
            <input class="input" type="password" autocomplete="new-password" [value]="next()" (input)="next.set($any($event.target).value)" />
            <span [class]="touched() && next().length < 8 ? 'field-error' : 'field-hint'">{{ t('auth.passwordRule') }}</span>
          </label>
          <label class="field">
            <span class="field-label">{{ t('auth.confirmPassword') }}</span>
            <input class="input" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set($any($event.target).value)" />
            @if (touched() && confirm() !== next()) { <span class="field-error">{{ t('auth.mismatch') }}</span> }
          </label>
          @if (errors().length) { <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div> }
          <button type="submit" class="btn btn-primary btn-block min-h-12" [disabled]="busy()">{{ t('auth.resetButton') }}</button>
        </form>
      }
    </ng-container>
  `,
})
export default class AuthResetPassword {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected userId = this.route.snapshot.queryParamMap.get('user');
  protected token = this.route.snapshot.queryParamMap.get('token');
  protected next = signal('');
  protected confirm = signal('');
  protected touched = signal(false);
  protected busy = signal(false);
  protected done = signal(false);
  protected errors = signal<string[]>([]);

  constructor() {
    // Keep the token out of the address bar and history once read.
    if (this.token) void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.touched.set(true);
    this.errors.set([]);
    if (this.next().length < 8 || this.confirm() !== this.next()) return;
    this.busy.set(true);
    this.http.post(ApiEndpoints.Auth.ResetPassword, { userId: this.userId, token: this.token, newPassword: this.next() }).subscribe({
      next: () => this.done.set(true),
      error: (err: unknown) => {
        this.busy.set(false);
        this.errors.set(errorMessages(err, 'Error'));
      },
    });
  }
}
