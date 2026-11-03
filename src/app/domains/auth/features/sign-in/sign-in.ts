import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

/** Username + password on one screen (usernames, not phones, identify accounts: siblings share a phone). */
@Component({
  selector: 'auth-sign-in',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ t('auth.signIn') }}</h1>
      <p class="mt-1 text-muted">{{ t('auth.welcome') }}</p>

      @if (created) {
        <div class="alert alert-success mt-5" role="status">{{ t('auth.created') }}</div>
      }

      <form class="mt-6 flex flex-col gap-4" (submit)="submit($event)" novalidate>
        <label class="field">
          <span class="field-label">{{ t('auth.userName') }}</span>
          <input class="input" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false"
                 [value]="userName()" (input)="userName.set($any($event.target).value)" [attr.aria-invalid]="touched() && !userName().trim()" />
          @if (touched() && !userName().trim()) { <span class="field-error">{{ t('auth.required') }}</span> }
        </label>

        <label class="field">
          <span class="field-label">{{ t('auth.password') }}</span>
          <span class="relative">
            <input class="input pe-12" [type]="showPassword() ? 'text' : 'password'" autocomplete="current-password"
                   [value]="password()" (input)="password.set($any($event.target).value)" [attr.aria-invalid]="touched() && !password()" />
            <button type="button" class="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-muted"
                    [attr.aria-label]="showPassword() ? t('auth.hidePassword') : t('auth.showPassword')" (click)="showPassword.set(!showPassword())">
              <mat-icon [svgIcon]="showPassword() ? 'eye-off' : 'eye'" class="icon-size-5" />
            </button>
          </span>
          @if (touched() && !password()) { <span class="field-error">{{ t('auth.required') }}</span> }
        </label>

        <div class="flex justify-end">
          <a routerLink="/auth/forgot-password" class="text-[0.95rem] font-bold">{{ t('auth.forgot') }}</a>
        </div>

        @if (error()) {
          <div class="alert alert-danger" role="alert"><mat-icon svgIcon="circle-alert" class="icon-size-5 shrink-0" />{{ error() }}</div>
        }

        <button type="submit" class="btn btn-primary btn-block min-h-12 text-lg" [disabled]="busy()">{{ t('auth.signInButton') }}</button>
      </form>

      <div class="my-6 flex items-center gap-3 text-sm text-muted"><span class="h-px flex-1 bg-line"></span>{{ t('auth.or') }}<span class="h-px flex-1 bg-line"></span></div>
      <p class="text-center text-[0.95rem]">
        {{ t('auth.noAccount') }} <a routerLink="/auth/sign-up" class="font-bold">{{ t('auth.createAccount') }}</a>
      </p>
    </ng-container>
  `,
})
export default class AuthSignIn {
  private router = inject(Router);
  private auth = inject(AuthService);
  private transloco = inject(TranslocoService);

  protected created = inject(ActivatedRoute).snapshot.queryParamMap.has('created');
  protected userName = signal('');
  protected password = signal('');
  protected showPassword = signal(false);
  protected touched = signal(false);
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected submit(event: Event): void {
    event.preventDefault();
    this.touched.set(true);
    this.error.set(null);
    if (!this.userName().trim() || !this.password()) return;

    this.busy.set(true);
    this.auth.signIn({ userName: this.userName().trim(), password: this.password() }).subscribe({
      next: () => {
        this.busy.set(false);
        const redirect = safeRedirect(this.router);
        this.router.navigateByUrl(this.auth.user()?.mustChangePassword ? '/account/password' : redirect ?? this.auth.homeRoute());
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiValidationError ? err.errors.join(' ') : this.transloco.translate('auth.failed'));
      },
    });
  }
}

/** A safe in-app path from ?redirectURL= (never an absolute URL). */
function safeRedirect(router: Router): string | null {
  const target = router.parseUrl(router.url).queryParams['redirectURL'] as string | undefined;
  return target && target.startsWith('/') && !target.startsWith('//') ? target : null;
}
